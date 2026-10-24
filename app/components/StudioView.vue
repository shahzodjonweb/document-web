<script setup lang="ts">
import type { CvFactTicks, CvFileSource, CvSource } from '../composables/useCvSources'
const props = defineProps<{ draftId?: string }>()
const route = useRoute()
const { t, count, path, locale, date } = useLocale()
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
 * A CV is written from a description, the customer's LinkedIn profile or an
 * old CV, with an optional portrait and a template. It is one or two pages,
 * whatever its content needs in the template, so it has no count to read or
 * set, and no outline to plan: its eight sections are always the same ones.
 */
const isCv = computed(() => form.feature_id === 'ai.cv')
/**
 * Where the CV starts from, chosen first. Only the modes the server lists are
 * offered; one that lists none (an older server) takes the description alone,
 * and the choice is not shown.
 */
const cvSource = ref<CvSource>('text')
const cvModes = computed<CvSource[]>(() => {
  const listed = selected.value?.source_modes
  return Array.isArray(listed) ? CV_SOURCES.filter((mode) => mode === 'text' || listed.includes(mode)) : ['text']
})
const cvMode = computed<CvSource>(() =>
  isCv.value && cvModes.value.includes(cvSource.value) ? cvSource.value : 'text',
)
/** The CV is made from files: the description is notes on top of them. */
const cvFromFiles = computed(() => cvMode.value !== 'text')
/** A new CV made from files shows their upload area; a change keeps its CV's files. */
const cvFileForm = computed(() => cvFromFiles.value && !revising.value)
/**
 * Each mode keeps its own files while the page is open, so a click on another
 * mode loses nothing; only the chosen mode's files are ever sent.
 */
const cvFiles = reactive<Record<CvFileSource, any[]>>({ linkedin: [], file: [] })
const cvSourceFiles = computed<any[]>(() => (cvMode.value === 'text' ? [] : cvFiles[cvMode.value as CvFileSource]))
// What the server could not read of the CV's files (`cv_unread`): each file by
// name, whole or with how many of its pages were left out.
const cvUnread = computed(() => {
  const unread: { asset_id: string; pages: number; whole?: boolean }[] = draft.value?.cv_unread || []
  if (!isCv.value || !unread.length) return ''
  const names = new Map(cvSourceFiles.value.map((file) => [String(file.id), String(file.name || '')]))
  return unread
    .map((entry) => {
      const name = names.get(String(entry.asset_id)) || t('studioCvUnreadFile')
      return entry.whole ? name : t('studioCvUnreadPages', { name, count: entry.pages })
    })
    .join('; ')
})
const cvKinds = computed<string[]>(() => {
  if (cvMode.value === 'text') return []
  const mode = cvMode.value as CvFileSource
  const listed = selected.value?.source_kinds?.[mode]
  return Array.isArray(listed) && listed.length ? listed : CV_SOURCE_KINDS[mode]
})
const cvMaxFiles = computed(() => selected.value?.max_source_files || CV_SOURCE_FILES)
/** Most pages the files may have in all: the server's when it says, else its usual cap. */
const cvMaxPages = computed(() => selected.value?.max_source_pages || CV_SOURCE_PAGES)
const CV_SOURCE_ICONS: Record<CvSource, string> = { text: 'edit', linkedin: 'globe', file: 'file' }
/** Each choice's name and the line under it. */
const CV_SOURCE_CHOICES: Record<CvSource, [string, string]> = {
  text: ['studioCvFromText', 'studioCvFromTextHint'],
  linkedin: ['studioCvFromLinkedin', 'studioCvFromLinkedinHint'],
  file: ['studioCvFromFile', 'studioCvFromFileHint'],
}
const CV_SOURCE_LABELS: Record<CvSource, string> = {
  text: 'studioCvSourceText',
  linkedin: 'studioCvSourceLinkedin',
  file: 'studioCvSourceFile',
}
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
    // A CV reads only its own mode's files, so a PDF left attached from another
    // service is no input.
    (!isCv.value && files.value.length > 0) ||
    cvSourceFiles.value.length > 0 ||
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
const CV_OPTIONS = ['cv_template', 'portrait_asset_id', 'portrait_sha256', 'cv_source']
/**
 * A CV's own files: the chosen mode's, none for a description. A change keeps
 * the files its CV was made from, as the server holds them, and has no mode
 * to choose.
 */
