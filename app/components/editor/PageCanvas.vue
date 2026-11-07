<script setup lang="ts">
/**
 * One page of the document.
 *
 * The container is sized from the page's declared PDF points and carries no
 * border or padding, so its rect *is* the page: every coordinate conversion in
 * the editor measures this element. That is true before any pixels arrive,
 * which is why editing keeps working even when rendering fails entirely.
 */
const props = withDefaults(
  defineProps<{
    page: number
    pageWidth: number
    pageHeight: number
    /** CSS pixels per PDF point. */
    zoom: number
    fileId: string
    pageCount: number
    /**
     * Degrees the page will be turned in the file. It turns as a whole about its
     * middle, marks and all, inside a slot that has the turned size; the rect this
     * element reports is then the turned box, which MarkLayer turns back.
     */
    turn?: number
    /** The page a person sees first: the server's picture of it shows until pdf.js has drawn it. */
    early?: boolean
    /** Its place in the file being made, when that differs from the upload's. */
    position?: number
  }>(),
  { turn: 0, early: false, position: 0 },
)

const emit = defineEmits<{ rendered: [page: number]; failed: [page: number] }>()

const { t } = useLocale()
const render = useEditorRender()

const frame = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const visible = ref(false)
const drawn = ref(false)
const imageFailed = ref(false)

const cssWidth = computed(() => props.pageWidth * props.zoom)
const label = computed(() =>
  t('editorPageLabel', { page: props.position || props.page, count: props.pageCount }),
)
/** The server's picture stands in while pdf.js opens the file and draws this page. */
const server = computed(() => render.mode.value === 'server')
const earlyFailed = ref(false)
const showEarly = computed(
  () => props.early && !drawn.value && !earlyFailed.value && ['loading', 'pdfjs'].includes(render.mode.value),
)

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
    :class="{ turned: turn }"
    :style="{
      width: `${cssWidth}px`,
      aspectRatio: `${pageWidth} / ${pageHeight}`,
      ...(turn ? { transform: `translate(-50%, -50%) rotate(${turn}deg)` } : {}),
    }"
  >
    <canvas v-show="render.mode.value === 'pdfjs'" ref="canvas" class="editor-page-canvas" aria-hidden="true" />
    <!-- One picture, early or not: if pdf.js gives up, the one already asked for stays. -->
    <PreviewImage
      v-if="(server && visible && !imageFailed) || showEarly"
      class="editor-page-canvas"
      :class="{ 'editor-page-early': !server }"
      :src="render.serverPreview(fileId, page)"
      :quiet="!server"
      :data-testid="server ? undefined : 'editor-page-early'"
      @failed="server ? (imageFailed = true) : (earlyFailed = true)"
    />
    <p v-if="imageFailed" class="editor-page-fallback" role="status">{{ t('editorRenderFailed') }}</p>
    <slot />
  </div>
</template>
