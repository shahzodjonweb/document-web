<script setup lang="ts">
/** The rest of the deck editor, one tap in: the parts no slide region leads to. */
import { primeKeyboard } from '~/composables/useDeckEditor'

const open = defineModel<boolean>({ required: true })
defineProps<{ questions: boolean; notes: boolean; editable: boolean }>()
const emit = defineEmits<{ cover: []; questions: []; notes: []; show: [index: number] }>()

const { t } = useLocale()
const telegram = useTelegramApp()
const snackbar = useEditorSnackbar()
const hints = useEditorHints()
const deck = useDeckEditor()

/** All changes is a page of this sheet: Back returns to the rows, and closing starts on them again. */
const view = ref<'menu' | 'changes'>('menu')
telegram.useBackLayer(
  () => open.value && view.value === 'changes',
  () => (view.value = 'menu'),
)
watch(open, (value) => {
  if (!value) view.value = 'menu'
})
const changed = computed(() => JSON.stringify(deck.baseline.value) !== JSON.stringify(deck.content.value))

function show(index: number) {
  open.value = false
  emit('show', index)
}

/** One step of history, so nothing is lost and nothing needs asking first. */
function startOver() {
  open.value = false
  if (!deck.startOver()) return
  snackbar.show({
    message: t('deckStartedOver'),
    actionLabel: t('editorUndo'),
    onAction: deck.undo,
    step: deck.steps.value,
  })
}

function choose(what: 'cover' | 'questions') {
  open.value = false
  if (what === 'cover') emit('cover')
  else emit('questions')
}

/**
 * The notes open in the dock, whose field takes the keyboard only after a field
 * focused inside this tap. A modal sheet leaves the page inert until it closes,
 * so it is closed here first, before the stand-in field takes focus.
 */
function openNotes(event: MouseEvent) {
  ;(event.currentTarget as HTMLElement).closest('dialog')?.close()
  primeKeyboard()
  open.value = false
  emit('notes')
}

function showTips() {
  hints.showAgain()
  open.value = false
  snackbar.show({ message: t('editorTipsBack') })
}
</script>

<template>
  <EditorSheet
    :open="open"
    size="tall"
    modal
    :title="view === 'changes' ? t('editorAllChanges') : t('editorMore')"
    testid="deck-more-sheet"
    @close="open = false"
  >
    <DeckChangeList v-if="view === 'changes'" testid="deck-more-changes-list" @show="show" />
    <div v-else class="editor-more-rows">
      <button type="button" class="editor-more-row" data-testid="deck-more-changes" @click="view = 'changes'">
        <AppIcon name="reorder" :size="19" /><span>{{ t('editorAllChanges') }}</span
        ><AppIcon name="chevron" :size="15" />
      </button>
      <button type="button" class="editor-more-row" data-testid="deck-more-cover" @click="choose('cover')">
        <AppIcon name="file" :size="19" /><span>{{ t('deckCoverDetails') }}</span
        ><AppIcon name="chevron" :size="15" />
      </button>
      <button
        v-if="questions"
        type="button"
        class="editor-more-row"
        data-testid="deck-more-questions"
        @click="choose('questions')"
      >
        <AppIcon name="checks" :size="19" /><span>{{ t('deckQuestionsTitle') }}</span
        ><AppIcon name="chevron" :size="15" />
      </button>
      <button
        type="button"
        class="editor-more-row"
        data-testid="deck-more-notes"
        :disabled="!notes || !editable"
        @click="openNotes"
      >
        <AppIcon name="sticky" :size="19" /><span>{{ t('deckFieldNotes') }}</span>
      </button>
      <button
        type="button"
        class="editor-more-row"
        data-testid="deck-more-tips"
        :disabled="!hints.anyRetired.value"
        @click="showTips"
      >
        <AppIcon name="help" :size="19" /><span>{{ t('editorShowTips') }}</span>
      </button>
      <button
        v-if="telegram.canExpand.value"
        type="button"
        class="editor-more-row"
        data-testid="editor-more-expand"
        @click="telegram.toggleExpanded()"
      >
        <AppIcon name="fit" :size="19" /><span>{{ t('editorExpand') }}</span>
      </button>
      <button
        type="button"
        class="editor-more-row"
        data-testid="deck-more-start-over"
        :disabled="!changed || !editable"
        @click="startOver"
      >
        <AppIcon name="rotateLeft" :size="19" /><span>{{ t('editorStartOver') }}</span>
      </button>
    </div>
  </EditorSheet>
</template>
