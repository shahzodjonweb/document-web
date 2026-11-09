<script setup lang="ts">
/**
 * One slide as the server drew it, with the counter row under it.
 *
 * The picture is all a finger sees, so a tap is matched against the boxes the server
 * says the heading and the lines were drawn in, each widened to a fingertip. The
 * region buttons over them are for a keyboard and a screen reader only: the CSS keeps
 * pointers off them, and the slide menu is the same way in by buttons. One finger
 * sideways goes to the next slide; two are the browser's zoom and are left alone, and
 * once zoomed in one finger looks along the slide instead. The hint slot sits over the
 * slide's foot.
 */
import type { DeckFrame, DeckSlideImage, PreviewState, SlideRef } from '~/composables/useDeckEditor'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  slide: SlideRef
  image: DeckSlideImage | null
  src: string | null
  number: number
  total: number
  heading: string
  stale: boolean
  preview: PreviewState
  outlined: boolean
  editable: boolean
  isCover: boolean
  /** Words over the slide's room, -1 when some are and the count is not known, null when all show. */
  tooLong: number | null
  canSplit: boolean
}>()

const emit = defineEmits<{
  region: [field: 'heading' | 'body']
  prev: []
  next: []
  flash: []
  menu: []
  cover: []
  split: []
  pickLayout: []
}>()

const { t, count } = useLocale()
const telegram = useTelegramApp()
const deck = useDeckEditor()
/** The plan's count of slides: Split would make one more, so it is refused here, with the reason beside it. */
const full = computed(() => deck.sections.value.length >= deck.maxSlides.value)
const fullText = computed(() => (full.value ? t('deckSlidesFull', { max: deck.maxSlides.value }) : ''))

const root = ref<HTMLElement>()
/** The too-long row's height: on a phone the slide gives it room (screens.css), its words and fixes in sight. */
const overRow = ref<HTMLElement>()
const overHeight = ref(0)
let overWatch: ResizeObserver | null = null

/**
 * The last picture of this slide that has arrived. A redrawn one has a new key, and
 * until its file is here the old one stays rather than the slide going blank.
 */
const slideKey = computed(() =>
  props.slide.kind === 'section' ? props.slide.id : `questions:${props.slide.page}`,
)
const last = shallowRef<{ slide: string; key: string; src: string } | null>(null)
watch(
  () => [props.src, props.image?.key, slideKey.value] as const,
  ([src, key, slide]) => {
    if (src && key) last.value = { slide, key, src }
  },
  { immediate: true },
)
const shown = computed(() => (last.value?.slide === slideKey.value ? last.value : null))
const broken = ref('')
// A picture fetched again after a failure comes as a new address: it gets its own chance to show.
watch(
  () => shown.value?.src,
  () => (broken.value = ''),
)

const blank = computed(() => !props.image || (!!shown.value && broken.value === shown.value.key))
const state = computed(() => {
  if (blank.value) return 'blank'
  if (props.stale && (props.preview === 'unavailable' || props.preview === 'busy')) return 'dim'
  if (props.stale && props.preview === 'drawing') return 'drawing'
  return 'ready'
})
const untitled = computed(() => props.heading.trim() || t('deckUntitled'))
const content = computed(() => props.slide.kind === 'section' && !props.isCover)

type Box = { field: 'heading' | 'body'; x: number; y: number; w: number; h: number }
/** The heading's box and the lines' boxes; a picture is nobody's to type into. */
const regions = computed(() =>
  (props.image?.frames ?? []).filter((frame): frame is DeckFrame & Box => frame.field !== 'picture'),
)
const firstBody = computed(() => regions.value.findIndex((frame) => frame.field === 'body'))
const percent = (value: number) => `${Math.max(0, Math.min(1, value)) * 100}%`
function boxStyle(frame: Box) {
  return { left: percent(frame.x), top: percent(frame.y), width: percent(frame.w), height: percent(frame.h) }
}
function regionLabel(frame: Box, index: number) {
  if (frame.field === 'heading') return t('deckRegionHeading', { n: props.number, text: untitled.value })
  return index === firstBody.value ? t('deckRegionBody', { n: props.number }) : undefined
}

/* ------------------------------------------------------------------ taps */

// A tap is a finger lifted within 10 px and 350 ms of where it went down, as on a page.
const TAP_DISTANCE = 10
const TAP_TIME = 350
const SWIPE_DISTANCE = 40
const SWIPE_TIME = 600
// A box smaller than a fingertip is reached as if it were one; any box a little past its edges.
const REACH = 44
const SLOP = 12

/**
 * Which part a tap at (x, y), in CSS pixels from the slide's corner, means: the box it
 * is in, else the nearest-centred box whose reach it is in, else none.
 */
