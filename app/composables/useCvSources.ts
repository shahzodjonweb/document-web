/**
 * Where a CV starts from, chosen first in Create with AI: a description typed
 * in the form (`text`), the customer's LinkedIn profile as LinkedIn's own
 * Save to PDF or as screenshots (`linkedin`), or an old CV (`file`). In the
 * last two the description is notes on top of the files: the job wanted now,
 * what to change, what to add. The files are read for their text (or by OCR)
 * and never used as the portrait, which has its own control.
 */
export type CvSource = 'text' | 'linkedin' | 'file'
export type CvFileSource = Exclude<CvSource, 'text'>
export const CV_SOURCES: CvSource[] = ['text', 'linkedin', 'file']
/** What each mode reads when the server does not list it (GET studio/config `source_kinds`). */
export const CV_SOURCE_KINDS: Record<CvFileSource, string[]> = {
  linkedin: ['pdf', 'image'],
  file: ['pdf', 'docx', 'image'],
}
/** Most files one CV is made from, when the server does not say (`max_source_files`). */
export const CV_SOURCE_FILES = 10
/** Most pages all of a CV's files may have together, when the server does not say (`max_source_pages`). */
export const CV_SOURCE_PAGES = 30
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const ACCEPT: Record<string, string> = {
  pdf: '.pdf,application/pdf',
  docx: `.docx,${DOCX}`,
  image: '.jpg,.jpeg,.png,image/jpeg,image/png',
}
/** The file input's `accept` for these kinds. */
export const cvAccept = (kinds: string[]) =>
  kinds
    .map((kind) => ACCEPT[kind])
    .filter(Boolean)
    .join(',')
const KIND_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  [DOCX]: 'docx',
  'image/jpeg': 'image',
  'image/png': 'image',
}
const KIND_BY_EXTENSION: Record<string, string> = {
  pdf: 'pdf',
  docx: 'docx',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
}
/** The extension each type is uploaded with: the server tells files apart by it. */
const EXTENSION: Record<string, string> = {
  'application/pdf': '.pdf',
  [DOCX]: '.docx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
}
const extensionOf = (name = '') => /\.([^./\\]+)$/.exec(name)?.[1]?.toLowerCase() || ''

/**
 * `pdf`, `docx` or `image` (a JPG or PNG), by the name's extension or else the
 * type the browser gives; '' for anything else. An old Word `.doc` is not
 * read, nor is a HEIC photo (a phone sends its photos as JPEG when the picker
 * asks for one).
 */
export function cvFileKind(file: { name?: string; type?: string; mime_type?: string }) {
  return (
    KIND_BY_EXTENSION[extensionOf(file.name)] ||
    KIND_BY_TYPE[String(file.type || file.mime_type || '').toLowerCase()] ||
    ''
  )
}

/**
 * The file as it is uploaded. One whose name has no extension the server
 * knows (some phone pickers name a screenshot without one) is given the one
 * its type says, since the server reads the kind from the name.
 */
export function withExtension(file: File) {
  if (KIND_BY_EXTENSION[extensionOf(file.name)]) return file
  const extension = EXTENSION[file.type.toLowerCase()]
  return extension ? new File([file], `${file.name || 'file'}${extension}`, { type: file.type }) : file
}

