<script setup lang="ts">
defineProps<{ message?: string }>()
const { t } = useLocale()
</script>
<template>
  <div class="error-banner" role="alert">
    <AppIcon name="alert" :size="20" /><span>{{ message || t('apiError') }}</span
    ><slot />
  </div>
</template>
