<script setup lang="ts">
/**
 * The deck's slides as a list, to move them without dragging: pick a row, then a
 * gap to put it in, or move it a place at a time. The title slide stays first, so
 * it is never picked nor a place to put another before. Each change is one step of
 * the deck's history; the frame offers Undo for the ones that take something away.
 */
import type { DeckSection } from '~/composables/useDeckEditor'

const props = defineProps<{
  sections: DeckSection[]
  questions: number
  current: number
  thumbs: Record<string, string | null>
  fits: Record<string, boolean | null>
  canAdd: boolean
  editable: boolean
}>()
const emit = defineEmits<{
  go: [index: number]
  move: [id: string, to: number]
  duplicate: [id: string]
  delete: [id: string]
  add: [after: number]
  fewer: []
  removeQuiz: []
  questions: []
}>()

const { t } = useLocale()
const telegram = useTelegramApp()

const selected = ref<string | null>(null)
/** What the last move did, said once in the status line and then replaced by the next thing to do. */
const said = ref('')
const rows = new Map<string, HTMLButtonElement>()
function keep(id: string, element: unknown) {
  if (element instanceof HTMLButtonElement) rows.set(id, element)
  else rows.delete(id)
}

const selectedIndex = computed(() =>
  selected.value ? props.sections.findIndex((section) => section.id === selected.value) : -1,
)
/** The gaps a picked row can go to: none before the title slide, none either side of itself. */
const gaps = computed(() => {
  const at = selectedIndex.value
  const open = new Set<number>()
  if (at < 1 || !props.editable) return open
  for (let gap = 1; gap <= props.sections.length; gap += 1) if (gap !== at && gap !== at + 1) open.add(gap)
  return open
})
const lastSection = computed(() => Math.max(0, props.sections.length - 1))

// Back lets go of the pick before it closes the sheet: this layer comes after the sheet's.
telegram.useBackLayer(
  () => !!selected.value,
  () => (selected.value = null),
)
// A row gone, or editing held, ends the pick.
watch(
  () => [props.sections.map((section) => section.id).join(), props.editable] as const,
  () => {
    if (selected.value && (!props.editable || selectedIndex.value < 1)) selected.value = null
  },
)
watch(selected, () => (said.value = ''))

function tap(index: number) {
  const section = props.sections[index]
  if (!section) return
  if (index === 0 || !props.editable || selected.value === section.id) return emit('go', index)
  selected.value = section.id
  telegram.haptic('selection')
}

/** `to` is the place it ends at. Focus follows the row, and the status line says where it went. */
async function move(to: number) {
  const id = selected.value
  if (!id || !props.editable) return
  emit('move', id, Math.min(Math.max(to, 1), lastSection.value))
  await nextTick()
  const at = props.sections.findIndex((section) => section.id === id)
  if (at < 0) return
  said.value = t('deckMovedTo', { n: at + 1 })
  rows.get(id)?.focus()
}
function put(gap: number) {
  const at = selectedIndex.value
  if (at > 0) void move(gap > at ? gap - 1 : gap)
}

/** A new slide after the picked one, or the one on screen; picked in turn, with no keyboard. */
async function add() {
  const before = new Set(props.sections.map((section) => section.id))
  emit('add', selectedIndex.value > 0 ? selectedIndex.value : Math.min(props.current, lastSection.value))
  await nextTick()
  const added = props.sections.find((section) => !before.has(section.id))
  if (!added) return
  selected.value = added.id
  rows.get(added.id)?.focus()
}

function onEscape(event: KeyboardEvent) {
  if (!selected.value) return
  event.preventDefault()
  event.stopPropagation()
  selected.value = null
}
</script>

