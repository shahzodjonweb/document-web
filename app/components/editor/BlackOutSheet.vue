<script setup lang="ts">
/**
 * Black out, as this release has it: a box drawn where a tap lands, fitted by its
 * corner or the form, hatched until the file is made. Each page with a box becomes
 * a picture in the new file; Review asks for "I understand" before that happens.
 * Finding words and numbers to black out comes with the text layer.
 */
const { t, count } = useLocale()
const session = useEditorSession()
const tools = useEditorTools()
const hints = useEditorHints()
const pageOrder = useEditorPageOrder()

const boxes = computed(() => session.commands.value.filter((command) => command.type === 'redact'))
/** By their place in the file being made, as the page chip and Pages name them. */
const pages = computed(() =>
  [
    ...new Set(boxes.value.map((command) => pageOrder.positionOf(command.page ?? 1) || (command.page ?? 1))),
  ].sort((a, b) => a - b),
)
</script>

<template>
  <div class="editor-blackout" data-testid="editor-blackout">
    <p class="field-hint">
      {{ t(hints.showing('blackout') ? 'editorHintBlackOut' : 'editorBlackOutAgain') }}
    </p>
    <p v-if="boxes.length" class="editor-blackout-count" role="status" data-testid="editor-blackout-count">
      {{ count('editorBlackOutBoxes', boxes.length) }} ·
      {{
        pages.length > 1
          ? t('editorBlackOutPages', { pages: pages.join(', ') })
          : t('editorBlackOutPage', { page: pages[0]! })
      }}
    </p>
    <p class="field-hint">{{ t('editorBlackOutPictures') }}</p>
    <button
      type="button"
      class="button secondary small"
      data-testid="editor-blackout-done"
      @click="tools.stopBlackOut"
    >
      {{ t('editorDone') }}
    </button>
  </div>
</template>
