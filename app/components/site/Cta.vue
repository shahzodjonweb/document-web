<script setup lang="ts">
// The closing ink band with the folded corner: a title, a line, the main action and the bot.
defineProps<{ title: string; line?: string; action?: string; to?: string }>()
const { t, start, bot } = useSite()
</script>
<template>
  <section class="site-cta">
    <div class="site-container">
      <div class="site-cta-band">
        <span class="site-cta-fold" aria-hidden="true"></span>
        <div>
          <h2 class="site-h2">{{ title }}</h2>
          <p v-if="line">{{ line }}</p>
        </div>
        <div class="site-actions">
          <NuxtLink class="site-btn is-primary is-lg" :to="to || start()">{{ action || t('siteNavStart') }}</NuxtLink>
          <a v-if="bot?.url" class="site-btn is-secondary is-lg" :href="bot.url" target="_blank" rel="noopener"
            ><AppIcon name="send" class="site-icon" />Telegram</a
          >
        </div>
      </div>
    </div>
  </section>
</template>
