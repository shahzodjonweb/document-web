<script setup lang="ts">
import { categoryLook, type StudioCategory } from '../../composables/useStudioCategories'
/**
 * One list of the AI PDF or AI Slides picker: the top of a service's list, or a
 * group's. Each button is a tile, its name, its line (top list only), a count
 * for a group and a chevron, drawn as Telegram's own lists are (`.tg-cell`) in
 * the Mini App and in a browser alike. A button is a real <button>, so the
 * whole row is one tap target and one stop for the keyboard.
 */
defineProps<{ nodes: StudioCategory[]; label: string; otherHint: string; compact?: boolean }>()
const emit = defineEmits<{ pick: [node: StudioCategory] }>()
const childCount = (node: StudioCategory) =>
  (node.children || []).filter((child) => child.kind !== 'other').length
</script>
<template>
  <nav class="tg-list category-list" :class="{ compact }" :aria-label="label" data-testid="category-list">
    <button
      v-for="node in nodes"
      :key="node.id"
      type="button"
      class="tg-cell category-cell"
      :data-testid="`category-${node.id}`"
      :data-kind="node.kind"
      @click="emit('pick', node)"
    >
      <span class="category-tile" :data-tone="categoryLook(node).tone"
        ><AppIcon :name="categoryLook(node).icon" :size="compact ? 18 : 20"
      /></span>
      <span class="tg-cell-text"
        ><strong>{{ node.label }}</strong
        ><small v-if="node.kind === 'other' ? otherHint : node.hint">{{
          node.kind === 'other' ? otherHint : node.hint
        }}</small></span
      >
      <span v-if="node.kind === 'group'" class="category-count">{{ childCount(node) }}</span>
      <AppIcon class="tg-cell-chevron" name="chevron" :size="16" />
    </button>
  </nav>
</template>
