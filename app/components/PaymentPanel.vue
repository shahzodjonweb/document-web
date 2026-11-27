<script setup lang="ts">
/**
 * Paying for a plan, the way the server offers.
 *
 * Automatically, through inPAY: the customer pays on inPAY's own page and the
 * plan switches on by itself. By card transfer: the customer sends the plan's
 * price from their own bank app to the owner's card and uploads the receipt;
 * the owner checks the transfer and switches the plan on. The platform offers
 * one at a time (inPAY while it works, card transfer as the fallback); the
 * panel still shows a choice if it is ever sent both.
 *
 * Nothing here grants anything — the panel only shows what the server says,
 * and waits for inPAY's answer or the owner's decision.
 *
 * Where the server offers saved cards (inPAY Avto PAY), paying through inPAY
 * is also a choice of «Pay once» or «Pay and renew every month», which saves
 * the card on inPAY's page and comes back to /app/card/{id}. With a card saved
 * on the website, it pays in one tap, after a confirm.
 *
 * A plan bought for a year (`term`) is paid once, at the server's yearly price:
 * on inPAY's page, or by card transfer while that is the way. It never renews
 * from a saved card, so a year skips the «once or every month» choice.
 */
import type {
  BillingOptions,
  CardCharge,
  Checkout,
  ManualPayment,
  SavedCardState,
} from '../../generated/api/types'
type Method = 'automatic' | 'card'
type Way = 'once' | 'renew' | 'card' | 'card_renew'
const props = defineProps<{ plan?: string; term?: 'month' | 'year' }>()
const emit = defineEmits<{ close: []; changed: []; choose: [plan: string, term: 'month' | 'year'] }>()
const { t, date } = useLocale()
const ws = useWorkspace()
const options = ref<BillingOptions | null>(null)
const payment = ref<ManualPayment | null>(null)
// An automatic payment is read every 5 s while it is pending, for ten minutes.
const pay = useCheckout({ every: 5000, limit: 10 * 60_000 })
const receipt = ref<File | null>(null)
const fileInput = ref<HTMLInputElement>()
const note = ref('')
const busy = ref('')
const error = ref('')
const checkoutError = ref('')
// inPAY could not open the payment and the server now offers card transfer in its place.
const fellBack = ref(false)
const copied = ref('')
let timer: ReturnType<typeof setInterval> | undefined

const open = computed(() => ['awaiting', 'submitted'].includes(payment.value?.status || ''))
const { money: price, discount, yearly, untilLabel } = usePricing()
const planName = (plan: string) => t(plan)
/** "Plus", or "Plus · 1 year" for a plan bought for a year. */
const termName = (plan: string, term?: string | null) =>
  term === 'year' ? t('planOneYear', { plan: planName(plan) }) : planName(plan)
const option = (plan: string) => options.value?.plans?.find((p) => p.plan === plan)
const byYear = computed(() => props.term === 'year')
// The chosen plan's year, as the server prices it: none means it is not sold by the year now.
const chosenYear = computed(() => (byYear.value ? yearly(option(props.plan || '')) : null))
// The server's price for the chosen plan today: discounted while a discount is
// on, or the year's price, which no discount lowers.
// What the server is asked to open: a month is the plan alone, as it always was; a year says so.
const chosenBody = computed(() => (byYear.value ? { plan: props.plan, term: 'year' } : { plan: props.plan }))
const chosenPrice = computed(() =>
  byYear.value ? (chosenYear.value?.price ?? 0) : Number(option(props.plan || '')?.price) || 0,
)
/**
 * The discount to name beside an amount: only while the plan's discount is
 * live and the amount is the discounted price. A request opened before the
 * discount, or at the regular price, is shown plainly.
 */
