<script setup lang="ts">
// The public site's frame (docs/site/design): discount line, header, the page,
// footer with the seller's details. Server-rendered pages arrive with plans,
// tools and contacts; the browser asks for fresh plans and tools once more,
// so a price changed since the page was cached is right a moment later.
const { t } = useLocale()
const ws = useWorkspace()
useContacts()
onMounted(() => {
  void ws.loadPlans().catch(() => {})
  void ws.loadCatalog().catch(() => {})
})
</script>
<template>
  <div class="site-body">
    <a class="site-skip" href="#main-content">{{ t('siteNavSkip') }}</a>
    <SiteBanner />
    <SiteHeader />
    <main id="main-content" tabindex="-1"><slot /></main>
    <SiteFooter />
  </div>
</template>
