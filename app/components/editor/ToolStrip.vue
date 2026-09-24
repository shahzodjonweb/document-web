<script setup lang="ts">
/**
 * Tool selection, history and zoom.
 *
 * Tools the account's plan excludes stay visible and focusable with a lock
 * chip rather than being `disabled`, so the reason is discoverable. When the
 * catalog could not be read we assume everything is allowed and let the
 * server's 403 be the authority.
 */
import { CANVAS_TOOLS, COMMAND_FEATURE, COMMAND_SHAPE, type CommandType } from '~/composables/useEditorCommands'

const emit = defineEmits<{ togglePages: [] }>()

const { t, path } = useLocale()
const ws = useWorkspace()
const session = useEditorSession()

const lockedTool = ref<CommandType | ''>('')

const eligibility = computed(() => {
  const features = ws.features.value
  return (type: CommandType) => {
    if (!features.length) return true
    const feature = features.find((item) => item.id === COMMAND_FEATURE[type])
    return feature ? feature.eligible !== false : true
  }
})

function pick(type: CommandType) {
  if (!eligibility.value(type)) {
    lockedTool.value = lockedTool.value === type ? '' : type
    return
  }
  lockedTool.value = ''
  session.activeTool.value = session.activeTool.value === type ? 'select' : type
}

const zoomPercent = computed(() => Math.round(session.zoom.value * 100))
function zoomBy(factor: number) {
  session.fitMode.value = 'custom'
  session.zoom.value = Math.min(4, Math.max(0.25, session.zoom.value * factor))
}
</script>

<template>
  <div class="editor-toolstrip" role="toolbar" :aria-label="t('editorTools')">
    <div class="editor-toolstrip-scroll">
      <button
        type="button"
        class="editor-toolpill"
        :class="{ active: session.activeTool.value === 'select' }"
        :aria-pressed="session.activeTool.value === 'select'"
        data-testid="editor-tool-select"
        @click="session.activeTool.value = 'select'"
      >
        <AppIcon name="cursor" :size="17" />{{ t('editorToolSelect') }}
      </button>
      <button
        v-for="type in CANVAS_TOOLS"
        :key="type"
        type="button"
        class="editor-toolpill"
        :class="{ active: session.activeTool.value === type, locked: !eligibility(type) }"
        :aria-pressed="eligibility(type) ? session.activeTool.value === type : undefined"
        :data-locked="!eligibility(type) || undefined"
        :data-testid="`editor-tool-${type}`"
        @click="pick(type)"
      >
        <AppIcon :name="COMMAND_SHAPE[type].icon" :size="17" />{{ t(COMMAND_SHAPE[type].labelKey)
        }}<template v-if="!eligibility(type)"
          ><AppIcon name="lock" :size="13" /><span class="visually-hidden">{{ t('editorLocked') }}</span></template
        >
      </button>
    </div>

    <div class="editor-toolstrip-end">
      <button
        type="button"
        class="icon-button"
        :disabled="!session.canUndo.value"
        :aria-label="t('editorUndo')"
        @click="session.undo"
      >
        <AppIcon name="undo" :size="18" />
      </button>
      <button
        type="button"
        class="icon-button"
        :disabled="!session.canRedo.value"
        :aria-label="t('editorRedo')"
        @click="session.redo"
      >
        <AppIcon name="redo" :size="18" />
      </button>
      <span class="editor-zoom">
        <button type="button" class="icon-button" :aria-label="t('editorZoomOut')" @click="zoomBy(1 / 1.25)">
          <AppIcon name="zoomOut" :size="18" />
        </button>
        <button
          type="button"
          class="text-link"
          :aria-label="t('editorFitWidth')"
          @click="session.fitMode.value = 'width'"
        >
          {{ zoomPercent }}%
        </button>
        <button type="button" class="icon-button" :aria-label="t('editorZoomIn')" @click="zoomBy(1.25)">
          <AppIcon name="zoomIn" :size="18" />
        </button>
      </span>
      <button type="button" class="icon-button editor-pages-toggle" :aria-label="t('editorShowPages')" @click="emit('togglePages')">
        <AppIcon name="panelLeft" :size="18" />
      </button>
    </div>

    <p v-if="lockedTool" class="editor-lock" role="status">
      <AppIcon name="lock" :size="15" />
      <span>{{ t('editorLockedTool', { tool: t(COMMAND_SHAPE[lockedTool].labelKey) }) }}</span>
      <NuxtLink :to="path('/app/billing')" class="text-link">{{ t('editorSeePlans') }}</NuxtLink>
    </p>
    <p v-else-if="session.activeTool.value !== 'select'" class="editor-tool-hint" role="status">
      {{ session.activeTool.value === 'draw' ? t('editorDrawHint') : t('editorPlaceHint') }}
    </p>
  </div>
</template>
