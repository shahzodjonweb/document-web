<script setup lang="ts">
/**
 * Draw a signature with a mouse, finger or pen.
 *
 * The result is a transparent PNG uploaded as an ordinary file asset, so the
 * export path is exactly the same as an uploaded signature image — no special
 * case anywhere in the engine.
 */
import { cropToInk, type PreparedImage } from '~/composables/useEditorImages'

// `local` is the new frame's: the drawing stays on the phone, cut to its ink, until it is placed.
const props = defineProps<{ local?: boolean }>()
const emit = defineEmits<{
  saved: [index: number]
  drawn: [image: PreparedImage]
  refused: [why: string]
  close: []
}>()

const { t } = useLocale()
const session = useEditorSession()
const telegram = useTelegramApp()

const WIDTH = 600
// A phone's pad is taller: a finger needs the room, and the ink is cut out of it anyway.
const HEIGHT = props.local ? 300 : 200

const canvas = ref<HTMLCanvasElement>()
const drawn = ref(false)
let drawing = false
let releaseSwipes: (() => void) | null = null
let context: CanvasRenderingContext2D | null = null

function prepare() {
  const element = canvas.value
  if (!element) return
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2)
  element.width = WIDTH * dpr
  element.height = HEIGHT * dpr
  context = element.getContext('2d')
  if (!context) return
  context.scale(dpr, dpr)
  context.lineWidth = 2.4
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = '#17212E'
  if (props.local) context.lineWidth = 3.2
}

onMounted(prepare)

function pointOf(event: PointerEvent) {
  const rect = canvas.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
  }
}

function start(event: PointerEvent) {
  if (!context) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  drawing = true
  // A stroke downwards must not take Telegram down with it.
  if (props.local) releaseSwipes = telegram.holdSwipes()
  const { x, y } = pointOf(event)
  context.beginPath()
  context.moveTo(x, y)
}

function move(event: PointerEvent) {
  if (!drawing || !context) return
  const { x, y } = pointOf(event)
  context.lineTo(x, y)
  context.stroke()
  drawn.value = true
}

function stop() {
  drawing = false
  releaseSwipes?.()
  releaseSwipes = null
}
onBeforeUnmount(stop)

function clear() {
  const element = canvas.value
  if (!element || !context) return
  context.clearRect(0, 0, element.width, element.height)
  drawn.value = false
}

async function save() {
  const element = canvas.value
  if (!element || !drawn.value) return
  if (props.local) {
    const image = await cropToInk(element)
    if (image) emit('drawn', image)
    return
  }
  const blob = await new Promise<Blob | null>((resolve) => element.toBlob(resolve, 'image/png'))
  if (!blob) return
  const file = new File([blob], 'signature.png', { type: 'image/png' })
  const index = await session.uploadAsset(file, (why) => emit('refused', why))
  if (index !== null) emit('saved', index)
}
</script>

<template>
  <div class="editor-signature" :class="{ local }" data-testid="editor-signature-pad">
    <p class="field-hint">{{ local ? t('editorSignatureHintPhone') : t('editorSignatureHint') }}</p>
    <canvas
      ref="canvas"
      class="editor-signature-canvas"
      :style="{ aspectRatio: `${WIDTH} / ${HEIGHT}` }"
      :aria-label="t('editorSignatureDraw')"
      role="img"
      @pointerdown="start"
      @pointermove="move"
      @pointerup="stop"
      @pointercancel="stop"
      @pointerleave="stop"
    />
    <!-- What else the drawing needs decided before it is used, such as keeping it. -->
    <slot />
    <div class="editor-signature-actions">
      <button type="button" class="button secondary small" :disabled="!drawn" @click="clear">
        {{ t('editorSignatureClear') }}
      </button>
      <button
        type="button"
        class="button primary small"
        data-testid="editor-signature-save"
        :disabled="!drawn || session.isBusy('asset')"
        @click="save"
      >
        {{ session.isBusy('asset') ? t('working') : t('editorSignatureSave') }}
      </button>
      <button v-if="!local" type="button" class="text-link" @click="emit('close')">{{ t('cancel') }}</button>
    </div>
  </div>
</template>
