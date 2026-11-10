<script setup lang="ts">
// A live admin discount, above the header on every public page (the app's
// DiscountBanner wording, the site's look). On a phone it is one short line:
// each plan's percentage and the last day, the prices on the pricing page.
const { t, path } = useLocale()
const { active, money, untilLabel } = usePricing()
const ends = computed(() => {
  const days = [...new Set(active.value.map(({ discount }) => discount.until))]
  return days.length === 1 ? untilLabel(active.value[0]!.discount) : ''
})
</script>
<template>
  <div v-if="active.length" class="site-banner" role="status" data-testid="discount-banner">
    <div class="site-container">
      <AppIcon name="percent" class="site-icon" />
      <p v-for="{ plan, discount } in active" :key="plan.id" class="site-banner-line">
        <b>{{ t('discountBannerLead', { plan: t(plan.id) }) }}:</b>
        <s><span class="site-visually-hidden">{{ t('regularPrice') + ' ' }}</span>{{ money(discount.regular) }}</s>
        <b>{{ money(discount.price) }}</b>
        <span class="site-badge">−{{ discount.percent }}%</span>
        <span v-if="!ends">{{ untilLabel(discount) }}</span>
      </p>
      <p v-if="ends && active.length > 1" class="site-banner-line">{{ ends }}</p>
      <p class="site-banner-short" aria-hidden="true">
        <span v-for="{ plan, discount } in active" :key="plan.id"
          ><b>{{ t(plan.id) }}</b> <span class="site-badge">−{{ discount.percent }}%</span></span
        ><span v-if="ends">{{ ends }}</span>
      </p>
      <NuxtLink class="site-link-arrow" :to="path('/pricing')"
        >{{ t('comparePlans') }}<AppIcon name="right" class="site-icon is-sm"
      /></NuxtLink>
    </div>
  </div>
</template>
