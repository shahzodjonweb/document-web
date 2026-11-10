<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t, path, locale } = useLocale()
const missing = computed(() => props.error.statusCode === 404)
useHead({
  htmlAttrs: { lang: locale },
  title: () => `${t(missing.value ? 'notFoundTitle' : 'pageErrorTitle')} · PDF Master`,
  meta: [{ name: 'robots', content: 'noindex' }],
})
</script>
<template>
  <a class="skip-link" href="#main-content">{{ t('skipToContent') }}</a>
  <div class="public-shell">
    <div class="app-body">
      <header class="public-topbar">
        <NuxtLink :to="path()" class="brand"><BrandLogo /></NuxtLink>
      </header>
      <main id="main-content" tabindex="-1" class="public-content">
        <section class="empty-state error-page">
          <h1>{{ t(missing ? 'notFoundTitle' : 'pageErrorTitle') }}</h1>
          <p>{{ t(missing ? 'notFoundLead' : 'pageErrorLead') }}</p>
          <div class="error-page-actions">
            <button class="button primary" type="button" @click="clearError({ redirect: path() })">
              {{ t('notFoundHome') }}
            </button>
            <button class="button secondary" type="button" @click="clearError({ redirect: path('/tools') })">
              {{ t('navTools') }}
            </button>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
