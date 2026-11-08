<script setup lang="ts">
/**
 * Properties for the current selection.
 *
 * The numeric X/Y/W/H fields are the keyboard-and-screen-reader equivalent of
 * dragging, so every canvas gesture has a non-pointer path.
 *
 * Under `editor_v2` this is the object form instead: labelled 44 px buttons for size,
 * moving, turning, layering and replacing, with the exact position in millimetres
 * folded away. The page stays in sight and tappable above it.
 */
import { COLOR_PATTERN, COMMAND_SHAPE, LIMITS, moveBy, sizeOf } from '~/composables/useEditorCommands'
import { unturn } from '~/composables/useEditorGeometry'
import { preparePicture, turnPicture } from '~/composables/useEditorImages'
import { PICTURE_TYPES } from '~/composables/useEditorTools'

const { t } = useLocale()
const session = useEditorSession()
const metrics = useEditorFontMetrics()
const editorV2 = useEditorV2()
const tools = useEditorTools()
const images = useEditorImages()
const snackbar = useEditorSnackbar()
const pageOrder = useEditorPageOrder()

const command = computed(() => session.selected.value[0] ?? null)
const shape = computed(() => (command.value ? COMMAND_SHAPE[command.value.type] : null))

const PRESETS = [
  ['#FFFF00', 'colorYellow'],
  ['#FF7AB6', 'colorPink'],
  ['#2FA36B', 'colorGreen'],
  ['#0275FC', 'colorBlue'],
  ['#FA3331', 'colorRed'],
  ['#17212E', 'colorBlack'],
] as const

function set(patch: Record<string, unknown>, label = 'edit') {
  if (command.value) session.patchCommand(command.value._id, patch, label)
}

function setColor(value: string) {
  if (COLOR_PATTERN.test(value)) set({ color: value.toUpperCase() }, 'colour')
}

const colorValid = computed(() => !command.value?.color || COLOR_PATTERN.test(command.value.color))

/** Insert real newlines: the export engine never wraps text itself. */
function wrapText() {
  const current = command.value
  if (!current || current.type !== 'add_text') return
  const page = session.pageSize(current.page ?? 1)
  const wrapped = metrics.wrapToWidth(current.text ?? '', current.font_size ?? 16, page.width - (current.x ?? 0))
  set({ text: wrapped }, 'wrap')
}

function duplicate() {
  if (command.value) session.duplicateCommand(command.value._id)
}

/* ---------------------------------------------------------- the object form */

/** A move step: 2 mm, and a held button keeps going. */
const STEP = (2 * 72) / 25.4
const millimetres = (value = 0) => Math.round((value * 25.4) / 72)
const announcement = ref('')