function cvSourceIds(): string[] {
  if (revising.value) return [...(draft.value?.source_ids || [])]
  return cvSourceFiles.value.map((file) => file.id)
}
function draftFields() {
  const options = Object.fromEntries(
    Object.entries(form.options).filter(
      ([key, value]) => value !== '' && value !== undefined && (isCv.value || !CV_OPTIONS.includes(key)),
    ),
  )
  // The mode is said only to a server that offers modes; to one that does not,
  // a CV is its description, as it always was. A change keeps its CV's mode.
  if (isCv.value && !revising.value && Array.isArray(selected.value?.source_modes))
    options.cv_source = cvMode.value
  return {
    ...form,
    // A new CV is named after the person, from the description. Its Title field
    // is hidden, so a title typed while another service was chosen must not
    // name it, nor stand in for the name the server looks for. A CV draft's
    // title is the server's, read back into the form, so a save keeps it.
    title: isCv.value && !draft.value ? titleFrom('') : effectiveTitle.value,
    source_text: form.source_text,
    options,
    // A CV's portrait is an option, never a source file.
    source_ids: isCv.value ? cvSourceIds() : files.value.map((file) => file.id),
  }
}

/**
 * Each of a CV's files is read by the server in its turn, after the upload:
 * its chip says where the read is (in line, being read, read, not read). A
 * draft is made only from files read, so Review pressed before then waits
 * here, saying how many are ahead, and sends itself as soon as every file is
 * read or could not be; a server still reading says so (`cv_reading`), and
 * the wait is the same. Never a "try again".
 */
const cvReads = useCvReads(cvSourceIds, () => isCv.value && cvFromFiles.value)
const cvWaiting = ref(false)
/** How many were ahead when the wait began: said once, not again at every turn of the line. */
const cvWaitAhead = ref(0)
const reviewButton = ref<HTMLButtonElement>()
function waitForReads() {
  cvWaitAhead.value = cvReads.ahead.value
  cvWaiting.value = true
  step.value = 0
}
// Sent once every file is read, unless the files were all taken away meanwhile.
watch([cvReads.pending, busy], () => {
  if (!cvWaiting.value || cvReads.pending.value || busy.value) return
  cvWaiting.value = false
  if (cvSourceIds().length) review()
})
const READ_ICONS: Record<string, string> = {
  queued: 'clock',
  reading: 'loader',
  done: 'check',
  failed: 'alert',
}
const cvRead = (file: any) => cvReads.reads.value[String(file.id)]
/** Where a file's read is, as its chip shows it: a file read with no text in it was not read. */
const cvReadState = (file: any) => cvReadShown(cvRead(file))
function readLabel(file: any) {
  const read = cvRead(file)
  if (!read) return ''
  if (read.status === 'queued')
    return read.ahead > 0 ? count('studioCvReadQueued', read.ahead) : t('studioCvReadNext')
  if (read.status === 'reading') return t('studioCvReadReading')
  if (cvReadFailed(read)) return t('studioCvReadFailed')
  return read.pages ? count('studioCvReadPages', read.pages) : t('studioCvReadDone')
}
const reviewWaitLabel = computed(() =>
  cvReads.ahead.value > 0
    ? t('studioCvReadWaiting', { count: cvReads.ahead.value })
    : t('studioCvReadWaitingNow'),
)
/** About how long until the files are read, rounded up: to 5 seconds, or whole minutes past one. */
function waitTime(seconds: number) {
  const minutes = seconds > 55 ? Math.ceil(seconds / 60) : 0
  return new Intl.NumberFormat(locale.value === 'uz' ? 'uz-Latn' : locale.value, {
    style: 'unit',
    unit: minutes ? 'minute' : 'second',
    unitDisplay: 'long',
  }).format(minutes || Math.max(5, Math.ceil(seconds / 5) * 5))
}
const cvWaitHint = computed(() => {
  const seconds = cvReads.estimate.value
  return seconds && seconds > 0
    ? t('studioCvReadWaitTime', { time: waitTime(seconds) })
    : t('studioCvReadWaitHint')
})
/**
 * What a screen reader is told, politely: the wait as it began, and the files
 * as they finish, never each turn of the line. The files only once the server
 * has said how far every one of them is.
 */
const cvReadWait = computed(() =>
  !cvWaiting.value
    ? ''
    : cvWaitAhead.value > 0
      ? count('studioCvReadWaitStatus', cvWaitAhead.value)
      : t('studioCvReadWaitStatusNow'),
)
const cvReadProgress = computed(() => {
  const ids = cvSourceIds()
  const known = ids.map((id) => cvReads.reads.value[id])
  if (!ids.length || known.some((read) => !read)) return ''
  const read = known.filter((entry) => cvReadShown(entry) === 'done').length
  if (known.some(cvReadUnfinished)) return t('studioCvReadProgress', { read, total: ids.length })
  // A file read whose pages are not known yet may have had no text in it: said once they are.
  if (known.some((entry) => entry?.status === 'done' && entry.pages == null)) return ''
  const failed = cvSourceFiles.value.filter((file) => cvReadFailed(cvRead(file))).map((file) => file.name)
  return failed.length ? t('studioCvReadNotRead', { names: failed.join(', ') }) : t('studioCvReadAll')
})
/**
 * The server had not read every file yet (`cv_reading`): the files are asked
 * after, and the draft waits for them as if Review had been pressed early.
 */
