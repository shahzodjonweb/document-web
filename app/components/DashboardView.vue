<script setup lang="ts">
const { t, path, date, timeZone } = useLocale()
const ws = useWorkspace()
const studio = useStudio()
const { sorted, name, description } = useTools()
const fileInput = ref<HTMLInputElement>()
const busy = ref(false)
const error = ref('')
const dragging = ref(false)
const officeAvailable = computed(() => ws.features.value.some((f) => f.id === 'convert.word_to_pdf'))
const firstName = computed(() => (ws.user.value?.display_name || '').trim().split(/\s+/)[0] || '')
// The week's limits reset on Monday 00:00 in Tashkent, shown in this device's zone.
const resetsAt = computed(() => ws.usage.value?.week?.resets_at ?? ws.usage.value?.resets_at)
// The two AI services get their own shortcuts, so the file tools below them
// are the familiar ones.
const aiShortcuts = computed(() =>
  studio.config.value
    ? studio.features.value.filter((f) => ['ai.pdf_topic', 'ai.pptx'].includes(f.id)).slice(0, 2)
    : [],
)
const popular = computed(() => sorted.value.filter((f) => !isGenerationFeature(f.id)).slice(0, 5))
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
async function upload(files: FileList | File[] | null) {
  if (!files?.length) return
  busy.value = true
  error.value = ''
  try {
    ws.activeUploads.value = []
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      ws.activeUploads.value.push(await ws.api('/files/uploads', { method: 'POST', body: form }))
    }
    ws.activeTool.value = Array.from(files)[0]?.name.toLowerCase().endsWith('.docx')
      ? 'convert.word_to_pdf'
      : Array.from(files)[0]?.name.toLowerCase().endsWith('.pptx')
        ? 'convert.pptx_to_pdf'
        : Array.from(files).every((f) => f.type.startsWith('image/'))
          ? 'pdf.images_to_pdf'
          : files.length > 1
            ? 'pdf.merge'
            : 'pdf.compress'
    ws.activeParameters.value = {}
    ws.quote.value = null
    ws.persistDraft()
    await navigateTo(path(`/app/tools/${ws.activeTool.value}`))
  } catch (e: any) {
    error.value = e.data?.error?.message || e.data?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
function onDrop(event: DragEvent) {
  dragging.value = false
  upload(event.dataTransfer?.files || null)
}
</script>
<template>
  <div class="page-heading">
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
  <ErrorBanner v-if="error" :message="error" />
  <section
    class="dashboard-drop"
    :class="{ dragging }"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <span class="drop-icon" aria-hidden="true"
      ><AppIcon :name="busy ? 'loader' : 'upload'" :size="26" :class="{ spin: busy }"
    /></span>
    <div class="drop-copy">
      <h2>{{ busy ? t('uploading') : t('dropTitle') }}</h2>
      <p>{{ t('dropSub') }}</p>
    </div>
    <div class="drop-action">
      <button class="button primary" @click="fileInput?.click()" :disabled="busy">
        {{ t('chooseFiles') }}</button
      ><small>{{ t(officeAvailable ? 'supported' : 'supportedBasic') }}</small>
    </div>
    <input
      ref="fileInput"
      class="visually-hidden"
      type="file"
      multiple
      :accept="officeAvailable ? '.pdf,.jpg,.jpeg,.png,.docx,.pptx' : '.pdf,.jpg,.jpeg,.png'"
      @change="upload(($event.target as HTMLInputElement).files)"
      :aria-label="t('chooseFiles')"
    />
  </section>
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
      <h2>{{ t('homeTools') }}</h2>
      <NuxtLink :to="path('/app/tools')" class="text-link"
        >{{ t('viewAll') }}<AppIcon name="right" :size="16"
      /></NuxtLink>
    </div>
    <div v-if="popular.length" class="quick-tools">
      <ToolCard v-for="feature in popular" :key="feature.id" :feature="feature" compact />
    </div>
    <p v-else class="muted">{{ t('noCatalog') }}</p>
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
