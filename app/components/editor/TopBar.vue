<script setup lang="ts">
/**
 * The 52 px row over the page. The save state is an icon to look at and words for a
 * screen reader. Telegram draws the way back from 6.1; elsewhere this bar has to.
 */
const emit = defineEmits<{ more: [] }>()

const { t, path } = useLocale()
const session = useEditorSession()
const telegram = useTelegramApp()
const send = useEditorSend()

const name = computed(() => (!session.isBusy('load') && session.doc.value?.file.name) || t('editorTitle'))

const saveIcon = computed(() => {
  switch (session.saveState.value) {
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
  switch (session.saveState.value) {
    case 'failed':
    case 'paused':
      return t('editorNotSaved')
    case 'dirty':
    case 'saving':
      return t('editorSaveSending')
    default:
      return send.unsent.value ? `${t('editorSaveSaved')}. ${t('editorNotSent')}` : t('editorSaveSaved')
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
        :to="path('/app/editor')"
        class="icon-button"
        :aria-label="t('editor')"
        data-testid="editor-back-link"
        ><AppIcon name="back" :size="20"
      /></NuxtLink>
    </template>
    <h1 :title="name">{{ name }}</h1>
    <span
      class="editor-topbar-save"
      :data-state="session.saveState.value"
      :title="saveWords"
      data-testid="editor-save-icon"
      ><AppIcon :name="saveIcon" :size="16"
    /></span>
    <!-- Saved on the server, and not yet sent anywhere: the file in the chat is still the old one. -->
    <span
      v-if="send.unsent.value"
      class="editor-topbar-unsent"
      :title="t('editorNotSent')"
      aria-hidden="true"
      data-testid="editor-unsent"
    />
    <span class="visually-hidden" aria-live="polite" data-testid="editor-save-words">{{ saveWords }}</span>
    <!--
      With a text field open these leave focus where it is, as its closing first would be a step of
      its own to undo. Any other field has to lose it, which is what commits the value typed there.
    -->
    <button
      type="button"
      class="icon-button"
      :disabled="!session.canUndo.value"
      :aria-label="t('editorUndo')"
      data-testid="editor-undo"
      @mousedown="session.editingId.value && $event.preventDefault()"
      @click="session.undo"
    >
      <AppIcon name="undo" :size="20" />
    </button>
    <button
      type="button"
      class="icon-button"
      :disabled="!session.canRedo.value"
      :aria-label="t('editorRedo')"
      data-testid="editor-redo"
      @mousedown="session.editingId.value && $event.preventDefault()"
      @click="session.redo"
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