function readingRefused(e: any) {
  const refusal = e?.data?.error
  const ids = cvSourceIds()
  if (refusal?.code !== 'cv_reading' || !isCv.value || !ids.length) return false
  cvReads.expect(ids, refusal.message_params || {})
  waitForReads()
  return true
}

/**
 * The CV's source files: a LinkedIn profile's PDF or screenshots, or an old
 * CV. A file of a kind the mode does not read, or one too many, is said beside
 * the upload area before anything is uploaded; the server checks again, and
 * reads them in turn for their text.
 */
const cvSourceInput = ref<HTMLInputElement>()
const cvSourceButton = ref<HTMLButtonElement>()
const cvSourceList = ref<HTMLUListElement>()
const sourceError = ref('')
const kindRefusal = (mode: CvSource) => (mode === 'linkedin' ? 'studioCvKindLinkedin' : 'studioCvKindFile')
const missingRefusal = (mode: CvSource) => (mode === 'linkedin' ? 'studioCvNeedLinkedin' : 'studioCvNeedFile')
/**
 * An upload refused for a password: the CV's upload area has no password
 * field, and a protected PDF is never read for a CV (the bot says the same).
 */
const PASSWORD_REFUSALS = ['password_required', 'password_invalid', 'secure_password_entry_required']
const uploadRefusal = (e: any) =>
  PASSWORD_REFUSALS.includes(e?.data?.error?.code) ? t('studioCvProtected') : requestError(e)
/** The upload button, or the last file's remove button once the files are as many as they can be. */
function focusCvSources() {
  const button = cvSourceButton.value
  if (button && !button.disabled) button.focus()
  else cvSourceList.value?.querySelector<HTMLButtonElement>('li:last-child button')?.focus()
}
async function uploadCvSources(list: FileList | null) {
  const picked = Array.from(list || [])
  // Cleared so that choosing the same file again still reaches here.
  if (cvSourceInput.value) cvSourceInput.value.value = ''
  if (!picked.length || cvMode.value === 'text') return
  const mode = cvMode.value as CvFileSource
  // Taken away for a moment, so that the same refusal made again is read out again.
  if (sourceError.value) {
    sourceError.value = ''
    await nextTick()
  }
  if (picked.some((file) => !cvKinds.value.includes(cvFileKind(file)))) {
    sourceError.value = t(kindRefusal(mode))
    return
  }
  if (cvFiles[mode].length + picked.length > cvMaxFiles.value) {
    sourceError.value = t('studioCvFilesMax', { max: cvMaxFiles.value })
    return
  }
  await run('upload', async () => {
    // A file the server refuses is named with why, beside the upload area,
    // where it is put right; the files before and after it are still taken.
    const refused = new Map<string, string[]>()
    for (const file of picked) {
      const body = new FormData()
      body.append('file', withExtension(file))
      // Read for the CV only: a Word CV with links in it (an email, a LinkedIn
      // address) is taken, and no file tool will take this file.
      body.append('purpose', 'cv_source')
      try {
        const asset: any = await ws.api('/files/uploads', { method: 'POST', body })
        cvFiles[mode] = [...cvFiles[mode], asset]
        cvReads.take(asset.id, asset.cv_read)
      } catch (e) {
        const reason = uploadRefusal(e)
        refused.set(reason, [...(refused.get(reason) || []), file.name])
      }
    }
    sourceError.value = [...refused].map(([reason, names]) => `${names.join(', ')}: ${reason}`).join(' ')
    // Where the line is now, and the pages of a file read already.
    cvReads.refresh()
  })
  // The form was disabled while the files went up, which took the focus away
  // from the upload button: it goes back there, whose description is any refusal.
  await nextTick()
  if (!document.activeElement || document.activeElement === document.body) focusCvSources()
}
/** A file taken off the form is taken out of the line too, if it is still in it: no one waits for its read. */
function removeCvSource(id: string) {
  if (cvMode.value === 'text') return
  const mode = cvMode.value as CvFileSource
  cvFiles[mode] = cvFiles[mode].filter((file) => file.id !== id)
  cvReads.cancel([id])
  sourceError.value = ''
}
/** Every CV file the page keeps, whichever way to start it is under. */
const cvFileIds = () => [...cvFiles.linkedin, ...cvFiles.file].map((file) => String(file.id))
/**
 * The CV files the page keeps that this CV is not made from: another way to
 * start's, or all of them for a description or another service. Their reads
 * still in line are taken out of it when the CV is sent, so its own files
 * are not kept waiting behind them; shown again, they go back in line.
 */