function hit(x: number, y: number, width: number, height: number): Box['field'] | null {
  const boxes = regions.value.map((frame) => ({
    field: frame.field,
    x: frame.x * width,
    y: frame.y * height,
    w: frame.w * width,
    h: frame.h * height,
  }))
  const away = (box: (typeof boxes)[number]) => Math.hypot(x - (box.x + box.w / 2), y - (box.y + box.h / 2))
  const nearest = (list: typeof boxes) => list.sort((a, b) => away(a) - away(b))[0]?.field ?? null
  const within = boxes.filter((box) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h)
  if (within.length) return nearest(within)
  const reached = boxes.filter((box) => {
    const w = Math.min(width, Math.max(REACH, box.w + 2 * SLOP))
    const h = Math.min(height, Math.max(REACH, box.h + 2 * SLOP))
    const left = Math.max(0, Math.min(width - w, box.x - (w - box.w) / 2))
    const top = Math.max(0, Math.min(height - h, box.y - (h - box.h) / 2))
    return x >= left && x <= left + w && y >= top && y <= top + h
  })
  return nearest(reached)
}

/** A part reached is the parent's to open, or not while the deck is held; a miss shows the parts. */
function tap(event: PointerEvent) {
  const rect = root.value?.getBoundingClientRect()
  if (!rect?.width || !rect.height) return
  const field = hit(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height)
  if (field) emit('region', field)
  else emit('flash')
}

/* ---------------------------------------------------------------- swipes */

const down = new Set<number>()
let press: { pointer: number; x: number; y: number; at: number; sideways: boolean } | null = null
let releaseSwipes: (() => void) | null = null
let swipedAt = -Infinity

/** Pinched in, a finger sideways is the browser's to pan, never a swipe (the CSS lets it pan). */
const isZoomed = () => (window.visualViewport?.scale ?? 1) > 1.01
const zoomed = ref(false)
function readZoom() {
  zoomed.value = isZoomed()
}
onMounted(() => {
  readZoom()
  window.visualViewport?.addEventListener('resize', readZoom)
  if (typeof ResizeObserver === 'undefined' || !overRow.value) return
  overWatch = new ResizeObserver(() => (overHeight.value = overRow.value?.offsetHeight ?? 0))
  overWatch.observe(overRow.value)
})

function letGo() {
  releaseSwipes?.()
  releaseSwipes = null
  press = null
}
onBeforeUnmount(() => {
  letGo()
  window.visualViewport?.removeEventListener('resize', readZoom)
  overWatch?.disconnect()
})

function onPointerDown(event: PointerEvent) {
  // A first finger means no other is down, whatever was missed before.
  if (event.isPrimary) down.clear()
  down.add(event.pointerId)
  // A second finger is the browser's pinch: neither a tap nor a swipe.
  if (down.size > 1 || event.button !== 0) return letGo()
  press = {
    pointer: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    at: event.timeStamp,
    sideways: false,
  }
}

/**
 * The slide keeps the finger only once it goes sideways: held from the start, the
 * click of a tap on the blank card's buttons would land on the slide instead.
 */
function onPointerMove(event: PointerEvent) {
  if (!press || press.pointer !== event.pointerId || press.sideways || isZoomed()) return
  const dx = event.clientX - press.x
  const dy = event.clientY - press.y
  if (Math.abs(dx) > TAP_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
    press.sideways = true
    releaseSwipes = telegram.holdSwipes()
    try {
      root.value?.setPointerCapture(event.pointerId)
    } catch {}
  }
}

function onPointerUp(event: PointerEvent) {
  down.delete(event.pointerId)
  const was = press
  if (!was || was.pointer !== event.pointerId) return
  letGo()
  const dx = event.clientX - was.x
  const dy = event.clientY - was.y
  const time = event.timeStamp - was.at
  if (Math.hypot(dx, dy) <= TAP_DISTANCE && time <= TAP_TIME) {
    // A real button under the finger answers with its own click.
    if ((event.target as Element | null)?.closest?.('button')) return
    return tap(event)
  }
  if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) && time < SWIPE_TIME && !isZoomed()) {
    swipedAt = event.timeStamp
    if (dx < 0) emit('next')
    else emit('prev')
  }
}

function onPointerCancel(event: PointerEvent) {
  down.delete(event.pointerId)
  if (press?.pointer === event.pointerId) letGo()
}

/** The click that follows a swipe is the swipe's, not a press on whatever it ended over. */
function onClickCapture(event: MouseEvent) {
  if (event.timeStamp - swipedAt < 400) {
    event.preventDefault()
    event.stopPropagation()
  }
}
</script>

