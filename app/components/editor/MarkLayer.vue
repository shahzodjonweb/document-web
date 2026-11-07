<script setup lang="ts">
/**
 * The interaction surface for one page.
 *
 * Everything here converts between screen pixels and PDF points using the page
 * element's own rect, and every write is clamped to the bounds the export
 * engine enforces, so a mark that looks placed is a mark the server accepts.
 */
import type { ClientCommand, CommandType } from '~/composables/useEditorCommands'
import { COMMAND_SHAPE, LIMITS, moveBy } from '~/composables/useEditorCommands'
import type { Hit } from '~/composables/useEditorGeometry'

// `turn` is what the page will gain in the file, which the stage shows: marks stay put on the paper.
const props = withDefaults(
  defineProps<{ page: number; pageWidth: number; pageHeight: number; zoom: number; turn?: number }>(),
  { turn: 0 },
)

const { t } = useLocale()
const session = useEditorSession()
const geometry = useEditorGeometry()
const metrics = useEditorFontMetrics()
const telegram = useTelegramApp()
const editorV2 = useEditorV2()
const tools = useEditorTools()
const images = useEditorImages()

const layer = ref<HTMLElement>()
const editingId = session.editingId
const textInput = ref<HTMLTextAreaElement>()
const announcement = ref('')

const size = computed(() => ({ width: props.pageWidth, height: props.pageHeight }))
// Under the switch a draft also holds its pages' own changes, which are no mark on the paper.
const marks = computed(() =>
  session.commands.value.filter(
    (command) =>
      command.page === props.page &&
      (!editorV2.value || COMMAND_SHAPE[command.type].positional || command.type === 'draw'),
  ),
)
const placing = computed(() => (editorV2.value ? !!tools.armed.value : session.activeTool.value !== 'select'))
/** Under the switch a finger drawing must not scroll the page; everywhere else on it, it must. */
const drawing = computed(() => editorV2.value && tools.armed.value?.kind === 'draw')
/** Below Bot API 7.7 a drag would pull Telegram down with it, so marks move by buttons there. */
const canDrag = computed(() => !editorV2.value || telegram.canDragMarks.value)

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

/** PDF points are for the engine; a person is told a position in millimetres. */
const millimetres = (value = 0) => Math.round((value * 25.4) / 72)

function longestLine(text: string) {
  return text.split('\n').reduce((longest, line) => (line.length > longest.length ? line : longest), '')
}
function lineCount(text: string) {
  return Math.max(1, text.split('\n').length)
}

function rectOf(command: ClientCommand) {
  return geometry.commandRect(
    command,
    command.font_size ?? 16,
    metrics.stringWidth(longestLine(command.text ?? ''), command.font_size ?? 16),
    lineCount(command.text ?? ''),
  )
}

function markLabel(command: ClientCommand) {
  const name = t(COMMAND_SHAPE[command.type].labelKey)
  return `${name}, ${t('editorPageLabel', { page: command.page ?? 1, count: props.page })}`
}

function pointFor(event: PointerEvent | MouseEvent) {
  const element = layer.value
  if (!element) return { x: 0, y: 0 }
  return geometry.pointFromEvent(event, element.getBoundingClientRect(), size.value, props.turn)
}

/* ---------------------------------------------------------------- swipes */

// A finger dragging a mark down must not drag the whole app down with it.
let releaseSwipes: (() => void) | null = null
function holdSwipes() {
  if (editorV2.value) releaseSwipes = telegram.holdSwipes()
}
function letGoOfSwipes() {
  releaseSwipes?.()
  releaseSwipes = null
}
onBeforeUnmount(letGoOfSwipes)

/* ---------------------------------------------------------------- placing */

// A pointerdown that places a mark is followed by a click on the layer. That
// click must not clear the selection we just made.
let justPlaced = false

function onLayerPointerDown(event: PointerEvent) {
  if (editorV2.value) return pressDown(event)
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
  if (editorV2.value) return
  if (justPlaced) {
    justPlaced = false
    return
  }
  if (event.target === layer.value && !placing.value) session.select(null)
}

/* ------------------------------------------------- taps, under the switch */

// A tap is a finger lifted within 10 px and 350 ms of where it went down: anything
// else was the page being scrolled or zoomed, and places nothing.
const TAP_DISTANCE = 10
const TAP_TIME = 350
const LONG_PRESS = 500

