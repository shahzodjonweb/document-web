<script setup lang="ts">
/**
 * The title slide's lines as a form: the topic, who made it and who checks it, the
 * class, the school, and any other line. It is written back line for line through
 * useDeckCover.ts: a line not touched goes back as it was, a changed one keeps its
 * own label ("Bajardi:"), and only a new one gets the deck's label, in the deck's
 * language.
 *
 * The four roles can be kept on the account for the next decks. Kept ones fill the
 * rows this cover lacks and go in at the first commit, unless cleared. Nothing is
 * focused on open: the keyboard would cover the slide the form is about.
 */
import {
  COVER_LINES,
  COVER_ROLES,
  adoptRows,
  carryRows,
  composeCover,
  countCoverLines,
  coverMemory,
  coverRoleOpen,
  fillCoverFromKept,
  keepsSame,
  labelsFor,
  linesInPlace,
  noteRows,
  parseCover,
  restoreRows,
  roleLines,
  settleRows,
  type CoverRole,
  type CoverRow,
} from '~/composables/useDeckCover'
import type { CommitReason, DeckFit, DeckSection } from '~/composables/useDeckEditor'
import { usePasteGuard } from '~/composables/usePasteGuard'

const props = defineProps<{
  section: DeckSection
  title: string
  mode: 'sheet' | 'panel'
  editable: boolean
  locale: 'en' | 'uz' | 'ru'
}>()
const emit = defineEmits<{ commit: [patch: { heading: string; body: string }, reason: CommitReason] }>()

const LINE_CHARS = 160
/** The budget is asked of the server once typing pauses, as the dock's is. */
const MEASURE_AFTER = 1500
const ROLE_FIELDS: Record<CoverRole, { label: string; placeholder?: string }> = {
  made: { label: 'deckCoverPreparedBy' },
  checked: { label: 'deckCoverCheckedBy' },
  group: { label: 'deckCoverGroup', placeholder: 'deckCoverGroupExample' },
  school: { label: 'deckCoverSchool', placeholder: 'deckCoverSchoolExample' },
}

const { t, locale: screenLocale } = useLocale()
const plural = (key: string, amount: number, values: Record<string, string | number> = {}) =>
  t(`${key}_${new Intl.PluralRules(screenLocale.value).select(amount)}`, { count: amount, ...values })
const deck = useDeckEditor()
const cover = useDeckCover()
const telegram = useTelegramApp()
const snackbar = useEditorSnackbar()

const labels = computed(() => labelsFor(props.locale))
/** The rows this deck's Cover forms have shown, before this one too. */
const memory = coverMemory(deck.draftId.value)
const form = ref(parseCover(props.section.heading, props.section.body))
// A cover shown before (the sheet closed and opened again): each line in the row it had.
if (memory.covers.has(props.section.body)) restoreRows(form.value, memory, props.section.body)
const composed = computed(() => composeCover(form.value, labels.value))
/** The cover as the form reads it untouched: blank lines and the like are not a change. */
const pristine = computed(() =>
  composeCover(parseCover(props.section.heading, props.section.body), labels.value),
)
const dirty = computed(
  () => composed.value.heading !== pristine.value.heading || composed.value.body !== pristine.value.body,
)
/** Rows filled from the account, said until they are in the deck or cleared. */
const filled = ref(false)
const filledShown = computed(() => filled.value && dirty.value)
const keepLines = ref(false)
let keepTouched = false
/** What the last commit sent, until the deck answers with it: a second commit before then is the same one. */
let sent = ''

const rowOf = (role: CoverRole) => form.value.rows.find((row) => row.role === role)
const others = computed(() => form.value.rows.filter((row) => row.role === 'other'))
/** Each line's own key, so its field and its trash stay with it when a line before it goes. */
const keys = new WeakMap<CoverRow, number>()
let lastKey = 0
function keyOf(row: CoverRow) {
  const own = toRaw(row)
  let key = keys.get(own)
  if (key === undefined) keys.set(own, (key = ++lastKey))
  return key
}
const lineCount = computed(() => countCoverLines(form.value))
/** The slide draws eight lines: past them a new one is refused at the tap, and the form says why. */
const full = computed(() => lineCount.value >= COVER_LINES)
const remembered = computed(() => cover.remembered.value ?? [])

