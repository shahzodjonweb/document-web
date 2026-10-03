<script setup lang="ts">
const { t } = useLocale()
const route = useRoute()
const { sorted, category, name, description } = useTools()
const search = ref('')
const selected = ref('allCategories')
const categories = [
  'allCategories',
  'aiCategory',
  'pagesCategory',
  'compressionCategory',
  'conversionCategory',
  'securityCategory',
  'ocrCategory',
  'editor',
  'automationCategory',
]
// The public directory stays file-tools only: generation needs an account, and
// `/tools/<id>` has no page for a feature that lives in the studio.
const publicView = computed(() => !route.path.includes('/app'))
const filtered = computed(() =>
  sorted.value.filter(
    (f) =>
      !(publicView.value && isGenerationFeature(f.id)) &&
      (selected.value === 'allCategories' || category(f.id) === selected.value) &&
      `${name(f.id, f.name)} ${description(f.id)}`
        .toLocaleLowerCase()
        .includes(search.value.toLocaleLowerCase()),
  ),
)
// A category with nothing in it is not offered.
const offered = computed(() =>
  categories.filter(
    (item) =>
      item === 'allCategories' ||
      sorted.value.some(
        (f) => category(f.id) === item && !(publicView.value && isGenerationFeature(f.id)),
      ),
  ),
)
function resetSearch() {
  search.value = ''
  selected.value = 'allCategories'
}
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>{{ t('tools') }}</h1>
      <p>{{ t('toolsLead') }}</p>
    </div>
  </div>
  <div class="directory-toolbar">
    <div class="category-tabs" role="group" :aria-label="t('navTools')">
      <button
        v-for="item in offered"
        :key="item"
        type="button"
        :class="{ selected: selected === item }"
        :aria-pressed="selected === item"
        @click="selected = item"
      >
        {{ t(item) }}
      </button>
    </div>
    <label class="search-box"
      ><AppIcon name="search" :size="18" /><input
        v-model="search"
        type="search"
        :placeholder="t('searchTools')"
        :aria-label="t('searchTools')"
    /></label>
  </div>
  <div v-if="filtered.length" class="tool-grid">
    <ToolCard
      v-for="feature in filtered"
      :key="feature.id"
      :feature="feature"
      :public-view="publicView"
    />
  </div>
  <div v-else class="empty-state panel">
    <AppIcon name="search" :size="28" />
    <h3>{{ t('emptySearch') }}</h3>
    <button class="text-link" type="button" @click="resetSearch">
      {{ t('viewAll') }}
    </button>
  </div>
  <p class="directory-note">
    <AppIcon name="shield" :size="16" />{{ t('secureNote') }} · {{ t('noInstall') }}
  </p>
</template>
