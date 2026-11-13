<script setup lang="ts">
/**
 * The designs a deck can wear, by category, each as its real cover: the setup screen's
 * before a deck is made, and the slide editor's Design sheet after. Auto is offered
 * only before: a drawn deck already has a look, and changes it for one named here.
 */
export interface DeckDesign {
  id: string
  name: string
  theme: 'light' | 'dark' | 'bold'
  photo?: boolean
  pattern?: string
  composition?: string
  /** The design's real cover, rendered by the platform with a sample title. */
  preview?: string
  heading_font?: string
  colours: Record<string, string>
}
export interface DeckCategory {
  id: string
  name: string
  designs: DeckDesign[]
}

const design = defineModel<string>({ required: true })
const props = defineProps<{ categories: DeckCategory[]; auto?: boolean; disabled?: boolean }>()

const { t } = useLocale()
const category = ref('')
// A thumbnail that fails to load falls back to the drawn swatch.
const broken = reactive<Record<string, boolean>>({})
const shown = computed(() => props.categories.find((group) => group.id === category.value)?.designs || [])
// The chosen design's category opens first, and again when the list or the choice arrives.
watch(
  () => [props.categories, design.value] as const,
  ([groups, chosen]) => {
    if (groups.some((group) => group.id === category.value) && category.value) return
    category.value =
      groups.find((group) => group.designs.some((entry) => entry.id === chosen))?.id || groups[0]?.id || ''
  },
  { immediate: true },
)
function choose(id: string) {
  if (!props.disabled) design.value = id
}
// A swatch of the design's cover: its ground, accent bar, title and rule.
const coverStyle = (entry: DeckDesign) => ({
  background: entry.colours.cover_fill,
  color: entry.colours.cover_ink,
  fontFamily: `'${entry.heading_font}', var(--font-display)`,
})
</script>

<template>
  <div class="deck-design-picker">
    <button
      v-if="auto"
      type="button"
      class="deck-auto"
      role="radio"
      :aria-checked="design === 'auto'"
      :disabled="disabled"
      data-testid="deck-design-auto"
      @click="choose('auto')"
    >
      <AppIcon name="sparkle" :size="20" />
      <span
        ><b>{{ t('deckSetupAuto') }}</b
        ><small>{{ t('deckSetupAutoHint') }}</small></span
      >
      <AppIcon v-if="design === 'auto'" name="check" :size="18" class="deck-check" />
    </button>
    <div class="category-tabs deck-categories" role="group" :aria-label="t('deckSetupCategories')">
      <button
        v-for="group in categories"
        :key="group.id"
        type="button"
        :class="{ selected: category === group.id }"
        :aria-pressed="category === group.id"
        @click="category = group.id"
      >
        {{ group.name }}
      </button>
    </div>
    <div class="deck-grid" role="radiogroup" :aria-label="t('deckSetupDesign')">
      <button
        v-for="entry in shown"
        :key="entry.id"
        type="button"
        role="radio"
        class="deck-card"
        :aria-checked="design === entry.id"
        :disabled="disabled"
        :data-design="entry.id"
        @click="choose(entry.id)"
      >
        <span v-if="entry.preview && !broken[entry.id]" class="deck-cover" aria-hidden="true">
          <img class="deck-thumb" :src="entry.preview" alt="" loading="lazy" @error="broken[entry.id] = true" />
        </span>
        <span v-else class="deck-cover" :style="coverStyle(entry)" aria-hidden="true">
          <i class="deck-bar" :style="{ background: entry.colours.accent }" />
          <i
            v-if="entry.photo"
            class="deck-photo"
            :style="{ background: `linear-gradient(135deg, ${entry.colours.accent_soft}, ${entry.colours.accent})` }"
          />
          <i
            v-else
            class="deck-mark"
            :class="entry.pattern ? `pattern-${entry.pattern}` : ''"
            :style="{ color: entry.theme === 'bold' ? entry.colours.cover_ink : entry.colours.accent }"
          />
          <span class="deck-title">Aa</span>
          <i class="deck-rule" :style="{ background: entry.theme === 'bold' ? entry.colours.cover_ink : entry.colours.accent }" />
        </span>
        <span class="deck-name"
          >{{ entry.name }}<small v-if="entry.photo">{{ t('deckSetupPhoto') }}</small></span
        >
        <AppIcon v-if="design === entry.id" name="check" :size="16" class="deck-check" />
      </button>
    </div>
  </div>
</template>
