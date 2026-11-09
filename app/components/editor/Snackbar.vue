<script setup lang="ts">
const { t } = useLocale()
const session = useEditorSession()
const { snack, dismiss, act } = useEditorSnackbar()

watch(session.steps, (step) => {
  if (snack.value?.step !== undefined && snack.value.step !== step) dismiss()
})
</script>

<template>
  <!-- The live region stays mounted, or a screen reader may not announce what appears in it. -->
  <div class="editor-snackbar-region" role="status" aria-live="polite">
    <div v-if="snack" class="editor-snackbar" data-testid="editor-snackbar">
      <p>{{ snack.message }}</p>
      <button
        v-if="snack.actionLabel"
        type="button"
        class="text-link"
        data-testid="editor-snackbar-action"
        @mousedown="snack.keepFocus && $event.preventDefault()"
        @click="act"
      >
        {{ snack.actionLabel }}
      </button>
      <button
        type="button"
        class="icon-button"
        :aria-label="t('editorDismiss')"
        @mousedown="snack.keepFocus && $event.preventDefault()"
        @click="dismiss"
      >
        <AppIcon name="x" :size="16" />
      </button>
    </div>
  </div>
</template>
