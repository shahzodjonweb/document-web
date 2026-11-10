<script setup lang="ts">
// The three plans as marketing cards, from the live plans: today's price (with
// the regular one struck through while a discount runs), the weekly allowances
// and the channel rule. Nothing renders until the plans are known.
const { t, path } = useSite()
const ws = useWorkspace()
const { figure, discount, price, regular, dayLabel } = usePricing()
const ORDER = ['free', 'plus', 'premium']
const plans = computed(() =>
  ORDER.map((id) => ws.plans.value.find((plan: any) => plan.id === id)).filter((plan): plan is any => !!plan),
)
const capitalized = (id: string) => id[0]!.toUpperCase() + id.slice(1)
const limit = (plan: any, field: string, key: string) => {
  const value = plan.limits?.[field]
  return value === null || value === undefined ? t(`${key}Unlimited`) : t(key, { count: figure(Number(value)) })
}
const card = (plan: any) => {
  const deal = discount(plan)
  return {
    id: plan.id,
    name: t(plan.id),
    body: t(`sitePlan${capitalized(plan.id)}Body`),
    price: figure(price(plan)),
    regular: deal ? figure(regular(plan)) : '',
    period: regular(plan)
      ? deal
        ? t('sitePlanDiscountPeriod', { date: dayLabel(deal.until) })
        : t('sitePlanPeriod')
      : t('sitePlanFreePeriod'),
    percent: deal?.percent ?? 0,
    rows: [
      limit(plan, 'weekly_ai_documents', 'sitePlanAiDocs'),
      limit(plan, 'weekly_file_jobs', 'sitePlanFileTasks'),
      limit(plan, 'edits_per_file', 'sitePlanEdits'),
    ],
    // Free and Plus ask to join the channels; Premium does not.
    channel: plan.id === 'premium' ? t('sitePlanNoChannel') : t('sitePlanChannel'),
    button: t(`sitePlan${capitalized(plan.id)}Button`),
    to: path(plan.id === 'free' ? '/app' : '/app/billing'),
    primary: plan.id === 'plus',
  }
}
</script>
<template>
  <div v-if="plans.length" class="site-plans">
    <article v-for="plan in plans.map(card)" :key="plan.id" class="site-plan" :data-plan="plan.id">
      <div class="site-plan-name">
        <h3 class="site-h3">{{ plan.name }}</h3>
        <span v-if="plan.percent" class="site-badge">−{{ plan.percent }}%</span>
      </div>
      <div class="site-plan-price">
        <s v-if="plan.regular">{{ t('sitePlanRegular', { price: `${plan.regular} so'm` }) }}</s>
        <strong>{{ plan.price }}<small>so'm</small></strong><span>{{ plan.period }}</span>
      </div>
      <ul>
        <li class="is-note"><AppIcon name="info" class="site-icon" />{{ plan.body }}</li>
        <li v-for="row in plan.rows" :key="row"><AppIcon name="check" class="site-icon" />{{ row }}</li>
        <li :class="{ 'is-note': plan.id !== 'premium' }">
          <AppIcon :name="plan.id === 'premium' ? 'check' : 'send'" class="site-icon" />{{ plan.channel }}
        </li>
      </ul>
      <NuxtLink class="site-btn is-sm" :class="plan.primary ? 'is-primary' : 'is-secondary'" :to="plan.to">{{
        plan.button
      }}</NuxtLink>
    </article>
  </div>
</template>
