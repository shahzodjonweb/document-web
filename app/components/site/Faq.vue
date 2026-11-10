<script setup lang="ts">
// A page's questions (content/site/faq.ts) as one accessible accordion.
const props = defineProps<{ page: string; title: string; to?: string; link?: string; open?: boolean }>()
const { faq } = useSite()
const items = computed(() => faq(props.page))
</script>
<template>
  <section v-if="items.length" class="site-section" :aria-labelledby="`faq-${page}`">
    <div class="site-container site-faq-grid">
      <div>
        <h2 :id="`faq-${page}`" class="site-h2">{{ title }}</h2>
        <NuxtLink v-if="to && link" class="site-link-arrow" :to="to"
          >{{ link }}<AppIcon name="right" class="site-icon is-sm"
        /></NuxtLink>
      </div>
      <div class="site-faq">
        <details v-for="(item, index) in items" :key="item.id" :open="open && index === 0">
          <summary>{{ item.q }}<AppIcon name="plus" class="site-icon" /></summary>
          <div><p>{{ item.a }}</p></div>
        </details>
      </div>
    </div>
  </section>
</template>
