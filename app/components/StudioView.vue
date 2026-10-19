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
const cvTemplates = useCvTemplates()

const form = reactive({
  feature_id: String(route.query.feature || 'ai.pdf_topic'),
  title: '',
  // The description is the whole brief: pages, tone, audience and questions are
  // all read out of it server-side, so there is nothing else to collect.
  prompt: String(route.query.prompt || ''),
  source_text: '',
  output_locale: String(ws.user.value?.preferences?.output_locale || locale.value),
  // The service decides the format; this is only what to show before the
  // first draft comes back, so it must match what the server will choose.
  output_format: String(route.query.feature) === 'ai.pptx' ? 'pptx' : 'pdf',
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
/** A draft derived from a finished document changes it rather than replacing it. */
const revising = computed(() => !!draft.value?.revision)
const revisionSelection = computed<string[]>(() => draft.value?.revision?.selected_section_ids || [])
const revisionPageNumbers = computed(() =>
  sectionList.value
    .map((section, index) => (revisionSelection.value.includes(section.id) ? index + 1 : null))
    .filter(Boolean)
    .join(', '),
)
// The server says how many pages a description with no count gets; 10 is its
// own default, kept here for the moment before the config has loaded.
const defaultPages = computed(() => studio.config.value?.default_pages ?? 10)
const maxPages = computed(() => selected.value?.max_pages ?? defaultPages.value)
/**
 * The page count is read from the description by the server, so the form does
 * not parse it a second time: it shows what the draft came back with, and the
 * default until there is one.
 */
const readingPages = computed(() => draft.value?.options?.length ?? defaultPages.value)
/** A deck is counted in slides; only a document is counted in pages. */
const isDeck = computed(() => form.feature_id === 'ai.pptx')
/**
 * A CV is written from the description alone, with an optional portrait and a
 * template. It is one or two pages, whatever its content needs in the
 * template, so it has no count to read or set, and no outline to plan: its
 * eight sections are always the same ones.
 */
const isCv = computed(() => form.feature_id === 'ai.cv')
/**
 * Photo layouts need the service to be able to fetch a photo. Without one they
 * would only ever be drawn as text, so they are not offered.
 */
const photosAvailable = computed(() => (selected.value?.max_images ?? 0) > 0)
const readingLabel = computed(() =>
  isCv.value
    ? t('studioCvLength')
    : t(isDeck.value ? 'studioSlidesReading' : 'studioPagesReading', { count: readingPages.value }),
)
const clampedFrom = computed(() => {
  const asked = draft.value?.options?.requested_pages
  return asked && asked > readingPages.value ? asked : 0
})
/** The most pages (or slides) the chosen service makes, the same on every plan. */
const pageCeiling = computed(() => selected.value?.max_pages ?? readingPages.value)
/**
 * A count read wrong from the description is put right here, before paying:
 * the chosen count wins over the description and the cost is quoted again.
 */
async function setPages(count: number) {
  if (isCv.value || busy.value || submissionPending.value || count < 1 || count > pageCeiling.value) return
  form.options.pages = count
  quote.value = null
  await review()
}

const providerReady = computed(() => studio.config.value?.provider?.configured === true)
const canUseTool = computed(
  () => !!selected.value && selected.value.eligible !== false && providerReady.value,
)
const hasEssentialInput = computed(
  () =>
    !!form.prompt.trim() ||
    // A CV reads no PDF, so one left attached from another service is no input.
    (!isCv.value && files.value.length > 0) ||
    !!form.source_text.trim() ||
    // A draft opened from the list already has its content; it does not need
    // the description typed out again.
    sectionList.value.some(sectionHasContent),
)
/** The first line of the description names the document unless a title is set. */
const titleFrom = (title: string) =>
  (
    title.trim() ||
    form.prompt.trim() ||
    form.source_text.trim() ||
    (!isCv.value && files.value[0]?.name?.replace(/\.[^.]+$/, '')) ||
    name(form.feature_id, selected.value?.name)
  )
    .split(/\r?\n/, 1)[0]
    .slice(0, 160)
const effectiveTitle = computed(() => titleFrom(form.title))
// Slides default to a PDF; only the slides service offers the editable deck.
watch([() => form.feature_id, formats], () => {
  if (!draft.value && !formats.value.includes(form.output_format))
    form.output_format = formats.value[0] || 'pdf'
})

/** Options only a CV takes; the server refuses them on the other services. */
const CV_OPTIONS = ['cv_template', 'portrait_asset_id', 'portrait_sha256']
function draftFields() {
  const options = Object.fromEntries(
    Object.entries(form.options).filter(
      ([key, value]) => value !== '' && value !== undefined && (isCv.value || !CV_OPTIONS.includes(key)),
    ),
  )
  return {
    ...form,
    // A new CV is named after the person, from the description. Its Title field
    // is hidden, so a title typed while another service was chosen must not
    // name it, nor stand in for the name the server looks for. A CV draft's
    // title is the server's, read back into the form, so a save keeps it.
    title: isCv.value && !draft.value ? titleFrom('') : effectiveTitle.value,
    source_text: form.source_text,
    options,
    // A CV is written from the description; its only file is the portrait.
    source_ids: isCv.value ? [] : files.value.map((file) => file.id),
  }
}

/**
 * The CV's portrait: the uploaded image, whose id is the draft's option, and a
 * preview of a file chosen on this page. The server checks it again (owned,
 * JPG or PNG, at most 5 MB and 6 megapixels); this saves a round trip for the
 * obvious mistakes, and makes a phone's photo small enough to be taken.
 */
const portrait = ref<{ id: string; name: string } | null>(null)
const portraitPreview = ref('')
const portraitInput = ref<HTMLInputElement>()
const portraitButton = ref<HTMLButtonElement>()
const photoError = ref('')
const PORTRAIT_TYPES = ['image/jpeg', 'image/png']
/** The largest original taken: a phone's full-size photo, before it is made smaller here. */
const PORTRAIT_SOURCE_BYTES = 20 * 1024 * 1024
/** What the server takes for a portrait (apps/studio/cv/portrait.py). */
const PORTRAIT_BYTES = 5 * 1024 * 1024
const PORTRAIT_PIXELS = 6_000_000
/** The long side a portrait is sent at: about 3 MP at 4:3, ample for a CV's 600 px photo. */
const PORTRAIT_EDGE = 2000
function showPreview(url = '') {
  if (portraitPreview.value) URL.revokeObjectURL(portraitPreview.value)
  portraitPreview.value = url
}
/** The picture decoded upright (by its EXIF orientation), or null when this browser cannot read it. */
async function decodePortrait(file: File) {
  if (typeof createImageBitmap === 'function') {
    // A browser that does not know `from-image` refuses the option; its default
    // is the same orientation.
    for (const options of [{ imageOrientation: 'from-image' } as ImageBitmapOptions, undefined]) {
      try {
        const bitmap = await createImageBitmap(file, options)
        return {
          source: bitmap as CanvasImageSource,
          width: bitmap.width,
          height: bitmap.height,
          close: () => bitmap.close(),
        }
      } catch {
        // Tried again without the option, then as an <img>.
      }
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return {
      source: image as CanvasImageSource,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => {},
    }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
/**
 * The photo as it is sent. A phone's original is 12 MP or more, twice what the
 * server takes, so every picture is drawn again here at most PORTRAIT_EDGE px
 * on its long side, upright, on white (a transparent PNG), as a JPEG of the
 * pixels only: no EXIF, so no location either. A picture that cannot be drawn
 * here goes as it is only when the server would take it; null when it would not.
 */
async function shrinkPortrait(file: File): Promise<File | null> {
  const image = await decodePortrait(file)
  if (!image) return file.size <= PORTRAIT_BYTES ? file : null
  try {
    const scale = Math.min(1, PORTRAIT_EDGE / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.imageSmoothingQuality = 'high'
      context.drawImage(image.source, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (blob && blob.size <= PORTRAIT_BYTES)
        return new File([blob], `${file.name.replace(/\.[^.]*$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' })
    }
  } catch {
    // Not drawn: the original is weighed as it is, below.
  } finally {
    image.close()
  }
  return file.size <= PORTRAIT_BYTES && image.width * image.height <= PORTRAIT_PIXELS ? file : null
}
async function uploadPortrait(file?: File | null) {
  // Cleared so that choosing the same file again still reaches here.
  if (portraitInput.value) portraitInput.value.value = ''
  if (!file) return
  photoError.value = ''
  if (!PORTRAIT_TYPES.includes(file.type) || file.size > PORTRAIT_SOURCE_BYTES) {
    photoError.value = t('studioCvPhotoWrong')
    return
  }
  await run('upload', async () => {
    const photo = await shrinkPortrait(file)
    if (!photo) {
      photoError.value = t('studioCvPhotoUnusable')
      return
    }
    const body = new FormData()
    body.append('file', photo)
    let asset: any
    try {
      asset = await ws.api('/files/uploads', { method: 'POST', body })
    } catch (e) {
      // Said beside the photo, where it is put right, not at the top of the page.
      photoError.value = requestError(e)
      return
    }
    portrait.value = { id: asset.id, name: asset.name || photo.name }
    showPreview(URL.createObjectURL(photo))
    form.options.portrait_asset_id = asset.id
    // The server pins the photo it was given; a new one is pinned afresh.
    delete form.options.portrait_sha256
  })
}
function removePortrait() {
  portrait.value = null
  photoError.value = ''
  showPreview()
  delete form.options.portrait_asset_id
  delete form.options.portrait_sha256
}
onBeforeUnmount(() => showPreview())
/**
 * A portrait the server will not take (over its size, unreadable, no longer
 * stored) is said under the photo field and taken off, so the next review
 * makes the CV without it, instead of failing again behind a banner at the
 * top of the page. The same codes are a brand logo's, so a draft with a logo
 * leaves them to the banner.
 */
const PHOTO_REFUSALS: Record<string, string> = {
  image_pixel_limit: 'studioCvPhotoUnusable',
  invalid_image: 'studioCvPhotoUnusable',
  file_unavailable: 'studioCvPhotoGone',
}
function photoRefused(e: any) {
  const message = PHOTO_REFUSALS[e?.data?.error?.code]
  if (!message || !isCv.value || !form.options.portrait_asset_id || form.options.branding?.logo_asset_id)
    return false
  removePortrait()
  photoError.value = t(message)
  step.value = 0
  return true
}
/**
 * The template a change keeps: the CV's own, unless another is picked. Auto
 * would keep it too, so the picker shows it chosen instead of offering Auto.
 * A change that asks for a new look has none, and its template is Auto's.
 */
const keptTemplate = computed(() => {
  const id = revising.value ? form.options.template_style?.cv_template : ''
  return id && cvTemplates.find(id) ? String(id) : ''
})
const cvPicked = computed(() => {
  const picked = form.options.cv_template
  return picked && picked !== 'auto' ? String(picked) : keptTemplate.value || 'auto'
})
/** The template the review names: the one picked, else the one a change keeps, else Auto. */
const cvTemplateLabel = computed(() => {
  const picked = form.options.cv_template
  const id = picked && picked !== 'auto' ? picked : form.options.template_style?.cv_template
  return id ? cvTemplates.find(id)?.name || String(id) : t('cvSetupAuto')
})
// The picker's templates, in the page's language, read when the CV is chosen.
function loadCvTemplates() {
  if (isCv.value) cvTemplates.load().catch(() => {})
}
watch([isCv, locale], loadCvTemplates)

const requestError = (e: any) => e.data?.error?.message || e.data?.message || t('genericError')
/**
 * A new description that names no topic is refused before anything is made or
 * counted. The refusal is said under the description, where the fix is typed,
 * rather than in the banner at the top of the page.
 */
const promptError = ref('')
/** The other service, when the refused description asked for it ("make slides" in the PDF service). */
const promptSwitch = ref('')
/** The description asked only for a file in another format: the file tools do that. */
const promptConvert = ref(false)
/** Set by "Continue anyway": the customer says the description does name its topic. */
const topicGiven = ref(false)
/** The action the refusal stopped, run again by "Continue anyway". */
let refusedRun: (() => Promise<void>) | null = null
const promptInput = ref<HTMLTextAreaElement>()
/** A service is only offered when it is another one and this plan can use it. */
const offered = (id: string) =>
  !!id && id !== form.feature_id && studio.features.value.some((f) => f.id === id && f.eligible !== false)
function promptRefused(e: any) {
  const refusal = e?.data?.error
  // A CV is refused for want of the person's name, as the others are for a topic.
  if (!['topic_required', 'convert_requested', 'cv_name_required'].includes(refusal?.code)) return false
  promptError.value = refusal.message || t('genericError')
  const other = String(refusal.message_params?.service || '')
  promptSwitch.value = offered(other) ? other : ''
  promptConvert.value = refusal.code === 'convert_requested'
  step.value = 0
  return true
}
// Typing (or taking an example) is the fix, and so is a title, which the
// server reads with the description; the refusal goes with either.
watch([() => form.prompt, () => form.title], () => {
  promptError.value = ''
  promptSwitch.value = ''
  promptConvert.value = false
  topicGiven.value = false
})
/** The customer insists the description has its topic: the same action, sent as it is. */
function continueAnyway() {
  topicGiven.value = true
  refusedRun?.()
}
/**
 * A refusal outlives a change of service, because the description still needs
 * its topic, but the server's words were about the service it was refused in
 * ("what the document should be about", pages). It is said again in words
 * that suit either, and the way to the other service has gone: it is the one
 * now chosen.
 */
watch(
  () => form.feature_id,
  (now, before) => {
    promptSwitch.value = ''
    // A CV needs a name, not a topic, so a refusal does not carry across to or
    // from it: the server says what the new service needs when it is reviewed.
    if (promptError.value && (now === 'ai.cv' || before === 'ai.cv')) {
      promptError.value = ''
      promptConvert.value = false
    } else if (promptError.value) promptError.value = t('studioTopicStill')
  },
)
/**
 * Slides asked of the PDF service, or a written paper of the Slides service.
 * Only ever a suggestion beside the description; the customer's choice stands.
 */
const suggestedService = computed(() => {
  if (draft.value || promptError.value) return ''
  const other = serviceHint(form.prompt, form.feature_id, files.value.length > 0)
  return offered(other) ? other : ''
})
const purposeSelect = ref<HTMLSelectElement>()
/**
 * Moves the description to the other service. The text stays in the form and
 * never travels in the address, where it would sit in the browser's history.
 */
function switchService(featureId: string) {
  if (draft.value || !offered(featureId)) return
  form.feature_id = featureId
  // The button that was pressed goes away; the select shows what changed.
  nextTick(() => purposeSelect.value?.focus())
}
async function run(task: string, fn: () => Promise<void>) {
  busy.value = task
  error.value = ''
  promptError.value = ''
  promptSwitch.value = ''
  promptConvert.value = false
  notice.value = ''
  let refused = false
  let photo = false
  try {
    await fn()
  } catch (e) {
    photo = photoRefused(e)
    refused = !photo && promptRefused(e)
    refusedRun = refused ? () => run(task, fn) : null
    if (!refused && !photo) error.value = requestError(e)
  } finally {
    busy.value = ''
  }
  // The fix is typed in the description, so focus goes there once the form is
  // enabled again; the field's own description reads the refusal out.
  if (refused) {
    await nextTick()
    promptInput.value?.focus()
  } else if (photo) {
    // The photo's button, whose description is the refusal, beside the field.
    await nextTick()
    portraitButton.value?.focus()
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
  // The portrait is the draft's: gone when the server dropped it, its name read on load.
  const photo = form.options.portrait_asset_id
  if (!photo) {
    portrait.value = null
    showPreview()
  } else if (portrait.value?.id !== photo) {
    portrait.value = { id: String(photo), name: '' }
    showPreview()
  }
  const next = structuredClone(
    value.content || {
      title: form.title,
      sections: (value.outline || []).map((s: any) => ({ heading: s.title, body: s.body })),
      questions: [],
    },
  )
  // Every slide field is filled in before the editor binds to it, and before
  // the edit watcher sees it, so opening a deck is not an edit.
  if (isDeck.value) next.sections?.forEach(slideSection)
  content.value = next
  contentEdited.value = false
  quote.value = null
}
async function load() {
  await studio.load()
  loadCvTemplates()
  if (props.draftId)
    await run('load', async () => {
      acceptDraft(await ws.api(`/generation/drafts/${props.draftId}`))
      files.value = await Promise.all(
        (draft.value.source_ids || []).map((id: string) => ws.api(`/files/${id}`)),
      )
      const photo = portrait.value
      if (photo && !photo.name)
        ws.api(`/files/${photo.id}`)
          .then((asset: any) => {
            if (portrait.value?.id === photo.id) portrait.value = { id: photo.id, name: asset.name || '' }
          })
          // Expired or gone: the chip still says a photo is attached, and the server decides.
          .catch(() => {})
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
      removePortrait()
      step.value = 0
      form.feature_id = String(route.query.feature || 'ai.pdf_topic')
      form.title = ''
      form.prompt = ''
      form.source_text = ''
      // The last draft's language was its own; a new one starts from the settings.
      form.output_locale = String(ws.user.value?.preferences?.output_locale || locale.value)
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
  const fields = draftFields()
  acceptDraft(
    await ws.api('/generation/drafts', {
      method: 'POST',
      body: {
        ...fields,
        // "Continue anyway" after a refusal: the check reads words, and a topic
        // it does not know must not block the customer. Only a new draft is
        // checked, so only this request carries it, never a later save.
        options: topicGiven.value ? { ...fields.options, topic_given: true } : fields.options,
        // Only a new draft needs this fallback. Changing an existing prompt,
        // even from empty to a service name, rebuilds its authored content.
        prompt: form.prompt.trim() || name(form.feature_id, selected.value?.name),
      },
    }),
  )
  topicGiven.value = false
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
  const section = { heading: '', body: '' }
  content.value.sections.push(isDeck.value ? slideSection(section) : section)
  quote.value = null
}
function addItem(section: any) {
  if (section.items.length < MAX_SLIDE_ITEMS) section.items.push({ label: '', text: '', value: '' })
}
/** Columns are typed one box at a time; an earlier empty box stays a string, never a hole. */
function setColumn(section: any, index: number, value: string) {
  const columns = Array.from({ length: Math.max(section.columns.length, index + 1) }, (_, i) =>
    i === index ? value : section.columns[i] || '',
  )
  section.columns = columns
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
      !sectionList.value.some(sectionHasContent) &&
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
  // A change request is planned from the document it changes; the server
  // refuses an AI outline for it, which would replace the document's text.
  if (busy.value || submissionPending.value || revising.value) return
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
</script>
<template>
  <div class="studio-page">
    <div class="page-heading studio-head">
      <div>
        <h1>{{ t('studioTitle') }}</h1>
        <p>{{ t('studioSub') }}</p>
      </div>
      <NuxtLink :to="path('/app/guide')" class="button quiet"
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
    <div v-if="revising" class="info-banner" data-testid="studio-revising">
      <AppIcon name="edit" :size="19" />{{
        revisionSelection.length
          ? t('reviseSelectedBanner', { pages: revisionPageNumbers })
          : t('reviseBanner')
      }}
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
          t(providerReady ? 'studioToolUnavailable' : 'studioUnavailable')
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
                  ref="purposeSelect"
                  v-model="form.feature_id"
                  :disabled="!!draft"
                  data-testid="studio-purpose"
                >
                  <option v-for="feature in studio.features.value" :key="feature.id" :value="feature.id">
                    {{ name(feature.id, feature.name) }}
                  </option>
                </select></label
              >
              <label class="form-field studio-primary-field">
                <span>{{ t(revising ? 'reviseLabel' : 'studioDescribe') }}</span>
                <textarea
                  ref="promptInput"
                  v-model="form.prompt"
                  data-testid="studio-primary-input"
                  @input="delete form.options.pages"
                  rows="7"
                  :maxlength="studio.config.value?.limits?.source_chars || 12000"
                  :placeholder="t(isCv ? 'studioCvPlaceholder' : 'studioDescribePlaceholder')"
                  :aria-invalid="promptError ? 'true' : undefined"
                  :aria-describedby="
                    promptError ? 'studio-prompt-error' : suggestedService ? 'studio-service-hint' : undefined
                  "
                />
                <small data-testid="studio-describe-hint">{{
                  revising
                    ? t(isCv ? 'reviseExamplesCv' : 'reviseExamples')
                    : isCv
                      ? t('studioCvDescribeHint')
                      : t('studioDescribeHint', { pages: defaultPages, max: maxPages })
                }}</small>
              </label>
              <!-- Outside the label: a button inside one would be part of its name. -->
              <div v-if="promptError" class="field-error" data-testid="studio-prompt-error">
                <AppIcon name="alert" :size="17" /><span id="studio-prompt-error">{{ promptError }}</span>
                <button
                  v-if="promptSwitch && offered(promptSwitch)"
                  type="button"
                  class="button secondary small"
                  data-testid="studio-prompt-switch"
                  @click="switchService(promptSwitch)"
                >
                  {{ t(promptSwitch === 'ai.pptx' ? 'studioMakeSlidesInstead' : 'studioMakePdfInstead') }}
                </button>
                <NuxtLink
                  v-if="promptConvert"
                  class="button secondary small"
                  data-testid="studio-prompt-tools"
                  :to="path('/app/tools')"
                  >{{ t('studioOpenFileTools') }}</NuxtLink
                >
                <button
                  type="button"
                  class="button quiet small"
                  data-testid="studio-prompt-anyway"
                  :disabled="!!busy"
                  @click="continueAnyway"
                >
                  {{ t('studioContinueAnyway') }}
                </button>
              </div>
              <!-- Always in the page, so the suggestion is announced when it appears while typing. -->
              <div
                class="studio-service-hint"
                :class="{ shown: !!suggestedService }"
                data-testid="studio-service-hint"
              >
                <AppIcon v-if="suggestedService" name="sparkle" :size="17" /><span
                  id="studio-service-hint"
                  role="status"
                  aria-live="polite"
                  data-testid="studio-service-hint-text"
                  >{{
                    suggestedService
                      ? t(suggestedService === 'ai.pptx' ? 'studioSlidesHint' : 'studioPdfHint')
                      : ''
                  }}</span
                >
                <button
                  v-if="suggestedService"
                  type="button"
                  class="button secondary small"
                  data-testid="studio-service-switch"
                  @click="switchService(suggestedService)"
                >
                  {{ t(suggestedService === 'ai.pptx' ? 'studioSwitchToSlides' : 'studioSwitchToPdf') }}
                </button>
              </div>
              <div v-if="!revising" class="studio-examples">
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
              <div v-if="!isCv" class="studio-source">
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
              <template v-if="!isCv">
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
              </template>
              <!-- A CV takes a portrait instead of a PDF, then its template. -->
              <template v-else>
                <div class="studio-source">
                  <div>
                    <h3>{{ t('studioCvPhoto') }}</h3>
                    <p>{{ t('studioCvPhotoHint') }}</p>
                  </div>
                  <button
                    ref="portraitButton"
                    type="button"
                    class="button secondary"
                    data-testid="studio-cv-photo-button"
                    :disabled="!!busy || submissionPending"
                    :aria-describedby="photoError ? 'studio-cv-photo-error' : undefined"
                    @click="portraitInput?.click()"
                  >
                    <AppIcon name="image" :size="17" />{{
                      t(portrait ? 'studioCvPhotoReplace' : 'studioCvPhotoAdd')
                    }}</button
                  ><input
                    ref="portraitInput"
                    type="file"
                    class="visually-hidden"
                    accept="image/png,image/jpeg"
                    data-testid="studio-cv-photo"
                    :aria-label="t('studioCvPhoto')"
                    @change="uploadPortrait(($event.target as HTMLInputElement).files?.[0])"
                  />
                </div>
                <div v-if="photoError" class="field-error" data-testid="studio-cv-photo-error">
                  <AppIcon name="alert" :size="17" /><span id="studio-cv-photo-error">{{ photoError }}</span>
                </div>
                <div v-if="portrait" class="source-chip cv-photo-chip" data-testid="studio-cv-photo-chip">
                  <img v-if="portraitPreview" class="cv-photo-preview" :src="portraitPreview" alt="" /><AppIcon
                    v-else
                    name="image"
                    :size="17"
                  /><span>{{ portrait.name || t('studioCvPhotoAttached') }}</span
                  ><!-- A change takes the CV's photo back whenever none is sent, so it is
                       left out in words, below, not with a button that would do nothing. --><button
                    v-if="!revising"
                    type="button"
                    class="icon-button"
                    :aria-label="t('remove')"
                    @click="removePortrait"
                  >
                    <AppIcon name="x" :size="15" />
                  </button>
                </div>
                <p v-if="revising && portrait" class="field-hint" data-testid="studio-cv-photo-kept">
                  {{ t('studioCvPhotoKept') }}
                </p>
                <section class="studio-cv-template" data-testid="studio-cv-template">
                  <h3>{{ t('studioCvTemplate') }}</h3>
                  <CvTemplatePicker
                    :model-value="cvPicked"
                    :categories="cvTemplates.categories.value"
                    :default-id="cvTemplates.defaultId.value"
                    :no-auto="!!keptTemplate"
                    compact
                    @update:model-value="form.options.cv_template = $event"
                  />
                </section>
              </template>
              <details class="studio-more-options" data-testid="studio-more-options">
                <summary>{{ t('studioMoreOptions') }}</summary>
                <div class="studio-settings-body">
                  <label class="form-field"
                    ><span>{{ t('outputLanguage') }}</span
                    ><select
                      v-model="form.output_locale"
                      data-testid="studio-locale"
                      @change="form.options.locale_chosen = true"
                    >
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
                  <!-- A CV is named after the person, as the description gives it. -->
                  <label v-if="!isCv" class="form-field"
                    ><span>{{ t('studioTitleOptional') }}</span
                    ><input v-model="form.title" maxlength="160" data-testid="studio-title"
                  /></label>
                </div>
              </details>
              <div class="studio-defaults" aria-live="polite">
                <AppIcon name="sparkle" :size="16" /><span
                  >{{ form.output_format.toUpperCase() }} · {{ outputLanguage }} ·
                  {{ readingLabel }}</span
                >
              </div>
              <div class="studio-form-actions">
                <button
                  v-if="draft && !isCv"
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
                  {{ busy ? t('working') : t('studioReviewStep') }}<AppIcon name="right" :size="17" />
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
                  <label v-if="isDeck" class="form-field"
                    ><span>{{ t('slideLayout') }}</span
                    ><select v-model="section.layout" :data-testid="`slide-layout-${index}`">
                      <option value="auto">{{ t('layout.auto') }}</option>
                      <optgroup
                        v-for="(ids, group) in SLIDE_LAYOUT_GROUPS"
                        :key="group"
                        :label="t(`layoutGroup.${group}`)"
                      >
                        <option
                          v-for="id in ids"
                          :key="id"
                          :value="id"
                          :disabled="isPhotoLayout(id) && !photosAvailable && section.layout !== id"
                        >
                          {{ t(`layout.${id}`) }}
                        </option>
                      </optgroup>
                    </select>
                    <small v-if="index === 0 && sectionList.length > 1">{{ t('slideCoverFirst') }}</small>
                    <small v-else-if="section.layout !== 'auto'">{{ t(`layoutHint.${section.layout}`) }}</small>
                  </label>
                  <label class="form-field"
                    ><span>{{ t('sectionHeading') }}</span
                    ><input v-model="section.heading" /></label
                  ><label class="form-field"
                    ><span>{{ t('sectionBody') }}</span
                    ><textarea v-model="section.body" rows="4" />
                  </label>
                  <div v-if="isDeck && layoutUsesColumns(section)" class="form-field">
                    <span>{{ t('slideColumns') }}</span>
                    <div class="slide-columns">
                      <input
                        v-for="column in MAX_SLIDE_COLUMNS"
                        :key="column"
                        :value="section.columns[column - 1] || ''"
                        maxlength="80"
                        :aria-label="`${t('slideColumns')} ${column}`"
                        @input="setColumn(section, column - 1, ($event.target as HTMLInputElement).value)"
                      />
                    </div>
                  </div>
                  <div v-if="isDeck && layoutUsesItems(section)" class="form-field slide-items">
                    <span>{{ t('slideItems') }}</span>
                    <div v-for="(item, row) in section.items" :key="row" class="slide-item">
                      <input
                        v-model="item.label"
                        maxlength="160"
                        :placeholder="t('itemLabel')"
                        :aria-label="`${Number(row) + 1} · ${t('itemLabel')}`"
                      />
                      <input
                        v-model="item.text"
                        maxlength="600"
                        :placeholder="t('itemText')"
                        :aria-label="`${Number(row) + 1} · ${t('itemText')}`"
                      />
                      <input
                        v-model="item.value"
                        maxlength="160"
                        :placeholder="t('itemValue')"
                        :aria-label="`${Number(row) + 1} · ${t('itemValue')}`"
                      />
                      <button class="icon-button" :aria-label="t('removeItem')" @click="section.items.splice(row, 1)">
                        <AppIcon name="trash" :size="15" />
                      </button>
                    </div>
                    <button
                      v-if="section.items.length < MAX_SLIDE_ITEMS"
                      class="button secondary small"
                      :data-testid="`slide-add-item-${index}`"
                      @click="addItem(section)"
                    >
                      <AppIcon name="plus" :size="15" />{{ t('addItem') }}
                    </button>
                  </div>
                  <label v-if="isDeck && layoutUsesPhoto(section)" class="form-field"
                    ><span>{{ t('photoSubject') }}</span
                    ><input v-model="section.image_query" maxlength="100" :placeholder="t('photoSubjectExample')" />
                    <small>{{ photosAvailable ? t('photoSubjectHint') : t('photosOff') }}</small>
                  </label>
                  <label v-if="isDeck" class="form-field"
                    ><span>{{ t('speakerNotes') }}</span
                    ><textarea v-model="section.notes" rows="3" />
                  </label>
                </div>
                <div class="outline-actions">
                  <button
                    class="icon-button"
                    :disabled="index === 0 || !!revisionSelection.length"
                    @click="moveSection(Number(index), -1)"
                    :aria-label="t('moveUp')"
                  >
                    <AppIcon name="up" :size="17" /></button
                  ><button
                    class="icon-button"
                    :disabled="index === sectionList.length - 1 || !!revisionSelection.length"
                    @click="moveSection(Number(index), 1)"
                    :aria-label="t('moveDown')"
                  >
                    <AppIcon name="moveDown" :size="17" /></button
                  ><button
                    class="icon-button"
                    :disabled="!!revisionSelection.length"
                    @click="content.sections.splice(index, 1)"
                 
                    :aria-label="t('delete')"
                  >
                    <AppIcon name="trash" :size="17" />
                  </button>
                </div>
              </div>
              <button
                class="button secondary full add-section"
                :disabled="!!revisionSelection.length"
                @click="addSection"
             
              >
                <AppIcon name="plus" :size="17" />{{ t('addSection') }}
              </button>
              <button
                v-if="!revising && !isCv"
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
            <p class="field-hint">{{ t(isCv ? 'studioCvReviewHint' : 'studioReviewHint') }}</p>
            <button
              v-if="!isCv"
              class="button secondary small"
              :disabled="!!busy || submissionPending"
              data-testid="studio-edit-outline"
              @click="step = 1"
            >
              {{ t('studioEditOutline') }}
            </button>
            <div v-if="!isCv" class="outline-summary">
              <div v-for="(section, index) in sectionList" :key="index">
                <b>{{ Number(index) + 1 }}</b
                ><span>{{ section.heading }}</span>
              </div>
            </div>
            <p class="review-advice"><AppIcon name="shield" :size="17" />{{ t('reviewBeforeShare') }}</p>
            <div v-if="!quote" class="studio-form-actions">
              <button class="button primary" @click="review" :disabled="!!busy || submissionPending">
                {{ t('studioReviewStep') }}
              </button>
            </div>
          </section>
        </div>
        <aside v-if="quote" class="studio-rail">
          <section class="panel studio-quote">
            <h2>{{ t('reviewTitle') }}</h2>
            <!-- A CV's length is the template's to fit: said, not set. -->
            <template v-if="isCv">
              <div class="meter-row studio-cv-row" data-testid="studio-cv-length">
                <span>{{ t('guideRowPages') }}</span><strong>{{ t('studioCvLength') }}</strong>
              </div>
              <div class="meter-row studio-cv-row" data-testid="studio-cv-template-row">
                <span>{{ t('studioCvTemplate') }}</span><strong>{{ cvTemplateLabel }}</strong>
              </div>
              <div class="meter-row studio-cv-row" data-testid="studio-cv-photo-row">
                <span>{{ t('cvSetupPhoto') }}</span
                ><strong>{{ t(portrait ? 'studioCvPhotoAttached' : 'studioCvPhotoNone') }}</strong>
              </div>
            </template>
            <div v-else class="meter-row" data-testid="studio-pages">
              <span>{{ t('guideRowPages') }}</span
              ><span class="page-stepper">
                <button
                  type="button"
                  class="icon-button"
                  data-testid="studio-pages-fewer"
                  :aria-label="t('studioFewer')"
                  :disabled="!!busy || submissionPending || readingPages <= 1"
                  @click="setPages(readingPages - 1)"
                >
                  −</button
                ><strong>{{ readingPages }}</strong
                ><button
                  type="button"
                  class="icon-button"
                  data-testid="studio-pages-more"
                  :aria-label="t('studioMore')"
                  :disabled="!!busy || submissionPending || readingPages >= pageCeiling"
                  @click="setPages(readingPages + 1)"
                >
                  +
                </button>
              </span>
            </div>
            <!-- A clamped request is said out loud. Every plan has the same ceiling,
                 so there is no plan to offer for more. -->
            <p v-if="clampedFrom && !isCv" class="field-hint" data-testid="studio-pages-clamped">
              {{ t('studioPagesClamped', { asked: clampedFrom, given: readingPages }) }}
            </p>
            <!-- An edit counts against the file's own edits, not the week's documents. -->
            <WeeklyLine v-if="!revising" kind="ai" :usage="quote.usage" />
            <p class="quote-expiry">{{ t('quoteExpires') }} {{ date(quote.expires_at, true) }}</p>
            <div v-if="quote.affordable === false" class="warning-banner" data-testid="weekly-limit">
              <AppIcon name="alert" :size="17" /><span
                >{{ t(revising ? 'editLimitReached' : 'quotaExceeded') }}
                <NuxtLink :to="path('/app/billing')" class="text-link">{{ t('studioSeePlans') }}</NuxtLink></span
              >
            </div>
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
              class="text-link refresh-quote"
              type="button"
              :disabled="!!busy || submissionPending"
              @click="quoteStage === 'outline' ? reviewOutline() : review()"
            >
              {{ t('refreshQuote') }}
            </button>
          </section>
        </aside>
      </div></template
    >
  </div>
</template>
