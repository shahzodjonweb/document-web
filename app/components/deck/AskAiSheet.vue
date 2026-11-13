<script setup lang="ts">
/**
 * ✨ A change the AI makes, for the slide on screen or the whole deck: the one thing in
 * the deck editor that uses an AI edit, said above its button. It starts the way a task's
 * page does (JobDetail's revise): a change draft of this deck, opened in Create, where
 * the price is shown before anything runs. The deck's own edits are saved first, so the
 * AI starts from the deck as it is now.
 */
import type { DeckSection } from '~/composables/useDeckEditor'

const props = defineProps<{ section: DeckSection | null; number: number }>()

const { t, path } = useLocale()
const uid = useId()
const ws = useWorkspace()
const deck = useDeckEditor()

const scope = ref<'slide' | 'deck'>('slide')
const change = ref('')
const working = ref(false)
const error = ref('')
const PRESETS = ['deckAskShorter', 'deckAskSimpler', 'deckAskMore', 'deckAskExample'] as const
/** A language switch offers the two the deck is not in, and is for the whole deck. */
const LANGUAGES = { en: 'deckAskEnglish', ru: 'deckAskRussian', uz: 'deckAskUzbek' } as const
const languages = computed(() =>
  (Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[]).filter((code) => code !== deck.deckLocale.value),
)
watch(
  () => props.section?.id,
  (id) => {
    if (!id && scope.value === 'slide') scope.value = 'deck'
  },
  { immediate: true },
)

function preset(key: string, whole = false) {
  if (whole) scope.value = 'deck'
  const words = t(key)
  change.value = change.value.trim() ? `${change.value.trim()}\n${words}` : words
}

async function go() {
  const words = change.value.trim()
  if (!words || working.value || !deck.editable.value) return
  working.value = true
  error.value = ''
  try {
    if (!(await deck.flush())) {
      error.value = t('editorNotSaved')
      return
    }
    const slide = scope.value === 'slide' && props.section ? props.section.id : ''
    const draft = await ws.api<{ id: string }>('/generation/drafts', {
      method: 'POST',
      body: {
        prompt: words,
        options: {
          revise_draft_id: deck.draftId.value,
          ...(slide ? { revise_section_ids: [slide], revise_base_version: deck.version.value } : {}),
        },
      },
    })
    await navigateTo(path(`/app/create/${draft.id}`))
  } catch (e: any) {
    error.value = e?.data?.error?.message || t('genericError')
  } finally {
    working.value = false
  }
}
</script>

<template>
  <form class="deck-ask" data-testid="deck-ask" @submit.prevent="go">
    <div class="deck-ask-scope">
      <span :id="`${uid}-scope`">{{ t('deckAskScope') }}</span>
      <div class="category-tabs" role="group" :aria-labelledby="`${uid}-scope`">
        <button
          type="button"
          :class="{ selected: scope === 'slide' }"
          :aria-pressed="scope === 'slide'"
          :disabled="!section"
          data-testid="deck-ask-slide"
          @click="scope = 'slide'"
        >
          {{ t('deckAskThisSlide', { n: number }) }}
        </button>
        <button
          type="button"
          :class="{ selected: scope === 'deck' }"
          :aria-pressed="scope === 'deck'"
          data-testid="deck-ask-deck"
          @click="scope = 'deck'"
        >
          {{ t('deckAskWholeDeck') }}
        </button>
      </div>
    </div>
    <div class="deck-ask-presets" role="group" :aria-label="t('deckAskPresets')">
      <button v-for="key in PRESETS" :key="key" type="button" class="button secondary small" @click="preset(key)">
        {{ t(key) }}
      </button>
      <button
        v-for="code in languages"
        :key="code"
        type="button"
        class="button secondary small"
        :data-testid="`deck-ask-to-${code}`"
        @click="preset(LANGUAGES[code], true)"
      >
        <AppIcon name="languages" :size="15" />{{ t(LANGUAGES[code]) }}
      </button>
    </div>
    <label class="form-field">
      <span>{{ t('deckAskLabel') }}</span>
      <textarea v-model="change" rows="3" maxlength="2000" data-testid="deck-ask-text" />
    </label>
    <p class="field-hint" data-testid="deck-ask-cost">{{ t('deckAskCost') }}</p>
    <p class="field-hint">{{ t('deckAskKept') }}</p>
    <p v-if="error" class="warning-banner" role="alert" data-testid="deck-ask-error">{{ error }}</p>
    <button
      type="submit"
      class="button primary"
      data-testid="deck-ask-go"
      :disabled="!change.trim() || working || !deck.editable.value"
    >
      <AppIcon v-if="working" name="loader" class="spin" :size="17" />{{ working ? t('deckAskWorking') : t('deckAskGo') }}
    </button>
  </form>
</template>