// A LinkedIn profile's address, as the server reads one (apps/studio/cv/sources.py
// LINKEDIN_LINK): linkedin.com/in/…, an older /pub/ or /profile/ one, or a lnkd.in short link.
const LINKEDIN_PROFILE = /(?:https?:\/\/)?(?:[\w-]+\.)?(?:linkedin\.com\/(?:in|pub|profile)\/|lnkd\.in\/)[^\s<>]*/giu
// What makes a fact to put on a CV, as the server reads one (apps/studio/cv/content.py
// EMAIL, PHONE, YEAR): an email, a phone number, a year.
const EMAIL = /[\p{L}\p{N}_.+\-']+@[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+/u
const PHONE = /\+?\p{Nd}[\p{Nd} \t().-]{5,}\p{Nd}/u
const YEAR = /(?<!\p{Nd})(?:19|20)\p{Nd}{2}(?!\p{Nd})/u
// A word as the server counts one: letters only (Python's [^\W\d_]+).
const WORD = /[\p{L}\p{Nl}\p{No}]+/gu
/**
 * The words people ask with, greet with and point at their profile with, in
 * English, Uzbek and Russian. None of them is a fact about the person. The
 * same words as the server's ASKING (apps/studio/cv/sources.py), and never
 * one more: a word only this side took for asking would stop a description
 * the server makes a CV of.
 */
const ASKING = new Set(
  [
    'hello hi here is my the a an at from for me it please make create professional good cv resume profile link page',
    'thank thanks you very much this',
    'assalomu alaykum salom mana mening shu shundan menga yaxshi rezyume profil profilim havola qilib bering iltimos',
    'tayyorlab rahmat',
    'здравствуйте привет вот ссылка на мой моя мне профиль в из него по моему сделайте сделать составьте пожалуйста',
    'резюме спасибо',
  ]
    .join(' ')
    .split(' '),
)

/**
 * A description that is a LinkedIn profile's link and no fact about the
 * person: a bare link, or one in a request ("Здравствуйте, вот ссылка на мой
 * профиль, сделайте резюме: …", "Please make my CV from my profile at …").
 * LinkedIn shows profiles only to people signed in, so the server cannot read
 * one: the way is LinkedIn's own Save to PDF. Any other word, an email, a
 * phone number or a year is a fact, however short the description ("Ali
 * Valiyev, SMM manager. linkedin.com/in/…"), and it is sent.
 *
 * The server's rule (sources.linkedin_link_only) also takes the person's name
 * out before it reads the words. A name is not looked for here: its words are
 * no asking words, so a description with one goes to the server, which says
 * the same (`cv_linkedin_link`) when nothing but the name is left. So this
 * stops only what the server would refuse.
 */
export function linkedinLinkOnly(text: string) {
  const value = String(text || '')
  if (!value.match(LINKEDIN_PROFILE)) return false
  const rest = value.replace(LINKEDIN_PROFILE, ' ')
  if (EMAIL.test(rest) || PHONE.test(rest) || YEAR.test(rest)) return false
  return (rest.match(WORD) || [])
    .map((word) => word.toLowerCase())
    .every((word) => word === 'linkedin' || ASKING.has(word))
}

/**
 * How far the server has got reading one of a CV's files. Each file uploaded
 * for a CV is put in line to be read (`cv_read` on the upload), and the line
 * takes turns between customers; a CV draft is made only from what was read,
 * so it waits until every file is read, or could not be (`failed`, or
 * `done` with no page of text: said on the review as not read).
 */
export type CvReadStatus = 'queued' | 'reading' | 'done' | 'failed'
export interface CvRead {
  status: CvReadStatus
  /** Reads that will be done before this one: 0 once it is next or being read. */
  ahead: number
  /** Pages read from the file, and how many of those by OCR, once it is read. */
  pages?: number | null
  ocr_pages?: number | null
  error?: string | null
}
const UNFINISHED: CvReadStatus[] = ['queued', 'reading']
/** In line or being read: the draft waits for it. */
export const cvReadUnfinished = (read?: CvRead | null) => !!read && UNFINISHED.includes(read.status)
/**
 * Not read: the server could not read the file (`failed`), or read it and
 * found no text in it (`done` with no page read), as in a blank photo. The
 * draft has nothing from it either way, and the review says so. A read whose
 * pages are not known yet (an upload's answer) is not this.
 */
export const cvReadFailed = (read?: CvRead | null) =>
  !!read && (read.status === 'failed' || (read.status === 'done' && read.pages === 0))
/** How a read is shown: as the server says it, except that a file read with no text in it was not read. */
export const cvReadShown = (read?: CvRead | null): CvReadStatus | undefined =>
  cvReadFailed(read) ? 'failed' : read?.status
/** How often the reads are asked after while one is unfinished, and the longest wait after failures. */
const CV_READ_POLL_MS = 2000
const CV_READ_BACKOFF_MS = 30000
/** Most files one request names: as many as one CV is made from. */
const CV_READ_IDS = CV_SOURCE_FILES
const statusOf = (e: any) => e?.statusCode || e?.status || e?.response?.status
const readQuery = (list: string[]) => list.map((id) => `ids=${encodeURIComponent(id)}`).join('&')

/**
 * The reads of a CV's files (`ids`), asked after (GET studio/cv-reads) every
 * two seconds while one is unfinished, `active` holds (a file mode is chosen)
 * and the page is in view; never otherwise, and never once the page is gone.
 * A request that fails waits twice as long each time, up to 30 seconds.
 *
 * A file the server answers 404 for is no longer there (or never was the
 * customer's): what its read was is forgotten, so nothing waits for it, and
 * the draft is left to the server, which says what is wrong with the file.
 */
export function useCvReads(ids: () => string[], active: () => boolean) {
  const ws = useWorkspace()
  const reads = ref<Record<string, CvRead>>({})
  /** Reads ahead of the last of these files, and about how long until it is read (null: not known). */
  const ahead = ref(0)
  const estimate = ref<number | null>(null)
  // Files the server says are not read yet, before it has said how far each one is.
  const expected = ref<string[]>([])
  // Files asked after once although read already: their pages, on the next request.
  let extra: string[] = []
  const unfinished = computed(() =>
    ids().filter((id) => cvReadUnfinished(reads.value[id]) || expected.value.includes(id)),
  )
  const pending = computed(() => unfinished.value.length > 0)
  let timer: ReturnType<typeof setTimeout> | undefined
  let asking = false
  let failures = 0
  // Times the server said "still reading" and the reads then said done: asked
  // more slowly each time it happens again, so the two never loop.
  let contradictions = 0
  let mounted = true
  const backoff = (times: number) => Math.min(CV_READ_POLL_MS * 2 ** times, CV_READ_BACKOFF_MS)
  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'
  function stop() {
    if (timer) clearTimeout(timer)
    timer = undefined
  }
  function schedule(delay = CV_READ_POLL_MS) {
    stop()
    if (!mounted || asking || !active() || hidden()) return
    const wanted = new Set(ids())
    if (!pending.value && !extra.some((id) => wanted.has(id))) return
    timer = setTimeout(poll, failures ? backoff(failures) : delay)
  }
  async function poll() {
    timer = undefined
    const wanted = new Set(ids())
    const list = [...new Set([...unfinished.value, ...extra.filter((id) => wanted.has(id))])]
    extra = []
    if (!list.length) return
    asking = true
    try {
      // No automatic retry: $fetch asks a GET again at once on a 429, doubling
      // the requests that made it; the next poll, two seconds on, is the retry.
      const answer: any = await ws.api(`/studio/cv-reads?${readQuery(list)}`, { retry: 0 })
      failures = 0
      const next = { ...reads.value }
      for (const read of answer?.reads || [])
        if (read?.asset_id && read.status)
          next[String(read.asset_id)] = { ...read, ahead: Number(read.ahead) || 0 }
      reads.value = next
      if (list.some((id) => cvReadUnfinished(next[id]))) contradictions = 0
      else if (list.some((id) => expected.value.includes(id))) contradictions += 1
      expected.value = expected.value.filter((id) => !list.includes(id))
      ahead.value = Number(answer?.ahead) || 0
      estimate.value = Number.isFinite(answer?.estimated_seconds) ? answer.estimated_seconds : null
    } catch (e) {
      failures += 1
      if (statusOf(e) === 404) {
        const next = { ...reads.value }
        for (const id of list) delete next[id]
        reads.value = next
        expected.value = expected.value.filter((id) => !list.includes(id))
      }
    } finally {
      asking = false
    }
    sendCancels()
    schedule()
  }
  // Reads to take out of the line once no request asks after them: one asked
  // after while it is taken out could be put back in line by that request.
  let cancelling: string[] = []
  function sendCancels() {
    const list = [...new Set(cancelling)]
    cancelling = []
    for (let start = 0; start < list.length; start += CV_READ_IDS)
      ws.api(`/studio/cv-reads?${readQuery(list.slice(start, start + CV_READ_IDS))}`, { method: 'DELETE' })
        // The line is shorter now: the files still in it say so at once.
        .then(() => mounted && pending.value && refresh())
        // A server without the queue, or a file gone: nothing was in line for it.
        .catch(() => {})
  }
  /**
   * Files taken off the form (a chip removed, the page left), or not sent with
   * the CV (another way to start's): a read of theirs still in line is taken
   * out of it (DELETE studio/cv-reads), so neither the customer's other files
   * nor anyone else's wait for it. One being read finishes. The file itself
   * stays, since a saved draft may list it, and what was known of its read is
   * kept: a file shown again is asked after, and the server puts it back in line.
   */
  function cancel(list: string[]) {
    cancelling.push(
      ...list.filter((id) => reads.value[id]?.status === 'queued' || expected.value.includes(id)),
    )
    if (!asking) sendCancels()
  }
  /** A read as the upload said it. One read already is asked after once, for its pages. */
  function take(id: string, read?: CvRead | null) {
    if (!read?.status) return
    reads.value = { ...reads.value, [id]: { ...read, ahead: Number(read.ahead) || 0 } }
    const known = ids().map((key) => reads.value[key])
    ahead.value = Math.max(0, ...known.map((entry) => (cvReadUnfinished(entry) ? entry!.ahead : 0)))
    if (!cvReadUnfinished(read) && read.pages == null) extra.push(id)
  }
  /** The server said these files are still being read (`cv_reading`): they are asked after now. */
  function expect(list: string[], params: Record<string, any> = {}) {
    expected.value = [...new Set([...expected.value, ...list])]
    if (Number.isFinite(params.ahead)) ahead.value = params.ahead
    if (Number.isFinite(params.estimated_seconds)) estimate.value = params.estimated_seconds
    if (!asking) schedule(contradictions > 1 ? backoff(contradictions) : 0)
  }
  /** Asks after these files now (or the unfinished ones), when nothing is being asked already. */
  function refresh(list: string[] = []) {
    extra.push(...list)
    if (!asking) schedule(0)
  }
  watch([pending, active], ([nowPending, nowActive], [, wasActive]) => {
    if (!nowActive || !nowPending) stop()
    // Back in view of a file mode: asked at once, since the line has moved meanwhile.
    if (!timer && !asking) schedule(nowActive && !wasActive ? 0 : CV_READ_POLL_MS)
  })
  const onVisibility = () => (hidden() ? stop() : asking || schedule(0))
  onMounted(() => document.addEventListener('visibilitychange', onVisibility))
  onBeforeUnmount(() => {
    mounted = false
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
  })
  return { reads, ahead, estimate, pending, take, expect, refresh, cancel }
}
