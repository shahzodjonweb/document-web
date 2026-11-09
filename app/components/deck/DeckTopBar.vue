<script setup lang="ts">
/**
 * The deck's row over the slide, the PDF editor's top bar with the deck's own
 * state handed in. The deck is kept for 24 hours, so its last hour is said under
 * the name. Telegram draws the way back from 6.1; elsewhere this bar has to.
 */
import type { SaveState } from '~/composables/useEditorSession'

const props = defineProps<{
  name: string
  until: string
  soon: boolean
  saveState: SaveState
  saveError: string
  unsent: boolean
  canUndo: boolean
  canRedo: boolean
}>()
const emit = defineEmits<{ undo: []; redo: []; more: [] }>()

const { t, path } = useLocale()
const telegram = useTelegramApp()

const saveIcon = computed(() => {
  switch (props.saveState) {
    case 'failed':
    case 'paused':
      return 'x'
    case 'dirty':
    case 'saving':
      return 'upload'
    default:
      return 'check'
  }
})
const saveWords = computed(() => {
  switch (props.saveState) {
    case 'failed':
      return props.saveError || t('editorNotSaved')
    case 'paused':
      return t('editorNotSaved')
    case 'dirty':
    case 'saving':
      return t('editorSaveSending')
    default:
      return props.unsent ? `${t('editorSaveSaved')}. ${t('editorNotSent')}` : t('editorSaveSaved')
  }
})
</script>

<template>
  <header class="editor-topbar" data-testid="editor-topbar">
    <template v-if="!telegram.hasBackButton.value">
      <button
        v-if="telegram.canGoBack.value"
        type="button"
        class="icon-button"
        :aria-label="t('editorBack')"
        data-testid="editor-back"
        @click="telegram.goBack()"
      >
        <AppIcon name="back" :size="20" />
      </button>
      <NuxtLink
        v-else
        :to="path('/app/jobs')"
        class="icon-button"
        :aria-label="t('navTasks')"
        data-testid="editor-back-link"
        ><AppIcon name="back" :size="20"
      /></NuxtLink>
    </template>
    <!-- The time sits in the heading so the bar keeps its one flexible child; its own rule puts it under the name. -->
    <h1 :title="name">
      {{ name
      }}<span v-if="until" class="deck-edit-until" :data-soon="soon" data-testid="deck-until">{{
        t('deckUntil', { time: until })
      }}</span>
    </h1>
    <span class="editor-topbar-save" :data-state="saveState" :title="saveWords" data-testid="editor-save-icon"
      ><AppIcon :name="saveIcon" :size="16"
    /></span>
    <!-- Saved on the server, and not yet sent anywhere: the file in the chat is still the old one. -->
    <span
      v-if="unsent"
      class="editor-topbar-unsent"
      :title="t('editorNotSent')"
      aria-hidden="true"
      data-testid="editor-unsent"
    />
    <span class="visually-hidden" aria-live="polite" data-testid="editor-save-words">{{ saveWords }}</span>
    <button
      type="button"
      class="icon-button"
      :disabled="!canUndo"
      :aria-label="t('editorUndo')"
      data-testid="editor-undo"
      @click="emit('undo')"
    >
      <AppIcon name="undo" :size="20" />
    </button>
    <button
      type="button"
      class="icon-button"
      :disabled="!canRedo"
      :aria-label="t('editorRedo')"
      data-testid="editor-redo"
      @click="emit('redo')"
    >
      <AppIcon name="redo" :size="20" />
    </button>
    <button
      type="button"
      class="icon-button"
      :aria-label="t('editorMore')"
      aria-haspopup="dialog"
      data-testid="editor-more"
      @click="emit('more')"
    >
      <AppIcon name="menu" :size="20" />
    </button>
  </header>
</template>
