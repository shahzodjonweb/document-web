/**
 * The deck editor against a REAL local platform, not fixtures: what tests/deck-editor.mjs
 * cannot see is whether the platform answers in the shapes those fixtures invent.
 *
 * It makes a deck the way a customer has one (POST draft, PATCH its sections, quote,
 * generate: local_fixture authoring, no AI), opens it in the built web, edits it on a
 * phone and sends it, and reads every answer back from the platform. Every deck,
 * person and school here is made up.
 *
 * Needs, all local:
 *   the platform (document-platform) with
 *     DEBUG=1 DEVELOPMENT_LOGIN_ENABLED=1 LOCAL_SYNC_JOBS=1 ENABLE_BETA_TOOLS=1
 *     EDITOR_FLAG_DECK_EDITOR=1 [EDITOR_FLAG_COUNT_ONCE=1]
 *     CSRF_TRUSTED_ORIGINS=<this web origin> DATABASE_URL=<a throwaway database>
 *     python manage.py runserver 127.0.0.1:8010 --noreload
 *   the built web, its /api proxied there (the route rule is baked at build time; this overrides it):
 *     NITRO_NITRO_ROUTE_RULES='{"/api/**":{"proxy":{"to":"http://127.0.0.1:8010/api/**","_proxyStripBase":"/api"}}}' \
 *       PORT=3003 HOST=127.0.0.1 node .output/server/index.mjs
 *   then: DECK_LIVE_ORIGIN=http://127.0.0.1:3003 DECK_LIVE_SHOTS=<folder> npm run test:deck-editor-live
 *
 * Without LibreOffice (a Mac) every render fails and the PDF is refused: the page must say the preview is
 * unavailable, Review must fall back to the PowerPoint alone, and that send must still succeed.
 * The drawn path runs too when the editor lane can draw: with LOCAL_SYNC_JOBS=0, `manage.py runworker`
 * for the jobs and an editor lane (`manage.py runeditor`, or on a Mac without LibreOffice a stand-in
 * that draws the slides' text boxes itself) the same groups tap the real frames and load the real pictures.
 * Each run makes five decks, all five of the test account's weekly AI documents on Free: start each
 * run on a fresh throwaway database. Groups 6 to 8 reuse group 1's deck.
 */
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'

const origin = process.env.DECK_LIVE_ORIGIN || 'http://127.0.0.1:3003'
assert.ok(
  ['127.0.0.1', 'localhost'].includes(new URL(origin).hostname),
  'Only a local platform, never staging or production',
)
const output = path.resolve(process.env.DECK_LIVE_SHOTS || '../editor-review/workspace/deck-live')
await fs.mkdir(output, { recursive: true })
const ONLY = (process.env.DECK_LIVE_ONLY || '').toLowerCase()

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const checks = []
const failures = []
const findings = []
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const passed = (name) => {
  checks.push(name)
  console.log(`passed: ${name}`)
}
/** A difference between the web and the platform: reported, and the run goes on. */
const found = (what) => {
  findings.push(what)
  console.log(`MISMATCH: ${what}`)
}

/* ------------------------------------------------------------------ the shapes the fixtures invent */

// Copied from tests/deck-editor.mjs (draftBody, renderAnswer, fitOf, the export-quote and jobBody
// fixtures): one sample of each, so their key paths can be laid beside the platform's.
const MOCK = {
  'GET draft': {
    id: '',
    feature_id: 'ai.pptx',
    version: 3,
    provider_mode: 'openai',
    expires_at: '',
    title: '',
    prompt: '',
    source_text: '',
    source_ids: [],
    excerpts: [],
    output_locale: 'en',
    locale_source: 'settings',
    output_format: 'pptx',
    options: {
      question_count: 6,
      length: 9,
      requested_pages: 7,
      question_slides: 2,
      uz_script: 'latn',
      image_cap: 6,
      photo_style: 'photo',
      template_style: { accent: '#255e49', deck_design: 'aurora' },
      title_lines: [''],
    },
    content: {
      title: '',
      sections: [
        {
          id: '',
          heading: '',
          body: '',
          notes: '',
          layout: '',
          items: [{ label: '', text: '', value: '' }],
          columns: [''],
          image_query: '',
        },
      ],
      questions: [{ id: 'q1', stem: '', options: [''], answer: '', explanation: '', topic: '', marks: 1 }],
      citations: [],
    },
    render: {
      design: 'aurora',
      deck_seed: '',
      body_size: 18,
      variants: { '*': '' },
      photos: { '*': { asset_id: '', candidates: [{ asset_id: '' }] } },
    },
    outline: [{ id: '', title: '', body: '' }],
  },
  'GET render': {
    status: 'done',
    version: 3,
    slides: [
      {
        index: 0,
        key: '',
        frames: [{ field: 'heading', x: 0, y: 0, w: 0, h: 0 }],
        fits: true,
        letters_over: 0,
        url: '',
        thumb_url: '',
      },
    ],
    error: null,
  },
  'POST render': { task_id: '', status: 'queued' },
  'POST fit': {
    id: '',
    index: 0,
    fits: true,
    words_over: 0,
    lines_used: 0,
    lines_max: 6,
    layouts_fitting: [''],
  },
  'POST export-quote': {
    id: '',
    quote_id: '',
    quote_version: '1',
    feature_id: 'export.generated_pptx',
    plan_version_id: '',
    tariff_version_id: '',
    input_fingerprints: [{ id: '', sha256: '' }],
    normalized_parameters: {
      generation_draft_id: '',
      version: 3,
      snapshot: '',
      format: 'both',
      deliver: 'download',
    },
    affordable: true,
    usage: {
      ai_documents: { limit: 5, used: 0, remaining: 5 },
      file_jobs: { limit: 15, used: 4, remaining: 11 },
      edits_per_file: 3,
      resets_at: '',
    },
    expires_at: '',
    output_expectations: { retention_hours: 24 },
    limitations: [''],
    plan: 'free',
    summary: {
      slides: 9,
      format: 'both',
      kept_until: '',
      size_estimate: 2_400_000,
      cost: { kind: 'file_task', left: 11, limit: 15 },
      warnings: [],
    },
  },
  'GET job': {
    id: '',
    feature_id: 'export.generated_pptx',
    status: 'succeeded',
    created_at: '',
    started_at: '',
    completed_at: '',
    input_files: [],
    artifacts: [
      {
        id: '',
        name: '',
        size_bytes: 0,
        page_count: null,
        mime_type: '',
        state: 'ready',
        expires_at: '',
        page_sizes: [],
        form_fields: [],
        image_counts: [],
        encrypted: false,
        password_secret_id: null,
        preview_url: null,
        file_id: '',
        role: 'user_document',
        download_url: '',
      },
    ],
    error: null,
    warnings: [],
    parameters: { generation_draft_id: '', version: 3, snapshot: '', format: 'both', deliver: 'download' },
    origin_channel: 'web',
  },
  'POST latin': { texts: [''], changed: true },
  'cover-lines': { lines: [''], locale: '', roles: [''] },
}
MOCK['POST jobs'] = MOCK['GET job']
MOCK['PATCH draft'] = MOCK['GET draft']
// errorBody() in tests/deck-editor.mjs: every refusal the mock makes.
MOCK.refusal = {
  error: {
    code: '',
    message_key: '',
    message: '',
    message_params: {},
    request_id: '',
    field_errors: {},
    retryable: false,
  },
}
// What the web reads of each answer (app/composables/useDeck*.ts, app/components/deck/*.vue), as key paths.
const WEB_READS = {
  'GET draft': [
    'id',
    'version',
    'feature_id',
    'output_format',
    'output_locale',
    'expires_at',
    'prompt',
    'content',
    'content.sections[]',
    'content.questions[]',
    'render',
    'render.design',
    'render.body_size',
  ],
  'GET render': ['status', 'error', 'slides'],
  'GET render slides': [
    'slides[].index',
    'slides[].key',
    'slides[].frames',
    'slides[].fits',
    'slides[].letters_over',
    'slides[].url',
    'slides[].thumb_url',
  ],
  'POST render': ['status'],
  'POST fit': ['fits', 'words_over', 'lines_used', 'lines_max', 'layouts_fitting'],
  'POST export-quote': [
    'id',
    'affordable',
    'expires_at',
    'summary',
    'summary.slides',
    'summary.format',
    'summary.kept_until',
    'summary.size_estimate',
    'summary.cost',
    'summary.cost.kind',
    'summary.cost.left',
    'summary.cost.limit',
    'summary.warnings',
  ],
  'POST jobs': ['id', 'status', 'artifacts'],
  'GET job': [
    'id',
    'status',
    'error',
    'artifacts',
    'artifacts[].mime_type',
    'artifacts[].download_url',
    'artifacts[].name',
  ],
  'POST latin': ['texts', 'changed'],
  'PATCH draft': ['id', 'version', 'content', 'content.sections[]'],
  refusal: ['error', 'error.code', 'error.message_params'],
  'cover-lines': ['lines', 'locale', 'roles'],
}
// Objects keyed by section id, not by name.
const MAPS = new Set(['render.variants', 'render.photos'])

/** Every key path of a value: `a.b`, `a[].c`, maps folded to `a.*`. */
function paths(value, prefix = '', into = new Set()) {
  if (Array.isArray(value)) {
    if (prefix) into.add(`${prefix}[]`)
    for (const entry of value) paths(entry, `${prefix}[]`, into)
  } else if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      const named = MAPS.has(prefix) ? '*' : key
      const at = prefix ? `${prefix}.${named}` : named
      into.add(at)
      paths(inner, at, into)
    }
  }
  return into
}

/* ------------------------------------------------------------------ the platform, as the web reaches it */

/** The context's own cookies, so a page and these calls are the same signed-in person. */
async function api(context, method, url, body, headers = {}) {
  const csrf = (await context.cookies(origin)).find((cookie) => cookie.name === 'csrftoken')?.value || ''
  const response = await context.request.fetch(`${origin}/api/v1${url}`, {
    method,
    headers: {
      ...(method === 'GET' ? {} : { 'X-CSRFToken': csrf, Origin: origin }),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { data: JSON.stringify(body) }),
    failOnStatusCode: false,
  })
  let json = null
  try {
    json = await response.json()
  } catch {}
  return { status: response.status(), json }
}

