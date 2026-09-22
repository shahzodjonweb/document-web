<script setup lang="ts">
const { t, path } = useLocale()
const ws = useWorkspace()
const studio = useStudio()
const title = ref('')
const prompt = ref('')
const busy = ref(false)
const error = ref('')
const draft = ref<any>(null)
const quote = ref<any>(null)
const key = ref('')
const configured = computed(() => studio.config.value?.provider?.image_configured === true)
onMounted(() => studio.load())
watch([title, prompt], () => {
  draft.value = null
  quote.value = null
})
async function review() {
  busy.value = true
  error.value = ''
  try {
    draft.value = await ws.api('/generation/drafts', {
      method: 'POST',
      body: {
        feature_id: 'ai.images',
        title: title.value,
        prompt: prompt.value,
        output_format: 'png',
        options: { length: 1, question_count: 0 },
      },
    })
    quote.value = await ws.api(`/generation/drafts/${draft.value.id}/quote`, {
      method: 'POST',
      body: { version: draft.value.version },
    })
    key.value = crypto.randomUUID()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
async function generate() {
  busy.value = true
  error.value = ''
  try {
    sessionStorage.setItem(
      'pdf-master-pending-job',
      JSON.stringify({ quote_id: quote.value.id, key: key.value }),
    )
    const job = await ws.api('/jobs', {
      method: 'POST',
      headers: { 'Idempotency-Key': key.value },
      body: { quote_id: quote.value.id },
    })
    sessionStorage.removeItem('pdf-master-pending-job')
    await ws.loadAccount()
    await navigateTo(path(`/app/jobs/${job.id}`))
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">{{ t('create') }}</span>
      <h1>{{ t('imageStudioTitle') }}</h1>
      <p>{{ t('imageStudioSub') }}</p>
    </div>
    <NuxtLink class="button secondary" :to="path('/app/create')"
      ><AppIcon name="file" :size="17" />{{ t('newDocument') }}</NuxtLink
    >
  </div>
  <div v-if="!configured" class="provider-banner">
    <span class="provider-icon"><AppIcon name="image" :size="22" /></span>
    <div>
      <strong>{{ t('imageProviderRequired') }}</strong>
      <p>{{ t('imageProviderNote') }}</p>
    </div>
  </div>
  <ErrorBanner v-if="error" :message="error" />
  <div class="studio-layout">
    <section class="panel studio-form">
      <h2>{{ t('imagePrompt') }}</h2>
      <label class="form-field"
        ><span>{{ t('title') }}</span
        ><input v-model="title" maxlength="160" /></label
      ><label class="form-field"
        ><span>{{ t('imageDescription') }}</span
        ><textarea v-model="prompt" rows="9" maxlength="12000" />
      </label>
      <p class="field-hint">{{ t('imageOutputNote') }}</p>
    </section>
    <aside class="panel studio-quote">
      <span class="tool-icon purple"><AppIcon name="image" :size="25" /></span>
      <h2>{{ t('reviewTitle') }}</h2>
      <div class="meter-row">
        <span>{{ t('format') }}</span
        ><strong>PNG</strong>
      </div>
      <div class="meter-row">
        <span>{{ t('resolution') }}</span
        ><strong>1024 × 1024</strong>
      </div>
      <template v-if="quote"
        ><div v-for="meter in quote.meters" :key="meter.meter" class="meter-row">
          <span>{{
            t(
              meter.meter === 'file_tasks'
                ? 'standardTasks'
                : meter.meter === 'file_page_units'
                  ? 'pageUnits'
                  : meter.meter,
            )
          }}</span
          ><strong>{{ meter.amount }}</strong>
        </div>
        <button class="button primary full" :disabled="busy || quote.affordable === false" @click="generate">
          {{ busy ? t('working') : t('generateImage') }}
        </button></template
      ><button
        v-else
        class="button primary full"
        :disabled="busy || !configured || !title.trim() || !prompt.trim()"
        @click="review"
      >
        {{ busy ? t('working') : t('getQuote') }}
      </button>
      <p>{{ t('noChargeBefore') }}</p>
    </aside>
  </div>
</template>
