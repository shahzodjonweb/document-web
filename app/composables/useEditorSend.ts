/**
 * Sending the draft from the new frame: one quote when Review opens, one job on
 * Confirm, and what follows. Everything said about it is the server's answer: the
 * summary, the cost and each refusal by its code.
 *
 * A retry is the same send. It goes again on the same quote with the same
 * Idempotency-Key, however old the quote, so the server settles it once. A quote
 * that ran out before Confirm is asked for again first, in the foreground, and if
 * the cost changed meanwhile the new one is shown and confirmed again.
 *
 * A job reads the draft when it starts, so the draft is held from Confirm until
 * then: a change made while it waits would fail it with `version_conflict`.
 */
import type { Deliver, DraftQuote, Refusal } from './useEditorSession'
import type { PictureMiss } from './useEditorTools'

export type SendStage = 'idle' | 'checking' | 'ready' | 'sending' | 'accepted' | 'made' | 'failed'

/** How long "Accepted" stays before Telegram closes the app. */
const ACCEPTED_FOR = 700
/** A quote this close to running out is asked for again rather than risked. */
const EXPIRY_MARGIN = 15_000
const POLL_EVERY = 1500
const POLL_FOR = 10 * 60_000
/** Three unanswered looks in a row and the hold lets go: an edit then fails the job, not the person. */
const POLL_MISSES = 3
const UPLOAD_WAIT = 60_000
/** A job request that hangs ends as one with no answer, so Try again (the same key) is offered. */
const SEND_TIMEOUT = 30_000
/** At this share of the week's file tasks used, the app stays open after a send. */
const STAY_OPEN_AT = 0.8
const TERMINAL = ['succeeded', 'failed', 'canceled', 'expired', 'no_op']
const SENT_KEY = 'docmaster-editor-sent'
const SENT_KEPT = 20
/** What Review says of a picture that never got in, above Confirm: told, the person sends or fixes it. */
const MISSED: Record<PictureMiss, string> = {
  picture_not_added: 'editorPictureDropped',
  picture_not_changed: 'editorPictureNotChanged',
  picture_not_ready: 'editorPictureNotReady',
  picture_not_placed: 'editorPictureNotPlaced',
}

const stage = ref<SendStage>('idle')
const quote = shallowRef<DraftQuote | null>(null)
const refusal = shallowRef<Refusal | null>(null)
/** Pages the server says become pictures, and whether the person has said they understand. */
const consentPages = ref<number[]>([])
const consent = ref(false)
const costChanged = ref(false)
const job = shallowRef<any>(null)
const busy = ref(false)
/** The last job request had no answer: it may have landed, so Try again repeats it exactly. */
const uncertain = ref(false)
/** Quote id → Idempotency-Key, so one quote is one send however often it is tried. */
const keys = new Map<string, string>()
/** The misses this Review has said: done with once the send goes, or Review closes having said them. */
const said = shallowReactive(new Set<object>())
/** Pictures begun when the quote was asked for: one begun since is asked about again before it goes. */
let quotedStarted = 0
/** Pictures begun when Confirm was pressed: one begun after it is not in what the send makes. */
let startedAt = 0
/** The draft's version the quote was made of: one changed since is asked for again before it goes. */
let quotedVersion: number | null = null
/** Document id → the version last sent from this device, for the top bar's "Not sent yet". */
const sent = ref<Record<string, number> | null>(null)
let polling: number | null = null
let closing: number | null = null
let runs = 0

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function loadSent() {
  if (sent.value || !import.meta.client) return
  try {
    sent.value = JSON.parse(localStorage.getItem(SENT_KEY) || '{}') ?? {}
  } catch {
    sent.value = {}
  }
}
/** `null` forgets it again: a send that failed sent nothing. */
function recordSent(id: string, version: number | null) {
  const all: Record<string, number> = { ...sent.value }
  if (version === null) delete all[id]
  else all[id] = version
  sent.value = Object.fromEntries(Object.entries(all).slice(-SENT_KEPT))
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(sent.value))
  } catch {
    // Only the dot comes back after a reload without it.
  }
}

