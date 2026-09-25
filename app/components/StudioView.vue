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
const savedProjects = ref<any[]>([])
const templateContent = ref<any>(null)
const sourceDrafts = ref<any[]>([])
const revisionSource = ref<any>(null)
const logoInput = ref<HTMLInputElement>()
const revision = computed(() => ['ai.rewrite', 'ai.regenerate_slide'].includes(form.feature_id))
const revisionDrafts = computed(() =>
  sourceDrafts.value.filter(
    (item) =>
      !item.feature_id.startsWith('teacher.') &&
      !item.feature_id.startsWith('school.') &&
      (form.feature_id !== 'ai.regenerate_slide' || item.output_format === 'pptx'),
  ),
)
const editableSection = (section: any) =>
  !draft.value?.revision || draft.value.revision.selected_section_ids.includes(section.id)
async function loadDrafts() {
  try {
    sourceDrafts.value = (await ws.api('/generation/drafts')).results || []
  } catch {}
}
async function chooseRevision() {
  await run('source', async () => {
    revisionSource.value = await ws.api(`/generation/drafts/${form.options.source_draft_id}`)
    form.options.source_draft_version = revisionSource.value.version
    form.options.selected_section_ids = revisionSource.value.content.sections
      .slice(0, form.feature_id === 'ai.regenerate_slide' ? 1 : undefined)
      .map((section: any) => section.id)
    form.title = revisionSource.value.title
    form.output_format = revisionSource.value.output_format
    form.output_locale = revisionSource.value.output_locale
    form.options.length = revisionSource.value.content.sections.length
  })
}
function toggleBranding(event: Event) {
  if ((event.target as HTMLInputElement).checked) form.options.branding = { name: '', accent: '#0275fc' }
  else delete form.options.branding
}
async function uploadLogo(file: File | undefined) {
  if (!file) return
  await run('logo', async () => {
    const body = new FormData()
    body.append('file', file)
    const asset = await ws.api('/files/uploads', { method: 'POST', body })
    form.options.branding.logo_asset_id = asset.id
  })
}
async function loadProjects() {
  try {
    savedProjects.value = (await ws.api('/education/projects')).results || []
  } catch {}
}
const saveConsent = ref(false)
const form = reactive({
  feature_id: String(route.query.feature || 'ai.pdf_topic'),
  title: '',
  prompt: '',
  source_text: '',
  output_locale: String(ws.user.value?.preferences?.output_locale || locale.value),
  output_format: ['ai.pptx', 'ai.source_to_slides', 'school.project_slides'].includes(
    String(route.query.feature),
  )
    ? 'pptx'
    : 'pdf',
  options: {
    length: 2,
    question_count: 5,
  } as Record<string, any>,
})
watch(
  () => form.feature_id,
  (value) => {
    if (value === 'school.adaptive') loadProjects()
    if (value === 'ai.images') navigateTo(path('/app/images'))
  },
)
const content = ref<any>({ title: '', sections: [], questions: [] })
const selected = computed(() => studio.features.value.find((f) => f.id === form.feature_id))
const education = computed(() => /^(study|school|teacher)\./.test(form.feature_id))
const sectionList = computed<any[]>(() => content.value.sections || [])
const handwriting = computed(() => form.feature_id === 'study.handwriting')
const fileOnly = computed(() => form.feature_id === 'ai.pdf_sources')
const adaptive = computed(() => form.feature_id === 'school.adaptive')
const sourceFirst = computed(
  () =>
    (studio.localProvider.value &&
      !revision.value &&
      !handwriting.value &&
      !adaptive.value &&
      form.feature_id !== 'study.pdf_qa') ||
    [
      'ai.pdf_text',
      'ai.source_to_slides',
      'study.summary',
      'study.definitions',
      'study.answer_key',
      'study.report_format',
      'study.references',
      'study.writing_feedback',
      'teacher.answer_key',
      'teacher.syllabus',
      'teacher.feedback',
      'study.flashcards',
    ].includes(form.feature_id),
)
const primaryText = computed({
  get: () => (sourceFirst.value ? form.source_text : form.prompt),
  set: (value: string) => {
    if (sourceFirst.value) form.source_text = value
    else form.prompt = value
  },
})
const primaryLabel = computed(() =>
  t(
    form.feature_id === 'study.pdf_qa'
      ? 'studioQuestion'
      : sourceFirst.value
        ? 'studioSource'
        : revision.value
          ? 'studioRevisionPrompt'
          : 'studioPrompt',
  ),
)
const primaryPlaceholder = computed(() =>
  t(
    form.feature_id === 'study.pdf_qa'
      ? 'studioQuestionPlaceholder'
      : form.feature_id === 'school.check_attempt'
        ? 'studioAttemptPlaceholder'
        : form.feature_id === 'teacher.suggest_marks'
          ? 'studioMarksPlaceholder'
          : form.feature_id === 'teacher.reading_level'
            ? 'studioReadingPlaceholder'
            : form.feature_id === 'ai.pptx'
              ? 'studioSlidesPlaceholder'
              : sourceFirst.value
                ? 'studioSourcePlaceholder'
                : revision.value
                  ? 'studioRevisionPlaceholder'
                  : education.value
                    ? 'studioEducationPlaceholder'
                    : 'studioPromptPlaceholder',
  ),
)
const formats = computed<string[]>(
  () =>
    selected.value?.parameter_schema?.output_format?.enum ||
    selected.value?.parameter_schema?.properties?.output_format?.enum || ['pdf', 'pptx'],
)
const maxLength = computed(
  () => studio.config.value?.limits?.[form.output_format === 'pptx' ? 'slides' : 'sections'] || 2,
)
const questionMultiplier = computed(
  () =>
    ({ 'teacher.variants': 3, 'teacher.differentiated': 3, 'school.weekly_pack': 5 })[form.feature_id] || 1,
)
const maxQuestions = computed(() =>
  Math.floor((studio.config.value?.limits?.questions || 5) / questionMultiplier.value),
)
const outputLanguage = computed(
  () => ({ en: 'English', uz: 'O‘zbekcha', ru: 'Русский' })[form.output_locale] || form.output_locale,
)