async function signIn(context, locale) {
  await api(context, 'GET', '/auth/session')
  const answer = await api(context, 'POST', '/auth/dev-login', { locale })
  assert.equal(answer.status, 200, `development login: ${JSON.stringify(answer.json)}`)
  return answer.json.user
}

const section = (id, layout, heading, body = '', extra = {}) => ({
  id,
  heading,
  body,
  notes: '',
  layout,
  items: [],
  columns: [],
  image_query: '',
  ...extra,
})
const item = (label, text, value = '') => ({ label, text, value })
const DECKS = {
  en: {
    title: 'Water cycle in nature',
    brief:
      'A school lesson about the water cycle in nature: evaporation, clouds and rain. 7 slides with 6 questions.',
    sections: [
      section(
        's1',
        'cover',
        'Water cycle in nature',
        'Prepared by: Fixture Pupil\nChecked by: Fixture Teacher\n9-B class\nSchool No. 99',
        {
          image_query: 'ocean clouds',
        },
      ),
      section(
        's2',
        'bullets',
        'Evaporation',
        'The sun warms rivers and seas\nWater turns into vapour\nWarm air carries it upwards',
        {
          notes: 'Ask who has seen fog.',
        },
      ),
      section('s3', 'process', 'How rain forms', '', {
        items: [
          item('Rising', 'Vapour rises with warm air'),
          item('Cooling', 'High air is cold, so vapour cools'),
          item('Falling', 'Drops grow heavy and fall'),
        ],
      }),
      section('s4', 'stats', 'Where water is', '', {
        items: [
          item('Oceans', 'Salt water', '97%'),
          item('Ice', 'Glaciers and caps', '2%'),
          item('Fresh', 'Rivers, lakes, ground', '1%'),
        ],
      }),
      section('s5', 'image_split', 'Clouds', 'Clouds are tiny drops of water\nThey move with the wind', {
        image_query: 'rain clouds',
      }),
      section('s6', 'pros_cons', 'Rain in cities', '', {
        items: [
          item('Cleaner air', 'Rain washes dust away', 'pro'),
          item('Floods', 'Drains can overflow', 'con'),
        ],
        columns: ['For', 'Against'],
      }),
      section('s7', 'closing', 'Thank you', 'Questions?'),
    ],
  },
  uz: {
    title: 'Suvning tabiatda aylanishi',
    brief:
      'Maktab darsi: suvning tabiatda aylanishi, bug‘lanish, bulutlar va yomg‘ir. 5 ta slayd va 3 ta savol.',
    sections: [
      section('s1', 'cover', 'Suvning tabiatda aylanishi', 'Bajardi: Sinov O‘quvchi\n9-B sinf\n99-maktab'),
      section('s2', 'bullets', 'Bug‘lanish', 'Quyosh daryo va dengizlarni isitadi\nSuv bug‘ga aylanadi'),
      section(
        's3',
        'bullets',
        'Bulutlar',
        'Bulutlar mayda suv tomchilaridan iborat\nUlar shamol bilan harakatlanadi',
      ),
      section('s4', 'bullets', 'Yomg‘ir', 'Tomchilar og‘irlashib tushadi'),
      section('s5', 'closing', 'Rahmat', 'Savollar?'),
    ],
  },
}
const questionsOf = (count, topic) =>
  Array.from({ length: count }, (_, n) => ({
    id: `q${n + 1}`,
    stem: `Fixture question ${n + 1}?`,
    options: ['North', 'South', 'East', 'West'],
    answer: 'North',
    explanation: '',
    topic,
    marks: 1,
  }))

/** The generation job that made each deck, by its draft id. */
const generationJobs = new Map()
/**
 * A deck made the way a customer has one: drafted, written, quoted and generated (local authoring, no AI).
 * `prompt` is the description as typed, where title-page lines can be dictated; without one it is the title.
 * `cover` puts other lines on the title slide as written, before the platform adds the dictated and kept ones.
 */
async function makeDeck(context, locale, questions, { prompt, cover } = {}) {
  const deck = DECKS[locale]
  const sections =
    cover === undefined ? deck.sections : deck.sections.map((row, n) => (n ? row : { ...row, body: cover }))
  const created = await api(context, 'POST', '/generation/drafts', {
    feature_id: 'ai.pptx',
    title: deck.title,
    ...(prompt ? { prompt } : {}),
    source_text: deck.brief,
    output_locale: locale,
    output_format: 'pptx',
    options: { pages: deck.sections.length },
  })
  assert.equal(created.status, 201, `draft: ${JSON.stringify(created.json)}`)
  const content = {
    title: deck.title,
    sections,
    questions: questionsOf(questions, deck.title),
    citations: [],
  }
  const written = await api(context, 'PATCH', `/generation/drafts/${created.json.id}`, {
    version: created.json.version,
    content,
  })
  assert.equal(written.status, 200, `sections: ${JSON.stringify(written.json)}`)
  const quote = await api(context, 'POST', `/generation/drafts/${created.json.id}/quote`, {
    version: written.json.version,
  })
  assert.equal(quote.status, 201, `generation quote: ${JSON.stringify(quote.json)}`)
  const job = await api(
    context,
    'POST',
    `/generation/drafts/${created.json.id}/generate`,
    { quote_id: quote.json.id },
    { 'Idempotency-Key': `deck-live-${quote.json.id}` },
  )
  // In the request with LOCAL_SYNC_JOBS; otherwise a worker (manage.py runworker) makes it.
  const made = await until(
    async () => {
      const now =
        job.json?.status === 'queued' || job.json?.status === 'running'
          ? await api(context, 'GET', `/jobs/${job.json.id}`)
          : job
      job.json = now.json
      return ['queued', 'running'].includes(now.json?.status) ? null : now.json
    },
    'the deck generated',
    120000,
  )
  assert.equal(made?.status, 'succeeded', `generation: ${JSON.stringify(made?.error ?? made)}`)
  generationJobs.set(created.json.id, made.id)
  const draft = await api(context, 'GET', `/generation/drafts/${created.json.id}`)
  assert.ok(draft.json.render, 'a generated deck carries its pins (render)')
  return draft.json
}

/* ------------------------------------------------------------------ recording what the page asked */

const ENDPOINTS = [
  ['GET draft', 'GET', /^\/generation\/drafts\/[\w-]+$/],
  ['PATCH draft', 'PATCH', /^\/generation\/drafts\/[\w-]+$/],
  ['GET render', 'GET', /^\/generation\/drafts\/[\w-]+\/render$/],
  ['POST render', 'POST', /^\/generation\/drafts\/[\w-]+\/render$/],
  ['POST fit', 'POST', /^\/generation\/drafts\/[\w-]+\/fit$/],
  ['POST export-quote', 'POST', /^\/generation\/drafts\/[\w-]+\/export-quote$/],
  ['POST jobs', 'POST', /^\/jobs$/],
  ['GET job', 'GET', /^\/jobs\/[\w-]+$/],
  ['POST latin', 'POST', /^\/studio\/latin$/],
  ['cover-lines', null, /^\/studio\/cover-lines$/],
  ['slide picture', 'GET', /^\/generation\/drafts\/[\w-]+\/slides\//],
]
const seen = new Map()
function record(page, log) {
  page.on('response', async (response) => {
    const url = new URL(response.url())
    if (!url.pathname.startsWith('/api/v1/')) return
    const endpoint = url.pathname.slice('/api/v1'.length)
    const method = response.request().method()
    const name = ENDPOINTS.find(
      ([, verb, pattern]) => (!verb || verb === method) && pattern.test(endpoint),
    )?.[0]
    let body = null
    let sent = null
    try {
      sent = response.request().postData() ? JSON.parse(response.request().postData()) : null
    } catch {}
    if (name !== 'slide picture')
      try {
        body = await response.json()
      } catch {}
    const entry = {
      name: name ?? `${method} ${endpoint}`,
      method,
      endpoint,
      search: url.search,
      status: response.status(),
      body,
      sent,
      at: Date.now(),
    }
    log.push(entry)
    if (name && response.status() < 300 && body) {
      const key = name === 'GET render' && body.slides?.length ? 'GET render slides' : name
      if (!seen.has(key)) seen.set(key, body)
      if (key === 'GET render slides' && !seen.has('GET render')) seen.set('GET render', body)
    }
    if (response.status() >= 400 && body?.error && !seen.has('refusal')) seen.set('refusal', body)
  })
}
const answers = (log, name) => log.filter((entry) => entry.name === name)
const until = async (check, what, timeout = 15000) => {
  const end = Date.now() + timeout
  for (;;) {
    const value = await check()
    if (value) return value
    if (Date.now() > end) throw new assert.AssertionError({ message: `Waited ${timeout} ms for ${what}` })
    await sleep(100)
  }
}

/* ------------------------------------------------------------------ a phone */

async function phone({ width, height, locale, theme }) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
    hasTouch: true,
    locale,
    reducedMotion: 'reduce',
    acceptDownloads: true,
  })
  await context.addInitScript((value) => {
    try {
      localStorage.setItem('docmaster-theme', value)
    } catch {}
  }, theme)
  // Outside Telegram: its script is the only thing the page loads from elsewhere, and it stays empty.
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue()
    if (url.hostname === 'telegram.org')
      return route.fulfill({ contentType: 'application/javascript', body: '' })
    return route.abort('blockedbyclient')
  })
  opened.add(context)
  const page = await context.newPage()
  page.setDefaultTimeout(20000)
  const errors = []
  const log = []
  page.on('pageerror', (error) => errors.push(error.message))
  // A refused request is logged by the browser too; those are judged one by one in refusedAnswers().
  page.on(
    'console',
    (message) =>
      message.type() === 'error' &&
      !message.text().startsWith('Failed to load resource') &&
      errors.push(`console: ${message.text().slice(0, 200)}`),
  )
  record(page, log)
  return { context, page, errors, log, width, height, locale, theme }
}
/** Every refusal the page met, less the ones a Mac without LibreOffice must meet. */
const EXPECTED_REFUSALS = [
  // Review asks for both files first; without LibreOffice the PDF is refused and it asks for the PowerPoint alone.
  (entry) =>
    entry.name === 'POST export-quote' &&
    entry.status === 409 &&
    entry.body?.error?.code === 'engine_unavailable',
]
const refusedAnswers = (log, also = []) =>
  log
    .filter(
      (entry) => entry.status >= 400 && ![...EXPECTED_REFUSALS, ...also].some((expected) => expected(entry)),
    )
    .map((entry) => `${entry.method} ${entry.endpoint} ${entry.status} ${entry.body?.error?.code ?? ''}`)
