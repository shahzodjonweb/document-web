<script setup lang="ts">
/**
 * The interaction surface for one page.
 *
 * Everything here converts between screen pixels and PDF points using the page
 * element's own rect, and every write is clamped to the bounds the export
 * engine enforces, so a mark that looks placed is a mark the server accepts.
 */
import type { ClientCommand, CommandType } from '~/composables/useEditorCommands'
import { COMMAND_SHAPE, LIMITS } from '~/composables/useEditorCommands'

const props = defineProps<{ page: number; pageWidth: number; pageHeight: number; zoom: number }>()

const { t } = useLocale()
const session = useEditorSession()
const geometry = useEditorGeometry()
const metrics = useEditorFontMetrics()

const layer = ref<HTMLElement>()
const editingId = ref('')
const textInput = ref<HTMLTextAreaElement>()
const announcement = ref('')

const size = computed(() => ({ width: props.pageWidth, height: props.pageHeight }))
const marks = computed(() => session.commands.value.filter((command) => command.page === props.page))
const placing = computed(() => session.activeTool.value !== 'select')

/** PDF points → percentage of the page, so overlays track any zoom for free. */
function style(command: ClientCommand) {
  const rect = geometry.commandRect(
    command,
    command.font_size ?? 16,
    metrics.stringWidth(longestLine(command.text ?? ''), command.font_size ?? 16),
    lineCount(command.text ?? ''),
  )
  if (!rect) return {}
  return {
    left: `${(100 * rect.x) / props.pageWidth}%`,
    top: `${(100 * rect.y) / props.pageHeight}%`,
    width: `${(100 * Math.max(rect.width, 2)) / props.pageWidth}%`,
    height: `${(100 * Math.max(rect.height, 2)) / props.pageHeight}%`,
  }
}

function longestLine(text: string) {
  return text.split('\n').reduce((longest, line) => (line.length > longest.length ? line : longest), '')
}
function lineCount(text: string) {
  return Math.max(1, text.split('\n').length)
}

function markLabel(command: ClientCommand) {
  const name = t(COMMAND_SHAPE[command.type].labelKey)
  return `${name}, ${t('editorPageLabel', { page: command.page ?? 1, count: props.page })}`
}

function pointFor(event: PointerEvent | MouseEvent) {
  const element = layer.value
  if (!element) return { x: 0, y: 0 }
  return geometry.pointFromEvent(event, element.getBoundingClientRect(), size.value)
}

/* ---------------------------------------------------------------- placing */

// A pointerdown that places a mark is followed by a click on the layer. That
// click must not clear the selection we just made.
let justPlaced = false

function onLayerPointerDown(event: PointerEvent) {
  if (!placing.value || event.button !== 0) return
  const tool = session.activeTool.value as CommandType
  const at = pointFor(event)
  if (tool === 'draw') return startStroke(event, at)
  event.preventDefault()
  const command = session.addCommand(tool, { page: props.page, x: at.x, y: at.y })
  // Redaction stays armed: you almost always draw several boxes in a row.
  if (tool !== 'redact') session.activeTool.value = 'select'
  justPlaced = true
  if (command && (command.type === 'add_text' || command.type === 'note')) {
    editingId.value = command._id
    void nextTick(() => textInput.value?.focus())
  }
}

function onLayerClick(event: MouseEvent) {
  if (justPlaced) {
    justPlaced = false
    return
  }
  if (event.target === layer.value && !placing.value) session.select(null)
}

/* ------------------------------------------------------------------ drawing */

let stroke: [number, number][] = []
let strokeId = ''

function startStroke(event: PointerEvent, at: { x: number; y: number }) {
  event.preventDefault()
  layer.value?.setPointerCapture(event.pointerId)
  stroke = [[at.x, at.y]]
  const command = session.addCommand('draw', { page: props.page })
  strokeId = command?._id ?? ''
}

function extendStroke(event: PointerEvent) {
  if (!strokeId) return
  const at = pointFor(event)
  const last = stroke[stroke.length - 1]
  // Thin out the trail: the engine accepts at most 200 points per line.
  if (last && Math.hypot(at.x - last[0], at.y - last[1]) < 1.5) return
  if (stroke.length >= LIMITS.points.max) {
    session.notice.value = t('editorDrawPointLimit')
    return finishStroke(event)
  }
  stroke = [...stroke, [at.x, at.y]]
  session.patchCommand(strokeId, { points: stroke }, 'draw')
}

