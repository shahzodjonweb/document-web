<script setup lang="ts">
/**
 * A slide's words: one field in the dock that takes the top bar's place on a phone,
 * or all three in the panel at 980 px and over.
 *
 * What is typed stays here until it is committed: Done, Back, a send, the app hiding
 * or the person going to another slide. A line on the slide is a field of its own.
 * The budget is the server's count of the lines the slide holds; between its answers
 * the same font metrics carry it forward, scaled by what it said last.
 */
import {
  BODY_CHARS,
  FIT_PAUSE,
  LINE_CHARS,
  MAX_LINES,
  useDeckEditor,
  type CommitReason,
  type DeckFit,
  type DeckFrame,
  type DeckSection,
} from '~/composables/useDeckEditor'
import { LOCAL_LAYOUTS, bodyWidthPt, calibrated, lineEstimate } from '~/composables/useDeckFit'
import { cutTo, pastedText, usePasteGuard } from '~/composables/usePasteGuard'
import {
  MAX_SLIDE_COLUMNS,
  MAX_SLIDE_ITEMS,
  layoutUsesColumns,
  layoutUsesItems,
} from '~/composables/useSlideLayouts'

type Field = 'heading' | 'lines' | 'notes'
type Options = { keepOpen: boolean; amend: boolean; reason: CommitReason }

const props = defineProps<{
  section: DeckSection
  isNew: boolean
  number: number
  field: Field
  mode: 'dock' | 'panel'
  thumb: string | null
  frames: DeckFrame[]
  editable: boolean
  locale: 'en' | 'uz' | 'ru'
  /** The deck has room for one more slide, which Split makes. */
  canAdd: boolean
}>()
const emit = defineEmits<{
  commit: [patch: Partial<DeckSection>, opts: Options]
  close: []
  split: []
  pickLayout: [fit: DeckFit | null]
  /** The slide this dock made is to go again: Cancel, or every word of it taken out. */
  discard: []
}>()

const { t, count, locale: screenLocale } = useLocale()
const plural = (key: string, amount: number, values: Record<string, string | number> = {}) =>
  t(`${key}_${new Intl.PluralRules(screenLocale.value).select(amount)}`, { count: amount, ...values })
const deck = useDeckEditor()
const telegram = useTelegramApp()
const metrics = useEditorFontMetrics()

const root = ref<HTMLElement>()
const uid = useId()
const docked = computed(() => props.mode === 'dock')
const lang = computed(() => (props.locale === 'uz' ? 'uz-Latn' : props.locale))
const FIELD_NAMES: Record<Field, string> = {
  heading: 'deckFieldHeadline',
  lines: 'deckFieldLines',
  notes: 'deckFieldNotes',
}
const title = computed(() => t('deckDockTitle', { n: props.number, field: t(FIELD_NAMES[props.field]) }))
const shows = (name: Field) => !docked.value || props.field === name

/**
 * What the last paste or keyboard insert left out, until the next change typed. In the dock
 * it takes the title's place: the body under the head is a line or two high above the
 * keyboard and would scroll it away. In the panel it is under the field: a line, an item
 * and a column each have their own.
 */
const {
  note: pasteNote,
  field: pasteField,
  say: sayPasted,
  clear: clearPaste,
  ...guard
} = usePasteGuard(root)
const pasteAt = (name: string) => !docked.value && !!pasteNote.value && pasteField.value === name

/* --------------------------------------------------------------- the buffer */

// Values the server takes for these layouts' items: `layouts.py` PRO and CON, and the layouts that show a value.
const PRO = new Set(['pro', '+', 'for', 'yes', 'plus', 'upside'])
const CON = new Set(['con', '-', '–', 'against', 'no', 'minus', 'downside'])
const VALUE_LAYOUTS = new Set(['big_number', 'stats', 'timeline', 'chart', 'comparison', 'cards', 'table'])
const PANEL_PAUSE = 1500

type Line = { key: number; text: string }
type Item = { key: number; label: string; text: string; value: string }
type Shape = Pick<DeckSection, 'heading' | 'body' | 'notes' | 'items' | 'columns'>

let nextKey = 0
const heading = ref('')
const lines = ref<Line[]>([])
const items = ref<Item[]>([])
const columns = ref<string[]>([])
const notes = ref('')
/** Lines show for a layout of items only when the slide had lines of its own. */
const hadLines = ref(false)

const splitBody = (body = '') => body.split(/\r?\n/).filter((line) => line.trim())
const bodyOf = (texts: string[]) =>
  texts
    .filter((text) => text.trim())
    .join('\n')
    .slice(0, BODY_CHARS)
