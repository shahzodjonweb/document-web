<script setup lang="ts">
/**
 * Where inPAY sends the browser after its payment page. It is shown signed out
 * too: a payment started in the Telegram bot comes back to a browser that has
 * no session here.
 *
 * Only the payment's id in the address is read. Whatever inPAY adds to the
 * address is never looked at: the result is the server's own answer, which it
 * gets from inPAY itself.
 */
const props = defineProps<{ checkoutId: string }>()
const { t, path, date } = useLocale()
const ws = useWorkspace()
const { money } = usePricing()
// Read every 3 s while it is pending, for two minutes.
const pay = useCheckout({ every: 3000, limit: 2 * 60_000 })
const loading = ref(true)
const checkout = computed(() => pay.checkout.value)
const known = computed(() => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(props.checkoutId))
onMounted(async () => {
  if (known.value) await pay.find(props.checkoutId)
  loading.value = false
})
// The first read may be the one that turns the payment paid, after the session was read.
watch(
  () => checkout.value?.status,
  async (status) => {
    if (status !== 'paid' || checkout.value?.test || !ws.user.value) return
    await ws.init()
    await ws.loadAccount().catch(() => {})
  },
)

type State = 'loading' | 'missing' | 'unreachable' | 'confirming' | 'later' | 'paid' | 'ended' | 'refunded'
const state = computed<State>(() => {
  const value = checkout.value
  if (loading.value) return 'loading'
  if (!value) return pay.missing.value || !known.value ? 'missing' : 'unreachable'
  if (value.status === 'pending') return pay.waitedOut.value ? 'later' : 'confirming'
  if (value.status === 'paid' || value.status === 'refunded') return value.status
  return 'ended'
})
const SYMBOL: Record<State, { icon: string; tone?: string }> = {
  loading: { icon: 'loader' },
  confirming: { icon: 'loader' },
  later: { icon: 'clock' },
  paid: { icon: 'checks', tone: 'success' },
  ended: { icon: 'alert' },
  refunded: { icon: 'receipt' },
  missing: { icon: 'search' },
  unreachable: { icon: 'alert' },
}
const ENDED: Record<string, string> = {
  failed: 'checkoutFailed',
  cancelled: 'checkoutCancelled',
  expired: 'checkoutExpired',
}
const plan = computed(() => (checkout.value ? t(checkout.value.plan) : ''))
const title = computed(() => {
  switch (state.value) {
    case 'loading':
      return t('checkoutLooking')
    case 'confirming':
      return t('checkoutConfirmingTitle')
    case 'later':
      return t('checkoutLaterTitle')
    case 'paid':
      return t(checkout.value?.test ? 'checkoutTestPaidTitle' : 'checkoutPaidTitle')
    case 'refunded':
      return t('checkoutRefundedTitle')
    case 'ended':
      return t('checkoutNotDoneTitle')
    case 'missing':
      return t('checkoutMissingTitle')
    default:
      return t('checkoutTitle')
  }
})
const lead = computed(() => {
  const value = checkout.value
  switch (state.value) {
    case 'confirming':
      return t('checkoutConfirmingBody')
    case 'later':
      return t('checkoutLaterBody')
    case 'paid':
      if (value?.test) return t('checkoutTestPaid')
      return value?.active_until
        ? t('checkoutPlanActive', { plan: plan.value, date: date(value.active_until) })
        : t('checkoutPlanOn', { plan: plan.value })
    case 'refunded':
      return t('checkoutRefunded')
    case 'ended':
      return t(ENDED[value?.status || ''] || 'checkoutFailed')
    case 'missing':
      return t('checkoutMissingBody')
    case 'unreachable':
      return t('checkoutCheckFailed')
    default:
      return ''
  }
})
// A payment started in the bot goes back to the bot; any other, into the app.
const bot = computed(() =>
  checkout.value?.channel === 'bot' ? httpsLink(checkout.value.bot_url, 't.me') : null,
)
const receipt = computed(() => httpsLink(checkout.value?.receipt_url))
const moneyTaken = computed(
  () => state.value === 'ended' && ['failed', 'expired'].includes(checkout.value?.status || ''),
)
</script>

<template>
  <section class="pay-return" :data-state="state" data-testid="pay-return" aria-live="polite">
    <span class="result-symbol" :class="SYMBOL[state].tone"
      ><AppIcon
        :name="SYMBOL[state].icon"
        :size="34"
        :class="{ spin: state === 'loading' || state === 'confirming' }"
    /></span>
    <h1>{{ title }}</h1>
    <p v-if="lead" class="pay-return-lead">{{ lead }}</p>
    <p v-if="checkout" class="pay-return-sum" data-testid="pay-return-sum">
      {{ plan }} · {{ money(checkout.amount) }}
    </p>
    <p v-if="checkout?.test && state !== 'paid'" class="warning-banner" data-testid="checkout-test">
      <AppIcon name="info" :size="18" /><span>{{ t('checkoutTestNote') }}</span>
    </p>
    <p v-if="moneyTaken" class="field-hint">
      {{ t('checkoutMoneyTaken') + ' '
      }}<NuxtLink class="text-link" :to="path(ws.user.value ? '/app/support' : '/help')">{{
        t('navHelp')
      }}</NuxtLink>
    </p>
    <ErrorBanner v-if="state === 'later' && pay.failed.value" :message="t('checkoutCheckFailed')" />
    <p
      v-else-if="state === 'later' && pay.notYet.value && !pay.checking.value"
      class="field-hint"
      role="status"
    >
      {{ t('checkoutNotYet') }}
    </p>

    <div v-if="state !== 'loading' && state !== 'confirming'" class="pay-return-actions">
      <button
        v-if="state === 'later' || state === 'unreachable'"
        class="button primary"
        type="button"
        :disabled="pay.checking.value"
        data-testid="pay-return-check"
        @click="pay.check(checkoutId)"
      >
        <AppIcon name="rotate" :size="16" />{{
          pay.checking.value ? t('checkoutChecking') : t('checkoutCheckAgain')
        }}
      </button>
      <a
        v-if="bot"
        class="button"
        :class="state === 'later' ? 'secondary' : 'primary'"
        :href="bot"
        rel="noopener noreferrer"
        data-testid="pay-return-telegram"
        ><AppIcon name="send" :size="16" />{{ t('checkoutBackToTelegram') }}</a
      >
      <NuxtLink
        v-else-if="state === 'ended'"
        class="button primary"
        :to="path('/app/billing')"
        data-testid="pay-return-billing"
        >{{ t('retry') }}</NuxtLink
      >
      <NuxtLink
        v-else
        class="button"
        :class="state === 'later' || state === 'unreachable' ? 'secondary' : 'primary'"
        :to="path('/app')"
        data-testid="pay-return-open"
        >{{ t('checkoutOpenApp') }}</NuxtLink
      >
      <a
        v-if="state === 'paid' && receipt"
        class="button secondary"
        :href="receipt"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="pay-return-receipt"
        ><AppIcon name="receipt" :size="16" />{{ t('checkoutReceipt') }}</a
      >
    </div>
  </section>
</template>
