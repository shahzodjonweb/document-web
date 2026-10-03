<script setup lang="ts">
import type { Feature } from '../../generated/api/types'
defineProps<{ feature: Feature; compact?: boolean; publicView?: boolean }>()
const { path } = useLocale()
const { icon, name, description, destination } = useTools()
</script>
<template>
  <NuxtLink
    :to="path(publicView ? `/tools/${feature.id}` : destination(feature.id))"
    class="tool-card"
    :class="{ compact }"
    ><span class="tool-icon" :class="{ ai: isGenerationFeature(feature.id) }"
      ><AppIcon :name="icon(feature.id)" :size="compact ? 20 : 22"
    /></span>
    <div class="tool-copy">
      <h3>{{ name(feature.id, feature.name) }}</h3>
      <p v-if="!compact">{{ description(feature.id) }}</p>
    </div>
    <AppIcon class="tool-arrow" name="right" :size="16"
  /></NuxtLink>
</template>
