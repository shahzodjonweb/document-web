<script setup lang="ts">
/**
 * An automatic payment on the billing page: waiting for it, or how it ended.
 * It shows what the server says and nothing more; the checks themselves are the
 * panel's (useCheckout).
 */
import type { Checkout } from '../../generated/api/types'
const props = defineProps<{
  checkout: Checkout
  checking?: boolean
  waitedOut?: boolean
  notYet?: boolean
  error?: string
}>()
const emit = defineEmits<{ check: []; pay: []; retry: [plan: string, term: 'month' | 'year'] }>()
const { t, path, date } = useLocale()
const { money } = usePricing()
const payable = computed(() => !!checkoutDestination(props.checkout.checkout_url))
const receipt = computed(() => httpsLink(props.checkout.receipt_url))
const paid = computed(() => {
  const values = { plan: t(props.checkout.plan), date: date(props.checkout.active_until) }
  if (props.checkout.test) return t('checkoutTestPaid')
  return t(props.checkout.active_until ? 'paymentApproved' : 'checkoutPaidPlain', values)
})
const ENDED: Record<string, string> = {
  failed: 'checkoutFailed',
  cancelled: 'checkoutCancelled',
  expired: 'checkoutExpired',
  refunded: 'checkoutRefunded',
}
</script>

<template>
  <section class="panel checkout-status" data-testid="checkout-status" aria-live="polite">
    <ErrorBanner v-if="error" :message="error" />
    <p v-if="checkout.test && checkout.status !== 'paid'" class="warning-banner" data-testid="checkout-test">
      <AppIcon name="info" :size="18" /><span>{{ t('checkoutTestNote') }}</span>
    </p>

    <template v-if="checkout.status === 'pending'">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">{{ t('methodAutomatic') }}</span>
          <h2>
            {{ checkout.term === 'year' ? t('planOneYear', { plan: t(checkout.plan) }) : t(checkout.plan) }} ·
            {{ money(checkout.amount) }}
          </h2>
        </div>
        <span class="status-badge" data-testid="checkout-waiting"
          ><AppIcon name="clock" :size="15" />{{ t('checkoutWaiting') }}</span
        >
      </div>
      <p class="muted">{{ t(waitedOut ? 'checkoutWaitedOut' : 'checkoutWaitingBody') }}</p>
      <div class="checkout-actions">
        <button
          v-if="payable"
          class="button primary"
          type="button"
          data-testid="checkout-continue"
          @click="emit('pay')"
        >
          {{ t('checkoutContinue') }}<AppIcon name="right" :size="17" />
        </button>
        <button
          class="button secondary"
          type="button"
          :disabled="checking"
          data-testid="checkout-check"
          @click="emit('check')"
        >
          <AppIcon name="rotate" :size="16" />{{ checking ? t('checkoutChecking') : t('checkoutCheck') }}
        </button>
      </div>
      <p v-if="notYet && !checking" class="field-hint" role="status" data-testid="checkout-not-yet">
        {{ t('checkoutNotYet') }}
      </p>
    </template>

    <div
      v-else-if="checkout.status === 'paid'"
      :class="checkout.test ? 'warning-banner' : 'success-banner'"
      role="status"
      data-testid="checkout-paid"
    >
      <AppIcon :name="checkout.test ? 'info' : 'check'" :size="18" />
      <span
        >{{ paid }}
        <a v-if="receipt" class="text-link" :href="receipt" target="_blank" rel="noopener noreferrer"
          >{{ t('checkoutReceipt') }}<AppIcon name="external" :size="14"
        /></a>
      </span>
    </div>

    <template v-else>
      <div class="info-banner" role="status" data-testid="checkout-ended">
        <AppIcon name="alert" :size="19" />
        <span
          >{{ t(ENDED[checkout.status] || 'checkoutFailed') }}
          <template v-if="checkout.status === 'failed' || checkout.status === 'expired'"
            >{{ t('checkoutMoneyTaken') + ' '
            }}<NuxtLink class="text-link" :to="path('/app/support')">{{ t('navHelp') }}</NuxtLink></template
          >
        </span>
      </div>
      <button
        v-if="checkout.status !== 'refunded'"
        class="button secondary"
        type="button"
        data-testid="checkout-retry"
        @click="emit('retry', checkout.plan, checkout.term === 'year' ? 'year' : 'month')"
      >
        {{ t('retry') }}
      </button>
    </template>
  </section>
</template>