const label = (o) => `${o.width}-${o.locale}-${o.theme}-browser`
const shot = (o, state) =>
  o.page.screenshot({ path: path.join(output, `${label(o)}-${state}.png`), fullPage: false })
const saved = (page) =>
  page.waitForFunction(
    () =>
      ['saved', 'clean'].includes(document.querySelector('[data-testid="editor-save-icon"]')?.dataset.state),
    null,
    { timeout: 20000 },
  )
const currentSlide = (page) =>
  page.evaluate(() => {
    const thumb = [...document.querySelectorAll('[data-testid^="deck-thumb-"]')].find(
      (node) => node.getAttribute('aria-current') && node.getAttribute('aria-current') !== 'false',
    )
    return thumb ? Number(thumb.dataset.testid.slice('deck-thumb-'.length)) : null
  })
/**
 * A part of the slide opened as a person does: the placeholder's button when there is no picture, or a tap
 * on the picture where the platform's frame for it lies (the slide reads the tap; its region buttons are for
 * screen readers).
 */
async function openField(page, field) {
  const dock = page.locator(
    `[data-testid="deck-dock"][data-field="${field === 'heading' ? 'heading' : 'lines'}"]`,
  )
  const blank = page.getByTestId(field === 'heading' ? 'deck-blank-heading' : 'deck-blank-lines')
  // A picture can arrive while this taps (the placeholder then leaves): tried again until the dock opens.
  const end = Date.now() + 15000
  for (;;) {
    try {
      if (await blank.count()) await blank.click({ timeout: 2000 })
      else {
        await page.getByTestId('deck-slide').scrollIntoViewIfNeeded()
        const box = await page.getByTestId(`deck-region-${field}`).first().boundingBox()
        if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      }
      await dock.waitFor({ timeout: 2000 })
      return
    } catch (error) {
      if (Date.now() > end) throw error
    }
  }
}
async function goTo(page, n) {
  if ((await currentSlide(page)) === n) return
  await page.getByTestId(`deck-thumb-${n}`).click()
  await until(async () => (await currentSlide(page)) === n, `slide ${n}`)
}
const noSidewaysScroll = async (page, what) => {
  const { scrollWidth, width } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }))
  assert.ok(scrollWidth <= width, `${what}: the page scrolls sideways (${scrollWidth} over ${width})`)
}
const smallTargets = (page) =>
  page.evaluate(() => {
    const seen = []
    const open = document.querySelector('dialog.editor-sheet:modal')
    const root = open ?? document.querySelector('[data-testid="deck-editor"]')
    for (const node of root.querySelectorAll('button, a[href], select, summary, input:not([type=file])')) {
      const box = node.getBoundingClientRect()
      if (!box.width || !box.height || getComputedStyle(node).visibility === 'hidden') continue
      if (node.closest('.deck-edit-region, .deck-edit-regions, .visually-hidden')) continue
      if (node.matches('input[type=checkbox], input[type=color]')) continue
      if (box.height < 43.5 || box.width < 43.5)
        seen.push(
          `${node.getAttribute('data-testid') || node.textContent.trim().slice(0, 24)}: ${Math.round(box.width)}x${Math.round(box.height)}`,
        )
    }
    return seen
  })
async function look(o, state) {
  await noSidewaysScroll(o.page, `${label(o)} ${state}`)
  const small = await smallTargets(o.page)
  if (small.length) found(`${label(o)} ${state}: tap targets under 44 px: ${small.join(', ')}`)
  await shot(o, state)
}
async function draftOf(o, id) {
  const answer = await api(o.context, 'GET', `/generation/drafts/${id}`)
  assert.equal(answer.status, 200)
  return answer.json
}
/** The server's copy, once it says what `test` wants: a save reached it. */
const onServer = (o, id, test, what) =>
  until(async () => {
    const d = await draftOf(o, id)
    return test(d.content) ? d : null
  }, what)
async function closeSheet(page, testid) {
  await page.getByTestId(testid).getByTestId('editor-sheet-close').click()
  await page.getByTestId(testid).waitFor({ state: 'hidden' })
}

