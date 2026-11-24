<script setup lang="ts">
/**
 * Where inPAY's page for saving a card sends the customer back to
 * (/app/card/{id}), signed in: the card was saved from the billing page.
 *
 * Only the card's id in the address is read. The server asks inPAY whether the
 * card is saved and, once it is, pays for the plan it was saved for, once: the
 * answer here is the server's, never anything inPAY adds to the address.
 */
import type { SavedCardState } from '../../generated/api/types'
const props = defineProps<{ cardId: string }>()
const { t, path } = useLocale()
const ws = useWorkspace()
const { money } = usePricing()
const renewal = useRenewal()
const card = ref<SavedCardState | null>(null)
const loading = ref(true)
const checking = ref(false)
const missing = ref(false)
// Asked every 4 s while inPAY has not answered, for a minute; then on the customer's word.
const EVERY = 4000
const LIMIT = 15
const tries = ref(0)
let timer: ReturnType<typeof setTimeout> | undefined
const known = computed(() => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(props.cardId))
const charge = computed(() => card.value?.charge ?? null)
const waiting = computed(() => card.value?.status === 'binding' || charge.value?.status === 'pending')

async function look() {
  checking.value = true
  try {
    card.value = await ws.api<SavedCardState>(`/billing/cards/${props.cardId}`)
  } catch (e: any) {
    if (e.data?.error?.code === 'not_found') missing.value = true
  } finally {
    checking.value = false
  }
}
function schedule() {
  if (timer) clearTimeout(timer)
  if (!waiting.value || tries.value >= LIMIT) return
  timer = setTimeout(async () => {
    tries.value += 1
    await look()
    schedule()
  }, EVERY)
}
onMounted(async () => {
  if (known.value) await look()
  else missing.value = true
  loading.value = false
  schedule()
})
onBeforeUnmount(() => timer && clearTimeout(timer))
async function again() {
  tries.value = 0
  await look()
  schedule()
}
// The plan is on: the frame takes it up, and the billing page's panels show the card.
watch(
  () => charge.value?.status,
  async (status) => {
    if (status !== 'paid') return
    await ws.init()
    await Promise.all([ws.loadAccount().catch(() => {}), renewal.load()])
  },
)

type State =
  | 'loading'
  | 'waiting'
  | 'later'
  | 'paid'
  | 'failed'
  | 'pending'
  | 'saved'
  | 'closed'
  | 'missing'
  | 'unreachable'
const state = computed<State>(() => {
  if (loading.value) return 'loading'
  if (missing.value) return 'missing'
  const value = card.value
  if (!value) return 'unreachable'
  if (value.charge)
    return value.charge.status === 'paid' ? 'paid' : value.charge.status === 'failed' ? 'failed' : 'pending'
  if (value.status === 'binding') return tries.value >= LIMIT ? 'later' : 'waiting'
  return value.status === 'active' ? 'saved' : 'closed'
})
const SYMBOL: Record<State, { icon: string; tone?: string }> = {
  loading: { icon: 'loader' },
  waiting: { icon: 'loader' },
  later: { icon: 'clock' },
  paid: { icon: 'checks', tone: 'success' },
  failed: { icon: 'alert' },
  pending: { icon: 'clock' },
  saved: { icon: 'check', tone: 'success' },
  closed: { icon: 'alert' },
  missing: { icon: 'search' },
  unreachable: { icon: 'alert' },
}
const TITLE: Record<State, string> = {
  loading: 'checkoutLooking',
  waiting: 'cardReturnTitle',
  later: 'cardWaitingTitle',
  paid: 'checkoutPaidTitle',
  failed: 'cardNotPaidTitle',
  pending: 'checkoutLaterTitle',
  saved: 'cardSavedTitle',
  closed: 'cardClosedTitle',
  missing: 'checkoutMissingTitle',
  unreachable: 'checkoutTitle',
}
const lead = computed(() => {
  switch (state.value) {
    case 'later':
      return t('cardWaitingBody')
    case 'saved':
      return t('cardSavedBody', { last4: card.value?.last4 || '' })
    case 'closed':
      return t('cardClosedBody')
    case 'missing':
      return t('checkoutMissingBody')
    case 'unreachable':
      return t('checkoutCheckFailed')
    default:
      return ''
  }
})
const sum = computed(() => {
  if (charge.value) return `${t(charge.value.plan)} · ${money(charge.value.amount)}`
  return card.value?.plan ? t(card.value.plan) : ''
})
// Back to inPAY's own page, while it is open: never anywhere else.
const inpayPage = computed(() => checkoutDestination(card.value?.bind_url))
</script>

<template>
  <section class="pay-return" :data-state="state" data-testid="card-return" aria-live="polite">
    <span class="result-symbol" :class="SYMBOL[state].tone"
      ><AppIcon
        :name="SYMBOL[state].icon"
        :size="34"
        :class="{ spin: state === 'loading' || state === 'waiting' }"
    /></span>
    <h1>{{ t(TITLE[state]) }}</h1>
    <p v-if="lead" class="pay-return-lead">{{ lead }}</p>
    <p v-if="sum && state !== 'missing'" class="pay-return-sum" data-testid="card-return-sum">{{ sum }}</p>
    <CardChargeResult v-if="charge" :charge="charge" />

    <div v-if="state !== 'loading' && state !== 'waiting'" class="pay-return-actions">
      <button
        v-if="state === 'later' || state === 'unreachable' || state === 'pending'"
        class="button primary"
        type="button"
        :disabled="checking"
        data-testid="card-return-check"
        @click="again"
      >
        <AppIcon name="rotate" :size="16" />{{ checking ? t('checkoutChecking') : t('checkoutCheckAgain') }}
      </button>
      <a
        v-if="state === 'later' && inpayPage"
        class="button secondary"
        :href="inpayPage"
        rel="noopener noreferrer"
        data-testid="card-return-inpay"
        >{{ t('cardBackToInpay') }}</a
      >
      <NuxtLink
        class="button"
        :class="state === 'later' || state === 'unreachable' || state === 'pending' ? 'secondary' : 'primary'"
        :to="path('/app/billing')"
        data-testid="card-return-billing"
        >{{ t('navBilling') }}</NuxtLink
      >
    </div>
  </section>
</template>
