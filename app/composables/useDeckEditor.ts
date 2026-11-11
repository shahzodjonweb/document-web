/**
 * A generated deck as the slide editor holds it: its content, history and saves,
 * and the slide pictures the server draws of each saved version.
 *
 * Every PATCH carries the whole content and the exact current `version`, so one
 * write is in flight at a time, and what goes is `normaliseContent`, the server's
 * own trimming done first: what was sent and what came back then compare equal,
 * and a save that changes nothing is never sent.
 *
 * Pictures are drawn in the editor lane, never on a save. A save asks for its
 * version (`POST /render`) and the answer is followed until it is drawn; a slide
 * keeps its last picture, marked stale, until a version that has its change comes.
 */
import type { EffectScope, Ref } from 'vue'
import type { components } from '../../generated/api/schema'
import type { Refusal, SaveState } from '~/composables/useEditorSession'
import { SLIDE_LAYOUTS } from './useSlideLayouts.ts'

export type DeckDraft = components['schemas']['GenerationDraft']
export type DeckContent = components['schemas']['GenerationContent']
export type DeckSection = Required<
  Pick<components['schemas']['GenerationSection'], 'id' | 'heading' | 'body'>
> & {
  notes: string
  layout: string
  items: { label: string; text: string; value: string }[]
  columns: string[]
  image_query: string
}
export type DeckQuestion = components['schemas']['GenerationQuestion']
export type DeckFit = components['schemas']['DeckSlideFit']
export type DeckFrame = { field: 'heading' | 'body' | 'picture'; x: number; y: number; w: number; h: number }
export interface DeckSlideImage {
  key: string
  url: string
  thumb: string
  frames: DeckFrame[]
  fits: boolean
  letters_over: number
  /** The deck version this picture was drawn from. */
  version: number
}
export type SlideRef =
  | { kind: 'section'; id: string; index: number }
  | { kind: 'questions'; page: number; index: number }
export type DeckOpenState = 'loading' | 'ready' | 'gone' | 'not_editable' | 'off' | 'failed'
export type PreviewState = 'idle' | 'drawing' | 'unavailable' | 'busy'
export type CommitReason = 'done' | 'close' | 'blur' | 'send' | 'hide' | 'leave' | 'navigate'
type DeckRender = components['schemas']['DeckRender']
type DeckRenderSlide = components['schemas']['DeckRenderSlide']

export const QUESTIONS_PER_SLIDE = 5,
  MAX_LINES = 8,
  LINE_CHARS = 400,
  BODY_CHARS = 3400,
  HISTORY_LIMIT = 50,
  AUTOSAVE_DELAY = 900,
  BUSY_RETRY = 2000,
  KEEPALIVE_BYTES = 60000,
  LEAVE_WAIT = 3000,
  FIT_PAUSE = 1500,
  EXPIRY_WARNING = 3 * 3600_000,
  PATCH_TIMEOUT = 20000,
  RENDER_TIMEOUT = 10000,
  FIT_TIMEOUT = 5000

const COALESCE_WINDOW = 500
const OPEN_TIMEOUT = 15000
/** How long opening waits for the studio's switches before going on without them. */
const CONFIG_WAIT = 5000
/** A save with no answer goes again after these, then waits for Save now or the connection. */
const SAVE_RETRIES = [2000, 5000, 10000, 20000]
const POLL_WAITS = [500, 700, 1000, 1500, 2000]
/** Past this a picture is called unavailable, and looked for now and then a while longer. */
const POLL_FOR = 60_000
const POLL_SLOW = 10_000
const POLL_SLOW_FOR = 5 * 60_000
/** Unanswered looks in a row before the preview is called unavailable; fewer are a bad moment. */
const POLL_MISSES = 3
/** Asks for one version's pictures within one follow, so a server saying `none` cannot loop it. */
const RENDER_ASKS = 3
const LANE_RETRY = 60_000
const LANE_TRIES = 10
const FIT_LIMIT_PAUSE = 30_000
const FIT_KEPT = 200
const ORDERS_KEPT = 20
/** `domain.MAX_QUESTIONS`. */
const MAX_QUESTIONS = 40
const MAX_ITEMS = 8
const MAX_COLUMNS = 3
/** Each with the account's id after it: one device, one set of marks per account. */
const SEEN_KEY = 'docmaster-deck-seen'
const SENT_KEY = 'docmaster-deck-sent'
const MARKS_KEPT = 20

type Timer = ReturnType<typeof setTimeout>
type Order = { ids: string[]; questionPages: number }

/**
 * What every `useDeckEditor()` call shares about the open deck, beside its `useState`:
 * plain data, as nothing here needs to be watched. A deck with another id starts afresh.
 */
interface DeckState {
  id: string
  /** The account it was opened by: another one signed in since never sees or saves it. */
  owner: string
  past: string[]
  future: string[]
  lastLabel: string
  lastAt: number
  saveTimer: Timer | null
  retryTimer: Timer | null
  retryStep: number
  /** The write in flight; the next waits for it, as each PATCH needs the version it returns. */
  saving: Promise<boolean> | null
  /** The content the server last confirmed, as `normaliseContent` gives it. */
  onServer: string
  savedIds: string[]
  /** Contents sent with no answer since the last that got one: any may be what landed. */
  unanswered: Set<string>
  /** Each saved version's slide order, to put a drawing's pictures on the slides it drew. */
  orders: Map<number, Order>
  /** The version that last changed each slide: a picture older than it is stale. */
  changedAt: Map<string, number>
  questionsChangedAt: number
  fitCache: Map<string, DeckFit>
  fitInFlight: Promise<void> | null
  fitQueued: { section: DeckSection; key: string; resolve: (fit: DeckFit | null) => void } | null
  fitPausedUntil: number
  pollTimer: Timer | null
  /** Lets go of a poll waiting for the app to be seen again. */
  waiting: (() => void) | null
  renderWanted: number | null
  renderRetried: boolean
  conflictRetried: boolean
  busyTries: number
  /** Goes up with every new follow of a drawing, so an older one stops where it is. */
  run: number
  firstDone: boolean
  closed: boolean
  /** Another deck is being opened: nothing more is typed in, and what is left to save still goes. */
  leaving: boolean
}

/**
 * An edit whose last write never landed, held when its deck is let go: what was on the
 * screen, what the server had confirmed, the writes that went with no answer, and the
 * history. In this tab only, never stored; the deck's next opening puts it back.
 */
interface Unsaved {
  owner: string
  content: string
  onServer: string
  unanswered: Set<string>
  past: string[]
  future: string[]
  /** A refusal's words: sending it again changes nothing, so it is shown again, not sent. */
  refused: string | null
  /** Whoever opened another deck since has been told it waits here. */
  told: boolean
}

const decks = new Map<string, DeckState>()
const unsaved = new Map<string, Unsaved>()
const UNSAVED_KEPT = 5
/**
 * Counts `open` calls, so a slow one cannot replace the deck asked for after it; `close`
 * counts too, so an opening its editor started stops once that editor is gone.
 */
let opens = 0
/**
 * Whose `open` came last. The next page mounts before the last one goes, so an editor
 * closing as another opens must not stop that one.
 */
