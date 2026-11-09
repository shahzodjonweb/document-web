/**
 * Sending a deck from its editor: one quote when Review opens, one job on Confirm,
 * and what follows. The slides, size, cost and every refusal are the server's; only
 * the list of changes is worked out here, from the deck as it was opened or last
 * sent, as the quote has none of its own (render_export.quote_summary).
 *
 * As in useEditorSend.ts, a retry is the same send: the same quote under the same
 * Idempotency-Key, so the server settles it once. A quote about to run out is asked
 * for again first, and goes on by itself only as Review showed it: the same cost, the
 * same files, the same warnings.
 *
 * A send belongs to its deck and its account: one still followed after the person has
 * opened another deck only marks its own deck unsent if it fails, and another account
 * signed in on the device starts with none of it.
 *
 * A job reads the draft when it starts, so the deck is held from Confirm until then:
 * a change made while it waits would fail it with `version_conflict`.
 *
 * Nothing here runs at import, so `changesOf` can be tried in plain Node.
 */
import type { components } from '../../generated/api/schema'
import type { Deliver, QuoteCost, Refusal } from './useEditorSession'
import { QUESTIONS_PER_SLIDE, type DeckContent } from './useDeckEditor.ts'

export type DeckSendStage =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'needs_fix'
  | 'pictures'
  | 'sending'
  | 'accepted'
  | 'made'
  | 'failed'
export interface DeckTooLong {
  id: string
  index: number
  words_over: number
}
export interface DeckPictureGone {
  id: string
  index: number
}
export type DeckChangeKind = 'added' | 'moved' | 'text' | 'notes' | 'layout'
export interface DeckChange {
  id: string | null
  index: number | null
  what: DeckChangeKind[]
  cover: boolean
  removedHeading?: string
}
export type DeckQuote = components['schemas']['Quote'] & {
  summary: components['schemas']['DeckExportSummary']
}

/** How long "Accepted" stays before Telegram closes the app. */
const ACCEPTED_FOR = 700
/** A quote this close to running out is asked for again rather than risked. */
const EXPIRY_MARGIN = 15_000
const POLL_EVERY = 1500
const POLL_FOR = 10 * 60_000
/** Three unanswered looks in a row and the hold lets go: an edit then fails the job, not the person. */
const POLL_MISSES = 3
/** One look that hangs counts as a miss, rather than holding the deck for good. */
const POLL_TIMEOUT = 10_000
/** At this share of the week's file tasks used, the app stays open after a send. */
const STAY_OPEN_AT = 0.8
const QUOTE_TIMEOUT = 20_000
/** A job request that hangs ends as one with no answer, so Try again (the same key) is offered. */
const SEND_TIMEOUT = 30_000
/** A send of this draft still waiting to start: asked again after a moment, a few times. */
const BUSY_WAIT = 2000
const BUSY_TRIES = 3
/** Saved again while a quote was asked for: that quote is of a deck that no longer stands. */
const MOVED_TRIES = 2
const TERMINAL = ['succeeded', 'failed', 'canceled', 'expired', 'no_op']

type Section = DeckContent['sections'][number]

const slideCount = (content: DeckContent) =>
  content.sections.length + Math.ceil((content.questions?.length ?? 0) / QUESTIONS_PER_SLIDE)
const wordsOf = (section: Section) =>
  JSON.stringify([section.heading ?? '', section.body ?? '', section.items ?? [], section.columns ?? []])

/**
 * The slides moved, of those both versions have: the fewest that, taken out, leave
 * the rest in their old order. One slide put earlier is that one, not every slide
 * it passed.
 */
function movedIds(before: string[], after: string[]): Set<string> {
  const was = new Map(before.map((id, index) => [id, index]))
  const order = after.map((id) => was.get(id) ?? 0)
  const tails: number[] = []
  const previous: number[] = order.map(() => -1)
  order.forEach((place, index) => {
    let low = 0
    let high = tails.length
    while (low < high) {
      const middle = (low + high) >> 1
      if (order[tails[middle]!]! < place) low = middle + 1
      else high = middle
    }
    if (low > 0) previous[index] = tails[low - 1]!
    tails[low] = index
  })
  const kept = new Set<string>()
  for (let index = tails.length ? tails[tails.length - 1]! : -1; index >= 0; index = previous[index]!)
    kept.add(after[index]!)
  return new Set(after.filter((id) => !kept.has(id)))
}

/**
 * What changed between two versions of a deck, slide by slide in the new order, and
 * the removed ones last. Question slides count in the totals, one per five questions.
 * With nothing to compare against there is nothing to say.
 */
