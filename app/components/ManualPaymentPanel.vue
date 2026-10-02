<script setup lang="ts">
/**
 * Paying by card transfer. The customer sends the plan's price from their own
 * bank app to the owner's card and uploads the receipt; the owner checks the
 * transfer and switches the plan on. Nothing here grants anything — the panel
 * only shows what the server says, and waits for the owner's decision.
 */
const props = defineProps<{ plan?: string }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const { t, date } = useLocale()
const ws = useWorkspace()
const options = ref<any>(null)
const payment = ref<any>(null)
const method = ref<'card' | 'automatic'>('card')
const receipt = ref<File | null>(null)
const fileInput = ref<HTMLInputElement>()
const note = ref('')
const busy = ref('')
const error = ref('')
const copied = ref('')
let timer: ReturnType<typeof setInterval> | undefined

const open = computed(() => ['awaiting', 'submitted'].includes(payment.value?.status))
const price = (amount: number) => `${amount.toLocaleString('ru-RU').replace(/ /g, ' ')} so'm`
const planName = (plan: string) => t(plan)
const chosenPrice = computed(() => options.value?.plans?.find((p: any) => p.plan === props.plan)?.price)
const cardNumber = computed(() => (payment.value?.card?.number || '').replace(/(\d{4})(?=\d)/g, '$1 '))
// A decision is shown until the customer moves on; an old one is not news.
const recent = computed(
  () =>
    payment.value &&
    !open.value &&
    payment.value.decided_at &&
    Date.now() - new Date(payment.value.decided_at).getTime() < 7 * 86400000,
)
const visible = computed(() => !!props.plan || open.value || recent.value)

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
  const value: any = await ws.api('/billing/manual')
  const before = payment.value?.status
  options.value = value
  payment.value = value.payment
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
    method.value = 'card'
    error.value = ''
  },
)

async function start() {
  await run('start', async () => {
    payment.value = await ws.api('/billing/manual', { method: 'POST', body: { plan: props.plan } })
  })
}
async function send() {
  if (!receipt.value || !payment.value) return
  await run('send', async () => {
    const body = new FormData()
    body.append('file', receipt.value as File)
    body.append('note', note.value)
    payment.value = await ws.api(`/billing/manual/${payment.value.id}/receipt`, { method: 'POST', body })
    receipt.value = null
    note.value = ''
    // The file box would otherwise still name a receipt that has been sent.
    if (fileInput.value) fileInput.value.value = ''
    await load()
  })
}
async function cancel() {
  await run('cancel', async () => {
    payment.value = await ws.api(`/billing/manual/${payment.value.id}`, { method: 'DELETE' })
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
  <section v-if="visible" class="panel manual-payment" data-testid="manual-payment" aria-live="polite">
    <ErrorBanner v-if="error" :message="error" />

    <!-- A payment on its way or waiting for the owner. -->
    <template v-if="open">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">{{ t('payByCard') }} · {{ payment.reference }}</span>
          <h2>{{ planName(payment.plan) }} · {{ price(payment.amount) }}</h2>
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
            <button class="button secondary small" type="button" @click="copy(payment.card.number, 'card')">
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
    <template v-else-if="recent && !plan">
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
          <span class="eyebrow">{{ t('paymentMethod') }}</span>
          <h2>
            {{ planName(plan) }}<template v-if="chosenPrice"> · {{ price(chosenPrice) }}</template>
          </h2>
        </div>
        <button class="icon-button" type="button" :aria-label="t('closePanel')" @click="emit('close')">
          <AppIcon name="x" :size="17" />
        </button>
      </div>
      <p v-if="options && !options.enabled" class="muted">{{ t('cardPaymentsUnavailable') }}</p>
      <fieldset v-else class="payment-methods">
        <legend class="visually-hidden">{{ t('paymentMethod') }}</legend>
        <label class="payment-method" :class="{ selected: method === 'card' }"
          ><input v-model="method" type="radio" value="card" />
          <span><strong>{{ t('methodCard') }}</strong><small>{{ t('methodCardBody') }}</small></span></label
        ><label class="payment-method disabled"
          ><input type="radio" value="automatic" disabled />
          <span
            ><strong>{{ t('methodAutomatic') }}</strong><small>{{ t('methodAutomaticSoon') }}</small></span
          ></label
        >
      </fieldset>
      <button
        v-if="options?.enabled"
        class="button primary"
        :disabled="!!busy || method !== 'card' || !chosenPrice"
        data-testid="manual-start"
        @click="start"
      >
        {{ busy === 'start' ? t('working') : t('paymentContinue') }}<AppIcon name="right" :size="17" />
      </button>
    </template>
  </section>
</template>
