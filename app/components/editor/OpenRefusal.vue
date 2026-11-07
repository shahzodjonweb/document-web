<script setup lang="ts">
/**
 * A file the new frame cannot open, said as a state with the way on, not as the
 * launcher: a password has an unlock, a signed file needs an unsigned copy.
 * The reason is the server's (`unsupported_file`'s `reason`); nothing is guessed.
 */
import type { Refusal } from '~/composables/useEditorSession'

const props = defineProps<{ refusal: Refusal }>()

const { t, path } = useLocale()

const state = computed(() => {
  const { code, params, message } = props.refusal
  if (code === 'unsupported_file') {
    switch (params.reason) {
      case 'password':
        return { icon: 'lock', text: t('editorPassword'), action: 'unlock' }
      case 'signed':
        return { icon: 'shield', text: t('editorSigned'), action: '' }
      case 'pptx_upload':
        return { icon: 'files', text: t('editorSlidesLater'), action: '' }
      default:
        return { icon: 'file', text: t('editorNotPdf'), action: '' }
    }
  }
  if (code === 'file_expired') return { icon: 'clock', text: t('editorExpired'), action: '' }
  return { icon: 'alert', text: message || t('genericError'), action: '' }
})
</script>

<template>
  <section
    class="editor-open-refusal"
    role="alert"
    data-testid="editor-refusal"
    :data-reason="refusal.params.reason || refusal.code"
  >
    <span class="result-symbol failed"><AppIcon :name="state.icon" :size="30" /></span>
    <p>{{ state.text }}</p>
    <NuxtLink
      v-if="state.action === 'unlock'"
      :to="path('/app/tools/pdf.unlock_known')"
      class="button primary"
      data-testid="editor-refusal-unlock"
      ><AppIcon name="unlock" :size="17" />{{ t('editorUnlock') }}</NuxtLink
    >
    <NuxtLink :to="path('/app/editor')" class="button secondary" data-testid="editor-refusal-back">{{
      t('editorOtherFile')
    }}</NuxtLink>
  </section>
</template>
