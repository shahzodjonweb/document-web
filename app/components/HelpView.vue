<script setup lang="ts">
const { t, path } = useLocale()
defineProps<{ legal?: string }>()
</script>
<template>
  <div class="page-heading">
    <div>
      <div class="eyebrow">PDF MASTER</div>
      <h1>{{ legal ? t(legal) : t('helpTitle') }}</h1>
      <p>{{ legal ? t('legalDraft') : t('supportSub') }}</p>
    </div>
  </div>
  <div class="help-articles">
    <section
      v-for="key in legal
        ? ['helpPrivacy', 'helpBilling']
        : ['helpGetting', 'helpFormats', 'helpPrivacy', 'helpBilling']"
      :key="key"
      class="panel"
    >
      <h2>{{ t(key) }}</h2>
      <p>{{ t(`${key}Body`) }}</p>
    </section>
  </div>
  <div class="help-strip">
    <span><AppIcon name="help" :size="20" />{{ t('supportTitle') }}</span
    ><NuxtLink :to="path('/app/support')"
      >{{ t('contactSupport') }}<AppIcon name="arrow" :size="16"
    /></NuxtLink>
  </div>
</template>