let press: {
  pointer: number
  x: number
  y: number
  at: number
  timer: number | null
  spent: boolean
} | null = null

function startPress(event: PointerEvent) {
  if (press?.timer != null) clearTimeout(press.timer)
  press = {
    pointer: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    at: event.timeStamp,
    timer: null,
    spent: false,
  }
  press.timer = window.setTimeout(longPress, LONG_PRESS)
}
function endPress() {
  if (press?.timer != null) clearTimeout(press.timer)
  press = null
}

function pressDown(event: PointerEvent) {
  if (event.button !== 0) return
  if (drawing.value) return startStroke(event, pointFor(event))
  startPress(event)
}

/** The marks under a point, as a tap reads them; at least a fingertip wide however small they look. */
function hitsAt(at: { x: number; y: number }) {
  const candidates: Hit[] = []
  // Newest on top: the engine draws the marks in order. Lines of text and the file's
  // own pictures join with the text layer, where `hitOrder` already ranks them.
  for (const command of [...marks.value].reverse()) {
    const rect = rectOf(command)
    if (rect && command._id !== editingId.value) candidates.push({ id: command._id, kind: 'mark', rect })
  }
  return geometry.hitOrder(candidates, at, size.value, 44 / (props.zoom || 1))
}

/**
 * A long press goes down through what is stacked under the finger, one each time.
 * Over a single mark it is nothing, so a finger that rests before dragging still drags.
 */
function longPress() {
  if (!press || drag?.moved) return
  press.timer = null
  const hits = hitsAt(pointFor({ clientX: press.x, clientY: press.y } as PointerEvent))
  if (hits.length < 2) return
  press.spent = true
  if (drag) {
    drag = null
    letGoOfSwipes()
  }
  const current = hits.findIndex((hit) => session.selection.value.includes(hit.id))
  session.select(hits[(current + 1) % hits.length]!.id)
  telegram.haptic('selection')
}

function pressUp(event: PointerEvent) {
  const was = press
  endPress()
  if (!was || was.spent || was.pointer !== event.pointerId) return
  if (Math.hypot(event.clientX - was.x, event.clientY - was.y) > TAP_DISTANCE) return
  if (event.timeStamp - was.at > TAP_TIME) return
  tap(pointFor(event))
}

/**
 * Own mark first; with something armed, the page takes it, except that a black box
 * tapped in Black out is chosen rather than covered by another. With a sheet open,
 * paper only closes it. Bare paper opens Add here at that spot.
 */
function tap(at: { x: number; y: number }) {
  const armed = tools.armed.value
  const hits = hitsAt(at)
  if (armed && !(armed.kind === 'redact' && hits.length)) {
    if (armed.kind === 'draw') return
    tools.place(armed, { page: props.page, ...at })
    if (armed.kind !== 'redact') tools.disarm()
    return
  }
  if (hits.length) return session.select(hits[0]!.id)
  if (session.selection.value.length || (tools.sheet.value && tools.sheet.value !== 'blackout')) {
    session.select(null)
    tools.closeSheet()
    return
  }
  if (armed) return
  tools.openSheet('add', { page: props.page, ...at })
}

function onMarkPointerDown(event: PointerEvent, command: ClientCommand) {
  if (!editorV2.value) return beginDrag(event, command, null)
  // Only the chosen mark drags: anything else under a finger is the page, to scroll.
  if (!canDrag.value || !session.selection.value.includes(command._id) || editingId.value === command._id)
    return
  beginDrag(event, command, null)
  startPress(event)
}

/** A keyboard's Enter or Space on a mark; a finger's tap is the layer's to read. */
function onMarkClick(event: MouseEvent, command: ClientCommand) {
  if (editorV2.value && event.detail === 0) session.select(command._id)
}

function openText(command: ClientCommand) {
  if (command.type !== 'add_text' && command.type !== 'note') return
  if (editorV2.value) return tools.openField(command._id)
  editingId.value = command._id
  void nextTick(() => textInput.value?.focus())
}

const selectedHere = computed(() =>
  editorV2.value && canDrag.value && session.selection.value.length === 1
    ? (marks.value.find(
        (command) => command._id === session.selection.value[0] && command._id !== editingId.value,
      ) ?? null)
    : null,
)
/**
 * The grip goes to the mark's left; at the page's left edge, to its right when the
 * corner handle leaves room there, else under it.
 */
