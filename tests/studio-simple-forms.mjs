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
  features: featureIds.map((feature) => ({
    id: feature,
    name: feature,
    surface: 'generate',
    eligible: true,
    requires_provider: false,
    parameter_schema: {
      output_locale: { enum: ['en', 'uz', 'ru'] },
      output_format: { enum: feature === 'ai.pptx' ? ['pptx'] : ['pdf'] },
    },
    max_pages: feature === 'ai.pptx' ? 60 : 35,
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
  if (endpoint === '/files/uploads')
    return json(
      {
        id: id(),
        name: 'research-notes.pdf',
        size_bytes: 4096,
        page_count: 2,
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
      options: { ...structuredClone(body.options || {}), length, requested_pages: asked },
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
      // Match the backend's rebuild trigger: a changed brief/source/format
      // regenerates content unless the user explicitly supplies edited content.
      const rebuild = ['prompt', 'source_text', 'source_ids', 'output_format'].some(
        (key) => Object.hasOwn(body, key) && !isDeepStrictEqual(body[key], draft[key]),
      )
      const updated = { ...draft, ...structuredClone(body), version: draft.version + 1 }
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

  for (const locale of ['en', 'uz', 'ru']) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const feature of featureIds) {
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
    'Both services pass EN/UZ/RU desktop/mobile checks in both themes with no overflow or WCAG A/AA findings',
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
