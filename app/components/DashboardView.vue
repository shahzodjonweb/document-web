<script setup lang="ts">
/*
 * Home leads with what people come for, and asks for no file: the AI services, then
 * what can be done with a file. A file is chosen on the next screen, once the customer
 * has said what to do with it (the tool's own page).
 */
const { t, path, date, timeZone } = useLocale()
const ws = useWorkspace()
const studio = useStudio()
const { sorted, name, description } = useTools()
const firstName = computed(() => (ws.user.value?.display_name || '').trim().split(/\s+/)[0] || '')
// The week's limits reset on Monday 00:00 in Tashkent, shown in this device's zone.
const resetsAt = computed(() => ws.usage.value?.week?.resets_at ?? ws.usage.value?.resets_at)
// The AI services get their own shortcuts, so the file tools below them are
// the familiar ones. Only the services the server lists are shown.
const aiShortcuts = computed(() =>
  studio.config.value
    ? studio.features.value.filter((f) => ['ai.pdf_topic', 'ai.pptx', 'ai.cv'].includes(f.id)).slice(0, 3)
    : [],
)
/*
 * Inside Telegram Home is the bot's main menu as a screen: the AI services, PDF from
 * photos and Invite friends sit at the top, as the bot's own buttons do.
 */
const telegram = useTelegramApp()
const tg = telegram.isMiniApp
const scanAvailable = computed(() => ws.features.value.some((f) => f.id === 'pdf.images_to_pdf'))
// The file tools, the AI services aside; inside Telegram PDF from photos has its own shortcut above them.
const popular = computed(() =>
  sorted.value
    .filter((f) => !isGenerationFeature(f.id) && !(tg.value && scanAvailable.value && f.id === 'pdf.images_to_pdf'))
    .slice(0, 5),
)
// Free accounts are told up front which Telegram channels to join, rather than
// only when a task is refused.
const gate = useState<{ channels: any[] } | null>('channel-gate', () => null)
const channels = ref<any>(null)
onMounted(async () => {
  if (!ws.user.value) return
  try {
    const state: any = await ws.api('/channels')
    channels.value = state.required && !state.joined ? state : null
  } catch {
    // The banner is a courtesy; the dialog still opens when a task is refused.
  }
})
watch(gate, (value) => {
  if (value?.channels?.every((c: any) => c.joined)) channels.value = null
})
</script>
<template>
  <div class="page-heading" data-testid="home-heading">
    <div>
      <h1>{{ firstName ? t('homeHello', { name: firstName }) : t('navHome') }}</h1>
      <p>{{ t('homeSub') }}</p>
    </div>
  </div>
  <div v-if="channels" class="info-banner channel-banner" data-testid="channel-banner">
    <AppIcon name="send" :size="18" />
    <p>{{ t('channelsBanner') }}</p>
    <button class="button primary small" type="button" @click="gate = { channels: channels.channels }">
      {{ t('channelsBannerAction') }}
    </button>
  </div>
  <section v-if="aiShortcuts.length" class="home-section">
    <div class="section-heading">
      <h2>{{ t('navCreate') }}</h2>
    </div>
    <div class="ai-shortcuts">
      <NuxtLink
        v-for="feature in aiShortcuts"
        :key="feature.id"
        :to="path(`/app/create?feature=${encodeURIComponent(feature.id)}`)"
        class="ai-shortcut panel"
        ><span class="tool-icon ai"><AppIcon name="sparkle" :size="22" /></span
        ><span class="ai-shortcut-copy"
          ><strong>{{ name(feature.id, feature.name) }}</strong
          ><span>{{ description(feature.id) }}</span></span
        ><AppIcon class="tool-arrow" name="right" :size="18"
      /></NuxtLink>
    </div>
  </section>
  <div v-if="tg" class="tg-shortcuts">
    <NuxtLink v-if="scanAvailable" :to="path('/app/tools/pdf.images_to_pdf')" class="tg-shortcut panel"
      ><span class="tool-icon"><AppIcon name="camera" :size="20" /></span
      ><strong>{{ name('pdf.images_to_pdf') }}</strong></NuxtLink
    ><NuxtLink :to="path('/app/referrals')" class="tg-shortcut panel" data-testid="home-invite"
      ><span class="tool-icon gift"><AppIcon name="gift" :size="20" /></span
      ><strong>{{ t('tgFreeGift') }}</strong></NuxtLink
      >
  </div>
  <section class="home-section" data-testid="home-files">
    <div class="section-heading">
      <div>
        <h2>{{ t('homeFiles') }}</h2>
        <p>{{ t('homeFilesSub') }}</p>
      </div>
      <NuxtLink :to="path('/app/tools')" class="text-link"
        >{{ t('viewAll') }}<AppIcon name="right" :size="16"
      /></NuxtLink>
    </div>
    <div v-if="popular.length" class="quick-tools">
      <ToolCard v-for="feature in popular" :key="feature.id" :feature="feature" compact />
    </div>
    <p v-else class="muted">{{ t('noCatalog') }}</p>
  </section>
  <section v-if="ws.usage.value?.ai_documents || ws.usage.value?.file_jobs" class="home-section">
    <div class="section-heading">
      <h2>{{ t('homePlan') }} · {{ t(ws.user.value?.plan || 'free') }}</h2>
      <NuxtLink :to="path('/app/billing')" class="text-link"
        >{{ t('navBilling') }}<AppIcon name="right" :size="16"
      /></NuxtLink>
    </div>
    <WeeklyUsage class="panel" />
    <p v-if="resetsAt" class="week-reset">{{ t('weekResets') }} {{ date(resetsAt, true) }} · {{ timeZone }}</p>
  </section>
  <section class="home-section">
    <div class="section-heading">
      <h2>{{ t('recentTitle') }}</h2>
      <NuxtLink :to="path('/app/jobs')" class="text-link"
        >{{ t('viewHistory') }}<AppIcon name="right" :size="16"
      /></NuxtLink>
    </div>
    <div class="panel"><JobList :jobs="ws.jobs.value.slice(0, 4)" /></div>
  </section>
</template>