const saving = (plan: string, amount: number, term?: string | null) => {
  if (term === 'year') return null
  const deal = discount(option(plan))
  return deal && deal.price === Number(amount) ? deal : null
}
const chosenSaving = computed(() => (props.plan ? saving(props.plan, chosenPrice.value, props.term) : null))
const openSaving = computed(() =>
  payment.value ? saving(payment.value.plan, payment.value.amount, payment.value.term) : null,
)
const cardNumber = computed(() => (payment.value?.card?.number || '').replace(/(\d{4})(?=\d)/g, '$1 '))
// The ways to pay the server offers this customer, automatic first. An older
// platform never offers automatic, so card transfer is then the only one.
const methods = computed<Method[]>(() => [
  ...(options.value?.automatic?.available === true ? (['automatic'] as const) : []),
  ...(options.value?.enabled ? (['card'] as const) : []),
])
const picked = ref<Method | ''>('')
const method = computed<Method | ''>({
  get: () => (picked.value && methods.value.includes(picked.value) ? picked.value : (methods.value[0] ?? '')),
  set: (value) => (picked.value = value),
})
// Saved cards, where the server offers them: only for paying through inPAY.
const renewal = useRenewal()
const savedCard = renewal.card
const telegram = useTelegramApp()
const ways = computed<Way[]>(() => {
  if (method.value !== 'automatic' || !renewal.state.value?.offered || byYear.value) return []
  return savedCard.value ? ['card', 'card_renew', 'once'] : ['once', 'renew']
})
const pickedWay = ref<Way | ''>('')
const way = computed<Way>({
  get: () =>
    pickedWay.value && ways.value.includes(pickedWay.value) ? pickedWay.value : (ways.value[0] ?? 'once'),
  set: (value) => {
    pickedWay.value = value
    confirming.value = false
  },
})
// One more tap before a saved card is charged.
const confirming = ref(false)
// How the last saved-card charge went, shown until the customer picks a plan again.
const charge = ref<CardCharge | null>(null)
const WAY_TITLE: Record<Way, string> = {
  once: 'payWayOnce',
  renew: 'payWayRenew',
  card: 'payWayCard',
  card_renew: 'payWayCardRenew',
}
const wayTitle = (value: Way) =>
  t(value === 'once' && savedCard.value ? 'payWayOnceOther' : WAY_TITLE[value], {
    last4: savedCard.value?.last4 ?? '',
  })
const wayBody = (value: Way) =>
  value === 'once'
    ? t('methodAutomaticBody')
    : value === 'card'
      ? t('payWayCardBody')
      : t(value === 'renew' ? 'payWayRenewBody' : 'payWayCardRenewBody', { price: price(chosenPrice.value) })
// A question only where there is a choice; one way to pay is simply named.
const heading = computed(() =>
  methods.value.length > 1
    ? 'paymentMethod'
    : method.value === 'automatic'
      ? 'methodAutomatic'
      : 'methodCard',
)
// A decision is shown until the customer moves on; an old one is not news.
const recent = computed(
  () =>
    !!payment.value &&
    !open.value &&
    !!payment.value.decided_at &&
    Date.now() - new Date(payment.value.decided_at).getTime() < 7 * 86400000,
)
const at = (value?: string | null) => (value ? new Date(value).getTime() || 0 : 0)
// Of a finished automatic payment and a decided card transfer, only the later one is news.
const checkoutLater = computed(() => {
  const value = pay.checkout.value
  return !!value && at(value.paid_at || value.created_at) >= at(payment.value?.decided_at)
})
// A pending automatic payment stays on screen whatever else is chosen: it may already be paid.
const checkoutShown = computed(
  () =>
    pay.pending.value ||
    (!!pay.checkout.value && !props.plan && !open.value && (!recent.value || checkoutLater.value)),
)
const decisionShown = computed(
  () => recent.value && !props.plan && !(pay.checkout.value && !pay.pending.value && checkoutLater.value),
)
const visible = computed(() => !!props.plan || open.value || decisionShown.value)
// Where the customer is: choosing how to pay, paying, or waiting for the plan.
const stage = computed(() => (payment.value?.status === 'submitted' ? 2 : open.value ? 1 : 0))
const steps = computed(() =>
  !open.value && method.value === 'automatic'
    ? ['stepHowToPay', 'stepPayInpay', 'stepPlanOn']
    : ['stepHowToPay', 'stepTransfer', 'stepWeCheck'],
)