// The cover changed under the form (Undo, Latin letters, the other side of a conflict):
// read again, unless something typed here has not gone in yet.
watch(
  () => [props.section.heading, props.section.body] as const,
  ([heading, body], [oldHeading, oldBody]) => {
    sent = ''
    const mine = JSON.stringify(composed.value)
    const was = JSON.stringify(composeCover(parseCover(oldHeading, oldBody), labels.value))
    const now = JSON.stringify(composeCover(parseCover(heading, body), labels.value))
    // Its own words back, as its commit sent them: each row is now what the slide has, so a row
    // cleared is a new row the slide may have no room for. Rows stay where they are and in their
    // rows ("Northbrook" typed in School), so a tap begun on one never lands on another.
    if (mine === now) {
      settleRows(form.value, labels.value)
      noteRows(form.value, memory, body)
      filled.value = false
      return
    }
    if (mine !== was) return
    const before = form.value
    form.value = parseCover(heading, body)
    // Lines shown before go back to their rows (Undo, Redo); a line new here takes the row of the
    // line it stands in place of (Latin letters, the other side's words).
    const known = restoreRows(form.value, memory, body)
    const rewritten = [...linesInPlace(oldBody, body)].filter(([, line]) => !known.has(line))
    carryRows(form.value, before, new Map(rewritten), labels.value)
    adoptRows(form.value, cover.kept.value ?? [])
    noteRows(form.value, memory, body)
    filled.value = false
  },
)

onMounted(async () => {
  if (cover.remembered.value === null) await cover.loadRemembered()
  if (!keepTouched) keepLines.value = remembered.value.length > 0
  // Each kept line back in the row it was typed in.
  if (props.editable && fillCoverFromKept(form.value, cover.kept.value ?? [])) filled.value = true
  noteRows(form.value, memory, props.section.body)
  // After the watch below has heard the rows just filled, so the first answer is not held back.
  await nextTick()
  measureSoon(0)
})

/** One line each, as the cover holds them: no control characters, a tab is a space. */
function clean(event: Event) {
  const field = event.target as HTMLInputElement
  let value = ''
  for (const character of field.value) {
    if (character === '\t') value += ' '
    else if ((character.codePointAt(0) ?? 0) >= 32) value += character
  }
  if (value !== field.value) field.value = value
  return value
}
function setRow(row: CoverRow | undefined, event: Event) {
  if (row) row.value = clean(event)
}
async function addLine() {
  form.value.rows.push({ role: 'other', value: '', label: null, original: null })
  await nextTick()
  root.value
    ?.querySelector<HTMLInputElement>(`[data-testid="deck-cover-other-${others.value.length - 1}"]`)
    ?.focus()
}
function removeLine(row: CoverRow) {
  form.value.rows = form.value.rows.filter((item) => item !== row)
  // Its paste note goes with it.
  clearPaste()
  commit('blur')
}

const fit = ref<DeckFit | null>(null)
const level = computed(() => {
  const answer = fit.value
  if (!answer) return 'ok'
  if (!answer.fits || answer.lines_used > answer.lines_max) return 'over'
  return answer.lines_max && answer.lines_used / answer.lines_max >= 0.9 ? 'near' : 'ok'
})
let measureTimer: ReturnType<typeof setTimeout> | null = null
function measureSoon(delay = MEASURE_AFTER) {
  if (measureTimer !== null) clearTimeout(measureTimer)
  measureTimer = setTimeout(async () => {
    measureTimer = null
    const asked = composed.value
    const answer = await deck.measure({ ...props.section, heading: asked.heading, body: asked.body })
    // Typed on meanwhile: that answer is of words no longer there.
    if (asked.heading === composed.value.heading && asked.body === composed.value.body) fit.value = answer
  }, delay)
}
watch(composed, () => measureSoon())

