<script setup lang="ts">
import type { Job } from '../../generated/api/types'
const props = defineProps<{ jobId: string }>()
const { t, count, path, date, timeZone } = useLocale()
const ws = useWorkspace()
const { name, destination } = useTools()
const nextRoute = computed(() => destination(job.value?.feature_id || ''))
const job = ref<Job | null>(null)
const error = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
const terminal = ['succeeded', 'failed', 'canceled', 'expired', 'no_op', 'noop']
const active = computed(() => job.value && !terminal.includes(job.value.status))
const success = computed(() => job.value?.status === 'succeeded')
const noop = computed(() => ['no_op', 'noop'].includes(job.value?.status || ''))
const stages = ['queued', 'preparing', 'processing', 'finalizing', 'succeeded']
const stageIndex = computed(() =>
  job.value
    ? Math.max(
        0,
        stages.indexOf(job.value.stage || (job.value.status === 'running' ? 'processing' : job.value.status)),
      )
    : 0,
)
const meters = computed(() =>
  Object.entries((job.value as any)?.settled_meters || job.value?.settled_usage || {}).filter(
    ([, amount]) => Number(amount) > 0,
  ),
)
const outputs = computed(() => job.value?.artifacts || job.value?.outputs || [])
/**
 * A generated document can be changed by asking; a converted file cannot.
 * The draft behind the job is what the change applies to.
 */
