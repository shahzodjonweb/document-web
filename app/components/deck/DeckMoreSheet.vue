<script setup lang="ts">
/** The rest of the deck editor, one tap in: the parts no slide region leads to. */
import { primeKeyboard } from '~/composables/useDeckEditor'

const open = defineModel<boolean>({ required: true })
defineProps<{ questions: boolean; notes: boolean; editable: boolean }>()
const emit = defineEmits<{ cover: []; questions: []; notes: [] }>()

const { t } = useLocale()
const telegram = useTelegramApp()
const snackbar = useEditorSnackbar()
const hints = useEditorHints()

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
    :title="t('editorMore')"
    testid="deck-more-sheet"
    @close="open = false"
  >
    <div class="editor-more-rows">
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
    </div>
  </EditorSheet>
</template>
