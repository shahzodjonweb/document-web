<script setup lang="ts">
const { t } = useLocale()
</script>
<template>
  <div class="help-page">
    <div class="page-heading">
      <div>
        <h1>{{ t('navHelp') }}</h1>
        <p>{{ t('helpLead') }}</p>
      </div>
    </div>
    <ContactLinks />
    <HelpArticles guide />
  </div>
</template>
