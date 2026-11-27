<script setup lang="ts">
import type { PlanPhrase } from '../composables/usePlanPhrases'
const { t, path, date, timeZone } = useLocale()
const ws = useWorkspace()
const usage = computed(() => ws.usage.value)
// The week's limits reset on Monday 00:00 in Tashkent, shown in this device's zone.
const resetsAt = computed(() => usage.value?.week?.resets_at ?? usage.value?.resets_at)
// So'm per 30 days, however it is paid; a discount lowers today's price. A
// plan may also be bought for a year at once, at the server's yearly price,
// which no discount lowers.
const { figure, money, regular, discount, price, yearly, untilLabel } = usePricing()
/** Each plan with today's price, its discount and its year, if any, worked out once. */
const rows = computed(() =>
  (ws.plans.value || []).map((plan: any) => ({
    plan,
    deal: discount(plan),
    today: price(plan),
    year: yearly(plan),
  })),
)
// Month or year: the switch shows only while some plan is sold by the year.
const sellsYears = computed(() => rows.value.some((row) => row.year))
const pickedTerm = ref<'month' | 'year'>('month')
const term = computed<'month' | 'year'>({
  get: () => (sellsYears.value ? pickedTerm.value : 'month'),
  set: (value) => (pickedTerm.value = value),
})
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
const chosenTerm = ref<'month' | 'year'>('month')
async function pay(plan: string, how: 'month' | 'year' = 'month') {
  chosen.value = plan
  chosenTerm.value = how
  await nextTick()
  document
    .querySelector('[data-testid="manual-payment"]')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  <RenewalPanel v-if="ws.user.value" />
  <PaymentPanel
    v-if="ws.user.value"
    :plan="chosen"
    :term="chosenTerm"
    @close="chosen = ''"
    @changed="planChanged"
    @choose="pay"
  />
  <section class="home-section">
    <div class="section-heading">
      <h2>{{ t('plansTitle') }}</h2>
      <div
        v-if="sellsYears"
        class="term-switch"
        role="radiogroup"
        :aria-label="t('termChoice')"
        data-testid="term-switch"
      >
        <label :class="{ selected: term === 'month' }" data-testid="term-month"
          ><input v-model="term" type="radio" name="plan-term" value="month" />{{ t('termMonthly') }}</label
        >
        <label :class="{ selected: term === 'year' }" data-testid="term-year"
          ><input v-model="term" type="radio" name="plan-term" value="year" />{{ t('termYearly') }}</label
        >
      </div>
    </div>
    <div class="plan-grid">
      <section
        v-for="{ plan, deal, today, year } in rows"
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
          {{
            t(plan.id === 'free' ? 'planFreeBody' : plan.id === 'plus' ? 'planPlusBody' : 'planPremiumBody')
          }}
        </p>
        <div class="plan-price">
          <!-- By the year: the price spread over its months, so it compares with the month,
               then what is paid at once, and the saving against twelve months. -->
          <template v-if="term === 'year' && year">
            <strong :data-testid="`year-month-${plan.id}`">{{ figure(year.perMonth) }}</strong
            ><span>so'm</span>
            <span class="discount-badge" :data-testid="`year-saving-${plan.id}`">{{
              t('yearSaving', { percent: year.percent })
            }}</span>
            <small
              >{{ t('perMonthShort') }} ·
              <span :data-testid="`year-total-${plan.id}`">{{
                t('billedYearly', { price: money(year.price) })
              }}</span></small
            >
          </template>
          <template v-else-if="today || (pricedInSom && plan.id === 'free')">
            <!-- On discount: the regular price struck through above today's, the percentage, the last day.
                 Strikethrough is not read aloud, so the struck price is named; the space travels inside
                 the interpolation because the template compiler drops a trailing whitespace-only node. -->
            <s v-if="deal" class="plan-price-regular" :data-testid="`regular-${plan.id}`"
              ><span class="visually-hidden">{{ t('regularPrice') + ' ' }}</span
              >{{ money(deal.regular) }}</s
            >
            <strong>{{ figure(today) }}</strong
            ><span>so'm</span>
            <span v-if="deal" class="discount-badge" :data-testid="`discount-${plan.id}`"
              >−{{ deal.percent }}%</span
            >
            <!-- One line, "per 30 days · until 31 Oct", so the last day never starts a row with the dot. -->
            <small
              >{{ t('perThirtyDays')
              }}<span v-if="deal" class="discount-until"> · {{ untilLabel(deal) }}</span></small
            >
          </template>
          <span v-else class="muted">{{ t('unavailablePrice') }}</span>
        </div>
        <template v-if="term === 'year' && year">
          <NuxtLink v-if="!ws.user.value" :to="path('/app/billing')" class="button primary">{{
            t('signInToPay')
          }}</NuxtLink
          ><button
            v-else
            class="button primary"
            :data-testid="`pay-${plan.id}`"
            @click="pay(plan.id, 'year')"
          >
            {{ t(plan.id === currentPlan ? 'extendYear' : 'payPlan', { price: money(year.price) }) }}
          </button>
        </template>
        <template v-else-if="today">
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
              >{{ row.pre }}<strong v-if="row.value !== ''">{{ row.value }}</strong
              >{{ row.post }}</span
            >
          </li>
        </ul>
      </section>
    </div>
  </section>
  <p class="directory-note"><AppIcon name="shield" :size="16" />{{ t('retentionBilling') }}</p>
</template>
