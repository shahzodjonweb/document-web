import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'

// Every API request is intercepted; this verifies browser behavior without any
// live customer writes or paid generation calls.
const origin = process.env.STUDIO_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(
  ['127.0.0.1', 'localhost'].includes(new URL(origin).hostname),
  'Use the local web server for this fixture test',
)
const output = path.resolve(process.env.STUDIO_ARTIFACT_DIR || '../studio-review/simple-forms')
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
})
const page = await context.newPage()
page.setDefaultTimeout(10000)
page.setDefaultNavigationTimeout(15000)
const errors = [],
  checks = [],
  requests = [],
  unexpected = [],
  external = []
const drafts = new Map(),
  quotes = new Map(),
  jobs = new Map(),
  idempotentJobs = new Map()
let sequence = 0
let affordable = true
// This week's AI documents, as /usage and every generation quote report them.
const week = { starts_at: '2026-10-11T19:00:00Z', resets_at: '2026-10-18T19:00:00Z', time_zone: 'Asia/Tashkent' }
const weekUsage = () => ({
  ai_documents: affordable ? { limit: 5, used: 2, remaining: 3 } : { limit: 5, used: 5, remaining: 0 },
  file_jobs: { limit: 15, used: 0, remaining: 15 },
  edits_per_file: 3,
  resets_at: week.resets_at,
})
let expiredFile = false
let visualChecks = 0
let failJobOnce = false
let expireJobOnce = false
let clampPages = 0
// A new description that names no topic is refused by the server, which says
// which other service it asked for, if any. Synthetic prompts only.
const topicless = new Map([
  ['Make bright slides.', 'ai.pptx'],
  ['Make it 12 pages long.', ''],
  ['Convert this to PDF.', 'convert'],
])
const convertRefusal = 'To convert a file, open All tools and choose a converter.'
const topicRefusal = {
  en: 'Write what the document should be about.',
  uz: 'Hujjat nima haqida bo‘lishini yozing.',
  ru: 'Напишите, о чём должен быть документ.',
}
const id = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
const future = () => new Date(Date.now() + 300000).toISOString()
const featureIds = ['ai.pdf_topic', 'ai.pptx']
// Every service the Studio offers: the two above, and a CV.
const serviceIds = [...featureIds, 'ai.cv']
const account = {
  id: '00000000-0000-4000-8000-999999999999',
  display_name: 'Fixture Reader',
  locale: 'en',
  time_zone: 'UTC',
  mode: 'general',
  plan: 'free',
  preferences: {},
  login_methods: { email: true, google: false, telegram: false },
}
const config = {
  provider: { mode: 'openai', configured: true },
  // As the server sends them: 10 when the description names no count, and one
  // ceiling per service that every plan shares.
  default_pages: 10,
  features: serviceIds.map((feature) => ({
    id: feature,
    name: feature,
    surface: 'generate',
    eligible: true,
    requires_provider: false,
    parameter_schema: {
      output_locale: { enum: ['en', 'uz', 'ru'] },
      output_format: { enum: feature === 'ai.pptx' ? ['pptx'] : ['pdf'] },
    },
    // A CV is one or two pages, and never has stock photos. It starts from a
    // description, a LinkedIn profile's PDF or screenshots, or an old CV.
    max_pages: feature === 'ai.pptx' ? 60 : feature === 'ai.cv' ? 2 : 35,
    ...(feature === 'ai.cv'
      ? {
          max_images: 0,
          source_modes: ['text', 'linkedin', 'file'],
          source_kinds: { linkedin: ['pdf', 'image'], file: ['pdf', 'docx', 'image'] },
          max_source_files: 10,
        }
      : {}),
    locales: ['en', 'uz', 'ru'],
  })),
  limits: { sections: 10, slides: 20, questions: 5, source_chars: 12000 },
}
const sourceDraft = {
  id: '00000000-0000-4000-8000-777777777777',
  feature_id: 'ai.pptx',
  version: 3,
  title: 'Reviewed fixture presentation',
  prompt: 'A reviewed source',
  source_text: '',
  source_ids: ['00000000-0000-4000-8000-888888888888'],
  output_locale: 'en',
  output_format: 'pptx',
  provider_mode: 'openai',
  options: { length: 2 },
  content: {
    title: 'Reviewed fixture presentation',
    sections: [
      { id: 's1', heading: 'First section', body: 'First reviewed paragraph.', notes: '' },
      { id: 's2', heading: 'Second section', body: 'Second reviewed paragraph.', notes: '' },
    ],
    questions: [],
    citations: [],
  },
  expires_at: future(),
}
drafts.set(sourceDraft.id, structuredClone(sourceDraft))
const authoredDrafts = featureIds.map((feature) => ({
  ...structuredClone(sourceDraft),
  id: id(),
  feature_id: feature,
  prompt: '',
  source_text: 'Original supplied paragraph, before the author reviewed it.',
  source_ids: [],
  output_format: feature === 'ai.pptx' ? 'pptx' : 'pdf',
}))
for (const draft of authoredDrafts) drafts.set(draft.id, draft)
// Server-seeded section copies, before a customer edits or generates them.
const seededDrafts = authoredDrafts.map((draft) => {
  const seeded = structuredClone(draft)
  seeded.id = id()
  seeded.prompt = 'Write a two-section report using the supplied material.'
  seeded.source_text = 'First source paragraph.\n\nSecond source paragraph.'
  seeded.content.sections = ['First source paragraph.', 'Second source paragraph.'].map((body, index) => ({
    id: `s${index + 1}`,
    heading: '',
    body,
    notes: '',
  }))
  return seeded
})
for (const draft of seededDrafts) drafts.set(draft.id, draft)

// The CV templates, as GET studio/cv-templates lists them (fictional sample).
const cvTemplate = (id, name, category, drawer, accent, extra = {}) => ({
  id,
  name,
  category,
  drawer,
  photo: false,
  tone: 'light',
  preview: `/api/v1/studio/cv-templates/${id}.png?locale=en&v=fixture`,
  fonts: { heading: 'serif', body: 'sans' },
  colours: { accent, secondary: '#B08D57', tint: '#FFFFFF', ink: '#1A1A1A', fill: accent },
  ...extra,
})
const cvCatalogue = {
  default: 'classic_navy',
  categories: [
    { id: 'classic', name: 'Classic', templates: [cvTemplate('classic_navy', 'Classic Navy', 'classic', 'column', '#1F3A68'), cvTemplate('charter', 'Charter', 'classic', 'column', '#14284B'), cvTemplate('oxford', 'Oxford', 'classic', 'timeline', '#0B3954')] },
    { id: 'modern', name: 'Modern', templates: [cvTemplate('azure_side', 'Azure Side', 'modern', 'sidebar_left', '#0F4C81', { photo: true })] },
    { id: 'academic', name: 'Academic & technical', templates: [cvTemplate('lab', 'Lab', 'academic', 'sidebar_left', '#01579B'), cvTemplate('syntax', 'Syntax', 'academic', 'compact', '#1F2937')] },
  ],
}
// A small A4-shaped PNG: a template's cover, and the portrait the CV pass uploads.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABUAAAAeCAIAAABMssICAAAAN0lEQVR42mOUt8pgoAAwMVAGRrp+xv///w9l97PAWSfPXSdem7mR5uDw/6j7R90/6v5R9w+U+wFRIC3rnHdRvQAAAABJRU5ErkJggg==',
  'base64',
)
const CV_SECTIONS = ['profile', 'experience', 'education', 'skills', 'languages', 'projects', 'certificates', 'extra']
const cvNameRefusal = 'Write your full name — the CV is made for you, so it has to say who you are.'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
// A CV made from files, as the server would answer for them (fictional people
// and files only): the person is read from the file unless its name says it
// names nobody, and a "blank" file has no text to read.
const cvFileRefusal = {
  cv_file_required: 'Add the file your CV is to be made from.',
  cv_file_unreadable: 'No text could be read from these files. Send a clearer photo or scan.',
  cv_file_kind: 'This kind of file cannot be used here.',
  cv_linkedin_link: 'LinkedIn links cannot be opened. Save your profile as a PDF and send it.',
}
const cvFilePerson = 'Malika Karimova'
// A kind refusal the server makes on the next CV draft write, as if it read the file differently.
let refuseCvKind = false
const assetKind = (asset) =>
  ({ 'application/pdf': 'pdf', [DOCX]: 'docx', 'image/png': 'image', 'image/jpeg': 'image' })[asset?.mime_type] || ''
/** A CV's source refusal, as apps/studio/domain.py decides it, or null. */
function cvSourceRefusal(body, prompt) {
  const mode = body.options?.cv_source || 'text'
  const ids = body.source_ids || []
  const refuse = (code) => ({ error: { code, message: cvFileRefusal[code] } })
  if (!['text', 'linkedin', 'file'].includes(mode)) return { error: { code: 'invalid_parameters', message: 'invalid' } }
  const linkOnly = /^\s*(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+\/?\s*$/i.test(prompt || '')
  const linkAsked = /linkedin\.com\/in\//i.test(prompt || '') && prompt.split(/\s+/).length < 16
  if (mode === 'text') {
    if (ids.length) return { error: { code: 'invalid_parameters', message: 'A description takes no files.' } }
    return linkOnly || linkAsked ? refuse('cv_linkedin_link') : null
  }
  if (!ids.length) return refuse(linkOnly || linkAsked ? 'cv_linkedin_link' : 'cv_file_required')
  const assets = ids.map((asset) => uploads.get(asset))
  const kinds = mode === 'linkedin' ? ['pdf', 'image'] : ['pdf', 'docx', 'image']
  if (refuseCvKind || assets.some((asset) => !kinds.includes(assetKind(asset)))) {
    refuseCvKind = false
    return refuse('cv_file_kind')
  }
  if (assets.every((asset) => /^blank/i.test(asset.name))) return refuse('cv_file_unreadable')
  return null
}
// Uploaded files by id, so an uploaded portrait reads back as itself.
const uploads = new Map()
// What the last uploaded image was, as the server would read it: its type,
// name, size in pixels and whether it still carried EXIF.
let uploadedImage = null
// A portrait the server refuses on the next draft write, by its error code.
let refusePortrait = ''
/** The uploaded file of a multipart body: its name, type and bytes. */
function multipartFile(buffer) {
  const text = buffer.toString('latin1')
  const head = /filename="([^"]*)"\r\nContent-Type: ([^\r]+)\r\n\r\n/i.exec(text)
  if (!head) return null
  const start = head.index + head[0].length
  const boundary = text.slice(0, text.indexOf('\r\n'))
  const end = text.indexOf(`\r\n${boundary}`, start)
  return { name: head[1], type: head[2], bytes: buffer.subarray(start, end) }
}
/** Width and height of a PNG or JPEG, and whether a JPEG has an EXIF block. */
function imageFacts(bytes) {
  if (bytes.subarray(1, 4).toString('latin1') === 'PNG')
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), exif: false }
  let exif = false
  for (let at = 2; at + 9 < bytes.length; ) {
    if (bytes[at] !== 0xff) return null
    const marker = bytes[at + 1]
    const length = bytes.readUInt16BE(at + 2)
    if (marker === 0xe1 && bytes.subarray(at + 4, at + 8).toString('latin1') === 'Exif') exif = true
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5), exif }
    at += 2 + length
  }
  return null
}
/** A JPEG with an EXIF block saying it is to be turned a quarter clockwise, as a phone stores a portrait. */
function withOrientation(jpeg, orientation) {
  const exif = Buffer.from([
    0xff, 0xe1, 0x00, 0x22, ...Buffer.from('Exif\0\0', 'latin1'),
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ])
  // After the JFIF block, which comes first.
  const after = 4 + jpeg.readUInt16BE(4)
  return Buffer.concat([jpeg.subarray(0, after), exif, jpeg.subarray(after)])
}
/**
 * A CV's options as the server keeps them: the template picked is in its style
 * (Auto has none until the CV is made), and a change keeps the CV's own style
 * and portrait unless another is picked or sent. The server takes the CV's
 * portrait back whenever a change sends none (apps/studio/cv/portrait.py).
 */
