<script setup lang="ts">
/** Page thumbnails. Rendered locally, so they cost no preview requests. */
// `pages` is the order the new frame shows them in, as uploaded numbers; by default every page in turn.
const props = defineProps<{ pageCount: number; current: number; pages?: number[] }>()
const emit = defineEmits<{ go: [page: number] }>()

const { t } = useLocale()
const session = useEditorSession()
const render = useEditorRender()

const thumbnails = ref<Record<number, string>>({})
const listed = computed(() => props.pages ?? Array.from({ length: props.pageCount }, (_, index) => index + 1))

const changesOn = (page: number) => session.commands.value.filter((command) => command.page === page).length

async function loadThumbnail(page: number) {
  if (thumbnails.value[page]) return
  const url = await render.thumbnail(page)
  if (url) thumbnails.value = { ...thumbnails.value, [page]: url }
}

watch(
  () => [render.mode.value, props.pageCount] as const,
  ([mode, count]) => {
    if (mode !== 'pdfjs') return
    // Warm the first screenful; the rest load as they scroll into view.
    for (let page = 1; page <= Math.min(count, 8); page += 1) void loadThumbnail(page)
  },
  { immediate: true },
)

function observe(element: Element | null, page: number) {
  if (!element || thumbnails.value[page]) return
  const observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) {
      void loadThumbnail(page)
      observer.disconnect()
    }
  })
  observer.observe(element)
}
</script>

<template>
  <nav class="editor-rail" :aria-label="t('editorPagesPanel')" data-testid="editor-rail">
    <button
      v-for="(page, index) in listed"
      :key="page"
      :ref="(element) => observe(element as Element | null, page)"
      type="button"
      class="editor-rail-item"
      :class="{ active: page === current }"
      :aria-current="page === current ? 'true' : undefined"
      :aria-label="t('editorPageLabel', { page: index + 1, count: listed.length })"
      @click="emit('go', page)"
    >
      <span class="editor-rail-thumb">
        <img v-if="thumbnails[page]" :src="thumbnails[page]" alt="" />
      </span>
      <small>{{ index + 1 }}</small>
      <span v-if="changesOn(page)" class="count-tag">{{ changesOn(page) }}</span>
    </button>
  </nav>
</template>
