<script setup lang="ts">
/**
 * Cyrillic typed into an Uzbek deck, which is written in Latin letters: the first
 * changed line as it would read, and the choice. Nothing is changed until asked.
 */
defineProps<{ offer: { from: string; to: string } | null }>()
const emit = defineEmits<{ switch: []; keep: [] }>()

const { t } = useLocale()
</script>

<template>
  <!-- The live region stays mounted, or a screen reader may not announce what appears in it. -->
  <div class="deck-edit-notice" role="status">
    <section v-if="offer" class="deck-edit-latin info-banner" data-testid="deck-latin">
      <div>
        <strong>{{ t('deckLatinTitle') }}</strong>
        <p lang="uz">{{ offer.from }} → {{ offer.to }}</p>
      </div>
      <span>
        <button
          type="button"
          class="button primary small"
          data-testid="deck-latin-switch"
          @click="emit('switch')"
        >
          {{ t('deckLatinSwitch') }}
        </button>
        <button
          type="button"
          class="button secondary small"
          data-testid="deck-latin-keep"
          @click="emit('keep')"
        >
          {{ t('deckLatinKeep') }}
        </button>
      </span>
    </section>
  </div>
</template>