/**
 * Density decides how much of the page the body text fills. The server owns the
 * list and the actual spacing metrics, so the UI never hardcodes either.
 */
const densities = computed<string[]>(
  () => (selected.value?.parameter_schema as any)?.density?.enum || [],
)
const activeDensity = computed(() => form.options.density || 'balanced')
function setDensity(value: string) {
  form.options.density = value
  quote.value = null
}

/** One tone select replaces the free-text audience and style boxes. */
const TONES = ['neutral', 'formal', 'friendly', 'academic', 'simple'] as const
const providerReady = computed(
  () => studio.config.value?.provider?.configured === true || !!draft.value?.transcription_ready,
)
const canUseTool = computed(
  () =>
    !!draft.value?.transcription_ready ||
    (!!selected.value && selected.value.eligible !== false && providerReady.value),
)
const hasAuthoredContent = (value: any) =>
  value?.sections?.some((section: any) => section.body?.trim()) ||
  value?.questions?.some((question: any) => question.stem?.trim())
const hasEssentialInput = computed(() => {
  if (handwriting.value)
    return files.value.length === 1 && (!files.value[0].page_count || files.value[0].page_count === 1)
  if (fileOnly.value) return files.value.length > 0
  if (adaptive.value) return !!form.options.project_id
  if (revision.value) return !!form.options.source_draft_id && !!form.options.selected_section_ids?.length
  if (form.feature_id === 'study.pdf_qa') return !!form.prompt.trim() && files.value.length > 0
  return (
    !!primaryText.value.trim() ||
    files.value.length > 0 ||
    !!form.source_text.trim() ||
    hasAuthoredContent(content.value) ||
    hasAuthoredContent(templateContent.value)
  )
})
const effectiveTitle = computed(() =>
  Array.from(
    (
      form.title.trim() ||
      primaryText.value.trim() ||
      form.source_text.trim() ||
      files.value[0]?.name?.replace(/\.[^.]+$/, '') ||
      name(form.feature_id, selected.value?.name)
    ).split(/\r?\n/, 1)[0] || '',
  )
    .slice(0, 160)
    .join(''),
)
function defaultsForFeature() {
  if (draft.value || templateContent.value) return
  form.output_format = ['ai.pptx', 'ai.source_to_slides', 'school.project_slides'].includes(form.feature_id)
    ? 'pptx'
    : 'pdf'
  if (!formats.value.includes(form.output_format)) form.output_format = formats.value[0] || 'pdf'
  form.options.length = handwriting.value
    ? 1
    : Math.min(form.output_format === 'pptx' ? 5 : 2, maxLength.value)
  form.options.question_count = handwriting.value ? 0 : Math.min(5, maxQuestions.value)
}
watch(() => studio.config.value, defaultsForFeature)
watch(
  () => form.output_format,
  () => {
    if (!draft.value) form.options.length = Math.min(form.options.length || 2, maxLength.value)
  },
)
watch(
  () => form.feature_id,
  (_, previous) => {
    if (draft.value || templateContent.value) return
    delete form.options.source_draft_id
    delete form.options.source_draft_version
    delete form.options.selected_section_ids
    delete form.options.project_id
    revisionSource.value = null
    if (previous === 'study.handwriting')
      files.value = files.value.filter((file) => file.mime_type === 'application/pdf')
    defaultsForFeature()
  },
)
function draftFields() {
  const options = Object.fromEntries(
    Object.entries(form.options).filter(([, value]) => value !== '' && value !== undefined),
  )
  return {
    ...form,
    title: effectiveTitle.value,
    prompt: form.prompt.trim() || name(form.feature_id, selected.value?.name),
    source_text:
      handwriting.value || revision.value || adaptive.value || fileOnly.value ? '' : form.source_text,
    options,
    source_ids: revision.value
      ? draft.value?.source_ids || []
      : adaptive.value
        ? []
        : files.value.map((file) => file.id),
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
      step.value = draft.value.transcription_ready ? 1 : 0
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
  else if (route.query.template) {
    let tpl = studio.config.value?.templates?.find((v: any) => v.id === route.query.template)
    if (!tpl) {
      try {
        tpl = await ws.api(`/templates/${route.query.template}`)
      } catch (e) {
        error.value = requestError(e)
      }
    }
    if (tpl) {
      defaultsForFeature()
      const presets: Record<string, string> = {
        clean: 'presetClean',
        classroom: 'presetClassroom',
        presentation: 'presetPresentation',
        executive_report: 'presetExecutive',
        compact_brief: 'presetBrief',
        study_notes: 'presetStudy',
      }
      form.title = presets[tpl.id] ? t(presets[tpl.id]!) : tpl.name || ''
      form.source_text = tpl.content?.body || tpl.content?.instructions || tpl.instructions || ''
      if (tpl.content?.sections?.length) {
        templateContent.value = JSON.parse(JSON.stringify(tpl.content))
        if (tpl.content.feature_id) form.feature_id = tpl.content.feature_id
        form.options = { ...form.options, ...tpl.content.options }
        form.output_locale = tpl.output_locale || form.output_locale
        form.output_format = tpl.content.output_format || form.output_format
      }
      form.options.template_id = tpl.id
    }
  }
}
/**
 * The bot links here as `?file_id=…` after a file has been sent to the chat, so
 * the document carries across instead of having to be uploaded twice.
 */
async function adoptLinkedFiles() {
  if (props.draftId || adaptive.value) return
  // The bot sends one `file_id` per file already attached to its draft.
  for (const id of linkedFileIds(route.query.file_id)) {
    if (files.value.some((file) => file.id === id)) continue
    try {
      const asset: any = await ws.api(`/files/${id}`)
      // `/files/{id}` answers 200 for an expired asset; attaching one would
      // only show a chip that fails at generation.
      if (asset.state !== 'ready') continue
      // Attach it exactly as the picker would, so the same rules apply: one
      // image for handwriting, PDFs everywhere else.
      if (handwriting.value) {
        files.value = [asset]
        return
      }
      if (asset.mime_type === 'application/pdf') files.value = [...files.value, asset]
    } catch {
      // Deleted or someone else's: the page still works without it.
    }
  }
}

onMounted(() => {
  load().then(adoptLinkedFiles)
  loadProjects()
  loadDrafts()
  if (form.feature_id === 'ai.images') navigateTo(path('/app/images'))
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
      if (form.feature_id === 'study.handwriting') files.value = []
      files.value.push(asset)
    }
  })
}
async function createDraft() {
  acceptDraft(await ws.api('/generation/drafts', { method: 'POST', body: draftFields() }))
  if (templateContent.value) {
    content.value = { ...templateContent.value, title: form.title }
    await saveDraft()
    templateContent.value = null
  }
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
        ...(contentEdited.value || (draft.value.transcription_ready && step.value === 1)
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
    const questions = content.value.questions?.length || 0
    const minimumQuestions =
      form.feature_id === 'teacher.variants'
        ? 3
        : form.feature_id === 'school.weekly_pack'
          ? 5
          : [
                'study.flashcards',
                'study.answer_key',
                'teacher.answer_key',
                'study.exam_pack',
                'teacher.differentiated',
                'teacher.lesson_pack',
              ].includes(form.feature_id)
            ? 1
            : 0
    if (
      studio.localProvider.value &&
      ((!sectionList.value.some((section) => section.body?.trim()) && !questions) ||
        questions < minimumQuestions)
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
async function saveTemplate() {
  await run('template', async () => {
    await saveDraft()
    const reusableOptions = Object.fromEntries(
      ['length', 'density', 'question_count', 'subject', 'grade', 'duration', 'style', 'objectives']
        .filter((key) => form.options[key] !== undefined)
        .map((key) => [key, form.options[key]]),
    )
    if (form.options.branding) {
      reusableOptions.branding = {
        name: form.options.branding.name,
        accent: form.options.branding.accent,
      }
    }
    const needsOriginal = [
      'ai.rewrite',
      'ai.regenerate_slide',
      'study.pdf_qa',
      'study.handwriting',
      'school.adaptive',
    ].includes(form.feature_id)
    await ws.api('/templates', {
      method: 'POST',
      body: {
        name: form.title,
        content: {
          ...content.value,
          feature_id: needsOriginal
            ? form.output_format === 'pptx'
              ? 'ai.pptx'
              : 'ai.pdf_text'
            : form.feature_id,
          instructions: form.source_text,
          options: reusableOptions,
          output_format: form.output_format,
        },
        output_locale: form.output_locale,
      },
    })
    notice.value = t('templateSaved')
  })
}
async function saveProject() {
  await run('save-project', async () => {
    await saveDraft()
    const result = await ws.api('/education/projects', {
      method: 'POST',
      body: { draft_id: draft.value.id, title: form.title, save_consent: saveConsent.value },
    })
    await navigateTo(path(`/app/projects/${result.id}`))
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
    <NuxtLink :to="path('/app/images')" class="button secondary"
      ><AppIcon name="image" :size="17" />{{ t('ai.images.name') }}</NuxtLink
    ><NuxtLink :to="path('/app/templates')" class="button secondary"
      ><AppIcon name="files" :size="17" />{{ t('templates') }}</NuxtLink
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
  <div v-if="draft?.transcription_ready" class="info-banner">
    <AppIcon name="edit" :size="19" />{{ t('transcriptionReviewNote') }}
  </div>
  <div v-if="form.feature_id === 'study.handwriting'" class="provider-banner">
    <AppIcon name="edit" :size="23" />
    <div>
      <strong>{{ t('handwritingReview') }}</strong>
      <p>{{ t(selected?.eligible === false ? 'handwritingProviderRequired' : 'handwritingInputHint') }}</p>
    </div>
  </div>
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
              ><select
                v-model="form.feature_id"
                :disabled="!!draft"
                data-testid="studio-purpose"
                @change="templateContent = null"
              >
                <option v-for="feature in studio.features.value" :key="feature.id" :value="feature.id">
                  {{ name(feature.id, feature.name) }}
                </option>
              </select></label
            >
            <section v-if="revision && !draft" class="revision-source">
              <label class="form-field"
                ><span>{{ t('sourceDraft') }}</span
                ><select v-model="form.options.source_draft_id" @change="chooseRevision">
                  <option value="" disabled>{{ t('chooseDraft') }}</option>
                  <option v-for="item in revisionDrafts" :key="item.id" :value="item.id">
                    {{ item.title }} · {{ item.output_format.toUpperCase() }}
                  </option>
                </select></label
              >
              <p class="field-hint">{{ t('revisionHint') }}</p>
              <label
                v-for="section in revisionSource?.content?.sections || []"
                :key="section.id"
                class="check-label revision-section"
                ><input
                  v-model="form.options.selected_section_ids"
                  type="checkbox"
                  :value="section.id"
                /><span>{{ section.heading }}</span></label
              >
            </section>
            <label v-if="!handwriting && !adaptive && !fileOnly" class="form-field studio-primary-field">
              <span
                >{{ primaryLabel }}<small v-if="revision"> · {{ t('studioOptional') }}</small></span
              >
              <textarea
                v-model="primaryText"
                data-testid="studio-primary-input"
                rows="5"
                :maxlength="
                  Math.min(sourceFirst ? 80000 : 12000, studio.config.value?.limits?.source_chars || 12000)
                "
                :placeholder="primaryPlaceholder"
              />
              <small>{{
                t(sourceFirst ? 'studioSourceHint' : revision ? 'studioRevisionHint' : 'studioPromptHint')
              }}</small>
            </label>
            <div v-if="!revision && !adaptive" class="studio-source">
              <div>
                <h3>
                  {{
                    t(
                      handwriting
                        ? 'studioHandwritingFile'
                        : form.feature_id === 'study.pdf_qa'
                          ? 'studioQuestionFile'
                          : 'studioAttach',
                    )
                  }}
                </h3>
                <p>
                  {{
                    t(
                      handwriting
                        ? 'handwritingInputHint'
                        : form.feature_id === 'study.pdf_qa'
                          ? 'studioQuestionFileHint'
                          : fileOnly
                            ? 'studioPdfSourcesHint'
                            : 'studioAttachHint',
                    )
                  }}
                </p>
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
                :multiple="form.feature_id !== 'study.handwriting'"
                class="visually-hidden"
                :accept="form.feature_id === 'study.handwriting' ? '.png,.jpg,.jpeg,.pdf' : '.pdf'"
                @change="upload(($event.target as HTMLInputElement).files)"
                :aria-label="t('sourceFiles')"
              />
            </div>
            <div v-for="file in !revision && !adaptive ? files : []" :key="file.id" class="source-chip">
              <AppIcon name="file" :size="17" /><span>{{ file.name }}</span
              ><button
                class="icon-button"
                @click="files = files.filter((f) => f.id !== file.id)"
                :aria-label="t('remove')"
              >
                <AppIcon name="x" :size="15" />
              </button>
            </div>
            <label v-if="form.feature_id === 'school.adaptive'" class="form-field"
              ><span>{{ t('projects') }}</span
              ><select v-model="form.options.project_id">
                <option value="" disabled>{{ t('chooseProject') }}</option>
                <option v-for="project in savedProjects" :key="project.id" :value="project.id">
                  {{ project.title }}
                </option></select
              ><small>{{ t('adaptiveProjectHint') }}</small></label
            >
            <p v-if="revision && !revisionDrafts.length" class="field-hint">{{ t('studioNoDrafts') }}</p>
            <p v-if="adaptive && !savedProjects.length" class="field-hint">{{ t('adaptiveProjectHint') }}</p>
            <div class="studio-defaults" aria-live="polite">
              <AppIcon name="sparkle" :size="16" /><span
                >{{ form.output_format.toUpperCase() }} · {{ outputLanguage }} ·
                {{
                  t(form.output_format === 'pptx' ? 'studioSlidesSummary' : 'studioLengthSummary', {
                    count: form.options.length,
                  })
                }}</span
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
                  ><input v-model="section.heading" :disabled="!editableSection(section)" /></label
                ><label class="form-field"
                  ><span>{{ t('sectionBody') }}</span
                  ><textarea v-model="section.body" :disabled="!editableSection(section)" rows="4" />
                </label>
                <label v-if="form.output_format === 'pptx'" class="form-field"
                  ><span>{{ t('speakerNotes') }}</span
                  ><textarea v-model="section.notes" :disabled="!editableSection(section)" rows="3" />
                </label>
              </div>
              <div class="outline-actions">
                <button
                  class="icon-button"
                  :disabled="index === 0 || !!draft?.revision"
                  @click="moveSection(Number(index), -1)"
                  :aria-label="t('moveUp')"
                >
                  <AppIcon name="up" :size="17" /></button
                ><button
                  class="icon-button"
                  :disabled="index === sectionList.length - 1 || !!draft?.revision"
                  @click="moveSection(Number(index), 1)"
                  :aria-label="t('moveDown')"
                >
                  <AppIcon name="moveDown" :size="17" /></button
                ><button
                  class="icon-button"
                  @click="content.sections.splice(index, 1)"
                  :disabled="!!draft?.revision"
                  :aria-label="t('delete')"
                >
                  <AppIcon name="trash" :size="17" />
                </button>
              </div>
            </div>
            <button
              class="button secondary full add-section"
              @click="addSection"
              :disabled="!!draft?.revision"
            >
              <AppIcon name="plus" :size="17" />{{ t('addSection') }}
            </button>
            <button
              v-if="!revision && form.feature_id !== 'study.handwriting'"
              class="button secondary full outline-generation"
              :disabled="!!busy || submissionPending"
              @click="reviewOutline"
            >
              <AppIcon name="sparkle" :size="17" />{{ t('reviewOutlineGeneration') }}
            </button>
            <div v-if="education && !handwriting" class="question-editor">
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
                        : draft?.transcription_reviewed
                          ? 'exportTranscription'
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
          <fieldset class="studio-fieldset" :disabled="!!busy || submissionPending">
            <p class="field-hint">{{ t('studioDefaultsHint') }}</p>
            <label v-if="!revision" class="form-field"
              ><span>{{ t('studioTitleOptional') }}</span
              ><input
                v-model="form.title"
                maxlength="160"
                :placeholder="effectiveTitle || t('studioAutoTitle')"
              /><small>{{ t('studioAutoTitle') }}</small></label
            >
            <label
              v-if="
                !sourceFirst &&
                !revision &&
                !handwriting &&
                !adaptive &&
                !fileOnly &&
                form.feature_id !== 'study.pdf_qa'
              "
              class="form-field"
              ><span>{{ t('sourceText') }} · {{ t('studioOptional') }}</span
              ><textarea
                v-model="form.source_text"
                rows="4"
                :maxlength="studio.config.value?.limits?.source_chars || 12000"
              />
            </label>
            <label v-if="sourceFirst || handwriting || adaptive || fileOnly" class="form-field"
              ><span>{{ t('studioExtraInstructions') }}</span
              ><textarea v-model="form.prompt" rows="3" :maxlength="handwriting ? 1000 : 12000" />
            </label>
            <div v-if="education && !handwriting" class="form-row education-fields">
              <label class="form-field"
                ><span>{{ t('subject') }}</span
                ><input v-model="form.options.subject" maxlength="120"
              /></label>
              <label class="form-field"
                ><span>{{ t('grade') }}</span
                ><input v-model="form.options.grade" maxlength="120"
              /></label>
            </div>
            <label v-if="education && !handwriting" class="form-field"
              ><span>{{ t('objectives') }}</span
              ><textarea v-model="form.options.objectives" rows="3" maxlength="1000" />
            </label>
            <label class="form-field"
              ><span>{{ t('outputLanguage') }}</span
              ><select v-model="form.output_locale" @change="quote = null">
                <option value="en">English</option>
                <option value="uz">O‘zbekcha</option>
                <option value="ru">Русский</option>
              </select></label
            ><label class="form-field"
              ><span>{{ t('format') }}</span
              ><select
                v-model="form.output_format"
                :disabled="revision || handwriting || formats.length === 1"
                @change="quote = null"
              >
                <option
                  v-for="format in formats.filter((value) => value !== 'png')"
                  :key="format"
                  :value="format"
                >
                  {{ format.toUpperCase() }}
                </option>
              </select></label
            ><label class="form-field"
              ><span>{{ form.output_format === 'pptx' ? t('studioSlideCount') : t('studioPageCount') }}</span
              ><input
                v-model.number="form.options.length"
                :disabled="revision || handwriting"
                type="number"
                min="1"
                :max="maxLength"
                data-testid="studio-length"
                @change="quote = null" /><small>{{ t('studioPageCountHint', { max: maxLength }) }}</small></label
            >

            <!-- How much of the page the body text fills. Server-driven: the
                 values come from /studio/config, the metrics live in the
                 renderer, and every plan gets them. -->
            <fieldset v-if="densities.length && !handwriting" class="form-field studio-density">
              <span>{{ t('studioDensity') }}</span>
              <div class="studio-density-row" role="radiogroup" :aria-label="t('studioDensity')">
                <button
                  v-for="value in densities"
                  :key="value"
                  type="button"
                  class="studio-density-option"
                  :class="{ active: activeDensity === value }"
                  role="radio"
                  :aria-checked="activeDensity === value"
                  :data-testid="`studio-density-${value}`"
                  @click="setDensity(value)"
                >
                  <strong>{{ t(`studioDensity_${value}`) }}</strong>
                  <small>{{ t(`studioDensityHint_${value}`) }}</small>
                </button>
              </div>
            </fieldset>

            <label v-if="education && !handwriting" class="form-field"
              ><span>{{ t('questionCount') }}</span
              ><input
                v-model.number="form.options.question_count"
                type="number"
                min="1"
                :max="maxQuestions" /></label
            ><label v-if="!handwriting && !revision" class="form-field"
              ><span>{{ t('studioTone') }}</span
              ><select v-model="form.options.style" data-testid="studio-tone">
                <option value="">{{ t('studioToneDefault') }}</option>
                <option v-for="tone in TONES" :key="tone" :value="tone">{{ t(`studioTone_${tone}`) }}</option>
              </select></label
            ><label v-if="education && !handwriting" class="form-field"
              ><span>{{ t('duration') }}</span
              ><input v-model.number="form.options.duration" type="number" min="5" max="240"
            /></label>
            <details v-if="!handwriting && !revision" class="branding-options">
              <summary>{{ t('branding') }}</summary>
              <label class="check-label"
                ><input type="checkbox" :checked="!!form.options.branding" @change="toggleBranding" /><span>{{
                  t('useBranding')
                }}</span></label
              ><template v-if="form.options.branding"
                ><label class="form-field"
                  ><span>{{ t('brandName') }}</span
                  ><input v-model="form.options.branding.name" maxlength="120" /></label
                ><label class="form-field"
                  ><span>{{ t('brandAccent') }}</span
                  ><input v-model="form.options.branding.accent" type="color" /></label
                ><button
                  class="button secondary full"
                  :disabled="!!busy || submissionPending"
                  @click="logoInput?.click()"
                >
                  <AppIcon name="image" :size="16" />{{ t('uploadLogo') }}</button
                ><input
                  ref="logoInput"
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  class="visually-hidden"
                  @change="uploadLogo(($event.target as HTMLInputElement).files?.[0])"
                  :aria-label="t('uploadLogo')" />
                <div v-if="form.options.branding.logo_asset_id" class="brand-logo-preview">
                  <img
                    :src="`/api/v1/files/${form.options.branding.logo_asset_id}/download`"
                    :alt="t('brandLogo')"
                  /><button
                    class="icon-button"
                    @click="delete form.options.branding.logo_asset_id"
                    :aria-label="t('remove')"
                  >
                    <AppIcon name="x" :size="16" />
                  </button></div
              ></template>
            </details>
          </fieldset>
        </details>
        <section v-if="draft && education && sectionList.length && step === 1" class="panel project-save">
          <h3>{{ t('saveProject') }}</h3>
          <label class="check-label"
            ><input v-model="saveConsent" type="checkbox" /><span>{{ t('projectConsent') }}</span></label
          ><button class="button secondary full" :disabled="!saveConsent || !!busy" @click="saveProject">
            {{ t('saveProject') }}
          </button>
        </section>
        <section v-if="draft && sectionList.length && step === 1" class="panel project-save">
          <h3>{{ t('saveTemplate') }}</h3>
          <p class="field-hint">{{ t('templateSaveHint') }}</p>
          <button class="button secondary full" :disabled="!!busy || submissionPending" @click="saveTemplate">
            {{ t('saveTemplate') }}
          </button>
        </section>
      </aside>
    </div></template
  >
</template>
