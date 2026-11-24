<script setup lang="ts">
/**
 * The card a customer saved in the bot (inPAY Avto PAY) and its monthly renewal.
 * Saving a card and turning renewal on happen in the bot; here the customer sees
 * when the next charge is, turns renewal off, and removes the card. Nothing shows
 * for a customer with neither, or against a platform without the endpoint.
 */
import type { AutoRenewalState } from '../../generated/api/types'
const { t, date } = useLocale()
const ws = useWorkspace()
const { money } = usePricing()
const state = ref<AutoRenewalState | null>(null)
const busy = ref(false)
const confirming = ref(false)
const failed = ref(false)
const card = computed(() => state.value?.card ?? null)
const renewal = computed(() => state.value?.renewal ?? null)
const on = computed(() => renewal.value?.status === 'on')
async function load() {
  try {
    state.value = await ws.api<AutoRenewalState>('/billing/renewal')
  } catch {
    state.value = null
  }
}
onMounted(load)
async function act(path: string) {
  busy.value = true
  failed.value = false
  try {
    state.value = await ws.api<AutoRenewalState>(path, { method: 'DELETE' })
    confirming.value = false
  } catch {
    failed.value = true
  } finally {
    busy.value = false
  }
}
const turnOff = () => act('/billing/renewal')
const removeCard = () => card.value && act(`/billing/cards/${card.value.id}`)
</script>
<template>
  <section v-if="card || on" class="panel renewal-panel" data-testid="renewal">
    <h2>{{ t('renewalTitle') }}</h2>
    <p v-if="on && renewal" data-testid="renewal-on">
      {{
        t('renewalOn', {
          date: date(renewal.renews_at),
          price: renewal.amount ? money(renewal.amount) : '—',
          last4: renewal.card_last4,
        })
      }}
    </p>
    <p v-else-if="renewal?.status === 'stopped'" data-testid="renewal-stopped">{{ t('renewalStopped') }}</p>
    <p v-else class="muted" data-testid="renewal-off">{{ t('renewalOff') }}</p>
    <p v-if="on && renewal?.attempts && renewal.next_try_at" class="warning-banner" role="status">
      {{ t('renewalRetry', { date: date(renewal.next_try_at) }) }}
    </p>
    <p v-if="card" class="muted" data-testid="saved-card">{{ t('renewalCard', { last4: card.last4 }) }}</p>
    <p v-if="failed" class="warning-banner" role="alert">{{ t('renewalActionFailed') }}</p>
    <div class="renewal-actions">
      <button
        v-if="on"
        class="button secondary small"
        :disabled="busy"
        data-testid="renewal-turn-off"
        @click="turnOff"
      >
        {{ t('renewalTurnOff') }}
      </button>
      <template v-if="card">
        <button
          v-if="!confirming"
          class="button secondary small"
          :disabled="busy"
          data-testid="card-remove"
          @click="confirming = true"
        >
          {{ t('renewalRemoveCard', { last4: card.last4 }) }}
        </button>
        <template v-else>
          <span class="renewal-confirm">{{ t('renewalRemoveConfirm') }}</span>
          <button
            class="button primary small"
            :disabled="busy"
            data-testid="card-remove-yes"
            @click="removeCard"
          >
            {{ t('renewalRemoveYes') }}
          </button>
          <button class="button secondary small" :disabled="busy" @click="confirming = false">
            {{ t('cancel') }}
          </button>
        </template>
      </template>
    </div>
    <p class="muted renewal-note">{{ t('renewalInBot') }}</p>
  </section>
</template>
<style scoped>
.renewal-panel {
  margin-top: var(--space-6);
  padding: var(--space-5) var(--space-6);
}
.renewal-panel h2 {
  margin: 0 0 var(--space-2);
  font-size: var(--text-lg);
}
.renewal-panel p {
  margin: 0 0 var(--space-2);
}
.renewal-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-3) 0 var(--space-2);
}
.renewal-confirm {
  flex-basis: 100%;
}
.renewal-note {
  font-size: var(--text-sm);
}
@media (max-width: 560px) {
  .renewal-panel {
    padding: var(--space-4);
  }
}
</style>
