<script setup lang="ts">
defineProps<{ subtitle?: string }>()
const brand = String(useRuntimeConfig().public.productName)
</script>
<!-- Both versions carry the name: only the one the theme shows is read out. -->
<template>
  <span class="brand-lockup">
    <span class="brand-logo-surface"
      ><img src="/brand/docmaster-logo.svg" :alt="brand" width="614" height="98" class="brand-logo brand-logo-light" /><img
        src="/brand/docmaster-logo-dark.svg"
        :alt="brand"
        width="614"
        height="98"
        class="brand-logo brand-logo-dark"
    /></span>
    <small v-if="subtitle" class="brand-subtitle">{{ subtitle }}</small>
  </span>
</template>