function cvOptions(options, source) {
  const picked = options?.cv_template && options.cv_template !== 'auto' ? options.cv_template : ''
  const kept = source?.options || {}
  const portrait = options?.portrait_asset_id || kept.portrait_asset_id
  const { portrait_asset_id, portrait_sha256, template_style, ...rest } = structuredClone(options || {})
  return {
    ...rest,
    length: CV_SECTIONS.length,
    template_style: picked ? { cv_template: picked } : structuredClone(kept.template_style || {}),
    ...(portrait ? { portrait_asset_id: portrait, portrait_sha256: `fixture-${portrait}` } : {}),
  }
}
const sourceContent = (fields, length) => ({
  title: fields.title,
  sections: Array.from({ length }, (_, index) => ({
    id: `s${index + 1}`,
    heading: `Section ${index + 1}`,
    body: index ? '' : fields.source_text || '',
    notes: '',
  })),
  questions: [],
  citations: [],
})
page.on('pageerror', (error) => errors.push(error.message))
await fs.mkdir(output, { recursive: true })
await context.route('**/*', (route) => {
  const url = new URL(route.request().url())
  if (url.origin === origin && url.pathname.startsWith('/api/')) {
    unexpected.push({ path: url.pathname, method: route.request().method() })
    return route.abort('blockedbyclient')
  }
  if (url.origin === origin || url.protocol === 'data:') return route.continue()
  if (url.hostname === 'telegram.org')
    return route.fulfill({ contentType: 'application/javascript', body: '' })
  external.push(url.origin)
  return route.abort('blockedbyclient')
})
await context.route(`${origin}/api/v1/**`, async (route) => {
  const request = route.request()
  const endpoint = new URL(request.url()).pathname.replace('/api/v1', '')
  const method = request.method()
  const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null
  requests.push({ path: endpoint, method, body, idempotencyKey: request.headers()['idempotency-key'] })
  const json = (value, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
  const failure = (code) => json({ error: { code, message: code } }, 409)
  if (endpoint === '/auth/session')
    return json({ user: account, development_login_enabled: false, csrf_token: 'fixture-csrf' })
  if (endpoint === '/auth/providers')
    return json({
      email: { enabled: true, configured: true },
      google: { enabled: false, configured: false },
      telegram: { enabled: false, configured: false },
      antibot: { enabled: false, configured: false, site_key: '', binding: '' },
    })
  if (endpoint === '/me') {
    if (method === 'PATCH') Object.assign(account, body)
    return json(account)
  }
  if (endpoint === '/catalog') return json({ features: [], draft: false })
  if (endpoint === '/plans') return json({ plans: [], draft: false })
  if (endpoint === '/usage') return json({ plan: 'free', week, ...weekUsage() })
  if (endpoint === '/studio/config') return json(config)
  if (endpoint === '/studio/cv-templates') return json(cvCatalogue)
  if (/^\/studio\/cv-templates\/[\w-]+\.png$/.test(endpoint))
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
  if (endpoint === '/files/uploads') {
    // The multipart body names the file's type: a portrait for a CV, else a PDF.
    const file = multipartFile(request.postDataBuffer() || Buffer.alloc(0))
    const image = /^image\/(png|jpeg)$/i.exec(file?.type || '')
    if (image) uploadedImage = { name: file.name, type: file.type, bytes: file.bytes.length, ...imageFacts(file.bytes) }
    // Word files keep their name and type, as a CV's old file; anything else is a PDF.
    const asset = image
      ? { id: id(), name: file.name, size_bytes: file.bytes.length, mime_type: `image/${image[1]}`, state: 'ready' }
      : /\.docx$/i.test(file?.name || '')
        ? { id: id(), name: file.name, size_bytes: file.bytes.length, page_count: 1, mime_type: DOCX, state: 'ready' }
        : { id: id(), name: file?.name || 'research-notes.pdf', size_bytes: 4096, page_count: 2, mime_type: 'application/pdf', state: 'ready' }
    uploads.set(asset.id, asset)
    return json(asset, 201)
  }
  if (uploads.has(endpoint.split('/')[2])) return json(uploads.get(endpoint.split('/')[2]))
  if (endpoint.startsWith('/files/'))
    return json({
      id: endpoint.split('/')[2],
      name: 'research-notes.pdf',
      size_bytes: 4096,
      page_count: 2,
      mime_type: 'application/pdf',
      // Retention answers 200 with an 'expired' state rather than a 404.
      state: expiredFile ? 'expired' : 'ready',
    })
  if (endpoint === '/generation/drafts' && method === 'GET') return json({ results: [...drafts.values()] })
  if (endpoint === '/generation/drafts' && method === 'POST') {
    // Only a new draft from a bare description is checked: never a change, a
    // file or pasted text. Nothing is created and nothing is counted.
    if (
      topicless.has(body.prompt) &&
      body.options?.topic_given !== true &&
      !body.options?.revise_draft_id &&
      !body.source_ids?.length &&
      !body.source_text
    ) {
      const asked = topicless.get(body.prompt)
      if (asked === 'convert')
        return json(
          {
            error: {
              code: 'convert_requested',
              message: convertRefusal,
              message_params: { service: '', convert: true },
            },
          },
          400,
        )
      return json(
        {
          error: {
            code: 'topic_required',
            message: topicRefusal[account.locale] || topicRefusal.en,
            message_params: { service: asked === body.feature_id ? '' : asked },
          },
        },
        400,
      )
    }
    // A CV is written for the person it names, and is always its eight sections:
    // no page count is read, and the title is the name.
    if (body.feature_id === 'ai.cv') {
      const sourceRefusal = cvSourceRefusal(body, body.prompt)
      if (sourceRefusal) return json(sourceRefusal, 400)
      // The server looks for the name in the title too (apps/studio/cv/content.py),
      // and in the files a CV is made from.
      const person = /^\p{Lu}\p{L}+ \p{Lu}\p{L}+$/mu
      const fromFile =
        body.source_ids?.length && !body.source_ids.every((asset) => /^nameless/i.test(uploads.get(asset)?.name || ''))
      const named = person.exec(body.prompt || '') || person.exec(body.title || '') || (fromFile ? [cvFilePerson] : null)
      if (!named && body.options?.topic_given !== true)
        return json({ error: { code: 'cv_name_required', message: cvNameRefusal } }, 400)
      if (refusePortrait && body.options?.portrait_asset_id)
        return json({ error: { code: refusePortrait, message: 'Check the request and try again.' } }, 400)
      const title = named ? named[0] : body.title
      const draft = {
        id: id(),
        version: 1,
        provider_mode: config.provider.mode,
        expires_at: future(),
        ...structuredClone(body),
        title,
        options: cvOptions(body.options),
        content: { title, sections: CV_SECTIONS.map((section) => ({ id: section, heading: '', body: '', notes: '' })), questions: [], citations: [] },
      }
      drafts.set(draft.id, draft)
      return json(draft, 201)
    }
    // The server reads the page count out of the description and clamps it to
    // the service's ceiling; the fixture does the same so the form sees a real answer.
    const named = /(\d{1,3})\s*(?:-|\s)?\s*(?:pages?|slides?)/i.exec(
      `${body.prompt || ''}\n${body.source_text || ''}`,
    )
    const asked = named ? Number(named[1]) : null
    // A change inherits the document it applies to, exactly as the server does.
    const source = body.options?.revise_draft_id ? drafts.get(body.options.revise_draft_id) : null
    const length = Math.min(
      asked || source?.content?.sections?.length || config.default_pages,
      clampPages || 99,
    )
    const draft = {
      id: id(),
      version: 1,
      provider_mode: config.provider.mode,
      expires_at: future(),
      ...structuredClone(body),
      options:
        source?.feature_id === 'ai.cv'
          ? cvOptions(body.options, source)
          : { ...structuredClone(body.options || {}), length, requested_pages: asked },
      ...(source
        ? {
            feature_id: source.feature_id,
            output_format: source.output_format,
            title: source.title,
            revision: {
              request: body.prompt,
              source_draft_id: source.id,
              ...(body.options?.revise_section_ids
                ? { selected_section_ids: body.options.revise_section_ids, base_version: source.version }
                : {}),
            },
          }
        : {}),
      content: source ? structuredClone(source.content) : sourceContent(body, length),
    }
    drafts.set(draft.id, draft)
    return json(draft, 201)
  }
  const draftRoute = endpoint.match(/^\/generation\/drafts\/([^/]+)(?:\/(outline|quote))?$/)
  if (draftRoute) {
    const draft = drafts.get(draftRoute[1])
    if (!draft) return failure('not_found')
    if (method === 'GET') return json(draft)
    if (body.version !== draft.version) return failure('version_conflict')
    if (draftRoute[2] === 'quote') {
      const quote = {
        id: id(),
        feature_id: draft.feature_id,
        expires_at: future(),
        affordable,
        usage: weekUsage(),
        parameters: {
          generation_draft_id: draft.id,
          generation_draft_version: draft.version,
          generation_stage: body.stage || 'document',
        },
      }
      quotes.set(quote.id, quote)
      return json(quote, 201)
    }
    if (method === 'PATCH') {
      if (draft.feature_id === 'ai.cv' && refusePortrait && body.options?.portrait_asset_id)
        return json({ error: { code: refusePortrait, message: 'Check the request and try again.' } }, 400)
      // A change keeps its CV's files whatever is sent; a new CV is checked again.
      const cvRefusal =
        draft.feature_id === 'ai.cv' && !draft.revision ? cvSourceRefusal(body, body.prompt ?? draft.prompt) : null
      if (cvRefusal) return json(cvRefusal, 400)
      // Match the backend's rebuild trigger: a changed brief/source/format
      // regenerates content unless the user explicitly supplies edited content.
      const rebuild = ['prompt', 'source_text', 'source_ids', 'output_format'].some(
        (key) => Object.hasOwn(body, key) && !isDeepStrictEqual(body[key], draft[key]),
      )
      const updated = { ...draft, ...structuredClone(body), version: draft.version + 1 }
      if (draft.feature_id === 'ai.cv')
        updated.options = cvOptions(body.options, drafts.get(draft.revision?.source_draft_id))
      // A count chosen on the review rail beats the description, clamped like any other.
      if (Number.isInteger(updated.options?.pages)) {
        const pages = updated.options.pages
        updated.options = { ...updated.options, length: Math.min(pages, clampPages || 99), requested_pages: pages }
      }
      const resized = updated.options?.length !== draft.options?.length
      if ((rebuild || resized) && !Object.hasOwn(body, 'content')) {
        updated.content = sourceContent(updated, updated.options.length)
      }
      Object.assign(draft, updated)
    }
    return json(draft)
  }
  const retryRoute = endpoint.match(/^\/generation\/jobs\/([^/]+)\/retry-quote$/)
  if (retryRoute && method === 'POST') {
    const failed = jobs.get(retryRoute[1])
    assert.equal(failed.status, 'failed')
    const quote = {
      id: id(),
      feature_id: failed.feature_id,
      expires_at: future(),
      affordable,
      usage: weekUsage(),
      parameters: failed.parameters,
      // The API names a quote's parameters this way; a retried edit carries `revision`.
      normalized_parameters: failed.parameters,
    }
    quotes.set(quote.id, quote)
    return json(quote, 201)
  }
  if (endpoint === '/jobs' && method === 'GET') return json({ results: [...jobs.values()], count: jobs.size })
  if (endpoint === '/jobs' && method === 'POST') {
    if (expireJobOnce) {
      expireJobOnce = false
      return failure('quote_expired')
    }
    const previous = idempotentJobs.get(request.headers()['idempotency-key'])
    if (previous) return json(previous)
    const quote = quotes.get(body.quote_id)
    if (!quote) return failure('quote_expired')
    const draft = drafts.get(quote.parameters.generation_draft_id)
    if (quote.parameters.generation_draft_version !== draft.version) return failure('quote_stale')
    if (!quote.affordable) return failure('weekly_ai_limit')
    const job = {
      id: id(),
      feature_id: draft.feature_id,
      status: 'succeeded',
      stage: 'succeeded',
      created_at: new Date().toISOString(),
      expires_at: future(),
      parameters: quote.parameters,
      artifacts: [],
      warnings: [],
    }
    jobs.set(job.id, job)
    idempotentJobs.set(request.headers()['idempotency-key'], job)
    if (failJobOnce) {
      failJobOnce = false
      return json({ error: { code: 'upstream_unavailable', message: 'Fixture network interruption' } }, 503)
    }
    return json(job, 201)
  }
  if (endpoint.startsWith('/jobs/')) return json(jobs.get(endpoint.split('/')[2]) || {})
  unexpected.push({ path: endpoint, method })
  return json({ error: { code: 'unexpected_fixture_request' } }, 404)
})

const go = (locale, feature) =>
  page.goto(`${origin}/${locale}/app/create?feature=${feature}`, { waitUntil: 'domcontentloaded' })
const calls = (endpoint, method = 'POST') =>
  requests.filter((request) => request.path === endpoint && request.method === method)
const lastDraftRequest = () => calls('/generation/drafts').at(-1)
const countJobs = () => calls('/jobs').length

async function open(feature, locale = 'en') {
  await go(locale, feature)
  await page.getByTestId('studio-brief').waitFor()
  await page.getByTestId('studio-review').waitFor()
  assert.equal(await page.getByTestId('studio-purpose').inputValue(), feature)
}
const primary = () => page.getByTestId('studio-primary-input')
const more = () => page.getByTestId('studio-more-options')
const review = () => page.getByTestId('studio-review')
const quotePanel = () => page.locator('.studio-quote')
// An uncertain submission relabels the same control, so match both states.
const generate = () => quotePanel().getByRole('button', { name: /^(Generate document|Try again)$/ })
const refreshQuote = () => quotePanel().getByRole('button', { name: 'Refresh', exact: true })
const upload = () => page.getByLabel('Source files', { exact: true })

async function reviewNew() {
  const beforeDrafts = calls('/generation/drafts').length
  const beforeJobs = countJobs()
  const beforeWrites = requests.length
  await review().click()
  await quotePanel().waitFor()
  assert.equal(calls('/generation/drafts').length, beforeDrafts + 1, 'One draft per review')
  assert.equal(countJobs(), beforeJobs, 'Review must not run a paid or free generation job')
  const writes = requests
    .slice(beforeWrites)
    .filter((request) => request.method !== 'GET' && request.path.startsWith('/generation/'))
  assert.deepEqual(
    writes.map((request) => [request.method, request.path.endsWith('/quote') ? 'quote' : request.path]),
    [
      ['POST', '/generation/drafts'],
      ['POST', 'quote'],
    ],
    'Fresh review is draft → quote, without extra authoring calls',
  )
  const created = lastDraftRequest().body
  assert.ok(created.title.trim(), 'Title is derived when it was not requested from the user')
  return created
}

async function reviewSaved() {
  const before = requests.length
  await review().click()
  await quotePanel().waitFor()
  const patched = requests
    .slice(before)
    .find((request) => request.method === 'PATCH' && request.path.startsWith('/generation/drafts/'))
  assert.ok(patched, 'An existing draft is saved, not recreated')
  return patched.body
}

/** WCAG A/AA on the brief in both themes, for a state the locale loop never opens. */
async function auditBrief(label) {
  const original = await page.evaluate(() => document.documentElement.dataset.theme || '')
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme)
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    )
    const result = await new AxeBuilder({ page })
      .include('.studio-form')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    assert.deepEqual(
      result.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => ({ target: node.target, failure: node.failureSummary })),
      })),
      [],
      `${label}/${theme}: accessibility violations`,
    )
    await page
      .getByTestId('studio-brief')
      .screenshot({ path: path.join(output, `${label.replaceAll(' ', '-')}-${theme}.png`) })
  }
  await page.evaluate((value) => {
    if (value) document.documentElement.dataset.theme = value
    else delete document.documentElement.dataset.theme
  }, original)
}

