<script setup lang="ts">
// A deck's slide count and design, chosen before paying. Opened from the bot's
// review as a Telegram Mini App; what is chosen here beats what the
// description says, and the review in the chat is redrawn with the new price.
interface DeckDesign {
  id: string
  name: string
  theme: 'light' | 'dark' | 'bold'
  photo?: boolean
  pattern?: string
  heading_font?: string
  colours: Record<string, string>
}
interface DeckCategory {
  id: string
  name: string
  designs: DeckDesign[]
}
const route = useRoute()
const { t, locale } = useLocale()
const ws = useWorkspace()
const studio = useStudio()
const draftId = computed(() => String(route.query.draft || ''))
const draft = ref<any>(null)
const categories = ref<DeckCategory[]>([])
const category = ref('')
const design = ref('auto')
const pages = ref(7)
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const error = ref('')
const requestError = (e: any) => e.data?.error?.message || e.data?.message || t('genericError')
const ceiling = computed(
  () => studio.features.value.find((feature) => feature.id === 'ai.pptx')?.max_pages || 20,
)
// The description's own count, said beside the stepper when it differs.
const asked = computed(() => {
  const options = draft.value?.options || {}
  return options.pages == null ? options.requested_pages || options.length : null
})
const shown = computed(() => categories.value.find((group) => group.id === category.value)?.designs || [])
const chosenName = computed(() => {
  for (const group of categories.value) {
    const found = group.designs.find((entry) => entry.id === design.value)
    if (found) return found.name
  }
  return t('deckSetupAuto')
})
const telegram = () => (import.meta.client ? (window as any).Telegram?.WebApp : null)

async function load() {
  if (!ws.user.value || !draftId.value) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const [opened, listed] = await Promise.all([
      ws.api(`/generation/drafts/${draftId.value}`),
      ws.api(`/studio/deck-designs?locale=${locale.value}`),
      studio.config.value ? Promise.resolve() : studio.load(),
    ])
    if (opened.feature_id !== 'ai.pptx') throw { data: { message: t('deckSetupNotDeck') } }
    draft.value = opened
    categories.value = listed.categories
    const options = opened.options || {}
    pages.value = Math.min(options.pages ?? listed.default_pages ?? 7, ceiling.value)
    design.value = options.deck_design || 'auto'
    category.value =
      listed.categories.find((group: DeckCategory) => group.designs.some((entry) => entry.id === design.value))
        ?.id || listed.categories[0]?.id || ''
  } catch (e: any) {
    const status = e.statusCode || e.status || e.response?.status
    error.value = status === 404 ? t('deckSetupExpired') : requestError(e)
  } finally {
    loading.value = false
  }
}
function setPages(value: number) {
  pages.value = Math.max(1, Math.min(ceiling.value, value))
  saved.value = false
}
function choose(id: string) {
  design.value = id
  saved.value = false
}
async function save() {
  if (!draft.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    const result = await ws.api(`/generation/drafts/${draft.value.id}/setup`, {
      method: 'POST',
      body: { pages: pages.value, deck_design: design.value },
    })
    draft.value = result.draft
    saved.value = true
    // Back to the chat, where the review now shows the new count and price.
    telegram()?.HapticFeedback?.notificationOccurred?.('success')
    if (telegram()?.initData) setTimeout(() => telegram()?.close(), 700)
  } catch (e) {
    error.value = requestError(e)
  } finally {
    saving.value = false
  }
}
watch(() => ws.user.value?.id, load)
onMounted(load)
// A swatch of the design's cover: its ground, accent bar, title and rule.
const coverStyle = (entry: DeckDesign) => ({
  background: entry.colours.cover_fill,
  color: entry.colours.cover_ink,
  fontFamily: `'${entry.heading_font}', var(--font-display)`,
})
</script>

<template>
  <div class="deck-setup">
    <div class="page-heading">
      <div>
        <h1>{{ t('deckSetupTitle') }}</h1>
        <p>{{ t('deckSetupLead') }}</p>
      </div>
    </div>
    <ErrorBanner v-if="error" :message="error" />
    <div v-if="loading" class="loading-state"><AppIcon name="loader" class="spin" :size="28" />{{ t('loading') }}</div>
    <p v-else-if="!draftId" class="empty-state">{{ t('deckSetupExpired') }}</p>
    <template v-else-if="draft">
      <section class="panel deck-setup-count">
        <div class="meter-row" data-testid="deck-setup-pages">
          <span>{{ t('deckSetupSlides') }}</span
          ><span class="page-stepper">
            <button
              type="button"
              class="icon-button"
              data-testid="deck-setup-fewer"
              :aria-label="t('studioFewer')"
              :disabled="saving || pages <= 1"
              @click="setPages(pages - 1)"
            >
              −</button
            ><strong aria-live="polite">{{ pages }}</strong
            ><button
              type="button"
              class="icon-button"
              data-testid="deck-setup-more"
              :aria-label="t('studioMore')"
              :disabled="saving || pages >= ceiling"
              @click="setPages(pages + 1)"
            >
              +
            </button>
          </span>
        </div>
        <p v-if="asked && asked !== pages" class="field-hint" data-testid="deck-setup-asked">
          {{ t('deckSetupAsked', { count: asked }) }}
        </p>
      </section>

      <section class="panel deck-setup-designs">
        <h2>{{ t('deckSetupDesign') }}</h2>
        <button
          type="button"
          class="deck-auto"
          role="radio"
          :aria-checked="design === 'auto'"
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
            :data-design="entry.id"
            @click="choose(entry.id)"
          >
            <span class="deck-cover" :style="coverStyle(entry)" aria-hidden="true">
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
      </section>

      <div class="deck-setup-actions">
        <p v-if="saved" class="success-banner" role="status" data-testid="deck-setup-saved">
          <AppIcon name="check" :size="17" />{{ t('deckSetupSaved') }}
        </p>
        <button class="button primary" type="button" data-testid="deck-setup-save" :disabled="saving" @click="save">
          {{ t('deckSetupSave', { count: pages, design: chosenName }) }}
        </button>
      </div>
    </template>
  </div>
</template>