<template>
  <div
    ref="root"
    v-bind="$attrs"
    class="deck-edit-slide"
    :class="{ outlined, zoomed }"
    :style="{ '--deck-edit-over': `${overHeight}px` }"
    :data-index="number - 1"
    :data-state="state"
    data-testid="deck-slide"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @lostpointercapture="onPointerCancel"
    @click.capture="onClickCapture"
  >
    <img
      v-if="shown && !blank"
      :key="shown.key"
      :src="shown.src"
      :alt="t('deckSlideAlt', { n: number, heading: untitled })"
      draggable="false"
      data-testid="deck-slide-image"
      @error="broken = shown?.key ?? ''"
    />
    <div v-if="blank" class="deck-edit-blank">
      <button
        type="button"
        class="deck-edit-blank-heading"
        :disabled="!editable"
        data-testid="deck-blank-heading"
        @click="emit('region', 'heading')"
      >
        {{ untitled }}
      </button>
      <button
        type="button"
        class="deck-edit-blank-lines"
        :disabled="!editable"
        data-testid="deck-blank-lines"
        @click="emit('region', 'body')"
      >
        {{ t('deckFieldLines') }}
      </button>
      <p class="muted">
        {{ preview === 'drawing' || preview === 'idle' ? t('deckNotDrawn') : t('deckPreviewUnavailable') }}
      </p>
    </div>
    <div v-else-if="regions.length" class="deck-edit-regions">
      <button
        v-for="(frame, index) in regions"
        :key="index"
        type="button"
        class="deck-edit-region"
        :style="boxStyle(frame)"
        :aria-label="regionLabel(frame, index)"
        :aria-hidden="frame.field === 'body' && index !== firstBody ? 'true' : undefined"
        :tabindex="frame.field === 'body' && index !== firstBody ? -1 : undefined"
        :disabled="!editable"
        :data-testid="`deck-region-${frame.field}`"
        @click="emit('region', frame.field)"
      />
    </div>
    <span v-if="state === 'drawing'" class="deck-edit-chip" data-testid="deck-drawing"
      ><AppIcon name="loader" :size="14" />{{ t('deckDrawing') }}</span
    >
    <!-- Over the slide's foot, where it takes no height from the counter row or the strip. -->
    <slot name="hint" />
  </div>
  <div class="deck-edit-row">
    <button
      type="button"
      class="icon-button"
      :aria-label="t('deckPrevSlide')"
      :disabled="number <= 1"
      data-testid="deck-slide-prev"
      @click="emit('prev')"
    >
      <AppIcon name="back" :size="20" />
    </button>
    <span class="deck-edit-counter" aria-live="polite" data-testid="deck-slide-counter">{{
      t('deckSlideOf', { n: number, total })
    }}</span>
    <button
      type="button"
      class="icon-button"
      :aria-label="t('deckNextSlide')"
      :disabled="number >= total"
      data-testid="deck-slide-next"
      @click="emit('next')"
    >
      <AppIcon name="chevron" :size="20" />
    </button>
    <button
      v-if="isCover"
      type="button"
      class="button secondary small"
      :aria-label="t('deckCoverDetails')"
      data-testid="deck-cover-open"
      @click="emit('cover')"
    >
      {{ t('deckCoverShort') }}
    </button>
    <button
      v-else
      type="button"
      class="icon-button"
      :aria-label="t('deckSlideMenu')"
      aria-haspopup="dialog"
      data-testid="deck-slide-menu"
      @click="emit('menu')"
    >
      <AppIcon name="more" :size="20" />
    </button>
  </div>
  <!-- Mounted while the slide is, so what it says is announced as it changes. -->
  <div ref="overRow" class="deck-edit-over" role="status" data-testid="deck-over">
    <template v-if="tooLong !== null">
      <span>{{ tooLong > 0 ? count('deckTooLong', tooLong) : t('deckTooLongSome') }}</span>
      <template v-if="content">
        <span v-if="full && canSplit" id="deck-over-full" data-testid="deck-over-full">{{ fullText }}</span>
        <button
          type="button"
          class="button secondary small"
          :disabled="!editable || !canSplit || full"
          :title="full ? fullText : canSplit ? undefined : t('deckSplitNeedsLines')"
          :aria-describedby="full && canSplit ? 'deck-over-full' : undefined"
          data-testid="deck-over-split"
          @click="emit('split')"
        >
          {{ t('deckSplit') }}
        </button>
        <button
          type="button"
          class="button secondary small"
          :disabled="!editable"
          data-testid="deck-over-layout"
          @click="emit('pickLayout')"
        >
          {{ t('deckPickLayout') }}
        </button>
      </template>
    </template>
  </div>
</template>
