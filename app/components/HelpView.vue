<script setup lang="ts">
const { t, path } = useLocale()
defineProps<{ legal?: string }>()
</script>
<template>
  <div class="help-page">
    <div class="page-heading">
      <div>
        <h1>{{ legal ? t(legal) : t('helpTitle') }}</h1>
        <p>{{ legal ? t('legalDraft') : t('helpLead') }}</p>
      </div>
    </div>
    <HelpArticles :keys="legal ? ['helpPrivacy', 'helpBilling'] : undefined" />
    <div class="panel help-contact">
      <span><AppIcon name="help" :size="20" />{{ t('writeToUs') }}</span
      ><NuxtLink :to="path('/app/support')" class="button secondary small"
        >{{ t('contactSupport') }}<AppIcon name="right" :size="15"
      /></NuxtLink>
    </div>
  </div>
</template>