/** As the server keeps them: trimmed, cut to size, empty ones gone, eight at most. */
const itemsOf = (list: { label?: string; text?: string; value?: string }[]) =>
  list
    .map((item) => ({
      label: String(item.label ?? '')
        .trim()
        .slice(0, 160),
      text: String(item.text ?? '')
        .trim()
        .slice(0, 600),
      value: String(item.value ?? '')
        .trim()
        .slice(0, 160),
    }))
    .filter((item) => item.label || item.text || item.value)
    .slice(0, MAX_SLIDE_ITEMS)
const columnsOf = (list: string[]) => {
  const kept = list.slice(0, MAX_SLIDE_COLUMNS).map((column) =>
    String(column ?? '')
      .trim()
      .slice(0, 80),
  )
  while (kept.length && !kept[kept.length - 1]) kept.pop()
  return kept
}
const shapeOf = (section: DeckSection): Shape => ({
  heading: section.heading ?? '',
  body: bodyOf(splitBody(section.body)),
  notes: section.notes ?? '',
  items: itemsOf(section.items ?? []),
  columns: columnsOf(section.columns ?? []),
})
const buffered = computed<Shape>(() => ({
  heading: heading.value,
  body: bodyOf(lines.value.map((line) => line.text)),
  notes: notes.value,
  items: itemsOf(items.value),
  columns: columnsOf(columns.value),
}))
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Fills the buffer from a section; `keep` reuses the rows' keys so their fields stay put. */
function load(section: DeckSection, keep = false) {
  heading.value = section.heading ?? ''
  const texts = splitBody(section.body)
  hadLines.value = texts.length > 0
  lines.value = (texts.length ? texts : ['']).map((text, index) => ({
    key: (keep && lines.value[index]?.key) || ++nextKey,
    text,
  }))
  const list = (section.items ?? []).map((item, index) => ({
    key: (keep && items.value[index]?.key) || ++nextKey,
    label: String(item.label ?? ''),
    text: String(item.text ?? ''),
    value: String(item.value ?? ''),
  }))
  // A layout of items with none yet starts with one to type into.
  if (!list.length && usesItemsFor(section, list))
    list.push({ key: ++nextKey, label: '', text: '', value: '' })
  items.value = list
  const named = (section.columns ?? []).map((column) => String(column ?? ''))
  columns.value = Array.from(
    { length: Math.max(MAX_SLIDE_COLUMNS, named.length) },
    (_, index) => named[index] ?? '',
  )
  notes.value = section.notes ?? ''
}
const usesItemsFor = (section: DeckSection, list: unknown[]) =>
  layoutUsesItems({ layout: section.layout, items: list })

load(props.section)
/** Opened on a slide still to be made: one made by its words is this dock's to take back. */
const createdHere = props.isNew
const madeHere = () => createdHere && !props.isNew
/** What Cancel puts back after a write-through. */
let opened = shapeOf(props.section)
/** A commit that kept the dock open has written to the deck: the next one amends it. */
let wroteThrough = false
/** The deck as it was before the first of those. */
let chainFrom: Shape | null = null

const layout = computed(() => props.section.layout || 'auto')
const usesItems = computed(() => usesItemsFor(props.section, items.value))
const usesColumns = computed(() => layoutUsesColumns({ layout: layout.value, columns: columns.value }))
const showLines = computed(() => !usesItems.value || hadLines.value)

/** What differs from the deck now, as the server would store it. */
function changes(from: Shape = shapeOf(props.section)): Partial<DeckSection> {
  const now = buffered.value
  const patch: Partial<DeckSection> = {}
  if (now.heading !== from.heading) patch.heading = now.heading
  if (now.body !== from.body) patch.body = now.body
  if (now.notes !== from.notes) patch.notes = now.notes
  if (!same(now.items, from.items)) patch.items = now.items
  if (!same(now.columns, from.columns)) patch.columns = now.columns
  return patch
}
const hasWords = (shape: Shape) =>
  !!(
    shape.heading.trim() ||
    shape.body.trim() ||
    shape.notes.trim() ||
    shape.items.length ||
    shape.columns.length
  )
/** A new slide is only made once something is typed in it. */
const dirty = computed(() => (props.isNew ? hasWords(buffered.value) : Object.keys(changes()).length > 0))

/**
 * The deck changed under the fields: another slide in the panel, the new slide given
 * its id, or the deck's own change such as a split or an undo. Words typed and not yet
 * committed are kept; otherwise the fields show the deck as it is now.
 */
watch(
  () => [props.section.id, JSON.stringify(shapeOf(props.section))] as const,
  ([id, now], [wasId, was]) => {
    if (id !== wasId && wasId) {
      clearPanelTimer()
      load(props.section)
      opened = shapeOf(props.section)
      wroteThrough = false
      chainFrom = null
      menuLine.value = null
      clearPaste()
      resetFit()
      return
    }
    const mine = JSON.stringify(buffered.value)
    if (mine === now || mine !== was) return
    load(props.section, true)
  },
)

/* ------------------------------------------------------------- committing */

