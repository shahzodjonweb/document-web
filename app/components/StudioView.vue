<script setup lang="ts">
const props = defineProps<{ draftId?: string }>()
const route = useRoute()
const { t, path, locale, date } = useLocale()
const ws = useWorkspace()
const studio = useStudio()
const { name } = useTools()
const input = ref<HTMLInputElement>()
const busy = ref('')
const error = ref('')
const notice = ref('')
const step = ref(0)
const draft = ref<any>(null)
const quote = ref<any>(null)
const submissionKey = ref('')
const submissionPending = ref(false)
const contentEdited = ref(false)
const reviewHandoff = useState<any>('studio-review-handoff', () => null)
const quoteStage = ref<'document' | 'outline'>('document')
const files = ref<any[]>([])
const promptExamples = usePromptExamples()

const form = reactive({
  feature_id: String(route.query.feature || 'ai.pdf_topic'),
  title: '',
  // The description is the whole brief: pages, tone, audience and questions are
  // all read out of it server-side, so there is nothing else to collect.
  prompt: String(route.query.prompt || ''),
  source_text: '',
  output_locale: String(ws.user.value?.preferences?.output_locale || locale.value),
  output_format: 'pdf',
  options: {} as Record<string, any>,
})
const content = ref<any>({ title: '', sections: [], questions: [] })
const selected = computed(() => studio.features.value.find((f) => f.id === form.feature_id))
const sectionList = computed<any[]>(() => content.value.sections || [])
const formats = computed<string[]>(
  () => selected.value?.parameter_schema?.output_format?.enum || ['pdf'],
)
const outputLanguage = computed(
  () => ({ en: 'English', uz: 'O‘zbekcha', ru: 'Русский' })[form.output_locale] || form.output_locale,
)
const examples = computed(() => promptExamples(form.feature_id))
const defaultPages = computed(() => studio.config.value?.default_pages ?? 5)
const maxPages = computed(() => selected.value?.max_pages ?? defaultPages.value)
/**
 * The page count is read from the description by the server, so the form does
 * not parse it a second time: it shows what the draft came back with, and the
 * default until there is one.
 */
const readingPages = computed(() => draft.value?.options?.length ?? defaultPages.value)
const clampedFrom = computed(() => {
  const asked = draft.value?.options?.requested_pages
  return asked && asked !== readingPages.value ? asked : 0
})

const providerReady = computed(() => studio.config.value?.provider?.configured === true)
const canUseTool = computed(
  () => !!selected.value && selected.value.eligible !== false && providerReady.value,
)
const hasEssentialInput = computed(
  () =>
    !!form.prompt.trim() ||
    files.value.length > 0 ||
    !!form.source_text.trim() ||
    // A draft opened from the list already has its content; it does not need
    // the description typed out again.
    sectionList.value.some((section: any) => section.body?.trim()),
)
/** The first line of the description names the document unless a title is set. */
const effectiveTitle = computed(() =>
  (
    form.title.trim() ||
    form.prompt.trim() ||
    form.source_text.trim() ||
    files.value[0]?.name?.replace(/\.[^.]+$/, '') ||
    name(form.feature_id, selected.value?.name)
  )
    .split(/\r?\n/, 1)[0]
    .slice(0, 160),
)
// Slides default to a PDF; only the slides service offers the editable deck.
watch([() => form.feature_id, formats], () => {
  if (!draft.value && !formats.value.includes(form.output_format))
    form.output_format = formats.value[0] || 'pdf'
})

function draftFields() {
  const options = Object.fromEntries(
    Object.entries(form.options).filter(([, value]) => value !== '' && value !== undefined),
  )
  return {
    ...form,
    title: effectiveTitle.value,
    prompt: form.prompt.trim() || name(form.feature_id, selected.value?.name),
    source_text: form.source_text,
    options,
    source_ids: files.value.map((file) => file.id),
  }
}

