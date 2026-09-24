<script setup lang="ts">
const { t, path, date } = useLocale()
const ws = useWorkspace()
const studio = useStudio()
const title = ref('')
const prompt = ref('')
const automaticTitle = computed(() =>
  Array.from(prompt.value.trim().split(/\r?\n/, 1)[0]?.trim() || '')
    .slice(0, 160)
    .join(''),
)
const effectiveTitle = computed(() => title.value.trim() || automaticTitle.value)
const busy = ref(false)
const error = ref('')
const draft = ref<any>(null)
const quote = ref<any>(null)
const key = ref('')
const submissionPending = ref(false)
const configured = computed(() => studio.config.value?.provider?.image_configured === true)
const planEligible = computed(
  () => studio.features.value.find((feature) => feature.id === 'ai.images')?.eligible !== false,
)
const canGenerate = computed(() => configured.value && planEligible.value)
const validPrompt = computed(() => !!prompt.value.trim() && Array.from(prompt.value.trim()).length <= 4000)
onMounted(() => studio.load())
watch(
  [title, prompt],
  () => {
    draft.value = null
    quote.value = null
    key.value = ''
  },
  { flush: 'sync' },
)
async function review() {
  if (busy.value || submissionPending.value || !canGenerate.value || !validPrompt.value) return
  busy.value = true
  error.value = ''
  try {
    if (!draft.value)
      draft.value = await ws.api('/generation/drafts', {
        method: 'POST',
        body: {
          feature_id: 'ai.images',
          title: effectiveTitle.value,
          prompt: prompt.value.trim(),
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
  if (busy.value || !canGenerate.value || !quote.value || quote.value.affordable === false || !key.value)
    return
  busy.value = true
  error.value = ''
  try {
    submissionPending.value = true
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
    submissionPending.value = false
    await ws.loadAccount()
    await navigateTo(path(`/app/jobs/${job.id}`))
  } catch (e: any) {
    const status = e.statusCode || e.status || e.response?.status
    if (status >= 400 && status < 500) {
      submissionPending.value = false
      sessionStorage.removeItem('pdf-master-pending-job')
    }
    // An uncertain submission must be retried with its existing quote and key.
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
    </div>
  </div>
  <div v-if="configured && !planEligible" class="info-banner">{{ t('studioPlanUnavailable') }}</div>
  <ErrorBanner v-if="error" :message="error" />
  <div class="studio-layout">
    <section class="panel studio-form">
      <h2>{{ t('imagePrompt') }}</h2>
      <p class="field-hint">{{ t('studioImageQuickHint') }}</p>
      <label class="form-field"
        ><span>{{ t('imageDescription') }}</span
        ><textarea
          v-model="prompt"
          rows="7"
          maxlength="4000"
          :placeholder="t('studioImagePromptPlaceholder')"
          :disabled="busy || submissionPending"
        />
      </label>
      <details class="image-more-options">
        <summary>{{ t('studioMoreOptions') }}</summary>
        <label class="form-field"
          ><span>{{ t('studioTitleOptional') }}</span
          ><input
            v-model="title"
            maxlength="160"
            :placeholder="automaticTitle || t('studioAutoTitle')"
            :disabled="busy || submissionPending"
          />
          <small>{{ t('studioAutoTitle') }}</small>
        </label>
      </details>
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
        <p v-if="quote.expires_at">{{ t('quoteExpires') }} {{ date(quote.expires_at, true) }}</p>
        <div v-if="quote.affordable === false" class="info-banner">{{ t('quotaExceeded') }}</div>
        <button
          class="button primary full"
          :disabled="busy || !canGenerate || quote.affordable === false"
          @click="generate"
        >
          {{ busy ? t('working') : t(submissionPending ? 'retry' : 'generateImage') }}
        </button>
        <button
          class="button secondary full"
          :disabled="busy || submissionPending || !canGenerate || !validPrompt"
          @click="review"
        >
          {{ t('refreshQuote') }}
        </button></template
      ><button
        v-else
        class="button primary full"
        :disabled="busy || !canGenerate || !validPrompt"
        @click="review"
      >
        {{ busy ? t('working') : t('studioReviewCost') }}
      </button>
      <p>{{ t('noChargeBefore') }}</p>
    </aside>
  </div>
</template>

<style scoped>
.studio-form > .field-hint {
  margin-bottom: 18px;
}
.image-more-options {
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin: 4px 0 20px;
}
.image-more-options summary {
  color: var(--ink);
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
  display: list-item;
}
.image-more-options[open] summary {
  margin-bottom: 8px;
}
.image-more-options .form-field {
  margin-bottom: 0;
}
</style>
