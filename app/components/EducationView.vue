<script setup lang="ts">
const props = defineProps<{ mode?: string }>()
const { t, path } = useLocale()
const studio = useStudio()
const { name } = useTools()
const mode = computed(() =>
  props.mode === 'school' ? 'school' : props.mode === 'teach' ? 'teacher' : 'student',
)
const prefix = computed(() => (mode.value === 'student' ? 'study.' : `${mode.value}.`))
const features = computed(() => studio.features.value.filter((f) => f.id.startsWith(prefix.value)))
onMounted(() => {
  if (!studio.loaded.value) studio.load()
})
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">{{ t('education') }}</span>
      <h1>{{ t('educationTitle') }}</h1>
      <p>{{ t('educationSub') }}</p>
    </div>
    <NuxtLink :to="path('/app/projects')" class="button secondary"
      ><AppIcon name="folder" :size="17" />{{ t('projects') }}</NuxtLink
    >
  </div>
  <div class="education-modes">
    <NuxtLink
      v-for="item in [
        { id: 'student', url: 'study', icon: 'word' },
        { id: 'school', url: 'school', icon: 'file' },
        { id: 'teacher', url: 'teach', icon: 'files' },
      ]"
      :key="item.id"
      :to="path(`/app/${item.url}`)"
      :class="{ selected: mode === item.id }"
      ><span
        class="tool-icon"
        :class="item.id === 'student' ? 'purple' : item.id === 'school' ? 'green' : 'orange'"
        ><AppIcon :name="item.icon" :size="24" /></span
      ><strong>{{ t(item.id) }}</strong>
      <p>{{ t(`${item.id}Description`) }}</p>
      <AppIcon class="mode-arrow" name="arrow" :size="18"
    /></NuxtLink>
  </div>
  <div v-if="studio.localProvider.value" class="provider-banner">
    <AppIcon name="sparkle" :size="21" />
    <div>
      <strong>{{ t('localProvider') }}</strong>
      <p>{{ t('localProviderNote') }}</p>
    </div>
  </div>
  <div class="education-grid">
    <NuxtLink
      v-for="feature in features"
      :key="feature.id"
      :to="path(`/app/create?feature=${encodeURIComponent(feature.id)}`)"
      class="panel education-tool"
      ><AppIcon
        :name="
          feature.id.includes('quiz') || feature.id.includes('test')
            ? 'checks'
            : feature.id.includes('plan')
              ? 'reorder'
              : feature.id.includes('slides')
                ? 'files'
                : 'file'
        "
        :size="24"
      />
      <h3>{{ name(feature.id, feature.name) }}</h3>
      <span>{{ t('selectTool') }}<AppIcon name="right" :size="15" /></span
      ><small v-if="feature.eligible === false" class="tool-locked"
        ><AppIcon name="lock" :size="13" />{{ t('billing') }}</small
      ></NuxtLink
    >
  </div>
  <div v-if="!features.length" class="empty-state panel">
    <AppIcon name="word" :size="28" />
    <h2>{{ studio.loaded.value ? t('notAvailable') : t('loading') }}</h2>
    <button class="button secondary" @click="studio.load">{{ t('refresh') }}</button>
  </div>
</template>
