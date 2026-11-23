<script setup lang="ts">
/**
 * Paying for a plan, one of two ways.
 *
 * Automatically, through inPAY: the customer pays on inPAY's own page and the
 * plan switches on by itself. By card transfer: the customer sends the plan's
 * price from their own bank app to the owner's card and uploads the receipt;
 * the owner checks the transfer and switches the plan on.
 *
 * Nothing here grants anything — the panel only shows what the server says,
 * and waits for inPAY's answer or the owner's decision.
 */
import type { BillingOptions, Checkout, ManualPayment } from '../../generated/api/types'
type Method = 'automatic' | 'card'
const props = defineProps<{ plan?: string }>()
const emit = defineEmits<{ close: []; changed: []; choose: [plan: string] }>()
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
const copied = ref('')
let timer: ReturnType<typeof setInterval> | undefined

const open = computed(() => ['awaiting', 'submitted'].includes(payment.value?.status || ''))
const { money: price, discount, untilLabel } = usePricing()
const planName = (plan: string) => t(plan)
const option = (plan: string) => options.value?.plans?.find((p) => p.plan === plan)
// The server's price for the chosen plan today: discounted while a discount is on.
const chosenPrice = computed(() => Number(option(props.plan || '')?.price) || 0)
/**
 * The discount to name beside an amount: only while the plan's discount is
 * live and the amount is the discounted price. A request opened before the
 * discount, or at the regular price, is shown plainly.
 */
const saving = (plan: string, amount: number) => {
  const deal = discount(option(plan))
  return deal && deal.price === Number(amount) ? deal : null
}
const chosenSaving = computed(() => (props.plan ? saving(props.plan, chosenPrice.value) : null))
const openSaving = computed(() => (payment.value ? saving(payment.value.plan, payment.value.amount) : null))
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
// A question only where there is a choice; one way to pay is simply named.
const heading = computed(() =>
  methods.value.length > 1 ? 'paymentMethod' : method.value === 'automatic' ? 'methodAutomatic' : 'methodCard',
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
  const value = await ws.api<BillingOptions>('/billing/manual')
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
  () => props.plan,
  () => {
    picked.value = ''
    error.value = ''
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
      created = await ws.api<Checkout>('/billing/checkout', { method: 'POST', body: { plan: props.plan } })
    } catch (e: any) {
      // Switched off since this page loaded: show the ways to pay there are now.
      if (e.data?.error?.code === 'checkout_disabled') load().catch(() => {})
      throw e
    }
    pay.follow(created)
    emit('close')
    if (created.status === 'pending') openPayment()
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
    payment.value = await ws.api<ManualPayment>('/billing/manual', { method: 'POST', body: { plan: props.plan } })
  })
}
async function send() {
  const current = payment.value
  if (!receipt.value || !current) return
  await run('send', async () => {
    const body = new FormData()
    body.append('file', receipt.value as File)
    body.append('note', note.value)
    payment.value = await ws.api<ManualPayment>(`/billing/manual/${current.id}/receipt`, { method: 'POST', body })
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
    @retry="emit('choose', $event)"
  />
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
          ><AppIcon v-if="index < stage" name="check" :size="14" /><template v-else>{{ index + 1 }}</template></span
        >{{ t(label) }}
      </li>
    </ol>

    <!-- A card transfer on its way or waiting for the owner. -->
    <template v-if="open && payment">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">{{ t('payByCard') }} · {{ payment.reference }}</span>
          <h2>{{ planName(payment.plan) }} · {{ price(payment.amount) }}</h2>
          <p v-if="openSaving" class="discount-note" data-testid="manual-discount">
            <s class="plan-price-regular"
              ><span class="visually-hidden">{{ t('regularPrice') + ' ' }}</span>{{ price(openSaving.regular) }}</s
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
            <button class="button secondary small" type="button" @click="copy(payment.card.number || '', 'card')">
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
      <button class="text-link" type="button" :disabled="!!busy" @click="cancel">{{ t('cancelPayment') }}</button>
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
            {{ planName(plan) }}<template v-if="chosenPrice"> · {{ price(chosenPrice) }}</template>
          </h2>
          <p v-if="chosenSaving" class="discount-note" data-testid="manual-discount">
            <s class="plan-price-regular"
              ><span class="visually-hidden">{{ t('regularPrice') + ' ' }}</span>{{ price(chosenSaving.regular) }}</s
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
      <p v-else-if="method" class="payment-way" data-testid="payment-way">
        {{ t(method === 'automatic' ? 'methodAutomaticBody' : 'methodCardBody') }}
      </p>
      <p
        v-if="method === 'automatic' && options?.automatic?.test"
        class="warning-banner"
        data-testid="checkout-test-mode"
      >
        <AppIcon name="info" :size="18" /><span>{{ t('checkoutTestMode') }}</span>
      </p>
      <button
        v-if="method === 'automatic'"
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
