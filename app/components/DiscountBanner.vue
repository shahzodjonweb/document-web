<script setup lang="ts">
/**
 * One slim line per plan on discount: the regular price struck through,
 * today's price, the percentage and the last day — nothing more, so it says
 * what is on offer without pressing. Without a live discount it renders
 * nothing and the page reads as it always has.
 */
defineProps<{ compare?: boolean }>()
const { t, path } = useLocale()
const { active, money, untilLabel } = usePricing()
</script>
<template>
  <div v-if="active.length" class="discount-banner" role="status" data-testid="discount-banner">
    <AppIcon name="percent" :size="20" />
    <div class="discount-banner-lines">
      <!-- Each part is a flex item: the gaps are the spaces, so no whitespace between tags matters. -->
      <p v-for="{ plan, discount } in active" :key="plan.id">
        <strong>{{ t('discountBannerLead', { plan: t(plan.id) }) }}:</strong>
        <!-- Strikethrough is not read aloud, so the struck price is named. -->
        <s><span class="visually-hidden">{{ t('regularPrice') + ' ' }}</span>{{ money(discount.regular) }}</s>
        <b>{{ money(discount.price) }}</b>
        <span class="discount-badge">−{{ discount.percent }}%</span>
        <span>· {{ untilLabel(discount) }}</span>
      </p>
    </div>
    <NuxtLink v-if="compare" :to="path('/pricing')" class="text-link"
      >{{ t('comparePlans') }}<AppIcon name="right" :size="16"
    /></NuxtLink>
  </div>
</template>
