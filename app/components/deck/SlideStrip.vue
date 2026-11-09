<script setup lang="ts">
/**
 * The deck's slides in a row, or a column beside the slide at 980 px and over. A tap
 * goes to a slide; order is changed in the Slides list, so nothing here is dragged.
 * "+" sits after the slide being looked at, where the new one will go.
 */
import type { SlideRef } from '~/composables/useDeckEditor'

const props = defineProps<{
  items: { ref: SlideRef; thumb: string | null; fits: boolean | null; question: boolean; key: string }[]
  current: number
  canAdd: boolean
  editable: boolean
  rail?: boolean
}>()
const emit = defineEmits<{ go: [index: number]; add: [] }>()

const { t } = useLocale()
const strip = ref<HTMLElement>()

/** Questions come last, and a new slide never goes among them. */
const addAfter = computed(() => {
  if (!props.items[props.current]?.question) return props.current
  return props.items.reduce((last, item, index) => (item.question ? last : index), -1)
})

function label(index: number) {
  const item = props.items[index]
  const name = t('deckSlideNumber', { n: index + 1 })
  return item?.fits === false ? `${name}, ${t('deckWordsHidden')}` : name
}

/**
 * The strip's own scroll, set directly: `scrollIntoView` would scroll the stage
 * around it as well, and move the slide out from under the finger.
 */
function reveal() {
  const element = strip.value
  const thumb = element?.querySelector<HTMLElement>(`[data-testid="deck-thumb-${props.current + 1}"]`)
  if (!element || !thumb) return
  const box = element.getBoundingClientRect()
  const at = thumb.getBoundingClientRect()
  if (props.rail) element.scrollTop += at.top - box.top - (element.clientHeight - at.height) / 2
  else element.scrollLeft += at.left - box.left - (element.clientWidth - at.width) / 2
}
watch(() => [props.current, props.rail, props.items.length] as const, reveal, { flush: 'post' })
onMounted(reveal)
</script>

<template>
  <nav
    ref="strip"
    class="deck-edit-strip"
    :class="{ rail }"
    :aria-label="t('deckStrip')"
    data-testid="deck-strip"
  >
    <template v-for="(item, index) in items" :key="item.key">
      <button
        type="button"
        class="deck-edit-thumb"
        :aria-current="index === current"
        :aria-label="label(index)"
        :data-fits="item.fits === null ? undefined : String(item.fits)"
        :data-testid="`deck-thumb-${index + 1}`"
        @click="emit('go', index)"
      >
        <img v-if="item.thumb" :src="item.thumb" alt="" width="96" height="54" draggable="false" />
        <span class="deck-edit-thumb-number" aria-hidden="true">{{ item.question ? '?' : index + 1 }}</span>
      </button>
      <button
        v-if="index === addAfter"
        type="button"
        class="deck-edit-add"
        :aria-label="t('deckAddSlide')"
        :disabled="!canAdd || !editable"
        data-testid="deck-strip-add"
        @click="emit('add')"
      >
        <AppIcon name="plus" :size="20" />
      </button>
    </template>
  </nav>
</template>