async function confirm() {
  const beforeJobs = countJobs()
  await generate().click()
  await page.waitForURL('**/app/jobs/*')
  await page.locator('.job-detail').waitFor()
  assert.equal(countJobs(), beforeJobs + 1, 'Confirmation submits exactly one job')
  assert.ok(calls('/jobs').at(-1).idempotencyKey, 'Confirmation retains job idempotency')
}

try {
  // 1. One description is the whole brief.
  await open('ai.pdf_topic')
  assert.equal(await more().getAttribute('open'), null, 'Advanced fields start collapsed')
  assert.equal(await review().isDisabled(), true, 'An empty description cannot be submitted')
  assert.equal(
    await page.getByTestId('studio-brief').locator('textarea:visible').count(),
    1,
    'One field, not a form',
  )
  // Everything the retired features asked for separately now lives in the text.
  for (const gone of ['studio-length', 'studio-tone', 'studio-density-rich']) {
    assert.equal(await page.getByTestId(gone).count(), 0, `${gone} must no longer be asked for`)
  }
  await primary().fill('Explain how to grow tomatoes on a small balcony, in 4 pages.')
  const simple = await reviewNew()
  assert.equal(simple.prompt, 'Explain how to grow tomatoes on a small balcony, in 4 pages.')
  assert.equal(simple.options.subject, undefined)
  assert.equal(simple.options.length, undefined, 'The server reads the page count, not the form')
  await confirm()
  checks.push('One description → one review → explicit confirmation, with no other field to fill')

  // 1b. The hint under the description states the server's default and the
  // ceiling, and neither depends on the plan.
  await open('ai.pdf_topic')
  const describeHint = () => page.getByTestId('studio-describe-hint').innerText()
  assert.match(await describeHint(), /No page count means 10; the most is 35\./)
  assert.doesNotMatch(await describeHint(), /plan/i, 'the ceiling is the same on every plan')
  config.default_pages = 7
  await open('ai.pdf_topic')
  assert.match(await describeHint(), /No page count means 7;/, 'the default is read from the config')
  delete config.default_pages
  await open('ai.pdf_topic')
  assert.match(await describeHint(), /No page count means 10;/, 'a config without a default still says 10')
  config.default_pages = 10
  checks.push('The description hint says 10 pages by default and the shared ceiling, read from the config')

  // 2. The resolved page count is shown back, and a clamp is said out loud.
  await open('ai.pdf_topic')
  await primary().fill('A guide to tide tables in 4 pages.')
  await review().click()
  await quotePanel().waitFor()
  assert.match(await page.getByTestId('studio-pages').innerText(), /4/)
  assert.equal(await page.getByTestId('studio-pages-clamped').count(), 0)

  clampPages = 2
  await open('ai.pdf_topic')
  await primary().fill('A 20 page report on tide tables.')
  await review().click()
  await quotePanel().waitFor()
  await page.getByTestId('studio-pages-clamped').waitFor()
  assert.match(await page.getByTestId('studio-pages-clamped').innerText(), /20/)
  assert.match(await page.getByTestId('studio-pages-clamped').innerText(), /You asked for 20; the most is 2\./)
  assert.equal(
    await page.getByTestId('studio-pages-clamped').getByRole('link').count(),
    0,
    'every plan has the same ceiling, so a clamp offers no plan',
  )
  clampPages = 0
  checks.push('The pages resolved from the description are shown back, and a clamp is explained without offering a plan')

  // 2b. A count read wrong is put right on the review rail, and quoted again.
  await open('ai.pdf_topic')
  await primary().fill('A guide to tide tables in 4 pages.')
  await review().click()
  await quotePanel().waitFor()
  const quoteCalls = () => requests.filter((request) => request.path.endsWith('/quote')).length
  const quotesBefore = quoteCalls()
  await page.getByTestId('studio-pages-more').click()
  await page.waitForFunction(
    () => document.querySelector('[data-testid="studio-pages"] strong')?.textContent?.trim() === '5',
  )
  const resized = requests
    .filter((request) => request.method === 'PATCH' && request.path.startsWith('/generation/drafts/'))
    .at(-1).body
  assert.equal(resized.options.pages, 5, 'The chosen count is sent as the count')
  assert.ok(quoteCalls() > quotesBefore, 'The new count is quoted again')
  await page.getByTestId('studio-pages-fewer').click()
  await page.waitForFunction(
    () => document.querySelector('[data-testid="studio-pages"] strong')?.textContent?.trim() === '4',
  )
  assert.match(await quotePanel().getByTestId('weekly-line').innerText(), /AI documents this week\s+2 of 5 used/)
  await quotePanel().screenshot({ path: path.join(output, 'review-pages.png') })
  checks.push('The count can be changed on the review rail before creating, beside the week’s AI documents')

  // 3. Examples are one tap, and the guide is one click.
  await open('ai.pdf_topic')
  const example = await page.getByTestId('studio-example-0').innerText()
  await page.getByTestId('studio-example-0').click()
  assert.ok((await primary().inputValue()).startsWith(example.slice(0, 20)))
  assert.equal(await review().isDisabled(), false, 'An example is a complete brief on its own')
  const used = await reviewNew()
  assert.ok(/\d/.test(used.prompt), 'every example names a page count')
  checks.push('An example fills the description and reviews without another field being touched')

  // 4. Slides are the same flow, with nothing extra to choose.
  await open('ai.pptx')
  assert.equal(
    await page.getByTestId('studio-format').count(),
    0,
    'A deck is always a PowerPoint, so there is nothing to pick',
  )
  await primary().fill('8 slides introducing our results to the sales team.')
  const deck = await reviewNew()
  assert.equal(deck.output_format, 'pptx')
  await open('ai.pdf_topic')
  assert.equal(await page.getByTestId('studio-format').count(), 0, 'A document is always a PDF')
  checks.push('Neither service asks for a format: a document is a PDF, a deck is a PowerPoint')

  // 4b. Slides asked of the PDF service are offered the Slides service, as a
  // suggestion that keeps the text; a plain PDF brief is left alone.
  const hint = () => page.getByTestId('studio-service-hint')
  const hintText = () => page.getByTestId('studio-service-hint-text')
  const hintSwitch = () => page.getByTestId('studio-service-switch')
  const settled = () =>
    page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  /** The service a description is offered while typing, or '' when it is left alone. */
  async function suggestion(prompt) {
    await primary().fill(prompt)
    await settled()
    if (!(await hintSwitch().count())) {
      assert.equal((await hintText().textContent()).trim(), '', `${prompt}: a suggestion with no way across`)
      return ''
    }
    return (await hintSwitch().innerText()).includes('Slides') ? 'ai.pptx' : 'ai.pdf_topic'
  }
  await open('ai.pdf_topic')
  // The live region is in the page before there is anything to say, so the
  // suggestion is announced when it appears; the button is not part of it.
  const liveRegion = hintText()
  assert.equal(await liveRegion.getAttribute('role'), 'status')
  assert.equal(await liveRegion.getAttribute('aria-live'), 'polite')
  assert.equal((await liveRegion.textContent()).trim(), '')
  await liveRegion.evaluate((node) => (node.dataset.fixtureMark = 'before'))
  assert.equal(
    await suggestion('A 4 page guide to composting at home.'),
    '',
    'A plain PDF brief gets no suggestion',
  )
  assert.equal(
    await suggestion('A 4 page PDF handout to go with my slides on composting.'),
    '',
    'A PDF named as the thing to make stays a PDF',
  )
  const slidesBrief = 'Make 8 slides about composting for a school club.'
  await primary().fill(slidesBrief)
  await hintSwitch().waitFor()
  assert.match(await hint().innerText(), /mentions slides[\s\S]*Switch to Slides/)
  assert.equal(
    await liveRegion.getAttribute('data-fixture-mark'),
    'before',
    'The suggestion fills the region that was already there',
  )
  assert.match(
    await liveRegion.innerText(),
    /^Your description mentions slides\. This service makes a PDF document\.$/,
  )
  assert.equal(
    await liveRegion.locator('button').count(),
    0,
    'The button is not read as part of the suggestion',
  )
  assert.equal(await primary().getAttribute('aria-describedby'), 'studio-service-hint')
  await auditBrief('slides hint')
  const draftsBeforeSwitch = calls('/generation/drafts').length
  await hintSwitch().click()
  assert.equal(await page.getByTestId('studio-purpose').inputValue(), 'ai.pptx')
  assert.equal(await primary().inputValue(), slidesBrief, 'Switching keeps the typed description')
  assert.equal(await hintSwitch().count(), 0)
  assert.match(await page.locator('.studio-defaults').innerText(), /PPTX[\s\S]*slides/)
  assert.ok(
    !decodeURIComponent(page.url()).includes('composting'),
    'The description never travels in the address',
  )
  assert.equal(calls('/generation/drafts').length, draftsBeforeSwitch, 'Switching creates nothing')
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('data-testid')),
    'studio-purpose',
    'Focus lands on the service that changed, not on the page',
  )
  assert.equal((await reviewNew()).feature_id, 'ai.pptx')

  // A slide word is as often the topic as the request: it counts only when it
  // is asked for (a count, or a make/need verb beside it), never when a
  // written paper is named as the thing to make. A PDF the slides are made
  // from is not a PDF asked for. Synthetic descriptions only.
  await open('ai.pdf_topic')
  const pdfService = [
    ['How to give a good presentation, 5 pages for first-year students', ''],
    ['Clinical presentation of pneumonia in children, 6 pages', ''],
    ['IAS 1 Presentation of Financial Statements: a summary', ''],
    ['How to prepare microscope slides for a biology lab', ''],
    ['Taqdimot tayyorlash bo‘yicha qo‘llanma, 5 bet', ''],
    ['Ilmiy taqdimot tuzilishi va qoidalari', ''],
    ['PowerPoint dasturi haqida referat, 5 bet', ''],
    ['Как сделать хорошую презентацию: советы студентам', ''],
    ['Реферат на тему: Программа PowerPoint и её возможности', ''],
    ['Ekologiya haqida slayd yasab bering', 'ai.pptx'],
    ['Biologiyadan 15 ta slayd kerak: suv resurslari', 'ai.pptx'],
    ['Сделай презентацию про Байкал на 10 слайдов', 'ai.pptx'],
    ['A presentation on volcanoes for year 5', 'ai.pptx'],
    ['Kurs ishi himoyasi uchun 10 ta slayd kerak', 'ai.pptx'],
    ['Bu pdfni slayd qilib ber', 'ai.pptx'],
    ['pdfni 10 ta slaydga aylantir', 'ai.pptx'],
    ['Turn this PDF into 10 slides', 'ai.pptx'],
    ['Convert the attached PDF into a presentation', 'ai.pptx'],
    ['этот pdf переделай в презентацию', 'ai.pptx'],
    ['Make the slides as a PDF', ''],
  ]
  for (const [prompt, expected] of pdfService)
    assert.equal(await suggestion(prompt), expected, `PDF service: ${prompt}`)

  // The other way round only on a written paper asked for: a PDF in the Slides
  // service is nearly always the file the deck is made from, and a paper's
  // defence is made with slides.
  await open('ai.pptx')
  const slidesService = [
    ['Summarise the attached PDF on the Silk Road.', ''],
    ['Referat yozish qoidalari', ''],
    ['Kurs ishi himoyasi uchun', ''],
    ['Защита реферата по истории', ''],
    ['How to write a term paper: a lesson for year 10', ''],
    ['Tarixdan 10 sahifali referat kerak', 'ai.pdf_topic'],
    ['Напиши реферат про Шёлковый путь', 'ai.pdf_topic'],
  ]
  for (const [prompt, expected] of slidesService)
    assert.equal(await suggestion(prompt), expected, `Slides service: ${prompt}`)
  await primary().fill('A referat on the Silk Road for history class.')
  await hintSwitch().waitFor()
  await hintSwitch().click()
  assert.equal(await page.getByTestId('studio-purpose').inputValue(), 'ai.pdf_topic')
  assert.equal(await primary().inputValue(), 'A referat on the Silk Road for history class.')
  checks.push(
    'Slides asked of the PDF service (or a paper of Slides) are offered the other service, text kept; a topic is not',
  )

  // A service switched off (every plan has both, so off means off for everyone)
  // is never offered, by the suggestion or the refusal.
  const slidesFeature = config.features.find((feature) => feature.id === 'ai.pptx')
  slidesFeature.eligible = false
  await open('ai.pdf_topic')
  assert.equal(await suggestion(slidesBrief), '', 'No way across to a service that is switched off')
  await primary().fill('Make bright slides.')
  await review().click()
  await page.getByTestId('studio-prompt-error').waitFor()
  assert.equal(await page.getByTestId('studio-prompt-switch').count(), 0, 'Nor from the refusal')
  slidesFeature.eligible = true
  checks.push('A service that is switched off is never offered')

  // 4c. A description that names no topic is refused under the field, where
  // the fix is typed, and is never quoted.
  const refusal = () => page.getByTestId('studio-prompt-error')
  const promptSwitch = () => page.getByTestId('studio-prompt-switch')
  const activeTestId = () =>
    page.evaluate(
      () => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName,
    )
  await open('ai.pdf_topic')
  await primary().fill('Make bright slides.')
  const beforeRefusal = requests.length
  // From the keyboard: focus goes to the field to fix, not back to the page.
  await review().focus()
  await page.keyboard.press('Enter')
  await refusal().waitFor()
  await settled()
  assert.match(await refusal().locator('#studio-prompt-error').innerText(), /Write what the document should be about/)
  assert.equal(await activeTestId(), 'studio-primary-input', 'Focus moves to the description to fix')
  assert.equal(
    await refusal().locator('[role="alert"], [aria-live]').count(),
    0,
    'Read once, as the focused field’s description, not again as an alert',
  )
  assert.equal(
    await page.locator('.error-banner').count(),
    0,
    'The refusal is beside the field, not in the banner',
  )
  assert.equal(await primary().getAttribute('aria-invalid'), 'true')
  assert.equal(await primary().getAttribute('aria-describedby'), 'studio-prompt-error')
  assert.equal(await hintSwitch().count(), 0, 'One message under the field at a time')
  assert.deepEqual(
    requests
      .slice(beforeRefusal)
      .filter((request) => request.method !== 'GET')
      .map((request) => [request.method, request.path]),
    [['POST', '/generation/drafts']],
    'A refused description is never quoted',
  )
  assert.equal(
    await page.getByTestId('studio-purpose').isDisabled(),
    false,
    'No draft exists, so the service can change',
  )
  assert.equal(await promptSwitch().innerText(), 'Make slides instead')
  await auditBrief('topic refusal')
  await page.setViewportSize({ width: 390, height: 1000 })
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'topic refusal/390: horizontal overflow',
  )
  await page.getByTestId('studio-brief').screenshot({ path: path.join(output, 'topic-required-390.png') })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await promptSwitch().click()
  assert.equal(await page.getByTestId('studio-purpose').inputValue(), 'ai.pptx')
  assert.equal(await primary().inputValue(), 'Make bright slides.', 'Switching keeps the typed description')
  assert.equal(await promptSwitch().count(), 0)
  // The description still needs its topic, said now in words that suit slides too.
  const topicStill = 'Now add the topic — for example: “The water cycle for 6th grade”.'
  assert.equal(
    await refusal().locator('#studio-prompt-error').innerText(),
    topicStill,
    'The refusal no longer speaks of a document and pages',
  )
  assert.equal(await primary().getAttribute('aria-invalid'), 'true')
  await auditBrief('topic still')
  await primary().fill('Make bright slides about the water cycle for year 6.')
  assert.equal(await refusal().count(), 0, 'Typing clears the refusal')
  assert.equal(await primary().getAttribute('aria-invalid'), null)
  assert.equal((await reviewNew()).feature_id, 'ai.pptx')

  // Changing the service any other way takes the stale way across with it.
  await open('ai.pdf_topic')
  await primary().fill('Make bright slides.')
  await review().click()
  await promptSwitch().waitFor()
  await page.getByTestId('studio-purpose').selectOption('ai.pptx')
  await settled()
  assert.equal(await promptSwitch().count(), 0, 'No button back to the service already chosen')
  assert.equal(await refusal().locator('#studio-prompt-error').innerText(), topicStill)
  await open('ai.pdf_topic')
  await primary().fill('Make bright slides.')
  await review().click()
  await promptSwitch().waitFor()
  await page.evaluate(() =>
    document
      .querySelector('#__nuxt')
      .__vue_app__.config.globalProperties.$router.push('/en/app/create?feature=ai.pptx'),
  )
  await page.waitForFunction(
    () => document.querySelector('[data-testid="studio-purpose"]')?.value === 'ai.pptx',
  )
  await settled()
  assert.equal(await promptSwitch().count(), 0, 'Nor after following a link to the other service')

  // With no other service named, there is nothing to switch to.
  await open('ai.pdf_topic')
  await primary().fill('Make it 12 pages long.')
  await review().click()
  await refusal().waitFor()
  assert.equal(await promptSwitch().count(), 0)
  await page.getByTestId('studio-example-0').click()
  assert.equal(await refusal().count(), 0, 'Taking an example clears the refusal too')
  // A title is read with the description, so giving one is a fix as well.
  await primary().fill('Make it 12 pages long.')
  await review().click()
  await refusal().waitFor()
  await more().locator('summary').click()
  await page.getByTestId('studio-title').fill('The water cycle')
  await settled()
  assert.equal(await refusal().count(), 0, 'A title clears the refusal')
  assert.equal(await primary().getAttribute('aria-invalid'), null)

  // The customer may know better than the check: "Continue anyway" sends the
  // same description again, marked as theirs to decide, and the review follows.
  await open('ai.pdf_topic')
  await primary().fill('Make it 12 pages long.')
  await review().click()
  await refusal().waitFor()
  const beforeAnyway = calls('/generation/drafts').length
  await page.getByTestId('studio-prompt-anyway').click()
  await quotePanel().waitFor()
  const insisted = calls('/generation/drafts').slice(beforeAnyway)
  assert.equal(insisted.length, 1, 'One draft, sent once')
  assert.equal(insisted[0].body.options?.topic_given, true)
  assert.equal(insisted[0].body.prompt, 'Make it 12 pages long.', 'Sent as it was written')
  assert.equal(await refusal().count(), 0)

  // A conversion asked of an AI service points to the file tools, beside the field.
  await open('ai.pdf_topic')
  await primary().fill('Convert this to PDF.')
  await review().click()
  await refusal().waitFor()
  assert.equal(await refusal().locator('#studio-prompt-error').innerText(), convertRefusal)
  assert.equal(await page.locator('.error-banner').count(), 0)
  assert.match(
    (await page.getByTestId('studio-prompt-tools').getAttribute('href')) || '',
    /\/app\/tools$/,
  )
  assert.equal(await promptSwitch().count(), 0)
  await primary().fill('Convert this to PDF, please.')
  assert.equal(await page.getByTestId('studio-prompt-tools').count(), 0, 'Typing clears it')
  checks.push(
    'A description with no topic is refused under the field, focused, with the way to the service it asked for',
  )

  // 5. A document is read when attached and never demanded.
  await open('ai.pdf_topic')
  await upload().setInputFiles('tests/fixtures/research-notes.pdf')
  await page.locator('.source-chip').waitFor()
  await primary().fill('Summarise the attached notes in 3 pages.')
  const withFile = await reviewNew()
  assert.equal(withFile.source_ids.length, 1)
  checks.push('An attached PDF is used as the source without being required')

  // 6. Reviewing either kind of authored draft preserves an empty prompt and
  // every authored field. A row-count assertion misses rebuilds of equal length.
  for (const authoredDraft of authoredDrafts) {
    const originalContent = structuredClone(authoredDraft.content)
    await page.goto(`${origin}/en/app/create/${authoredDraft.id}`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('studio-brief').waitFor()
    assert.equal(await primary().inputValue(), '')
    assert.equal(await review().isDisabled(), false)
    const patched = await reviewSaved()
    assert.deepEqual(
      drafts.get(authoredDraft.id).content,
      originalContent,
      `${authoredDraft.feature_id}: reviewing an empty-prompt draft must preserve all authored content`,
    )
    assert.equal(patched.prompt, '', 'Review must not replace an existing empty prompt')
    assert.equal(patched.content, undefined, 'Opening authored content is not an edit')
  }
  checks.push('Authored PDF and PPTX drafts with empty prompts review without rebuilding their content')

  for (const seeded of seededDrafts) {
    await page.goto(`${origin}/en/app/create/${seeded.id}`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('studio-brief').waitFor()
    const before = requests.length
    const patched = await reviewSaved()
    assert.equal(
      patched.content,
      undefined,
      `${seeded.feature_id}: unchanged source copies retain server provenance`,
    )
    await confirm()
    const writes = requests.slice(before).filter((request) => request.method === 'PATCH')
    assert.equal(writes.length, 1, 'Confirmation does not save content a second time')
    assert.ok(writes.every((request) => request.body.content === undefined))
  }
  checks.push(
    'Untouched source-seeded PDF and PPTX drafts reach confirmation without sending authored content',
  )

  // 7. A deck's slides each have a layout, and the fields it needs.
  await page.goto(`${origin}/en/app/create/${sourceDraft.id}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('studio-brief').waitFor()
  const untouched = await reviewSaved()
  assert.equal(untouched.content, undefined, 'Opening a deck is not an edit: no content is sent back')
  await page.goto(`${origin}/en/app/create/${sourceDraft.id}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('studio-edit-outline').click()
  const layout = page.getByTestId('slide-layout-1')
  await layout.waitFor()
  assert.equal(await layout.inputValue(), 'auto', 'A slide without a layout lets the AI choose')
  assert.equal(await layout.locator('option').count(), 21, 'Let the AI choose, then the twenty layouts')
  // Playwright's isDisabled() does not report a disabled <option>; the DOM does.
  assert.deepEqual(
    await layout.locator('option:disabled').evaluateAll((nodes) => nodes.map((node) => node.value)),
    ['image_split', 'image_full'],
    'Photo layouts are not offered when the plan has no photos',
  )
  assert.match(await page.locator('.outline-section').first().innerText(), /always its title slide/)
  await layout.selectOption('stats')
  assert.match(await page.locator('.outline-section').nth(1).innerText(), /2 to 4 items/)
  const addItem = page.getByTestId('slide-add-item-1')
  await addItem.click()
  await addItem.click()
  const items = page.locator('.outline-section').nth(1).locator('.slide-item')
  assert.equal(await items.count(), 2)
  await items.nth(0).getByLabel('1 · Label').fill('Revenue')
  await items.nth(0).getByLabel('1 · Value').fill('$4.2m')
  await items.nth(1).getByLabel('2 · Label').fill('Customers')
  await items.nth(1).getByLabel('2 · Value').fill('1,200')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `slide editor/${width}: horizontal overflow`,
    )
    const audit = await new AxeBuilder({ page })
      .include('.outline-panel')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    assert.deepEqual(
      audit.violations.map((violation) => violation.id),
      [],
      `slide editor/${width}: accessibility`,
    )
    await page.screenshot({ path: path.join(output, `slide-editor-${width}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  const beforeSave = requests.length
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await page.getByText('Draft saved').waitFor()
  const saved = requests
    .slice(beforeSave)
    .find((request) => request.method === 'PATCH' && request.path.startsWith('/generation/drafts/')).body
  const slide = saved.content.sections[1]
  assert.equal(slide.layout, 'stats')
  assert.deepEqual(slide.items, [
    { label: 'Revenue', text: '', value: '$4.2m' },
    { label: 'Customers', text: '', value: '1,200' },
  ])
  assert.deepEqual(slide.columns, [])
  assert.equal(slide.image_query, '')
  assert.equal(saved.content.sections[0].layout, 'auto', 'Untouched slides stay with the AI’s choice')
  checks.push('A deck slide takes a layout and its items, and saves them; photo layouts wait for photos')

  await open('ai.pdf_topic')
  await primary().fill('A fixture document for an interrupted confirmation.')
  await reviewNew()
  const beforeRetryJobs = jobs.size
  failJobOnce = true
  await generate().click()
  await page.locator('.error-banner').waitFor()
  const originalAttempt = calls('/jobs').at(-1)
  assert.equal(
    await refreshQuote().isDisabled(),
    true,
    'An uncertain submission cannot silently replace its quote',
  )
  assert.equal(await generate().textContent(), 'Try again')
  await confirm()
  const retryAttempt = calls('/jobs').at(-1)
  assert.equal(retryAttempt.idempotencyKey, originalAttempt.idempotencyKey)
  assert.equal(retryAttempt.body.quote_id, originalAttempt.body.quote_id)
  assert.equal(jobs.size, beforeRetryJobs + 1, 'A retry recovers the same accepted job')
  checks.push('Retrying interrupted confirmation keeps the quote and idempotency key and recovers one job')

  await open('ai.pdf_topic')
  await primary().fill('An estimate which needs refreshing after expiry.')
  await reviewNew()
  expireJobOnce = true
  await generate().click()
  await page.locator('.error-banner').waitFor()
  const expiredAttempt = calls('/jobs').at(-1)
  const beforeRefresh = countJobs()
  assert.equal(
    await refreshQuote().isDisabled(),
    false,
    'A refused submission releases the estimate for an explicit refresh',
  )
  await refreshQuote().click()
  await generate().waitFor()
  assert.equal(countJobs(), beforeRefresh, 'Refreshing an estimate never submits generation')
  await confirm()
  const refreshedAttempt = calls('/jobs').at(-1)
  assert.notEqual(refreshedAttempt.body.quote_id, expiredAttempt.body.quote_id)
  assert.notEqual(refreshedAttempt.idempotencyKey, expiredAttempt.idempotencyKey)
  checks.push('An expired estimate refreshes explicitly with a new quote and idempotency key')

  // 7. The bot hands files over as `?file_id=…`; they must arrive attached.
  const linked = id()
  await page.goto(`${origin}/en/app/create?feature=ai.pdf_topic&file_id=${linked}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByTestId('studio-brief').waitFor()
  await page.locator('.source-chip').first().waitFor()
  await primary().fill('Summarise the attached file in 2 pages.')
  await reviewNew()
  assert.deepEqual(lastDraftRequest().body.source_ids, [linked], 'The linked file is the source')

  const many = [id(), id(), id()]
  await page.goto(
    `${origin}/en/app/create?feature=ai.pdf_topic&${many.map((f) => `file_id=${f}`).join('&')}`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.getByTestId('studio-brief').waitFor()
  // They attach one at a time, so wait for the last rather than the first.
  await page
    .locator('.source-chip')
    .nth(many.length - 1)
    .waitFor()
  await primary().fill('Summarise all of the attached files in 3 pages.')
  await reviewNew()
  assert.deepEqual(lastDraftRequest().body.source_ids, many, 'Every linked file is a source, in order')

  expiredFile = true
  await page.goto(`${origin}/en/app/create?feature=ai.pdf_topic&file_id=${id()}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByTestId('studio-brief').waitFor()
  await page.waitForTimeout(400)
  assert.equal(await page.locator('.source-chip').count(), 0, 'An expired link attaches nothing')
  expiredFile = false
  checks.push('Files handed over by the bot arrive attached, in order, and expired links attach nothing')

  // 8. A finished document can be changed by asking, from the job page.
  await open('ai.pdf_topic')
  await primary().fill('A 2 page guide to tide tables.')
  await reviewNew()
  await confirm()
  const producedBy = lastDraftRequest().body
  await page.getByTestId('job-revise').waitFor()
  const finishedJobUrl = page.url()
  await page.screenshot({ path: path.join(output, 'job-revise.png'), fullPage: true })
  await page.getByTestId('job-revise-input').fill('Use a friendlier tone and add an example.')
  await page.getByTestId('job-revise-submit').click()
  await page.waitForURL('**/app/create/*')
  await page.getByTestId('studio-revising').waitFor()

  const change = lastDraftRequest().body
  assert.equal(change.prompt, 'Use a friendlier tone and add an example.')
  assert.ok(change.options.revise_draft_id, 'the change names the document it applies to')
  assert.equal(change.options.revise_section_ids, undefined, 'Global revisions remain the default')
  assert.equal(await primary().inputValue(), 'Use a friendlier tone and add an example.')
  // A change is not a new brief, so the starter examples stand down.
  assert.equal(await page.getByTestId('studio-example-0').count(), 0)
  assert.equal(await review().isDisabled(), false, 'ready to price the change')
  await review().click()
  await quotePanel().waitFor()
  assert.match(await page.getByTestId('studio-pages').innerText(), /2/, 'the length is inherited')
  assert.ok(producedBy.prompt.includes('tide tables'))
  // A change is planned from the document it changes: no AI outline is offered,
  // which would replace the document's text with one-line summaries.
  await page.getByTestId('studio-edit-outline').first().click()
  await page.locator('.outline-section').first().waitFor()
  assert.equal(await page.locator('.outline-generation').count(), 0, 'No AI outline for a change request')
  checks.push('A finished document is changed by asking, and the change keeps what it did not mention')

  await page.goto(finishedJobUrl, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('job-revise-scope').selectOption('s2')
  await page.getByTestId('job-revise-input').fill('Make this page friendlier.')
  const sourceVersion = drafts.get(change.options.revise_draft_id).version
  await page.getByTestId('job-revise-submit').click()
  await page.waitForURL('**/app/create/*')
  const selectedChange = lastDraftRequest().body
  assert.deepEqual(selectedChange.options.revise_section_ids, ['s2'])
  assert.equal(selectedChange.options.revise_base_version, sourceVersion)
  await page.getByTestId('studio-revising').waitFor()
  assert.match(await page.getByTestId('studio-revising').innerText(), /only page\/slide 2/)
  checks.push('Optional page selection sends explicit identity and the source version')

  // The AI could not finish a new document: the retry stays, and says how to
  // make the description clearer if it fails again.
  const providerFailed = { code: 'provider_failed', message: 'The AI couldn’t finish this.' }
  const failedId = id()
  jobs.set(failedId, {
    ...structuredClone([...jobs.values()][0]),
    id: failedId,
    status: 'failed',
    stage: 'failed',
    error: providerFailed,
  })
  await page.goto(`${origin}/en/app/jobs/${failedId}`, { waitUntil: 'domcontentloaded' })
  assert.match(await page.getByTestId('job-retry-body').innerText(), /doesn’t count against your week/)
  const advice = page.getByTestId('job-retry-advice')
  assert.match(
    await advice.innerText(),
    /fails again, make the request more specific: the topic, who it is for and the length/,
  )
  assert.equal(
    await advice.getByRole('link', { name: 'Change the request' }).getAttribute('href'),
    `/en/app/create/${jobs.get(failedId).parameters.generation_draft_id}`,
    'The advice opens the draft behind the job, where the description is changed',
  )
  assert.equal(
    await page.getByTestId('job-retry-review').isVisible(),
    true,
    'The retry stays beside the advice',
  )
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme)
    const audit = await new AxeBuilder({ page })
      .include('[data-testid="job-retry"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    assert.deepEqual(
      audit.violations.map((violation) => violation.id),
      [],
      `failed job advice/${theme}: accessibility`,
    )
  }
  await page.evaluate(() => (document.documentElement.dataset.theme = 'light'))
  await page.getByTestId('job-retry').screenshot({ path: path.join(output, 'job-retry-advice.png') })
  const beforeRetry = countJobs()
  await page.getByTestId('job-retry-review').click()
  await page.getByTestId('job-retry-quote').waitFor()
  assert.equal(countJobs(), beforeRetry, 'Reviewing does not start a retry')
  assert.match(await page.getByTestId('job-retry-quote').innerText(), /AI documents this week\s+2 of 5 used/)
  failJobOnce = true
  await page.getByTestId('job-retry-confirm').click()
  await page.getByTestId('job-retry-confirm').filter({ hasText: 'Try again' }).waitFor()
  const ambiguous = calls('/jobs').at(-1)
  await page.getByTestId('job-retry-confirm').click()
  await page.waitForURL((url) => /\/app\/jobs\//.test(url.pathname) && !url.pathname.endsWith(failedId))
  const replay = calls('/jobs').at(-1)
  assert.equal(replay.idempotencyKey, ambiguous.idempotencyKey)
  assert.deepEqual(replay.body, ambiguous.body)
  assert.equal(await page.evaluate(() => sessionStorage.getItem('pdf-master-pending-job')), null)
  checks.push(
    'A failed generation retries only after confirmation and preserves its key on an ambiguous response',
  )
  checks.push(
    'A new AI document the AI could not finish advises a clearer description and links to change it',
  )

  // An outline the AI could not finish keeps the plain retry, as in the bot:
  // the advice is about describing a new document.
  const failedOutlineId = id()
  const outlineSource = jobs.get(failedId)
  jobs.set(failedOutlineId, {
    ...structuredClone(outlineSource),
    id: failedOutlineId,
    parameters: { ...outlineSource.parameters, stage: 'outline' },
    error: providerFailed,
  })
  await page.goto(`${origin}/en/app/jobs/${failedOutlineId}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('job-retry-body').waitFor()
  assert.equal(
    await page.getByTestId('job-retry-advice').count(),
    0,
    'No description advice for a failed outline',
  )
  assert.equal(await page.getByTestId('job-retry-review').isVisible(), true, 'An outline is still retried')
  checks.push('A failed outline is retried without the advice on describing a new document')

  // A failed AI edit is retried the same way, but it counts against the file's
  // own edits: the week's AI documents are neither shown nor blamed.
  const failedEditId = id()
  const editSource = [...jobs.values()][0]
  jobs.set(failedEditId, {
    ...structuredClone(editSource),
    id: failedEditId,
    status: 'failed',
    stage: 'failed',
    parameters: {
      ...editSource.parameters,
      revision: true,
      root_draft_id: editSource.parameters.generation_draft_id,
    },
    error: providerFailed,
  })
  await page.goto(`${origin}/en/app/jobs/${failedEditId}`, { waitUntil: 'domcontentloaded' })
  const editRetryBody = await page.getByTestId('job-retry-body').innerText()
  // An edit changes what is already there; advice on describing a new one does not apply.
  assert.equal(
    await page.getByTestId('job-retry-advice').count(),
    0,
    'No description advice for a failed edit',
  )
  assert.match(editRetryBody, /doesn’t count against this file’s AI edits/)
  assert.doesNotMatch(editRetryBody, /week/)
  await page.getByTestId('job-retry-review').click()
  await page.getByTestId('job-retry-quote').waitFor()
  const editQuote = page.getByTestId('job-retry-quote')
  assert.equal(await editQuote.getByTestId('weekly-line').count(), 0, 'An edit shows no weekly AI-documents line')
  assert.match(await editQuote.innerText(), /AI edits per file on your plan: 3\./)
  affordable = false
  await editQuote.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByTestId('job-retry-refused').waitFor()
  const editRefusal = await page.getByTestId('job-retry-refused').innerText()
  assert.match(editRefusal, /used all AI edits for this file[\s\S]*See plans/)
  assert.doesNotMatch(editRefusal, /week|Monday/)
  assert.equal(await editQuote.getByTestId('weekly-line').count(), 0, 'Even a week used up is not blamed for an edit')
  assert.equal(await page.getByTestId('job-retry-confirm').isDisabled(), true)
  await page.getByTestId('job-retry').screenshot({ path: path.join(output, 'job-retry-edit-refused.png') })
  affordable = true
  checks.push(
    'Retrying a failed AI edit speaks of the file’s edits, never the week’s AI documents, nor gives description advice',
  )

  // 9. A description can also arrive pre-filled, which is how the guide works.
  const brief = 'A 3 page briefing on tide tables for a general audience.'
  await page.goto(`${origin}/en/app/create?feature=ai.pdf_topic&prompt=${encodeURIComponent(brief)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByTestId('studio-brief').waitFor()
  assert.equal(await primary().inputValue(), brief)
  assert.equal(await review().isDisabled(), false)
  checks.push('A description arriving in the link is ready to review, which is how the guide hands one over')

  affordable = false
  await open('ai.pdf_topic')
  await primary().fill('A short fixture document.')
  await reviewNew()
  assert.equal(await generate().isDisabled(), true)
  assert.match(await page.getByTestId('weekly-limit').innerText(), /reached this week’s limit[\s\S]*See plans/)
  assert.match(await quotePanel().getByTestId('weekly-line').innerText(), /AI documents this week\s+5 of 5 used/)
  await quotePanel().screenshot({ path: path.join(output, 'review-week-used-up.png') })
  affordable = true
  checks.push('A quote past the week’s limit cannot submit generation, and offers the plans')

  // 10. A CV: no page count to read or set, a portrait instead of a PDF, and a
  // template picked from the catalogue or left on Auto.
  await open('ai.cv')
  const photoInput = () => page.getByTestId('studio-cv-photo')
  assert.equal(await photoInput().getAttribute('accept'), 'image/png,image/jpeg', 'the portrait is a JPG or PNG')
  assert.equal(await upload().count(), 0, 'a CV reads no PDF')
  assert.equal(await page.getByTestId('studio-title').count(), 0, 'a CV is named after the person')
  assert.match(await page.getByTestId('studio-describe-hint').innerText(), /your full name, email or phone/)
  assert.match(await page.locator('.studio-defaults').innerText(), /PDF[\s\S]*1–2 pages/)
  assert.doesNotMatch(await page.locator('.studio-defaults').innerText(), /\b10 pages/)
  const cvAuto = page.getByTestId('cv-template-auto')
  await cvAuto.waitFor()
  assert.equal(await cvAuto.getAttribute('aria-checked'), 'true', 'a CV starts on Auto')
  await page.locator('[data-template="classic_navy"] img.cv-thumb').waitFor()
  // A wrong file is refused beside the button, before anything is uploaded.
  const uploadsBefore = calls('/files/uploads').length
  const photoError = () => page.getByTestId('studio-cv-photo-error')
  await photoInput().setInputFiles({ name: 'portrait.webp', mimeType: 'image/webp', buffer: PNG })
  await photoError().waitFor()
  assert.match(await photoError().innerText(), /JPG or PNG photo of up to 20 MB/)
  assert.equal(calls('/files/uploads').length, uploadsBefore, 'a WebP is never uploaded')
  await photoInput().setInputFiles({ name: 'huge.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(21 * 1024 * 1024, 1) })
  await page.getByText(/JPG or PNG photo of up to 20 MB/).waitFor()
  assert.equal(calls('/files/uploads').length, uploadsBefore, 'an original over 20 MB is never read')
  // A picture this browser cannot draw goes as it is only when the server would take it.
  await photoInput().setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(6 * 1024 * 1024, 7) })
  await page.getByText(/This photo cannot be used\. Choose a JPG or PNG of up to 5 MB and 6 megapixels/).waitFor()
  assert.equal(calls('/files/uploads').length, uploadsBefore, 'an unreadable 6 MB file is not uploaded')
  assert.equal(await page.getByTestId('studio-cv-photo-chip').count(), 0)
  // A phone's 12 MP original, stored on its side with an EXIF turn as phones do,
  // is sent upright, at most 2000 px long, as a JPEG with nothing of the original's EXIF.
  const landscape = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 4032
      canvas.height = 3024
      const context = canvas.getContext('2d')
      context.fillStyle = '#7a9cc6'
      context.fillRect(0, 0, 4032, 3024)
      context.fillStyle = '#20314d'
      context.fillRect(1200, 600, 1600, 1800)
      return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
    }),
    'base64',
  )
  const phonePhoto = withOrientation(landscape, 6)
  assert.deepEqual(imageFacts(phonePhoto), { width: 4032, height: 3024, exif: true })
  await photoInput().setInputFiles({ name: 'IMG_2041.jpeg', mimeType: 'image/jpeg', buffer: phonePhoto })
  await page.getByTestId('studio-cv-photo-chip').waitFor()
  assert.equal(await photoError().count(), 0, 'a phone photo is taken')
  assert.deepEqual(
    uploadedImage,
    { name: 'IMG_2041.jpg', type: 'image/jpeg', bytes: uploadedImage.bytes, width: 1500, height: 2000, exif: false },
    'the photo is sent upright, 2000 px long, without EXIF',
  )
  assert.ok(uploadedImage.bytes < 5 * 1024 * 1024)
  await photoInput().setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: PNG })
  await page.getByText('portrait.jpg', { exact: true }).waitFor()
  // A PNG is drawn on white and sent as a JPEG of its own size.
  assert.deepEqual(
    [uploadedImage.type, uploadedImage.width, uploadedImage.height, uploadedImage.exif],
    ['image/jpeg', 21, 30, false],
  )
  assert.equal(await photoError().count(), 0)
  assert.match(await page.getByTestId('studio-cv-photo-button').innerText(), /Replace the photo/)
  let portraitId = [...uploads.values()].at(-1).id
  await page.getByRole('button', { name: 'Academic & technical', exact: true }).click()
  await page.locator('[data-template="lab"]').click()
  assert.equal(await page.locator('[data-template="lab"]').getAttribute('aria-checked'), 'true')
  assert.equal(await cvAuto.getAttribute('aria-checked'), 'false')
  // A description that names nobody is refused under the field, as a topic is.
  await primary().fill('I am an accountant with five years of experience in a bank.')
  await review().click()
  await page.getByTestId('studio-prompt-error').waitFor()
  assert.equal(await page.locator('#studio-prompt-error').innerText(), cvNameRefusal)
  assert.equal(await page.getByTestId('studio-prompt-switch').count(), 0)
  // Every example names its person on the first line, and needs nothing else.
  for (const index of [0, 1, 2]) assert.match(await page.getByTestId(`studio-example-${index}`).innerText(), /^\p{Lu}\p{L}+ \p{Lu}\p{L}+ /u)
  await page.getByTestId('studio-example-0').click()
  assert.equal(await page.getByTestId('studio-prompt-error').count(), 0, 'the example clears the refusal')
  await auditBrief('cv brief')
  // A photo the server refuses is said under the photo and taken off, never in
  // the banner at the top; the next review makes the CV without it.
  refusePortrait = 'image_pixel_limit'
  const refusedDrafts = calls('/generation/drafts').length
  await review().click()
  await photoError().waitFor()
  refusePortrait = ''
  assert.equal(calls('/generation/drafts').length, refusedDrafts + 1)
  assert.match(await photoError().innerText(), /This photo cannot be used/)
  assert.equal(await page.getByTestId('studio-cv-photo-chip').count(), 0, 'the refused photo is taken off')
  assert.equal(await page.locator('.error-banner').count(), 0, 'not in the banner at the top')
  assert.equal(await page.getByTestId('studio-prompt-error').count(), 0)
  // Focus goes to the photo's button, which the refusal describes.
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'studio-cv-photo-button')
  assert.equal(await page.getByTestId('studio-cv-photo-button').getAttribute('aria-describedby'), 'studio-cv-photo-error')
  // On a phone the refusal is in view where the photo is, not at the top of the page.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('studio-cv-photo-button').scrollIntoViewIfNeeded()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: path.join(output, 'cv-photo-refused-390.png') })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await photoInput().setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: PNG })
  await page.getByTestId('studio-cv-photo-chip').waitFor()
  assert.equal(await photoError().count(), 0)
  portraitId = [...uploads.values()].at(-1).id
  const cv = await reviewNew()
  assert.equal(cv.feature_id, 'ai.cv')
  assert.equal(cv.output_format, 'pdf')
  assert.deepEqual(cv.source_ids, [], 'a CV sends no source files')
  assert.equal(cv.options.cv_template, 'lab', 'the picked template is sent')
  assert.equal(cv.options.portrait_asset_id, portraitId, 'the portrait is sent as its asset')
  assert.equal(cv.options.pages, undefined)
  assert.ok(!/\d+\s*(pages?|slides?)/i.test(cv.prompt), 'a CV example names no page count')
  // The review rail says the length, the template and the photo; nothing to step.
  assert.equal(await page.getByTestId('studio-pages').count(), 0, 'no page stepper for a CV')
  assert.equal(await page.getByTestId('studio-pages-more').count(), 0)
  assert.match(await page.getByTestId('studio-cv-length').innerText(), /Length\s+1–2 pages/)
  assert.match(await page.getByTestId('studio-cv-template-row').innerText(), /Template\s+Lab/)
  assert.match(await page.getByTestId('studio-cv-photo-row').innerText(), /Photo\s+Attached/)
  assert.equal(await page.getByTestId('studio-edit-outline').count(), 0, 'a CV has no outline to edit')
  assert.equal(await page.locator('.outline-summary').count(), 0)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `cv review/${width}: horizontal overflow`)
    const audit = await new AxeBuilder({ page }).include('.studio-layout').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    assert.deepEqual(audit.violations.map((violation) => violation.id), [], `cv review/${width}: accessibility`)
    await page.screenshot({ path: path.join(output, `cv-review-${width}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  // Back on the brief, the portrait can be taken off again before creating.
  await page.locator('.studio-steps button').first().click()
  await page.getByTestId('studio-cv-photo-chip').getByRole('button', { name: 'Remove' }).click()
  assert.equal(await page.getByTestId('studio-cv-photo-chip').count(), 0)
  const removed = await reviewSaved()
  assert.equal(removed.options.portrait_asset_id, undefined, 'a removed portrait is not sent')
  assert.equal(removed.options.cv_template, 'lab', 'the template stays picked')
  assert.match(await page.getByTestId('studio-cv-photo-row').innerText(), /Photo\s+None/)
  // A photo gone from storage by the time the draft is saved is said the same way.
  await page.locator('.studio-steps button').first().click()
  await photoInput().setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: PNG })
  await page.getByTestId('studio-cv-photo-chip').waitFor()
  refusePortrait = 'file_unavailable'
  await review().click()
  await photoError().waitFor()
  refusePortrait = ''
  assert.match(await photoError().innerText(), /The photo is no longer stored\. Add it again, or create the CV without a photo\./)
  assert.equal(await page.getByTestId('studio-cv-photo-chip').count(), 0)
  assert.equal(await page.locator('.error-banner').count(), 0)
  await photoInput().setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: PNG })
  await page.getByTestId('studio-cv-photo-chip').waitFor()
  const madePortrait = [...uploads.values()].at(-1).id
  assert.equal((await reviewSaved()).options.portrait_asset_id, madePortrait)
  assert.match(await page.getByTestId('studio-cv-photo-row').innerText(), /Photo\s+Attached/)
  await confirm()
  // A CV is changed as a whole: no page to choose, and examples about a CV.
  await page.getByTestId('job-revise').waitFor()
  assert.equal(await page.getByTestId('job-revise-scope').count(), 0, 'no page to choose in a CV')
  assert.match(await page.getByTestId('job-revise').innerText(), /Make the profile shorter/)
  // A change keeps the CV's photo and template. The server takes the photo back
  // whenever none is sent, so there is no remove button that would do nothing,
  // and the words that do leave it out are given; the picker shows the template
  // the change keeps, not an Auto that would keep it too.
  await page.getByTestId('job-revise-input').fill('Make the profile shorter.')
  await page.getByTestId('job-revise-submit').click()
  await page.waitForURL('**/app/create/*')
  await page.getByTestId('studio-revising').waitFor()
  await page.getByTestId('studio-cv-photo-chip').waitFor()
  assert.equal(await page.getByTestId('studio-cv-photo-chip').getByRole('button', { name: 'Remove' }).count(), 0)
  assert.equal(
    await page.getByTestId('studio-cv-photo-kept').innerText(),
    'A change keeps this photo. To make the CV without it, write “without a photo” in your request.',
  )
  assert.match(await page.getByTestId('studio-cv-photo-button').innerText(), /Replace the photo/)
  await page.locator('[data-template="lab"]').waitFor()
  assert.equal(await page.getByTestId('cv-template-auto').count(), 0, 'no Auto in a change')
  assert.equal(await page.locator('[data-template="lab"]').getAttribute('aria-checked'), 'true')
  assert.equal(await page.locator('.cv-card[aria-checked="true"]').count(), 1)
  const kept = await reviewSaved()
  assert.equal(kept.options.portrait_asset_id, madePortrait, 'the kept photo is sent back')
  assert.equal(kept.options.cv_template, undefined, 'keeping the template picks none')
  assert.match(await page.getByTestId('studio-cv-template-row').innerText(), /Template\s+Lab/)
  assert.match(await page.getByTestId('studio-cv-photo-row').innerText(), /Photo\s+Attached/)
  await page.locator('.studio-steps button').first().click()
  await page.locator('[data-template="syntax"]').click()
  assert.equal(await page.locator('[data-template="lab"]').getAttribute('aria-checked'), 'false')
  assert.equal((await reviewSaved()).options.cv_template, 'syntax', 'another template is picked for the change')
  assert.match(await page.getByTestId('studio-cv-template-row').innerText(), /Template\s+Syntax/)
  await page.locator('.studio-steps button').first().click()
  assert.equal(await page.locator('[data-template="syntax"]').getAttribute('aria-checked'), 'true')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `cv change/${width}: horizontal overflow`)
    await page.getByTestId('studio-brief').screenshot({ path: path.join(output, `cv-change-${width}.png`) })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await auditBrief('cv change')
  // A CV made with another service's PDF and title first sends neither. The
  // title's field is hidden for a CV, and the server reads a title for the
  // person's name: a school topic such as "Amir Temur" must not pass for one.
  await open('ai.pdf_topic')
  await upload().setInputFiles('tests/fixtures/research-notes.pdf')
  await page.locator('.source-chip').waitFor()
  await more().locator('summary').click()
  await page.getByTestId('studio-title').fill('Amir Temur')
  await page.getByTestId('studio-purpose').selectOption('ai.cv')
  assert.equal(await page.getByTestId('studio-title').count(), 0)
  await primary().fill('Marketing manager in Tashkent, five years at a food company.')
  await review().click()
  await page.getByTestId('studio-prompt-error').waitFor()
  assert.equal(lastDraftRequest().body.title, 'Marketing manager in Tashkent, five years at a food company.')
  await page.getByTestId('studio-prompt-anyway').click()
  await quotePanel().waitFor()
  assert.equal(lastDraftRequest().body.title, 'Marketing manager in Tashkent, five years at a food company.')
  assert.equal(lastDraftRequest().body.options.topic_given, true)
  await open('ai.pdf_topic')
  await upload().setInputFiles('tests/fixtures/research-notes.pdf')
  await page.locator('.source-chip').waitFor()
  await more().locator('summary').click()
  await page.getByTestId('studio-title').fill('Tarix fanidan referat')
  await page.getByTestId('studio-purpose').selectOption('ai.cv')
  await page.getByTestId('studio-example-1').click()
  const switched = await reviewNew()
  assert.equal(switched.title, 'Jasur Toshmatov', 'a new CV is named from its description')
  assert.deepEqual(switched.source_ids, [], 'the PDF stays with the PDF service')
  assert.equal(switched.options.cv_template, undefined, 'Auto is the server’s default, so nothing is sent')
  assert.match(await page.getByTestId('studio-cv-template-row').innerText(), /Template\s+Auto/)
  checks.push('A CV takes one description, a JPG/PNG portrait and a template; it has no page stepper or outline, and quotes as 1–2 pages')

  // 11. A CV starts with where it is made from: a description, a LinkedIn
  // profile (its Save to PDF, or screenshots) or an old CV. In the last two the
  // text is notes on top of the files, which go to the draft as its sources.
  const pdfBytes = await fs.readFile('tests/fixtures/research-notes.pdf')
  const sourceInput = () => page.getByTestId('studio-cv-source-input')
  const sourceError = () => page.getByTestId('studio-cv-source-error')
  const sourceChips = () => page.getByTestId('studio-cv-source-files').locator('li')
  const sourceNames = () => page.getByTestId('studio-cv-source-names').locator('li').allInnerTexts()
  const choice = (mode) => page.getByTestId(`studio-cv-source-${mode}`)
  const radio = (name) => page.getByRole('radio', { name })
  const linkError = () => page.getByTestId('studio-cv-link-error')
  const cvDrafts = () => calls('/generation/drafts').length
  const noOverflow = async (label) =>
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: horizontal overflow`)
  const focused = (testId) =>
    page.waitForFunction((value) => document.activeElement?.getAttribute('data-testid') === value, testId)
  await open('ai.cv')
  const sourceGroup = page.getByRole('group', { name: 'How do you want to make your CV?' })
  await sourceGroup.waitFor()
  assert.deepEqual(
    await sourceGroup.getByRole('radio').evaluateAll((nodes) => nodes.map((node) => node.value)),
    ['text', 'linkedin', 'file'],
  )
  assert.equal(await radio(/^Describe yourself/).isChecked(), true, 'a CV starts from a description')
  assert.ok(
    await page.evaluate(() => {
      const [purpose, choices, field] = ['studio-purpose', 'studio-cv-source', 'studio-primary-input'].map((id) =>
        document.querySelector(`[data-testid="${id}"]`),
      )
      const after = (first, second) => !!(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
      return after(purpose, choices) && after(choices, field)
    }),
    'the choice comes first, right after the service',
  )
  assert.equal(await sourceInput().count(), 0, 'a description takes no files')
  await page.getByTestId('studio-example-0').waitFor()
  // The arrows move between the choices, as in any radio group.
  await radio(/^Describe yourself/).focus()
  await page.keyboard.press('ArrowRight')
  assert.equal(await radio(/^From LinkedIn/).isChecked(), true, 'the arrow keys choose')
  assert.equal(await page.evaluate(() => document.activeElement?.value), 'linkedin')
  // From LinkedIn: how to save the profile, then the files and the notes.
  const linkedinSteps = page.getByTestId('studio-cv-linkedin-steps')
  await linkedinSteps.waitFor()
  assert.equal(await linkedinSteps.locator('li').count(), 3)
  assert.match(await linkedinSteps.innerText(), /More[\s\S]*Save to PDF[\s\S]*desktop site[\s\S]*screenshots/)
  assert.equal(await sourceInput().getAttribute('accept'), '.pdf,application/pdf,.jpg,.jpeg,.png,image/jpeg,image/png')
  assert.equal(await page.getByTestId('studio-example-0').count(), 0, 'a whole description is no example of notes')
  assert.match(await page.locator('.studio-primary-field > span').innerText(), /What job are you applying for, or what should change\? \(optional\)/)
  assert.match(await page.getByTestId('studio-describe-hint').innerText(), /Everything in the files goes on the CV/)
  // The portrait stays its own control, and says the files are not it.
  await page.getByTestId('studio-cv-photo-button').waitFor()
  assert.match(await page.getByTestId('studio-cv-photo-separate').innerText(), /not taken from the files above/)
  assert.equal(await review().isDisabled(), true, 'nothing to make the CV from yet')
  // A bare profile link is never sent: LinkedIn cannot be read, so the steps are said under the field.
  let draftsBefore = cvDrafts()
  await primary().fill('https://www.linkedin.com/in/fixture-person/')
  await review().click()
  await linkError().waitFor()
  assert.equal(cvDrafts(), draftsBefore, 'a bare link is not sent')
  assert.match(await page.locator('#studio-cv-link-error').innerText(), /We cannot open LinkedIn links/)
  assert.equal(await linkError().getByTestId('studio-cv-link-steps').locator('li').count(), 3)
  assert.equal(await primary().getAttribute('aria-describedby'), 'studio-cv-link-error')
  assert.equal(await primary().getAttribute('aria-invalid'), 'true')
  await focused('studio-primary-input')
  assert.equal(await page.getByTestId('studio-cv-use-linkedin').count(), 0, 'already From LinkedIn')
  assert.equal(await page.locator('.error-banner').count(), 0)
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow('cv link steps/390')
  await linkError().scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(output, 'cv-source-link-steps-390.png') })
  await page.setViewportSize({ width: 1440, height: 1000 })
  // Notes alone are not enough: the profile is what the CV is made from.
  await primary().fill('Applying for a data analyst job at a bank.')
  assert.equal(await linkError().count(), 0, 'typing takes the steps away')
  await review().click()
  await sourceError().waitFor()
  assert.equal(cvDrafts(), draftsBefore, 'no file, no request')
  assert.equal(await sourceError().innerText(), 'Add your LinkedIn profile: the PDF or the screenshots.')
  await focused('studio-cv-source-button')
  assert.equal(await page.getByTestId('studio-cv-source-button').getAttribute('aria-describedby'), 'studio-cv-source-error')
  // A Word file is no LinkedIn export, and is never uploaded.
  let sourceUploads = calls('/files/uploads').length
  await sourceInput().setInputFiles({ name: 'profile.docx', mimeType: DOCX, buffer: Buffer.from('PK fixture') })
  await page.getByText('From LinkedIn takes a PDF or JPG/PNG screenshots.').waitFor()
  assert.equal(calls('/files/uploads').length, sourceUploads)
  await sourceInput().setInputFiles({ name: 'Profile.pdf', mimeType: 'application/pdf', buffer: pdfBytes })
  await sourceChips().first().waitFor()
  assert.equal(await sourceError().count(), 0, 'a file taken clears the refusal')
  assert.deepEqual(await sourceChips().allInnerTexts(), ['Profile.pdf'])
  const profileId = [...uploads.values()].at(-1).id
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow('cv linkedin brief/390')
  await auditBrief('cv source linkedin 390')
  await page.setViewportSize({ width: 1440, height: 1000 })
  const fromLinkedin = await reviewNew()
  assert.equal(fromLinkedin.feature_id, 'ai.cv')
  assert.equal(fromLinkedin.options.cv_source, 'linkedin')
  assert.deepEqual(fromLinkedin.source_ids, [profileId])
  assert.equal(fromLinkedin.prompt, 'Applying for a data analyst job at a bank.')
  assert.equal(fromLinkedin.options.portrait_asset_id, undefined, 'a source file is never the portrait')
  // The rail says what the CV is made from, by name, read back with the draft.
  assert.match(await page.getByTestId('studio-cv-source-row').innerText(), /Made from\s+LinkedIn profile/)
  assert.deepEqual(await sourceNames(), ['Profile.pdf'])
  assert.equal(await page.locator('.generation-summary h2').innerText(), cvFilePerson, 'named from the file')
  await page.setViewportSize({ width: 390, height: 1000 })
  await noOverflow('cv source review/390')
  {
    const audit = await new AxeBuilder({ page }).include('.studio-layout').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    assert.deepEqual(audit.violations.map((violation) => violation.id), [], 'cv source review/390: accessibility')
  }
  await page.screenshot({ path: path.join(output, 'cv-source-review-390.png'), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  // The draft opened again keeps its mode and its files.
  await page.locator('.studio-steps button').first().click()
  assert.equal(await radio(/^From LinkedIn/).isChecked(), true)
  assert.deepEqual(await sourceChips().allInnerTexts(), ['Profile.pdf'])

  // Screenshots instead of the PDF: three at once, up to ten in all, and no notes.
  await open('ai.cv')
  await choice('linkedin').click()
  const shot = (index) => ({ name: `profile-${index}.png`, mimeType: 'image/png', buffer: PNG })
  await sourceInput().setInputFiles([shot(1), shot(2), shot(3)])
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="studio-cv-source-files"] li').length === 3)
  await sourceChips().nth(2).getByRole('button', { name: 'Remove file: profile-3.png' }).click()
  assert.deepEqual(await sourceChips().allInnerTexts(), ['profile-1.png', 'profile-2.png'])
  await sourceInput().setInputFiles(shot(3))
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="studio-cv-source-files"] li').length === 3)
  sourceUploads = calls('/files/uploads').length
  await sourceInput().setInputFiles(Array.from({ length: 8 }, (_, index) => shot(index + 4)))
  await page.getByText('Up to 10 files. Remove some to add others.').waitFor()
  assert.equal(calls('/files/uploads').length, sourceUploads, 'an eleventh file is never uploaded')
  assert.equal(await review().isDisabled(), false, 'the files alone are enough')
  const fromShots = await reviewNew()
  assert.equal(fromShots.options.cv_source, 'linkedin')
  assert.equal(fromShots.source_ids.length, 3)
  assert.equal(fromShots.prompt, '', 'no notes are sent as none, not as the service’s name')
  assert.equal(fromShots.options.portrait_asset_id, undefined, 'a screenshot is a page to read, not the portrait')
  assert.deepEqual(await sourceNames(), ['profile-1.png', 'profile-2.png', 'profile-3.png'])

  // From an old CV: a PDF, a Word file or photos. What the server cannot read,
  // or reads as another kind, is said beside the files, never in the banner.
  await open('ai.cv')
  await choice('file').click()
  assert.equal(await radio(/^From an old CV/).isChecked(), true)
  assert.equal(await page.getByTestId('studio-cv-linkedin-steps').count(), 0)
  assert.equal(
    await sourceInput().getAttribute('accept'),
    `.pdf,application/pdf,.docx,${DOCX},.jpg,.jpeg,.png,image/jpeg,image/png`,
  )
  await sourceInput().setInputFiles({ name: 'blank-scan.pdf', mimeType: 'application/pdf', buffer: pdfBytes })
  await sourceChips().first().waitFor()
  draftsBefore = cvDrafts()
  await review().click()
  await sourceError().waitFor()
  assert.equal(cvDrafts(), draftsBefore + 1, 'the server read this one')
  assert.equal(await sourceError().innerText(), cvFileRefusal.cv_file_unreadable)
  assert.equal(await page.locator('.error-banner').count(), 0, 'not in the banner at the top')
  await focused('studio-cv-source-button')
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow('cv unreadable/390')
  await page.getByTestId('studio-cv-source-button').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(output, 'cv-source-unreadable-390.png') })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await sourceChips().first().getByRole('button', { name: 'Remove file: blank-scan.pdf' }).click()
  assert.equal(await sourceError().count(), 0)
  await sourceInput().setInputFiles({ name: 'Old-CV.docx', mimeType: DOCX, buffer: Buffer.from('PK fixture docx') })
  await page.getByTestId('studio-cv-source-files').getByText('Old-CV.docx').waitFor()
  const oldCvId = [...uploads.values()].at(-1).id
  refuseCvKind = true
  await review().click()
  await sourceError().waitFor()
  assert.equal(await sourceError().innerText(), cvFileRefusal.cv_file_kind)
  assert.equal(await page.locator('.error-banner').count(), 0)
  await primary().fill('Now applying for a project manager role. Add my 2024 PMP certificate.')
  const fromOldCv = await reviewNew()
  assert.equal(fromOldCv.options.cv_source, 'file')
  assert.deepEqual(fromOldCv.source_ids, [oldCvId])
  assert.match(await page.getByTestId('studio-cv-source-row').innerText(), /Made from\s+Old CV/)
  assert.deepEqual(await sourceNames(), ['Old-CV.docx'])
  await page.locator('.studio-steps button').first().click()
  await page.getByTestId('studio-cv-source-files').getByText('Old-CV.docx').waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow('cv old cv brief/390')
  await auditBrief('cv source file 390')
  await page.setViewportSize({ width: 1440, height: 1000 })
  // Back to Describe: the files stay with their mode and are not sent.
  await choice('text').click()
  assert.equal(await sourceInput().count(), 0)
  assert.equal(await page.getByTestId('studio-cv-source-files').count(), 0)
  await page.getByTestId('studio-example-0').click()
  const described = await reviewSaved()
  assert.equal(described.options.cv_source, 'text')
  assert.deepEqual(described.source_ids, [], 'a description sends no files')
  assert.match(await page.getByTestId('studio-cv-source-row').innerText(), /Made from\s+Your description/)
  assert.equal(await page.getByTestId('studio-cv-source-names').count(), 0)
  await page.locator('.studio-steps button').first().click()
  await choice('file').click()
  await page.getByTestId('studio-cv-source-files').getByText('Old-CV.docx').waitFor()

  // No name in the notes nor in the file: asked for under the notes, as for a description.
  await open('ai.cv')
  await choice('file').click()
  await sourceInput().setInputFiles({ name: 'nameless-scan.png', mimeType: 'image/png', buffer: PNG })
  await sourceChips().first().waitFor()
  await review().click()
  await page.getByTestId('studio-prompt-error').waitFor()
  assert.equal(await page.locator('#studio-prompt-error').innerText(), cvNameRefusal)
  await focused('studio-primary-input')
  await primary().fill('Dilnoza Rahimova\nApplying for a teacher job.')
  assert.equal((await reviewNew()).title, 'Dilnoza Rahimova')

  // A description that is a bare link shows the steps, and the way to From LinkedIn.
  await open('ai.cv')
  draftsBefore = cvDrafts()
  await primary().fill('linkedin.com/in/fixture-person')
  await review().click()
  await linkError().waitFor()
  assert.equal(cvDrafts(), draftsBefore, 'a bare link is not sent')
  await page.getByTestId('studio-cv-use-linkedin').click()
  assert.equal(await radio(/^From LinkedIn/).isChecked(), true)
  assert.equal(await linkError().count(), 0)
  await page.getByTestId('studio-cv-linkedin-steps').waitFor()
  // A sentence round a link is the server's to read; it says the same.
  await choice('text').click()
  await primary().fill('Please make my CV from my profile at linkedin.com/in/fixture-person, thank you very much.')
  await review().click()
  await linkError().waitFor()
  assert.equal(cvDrafts(), draftsBefore + 1)
  assert.equal(await linkError().getByTestId('studio-cv-link-steps').locator('li').count(), 3)
  assert.equal(await page.locator('.error-banner').count(), 0)

  // The PDF and Slides services never get a CV's mode or files.
  for (const feature of featureIds) {
    await open('ai.cv')
    await choice('linkedin').click()
    await sourceInput().setInputFiles({ name: 'Profile.pdf', mimeType: 'application/pdf', buffer: pdfBytes })
    await sourceChips().first().waitFor()
    await page.getByTestId('studio-purpose').selectOption(feature)
    assert.equal(await page.getByTestId('studio-cv-source').count(), 0)
    assert.equal(await sourceInput().count(), 0)
    await primary().fill('A report on solar power in Central Asia.')
    const other = await reviewNew()
    assert.equal(other.feature_id, feature)
    assert.equal(other.options.cv_source, undefined, `${feature} gets no cv_source`)
    assert.deepEqual(other.source_ids, [], `${feature} gets no CV files`)
  }
  checks.push(
    'A CV starts from a description, LinkedIn (PDF or screenshots) or an old CV (PDF, Word, photos): the mode and files are sent, a bare link shows the steps, and refusals are said beside their control',
  )

  for (const locale of ['en', 'uz', 'ru']) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const feature of serviceIds) {
        await open(feature, locale)
        assert.equal(await more().getAttribute('open'), null)
        assert.equal(await page.locator('html').getAttribute('lang'), locale)
        if (feature === 'ai.cv') {
          // The photo hint points to a "Photo" mark: it is there at every width,
          // and read out, on the templates that take a photo.
          await page.getByRole('button', { name: 'Modern', exact: true }).click()
          const mark = page.locator('[data-template="azure_side"] [data-testid="cv-photo-mark"]')
          assert.equal(await mark.isVisible(), true, `cv/${locale}/${width}: the photo mark is shown`)
          assert.equal(await mark.innerText(), { en: 'Photo', uz: 'Foto', ru: 'Фото' }[locale])
          assert.match(await page.locator('[data-template="azure_side"]').evaluate((node) => node.textContent), /Azure Side\s+(Photo|Foto|Фото)/)
          assert.ok(
            await mark.evaluate((node) => {
              const card = node.closest('.cv-card').getBoundingClientRect()
              const box = node.getBoundingClientRect()
              return box.left >= card.left && box.right <= card.right
            }),
            `cv/${locale}/${width}: the photo mark stays in its card`,
          )
          assert.match(
            await page.locator('.studio-cv-template').evaluate((node) => node.closest('.studio-form').textContent),
            { en: /marked “Photo”/, uz: /«Foto» belgisi/, ru: /пометкой «Фото»/ }[locale],
          )
        }
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme)
          await page.evaluate(
            () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          )
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
            `${feature}/${locale}/${width}/${theme}: horizontal overflow`,
          )
          visualChecks += 1
          const result = await new AxeBuilder({ page })
            .include('.studio-layout')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
          assert.deepEqual(
            result.violations.map((violation) => ({
              id: violation.id,
              nodes: violation.nodes.map((node) => ({ target: node.target, failure: node.failureSummary })),
            })),
            [],
            `${feature}/${locale}/${width}/${theme}: accessibility violations`,
          )
        }
        await page.screenshot({
          path: path.join(output, `${feature}-${locale}-${width}.png`),
          fullPage: true,
        })
        // A CV's two file modes, in every language: the LinkedIn steps and the
        // old CV's upload area fit, and pass, on a phone as on a desktop.
        if (feature === 'ai.cv')
          for (const mode of ['linkedin', 'file']) {
            await page.getByTestId(`studio-cv-source-${mode}`).click()
            await page.getByTestId('studio-cv-source-input').waitFor({ state: 'attached' })
            for (const theme of ['light', 'dark']) {
              await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme)
              await page.evaluate(
                () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
              )
              const label = `${feature}/${mode}/${locale}/${width}/${theme}`
              assert.equal(
                await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
                false,
                `${label}: horizontal overflow`,
              )
              visualChecks += 1
              const result = await new AxeBuilder({ page })
                .include('.studio-layout')
                .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
                .analyze()
              assert.deepEqual(
                result.violations.map((violation) => ({
                  id: violation.id,
                  nodes: violation.nodes.map((node) => ({ target: node.target, failure: node.failureSummary })),
                })),
                [],
                `${label}: accessibility violations`,
              )
            }
            await page.getByTestId('studio-brief').screenshot({
              path: path.join(output, `${feature}-${mode}-${locale}-${width}.png`),
            })
          }
      }
    }
  }
  checks.push(
    'Every service passes EN/UZ/RU desktop/mobile checks in both themes with no overflow or WCAG A/AA findings',
  )
  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [], 'Every API call is explicitly covered by the offline fixture')
  assert.deepEqual(external, [], 'No external AI/provider calls occur')
  const result = {
    status: 'passed',
    at: new Date().toISOString(),
    checks,
    errors,
    functionalGroups: checks.length - 1,
    draftRequests: calls('/generation/drafts').length,
    jobSubmissionRequests: countJobs(),
    acceptedJobs: jobs.size,
    visualChecks,
  }
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(result, null, 2))
  await Promise.all(
    ['failure.json', 'failure.png'].map((name) => fs.rm(path.join(output, name), { force: true })),
  )
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
  await fs.writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify({ error: error.message, page: page.url(), checks, errors, unexpected, external }, null, 2),
  )
  throw error
} finally {
  await browser.close()
}
