<script setup lang="ts">
const { t, path } = useLocale()
const ws = useWorkspace()
const { sorted } = useTools()
const fileInput = ref<HTMLInputElement>()
const busy = ref(false)
const error = ref('')
const dragging = ref(false)
const officeAvailable = computed(() => ws.features.value.some((f) => f.id === 'convert.word_to_pdf'))
const balance = computed(() => (ws.usage.value as any)?.meters?.file_tasks)
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
      <div class="eyebrow greeting-eyebrow"><span />{{ t('morning') }}</div>
      <h1>{{ t('greeting') }}</h1>
      <p>{{ t('dashboardSub') }}</p>
    </div>
    <NuxtLink :to="path('/app/tools')" class="button secondary"
      ><AppIcon name="plus" :size="18" />{{ t('newTask') }}</NuxtLink
    >
  </div>
  <ErrorBanner v-if="error" :message="error" />
  <div class="dashboard-top">
    <section
      class="dashboard-drop"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <div class="document-art" aria-hidden="true">
        <div class="doc-back" />
        <div class="doc-front">
          <span class="doc-corner" /><span class="doc-label">PDF</span><i /><i /><i />
        </div>
        <span class="doc-plus"><AppIcon name="plus" :size="19" /></span>
      </div>
      <h2>{{ busy ? t('uploading') : t('uploadTitle') }}</h2>
      <p>{{ t('uploadSub') }}</p>
      <button class="button primary" @click="fileInput?.click()" :disabled="busy">
        <AppIcon :name="busy ? 'loader' : 'upload'" :size="17" :class="{ spin: busy }" />{{
          t('chooseFiles')
        }}</button
      ><input
        ref="fileInput"
        class="visually-hidden"
        type="file"
        multiple
        :accept="officeAvailable ? '.pdf,.jpg,.jpeg,.png,.docx,.pptx' : '.pdf,.jpg,.jpeg,.png'"
        @change="upload(($event.target as HTMLInputElement).files)"
        :aria-label="t('chooseFiles')"
      /><small>{{ t(officeAvailable ? 'supported' : 'supportedBasic') }}</small>
    </section>
    <aside class="dashboard-rail">
      <section class="privacy-card">
        <span class="privacy-symbol"><AppIcon name="shield" :size="26" /></span>
        <h3>{{ t('privateTitle') }}</h3>
        <p>{{ t('privateBody') }}</p>
        <div class="privacy-rule" />
        <span class="small-info"><AppIcon name="clock" :size="15" />{{ t('retention') }}</span>
      </section>
      <NuxtLink :to="path('/app/billing')" class="usage-card"
        ><div>
          <span>{{ t('standardTasks') }}</span
          ><AppIcon name="arrow" :size="15" />
        </div>
        <p v-if="balance">
          <strong>{{ balance.remaining }}</strong
          ><span>/ {{ balance.limit }} {{ t('remaining') }}</span>
        </p>
        <p v-else class="muted">{{ t('loading') }}</p>
        <div class="usage-track">
          <span
            :style="{
              width: balance
                ? `${Math.max(0, Math.min(100, (balance.remaining / balance.limit) * 100))}%`
                : '0%',
            }"
          />
        </div>
        <small>{{ t(ws.user.value?.plan || 'free') }} · {{ t('perPeriod') }}</small></NuxtLink
      >
    </aside>
  </div>
  <section class="section-block">
    <div class="section-heading">
      <div>
        <h2>{{ t('popularTools') }}</h2>
        <p>{{ t('popularSub') }}</p>
      </div>
      <NuxtLink :to="path('/app/tools')" class="text-link"
        >{{ t('viewAll') }}<AppIcon name="right" :size="16"
      /></NuxtLink>
    </div>
    <div class="quick-tools">
      <ToolCard v-for="feature in sorted.slice(0, 5)" :key="feature.id" :feature="feature" compact />
    </div>
    <p v-if="!sorted.length" class="muted">{{ t('noCatalog') }}</p>
  </section>
  <section class="section-block">
    <div class="section-heading">
      <h2>{{ t('recentTitle') }}</h2>
      <NuxtLink :to="path('/app/jobs')" class="text-link"
        >{{ t('viewHistory') }}<AppIcon name="right" :size="16"
      /></NuxtLink>
    </div>
    <div class="panel"><JobList :jobs="ws.jobs.value.slice(0, 4)" /></div>
  </section>
  <div class="help-strip">
    <span><AppIcon name="help" :size="18" />{{ t('supportTitle') }}</span
    ><NuxtLink :to="path('/app/support')"
      >{{ t('contactSupport') }}<AppIcon name="arrow" :size="16"
    /></NuxtLink>
  </div>
</template>
