<script setup lang="ts">
/**
 * How the deck looks: the slide on screen's layout (the chooser of those that hold all
 * its words), then the design of the whole deck. A design picked is saved at once, as a
 * new version every slide is drawn again from; Undo in the snackbar puts the last one back.
 */
import type { DeckSection } from '~/composables/useDeckEditor'

const props = defineProps<{ section: DeckSection | null; number: number; isCover: boolean }>()
const emit = defineEmits<{ layout: [sectionId: string] }>()

const { t } = useLocale()
const deck = useDeckEditor()
const pictures = useDeckPictures()

const current = computed(() => deck.draft.value?.render?.design ?? '')
const chosen = ref('')
watch(current, (design) => (chosen.value = design), { immediate: true })
// A pick goes to the server at once; one it refuses leaves the picker on the design the deck has.
watch(chosen, async (design) => {
  if (!design || design === current.value) return
  if (!(await pictures.setDesign(design))) chosen.value = current.value
})
onMounted(() => void pictures.loadDesigns())
const { locale } = useLocale()
// Another language asks for the designs' names in it.
watch(locale, () => void pictures.loadDesigns())

const layoutName = computed(() => {
  const id = props.section?.layout || 'auto'
  return id === 'quote' ? t('deckLayoutQuote') : t(`layout.${id}`)
})
const busy = computed(() => pictures.running.value?.action === 'design')
</script>

<template>
  <div class="deck-design" data-testid="deck-design">
    <section class="deck-design-layout">
      <h3>{{ t('deckDesignThisSlide', { n: number }) }}</h3>
      <p v-if="!section || isCover" class="field-hint" data-testid="deck-design-no-layout">
        {{ t('deckDesignNoLayout') }}
      </p>
      <div v-else class="deck-design-layout-row">
        <span data-testid="deck-design-layout-name">{{ layoutName }}</span>
        <button
          type="button"
          class="button secondary small"
          data-testid="deck-design-layout"
          :disabled="!deck.editable.value"
          @click="emit('layout', section.id)"
        >
          {{ t('deckPickLayout') }}
        </button>
      </div>
    </section>
    <section class="deck-design-whole">
      <h3>{{ t('deckDesignWhole') }}</h3>
      <p v-if="pictures.designsFailed.value" class="warning-banner" role="alert" data-testid="deck-design-failed">
        <span>{{ t('genericError') }}</span
        ><button type="button" class="text-link" data-testid="deck-design-retry" @click="pictures.loadDesigns()">
          {{ t('retry') }}
        </button>
      </p>
      <p v-else-if="!pictures.designs.value.length" class="loading-state">
        <AppIcon name="loader" class="spin" :size="20" />{{ t('loading') }}
      </p>
      <DeckDesignPicker
        v-else
        v-model="chosen"
        :categories="pictures.designs.value"
        :disabled="!deck.editable.value || busy"
      />
      <p class="deck-pictures-status" role="status" aria-live="polite" data-testid="deck-design-status">
        <template v-if="busy"><AppIcon name="loader" class="spin" :size="16" />{{ t('deckDesignWorking') }}</template>
        <template v-else>{{ pictures.message.value }}</template>
      </p>
    </section>
  </div>
</template>
