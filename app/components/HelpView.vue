<script setup lang="ts">
const { t } = useLocale()
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
    <ContactLinks />
  </div>
</template>
