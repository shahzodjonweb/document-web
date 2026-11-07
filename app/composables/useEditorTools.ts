/**
 * The new frame's tools: which sheet is up, where on the paper it was opened, what
 * a tap will place next, and placing it.
 *
 * A mark lands on finger lift where the finger was, shows its real picture at once
 * and says so in a snackbar with Adjust, rather than opening a form nobody asked
 * for. Words open the docked field instead. A picture or signature uploads as soon
 * as it is placed, as a 24-hour input of this draft, so autosave and a second
 * device see it like any other mark.
 */
import {
  COMMAND_FEATURE,
  COMMAND_SHAPE,
  scaleBy,
  tickPoints,
  todayText,
  type ClientCommand,
  type CommandType,
} from './useEditorCommands'
import { useEditorImages, type PreparedImage } from './useEditorImages'

export type ToolSheet = 'add' | 'sign' | 'blackout' | 'fields'
export type PlaceKind =
  | 'text'
  | 'date'
  | 'tick'
  | 'signature'
  | 'picture'
  | 'highlight'
  | 'note'
  | 'draw'
  | 'redact'

/** What a Review says of a picture that never got in: taken off, the old one left, or never made ready. */
export type PictureMiss = 'picture_not_added' | 'picture_not_changed' | 'picture_not_ready' | 'picture_not_placed'

export interface Placement {
  kind: PlaceKind
  image?: PreparedImage
  /** A signature kept on the phone, sent once however often it is placed. */
  keptId?: string
}
export interface Pin {
  page: number
  x: number
  y: number
}

export const PLACE_TOOL: Record<PlaceKind, CommandType> = {
  text: 'add_text',
  date: 'add_text',
  tick: 'draw',
  signature: 'signature',
  picture: 'insert_image',
  highlight: 'highlight',
  note: 'note',
  draw: 'draw',
  redact: 'redact',
}

export const PLACE_LABEL: Record<PlaceKind, string> = {
  text: 'editorKindText',
  date: 'editorToday',
  tick: 'editorTick',
  signature: 'editorKindSignature',
  picture: 'editorKindPicture',
  highlight: 'editorKindHighlight',
  note: 'editorKindNote',
  draw: 'editorKindDrawing',
  redact: 'editorKindBlackOut',
}

/** What a mark is called in its form's title and its snackbar, as a person would name it. */
const KIND_LABEL: Partial<Record<CommandType, string>> = {
  add_text: 'editorKindText',
  highlight: 'editorKindHighlight',
  note: 'editorKindNote',
  draw: 'editorKindDrawing',
  signature: 'editorKindSignature',
  insert_image: 'editorKindPicture',
  redact: 'editorKindBlackOut',
}
export const kindLabel = (type: CommandType) => KIND_LABEL[type] ?? COMMAND_SHAPE[type].labelKey

/** Sizes for a form's blanks: documents are set at 10–12, not the 16 a screen reads well at. */
const TEXT_SIZE = 12
const SIGNATURE_WIDTH = 120
/** What a picture may be: the server takes these, and nothing else once attached. */
export const PICTURE_TYPES = 'image/png,image/jpeg,image/webp'
/** Back from the chooser with no word yet: how long a photo may still take to be handed over. */
const PICK_GRACE = 20_000
/** And at most, however the chooser was left: a send waits no longer than this for one. */
const PICK_LONGEST = 120_000
const PICTURE_WIDTH = 200

const sheet = ref<ToolSheet | null>(null)
const pin = ref<Pin | null>(null)
const armed = shallowRef<Placement | null>(null)
/** The mark whose picture the Sign sheet or a chosen photo replaces, rather than placing a new one. */
const replacing = ref('')
/** Marks placed before their picture reached the server, shown from the phone's copy meanwhile. */
const waiting = reactive(new Map<string, string>())
/** Placed marks whose picture is being replaced or turned, from choosing the new one until it is in. */
const changing = reactive(new Set<string>())
/**
 * Pictures that never got in, by mark or by the sheet that refused one, with their document and
 * when. What said so, a snackbar or a sheet's line, may have been under another sheet or gone by:
 * that document's next Review says each one still standing. Kept on leaving the document, so a
 * Review on coming back still says it.
 */
const missed = reactive(
  new Map<string, { code: PictureMiss; at: number; doc: string; asset: string; open: object | null }>(),
)
/**
 * The frame's one file input, mounted for as long as the frame is: a sheet put away while the
 * phone hands a photo over takes nothing with it, and the photo goes to whoever asked for it.
 */