function finishStroke(event: PointerEvent) {
  if (!strokeId) return
  layer.value?.releasePointerCapture?.(event.pointerId)
  // A tap is not a line; drop anything the server would reject.
  if (stroke.length < LIMITS.points.min) session.removeCommands([strokeId])
  strokeId = ''
  stroke = []
}

/* --------------------------------------------------------- drag and resize */

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
let drag: {
  id: string
  handle: Handle | null
  startX: number
  startY: number
  origin: ClientCommand
  moved: boolean
} | null = null

function beginDrag(event: PointerEvent, command: ClientCommand, handle: Handle | null) {
  if (event.button !== 0 || editingId.value === command._id) return
  event.preventDefault()
  event.stopPropagation()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  const at = pointFor(event)
  drag = { id: command._id, handle, startX: at.x, startY: at.y, origin: { ...command }, moved: false }
  if (!session.selection.value.includes(command._id)) session.select(command._id, event.shiftKey)
}

function onPointerMove(event: PointerEvent) {
  if (strokeId) return extendStroke(event)
  if (!drag) return
  const at = pointFor(event)
  const dx = at.x - drag.startX
  const dy = at.y - drag.startY
  if (!drag.moved && Math.hypot(dx, dy) * props.zoom < 3) return
  drag.moved = true
  const origin = drag.origin
  if (!drag.handle) {
    session.patchCommand(drag.id, { x: (origin.x ?? 0) + dx, y: (origin.y ?? 0) + dy }, 'move')
    return
  }
  const patch: Partial<ClientCommand> = {}
  const handle = drag.handle
  if (handle.includes('w')) {
    patch.x = (origin.x ?? 0) + dx
    patch.width = (origin.width ?? 0) - dx
  }
  if (handle.includes('e')) patch.width = (origin.width ?? 0) + dx
  if (handle.includes('n')) {
    patch.y = (origin.y ?? 0) + dy
    patch.height = (origin.height ?? 0) - dy
  }
  if (handle.includes('s')) patch.height = (origin.height ?? 0) + dy
  if ((patch.width ?? 1) < LIMITS.minSize) patch.width = LIMITS.minSize
  if ((patch.height ?? 1) < LIMITS.minSize) patch.height = LIMITS.minSize
  session.patchCommand(drag.id, patch, 'resize', 'resize')
}

function onPointerUp(event: PointerEvent) {
  if (strokeId) return finishStroke(event)
  if (!drag) return
  const command = session.commands.value.find((item) => item._id === drag?.id)
  if (command && drag.moved) {
    announcement.value = drag.handle
      ? t('editorResizedTo', { width: Math.round(command.width ?? 0), height: Math.round(command.height ?? 0) })
      : t('editorMovedTo', { x: Math.round(command.x ?? 0), y: Math.round(command.y ?? 0) })
  }
  drag = null
}

/* ------------------------------------------------------------ inline text */

const editingCommand = computed(() => marks.value.find((command) => command._id === editingId.value) ?? null)

const overflow = computed(() => {
  const command = editingCommand.value
  if (!command || command.type !== 'add_text') return null
  const result = metrics.textOverflow(
    command.text ?? '',
    command.font_size ?? 16,
    command.x ?? 0,
    command.y ?? 0,
    props.pageWidth,
    props.pageHeight,
  )
  return result.horizontal || result.vertical ? result : null
})

function onTextInput(event: Event) {
  const command = editingCommand.value
  if (!command) return
  const raw = (event.target as HTMLTextAreaElement).value
  // Match the server: control characters other than newline and tab are refused.
  let clean = ''
  for (const character of raw) {
    const code = character.codePointAt(0) ?? 0
    if (code >= 32 || character === '\n' || character === '\t') clean += character
  }
  const capped = [...clean].slice(0, LIMITS.text).join('')
  session.patchCommand(command._id, { text: capped }, `text:${command._id}`)
}

function stopEditing() {
  const command = editingCommand.value
  // An untouched text mark would be rejected by the server; drop it instead.
  if (command && !(command.text ?? '').trim()) session.removeCommands([command._id])
  editingId.value = ''
}