export function changesOf(
  before: DeckContent | null,
  after: DeckContent,
): { rows: DeckChange[]; questions: boolean; slidesBefore: number; slidesAfter: number } {
  const now = after.sections ?? []
  const then = before?.sections ?? now
  const old = new Map(then.map((section) => [section.id, section]))
  const ids = new Set(now.map((section) => section.id))
  const moved = movedIds(
    then.filter((section) => ids.has(section.id)).map((section) => section.id),
    now.filter((section) => old.has(section.id)).map((section) => section.id),
  )
  const rows: DeckChange[] = []
  now.forEach((section, index) => {
    const was = old.get(section.id)
    const what: DeckChangeKind[] = []
    if (!was) what.push('added')
    else {
      if (moved.has(section.id)) what.push('moved')
      if (wordsOf(was) !== wordsOf(section)) what.push('text')
      if ((was.notes ?? '') !== (section.notes ?? '')) what.push('notes')
      if ((was.layout || 'auto') !== (section.layout || 'auto')) what.push('layout')
    }
    if (what.length) rows.push({ id: section.id, index, what, cover: index === 0 })
  })
  for (const section of then)
    if (!ids.has(section.id))
      rows.push({
        id: section.id,
        index: null,
        what: [],
        cover: false,
        removedHeading: section.heading ?? '',
      })
  return {
    rows,
    questions: !!before && JSON.stringify(before.questions ?? []) !== JSON.stringify(after.questions ?? []),
    slidesBefore: slideCount(before ?? after),
    slidesAfter: slideCount(after),
  }
}