<template>
  <div data-testid="deck-slide-list" @keydown.esc="onEscape">
    <button
      type="button"
      class="button secondary small"
      data-testid="deck-add-slide"
      :disabled="!canAdd || !editable"
      @click="add"
    >
      <AppIcon name="plus" :size="16" />{{ t('deckAddSlide') }}
    </button>
    <!-- Mounted with the list, so a pick and a move are announced as they happen. -->
    <div role="status">
      <p v-if="said" class="field-hint" data-testid="deck-moved">{{ said }}</p>
      <p v-else-if="selectedIndex > 0" class="field-hint" data-testid="deck-choose-spot">
        {{ t('deckChooseSpot', { n: selectedIndex + 1 }) }}
      </p>
    </div>
    <ol class="deck-edit-list">
      <li v-for="(section, index) in sections" :key="section.id">
        <button
          v-if="gaps.has(index)"
          type="button"
          class="deck-edit-put"
          :data-testid="`deck-put-${index}`"
          @click="put(index)"
        >
          {{ t('deckPutHere', { n: selectedIndex + 1 }) }}
        </button>
        <button
          :ref="(element) => keep(section.id, element)"
          type="button"
          class="deck-edit-list-row"
          :class="{ cover: index === 0 }"
          :data-testid="`deck-row-${index + 1}`"
          :aria-pressed="index === 0 ? undefined : selected === section.id"
          :aria-current="index === current ? 'true' : undefined"
          :data-fits="index > 0 && fits[section.id] === false ? 'false' : undefined"
          @click="tap(index)"
        >
          <img
            v-if="thumbs[section.id]"
            :src="thumbs[section.id]!"
            alt=""
            width="64"
            height="36"
            draggable="false"
          />
          <span v-else />
          <span>{{ index + 1 }}</span>
          <span>{{ section.heading || t('deckUntitled') }}</span>
          <span v-if="index === 0" data-testid="deck-row-cover-lock"
            ><AppIcon name="lock" :size="14" />{{ t('deckCoverFirst') }}</span
          >
          <span v-else-if="fits[section.id] === false" class="visually-hidden">{{
            t('deckWordsHidden')
          }}</span>
        </button>
        <button
          v-if="index === sections.length - 1 && gaps.has(sections.length)"
          type="button"
          class="deck-edit-put"
          :data-testid="`deck-put-${sections.length}`"
          @click="put(sections.length)"
        >
          {{ t('deckPutHere', { n: selectedIndex + 1 }) }}
        </button>
      </li>
    </ol>

    <div v-if="questions > 0" class="deck-edit-quiz" data-testid="deck-questions-row">
      <span>{{ t('deckQuestions', { count: questions }) }}</span>
      <button
        type="button"
        class="button secondary small"
        data-testid="deck-questions-open"
        :disabled="!editable"
        @click="emit('questions')"
      >
        <AppIcon name="edit" :size="15" />{{ t('deckQuestionsTitle') }}
      </button>
      <button
        v-if="questions > 5"
        type="button"
        class="button secondary small"
        data-testid="deck-fewer"
        :disabled="!editable"
        @click="emit('fewer')"
      >
        {{ t('deckFewerQuestions') }}
      </button>
      <button
        type="button"
        class="button secondary small"
        data-testid="deck-remove-quiz"
        :disabled="!editable"
        @click="emit('removeQuiz')"
      >
        <AppIcon name="trash" :size="15" />{{ t('deckRemoveQuiz') }}
      </button>
    </div>

    <!-- Only with a row picked: what else can be done with it, held at the sheet's foot. -->
    <div
      v-if="selectedIndex > 0"
      class="deck-edit-list-actions"
      role="group"
      :aria-label="t('deckSlideNumber', { n: selectedIndex + 1 })"
    >
      <button
        type="button"
        class="button secondary small"
        data-testid="deck-move-earlier"
        :disabled="!editable || selectedIndex <= 1"
        @click="move(selectedIndex - 1)"
      >
        <AppIcon name="up" :size="16" />{{ t('editorEarlier') }}
      </button>
      <button
        type="button"
        class="button secondary small"
        data-testid="deck-move-later"
        :disabled="!editable || selectedIndex >= lastSection"
        @click="move(selectedIndex + 1)"
      >
        <AppIcon name="moveDown" :size="16" />{{ t('editorLater') }}
      </button>
      <button
        type="button"
        class="button secondary small"
        data-testid="deck-duplicate"
        :disabled="!editable || !canAdd"
        @click="selected && emit('duplicate', selected)"
      >
        <AppIcon name="copy" :size="16" />{{ t('editorDuplicate') }}
      </button>
      <button
        type="button"
        class="button secondary small"
        data-testid="deck-delete"
        :disabled="!editable"
        @click="selected && emit('delete', selected)"
      >
        <AppIcon name="trash" :size="16" />{{ t('delete') }}
      </button>
    </div>
  </div>
</template>