let panelTimer: ReturnType<typeof setTimeout> | null = null
function clearPanelTimer() {
  if (panelTimer !== null) clearTimeout(panelTimer)
  panelTimer = null
}

/**
 * Writes what changed to the deck. `keepOpen` is a write-through that leaves the fields
 * up, as the app hiding does; the commits after it amend the same step of history.
 */
function commit({ reason, keepOpen = false }: { reason: CommitReason; keepOpen?: boolean }) {
  clearPanelTimer()
  // Nothing can be written now; what was typed waits for the deck to take it.
  if (!props.editable) return false
  // A slide this dock made and then emptied goes as the field closes: an empty one is never kept.
  if (!keepOpen && reason !== 'blur' && madeHere() && !hasWords(buffered.value)) {
    wroteThrough = false
    chainFrom = null
    emit('discard')
    return true
  }
  // The commit that ends a write-through names all it wrote, for the checks run on a field left,
  // and what differs from the deck now: a word put back as it was before the chain is written too.
  const patch = !keepOpen && wroteThrough && chainFrom ? { ...changes(chainFrom), ...changes() } : changes()
  if (props.isNew ? !hasWords(buffered.value) : !Object.keys(patch).length) {
    if (!docked.value && !keepOpen) {
      wroteThrough = false
      chainFrom = null
    }
    return false
  }
  if (keepOpen && !wroteThrough) chainFrom = shapeOf(props.section)
  emit('commit', patch, { keepOpen, amend: wroteThrough, reason })
  // In the panel a chain of pauses ends where the field is left.
  wroteThrough = docked.value ? keepOpen || wroteThrough : keepOpen
  if (!docked.value && !keepOpen) chainFrom = null
  return true
}

/** Done, Back and Enter in the headline: commit, close, put the keyboard away. */
function done(reason: CommitReason = 'done') {
  if (!props.editable && reason === 'done') return
  commit({ reason })
  emit('close')
  telegram.hideKeyboard()
}

/**
 * Cancel forgets what was typed, and takes back what a write-through already put in:
 * a slide that write-through made goes again, rather than stay behind empty.
 */
function cancel() {
  clearPanelTimer()
  if (madeHere() && props.editable) emit('discard')
  else if (wroteThrough && props.editable) {
    const now = shapeOf(props.section)
    const patch: Partial<DeckSection> = {}
    for (const key of ['heading', 'body', 'notes', 'items', 'columns'] as const)
      if (!same(now[key], opened[key])) Object.assign(patch, { [key]: opened[key] })
    if (Object.keys(patch).length) emit('commit', patch, { keepOpen: true, amend: true, reason: 'close' })
  }
  emit('close')
  telegram.hideKeyboard()
}

/** In the panel, words are written a moment after the typing stops. */
function typed() {
  if (docked.value) return
  clearPanelTimer()
  panelTimer = setTimeout(() => commit({ reason: 'blur', keepOpen: true }), PANEL_PAUSE)
}
/** A button's change in the panel is written at once, as a field left is. */
function changed() {
  if (!docked.value) commit({ reason: 'blur' })
}
// Typed while the deck could not take it: written once it can.
watch(
  () => props.editable,
  (editable) => {
    if (editable && !docked.value && dirty.value) commit({ reason: 'blur' })
  },
)

// `focus` is for the panel, which takes focus only when asked: arrows to another slide must not land in it.
defineExpose({ commit, done, dirty, focus: () => focusFirst() })

/* ----------------------------------------------------------------- typing */

/** The server's rule: no control characters but a tab, and a newline where one may be. */
function clean(raw: string, multiline = false) {
  let out = ''
  for (const character of raw) {
    const code = character.codePointAt(0) ?? 0
    if (code >= 32 || character === '\t' || (multiline && character === '\n')) out += character
  }
  return out
}
function read(event: Event, multiline = false) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  const value = clean(target.value, multiline)
  if (value !== target.value) target.value = value
  typed()
  return value
}