function onMarkKeydown(event: KeyboardEvent, command: ClientCommand) {
  const step = event.shiftKey ? 10 : event.altKey ? 0.25 : 1
  const moves: Record<string, [number, number]> = {
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
  }
  const move = moves[event.key]
  if (move) {
    event.preventDefault()
    session.patchCommand(command._id, { x: (command.x ?? 0) + move[0], y: (command.y ?? 0) + move[1] }, 'nudge')
    const fresh = session.commands.value.find((item) => item._id === command._id)
    announcement.value = t('editorMovedTo', { x: Math.round(fresh?.x ?? 0), y: Math.round(fresh?.y ?? 0) })
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    session.removeCommands([command._id])
  } else if (event.key === 'Enter' && (command.type === 'add_text' || command.type === 'note')) {
    event.preventDefault()
    editingId.value = command._id
    void nextTick(() => textInput.value?.focus())
  } else if (event.key === 'Escape') session.select(null)
}

function polyline(command: ClientCommand) {
  return (command.points ?? []).map(([x, y]) => `${(100 * x) / props.pageWidth},${(100 * y) / props.pageHeight}`).join(' ')
}

defineExpose({ stopEditing })
</script>

<template>
  <div
    ref="layer"
    class="editor-layer"
    :class="{ placing }"
    @pointerdown="onLayerPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click="onLayerClick"
  >
    <template v-for="command in marks" :key="command._id">
      <!-- Freehand lines are an SVG overlay; everything else is a box. -->
      <svg v-if="command.type === 'draw'" class="editor-mark draw" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          :points="polyline(command)"
          fill="none"
          :stroke="command.color || '#17212E'"
          :stroke-width="((command.stroke_width ?? 2) / pageWidth) * 100"
          vector-effect="non-scaling-stroke"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <button
        v-else
        type="button"
        class="editor-mark"
        :class="[
          command.type,
          {
            selected: session.selection.value.includes(command._id),
            editing: editingId === command._id,
          },
        ]"
        :style="[
          style(command),
          command.type === 'highlight' ? { background: command.color } : {},
          command.type === 'add_text' ? { color: command.color } : {},
        ]"
        :aria-label="markLabel(command)"
        :aria-pressed="session.selection.value.includes(command._id)"
        :data-testid="`editor-mark-${command._id}`"
        @pointerdown="beginDrag($event, command, null)"
        @keydown="onMarkKeydown($event, command)"
        @dblclick="
          command.type === 'add_text' || command.type === 'note'
            ? ((editingId = command._id), nextTick(() => textInput?.focus()))
            : undefined
        "
      >
        <span
          v-if="command.type === 'add_text'"
          class="editor-mark-text"
          :style="{ fontSize: `${((command.font_size ?? 16) / pageWidth) * 100}cqw` }"
          >{{ command.text }}</span
        >
        <AppIcon v-else-if="command.type === 'note'" name="sticky" :size="14" />
        <AppIcon v-else-if="command.type === 'signature'" name="signature" :size="18" />
        <AppIcon v-else-if="command.type === 'insert_image'" name="image" :size="18" />
      </button>

      <!-- Resize handles live outside the button so they are not nested controls. -->
      <template v-if="session.selection.value.includes(command._id) && COMMAND_SHAPE[command.type].box">
        <span
          v-for="handle in ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']"
          :key="handle"
          class="editor-handle"
          :class="handle"
          :style="style(command)"
          :data-handle="handle"
          @pointerdown="beginDrag($event, command, handle as any)"
        />
      </template>
    </template>

    <textarea
      v-if="editingCommand"
      ref="textInput"
      class="editor-text-input"
      :class="{ overflowing: overflow }"
      :style="[
        style(editingCommand),
        {
          fontSize: `${((editingCommand.font_size ?? 16) / pageWidth) * 100}cqw`,
          color: editingCommand.color || 'inherit',
        },
      ]"
      :value="editingCommand.text"
      :placeholder="t('editorTextPlaceholder')"
      :aria-label="t('text')"
      data-testid="editor-text-input"
      spellcheck="false"
      autocapitalize="off"
      @input="onTextInput"
      @keydown.escape.prevent="stopEditing"
      @blur="stopEditing"
    />

    <p v-if="overflow" class="editor-overflow-hint" role="status">{{ t('editorTextOverflow') }}</p>
    <span class="visually-hidden" aria-live="polite">{{ announcement }}</span>
  </div>
</template>
