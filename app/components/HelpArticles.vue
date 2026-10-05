<script setup lang="ts">
/** The help articles, with a search, and the guide to describing an AI document. */
const props = defineProps<{ keys?: string[]; guide?: boolean }>()
const { t, path } = useLocale()
const query = ref('')
const articles = computed(() =>
  (props.keys || ['helpGetting', 'helpFormats', 'helpPrivacy', 'helpBilling']).map((key) => ({
    key,
    title: t(key),
    body: t(`${key}Body`),
  })),
)
const found = computed(() => {
  const words = query.value.trim().toLocaleLowerCase()
  return words
    ? articles.value.filter((a) => `${a.title} ${a.body}`.toLocaleLowerCase().includes(words))
    : articles.value
})
</script>
<template>
  <div class="help-area">
    <label class="search-box help-search"
      ><AppIcon name="search" :size="18" /><input
        v-model="query"
        type="search"
        :placeholder="t('helpSearch')"
        :aria-label="t('helpSearch')"
    /></label>
    <div class="help-articles">
      <NuxtLink v-if="guide && !query" :to="path('/app/guide')" class="panel help-card help-guide"
        ><span class="tool-icon ai"><AppIcon name="sparkle" :size="20" /></span>
        <h2>{{ t('guideTitle') }}</h2>
        <p>{{ t('guideSub') }}</p>
        <span class="text-link">{{ t('learnMore') }}<AppIcon name="right" :size="15" /></span>
      </NuxtLink>
      <section v-for="article in found" :key="article.key" class="panel help-card">
        <h2>{{ article.title }}</h2>
        <p>{{ article.body }}</p>
      </section>
    </div>
    <p v-if="!found.length" class="muted help-empty">{{ t('helpNoResults') }}</p>
  </div>
</template>
