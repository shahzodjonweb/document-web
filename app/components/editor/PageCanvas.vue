<script setup lang="ts">
/**
 * One page of the document.
 *
 * The container is sized from the page's declared PDF points and carries no
 * border or padding, so its rect *is* the page: every coordinate conversion in
 * the editor measures this element. That is true before any pixels arrive,
 * which is why editing keeps working even when rendering fails entirely.
 */
const props = defineProps<{
  page: number
  pageWidth: number
  pageHeight: number
  /** CSS pixels per PDF point. */
  zoom: number
  fileId: string
  pageCount: number
}>()

const emit = defineEmits<{ rendered: [page: number]; failed: [page: number] }>()

const { t } = useLocale()
const render = useEditorRender()

const frame = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const visible = ref(false)
const drawn = ref(false)
const imageFailed = ref(false)

const cssWidth = computed(() => props.pageWidth * props.zoom)
const label = computed(() => t('editorPageLabel', { page: props.page, count: props.pageCount }))

let observer: IntersectionObserver | null = null
let pending: number | null = null

async function draw() {
  if (!visible.value || render.mode.value !== 'pdfjs') return
  const target = canvas.value
  if (!target) return
  const ok = await render.renderPage(props.page, target, cssWidth.value)
  if (ok) {
    drawn.value = true
    emit('rendered', props.page)
  } else if (!drawn.value) emit('failed', props.page)
}

/** Re-render after zoom settles; the stale bitmap is scaled meanwhile. */
function scheduleDraw(delay = 150) {
  if (pending !== null) clearTimeout(pending)
  pending = window.setTimeout(() => {
    pending = null
    void draw()
  }, delay)
}

onMounted(() => {
  if (!frame.value) return
  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (!entry) return
      visible.value = entry.isIntersecting
      if (entry.isIntersecting) scheduleDraw(0)
    },
    { rootMargin: '600px 0px' },
  )
  observer.observe(frame.value)
})

watch(() => props.zoom, () => scheduleDraw())
watch(
  () => render.mode.value,
  (value) => {
    drawn.value = false
    if (value === 'pdfjs') scheduleDraw(0)
  },
)

onBeforeUnmount(() => {
  if (pending !== null) clearTimeout(pending)
  observer?.disconnect()
  observer = null
  // Drop the backing store before the element goes away.
  if (canvas.value) {
    canvas.value.width = 0
    canvas.value.height = 0
  }
})
</script>

<template>
  <div
    ref="frame"
    class="editor-page"
    role="group"
    :aria-label="label"
    :data-testid="`editor-page-${page}`"
    :data-page="page"
    :style="{
      width: `${cssWidth}px`,
      aspectRatio: `${pageWidth} / ${pageHeight}`,
    }"
  >
    <canvas v-show="render.mode.value === 'pdfjs'" ref="canvas" class="editor-page-canvas" aria-hidden="true" />
    <img
      v-if="render.mode.value === 'server' && visible && !imageFailed"
      class="editor-page-canvas"
      :src="render.serverPreview(fileId, page)"
      alt=""
      aria-hidden="true"
      @error="imageFailed = true"
    />
    <p v-if="imageFailed" class="editor-page-fallback" role="status">{{ t('editorRenderFailed') }}</p>
    <slot />
  </div>
</template>
