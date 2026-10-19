<script setup lang="ts">
import type { CvCategory, CvTemplate } from '../composables/useCvTemplates'
/**
 * The CV template picker, in the Mini App's setup page and in Create with AI.
 * Auto leaves the choice to the AI, which keeps to the default (a classic
 * look) unless the description calls for another; a template picked here is
 * used as it is. Each card shows the template's real first page, rendered by
 * the platform with a fictional sample CV, and falls back to a drawn swatch of
 * its colours and layout when that image does not load.
 */
const props = defineProps<{
  /** `auto` or a template id. */
  modelValue: string
  categories: CvCategory[]
  defaultId?: string
  /** Smaller cards, for the picker inside the Create with AI form. */
  compact?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useLocale()
const category = ref('')
// A thumbnail that fails to load falls back to the drawn swatch.
const broken = reactive<Record<string, boolean>>({})
const holding = (id?: string) =>
  props.categories.find((group) => group.templates.some((entry) => entry.id === id))?.id
// The tabs open on the chosen template's category, or the default's on Auto,
// and follow a choice made elsewhere (a draft loaded with one). Choosing Auto
// leaves the tab where it is.
watch(
  () => [props.categories, props.modelValue] as const,
  () => {
    const known = props.categories.some((group) => group.id === category.value)
    category.value =
      holding(props.modelValue) ||
      (known ? category.value : holding(props.defaultId) || props.categories[0]?.id || '')
  },
  { immediate: true },
)
const shown = computed(() => props.categories.find((group) => group.id === category.value)?.templates || [])
const defaultName = computed(() => {
  for (const group of props.categories) {
    const found = group.templates.find((entry) => entry.id === props.defaultId)
    if (found) return found.name
  }
  return 'Classic Navy'
})
function choose(id: string) {
  if (id !== props.modelValue) emit('update:modelValue', id)
}
// The swatch: the page (tinted on paper templates), its side or band in the
// template's fill, and the name in its heading face and accent.
const drawStyle = (entry: CvTemplate) => {
  const tint = entry.colours.tint || '#FFFFFF'
  const dark = entry.tone === 'dark'
  return {
    '--cv-page': entry.tone === 'paper' ? tint : '#FFFFFF',
    '--cv-side': dark ? entry.colours.fill || entry.colours.accent : tint,
    '--cv-on-side': dark ? '#FFFFFF' : entry.colours.accent,
    '--cv-accent': entry.colours.accent,
    '--cv-rule': entry.colours.secondary || entry.colours.accent,
    '--cv-ink': entry.colours.ink || '#1A1A1A',
    fontFamily: entry.fonts.heading === 'serif' ? "Georgia, 'Times New Roman', serif" : 'var(--font-display)',
  }
}
</script>

<template>
  <div class="cv-picker" :class="{ compact }">
    <button
      type="button"
      class="deck-auto cv-auto"
      role="radio"
      :aria-checked="modelValue === 'auto'"
      data-testid="cv-template-auto"
      @click="choose('auto')"
    >
      <AppIcon name="sparkle" :size="20" />
      <span
        ><b>{{ t('cvSetupAuto') }}</b
        ><small>{{ t('cvSetupAutoHint', { template: defaultName }) }}</small></span
      >
      <AppIcon v-if="modelValue === 'auto'" name="check" :size="18" class="deck-check" />
    </button>
    <div
      v-if="categories.length > 1"
      class="category-tabs deck-categories cv-categories"
      role="group"
      :aria-label="t('cvSetupCategories')"
    >
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
    <div v-if="shown.length" class="cv-grid" role="radiogroup" :aria-label="t('cvSetupTemplate')">
      <button
        v-for="entry in shown"
        :key="entry.id"
        type="button"
        role="radio"
        class="cv-card"
        :aria-checked="modelValue === entry.id"
        :data-template="entry.id"
        @click="choose(entry.id)"
      >
        <span class="cv-cover" aria-hidden="true">
          <img
            v-if="entry.preview && !broken[entry.id]"
            class="cv-thumb"
            :src="entry.preview"
            alt=""
            loading="lazy"
            @error="broken[entry.id] = true"
          />
          <span v-else class="cv-draw" :class="`cv-draw-${entry.drawer}`" :style="drawStyle(entry)">
            <i class="cv-draw-side" /><b>Aa</b><i class="cv-draw-rule" /><i class="cv-draw-lines" />
            <i v-if="entry.photo" class="cv-draw-photo" />
          </span>
        </span>
        <span class="cv-name"
          >{{ entry.name }} <small v-if="entry.photo">{{ t('cvSetupPhoto') }}</small></span
        >
        <AppIcon v-if="modelValue === entry.id" name="check" :size="16" class="deck-check" />
      </button>
    </div>
  </div>
</template>
