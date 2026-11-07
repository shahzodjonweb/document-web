<script setup lang="ts">
/** The rest of the editor, one tap in. */
const open = defineModel<boolean>({ required: true })

const { t } = useLocale()
const session = useEditorSession()
const telegram = useTelegramApp()
const snackbar = useEditorSnackbar()
const hints = useEditorHints()

const view = ref<'menu' | 'changes'>('menu')
telegram.useBackLayer(
  () => open.value && view.value === 'changes',
  () => (view.value = 'menu'),
)
watch(open, (value) => {
  if (!value) view.value = 'menu'
})

// Choosing a change means going to it: the sheet moves out of the way of its form.
watch(session.selection, (selection) => {
  const id = selection[0]
  if (!open.value || view.value !== 'changes' || !id) return
  open.value = false
})

const zoomPercent = computed(() => Math.round(session.zoom.value * 100))
function zoomBy(factor: number) {
  session.fitMode.value = 'custom'
  session.zoom.value = Math.min(4, Math.max(0.25, session.zoom.value * factor))
}

function showTips() {
  hints.showAgain()
  open.value = false
  snackbar.show({ message: t('editorTipsBack') })
}

function startOver() {
  const ids = session.commands.value.map((command) => command._id)
  if (!ids.length) return
  open.value = false
  if (!session.removeCommands(ids)) return
  // One step of history, so nothing is lost and no question needs asking first.
  snackbar.show({
    message: t('editorStartedOver'),
    actionLabel: t('editorUndo'),
    onAction: session.undo,
    step: session.steps.value,
  })
}
</script>

<template>
  <EditorSheet
    :open="open"
    size="tall"
    modal
    :title="view === 'changes' ? t('editorAllChanges') : t('editorMore')"
    testid="editor-more-sheet"
    @close="open = false"
  >
    <EditorCommandList v-if="view === 'changes'" />
    <div v-else class="editor-more-rows">
      <button
        type="button"
        class="editor-more-row"
        data-testid="editor-more-changes"
        @click="view = 'changes'"
      >
        <AppIcon name="reorder" :size="19" /><span>{{ t('editorAllChanges') }}</span
        ><span class="count-tag">{{ session.commands.value.length }}</span
        ><AppIcon name="chevron" :size="15" />
      </button>
      <div class="editor-more-row static" role="group" :aria-label="t('editorZoom')">
        <AppIcon name="zoomIn" :size="19" /><span>{{ t('editorZoom') }}</span>
        <button type="button" class="icon-button" :aria-label="t('editorZoomOut')" @click="zoomBy(1 / 1.25)">
          <AppIcon name="minus" :size="18" />
        </button>
        <button
          type="button"
          class="text-link editor-more-zoom"
          :aria-label="t('editorFitWidth')"
          data-testid="editor-more-fit"
          @click="session.fitMode.value = 'width'"
        >
          {{ zoomPercent }}%
        </button>
        <button type="button" class="icon-button" :aria-label="t('editorZoomIn')" @click="zoomBy(1.25)">
          <AppIcon name="plus" :size="18" />
        </button>
      </div>
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
        data-testid="editor-more-tips"
        :disabled="!hints.anyRetired.value"
        @click="showTips"
      >
        <AppIcon name="help" :size="19" /><span>{{ t('editorShowTips') }}</span>
      </button>
      <button
        type="button"
        class="editor-more-row"
        data-testid="editor-more-start-over"
        :disabled="!session.commands.value.length"
        @click="startOver"
      >
        <AppIcon name="rotateLeft" :size="19" /><span>{{ t('editorStartOver') }}</span>
      </button>
    </div>
  </EditorSheet>
</template>