async function run(task: string, fn: () => Promise<void>) {
  busy.value = task
  error.value = ''
  try {
    await fn()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = ''
  }
}
async function load() {
  const [value] = await Promise.all([ws.api<BillingOptions>('/billing/manual'), renewal.load()])
  const before = payment.value?.status
  options.value = value
  payment.value = value.payment
  pay.adopt(value.checkout ?? null)
  if (before === 'submitted' && value.payment?.status === 'approved') emit('changed')
  // While the owner is reviewing, check now and then so an approval shows up
  // without a reload.
  if (payment.value?.status === 'submitted') timer ??= setInterval(() => load().catch(() => {}), 30000)
  else if (timer) {
    clearInterval(timer)
    timer = undefined
  }
}
onMounted(() => run('load', load))
onBeforeUnmount(() => timer && clearInterval(timer))
watch(
  () => [props.plan, props.term] as const,
  ([plan]) => {
    picked.value = ''
    pickedWay.value = ''
    confirming.value = false
    error.value = ''
    fellBack.value = false
    if (plan) charge.value = null
  },
)
// The plan is on the moment inPAY's answer arrives: the frame and the cards take it up.
watch(
  () => [pay.checkout.value?.id, pay.checkout.value?.status] as const,
  ([id, status], [beforeId, before]) => {
    if (id === beforeId && before === 'pending' && status === 'paid' && !pay.checkout.value?.test)
      emit('changed')
  },
)

async function payAutomatic() {
  await run('checkout', async () => {
    let created: Checkout
    try {
      created = await ws.api<Checkout>('/billing/checkout', {
        method: 'POST',
        body: chosenBody.value,
      })
    } catch (e: any) {
      // Switched off since this page loaded, or inPAY could not open the
      // payment: show the ways to pay there are now. The server offers card
      // transfer in inPAY's place for a while after inPAY fails.
      const code = e.data?.error?.code
      if (code !== 'checkout_disabled' && code !== 'checkout_unavailable') throw e
      await load().catch(() => {})
      if (code === 'checkout_unavailable' && method.value === 'card') {
        fellBack.value = true
        return
      }
      throw e
    }
    pay.follow(created)
    emit('close')
    if (created.status === 'pending') openPayment()
  })
}
// Saved cards switched off, or the card gone, since the page loaded: show the ways there are now.
async function refreshCards(e: any) {
  if (['autopay_unavailable', 'card_unavailable', 'checkout_disabled'].includes(e.data?.error?.code))
    await renewal.load()
}
/** «Pay and renew every month»: save the card on inPAY's page, which pays for the plan once saved. */
async function saveCard() {
  await run('card', async () => {
    let saved: SavedCardState
    try {
      saved = await ws.api<SavedCardState>('/billing/cards', { method: 'POST', body: { plan: props.plan } })
    } catch (e: any) {
      await refreshCards(e)
      throw e
    }
    // Only inPAY's own page can receive this browser navigation.
    const destination = checkoutDestination(saved.bind_url)
    if (!destination) throw new Error('Invalid card page')
    if (!telegram.openLink(destination)) window.location.assign(destination)
  })
}
/** Pay from the card saved on the website, after the confirm tap; with renewal, it turns on. */
async function payWithCard() {
  const card = savedCard.value
  if (!card) return
  await run('card', async () => {
    try {
      charge.value = await ws.api<CardCharge>(`/billing/cards/${card.id}/charge`, {
        method: 'POST',
        body: { plan: props.plan, renew: way.value === 'card_renew' },
      })
    } catch (e: any) {
      confirming.value = false
      await refreshCards(e)
      throw e
    }
    confirming.value = false
    await renewal.load()
    // The plan is on: the frame and the cards take it up, and this panel closes.
    if (charge.value.status === 'paid') emit('changed')
  })
}
function openPayment() {
  checkoutError.value = ''
  try {
    pay.goToPayment()
  } catch {
    checkoutError.value = t('genericError')
  }
}
async function checkPayment() {
  checkoutError.value = ''
  await pay.check()
  if (pay.failed.value) checkoutError.value = t('checkoutCheckFailed')
}
async function start() {
  await run('start', async () => {
    payment.value = await ws.api<ManualPayment>('/billing/manual', {
      method: 'POST',
      body: chosenBody.value,
    })
  })
}
async function send() {
  const current = payment.value
  if (!receipt.value || !current) return
  await run('send', async () => {
    const body = new FormData()
    body.append('file', receipt.value as File)
    body.append('note', note.value)
    payment.value = await ws.api<ManualPayment>(`/billing/manual/${current.id}/receipt`, {
      method: 'POST',
      body,
    })
    receipt.value = null
    note.value = ''
    // The file box would otherwise still name a receipt that has been sent.
    if (fileInput.value) fileInput.value.value = ''
    await load()
  })
}
async function cancel() {
  const current = payment.value
  if (!current) return
  await run('cancel', async () => {
    payment.value = await ws.api<ManualPayment>(`/billing/manual/${current.id}`, { method: 'DELETE' })
    emit('close')
  })
}
async function copy(value: string, which: string) {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = which
    setTimeout(() => (copied.value = ''), 2000)
  } catch {
    // Copying is a convenience; the number is on screen either way.
  }
}
function pick(event: Event) {
  receipt.value = (event.target as HTMLInputElement).files?.[0] || null
}
</script>