/** Kept on the account when ticked, as one write at a time; unticked by the person, what was kept goes. */
function keep() {
  const lines = keepLines.value ? roleLines(form.value, labels.value) : null
  void cover.queue(async (now) => {
    const before = cover.kept.value ?? { lines: [], roles: [] }
    if (lines === null) {
      if (!keepTouched || !before.lines.length) return
      if (!(await now.forget())) snackbar.show({ message: t('genericError') })
      return
    }
    // Each role as kept already, and each kept with its row: nothing worth a write.
    if (lines.lines.length && keepsSame(lines, before)) return
    if (!(await now.remember(lines, props.locale))) snackbar.show({ message: t('genericError') })
  })
}
function onKeep(event: Event) {
  keepLines.value = (event.target as HTMLInputElement).checked
  keepTouched = true
  commit('blur')
}
let forgetting = false
async function forgetLines() {
  // One at a time, and unticked as it goes, so a commit made before it is gone keeps nothing again.
  if (forgetting) return
  forgetting = true
  const was = { lines: keepLines.value, touched: keepTouched }
  keepLines.value = false
  keepTouched = false
  const gone = await cover.forget()
  forgetting = false
  if (gone) return snackbar.show({ message: t('deckCoverForgotten') })
  if (!keepLines.value) {
    keepLines.value = was.lines
    keepTouched = was.touched
  }
  snackbar.show({ message: t('genericError') })
  // Ticked again: a change made while it was on its way is kept, as the tick says. A form
  // closed meanwhile keeps nothing: one opened again keeps its own rows.
  if (live && keepLines.value) keep()
}

/**
 * Into the deck as one change, when it is one; the frame offers its new words in
 * Latin letters (DeckEditor's onCoverCommit). Every way the form goes away commits
 * first: leaving a field, the sheet's close and Back, and the frame's own commits.
 */
function commit(reason: CommitReason = 'close') {
  if (!props.editable) return
  const next = composed.value
  const key = JSON.stringify(next)
  const changed = dirty.value && key !== sent
  if (changed) {
    sent = key
    emit('commit', { heading: next.heading, body: next.body }, reason)
    filled.value = false
  }
  // Only what the person changed or chose is kept: opening someone else's cover changes nothing kept.
  if (changed || keepTouched) keep()
}
let live = true
onBeforeUnmount(() => {
  live = false
  if (measureTimer !== null) clearTimeout(measureTimer)
})

const typing = computed(() => ({
  lang: props.locale === 'uz' ? 'uz-Latn' : props.locale,
  spellcheck: props.locale !== 'uz',
}))

/** On a phone the keyboard covers the sheet's own close: Done stays above the fields while one is in use. */
const root = ref<HTMLElement>()
const focused = ref(false)
const isField = (node: unknown) => node instanceof HTMLInputElement && node.type !== 'checkbox'
function onFocusIn(event: FocusEvent) {
  if (isField(event.target)) focused.value = true
}
// Focus that stays in the form (the checkbox, a remove button) keeps the row: taken away under the
// finger, the form would move and the tap land on something else.
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (!(next instanceof Node && root.value?.contains(next))) focused.value = false
}
function done() {
  commit('done')
  ;(document.activeElement as HTMLElement | null)?.blur?.()
  focused.value = false
  telegram.hideKeyboard()
}

/** More pasted or put in than a line holds: what fits goes in, and a note under the field says the end did not. */
const { note: pasteNote, field: pasteField, clear: clearPaste, ...guard } = usePasteGuard(root)

defineExpose({ commit, dirty })
</script>

