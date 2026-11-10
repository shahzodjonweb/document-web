<script setup lang="ts">
// A section's H2, its intro and an optional "see more" link, with one spacing rule.
defineProps<{ id: string; title: string; intro?: string; to?: string; link?: string }>()
</script>
<template>
  <div class="site-section-head">
    <div>
      <h2 :id="id" class="site-h2">{{ title }}</h2>
      <p v-if="intro">{{ intro }}</p>
    </div>
    <NuxtLink v-if="to && link" class="site-link-arrow" :to="to"
      >{{ link }}<AppIcon name="right" class="site-icon is-sm"
    /></NuxtLink>
  </div>
</template>