/** Made on the first call, inside the app: one Review serves the frame and its sheet. */
function createState() {
  return {
    format: ref<'both' | 'pptx'>('both'),
    stage: ref<DeckSendStage>('idle'),
    quote: shallowRef<DeckQuote | null>(null),
    refusal: shallowRef<Refusal | null>(null),
    tooLong: ref<DeckTooLong[]>([]),
    picturesGone: ref<DeckPictureGone[]>([]),
    /** The PDF could not be made when quoted, so this send is PowerPoint only. */
    pdfDropped: ref(false),
    costChanged: ref(false),
    /** The last job request had no answer: it may have landed, so Try again repeats it exactly. */
    uncertain: ref(false),
    busy: ref(false),
    job: shallowRef<any>(null),
  }
}
let state: ReturnType<typeof createState> | null = null
/** Quote id → Idempotency-Key, so one quote is one send however often it is tried. */
const keys = new Map<string, string>()
/** The deck's version the quote was made of: one saved since is asked for again before it goes. */
let quotedVersion: number | null = null
let polling: ReturnType<typeof setTimeout> | null = null
let closing: ReturnType<typeof setTimeout> | null = null
let runs = 0
/** The account `state` is of. */
let sentBy: string | null = null

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** Old web views lack randomUUID; the server takes any key of 8 to 128 characters. */
const newKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`

function stopTimers() {
  if (polling !== null) clearTimeout(polling)
  if (closing !== null) clearTimeout(closing)
  polling = null
  closing = null
}

export function useDeckSend() {
  const ws = useWorkspace()
  const owner = String(ws.user?.value?.id ?? '')
  if (state && sentBy !== owner) {
    // Another account's send: nothing of it is shown, followed or repeated here.
    stopTimers()
    runs += 1
    state = null
    keys.clear()
    quotedVersion = null
  }
  sentBy = owner
  const s = (state ??= createState())
  const deck = useDeckEditor()
  const telegram = useTelegramApp()

  const deliver = computed<Deliver>(() => (telegram.isMiniApp.value ? 'chat' : 'download'))
  const summary = computed(() => s.quote.value?.summary ?? null)
  const cost = computed<QuoteCost | null>(() => summary.value?.cost ?? null)
  const canConfirm = computed(
    () => s.stage.value === 'ready' && !!s.quote.value && !!cost.value && s.quote.value.affordable !== false,
  )
  /** The week's file tasks once this send is counted, from the server's own figures. */
  const stayOpen = computed(() => {
    const figures = cost.value
    if (!figures || !figures.limit || figures.left == null) return false
    const used = figures.limit - figures.left + (figures.kind === 'file_task' ? 1 : 0)
    return used / figures.limit >= STAY_OPEN_AT
  })
  /** The files made, PowerPoint first. */
  const results = computed(
    () =>
      (s.job.value?.artifacts ?? [])
        .flatMap((artifact: any) => {
          const mime = String(artifact.mime_type || '')
          const kind = /presentationml/.test(mime) ? 'pptx' : mime === 'application/pdf' ? 'pdf' : null
          return kind
            ? [{ kind, url: String(artifact.download_url || ''), name: String(artifact.name || '') }]
            : []
        })
        .sort((a: { kind: string }, b: { kind: string }) =>
          a.kind === b.kind ? 0 : a.kind === 'pptx' ? -1 : 1,
        ) as {
        kind: 'pptx' | 'pdf'
        url: string
        name: string
      }[],
  )

  /** What Review shows of the send, to tell whether a quote asked again unseen says anything new. */
  const shown = () =>
    JSON.stringify([
      s.format.value,
      s.pdfDropped.value,
      summary.value?.format ?? null,
      summary.value?.slides ?? null,
      summary.value?.warnings ?? [],
    ])

  function fail(refusal: Refusal) {
    s.refusal.value = refusal
    s.stage.value = 'failed'
    telegram.haptic('error')
  }

  function reset() {
    stopTimers()
    runs += 1
    s.stage.value = 'idle'
    s.quote.value = null
    s.refusal.value = null
    s.tooLong.value = []
    s.picturesGone.value = []
    s.format.value = 'both'
    s.pdfDropped.value = false
    s.costChanged.value = false
    s.uncertain.value = false
    s.busy.value = false
    s.job.value = null
    quotedVersion = null
  }

  /** Review opened: what was being typed is already committed. */
  async function begin() {
    reset()
    deck.held.value = false
    await check()
  }

  /**
   * Review closed. A send on its way keeps the deck held until its job starts; one that
   * may have landed unanswered lets go, as the person has moved on from it.
   */
  function dismiss(_chosen = true) {
    if (s.stage.value === 'accepted' || s.stage.value === 'sending') return
    if (s.stage.value !== 'made') deck.held.value = false
    reset()
  }

  /** Saves what is left to save, then asks the server what this send would be. */
  async function check() {
    const run = ++runs
    s.stage.value = 'checking'
    s.refusal.value = null
    s.tooLong.value = []
    s.picturesGone.value = []
    const before = s.quote.value?.summary?.cost ?? null
    let moved = 0
    let waited = 0
    for (;;) {
      const saved = await deck.flush()
      if (run !== runs) return
      if (!saved) {
        s.quote.value = null
        return fail({ code: deck.conflict.value ? 'version_conflict' : 'not_saved', message: '', params: {} })
      }
      const version = deck.version.value
      try {
        const made = await ws.api<DeckQuote>(`/generation/drafts/${deck.draftId.value}/export-quote`, {
          method: 'POST',
          body: { version, format: s.format.value, deliver: deliver.value },
          timeout: QUOTE_TIMEOUT,
        })
        if (run !== runs) return
        if (deck.version.value !== version && moved++ < MOVED_TRIES) continue
        s.quote.value = made
        quotedVersion = version
        s.costChanged.value = !!before && JSON.stringify(before) !== JSON.stringify(made.summary?.cost)
        if (made.affordable === false) return fail({ code: 'weekly_file_limit', message: '', params: {} })
        s.stage.value = 'ready'
        return
      } catch (e) {
        if (run !== runs) return
        const answer = deck.refusalOf(e)
        // No LibreOffice to make the PDF with: the PowerPoint goes alone, and Review says so.
        if (answer.code === 'engine_unavailable' && s.format.value === 'both') {
          s.format.value = 'pptx'
          s.pdfDropped.value = true
          continue
        }
        if (answer.code === 'generation_running' && waited++ < BUSY_TRIES) {
          await wait(BUSY_WAIT)
          if (run !== runs) return
          continue
        }
        s.quote.value = null
        if (answer.code === 'slide_text_too_long' || answer.code === 'pinned_asset_expired') {
          const listed = Array.isArray(answer.params.sections) ? answer.params.sections : []
          if (answer.code === 'slide_text_too_long') {
            s.tooLong.value = listed
            s.stage.value = 'needs_fix'
          } else {
            s.picturesGone.value = listed
            s.stage.value = 'pictures'
          }
          telegram.haptic('warning')
          return
        }
        // The frame shows its two choices; Review closes itself for them.
        if (answer.code === 'version_conflict') deck.holdForChoice()
        return fail(answer.status ? answer : { ...answer, code: 'unanswered' })
      }
    }
  }

  async function confirm() {
    if (s.busy.value || s.stage.value === 'sending') return
    // A retry after no answer is the same send, whatever its quote's age: the key says so.
    if (s.uncertain.value && s.quote.value) return submit(s.quote.value)
    if (!canConfirm.value || !s.quote.value) return
    s.busy.value = true
    try {
      // Saved since it was quoted: the new quote is shown and confirmed again.
      if (deck.version.value !== quotedVersion || !['saved', 'clean'].includes(deck.saveState.value))
        return await check()
      if (Date.parse(s.quote.value.expires_at) - EXPIRY_MARGIN <= Date.now()) {
        const told = shown()
        await check()
        // Asked again unseen, it goes on only as Review showed it: a new cost, the PDF left out or a
        // new warning stays on Review, said, to be confirmed again.
        if (!canConfirm.value || s.costChanged.value || shown() !== told) return
      }
      await submit(s.quote.value!)
    } finally {
      s.busy.value = false
    }
  }

  async function submit(made: DeckQuote, again = true): Promise<void> {
    const run = runs
    const draftId = deck.draftId.value
    const version = quotedVersion ?? deck.version.value
    s.stage.value = 'sending'
    s.refusal.value = null
    deck.held.value = true
    if (!keys.has(made.id)) keys.set(made.id, newKey())
    try {
      const accepted = await ws.api<any>('/jobs', {
        method: 'POST',
        headers: { 'Idempotency-Key': keys.get(made.id)! },
        body: { quote_id: made.id, ...(deliver.value === 'chat' ? { deliver_to_chat: true } : {}) },
        timeout: SEND_TIMEOUT,
      })
      // The send was let go meanwhile: what came after it is not closed on its answer.
      if (run !== runs) return
      s.uncertain.value = false
      s.job.value = accepted
      s.stage.value = 'accepted'
      telegram.haptic('success')
      // Review's list starts again from here, unless the send fails: then it is put back.
      const sentFrom = deck.draftId.value === draftId ? deck.baseline.value : null
      deck.recordSent(version, { id: draftId })
      if (deliver.value === 'chat' && !stayOpen.value)
        closing = setTimeout(() => {
          closing = null
          telegram.close()
        }, ACCEPTED_FOR)
      follow(accepted, draftId, sentFrom)
    } catch (e) {
      if (run !== runs) return
      const answer = deck.refusalOf(e)
      if (!answer.status || answer.status >= 500) {
        // It may have landed: the deck stays held until the next answer says.
        s.uncertain.value = true
        return fail({ ...answer, code: 'unanswered' })
      }
      s.uncertain.value = false
      deck.held.value = false
      if (answer.code === 'quote_expired' && again) {
        const told = shown()
        const asked = check()
        const mine = runs
        await asked
        // Gone on by itself only as it was: a new cost, the PDF left out or a new warning is shown and confirmed first.
        if (mine === runs && canConfirm.value && !s.costChanged.value && shown() === told && s.quote.value)
          return submit(s.quote.value, false)
        return
      }
      if (answer.code === 'version_conflict') deck.holdForChoice()
      fail(answer)
    }
  }

  /**
   * Follows the job until it ends; the hold goes as soon as it has read the draft. Once
   * another deck is open, the job's end only marks its own deck: nothing of the deck on
   * screen is held, quoted again or put in conflict for it.
   */
  function follow(first: any, draftId: string, sentFrom: DeckContent | null) {
    const id = first.id
    // A `reset` lets this one go, even when the next send is answered with this same job.
    const run = runs
    const started = Date.now()
    let misses = 0
    const here = () => deck.draftId.value === draftId
    const look = (fresh: any) => {
      if (fresh.status !== 'queued' && here()) deck.held.value = false
      if (!TERMINAL.includes(fresh.status)) return false
      if (fresh.status === 'succeeded') {
        if (!here()) return true
        s.stage.value = 'made'
        // The send gave the draft another day.
        void deck.refreshDraft()
        return true
      }
      // Failed at once: the app stays to say so, rather than close on it.
      if (closing !== null) clearTimeout(closing)
      closing = null
      // It sent nothing: the deck is unsent again, and Review lists all it would have.
      deck.recordSent(null, { id: draftId, restore: sentFrom })
      if (!here()) return true
      const code = fresh.error?.code || fresh.status
      // Too long once drawn, past what the quote could measure: the next quote names those slides.
      if (code === 'slide_text_too_long') {
        void check()
        return true
      }
      if (code === 'version_conflict') deck.holdForChoice()
      fail({ code, message: fresh.error?.message || '', params: fresh.error?.message_params ?? {} })
      return true
    }
    const tick = async () => {
      polling = null
      try {
        const fresh = await ws.api<any>(`/jobs/${id}`, { timeout: POLL_TIMEOUT })
        if (run !== runs || s.job.value?.id !== id) return
        misses = 0
        s.job.value = fresh
        if (look(fresh)) return
      } catch {
        if (run !== runs || s.job.value?.id !== id) return
        misses += 1
        if (misses >= POLL_MISSES && here()) deck.held.value = false
      }
      if (Date.now() - started < POLL_FOR) polling = setTimeout(tick, POLL_EVERY)
      else if (here()) deck.held.value = false
    }
    if (!look(first)) polling = setTimeout(tick, POLL_EVERY)
  }

  return {
    deliver,
    format: s.format,
    stage: s.stage,
    quote: s.quote,
    summary,
    cost,
    refusal: s.refusal,
    tooLong: s.tooLong,
    picturesGone: s.picturesGone,
    pdfDropped: s.pdfDropped,
    costChanged: s.costChanged,
    uncertain: s.uncertain,
    busy: s.busy,
    job: s.job,
    results,
    canConfirm,
    stayOpen,
    begin,
    check,
    confirm,
    dismiss,
    reset,
  }
}