function unsentCvFileIds() {
  const sent = new Set(cvSourceIds())
  return cvFileIds().filter((id) => !sent.has(id))
}
// The page left, its files are gone from the form: none is read for nothing.
// A saved draft's files were read before it was saved, and stay so.
onBeforeUnmount(() => cvReads.cancel(cvFileIds()))
const SOURCE_ICONS: Record<string, string> = { image: 'image', docx: 'word' }
const sourceIcon = (file: any) => SOURCE_ICONS[cvFileKind(file)] || 'file'
/** A CV's description is about the person; made from files, it is notes on top of them. */
const promptPlaceholder = computed(() =>
  !isCv.value ? 'studioDescribePlaceholder' : cvFileForm.value ? 'studioCvNotesPlaceholder' : 'studioCvPlaceholder',
)
/** What the review rail says the CV is made from, above the files' names. */
const cvSourceLabel = computed(() => t(CV_SOURCE_LABELS[cvMode.value]))
/**
 * A description that is a LinkedIn link and no fact about the person is not
 * sent: the server cannot open the profile. The way to send it is said under
 * the field, steps and all.
 */
const cvLinkError = ref('')
const LINKEDIN_STEPS = ['studioCvLinkedinStepComputer', 'studioCvLinkedinStepPhone', 'studioCvLinkedinStepScreenshots']
/**
 * What a CV needs, listed above its description: the facts it cannot be made
 * without, ticked as the text gives them, and those it may also have. The
 * server lists them (`cv_facts`). The ticks are the form's own reading of the
 * text (cvFactTicks), which only advises: the server decides, and what it
 * refused a CV for (`cv_missing`) is believed over the ticks until the text
 * changes. Made from files, the facts come from them, so nothing is ticked.
 */
/** The fact ids of `value` the form knows, each once, in order: nothing when it is not a list. */
const factList = (value: unknown) =>
  Array.isArray(value) ? [...new Set(value.map(String))].filter((key) => CV_FACT_KEYS.has(key)) : []
const cvFacts = computed(() => {
  const listed = selected.value?.cv_facts
  if (!Array.isArray(listed?.required) || !Array.isArray(listed?.optional)) return CV_FACTS_FALLBACK
  // A list that names no fact the form knows (ids renamed on the server) is the form's own.
  const required = factList(listed.required)
  const optional = factList(listed.optional)
  return {
    required: required.length ? required : CV_FACTS_FALLBACK.required,
    optional: optional.length ? optional : CV_FACTS_FALLBACK.optional,
  }
})
const cvTicks = computed(() => (cvFromFiles.value ? null : cvFactTicks(form.prompt)))
/** The patterns behind the ticks are compiled while the page is idle, a piece at a time, not on the first keystroke. */
function warmCvTicks() {
  const later = (step: () => void) =>
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback(step, { timeout: 3000 })
      : setTimeout(step, 60)
  const step = () => {
    if (warmCvFactTicks()) later(step)
  }
  later(step)
}
watch(
  () => isCv.value && !cvFromFiles.value,
  (typed) => {
    if (typed && import.meta.client) warmCvTicks()
  },
  { immediate: true },
)
/** The required facts the server's last refusal said a new CV lacks. */
const cvMissing = ref<string[]>([])
const cvDone = (key: string) => !!cvTicks.value?.[key as keyof CvFactTicks] && !cvMissing.value.includes(key)
const factKey = (key: string) => `studioCvFact${key.charAt(0).toUpperCase()}${key.slice(1)}`
const factName = (key: string) => t(factKey(key))
const capital = (text: string) => text.charAt(0).toLocaleUpperCase(locale.value) + text.slice(1)
/** A refusal's example is given for the required facts. */
const hasExample = (key: string) => CV_FACTS_FALLBACK.required.includes(key)
const cvOptional = computed(() =>
  t('studioCvNeedsOptional', { facts: cvFacts.value.optional.map(factName).join(', ') }),
)
/**
 * Said on the review of a CV the server made with something missing (the
 * customer insisted) or something it could still have: the missing facts first,
 * then the optional ones, four at most. The photo has its row of its own.
 */
const cvCanAdd = computed(() => {
  const facts = draft.value?.cv_facts
  if (!isCv.value || revising.value || !facts) return []
  // Read as lists whatever the draft holds: a value that is not one is nothing, never a broken page.
  return [...new Set([...factList(facts.missing), ...factList(facts.optional_missing)])]
    .filter((key) => key !== 'photo')
    .slice(0, 4)
    .map(factName)
})
const cvSourceChoice = ref<HTMLFieldSetElement>()
/** The steps' way to From LinkedIn. The button that was pressed goes away; the checked choice says what changed. */
function chooseLinkedin() {
  cvSource.value = 'linkedin'
  nextTick(() => cvSourceChoice.value?.querySelector<HTMLInputElement>('input:checked')?.focus())
}
/** What stops a new CV before it is sent: a bare LinkedIn link, or a file mode with no file. */
function cvStopsBeforeSending() {
  if (!isCv.value || revising.value) return false
  if (!cvSourceFiles.value.length && linkedinLinkOnly(form.prompt)) {
    cvLinkError.value = t('studioCvLinkRefused')
    step.value = 0
    nextTick(() => promptInput.value?.focus())
    return true
  }
  if (cvFromFiles.value && !cvSourceFiles.value.length) {
    sourceError.value = t(missingRefusal(cvMode.value))
    step.value = 0
    nextTick(() => cvSourceButton.value?.focus())
    return true
  }
  return false
}
/**
 * A CV refused for its files is said beside the upload area, and one refused
 * for a LinkedIn link under the description, with the steps; never in the
 * banner at the top. The server's words are used when it gives them, except
 * for the link, whose steps are drawn here.
 */