<template>
  <CheckoutStatus
    v-if="checkoutShown && pay.checkout.value"
    :checkout="pay.checkout.value"
    :checking="pay.checking.value"
    :waited-out="pay.waitedOut.value"
    :not-yet="pay.notYet.value"
    :error="checkoutError"
    @check="checkPayment"
    @pay="openPayment"
    @retry="(plan, term) => emit('choose', plan, term)"
  />
  <section v-if="charge" class="panel checkout-status" data-testid="card-charge" aria-live="polite">
    <CardChargeResult :charge="charge" />
  </section>
  <section v-if="visible" class="panel manual-payment" data-testid="manual-payment" aria-live="polite">
    <ErrorBanner v-if="error" :message="error" />
    <ol v-if="open || plan" class="pay-stepper" data-testid="pay-stepper">
      <li
        v-for="(label, index) in steps"
        :key="label"
        :class="{ done: index < stage, current: index === stage }"
        :aria-current="index === stage ? 'step' : undefined"
      >
        <span class="pay-step-number" aria-hidden="true"
          ><AppIcon v-if="index < stage" name="check" :size="14" /><template v-else>{{
            index + 1
          }}</template></span
        >{{ t(label) }}
      </li>
    </ol>

    <!-- A card transfer on its way or waiting for the owner. -->
    <template v-if="open && payment">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">{{ t('payByCard') }} · {{ payment.reference }}</span>
          <h2>{{ termName(payment.plan, payment.term) }} · {{ price(payment.amount) }}</h2>
          <p v-if="openSaving" class="discount-note" data-testid="manual-discount">
            <s class="plan-price-regular"
              ><span class="visually-hidden">{{ t('regularPrice') + ' ' }}</span
              >{{ price(openSaving.regular) }}</s
            >
            <span class="discount-badge">−{{ openSaving.percent }}%</span>
            <span class="discount-until">{{ untilLabel(openSaving) }}</span>
          </p>
        </div>
        <span v-if="payment.status === 'submitted'" class="status-badge" data-testid="manual-waiting"
          ><AppIcon name="clock" :size="15" />{{ t('paymentWaiting') }}</span
        >
      </div>
      <p v-if="payment.status === 'submitted'" class="muted">{{ t('paymentWaitingBody') }}</p>
      <ol class="manual-steps">
        <li>
          <span>{{ t('cardStepSend', { amount: price(payment.amount) }) }}</span>
          <div class="manual-card">
            <strong data-testid="manual-card-number">{{ cardNumber }}</strong>
            <button
              class="button secondary small"
              type="button"
              @click="copy(payment.card.number || '', 'card')"
            >
              <AppIcon name="copy" :size="15" />{{ copied === 'card' ? t('copied') : t('copyAction') }}
            </button>
            <small>{{ [payment.card.holder, payment.card.label].filter(Boolean).join(' · ') }}</small>
          </div>
        </li>
        <li>
          <span>{{ t('cardStepReceipt') }}</span>
          <form class="manual-receipt" @submit.prevent="send">
            <label class="form-field"
              ><span>{{ t('receiptFile') }}</span
              ><input
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                data-testid="manual-receipt"
                @change="pick"
            /></label>
            <label class="form-field"
              ><span>{{ t('receiptNote') }}</span
              ><input v-model="note" maxlength="120" :placeholder="t('receiptNoteHint')"
            /></label>
            <button class="button primary" :disabled="!receipt || !!busy" data-testid="manual-send">
              <AppIcon name="upload" :size="16" />{{
                busy === 'send'
                  ? t('working')
                  : payment.status === 'submitted'
                    ? t('sendAnotherReceipt')
                    : t('sendReceipt')
              }}
            </button>
          </form>
        </li>
      </ol>
      <p class="field-hint">
        {{ t('paymentCode') }}: <strong>{{ payment.reference }}</strong> · {{ t('manualReviewNote') }}
      </p>
      <button class="text-link" type="button" :disabled="!!busy" @click="cancel">
        {{ t('cancelPayment') }}
      </button>
    </template>

    <!-- The owner's decision, shown for a few days. -->
    <template v-else-if="decisionShown && payment">
      <div v-if="payment.status === 'approved'" class="success-banner" role="status">
        <AppIcon name="check" :size="18" />{{
          t('paymentApproved', { plan: planName(payment.plan), date: date(payment.active_until) })
        }}
      </div>
      <div v-else-if="payment.status === 'rejected'" class="info-banner" role="status">
        <AppIcon name="alert" :size="19" />
        <span
          >{{ t('paymentRejected', { reference: payment.reference }) }}
          <strong>{{ payment.rejection_reason }}</strong></span
        >
      </div>
    </template>

    <!-- Choosing how to pay for the plan the customer picked. -->
    <template v-else-if="plan">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">{{ t(heading) }}</span>
          <h2>
            {{ termName(plan, term) }}<template v-if="chosenPrice"> · {{ price(chosenPrice) }}</template>
          </h2>
          <p v-if="chosenYear" class="discount-note" data-testid="year-note">
            <span class="discount-badge">−{{ chosenYear.percent }}%</span>
            <span class="discount-until"
              >{{ price(chosenYear.perMonth) }} {{ t('perMonthShort') }} · {{ t('yearPaidOnce') }}</span
            >
          </p>
          <p v-if="chosenSaving" class="discount-note" data-testid="manual-discount">
            <s class="plan-price-regular"
              ><span class="visually-hidden">{{ t('regularPrice') + ' ' }}</span
              >{{ price(chosenSaving.regular) }}</s
            >
            <span class="discount-badge">−{{ chosenSaving.percent }}%</span>
            <span class="discount-until">{{ untilLabel(chosenSaving) }}</span>
          </p>
        </div>
        <button class="icon-button" type="button" :aria-label="t('closePanel')" @click="emit('close')">
          <AppIcon name="x" :size="17" />
        </button>
      </div>
      <p v-if="options && !methods.length" class="muted">{{ t('cardPaymentsUnavailable') }}</p>
      <fieldset v-else-if="methods.length > 1" class="payment-methods">
        <legend class="visually-hidden">{{ t('paymentMethod') }}</legend>
        <label
          v-for="way in methods"
          :key="way"
          class="payment-method"
          :class="{ selected: method === way }"
          :data-testid="`method-${way}`"
          ><input v-model="method" type="radio" :value="way" />
          <span
            ><strong>{{ t(way === 'automatic' ? 'methodAutomatic' : 'methodCard') }}</strong
            ><small>{{ t(way === 'automatic' ? 'methodAutomaticBody' : 'methodCardBody') }}</small></span
          ></label
        >
      </fieldset>
      <p v-else-if="method && !ways.length" class="payment-way" data-testid="payment-way">
        {{ t(method === 'automatic' ? 'methodAutomaticBody' : 'methodCardBody') }}
      </p>
      <!-- Through inPAY, where saved cards are offered: once, or every month from a saved card. -->
      <fieldset v-if="ways.length" class="payment-methods" data-testid="card-ways">
        <legend class="visually-hidden">{{ t('paymentMethod') }}</legend>
        <label
          v-for="value in ways"
          :key="value"
          class="payment-method"
          :class="{ selected: way === value }"
          :data-testid="`way-${value}`"
          ><input v-model="way" type="radio" name="card-way" :value="value" />
          <span
            ><strong>{{ wayTitle(value) }}</strong
            ><small>{{ wayBody(value) }}</small></span
          ></label
        >
      </fieldset>
      <p
        v-if="fellBack && method === 'card'"
        class="info-banner"
        role="status"
        data-testid="checkout-fallback"
      >
        <AppIcon name="info" :size="18" /><span>{{ t('checkoutFallback') }}</span>
      </p>
      <p
        v-if="method === 'automatic' && way === 'once' && options?.automatic?.test"
        class="warning-banner"
        data-testid="checkout-test-mode"
      >
        <AppIcon name="info" :size="18" /><span>{{ t('checkoutTestMode') }}</span>
      </p>
      <button
        v-if="method === 'automatic' && way === 'renew'"
        class="button primary"
        :disabled="!!busy || !chosenPrice"
        data-testid="card-save"
        @click="saveCard"
      >
        {{ busy === 'card' ? t('working') : t('saveCardPay', { price: price(chosenPrice) })
        }}<AppIcon name="right" :size="17" />
      </button>
      <template v-else-if="method === 'automatic' && savedCard && (way === 'card' || way === 'card_renew')">
        <div v-if="confirming" class="card-confirm" role="group" data-testid="card-confirm">
          <p>
            <strong>{{ t('cardConfirm', { price: price(chosenPrice), last4: savedCard.last4 }) }}</strong>
            <template v-if="way === 'card_renew'">
              {{ ' ' + t('cardConfirmRenew', { price: price(chosenPrice) }) }}</template
            >
          </p>
          <div class="card-confirm-actions">
            <button
              class="button primary"
              type="button"
              :disabled="!!busy"
              data-testid="card-pay-yes"
              @click="payWithCard"
            >
              {{ busy === 'card' ? t('working') : t('payPlan', { price: price(chosenPrice) }) }}
            </button>
            <button class="button secondary" type="button" :disabled="!!busy" @click="confirming = false">
              {{ t('cancel') }}
            </button>
          </div>
        </div>
        <button
          v-else
          class="button primary"
          type="button"
          :disabled="!!busy || !chosenPrice"
          data-testid="card-pay"
          @click="confirming = true"
        >
          {{ t('payPlan', { price: price(chosenPrice) }) }}<AppIcon name="right" :size="17" />
        </button>
      </template>
      <button
        v-else-if="method === 'automatic'"
        class="button primary"
        :disabled="!!busy || !chosenPrice"
        data-testid="checkout-pay"
        @click="payAutomatic"
      >
        {{ busy === 'checkout' ? t('working') : t('payPlan', { price: price(chosenPrice) })
        }}<AppIcon name="right" :size="17" />
      </button>
      <button
        v-else-if="method === 'card'"
        class="button primary"
        :disabled="!!busy || !chosenPrice"
        data-testid="manual-start"
        @click="start"
      >
        {{ busy === 'start' ? t('working') : t('paymentContinue') }}<AppIcon name="right" :size="17" />
      </button>
    </template>
  </section>
</template>