const gripSide = computed(() => {
  const command = selectedHere.value
  const rect = command ? rectOf(command) : null
  if (!command || !rect || rect.x * props.zoom >= 56) return 'left'
  const right = (props.pageWidth - rect.x - rect.width) * props.zoom >= 56
  return right && (!COMMAND_SHAPE[command.type].box || rect.height * props.zoom >= 100) ? 'right' : 'below'
})

/** What a picture mark shows: the phone's copy while it uploads, then the server's. */
function pictureUrl(command: ClientCommand) {
  const waiting = tools.waiting.get(command._id)
  if (waiting) return waiting
  const asset = session.assets.value[(command.input_index ?? 0) - 1]
  return images.urlFor(asset?.id)
}
watch(
  () => (editorV2.value ? session.assets.value.map((asset) => asset.id) : []),
  (ids) => ids.forEach((id) => void images.load(id)),
  { immediate: true },
)

const pinStyle = computed(() => {
  const pin = tools.pin.value
  if (!editorV2.value || !pin || pin.page !== props.page) return null
  return { left: `${(100 * pin.x) / props.pageWidth}%`, top: `${(100 * pin.y) / props.pageHeight}%` }
})

/* ------------------------------------------------------------------ drawing */

let stroke: [number, number][] = []
let strokeId = ''

function startStroke(event: PointerEvent, at: { x: number; y: number }) {
  event.preventDefault()
  layer.value?.setPointerCapture(event.pointerId)
  holdSwipes()
  stroke = [[at.x, at.y]]
  const command = session.addCommand('draw', { page: props.page })
  strokeId = command?._id ?? ''
  // Under the switch a chosen mark opens its form, which would lift the page mid-line.
  if (editorV2.value) session.select(null)
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
  letGoOfSwipes()
  layer.value?.releasePointerCapture?.(event.pointerId)
  // A tap is not a line; drop anything the server would reject.
  if (stroke.length < LIMITS.points.min) session.removeCommands([strokeId], { amend: true })
  // The next line is drawn, not a form opened for this one.
  else if (editorV2.value) session.select(null)
  strokeId = ''
  stroke = []
}

/* --------------------------------------------------------- drag and resize */

// `scale` is the new frame's one corner: it keeps a picture's proportions and fits a box to the words.
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'scale'
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
  holdSwipes()
  if (!session.selection.value.includes(command._id)) session.select(command._id, event.shiftKey)
}