const CV_FILE_REFUSALS: Record<string, (mode: CvSource) => string> = {
  cv_file_required: missingRefusal,
  cv_file_unreadable: () => 'studioCvUnreadable',
  cv_file_kind: kindRefusal,
  // More pages in all than one CV is made from (or more text than it reads).
  generation_limit: () => 'studioCvFilesTooLong',
  // A file kept past its hours, on a CV opened again whose files changed.
  file_unavailable: () => 'studioCvFileGone',
}
/** Refusals said in this page's words: the server's are about any document, not a CV's files. */
const OWN_REFUSALS = ['generation_limit', 'file_unavailable']
/** A source file the server no longer keeps, as it said when the file was read back. */
const sourceGone = (file: any) =>
  (!!file?.state && file.state !== 'ready') || (!!file?.expires_at && Date.parse(file.expires_at) <= Date.now())
/**
 * Whether a `file_unavailable` is the CV's files', not its portrait's or a
 * logo's: one of its files is known to be gone, or it has no other file.
 */
function cvFilesGone(e: any) {
  if (e?.data?.error?.code !== 'file_unavailable' || !isCv.value || !cvFileForm.value) return false
  return (
    cvSourceFiles.value.some(sourceGone) ||
    (!!cvSourceFiles.value.length && !form.options.portrait_asset_id && !form.options.branding?.logo_asset_id)
  )
}
function cvRefused(e: any): '' | 'source' | 'link' {
  const refusal = e?.data?.error
  if (!isCv.value || !refusal) return ''
  if (refusal.code === 'cv_linkedin_link') {
    cvLinkError.value = t('studioCvLinkRefused')
    step.value = 0
    return 'link'
  }
  const local = CV_FILE_REFUSALS[refusal.code]
  // Without an upload area in view (a description, a change), the banner says it.
  if (!local || !cvFileForm.value) return ''
  if (refusal.code === 'file_unavailable') {
    if (!cvFilesGone(e)) return ''
    // Named when it is known which: the chips keep every file's name.
    const gone = cvSourceFiles.value.filter(sourceGone).map((file) => file.name)
    sourceError.value = `${gone.length ? `${gone.join(', ')}: ` : ''}${t('studioCvFileGone')}`
  } else
    sourceError.value =
      (!OWN_REFUSALS.includes(refusal.code) && refusal.message) || t(local(cvMode.value), { pages: cvMaxPages.value })
  step.value = 0
  return 'source'
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
  // A source file known to be gone is what the server could not find: the photo stays.
  if (cvFilesGone(e)) return false
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
/** The required facts a refusal says a CV lacks: listed by `cv_missing`; an older server asks for the name alone. */
function missingFacts(refusal: any): string[] {
  if (refusal?.code === 'cv_name_required') return ['name']
  const listed = refusal?.code === 'cv_missing' ? refusal.message_params?.missing : null
  return factList(listed).filter((key) => cvFacts.value.required.includes(key))
}
function promptRefused(e: any) {
  const refusal = e?.data?.error
  // A CV is refused for the facts it lacks, as the others are for a topic.
  if (!['topic_required', 'convert_requested', 'cv_missing', 'cv_name_required'].includes(refusal?.code))
    return false
  cvMissing.value = missingFacts(refusal)
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
  cvLinkError.value = ''
  cvMissing.value = []
})
/**
 * Another way to start is another CV: what was said about the last one's
 * files, its link or its missing name is about that one. The quote is the
 * last mode's too.
 */
