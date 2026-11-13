/**
 * A deck's pictures and its design, changed on the server: Add to all slides, Another
 * picture, Remove, From my phone, Find more, and another design. None is an AI edit.
 *
 * Each is a new version of the draft, made by the server, so the deck's saves go first
 * and the deck is held while one runs (`busy`), as for a send; its answer is taken as one
 * step of history (`adopt`). Remove and design answer at once; the rest are a picture
 * task, followed until it is done. One at a time.
 */
import type { components } from '../../generated/api/schema'
import type { DeckDraft } from '~/composables/useDeckEditor'
import type { DeckCategory } from '~/components/deck/DesignPicker.vue'

export type PictureAction = 'fill' | 'next' | 'upload' | 'search' | 'remove'
export type PictureStyle = 'photo' | 'illustration'
type PictureTask = components['schemas']['DeckPhotoTask']
type PicturesState = components['schemas']['DeckPictures']

/** The longest edge a phone's photo is sent at: the server keeps 1600 px of it. */
export const UPLOAD_EDGE = 1600
const UPLOAD_QUALITY = 0.86
const POLL_WAITS = [400, 600, 900, 1300, 2000]
/** A fill takes up to about two minutes on the server, three at most (its lease); past this the deck is let go. */
const FOLLOW_FOR = 240_000
const REQUEST_TIMEOUT = 20_000

const codeOf = (e: any): string => e?.data?.error?.code || ''

