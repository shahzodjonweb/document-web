<script setup lang="ts">
// The legal pages as they are until the signed-off texts replace them (step W5).
definePageMeta({ layout: 'site' })
const route = useRoute()
</script>
<template>
  <div>
    <SiteBreadcrumb />
    <div class="site-container site-section is-tight site-legacy"><HelpView :legal="String(route.params.doc)" /></div>
  </div>
</template>
