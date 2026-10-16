<script setup lang="ts">
const props = defineProps<{ message?: string }>()
const { t, path } = useLocale()
const ws = useWorkspace()
// A refusal because the week's allowance or a file's edits ran out offers the next plan.
// Those are the only limits that differ by plan, so no other refusal offers one.
const offerPlans = computed(() => !!props.message && props.message === ws.limitMessage.value)
</script>
<template>
  <div class="error-banner" role="alert">
    <AppIcon name="alert" :size="20" /><span>{{ message || t('apiError') }}</span
    ><NuxtLink v-if="offerPlans" :to="path('/app/billing')" class="text-link" data-testid="limit-plans">{{
      t('studioSeePlans')
    }}</NuxtLink
    ><slot />
  </div>
</template>
