<script setup lang="ts">
/**
 * What changed since the deck was opened or last sent, slide by slide, each a tap from
 * being shown: Review's list before Confirm, and More → All changes at any time.
 */
import { changesOf, type DeckChange, type DeckChangeKind } from '~/composables/useDeckSend'

defineProps<{ testid: string; title?: string }>()
const emit = defineEmits<{ show: [index: number] }>()

const { t } = useLocale()
const deck = useDeckEditor()

const WORDS: Record<DeckChangeKind, string> = {
  added: 'deckChangeAdded',
  moved: 'deckChangeMoved',
  text: 'deckChangeText',
  notes: 'deckChangeNotes',
  layout: 'deckChangeLayout',
}
const changes = computed(() => changesOf(deck.baseline.value, deck.content.value))
const changeText = (row: DeckChange) =>
  t('deckChangeRow', {
    n: (row.index ?? 0) + 1,
    what: row.cover ? t('deckCoverDetails') : row.what.map((word) => t(WORDS[word])).join(', '),
  })
const unchanged = computed(
  () =>
    !changes.value.rows.length &&
    !changes.value.questions &&
    changes.value.slidesBefore === changes.value.slidesAfter,
)
/** The first question slide, to show from the questions row; none once the quiz is gone. */
const firstQuestion = computed(() =>
  deck.content.value.questions?.length ? deck.sections.value.length : null,
)
defineExpose({ unchanged })
</script>

<template>
  <section class="deck-edit-changes" :data-testid="testid">
    <strong v-if="title">{{ title }}</strong>
    <ul>
      <li v-if="unchanged">{{ t('deckNoChanges') }}</li>
      <li v-if="changes.slidesBefore !== changes.slidesAfter" data-testid="deck-review-count">
        {{ t('deckSlidesCount', { a: changes.slidesBefore, b: changes.slidesAfter }) }}
      </li>
      <li v-for="row in changes.rows" :key="row.id ?? ''">
        <template v-if="row.index === null">{{
          t('deckChangeRemoved', { heading: row.removedHeading || t('deckUntitled') })
        }}</template>
        <template v-else>
          <span>{{ changeText(row) }}</span>
          <button
            type="button"
            class="text-link"
            :aria-label="`${t('editorShowIt')}: ${changeText(row)}`"
            @click="emit('show', row.index ?? 0)"
          >
            {{ t('editorShowIt') }}
          </button>
        </template>
      </li>
      <li v-if="changes.questions">
        <span>{{ t('deckChangeQuestions') }}</span>
        <button
          v-if="firstQuestion !== null"
          type="button"
          class="text-link"
          :aria-label="`${t('editorShowIt')}: ${t('deckChangeQuestions')}`"
          @click="emit('show', firstQuestion ?? 0)"
        >
          {{ t('editorShowIt') }}
        </button>
      </li>
    </ul>
  </section>
</template>
