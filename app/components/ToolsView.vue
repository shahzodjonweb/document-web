<script setup lang="ts">
const { t, path } = useLocale()
const studio = useStudio()
const route = useRoute()
const { sorted, category, name, description } = useTools()
const search = ref('')
const selected = ref('allCategories')
const categories = [
  'allCategories',
  'pagesCategory',
  'compressionCategory',
  'conversionCategory',
  'securityCategory',
  'ocrCategory',
  'editor',
  'automationCategory',
]
const filtered = computed(() =>
  sorted.value.filter(
    (f) =>
      (selected.value === 'allCategories' || category(f.id) === selected.value) &&
      `${name(f.id, f.name)} ${description(f.id)}`
        .toLocaleLowerCase()
        .includes(search.value.toLocaleLowerCase()),
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
      <div class="eyebrow">{{ t('toolkit') }}</div>
      <h1>{{ t('toolsTitle') }}</h1>
      <p>{{ t('toolsSub') }}</p>
    </div>
  </div>
  <nav v-if="route.path.includes('/app') && studio.config.value" class="workspace-hubs">
    <NuxtLink
      v-for="item in [
        { url: 'create', label: 'create', icon: 'sparkle' },
        { url: 'study', label: 'education', icon: 'book' },
        { url: 'workflows', label: 'workflows', icon: 'reorder' },
        { url: 'bot', label: 'bot', icon: 'send' },
        { url: 'templates', label: 'templates', icon: 'files' },
        { url: 'projects', label: 'projects', icon: 'folder' },
        { url: 'editor', label: 'editor', icon: 'edit' },
        { url: 'referrals', label: 'referrals', icon: 'send' },
      ]"
      :key="item.url"
      :to="path(`/app/${item.url}`)"
      ><AppIcon :name="item.icon" :size="20" />{{ t(item.label) }}</NuxtLink
    >
  </nav>
  <div class="directory-toolbar">
    <div class="category-tabs">
      <button
        v-for="item in categories"
        :key="item"
        :class="{ selected: selected === item }"
        @click="selected = item"
      >
        {{ t(item) }}
      </button>
    </div>
    <label class="search-box"
      ><AppIcon name="search" :size="18" /><input
        v-model="search"
        :placeholder="t('searchTools')"
        :aria-label="t('searchTools')"
    /></label>
  </div>
  <div v-if="filtered.length" class="tool-grid">
    <ToolCard
      v-for="feature in filtered"
      :key="feature.id"
      :feature="feature"
      :public-view="!route.path.includes('/app')"
    />
  </div>
  <div v-else class="empty-state panel">
    <AppIcon name="search" :size="30" />
    <h3>{{ t('emptySearch') }}</h3>
    <button class="text-link" @click="resetSearch">
      {{ t('viewAll') }}
    </button>
  </div>
  <p class="directory-note">
    <AppIcon name="shield" :size="16" />{{ t('secureNote') }} · {{ t('noInstall') }}
  </p>
</template>
