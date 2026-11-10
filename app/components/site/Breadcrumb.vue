<script setup lang="ts">
// The trail above every page but home: the same names its structured data gives.
const { t } = useLocale()
const { crumbs } = useSitePage()
</script>
<template>
  <nav v-if="crumbs.length > 1" class="site-crumbs site-container" :aria-label="t('siteCrumbLabel')">
    <ol>
      <li v-for="(crumb, index) in crumbs" :key="crumb.path">
        <span v-if="index === crumbs.length - 1" aria-current="page">{{ crumb.name }}</span>
        <NuxtLink v-else :to="crumb.path">{{ crumb.name }}</NuxtLink>
      </li>
    </ol>
  </nav>
</template>
