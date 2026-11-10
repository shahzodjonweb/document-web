<script setup lang="ts">
// What every page shares, whichever frame it stands in (app/layouts).
const { locale } = useLocale()
useHead({ htmlAttrs: { lang: locale } })
useSiteSeo()
// A page rendered on the server carries its prices, tools and contacts; the
// app's own pages render in the browser and load them as they always have.
if (import.meta.server) await loadPublicData()
</script>
<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>
