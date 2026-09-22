<script setup lang="ts">
import type { Feature } from '../../generated/api/types'
defineProps<{ feature: Feature; compact?: boolean; publicView?: boolean }>()
const { t, path } = useLocale()
const { icons, colors, name, description, destination } = useTools()
</script>
<template>
  <NuxtLink
    :to="path(publicView ? `/tools/${feature.id}` : destination(feature.id))"
    class="tool-card"
    :class="{ compact }"
    ><span class="tool-icon" :class="colors[feature.id] || 'sage'"
      ><AppIcon :name="icons[feature.id] || 'file'" :size="24"
    /></span>
    <div>
      <h3>{{ name(feature.id, feature.name) }}</h3>
      <p v-if="!compact">{{ description(feature.id) }}</p>
    </div>
    <AppIcon class="tool-arrow" name="arrow" :size="17"
  /></NuxtLink>
</template>