const footprint = computed(() => {
  const current = command.value
  if (!current) return null
  if (current.points?.length) {
    const xs = current.points.map(([x]) => x)
    const ys = current.points.map(([, y]) => y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
  }
  return { x: current.x ?? 0, y: current.y ?? 0, width: current.width ?? 0, height: current.height ?? 0 }
})
/** A change of the file's own words stays on its line at its size: it is only changed again or taken back. */
const words = computed(() => command.value?.type === 'edit_text')
const movable = computed(
  () => !!command.value && !words.value && (shape.value?.positional || command.value.type === 'draw'),
)
const sizable = computed(() => movable.value && command.value?.type !== 'note')
const picture = computed(() => !!shape.value?.image)
const coloured = computed(() => ['add_text', 'highlight', 'draw'].includes(command.value?.type ?? ''))

/** 100 % is the size it had when it was chosen. */
const base = ref(1)
watch(
  () => command.value?._id,
  () => {
    base.value = command.value ? sizeOf(command.value) || 1 : 1
    announcement.value = ''
  },
  { immediate: true },
)
const percent = computed(() => (command.value ? Math.round((100 * sizeOf(command.value)) / base.value) : 100))

function nudge(dx: number, dy: number) {
  const current = command.value
  if (!current?.page) return
  // The arrows go as the page is seen, turned or not.
  const [across, down] = unturn(dx, dy, pageOrder.turnOf(current.page))
  const patch = moveBy(current, across, down, session.pageSize(current.page))
  session.patchCommand(current._id, patch, 'nudge', 'move', { amend: false })
  const at = footprint.value
  announcement.value = t('editorMovedTo', { x: millimetres(at?.x), y: millimetres(at?.y) })
}

let repeat: number | null = null
let repeated = false
function holdMove(dx: number, dy: number) {
  stopMove()
  repeat = window.setTimeout(function step() {
    repeated = true
    nudge(dx, dy)
    repeat = window.setTimeout(step, 90)
  }, 400)
}
function stopMove() {
  if (repeat !== null) clearTimeout(repeat)
  repeat = null
}
/** A held button already moved it; the click that ends the hold is not one more step. */
function tapMove(dx: number, dy: number) {
  if (repeated) repeated = false
  else nudge(dx, dy)
}
onBeforeUnmount(stopMove)

const MOVES = [
  { key: 'left', icon: 'left', label: 'editorMoveLeft', dx: -1, dy: 0 },
  { key: 'up', icon: 'up', label: 'editorMoveUp', dx: 0, dy: -1 },
  { key: 'down', icon: 'moveDown', label: 'editorMoveDown', dx: 0, dy: 1 },
  { key: 'right', icon: 'right', label: 'editorMoveRight', dx: 1, dy: 0 },
] as const

/** Millimetres from the page's top-left corner, as a ruler on the paper would read them. */
function setExact(key: 'x' | 'y' | 'width' | 'height', value: string) {
  const current = command.value
  const at = footprint.value
  const amount = Number(value)
  if (!current?.page || !at || !Number.isFinite(amount)) return
  const points = (amount * 72) / 25.4
  if (key === 'x' || key === 'y') {
    const dx = key === 'x' ? points - at.x : 0
    const dy = key === 'y' ? points - at.y : 0
    const patch = moveBy(current, dx, dy, session.pageSize(current.page))
    session.patchCommand(current._id, patch, 'position', 'move', { amend: false })
  } else session.patchCommand(current._id, { [key]: Math.max(LIMITS.minSize, points) }, 'size', 'resize')
}

function remove() {
  const current = command.value
  // While a send holds the draft the mark stays, and nothing says it went.
  if (!current || !session.removeCommands([current._id])) return
  snackbar.show({
    message: t('editorDeleted'),
    actionLabel: t('editorUndo'),
    onAction: session.undo,
    step: session.steps.value,
  })
}

function replace() {
  const current = command.value
  if (!current) return
  const id = current._id
  // The photo goes to this mark, whatever is chosen or put away by the time the phone hands it over.
  if (current.type !== 'signature') return tools.pickFile(PICTURE_TYPES, (file) => void onReplaceFile(id, file))
  tools.openSheet('sign')
  tools.replacing.value = id
}
async function onReplaceFile(id: string, file: File) {
  // Deleted meanwhile, it wants no picture.
  if (!session.commands.value.some((item) => item._id === id)) return
  // A send waits from here: making the picture ready takes a moment of its own.
  await tools.changePicture(id, async () => {
    const image = await preparePicture(file)
    if (image) return tools.replacePicture(id, { kind: 'picture', image })
    snackbar.show({ message: t('editorImageRefused') })
    return false
  })
}

/** A quarter turn clockwise is a new picture, its box turned about its middle. */
async function turn() {
  const current = command.value
  const asset = current ? session.assets.value[(current.input_index ?? 0) - 1] : null
  const url = images.urlFor(asset?.id)
  if (!current || !asset || !url) return
  await tools.changePicture(current._id, async () => {
    const image = await turnPicture(url, asset.mime_type ?? 'image/png')
    if (!image) return false
    const index = await tools.upload(image, current.type === 'signature' ? 'signature.png' : 'picture')
    const now = session.commands.value.find((item) => item._id === current._id)
    if (index === null || !now) return false
    const width = now.width ?? 0
    const height = now.height ?? 0
    const middleX = (now.x ?? 0) + width / 2
    const middleY = (now.y ?? 0) + height / 2
    return session.patchCommand(
      now._id,
      { input_index: index, width: height, height: width, x: middleX - height / 2, y: middleY - width / 2 },
      `turn:${now._id}`,
    )
  })
}
const pictureReady = computed(() => {
  const current = command.value
  const asset = current ? session.assets.value[(current.input_index ?? 0) - 1] : null
  // A new picture is a change, which a draft held by a send does not take.
  // Nor while a photo is still being handed over: it is a change of its own, on its way to a mark.
  return (
    !!asset && !!images.urlFor(asset.id) && !session.isBusy('picture') && !session.held.value && !tools.picking.value
  )
})

const issue = computed(() => session.issues.value.find((item) => item.id === command.value?._id))
</script>

<template>
  <section
    v-if="editorV2"
    class="editor-objectform"
    :aria-label="t('editorProperties')"
    data-testid="editor-floatbar"
  >
    <p v-if="!command" class="field-hint">{{ t('editorNoSelection') }}</p>
    <template v-else>
      <p v-if="issue" class="editor-invalid" role="status">{{ t(issue.code) }}</p>
      <button
        v-if="command.type === 'add_text' || command.type === 'note' || words"
        type="button"
        class="button secondary small editor-object-words"
        data-testid="editor-object-words"
        @click="tools.openWords(command._id)"
      >
        <AppIcon name="type" :size="16" />{{ t('editorChangeWords') }}
      </button>
      <button
        v-if="words"
        type="button"
        class="button secondary small editor-object-words"
        data-testid="editor-object-restore"
        @click="remove"
      >
        <AppIcon name="undo" :size="16" />{{ t('editorRestoreText') }}
      </button>

      <div v-if="sizable" class="editor-object-row" role="group" :aria-label="t('editorSize')">
        <span class="editor-object-label">{{ t('editorSize') }}</span>
        <button
          type="button"
          class="icon-button"
          :aria-label="t('editorSmaller')"
          data-testid="editor-object-smaller"
          @click="tools.resize(command._id, 1 / 1.1)"
        >
          <AppIcon name="minus" :size="18" />
        </button>
        <output class="editor-object-value" data-testid="editor-object-size">{{ percent }}%</output>
        <button
          type="button"
          class="icon-button"
          :aria-label="t('editorLarger')"
          data-testid="editor-object-larger"
          @click="tools.resize(command._id, 1.1)"
        >
          <AppIcon name="plus" :size="18" />
        </button>
      </div>

      <div v-if="movable" class="editor-object-row" role="group" :aria-label="t('editorMove')">
        <span class="editor-object-label">{{ t('editorMove') }}</span>
        <button
          v-for="move in MOVES"
          :key="move.key"
          type="button"
          class="icon-button"
          :aria-label="t(move.label)"
          :data-testid="`editor-object-${move.key}`"
          @click="tapMove(move.dx * STEP, move.dy * STEP)"
          @pointerdown="holdMove(move.dx * STEP, move.dy * STEP)"
          @pointerup="stopMove"
          @pointerleave="stopMove"
          @pointercancel="stopMove"
        >
          <AppIcon :name="move.icon" :size="18" />
        </button>
      </div>

      <div v-if="!words" class="editor-object-actions">
        <button
          v-if="picture"
          type="button"
          class="button secondary small"
          data-testid="editor-object-replace"
          :disabled="session.isBusy('picture') || session.held.value || tools.picking.value"
          @click="replace"
        >
          <AppIcon name="replace" :size="16" />{{ t('editorReplace') }}
        </button>
        <button
          v-if="picture"
          type="button"
          class="button secondary small"
          data-testid="editor-object-turn"
          :disabled="!pictureReady"
          @click="turn"
        >
          <AppIcon :name="session.isBusy('picture') ? 'loader' : 'rotate'" :size="16" />{{ t('editorTurn') }}
        </button>
        <button
          v-if="movable"
          type="button"
          class="button secondary small"
          data-testid="editor-object-duplicate"
          @click="duplicate"
        >
          <AppIcon name="copy" :size="16" />{{ t('editorDuplicate') }}
        </button>
        <button
          type="button"
          class="button secondary small editor-object-delete"
          data-testid="editor-object-delete"
          @click="remove"
        >
          <AppIcon name="trash" :size="16" />{{ t('delete') }}
        </button>
      </div>

      <div v-if="coloured" class="editor-swatches" role="group" :aria-label="t('editorColorPresets')">
        <button
          v-for="[value, key] in PRESETS"
          :key="value"
          type="button"
          class="editor-swatch"
          :class="{ active: command.color?.toUpperCase() === value }"
          :style="{ '--swatch': value }"
          :aria-label="t(key)"
          :aria-pressed="command.color?.toUpperCase() === value"
          @click="setColor(value)"
        />
      </div>

      <div v-if="movable" class="editor-object-row" role="group" :aria-label="t('editorLayer')">
        <span class="editor-object-label">{{ t('editorLayer') }}</span>
        <button
          type="button"
          class="button secondary small"
          data-testid="editor-object-back"
          @click="session.restack(command._id, -1)"
        >
          <AppIcon name="sendBack" :size="16" />{{ t('editorSendBack') }}
        </button>
        <button
          type="button"
          class="button secondary small"
          data-testid="editor-object-forward"
          @click="session.restack(command._id, 1)"
        >
          <AppIcon name="bringForward" :size="16" />{{ t('editorBringForward') }}
        </button>
      </div>

      <details v-if="movable && footprint" class="editor-object-exact" data-testid="editor-object-exact">
        <summary>{{ t('editorExactPosition') }}</summary>
        <div class="form-row">
          <label class="form-field"
            ><span>{{ t('editorFromLeft') }}</span
            ><input
              type="number"
              inputmode="decimal"
              step="0.5"
              min="0"
              :value="millimetres(footprint.x)"
              data-testid="editor-object-x"
              @change="setExact('x', ($event.target as HTMLInputElement).value)"
          /></label>
          <label class="form-field"
            ><span>{{ t('editorFromTop') }}</span
            ><input
              type="number"
              inputmode="decimal"
              step="0.5"
              min="0"
              :value="millimetres(footprint.y)"
              data-testid="editor-object-y"
              @change="setExact('y', ($event.target as HTMLInputElement).value)"
          /></label>
        </div>
        <div v-if="shape?.box" class="form-row">
          <label class="form-field"
            ><span>{{ t('editorWidthMm') }}</span
            ><input
              type="number"
              inputmode="decimal"
              step="0.5"
              min="1"
              :value="millimetres(command.width)"
              @change="setExact('width', ($event.target as HTMLInputElement).value)"
          /></label>
          <label class="form-field"
            ><span>{{ t('editorHeightMm') }}</span
            ><input
              type="number"
              inputmode="decimal"
              step="0.5"
              min="1"
              :value="millimetres(command.height)"
              @change="setExact('height', ($event.target as HTMLInputElement).value)"
          /></label>
        </div>
      </details>

      <span class="visually-hidden" aria-live="polite">{{ announcement }}</span>
    </template>
  </section>
  <section
    v-else
    class="editor-floatbar panel"
    :aria-label="t('editorProperties')"
    data-testid="editor-floatbar"
  >
    <p v-if="!command" class="field-hint">{{ t('editorNoSelection') }}</p>
    <template v-else>
      <div class="editor-floatbar-head">
        <strong>{{ t(COMMAND_SHAPE[command.type].labelKey) }}</strong>
        <span>
          <button type="button" class="icon-button" :aria-label="t('editorDuplicate')" @click="duplicate">
            <AppIcon name="copy" :size="17" />
          </button>
          <button
            type="button"
            class="icon-button"
            :aria-label="t('delete')"
            @click="session.removeCommands([command._id])"
          >
            <AppIcon name="trash" :size="17" />
          </button>
        </span>
      </div>

      <div v-if="shape?.positional" class="form-row">
        <label class="form-field"
          ><span>{{ t('xCoordinate') }}</span
          ><input
            type="number"
            step="0.01"
            min="0"
            :value="command.x"
            @change="set({ x: Number(($event.target as HTMLInputElement).value) }, 'position')"
        /></label>
        <label class="form-field"
          ><span>{{ t('yCoordinate') }}</span
          ><input
            type="number"
            step="0.01"
            min="0"
            :value="command.y"
            @change="set({ y: Number(($event.target as HTMLInputElement).value) }, 'position')"
        /></label>
      </div>

      <div v-if="shape?.box" class="form-row">
        <label class="form-field"
          ><span>{{ t('width') }}</span
          ><input
            type="number"
            step="0.01"
            :min="LIMITS.minSize"
            :value="command.width"
            @change="set({ width: Number(($event.target as HTMLInputElement).value) }, 'size')"
        /></label>
        <label class="form-field"
          ><span>{{ t('height') }}</span
          ><input
            type="number"
            step="0.01"
            :min="LIMITS.minSize"
            :value="command.height"
            @change="set({ height: Number(($event.target as HTMLInputElement).value) }, 'size')"
        /></label>
      </div>

      <label v-if="command.type === 'add_text'" class="form-field"
        ><span>{{ t('fontSize') }}</span
        ><input
          type="number"
          :min="LIMITS.fontSize.min"
          :max="LIMITS.fontSize.max"
          :value="command.font_size"
          @change="set({ font_size: Number(($event.target as HTMLInputElement).value) }, 'size')"
      /></label>

      <label v-if="command.type === 'draw'" class="form-field"
        ><span>{{ t('editorStrokeWidth') }}</span
        ><input
          type="number"
          step="0.5"
          :min="LIMITS.strokeWidth.min"
          :max="LIMITS.strokeWidth.max"
          :value="command.stroke_width"
          @change="set({ stroke_width: Number(($event.target as HTMLInputElement).value) }, 'size')"
      /></label>

      <template v-if="command.color !== undefined">
        <label class="form-field"
          ><span>{{ t('editorColorHex') }}</span>
          <span class="editor-color-row">
            <input
              type="color"
              :value="command.color"
              :aria-label="t('color')"
              @input="setColor(($event.target as HTMLInputElement).value)"
            /><input
              class="editor-color-hex"
              :value="command.color"
              maxlength="7"
              pattern="#[0-9A-Fa-f]{6}"
              :aria-label="t('editorColorHex')"
              @change="setColor(($event.target as HTMLInputElement).value)"
            />
          </span>
          <small v-if="!colorValid" class="editor-invalid">{{ t('editorColorInvalid') }}</small>
        </label>
        <div class="editor-swatches" role="group" :aria-label="t('editorColorPresets')">
          <button
            v-for="[value, key] in PRESETS"
            :key="value"
            type="button"
            class="editor-swatch"
            :class="{ active: command.color?.toUpperCase() === value }"
            :style="{ '--swatch': value }"
            :aria-label="t(key)"
            @click="setColor(value)"
          />
        </div>
      </template>

      <button
        v-if="command.type === 'add_text'"
        type="button"
        class="button secondary full small editor-wrap-text"
        @click="wrapText"
      >
        <AppIcon name="alignLeft" :size="15" />{{ t('editorWrapToPage') }}
      </button>

      <EditorAssetField
        v-if="shape?.image"
        :command-id="command._id"
        :input-index="command.input_index"
        :signature="command.type === 'signature'"
      />

      <p v-if="shape?.image" class="field-hint">{{ t('editorImageLetterbox') }}</p>
      <p v-if="command.type === 'add_text'" class="field-hint">{{ t('editorOneFontNote') }}</p>
      <p class="field-hint">{{ t('editorNudgeHint') }}</p>
    </template>
  </section>
</template>