/** A photo decoded upright: as a bitmap where the browser can, else through an <img> (older iOS WebViews). */
async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
      return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close?.() }
    } catch {
      // Some WebViews refuse the options, or the type: the <img> below decodes what the browser shows.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, done: () => URL.revokeObjectURL(url) }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

/** A phone's photo as a JPEG at most UPLOAD_EDGE on its long side, upright: what the server would keep anyway. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await decode(file)
  if (!bitmap.width || !bitmap.height) throw new Error('empty')
  const scale = Math.min(1, UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('no_canvas')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap.source, 0, 0, canvas.width, canvas.height)
  bitmap.done()
  return await new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no_blob'))), 'image/jpeg', UPLOAD_QUALITY),
  )
}

export function useDeckPictures() {
  const ws = useWorkspace()
  const deck = useDeckEditor()
  const snackbar = useEditorSnackbar()
  const telegram = useTelegramApp()
  const { t, locale } = useLocale()

  /** What runs now: its action and slide, for the sheet to say. */
  const running = useState<{ action: PictureAction | 'design'; section: string | null } | null>(
    'deck-pictures-running',
    () => null,
  )
  /** The last thing said about an action, in the sheet's live line; '' when nothing is. */
  const message = useState('deck-pictures-message', () => '')
  const designs = useState<{ locale: string; categories: DeckCategory[] }>('deck-design-list', () => ({
    locale: '',
    categories: [],
  }))
  const designsFailed = useState('deck-design-failed', () => false)
  /** The slide a photo is being chosen for, from the frame's one file input. */
  const pickFor = useState<string | null>('deck-pictures-pick', () => null)
  const chosenStyle = useState<PictureStyle | null>('deck-pictures-style', () => null)

  const state = computed<PicturesState | null>(() => (deck.draft.value as any)?.pictures ?? null)
  const on = computed(() => state.value?.on === true)
  const style = computed<PictureStyle>({
    get: () => chosenStyle.value ?? state.value?.style ?? 'photo',
    set: (value) => (chosenStyle.value = value),
  })
  const photos = computed(() => deck.draft.value?.render?.photos ?? {})
  const pictureUrl = (asset: string) => `/api/v1/generation/drafts/${deck.draftId.value}/pictures/${asset}.jpg`

  /** What a refusal or a failed task says, in this app's own words. */
  function words(code: string, params: Record<string, any> = {}) {
    switch (code) {
      case 'photos_limit':
        return params.limit_kind === 'deck'
          ? t('deckPicturesDeckFull', { max: params.limit ?? state.value?.per_deck ?? 12 })
          : params.limit_kind === 'search_minute'
            ? t('deckPicturesSearchMinute')
            : params.limit_kind === 'search'
              ? t('deckPicturesSearchDay')
              : t('deckPicturesFillDay')
      case 'photos_unavailable':
        return t('deckPicturesNoLibrary')
      case 'picture_unavailable':
        return t('deckPictureUnavailable')
      case 'picture_no_room':
        return t('deckPictureNoRoom')
      case 'invalid_image':
        return t('deckPictureUnreadable')
      case 'deck_pictures_complete':
        return t('deckPicturesComplete')
      case 'lane_busy':
      case 'rate_limited':
        return t('deckPicturesBusy')
      case 'generation_running':
        return t('editorHeld')
      default:
        return t('genericError')
    }
  }

  /**
   * Each action belongs to the opening of the deck it was tapped on: once another deck is
   * opened, or this one again, it lets go and nothing of it lands on the screen.
   */
  const opening = () => {
    const at = deck.openings.value
    return () => deck.openings.value === at
  }

  /** The task until it ends, or null once it is past waiting for or its opening is over. */
  async function follow(id: string, task: string, alive: () => boolean): Promise<PictureTask | null> {
    const end = Date.now() + FOLLOW_FOR
    for (let attempt = 0; Date.now() < end; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_WAITS[Math.min(attempt, POLL_WAITS.length - 1)]))
      if (!alive()) return null
      try {
        const answer = await ws.api<PictureTask>(`/generation/drafts/${id}/photos/${task}`, {
          timeout: REQUEST_TIMEOUT,
        })
        if (answer.status === 'done' || answer.status === 'failed') return answer
      } catch (e) {
        if (codeOf(e) === 'not_found') return null
      }
    }
    return null
  }

  /** The slides whose picture the server changed, from its draft and the one here. */
  function picturesChanged(fresh: DeckDraft) {
    const before = photos.value as Record<string, { asset_id?: string | null } | undefined>
    const after = (fresh.render?.photos ?? {}) as Record<string, { asset_id?: string | null } | undefined>
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
      (id) => (before[id]?.asset_id ?? null) !== (after[id]?.asset_id ?? null),
    )
  }

  /**
   * The draft as the server now has it, taken as one step, if it moved on. After every
   * ending, the unclear ones too (an answer lost, a task past waiting for), so the next
   * save never meets a version this screen did not know of. True when it could ask.
   */
  async function readBack(id: string, alive: () => boolean, changed?: 'all') {
    try {
      const fresh = await ws.api<DeckDraft>(`/generation/drafts/${id}`, { timeout: REQUEST_TIMEOUT })
      if (alive() && fresh.version > deck.version.value) deck.adopt(fresh, changed ?? picturesChanged(fresh))
      return true
    } catch {
      return false
    }
  }

  /**
   * Holds the deck for one action: what is typed goes first, then nothing more is typed or
   * sent until it ends. False when another is under way or the deck could not be saved.
   */
  async function hold(action: PictureAction | 'design', section: string | null) {
    if (running.value || deck.busy.value || !deck.editable.value) return false
    message.value = ''
    running.value = { action, section }
    deck.busy.value = action
    if (await deck.flush()) return true
    message.value = t('editorNotSaved')
    letGo()
    return false
  }
  function letGo() {
    deck.busy.value = null
    running.value = null
  }

  /**
   * One action on a held deck, start to end: its result, true for one answered at once,
   * or null. Whatever happens the deck is let go after, and the sheet's line says what
   * came of it.
   */
  async function act(
    action: PictureAction,
    body: Record<string, unknown>,
    alive: () => boolean,
  ): Promise<PictureTask['result'] | true | null> {
    const id = deck.draftId.value
    const section = typeof body.section_id === 'string' ? body.section_id : null
    let landed = false
    let unclear = false
    try {
      const answer = await ws.api<any>(`/generation/drafts/${id}/photos`, {
        method: 'POST',
        body: { action, version: deck.version.value, style: style.value, ...body },
        timeout: REQUEST_TIMEOUT,
      })
      if (!alive()) return null
      if (action === 'remove') {
        deck.adopt(answer as DeckDraft, section ? [section] : [])
        return true
      }
      const done = answer.status === 'done' || answer.status === 'failed' ? answer : await follow(id, answer.task_id, alive)
      if (!alive()) return null
      if (!done) {
        unclear = true
        message.value = t('deckPicturesSlow')
        return null
      }
      if (done.status === 'failed') {
        if (done.error === 'version_conflict') deck.holdForChoice()
        else message.value = words(done.error || '')
        telegram.haptic('error')
        return null
      }
      landed = true
      telegram.haptic('success')
      return done.result ?? {}
    } catch (e: any) {
      const code = codeOf(e)
      const status = e?.statusCode || e?.status || e?.response?.status
      if (code === 'version_conflict') deck.holdForChoice()
      else message.value = words(code, e?.data?.error?.message_params ?? {})
      // No answer from the server itself: it may have done it.
      unclear = !status || status >= 500
      return null
    } finally {
      if (alive() && (landed || unclear) && !deck.conflict.value) {
        // A done task's version is read back before the deck is let go; one read that fails leaves the next save to find it.
        await readBack(id, alive)
      }
      if (alive()) letGo()
    }
  }

  async function run(action: PictureAction, body: Record<string, unknown> = {}) {
    const alive = opening()
    if (!(await hold(action, typeof body.section_id === 'string' ? body.section_id : null))) return null
    return act(action, body, alive)
  }

  async function fill() {
    const result: any = await run('fill')
    if (!result || result === true) return
    if (result.added) {
      message.value = t('deckPicturesAdded', { count: result.added })
      snackbar.show({ message: message.value })
    } else
      message.value = result.no_room && !result.unmatched ? t('deckPicturesNoRoomAny') : t('deckPicturesNoneFound')
  }

  /** Undo for a picture change: back to `worn`, if this deck is still the one open. */
  function undoTo(section: string, worn: string | null, alive: () => boolean) {
    return () => {
      if (!alive()) return
      void (worn ? next(section, worn) : remove(section))
    }
  }

  /** The slide's next picture on offer, or `asset`; Undo puts back the one it wore. */
  async function next(section: string, asset?: string) {
    const alive = opening()
    const worn = photos.value[section]?.asset_id ?? null
    const done = await run('next', { section_id: section, ...(asset ? { asset_id: asset } : {}) })
    if (!done || !alive()) return
    message.value = t('deckPictureChanged')
    snackbar.show({
      message: message.value,
      ...(worn ? { actionLabel: t('editorUndo'), onAction: undoTo(section, worn, alive) } : {}),
    })
  }

  async function remove(section: string) {
    const alive = opening()
    const worn = photos.value[section]?.asset_id ?? null
    const done = await run('remove', { section_id: section })
    if (!done || !alive()) return
    message.value = t('deckPictureRemoved')
    snackbar.show({
      message: message.value,
      ...(worn ? { actionLabel: t('editorUndo'), onAction: undoTo(section, worn, alive) } : {}),
    })
  }

  async function search(section: string, query: string) {
    const result: any = await run('search', { section_id: section, query })
    if (!result || result === true) return
    message.value = result.found ? t('deckPicturesFound', { count: result.found }) : t('deckPicturesNoneFound')
  }

  /** The phone's own photo for slide `section`, shrunk here, uploaded, then put on it: the deck is held from the start. */
  async function upload(section: string, file: File) {
    const alive = opening()
    if (!(await hold('upload', section))) return
    let asset: string
    try {
      const blob = await shrinkPhoto(file).catch(() => null)
      if (!blob) {
        message.value = t('deckPictureUnreadable')
        letGo()
        return
      }
      const form = new FormData()
      form.append('file', blob, 'photo.jpg')
      asset = (await ws.api<{ id: string }>('/files/uploads', { method: 'POST', body: form, timeout: 60_000 })).id
    } catch (e: any) {
      if (alive()) {
        message.value = e?.data?.error?.message || t('genericError')
        letGo()
      }
      return
    }
    if (!alive()) return
    const worn = photos.value[section]?.asset_id ?? null
    const done = await act('upload', { section_id: section, asset_id: asset }, alive)
    if (!done || !alive()) return
    message.value = t('deckPictureYours')
    snackbar.show({ message: message.value, actionLabel: t('editorUndo'), onAction: undoTo(section, worn, alive) })
  }

  /** The designs in the app's language; a failed load says so, and the sheet offers to ask again. */
  async function loadDesigns() {
    if (designs.value.locale === locale.value && designs.value.categories.length) return
    const asked = locale.value
    designsFailed.value = false
    try {
      const answer = await ws.api<{ categories: DeckCategory[] }>(`/studio/deck-designs?locale=${asked}`)
      designs.value = { locale: asked, categories: answer.categories }
    } catch {
      designsFailed.value = true
    }
  }

  /** Another design for the whole deck: one new version, every slide drawn again. Undo puts the last one back. */
  async function setDesign(design: string, undoing = false) {
    const alive = opening()
    const before = deck.draft.value?.render?.design ?? ''
    if (!design || design === before) return false
    if (!(await hold('design', null))) return false
    const id = deck.draftId.value
    let unclear = false
    try {
      const fresh = await ws.api<DeckDraft>(`/generation/drafts/${id}/design`, {
        method: 'POST',
        body: { version: deck.version.value, design },
        timeout: REQUEST_TIMEOUT,
      })
      if (!alive()) return false
      deck.adopt(fresh, 'all')
      if (!undoing)
        snackbar.show({
          message: t('deckDesignChanged'),
          actionLabel: t('editorUndo'),
          onAction: () => {
            if (alive()) void setDesign(before, true)
          },
        })
      return true
    } catch (e: any) {
      const status = e?.statusCode || e?.status || e?.response?.status
      if (codeOf(e) === 'version_conflict') deck.holdForChoice()
      else message.value = words(codeOf(e))
      unclear = !status || status >= 500
      return false
    } finally {
      if (unclear && alive()) await readBack(id, alive, 'all')
      if (alive()) letGo()
    }
  }

  return {
    state,
    on,
    style,
    photos,
    running,
    message,
    designs: computed(() => designs.value.categories),
    designsFailed,
    pickFor,
    pictureUrl,
    fill,
    next,
    remove,
    search,
    upload,
    loadDesigns,
    setDesign,
  }
}