const reviseDraftId = computed(() =>
  success.value && isGenerationFeature(job.value?.feature_id || '')
    ? (job.value as any)?.parameters?.generation_draft_id || ''
    : '',
)
const change = ref('')
const revising = ref(false)
const revisionSource = ref<any>(null)
const revisionSection = ref('')
watch(reviseDraftId, async (id) => {
  revisionSource.value = null
  revisionSection.value = ''
  if (!id) return
  try {
    const source = await ws.api(`/generation/drafts/${id}`)
    if (reviseDraftId.value === id) revisionSource.value = source
  } catch {
    // Whole-document changes retain the existing path if this optional read fails.
  }
})
const retryAvailable = computed(
  () =>
    job.value?.status === 'failed' &&
    isGenerationFeature(job.value.feature_id) &&
    job.value.feature_id !== 'ai.images',
)
const retryQuote = ref<any>(null)
const retryBusy = ref(false)
const retryPending = ref(false)
const retryKey = ref('')
const retryMeters = computed(() => {
  const value = retryQuote.value?.meters || []
  return Array.isArray(value) ? value : Object.entries(value).map(([meter, amount]) => ({ meter, amount }))
})
async function reviewRetry() {
  if (retryBusy.value || retryPending.value) return
  retryBusy.value = true
  error.value = ''
  try {
    retryQuote.value = await ws.api(`/generation/jobs/${props.jobId}/retry-quote`, {
      method: 'POST',
      body: {},
    })
    retryKey.value = crypto.randomUUID()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    retryBusy.value = false
  }
}
async function confirmRetry() {
  if (retryBusy.value || !retryQuote.value || retryQuote.value.affordable === false) return
  retryBusy.value = true
  error.value = ''
  const key = retryKey.value || (retryKey.value = crypto.randomUUID())
  const quoteId = retryQuote.value.id
  retryPending.value = true
  sessionStorage.setItem('pdf-master-pending-job', JSON.stringify({ quote_id: quoteId, key }))
  try {
    const result: any = await ws.api('/jobs', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: { quote_id: quoteId },
    })
    sessionStorage.removeItem('pdf-master-pending-job')
    retryPending.value = false
    retryQuote.value = null
    await navigateTo(path(`/app/jobs/${result.id}`))
  } catch (e: any) {
    const status = e.statusCode || e.status || e.response?.status
    if (status >= 400 && status < 500) {
      retryPending.value = false
      sessionStorage.removeItem('pdf-master-pending-job')
    }
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    retryBusy.value = false
  }
}
async function revise() {
  if (!change.value.trim() || revising.value) return
  revising.value = true
  error.value = ''
  try {
    const draft: any = await ws.api('/generation/drafts', {
      method: 'POST',
      body: {
        prompt: change.value.trim(),
        options: {
          revise_draft_id: reviseDraftId.value,
          ...(revisionSection.value && revisionSource.value
            ? {
                revise_section_ids: [revisionSection.value],
                revise_base_version: revisionSource.value.version,
              }
            : {}),
        },
      },
    })
    await navigateTo(path(`/app/create/${draft.id}`))
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    revising.value = false
  }
}
async function cancel() {
  try {
    await ws.api(`/jobs/${props.jobId}/cancel`, { method: 'POST', body: {} })
    if (timer) clearTimeout(timer)
    await refresh()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  }
}
async function refresh() {
  try {
    job.value = await ws.api(`/jobs/${props.jobId}`)
    error.value = ''
    if (active.value) timer = setTimeout(refresh, 1800)
    else await ws.loadAccount()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('apiError')
  }
}
onMounted(refresh)
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
watch(
  () => props.jobId,
  () => {
    if (timer) clearTimeout(timer)
    retryQuote.value = null
    retryPending.value = false
    retryKey.value = ''
    refresh()
  },
)
function downloadUrl(url: string | undefined, id: string) {
  return url || `/api/v1/artifacts/${id}/download`
}
</script>
<template>
  <div class="job-page">
    <NuxtLink class="back-link" :to="path('/app/jobs')"
      ><AppIcon name="back" :size="16" />{{ t('navTasks') }}</NuxtLink
    ><ErrorBanner v-if="error" :message="error"
      ><button class="text-link" @click="refresh">{{ t('retry') }}</button></ErrorBanner
    >
    <div v-if="job" class="job-detail">
      <section class="result-heading">
        <span class="result-symbol" :class="{ success, failed: job.status === 'failed' }"
          ><AppIcon
            :name="success ? 'checks' : noop ? 'check' : job.status === 'failed' ? 'alert' : 'loader'"
            :size="34"
            :class="{ spin: active }" /></span
        ><StatusBadge :status="job.status" />
        <h1>
          {{
            t(
              success
                ? 'taskComplete'
                : noop
                  ? 'taskNoop'
                  : job.status === 'failed'
                    ? 'taskFailed'
                    : 'taskStarted',
            )
          }}
        </h1>
        <p>{{ name(job.feature_id) }} · {{ date(job.created_at, true) }}</p>
      </section>
      <div v-if="active" class="panel processing-stages" role="status" aria-live="polite">
        <div
          v-for="(stage, index) in stages"
          :key="stage"
          :class="{ done: index < stageIndex, active: index === stageIndex }"
        >
          <span
            ><AppIcon
              :name="index < stageIndex ? 'check' : index === stageIndex ? 'loader' : 'circle'"
              :size="19"
              :class="{ spin: index === stageIndex }" /></span
          ><strong>{{ t(stage) }}</strong>
        </div>
      </div>
      <ErrorBanner
        v-if="job.error"
        :message="typeof job.error === 'string' ? job.error : (job.error as any).message || t('genericError')"
      />
      <div v-if="noop" class="info-banner"><AppIcon name="check" :size="20" />{{ t('noopBody') }}</div>
      <section v-if="outputs.length" class="panel result-panel">
        <div class="panel-heading">
          <h2>{{ t('output') }}</h2>
          <span class="count-tag">{{ count('outputs', outputs.length) }}</span>
        </div>
        <div v-for="artifact in outputs" :key="artifact.id" class="artifact-row">
          <span class="file-tile"><AppIcon name="ready" :size="26" /></span>
          <div>
            <strong>{{ artifact.name || artifact.filename || 'PDF' }}</strong
            ><small>{{ Math.max(1, Math.round((artifact.size_bytes || artifact.size || 0) / 1024)) }} KB</small>
          </div>
          <a class="button primary" :href="downloadUrl(artifact.download_url, artifact.id)" download
            ><AppIcon name="download" :size="17" />{{ t('download') }}</a
          >
        </div>
        <ArtifactActions v-for="artifact in outputs" :key="`actions-${artifact.id}`" :artifact="artifact" />
        <p v-if="job.expires_at || outputs[0]?.expires_at" class="retention-note">
          <AppIcon name="clock" :size="15" />{{ t('expires') }}
          {{ date(job.expires_at || outputs[0]?.expires_at, true) }} · {{ timeZone }}
        </p>
      </section>
      <section v-if="meters.length" class="panel receipt-panel">
        <h3>{{ t('taskUsed') }}</h3>
        <div v-for="[meter, amount] in meters" :key="meter">
          <span>{{
            t(meter === 'file_tasks' ? 'standardTask' : meter === 'file_page_units' ? 'pageUnits' : meter)
          }}</span
          ><strong>{{ amount }}</strong>
        </div>
      </section>
      <p v-for="warning in job.warnings" :key="warning" class="info-banner">{{ t(warning) }}</p>
      <!-- Say what should change; everything unmentioned stays as it is. -->
      <section v-if="reviseDraftId" class="panel revise-panel" data-testid="job-revise">
        <h3><AppIcon name="edit" :size="18" />{{ t('reviseTitle') }}</h3>
        <p>{{ t('reviseBody') }}</p>
        <label v-if="revisionSource?.content?.sections?.length" class="form-field">
          <span>{{ t('reviseScope') }}</span>
          <select v-model="revisionSection" data-testid="job-revise-scope">
            <option value="">{{ t('reviseWhole') }}</option>
            <option
              v-for="(section, index) in revisionSource.content.sections"
              :key="section.id"
              :value="section.id"
            >
              {{ Number(index) + 1 }}. {{ section.heading || t('reviseUntitled') }}
            </option>
          </select>
          <small>{{ t('reviseScopeHint') }}</small>
        </label>
        <label class="form-field"
          ><span>{{ t('reviseLabel') }}</span
          ><textarea
            v-model="change"
            data-testid="job-revise-input"
            rows="3"
            :placeholder="t('revisePlaceholder')"
          />
          <small>{{ t('reviseExamples') }}</small>
        </label>
        <button
          class="button primary"
          data-testid="job-revise-submit"
          :disabled="!change.trim() || revising"
          @click="revise"
        >
          <AppIcon :name="revising ? 'loader' : 'sparkle'" :size="17" :class="{ spin: revising }" />{{
            t('reviseAction')
          }}
        </button>
        <p class="field-hint">{{ t('noChargeBefore') }}</p>
      </section>
      <section v-if="retryAvailable" class="panel revise-panel" data-testid="job-retry">
        <h3>{{ t('generationRetryTitle') }}</h3>
        <p>{{ t('generationRetryBody') }}</p>
        <button
          v-if="!retryQuote"
          class="button primary"
          data-testid="job-retry-review"
          :disabled="retryBusy"
          @click="reviewRetry"
        >
          {{ t('generationRetryReview') }}
        </button>
        <div v-else data-testid="job-retry-quote">
          <div v-for="meter in retryMeters" :key="meter.meter" class="meter-row">
            <span>{{ t(meter.meter) }}</span
            ><strong>{{ meter.amount }}</strong>
          </div>
          <p>{{ t('quoteExpires') }} {{ date(retryQuote.expires_at, true) }}</p>
          <p v-if="retryQuote.affordable === false" class="info-banner">{{ t('quotaExceeded') }}</p>
          <button
            class="button primary"
            data-testid="job-retry-confirm"
            :disabled="retryBusy || retryQuote.affordable === false"
            @click="confirmRetry"
          >
            {{ t(retryPending ? 'retry' : 'generationRetryConfirm') }}
          </button>
          <button class="button secondary" :disabled="retryBusy || retryPending" @click="reviewRetry">
            {{ t('refreshQuote') }}
          </button>
        </div>
        <p class="field-hint">{{ t('noChargeBefore') }}</p>
      </section>
      <div class="result-actions">
        <NuxtLink
          v-if="job.parameters?.generation_draft_id && job.feature_id !== 'ai.images'"
          :to="path(`/app/create/${job.parameters.generation_draft_id}`)"
          class="button primary"
          ><AppIcon name="edit" :size="17" />{{ t('reviewDraft') }}</NuxtLink
        >
        <button v-if="active" class="button secondary" @click="cancel">{{ t('cancelTask') }}</button
        ><NuxtLink :to="path(nextRoute)" class="button secondary"
          ><AppIcon name="plus" :size="17" />{{ t('newOperation') }}</NuxtLink
        ><NuxtLink :to="path('/app/jobs')" class="text-link"
          >{{ t('viewHistory') }}<AppIcon name="right" :size="16"
        /></NuxtLink>
      </div>
    </div>
    <div v-else-if="!error" class="loading-state">
      <AppIcon name="loader" class="spin" :size="30" />{{ t('loading') }}
    </div>
  </div>
</template>