function stopTimers() {
  if (polling !== null) clearTimeout(polling)
  if (closing !== null) clearTimeout(closing)
  polling = null
  closing = null
}

export function useEditorSend() {
  const ws = useWorkspace()
  const { t, path } = useLocale()
  const session = useEditorSession()
  const telegram = useTelegramApp()
  const tools = useEditorTools()
  loadSent()

  const deliver = computed<Deliver>(() => (telegram.isMiniApp.value ? 'chat' : 'download'))
  const summary = computed(() => quote.value?.summary ?? null)
  const cost = computed(() => summary.value?.cost ?? null)
  /** Confirm waits for the cost, and for "I understand" when pages become pictures. */
  const canConfirm = computed(
    () =>
      stage.value === 'ready' &&
      !!quote.value &&
      !!cost.value &&
      quote.value.affordable !== false &&
      (!consentPages.value.length || consent.value),
  )
  /** The week's file tasks once this send is counted, from the server's own figures. */
  const stayOpen = computed(() => {
    const figures = cost.value
    if (!figures || !figures.limit || figures.left == null) return false
    const used = figures.limit - figures.left + (figures.kind === 'file_task' ? 1 : 0)
    return used / figures.limit >= STAY_OPEN_AT
  })
  const skipped = computed(
    () => (job.value?.per_command ?? []).filter((row: any) => row.status === 'skipped').length,
  )
  /** Lines of the file's own words its font could not show, so set in a Noto face that looks like it. */
  const retyped = computed(
    () =>
      (job.value?.per_command ?? []).filter((row: any) => ['retyped', 'covered'].includes(row.engine)).length,
  )
  const result = computed(
    () =>
      (job.value?.artifacts ?? []).find((artifact: any) => artifact.mime_type === 'application/pdf') ??
      job.value?.artifacts?.[0] ??
      null,
  )
  /**
   * A picture begun once the send had gone: its picker was open as Send was pressed. It is not
   * in the file, so the app stays to say so rather than close on it.
   */
  const late = computed(
    () =>
      (['sending', 'accepted', 'made'].includes(stage.value) || (stage.value === 'failed' && uncertain.value)) &&
      tools.started.value !== startedAt,
  )
  /** A picture placed, replaced or turned a moment ago, still being made ready or going up. */
  const uploading = () =>
    tools.picking.value ||
    !!tools.waiting.size ||
    !!tools.changing.size ||
    ['picture', 'picture-ready', 'asset', 'signature-photo', 'signature-keep'].some((task) => session.isBusy(task))
  const assetAt = (index = 0) => (index > 0 ? session.assets.value[index - 1]?.id : undefined)
  /**
   * A miss of this document that still holds. A mark whose new picture failed still has its old
   * one: found by its id while the document stays open, or by that picture once it has been
   * opened again and its marks read under new ids.
   */
  const stands = (id: string, miss: { code: PictureMiss; doc: string; asset: string; open: object | null }) => {
    if (miss.doc !== session.doc.value?.id) return false
    if (miss.code !== 'picture_not_changed') return true
    // Read through the reactive map, the state comes back wrapped: compared as itself.
    const reopened = toRaw(miss.open) !== session.openedState()
    return session.commands.value.some(
      (item) => item._id === id || (reopened && !!miss.asset && assetAt(item.input_index) === miss.asset),
    )
  }
  /** Pictures that never got in and stand, not yet said by this Review. */
  const standing = () => [...tools.missed].filter(([id, miss]) => !said.has(miss) && stands(id, miss))
  function doneWithSaid() {
    for (const [key, miss] of [...tools.missed]) if (said.has(miss)) tools.missed.delete(key)
  }
  /**
   * The misses Review says above Confirm, as things stand: each it has said that still holds. One
   * put right meanwhile, by a new picture on its mark or another choice in its sheet, goes at once.
   */
  const missNotices = computed(() => {
    const codes = new Set(
      [...tools.missed].filter(([id, miss]) => said.has(miss) && stands(id, miss)).map(([, miss]) => miss.code),
    )
    return [...codes].map((code) => t(MISSED[code]))
  })
  /** And a picture waiting for a tap on the page, which is not in the draft, for as long as it waits. */
  const notices = computed(() =>
    tools.armed.value?.image ? [...missNotices.value, t('editorPictureArmed')] : missNotices.value,
  )
  /** Whether the quote is still of the draft as it will go, with nothing begun or missed since. */
  const asQuoted = () =>
    ['saved', 'clean'].includes(session.saveState.value) &&
    session.doc.value?.version === quotedVersion &&
    !uploading() &&
    !standing().length &&
    tools.started.value === quotedStarted
  /** What Review shows, to tell whether a check in the background found anything new. */
  const shown = () => `${said.size}|${notices.value.join('|')}`
  /** Saved, with changes, and not what was last sent from here. */
  const unsent = computed(() => {
    const current = session.doc.value
    if (!current || !session.commands.value.length) return false
    if (!['saved', 'clean'].includes(session.saveState.value)) return false
    return sent.value?.[current.id] !== current.version
  })

  function reset() {
    stopTimers()
    runs += 1
    stage.value = 'idle'
    quote.value = null
    refusal.value = null
    consentPages.value = []
    consent.value = false
    costChanged.value = false
    job.value = null
    uncertain.value = false
    busy.value = false
    quotedVersion = null
    said.clear()
  }

  /** Review opened: what is in the field is already in the draft. */
  async function begin() {
    reset()
    session.held.value = false
    await check()
  }

  /**
   * Review closed. A send on its way keeps the draft held until its job starts; one
   * that may have landed unanswered lets go, as the person has moved on from it.
   * One still being asked for cannot be closed: its answer would land on whatever came next.
   */
  function dismiss(chosen = true) {
    if (stage.value === 'accepted' || stage.value === 'sending') return
    if (stage.value !== 'made') session.held.value = false
    // Still being asked, what it said may not have been read: the next Review says it again. So
    // too when it closed by itself, for a conflict or a mark chosen under it.
    const settled = stage.value === 'ready' || (stage.value === 'failed' && refusal.value?.code !== 'version_conflict')
    if (chosen && settled) doneWithSaid()
    reset()
  }

  /** Asks the server what this send would be. */
  async function check() {
    const run = ++runs
    stage.value = 'checking'
    refusal.value = null
    // A picture placed, replaced or turned a moment ago goes in rather than being left out. One
    // placed while this waits is waited for too.
    const started = Date.now()
    while (uploading() && Date.now() - started < UPLOAD_WAIT) await wait(200)
    if (run !== runs) return
    // Still on its way: the send waits for it rather than going without it, and watches on, so
    // whatever becomes of it is said here rather than under this sheet.
    if (uploading()) {
      refusal.value = { code: 'picture_uploading', message: t('editorPictureOnItsWay'), params: {} }
      stage.value = 'failed'
      while (uploading()) {
        await wait(200)
        if (run !== runs) return
      }
      return check()
    }
    // One that never got in was said in a snackbar or a sheet's line, which may have been under
    // another sheet or gone by. Said here too, above Confirm: the send goes without it, or with
    // the old picture, only once the person has been told. A mark gone since needs no word.
    for (const [, miss] of standing()) said.add(miss)
    const issue = session.issues.value[0]
    if (issue) {
      refusal.value = { code: 'needs_fix', message: session.describeIssue(issue), params: { id: issue.id } }
      stage.value = 'failed'
      return
    }
    const before = quote.value?.summary?.cost
    // One quote at a time: an earlier ask still on its way is waited for, not refused.
    while (session.isBusy('quote')) await wait(100)
    if (run !== runs) return
    quotedStarted = tools.started.value
    let answer = await session.review(consent.value, deliver.value)
    // A picture that landed meanwhile changed the draft after it was quoted: that one is quoted again.
    const moved = () => !!answer && 'code' in answer && answer.code === 'changed_meanwhile'
    for (let again = 0; moved() && again < 2 && run === runs; again += 1)
      answer = await session.review(consent.value, deliver.value)
    if (run !== runs) return
    if (answer && 'id' in answer) {
      quote.value = answer
      quotedVersion = session.doc.value?.version ?? null
      if (answer.summary?.raster_pages?.length) consentPages.value = answer.summary.raster_pages
      costChanged.value = !!before && JSON.stringify(before) !== JSON.stringify(answer.summary?.cost)
      stage.value = answer.affordable === false ? 'failed' : 'ready'
      if (answer.affordable === false) refusal.value = { code: 'weekly_file_limit', message: '', params: {} }
      return
    }
    quote.value = null
    if (answer?.code === 'rasterization_consent_required') {
      consentPages.value = (answer.params.pages ?? []).map(Number)
      consent.value = false
      stage.value = 'ready'
      return
    }
    refusal.value = answer ?? { code: 'unanswered', message: '', params: {} }
    stage.value = 'failed'
  }

  /** "I understand" is part of the quote: with it, the server quotes the pages as pictures. */
  function understand(value: boolean) {
    consent.value = value
    if (value && !quote.value) void check()
  }

  async function confirm() {
    if (busy.value || stage.value === 'sending') return
    // A retry after no answer is the same send, whatever its quote's age: the key says so.
    if (uncertain.value && quote.value) return submit(quote.value)
    if (!canConfirm.value || !quote.value) return
    busy.value = true
    // A picture begun from here on is not in this send, Try again and all.
    startedAt = tools.started.value
    try {
      // The draft changed after it was quoted, or a picture begun since is on its way or never got
      // in, so the quote is not of what it will be: that is asked for and shown, and confirmed again.
      if (!asQuoted()) return await check()
      if (Date.parse(quote.value.expires_at) - EXPIRY_MARGIN <= Date.now()) {
        const before = shown()
        await check()
        // Asked again unseen, it goes on only as it was: anything new is shown and confirmed first.
        const same = shown() === before && tools.started.value === startedAt
        if (!canConfirm.value || costChanged.value || !same || !asQuoted()) return
      }
      await submit(quote.value!)
    } finally {
      busy.value = false
    }
  }

  async function submit(made: DraftQuote, again = true): Promise<void> {
    const current = session.doc.value
    if (!current) return
    const run = runs
    stage.value = 'sending'
    refusal.value = null
    session.held.value = true
    if (!keys.has(made.id)) keys.set(made.id, crypto.randomUUID())
    try {
      const accepted = await ws.api<any>('/jobs', {
        method: 'POST',
        headers: { 'Idempotency-Key': keys.get(made.id)! },
        body: { quote_id: made.id, ...(deliver.value === 'chat' ? { deliver_to_chat: true } : {}) },
        timeout: SEND_TIMEOUT,
      })
      // The send was let go meanwhile: what came after it is not closed on its answer.
      if (run !== runs) return
      uncertain.value = false
      job.value = accepted
      // Gone with what Review said of it: those misses are done with. A send refused keeps them.
      doneWithSaid()
      recordSent(current.id, current.version)
      stage.value = 'accepted'
      telegram.haptic('success')
      if (deliver.value === 'chat' && !stayOpen.value)
        closing = window.setTimeout(function closeWhenDone() {
          closing = null
          if (late.value) return
          // A photo still being handed over is waited for: it is said to be late, or it never comes.
          if (tools.picking.value) closing = window.setTimeout(closeWhenDone, 500)
          else telegram.close()
        }, ACCEPTED_FOR)
      follow(accepted, current.id)
    } catch (e) {
      if (run !== runs) return
      const answer = session.refusalOf(e)
      if (!answer.status || answer.status >= 500) {
        uncertain.value = true
        refusal.value = { ...answer, code: 'unanswered' }
        stage.value = 'failed'
        return
      }
      uncertain.value = false
      session.held.value = false
      if (answer.code === 'quote_expired' && again) {
        const before = quote.value?.summary?.cost
        const told = shown()
        quote.value = null
        await check()
        const now = quote.value as DraftQuote | null
        const sameCost = JSON.stringify(before) === JSON.stringify(now?.summary?.cost)
        // Gone on by itself only as it was: a new cost, a picture newly said, or one begun since
        // Confirm is shown and confirmed first.
        const same = sameCost && shown() === told && tools.started.value === startedAt
        if (now && canConfirm.value && same && asQuoted()) return submit(now, false)
        if (now && !sameCost) costChanged.value = true
        return
      }
      if (answer.code === 'version_conflict') session.holdForChoice()
      refusal.value = answer
      stage.value = 'failed'
    }
  }

  /** Follows the job until it ends; the hold goes as soon as it has read the draft. */
  function follow(first: any, documentId: string) {
    const id = first.id
    // A `reset` lets this one go, even when the next send is answered with this same job.
    const run = runs
    const started = Date.now()
    let misses = 0
    const look = (fresh: any) => {
      if (fresh.status !== 'queued') session.held.value = false
      if (!TERMINAL.includes(fresh.status)) return false
      if (fresh.status === 'succeeded') stage.value = 'made'
      else {
        // Changed elsewhere before it started: the frame's two choices say so, as for a save, on
        // that document only, if it is still the one open.
        if (fresh.error?.code === 'version_conflict' && session.doc.value?.id === documentId) session.holdForChoice()
        // Failed at once: the app stays to say so, rather than close on it.
        if (closing !== null) clearTimeout(closing)
        closing = null
        recordSent(documentId, null)
        refusal.value = {
          code: fresh.error?.code || fresh.status,
          message: fresh.error?.message || '',
          params: fresh.error?.message_params ?? {},
        }
        stage.value = 'failed'
      }
      return true
    }
    const tick = async () => {
      polling = null
      try {
        const fresh = await ws.api<any>(`/jobs/${id}`)
        if (run !== runs || job.value?.id !== id) return
        misses = 0
        job.value = fresh
        if (look(fresh)) return
      } catch {
        // Let go by a `reset` meanwhile: what came after is not this one's to follow or hold.
        if (run !== runs || job.value?.id !== id) return
        misses += 1
        if (misses >= POLL_MISSES) session.held.value = false
      }
      if (Date.now() - started < POLL_FOR) polling = window.setTimeout(tick, POLL_EVERY)
      else session.held.value = false
    }
    if (!look(first)) polling = window.setTimeout(tick, POLL_EVERY)
  }

  /** The change the server named by its place in the draft, which is the place in this list. */
  const changeAt = (index: number) => session.commands.value[index] ?? null

  /** Takes the change out, as one step Undo brings back, and asks again. */
  async function sendWithout(index: number) {
    const command = changeAt(index)
    if (!command) return
    session.held.value = false
    session.removeCommands([command._id])
    await session.flush()
    await check()
  }

  /** A new draft on the file just made, as the bot's Edit under it would open. */
  async function keepEditing() {
    const fileId = result.value?.file_id
    if (!fileId || busy.value) return
    busy.value = true
    try {
      const made = await ws.api<{ id: string }>('/editor/documents', {
        method: 'POST',
        body: { file_id: fileId },
      })
      reset()
      await navigateTo(path(`/app/editor/${made.id}`))
    } catch (e) {
      refusal.value = session.refusalOf(e)
    } finally {
      busy.value = false
    }
  }

  return {
    deliver,
    stage: computed(() => stage.value),
    quote: computed(() => quote.value),
    summary,
    cost,
    refusal: computed(() => refusal.value),
    notices,
    late,
    consentPages: computed(() => consentPages.value),
    consent: computed(() => consent.value),
    costChanged: computed(() => costChanged.value),
    uncertain: computed(() => uncertain.value),
    busy: computed(() => busy.value),
    job: computed(() => job.value),
    result,
    skipped,
    retyped,
    canConfirm,
    stayOpen,
    unsent,
    begin,
    dismiss,
    check,
    understand,
    confirm,
    changeAt,
    sendWithout,
    keepEditing,
  }
}
