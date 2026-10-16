<script setup lang="ts">
/**
 * Tool selection, history and zoom.
 *
 * Every plan has every tool, so a tool the catalog marks ineligible is one
 * switched off for everyone. It stays visible and focusable with a lock chip
 * rather than being `disabled`, so the reason is discoverable, and no plan is
 * offered because none would unlock it. When the catalog could not be read we
 * assume everything is allowed and let the server's 403 be the authority.
 */
import { CANVAS_TOOLS, COMMAND_FEATURE, COMMAND_SHAPE, type CommandType } from '~/composables/useEditorCommands'
import type { EditorMode } from '~/composables/useEditorSession'

const emit = defineEmits<{ togglePages: [] }>()

const { t } = useLocale()
const ws = useWorkspace()
const session = useEditorSession()

const lockedTool = ref<CommandType | ''>('')
const modeBlocked = ref('')
const shortcuts = ref(false)

/** Absent catalog means unknown, not forbidden — let the server's 403 rule. */
function allows(feature: string) {
  const features = ws.features.value
  if (!features.length) return true
  const match = features.find((item) => item.id === feature)
  return match ? match.eligible !== false : true
}

const eligibility = computed(() => {
  // Recompute when the catalog arrives.
  void ws.features.value
  return (type: CommandType) => allows(COMMAND_FEATURE[type])
})

const canRedact = computed(() => allows('editor.redact'))

const MODES: { id: EditorMode; labelKey: string; icon: string }[] = [
  { id: 'edit', labelKey: 'editorModeEdit', icon: 'edit' },
  { id: 'pages', labelKey: 'editorModePages', icon: 'pages' },
  { id: 'redact', labelKey: 'editorModeRedact', icon: 'redact' },
]

function switchMode(next: EditorMode) {
  modeBlocked.value = ''
  if (next === session.mode.value) return
  const commands = session.commands.value
  if (next === 'redact') {
    if (!canRedact.value) {
      modeBlocked.value = t('editorLockedTool', { tool: t('editorModeRedact') })
      return
    }
    // A draft mixing redaction with anything else cannot even be saved.
    if (commands.some((command) => command.type !== 'redact')) {
      modeBlocked.value = t('editorRedactExclusive')
      return
    }
  }
  if (next !== 'redact' && commands.some((command) => command.type === 'redact')) {
    modeBlocked.value = t('editorRedactExclusive')
    return
  }
  session.mode.value = next
  session.activeTool.value = next === 'redact' ? 'redact' : 'select'
}

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
    <div class="editor-modes" role="group" :aria-label="t('editorTools')">
      <button
        v-for="item in MODES"
        :key="item.id"
        type="button"
        class="editor-modepill"
        :class="{ active: session.mode.value === item.id }"
        :aria-pressed="session.mode.value === item.id"
        :data-locked="item.id === 'redact' && !canRedact ? true : undefined"
        :data-testid="`editor-mode-${item.id}`"
        @click="switchMode(item.id)"
      >
        <AppIcon :name="item.icon" :size="16" />{{ t(item.labelKey)
        }}<template v-if="item.id === 'redact' && !canRedact"
          ><AppIcon name="lock" :size="12" /><span class="visually-hidden">{{ t('editorLocked') }}</span></template
        >
      </button>
    </div>

    <div v-if="session.mode.value === 'edit'" class="editor-toolstrip-scroll">
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
      <button
        type="button"
        class="icon-button"
        :aria-label="t('editorKeyboardHelp')"
        data-testid="editor-shortcuts-open"
        @click="shortcuts = true"
      >
        <AppIcon name="help" :size="18" />
      </button>
    </div>

    <p v-if="lockedTool" class="editor-lock" role="status">
      <AppIcon name="lock" :size="15" />
      <span>{{ t('editorLockedTool', { tool: t(COMMAND_SHAPE[lockedTool].labelKey) }) }}</span>
    </p>
    <p v-else-if="modeBlocked" class="editor-lock" role="status" data-testid="editor-mode-blocked">
      <AppIcon name="lock" :size="15" />
      <span>{{ modeBlocked }}</span>
    </p>
    <p v-else-if="session.mode.value === 'redact'" class="editor-tool-hint" role="status">
      {{ t('editorRedactIntro') }}
    </p>
    <p v-else-if="session.activeTool.value !== 'select'" class="editor-tool-hint" role="status">
      {{ session.activeTool.value === 'draw' ? t('editorDrawHint') : t('editorPlaceHint') }}
    </p>

    <EditorShortcutSheet v-model="shortcuts" />
  </div>
</template>
