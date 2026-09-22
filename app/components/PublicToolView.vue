<script setup lang="ts">
const props = defineProps<{ toolId: string }>()
const { t, path } = useLocale()
const ws = useWorkspace()
const { icons, colors } = useTools()
const feature = computed(() => ws.features.value.find((f) => f.id === props.toolId))
</script>
<template>
  <div v-if="feature">
    <NuxtLink class="back-link" :to="path('/tools')"
      ><AppIcon name="back" :size="16" />{{ t('backTools') }}</NuxtLink
    >
    <div class="page-heading tool-page-heading">
      <span class="tool-heading-icon" :class="colors[toolId] || 'sage'"
        ><AppIcon :name="icons[toolId] || 'file'" :size="28"
      /></span>
      <div>
        <h1>{{ t(`${toolId}.name`) }}</h1>
        <p>{{ t(`${toolId}.description`) }}</p>
      </div>
    </div>
    <div class="public-tool-intro">
      <section class="panel">
        <h2>{{ t('simpleTitle') }}</h2>
        <p>{{ t('helpGettingBody') }}</p>
        <NuxtLink class="button primary" :to="path(`/app/tools/${toolId}`)"
          >{{ t('start') }}<AppIcon name="right" :size="17"
        /></NuxtLink>
      </section>
      <section class="panel">
        <span class="privacy-symbol"><AppIcon name="shield" :size="25" /></span>
        <h2>{{ t('privateTitle') }}</h2>
        <p>{{ t('helpPrivacyBody') }}</p>
      </section>
    </div>
  </div>
  <div v-else class="empty-state">
    <h1>{{ t('unavailableTool') }}</h1>
    <NuxtLink class="button primary" :to="path('/tools')">{{ t('viewAll') }}</NuxtLink>
  </div>
</template>
