<script setup lang="ts">
/** In a browser there is no Telegram button, so the frame draws the one filled button itself. */
const { browserPrimary, pressPrimary } = useTelegramApp()
</script>

<template>
  <div v-if="browserPrimary" class="editor-primary-fallback">
    <button
      type="button"
      class="button primary full"
      data-testid="editor-primary"
      :disabled="browserPrimary.enabled === false || browserPrimary.busy"
      @click="pressPrimary"
    >
      <AppIcon v-if="browserPrimary.busy" name="loader" class="spin" :size="16" />{{ browserPrimary.text }}
    </button>
  </div>
</template>
