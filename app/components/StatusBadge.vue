<script setup lang="ts">
defineProps<{ status: string }>()
const { t } = useLocale()
</script>
<template>
  <span class="status-badge" :class="status"><span />{{ t(status) }}</span>
</template>