const requestError = (e: any) => e.data?.error?.message || e.data?.message || t('genericError')
async function run(task: string, fn: () => Promise<void>) {
  busy.value = task
  error.value = ''
  notice.value = ''
  try {
    await fn()
  } catch (e) {
    error.value = requestError(e)
  } finally {
    busy.value = ''
  }
}
function acceptDraft(value: any) {
  draft.value = value
  form.feature_id = value.feature_id || form.feature_id
  form.title = value.title || value.content?.title || form.title
  form.prompt = value.prompt || ''
  form.source_text = value.source_text || ''
  form.output_locale = value.output_locale || form.output_locale
  form.output_format = value.output_format || form.output_format
  form.options = { ...value.options, length: value.options?.length || value.content?.sections?.length || 2 }
  content.value = structuredClone(
    value.content || {
      title: form.title,
      sections: (value.outline || []).map((s: any) => ({ heading: s.title, body: s.body })),
      questions: [],
    },
  )
  contentEdited.value = false
  quote.value = null
}
async function load() {
  await studio.load()
  if (props.draftId)
    await run('load', async () => {
      acceptDraft(await ws.api(`/generation/drafts/${props.draftId}`))
      files.value = await Promise.all(
        (draft.value.source_ids || []).map((id: string) => ws.api(`/files/${id}`)),
      )
      step.value = 0
      const pending = reviewHandoff.value
      if (
        pending?.draftId === draft.value.id &&
        pending.accountId === ws.user.value?.id &&
        pending.version === draft.value.version &&
        new Date(pending.quote.expires_at).getTime() > Date.now()
      ) {
        quote.value = pending.quote
        submissionKey.value = pending.key
        quoteStage.value = 'document'
        step.value = 2
      }
      reviewHandoff.value = null
    })
}

/**
 * The bot links here as `?file_id=…` after a file has been sent to the chat, so
 * the document carries across instead of having to be uploaded twice.
 */
async function adoptLinkedFiles() {
  if (props.draftId) return
  // The bot sends one `file_id` per file already attached to its draft.
  for (const id of linkedFileIds(route.query.file_id)) {
    if (files.value.some((file) => file.id === id)) continue
    try {
      const asset: any = await ws.api(`/files/${id}`)
      // `/files/{id}` answers 200 for an expired asset; attaching one would
      // only show a chip that fails at generation.
      if (asset.state !== 'ready') continue
      if (asset.mime_type === 'application/pdf') files.value = [...files.value, asset]
    } catch {
      // Deleted or someone else's: the page still works without it.
    }
  }
}

