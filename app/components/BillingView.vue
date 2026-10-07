<script setup lang="ts">
const { t, path, date, timeZone } = useLocale()
const ws = useWorkspace()
const usage = computed(() => ws.usage.value as any)
const meters = computed(() => usage.value?.meters || {})
const limit = (plan: any, key: string) => plan.limits?.[key] ?? plan[key]
/** So'm per 30 days for a card transfer, or nothing when a plan isn't for sale. */
const priceOf = (plan: any) => (Number(limit(plan, 'price_uzs')) > 0 ? Number(limit(plan, 'price_uzs')) : 0)
const money = (amount: number) => `${amount.toLocaleString('ru-RU').replace(/ /g, ' ')} so'm`
const count = (value: any) =>
  typeof value === 'number' ? value.toLocaleString('ru-RU').replace(/ /g, ' ') : value
const currentPlan = computed(() => ws.user.value?.plan || 'free')
/** Once plans are priced in so'm, Free reads as 0 so'm rather than 0 Stars. */
const pricedInSom = computed(() => (ws.plans.value || []).some((plan: any) => priceOf(plan)))
// The plan in one row, as on Home: what is left of each allowance, and today's cap.
const planMeters = computed(() =>
  [
    { key: 'standardTasks', meter: meters.value.file_tasks },
    { key: 'pageUnits', meter: meters.value.file_page_units },
    { key: 'ai_credits', meter: meters.value.ai_credits },
    { key: 'todayTasks', meter: usage.value?.daily?.limit ? usage.value.daily : null },
  ].filter((row) => row.meter && row.meter.limit),
)
const share = (meter: { remaining: number; limit: number }) =>
  `${Math.max(0, Math.min(100, (meter.remaining / meter.limit) * 100))}%`
// What sets the plans apart, in the order people compare them.
const features = (plan: any) =>
  [
    { value: count(limit(plan, 'file_tasks')), label: 'standardTasks' },
    { value: count(limit(plan, 'file_page_units')), label: 'pageUnits' },
    { value: `${limit(plan, 'max_file_mib')} MB`, label: 'fileLimit' },
    { value: count(limit(plan, 'max_pages_per_job')), label: 'jobLimit' },
    { value: limit(plan, 'max_generated_pdf_pages'), label: 'generatedPagesLimit' },
    { value: limit(plan, 'max_generated_slides'), label: 'generatedSlidesLimit' },
    { value: limit(plan, 'max_deck_images'), label: 'photosPerDeck' },
    { value: count(limit(plan, 'ai_credits')), label: 'ai_credits' },
    // No daily limit is stored as null; ask the plan directly.
    plan.limits && 'daily_ai_documents' in plan.limits
      ? { value: plan.limits.daily_ai_documents ?? t('unlimitedCount'), label: 'aiDocumentsPerDay' }
      : null,
  ].filter((row) => row && row.value !== undefined && row.value !== null) as { value: any; label: string }[]
const chosen = ref('')
async function pay(plan: string) {
  chosen.value = plan
  await nextTick()
  document.querySelector('[data-testid="manual-payment"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
async function planChanged() {
  chosen.value = ''
  await ws.init()
  await ws.loadAccount()
}
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>{{ ws.user.value ? t('navBilling') : t('pricing') }}</h1>
      <p>{{ t('billingLead') }}</p>
    </div>
  </div>
  <section v-if="ws.user.value && usage" class="panel current-plan" data-testid="current-plan">
    <div class="current-plan-head">
      <div>
        <span class="muted">{{ t('currentPlan') }}</span>
        <h2>{{ t(usage.plan || 'free') }}</h2>
      </div>
      <p class="muted">
        {{ t('cycleEnd') }} {{ date(usage.resets_at || usage.period_end, true) }} ·
        {{ timeZone }}
      </p>
    </div>
    <div v-if="planMeters.length" class="plan-meters">
      <div v-for="row in planMeters" :key="row.key" class="plan-meter">
        <span class="plan-meter-label">{{ t(row.key) }}</span>
        <p>
          <strong class="tabular">{{ count(Math.max(0, row.meter.remaining)) }}</strong>
          <span>{{ t('meterOf', { limit: count(row.meter.limit) }) }}</span>
        </p>
        <div class="usage-track"><span :style="{ width: share(row.meter) }" /></div>
      </div>
    </div>
  </section>
  <ManualPaymentPanel v-if="ws.user.value" :plan="chosen" @close="chosen = ''" @changed="planChanged" />
  <section class="home-section">
    <div class="section-heading">
      <h2>{{ t('plansTitle') }}</h2>
    </div>
    <div class="plan-grid">
      <section
        v-for="plan in ws.plans.value"
        :key="plan.id"
        class="panel plan-card"
        :class="{ current: plan.id === currentPlan && ws.user.value }"
      >
        <div class="plan-card-head">
          <h3>{{ t(plan.id) }}</h3>
          <span v-if="plan.id === currentPlan && ws.user.value" class="status-badge succeeded">{{
            t('yourPlanBadge')
          }}</span>
        </div>
        <p class="plan-card-body">
          {{ t(plan.id === 'free' ? 'planFreeBody' : plan.id === 'plus' ? 'planPlusBody' : 'planPremiumBody') }}
        </p>
        <div class="plan-price">
          <template v-if="priceOf(plan) || (pricedInSom && plan.id === 'free')">
            <strong>{{ money(priceOf(plan)).replace(" so'm", '') }}</strong><span>so'm</span>
            <small>{{ t('perThirtyDays') }}</small>
          </template>
          <span v-else class="muted">{{ t('unavailablePrice') }}</span>
        </div>
        <template v-if="priceOf(plan)">
          <NuxtLink v-if="!ws.user.value" :to="path('/app/billing')" class="button primary">{{
            t('signInToPay')
          }}</NuxtLink
          ><button v-else class="button primary" :data-testid="`pay-${plan.id}`" @click="pay(plan.id)">
            {{ t(plan.id === currentPlan ? 'extendPlan' : 'payPlan', { price: money(priceOf(plan)) }) }}
          </button>
        </template>
        <ul class="plan-features">
          <li v-for="row in features(plan)" :key="row.label">
            <AppIcon name="check" :size="16" /><span
              ><strong>{{ row.value }}</strong> {{ t(row.label) }}</span
            >
          </li>
        </ul>
      </section>
    </div>
  </section>
  <CommercePanel v-if="ws.user.value" />
  <p class="directory-note"><AppIcon name="shield" :size="16" />{{ t('retention') }}</p>
</template>
