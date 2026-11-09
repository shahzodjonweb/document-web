<script setup lang="ts">
/**
 * The deck's questions, changed where they stand: each stem, its options and its
 * answer, or a question taken out. New ones are not written here. What is typed goes
 * to the deck a moment after the last key, on leaving a field, and whenever the frame
 * commits (Send, hiding the app, closing the sheet); explanation, topic and marks go
 * back as they came.
 */
import type { DeckQuestion } from '~/composables/useDeckEditor'
import { usePasteGuard } from '~/composables/usePasteGuard'

const props = defineProps<{
  questions: DeckQuestion[]
  mode: 'sheet' | 'panel'
  editable: boolean
  locale: 'en' | 'uz' | 'ru'
}>()
const emit = defineEmits<{ commit: [next: DeckQuestion[]] }>()

const COMMIT_AFTER = 600
const LETTERS = 'ABCDEFGH'

const { t } = useLocale()
const telegram = useTelegramApp()

const copy = (list: DeckQuestion[]): DeckQuestion[] => JSON.parse(JSON.stringify(list))
const buffer = ref<DeckQuestion[]>(copy(props.questions))
const dirty = computed(() => JSON.stringify(buffer.value) !== JSON.stringify(props.questions))
/** What the last commit sent, until the deck answers with it: a second commit before then is the same one. */
let sent = ''
let timer: ReturnType<typeof setTimeout> | null = null

// The deck changed under the form (Undo, the other side of a conflict): taken unless something is typed here.
watch(
  () => JSON.stringify(props.questions),
  (next, previous) => {
    sent = ''
    const mine = JSON.stringify(buffer.value)
    if (mine === previous || mine === next) buffer.value = JSON.parse(next)
  },
)

function commit() {
  if (timer !== null) clearTimeout(timer)
  timer = null
  const next = JSON.stringify(buffer.value)
  if (!props.editable || !dirty.value || next === sent) return
  sent = next
  emit('commit', JSON.parse(next))
}
// Typed a moment ago and not yet gone in: it goes now rather than with nothing to send it.
onBeforeUnmount(() => timer !== null && commit())

/** The server's rule: no control characters but newline (in the stem) and tab. */
function clean(event: Event, multiline: boolean) {
  const field = event.target as HTMLInputElement | HTMLTextAreaElement
  let value = ''
  for (const character of field.value) {
    const code = character.codePointAt(0) ?? 0
    if (code >= 32 || character === '\t' || (multiline && character === '\n')) value += character
  }
  if (value !== field.value) field.value = value
  return value
}
function edit(index: number, apply: (question: DeckQuestion) => void) {
  const question = buffer.value[index]
  if (!question) return
  apply(question)
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(commit, COMMIT_AFTER)
}
/** An option that was the answer takes the answer with it, so the key still names an option. */
function setOption(index: number, option: number, value: string) {
  edit(index, (question) => {
    const options = [...(question.options ?? [])]
    if (question.answer === options[option]) question.answer = value
    options[option] = value
    question.options = options
  })
}
function remove(index: number) {
  buffer.value = buffer.value.filter((_, at) => at !== index)
  // The questions after it move up: a paste note would stand under another one's field.
  clearPaste()
  commit()
}

const typing = computed(() => ({
  lang: props.locale === 'uz' ? 'uz-Latn' : props.locale,
  autocapitalize: 'sentences',
  spellcheck: props.locale !== 'uz',
}))

/** On a phone the keyboard covers the sheet's own close: Done stays above the fields while one is in use. */
const root = ref<HTMLElement>()
const focused = ref(false)
const isField = (node: unknown) => node instanceof HTMLElement && node.matches('input, textarea')
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
  commit()
  ;(document.activeElement as HTMLElement | null)?.blur?.()
  focused.value = false
  telegram.hideKeyboard()
}

/** More pasted or put in than a field holds: what fits goes in, and a note under the field says the end did not. */
const { note: pasteNote, field: pasteField, clear: clearPaste, ...guard } = usePasteGuard(root)
const pasteAt = (name: string) => !!pasteNote.value && pasteField.value === name

defineExpose({ commit, dirty })
</script>

<template>
  <div
    ref="root"
    data-testid="deck-questions"
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
        data-testid="deck-questions-done"
        @mousedown.prevent
        @click="done"
      >
        {{ t('editorDone') }}
      </button>
    </div>
    <p class="field-hint">{{ t('deckQuestionsLead') }}</p>
    <fieldset
      v-for="(question, index) in buffer"
      :key="question.id"
      class="deck-edit-question"
      :disabled="!editable"
    >
      <legend>{{ t('deckQuestion', { n: index + 1 }) }}</legend>
      <textarea
        :value="question.stem"
        maxlength="2000"
        rows="2"
        :aria-label="t('deckQuestion', { n: index + 1 })"
        v-bind="typing"
        :data-testid="`deck-question-${index}-stem`"
        :data-note="`${index}-stem`"
        @input="edit(index, (item) => (item.stem = clean($event, true)))"
        @change="commit"
      />
      <p
        v-if="pasteAt(`${index}-stem`)"
        class="field-hint deck-edit-paste-note"
        aria-hidden="true"
        data-testid="deck-questions-paste-note"
      >
        {{ pasteNote }}
      </p>
      <div v-if="question.options?.length">
        <template v-for="(option, at) in question.options" :key="at">
          <label>
            <span>{{ t('deckQuestionOption', { letter: LETTERS[at] ?? at + 1 }) }}</span>
            <input
              :value="option"
              maxlength="500"
              v-bind="typing"
              :data-testid="`deck-question-${index}-option-${at}`"
              :data-note="`${index}-option-${at}`"
              @input="setOption(index, at, clean($event, false))"
              @change="commit"
            />
          </label>
          <!-- After its option: a row of its own, right under that option's row, not a word a line in its column. -->
          <p
            v-if="pasteAt(`${index}-option-${at}`)"
            class="field-hint deck-edit-paste-note"
            aria-hidden="true"
            data-testid="deck-questions-paste-note"
          >
            {{ pasteNote }}
          </p>
        </template>
      </div>
      <label>
        <span>{{ t('deckQuestionAnswer') }}</span>
        <input
          :value="question.answer"
          maxlength="2000"
          v-bind="typing"
          :data-testid="`deck-question-${index}-answer`"
          :data-note="`${index}-answer`"
          @input="edit(index, (item) => (item.answer = clean($event, false)))"
          @change="commit"
        />
      </label>
      <p
        v-if="pasteAt(`${index}-answer`)"
        class="field-hint deck-edit-paste-note"
        aria-hidden="true"
        data-testid="deck-questions-paste-note"
      >
        {{ pasteNote }}
      </p>
      <button
        type="button"
        class="button secondary small"
        :data-testid="`deck-question-${index}-remove`"
        @click="remove(index)"
      >
        <AppIcon name="trash" :size="15" />{{ t('deckRemoveQuestion') }}
      </button>
    </fieldset>
  </div>
</template>