/** The words of a PowerPoint's slides, read from its zip with nothing but zlib. */
function pptxWords(buffer) {
  assert.equal(buffer.subarray(0, 2).toString(), 'PK', 'a zip')
  let end = buffer.length - 22
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end -= 1
  assert.ok(end >= 0, 'a zip with its directory')
  const count = buffer.readUInt16LE(end + 10)
  let at = buffer.readUInt32LE(end + 16)
  const slides = {}
  for (let n = 0; n < count; n += 1) {
    const method = buffer.readUInt16LE(at + 10)
    const size = buffer.readUInt32LE(at + 20)
    const nameLength = buffer.readUInt16LE(at + 28)
    const extra = buffer.readUInt16LE(at + 30)
    const comment = buffer.readUInt16LE(at + 32)
    const local = buffer.readUInt32LE(at + 42)
    const name = buffer.subarray(at + 46, at + 46 + nameLength).toString()
    at += 46 + nameLength + extra + comment
    const match = /^ppt\/slides\/slide(\d+)\.xml$/.exec(name)
    if (!match) continue
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    const raw = buffer.subarray(start, start + size)
    const xml = (method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8')
    slides[Number(match[1])] = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((hit) => hit[1]).join(' ')
  }
  return Object.keys(slides)
    .sort((a, b) => a - b)
    .map((key) =>
      slides[key]
        .replace(/&amp;/g, '&')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"'),
    )
}

/** Contexts a group opened: closed when it ends however it ends, so a failed group leaves nothing open. */
const opened = new Set()
const closeQuietly = (context) =>
  Promise.race([context.close().catch(() => {}), sleep(5000)]).finally(() => opened.delete(context))
async function group(name, run) {
  if (ONLY && !name.toLowerCase().includes(ONLY)) return
  try {
    passed((await run()) || name)
  } catch (error) {
    failures.push([name, error])
    console.error(`FAILED: ${name}\n${error.stack}`)
  } finally {
    await Promise.all([...opened].map(closeQuietly))
  }
}

/* ------------------------------------------------------------------ preflight */

const probe = await browser.newContext()
const me = await signIn(probe, 'en')
const config = await api(probe, 'GET', '/studio/config')
assert.equal(config.status, 200)
const flags = config.json.limits?.editor ?? {}
assert.equal(flags.deck_editor, true, 'start the platform with EDITOR_FLAG_DECK_EDITOR=1')
const countOnce = flags.count_once === true
console.log(
  `platform: provider ${config.json.provider?.mode}, account ${me.plan}, flags ${JSON.stringify(flags)}`,
)
await probe.close()

/* ------------------------------------------------------------------ 1: a phone at 390, an English deck */

const keySets = {}
await group('1 Phone 390: open, edit, reorder, cover, send, download', async () => {
  const o = await phone({ width: 390, height: 844, locale: 'en', theme: 'light' })
  const { page, log, context } = o
  await signIn(context, 'en')
  // A new deck takes the lines kept from the last one (B4): none here, so the cover is the one written.
  assert.equal((await api(context, 'DELETE', '/studio/cover-lines')).status, 200)
  const made = await makeDeck(context, 'en', 6)
  const id = made.id
  keySets.seededDraft = made
  keySets.draftId = id
  await page.goto(`${origin}/en/app/editor/deck/${id}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('deck-editor').waitFor()
  await page.getByTestId('deck-slide').waitFor()
  assert.equal(await page.getByTestId('deck-refusal').count(), 0, 'the deck opens')
  assert.equal(await page.locator('[data-testid="deck-thumb-9"]').count(), 1, '7 slides and 2 of questions')

  // No LibreOffice here: the drawing fails and the page must say so, the deck still editable.
  const drawn = await until(
    async () =>
      (await page.getByTestId('deck-slide-image').count())
        ? 'image'
        : (await page.getByTestId('deck-preview-off').count())
          ? 'off'
          : null,
    'a picture or the preview-unavailable notice',
    30000,
  )
  const renders = answers(log, 'GET render')
  const posts = answers(log, 'POST render')
  console.log(
    `render: ${drawn}; POST ${posts.map((entry) => `${entry.status}/${entry.body?.status}`).join(',')}; GET ${renders
      .map((entry) => `${entry.body?.status}:${entry.body?.error}`)
      .join(',')}`,
  )
  if (drawn === 'off') {
    const reason = await page.getByTestId('deck-preview-off').getAttribute('data-reason')
    assert.equal(reason, 'unavailable')
    await page.getByTestId('deck-blank-heading').waitFor()
    assert.equal(await page.getByTestId('deck-blank-heading').isEnabled(), true, 'editing stays')
    const said = (await page.getByTestId('deck-preview-off').textContent()).trim()
    console.log(`preview off says: ${said}`)
  }
  await look(o, 'root')

  if (drawn === 'image') {
    // The platform's own pictures and frames (LibreOffice stood in for): loaded through the web's origin,
    // and each tap region where the frame the platform read from the PowerPoint says.
    const real = seen.get('GET render slides')
    assert.ok(real, 'a done render answer')
    const picture = await page
      .getByTestId('deck-slide-image')
      .evaluate((node) => ({ w: node.naturalWidth, src: node.currentSrc }))
    const thumbs = await page
      .locator('[data-testid^="deck-thumb-"] img')
      .evaluateAll((nodes) => nodes.filter((node) => node.complete && node.naturalWidth > 0).length)
    console.log(
      `drawn: slide picture ${picture.w} px wide from ${new URL(picture.src).pathname.slice(0, 60)}…; ${thumbs} thumbnails loaded`,
    )
    assert.ok(picture.w > 0, 'the slide picture loads')
    if (!thumbs) found('drawn: no strip thumbnail loads from the platform')
    await goTo(page, 2)
    await until(async () => (await page.getByTestId('deck-region-heading').count()) > 0, 'slide 2 regions')
    const imageBox = await page.getByTestId('deck-slide-image').boundingBox()
    for (const field of ['heading', 'body']) {
      const frame = real.slides[1].frames.find((entry) => entry.field === field)
      const region = await page.getByTestId(`deck-region-${field}`).first().boundingBox()
      if (!frame || !region) {
        found(
          `drawn: slide 2 has no ${field} ${frame ? 'region' : 'frame'} (frames ${JSON.stringify(real.slides[1].frames)})`,
        )
        continue
      }
      const want = {
        x: imageBox.x + frame.x * imageBox.width,
        y: imageBox.y + frame.y * imageBox.height,
        w: frame.w * imageBox.width,
        h: frame.h * imageBox.height,
      }
      const off = Math.max(
        Math.abs(want.x - region.x),
        Math.abs(want.y - region.y),
        Math.abs(want.w - region.width),
        Math.abs(want.h - region.height),
      )
      console.log(
        `drawn: slide 2 ${field} frame ${JSON.stringify(frame)} -> region off by ${off.toFixed(1)} px`,
      )
      if (off > 2) found(`drawn: slide 2's ${field} region is ${off.toFixed(0)} px from the platform's frame`)
    }
    const first = real.slides[0]
    console.log(`drawn: render answer sample ${JSON.stringify({ ...first, frames: first.frames.length })}`)
  }

  // A headline on slide 2, by the button the placeholder offers (or the slide's own region once drawn).
  await goTo(page, 2)
  const region = (field) => openField(page, field)
  await region('heading')
  await page.locator('[data-testid="deck-dock"][data-field="heading"]').waitFor()
  await page.getByTestId('deck-headline').fill('Evaporation and fog')
  await shot(o, 'dock-headline')
  await page.getByTestId('deck-dock-done').click()
  await saved(page)
  await onServer(o, id, (c) => c.sections[1].heading === 'Evaporation and fog', 'the headline on the server')

  // A line in the lines dock: the budget asks the server (/fit) and shows "n of m lines".
  await region('body')
  await page.locator('[data-testid="deck-dock"][data-field="lines"]').waitFor()
  await page.getByTestId('deck-line-0').fill('The sun warms rivers, lakes and seas')
  await until(() => answers(log, 'POST fit').some((entry) => entry.status === 200), 'a /fit answer', 15000)
  const budget = page.getByTestId('deck-dock-budget').first()
  await budget.waitFor()
  const budgetText = (await budget.textContent()).trim()
  console.log(`budget: ${budgetText} (${await budget.getAttribute('data-level')})`)
  assert.match(budgetText, /\d+ of \d+ lines/, 'the budget says n of m lines')
  await shot(o, 'dock-lines')
  await page.getByTestId('deck-dock-done').click()
  await saved(page)
  await onServer(
    o,
    id,
    (c) =>
      c.sections[1].body.split('\n')[0] === 'The sun warms rivers, lakes and seas' &&
      c.sections[1].body.split('\n').length === 3,
    'the line on the server, the others kept',
  )

  // Slide 6 put first after the cover, from the Slides list.
  await page.getByTestId('deck-tab-slides').click()
  await page.getByTestId('deck-slides-sheet').waitFor()
  await page.getByTestId('deck-row-6').click()
  await page.getByTestId('deck-choose-spot').waitFor()
  await shot(o, 'slides-moving')
  await page.getByTestId('deck-put-1').click()
  await saved(page)
  await onServer(
    o,
    id,
    (c) => c.sections.map((row) => row.id).join(',') === 's1,s6,s2,s3,s4,s5,s7',
    'the new order on the server',
  )
  await closeSheet(page, 'deck-slides-sheet')

  // Cover details: rows read from the cover's lines, one changed and remembered.
  await goTo(page, 1)
  await page.getByTestId('deck-cover-open').click()
  await page.getByTestId('deck-cover-sheet').waitFor()
  const value = (testid) => page.getByTestId(testid).inputValue()
  const rows = {
    topic: await value('deck-cover-topic'),
    made: await value('deck-cover-made'),
    checked: await value('deck-cover-checked'),
    group: await value('deck-cover-group'),
    school: await value('deck-cover-school'),
  }
  assert.deepEqual(rows, {
    topic: 'Water cycle in nature',
    made: 'Fixture Pupil',
    checked: 'Fixture Teacher',
    group: '9-B class',
    school: 'School No. 99',
  })
  await until(
    () => answers(log, 'cover-lines').some((entry) => entry.method === 'GET'),
    'the remembered lines asked for',
  )
  await page.getByTestId('deck-cover-made').fill('Fixture Pupil Two')
  await page.getByTestId('deck-cover-remember').check()
  await shot(o, 'cover')
  await closeSheet(page, 'deck-cover-sheet')
  await saved(page)
  const covered = await onServer(
    o,
    id,
    (c) => c.sections[0].body.includes('Prepared by: Fixture Pupil Two'),
    'the cover line on the server',
  )
  assert.deepEqual(covered.content.sections[0].body.split('\n'), [
    'Prepared by: Fixture Pupil Two',
    'Checked by: Fixture Teacher',
    '9-B class',
    'School No. 99',
  ])
  await until(
    () => answers(log, 'cover-lines').some((entry) => entry.method === 'POST' && entry.status === 200),
    'Remember saved',
  )
  const kept = await api(context, 'GET', '/studio/cover-lines')
  assert.deepEqual(kept.json.lines, [
    'Prepared by: Fixture Pupil Two',
    'Checked by: Fixture Teacher',
    '9-B class',
    'School No. 99',
  ])
  // Kept with the deck's language, so only a new deck in that language takes them (B4).
  const remembered = answers(log, 'cover-lines')
    .filter((entry) => entry.method === 'POST' && entry.status === 200)
    .at(-1)
  if (remembered.sent?.locale !== 'en')
    found(`Remember sends the lines without the deck's language: ${JSON.stringify(remembered.sent)}`)
  if (kept.json.locale !== 'en')
    found(`GET /studio/cover-lines answers locale ${JSON.stringify(kept.json.locale)}, not "en"`)
  // And with the Cover sheet row of each, so a new deck never has to guess a line's role from its words.
  const sheetRows = ['made', 'checked', 'group', 'school']
  if (JSON.stringify(remembered.sent?.roles) !== JSON.stringify(sheetRows))
    found(`Remember sends the lines without their rows: ${JSON.stringify(remembered.sent)}`)
  if (JSON.stringify(kept.json.roles) !== JSON.stringify(sheetRows))
    found(
      `GET /studio/cover-lines answers roles ${JSON.stringify(kept.json.roles)}, not ${JSON.stringify(sheetRows)}`,
    )
  keySets.coverLinesRemembered = kept.json

  // Once the saves settle the page must say what the platform says of the last version: drawn, or
  // (no LibreOffice) unavailable, never a picture promised for good. The answers are kept beside it.
  const lastVersion = (await draftOf(o, id)).version
  const settled = await until(
    async () => {
      if (await page.getByTestId('deck-preview-off').count()) return 'off'
      const image = page.getByTestId('deck-slide-image')
      if ((await image.count()) && (await image.evaluate((node) => node.complete && node.naturalWidth > 0))) {
        const done = answers(log, 'GET render').some(
          (entry) => entry.body?.status === 'done' && entry.body?.version === lastVersion,
        )
        if (done) return 'drawn'
      }
      return null
    },
    'the slide drawn or the preview-unavailable notice after the saves',
    30000,
  ).catch(() => null)
  const renderTimeline = log
    .filter((entry) => entry.name === 'GET render' || entry.name === 'POST render')
    .map(
      (entry) =>
        `${entry.method}${entry.search} ${entry.sent ? JSON.stringify(entry.sent) : ''} -> ${entry.status} ${entry.body?.status}${entry.body?.error ? `:${entry.body.error}` : ''}`,
    )
  await fs.writeFile(path.join(output, `render-timeline-390-${drawn}.txt`), renderTimeline.join('\n'))
  const caption = (
    await page
      .getByTestId('deck-slide')
      .locator('p.muted')
      .last()
      .textContent()
      .catch(() => '')
  ).trim()
  console.log(
    `after the saves (v${lastVersion}): ${settled ?? 'NEITHER'}; slide says "${caption}"; ${renderTimeline.length} render calls`,
  )
  if (!settled)
    found(
      `390 en (${drawn}): after edits the page neither shows version ${lastVersion} drawn nor "Preview unavailable" within 30 s; the slide says "${caption}" (render-timeline-390-${drawn}.txt)`,
    )
  else if (settled !== (drawn === 'image' ? 'drawn' : 'off'))
    found(`390 en: opened ${drawn} but after edits the page is ${settled}`)
  await shot(o, 'after-saves')

  // Review: the server's cost line; the PDF refused without LibreOffice, so the PowerPoint alone.
  assert.equal((await page.getByTestId('editor-primary').textContent()).trim(), 'Download')
  await page.getByTestId('editor-primary').click()
  await page.getByTestId('deck-review-sheet').waitFor()
  await page.locator('[data-testid="deck-review-body"][data-stage="ready"]').waitFor({ timeout: 30000 })
  const quotes = answers(log, 'POST export-quote')
  console.log(
    `quotes: ${quotes.map((entry) => `${entry.sent?.format}->${entry.status} ${entry.body?.error?.code ?? entry.body?.summary?.cost?.kind}`).join(', ')}`,
  )
  const ready = quotes.at(-1)
  assert.equal(ready.status, 201)
  assert.equal(ready.sent.deliver, 'download')
  if (quotes.some((entry) => entry.body?.error?.code === 'engine_unavailable')) {
    assert.equal(ready.sent.format, 'pptx', 'the PowerPoint alone after engine_unavailable')
    await page.getByTestId('deck-pptx-only').waitFor()
    console.log(`pptx only says: ${(await page.getByTestId('deck-pptx-only').textContent()).trim()}`)
  }
  const cost = (await page.getByTestId('editor-review-cost').textContent()).trim()
  console.log(`cost line: ${cost}; summary ${JSON.stringify(ready.body.summary)}`)
  assert.ok(cost.length > 0)
  const facts = (await page.getByTestId('editor-review-facts').textContent()).trim()
  console.log(`facts: ${facts}`)
  const changes = (
    await page
      .getByTestId('deck-review-changes')
      .textContent()
      .catch(() => '')
  ).trim()
  console.log(`changes: ${changes}`)
  await look(o, 'review-ready')
  const firstKind = ready.body.summary.cost.kind

  // Confirm: a real job, followed until made, and its PowerPoint downloaded.
  await page.getByTestId('editor-confirm').click()
  const pptx = page.getByTestId('deck-download-pptx')
  await pptx.waitFor({ timeout: 60000 })
  const jobPost = answers(log, 'POST jobs').at(-1)
  assert.ok(
    jobPost.status === 201 || jobPost.status === 200,
    `POST /jobs ${jobPost.status} ${JSON.stringify(jobPost.body)}`,
  )
  assert.equal(jobPost.sent.deliver_to_chat, undefined, 'a browser asks for no chat')
  const jobId = jobPost.body.id
  keySets.exportJobId = jobId
  const job = await api(context, 'GET', `/jobs/${jobId}`)
  assert.equal(job.json.status, 'succeeded', JSON.stringify(job.json.error))
  keySets.jobFromApi = job.json
  await look(o, 'review-made')
  const href = await pptx.getAttribute('href')
  const [download] = await Promise.all([page.waitForEvent('download'), pptx.click()])
  const file = path.join(output, 'deck-live.pptx')
  await download.saveAs(file)
  const bytes = await fs.readFile(file)
  const words = pptxWords(bytes)
  console.log(
    `downloaded ${download.suggestedFilename()} from ${href}: ${bytes.length} bytes, ${words.length} slides`,
  )
  assert.ok(words.length >= 7, 'every slide')
  assert.match(words[0], /Fixture Pupil Two/, 'the cover as changed')
  assert.match(words[1], /Rain in cities/, 'slide 6 moved to second')
  assert.match(words[2], /Evaporation and fog/, 'the headline as typed')
  assert.match(words[2], /The sun warms rivers, lakes and seas/, 'the line as typed')
  if (await page.getByTestId('deck-download-pdf').count()) found('a PDF link after a PowerPoint-only send')

  // Sent again after one more change: with count_once on, the same draft uses nothing this week.
  await closeSheet(page, 'deck-review-sheet')
  await goTo(page, 3)
  await region('heading')
  await page.locator('[data-testid="deck-dock"][data-field="heading"]').waitFor()
  await page.getByTestId('deck-headline').fill('Evaporation, fog and dew')
  await page.getByTestId('deck-dock-done').click()
  await saved(page)
  await onServer(
    o,
    id,
    (c) => c.sections[2].heading === 'Evaporation, fog and dew',
    'the second change on the server',
  )
  const before = answers(log, 'POST export-quote').length
  await page.getByTestId('editor-primary').click()
  await page.getByTestId('deck-review-sheet').waitFor()
  await page.locator('[data-testid="deck-review-body"][data-stage="ready"]').waitFor({ timeout: 30000 })
  const again = answers(log, 'POST export-quote').slice(before).at(-1)
  const secondCost = (await page.getByTestId('editor-review-cost').textContent()).trim()
  console.log(`second send: ${JSON.stringify(again.body.summary.cost)}; says ${secondCost}`)
  if (countOnce) assert.equal(again.body.summary.cost.kind, 'none', 'count_once: one task per draft a week')
  else assert.equal(again.body.summary.cost.kind, firstKind)
  await look(o, 'review-again')
  await page.getByTestId('editor-confirm').click()
  await page.getByTestId('deck-download-pptx').waitFor({ timeout: 60000 })
  const usage = await api(context, 'GET', '/usage')
  console.log(`usage after two sends: ${JSON.stringify(usage.json.file_jobs)}`)
  if (countOnce)
    assert.equal(
      usage.json.file_jobs.used,
      firstKind === 'file_task' ? 1 : 0,
      'two sends of one draft, one task',
    )

  // Typed into the dock and left without Done, by leaving the page: the words still reach the platform
  // (the page commits the open dock and saves with keepalive as it goes, through the real CSRF check).
  await closeSheet(page, 'deck-review-sheet').catch(() => {})
  await goTo(page, 5)
  await region('heading')
  await page.locator('[data-testid="deck-dock"][data-field="heading"]').waitFor()
  await page.getByTestId('deck-headline').fill('Where water is kept')
  const patchesBefore = answers(log, 'PATCH draft').length
  await page.goto(`${origin}/en/app`, { waitUntil: 'domcontentloaded' })
  const leftWith = await until(
    async () => {
      const d = await draftOf(o, id)
      return d.content.sections[4].heading === 'Where water is kept' ? d : null
    },
    'the words typed before leaving on the server',
    8000,
  ).catch(() => null)
  const leavePatch = log.filter((entry) => entry.name === 'PATCH draft').slice(patchesBefore)
  console.log(
    `left without Done: ${leftWith ? 'saved' : 'NOT saved'}; PATCHes seen ${leavePatch.map((entry) => entry.status).join(',') || 'none'}`,
  )
  if (!leftWith)
    found(
      '390 en: a headline typed in the dock and left by navigating away (no Done) never reached the platform',
    )

  assert.deepEqual(o.errors, [], 'page errors')
  for (const refused of refusedAnswers(log)) found(`${label(o)}: the platform refused ${refused}`)
  await context.close()
  return `Phone 390: the real deck opens (${drawn === 'off' ? 'preview unavailable, as there is no LibreOffice here' : 'drawn'}), a headline and a line, a reorder and a cover line all reach the server; Review costs "${cost}"; the job makes a PowerPoint with the changes; a second send costs ${again.body.summary.cost.kind}`
})

/* ------------------------------------------------------------------ 2: 320, an Uzbek deck, dark */

await group('2 Phone 320: an Uzbek deck, Cyrillic offered in Latin letters', async () => {
  const o = await phone({ width: 320, height: 568, locale: 'uz', theme: 'dark' })
  const { page, log, context } = o
  await signIn(context, 'uz')
  // B4: a line kept from the last deck, in this deck's language and for a role this cover lacks, goes on the
  // cover of a new deck whose description dictates none.
  const keptLine = 'Qabul qildi: Sinov O‘qituvchi'
  assert.equal(
    (await api(context, 'POST', '/studio/cover-lines', { lines: [keptLine], locale: 'uz' })).status,
    200,
  )
  const made = await makeDeck(context, 'uz', 3)
  const id = made.id
  const coverBody = made.content.sections[0].body.split('\n')
  console.log(`uz cover as generated: ${JSON.stringify(coverBody)}`)
  if (!coverBody.includes(keptLine))
    found(`B4: the kept line "${keptLine}" is not on the new uz deck's cover: ${JSON.stringify(coverBody)}`)
  await page.goto(`${origin}/uz/app/editor/deck/${id}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('deck-editor').waitFor()
  await page.getByTestId('deck-slide').waitFor()
  await until(
    async () =>
      (await page.getByTestId('deck-slide-image').count()) ||
      (await page.getByTestId('deck-preview-off').count()),
    'a picture or the notice',
    30000,
  )
  await look(o, 'root')
  const text = await page.evaluate(() => document.body.innerText)
  const cyrillic = text.match(/[Ѐ-ӿ]+/g)
  if (cyrillic) found(`uz page shows Cyrillic: ${[...new Set(cyrillic)].join(' ')}`)
  const wrongMarks = text.match(/\S*[’'`ʻ]\S*/g)
  if (wrongMarks)
    found(
      `uz page shows apostrophes the house does not use: ${[...new Set(wrongMarks)].slice(0, 8).join(' ')}`,
    )

  // The Cover sheet reads the platform's cover back into its rows, the kept line included.
  await page.getByTestId('deck-cover-open').click()
  await page.getByTestId('deck-cover-sheet').waitFor()
  const coverRows = {
    topic: await page.getByTestId('deck-cover-topic').inputValue(),
    made: await page.getByTestId('deck-cover-made').inputValue(),
    checked: await page.getByTestId('deck-cover-checked').inputValue(),
    group: await page.getByTestId('deck-cover-group').inputValue(),
    school: await page.getByTestId('deck-cover-school').inputValue(),
  }
  console.log(`uz cover rows: ${JSON.stringify(coverRows)}`)
  if (
    coverRows.made !== 'Sinov O‘quvchi' ||
    coverRows.group !== '9-B sinf' ||
    coverRows.school !== '99-maktab'
  )
    found(`uz Cover sheet misreads the cover: ${JSON.stringify(coverRows)} from ${JSON.stringify(coverBody)}`)
  if (coverBody.includes(keptLine) && coverRows.checked !== 'Sinov O‘qituvchi')
    found(
      `uz Cover sheet does not show the kept "Qabul qildi" line as Checked by: ${JSON.stringify(coverRows)}`,
    )
  // At 320 x 568 the sheet is short: its last controls must still scroll into reach, not sit under the bars.
  for (const testid of ['deck-cover-school', 'deck-cover-remember']) {
    const control = page.getByTestId(testid)
    await control.scrollIntoViewIfNeeded()
    const reachable = await control.evaluate((node) => {
      const box = node.getBoundingClientRect()
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return !!hit && (hit === node || node.contains(hit) || !!hit.closest('label')?.contains(node))
    })
    if (!reachable) found(`320 uz: the Cover sheet's ${testid} cannot be tapped: something covers it`)
  }
  await shot(o, 'cover-scrolled')
  await look(o, 'cover')
  await closeSheet(page, 'deck-cover-sheet')
  await assert
    .rejects(
      until(() => answers(log, 'PATCH draft').length > 0, 'a save', 2500),
      undefined,
      'opening and closing the Cover sheet unchanged saves nothing',
    )
    .catch(() => found('uz: opening and closing the Cover sheet with no change saved the draft'))
  await api(context, 'DELETE', '/studio/cover-lines')

  await goTo(page, 2)
  await openField(page, 'heading')
  await page.locator('[data-testid="deck-dock"][data-field="heading"]').waitFor()
  await page.getByTestId('deck-headline').fill('Ҳаво ифлосланиши')
  await shot(o, 'dock-headline')
  await page.getByTestId('deck-dock-done').click()
  await saved(page)
  await onServer(
    o,
    id,
    (c) => c.sections[1].heading === 'Ҳаво ифлосланиши',
    'the Cyrillic headline saved as typed',
  )
  await until(() => answers(log, 'POST latin').length, 'POST /studio/latin')
  const asked = answers(log, 'POST latin')[0]
  console.log(`latin: ${JSON.stringify(asked.sent)} -> ${asked.status} ${JSON.stringify(asked.body)}`)
  assert.deepEqual(asked.sent, { texts: ['Ҳаво ифлосланиши'] })
  assert.deepEqual(asked.body, { texts: ['Havo ifloslanishi'], changed: true })
  const offer = page.getByTestId('deck-latin')
  await offer.waitFor()
  console.log(`latin offer: ${(await offer.textContent()).trim()}`)
  await look(o, 'latin')
  await page.getByTestId('deck-latin-switch').click()
  await saved(page)
  await onServer(
    o,
    id,
    (c) => c.sections[1].heading === 'Havo ifloslanishi',
    'the Latin headline on the server',
  )

  await page.getByTestId('editor-primary').click()
  await page.getByTestId('deck-review-sheet').waitFor()
  await page.locator('[data-testid="deck-review-body"][data-stage="ready"]').waitFor({ timeout: 30000 })
  await look(o, 'review-ready')
  const review = await page.getByTestId('deck-review-sheet').innerText()
  const reviewCyrillic = review.match(/[Ѐ-ӿ]+/g)
  if (reviewCyrillic) found(`uz Review shows Cyrillic: ${reviewCyrillic.join(' ')}`)
  console.log(`uz review: ${review.replace(/\s+/g, ' ').slice(0, 400)}`)
  assert.deepEqual(o.errors, [], 'page errors')
  for (const refused of refusedAnswers(log)) found(`${label(o)}: the platform refused ${refused}`)
  // Last, so the page's own checks above still run when it fails.
  assert.ok(
    coverBody.includes(keptLine),
    `B4: a plain new uz deck takes the line kept in uz: ${JSON.stringify(coverBody)}`,
  )
  await context.close()
  return 'Phone 320 uz dark: the line kept in uz is on a plain new uz deck; a Cyrillic headline is saved as typed, the server offers it in Latin (o‘ with U+2018) and Switch saves that; Review is ready'
})

/* ------------------------------------------------------------------ 9: kept cover lines and a dictated cover */

await group('9 Kept cover lines: a deck naming its own teacher or school takes none of theirs', async () => {
  const context = await browser.newContext()
  opened.add(context)
  await signIn(context, 'uz')
  const keptLine = 'Qabul qildi: Sinov O‘qituvchi'
  // The Cover sheet with only its School row filled of the two, typed bare: no word in it says it is a school,
  // so only the row it was kept from (useDeckCover.roleLines) can tell a new deck what it is.
  const keptSchool = 'QMTU'
  const teacher = 'O‘qituvchi: Rasulova Malika'
  const dictatedGroup = 'Guruh: 305-22'
  const dictatedSchool = '21-maktab'
  // A title slide with no class and no school of its own: only the description or the kept lines can add one.
  const ownCover = 'Bajardi: Sinov O‘quvchi'
  let grouped = []
  let schooled = []
  try {
    const kept = await api(context, 'POST', '/studio/cover-lines', {
      lines: [keptLine, keptSchool],
      locale: 'uz',
      roles: ['checked', 'school'],
    })
    assert.equal(kept.status, 200, `remember: ${JSON.stringify(kept.json)}`)
    assert.deepEqual(kept.json, { lines: [keptLine, keptSchool], locale: 'uz', roles: ['checked', 'school'] })
    assert.deepEqual(
      (await api(context, 'GET', '/studio/cover-lines')).json.roles,
      ['checked', 'school'],
      'the rows come back from GET',
    )
    // The description dictates who checks this deck, labelled another way than the kept line, and its group alone.
    const first = await makeDeck(context, 'uz', 0, {
      prompt: `${DECKS.uz.title}\nTitul sahifaga yoz:\n${teacher}\n${dictatedGroup}`,
      cover: ownCover,
    })
    grouped = first.content.sections[0].body.split('\n')
    console.log(`uz cover with a dictated teacher and group: ${JSON.stringify(grouped)}`)
    // This one names its own school beside the group, and no one who checks it.
    const second = await makeDeck(context, 'uz', 0, {
      prompt: `${DECKS.uz.title}\nTitul sahifaga yoz:\n${ownCover}\n${dictatedGroup}\n${dictatedSchool}`,
      cover: ownCover,
    })
    schooled = second.content.sections[0].body.split('\n')
    console.log(`uz cover with a dictated group and school: ${JSON.stringify(schooled)}`)
  } finally {
    await api(context, 'DELETE', '/studio/cover-lines')
  }
  const has = (cover, line) => cover.some((entry) => entry.trim() === line)
  assert.ok(
    has(grouped, teacher),
    `the teacher the description names is on the cover: ${JSON.stringify(grouped)}`,
  )
  assert.ok(
    !has(grouped, keptLine),
    `the kept teacher stays off a deck that names its own: ${JSON.stringify(grouped)}`,
  )
  assert.ok(
    has(grouped, dictatedGroup),
    `the group the description names is on the cover: ${JSON.stringify(grouped)}`,
  )
  assert.ok(
    has(grouped, keptSchool),
    `the bare "${keptSchool}" kept from the School row goes on a deck that names only its group: ${JSON.stringify(grouped)}`,
  )
  assert.ok(has(grouped, ownCover), `the cover's own lines stay: ${JSON.stringify(grouped)}`)
  assert.ok(
    has(schooled, dictatedSchool),
    `the school the description names is on the cover: ${JSON.stringify(schooled)}`,
  )
  assert.ok(
    !has(schooled, keptSchool),
    `the kept "${keptSchool}" stays off a deck whose description says "${dictatedSchool}": ${JSON.stringify(schooled)}`,
  )
  assert.ok(
    has(schooled, keptLine),
    `a deck that names no one who checks it takes the kept "${keptLine}": ${JSON.stringify(schooled)}`,
  )
  await context.close()
  return 'Kept cover lines with their rows: a new uz deck whose description dictates "O‘qituvchi: …" and "Guruh: 305-22" takes the bare "QMTU" kept from the School row but not the kept "Qabul qildi: …"; one dictating "21-maktab" takes "Qabul qildi: …" but not "QMTU"'
})

/* ------------------------------------------------------------------ 5: over the budget, measured by the platform */

const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']
// Long lines, so that eight of them (the most a slide takes) wrap past what a bullets slide holds.
const LONG_LINES = Array.from(
  { length: 8 },
  (_, n) =>
    `Fixture long line ${NUMBER_WORDS[n]}: warm sun heats the sea, vapour rises high, cools into clouds and falls as rain on far hills`,
)
const squash = (text) => text.replace(/\s+/g, ' ').trim()

await group('5 Phone 390: too long for its slide, refused in Review and split there', async () => {
  const o = await phone({ width: 390, height: 844, locale: 'en', theme: 'light' })
  const { page, log, context } = o
  await signIn(context, 'en')
  await api(context, 'DELETE', '/studio/cover-lines')
  const made = await makeDeck(context, 'en', 0)
  const id = made.id
  await page.goto(`${origin}/en/app/editor/deck/${id}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('deck-editor').waitFor()
  await page.getByTestId('deck-slide').waitFor()
  await until(
    async () =>
      (await page.getByTestId('deck-slide-image').count()) ||
      (await page.getByTestId('deck-preview-off').count()),
    'a picture or the notice',
    30000,
  )
  await goTo(page, 2)
  await openField(page, 'body')
  await page.locator('[data-testid="deck-dock"][data-field="lines"]').waitFor()
  for (let index = 0; index < LONG_LINES.length; index += 1) {
    if (!(await page.getByTestId(`deck-line-${index}`).count()))
      await page.getByTestId('deck-add-line').click()
    await page.getByTestId(`deck-line-${index}`).fill(LONG_LINES[index])
  }
  const addLine = page.getByTestId('deck-add-line')
  const ninth = (await addLine.count()) ? await addLine.isEnabled() : false
  console.log(`over: an "Add line" past 8 lines is ${ninth ? 'still offered' : 'not offered'}`)
  // The platform's /fit says how far over it is; the dock must say so before anything is sent.
  const over = await until(
    () =>
      page.evaluate(() => {
        const budget = document.querySelector('[data-testid="deck-dock-budget"]')
        return budget?.dataset.level === 'over' ? budget.textContent.trim() : null
      }),
    'the budget over',
    20000,
  ).catch(() => null)
  const lastFit = answers(log, 'POST fit')
    .filter((entry) => entry.status === 200)
    .at(-1)?.body
  console.log(`over: budget "${over}"; last /fit ${JSON.stringify(lastFit)}`)
  if (!over)
    found(`over: 8 long lines (/fit: ${JSON.stringify(lastFit)}) and the dock budget never says over`)
  const message = (
    await page
      .getByTestId('deck-dock-message')
      .textContent()
      .catch(() => '')
  ).trim()
  console.log(`over: dock says "${message}"`)
  if (lastFit && !lastFit.fits && lastFit.words_over && !message.includes(String(lastFit.words_over)))
    found(`over: /fit says ${lastFit.words_over} words won't show but the dock says "${message}"`)
  await look(o, 'dock-over')
  await page.getByTestId('deck-dock-done').click()
  await saved(page)
  await onServer(o, id, (c) => c.sections[1].body.split('\n').length === 8, 'the long lines kept as typed')

  // Review: the platform refuses the send (slide_text_too_long), and Review lists the slide with its fixes.
  await page.getByTestId('editor-primary').click()
  await page.getByTestId('deck-review-sheet').waitFor()
  await page.locator('[data-testid="deck-review-body"][data-stage="needs_fix"]').waitFor({ timeout: 30000 })
  const refusal = answers(log, 'POST export-quote').find(
    (entry) => entry.body?.error?.code === 'slide_text_too_long',
  )
  assert.ok(refusal, 'the platform refused slide_text_too_long')
  const rows = refusal.body.error.message_params?.sections ?? []
  console.log(`over: refusal params ${JSON.stringify(refusal.body.error.message_params)}`)
  assert.deepEqual(
    rows.map((row) => [row.id, row.index]),
    [['s2', 1]],
    'slide 2 named',
  )
  const fixRow = page.getByTestId('deck-review-fix-1')
  await fixRow.waitFor()
  const fixText = squash(await fixRow.textContent())
  console.log(`over: Review says "${fixText}"`)
  assert.match(fixText, new RegExp(`Slide 2: ${rows[0].words_over} words? won’t show`))
  await look(o, 'review-fix')
  const before = (await draftOf(o, id)).content.sections.length
  await page.getByTestId('deck-review-fix-1-split').click()
  await saved(page)
  const split = await onServer(o, id, (c) => c.sections.length === before + 1, 'the split from Review')
  const [kept, added] = [split.content.sections[1], split.content.sections[2]]
  console.log(
    `over: split into ${kept.body.split('\n').length} + ${added.body.split('\n').length} lines, new id ${added.id}`,
  )
  assert.equal(kept.id, 's2')
  assert.match(added.id, /^[0-9a-f-]{36}$/)
  assert.equal(added.heading, kept.heading, 'the new slide keeps the headline')
  assert.deepEqual(
    [...kept.body.split('\n'), ...added.body.split('\n')],
    LONG_LINES,
    'every line kept, in order',
  )
  if (!(await page.getByTestId('deck-review-sheet').isVisible()))
    await page.getByTestId('editor-primary').click()
  const settled = await until(
    async () => {
      const stage = await page
        .getByTestId('deck-review-body')
        .getAttribute('data-stage')
        .catch(() => null)
      return ['ready', 'needs_fix'].includes(stage) && stage
    },
    'Review again',
    30000,
  )
  if (settled === 'needs_fix') {
    const still = answers(log, 'POST export-quote').at(-1)?.body?.error?.message_params
    found(
      `over: after Split from Review the platform still refuses the deck as too long: ${JSON.stringify(still)}`,
    )
    await look(o, 'review-fix-again')
  } else {
    await look(o, 'review-after-split')
    await page.getByTestId('editor-confirm').click()
    const pptx = page.getByTestId('deck-download-pptx')
    await pptx.waitFor({ timeout: 60000 })
    const [download] = await Promise.all([page.waitForEvent('download'), pptx.click()])
    const file = path.join(output, 'deck-live-over.pptx')
    await download.saveAs(file)
    const words = squash(pptxWords(await fs.readFile(file)).join(' '))
    const lost = LONG_LINES.filter((line) => !words.includes(squash(line)))
    if (lost.length)
      found(`over: the PowerPoint lacks ${lost.length} of the 8 lines after the split: ${lost[0]}`)
  }
  assert.deepEqual(o.errors, [], 'page errors')
  const tooLong = (entry) =>
    entry.name === 'POST export-quote' && entry.body?.error?.code === 'slide_text_too_long'
  for (const refused of refusedAnswers(log, [tooLong])) found(`over: the platform refused ${refused}`)
  await context.close()
  return `Too long: the dock says "${over}" from the platform's /fit, the send is refused (slide 2, ${rows[0].words_over} words) and Review's Split ${settled === 'ready' ? 'lets it go, every line in the file' : 'does not clear it'}`
})

/* ------------------------------------------------------------------ 6: Send to chat, as a Mini App asks it */

// Telegram cannot be driven here, so the two requests the page makes inside it are made directly, as
// useDeckSend makes them (export-quote deliver chat, then /jobs with deliver_to_chat), on group 1's deck.
await group('6 Send to chat: the requests a Mini App makes', async () => {
  assert.ok(keySets.draftId, 'group 1 made a deck')
  const context = await browser.newContext()
  opened.add(context)
  await signIn(context, 'en')
  const draft = (await api(context, 'GET', `/generation/drafts/${keySets.draftId}`)).json
  const quoteFor = (deliver) =>
    api(context, 'POST', `/generation/drafts/${keySets.draftId}/export-quote`, {
      version: draft.version,
      format: 'pptx',
      deliver,
    })
  const quote = await quoteFor('chat')
  console.log(
    `chat: export-quote ${quote.status} ${quote.json?.error?.code ?? JSON.stringify(quote.json?.summary)}`,
  )
  assert.equal(quote.status, 201, JSON.stringify(quote.json))
  const key = `deck-live-chat-${quote.json.id}`
  const first = await api(
    context,
    'POST',
    '/jobs',
    { quote_id: quote.json.id, deliver_to_chat: true },
    { 'Idempotency-Key': key },
  )
  console.log(
    `chat: POST /jobs ${first.status} ${first.json?.status} ${first.json?.origin_channel} ${first.json?.error?.code ?? ''}`,
  )
  assert.ok([200, 201].includes(first.status), JSON.stringify(first.json))
  const job = await until(
    async () => {
      const now = await api(context, 'GET', `/jobs/${first.json.id}`)
      return ['queued', 'running'].includes(now.json?.status) ? null : now.json
    },
    'the chat send made',
    120000,
  )
  console.log(
    `chat: job ${job.status}, origin ${job.origin_channel}, parameters ${JSON.stringify(job.parameters)}`,
  )
  assert.equal(job.status, 'succeeded', JSON.stringify(job.error))
  if (job.origin_channel !== 'mini_app')
    found(`chat: a deliver chat send is recorded from ${job.origin_channel}, not mini_app`)
  const again = await api(
    context,
    'POST',
    '/jobs',
    { quote_id: quote.json.id, deliver_to_chat: true },
    { 'Idempotency-Key': key },
  )
  assert.equal(again.status, 200, 'the same key again: the same job')
  assert.equal(again.json.id, first.json.id)
  // The same version quoted for download: the file it already made, kept another day (200), not a new task.
  let download = await quoteFor('download')
  if (download.status === 429 && download.json?.error?.code === 'rate_limited') {
    // Ten quotes a minute an account (EXPORT_QUOTES_PER_MINUTE); the groups before used them.
    console.log('chat: export-quote rate_limited after the earlier groups; waiting out the minute')
    await sleep(61000)
    download = await quoteFor('download')
  }
  assert.equal(download.status, 201, JSON.stringify(download.json))
  const repeat = await api(
    context,
    'POST',
    '/jobs',
    { quote_id: download.json.id },
    { 'Idempotency-Key': `deck-live-dl-${download.json.id}` },
  )
  console.log(
    `chat: same version for download -> quote ${download.status} cost ${JSON.stringify(download.json?.summary?.cost)}, /jobs ${repeat.status} ${repeat.json?.id === first.json.id ? 'the same job' : `another job (${repeat.json?.status ?? repeat.json?.error?.code})`}`,
  )
  return `Send to chat: export-quote deliver chat 201, /jobs deliver_to_chat ${first.status} -> ${job.status} (${job.origin_channel}); same key 200 same job; same version for download -> /jobs ${repeat.status}`
})

/* ------------------------------------------------------------------ 7: two tabs, one deck */

await group('7 Two tabs: the platform refuses the older one and the page asks', async () => {
  assert.ok(keySets.draftId, 'group 1 made a deck')
  const id = keySets.draftId
  const o = await phone({ width: 390, height: 844, locale: 'en', theme: 'light' })
  const { page: a, context } = o
  await signIn(context, 'en')
  const b = await context.newPage()
  const bLog = []
  record(b, bLog)
  for (const page of [a, b]) {
    await page.goto(`${origin}/en/app/editor/deck/${id}`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('deck-editor').waitFor()
    await page.getByTestId('deck-slide').waitFor()
  }
  await a.bringToFront()
  await goTo(a, 3)
  await openField(a, 'heading')
  await a.locator('[data-testid="deck-dock"][data-field="heading"]').waitFor()
  await a.getByTestId('deck-headline').fill('Changed in the first tab')
  await a.getByTestId('deck-dock-done').click()
  await saved(a)
  await onServer(o, id, (c) => c.sections[2].heading === 'Changed in the first tab', 'the first tab saved')
  await b.bringToFront()
  await goTo(b, 4)
  await openField(b, 'heading')
  await b.locator('[data-testid="deck-dock"][data-field="heading"]').waitFor()
  await b.getByTestId('deck-headline').fill('Changed in the second tab')
  await b.getByTestId('deck-dock-done').click()
  // Either the page knew of the newer version (it looks again when shown) and saved on top of it, or the
  // platform refuses the older version and the page asks. Never the first tab's words lost unasked.
  const outcome = await until(
    async () =>
      (await b.getByTestId('deck-conflict').count())
        ? 'conflict'
        : (await b.evaluate(
              () => document.querySelector('[data-testid="editor-save-icon"]')?.dataset.state,
            )) === 'saved' && bLog.some((entry) => entry.name === 'PATCH draft' && entry.status === 200)
          ? 'saved'
          : null,
    'a conflict or a save from the second tab',
    20000,
  )
  // The banner can show before the recorder has read the refusal's body and logged it.
  if (outcome === 'conflict')
    await until(
      () => bLog.some((entry) => entry.name === 'PATCH draft' && entry.status === 409),
      'the refused PATCH logged',
      5000,
    )
  const patches = bLog
    .filter((entry) => entry.name === 'PATCH draft')
    .map((entry) => `${entry.status} ${entry.body?.error?.code ?? `v${entry.body?.version}`}`)
  console.log(`tabs: second tab ${outcome}; its PATCHes ${patches.join(', ')}`)
  let result
  if (outcome === 'saved') {
    const both = await draftOf(o, id)
    const kept = [both.content.sections[2].heading, both.content.sections[3].heading]
    console.log(`tabs: on the server now ${JSON.stringify(kept)}`)
    if (kept[0] !== 'Changed in the first tab')
      found(
        `tabs: the second tab's save overwrote the first tab's headline without asking: ${JSON.stringify(kept)}`,
      )
    assert.equal(kept[1], 'Changed in the second tab')
    result =
      'Two tabs: the second tab took up the newer version as it was shown and saved on top of it; both headlines kept'
  } else {
    const refused = bLog.find((entry) => entry.name === 'PATCH draft' && entry.status === 409)
    console.log(`tabs: banner "${squash(await b.getByTestId('deck-conflict').textContent())}"`)
    assert.equal(refused?.body?.error?.code, 'version_conflict')
    await b.screenshot({ path: path.join(output, `${label(o)}-tabs-conflict.png`) })
    const serverNow = await draftOf(o, id)
    assert.equal(
      serverNow.content.sections[2].heading,
      'Changed in the first tab',
      'nothing overwritten before the choice',
    )
    await b.getByTestId('deck-conflict-take').click()
    await until(async () => !(await b.getByTestId('deck-conflict').count()), 'the banner gone')
    await goTo(b, 3)
    const shown = await b.evaluate(
      () =>
        document.querySelector('[data-testid="deck-slide-image"]')?.alt ||
        document.querySelector('[data-testid="deck-blank-heading"]')?.textContent ||
        '',
    )
    console.log(`tabs: after Take, the second tab's slide 3 says "${squash(shown)}"`)
    if (!shown.includes('Changed in the first tab'))
      found(
        `tabs: after "take theirs" the second tab does not show the first tab's headline: "${squash(shown)}"`,
      )
    result =
      'Two tabs: the older tab is refused version_conflict by the platform, the page holds and asks, and Take shows the other tab’s words'
  }
  await context.close()
  return result
})

/* ------------------------------------------------------------------ 8: Edit from the task pages */

await group('8 Task pages: Edit under a made deck and under a sent one opens the deck editor', async () => {
  assert.ok(keySets.draftId && keySets.exportJobId, 'group 1 made and sent a deck')
  const o = await phone({ width: 390, height: 844, locale: 'en', theme: 'light' })
  const { page, context } = o
  await signIn(context, 'en')
  const said = []
  for (const [what, jobId] of [
    ['the generation task', generationJobs.get(keySets.draftId)],
    ['the send from the editor', keySets.exportJobId],
  ]) {
    await page.goto(`${origin}/en/app/jobs/${jobId}`, { waitUntil: 'domcontentloaded' })
    const edit = page.getByTestId('artifact-edit').first()
    const shown = await edit
      .waitFor({ timeout: 20000 })
      .then(() => true)
      .catch(() => false)
    const href = shown ? await edit.getAttribute('href') : null
    const reviewDraft = await page.getByRole('link', { name: 'Review draft' }).count()
    console.log(
      `task page (${what}): Edit ${href ?? 'missing'}; "Review draft" ${reviewDraft ? 'shown' : 'hidden'}`,
    )
    said.push(`${what}: ${href ?? 'no Edit'}`)
    if (href !== `/en/app/editor/deck/${keySets.draftId}`) {
      found(`task page (${what}): Edit goes to ${href ?? 'nowhere'}, not the deck editor for its draft`)
      continue
    }
    if (reviewDraft)
      found(`task page (${what}): "Review draft" is still offered beside the deck editor's Edit`)
    await shot(o, `task-${what.split(' ').at(-1)}`)
    await edit.click()
    await page.getByTestId('deck-editor').waitFor()
    await page.getByTestId('deck-slide').waitFor()
    assert.equal(await page.getByTestId('deck-refusal').count(), 0, 'the deck opens from the task page')
  }
  assert.deepEqual(o.errors, [], 'page errors')
  await context.close()
  return `Task pages: ${said.join('; ')}`
})

/* ------------------------------------------------------------------ 3: the helpers called for real */

await group('3 Latin and cover lines, called directly', async () => {
  const context = await browser.newContext()
  await signIn(context, 'en')
  const latin = await api(context, 'POST', '/studio/latin', {
    texts: ['Ҳаво ифлосланиши', 'Ўқувчилар', 'Already Latin'],
  })
  assert.equal(latin.status, 200)
  assert.deepEqual(latin.json, {
    texts: ['Havo ifloslanishi', 'O‘quvchilar', 'Already Latin'],
    changed: true,
  })
  keySets.latin = latin.json
  const refused = await api(context, 'POST', '/studio/latin', { texts: [] })
  assert.equal(refused.status, 400)
  assert.equal(refused.json.error.code, 'invalid_parameters')
  // Kept with the Cover sheet row of each, one per line: a bare "Northbrook" from the School row is the school.
  const asked = await api(context, 'POST', '/studio/cover-lines', {
    lines: ['Prepared by:\tFixture  Pupil', ' 9-B class ', 'Northbrook'],
    locale: 'en',
    roles: ['made', 'group', 'school'],
  })
  assert.equal(asked.status, 200, `remember: ${JSON.stringify(asked.json)}`)
  const keptLines = {
    lines: ['Prepared by: Fixture Pupil', '9-B class', 'Northbrook'],
    locale: 'en',
    roles: ['made', 'group', 'school'],
  }
  assert.deepEqual(asked.json, keptLines)
  const read = await api(context, 'GET', '/studio/cover-lines')
  assert.deepEqual(read.json, keptLines, 'the rows come back from GET')
  const profile = await api(context, 'GET', '/me')
  assert.equal(JSON.stringify(profile.json).includes('Fixture Pupil'), false, 'never in the profile')
  // A client that says neither the deck's language nor the rows keeps the lines with neither, a null per line;
  // a language not listed, a row not listed and rows not one per line are refused.
  const unsaid = await api(context, 'POST', '/studio/cover-lines', { lines: ['9-B class'] })
  assert.deepEqual(unsaid.json, { lines: ['9-B class'], locale: null, roles: [null] })
  // A blank line goes with its row, so the rest stay in step.
  const blank = await api(context, 'POST', '/studio/cover-lines', {
    lines: [' ', 'Northbrook'],
    locale: 'en',
    roles: ['made', 'school'],
  })
  assert.deepEqual(blank.json, { lines: ['Northbrook'], locale: 'en', roles: ['school'] })
  const partly = await api(context, 'POST', '/studio/cover-lines', {
    lines: ['Prepared by: Fixture Pupil', 'Northbrook'],
    locale: 'en',
    roles: [null, 'school'],
  })
  assert.deepEqual(partly.json, {
    lines: ['Prepared by: Fixture Pupil', 'Northbrook'],
    locale: 'en',
    roles: [null, 'school'],
  })
  for (const [what, refused] of [
    ['a language not listed', { lines: ['9-B class'], locale: 'de' }],
    ['a row not listed', { lines: ['9-B class'], locale: 'en', roles: ['class'] }],
    [
      'fewer rows than lines',
      { lines: ['Prepared by: Fixture Pupil', '9-B class'], locale: 'en', roles: ['made'] },
    ],
    ['more rows than lines', { lines: ['9-B class'], locale: 'en', roles: ['group', 'school'] }],
  ]) {
    const answer = await api(context, 'POST', '/studio/cover-lines', refused)
    assert.equal(answer.status, 400, `${what}: ${JSON.stringify(answer.json)}`)
    assert.equal(answer.json.error.code, 'invalid_parameters', what)
  }
  assert.deepEqual(
    (await api(context, 'GET', '/studio/cover-lines')).json.roles,
    [null, 'school'],
    'a refused POST keeps what was kept',
  )
  const forgot = await api(context, 'DELETE', '/studio/cover-lines')
  assert.equal(forgot.status, 200)
  assert.deepEqual(forgot.json, { lines: [], locale: null, roles: [] })
  assert.deepEqual((await api(context, 'GET', '/studio/cover-lines')).json, {
    lines: [],
    locale: null,
    roles: [],
  })
  keySets.coverLines = read.json
  await context.close()
  return 'POST /studio/latin writes Latin (o‘ U+2018); cover lines are cleaned, kept with their deck’s language and the row of each (null unsaid; refused: a language or row not listed, rows not one per line), read back with GET, out of /me, and forgotten ({lines: [], locale: null, roles: []})'
})

/* ------------------------------------------------------------------ 4: the shapes side by side */

await group('4 Answer shapes against the fixtures', async () => {
  if (keySets.latin) seen.set('POST latin', keySets.latin)
  if (keySets.coverLines) seen.set('cover-lines', keySets.coverLines)
  // A job made in-process (LOCAL_SYNC_JOBS) is done before the page looks: GET /jobs/{id} as the script read it.
  if (keySets.jobFromApi && !seen.has('GET job')) seen.set('GET job', keySets.jobFromApi)
  if (seen.has('GET render slides')) seen.set('GET render', seen.get('GET render slides'))
  const report = {}
  for (const [name, mock] of Object.entries(MOCK)) {
    const real = seen.get(name)
    if (!real) {
      report[name] = 'not seen'
      continue
    }
    const realPaths = paths(real)
    const mockPaths = paths(mock)
    const invented = [...mockPaths].filter((key) => !realPaths.has(key))
    const unknown = [...realPaths].filter((key) => !mockPaths.has(key))
    const reads = [...(WEB_READS[name] ?? [])].filter((key) => !realPaths.has(key))
    report[name] = { invented, unknown, webReadsMissing: reads }
    for (const key of reads) found(`${name}: the web reads \`${key}\`, which the platform did not send`)
  }
  const slides = seen.get('GET render slides')
  if (slides) {
    const realPaths = paths(slides)
    const reads = WEB_READS['GET render slides'].filter((key) => !realPaths.has(key))
    for (const key of reads) found(`GET render: the web reads \`${key}\`, which the platform did not send`)
    report['GET render slides'] = { webReadsMissing: reads, sample: slides.slides[0] }
  } else report['GET render slides'] = 'never done here (no LibreOffice): slide keys unverified'
  await fs.writeFile(path.join(output, 'shapes.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  return 'Shapes compared and written to shapes.json'
})

await Promise.race([browser.close().catch(() => {}), sleep(10000)])
console.log(`\npassed (${checks.length}):\n${checks.map((name) => `  - ${name}`).join('\n')}`)
if (findings.length)
  console.log(`\nmismatches (${findings.length}):\n${findings.map((what) => `  - ${what}`).join('\n')}`)
if (failures.length) {
  console.error(
    `\nfailed (${failures.length}):\n${failures.map(([name, error]) => `  - ${name}: ${error.message}`).join('\n')}`,
  )
  process.exit(1)
}
process.exit(0)