const picker = shallowRef<HTMLInputElement | null>(null)
let onPicked: ((file: File) => void) | null = null
/** The document it was asked for in: a file handed over after the person moved on goes nowhere. */
let pickedFor = ''
/** A file asked for and not handed over yet: a send waits for it, and the app does not close on it. */
const picking = ref(false)
let pickTimer: ReturnType<typeof setTimeout> | null = null
/** Counts pictures begun, being made ready or going up: one begun after a send went is not in it. */
const started = ref(0)
/** `document:kept signature` → the upload of it, so one signature goes up once per draft. */
const sent = new Map<string, Promise<string | null>>()
/** The words a field held when it opened, for Cancel; and whether it was a new mark. */
const field = { before: '', fresh: false }

/**
 * iOS shows the keyboard only for a field focused inside the tap's own handler, and
 * the docked field mounts a moment later. A field focused now holds the keyboard
 * up until the dock takes focus from it.
 */
function primeKeyboard() {
  if (!import.meta.client) return
  const primer = document.createElement('input')
  primer.setAttribute('aria-hidden', 'true')
  primer.tabIndex = -1
  primer.dataset.keyboardPrimer = ''
  primer.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0'
  document.body.append(primer)
  primer.focus()
  setTimeout(() => primer.remove(), 1500)
}

