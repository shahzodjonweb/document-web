<script setup lang="ts">
/**
 * A server preview that may not be drawn yet.
 *
 * With the deck lane on, an uncached `/files/{id}/preview` answers 202 and is being
 * drawn, or 429 `lane_busy` when too much is waiting. An `<img>` would show either
 * as a broken picture, so this asks with `fetch`, asks again until there is one, and
 * only then shows it. `failed` is the old `@error`: the caller keeps its own fallback.
 */
const props = withDefaults(defineProps<{ src: string; alt?: string; lazy?: boolean; quiet?: boolean }>(), {
  alt: '',
  lazy: false,
  quiet: false,
})
const emit = defineEmits<{ failed: [] }>()

const { t } = useLocale()

/** How long to wait before asking again; the last repeats. The lane's first draw of a page takes seconds. */
const DRAWING_WAITS = [1000, 1500, 2000, 3000, 5000]
/** A slide deck's first pages can take this long behind others; past it, say so. */
const DRAWING_LIMIT = 120_000
const BUSY_WAIT = 15_000
const BUSY_TRIES = 5

const holder = ref<HTMLElement>()
const state = ref<'idle' | 'drawing' | 'busy' | 'ready'>('idle')
const shown = ref('')
let objectUrl = ''
let run = 0
let controller: AbortController | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let observer: IntersectionObserver | null = null

function stop() {
  run += 1
  controller?.abort()
  controller = null
  if (timer !== null) clearTimeout(timer)
  timer = null
  observer?.disconnect()
  observer = null
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = ''
  shown.value = ''
}

async function load() {
  const mine = run
  const started = Date.now()
  let drawing = 0
  let busy = 0
  state.value = 'drawing'
  const again = (wait: number) =>
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, wait)
    })
  while (mine === run) {
    let response: Response
    controller = new AbortController()
    try {
      response = await fetch(props.src, { credentials: 'include', signal: controller.signal })
    } catch {
      if (mine !== run) return
      // Not an answer. The browser's own request is the last word, as it was before.
      shown.value = props.src
      state.value = 'ready'
      return
    }
    if (mine !== run) return
    if (response.status === 202) {
      void response.body?.cancel()
      if (Date.now() - started > DRAWING_LIMIT) break
      state.value = 'drawing'
      await again(DRAWING_WAITS[Math.min(drawing, DRAWING_WAITS.length - 1)]!)
      drawing += 1
      continue
    }
    if (response.status === 429) {
      void response.body?.cancel()
      busy += 1
      if (busy >= BUSY_TRIES) break
      state.value = 'busy'
      await again(BUSY_WAIT)
      continue
    }
    if (!response.ok) break
    const blob = await response.blob().catch(() => null)
    if (mine !== run) return
    if (!blob) break
    objectUrl = URL.createObjectURL(blob)
    shown.value = objectUrl
    state.value = 'ready'
    return
  }
  if (mine === run) emit('failed')
}

function begin() {
  stop()
  state.value = 'idle'
  if (!props.lazy) {
    void load()
    return
  }
  void nextTick(() => {
    if (!holder.value) return
    const mine = run
    observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || mine !== run) return
      observer?.disconnect()
      observer = null
      void load()
    })
    observer.observe(holder.value)
  })
}

watch(() => props.src, begin)
onMounted(begin)
onBeforeUnmount(stop)
</script>

<template>
  <img v-if="shown" :src="shown" :alt="alt" @error="emit('failed')" />
  <span v-else ref="holder" class="preview-wait">
    <template v-if="state !== 'idle'">
      <AppIcon name="loader" class="spin" :size="quiet ? 14 : 18" />
      <span :class="{ 'visually-hidden': quiet }" role="status">{{
        t(state === 'busy' ? 'previewWaiting' : 'previewPreparing')
      }}</span>
    </template>
  </span>
</template>