onMounted(() => {
  load().then(adoptLinkedFiles)
})
watch(
  () => props.draftId,
  async (value, previous) => {
    if (value && value !== draft.value?.id) await load()
    else if (!value && previous) {
      draft.value = null
      quote.value = null
      files.value = []
      step.value = 0
      form.feature_id = String(route.query.feature || 'ai.pdf_topic')
      form.title = ''
      form.prompt = ''
      form.source_text = ''
      form.options = { length: 2, question_count: 5 }
      content.value = { title: '', sections: [], questions: [] }
      await load()
    }
  },
)
watch(
  () => route.query.feature,
  (value) => {
    if (value && !props.draftId) form.feature_id = String(value)
  },
)
async function upload(list: FileList | null) {
  if (!list?.length) return
  await run('upload', async () => {
    for (const file of Array.from(list)) {
      const body = new FormData()
      body.append('file', file)
      const asset = await ws.api('/files/uploads', { method: 'POST', body })
      files.value.push(asset)
    }
  })
}
async function createDraft() {
  acceptDraft(await ws.api('/generation/drafts', { method: 'POST', body: draftFields() }))
}
async function saveDraft() {
  if (!draft.value) return
  const { feature_id, ...fields } = draftFields()
  acceptDraft(
    await ws.api(`/generation/drafts/${draft.value.id}`, {
      method: 'PATCH',
      body: {
        version: draft.value.version,
        ...fields,
        ...(contentEdited.value
          ? { content: { ...content.value, title: effectiveTitle.value } }
          : {}),
      },
    }),
  )
  notice.value = t('draftSaved')
}
async function outline() {
  await run('outline', async () => {
    if (!draft.value) {
      await createDraft()
      if (!draft.value) return
    } else await saveDraft()
    acceptDraft(
      await ws.api(`/generation/drafts/${draft.value.id}/outline`, {
        method: 'POST',
        body: { version: draft.value.version },
      }),
    )
    step.value = 1
  })
}
function addQuestion() {
  if (!content.value.questions) content.value.questions = []
  content.value.questions.push({
    id: crypto.randomUUID(),
    stem: '',
    options: ['', ''],
    answer: '',
    explanation: '',
    topic: form.options.subject || form.title,
    marks: 1,
  })
}
function addSection() {
  if (!content.value.sections) content.value.sections = []
  content.value.sections.push({ heading: '', body: '' })
  quote.value = null
}
function moveSection(index: number, direction: number) {
  const to = index + direction
  const rows = content.value.sections
  if (to < 0 || to >= rows.length) return
  ;[rows[index], rows[to]] = [rows[to], rows[index]]
  quote.value = null
}
async function review() {
  if (busy.value || submissionPending.value || !canUseTool.value || !hasEssentialInput.value) return
  await run('quote', async () => {
    if (!draft.value) await createDraft()
    else await saveDraft()
    // Local authoring has no model to write the body, so the content has to
    // come from the customer before there is anything to render.
    if (
      studio.localProvider.value &&
      !sectionList.value.some((section) => section.body?.trim()) &&
      !content.value.questions?.length
    ) {
      step.value = 1
      notice.value = t('studioLocalContentNeeded')
      return
    }
    quoteStage.value = 'document'
    quote.value = await ws.api(`/generation/drafts/${draft.value.id}/quote`, {
      method: 'POST',
      body: { version: draft.value.version },
    })
    submissionKey.value = crypto.randomUUID()
    step.value = 2
    notice.value = ''
    if (props.draftId !== draft.value.id) {
      reviewHandoff.value = {
        draftId: draft.value.id,
        accountId: ws.user.value?.id,
        version: draft.value.version,
        quote: quote.value,
        key: submissionKey.value,
      }
      await navigateTo(path(`/app/create/${draft.value.id}`))
    }
  })
}
async function generate() {
  if (busy.value || !quote.value || quote.value.affordable === false) return
  await run('generate', async () => {
    const key = submissionKey.value || (submissionKey.value = crypto.randomUUID())
    const quoteId = quote.value.id
    submissionPending.value = true
    sessionStorage.setItem('pdf-master-pending-job', JSON.stringify({ quote_id: quoteId, key }))
    let job
    try {
      job = await ws.api('/jobs', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: { quote_id: quoteId },
      })
    } catch (e: any) {
      // A refused request is already decided. An uncertain one must be retried
      // with the same quote and key so the server settles it exactly once.
      const status = e.statusCode || e.status || e.response?.status
      if (status >= 400 && status < 500) {
        submissionPending.value = false
        sessionStorage.removeItem('pdf-master-pending-job')
      }
      throw e
    }
    sessionStorage.removeItem('pdf-master-pending-job')
    submissionPending.value = false
    await ws.loadAccount()
    if (quoteStage.value === 'outline' && job.status === 'succeeded') {
      quote.value = null
      await load()
      notice.value = t('outlineGenerated')
      return
    }
    await navigateTo(path(`/app/jobs/${job.id}`))
  })
}
async function reviewOutline() {
  if (busy.value || submissionPending.value) return
  await run('outline-quote', async () => {
    await saveDraft()
    quoteStage.value = 'outline'
    quote.value = await ws.api(`/generation/drafts/${draft.value.id}/quote`, {
      method: 'POST',
      body: { version: draft.value.version, stage: 'outline' },
    })
  })
}
function invalidateQuote() {
  quote.value = null
  submissionKey.value = ''
}
watch(
  content,
  () => {
    contentEdited.value = true
    invalidateQuote()
  },
  { deep: true, flush: 'sync' },
)
watch(form, invalidateQuote, { deep: true, flush: 'sync' })
watch(files, invalidateQuote, { deep: true, flush: 'sync' })
const meters = computed(() => (Array.isArray(quote.value?.meters) ? quote.value.meters : []))
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">{{ t('create') }} · PDF MASTER</span>
      <h1>{{ t('studioTitle') }}</h1>
      <p>{{ t('studioSub') }}</p>
    </div>
    <NuxtLink :to="path('/app/guide')" class="button secondary"
      ><AppIcon name="book" :size="17" />{{ t('studioGuideLink') }}</NuxtLink
    >
  </div>
  <div v-if="studio.localProvider.value" class="provider-banner">
    <span class="provider-icon"><AppIcon name="sparkle" :size="22" /></span>
    <div>
      <strong>{{ t('localProvider') }}</strong>
      <p>{{ t('localProviderNote') }}</p>
    </div>
    <span class="status-badge">LOCAL</span>
  </div>
  <ErrorBanner v-if="error" :message="error" />
  <div v-if="notice" class="success-banner" role="status">
    <AppIcon name="check" :size="17" />{{ notice }}
  </div>
  <div v-if="!studio.config.value" class="empty-state panel">
    <AppIcon name="sparkle" :size="28" />
    <h2>{{ studio.loaded.value ? t('notAvailable') : t('loading') }}</h2>
    <button class="button secondary" @click="load">{{ t('refresh') }}</button>
  </div>
  <template v-else>
    <div v-if="!canUseTool" class="info-banner" role="status">
      <AppIcon name="sparkle" :size="18" />{{
        t(providerReady ? 'studioPlanUnavailable' : 'studioUnavailable')
      }}
    </div>
    <nav class="studio-steps" :aria-label="t('create')">
      <button
        :class="{ active: step !== 2, complete: step === 2 }"
        :disabled="!!busy || submissionPending"
        @click="step = 0"
      >
        <b>1</b>{{ t('studioYourIdea') }}
      </button>
      <button
        :class="{ active: step === 2 }"
        :disabled="!draft || !!busy || submissionPending"
        @click="step = 2"
      >
        <b>2</b>{{ t('studioReviewCreate') }}
      </button>
    </nav>
    <div class="studio-layout">
      <div class="studio-main">
        <section v-if="step === 0" class="panel studio-form" data-testid="studio-brief">
          <fieldset class="studio-fieldset" :disabled="!!busy || submissionPending">
            <h2>{{ t('studioYourIdea') }}</h2>
            <p class="studio-intro">{{ t('studioQuickHint') }}</p>
            <label class="form-field"
              ><span>{{ t('purpose') }}</span
              ><select v-model="form.feature_id" :disabled="!!draft" data-testid="studio-purpose">
                <option v-for="feature in studio.features.value" :key="feature.id" :value="feature.id">
                  {{ name(feature.id, feature.name) }}
                </option>
              </select></label
            >
            <label class="form-field studio-primary-field">
              <span>{{ t('studioDescribe') }}</span>
              <textarea
                v-model="form.prompt"
                data-testid="studio-primary-input"
                rows="7"
                :maxlength="studio.config.value?.limits?.source_chars || 12000"
                :placeholder="t('studioDescribePlaceholder')"
              />
              <small>{{ t('studioDescribeHint', { pages: defaultPages, max: maxPages }) }}</small>
            </label>
            <div class="studio-examples">
              <span>{{ t('studioTryOne') }}</span>
              <button
                v-for="(example, index) in examples"
                :key="index"
                type="button"
                class="chip"
                :data-testid="`studio-example-${index}`"
                @click="form.prompt = example"
              >
                {{ example.slice(0, 54) }}…
              </button>
              <NuxtLink class="text-link" :to="path('/app/guide')"
                >{{ t('studioGuideLink') }}<AppIcon name="right" :size="15"
              /></NuxtLink>
            </div>
            <div class="form-row">
              <label class="form-field"
                ><span>{{ t('outputLanguage') }}</span
                ><select v-model="form.output_locale" data-testid="studio-locale">
                  <option
                    v-for="(label, value) in { en: 'English', uz: 'O‘zbekcha', ru: 'Русский' }"
                    :key="value"
                    :value="value"
                  >
                    {{ label }}
                  </option>
                </select></label
              >
              <label v-if="formats.length > 1" class="form-field"
                ><span>{{ t('format') }}</span
                ><select v-model="form.output_format" data-testid="studio-format">
                  <option v-for="value in formats" :key="value" :value="value">
                    {{ value.toUpperCase() }}
                  </option>
                </select></label
              >
            </div>
            <div class="studio-source">
              <div>
                <h3>{{ t('studioAttach') }}</h3>
                <p>{{ t('studioAttachHint') }}</p>
              </div>
              <button
                class="button secondary"
                @click="input?.click()"
                :disabled="!!busy || submissionPending"
              >
                <AppIcon name="upload" :size="17" />{{ t(files.length ? 'addMore' : 'upload') }}</button
              ><input
                ref="input"
                type="file"
                multiple
                class="visually-hidden"
                accept=".pdf"
                @change="upload(($event.target as HTMLInputElement).files)"
                :aria-label="t('sourceFiles')"
              />
            </div>
            <div v-for="file in files" :key="file.id" class="source-chip">
              <AppIcon name="file" :size="17" /><span>{{ file.name }}</span
              ><button
                class="icon-button"
                @click="files = files.filter((f) => f.id !== file.id)"
                :aria-label="t('remove')"
              >
                <AppIcon name="x" :size="15" />
              </button>
            </div>
            <div class="studio-defaults" aria-live="polite">
              <AppIcon name="sparkle" :size="16" /><span
                >{{ form.output_format.toUpperCase() }} · {{ outputLanguage }} ·
                {{ t('studioPagesReading', { count: readingPages }) }}</span
              >
            </div>
            <div class="studio-form-actions">
              <button
                v-if="draft"
                class="button secondary"
                :disabled="!!busy || submissionPending"
                data-testid="studio-edit-outline"
                @click="step = 1"
              >
                {{ t('studioEditOutline') }}
              </button>
              <button
                class="button primary"
                data-testid="studio-review"
                :disabled="!!busy || !canUseTool || !hasEssentialInput"
                @click="review"
              >
                {{ busy ? t('working') : t('studioReviewCost') }}<AppIcon name="right" :size="17" />
              </button>
            </div>
            <p class="field-hint studio-charge-hint">{{ t('noChargeBefore') }}</p>
          </fieldset>
        </section>
        <section v-else-if="step === 1" class="panel outline-panel">
          <fieldset class="studio-fieldset" :disabled="!!busy || submissionPending">
            <div class="panel-heading">
              <div>
                <h2>{{ t('outlineStep') }}</h2>
                <p>{{ t('outlineHelp') }}</p>
              </div>
              <button class="button secondary small" :disabled="!!busy || submissionPending" @click="outline">
                <AppIcon name="rotate" :size="15" />{{ t('generateOutline') }}
              </button>
            </div>
            <div v-for="(section, index) in sectionList" :key="index" class="outline-section">
              <div class="outline-number">{{ String(Number(index) + 1).padStart(2, '0') }}</div>
              <div class="outline-fields">
                <label class="form-field"
                  ><span>{{ t('sectionHeading') }}</span
                  ><input v-model="section.heading" /></label
                ><label class="form-field"
                  ><span>{{ t('sectionBody') }}</span
                  ><textarea v-model="section.body" rows="4" />
                </label>
                <label v-if="form.output_format === 'pptx'" class="form-field"
                  ><span>{{ t('speakerNotes') }}</span
                  ><textarea v-model="section.notes" rows="3" />
                </label>
              </div>
              <div class="outline-actions">
                <button
                  class="icon-button"
                  :disabled="index === 0"
                  @click="moveSection(Number(index), -1)"
                  :aria-label="t('moveUp')"
                >
                  <AppIcon name="up" :size="17" /></button
                ><button
                  class="icon-button"
                  :disabled="index === sectionList.length - 1"
                  @click="moveSection(Number(index), 1)"
                  :aria-label="t('moveDown')"
                >
                  <AppIcon name="moveDown" :size="17" /></button
                ><button
                  class="icon-button"
                  @click="content.sections.splice(index, 1)"
                 
                  :aria-label="t('delete')"
                >
                  <AppIcon name="trash" :size="17" />
                </button>
              </div>
            </div>
            <button
              class="button secondary full add-section"
              @click="addSection"
             
            >
              <AppIcon name="plus" :size="17" />{{ t('addSection') }}
            </button>
            <button
              class="button secondary full outline-generation"
              :disabled="!!busy || submissionPending"
              @click="reviewOutline"
            >
              <AppIcon name="sparkle" :size="17" />{{ t('reviewOutlineGeneration') }}
            </button>
            <div v-if="content.questions.length" class="question-editor">
              <div class="panel-heading">
                <h3>{{ t('practice') }}</h3>
                <button class="button secondary small" @click="addQuestion">
                  <AppIcon name="plus" :size="15" />{{ t('addQuestion') }}
                </button>
              </div>
              <div
                v-for="(question, index) in content.questions"
                :key="question.id || index"
                class="question-edit-card"
              >
                <label class="form-field"
                  ><span>{{ Number(index) + 1 }} · {{ t('text') }}</span
                  ><textarea v-model="question.stem" rows="3" />
                </label>
                <div v-if="Array.isArray(question.options)" class="question-options-edit">
                  <input
                    v-for="(_, i) in question.options"
                    :key="i"
                    v-model="question.options[i]"
                    :aria-label="`${Number(index) + 1}.${Number(i) + 1}`"
                  />
                </div>
                <label class="form-field"
                  ><span>{{ t('teacherKey') }}</span
                  ><input v-model="question.answer" /></label
                ><label class="form-field"
                  ><span>{{ t('explanation') }}</span
                  ><textarea v-model="question.explanation" rows="2" />
                </label>
              </div>
            </div>
            <div class="studio-form-actions">
              <button
                class="button secondary"
                :disabled="!!busy || submissionPending"
                @click="run('save', saveDraft)"
              >
                {{ t('saveDraft') }}</button
              ><button class="button primary" :disabled="!!busy || !sectionList.length" @click="review">
                {{ busy ? t('working') : t('reviewGeneration') }}<AppIcon name="right" :size="17" />
              </button>
            </div>
          </fieldset>
        </section>
        <section v-else class="panel generation-summary">
          <span class="result-symbol"><AppIcon name="ready" :size="34" /></span>
          <h2>{{ form.title }}</h2>
          <p>
            {{ name(form.feature_id, selected?.name) }} · {{ form.output_format.toUpperCase() }} ·
            {{ form.output_locale.toUpperCase() }}
          </p>
          <p class="field-hint">{{ t('studioReviewHint') }}</p>
          <button
            class="button secondary small"
            :disabled="!!busy || submissionPending"
            data-testid="studio-edit-outline"
            @click="step = 1"
          >
            {{ t('studioEditOutline') }}
          </button>
          <div class="outline-summary">
            <div v-for="(section, index) in sectionList" :key="index">
              <b>{{ Number(index) + 1 }}</b
              ><span>{{ section.heading }}</span>
            </div>
          </div>
          <p class="review-advice"><AppIcon name="shield" :size="17" />{{ t('reviewBeforeShare') }}</p>
          <div v-if="!quote" class="studio-form-actions">
            <button class="button primary" @click="review" :disabled="!!busy || submissionPending">
              {{ t('studioReviewCost') }}
            </button>
          </div>
        </section>
      </div>
      <aside class="studio-rail">
        <section v-if="quote" class="panel studio-quote">
          <h2>{{ t('reviewTitle') }}</h2>
          <div class="meter-row" data-testid="studio-pages">
            <span>{{ t('guideRowPages') }}</span
            ><strong>{{ readingPages }}</strong>
          </div>
          <!-- A clamped request is said out loud rather than quietly honoured short. -->
          <p v-if="clampedFrom" class="field-hint" data-testid="studio-pages-clamped">
            {{ t('studioPagesClamped', { asked: clampedFrom, given: readingPages }) }}
          </p>
          <div v-for="meter in meters" :key="meter.meter" class="meter-row">
            <span>{{
              t(
                meter.meter === 'file_tasks'
                  ? 'standardTask'
                  : meter.meter === 'file_page_units'
                    ? 'pageUnits'
                    : meter.meter,
              )
            }}</span
            ><strong>{{ meter.amount }}</strong>
          </div>
          <p>{{ t('quoteExpires') }} {{ date(quote.expires_at, true) }}</p>
          <div v-if="quote.affordable === false" class="info-banner">{{ t('quotaExceeded') }}</div>
          <button
            class="button primary full"
            :disabled="!!busy || quote.affordable === false"
            @click="generate"
          >
            {{
              busy
                ? t('working')
                : t(
                    submissionPending
                      ? 'retry'
                      : quoteStage === 'outline'
                        ? 'confirmOutlineGeneration'
                        : 'generateDocument',
                  )
            }}<AppIcon name="sparkle" :size="17" />
          </button>
          <button
            class="button secondary full"
            :disabled="!!busy || submissionPending"
            @click="quoteStage === 'outline' ? reviewOutline() : review()"
          >
            {{ t('refreshQuote') }}
          </button>
        </section>
        <details class="panel studio-settings studio-more-options" data-testid="studio-more-options">
          <summary>
            {{ t('studioMoreOptions') }}<span>{{ t('studioOptional') }}</span>
          </summary>
          <div class="studio-settings-body">
            <label class="form-field"
              ><span>{{ t('studioTitleOptional') }}</span
              ><input v-model="form.title" maxlength="160" data-testid="studio-title"
            /></label>
          </div>
        </details>
      </aside>
    </div></template
  >
</template>