<template>
  <div
    ref="root"
    class="deck-edit-cover"
    data-testid="deck-cover-form"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @paste="guard.onPaste"
    @beforeinput="guard.onBeforeInput"
    @input="guard.onInput"
    @compositionend="guard.onCompositionEnd"
  >
    <!-- The note as it is announced; the one in sight, under its field, is hidden from it. -->
    <span class="visually-hidden" role="status">{{ pasteNote }}</span>
    <div v-if="mode === 'sheet' && focused" class="deck-edit-sheet-done">
      <button
        type="button"
        class="button primary small"
        data-testid="deck-cover-done"
        @mousedown.prevent
        @click="done"
      >
        {{ t('editorDone') }}
      </button>
    </div>
    <p v-if="filledShown" class="info-banner" role="status" data-testid="deck-cover-filled">
      {{ t('deckCoverFilled') }}
    </p>
    <label>
      <span>{{ t('deckCoverTopic') }}</span>
      <input
        :value="form.topic"
        :maxlength="LINE_CHARS"
        :placeholder="title"
        :disabled="!editable"
        autocapitalize="sentences"
        v-bind="typing"
        data-testid="deck-cover-topic"
        data-note="topic"
        @input="form.topic = clean($event)"
        @change="commit('blur')"
      />
    </label>
    <p
      v-if="pasteNote && pasteField === 'topic'"
      class="field-hint deck-edit-paste-note"
      aria-hidden="true"
      data-testid="deck-cover-paste-note"
    >
      {{ pasteNote }}
    </p>
    <template v-for="role in COVER_ROLES" :key="role">
      <label>
        <span>{{ t(ROLE_FIELDS[role].label) }}</span>
        <input
          :value="rowOf(role)?.value ?? ''"
          :maxlength="LINE_CHARS"
          :placeholder="ROLE_FIELDS[role].placeholder ? t(ROLE_FIELDS[role].placeholder) : undefined"
          :disabled="!editable || !coverRoleOpen(form, role)"
          :aria-describedby="coverRoleOpen(form, role) ? undefined : 'deck-cover-full'"
          :autocapitalize="role === 'made' || role === 'checked' ? 'words' : 'sentences'"
          v-bind="typing"
          :data-testid="`deck-cover-${role}`"
          :data-note="role"
          @input="setRow(rowOf(role), $event)"
          @change="commit('blur')"
        />
      </label>
      <p
        v-if="pasteNote && pasteField === role"
        class="field-hint deck-edit-paste-note"
        aria-hidden="true"
        data-testid="deck-cover-paste-note"
      >
        {{ pasteNote }}
      </p>
    </template>
    <p v-if="editable && full" id="deck-cover-full" class="field-hint" data-testid="deck-cover-full">
      {{ t('deckCoverFull', { max: COVER_LINES }) }}
    </p>
    <div v-for="(row, index) in others" :key="keyOf(row)" class="deck-edit-cover-other">
      <label>
        <span>{{ row.label || t('deckCoverOther') }}</span>
        <input
          :value="row.value"
          :maxlength="LINE_CHARS"
          :disabled="!editable"
          autocapitalize="sentences"
          v-bind="typing"
          :data-testid="`deck-cover-other-${index}`"
          :data-note="`other-${keyOf(row)}`"
          @input="setRow(row, $event)"
          @change="commit('blur')"
        />
      </label>
      <button
        type="button"
        class="icon-button"
        :aria-label="t('deckRemoveLine')"
        :disabled="!editable"
        :data-testid="`deck-cover-other-${index}-remove`"
        @click="removeLine(row)"
      >
        <AppIcon name="trash" :size="16" />
      </button>
      <p
        v-if="pasteNote && pasteField === `other-${keyOf(row)}`"
        class="field-hint deck-edit-paste-note"
        aria-hidden="true"
        data-testid="deck-cover-paste-note"
      >
        {{ pasteNote }}
      </p>
    </div>
    <p v-if="composed.over.length" class="warning-banner" role="status" data-testid="deck-cover-over">
      {{ t('deckCoverFull', { max: COVER_LINES }) }}
    </p>
    <p role="status">
      <span v-if="fit" class="deck-edit-budget" :data-level="level" data-testid="deck-cover-budget">{{
        plural('deckLinesBudget', fit.lines_max, { used: fit.lines_used, max: fit.lines_max })
      }}</span>
    </p>
    <button
      type="button"
      class="button secondary small"
      data-testid="deck-cover-add"
      :disabled="!editable || full"
      :aria-describedby="editable && full ? 'deck-cover-full' : undefined"
      @click="addLine"
    >
      <AppIcon name="plus" :size="15" />{{ t('deckAddLine') }}
    </button>
    <div class="deck-edit-remember">
      <label>
        <input
          type="checkbox"
          :checked="keepLines"
          :disabled="!editable"
          data-testid="deck-cover-remember"
          @change="onKeep"
        /><span>{{ t('deckCoverRemember') }}</span>
      </label>
      <p class="field-hint">{{ t('deckCoverRememberHint') }}</p>
      <button
        v-if="remembered.length"
        type="button"
        class="text-link"
        data-testid="deck-cover-forget"
        @click="forgetLines"
      >
        {{ t('editorForget') }}
      </button>
    </div>
  </div>
</template>