export function useEditorTools() {
  const { t } = useLocale()
  const session = useEditorSession()
  const telegram = useTelegramApp()
  const snackbar = useEditorSnackbar()
  const hints = useEditorHints()
  const images = useEditorImages()
  const metrics = useEditorFontMetrics()
  const ws = useWorkspace()

  /**
   * Every plan has every tool, so one the catalog marks ineligible is switched off for
   * everyone; an unread catalog is not a refusal, and the server's 403 has the last word.
   */
  function allows(type: CommandType) {
    const match = ws.features.value.find((item) => item.id === COMMAND_FEATURE[type])
    return match ? match.eligible !== false : true
  }

  function openSheet(name: ToolSheet, at: Pin | null = null) {
    session.select(null)
    sheet.value = name
    pin.value = at
  }
  function closeSheet() {
    sheet.value = null
    pin.value = null
    replacing.value = ''
  }
  function arm(placement: Placement) {
    armed.value = placement
    session.select(null)
    // The tool strip's own state, so Escape and the old keys still let go of it.
    session.activeTool.value = PLACE_TOOL[placement.kind]
  }
  function disarm() {
    armed.value = null
    if (session.activeTool.value !== 'select') session.activeTool.value = 'select'
  }
  function reset() {
    closeSheet()
    disarm()
    waiting.clear()
    changing.clear()
    // A file asked for in the document left is not waited for here.
    if (pickTimer !== null) clearTimeout(pickTimer)
    pickTimer = null
    picking.value = false
    onPicked = null
  }

  /* ------------------------------------------------------------- the field */

  function openField(id: string, fresh = false) {
    primeKeyboard()
    snackbar.dismiss()
    const command = session.commands.value.find((item) => item._id === id)
    field.before = command?.text ?? ''
    field.fresh = fresh
    session.select(null)
    session.editingId.value = id
  }
  /** Done, Back and any send keep what was typed; an empty mark was never wanted. */
  function commitField() {
    const id = session.editingId.value
    if (!id) return
    const command = session.commands.value.find((item) => item._id === id)
    if (command && !(command.text ?? '').trim()) session.removeCommands([id], { amend: true })
    session.editingId.value = ''
    telegram.hideKeyboard()
  }
  function cancelField() {
    const id = session.editingId.value
    if (!id) return
    const command = session.commands.value.find((item) => item._id === id)
    if (command && (field.fresh || !field.before.trim())) session.removeCommands([id], { amend: true })
    else if (command && command.text !== field.before)
      session.patchCommand(id, { text: field.before }, `text:${id}`)
    session.editingId.value = ''
    telegram.hideKeyboard()
  }

  /* ------------------------------------------------------------- pictures */

  /** The picture's box at a width, standing as the picture stands, inside the page. */
  function pictureBox(image: PreparedImage, width: number, page: { width: number; height: number }) {
    let boxWidth = Math.min(width, page.width * 0.8)
    let boxHeight = (boxWidth * image.height) / image.width
    if (boxHeight > page.height * 0.6) {
      boxHeight = page.height * 0.6
      boxWidth = (boxHeight * image.width) / image.height
    }
    return { width: boxWidth, height: boxHeight }
  }

  /**
   * Sends a picture once; `null` when it was refused, said in a snackbar. A kept
   * signature already sent for this draft is used again, unless the draft has since
   * let that picture go (another device's version taken, say): then it goes again.
   */
  async function upload(
    image: PreparedImage,
    name: string,
    keptId?: string,
    again = true,
  ): Promise<number | null> {
    const documentId = session.doc.value?.id ?? ''
    const key = keptId ? `${documentId}:${keptId}` : ''
    const earlier = key ? sent.get(key) : undefined
    let sending = earlier
    if (!sending) {
      sending = (async () => {
        let why = ''
        const file = new File([image.blob], name, { type: image.blob.type || 'image/png' })
        const index = await session.uploadAsset(file, (reason) => (why = reason))
        if (index === null) {
          if (why) snackbar.show({ message: t('editorPictureNotAdded', { why }) })
          return null
        }
        const asset = session.assets.value[index - 1]
        if (asset) images.adopt(asset.id, image.url)
        return asset?.id ?? null
      })()
      if (key) sent.set(key, sending)
    }
    const assetId = await sending
    if (!assetId) {
      if (key) sent.delete(key)
      return null
    }
    // Leaving the document meanwhile, the draft is on its way out: nothing new goes into it.
    if (session.isBusy('load')) return null
    const index = session.assets.value.findIndex((asset) => asset.id === assetId) + 1
    if (index > 0) return index
    if (key) sent.delete(key)
    return earlier && again ? upload(image, name, keptId, false) : null
  }

  /**
   * A picture that never got in, as `PictureMiss` names it, for a Review to say. A mark that kept
   * its old picture also names that picture, which still finds it once the marks are read again.
   */
  function miss(key: string, code: PictureMiss, where: { doc?: string; asset?: string; open?: object | null } = {}) {
    missed.set(key, {
      code,
      at: Date.now(),
      doc: where.doc ?? session.doc.value?.id ?? '',
      asset: where.asset ?? '',
      open: where.open === undefined ? session.openedState() : where.open,
    })
  }
  /**
   * Whether a mark is in the draft, as last seen while its document was open: one deleted or
   * undone before the person left is not missed once they come back.
   */
  function watchInDraft(id: string, opened: object | null) {
    const present = () => session.commands.value.some((item) => item._id === id)
    let inDraft = present()
    const stop = watch(present, (now) => session.openedState() === opened && (inDraft = now), { flush: 'sync' })
    return { stop, inDraft: () => inDraft }
  }

  /**
   * Asks the phone for a file, for `use` to take. One ask at a time: a new one replaces one that
   * never heard back. A file handed over after the wait gave up still goes to its asker.
   */
  function pickFile(accept: string, use: (file: File) => void) {
    const input = picker.value
    if (!input) return
    input.accept = accept
    input.value = ''
    onPicked = use
    pickedFor = session.doc.value?.id ?? ''
    waitForPick(PICK_LONGEST)
    input.click()
  }
  function waitForPick(ms: number) {
    if (pickTimer !== null) clearTimeout(pickTimer)
    picking.value = true
    pickTimer = setTimeout(() => {
      pickTimer = null
      picking.value = false
    }, ms)
  }
  /** The input's word: the file chosen, or none when the chooser was cancelled. */
  function picked(file: File | null) {
    if (pickTimer !== null) clearTimeout(pickTimer)
    pickTimer = null
    picking.value = false
    const use = onPicked
    onPicked = null
    if (picker.value) picker.value.value = ''
    if (file && use && pickedFor === (session.doc.value?.id ?? '')) use(file)
  }
  /** The page has the phone's attention again: a photo may still come, as iOS converts it first, but not for ever. */
  function pickerLeft() {
    if (picking.value) waitForPick(PICK_GRACE)
  }
  /** A sheet's own refusal, kept for this document only: another document's sheet leaves it be. */
  const sheetKey = (sheet: 'add' | 'sign') => `${session.doc.value?.id ?? ''}:${sheet}`
  /** The uploaded picture a mark shows, by its id among the draft's inputs. */
  function assetOf(id: string) {
    const index = session.commands.value.find((item) => item._id === id)?.input_index ?? 0
    return index > 0 ? (session.assets.value[index - 1]?.id ?? '') : ''
  }
  function startPicture() {
    started.value += 1
  }

  async function attachPicture(command: ClientCommand, placement: Placement) {
    const image = placement.image
    if (!image) return
    startPicture()
    const doc = session.doc.value?.id ?? ''
    const opened = session.openedState()
    const mark = watchInDraft(command._id, opened)
    waiting.set(command._id, image.url)
    const index = await upload(
      image,
      placement.kind === 'signature' ? 'signature.png' : 'picture',
      placement.keptId,
    ).finally(mark.stop)
    waiting.delete(command._id)
    // Undone meanwhile, the mark is in Redo's copy, which takes its picture as well.
    if (index !== null) return session.attachInput(command._id, index)
    // Left or opened again meanwhile, the mark went with that draft, kept out of every save while
    // it had no picture: its document's next Review says it, unless it had been taken off before.
    if (session.openedState() !== opened) {
      if (mark.inDraft()) miss(command._id, 'picture_not_added', { doc, open: opened })
      return
    }
    if (session.commands.value.some((item) => item._id === command._id)) {
      miss(command._id, 'picture_not_added')
      session.removeCommands([command._id], { amend: true })
    }
  }

  /**
   * A placed mark's picture being replaced or turned, from choosing the new one until
   * it is in: a send waits for it. `change` says whether it got in. One that did not
   * leaves the old picture, which whatever refused it says, and the next Review too.
   * Called again inside its own `change`, it is the same change; nothing else starts
   * one on that mark meanwhile, as Replace, Turn and the Sign sheet wait.
   */
  async function changePicture(id: string, change: () => Promise<boolean>) {
    if (!id || changing.has(id)) return change()
    startPicture()
    const doc = session.doc.value?.id ?? ''
    const opened = session.openedState()
    // The picture it has now, which stays if this fails. None yet: Review names that mark already.
    const asset = assetOf(id)
    const mark = watchInDraft(id, opened)
    changing.add(id)
    missed.delete(id)
    session.begin('picture')
    let changed = false
    try {
      changed = await change()
    } finally {
      mark.stop()
      changing.delete(id)
      if (!changing.size) session.end('picture')
      // Left or opened again meanwhile, the mark is saved with its old picture under a new id.
      if (!changed && asset && session.openedState() !== opened) {
        if (mark.inDraft()) miss(id, 'picture_not_changed', { doc, asset, open: opened })
      } else if (!changed && session.commands.value.some((item) => item._id === id)) {
        // The picture it has by now: its first may have landed while this one was on its way.
        const had = asset || assetOf(id)
        if (had) miss(id, 'picture_not_changed', { asset: had })
      }
    }
    return changed
  }

  /** Another picture in the same place: as wide as it was, as tall as the new one stands. */
  function replacePicture(id: string, placement: Placement) {
    return changePicture(id, async () => {
      const image = placement.image
      if (!image) return false
      const index = await upload(
        image,
        placement.kind === 'signature' ? 'signature.png' : 'picture',
        placement.keptId,
      )
      const now = session.commands.value.find((item) => item._id === id)
      if (index === null || !now) return false
      const middleY = (now.y ?? 0) + (now.height ?? 0) / 2
      const box = pictureBox(image, now.width ?? SIGNATURE_WIDTH, session.pageSize(now.page ?? 1))
      return session.patchCommand(
        id,
        { input_index: index, ...box, y: middleY - box.height / 2 },
        `replace:${id}`,
      )
    })
  }

  /* -------------------------------------------------------------- placing */

  /** Puts what is armed, or what the Add sheet offered, where the finger was. */
  function place(placement: Placement, at: Pin): ClientCommand | null {
    const page = session.pageSize(at.page)
    const where = (width: number, height: number) => ({
      page: at.page,
      x: at.x - width / 2,
      y: at.y - height / 2,
    })
    let command: ClientCommand | null = null
    switch (placement.kind) {
      case 'text':
      case 'date': {
        // A blank is tapped on its line: the words sit on it, typed from the finger, a date centred there.
        const text = placement.kind === 'date' ? todayText() : ''
        const width = text ? metrics.stringWidth(text, TEXT_SIZE) : 0
        command = session.addCommand(
          'add_text',
          { page: at.page, x: at.x - width / 2, y: at.y - TEXT_SIZE * 0.75 },
          { text, font_size: TEXT_SIZE },
        )
        break
      }
      case 'note':
        command = session.addCommand('note', where(22, 22))
        break
      case 'tick':
        command = session.addCommand(
          'draw',
          { page: at.page },
          { points: tickPoints(at.x, at.y), stroke_width: 1.6 },
        )
        break
      case 'highlight':
        command = session.addCommand('highlight', where(140, 18), { width: 140, height: 18 })
        break
      case 'redact':
        command = session.addCommand('redact', where(120, 20), { width: 120, height: 20 })
        break
      case 'signature':
      case 'picture': {
        if (!placement.image) return null
        const box = pictureBox(
          placement.image,
          placement.kind === 'signature' ? SIGNATURE_WIDTH : PICTURE_WIDTH,
          page,
        )
        command = session.addCommand(PLACE_TOOL[placement.kind], where(box.width, box.height), {
          ...box,
          input_index: 0,
        })
        break
      }
      default:
        return null
    }
    if (!command) {
      // A picture whose file came in while a send held the draft, or with the draft full: the next
      // Review says it, as Review or the send covers whatever else would.
      if (placement.image) miss(`unplaced:${crypto.randomUUID()}`, 'picture_not_placed')
      return null
    }
    // One placed now puts right those that were not, as far as Review is concerned.
    if (placement.image)
      for (const [key, entry] of [...missed])
        if (key.startsWith('unplaced:') && entry.doc === session.doc.value?.id) missed.delete(key)
    telegram.haptic('light')
    hints.retire('place')
    if (placement.kind === 'signature') hints.retire('sign')
    if (placement.kind === 'redact') hints.retire('blackout')
    if (placement.kind === 'text' || placement.kind === 'note') {
      openField(command._id, true)
      return command
    }
    // Placing leaves the form shut: Adjust opens it for whoever wants to. Black out's
    // own sheet counts its boxes, where a snackbar would cover the next place to tap.
    session.select(null)
    if (placement.image) void attachPicture(command, placement)
    if (placement.kind === 'redact') return command
    const id = command._id
    snackbar.show({
      message: t('editorPlaced', { what: t(PLACE_LABEL[placement.kind]) }),
      actionLabel: t('editorAdjust'),
      onAction: () => session.select(id),
    })
    return command
  }

  /** A deep link's `?feature=` names a tool of the old strip; here it opens that tool's own place. */
  function fromTool(type: CommandType) {
    if (type === 'signature') openSheet('sign')
    else if (type === 'insert_image') openSheet('add')
    else if (type === 'fill_form') openSheet('fields')
    else if (type === 'redact') startBlackOut()
    else if (type === 'add_text') arm({ kind: 'text' })
    else if (type === 'highlight') arm({ kind: 'highlight' })
    else if (type === 'note') arm({ kind: 'note' })
    else if (type === 'draw') arm({ kind: 'draw' })
  }

  function startBlackOut() {
    session.mode.value = 'redact'
    openSheet('blackout')
    arm({ kind: 'redact' })
  }
  function stopBlackOut() {
    if (session.mode.value === 'redact') session.mode.value = 'edit'
    if (armed.value?.kind === 'redact') disarm()
    if (sheet.value === 'blackout') closeSheet()
  }

  /** One step bigger or smaller, about the middle, said in a percentage of how it began. */
  function resize(id: string, factor: number) {
    const command = session.commands.value.find((item) => item._id === id)
    if (!command?.page) return
    const patch = scaleBy(command, factor, session.pageSize(command.page))
    if (patch) session.patchCommand(id, patch, `size:${id}`, 'move', { amend: false })
  }

  return {
    allows,
    sheet: computed(() => sheet.value),
    pin: computed(() => pin.value),
    armed: computed(() => armed.value),
    replacing,
    waiting,
    changing,
    missed,
    miss,
    sheetKey,
    picker,
    picking: computed(() => picking.value),
    pickFile,
    picked,
    pickerLeft,
    started: computed(() => started.value),
    startPicture,
    openSheet,
    closeSheet,
    arm,
    disarm,
    reset,
    place,
    changePicture,
    replacePicture,
    upload,
    openField,
    commitField,
    cancelField,
    fromTool,
    startBlackOut,
    stopBlackOut,
    resize,
    pictureBox,
  }
}