function fieldNode(selector: string) {
  return (
    root.value?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-testid="${selector}"]`) ?? null
  )
}
function focusOn(selector: string, at: 'start' | 'end' = 'end') {
  void nextTick(() => {
    const input = fieldNode(selector)
    if (!input) return
    input.focus({ preventScroll: true })
    const position = at === 'start' ? 0 : input.value.length
    try {
      input.setSelectionRange(position, position)
    } catch {}
    input.scrollIntoView({ block: 'nearest' })
  })
}

function onHeadingKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.isComposing) return
  event.preventDefault()
  if (docked.value) done('done')
  else commit({ reason: 'blur' })
}

/* ------------------------------------------------------------------ lines */

const menuLine = ref<number | null>(null)
const lineCount = computed(() => lines.value.length)
/** A line's Up, Down and Remove open under it, scrolled into the dock's short body with the keyboard up. */
function toggleLineMenu(key: number) {
  menuLine.value = menuLine.value === key ? null : key
  if (menuLine.value !== null)
    void nextTick(() =>
      root.value?.querySelector('.deck-edit-line-actions')?.scrollIntoView({ block: 'nearest' }),
    )
}

/** Enter breaks the line at the caret, as in any list of lines, and goes to the new one. */
function onLineKeydown(event: KeyboardEvent, index: number) {
  if (event.isComposing) return
  const input = event.target as HTMLInputElement
  if (event.key === 'Enter') {
    event.preventDefault()
    if (lines.value.length >= MAX_LINES) {
      if (index + 1 < lines.value.length) focusOn(`deck-line-${index + 1}`)
      return
    }
    const line = lines.value[index]!
    const start = input.selectionStart ?? line.text.length
    const end = input.selectionEnd ?? start
    const rest = line.text.slice(end)
    line.text = line.text.slice(0, start)
    lines.value.splice(index + 1, 0, { key: ++nextKey, text: rest })
    focusOn(`deck-line-${index + 1}`, 'start')
    typed()
  } else if (event.key === 'Backspace' && !input.value && index > 0) {
    // To the line above first, so the keyboard never drops between the two.
    event.preventDefault()
    const above = fieldNode(`deck-line-${index - 1}`)
    above?.focus({ preventScroll: true })
    if (above) above.setSelectionRange(above.value.length, above.value.length)
    lines.value.splice(index, 1)
    changed()
  }
}

/**
 * Lines pasted from elsewhere stay lines. What does not fit is not taken: lines past
 * the slide's last row, the end of a line past its length. The words already in the
 * line stay whole, and the dock says what was left out.
 */
function onLinePaste(event: ClipboardEvent, index: number) {
  const text = event.clipboardData?.getData('text/plain') ?? ''
  const input = event.target as HTMLInputElement
  const line = lines.value[index]!
  const start = input.selectionStart ?? line.text.length
  const end = input.selectionEnd ?? start
  // One line that fits is the browser's own paste; past `maxlength` it would cut without a word.
  if (!/[\r\n]/.test(text) && line.text.length - (end - start) + text.length <= LINE_CHARS) return
  event.preventDefault()
  clearPaste()
  const parts = pastedText(text, true)
    .split('\n')
    .map((part) => part.replace(/\t/g, ' '))
    .filter((part) => part.trim())
  if (!parts.length) return
  const room = Math.max(1, MAX_LINES - lines.value.length + 1)
  const taken = parts.slice(0, room)
  const before = line.text.slice(0, start)
  const after = line.text.slice(end)
  let shortened = 0
  const rows = taken.map((part, at) => {
    const head = at === 0 ? before : ''
    const tail = at === taken.length - 1 ? after : ''
    const kept = cutTo(part, LINE_CHARS - head.length - tail.length)
    if (kept.length < part.length) shortened += 1
    return { key: at ? ++nextKey : line.key, text: head + kept + tail }
  })
  lines.value.splice(index, 1, ...rows)
  focusOn(`deck-line-${index + rows.length - 1}`)
  typed()
  // One sentence either way: the head holds two lines of it at 320 px.
  const left = parts.length - taken.length
  sayPasted(
    left && shortened
      ? t('deckPasteSomeLeft', { lines: MAX_LINES, max: LINE_CHARS })
      : left
        ? plural('deckPasteLinesLeft', left, { max: MAX_LINES })
        : shortened
          ? t('deckPasteLineCut', { max: LINE_CHARS })
          : '',
    `line-${rows[rows.length - 1]!.key}`,
  )
}

function moveLine(index: number, by: -1 | 1) {
  const to = index + by
  if (to < 0 || to >= lines.value.length) return
  const [line] = lines.value.splice(index, 1)
  lines.value.splice(to, 0, line!)
  focusOn(`deck-line-${to}`)
  changed()
}
function removeLine(index: number) {
  menuLine.value = null
  // A note about the line taken out would be about nothing on screen.
  clearPaste()
  if (lines.value.length === 1) lines.value[0]!.text = ''
  else lines.value.splice(index, 1)
  focusOn(`deck-line-${Math.max(0, index - 1)}`)
  changed()
}

/* ------------------------------------------------------------------ items */

const side = (value: string) => {
  const word = value.trim().toLowerCase()
  return PRO.has(word) ? 'pro' : CON.has(word) ? 'con' : null
}
function setSide(item: Item, value: 'pro' | 'con') {
  if (item.value === value) return
  item.value = value
  changed()
}
function dropItem(index: number) {
  clearPaste()
  items.value.splice(index, 1)
  if (!items.value.length) items.value.push({ key: ++nextKey, label: '', text: '', value: '' })
  focusOn(`deck-item-${Math.max(0, index - 1)}-label`)
  changed()
}
function setColumn(index: number, event: Event) {
  columns.value[index] = read(event)
}

const addsItem = computed(() => usesItems.value)
const canAddLine = computed(() =>
  addsItem.value ? items.value.length < MAX_SLIDE_ITEMS : lines.value.length < MAX_LINES,
)
function addLine() {
  if (!canAddLine.value) return
  if (addsItem.value) {
    items.value.push({ key: ++nextKey, label: '', text: '', value: '' })
    focusOn(`deck-item-${items.value.length - 1}-label`)
  } else {
    lines.value.push({ key: ++nextKey, text: '' })
    focusOn(`deck-line-${lines.value.length - 1}`)
  }
}

const splitsInTwo = computed(
  () => splitBody(buffered.value.body).length >= 2 || buffered.value.items.length >= 2,
)
const canSplit = computed(() => !props.isNew && props.number !== 1 && props.canAdd && splitsInTwo.value)
/** Why Split is off, said where it is: the plan's count of slides reached, or one line alone. */
const full = computed(() => (props.canAdd ? '' : t('deckSlidesFull', { max: deck.maxSlides.value })))
const splitWhy = computed(() => (canSplit.value ? undefined : full.value || t('deckSplitNeedsLines')))
/** Split and another layout act on the deck: what was typed goes in first. */
function split() {
  commit({ reason: 'blur' })
  emit('split')
}
function pickLayout() {
  commit({ reason: 'blur' })
  emit('pickLayout', fit.value)
}

/* ----------------------------------------------------------------- budget */

const fit = shallowRef<DeckFit | null>(null)
/** The section the last answer was for, and the local estimate of that same text. */
const fitFor = ref('')
const estimateAtFit = ref(0)
const faceReady = ref(0)
let asking = 0
let pause: ReturnType<typeof setTimeout> | null = null
let alive = true

const measurable = computed(
  () => !props.isNew && !!props.section.id && (!docked.value || props.field === 'lines'),
)
const candidate = (): DeckSection => ({ ...props.section, ...buffered.value })
const candidateJson = computed(() => JSON.stringify(candidate()))

const bodySize = computed(() => Number(deck.draft.value?.render?.body_size) || 0)
const boxWidth = computed(() => bodyWidthPt(props.frames))
const estimable = computed(
  () =>
    LOCAL_LAYOUTS.includes(layout.value) &&
    !!deck.bodyFace.value &&
    !!boxWidth.value &&
    bodySize.value > 0 &&
    !buffered.value.items.length,
)
const lineTexts = computed(() => splitBody(buffered.value.body))
/** The local count of lines, before it is scaled by the server's last answer. */
const estimate = computed(() => {
  void faceReady.value
  if (!estimable.value) return null
  return lineEstimate(lineTexts.value, deck.bodyFace.value!, bodySize.value, boxWidth.value!)
})
// The faces are fetched for the letters typed, so a new script can need another file.
watch(
  () => (estimable.value && estimate.value === null ? lineTexts.value.join('\n') : null),
  (text) => {
    if (text === null || !deck.bodyFace.value) return
    void metrics.ensureDeckFace(deck.bodyFace.value, text).then((ok) => {
      if (ok && alive) faceReady.value += 1
    })
  },
  { immediate: true },
)

const used = computed(() => {
  const answer = fit.value
  if (!answer) return null
  if (candidateJson.value === fitFor.value) return answer.lines_used
  const local = estimate.value
  return local !== null && estimateAtFit.value > 0
    ? calibrated(local, answer, estimateAtFit.value)
    : answer.lines_used
})
const level = computed(() => {
  const answer = fit.value
  if (!answer || used.value === null) return 'ok'
  if (!answer.fits || used.value > answer.lines_max) return 'over'
  return answer.lines_max > 0 && used.value / answer.lines_max >= 0.9 ? 'near' : 'ok'
})
const budget = computed(() =>
  fit.value && used.value !== null
    ? plural('deckLinesBudget', fit.value.lines_max, { used: used.value, max: fit.value.lines_max })
    : '',
)
/** Over the room, in the server's own count of words: the estimate never says so. */
const over = computed(() => {
  const answer = fit.value
  if (!answer || answer.fits || props.isNew) return ''
  return answer.words_over > 0 ? count('deckTooLong', answer.words_over) : t('deckTooLongSome')
})

/** A first question the deck put aside for another, or that went unanswered, is asked once more. */
let askedAgain = false
async function measure() {
  if (!measurable.value) return
  const section = candidate()
  const json = JSON.stringify(section)
  const local = estimate.value
  const ask = ++asking
  const answer = await deck.measure(section)
  if (!alive || ask !== asking) return
  if (!answer) {
    if (!fit.value && !askedAgain && pause === null) {
      askedAgain = true
      pause = setTimeout(() => {
        pause = null
        void measure()
      }, FIT_PAUSE)
    }
    return
  }
  fit.value = answer
  fitFor.value = json
  estimateAtFit.value = local ?? 0
}
function resetFit() {
  if (pause !== null) clearTimeout(pause)
  pause = null
  asking += 1
  askedAgain = false
  fit.value = null
  fitFor.value = ''
  estimateAtFit.value = 0
  void measure()
}
/**
 * After a pause the server is asked again, when the words changed and the local count
 * cannot be trusted alone: near the limit, over it last time, or not possible here.
 */
watch(candidateJson, (json) => {
  if (pause !== null) clearTimeout(pause)
  pause = null
  if (!measurable.value || json === fitFor.value) return
  pause = setTimeout(() => {
    pause = null
    if (candidateJson.value === fitFor.value) return
    const answer = fit.value
    const near = !!answer && used.value !== null && used.value >= 0.8 * answer.lines_max
    // An estimate with no answer of its own to scale by (the faces came after it) counts for nothing.
    const local = estimate.value !== null && estimateAtFit.value > 0
    if (!local || !answer || !answer.fits || near) void measure()
  }, FIT_PAUSE)
})
watch(measurable, (on) => {
  if (on && !fit.value) void measure()
})

/* ------------------------------------------------------------ the dock */

const saveWords = computed(() => {
  switch (deck.saveState.value) {
    case 'failed':
    case 'paused':
      return deck.saveError.value || t('editorNotSaved')
    case 'dirty':
    case 'saving':
      return t('editorSaveSending')
    default:
      return t('editorSaveSaved')
  }
})

function focusFirst() {
  if (props.field === 'heading') return focusOn('deck-headline')
  if (props.field === 'notes') return focusOn('deck-notes')
  focusOn(showLines.value ? 'deck-line-0' : 'deck-item-0-label', showLines.value ? 'end' : 'start')
}

// Back closes the dock as Done does: going back loses nothing.
telegram.useBackLayer(docked, () => done('done'))
let releaseSwipes: (() => void) | null = null
watch(
  docked,
  (on) => {
    releaseSwipes?.()
    releaseSwipes = on ? telegram.holdSwipes({ lasting: true }) : null
  },
  { immediate: true },
)

onMounted(() => {
  // A new slide is typed into at once, wherever its fields are.
  if (docked.value || props.isNew) {
    focusFirst()
    // The field that held the keyboard up has done its job once this one has focus.
    void nextTick(() => document.querySelectorAll('[data-keyboard-primer]').forEach((node) => node.remove()))
  }
  void measure()
})
watch(
  () => props.field,
  () => {
    clearPaste()
    if (docked.value) focusFirst()
  },
)
watch(telegram.keyboardInset, () => {
  if (!docked.value) return
  void nextTick(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement && root.value?.contains(active))
      active.scrollIntoView({ block: 'nearest' })
  })
})
// The over-the-room message comes in above the lines while one is typed in, and a paste note can
// make the head taller: WebKit keeps no scroll anchor, so the line would drop out of the dock's
// short body without this.
watch([over, pasteNote], () => {
  if (!docked.value) return
  void nextTick(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement && root.value?.contains(active))
      active.scrollIntoView({ block: 'nearest' })
  })
})
onBeforeUnmount(() => {
  alive = false
  releaseSwipes?.()
  clearPanelTimer()
  if (pause !== null) clearTimeout(pause)
})

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !docked.value) return
  event.preventDefault()
  cancel()
}
</script>

<template>
  <div
    ref="root"
    :class="{ 'editor-dock': docked, 'deck-edit-dock': docked }"
    role="group"
    :aria-label="docked ? title : t('deckSlideNumber', { n: number })"
    :data-field="docked ? field : undefined"
    :data-testid="docked ? 'deck-dock' : 'deck-fields'"
    @keydown="onKeydown"
    @paste="guard.onPaste"
    @beforeinput="guard.onBeforeInput"
    @input="guard.onInput"
    @compositionend="guard.onCompositionEnd"
  >
    <div v-if="docked" class="editor-dock-head">
      <p
        v-if="pasteNote"
        class="editor-dock-message deck-edit-paste-note"
        aria-hidden="true"
        data-testid="deck-paste-note"
      >
        {{ pasteNote }}
      </p>
      <template v-else>
        <strong>{{ title }}</strong>
        <span
          v-if="field === 'lines' && budget"
          class="deck-edit-budget"
          :data-level="level"
          data-testid="deck-dock-budget"
          >{{ budget }}</span
        >
      </template>
      <img
        v-if="thumb"
        class="deck-edit-mini"
        :src="thumb"
        alt=""
        width="64"
        height="36"
        draggable="false"
        data-testid="deck-dock-mini"
      />
      <span class="visually-hidden" aria-live="polite">{{ saveWords }}</span>
    </div>
    <!-- The note as it is announced, mounted while the fields are; the one in sight is hidden from it. -->
    <span class="visually-hidden" role="status">{{ pasteNote }}</span>
    <div class="deck-edit-dock-body">
      <!-- Mounted while the fields are, so what it says is announced as it changes. -->
      <p :id="`${uid}-message`" class="editor-dock-message" role="status" data-testid="deck-dock-message">
        <template v-if="over">
          <span>{{ over }}</span>
          <template v-if="number !== 1">
            <span v-if="full && splitsInTwo" data-testid="deck-split-full">{{ full }}</span>
            <button
              type="button"
              class="button secondary small"
              :disabled="!editable || !canSplit"
              :title="splitWhy"
              data-testid="deck-split"
              @mousedown.prevent
              @click="split"
            >
              {{ t('deckSplit') }}
            </button>
            <button
              type="button"
              class="button secondary small"
              :disabled="!editable"
              data-testid="deck-pick-layout"
              @mousedown.prevent
              @click="pickLayout"
            >
              {{ t('deckPickLayout') }}
            </button>
          </template>
        </template>
      </p>

      <label v-if="!docked" :for="`${uid}-heading`" class="deck-edit-field-name">{{
        t('deckFieldHeadline')
      }}</label>
      <input
        v-if="shows('heading')"
        :id="`${uid}-heading`"
        :value="heading"
        maxlength="160"
        enterkeyhint="done"
        :aria-label="docked ? t('deckFieldHeadline') : undefined"
        :aria-describedby="`${uid}-message`"
        :lang="lang"
        autocapitalize="sentences"
        :spellcheck="locale !== 'uz'"
        data-testid="deck-headline"
        data-note="heading"
        @input="heading = read($event)"
        @keydown="onHeadingKeydown"
        @change="changed"
      />
      <p
        v-if="pasteAt('heading')"
        class="field-hint deck-edit-paste-note"
        aria-hidden="true"
        data-testid="deck-paste-note"
      >
        {{ pasteNote }}
      </p>

      <template v-if="shows('lines')">
        <span v-if="!docked" class="deck-edit-field-name"
          >{{ t('deckFieldLines')
          }}<span v-if="budget" class="deck-edit-budget" :data-level="level" data-testid="deck-dock-budget">{{
            budget
          }}</span></span
        >
        <div v-if="usesColumns" class="deck-edit-columns" role="group" :aria-label="t('slideColumns')">
          <template v-for="(column, index) in columns.slice(0, MAX_SLIDE_COLUMNS)" :key="index">
            <input
              :value="column"
              maxlength="80"
              :placeholder="t('slideColumns')"
              :aria-label="`${t('slideColumns')} ${index + 1}`"
              :lang="lang"
              autocapitalize="sentences"
              :spellcheck="locale !== 'uz'"
              :data-testid="`deck-column-${index}`"
              :data-note="`column-${index}`"
              @input="setColumn(index, $event)"
              @change="changed"
            />
            <!-- After its column: a row of its own, right under that column's row. -->
            <p
              v-if="pasteAt(`column-${index}`)"
              class="field-hint deck-edit-paste-note"
              aria-hidden="true"
              data-testid="deck-paste-note"
            >
              {{ pasteNote }}
            </p>
          </template>
        </div>
        <template v-if="showLines">
          <div v-for="(line, index) in lines" :key="line.key" class="deck-edit-line">
            <span aria-hidden="true">{{ index + 1 }}</span>
            <input
              :value="line.text"
              maxlength="400"
              enterkeyhint="next"
              :aria-label="t('deckLine', { n: index + 1 })"
              :aria-describedby="`${uid}-message`"
              :lang="lang"
              autocapitalize="sentences"
              :spellcheck="locale !== 'uz'"
              :data-testid="`deck-line-${index}`"
              :data-note="`line-${line.key}`"
              @input="line.text = read($event)"
              @keydown="onLineKeydown($event, index)"
              @paste="onLinePaste($event, index)"
              @change="changed"
            />
            <button
              type="button"
              class="icon-button"
              :aria-label="t('deckLineMenu', { n: index + 1 })"
              :aria-expanded="menuLine === line.key"
              :data-testid="`deck-line-menu-${index}`"
              @mousedown.prevent
              @click="toggleLineMenu(line.key)"
            >
              <AppIcon name="more" :size="18" />
            </button>
            <p
              v-if="pasteAt(`line-${line.key}`)"
              class="field-hint deck-edit-paste-note"
              aria-hidden="true"
              data-testid="deck-paste-note"
            >
              {{ pasteNote }}
            </p>
            <div v-if="menuLine === line.key" class="deck-edit-line-actions">
              <button
                type="button"
                class="icon-button"
                :aria-label="t('deckLineUp')"
                :disabled="index === 0"
                :data-testid="`deck-line-up-${index}`"
                @mousedown.prevent
                @click="moveLine(index, -1)"
              >
                <AppIcon name="up" :size="18" />
              </button>
              <button
                type="button"
                class="icon-button"
                :aria-label="t('deckLineDown')"
                :disabled="index === lineCount - 1"
                :data-testid="`deck-line-down-${index}`"
                @mousedown.prevent
                @click="moveLine(index, 1)"
              >
                <AppIcon name="moveDown" :size="18" />
              </button>
              <button
                type="button"
                class="icon-button"
                :aria-label="t('deckRemoveLine')"
                :data-testid="`deck-line-remove-${index}`"
                @mousedown.prevent
                @click="removeLine(index)"
              >
                <AppIcon name="trash" :size="18" />
              </button>
            </div>
          </div>
        </template>
        <template v-if="usesItems">
          <div v-for="(item, index) in items" :key="item.key" class="deck-edit-item">
            <input
              :value="item.label"
              maxlength="160"
              :placeholder="t('itemLabel')"
              :aria-label="`${index + 1} · ${t('itemLabel')}`"
              :lang="lang"
              autocapitalize="sentences"
              :spellcheck="locale !== 'uz'"
              :data-testid="`deck-item-${index}-label`"
              :data-note="`item-${item.key}`"
              @input="item.label = read($event)"
              @change="changed"
            />
            <input
              :value="item.text"
              maxlength="600"
              :placeholder="t('itemText')"
              :aria-label="`${index + 1} · ${t('itemText')}`"
              :lang="lang"
              autocapitalize="sentences"
              :spellcheck="locale !== 'uz'"
              :data-testid="`deck-item-${index}-text`"
              :data-note="`item-${item.key}`"
              @input="item.text = read($event)"
              @change="changed"
            />
            <div
              v-if="layout === 'pros_cons'"
              class="deck-edit-procon"
              role="group"
              :aria-label="`${index + 1} · ${t('itemValue')}`"
            >
              <button
                type="button"
                :aria-pressed="side(item.value) === 'pro'"
                :data-testid="`deck-item-${index}-pro`"
                @mousedown.prevent
                @click="setSide(item, 'pro')"
              >
                {{ t('deckPro') }}
              </button>
              <button
                type="button"
                :aria-pressed="side(item.value) === 'con'"
                :data-testid="`deck-item-${index}-con`"
                @mousedown.prevent
                @click="setSide(item, 'con')"
              >
                {{ t('deckCon') }}
              </button>
            </div>
            <input
              v-else-if="VALUE_LAYOUTS.has(layout)"
              :value="item.value"
              maxlength="160"
              :placeholder="t('itemValue')"
              :aria-label="`${index + 1} · ${t('itemValue')}`"
              :lang="lang"
              autocapitalize="sentences"
              :spellcheck="locale !== 'uz'"
              :data-testid="`deck-item-${index}-value`"
              :data-note="`item-${item.key}`"
              @input="item.value = read($event)"
              @change="changed"
            />
            <button
              type="button"
              class="icon-button"
              :aria-label="t('deckRemoveLine')"
              :data-testid="`deck-item-${index}-remove`"
              @mousedown.prevent
              @click="dropItem(index)"
            >
              <AppIcon name="trash" :size="16" />
            </button>
            <p
              v-if="pasteAt(`item-${item.key}`)"
              class="field-hint deck-edit-paste-note"
              aria-hidden="true"
              data-testid="deck-paste-note"
            >
              {{ pasteNote }}
            </p>
            <p v-if="item.text.trim() && !item.label.trim()" class="deck-edit-item-hint">
              {{ t('deckItemNeedsLabel') }}
            </p>
          </div>
        </template>
        <button
          type="button"
          class="deck-edit-add-line"
          :disabled="!canAddLine"
          data-testid="deck-add-line"
          @mousedown.prevent
          @click="addLine"
        >
          <AppIcon name="plus" :size="18" />{{ t('deckAddLine') }}
        </button>
      </template>

      <label v-if="!docked" :for="`${uid}-notes`" class="deck-edit-field-name">{{
        t('deckFieldNotes')
      }}</label>
      <textarea
        v-if="shows('notes')"
        :id="`${uid}-notes`"
        :value="notes"
        maxlength="2000"
        rows="3"
        :aria-label="docked ? t('deckFieldNotes') : undefined"
        :lang="lang"
        autocapitalize="sentences"
        :spellcheck="locale !== 'uz'"
        data-testid="deck-notes"
        data-note="notes"
        @input="notes = read($event, true)"
        @change="changed"
      />
      <p
        v-if="pasteAt('notes')"
        class="field-hint deck-edit-paste-note"
        aria-hidden="true"
        data-testid="deck-paste-note"
      >
        {{ pasteNote }}
      </p>
    </div>
    <div v-if="docked" class="deck-edit-dock-foot">
      <button type="button" class="button secondary small" data-testid="deck-dock-cancel" @click="cancel">
        {{ t('cancel') }}
      </button>
      <button
        type="button"
        class="button primary small"
        :disabled="!editable"
        data-testid="deck-dock-done"
        @click="done('done')"
      >
        {{ t('editorDone') }}
      </button>
    </div>
  </div>
</template>
