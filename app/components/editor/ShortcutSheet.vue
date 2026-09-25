<script setup lang="ts">
/** The keyboard map, written down. Every canvas action has a key here. */
const open = defineModel<boolean>({ default: false })
const { t } = useLocale()

const dialog = ref<HTMLDialogElement>()

watch(open, (value) => {
  if (value) dialog.value?.showModal()
  else dialog.value?.close()
})

const GROUPS = [
  {
    titleKey: 'editorShortcutsCanvas',
    rows: [
      ['↑ ↓ ← →', 'editorShortcutNudge'],
      ['Shift + ↑ ↓ ← →', 'editorShortcutNudgeFar'],
      ['Enter', 'editorShortcutEdit'],
      ['Delete', 'editorShortcutDelete'],
      ['Esc', 'editorShortcutEscape'],
      ['Tab', 'editorShortcutNext'],
    ],
  },
  {
    titleKey: 'editorShortcutsDocument',
    rows: [
      ['Ctrl / ⌘ + Z', 'editorUndo'],
      ['Ctrl / ⌘ + Shift + Z', 'editorRedo'],
      ['Ctrl / ⌘ + S', 'editorSaveNow'],
      ['+  /  −', 'editorShortcutZoom'],
      ['0', 'editorFitWidth'],
    ],
  },
] as const
</script>

<template>
  <dialog
    ref="dialog"
    class="editor-shortcuts"
    aria-labelledby="editor-shortcuts-title"
    data-testid="editor-shortcuts"
    @close="open = false"
  >
    <div class="editor-shortcuts-head">
      <h2 id="editor-shortcuts-title">{{ t('editorKeyboardHelp') }}</h2>
      <button type="button" class="icon-button" :aria-label="t('editorCloseHelp')" @click="open = false">
        <AppIcon name="x" :size="18" />
      </button>
    </div>
    <section v-for="group in GROUPS" :key="group.titleKey">
      <h3>{{ t(group.titleKey) }}</h3>
      <dl>
        <template v-for="[keys, labelKey] in group.rows" :key="keys">
          <dt><kbd>{{ keys }}</kbd></dt>
          <dd>{{ t(labelKey) }}</dd>
        </template>
      </dl>
    </section>
  </dialog>
</template>
