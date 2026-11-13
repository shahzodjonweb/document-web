<script setup lang="ts">
/**
 * The deck's pictures: Add pictures to all slides, then the slide on screen's own —
 * the picture it wears, the ones on offer (a tap puts one on), Another picture,
 * Remove, From my phone and Find more. None uses an AI edit.
 *
 * Each runs on the server while the deck waits (useDeckPictures); what came of it is
 * said in one live line here and, for what can be undone, in the snackbar with Undo.
 */
import type { DeckSection } from '~/composables/useDeckEditor'

const props = defineProps<{
  /** The slide on screen, or null on a question slide. */
  section: DeckSection | null
  number: number
}>()
const emit = defineEmits<{ phone: [sectionId: string] }>()

const { t } = useLocale()
const deck = useDeckEditor()
const pictures = useDeckPictures()

const query = ref('')
const state = computed(() => pictures.state.value)
const photo = computed(() => (props.section ? pictures.photos.value[props.section.id] : undefined))
const worn = computed(() => photo.value?.asset_id ?? null)
const offered = computed(() => (photo.value?.candidates ?? []).filter((candidate) => candidate.asset_id !== worn.value))
const anyOffered = computed(() => (photo.value?.offered ?? photo.value?.candidates?.length ?? 0) > 0)
const running = computed(() => pictures.running.value)
const idle = computed(() => !running.value && deck.editable.value)
const full = computed(() => !!state.value && state.value.pinned >= state.value.per_deck)
const workingLine = computed(() => {
  const now = running.value
  if (!now) return ''
  if (now.action === 'fill') return t('deckPicturesWorking')
  if (now.action === 'search') return t('deckPicturesSearching')
  if (now.action === 'upload') return t('deckPictureUploading')
  if (now.action === 'design') return t('deckDesignWorking')
  return t('deckPictureWorking')
})
// The query box starts from the slide's own subject, which is already English words.
watch(
  () => props.section?.id,
  () => (query.value = props.section?.image_query ?? ''),
  { immediate: true },
)
// What was said about the last slide is not said about this one.
watch(
  () => props.section?.id,
  () => {
    if (!running.value) pictures.message.value = ''
  },
)

function find() {
  const words = query.value.trim()
  if (props.section && words) void pictures.search(props.section.id, words)
}
</script>

<template>
  <div class="deck-pictures" data-testid="deck-pictures">
    <p class="field-hint">{{ t('deckPicturesFree') }}</p>

    <section v-if="state?.stock" class="deck-pictures-all">
      <button
        type="button"
        class="button primary"
        data-testid="deck-pictures-all"
        :disabled="!idle || full || !state.fills_left"
        @click="pictures.fill()"
      >
        <AppIcon name="image" :size="18" />{{ t('deckPicturesAll') }}
      </button>
      <p class="field-hint" data-testid="deck-pictures-count">
        <span>{{ t('deckPicturesCount', { pinned: state.pinned, max: state.per_deck }) }}</span>
        <span>{{ t('deckPicturesLeftToday', { count: state.fills_left }) }}</span>
      </p>
      <div class="category-tabs deck-pictures-kind" role="group" :aria-label="t('deckPicturesKind')">
        <button
          type="button"
          :class="{ selected: pictures.style.value === 'photo' }"
          :aria-pressed="pictures.style.value === 'photo'"
          data-testid="deck-pictures-photo"
          @click="pictures.style.value = 'photo'"
        >
          {{ t('deckPicturesPhoto') }}
        </button>
        <button
          type="button"
          :class="{ selected: pictures.style.value === 'illustration' }"
          :aria-pressed="pictures.style.value === 'illustration'"
          data-testid="deck-pictures-drawing"
          @click="pictures.style.value = 'illustration'"
        >
          {{ t('deckPicturesDrawing') }}
        </button>
      </div>
    </section>

    <p v-if="!section" class="field-hint" data-testid="deck-pictures-questions">{{ t('deckPicturesQuestions') }}</p>
    <section v-else class="deck-pictures-slide" data-testid="deck-pictures-slide">
      <h3>{{ t('deckPicturesSlide', { n: number }) }}</h3>
      <div class="deck-pictures-row">
        <figure v-if="worn" class="deck-pictures-worn">
          <img :src="pictures.pictureUrl(worn)" :alt="t('deckPicturesCurrent')" data-testid="deck-picture-worn" />
        </figure>
        <p v-else class="deck-pictures-empty" data-testid="deck-picture-none">{{ t('deckPicturesNone') }}</p>
        <ul v-if="offered.length" class="deck-pictures-offered" :aria-label="t('deckPicturesOnOffer')">
          <li v-for="(candidate, at) in offered" :key="candidate.asset_id">
            <button
              type="button"
              class="deck-pictures-pick"
              :disabled="!idle || (!worn && full)"
              :aria-label="t('deckPictureOffered', { n: at + 1 })"
              :data-testid="`deck-picture-offer-${at + 1}`"
              @click="pictures.next(section.id, candidate.asset_id)"
            >
              <img :src="pictures.pictureUrl(candidate.asset_id)" alt="" loading="lazy" />
            </button>
          </li>
        </ul>
      </div>
      <p v-if="offered.length" class="field-hint">{{ t('deckPicturesOnOffer') }}</p>
      <div class="deck-pictures-actions">
        <button
          type="button"
          class="button secondary small"
          data-testid="deck-picture-another"
          :disabled="!idle || !anyOffered || (!worn && full)"
          @click="pictures.next(section.id)"
        >
          <AppIcon name="replace" :size="16" />{{ t('deckPictureAnother') }}
        </button>
        <button
          type="button"
          class="button secondary small"
          data-testid="deck-picture-remove"
          :disabled="!idle || !worn"
          @click="pictures.remove(section.id)"
        >
          <AppIcon name="trash" :size="16" />{{ t('deckPictureRemove') }}
        </button>
        <button
          type="button"
          class="button secondary small"
          data-testid="deck-picture-phone"
          :disabled="!idle || (!worn && full)"
          @click="emit('phone', section.id)"
        >
          <AppIcon name="camera" :size="16" />{{ t('deckPictureFromPhone') }}
        </button>
      </div>
      <form v-if="state?.stock" class="deck-pictures-find" @submit.prevent="find">
        <label class="form-field">
          <span>{{ t('deckPictureFindLabel') }}</span>
          <input
            v-model="query"
            type="search"
            inputmode="search"
            lang="en"
            autocapitalize="none"
            autocomplete="off"
            maxlength="100"
            :placeholder="t('deckPictureFindHint')"
            data-testid="deck-picture-query"
          />
          <small>{{ t('deckPicturesLeftToday', { count: state.searches_left }) }}</small>
        </label>
        <button
          type="submit"
          class="button secondary"
          data-testid="deck-picture-find"
          :disabled="!idle || !query.trim() || !state.searches_left"
        >
          <AppIcon name="search" :size="16" />{{ t('deckPictureFindMore') }}
        </button>
      </form>
    </section>

    <p class="deck-pictures-status" role="status" aria-live="polite" data-testid="deck-pictures-status">
      <template v-if="workingLine"><AppIcon name="loader" class="spin" :size="16" />{{ workingLine }}</template>
      <template v-else>{{ pictures.message.value }}</template>
    </p>
  </div>
</template>