let opener: object | null = null
/** The open deck's watchers, timers and window listeners, which outlive any one component. */
let scope: EffectScope | null = null

function blank(id: string, owner: string): DeckState {
  return {
    id,
    owner,
    past: [],
    future: [],
    lastLabel: '',
    lastAt: 0,
    saveTimer: null,
    retryTimer: null,
    retryStep: 0,
    saving: null,
    onServer: '',
    savedIds: [],
    unanswered: new Set(),
    orders: new Map(),
    changedAt: new Map(),
    questionsChangedAt: 0,
    fitCache: new Map(),
    fitInFlight: null,
    fitQueued: null,
    fitPausedUntil: 0,
    pollTimer: null,
    waiting: null,
    renderWanted: null,
    renderRetried: false,
    conflictRetried: false,
    busyTries: 0,
    run: 0,
    firstDone: false,
    closed: false,
    leaving: false,
  }
}

// ---------------------------------------------------------------- pure

/** Python's `str.strip()` whitespace, which is not quite JavaScript's `trim()`. */
const SPACE = /[\t\n\v\f\r \x1c-\x1f\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/.source
const PY_STRIP = new RegExp(`^${SPACE}+|${SPACE}+$`, 'g')

/** Python's `[:n]`, by letters: a cut never splits an emoji the server keeps whole. */
function cut(text: string, n: number) {
  return text.length <= n ? text : Array.from(text).slice(0, n).join('')
}
/** `str(value)`. */
const str = (value: unknown) => (value === null || value === undefined ? '' : String(value))
/** `str(value or '')`. */
const orEmpty = (value: unknown) => (value ? String(value) : '')
const strip = (text: string) => text.replace(PY_STRIP, '')
const isObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/** `layouts.clean_query`: a few lower-case English words, as the photo search gets them. */
function cleanQuery(text: unknown) {
  const folded = orEmpty(text).normalize('NFKC').toLowerCase()
  return folded
    .replace(/[^a-z0-9 '-]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 5)
    .join(' ')
    .slice(0, 100)
}

/**
 * `domain.validate_content` for a deck, without the plan's slide cap (adding a slide
 * past it is refused before it happens): headings, bodies and notes cut, not
 * stripped; items and columns stripped and cut, empty ones dropped; questions given
 * their defaults; anything but title, sections, questions and citations left out.
 */
export function normaliseContent(c: DeckContent): DeckContent {
  const source: Record<string, any> = isObject(c) ? c : {}
  const title = cut(str(source.title ?? 'Document'), 160)
  const sections: DeckSection[] = []
  const given: unknown[] = Array.isArray(source.sections) ? source.sections : []
  given.forEach((section, index) => {
    if (!isObject(section)) return
    const items: DeckSection['items'] = []
    for (const item of Array.isArray(section.items) ? section.items : []) {
      if (!isObject(item)) continue
      const clean = {
        label: cut(strip(orEmpty(item.label)), 160),
        text: cut(strip(orEmpty(item.text)), 600),
        value: cut(strip(orEmpty(item.value)), 160),
      }
      if (clean.label || clean.text || clean.value) items.push(clean)
    }
    const columns = (Array.isArray(section.columns) ? section.columns : [])
      .slice(0, MAX_COLUMNS)
      .map((column: unknown) => cut(strip(orEmpty(column)), 80))
    sections.push({
      id: cut(str(section.id ?? `s${index + 1}`), 40),
      heading: cut(str('heading' in section ? section.heading : (section.title ?? '')), 160),
      body: cut(str(section.body ?? ''), BODY_CHARS),
      notes: cut(str(section.notes ?? ''), 2000),
      layout: str(section.layout || 'auto'),
      items: items.slice(0, MAX_ITEMS),
      columns: columns.some(Boolean) ? columns : [],
      image_query: cleanQuery(section.image_query),
    })
  })
  const questions: DeckQuestion[] = []
  const asked: unknown[] = Array.isArray(source.questions) ? source.questions.slice(0, MAX_QUESTIONS) : []
  asked.forEach((question, index) => {
    if (!isObject(question)) return
    const options: unknown[] = Array.isArray(question.options) ? question.options.slice(0, 8) : []
    const marks = question.marks ?? 1
    questions.push({
      id: cut(str(question.id ?? `q${index + 1}`), 40),
      stem: cut(str(question.stem ?? ''), 2000),
      options: options.map((option) => cut(str(option), 500)),
      answer: cut(str(question.answer ?? ''), 2000),
      explanation: cut(str(question.explanation ?? ''), 3000),
      topic: cut(str(question.topic ?? title), 100),
      marks: Number.isInteger(marks) && marks >= 1 && marks <= 100 ? marks : 1,
    })
  })
  const citations = Array.isArray(source.citations) ? source.citations : []
  return { title, sections, questions, citations } as DeckContent
}

const sectionsOf = (content: DeckContent) => content.sections as DeckSection[]
const orderOf = (content: DeckContent): Order => ({
  ids: content.sections.map((section) => section.id),
  questionPages: Math.ceil(content.questions.length / QUESTIONS_PER_SLIDE),
})

/** A slide id the server takes: at most 40 characters, and never a question slide's `q1`. */
export function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  )
}

/**
 * iOS shows the keyboard only for a field focused inside the tap's own handler, and
 * the docked field mounts a moment later. A field focused now holds the keyboard
 * up until the dock takes focus from it.
 */
export function primeKeyboard() {
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

const codeOf = (e: any): string => e?.data?.error?.code || ''
const statusOf = (e: any): number | undefined => e?.statusCode || e?.status || e?.response?.status

function readMarks(key: string): Record<string, number> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}')
    return isObject(value) ? value : {}
  } catch {
    return {}
  }
}
function writeMarks(key: string, value: Record<string, number>) {
  const kept = Object.fromEntries(Object.entries(value).slice(-MARKS_KEPT))
  try {
    localStorage.setItem(key, JSON.stringify(kept))
  } catch {
    // Without storage only the not-sent dot forgets, at the next visit.
  }
  return kept
}

async function until(ready: () => boolean, limit: number) {
  const end = Date.now() + limit
  while (!ready() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 50))
}

// ---------------------------------------------------------------- the deck

