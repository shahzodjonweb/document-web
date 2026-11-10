<script setup lang="ts">
// Plans and prices (docs/site/design/pages/pricing.md, mockups/pricing.html).
// Every number comes from the live plans; nothing about a price is typed here.
definePageMeta({ layout: 'site' })
const { t, path } = useSite()
const ws = useWorkspace()
const { figure } = usePricing()

const ORDER = ['free', 'plus', 'premium']
const plans = computed(() =>
  ORDER.map((id) => ws.plans.value.find((plan: any) => plan.id === id)).filter((plan): plan is any => !!plan),
)
const amount = (plan: any, field: string) => {
  const value = plan.limits?.[field]
  return value === null || value === undefined ? t('sitePricingCellUnlimited') : figure(Number(value))
}
const rows = computed(() => [
  { label: t('sitePricingRowAiDocs'), cells: plans.value.map((plan) => amount(plan, 'weekly_ai_documents')) },
  { label: t('sitePricingRowFileTasks'), cells: plans.value.map((plan) => amount(plan, 'weekly_file_jobs')) },
  { label: t('sitePricingRowEdits'), cells: plans.value.map((plan) => amount(plan, 'edits_per_file')) },
  // Free and Plus ask to join the channels; Premium does not.
  {
    label: t('sitePricingRowChannel'),
    cells: plans.value.map((plan) => t(plan.id === 'premium' ? 'sitePricingCellNoJoin' : 'sitePricingCellJoin')),
  },
  { label: t('sitePricingRowTools'), cells: plans.value.map(() => t('sitePricingCellAll')) },
  { label: t('sitePricingRowWeb'), cells: plans.value.map(() => t('sitePricingCellWeb')) },
  { label: t('sitePricingRowBot'), cells: plans.value.map(() => t('sitePricingCellBot')) },
])
const tiles = [
  { icon: 'gift', key: 'Invite', to: '/invite' },
  { icon: 'calendar', key: 'Renew', to: '' },
  { icon: 'receipt', key: 'Refund', to: '' },
] as const
</script>
<template>
  <div class="site-pricing">
    <SiteBreadcrumb />
    <section class="site-hero site-pricing-intro">
      <div class="site-container site-pricing-head">
        <h1 class="site-h1">{{ t('sitePricingTitle') }}</h1>
        <p class="site-lead">{{ t('sitePricingLead') }}</p>
        <p class="site-muted site-small">{{ t('sitePricingVatNote') }}</p>
      </div>
    </section>

    <section v-if="plans.length" class="site-section is-tight site-pricing-plans" :aria-label="t('siteCrumbPricing')">
      <div class="site-container"><SitePlans /></div>
    </section>

    <section v-if="plans.length" class="site-section" aria-labelledby="pricing-table">
      <div class="site-container">
        <SiteSectionHead id="pricing-table" :title="t('sitePricingTableTitle')" />
        <div class="site-table-wrap">
          <table class="site-table">
            <caption>{{ t('sitePricingTableCaption') }}</caption>
            <thead>
              <tr>
                <th scope="col"><span class="site-visually-hidden">{{ t('sitePricingTableTitle') }}</span></th>
                <th v-for="plan in plans" :key="plan.id" scope="col">{{ t(plan.id) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.label">
                <th scope="row">{{ row.label }}</th>
                <td v-for="(cell, index) in row.cells" :key="index" :data-label="t(plans[index]!.id)">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="site-section is-band" aria-labelledby="pricing-pay">
      <div class="site-container">
        <SiteSectionHead id="pricing-pay" :title="t('sitePricingPayTitle')" />
        <ol class="site-steps site-pricing-steps">
          <li v-for="n in 4" :key="n">
            <h3 class="site-h3">{{ t(`sitePricingPayStep${n}Title`) }}</h3>
            <p>{{ t(`sitePricingPayStep${n}Text`) }}</p>
          </li>
        </ol>
        <div class="site-cards site-pricing-cards" :aria-label="t('sitePricingCardsLabel')">
          <span>Uzcard</span><span>Humo</span><span>Visa</span><span>Mastercard</span>
        </div>
      </div>
    </section>

    <section class="site-section" :aria-label="t('sitePricingInviteLabel')">
      <div class="site-container">
        <dl class="site-kv site-pricing-tiles">
          <div v-for="tile in tiles" :key="tile.key">
            <dt><AppIcon :name="tile.icon" class="site-icon is-sm" /> {{ t(`sitePricing${tile.key}Label`) }}</dt>
            <dd>
              {{ t(`sitePricing${tile.key}Value`) }}
              <small
                >{{ t(`sitePricing${tile.key}Note`) }}
                <NuxtLink v-if="tile.to" class="site-link" :to="path(tile.to)">{{ t('siteCrumbInvite') }}</NuxtLink></small
              >
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <SiteFaq page="pricing" :title="t('sitePricingFaqTitle')" :to="path('/help')" :link="t('siteFooterHelpCentre')" open />
    <SiteCta :title="t('siteHomeFinalTitle')" :line="t('siteHomeFinalLine')" />
  </div>
</template>
