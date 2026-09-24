<script setup lang="ts">
defineProps<{ subtitle?: string }>()
</script>
<template>
  <span class="brand-lockup">
    <span class="brand-logo-surface"
      ><img src="/brand/pdf-master-logo.svg" alt="PDF Master" width="1815" height="456" class="brand-logo"
    /></span>
    <small v-if="subtitle" class="brand-subtitle">{{ subtitle }}</small>
  </span>
</template>