watch(cvMode, () => {
  sourceError.value = ''
  cvLinkError.value = ''
  cvMissing.value = []
  cvWaiting.value = false
  if (isCv.value) {
    promptError.value = ''
    topicGiven.value = false
  }
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
    cvMissing.value = []
    // A CV needs its facts, not a topic, so a refusal does not carry across to or
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
  let cv: '' | 'source' | 'link' = ''
  let reading = false
  try {
    await fn()
  } catch (e) {
    reading = readingRefused(e)
    photo = !reading && photoRefused(e)
    cv = photo || reading ? '' : cvRefused(e)
    refused = !reading && !photo && !cv && promptRefused(e)
    refusedRun = refused ? () => run(task, fn) : null
    if (!reading && !refused && !photo && !cv) error.value = requestError(e)
  } finally {
    busy.value = ''
  }
  // The fix is typed in the description, so focus goes there once the form is
  // enabled again; the field's own description reads the refusal out.
  if (refused || cv === 'link') {
    await nextTick()
    promptInput.value?.focus()
  } else if (cv === 'source') {
    // The upload button, whose description is the refusal, beside the files.
    await nextTick()
    cvSourceButton.value?.focus()
  } else if (photo) {
    // The photo's button, whose description is the refusal, beside the field.
    await nextTick()
    portraitButton.value?.focus()
  } else if (reading) {
    // Review, which now says the files are being read and how many are ahead.
    await nextTick()
    reviewButton.value?.focus()
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
      const sources = await Promise.all(
        (draft.value.source_ids || []).map((id: string) => ws.api(`/files/${id}`)),
      )
      // A CV's files are its mode's, shown under its choice; a document's are its sources.
      if (isCv.value) {
        const mode = draft.value.options?.cv_source
        cvSource.value = CV_SOURCES.includes(mode) ? mode : 'text'
        cvFiles.linkedin = cvSource.value === 'linkedin' ? sources : []
        cvFiles.file = cvSource.value === 'file' ? sources : []
        files.value = []
        // Their chips say they were read, and how many pages.
        if (cvFileForm.value) cvReads.refresh(sources.map((file: any) => file.id))
      } else files.value = sources
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
      cvSource.value = 'text'
      // A new CV starts with no files: what the last one's were still in line for is not read.
      cvReads.cancel(cvFileIds())
      cvFiles.linkedin = []
      cvFiles.file = []
      cvWaiting.value = false
      sourceError.value = ''
      cvLinkError.value = ''
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
        // A CV made from files may have no notes, and a service's name is none.
        prompt: form.prompt.trim() || (cvFromFiles.value ? '' : name(form.feature_id, selected.value?.name)),
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
  sourceError.value = ''
  cvLinkError.value = ''
  if (cvStopsBeforeSending() || cvWaiting.value) return
  cvReads.cancel(unsentCvFileIds())
  if (cvFileForm.value && cvReads.pending.value) return waitForReads()
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
watch([cvSource, () => cvFiles.linkedin, () => cvFiles.file], invalidateQuote, { flush: 'sync' })
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
              <!-- A CV starts with where it is made from: native radios, so arrows move between them. -->
              <fieldset
                v-if="isCv && !revising && cvModes.length > 1"
                ref="cvSourceChoice"
                class="cv-source-choice"
                data-testid="studio-cv-source"
              >
                <legend>{{ t('studioCvStartFrom') }}</legend>
                <div class="cv-source-options">
                  <label
                    v-for="mode in cvModes"
                    :key="mode"
                    class="cv-source-option"
                    :class="{ selected: cvMode === mode }"
                    :data-testid="`studio-cv-source-${mode}`"
                    ><input v-model="cvSource" type="radio" name="studio-cv-source" :value="mode" /><AppIcon
                      :name="CV_SOURCE_ICONS[mode]"
                      :size="20"
                    /><span
                      ><strong>{{ t(CV_SOURCE_CHOICES[mode][0]) }}</strong
                      ><small>{{ t(CV_SOURCE_CHOICES[mode][1]) }}</small></span
                    ><AppIcon v-if="cvMode === mode" name="check" :size="17" class="cv-source-check"
                  /></label>
                </div>
              </fieldset>
              <template v-if="cvFileForm">
                <section
                  v-if="cvMode === 'linkedin'"
                  class="cv-linkedin-steps"
                  aria-labelledby="studio-cv-linkedin-steps"
                  data-testid="studio-cv-linkedin-steps"
                >
                  <h3 id="studio-cv-linkedin-steps">{{ t('studioCvLinkedinSteps') }}</h3>
                  <ol>
                    <li v-for="key in LINKEDIN_STEPS" :key="key">{{ t(key) }}</li>
                  </ol>
                  <p>{{ t('studioCvLinkedinNoLinks') }}</p>
                </section>
                <div class="cv-source-block">
                  <div class="studio-source cv-source-upload">
                    <div>
                      <h3>{{ t(cvMode === 'linkedin' ? 'studioCvLinkedinFiles' : 'studioCvOldFiles') }}</h3>
                      <p>
                        {{
                          t(cvMode === 'linkedin' ? 'studioCvLinkedinFilesHint' : 'studioCvOldFilesHint', {
                            max: cvMaxFiles,
                            pages: cvMaxPages,
                          })
                        }}
                      </p>
                    </div>
                    <button
                      ref="cvSourceButton"
                      type="button"
                      class="button secondary"
                      data-testid="studio-cv-source-button"
                      :disabled="!!busy || submissionPending || cvSourceFiles.length >= cvMaxFiles"
                      :aria-describedby="sourceError ? 'studio-cv-source-error' : undefined"
                      @click="cvSourceInput?.click()"
                    >
                      <AppIcon name="upload" :size="17" />{{ t(cvSourceFiles.length ? 'addMore' : 'upload') }}</button
                    ><input
                      ref="cvSourceInput"
                      type="file"
                      multiple
                      class="visually-hidden"
                      :accept="cvAccept(cvKinds)"
                      data-testid="studio-cv-source-input"
                      :aria-label="t(cvMode === 'linkedin' ? 'studioCvLinkedinFiles' : 'studioCvOldFiles')"
                      @change="uploadCvSources(($event.target as HTMLInputElement).files)"
                    />
                  </div>
                  <!-- An alert: a refusal made before anything is sent, or of one file in a batch, leaves the focus where it was. -->
                  <div
                    v-if="sourceError"
                    class="field-error cv-source-error"
                    role="alert"
                    data-testid="studio-cv-source-error"
                  >
                    <AppIcon name="alert" :size="17" /><span id="studio-cv-source-error">{{ sourceError }}</span>
                  </div>
                  <ul
                    v-if="cvSourceFiles.length"
                    ref="cvSourceList"
                    class="cv-source-list"
                    data-testid="studio-cv-source-files"
                  >
                    <li
                      v-for="file in cvSourceFiles"
                      :key="file.id"
                      class="source-chip cv-source-chip"
                      :data-read="cvReadState(file)"
                    >
                      <AppIcon :name="sourceIcon(file)" :size="17" /><span class="cv-source-text"
                        ><span class="cv-source-name">{{ file.name }}</span
                        ><!-- Where its read is: one line of its own, so a change of state moves nothing. --><small
                          v-if="readLabel(file)"
                          class="cv-read-state"
                          data-testid="studio-cv-read-state"
                          ><AppIcon
                            :name="READ_ICONS[cvReadState(file)!] || 'clock'"
                            :size="13"
                            :class="{ spin: cvReadState(file) === 'reading' }"
                          />{{ readLabel(file) }}</small
                        ></span
                      ><button
                        type="button"
                        class="icon-button"
                        :aria-label="`${t('remove')}: ${file.name}`"
                        @click="removeCvSource(file.id)"
                      >
                        <AppIcon name="x" :size="15" />
                      </button>
                    </li>
                  </ul>
                </div>
              </template>
              <!-- What a CV needs, ticked as it is typed. A section of its own, never inside the label below. -->
              <section
                v-if="isCv && !revising"
                class="cv-needs"
                aria-labelledby="studio-cv-needs"
                data-testid="studio-cv-needs"
              >
                <h3 id="studio-cv-needs">{{ t('studioCvNeedsTitle') }}</h3>
                <p v-if="cvFromFiles" class="cv-needs-files" data-testid="studio-cv-needs-files">
                  {{ t('studioCvNeedsFiles') }}
                </p>
                <template v-else>
                  <p id="studio-cv-required" class="cv-needs-label">{{ t('studioCvNeedsRequired') }}</p>
                  <ul
                    class="cv-needs-list"
                    aria-labelledby="studio-cv-required"
                    data-testid="studio-cv-needs-required"
                  >
                    <li
                      v-for="key in cvFacts.required"
                      :key="key"
                      class="cv-needs-row"
                      :class="{ done: cvDone(key) }"
                      :data-testid="`studio-cv-need-${key}`"
                      :data-done="cvDone(key)"
                    >
                      <AppIcon :name="cvDone(key) ? 'check' : 'circle'" :size="16" /><span>{{
                        capital(factName(key))
                      }}</span
                      ><span class="visually-hidden"
                        >({{ t(cvDone(key) ? 'studioCvNeedsDone' : 'studioCvNeedsMissing') }})</span
                      >
                    </li>
                  </ul>
                </template>
                <p class="cv-needs-optional" data-testid="studio-cv-needs-optional">{{ cvOptional }}</p>
              </section>
              <label class="form-field studio-primary-field" :class="{ 'cv-notes-field': cvFileForm }">
                <span>{{ t(revising ? 'reviseLabel' : cvFileForm ? 'studioCvNotes' : 'studioDescribe') }}</span>
                <textarea
                  ref="promptInput"
                  v-model="form.prompt"
                  data-testid="studio-primary-input"
                  @input="delete form.options.pages"
                  :rows="cvFileForm ? 4 : 7"
                  :maxlength="studio.config.value?.limits?.source_chars || 12000"
                  :placeholder="t(promptPlaceholder)"
                  :aria-invalid="promptError || cvLinkError ? 'true' : undefined"
                  :aria-describedby="
                    promptError
                      ? cvMissing.length
                        ? 'studio-prompt-error studio-cv-missing'
                        : 'studio-prompt-error'
                      : cvLinkError
                        ? 'studio-cv-link-error'
                        : suggestedService
                          ? 'studio-service-hint'
                          : undefined
                  "
                />
                <small data-testid="studio-describe-hint">{{
                  revising
                    ? t(isCv ? 'reviseExamplesCv' : 'reviseExamples')
                    : isCv
                      ? t(cvFromFiles ? 'studioCvNotesHint' : 'studioCvDescribeHint')
                      : t('studioDescribeHint', { pages: defaultPages, max: maxPages })
                }}</small>
              </label>
              <!-- A bare LinkedIn link: the steps to send the profile, where the link was typed. -->
              <div v-if="cvLinkError" class="field-error cv-link-error" data-testid="studio-cv-link-error">
                <AppIcon name="alert" :size="17" /><span id="studio-cv-link-error">{{ cvLinkError }}</span>
                <ol data-testid="studio-cv-link-steps">
                  <li v-for="key in LINKEDIN_STEPS" :key="key">{{ t(key) }}</li>
                </ol>
                <button
                  v-if="cvMode !== 'linkedin' && cvModes.includes('linkedin')"
                  type="button"
                  class="button secondary small"
                  data-testid="studio-cv-use-linkedin"
                  @click="chooseLinkedin"
                >
                  {{ t('studioCvUseLinkedin') }}
                </button>
              </div>
              <!-- Outside the label: a button inside one would be part of its name. -->
              <div
                v-if="promptError"
                class="field-error"
                :class="{ 'cv-missing-error': cvMissing.length }"
                data-testid="studio-prompt-error"
              >
                <AppIcon name="alert" :size="17" /><span id="studio-prompt-error">{{
                  cvMissing.length ? t('studioCvMissingLead') : promptError
                }}</span>
                <!-- A CV refused for what it lacks: each fact, with an example of how to give it. -->
                <ol v-if="cvMissing.length" id="studio-cv-missing" data-testid="studio-cv-missing">
                  <li v-for="key in cvMissing" :key="key">
                    <strong>{{ capital(factName(key)) }}</strong
                    ><template v-if="hasExample(key)"> — {{ t(`${factKey(key)}Example`) }}</template>
                  </li>
                </ol>
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
              <div v-if="!revising && !cvFromFiles" class="studio-examples">
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
                    <!-- The files above are read, never used as the portrait. -->
                    <p v-if="cvFileForm" data-testid="studio-cv-photo-separate">
                      {{ t('studioCvPhotoSeparate') }}
                    </p>
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
              <!-- The files' reads, told to a screen reader as they finish; the chips and Review show them. -->
              <p
                v-if="isCv && cvFromFiles"
                class="visually-hidden"
                role="status"
                aria-live="polite"
                data-testid="studio-cv-read-status"
              >
                <span>{{ cvReadWait }}</span> <span>{{ cvReadProgress }}</span>
              </p>
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
                <!-- Waiting for the files' reads it stays in reach (the wait is its name), and does nothing more. -->
                <button
                  ref="reviewButton"
                  class="button primary"
                  :class="{ 'studio-review-waiting': cvWaiting && !busy }"
                  data-testid="studio-review"
                  :disabled="!!busy || !canUseTool || !hasEssentialInput"
                  :aria-disabled="cvWaiting && !busy ? 'true' : undefined"
                  @click="review"
                >
                  <template v-if="cvWaiting && !busy"
                    ><AppIcon name="loader" :size="17" class="spin" />{{ reviewWaitLabel }}</template
                  >
                  <template v-else
                    >{{ busy ? t('working') : t('studioReviewStep') }}<AppIcon name="right" :size="17"
                  /></template>
                </button>
              </div>
              <p class="field-hint studio-charge-hint" data-testid="studio-charge-hint">
                {{ cvWaiting && !busy ? cvWaitHint : t('noChargeBefore') }}
              </p>
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
              <!-- What the CV is made from: the way it was started, and its files by name. -->
              <div class="meter-row studio-cv-row" data-testid="studio-cv-source-row">
                <span>{{ t('studioCvSource') }}</span><strong>{{ cvSourceLabel }}</strong>
              </div>
              <ul v-if="cvSourceFiles.length" class="studio-cv-files" data-testid="studio-cv-source-names">
                <li v-for="file in cvSourceFiles" :key="file.id">
                  <AppIcon :name="sourceIcon(file)" :size="15" /><span>{{ file.name }}</span>
                </li>
              </ul>
              <!-- Files, or pages of them, the server could not read: said, never left out unsaid. -->
              <p v-if="cvUnread" class="field-hint studio-cv-unread" role="status" data-testid="studio-cv-unread">
                <AppIcon name="alert" :size="15" />{{ t('studioCvUnread', { what: cvUnread }) }}
              </p>
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
              <!-- What the CV lacks, or could still have, and the server says: nothing to do first. -->
              <div v-if="cvCanAdd.length" class="studio-cv-can-add" data-testid="studio-cv-can-add">
                <span>{{ t('studioCvCanAdd') }}</span
                ><small>{{ cvCanAdd.join(' · ') }}</small>
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
