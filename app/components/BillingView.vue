<script setup lang="ts">
import type { PlanPhrase } from '../composables/usePlanPhrases'
const { t, path, date, timeZone } = useLocale()
const ws = useWorkspace()
const usage = computed(() => ws.usage.value)
// The week's limits reset on Monday 00:00 in Tashkent, shown in this device's zone.
const resetsAt = computed(() => usage.value?.week?.resets_at ?? usage.value?.resets_at)
// So'm per 30 days for a card transfer; a discount lowers today's price.
const { figure, money, regular, discount, price, untilLabel } = usePricing()
/** Each plan with today's price and its discount, if any, worked out once. */
const rows = computed(() =>
  (ws.plans.value || []).map((plan: any) => ({ plan, deal: discount(plan), today: price(plan) })),
)
const currentPlan = computed(() => ws.user.value?.plan || 'free')
/** Once the paid plans are priced, Free reads as 0 so'm rather than "to be announced". */
const pricedInSom = computed(() => (ws.plans.value || []).some((plan: any) => regular(plan)))
const { allowances } = usePlanPhrases()
// What sets the plans apart, and nothing else: the week's allowances and the
// channels. File size, pages, batches and tools are the same on every plan, so
// listing them on each card would only suggest a difference that isn't there.
const features = (plan: any) =>
  [
    ...allowances(plan),
    // Only Free and Plus are asked to join the Telegram channels.
    plan.id === 'premium' ? { pre: t('planNoChannels'), value: '', post: '' } : null,
  ].filter((row): row is PlanPhrase => !!row)
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
  <DiscountBanner />
  <section v-if="ws.user.value && usage" class="panel current-plan" data-testid="current-plan">
    <div class="current-plan-head">
      <div>
        <span class="muted">{{ t('currentPlan') }}</span>
        <h2>{{ t(usage.plan || 'free') }}</h2>
      </div>
      <p v-if="resetsAt" class="muted" data-testid="week-reset">
        {{ t('weekResets') }} {{ date(resetsAt, true) }} · {{ timeZone }}
      </p>
    </div>
    <WeeklyUsage edits />
  </section>
  <ManualPaymentPanel v-if="ws.user.value" :plan="chosen" @close="chosen = ''" @changed="planChanged" />
  <section class="home-section">
    <div class="section-heading">
      <h2>{{ t('plansTitle') }}</h2>
    </div>
    <div class="plan-grid">
      <section
        v-for="{ plan, deal, today } in rows"
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
          <template v-if="today || (pricedInSom && plan.id === 'free')">
            <!-- On discount: the regular price struck through above today's, the percentage, the last day.
                 Strikethrough is not read aloud, so the struck price is named; the space travels inside
                 the interpolation because the template compiler drops a trailing whitespace-only node. -->
            <s v-if="deal" class="plan-price-regular" :data-testid="`regular-${plan.id}`"
              ><span class="visually-hidden">{{ t('regularPrice') + ' ' }}</span>{{ money(deal.regular) }}</s
            >
            <strong>{{ figure(today) }}</strong><span>so'm</span>
            <span v-if="deal" class="discount-badge" :data-testid="`discount-${plan.id}`">−{{ deal.percent }}%</span>
            <!-- One line, "per 30 days · until 31 Oct", so the last day never starts a row with the dot. -->
            <small
              >{{ t('perThirtyDays') }}<span v-if="deal" class="discount-until"> · {{ untilLabel(deal) }}</span></small
            >
          </template>
          <span v-else class="muted">{{ t('unavailablePrice') }}</span>
        </div>
        <template v-if="today">
          <NuxtLink v-if="!ws.user.value" :to="path('/app/billing')" class="button primary">{{
            t('signInToPay')
          }}</NuxtLink
          ><button v-else class="button primary" :data-testid="`pay-${plan.id}`" @click="pay(plan.id)">
            {{ t(plan.id === currentPlan ? 'extendPlan' : 'payPlan', { price: money(today) }) }}
          </button>
        </template>
        <ul class="plan-features">
          <li v-for="(row, index) in features(plan)" :key="index">
            <AppIcon name="check" :size="16" /><span
              >{{ row.pre }}<strong v-if="row.value !== ''">{{ row.value }}</strong>{{ row.post }}</span
            >
          </li>
        </ul>
      </section>
    </div>
  </section>
  <p class="directory-note"><AppIcon name="shield" :size="16" />{{ t('retention') }}</p>
</template>