export function useDeckEditor() {
  const ws = useWorkspace()
  const studio = useStudio()
  const { t, locale, path } = useLocale()
  const pictures = useDeckImages()
  const snackbar = useEditorSnackbar()
  /** This call's own mark, set on `open`: its `close` stops only an opening it started. */
  const self = {}

  const openedId = useState('deck-id', () => '')
  const draft = useState<DeckDraft | null>('deck-draft', () => null)
  const content = useState<DeckContent>('deck-content', () => ({
    title: '',
    sections: [],
    questions: [],
    citations: [],
  }))
  const version = useState('deck-version', () => 0)
  const openState = useState<DeckOpenState>('deck-open-state', () => 'loading')
  const openError = useState('deck-open-error', () => '')
  const saveState = useState<SaveState>('deck-save-state', () => 'clean')
  const saveError = useState('deck-save-error', () => '')
  /** Whether Save now could help: a write with no answer, not a refusal. */
  const saveRetryable = useState('deck-save-retryable', () => false)
  const conflict = useState('deck-conflict', () => false)
  /** A send in flight: its job reads the draft when it starts, so nothing changes meanwhile. */
  const held = useState('deck-held', () => false)
  /** Goes up with every change to the history, so an offer to undo one step can tell it is still the last. */
  const steps = useState('deck-steps', () => 0)
  const canUndo = useState('deck-can-undo', () => false)
  const canRedo = useState('deck-can-redo', () => false)
  const current = useState('deck-current', () => 0)
  const images = useState<Record<string, DeckSlideImage>>('deck-images', () => ({}))
  const questionImages = useState<DeckSlideImage[]>('deck-question-images', () => [])
  const preview = useState<PreviewState>('deck-preview', () => 'idle')
  const previewError = useState<string | null>('deck-preview-error', () => null)
  const hiddenAtFirstRender = useState('deck-hidden-first', () => 0)
  /** The content as it was opened or last sent, for Review's list of changes. Never stored. */
  const baseline = useState<DeckContent | null>('deck-baseline', () => null)
  const bodyFace = useState<string | null>('deck-body-face', () => null)
  const marks = useState<{ seen: Record<string, number>; sent: Record<string, number> }>(
    'deck-marks',
    () => ({
      seen: {},
      sent: {},
    }),
  )
  const clock = useState('deck-clock', () => Date.now())

  const deck = () => decks.get(openedId.value) ?? null
  const account = () => String(ws.user.value?.id ?? '')
  const markKey = (base: string) => `${base}:${account()}`
  const sections = computed(() => sectionsOf(content.value))
  const questionPages = computed(() => Math.ceil(content.value.questions.length / QUESTIONS_PER_SLIDE))
  const slides = computed<SlideRef[]>(() => [
    ...sections.value.map((section, index) => ({ kind: 'section' as const, id: section.id, index })),
    ...Array.from({ length: questionPages.value }, (_, page) => ({
      kind: 'questions' as const,
      page,
      index: sections.value.length + page,
    })),
  ])
  const total = computed(() => slides.value.length)
  const editable = computed(() => openState.value === 'ready' && !held.value && !conflict.value)
  const expiresAt = computed(() => draft.value?.expires_at ?? '')
  const expiresSoon = computed(
    () => !!expiresAt.value && Date.parse(expiresAt.value) - clock.value < EXPIRY_WARNING,
  )
  const unsent = computed(() => {
    const id = openedId.value
    return version.value !== (marks.value.sent[id] ?? marks.value.seen[id])
  })
  const maxSlides = computed(() => Number(studio.config.value?.limits?.slides) || 60)
  const deckLocale = computed<'en' | 'uz' | 'ru'>(() => draft.value?.output_locale ?? 'en')

  function requestError(e: any) {
    return e?.data?.error?.message || e?.data?.message || t('genericError')
  }

  /** A refusal's code, words and parameters; one with no answer from the server is `unanswered`. */
  function refusalOf(e: unknown): Refusal {
    const refused = (e as any)?.data?.error
    return {
      code: refused?.code || 'unanswered',
      message: requestError(e),
      params: refused?.message_params ?? {},
      status: statusOf(e),
    }
  }

  function imageOf(ref: SlideRef): DeckSlideImage | null {
    return (ref.kind === 'section' ? images.value[ref.id] : questionImages.value[ref.page]) ?? null
  }

  function isStale(ref: SlideRef) {
    // Read so a template asking this hears of each save: the versions below change with it.
    void version.value
    const state = deck()
    const image = imageOf(ref)
    if (!state || !image) return false
    return (
      image.version < (ref.kind === 'section' ? (state.changedAt.get(ref.id) ?? 0) : state.questionsChangedAt)
    )
  }

  const needsDrawing = () => slides.value.some((ref) => !imageOf(ref) || isStale(ref))

  function clampCurrent() {
    current.value = Math.max(0, Math.min(current.value, total.value - 1))
  }

  /** The slide on screen stays on screen through a change that moves it, if it is still there. */
  function holdingCurrent(change: () => void) {
    const showing = slides.value[current.value]
    change()
    if (showing?.kind === 'section') {
      const at = sections.value.findIndex((section) => section.id === showing.id)
      if (at >= 0) current.value = at
    } else if (showing?.kind === 'questions') current.value = sections.value.length + showing.page
    clampCurrent()
  }

  // ------------------------------------------------------------ history

  function syncFlags(state: DeckState) {
    canUndo.value = state.past.length > 0
    canRedo.value = state.future.length > 0
    steps.value += 1
  }

  function markDirty() {
    const state = deck()
    if (!state || saveState.value === 'paused') return
    saveState.value = 'dirty'
    saveError.value = ''
    if (state.saveTimer) clearTimeout(state.saveTimer)
    state.saveTimer = setTimeout(() => {
      state.saveTimer = null
      void persist()
    }, AUTOSAVE_DELAY)
  }

  /**
   * Every change goes through here, as one step of history. The same label within
   * half a second is the same step (a burst of taps on Later); `amend` folds a change
   * into the step before it however long ago, and leaves none when the two together
   * changed nothing. A change that changes nothing is no step and no save.
   */
  function mutate(label: string, apply: (c: DeckContent) => void, opts: { amend?: boolean } = {}) {
    const state = deck()
    if (!state || !editable.value) return
    const before = JSON.stringify(content.value)
    const next = JSON.parse(before) as DeckContent
    apply(next)
    const after = JSON.stringify(next)
    if (after === before) return
    const now = Date.now()
    const together = opts.amend || (label === state.lastLabel && now - state.lastAt <= COALESCE_WINDOW)
    if (!together || !state.past.length) {
      state.past.push(before)
      if (state.past.length > HISTORY_LIMIT) state.past.shift()
    } else if (opts.amend && state.past[state.past.length - 1] === after) state.past.pop()
    state.future.length = 0
    state.lastLabel = label
    state.lastAt = now
    content.value = next
    syncFlags(state)
    markDirty()
  }

  function step(from: 'past' | 'future') {
    const state = deck()
    if (!state || !editable.value) return
    const snapshot = state[from].pop()
    if (snapshot === undefined) return
    state[from === 'past' ? 'future' : 'past'].push(JSON.stringify(content.value))
    state.lastLabel = ''
    holdingCurrent(() => (content.value = JSON.parse(snapshot)))
    syncFlags(state)
    markDirty()
  }
  const undo = () => step('past')
  const redo = () => step('future')

  // ------------------------------------------------------------ slides

  const indexOf = (id: string) => sections.value.findIndex((section) => section.id === id)
  const has = (id: string) => indexOf(id) >= 0

  function setSection(
    id: string,
    patch: Partial<DeckSection>,
    label?: string,
    opts: { amend?: boolean } = {},
  ) {
    const values = clone(patch)
    mutate(
      label ?? `section:${id}`,
      (c) => {
        const section = sectionsOf(c).find((item) => item.id === id)
        if (section) Object.assign(section, values, { id })
      },
      opts,
    )
  }

  /** A "Title and lines" slide after section `after`, on screen at once. Null at the plan's count of slides. */
  function addSlide(after: number, patch: Partial<DeckSection> = {}): string | null {
    const count = sections.value.length
    if (!editable.value || !count || count >= maxSlides.value) return null
    // From a question slide it goes after the last slide, as question slides come last.
    const from = current.value >= count ? count - 1 : Math.max(0, Math.min(Math.round(after), count - 1))
    const at = Math.max(1, from + 1)
    const id = newId()
    const section: DeckSection = {
      id,
      heading: '',
      body: '',
      notes: '',
      layout: 'bullets',
      items: [],
      columns: [],
      image_query: '',
      ...clone(patch),
    }
    section.id = id
    mutate(`add:${id}`, (c) => {
      sectionsOf(c).splice(at, 0, section)
    })
    if (!has(id)) return null
    current.value = at
    return id
  }

  function duplicateSlide(id: string): string | null {
    const index = indexOf(id)
    const source = sections.value[index]
    if (!editable.value || index <= 0 || !source || sections.value.length >= maxSlides.value) return null
    const copy = { ...clone(source), id: newId() }
    holdingCurrent(() =>
      mutate(`duplicate:${copy.id}`, (c) => {
        sectionsOf(c).splice(index + 1, 0, copy)
      }),
    )
    return has(copy.id) ? copy.id : null
  }

  /** The caller offers Undo: `{message: t('editorDeleted'), actionLabel: t('editorUndo'), onAction: undo, step: steps}`. */
  function deleteSlide(id: string) {
    const index = indexOf(id)
    if (!editable.value || index <= 0) return
    const showing = current.value
    mutate(`delete:${id}`, (c) => {
      c.sections.splice(index, 1)
    })
    if (has(id)) return
    // The slide that took its place shows, or the one before it when it was the last.
    current.value =
      showing > index ? showing - 1 : showing === index ? Math.min(index, sections.value.length - 1) : showing
    clampCurrent()
  }

  /** `to` is the slide's final index; the title slide stays first. */
  function moveSlide(id: string, to: number) {
    const from = indexOf(id)
    if (!editable.value || from <= 0) return
    const target = Math.max(1, Math.min(Math.round(to), sections.value.length - 1))
    if (target === from) return
    holdingCurrent(() =>
      mutate(`move:${id}`, (c) => {
        const [moved] = c.sections.splice(from, 1)
        c.sections.splice(target, 0, moved!)
      }),
    )
  }

  /** Half its lines, or else half its items, onto a new slide after it with the same headline. */
  function splitSlide(id: string): string | null {
    const index = indexOf(id)
    const section = sections.value[index]
    if (!editable.value || index <= 0 || !section || sections.value.length >= maxSlides.value) return null
    const lines = section.body.split('\n').filter((line) => line.trim())
    const items = section.items.filter(
      (item) => item.label?.trim() || item.text?.trim() || item.value?.trim(),
    )
    let keep: Partial<DeckSection>
    let rest: Partial<DeckSection>
    if (lines.length >= 2) {
      const half = Math.ceil(lines.length / 2)
      keep = { body: lines.slice(0, half).join('\n') }
      rest = { body: lines.slice(half).join('\n') }
    } else if (items.length >= 2) {
      const half = Math.ceil(items.length / 2)
      keep = { items: items.slice(0, half) }
      rest = { items: items.slice(half) }
    } else return null
    const next: DeckSection = {
      id: newId(),
      heading: section.heading,
      body: '',
      layout: section.layout,
      items: [],
      columns: [...section.columns],
      notes: '',
      image_query: '',
      ...clone(rest),
    }
    holdingCurrent(() =>
      mutate(`split:${id}`, (c) => {
        const all = sectionsOf(c)
        const at = all.findIndex((item) => item.id === id)
        Object.assign(all[at]!, clone(keep))
        all.splice(at + 1, 0, next)
      }),
    )
    return has(next.id) ? next.id : null
  }

  /** `layout` comes from the slide's `layouts_fitting`; anything the server does not know is ignored. */
  function setLayout(id: string, layout: string) {
    if (!(SLIDE_LAYOUTS as string[]).includes(layout)) return
    mutate(`layout:${id}`, (c) => {
      const section = sectionsOf(c).find((item) => item.id === id)
      if (section) section.layout = layout
    })
  }

  function setQuestions(next: DeckQuestion[]) {
    const values = clone(next)
    holdingCurrent(() =>
      mutate('questions', (c) => {
        c.questions = values
      }),
    )
  }

  /** One question slide fewer; never fewer than one slide's worth. */
  function fewerQuestions() {
    const count = content.value.questions.length
    if (count <= QUESTIONS_PER_SLIDE) return
    const keep = (Math.ceil(count / QUESTIONS_PER_SLIDE) - 1) * QUESTIONS_PER_SLIDE
    holdingCurrent(() =>
      mutate('questions:fewer', (c) => {
        c.questions = c.questions.slice(0, keep)
      }),
    )
  }

  function removeQuiz() {
    holdingCurrent(() =>
      mutate('questions:remove', (c) => {
        c.questions = []
      }),
    )
  }

  // ------------------------------------------------------------ saving

  function stopSaves(state: DeckState) {
    if (state.saveTimer) clearTimeout(state.saveTimer)
    if (state.retryTimer) clearTimeout(state.retryTimer)
    state.saveTimer = null
    state.retryTimer = null
  }

  /** The deck can no longer be edited here: nothing more is drawn or saved, and leaving asks nothing. */
  function shut(state: DeckState, to: DeckOpenState) {
    halt(state)
    stopSaves(state)
    saveState.value = 'clean'
    openState.value = to
  }

  const pendingSave = (state: DeckState) =>
    !!state.saving || !!state.retryTimer || saveState.value === 'dirty' || saveState.value === 'saving'

  /** The slides a confirmed version changed, by the version before it: their pictures are stale until drawn again. */
  function markChanged(state: DeckState, before: DeckContent, after: DeckContent, at: number) {
    const was = before.sections.map((section) => section.id)
    const moved =
      was.length !== after.sections.length ||
      after.sections.some((section, index) => section.id !== was[index])
    const old = new Map(before.sections.map((section) => [section.id, JSON.stringify(section)]))
    for (const section of after.sections)
      if (moved || old.get(section.id) !== JSON.stringify(section)) state.changedAt.set(section.id, at)
    if (moved || JSON.stringify(before.questions) !== JSON.stringify(after.questions))
      state.questionsChangedAt = at
  }

  /** A version the server holds, as the one the next write builds on. */
  function confirm(state: DeckState, fresh: DeckDraft) {
    const before = state.onServer ? (JSON.parse(state.onServer) as DeckContent) : null
    const after = normaliseContent(fresh.content)
    state.onServer = JSON.stringify(after)
    state.savedIds = after.sections.map((section) => section.id)
    version.value = fresh.version
    draft.value = fresh
    state.orders.set(fresh.version, orderOf(after))
    const oldest = state.orders.keys().next().value
    if (state.orders.size > ORDERS_KEPT && oldest !== undefined) state.orders.delete(oldest)
    if (before) markChanged(state, before, after, fresh.version)
  }

  function retrySoon(state: DeckState) {
    if (state.retryTimer || state.retryStep >= SAVE_RETRIES.length) return
    const wait = SAVE_RETRIES[state.retryStep]!
    state.retryStep += 1
    state.retryTimer = setTimeout(() => {
      state.retryTimer = null
      if (decks.get(state.id) === state && !state.closed) void persist()
    }, wait)
  }

  /**
   * Resolves true once the server holds what was here when this was called. Whoever
   * asks during a write waits for it, then sends what is newest by then.
   */
  async function persist(keepalive = false): Promise<boolean> {
    const state = deck()
    if (!state || (openState.value !== 'ready' && !state.leaving) || saveState.value === 'paused')
      return false
    stopSaves(state)
    if (state.saving) {
      await state.saving
      return deck() === state ? persist(keepalive) : false
    }
    const write = send(state, keepalive)
    state.saving = write
    try {
      return await write
    } finally {
      state.saving = null
    }
  }

  async function send(state: DeckState, keepalive: boolean): Promise<boolean> {
    const normal = normaliseContent(content.value)
    const sending = JSON.stringify(normal)
    // The server has all of it. A write with no answer may have changed that, so only one that was answered says so.
    if (sending === state.onServer && !state.unanswered.size) {
      saveState.value = 'saved'
      saveError.value = ''
      saveRetryable.value = false
      if (state.renderWanted !== version.value) requestRender()
      return true
    }
    saveState.value = 'saving'
    const body = { version: version.value, content: normal }
    // A browser refuses a `keepalive` request over 64 KiB; a bigger deck goes as a normal one.
    const small = new TextEncoder().encode(JSON.stringify(body)).length <= KEEPALIVE_BYTES
    try {
      const fresh = await ws.api<DeckDraft>(`/generation/drafts/${state.id}`, {
        method: 'PATCH',
        body,
        timeout: PATCH_TIMEOUT,
        ...(keepalive && small ? { keepalive: true } : {}),
      })
      if (decks.get(state.id) !== state) return true
      state.unanswered.clear()
      state.retryStep = 0
      confirm(state, fresh)
      // Nothing changed during the write, so the server's normalised words stand; otherwise the newer edit wins.
      if (saveState.value === 'saving') {
        if (JSON.stringify(normaliseContent(content.value)) !== state.onServer)
          content.value = JSON.parse(state.onServer)
        saveState.value = 'saved'
      }
      saveError.value = ''
      saveRetryable.value = false
      requestRender()
      return true
    } catch (e: any) {
      if (decks.get(state.id) !== state) return false
      const code = codeOf(e)
      const status = statusOf(e)
      if (code === 'version_conflict') return onConflict(state)
      // Held back while a generation runs, not refused: it goes again by itself, and says nothing.
      if (code === 'generation_running') {
        saveState.value = 'dirty'
        if (state.saveTimer) clearTimeout(state.saveTimer)
        state.saveTimer = setTimeout(() => {
          state.saveTimer = null
          void persist()
        }, BUSY_RETRY)
        return false
      }
      if (code === 'not_found' || status === 404) {
        shut(state, 'gone')
        return false
      }
      if (!status || status >= 500) {
        // Not an answer from the server itself, so it may still have landed.
        state.unanswered.add(sending)
        saveState.value = 'failed'
        saveRetryable.value = true
        saveError.value = t('editorNotSaved')
        retrySoon(state)
        return false
      }
      // Refused: sending it again changes nothing, so it waits for the next edit (which may be the fix) or Undo.
      saveState.value = 'failed'
      saveRetryable.value = false
      saveError.value = e?.data?.error?.message || t('genericError')
      return false
    }
  }

  /**
   * A write can land with its answer lost, as when the app is hidden straight
   * after it, and the next one then reads as a conflict with a device that does
   * not exist. So look first: only something else on the server is a choice.
   */
  async function onConflict(state: DeckState): Promise<boolean> {
    if (state.unanswered.size) {
      let server: DeckDraft
      try {
        server = await ws.api<DeckDraft>(`/generation/drafts/${state.id}`, { timeout: PATCH_TIMEOUT })
      } catch {
        if (decks.get(state.id) !== state) return false
        saveState.value = 'failed'
        saveRetryable.value = true
        saveError.value = t('editorNotSaved')
        return false
      }
      if (decks.get(state.id) !== state) return false
      const ours = state.unanswered.has(JSON.stringify(normaliseContent(server.content)))
      state.unanswered.clear()
      if (ours) {
        confirm(state, server)
        return send(state, false)
      }
    }
    holdForChoice()
    return false
  }

  /** Two versions exist and only the customer can say which stands, so saving waits for that. */
  function holdForChoice() {
    const state = deck()
    conflict.value = true
    saveState.value = 'paused'
    saveError.value = ''
    if (state) stopSaves(state)
  }

  /** The server's version stands; the one on this screen is one Undo away. */
  async function resolveTakeServer() {
    const state = deck()
    if (!state) return
    let server: DeckDraft
    try {
      server = await ws.api<DeckDraft>(`/generation/drafts/${state.id}`, { timeout: PATCH_TIMEOUT })
    } catch {
      return
    }
    if (deck() !== state) return
    state.past.push(JSON.stringify(content.value))
    if (state.past.length > HISTORY_LIMIT) state.past.shift()
    state.future.length = 0
    state.lastLabel = ''
    state.unanswered.clear()
    confirm(state, server)
    holdingCurrent(() => (content.value = JSON.parse(state.onServer)))
    conflict.value = false
    saveState.value = 'saved'
    saveError.value = ''
    syncFlags(state)
    requestRender()
  }

  /** This screen's version goes over whatever the server holds now. */
  async function resolveKeepMine() {
    const state = deck()
    if (!state) return
    let server: DeckDraft
    try {
      server = await ws.api<DeckDraft>(`/generation/drafts/${state.id}`, { timeout: PATCH_TIMEOUT })
    } catch {
      return
    }
    if (deck() !== state) return
    state.unanswered.clear()
    confirm(state, server)
    conflict.value = false
    saveState.value = 'dirty'
    await persist()
  }

  const save = () => persist(false)

  /**
   * What is waiting goes now, as a hidden or closing app may never run the timer.
   * True once the server holds everything; false while a conflict waits or it could not.
   */
  async function flush(opts: { keepalive?: boolean } = {}): Promise<boolean> {
    const state = deck()
    if (!state || (openState.value !== 'ready' && !state.leaving) || saveState.value === 'paused')
      return false
    if (saveState.value === 'dirty' || saveState.value === 'failed') return persist(!!opts.keepalive)
    if (state.saving) {
      await state.saving
      return deck() === state ? flush(opts) : false
    }
    return true
  }

  /** Leaving holds the customer up only so long: a write already sent finishes on its own. */
  function flushBriefly() {
    return Promise.race([
      flush().then(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, LEAVE_WAIT)),
    ])
  }

  // ------------------------------------------------------------ opening

  async function loadFace(fresh: DeckDraft) {
    bodyFace.value = null
    try {
      const answer = await ws.api<{ categories: { designs: { id: string; body_font?: string }[] }[] }>(
        `/studio/deck-designs?locale=${locale.value}`,
      )
      const design = answer.categories
        .flatMap((category) => category.designs)
        .find((item) => item.id === fresh.render?.design)
      if (openedId.value === fresh.id) bodyFace.value = design?.body_font || null
    } catch {
      // The lines budget waits for the server's count instead.
    }
  }

  function watchOpen() {
    scope?.stop()
    scope = effectScope(true)
    scope.run(() => {
      watch(current, prefetchAround)
      const tick = setInterval(() => (clock.value = Date.now()), 60_000)
      const online = () => {
        if (saveState.value === 'failed' || saveState.value === 'dirty') void persist()
      }
      window.addEventListener('online', online)
      onScopeDispose(() => {
        clearInterval(tick)
        window.removeEventListener('online', online)
      })
    })
  }

  /**
   * A deck let go with an edit its last write never landed (no answer, a refusal, a choice
   * still waiting): the edit stays in this tab for the deck's next opening, as it would
   * otherwise vanish unsaid. Only the open deck's screen is ever sent, so it waits rather
   * than going out behind another deck. One that landed, or a deck shut, leaves nothing.
   */
  function keepUnsaved(state: DeckState, flushed: boolean, shutMeanwhile: boolean) {
    unsaved.delete(state.id)
    if (flushed || shutMeanwhile) return
    if (JSON.stringify(normaliseContent(content.value)) === state.onServer && !state.unanswered.size) return
    unsaved.set(state.id, {
      owner: state.owner,
      content: JSON.stringify(content.value),
      onServer: state.onServer,
      unanswered: new Set(state.unanswered),
      past: state.past,
      future: state.future,
      refused: saveState.value === 'failed' && !saveRetryable.value ? saveError.value : null,
      told: false,
    })
    for (const key of unsaved.keys()) {
      if (unsaved.size <= UNSAVED_KEPT) break
      unsaved.delete(key)
    }
  }

  /**
   * A held edit back on its deck, over the version just read, Not saved. When the server
   * has nothing this tab did not write, it goes again by itself (a refusal is shown again
   * instead); anything else there is someone else's, and the customer chooses, as a
   * conflict always asks.
   */
  function restore(state: DeckState, kept: Unsaved) {
    const local = JSON.parse(kept.content) as DeckContent
    // It landed after all, its answer lost.
    if (JSON.stringify(normaliseContent(local)) === state.onServer) return
    content.value = local
    if (state.onServer !== kept.onServer && !kept.unanswered.has(state.onServer)) return holdForChoice()
    state.unanswered = kept.unanswered
    saveState.value = 'failed'
    if (kept.refused !== null) {
      saveRetryable.value = false
      saveError.value = kept.refused || t('genericError')
      return
    }
    saveRetryable.value = true
    saveError.value = t('editorNotSaved')
    retrySoon(state)
  }

  /** Once, on the next deck to open: another deck's last change is waiting unsaved, a tap away. */
  function tellUnsaved(id: string) {
    let waiting = ''
    for (const [key, kept] of unsaved)
      if (key !== id && !kept.told) {
        kept.told = true
        waiting = key
      }
    if (!waiting) return
    snackbar.show({
      message: t('deckOtherNotSaved'),
      actionLabel: t('deckOpenOther'),
      onAction: () => void navigateTo(path(`/app/editor/deck/${waiting}`)),
      // Leaving commits what is open (DeckEditor's onBeforeRouteUpdate); a field giving up focus first
      // brings the tab bar back under the finger, and Open it would miss.
      keepFocus: true,
    })
  }

  async function open(id: string) {
    const opening = ++opens
    opener = self
    const previous = openedId.value
    const owner = account()
    // Opened by another account before a sign-out and in on this device: let go unsaved, as this
    // session cannot save them, and unseen, as they are not its to show.
    for (const [key, other] of decks) {
      if (other.owner === owner) continue
      halt(other)
      stopSaves(other)
      other.closed = true
      decks.delete(key)
      if (key !== previous) continue
      draft.value = null
      baseline.value = null
      content.value = { title: '', sections: [], questions: [], citations: [] }
      saveState.value = 'clean'
      pictures.clear()
    }
    for (const [key, kept] of unsaved) if (kept.owner !== owner) unsaved.delete(key)
    const before = decks.get(previous)
    if (before) {
      // What is waiting goes out first, so nothing is lost and the deck reads back as its last write left it.
      // It is seen through, not cut short: a write let go unanswered would drop the edit queued behind it,
      // unsaid. Nothing more is typed meanwhile, and each write waits at most its own timeout.
      before.leaving = true
      openState.value = 'loading'
      const flushed = await flush()
      if (opening !== opens) return
      halt(before)
      stopSaves(before)
      before.closed = true
      // Shut meanwhile (deleted, switched off), it has said so, and nothing of it can be saved.
      keepUnsaved(before, flushed, openState.value !== 'loading')
      if (previous !== id) {
        decks.delete(previous)
        draft.value = null
        baseline.value = null
      }
    }
    scope?.stop()
    scope = null
    openedId.value = id
    openState.value = 'loading'
    openError.value = ''
    conflict.value = false
    held.value = false
    images.value = {}
    questionImages.value = []
    preview.value = 'idle'
    previewError.value = null
    hiddenAtFirstRender.value = 0
    if (!id) {
      openState.value = 'gone'
      return
    }
    let fresh: DeckDraft
    try {
      fresh = await ws.api<DeckDraft>(`/generation/drafts/${id}`, { timeout: OPEN_TIMEOUT })
    } catch (e) {
      if (opening !== opens) return
      // A deck that was open keeps its `draft`, so Make again can still offer its description.
      if (codeOf(e) === 'not_found' || statusOf(e) === 404) openState.value = 'gone'
      else {
        openError.value = requestError(e)
        openState.value = 'failed'
      }
      return
    }
    if (opening !== opens) return
    if (!studio.loaded.value) {
      void studio.load()
      await until(() => studio.loaded.value, CONFIG_WAIT)
      if (opening !== opens) return
    }
    draft.value = fresh
    if (fresh.feature_id !== 'ai.pptx' || fresh.output_format !== 'pptx' || !fresh.render) {
      openState.value = 'not_editable'
      return
    }
    // Not known yet is not off: the server says so for itself when asked to draw.
    if (studio.config.value && studio.config.value.limits?.editor?.deck_editor !== true) {
      openState.value = 'off'
      return
    }
    const normal = normaliseContent(fresh.content)
    const old = decks.get(id)
    const left = unsaved.get(id)
    unsaved.delete(id)
    const kept = left?.owner === owner ? left : null
    const state = blank(id, owner)
    // The same deck again keeps its history, as does one coming back with an edit held; its pictures
    // are asked for again, from the cache.
    const history = old ?? kept
    if (history) {
      state.past = history.past
      state.future = history.future
    }
    decks.set(id, state)
    state.onServer = JSON.stringify(normal)
    state.savedIds = normal.sections.map((section) => section.id)
    state.orders.set(fresh.version, orderOf(normal))
    content.value = normal
    version.value = fresh.version
    current.value = 0
    baseline.value = clone(normal)
    saveState.value = 'clean'
    saveError.value = ''
    saveRetryable.value = false
    canUndo.value = state.past.length > 0
    canRedo.value = state.future.length > 0
    const seen = readMarks(markKey(SEEN_KEY))
    marks.value = {
      seen: id in seen ? seen : writeMarks(markKey(SEEN_KEY), { ...seen, [id]: fresh.version }),
      sent: readMarks(markKey(SENT_KEY)),
    }
    clock.value = Date.now()
    openState.value = 'ready'
    watchOpen()
    void loadFace(fresh)
    if (kept) restore(state, kept)
    tellUnsaved(id)
    state.renderWanted = fresh.version
    preview.value = 'drawing'
    follow(state, fresh.version, false)
  }

  /**
   * Stops drawing, timers and listeners, and an opening this editor started: nothing is
   * read, followed or fetched for a page that is gone. The deck's state stays, for a write
   * still on its way, and whatever is unsaved waits for the next opening.
   */
  function close() {
    if (opener === self) {
      opens += 1
      opener = null
    }
    const state = deck()
    scope?.stop()
    scope = null
    if (!state) return
    state.closed = true
    halt(state)
    if (state.retryTimer) clearTimeout(state.retryTimer)
    state.retryTimer = null
    // A change still waiting for its timer goes now, rather than with the page.
    if (state.saveTimer) void persist(true)
  }

  async function refreshDraft() {
    const id = openedId.value
    try {
      const fresh = await ws.api<DeckDraft>(`/generation/drafts/${id}`, { timeout: OPEN_TIMEOUT })
      if (openedId.value === id) draft.value = fresh
    } catch {
      // The time shown stays the last one known.
    }
  }

  /**
   * The open deck's send, or deck `id`'s: one that went is the new baseline for Review. `null`
   * forgets a send that failed, as it sent nothing, and `restore` puts back the baseline that
   * send replaced, so Review still lists what has not arrived anywhere.
   */
  function recordSent(sentVersion: number | null, opts: { id?: string; restore?: DeckContent | null } = {}) {
    const id = opts.id ?? openedId.value
    if (!id) return
    const sent = { ...readMarks(markKey(SENT_KEY)) }
    delete sent[id]
    if (sentVersion !== null) sent[id] = sentVersion
    if (id === openedId.value) {
      if (sentVersion !== null) baseline.value = clone(content.value)
      else if (opts.restore) baseline.value = clone(opts.restore)
    }
    marks.value = { ...marks.value, sent: writeMarks(markKey(SENT_KEY), sent) }
  }

  // ------------------------------------------------------------ pictures

  /** Stops following a drawing; whatever it was waiting for is let go. */
  function halt(state: DeckState) {
    state.run += 1
    if (state.pollTimer) clearTimeout(state.pollTimer)
    state.pollTimer = null
    state.waiting?.()
  }

  /** A hidden app asks nothing: the next look waits until it is seen again. */
  function whenVisible(state: DeckState, then: () => void) {
    if (!document.hidden) return then()
    state.waiting?.()
    const shown = () => {
      if (document.hidden) return
      state.waiting?.()
      then()
    }
    document.addEventListener('visibilitychange', shown)
    state.waiting = () => {
      document.removeEventListener('visibilitychange', shown)
      state.waiting = null
    }
  }

  function prefetchAround() {
    const list: { key: string; url: string }[] = []
    for (const at of [current.value, current.value + 1, current.value - 1]) {
      const ref = slides.value[at]
      const image = ref ? imageOf(ref) : null
      if (image) list.push({ key: image.key, url: image.url })
    }
    for (const ref of slides.value) {
      const image = imageOf(ref)
      if (image) list.push({ key: image.key, url: image.thumb })
    }
    pictures.prefetch(list)
  }

  /** A drawing of version `at`: each picture goes on the slide that version had there, unless a newer one is already up. */
  function apply(state: DeckState, at: number, drawn: DeckRenderSlide[]) {
    const order = state.orders.get(at) ?? (at === version.value ? orderOf(content.value) : null)
    if (order) {
      const nextImages = { ...images.value }
      const nextQuestions = [...questionImages.value]
      drawn.forEach((slide, position) => {
        const index = typeof slide.index === 'number' ? slide.index : position
        const image: DeckSlideImage = {
          key: slide.key,
          url: slide.url,
          thumb: slide.thumb_url,
          frames: slide.frames,
          fits: slide.fits,
          letters_over: slide.letters_over,
          version: at,
        }
        if (index < order.ids.length) {
          const id = order.ids[index]!
          if ((nextImages[id]?.version ?? -1) <= at) nextImages[id] = image
        } else {
          const page = index - order.ids.length
          if ((nextQuestions[page]?.version ?? -1) <= at) nextQuestions[page] = image
        }
      })
      images.value = nextImages
      questionImages.value = nextQuestions
    }
    if (!state.firstDone) {
      state.firstDone = true
      hiddenAtFirstRender.value = drawn.filter((slide) => !slide.fits).length
    }
    if (at >= (state.renderWanted ?? at)) {
      preview.value = 'idle'
      previewError.value = null
    }
    prefetchAround()
  }

  /**
   * Follows the drawing of version `at` until it is done: by asking for it first
   * (`post`), or by looking how it stands. One follow at a time; a newer one stops this.
   */
  function follow(state: DeckState, at: number, post: boolean) {
    halt(state)
    const run = state.run
    const live = () => run === state.run && !state.closed && decks.get(state.id) === state
    let begun = Date.now()
    let attempt = 0
    let misses = 0
    let asks = 0

    const unavailable = (why: string) => {
      preview.value = 'unavailable'
      previewError.value = why
    }
    const after = (wait: number, then: () => void) => {
      state.pollTimer = setTimeout(() => {
        state.pollTimer = null
        if (!live()) return
        const due = Date.now()
        whenVisible(state, () => {
          // Hidden, nothing was asked: that time does not count against how long a drawing is followed.
          begun += Date.now() - due
          if (live()) then()
        })
      }, wait)
    }
    const again = (next: () => Promise<void> = look) => {
      const spent = Date.now() - begun
      if (spent >= POLL_FOR + POLL_SLOW_FOR) {
        // Given up: said, with Try again, rather than left drawing for good.
        if (preview.value === 'drawing') unavailable('render_timeout')
        return
      }
      if (spent >= POLL_FOR) {
        if (preview.value === 'drawing') unavailable('render_timeout')
        return after(POLL_SLOW, () => void next())
      }
      after(POLL_WAITS[Math.min(attempt++, POLL_WAITS.length - 1)]!, () => void next())
    }
    const missed = (next: () => Promise<void>) => {
      misses += 1
      if (misses >= POLL_MISSES && preview.value === 'drawing') unavailable('render_unanswered')
      again(next)
    }
    /** The answers that end editing here, whichever request had them. */
    const ended = (e: unknown) => {
      const code = codeOf(e)
      if (code === 'not_found' || statusOf(e) === 404) shut(state, 'gone')
      else if (code === 'feature_unavailable') shut(state, 'off')
      else if (code === 'deck_not_editable') shut(state, 'not_editable')
      else return false
      return true
    }

    async function ask(wanted: number): Promise<void> {
      asks += 1
      try {
        const answer = await ws.api<{ task_id: string; status: string }>(
          `/generation/drafts/${state.id}/render`,
          {
            method: 'POST',
            body: { version: wanted },
            timeout: RENDER_TIMEOUT,
          },
        )
        if (!live()) return
        misses = 0
        return answer.status === 'done' ? look() : again()
      } catch (e) {
        if (!live() || ended(e)) return
        const code = codeOf(e)
        const status = statusOf(e)
        if (code === 'version_conflict') {
          // A newer save asks for its own pictures, and stops this; one that fails instead leaves this looking.
          // With none on its way, the current version is asked for, once.
          if (pendingSave(state)) return again()
          if (state.conflictRetried) {
            if (preview.value === 'drawing') preview.value = 'idle'
            return
          }
          state.conflictRetried = true
          state.renderWanted = version.value
          return follow(state, version.value, true)
        }
        if (code === 'lane_busy') {
          preview.value = 'busy'
          previewError.value = 'lane_busy'
          if (state.busyTries >= LANE_TRIES) return
          state.busyTries += 1
          return after(LANE_RETRY, () => void ask(wanted))
        }
        if (!status || status >= 500 || code === 'rate_limited') return missed(() => ask(wanted))
        unavailable(code || 'render_failed')
      }
    }

    async function look(): Promise<void> {
      let answer: DeckRender
      try {
        answer = await ws.api<DeckRender>(`/generation/drafts/${state.id}/render?version=${at}`, {
          timeout: RENDER_TIMEOUT,
        })
      } catch (e) {
        if (!live() || ended(e)) return
        return missed(look)
      }
      if (!live()) return
      misses = 0
      if (answer.status === 'done') return apply(state, at, answer.slides)
      if (answer.status === 'queued' || answer.status === 'running') return again()
      if (answer.status === 'failed') {
        // Interrupted is worth one more try; anything else, as a picture gone, is not until the slide changes.
        if (answer.error === 'render_deck_interrupted' && !state.renderRetried) {
          state.renderRetried = true
          return ask(at)
        }
        return unavailable(answer.error || 'render_failed')
      }
      // `none`: never asked for, or gone after an hour. `stale`: this version will never be drawn.
      // A save on its way asks for its own pictures; should it fail, this goes on looking.
      if (pendingSave(state)) return again()
      if (version.value !== at) {
        state.renderWanted = version.value
        return follow(state, version.value, true)
      }
      if (asks >= RENDER_ASKS) return unavailable('render_failed')
      return ask(at)
    }

    void (post ? ask(at) : look())
  }

  /** Asks for the current version's pictures: after every save, and whenever one is missing. */
  function requestRender() {
    const state = deck()
    if (!state || state.closed || openState.value !== 'ready') return
    if (state.renderWanted !== version.value) {
      state.renderRetried = false
      state.conflictRetried = false
      state.busyTries = 0
    }
    state.renderWanted = version.value
    if (needsDrawing()) preview.value = 'drawing'
    follow(state, version.value, true)
  }

  function retryPreview() {
    const state = deck()
    if (!state || state.closed || openState.value !== 'ready') return
    state.renderRetried = false
    state.conflictRetried = false
    state.busyTries = 0
    state.renderWanted = version.value
    previewError.value = null
    preview.value = needsDrawing() ? 'drawing' : 'idle'
    follow(state, version.value, true)
  }

  // ------------------------------------------------------------ fit

  /**
   * How `section` as typed sits on its slide, from the server; null when it cannot
   * say (not saved yet, offline, asked too often). `/fit` measures against the saved
   * deck, so a slide the server has elsewhere, or not at all, is saved first. One
   * question at a time; a newer one waiting replaces the one before it.
   */
  function measure(section: DeckSection): Promise<DeckFit | null> {
    const state = deck()
    if (!state || openState.value !== 'ready' || Date.now() < state.fitPausedUntil)
      return Promise.resolve(null)
    const index = indexOf(section.id)
    // A slide still being made is measured once it is in the deck.
    if (index < 0) return Promise.resolve(null)
    const key = `${index}:${JSON.stringify(section)}`
    const known = state.fitCache.get(key)
    if (known) return Promise.resolve(known)
    return new Promise((resolve) => {
      state.fitQueued?.resolve(null)
      state.fitQueued = { section: clone(section), key, resolve }
      state.fitInFlight ??= drainFits(state)
    })
  }

  async function drainFits(state: DeckState) {
    try {
      while (state.fitQueued) {
        const { section, key, resolve } = state.fitQueued
        state.fitQueued = null
        resolve(await fitNow(state, section, key))
      }
    } finally {
      state.fitInFlight = null
    }
  }

  async function fitNow(state: DeckState, section: DeckSection, key: string): Promise<DeckFit | null> {
    if (Date.now() < state.fitPausedUntil) return null
    const at = indexOf(section.id)
    if (at < 0) return null
    if (state.savedIds.indexOf(section.id) !== at) {
      const saved = await flush()
      if (!saved || decks.get(state.id) !== state || !state.savedIds.includes(section.id)) return null
    }
    try {
      const fit = await ws.api<DeckFit>(`/generation/drafts/${state.id}/fit`, {
        method: 'POST',
        body: { section },
        timeout: FIT_TIMEOUT,
      })
      // No layout named may be a timed-out answer (slide_fit's FIT_SECONDS): asked again, not kept.
      if (fit.layouts_fitting?.length) {
        if (state.fitCache.size >= FIT_KEPT) state.fitCache.clear()
        state.fitCache.set(key, fit)
      }
      return fit
    } catch (e) {
      if (statusOf(e) === 429) state.fitPausedUntil = Date.now() + FIT_LIMIT_PAUSE
      return null
    }
  }

  return {
    draftId: computed(() => openedId.value),
    draft,
    content,
    version,
    openState,
    openError,
    saveState,
    saveError,
    saveRetryable,
    conflict,
    held,
    steps,
    canUndo,
    canRedo,
    current,
    slides,
    total,
    sections,
    questionPages,
    editable,
    preview,
    previewError,
    hiddenAtFirstRender,
    expiresAt,
    expiresSoon,
    unsent,
    baseline: baseline as Readonly<Ref<DeckContent | null>>,
    maxSlides,
    deckLocale,
    bodyFace: bodyFace as Readonly<Ref<string | null>>,
    imageOf,
    isStale,
    open,
    close,
    mutate,
    setSection,
    addSlide,
    duplicateSlide,
    deleteSlide,
    moveSlide,
    splitSlide,
    setLayout,
    setQuestions,
    fewerQuestions,
    removeQuiz,
    undo,
    redo,
    save,
    flush,
    flushBriefly,
    holdForChoice,
    resolveTakeServer,
    resolveKeepMine,
    refreshDraft,
    recordSent,
    requestRender,
    retryPreview,
    measure,
    refusalOf,
  }
}