function onPointerMove(event: PointerEvent) {
  if (
    press &&
    Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_DISTANCE &&
    press.timer != null
  ) {
    clearTimeout(press.timer)
    press.timer = null
  }
  if (strokeId) return extendStroke(event)
  if (!drag) return
  const at = pointFor(event)
  const dx = at.x - drag.startX
  const dy = at.y - drag.startY
  if (!drag.moved && Math.hypot(dx, dy) * props.zoom < 3) return
  drag.moved = true
  if (press) press.spent = true
  const origin = drag.origin
  if (!drag.handle && origin.points) {
    session.patchCommand(drag.id, moveBy(origin, dx, dy, size.value), 'move', 'move', { amend: false })
    return
  }
  if (!drag.handle) {
    session.patchCommand(drag.id, { x: (origin.x ?? 0) + dx, y: (origin.y ?? 0) + dy }, 'move')
    return
  }
  if (drag.handle === 'scale') {
    // A black box or a highlight goes over a line of words, which no ratio fits.
    if (!COMMAND_SHAPE[origin.type].image) {
      const width = Math.max(LIMITS.minSize, (origin.width ?? 0) + dx)
      const height = Math.max(LIMITS.minSize, (origin.height ?? 0) + dy)
      session.patchCommand(drag.id, { width, height }, 'resize', 'resize')
      return
    }
    const width = Math.max(8, (origin.width ?? 0) + dx)
    const ratio = (origin.height ?? 1) / (origin.width || 1)
    session.patchCommand(drag.id, { width, height: width * ratio }, 'resize', 'resize')
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

/** The browser took the finger for a scroll or a zoom: nothing was tapped. */
function onPointerCancel(event: PointerEvent) {
  endPress()
  if (strokeId || drag) onPointerUp(event)
}

function onPointerUp(event: PointerEvent) {
  if (strokeId) return finishStroke(event)
  if (!drag) {
    if (editorV2.value) pressUp(event)
    return
  }
  endPress()
  letGoOfSwipes()
  const command = session.commands.value.find((item) => item._id === drag?.id)
  if (command && drag.moved) {
    announcement.value = drag.handle
      ? t('editorResizedTo', { width: millimetres(command.width), height: millimetres(command.height) })
      : t('editorMovedTo', { x: millimetres(command.x), y: millimetres(command.y) })
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
  if (command && !(command.text ?? '').trim()) session.removeCommands([command._id], { amend: true })
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
  const key = moves[event.key]
  if (key) {
    event.preventDefault()
    const move = geometry.unturn(key[0], key[1], props.turn)
    session.patchCommand(command._id, { x: (command.x ?? 0) + move[0], y: (command.y ?? 0) + move[1] }, 'nudge')
    const fresh = session.commands.value.find((item) => item._id === command._id)
    announcement.value = t('editorMovedTo', { x: millimetres(fresh?.x), y: millimetres(fresh?.y) })
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    session.removeCommands([command._id])
  } else if (event.key === 'Enter' && (command.type === 'add_text' || command.type === 'note')) {
    event.preventDefault()
    openText(command)
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
    :class="{ placing, drawing, still: !canDrag }"
    @pointerdown="onLayerPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @click="onLayerClick"
    @contextmenu="editorV2 && $event.preventDefault()"
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
      <!-- Under the switch a line has a box of its own too, so it can be chosen and moved like the rest. -->
      <button
        v-if="command.type !== 'draw' || editorV2"
        type="button"
        class="editor-mark"
        :class="[
          command.type === 'draw' ? 'stroke' : command.type,
          {
            selected: session.selection.value.includes(command._id),
            editing: editingId === command._id,
            pending: command.type === 'redact' && editorV2,
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
        @pointerdown="onMarkPointerDown($event, command)"
        @click="onMarkClick($event, command)"
        @keydown="onMarkKeydown($event, command)"
        @dblclick="openText(command)"
      >
        <span
          v-if="command.type === 'add_text'"
          class="editor-mark-text"
          :style="{ fontSize: `${((command.font_size ?? 16) / pageWidth) * 100}cqw` }"
          >{{ command.text }}</span
        >
        <AppIcon v-else-if="command.type === 'note'" name="sticky" :size="14" />
        <img
          v-else-if="editorV2 && COMMAND_SHAPE[command.type].image && pictureUrl(command)"
          class="editor-mark-picture"
          :src="pictureUrl(command)"
          alt=""
          draggable="false"
        />
        <AppIcon v-else-if="command.type === 'signature'" name="signature" :size="18" />
        <AppIcon v-else-if="command.type === 'insert_image'" name="image" :size="18" />
      </button>

      <!-- Resize handles live outside the button so they are not nested controls. -->
      <template
        v-if="!editorV2 && session.selection.value.includes(command._id) && COMMAND_SHAPE[command.type].box"
      >
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

    <!--
      The new frame's way to move and size: a 44 px grip beside the chosen mark and one
      corner, which keeps a picture's proportions and sizes a box's sides apart. Both are
      shortcuts; the form has a button for each.
    -->
    <div v-if="selectedHere" class="editor-selection" :class="gripSide" :style="style(selectedHere)">
      <span class="editor-grip" data-testid="editor-grip" @pointerdown="beginDrag($event, selectedHere, null)"
        ><AppIcon name="grip" :size="18"
      /></span>
      <span
        v-if="COMMAND_SHAPE[selectedHere.type].box"
        class="editor-scale"
        data-testid="editor-scale"
        @pointerdown="beginDrag($event, selectedHere, 'scale')"
      />
    </div>
    <span v-if="pinStyle" class="editor-pin" :style="pinStyle" aria-hidden="true" data-testid="editor-pin" />

    <textarea
      v-if="editingCommand && !editorV2"
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

    <p v-if="overflow && !editorV2" class="editor-overflow-hint" role="status">
      {{ t('editorTextOverflow') }}
    </p>
    <span class="visually-hidden" aria-live="polite">{{ announcement }}</span>
  </div>
</template>
