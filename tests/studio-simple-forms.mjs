import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

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
let activeFeature = ''
let expiredFile = false
let visualChecks = 0
let failJobOnce = false
let expireJobOnce = false
const id = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
const future = () => new Date(Date.now() + 300000).toISOString()
const featureIds = [
  'ai.pdf_topic',
  'ai.pdf_text',
  'ai.pdf_sources',
  'ai.pptx',
  'ai.source_to_slides',
  'ai.rewrite',
  'ai.regenerate_slide',
  'study.summary',
  'study.flashcards',
  'study.pdf_qa',
  'study.handwriting',
  'study.definitions',
  'study.answer_key',
  'study.report_format',
  'study.references',
  'study.writing_feedback',
  'school.explain',
  'school.adaptive',
  'teacher.lesson_plan',
  'teacher.worksheet',
  'teacher.answer_key',
  'teacher.syllabus',
  'teacher.feedback',
]
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
  provider: {
    mode: 'openai',
    configured: true,
    image_configured: false,
    handwriting_configured: false,
  },
  features: featureIds.map((feature) => ({
    id: feature,
    name: feature,
    surface: 'generate',
    eligible: feature !== 'study.handwriting',
    requires_provider: feature === 'study.handwriting',
    parameter_schema: {
      length: { minimum: 1, maximum: 2 },
      output_locale: { enum: ['en', 'uz', 'ru'] },
      output_format: { enum: feature.startsWith('teacher.') ? ['pdf'] : ['pdf', 'pptx'] },
      density: { enum: ['rich', 'balanced', 'airy'] },
    },
    locales: ['en', 'uz', 'ru'],
  })),
  limits: { sections: 2, slides: 4, questions: 5 },
  templates: [],
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
const authoredDraft = {
  ...structuredClone(sourceDraft),
  id: '00000000-0000-4000-8000-555555555555',
  feature_id: 'ai.pdf_topic',
  prompt: '',
  source_ids: [],
  output_format: 'pdf',
}
drafts.set(authoredDraft.id, authoredDraft)
const savedTemplate = {
  id: '00000000-0000-4000-8000-444444444444',
  name: 'Authored classroom template',
  output_locale: 'ru',
  content: {
    ...structuredClone(sourceDraft.content),
    feature_id: 'teacher.lesson_plan',
    output_format: 'pdf',
    options: { length: 1, subject: 'Biology', grade: '6' },
  },
}
const project = {
  id: '00000000-0000-4000-8000-666666666666',
  title: 'Practised fixture project',
  version: 1,
  attempts: [{ weak_topics: ['Fractions'] }],
  expires_at: future(),
}

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
  if (endpoint === '/plans') return json({ plans: [], checkout_enabled: false })
  if (endpoint === '/usage') return json({ plan: 'free', remaining: { ai_credits: 100, file_tasks: 100 } })
  if (endpoint === '/studio/config') return json(config)
  if (endpoint === '/education/projects') return json({ results: [project], limit: 10 })
  if (endpoint === '/templates') return json({ results: [], published: [] })
  if (endpoint === `/templates/${savedTemplate.id}`) return json(savedTemplate)
  if (endpoint === '/files/uploads')
    return json(
      {
        id: id(),
        name: 'research-notes.pdf',
        size_bytes: 4096,
        page_count: activeFeature === 'study.handwriting' ? 1 : 2,
        mime_type: 'application/pdf',
        state: 'ready',
      },
      201,
    )
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
    const draft = {
      id: id(),
      version: 1,
      provider_mode: config.provider.mode,
      expires_at: future(),
      ...structuredClone(body),
      content: {
        title: body.title,
        sections: Array.from({ length: body.options.length }, (_, index) => ({
          id: `s${index + 1}`,
          heading: `Section ${index + 1}`,
          body: index ? '' : body.source_text || '',
          notes: '',
        })),
        questions: [],
        citations: [],
      },
    }
    if (['ai.rewrite', 'ai.regenerate_slide'].includes(body.feature_id)) {
      const source = drafts.get(body.options.source_draft_id)
      draft.source_ids = [...source.source_ids]
      draft.content = structuredClone(source.content)
      draft.revision = { selected_section_ids: body.options.selected_section_ids }
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
        meters: [{ meter: 'ai_credits', amount: 0 }],
        parameters: {
          generation_draft_id: draft.id,
          generation_draft_version: draft.version,
          generation_stage: body.stage || 'document',
        },
      }
      quotes.set(quote.id, quote)
      return json(quote, 201)
    }
    if (method === 'PATCH') Object.assign(draft, structuredClone(body), { version: draft.version + 1 })
    return json(draft)
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
    if (!quote.affordable) return failure('quota_exceeded')
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
      settled_meters: {},
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
  activeFeature = feature
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
const refreshQuote = () => quotePanel().getByRole('button', { name: 'Refresh estimate', exact: true })
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

