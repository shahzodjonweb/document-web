<script setup lang="ts">
/**
 * How a charge of a saved card went, as the server says: paid (and whether it
 * renews), failed and why, or still waiting for inPAY's answer.
 */
import type { CardCharge } from '../../generated/api/types'
const props = defineProps<{ charge: CardCharge }>()
const { t, date } = useLocale()
const { money } = usePricing()
const plan = computed(() => t(props.charge.plan))
</script>

<template>
  <div
    v-if="charge.status === 'paid'"
    class="card-charge-result success-banner"
    role="status"
    data-testid="card-charge-paid"
  >
    <AppIcon name="check" :size="18" />
    <span
      >{{
        charge.active_until
          ? t('paymentApproved', { plan, date: date(charge.active_until) })
          : t('checkoutPlanOn', { plan })
      }}
      <template v-if="charge.renews_at">
        {{
          t('cardRenewsOn', {
            date: date(charge.renews_at),
            price: money(charge.amount),
            last4: charge.last4,
          })
        }}</template
      ></span
    >
  </div>
  <div
    v-else-if="charge.status === 'failed'"
    class="card-charge-result info-banner"
    role="alert"
    data-testid="card-charge-failed"
  >
    <AppIcon name="alert" :size="19" />
    <span>{{ t('cardChargeFailed', { last4: charge.last4, reason: t(cardReason(charge)) }) }}</span>
  </div>
  <!-- Class order matters: `[class$='-banner']` rules space a banner by the end of its class list. -->
  <div v-else class="card-charge-result info-banner" role="status" data-testid="card-charge-pending">
    <AppIcon name="clock" :size="18" />
    <span>{{ t('cardChargePending') }}</span>
  </div>
</template>
