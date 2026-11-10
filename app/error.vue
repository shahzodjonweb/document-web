<script setup lang="ts">
// A page that does not exist, or one that failed, inside the public site's frame
// (docs/site/design/pages/not-found.md): the way back is the whole page.
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t, path, locale } = useLocale()
const route = useRoute()
const brand = String(useRuntimeConfig().public.productName)
const missing = computed(() => props.error.statusCode === 404)
const links = computed(() => [
  { to: path(), label: t('siteNotFoundHome'), icon: 'home' },
  { to: path('/tools'), label: t('siteNotFoundTools'), icon: 'tools' },
  { to: path('/ai'), label: t('siteNotFoundAi'), icon: 'sparkle' },
  { to: path('/help'), label: t('siteNotFoundHelp'), icon: 'help' },
])
// Leaving the error by a link clears it, so the next page renders normally.
const go = (to: string) => clearError({ redirect: to })
useHead({
  htmlAttrs: { lang: locale },
  title: () => `${t(missing.value ? 'siteNotFoundTitle' : 'pageErrorTitle')} · ${brand}`,
  meta: [{ name: 'robots', content: 'noindex' }],
})
</script>
<template>
  <NuxtLayout name="site">
    <section class="site-section site-error">
      <div class="site-container site-error-inner">
        <span class="site-error-code" aria-hidden="true">{{ error.statusCode || 500 }}</span>
        <h1 class="site-h1">{{ t(missing ? 'siteNotFoundTitle' : 'pageErrorTitle') }}</h1>
        <p class="site-lead">{{ t(missing ? 'siteNotFoundLine' : 'pageErrorLead') }}</p>
        <p v-if="missing" class="site-error-path">{{ t('siteNotFoundPath', { path: route.path }) }}</p>
        <nav class="site-error-links" :aria-label="t('siteNavLabel')">
          <a
            v-for="(link, index) in links"
            :key="link.to"
            :href="link.to"
            class="site-btn"
            :class="index === 0 ? 'is-primary' : 'is-secondary'"
            @click.prevent="go(link.to)"
            ><AppIcon :name="link.icon" class="site-icon is-sm" />{{ link.label }}</a
          >
        </nav>
      </div>
    </section>
  </NuxtLayout>
</template>