async function confirm() {
  const beforeJobs = countJobs()
  await generate().click()
  await page.waitForURL('**/app/jobs/*')
  await page.locator('.job-detail').waitFor()
  assert.equal(countJobs(), beforeJobs + 1, 'Confirmation submits exactly one job')
  assert.ok(calls('/jobs').at(-1).idempotencyKey, 'Confirmation retains job idempotency')
}

try {
  await open('ai.pdf_topic')
  assert.equal(await more().getAttribute('open'), null, 'Advanced fields start collapsed')
  assert.equal(await review().isDisabled(), true, 'An empty topic cannot be submitted')
  assert.equal(
    await page.locator('.studio-steps > button:visible').count(),
    2,
    'Only two primary stages are shown',
  )
  assert.equal(
    await page.getByTestId('studio-brief').locator('textarea:visible').count(),
    1,
    'One main text field',
  )
  await primary().fill('Explain how to grow tomatoes on a small balcony.')
  const simple = await reviewNew()
  assert.equal(simple.prompt, 'Explain how to grow tomatoes on a small balcony.')
  assert.equal(simple.options.length, 2, 'Default length respects the free PDF section cap')
  assert.equal(simple.options.subject, undefined)
  assert.equal(simple.options.grade, undefined)
  await confirm()
  checks.push(
    'One topic → one review → explicit confirmation; title/defaults derived; no generation before confirmation',
  )

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

  for (const feature of [
    'ai.pdf_text',
    'ai.source_to_slides',
    'study.summary',
    'study.flashcards',
    'study.definitions',
    'study.answer_key',
    'study.report_format',
    'study.references',
    'study.writing_feedback',
    'teacher.answer_key',
    'teacher.syllabus',
    'teacher.feedback',
  ]) {
    await open(feature)
    assert.equal(await review().isDisabled(), true, `${feature}: source is required`)
    const text =
      'Plants need light and water. Roots absorb water from the soil. Leaves use sunlight to make food.'
    await primary().fill(text)
    const created = await reviewNew()
    assert.equal(created.source_text, text, `${feature}: primary text is grounded source material`)
    assert.deepEqual(created.source_ids, [])
    assert.ok(
      created.options.length <=
        (created.output_format === 'pptx' ? config.limits.slides : config.limits.sections),
    )
  }
  checks.push(
    'Text/PDF, slides, study and teacher source-based tools require source input and preserve it as source_text',
  )

  // No AI tool forces an upload: typed material is a source in its own right.
  await open('ai.pdf_sources')
  assert.equal(await review().isDisabled(), true, 'but something has to be given')
  await primary().fill('Tide tables list high and low water for each day of the year.')
  const typedSources = await reviewNew()
  assert.deepEqual(typedSources.source_ids, [], 'nothing was uploaded')
  assert.equal(typedSources.source_text, 'Tide tables list high and low water for each day of the year.')

  await open('ai.pdf_sources')
  await upload().setInputFiles('tests/fixtures/research-notes.pdf')
  await page.locator('.source-chip').waitFor()
  const pdfSources = await reviewNew()
  assert.equal(pdfSources.source_ids.length, 1, 'and a document still works when there is one')
  checks.push('Creating from PDFs accepts typed material or an upload, and demands neither in particular')

  await open('study.summary')
  await upload().setInputFiles('tests/fixtures/research-notes.pdf')
  await page.locator('.source-chip').waitFor()
  assert.equal(await primary().inputValue(), '')
  const sourceOnly = await reviewNew()
  assert.equal(sourceOnly.source_ids.length, 1, 'A source PDF can replace pasted source text')
  checks.push('Uploaded PDF substitutes for pasted source text without another required text field')

  // A question still needs something to answer from, but that can be pasted.
  await open('study.pdf_qa')
  await primary().fill('How do leaves use sunlight?')
  assert.equal(await review().isDisabled(), true, 'a question alone has nothing to answer from')
  const pasted = page.getByTestId('studio-answer-source')
  await pasted.fill('Leaves absorb light with chlorophyll and convert it into sugars.')
  const answered = await reviewNew()
  assert.equal(answered.prompt, 'How do leaves use sunlight?')
  assert.deepEqual(answered.source_ids, [], 'no upload was needed')
  assert.match(answered.source_text, /chlorophyll/)

  await open('study.pdf_qa')
  await upload().setInputFiles('tests/fixtures/research-notes.pdf')
  await page.locator('.source-chip').waitFor()
  assert.equal(await review().isDisabled(), true, 'a document alone is not a question')
  await primary().fill('How do leaves use sunlight?')
  const question = await reviewNew()
  assert.equal(question.source_ids.length, 1)
  checks.push('PDF Q&A answers from a pasted source or an uploaded one, and needs the question either way')

  for (const feature of ['teacher.lesson_plan', 'teacher.worksheet', 'school.explain']) {
    await open(feature)
    assert.equal(await page.getByTestId('studio-brief').locator('textarea:visible').count(), 1)
    assert.equal(await more().getAttribute('open'), null)
    await primary().fill('Teach fractions to grade 5 using a short everyday example.')
    const created = await reviewNew()
    assert.equal(created.options.subject, undefined, 'Optional subject is not sent as an empty requirement')
    assert.equal(created.options.grade, undefined, 'Optional grade is not sent as an empty requirement')
  }
  checks.push(
    'Teacher and school tools accept one clear request without forcing subject, grade or objectives',
  )

  await open('teacher.lesson_plan')
  await primary().fill('A short lesson about fractions.')
  await more().locator('summary').first().click()
  await page.getByLabel('Title (optional)', { exact: false }).fill('Fraction workshop')
  await page.getByRole('combobox', { name: 'Output language', exact: true }).selectOption('ru')
  await page.getByTestId('studio-length').fill('1')
  await page.getByTestId('studio-density-rich').click()
  await page.getByTestId('studio-tone').selectOption('formal')
  await page.getByLabel('Subject', { exact: true }).fill('Mathematics')
  await page.getByLabel('Grade or level', { exact: true }).fill('5')
  await page.getByLabel('Learning objectives', { exact: true }).fill('Compare simple fractions.')
  const advanced = await reviewNew()
  assert.equal(advanced.title, 'Fraction workshop')
  assert.equal(advanced.output_locale, 'ru')
  assert.equal(advanced.options.length, 1)
  assert.equal(advanced.options.subject, 'Mathematics')
  assert.equal(advanced.options.grade, '5')
  assert.equal(advanced.options.objectives, 'Compare simple fractions.')
  assert.equal(advanced.options.density, 'rich', 'text density reaches the draft')
  assert.equal(advanced.options.style, 'formal', 'tone reaches the draft')
  checks.push(
    'Expanded options preserve title, language, pages, density, tone and teaching details in the quoted draft',
  )

  await page.getByTestId('studio-edit-outline').click()
  await page.locator('.outline-panel').waitFor()
  await page.getByLabel('Section heading', { exact: true }).first().fill('A better introduction')
  assert.equal(await quotePanel().count(), 0, 'Editing invalidates the previous quote')
  const beforeJobs = countJobs()
  const beforeEdits = requests.length
  await page.locator('.outline-panel').getByRole('button', { name: 'Review generation', exact: true }).click()
  await quotePanel().waitFor()
  assert.equal(countJobs(), beforeJobs)
  const edits = requests
    .slice(beforeEdits)
    .filter(
      (request) => ['POST', 'PATCH'].includes(request.method) && request.path.startsWith('/generation/'),
    )
  assert.deepEqual(
    edits.map((request) => request.method),
    ['PATCH', 'POST'],
  )
  const amended = edits.find((request) => request.method === 'PATCH')
  assert.equal(amended.body.content.sections[0].heading, 'A better introduction')
  assert.equal(edits.at(-1).body.version, amended.body.version + 1)
  checks.push(
    'Optional outline edit invalidates the quote and reviews the newly saved version before generation',
  )

  await page.goto(`${origin}/en/app/create/${authoredDraft.id}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('studio-brief').waitFor()
  assert.equal(await primary().inputValue(), '')
  assert.equal(await review().isEnabled(), true, 'Authored section bodies do not need another prompt')
  const beforeAuthored = requests.length
  await review().click()
  await quotePanel().waitFor()
  const authoredWrites = requests.slice(beforeAuthored).filter((request) => request.method !== 'GET')
  assert.deepEqual(
    authoredWrites.map((request) => request.method),
    ['PATCH', 'POST'],
  )
  assert.equal(drafts.get(authoredDraft.id).content.sections[0].body, 'First reviewed paragraph.')
  checks.push('An existing authored draft reviews without requiring a new topic and retains its content')

  await page.goto(`${origin}/en/app/create?template=${savedTemplate.id}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('studio-brief').waitFor()
  await page.waitForFunction(
    () => document.querySelector('[data-testid="studio-purpose"]')?.value === 'teacher.lesson_plan',
  )
  assert.equal(await primary().inputValue(), '')
  assert.equal(await review().isEnabled(), true, 'A content template does not require extra instructions')
  const beforeTemplate = requests.length
  await review().click()
  await quotePanel().waitFor()
  const templateWrites = requests.slice(beforeTemplate).filter((request) => request.method !== 'GET')
  assert.deepEqual(
    templateWrites.map((request) => request.method),
    ['POST', 'PATCH', 'POST'],
  )
  const templated = lastDraftRequest().body
  assert.equal(templated.feature_id, 'teacher.lesson_plan')
  assert.equal(templated.options.length, 1)
  assert.equal(templated.options.subject, 'Biology')
  assert.equal(templated.options.grade, '6')
  assert.equal(templated.options.template_id, savedTemplate.id)
  assert.equal(templated.output_locale, 'ru')
  assert.equal(templateWrites[1].body.content.sections[0].body, 'First reviewed paragraph.')
  checks.push(
    'A saved content template needs no extra instructions and retains its tool, language, content and options',
  )

  await open('school.adaptive')
  assert.equal(await review().isDisabled(), true)
  assert.equal(await primary().count(), 0, 'Adaptive practice only needs a saved project')
  await page.getByRole('combobox', { name: /^Saved projects/ }).selectOption(project.id)
  const adaptive = await reviewNew()
  assert.equal(adaptive.options.project_id, project.id)
  checks.push('Adaptive practice needs a saved project rather than another required prompt')

  await open('ai.rewrite')
  assert.equal(await review().isDisabled(), true)
  await page.getByRole('combobox', { name: 'Original draft', exact: true }).selectOption(sourceDraft.id)
  await page.locator('.revision-section input:checked').first().waitFor()
  const revision = await reviewNew()
  assert.equal(revision.options.source_draft_id, sourceDraft.id)
  assert.equal(revision.options.source_draft_version, sourceDraft.version)
  assert.ok(revision.options.selected_section_ids.length > 0)
  const createdRevision = [...drafts.values()].find(
    (draft) => draft.feature_id === 'ai.rewrite' && draft.options.source_draft_id === sourceDraft.id,
  )
  assert.deepEqual(createdRevision.source_ids, sourceDraft.source_ids)
  await page.getByTestId('studio-edit-outline').click()
  await page.locator('.outline-panel').waitFor()
  await page.getByLabel('Section heading', { exact: true }).first().fill('Revised source-backed heading')
  const beforeRevisionEdit = requests.length
  await page.locator('.outline-panel').getByRole('button', { name: 'Review generation', exact: true }).click()
  await quotePanel().waitFor()
  const revisionSave = requests.slice(beforeRevisionEdit).find((request) => request.method === 'PATCH')
  assert.deepEqual(
    revisionSave.body.source_ids,
    sourceDraft.source_ids,
    'Revision edits retain the attached PDF source',
  )
  assert.equal(revisionSave.body.content.sections[0].heading, 'Revised source-backed heading')
  checks.push(
    'Rewriting retains source selection, version and preselected sections; optional edits preserve the attached PDF',
  )

  await open('study.handwriting')
  assert.equal(await primary().count(), 0, 'Handwriting starts with its file requirement')
  assert.equal(await upload().getAttribute('multiple'), null)
  assert.equal(await upload().getAttribute('accept'), '.png,.jpg,.jpeg,.pdf')
  await upload().setInputFiles('tests/fixtures/research-notes.pdf')
  await page.locator('.source-chip').waitFor()
  assert.equal(
    await review().isDisabled(),
    true,
    'A missing handwriting provider cannot be bypassed by simplifying the form',
  )
  checks.push('Handwriting remains a single-file flow and honors missing-provider restrictions')

  // The Telegram bot sends the user here as `?file_id=…` after they upload a
  // document to the chat. The file must carry across, or they upload it twice.
  const linked = id()
  activeFeature = 'ai.pdf_sources'
  await page.goto(`${origin}/en/app/create?feature=ai.pdf_sources&file_id=${linked}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByTestId('studio-brief').waitFor()
  await page.locator('.source-chip').first().waitFor()
  assert.equal(await page.locator('.source-chip').count(), 1)
  assert.match(await page.locator('.source-chip').first().innerText(), /research-notes\.pdf/)
  await reviewNew()
  assert.deepEqual(lastDraftRequest().body.source_ids, [linked], 'The linked file is the source')
  checks.push('A file_id deep link from the bot arrives attached and needs no second upload')

  // A bot draft can hold several files, so the link repeats the parameter.
  const many = [id(), id(), id()]
  await page.goto(
    `${origin}/en/app/create?feature=ai.pdf_sources&${many.map((f) => `file_id=${f}`).join('&')}`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.getByTestId('studio-brief').waitFor()
  // They attach one at a time, so wait for the last rather than the first.
  await page.locator('.source-chip').nth(many.length - 1).waitFor()
  assert.equal(await page.locator('.source-chip').count(), many.length)
  await reviewNew()
  assert.deepEqual(lastDraftRequest().body.source_ids, many, 'Every linked file is a source, in order')
  checks.push('A multi-file bot draft arrives with all of its documents attached in order')

  expiredFile = true
  await page.goto(`${origin}/en/app/create?feature=ai.pdf_sources&file_id=${id()}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByTestId('studio-brief').waitFor()
  await page.waitForTimeout(400)
  assert.equal(await page.locator('.source-chip').count(), 0, 'An expired link attaches nothing')
  expiredFile = false
  checks.push('A deep link to a file that has aged out attaches nothing instead of failing later')

  // The same link on the education launcher must survive the hop to the tool.
  await page.goto(`${origin}/en/app/study?file_id=${linked}`, { waitUntil: 'domcontentloaded' })
  const tool = page.locator('.education-tool').first()
  await tool.waitFor()
  assert.match(await tool.getAttribute('href'), new RegExp(`file_id=${linked}$`))
  checks.push('The education launcher forwards the linked file to the tool the learner picks')

  affordable = false
  await open('ai.pdf_topic')
  await primary().fill('A short fixture document.')
  await reviewNew()
  assert.equal(await generate().isDisabled(), true)
  affordable = true
  checks.push('Unaffordable quotes cannot submit generation')

  for (const locale of ['en', 'uz', 'ru']) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const feature of ['ai.pdf_topic', 'study.summary', 'teacher.lesson_plan', 'study.pdf_qa']) {
        await open(feature, locale)
        assert.equal(await more().getAttribute('open'), null)
        assert.equal(await page.locator('html').getAttribute('lang'), locale)
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
      }
    }
  }
  checks.push(
    'Topic, source, teacher and Q&A forms pass EN/UZ/RU desktop/mobile checks in both themes with no overflow or WCAG A/AA findings',
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
