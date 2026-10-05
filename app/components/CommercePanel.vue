<script setup lang="ts">
const { t, path, date } = useLocale()
const ws = useWorkspace()
const studio = useStudio()
const data = ref<any>(null)
const subscription = ref<any>(null)
const transactions = ref<any[]>([])
const invoices = ref<any[]>([])
const invoice = ref<any>(null)
const busy = ref('')
const error = ref('')
const telegramRequired = ref(false)
const success = ref('')
const nextPlan = ref('plus')
async function run(action: string, fn: () => Promise<void>) {
  busy.value = action
  error.value = ''
  telegramRequired.value = false
  success.value = ''
  try {
    await fn()
  } catch (e: any) {
    telegramRequired.value = e.data?.error?.code === 'telegram_link_required'
    error.value = telegramRequired.value
      ? t('authTelegramRequired')
      : e.data?.error?.message || t('genericError')
  } finally {
    busy.value = ''
  }
}
async function refresh() {
  const [offers, sub, tx, iv] = await Promise.all([
    ws.api('/billing/offers'),
    ws.api('/billing/subscription'),
    ws.api('/billing/transactions'),
    ws.api('/billing/invoices'),
  ])
  data.value = offers
  subscription.value = sub.subscription
  transactions.value = tx.results
  invoices.value = iv.results
  nextPlan.value = subscription.value?.plan === 'premium' ? 'plus' : 'premium'
}
onMounted(() => run('load', refresh))
async function choose(offer: any) {
  await run('invoice', async () => {
    invoice.value = await ws.api('/billing/invoices', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: { offer_id: offer.id },
    })
    await refresh()
  })
}
async function pay() {
  await run('pay', async () => {
    const response = await ws.api(`/billing/invoices/${invoice.value.id}/sandbox-pay`, { method: 'POST' })
    invoice.value = response.invoice
    success.value = t('paymentConfirmed')
    await ws.init()
    await Promise.all([ws.loadAccount(), ws.loadCatalog(), studio.load(), refresh()])
  })
}
async function cancelInvoice() {
  await run('cancel', async () => {
    await ws.api(`/billing/invoices/${invoice.value.id}`, { method: 'DELETE' })
    invoice.value = null
    await refresh()
  })
}
async function renewal() {
  await run('renewal', async () => {
    const result = await ws.api(
      `/billing/subscription/${subscription.value.renewal_enabled ? 'cancel-renewal' : 'resume-renewal'}`,
      { method: 'POST' },
    )
    subscription.value = result.subscription
  })
}
async function schedule() {
  await run('schedule', async () => {
    const result = await ws.api('/billing/subscription/schedule-plan-change', {
      method: 'POST',
      body: { plan: nextPlan.value },
    })
    subscription.value = result.subscription
  })
}
function selectedInvoice(value: any) {
  invoice.value = value
  success.value = ''
}
</script>
<template>
  <section class="commerce-content">
    <ErrorBanner v-if="error" :message="error"
      ><NuxtLink v-if="telegramRequired" :to="path('/app/settings')" class="text-link">{{
        t('authSignInMethods')
      }}</NuxtLink></ErrorBanner
    >
    <div v-if="success" class="success-banner" role="status">
      <AppIcon name="check" :size="18" />{{ success }}
    </div>
    <div v-if="data?.sandbox" class="provider-banner">
      <span class="provider-icon"><AppIcon name="billing" :size="22" /></span>
      <div>
        <strong>{{ t('sandboxPayments') }}</strong>
        <p>{{ t('sandboxPaymentsNote') }}</p>
      </div>
      <span class="status-badge">SANDBOX</span>
    </div>
    <div v-if="subscription" class="panel subscription-panel">
      <div>
        <span class="eyebrow">{{ t('subscription') }}</span>
        <h2>{{ t(subscription.plan) }}</h2>
        <p>
          {{ t('activeUntil') }}
          {{ date(subscription.active_until || subscription.current_period_end, true) }}
        </p>
        <span v-if="subscription.scheduled_plan" class="status-badge"
          >{{ t('nextPlan') }} · {{ t(subscription.scheduled_plan) }}</span
        >
      </div>
      <!-- A card transfer pays for one period: there is nothing to renew or switch. -->
      <p v-if="subscription.provider === 'manual'" class="muted">
        {{ t('paidByCardUntil', { date: date(subscription.active_until || subscription.current_period_end) }) }}
      </p>
      <div v-else class="subscription-controls">
        <button class="button secondary" :disabled="!!busy" @click="renewal">
          {{ t(subscription.renewal_enabled ? 'cancelRenewal' : 'resumeRenewal') }}
        </button>
        <div class="form-row">
          <label class="form-field"
            ><span>{{ t('nextPlan') }}</span
            ><select v-model="nextPlan">
              <option
                v-for="plan in ['free', 'plus', 'premium'].filter((p) => p !== subscription.plan)"
                :key="plan"
                :value="plan"
              >
                {{ t(plan) }}
              </option>
            </select></label
          ><button class="button secondary" :disabled="!!busy" @click="schedule">
            {{ t('schedulePlan') }}
          </button>
        </div>
        <small>{{ t('scheduledPlanNote') }}</small>
      </div>
    </div>
    <div v-if="data?.offers?.length" class="commerce-offers">
      <div class="section-heading">
        <h2>{{ t('offers') }}</h2>
        <NuxtLink class="text-link" :to="path('/app/referrals')"
          >{{ t('referrals') }}<AppIcon name="arrow" :size="16"
        /></NuxtLink>
      </div>
      <div class="offer-grid">
        <section v-for="offer in data.offers" :key="offer.id" class="panel offer-card">
          <span class="tool-icon" :class="offer.kind === 'subscription' ? 'sage' : 'purple'"
            ><AppIcon
              :name="offer.kind === 'ai_pack' ? 'sparkle' : offer.kind === 'task_pack' ? 'files' : 'billing'"
              :size="23"
          /></span>
          <h3>{{ offer.plan ? t(offer.plan) : t(offer.kind === 'ai_pack' ? 'aiPack' : 'taskPack') }}</h3>
          <div class="offer-price">
            {{ offer.price_xtr }} <small>{{ offer.currency }}</small>
          </div>
          <p v-for="(quantity, meter) in offer.quantities" :key="meter" v-show="Number(quantity) > 0">
            <strong>{{ quantity }}</strong>
            {{
              t(
                meter === 'file_tasks'
                  ? 'standardTasks'
                  : meter === 'file_page_units'
                    ? 'pageUnits'
                    : 'ai_credits',
              )
            }}
          </p>
          <small v-if="offer.kind !== 'subscription'">{{ t('purchasedCredits') }}</small
          ><button
            class="button secondary full"
            :disabled="
              !!busy ||
              !offer.checkout_enabled ||
              (offer.kind === 'subscription' && !!subscription?.active_until)
            "
            @click="choose(offer)"
          >
            {{
              offer.kind === 'subscription' && subscription?.active_until
                ? t('currentPlan')
                : t('selectOffer')
            }}
          </button>
        </section>
      </div>
    </div>
    <section v-if="invoice" class="panel invoice-panel">
      <div>
        <span class="eyebrow">{{ t('invoice') }} · {{ invoice.id.slice(0, 8) }}</span>
        <h2>{{ invoice.amount_xtr }} {{ invoice.currency }}</h2>
        <p>{{ t('expires') }} {{ date(invoice.expires_at, true) }}</p>
        <span class="status-badge" :class="{ succeeded: invoice.status === 'paid' }">{{
          t(invoice.status === 'paid' ? 'paymentConfirmed' : 'invoicePending')
        }}</span>
      </div>
      <div class="invoice-actions">
        <button
          v-if="invoice.sandbox && ['created', 'presented', 'pending'].includes(invoice.status)"
          class="button primary"
          :disabled="!!busy"
          @click="pay"
        >
          {{ busy === 'pay' ? t('working') : t('simulatePayment') }}</button
        ><a
          v-else-if="invoice.invoice_url"
          class="button primary"
          :href="invoice.invoice_url"
          target="_blank"
          rel="noopener"
          >{{ t('invoice') }}<AppIcon name="external" :size="17" /></a
        ><button
          v-if="['created', 'presented', 'pending'].includes(invoice.status)"
          class="button secondary"
          :disabled="!!busy"
          @click="cancelInvoice"
        >
          {{ t('cancel') }}
        </button>
      </div>
    </section>
    <div
      v-if="invoices.some((i) => ['created', 'presented', 'pending'].includes(i.status)) && !invoice"
      class="panel pending-invoices"
    >
      <button
        v-for="item in invoices.filter((i) => ['created', 'presented', 'pending'].includes(i.status))"
        :key="item.id"
        class="text-link"
        @click="selectedInvoice(item)"
      >
        {{ t('invoicePending') }} · {{ item.amount_xtr }} XTR<AppIcon name="right" :size="16" />
      </button>
    </div>
    <section class="panel transactions-panel" data-testid="payment-history">
      <div class="panel-heading">
        <h2>{{ t('paymentHistory') }}</h2>
        <button class="icon-button" @click="run('load', refresh)" :aria-label="t('refresh')">
          <AppIcon name="rotate" :size="17" />
        </button>
      </div>
      <p v-if="!transactions.length" class="muted">{{ t('noTransactions') }}</p>
      <ul v-else class="transaction-list">
        <li v-for="transaction in transactions" :key="transaction.id" class="transaction-row">
          <div>
            <strong>{{
              transaction.plan ? t(transaction.plan) : t(transaction.kind === 'ai_pack' ? 'aiPack' : 'taskPack')
            }}</strong
            ><small
              >{{ date(transaction.occurred_at, true) }}{{ transaction.sandbox ? ' · SANDBOX' : '' }}</small
            >
          </div>
          <b class="tabular">{{
            transaction.currency === 'UZS'
              ? `${transaction.amount_xtr.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')} so'm`
              : `${transaction.amount_xtr} ${transaction.currency}`
          }}</b
          ><NuxtLink
            class="text-link"
            :to="path(`/app/support?topic=billing&ref=${encodeURIComponent(transaction.reference || transaction.id.slice(0, 8))}`)"
            >{{ t('askAboutPayment') }}</NuxtLink
          >
        </li>
      </ul>
    </section>
  </section>
</template>
