<script setup lang="ts">
// The prompt guide keeps its own content, now in the public site's frame.
definePageMeta({ layout: 'site' })
</script>
<template>
  <div>
    <SiteBreadcrumb />
    <div class="site-container site-section is-tight site-legacy"><GuideView /></div>
  </div>
</template>
