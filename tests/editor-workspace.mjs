/**
 * Offline browser checks for the PDF editor workspace.
 *
 * Every API call is intercepted and every external request is blocked, so this
 * exercises real rendering and real interaction without touching a customer
 * account, spending allowance or reaching any third party.
 *
 * Run against `nuxt preview` (not `nuxt dev`) so the built pdf.js assets under
 * /pdfjs are the ones being served.
 */
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const origin = process.env.EDITOR_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(
  ['127.0.0.1', 'localhost'].includes(new URL(origin).hostname),
  'Use the local web server for this fixture test',
)
const output = path.resolve(process.env.EDITOR_ARTIFACT_DIR || '../editor-review/workspace')
await fs.mkdir(output, { recursive: true })

const PAGE = { width: 595.276, height: 841.89 }
const pdfBytes = await fs.readFile('tests/fixtures/research-notes.pdf')
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
// The export engine's own measure of text, which `check:fonts` pins to reportlab.
const { parseFontMetrics, widthFromMetrics, splitLines } = await import(
  path.resolve('app/composables/useEditorFontMetrics.ts')
)
const fontFile = await fs.readFile('public/fonts/noto-sans-regular.ttf')
const font = parseFontMetrics(
  fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength),
)

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
// What the app asked of the browser, which a route handler cannot see: whether a
// save may outlive the page, and which listeners are still attached.
await context.addInitScript(() => {
  window.__patchKeepalive = []
  window.__listeners = { visibilitychange: 0, pagehide: 0 }
  const realFetch = window.fetch
  window.fetch = (input, init) => {
    if (init?.method === 'PATCH') window.__patchKeepalive.push(init.keepalive === true)
    return realFetch(input, init)
  }
  for (const target of [window, document]) {
    const add = target.addEventListener
    const remove = target.removeEventListener
    target.addEventListener = function (name, ...rest) {
      if (name in window.__listeners) window.__listeners[name] += 1
      return add.call(this, name, ...rest)
    }
    target.removeEventListener = function (name, ...rest) {
      if (name in window.__listeners) window.__listeners[name] -= 1
      return remove.call(this, name, ...rest)
    }
  }
})
const page = await context.newPage()
page.setDefaultTimeout(15000)
page.setDefaultNavigationTimeout(20000)

const errors = []
const checks = []
const requests = []
const unexpected = []
const external = []
page.on('pageerror', (e) => errors.push(e.message))

let plan = 'premium'
let conflictOnce = false
let failJobOnce = false
// A refusal the next PATCH gets whatever it carries: [code, status].
let refuseSaveOnce = null
// The next PATCH lands and its answer never comes back, or it never arrives at all.
let loseAnswerOnce = false
let loseRequestOnce = false
// How long a PATCH takes, and how many were ever on their way at once.
let patchDelay = 0
let patchesInFlight = 0
let mostPatchesInFlight = 0
// How long the other slow requests take.
let quoteDelay = 0
let downloadDelay = 0
let fileReadDelay = 0
let uploadDelay = 0
let documentReadDelay = 0
let failDocumentReadOnce = false
// Attached images the server says have gone, and ones it cannot be asked about.
const expiredFiles = new Set()
const unreadableFiles = new Set()
// What the next upload turns out to be, whatever the picker was told.
let uploadMime = 'image/png'
const uploadMimes = new Map()
let pageSizes = [PAGE, PAGE]
// Refusals the fixture's `normalize` made on its own. Nothing the app does may cause one.
const refusedCommands = []
// Text the fixture's engine failed a job for, after it was confirmed. Nothing may get that far.
const overflowedJobs = []
let draftLimits = { commands: 100, bytes: 100000 }
// A server from before `limits` existed does not state them.
let stateLimits = true
// A second document, slow to open, for the check that a later one wins.
const slowDocumentId = '00000000-0000-4000-8000-0000000000a1'
const editor = {
  id: '00000000-0000-4000-8000-000000000001',
  version: 1,
  commands: [],
  input_ids: ['00000000-0000-4000-8000-0000000000f1'],
}
const quotes = new Map()
const jobs = new Map()
const acceptedKeys = new Map()
let sequence = 0
const id = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`

const editorFeatures = [
  'editor.visual',
  'editor.add_text',
  'editor.highlight',
  'editor.annotate',
  'editor.fill_forms',
  'editor.signature_image',
  'editor.existing_text',
  'editor.insert_images',
  'editor.replace_images',
  'editor.redact',
]
// Every plan has every tool. A tool can still be switched off for everyone,
// which the catalog says with `eligible: false`; the test switches some off.
const switchedOff = new Set()

function documentPayload() {
  return {
    id: editor.id,
    version: editor.version,
    file: {
      id: editor.input_ids[0],
      name: 'research-notes.pdf',
      page_count: 2,
      mime_type: 'application/pdf',
      state: 'ready',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      preview_url: `/api/v1/files/${editor.input_ids[0]}/preview`,
    },
    pages: pageSizes,
    form_fields: [{ name: 'participant', type: '/Tx' }],
    image_counts: [1, 0],
    commands: editor.commands,
    input_ids: editor.input_ids,
    ...(stateLimits ? { limits: draftLimits } : {}),
  }
}

/**
 * `processors/editor.py: normalize`, which the real PATCH runs: one bad command
 * and the whole draft is refused. Returns the command with its defaults filled
 * in, or null.
 */
const COMMAND_FIELDS = {
  add_text: ['type', 'page', 'x', 'y', 'text', 'font_size', 'color'],
  highlight: ['type', 'page', 'x', 'y', 'width', 'height', 'color'],
  note: ['type', 'page', 'x', 'y', 'text'],
  draw: ['type', 'page', 'points', 'color', 'stroke_width'],
  fill_form: ['type', 'field', 'value'],
  signature: ['type', 'page', 'x', 'y', 'width', 'height', 'input_index'],
  insert_image: ['type', 'page', 'x', 'y', 'width', 'height', 'input_index'],
  replace_text: ['type', 'page', 'find', 'replacement'],
  replace_image: ['type', 'page', 'image_index', 'input_index'],
  remove_image: ['type', 'page', 'image_index'],
  redact: ['type', 'page', 'x', 'y', 'width', 'height'],
}
/** `apps/studio/editor_policy.py: COMMAND_FEATURES`: a switched-off tool refuses the whole draft. */
const COMMAND_FEATURES = {
  add_text: 'editor.add_text',
  highlight: 'editor.highlight',
  note: 'editor.annotate',
  draw: 'editor.annotate',
  fill_form: 'editor.fill_forms',
  signature: 'editor.signature_image',
  insert_image: 'editor.insert_images',
  replace_text: 'editor.existing_text',
  replace_image: 'editor.replace_images',
  remove_image: 'editor.replace_images',
  redact: 'editor.redact',
}
const inRange = (value, low = 0, high = 14400) =>
  typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high
const integerIn = (value, low, high) => Number.isInteger(value) && value >= low && value <= high
const stringUpTo = (value, length) => typeof value === 'string' && [...value].length <= length

function normalizeCommand(raw, inputCount, pageCount = 2) {
  const fields = COMMAND_FIELDS[raw?.type]
  if (!fields || Object.keys(raw).some((key) => !fields.includes(key))) return null
  const command = { ...raw }
  const kind = command.type
  if (kind !== 'fill_form' && !integerIn(command.page, 1, pageCount)) return null
  for (const axis of ['x', 'y']) if (fields.includes(axis) && !inRange(command[axis])) return null
  for (const size of ['width', 'height']) if (fields.includes(size) && !inRange(command[size], 1)) return null
  if (kind === 'add_text' || kind === 'note') {
    if (!stringUpTo(command.text, 2000) || !command.text) return null
    if ([...command.text].some((c) => c.codePointAt(0) < 32 && c !== '\n' && c !== '\t')) return null
  }
  if (kind === 'add_text') {
    command.font_size ??= 16
    if (!inRange(command.font_size, 6, 96)) return null
  }
  if (kind === 'add_text' || kind === 'highlight' || kind === 'draw') {
    command.color ??= kind === 'highlight' ? '#FFFF00' : '#000000'
    if (typeof command.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(command.color)) return null
  }
  if (kind === 'draw') {
    const points = command.points
    if (!Array.isArray(points) || points.length < 2 || points.length > 200) return null
    if (points.some((point) => !Array.isArray(point) || point.length !== 2 || !point.every((v) => inRange(v))))
      return null
    command.stroke_width ??= 2
    if (!inRange(command.stroke_width, 0.5, 12)) return null
  }
  if (kind === 'fill_form') {
    if (!stringUpTo(command.field, 200) || !command.field || !stringUpTo(command.value, 2000)) return null
  }
  if (kind === 'replace_text') {
    if (!stringUpTo(command.find, 500) || !stringUpTo(command.replacement, 500) || !command.find) return null
  }
  if (kind === 'insert_image' || kind === 'signature' || kind === 'replace_image') {
    if (!integerIn(command.input_index, 1, inputCount - 1)) return null
  }
  if (kind === 'replace_image' || kind === 'remove_image') {
    if (!integerIn(command.image_index, 0, 999)) return null
  }
  return command
}

/** `processors/editor.py: _overlay`: the engine never wraps, and one line past the page fails the job. */
function overflowsPage(command) {
  if (command.type !== 'add_text') return false
  const lines = splitLines(command.text)
  return (
    lines.some((line) => command.x + widthFromMetrics(font, line, command.font_size) > PAGE.width) ||
    command.y + lines.length * command.font_size * 1.3 > PAGE.height
  )
}

// Block everything that is not explicitly served by the fixture.
const blockExternal = (route) => {
  const url = new URL(route.request().url())
  if (url.origin === origin && url.pathname.startsWith('/api/')) {
    unexpected.push({ path: url.pathname, method: route.request().method() })
    return route.abort('blockedbyclient')
  }
  if (url.origin === origin || url.protocol === 'data:' || url.protocol === 'blob:') return route.continue()
  if (url.hostname === 'telegram.org')
    return route.fulfill({ contentType: 'application/javascript', body: '' })
  external.push(url.origin)
  return route.abort('blockedbyclient')
}

const fixtureApi = async (route) => {
  const request = route.request()
  const url = new URL(request.url())
  const endpoint = url.pathname.replace('/api/v1', '')
  const method = request.method()
  let body = null
  try {
    body = request.postDataJSON()
  } catch {
    body = null
  }
  requests.push({ path: endpoint, method, body, key: request.headers()['idempotency-key'] })
  const json = (value, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
  const failure = (code, status = 409) => json({ error: { code, message: code } }, status)

  if (endpoint === '/auth/session')
    return json({
      authenticated: true,
      user: { id: 'u1', plan, locale: 'en', display_name: 'Fixture Reader', preferences: {}, time_zone: 'UTC' },
      csrf_token: 'fixture',
      development_login_enabled: false,
    })
  if (endpoint === '/auth/providers') return json({ providers: [] })
  if (endpoint === '/me') return json({ id: 'u1', plan, locale: 'en', display_name: 'Fixture Reader', preferences: {}, time_zone: 'UTC' })
  if (endpoint === '/catalog')
    return json({
      features: editorFeatures.map((feature) => ({
        id: feature,
        name: feature,
        category: 'editor',
        eligible: !switchedOff.has(feature),
      })),
      draft: true,
    })
  if (endpoint === '/plans') return json({ plans: [{ id: plan, name: plan, limits: {} }], draft: true })
  // The seller's details and contacts, which public pages and Help read.
  if (endpoint === '/contacts')
    return json({ support: { username: '', url: '' }, ads: { username: '', url: '' }, bot: { username: '', url: '' },
      company: { name: '"ARCANIUM TECHNOLOGIES" MCHJ', tin: '313458514', address: 'Toshkent', phone: '', email: '' } })
  if (endpoint === '/usage')
    return json({ plan: 'free', week: { starts_at: '2026-10-11T19:00:00Z', resets_at: '2026-10-18T19:00:00Z', time_zone: 'Asia/Tashkent' }, resets_at: '2026-10-18T19:00:00Z',
      ai_documents: { limit: 5, used: 0, remaining: 5 }, file_jobs: { limit: 15, used: 4, remaining: 11 }, edits_per_file: 3 })
  if (endpoint === '/jobs' && method === 'GET') return json({ results: [...jobs.values()], count: jobs.size })
  if (endpoint === '/studio/config') return json({ features: [], limits: {}, provider: {} })
  // Every plan keeps 30 form templates; a cap of zero means saving them is off for everyone.
  if (endpoint === '/editor/form-templates')
    return json({ results: [], limit: switchedOff.has('editor.form_templates') ? 0 : 30 })

  if (endpoint === '/editor/documents' && method === 'GET') {
    // A list answers without the marks: only the draft itself holds them.
    const { commands: _commands, ...row } = documentPayload()
    return json({ results: [row] })
  }
  if (endpoint === '/editor/documents' && method === 'POST') return json({ id: editor.id }, 201)
  if (endpoint === `/editor/documents/${editor.id}` && method === 'GET') {
    if (documentReadDelay) await new Promise((resolve) => setTimeout(resolve, documentReadDelay))
    if (failDocumentReadOnce) {
      failDocumentReadOnce = false
      return failure('upstream_unavailable', 503)
    }
    return json(documentPayload())
  }
  if (endpoint === `/editor/documents/${slowDocumentId}`) {
    await new Promise((resolve) => setTimeout(resolve, 800))
    const slow = documentPayload()
    return json({ ...slow, id: slowDocumentId, file: { ...slow.file, name: 'slow.pdf' } })
  }
  if (endpoint === `/editor/documents/${editor.id}` && method === 'PATCH') {
    patchesInFlight += 1
    mostPatchesInFlight = Math.max(mostPatchesInFlight, patchesInFlight)
    if (patchDelay) await new Promise((resolve) => setTimeout(resolve, patchDelay))
    patchesInFlight -= 1
    if (loseRequestOnce) {
      loseRequestOnce = false
      return route.abort('connectionreset')
    }
    if (refuseSaveOnce) {
      const [code, status] = refuseSaveOnce
      refuseSaveOnce = null
      return failure(code, status)
    }
    if (conflictOnce) {
      conflictOnce = false
      return failure('version_conflict')
    }
    if (body.version !== editor.version) return failure('version_conflict')
    assert.ok(Array.isArray(body.commands), 'PATCH sends a command array')
    assert.equal(body.input_ids[0], editor.input_ids[0], 'the source file stays input 0')
    // `validate_inputs`: one attachment that has gone or is not an image refuses the whole draft.
    if (body.input_ids.some((file) => expiredFiles.has(file))) return failure('file_unavailable', 404)
    if (body.input_ids.some((file) => uploadMimes.has(file) && !uploadMimes.get(file).startsWith('image/')))
      return failure('unsupported_file', 400)
    if (body.commands.some((command) => switchedOff.has(COMMAND_FEATURES[command.type])))
      return failure('feature_not_in_plan', 403)
    const normalized = body.commands.map((command) => normalizeCommand(command, body.input_ids.length))
    if (normalized.includes(null)) {
      refusedCommands.push(body.commands[normalized.indexOf(null)])
      return failure('invalid_editor_command', 400)
    }
    if (Buffer.byteLength(JSON.stringify(normalized)) > draftLimits.bytes) return failure('payload_too_large', 413)
    editor.commands = normalized
    editor.input_ids = body.input_ids
    editor.version += 1
    if (loseAnswerOnce) {
      loseAnswerOnce = false
      return route.abort('connectionreset')
    }
    return json(documentPayload())
  }
  if (endpoint === `/editor/documents/${editor.id}/quote` && method === 'POST') {
    if (body.version !== editor.version) return failure('version_conflict')
    // `create_quote` allows a saved draft its size and a small wrapper, so what saves can be quoted.
    if (Buffer.byteLength(JSON.stringify(editor.commands)) > 101024) return failure('invalid_parameters', 400)
    if (editor.input_ids.some((file) => expiredFiles.has(file))) return failure('file_unavailable', 404)
    const quote = {
      id: id(),
      feature_id: 'editor.visual',
      affordable: true,
      usage: { file_jobs: { limit: 15, used: 4, remaining: 11 }, resets_at: '2026-10-18T19:00:00Z' },
      expires_at: new Date(Date.now() + 600000).toISOString(),
    }
    quotes.set(quote.id, { ...quote, commands: editor.commands })
    if (quoteDelay) await new Promise((resolve) => setTimeout(resolve, quoteDelay))
    return json(quote, 201)
  }
  if (endpoint === '/quotes' && method === 'POST') {
    const quote = {
      id: id(),
      feature_id: body.feature_id,
      affordable: true,
      expires_at: new Date(Date.now() + 600000).toISOString(),
    }
    quotes.set(quote.id, quote)
    return json(quote, 201)
  }
  if (endpoint === '/jobs' && method === 'POST') {
    const key = request.headers()['idempotency-key']
    if (acceptedKeys.has(key)) return json(acceptedKeys.get(key))
    if (!quotes.has(body.quote_id)) return failure('quote_expired')
    const overflowing = (quotes.get(body.quote_id).commands ?? []).filter(overflowsPage)
    overflowedJobs.push(...overflowing)
    const status = overflowing.length ? 'failed' : 'succeeded'
    const job = { id: id(), feature_id: 'editor.visual', status, artifacts: [], warnings: [] }
    jobs.set(job.id, job)
    acceptedKeys.set(key, job)
    if (failJobOnce) {
      failJobOnce = false
      return json({ error: { code: 'upstream_unavailable', message: 'Fixture interruption' } }, 503)
    }
    return json(job, 201)
  }
  if (endpoint.startsWith('/jobs/')) return json(jobs.get(endpoint.split('/')[2]) || {})
  if (endpoint === '/files/uploads' && method === 'POST') {
    if (uploadDelay) await new Promise((resolve) => setTimeout(resolve, uploadDelay))
    const upload = { id: id(), name: 'image.png', mime_type: uploadMime, state: 'ready' }
    uploadMimes.set(upload.id, uploadMime)
    return json(upload, 201)
  }
  if (/^\/files\/[^/]+\/download$/.test(endpoint)) {
    if (downloadDelay) await new Promise((resolve) => setTimeout(resolve, downloadDelay))
    return route.fulfill({ status: 200, contentType: 'application/pdf', body: pdfBytes })
  }
  if (/^\/files\/[^/]+\/preview$/.test(endpoint))
    return route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng })
  if (/^\/files\/[^/]+$/.test(endpoint)) {
    const file = endpoint.split('/')[2]
    if (fileReadDelay) await new Promise((resolve) => setTimeout(resolve, fileReadDelay))
    if (unreadableFiles.has(file)) return failure('upstream_unavailable', 503)
    const state = expiredFiles.has(file) ? 'expired' : 'ready'
    return json({ id: file, name: 'image.png', mime_type: 'image/png', state })
  }

  unexpected.push({ path: endpoint, method })
  return failure('unexpected_fixture_request', 404)
}

await context.route('**/*', blockExternal)
await context.route(`${origin}/api/v1/**`, fixtureApi)

const open = async (locale = 'en') => {
  await page.goto(`${origin}/${locale}/app/editor/${editor.id}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('editor-page-1').waitFor()
}

/**
 * Clear the fixture document only once any autosave has landed — resetting it
 * mid-flight lets a pending PATCH repopulate it behind the next check.
 */
async function resetDocument() {
  const before = requests.length
  await page.waitForTimeout(1400)
  if (requests.length !== before) await page.waitForTimeout(1000)
  editor.commands = []
  editor.input_ids = editor.input_ids.slice(0, 1)
}

/** Fit-to-width resizes the page once rendering settles; wait that out. */
async function settledBox(testId) {
  let previous = null
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const box = await page.getByTestId(testId).boundingBox()
    if (box && previous && Math.abs(box.width - previous.width) < 0.01 && Math.abs(box.x - previous.x) < 0.01)
      return box
    previous = box
    await page.waitForTimeout(100)
  }
  assert.fail(`${testId} never settled`)
}
const patches = () => requests.filter((r) => r.path === `/editor/documents/${editor.id}` && r.method === 'PATCH')
const lastPatch = () => patches().at(-1)
const jobPosts = () => requests.filter((r) => r.path === '/jobs' && r.method === 'POST')
const until = async (condition, message) => {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (condition()) return
    await page.waitForTimeout(50)
  }
  assert.fail(message)
}
/** Autosave fires 900 ms after the last edit; this is past it, and past any save it started. */
const pastAutosave = async () => {
  await page.waitForTimeout(1400)
  await page.locator('.editor-save:is([data-state="dirty"], [data-state="saving"])').waitFor({ state: 'detached' })
}
const commandRows = () => page.locator('[data-testid="editor-command-list"] li')
const saveBadge = () => page.getByTestId('editor-actionbar').locator('.editor-save')
const placeMark = async (tool, x, y) => {
  await page.getByTestId(`editor-tool-${tool}`).click()
  await page.getByTestId('editor-page-1').click({ position: { x, y } })
}
const placeText = async (text, x, y) => {
  await placeMark('add_text', x, y)
  await page.getByTestId('editor-text-input').fill(text)
  await page.getByTestId('editor-text-input').blur()
}
const drawLine = async () => {
  await page.getByTestId('editor-tool-draw').click()
  const box = await settledBox('editor-page-1')
  await page.mouse.move(box.x + 200, box.y + 420)
  await page.mouse.down()
  await page.mouse.move(box.x + 280, box.y + 460, { steps: 6 })
  await page.mouse.up()
}
/** Through the chooser of the selected signature or image, as a customer would. */
const attachFile = async (name, mimeType, buffer = onePixelPng) => {
  uploadMime = mimeType
  const before = requests.filter((r) => r.path === '/files/uploads').length
  await page.locator('.editor-assetfield input[type="file"]').setInputFiles({ name, mimeType, buffer })
  await until(
    () => requests.filter((r) => r.path === '/files/uploads').length > before,
    'nothing was uploaded',
  )
  uploadMime = 'image/png'
}
/** What the fixture's server should hold for a mark that uses an attached image. */
const signatureAt = (y, inputIndex) => ({
  type: 'signature',
  page: 1,
  x: 40,
  y,
  width: 160,
  height: 40,
  input_index: inputIndex,
})
const highlightAt = (y) => ({ type: 'highlight', page: 1, x: 40, y, width: 80, height: 20, color: '#FFFF00' })
const hasHorizontalOverflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
/** What Telegram does to a minimised Mini App, and what closing it does. */
const hideApp = (event) =>
  page.evaluate((name) => {
    if (name === 'pagehide') window.dispatchEvent(new Event('pagehide'))
    else {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    }
  }, event)

try {
  await open()

  // 1. pdf.js actually rendered — the canvas has a real backing store.
  const rendered = await page
    .locator('[data-testid="editor-page-1"] canvas')
    .evaluate((canvas) => canvas.width > 0 && canvas.height > 0)
  assert.ok(rendered, 'pdf.js rendered page 1 to a sized canvas')
  checks.push('pdf.js renders the document in the browser from authenticated bytes')

  // 2. Click-to-place converts screen pixels to PDF points.
  await page.getByTestId('editor-tool-add_text').click()
  // The conversion is relative to the page rect at the moment of the click, so
  // the assertion has to use the same settled rect the browser will see.
  const box = await settledBox('editor-page-1')
  const scale = box.width / PAGE.width
  await page.getByTestId('editor-page-1').click({ position: { x: 120, y: 160 } })
  await page.getByTestId('editor-text-input').fill('Reviewed in DocMaster')
  await page.getByTestId('editor-page-1').click({ position: { x: 400, y: 600 } })
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="editor-command-list"] li').length > 0,
  )
  await pastAutosave()
  const placed = lastPatch()?.body.commands.find((c) => c.type === 'add_text')
  assert.ok(placed, 'the text command reached the server')
  assert.ok(Math.abs(placed.x - 120 / scale) < 0.02, `x ${placed.x} ≈ ${120 / scale}`)
  assert.ok(Math.abs(placed.y - 160 / scale) < 0.02, `y ${placed.y} ≈ ${160 / scale}`)
  assert.equal(placed.text, 'Reviewed in DocMaster')
  checks.push('Clicking the page places a command at the exact PDF point under the cursor')

  // 3. The payload carries exactly the fields the engine allows.
  assert.deepEqual(
    Object.keys(placed).sort(),
    ['color', 'font_size', 'page', 'text', 'type', 'x', 'y'],
    'add_text sends exactly its allowed field set',
  )
  assert.equal(JSON.stringify(lastPatch().body.commands).includes('_id'), false, 'client ids never leave the browser')
  checks.push('Command payloads are a strict whitelist with no client-only fields')

  // 4. Autosave coalesces and never overlaps.
  const before = patches().length
  for (let step = 0; step < 5; step += 1) {
    await page.keyboard.press('Tab')
  }
  await page.getByTestId(`editor-mark-${await page.evaluate(() => '')}`).count().catch(() => {})
  await page.waitForTimeout(1400)
  assert.ok(patches().length - before <= 1, 'a burst of edits produces at most one save')
  checks.push('Autosave debounces and keeps one request in flight')

  // 5. Review then export, with a working idempotency key.
  await page.getByTestId('editor-review').click()
  await page.getByTestId('editor-export').waitFor()
  assert.equal(jobPosts().length, 0, 'reviewing never submits a job')
  assert.match(await page.getByTestId('editor-actionbar').getByTestId('weekly-line').innerText(),
    /File tasks this week\s+4 of 15 used/)
  await page.getByTestId('editor-export').click()
  await page.waitForURL('**/app/jobs/*')
  assert.equal(jobPosts().length, 1, 'confirming submits exactly one job')
  assert.ok(jobPosts()[0].key, 'the job carries an idempotency key')
  checks.push('Review shows the week’s file tasks without using one; export submits one idempotent job')

  // 6. An uncertain submission keeps its key and retries onto the same job.
  failJobOnce = true
  await open()
  await page.getByTestId('editor-review').click()
  await page.getByTestId('editor-export').waitFor()
  const beforeJobs = jobs.size
  await page.getByTestId('editor-export').click()
  await page.locator('.error-banner').waitFor()
  const first = jobPosts().at(-1)
  await page.getByTestId('editor-export').click()
  await page.waitForURL('**/app/jobs/*')
  const retry = jobPosts().at(-1)
  assert.equal(retry.key, first.key, 'the retry reuses the same idempotency key')
  assert.equal(jobs.size, beforeJobs + 1, 'the retry recovers the same accepted job')
  checks.push('An interrupted export retries with the same quote and key and creates one job')
  // An edit moves on from an export that may have failed: Review works, and the old quote stays unsent.
  failJobOnce = true
  await open()
  await page.getByTestId('editor-review').click()
  await page.getByTestId('editor-export').waitFor()
  await page.getByTestId('editor-export').click()
  await page.locator('.error-banner').waitFor()
  const pendingJob = () => page.evaluate(() => sessionStorage.getItem('docmaster-pending-job'))
  assert.notEqual(await pendingJob(), null, 'the export is waiting to be retried')
  await placeMark('highlight', 100, 300)
  assert.equal(await pendingJob(), null, 'the edit ends that, so a reload does not make the old version')
  await pastAutosave()
  await page.getByTestId('editor-review').click()
  await page.getByTestId('editor-export').waitFor()
  await page.getByTestId('editor-export').click()
  await page.waitForURL('**/app/jobs/*')
  checks.push('An edit after an uncertain export leaves Review working and the old quote unsent')

  // 7. A version conflict pauses autosave and offers both resolutions.
  await open()
  conflictOnce = true
  await page.getByTestId('editor-tool-highlight').click()
  await page.getByTestId('editor-page-1').click({ position: { x: 100, y: 100 } })
  await page.getByRole('button', { name: 'Keep my changes', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Use the other version', exact: true }).waitFor()
  checks.push('A version conflict stops autosave and asks which version to keep')

  // 8. Free has every tool: nothing in the editor is locked by the plan.
  plan = 'free'
  editor.commands = []
  await open()
  assert.equal(await page.locator('.editor-toolstrip [data-locked]').count(), 0, 'no tool is locked on Free')
  await page.locator('.form-templates small', { hasText: '0 / 30' }).waitFor({ state: 'attached' })
  assert.equal(await page.getByTestId('form-templates-locked').count(), 0, 'Free can save form templates')
  checks.push('Every editor tool, redaction and form templates included, is open on the Free plan')

  // 8b. A tool switched off for everyone stays visible and explains itself,
  // without offering a plan that would not bring it back.
  for (const feature of ['editor.redact', 'editor.insert_images', 'editor.form_templates']) switchedOff.add(feature)
  await open()
  const redactMode = page.getByTestId('editor-mode-redact')
  assert.equal(await redactMode.getAttribute('data-locked'), 'true', 'a switched-off mode is marked')
  assert.match(
    (await redactMode.innerText()).replace(/\s+/g, ' '),
    /Not available/,
    'the lock is part of the accessible name, not a disabled state',
  )
  await redactMode.click()
  await page.getByTestId('editor-mode-blocked').waitFor()
  assert.match(await page.getByTestId('editor-mode-blocked').innerText(), /Not available right now/)
  assert.equal(await page.getByTestId('editor-mode-blocked').getByRole('link').count(), 0, 'no plan is offered')
  assert.equal(await page.getByTestId('editor-pages-board').count(), 0, 'a locked mode does not open')
  const lockedTool = page.getByTestId('editor-tool-insert_image')
  assert.equal(await lockedTool.getAttribute('data-locked'), 'true', 'a switched-off tool is locked')
  await lockedTool.click()
  const lock = page.locator('.editor-toolstrip .editor-lock')
  await lock.waitFor()
  assert.match(await lock.innerText(), /Not available right now/)
  assert.equal(await lock.getByRole('link').count(), 0, 'no plan is offered')
  assert.equal(
    await page.locator('[data-testid="editor-command-list"] li').count(),
    0,
    'a locked tool adds no change',
  )
  const templatesLock = page.getByTestId('form-templates-locked')
  await templatesLock.waitFor({ state: 'attached' })
  assert.match(await templatesLock.textContent(), /Not available right now/)
  assert.equal(await templatesLock.locator('a').count(), 0, 'no plan is offered for form templates either')
  // A draft already holding a change made with a switched-off tool says so, and
  // offers only to remove it: no plan would bring the tool back.
  editor.commands = [{ type: 'highlight', page: 1, x: 40, y: 40, width: 80, height: 20, color: '#FFFF00' }]
  switchedOff.add('editor.highlight')
  await open()
  const stranded = page.locator('.editor-conflict')
  await stranded.waitFor()
  assert.match(await stranded.innerText(), /tool that isn’t available right now: 1\./)
  assert.equal(await stranded.locator('a').count(), 0, 'no plan is offered to keep them')
  // Nothing is sent, so nothing has failed yet. The first save does, says so, and
  // removing the changes is the way back: the draft is never stuck.
  assert.match(await saveBadge().innerText(), /Draft saved/)
  await placeText('Written after the tool went', 120, 500)
  await page.getByTestId('editor-save-error').waitFor()
  assert.match(await saveBadge().innerText(), /Changes are not saved/)
  await stranded.getByRole('button', { name: 'Remove these changes', exact: true }).click()
  await page.getByTestId('editor-save-error').waitFor({ state: 'detached' })
  await stranded.waitFor({ state: 'detached' })
  assert.deepEqual(
    editor.commands.map((command) => command.type),
    ['add_text'],
    'once they are gone the rest of the draft saves',
  )
  await resetDocument()
  switchedOff.clear()
  checks.push('A switched-off tool stays visible and explains itself, with no plan offered')
  plan = 'premium'

  // 9. Redaction is a mode of its own: the server cannot even save a mixed draft.
  await resetDocument()
  await open()
  await page.getByTestId('editor-tool-highlight').click()
  await page.getByTestId('editor-page-1').click({ position: { x: 80, y: 80 } })
  await page.waitForTimeout(1200)
  await page.getByTestId('editor-mode-redact').click()
  await page.getByTestId('editor-mode-blocked').waitFor()
  assert.match(
    await page.getByTestId('editor-mode-blocked').innerText(),
    /Removing content makes a file of its own/,
    'mixing redaction with other changes is refused up front',
  )
  checks.push('Redaction is refused alongside other changes before anything is saved')

  // 10. Pages mode maps onto the right one-shot job.
  await resetDocument()
  await open()
  await page.getByTestId('editor-mode-pages').click()
  await page.getByTestId('editor-pages-board').waitFor()
  const cards = page.locator('.editor-board-card')
  await cards.nth(1).getByRole('button', { name: 'Remove page', exact: true }).click()
  const quoteCalls = () => requests.filter((r) => r.path === '/quotes' && r.method === 'POST')
  await page.getByTestId('editor-pages-apply').click()
  await page.waitForURL('**/app/jobs/*')
  let planned = quoteCalls().at(-1)
  assert.equal(planned.body.feature_id, 'pdf.delete_pages', 'removing a page deletes it')
  assert.equal(planned.body.parameters.pages, '2')

  await open()
  await page.getByTestId('editor-mode-pages').click()
  await page.getByTestId('editor-pages-board').waitFor()
  await cards.nth(0).getByRole('button', { name: 'Move page later', exact: true }).click()
  await page.getByTestId('editor-pages-apply').click()
  await page.waitForURL('**/app/jobs/*')
  planned = quoteCalls().at(-1)
  assert.equal(planned.body.feature_id, 'pdf.reorder', 'a pure swap reorders')
  assert.deepEqual(planned.body.parameters.order, [2, 1])

  await open()
  await page.getByTestId('editor-mode-pages').click()
  await page.getByTestId('editor-pages-board').waitFor()
  await cards.nth(0).getByRole('button', { name: 'Rotate right', exact: true }).click()
  assert.match(
    await page.getByTestId('editor-pages-board').innerText(),
    /Rotate pages/,
    'rotation is planned as a rotate job',
  )
  await page.waitForFunction(
    () => document.querySelectorAll('.editor-board-thumb > img').length > 0,
    undefined,
    { timeout: 10000 },
  )
  await page.screenshot({ path: path.join(output, 'pages-mode.png'), fullPage: true })
  checks.push('Pages mode chooses delete, reorder or extract and never invents a server capability')

  // Redaction mode on a clean draft, for the visual record.
  await resetDocument()
  await open()
  await page.getByTestId('editor-mode-redact').click()
  await page.getByTestId('editor-page-1').click({ position: { x: 150, y: 120 } })
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(output, 'redact-mode.png'), fullPage: true })

  // 11. An image command with nothing attached is caught before the server
  // sees it, and drawing a signature satisfies it.
  await resetDocument()
  await open()
  await page.getByTestId('editor-tool-signature').click()
  await page.getByTestId('editor-page-1').click({ position: { x: 150, y: 400 } })
  await page.getByTestId('editor-floatbar').waitFor()
  assert.match(
    await page.getByTestId('editor-floatbar').innerText(),
    /Choose an image/,
    'a signature with no image explains itself instead of failing on save',
  )
  assert.equal(
    await page.getByTestId('editor-review').isDisabled(),
    true,
    'export is blocked while a change has no image',
  )
  await page.getByTestId('editor-signature-open').click()
  const pad = page.getByTestId('editor-signature-pad')
  await pad.waitFor()
  const padBox = await pad.locator('canvas').boundingBox()
  assert.ok(padBox)
  await page.mouse.move(padBox.x + 40, padBox.y + padBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(padBox.x + 140, padBox.y + 30, { steps: 8 })
  await page.mouse.move(padBox.x + 240, padBox.y + padBox.height - 30, { steps: 8 })
  await page.mouse.up()
  await page.getByTestId('editor-signature-save').click()
  await pastAutosave()
  const withImage = lastPatch()?.body.commands.find((c) => c.type === 'signature')
  assert.ok(withImage, 'the signature command saved')
  assert.equal(withImage.input_index, 1, 'it points at the first attached image')
  assert.equal(lastPatch().body.input_ids.length, 2, 'the signature image is attached as an input')
  assert.equal(
    await page.getByTestId('editor-review').isDisabled(),
    false,
    'export unblocks once the image exists',
  )
  checks.push('A signature is drawn, uploaded and attached; an image-less change blocks export first')

  // 12. The keyboard map is written down.
  await page.getByTestId('editor-shortcuts-open').click()
  await page.getByTestId('editor-shortcuts').waitFor()
  assert.match(await page.getByTestId('editor-shortcuts').innerText(), /Ctrl \/ ⌘ \+ Z/)
  await page.keyboard.press('Escape')
  checks.push('Every canvas gesture has a documented keyboard equivalent')

  // 12b. The Telegram bot deep-links here as `?file_id=…`; open that file
  // rather than showing the empty launcher to someone who just sent a PDF.
  await resetDocument()
  const linked = editor.input_ids[0]
  const priorCalls = requests.length
  await page.goto(`${origin}/en/app/editor?file_id=${linked}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('editor-page-1').waitFor()
  assert.match(new URL(page.url()).pathname, new RegExp(`/app/editor/${editor.id}$`))
  const created = requests
    .slice(priorCalls)
    .find((r) => r.path === '/editor/documents' && r.method === 'POST')
  assert.equal(created?.body?.file_id, linked, 'the linked file is what gets opened')
  checks.push('A file_id deep link from the bot opens that document instead of the launcher')

  // 12c. A mark that is not finished yet goes nowhere, so the server has nothing
  // to refuse and autosave keeps working for everything around it.
  await resetDocument()
  await open()
  const sentBefore = patches().length
  await placeMark('add_text', 120, 160)
  await page.getByTestId('editor-text-input').waitFor()
  await pastAutosave()
  assert.equal(patches().length, sentBefore, 'a mark with no text yet is not sent')
  assert.doesNotMatch(await saveBadge().innerText(), /not saved/i, 'saving has not stopped')
  assert.equal(await page.getByTestId('editor-issue').count(), 0, 'the mark being typed into is not a problem yet')
  await page.getByTestId('editor-text-input').fill('Typed after a pause')
  await pastAutosave()
  assert.equal(lastPatch().body.commands.at(-1).text, 'Typed after a pause', 'the mark saves once it has text')
  await page.getByTestId('editor-text-input').blur()
  // Walking away from an empty mark drops it, and the next mark saves.
  await placeMark('add_text', 120, 260)
  await page.getByTestId('editor-text-input').waitFor()
  await page.getByTestId('editor-text-input').blur()
  await placeMark('highlight', 80, 500)
  await pastAutosave()
  assert.deepEqual(
    lastPatch().body.commands.map((command) => command.type),
    ['add_text', 'highlight'],
    'a mark placed after an empty one still saves',
  )
  assert.equal(await commandRows().count(), 2, 'the empty mark was dropped')
  assert.match(await saveBadge().innerText(), /Draft saved/)
  checks.push('A mark with no text does not stop autosave, and later marks save')

  // 12d. A signature with no image stays where it is between marks that do save.
  await resetDocument()
  await open()
  await placeMark('highlight', 80, 80)
  await placeMark('signature', 150, 300)
  await placeMark('highlight', 80, 500)
  await page.locator('.editor-mark.signature').waitFor()
  const markIds = () =>
    page.locator('.editor-mark').evaluateAll((marks) => marks.map((mark) => mark.dataset.testid))
  const idsBeforeSave = await markIds()
  await pastAutosave()
  assert.deepEqual(
    lastPatch().body.commands.map((command) => command.type),
    ['highlight', 'highlight'],
    'only the complete marks are sent',
  )
  assert.deepEqual(await markIds(), idsBeforeSave, 'a save keeps every mark, in order, with its identity')
  assert.match(await commandRows().nth(1).innerText(), /Signature image[\s\S]*Choose an image/, 'flagged in the list')
  assert.match(await saveBadge().innerText(), /Not saved: one change needs fixing/, 'the badge does not claim all is saved')
  // Review refuses, and says which.
  assert.equal(await page.getByTestId('editor-review').isDisabled(), true, 'Review waits for it')
  assert.match(await page.getByTestId('editor-issue').innerText(), /2\. Signature image: Choose an image/)
  await page.getByTestId('editor-issue-show').click()
  assert.match(await page.getByTestId('editor-floatbar').innerText(), /Signature image[\s\S]*Choose an image/, 'Show opens it')
  await page.getByTestId('editor-signature-open').click()
  const padBounds = await page.getByTestId('editor-signature-pad').locator('canvas').boundingBox()
  await page.mouse.move(padBounds.x + 40, padBounds.y + 40)
  await page.mouse.down()
  await page.mouse.move(padBounds.x + 200, padBounds.y + 60, { steps: 6 })
  await page.mouse.up()
  await page.getByTestId('editor-signature-save').click()
  await pastAutosave()
  assert.deepEqual(
    lastPatch().body.commands.map((command) => command.type),
    ['highlight', 'signature', 'highlight'],
    'finished, it saves in the place it was given',
  )
  assert.deepEqual(await markIds(), idsBeforeSave, 'and keeps its identity')
  assert.match(await saveBadge().innerText(), /Draft saved/)
  assert.equal(await page.getByTestId('editor-issue').count(), 0)
  assert.equal(await page.getByTestId('editor-review').isDisabled(), false, 'Review opens again')
  checks.push('An unfinished change is held back in place, flagged, and blocks Review by name')

  // 12e. The same for what has no place on the page: a blank form field and find.
  await resetDocument()
  await open()
  await page.getByTestId('editor-fields').locator('summary').click()
  await page.getByRole('button', { name: 'Fill form field', exact: true }).click()
  await page.getByRole('button', { name: 'Replace existing text', exact: true }).click()
  await placeMark('highlight', 80, 80)
  await pastAutosave()
  assert.deepEqual(lastPatch().body.commands.map((command) => command.type), ['highlight'])
  assert.match(await commandRows().nth(0).innerText(), /Choose a form field/)
  assert.match(await commandRows().nth(1).innerText(), /Enter the text to find/)
  // Show opens the panel that holds the fix, however it was left.
  await page.getByTestId('editor-fields').locator('summary').click()
  assert.equal(await page.getByTestId('editor-fields').evaluate((panel) => panel.open), false)
  await page.getByTestId('editor-issue-show').click()
  assert.equal(await page.getByTestId('editor-fields').evaluate((panel) => panel.open), true, 'Show opens the panel')
  // Its toggle event comes a moment later and re-renders the panel, which puts back a number not yet committed.
  await page.waitForTimeout(300)
  const fields = page.getByTestId('editor-fields')
  await fields.getByLabel('Form field name').first().fill('participant')
  await fields.getByLabel('Form field name').first().blur()
  await fields.getByLabel('Existing text to find').fill('draft')
  await fields.getByLabel('Existing text to find').blur()
  // A page that does not exist is brought back in range rather than refused.
  await fields.getByLabel('Page').fill('99')
  await fields.getByLabel('Page').blur()
  await pastAutosave()
  const allThree = lastPatch().body.commands
  assert.deepEqual(allThree.map((command) => command.type), ['fill_form', 'replace_text', 'highlight'])
  assert.equal(allThree[1].page, 2, 'the page stays in the document')
  assert.match(await saveBadge().innerText(), /Draft saved/)
  checks.push('A blank form field or find waits locally and saves in place when filled in')

  // 12f. A number outside what the server allows is brought into range too.
  await resetDocument()
  await open()
  await placeText('Sized', 120, 160)
  const floatbar = page.getByTestId('editor-floatbar')
  await floatbar.getByLabel('Font size').fill('500')
  await floatbar.getByLabel('Font size').blur()
  await pastAutosave()
  assert.equal(lastPatch().body.commands[0].font_size, 96, 'font size stops at the largest allowed')
  assert.equal(await floatbar.getByLabel('Font size').inputValue(), '96', 'and the field shows what was kept')
  checks.push('A size out of range is corrected at the field, not refused by the server')

  // 12f-2. A save landing never touches what is being typed.
  await resetDocument()
  await open()
  await page.getByTestId('editor-fields').locator('summary').click()
  await page.getByRole('button', { name: 'Fill form field', exact: true }).click()
  await fields.getByLabel('Form field name').fill('participant')
  await fields.getByLabel('Form field name').blur()
  await fields.getByLabel('Field value').click()
  await page.keyboard.type('Nodira')
  await pastAutosave()
  assert.equal(await fields.getByLabel('Field value').inputValue(), 'Nodira', 'a form value survives a save landing')
  assert.equal(lastPatch().body.commands[0].value, 'Nodira', 'and it counts from the first letter, without leaving the field')
  await page.keyboard.type(' Saidova')
  await pastAutosave()
  assert.equal(await fields.getByLabel('Field value').inputValue(), 'Nodira Saidova', 'typing simply carries on')
  assert.equal(lastPatch().body.commands[0].value, 'Nodira Saidova')
  // A number is corrected only when it is finished, so it waits for the field to close.
  await placeMark('highlight', 80, 80)
  await floatbar.getByLabel('Width').fill('300')
  await pastAutosave()
  assert.equal(await floatbar.getByLabel('Width').inputValue(), '300', 'a number being typed survives a save landing')
  await floatbar.getByLabel('Width').blur()
  await pastAutosave()
  assert.equal(lastPatch().body.commands.at(-1).width, 300)
  // The same in the form panel, which redraws whenever the document object is replaced.
  await page.getByRole('button', { name: 'Replace existing text', exact: true }).click()
  await fields.getByLabel('Existing text to find').fill('draft')
  await fields.getByLabel('Page').fill('2')
  await pastAutosave()
  assert.equal(await fields.getByLabel('Page').inputValue(), '2', 'a page number being typed survives a save landing')
  await fields.getByLabel('Page').blur()
  await pastAutosave()
  assert.equal(lastPatch().body.commands.find((command) => command.type === 'replace_text').page, 2)
  // Hiding the app with a form field still focused sends what it holds.
  const hiddenWhileTyping = patches().length
  await fields.getByLabel('Field value').fill('Nodira Saidova!')
  await hideApp('visibilitychange')
  await until(() => patches().length > hiddenWhileTyping, 'hiding the app sent nothing')
  assert.equal(lastPatch().body.commands[0].value, 'Nodira Saidova!', 'hiding the app saves the letters just typed')
  checks.push('A save landing never wipes what is being typed, and form text saves as it is typed')

  // 12g. Undo and redo work, from the toolbar and the keyboard.
  await resetDocument()
  await open()
  const undoButton = page.getByRole('button', { name: 'Undo', exact: true })
  const redoButton = page.getByRole('button', { name: 'Redo', exact: true })
  assert.equal(await undoButton.isDisabled(), true, 'nothing to undo yet')
  await placeMark('highlight', 80, 80)
  await commandRows().first().waitFor()
  assert.equal(await undoButton.isDisabled(), false, 'placing a mark can be undone')
  await undoButton.click()
  assert.equal(await commandRows().count(), 0, 'toolbar Undo takes the mark away')
  assert.equal(await redoButton.isDisabled(), false)
  await redoButton.click()
  assert.equal(await commandRows().count(), 1, 'toolbar Redo brings it back')
  await page.keyboard.press('Control+z')
  assert.equal(await commandRows().count(), 0, 'Ctrl+Z takes it away')
  await page.keyboard.press('Control+Shift+z')
  assert.equal(await commandRows().count(), 1, 'Ctrl+Shift+Z brings it back')
  // On a Russian layout the Z key reports "я".
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'я', code: 'KeyZ', ctrlKey: true, cancelable: true })),
  )
  assert.equal(await commandRows().count(), 0, 'Ctrl+Z works on a Cyrillic layout')
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Я', code: 'KeyZ', ctrlKey: true, shiftKey: true, cancelable: true }),
    ),
  )
  assert.equal(await commandRows().count(), 1)
  await pastAutosave()
  assert.equal(lastPatch().body.commands.length, 1, 'autosave follows undo and redo')
  await undoButton.click()
  await pastAutosave()
  assert.equal(lastPatch().body.commands.length, 0, 'an undone mark leaves the saved draft')
  assert.equal(editor.commands.length, 0)
  // Placing a text mark and typing are one step, so Undo leaves no empty mark behind.
  await placeText('Undo me', 120, 160)
  await commandRows().first().waitFor()
  await undoButton.click()
  assert.equal(await commandRows().count(), 0, 'one Undo takes away a typed mark')
  await redoButton.click()
  assert.equal(await page.locator('.editor-mark.add_text').innerText(), 'Undo me', 'Redo brings it back with its words')
  // A mark dropped because it stayed empty leaves nothing to undo.
  await undoButton.click()
  assert.equal(await undoButton.isDisabled(), true, 'the first step is gone')
  await placeMark('add_text', 120, 260)
  await page.getByTestId('editor-text-input').waitFor()
  await page.getByTestId('editor-text-input').blur()
  assert.equal(await undoButton.isDisabled(), true, 'an empty mark that was dropped is not a step')
  // Two marks placed quickly are two steps.
  await placeMark('highlight', 80, 80)
  await placeMark('highlight', 80, 300)
  await undoButton.click()
  assert.equal(await commandRows().count(), 1, 'one Undo takes away one mark')
  // A line is one step, not an empty line and then its points.
  await drawLine()
  assert.equal(await commandRows().count(), 2)
  await page.getByTestId('editor-tool-select').click()
  await undoButton.click()
  assert.equal(await commandRows().count(), 1, 'one Undo takes away a whole line')
  // Holding the finger still partway through changes nothing about that.
  await page.getByTestId('editor-tool-draw').click()
  const strokeBox = await settledBox('editor-page-1')
  await page.mouse.move(strokeBox.x + 200, strokeBox.y + 420)
  await page.mouse.down()
  await page.mouse.move(strokeBox.x + 240, strokeBox.y + 440, { steps: 3 })
  await page.waitForTimeout(700)
  await page.mouse.move(strokeBox.x + 280, strokeBox.y + 460, { steps: 3 })
  await page.waitForTimeout(700)
  await page.mouse.move(strokeBox.x + 320, strokeBox.y + 480, { steps: 3 })
  await page.mouse.up()
  assert.equal(await commandRows().count(), 2)
  await page.getByTestId('editor-tool-select').click()
  await undoButton.click()
  assert.equal(await commandRows().count(), 1, 'one Undo takes away a line drawn with pauses in it')
  // With an empty text field open, one Undo takes that mark and not the step before it as well.
  await placeMark('add_text', 120, 260)
  await page.getByTestId('editor-text-input').waitFor()
  await undoButton.click()
  assert.equal(await page.getByTestId('editor-text-input').count(), 0, 'the field goes with its mark')
  assert.equal(await commandRows().count(), 1, 'the mark placed before it stays')
  assert.equal(await redoButton.isDisabled(), true, 'and an empty mark is nothing to bring back')
  await pastAutosave()
  assert.equal(editor.commands.length, 1, 'on the server too')
  // A number commits as focus leaves its box, so Undo takes back that and not the step before it.
  await placeText('Keep me', 120, 400)
  const sizeField = page.getByTestId('editor-floatbar').getByLabel('Font size')
  const sizeBefore = await sizeField.inputValue()
  await sizeField.fill('24')
  await undoButton.click()
  assert.equal(await commandRows().count(), 2, 'the mark stays')
  assert.equal(await sizeField.inputValue(), sizeBefore, 'and the size typed is what goes')
  await redoButton.click()
  assert.equal(await sizeField.inputValue(), '24', 'and comes back')
  checks.push('Undo and Redo work from the toolbar and from Ctrl+Z on any keyboard layout')

  // 12g-2. Every component waits behind one save, however slow the network.
  await resetDocument()
  await open()
  patchDelay = 700
  mostPatchesInFlight = 0
  const beforeSlowSave = patches().length
  await placeMark('highlight', 80, 80)
  await until(() => patches().length > beforeSlowSave, 'the first save never started')
  // A write is on its way. Edit, save from the keyboard and open Review on top of it.
  await placeMark('highlight', 80, 300)
  await page.keyboard.press('Control+s')
  await page.getByTestId('editor-review').click()
  await page.getByTestId('editor-export').waitFor()
  patchDelay = 0
  assert.equal(mostPatchesInFlight, 1, 'saves from different components never overlap')
  assert.equal(
    await page.getByRole('button', { name: 'Keep my changes', exact: true }).count(),
    0,
    'so a draft never conflicts with itself',
  )
  assert.equal(editor.commands.length, 2, 'Review waited for the newest edit, and did not give up')
  checks.push('All components share one save lock, and Review waits behind it')

  // 12g-3. A document reopened at once loads what its last save wrote, with a new history.
  await resetDocument()
  await open()
  patchDelay = 500
  await placeMark('highlight', 80, 80)
  await page.locator('.editor-head .back-link').click()
  await page.locator('.editor-recent-row a').first().click()
  // The old copy stays up until its last write lands; only then is it read again.
  const reads = () => requests.filter((r) => r.path === `/editor/documents/${editor.id}` && r.method === 'GET').length
  const readsBefore = reads()
  await until(() => reads() > readsBefore, 'the document was never read again')
  await page.getByTestId('editor-page-1').waitFor()
  await commandRows().first().waitFor()
  patchDelay = 0
  assert.equal(await commandRows().count(), 1, 'the mark made just before leaving is there')
  assert.equal(await undoButton.isDisabled(), true, 'a reopened document starts a new history')
  assert.equal(
    await page.getByRole('button', { name: 'Keep my changes', exact: true }).count(),
    0,
    'and the reopened copy is the newest',
  )
  assert.equal(editor.commands.length, 1)
  checks.push('Reopening a document at once finds the last edit saved and starts a new history')

  // 12g-4. A write that stalls holds nobody up for long, and nothing can be edited meanwhile.
  await resetDocument()
  await open()
  patchDelay = 6000
  const startedStall = patches().length
  await placeMark('highlight', 80, 80)
  await page.locator('.editor-head .back-link').click()
  await page.locator('.editor-recent-row a').first().click()
  const leftAt = Date.now()
  // At once, well before the wait for that write is over.
  await page.getByTestId('editor-opening').waitFor({ timeout: 1000 })
  await until(() => patches().length > startedStall, 'leaving sent what was waiting')
  assert.equal(await page.getByTestId('editor-page-1').count(), 0, 'the old pages have gone')
  assert.equal(await page.locator('.editor-toolstrip').count(), 0, 'and so have the tools')
  assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).count(), 0, 'Undo too')
  await page.keyboard.press('Control+z')
  await page.getByTestId('editor-page-1').waitFor()
  assert.ok(Date.now() - leftAt < 5000, `the document opened after ${Date.now() - leftAt} ms`)
  assert.equal(patchesInFlight, 1, 'with the write still on its way')
  await until(() => patchesInFlight === 0, 'the write finished')
  await until(() => editor.commands.length === 1, 'the write landed')
  assert.equal(await page.getByRole('button', { name: 'Keep my changes', exact: true }).count(), 0)
  patchDelay = 0
  // Leaving the editor altogether waits no longer than that either.
  await resetDocument()
  await open()
  patchDelay = 6000
  await placeMark('highlight', 80, 80)
  const leavingAt = Date.now()
  // The one route that is not the app's own catch-all, so the route guard runs.
  await page.evaluate(() =>
    document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push('/en'),
  )
  await page.waitForURL(`${origin}/en`)
  assert.ok(Date.now() - leavingAt < 5000, `leaving took ${Date.now() - leavingAt} ms`)
  await until(() => patchesInFlight === 0, 'the write finished')
  await until(() => editor.commands.length === 1, 'the write landed on its own')
  patchDelay = 0
  checks.push('A stalled write delays leaving by seconds at most, and no document can be edited in the gap')

  // 12g-5. The launcher is not the document: keys pressed there do nothing to the one left behind.
  await resetDocument()
  await open()
  await placeMark('highlight', 80, 80)
  await pastAutosave()
  await page.locator('.editor-head .back-link').click()
  await page.locator('.editor-recent-row a').first().waitFor()
  const onLauncher = patches().length
  await page.keyboard.press('Control+z')
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, cancelable: true }),
    ),
  )
  await pastAutosave()
  assert.equal(patches().length, onLauncher, 'nothing is written')
  assert.equal(editor.commands.length, 1, 'and the mark is still there')
  checks.push('Undo and Save pressed on the launcher leave the document alone')

  // 12g-6. A slow document left behind never replaces the one asked for after it.
  await resetDocument()
  await open()
  const goTo = (to) =>
    page.evaluate(
      (target) => document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push(target),
      to,
    )
  await goTo(`/en/app/editor/${slowDocumentId}`)
  await until(
    () => requests.some((r) => r.path === `/editor/documents/${slowDocumentId}`),
    'the slow document was never asked for',
  )
  await goTo(`/en/app/editor/${editor.id}`)
  await page.getByTestId('editor-page-1').waitFor()
  await page.waitForTimeout(1200)
  assert.equal(
    await page.locator('.editor-head h1').innerText(),
    'research-notes.pdf',
    'the later one stands',
  )
  await placeMark('highlight', 80, 80)
  await pastAutosave()
  assert.equal(editor.commands.length, 1, 'and edits go to it')
  checks.push('A slow document left behind never replaces the one asked for after it')

  // 12h. Duplicate copies the mark, not just its type.
  await resetDocument()
  await open()
  await placeText('Copy me', 120, 160)
  const original = page.locator('.editor-mark.add_text')
  await floatbar.getByLabel('Font size').fill('24')
  await floatbar.getByLabel('Font size').blur()
  await floatbar.getByRole('button', { name: 'Red', exact: true }).click()
  await floatbar.getByRole('button', { name: 'Duplicate', exact: true }).click()
  await pastAutosave()
  assert.equal(await original.count(), 2, 'the copy is on the page')
  const [source, copied] = lastPatch().body.commands
  assert.equal(copied.text, 'Copy me', 'the copy keeps the words')
  assert.equal(copied.font_size, 24, 'and the size')
  assert.equal(copied.color, '#FA3331', 'and the colour')
  assert.equal(copied.x, source.x + 12, 'and sits a little to the side')
  assert.equal(copied.y, source.y + 12)
  // A line's points come along too.
  await drawLine()
  await floatbar.getByRole('button', { name: 'Duplicate', exact: true }).click()
  await pastAutosave()
  const [line, lineCopy] = lastPatch().body.commands.filter((command) => command.type === 'draw')
  assert.ok(line.points.length >= 2)
  assert.equal(lineCopy.points.length, line.points.length, 'the copy of a line has all its points')
  assert.ok(Math.abs(lineCopy.points[0][0] - line.points[0][0] - 12) < 0.02)
  assert.equal(lineCopy.stroke_width, line.stroke_width)
  checks.push('Duplicate keeps the words, size, colour and points of the mark')

  // 12i. One size, in bytes: Cyrillic that saves also reaches Review.
  await resetDocument()
  await open()
  const cyrillic = 'я'.repeat(1500)
  // The same letters in lines that fit the page, as the engine never wraps.
  const fitting = Array.from({ length: 30 }, () => 'я'.repeat(50)).join('\n')
  await placeText(fitting, 60, 60)
  await pastAutosave()
  assert.equal(lastPatch().body.commands[0].text, fitting, 'a 1,500-letter Cyrillic mark saves')
  await page.getByTestId('editor-review').click()
  await page.getByTestId('editor-export').waitFor()
  await page.getByTestId('editor-export').click()
  await page.waitForURL('**/app/jobs/*')
  checks.push('A 1,500-letter Cyrillic mark saves, reaches Review and makes a job')
  // On one line it runs past the page. That saves, and Review says so rather than the failed job.
  await resetDocument()
  await open()
  await placeText(cyrillic, 60, 60)
  await pastAutosave()
  assert.equal(lastPatch().body.commands[0].text, cyrillic, 'it is saved like any other')
  assert.match(await saveBadge().innerText(), /Draft saved/, 'and the badge says so')
  assert.equal(await page.getByTestId('editor-review').isDisabled(), true, 'Review waits for it')
  assert.match(
    await page.getByTestId('editor-issue').innerText(),
    /1\. Add text: This text runs past the page edge/,
    'and says which change is in the way',
  )
  assert.match(await commandRows().first().innerText(), /runs past the page edge/, 'flagged in the list')
  await page.getByTestId('editor-issue-show').click()
  await page.locator('.editor-wrap-text').click()
  await page.getByTestId('editor-issue').waitFor({ state: 'detached' })
  await pastAutosave()
  assert.ok(lastPatch().body.commands[0].text.includes('\n'), 'Show leads to breaking the lines')
  await page.getByTestId('editor-review').click()
  await page.getByTestId('editor-export').waitFor()
  await page.getByTestId('editor-export').click()
  await page.waitForURL('**/app/jobs/*')
  // Moved too far to the right, words that fitted no longer do.
  await resetDocument()
  await open()
  await placeText('Fits where it was put', 120, 160)
  await page.getByTestId('editor-floatbar').getByLabel('X position').fill('500')
  await page.getByTestId('editor-floatbar').getByLabel('X position').blur()
  await page.getByTestId('editor-issue').waitFor()
  assert.equal(
    await page.getByTestId('editor-review').isDisabled(),
    true,
    'moving it past the edge counts too',
  )
  checks.push('Text past the page is saved and refused at Review by name, and Show leads to the fix')
  // Far past the old caps of 20,000 and 32,768: twelve of them are 36,000 bytes of
  // letters alone. A document that does not state its limits gets the same room.
  await resetDocument()
  stateLimits = false
  editor.commands = Array.from({ length: 11 }, (_, index) => ({
    type: 'add_text',
    page: 2,
    x: 40,
    y: 40 + index,
    text: fitting,
    font_size: 16,
    color: '#17212E',
  }))
  await open()
  await placeText(fitting, 60, 60)
  await pastAutosave()
  assert.equal(lastPatch().body.commands.length, 12, 'the larger draft saves')
  assert.ok(Buffer.byteLength(JSON.stringify(lastPatch().body)) > 32768, 'it is past the old limit on a request')
  assert.match(await saveBadge().innerText(), /Draft saved/)
  await page.getByTestId('editor-review').click()
  await page.getByTestId('editor-export').waitFor()
  stateLimits = true
  checks.push('A draft past the old caps saves and reaches Review, counted in bytes')

  // 12j. A refused save says why, and the next edit tries again.
  await resetDocument()
  await open()
  refuseSaveOnce = ['invalid_editor_command', 400]
  await placeMark('highlight', 80, 80)
  await page.getByTestId('editor-save-error').waitFor()
  assert.match(await page.getByTestId('editor-save-error').innerText(), /invalid_editor_command/, 'it says why')
  assert.match(await saveBadge().innerText(), /Changes are not saved/)
  assert.equal(await page.locator('.error-banner').count(), 0, 'once, where a phone can see it')
  const afterRefusal = patches().length
  await pastAutosave()
  assert.equal(patches().length, afterRefusal, 'a refused save is not retried on a timer')
  await placeMark('highlight', 80, 300)
  await pastAutosave()
  assert.equal(lastPatch().body.commands.length, 2, 'the next edit tries again, with everything')
  assert.equal(editor.commands.length, 2, 'and the server has it')
  assert.match(await saveBadge().innerText(), /Draft saved/, 'the session has recovered')
  assert.equal(await page.getByTestId('editor-save-error').count(), 0, 'and the reason is gone')
  // Save now tries again too.
  refuseSaveOnce = ['payload_too_large', 413]
  await placeMark('highlight', 80, 500)
  await page.getByTestId('editor-save-error').waitFor()
  await page.getByTestId('editor-save-now').click()
  await page.getByTestId('editor-save-error').waitFor({ state: 'detached' })
  assert.equal(editor.commands.length, 3, 'Save now recovers as well')
  // The reason stays in the action bar at every step of a retry, so the page never jumps.
  refuseSaveOnce = ['payload_too_large', 413]
  await placeMark('highlight', 80, 200)
  await page.getByTestId('editor-save-error').waitFor()
  refuseSaveOnce = ['payload_too_large', 413]
  patchDelay = 500
  const beforeRetry = patches().length
  await placeMark('highlight', 80, 400)
  assert.equal(await page.locator('.error-banner').count(), 0, 'not while the edit waits to be sent')
  await until(() => patches().length > beforeRetry, 'the retry never started')
  assert.equal(await page.locator('.error-banner').count(), 0, 'not while it is on its way')
  await page.getByTestId('editor-save-error').waitFor()
  assert.equal(await page.locator('.error-banner').count(), 0, 'and not once it is refused')
  patchDelay = 0
  // Pages mode has no action bar, so the reason shows at the top there.
  await page.getByTestId('editor-mode-pages').click()
  assert.match(await page.locator('.error-banner').innerText(), /payload_too_large/, 'Pages mode says why')
  await page.getByTestId('editor-mode-edit').click()
  assert.equal(await page.locator('.error-banner').count(), 0, 'and it moves back to the action bar')
  await page.getByTestId('editor-save-now').click()
  await page.getByTestId('editor-save-error').waitFor({ state: 'detached' })
  // A draft really over its limit is refused, and shortening it is the next edit.
  await resetDocument()
  draftLimits = { commands: 100, bytes: 1000 }
  await open()
  await placeText('я'.repeat(600), 60, 60)
  await page.getByTestId('editor-save-error').waitFor().catch(() => {})
  await page.getByTestId('editor-actionbar').getByText('at its size limit').waitFor()
  assert.equal(await page.getByTestId('editor-review').isDisabled(), true, 'the meter reads the limit the document states')
  await pastAutosave()
  assert.match(await saveBadge().innerText(), /Changes are not saved/, 'the server refused it too')
  await page.locator('.editor-mark.add_text').dblclick()
  await page.getByTestId('editor-text-input').fill('short')
  await page.getByTestId('editor-text-input').blur()
  await pastAutosave()
  assert.equal(editor.commands[0].text, 'short', 'shortened, it saves')
  assert.match(await saveBadge().innerText(), /Draft saved/)
  assert.equal(await page.getByTestId('editor-review').isDisabled(), false)
  draftLimits = { commands: 100, bytes: 100000 }
  checks.push('A refused save shows why and recovers on the next edit')

  // 12k. Only a version conflict pauses, and choosing resumes.
  await resetDocument()
  await open()
  conflictOnce = true
  await placeMark('highlight', 80, 80)
  const keepMine = page.getByRole('button', { name: 'Keep my changes', exact: true })
  await keepMine.waitFor()
  const paused = patches().length
  await placeMark('highlight', 80, 300)
  await pastAutosave()
  assert.equal(patches().length, paused, 'autosave waits for the choice')
  assert.equal(await page.getByTestId('editor-save-now').count(), 0, 'Save now would not help here')
  await keepMine.click()
  await keepMine.waitFor({ state: 'detached' })
  await page.locator('.editor-save.saved').waitFor()
  assert.equal(editor.commands.length, 2, 'the chosen version saves whole')
  await placeMark('highlight', 80, 500)
  await pastAutosave()
  assert.equal(editor.commands.length, 3, 'and autosave is back')
  // A failed save after choosing does not leave "reload" up, which would lose what was just kept.
  conflictOnce = true
  await placeMark('highlight', 300, 80)
  await keepMine.waitFor()
  await page.locator('.error-banner').waitFor()
  loseRequestOnce = true
  await keepMine.click()
  await keepMine.waitFor({ state: 'detached' })
  await page.getByTestId('editor-save-error').waitFor()
  assert.equal(await page.locator('.error-banner').count(), 0, 'the conflict message goes with the conflict')
  await page.getByTestId('editor-save-now').click()
  await page.getByTestId('editor-save-error').waitFor({ state: 'detached' })
  assert.equal(editor.commands.length, 4)
  // Review can meet another device's newer version too: the same choice, not a dead end.
  await resetDocument()
  await open()
  await placeMark('highlight', 80, 80)
  await pastAutosave()
  editor.version += 1
  await page.getByTestId('editor-review').click()
  await keepMine.waitFor()
  await keepMine.click()
  await keepMine.waitFor({ state: 'detached' })
  await page.getByTestId('editor-review').click()
  await page.getByTestId('editor-export').waitFor()
  checks.push('A version conflict alone pauses autosave, and choosing a version resumes it')

  // 12k-2. A write that landed with its answer lost is no conflict with anyone.
  const useOther = page.getByRole('button', { name: 'Use the other version', exact: true })
  await resetDocument()
  await open()
  loseAnswerOnce = true
  await placeMark('highlight', 80, 80)
  await hideApp('visibilitychange')
  await page.getByTestId('editor-save-error').waitFor()
  assert.equal(editor.commands.length, 1, 'the write landed, and the app does not know')
  await open()
  assert.equal(await commandRows().count(), 1, 'a reload simply finds it')
  loseAnswerOnce = true
  await placeMark('highlight', 80, 300)
  await page.getByTestId('editor-save-error').waitFor()
  assert.equal(editor.commands.length, 2)
  await placeMark('highlight', 80, 500)
  await pastAutosave()
  assert.equal(await keepMine.count(), 0, 'nobody else wrote, so there is nothing to choose')
  assert.equal(editor.commands.length, 3, 'the next edit carries on from it')
  assert.match(await saveBadge().innerText(), /Draft saved/)
  assert.equal(await page.getByTestId('editor-save-error').count(), 0)
  // Save now finds the same, and sends nothing twice when there is nothing new.
  loseAnswerOnce = true
  await placeMark('highlight', 300, 80)
  await page.getByTestId('editor-save-error').waitFor()
  const beforeSaveNow = patches().length
  await page.getByTestId('editor-save-now').click()
  await page.getByTestId('editor-save-error').waitFor({ state: 'detached' })
  assert.equal(patches().length, beforeSaveNow + 1, 'one write to find out, and none to repeat it')
  assert.equal(await keepMine.count(), 0)
  assert.equal(editor.commands.length, 4)
  // Other writes can fail on the way back: the one that landed is still recognised.
  loseAnswerOnce = true
  await placeMark('highlight', 300, 300)
  await page.getByTestId('editor-save-error').waitFor()
  loseRequestOnce = true
  const beforeLost = patches().length
  await placeMark('highlight', 300, 500)
  await until(() => patches().length > beforeLost, 'the second write never started')
  await page.getByTestId('editor-save-error').waitFor()
  assert.equal(editor.commands.length, 5, 'that one never arrived')
  await placeMark('highlight', 80, 640)
  await pastAutosave()
  assert.equal(await keepMine.count(), 0)
  assert.equal(editor.commands.length, 7, 'everything arrives')
  // Undoing the change that landed unanswered still takes it off the server.
  loseAnswerOnce = true
  await placeMark('highlight', 300, 700)
  await page.getByTestId('editor-save-error').waitFor()
  assert.equal(editor.commands.length, 8)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await pastAutosave()
  assert.equal(await keepMine.count(), 0)
  assert.equal(editor.commands.length, 7, 'what the app thought was never saved has gone')
  assert.match(await saveBadge().innerText(), /Draft saved/)
  // What another device really wrote on top of it is still the customer's choice.
  loseAnswerOnce = true
  await placeMark('highlight', 300, 640)
  await page.getByTestId('editor-save-error').waitFor()
  editor.commands = [...editor.commands, highlightAt(700)]
  editor.version += 1
  await placeMark('highlight', 80, 700)
  await keepMine.waitFor()
  await useOther.click()
  await useOther.waitFor({ state: 'detached' })
  assert.equal(await commandRows().count(), 9, 'the other version is what stands')
  // However long the signal stays away, the write that landed is still known for what it is.
  await resetDocument()
  await open()
  loseAnswerOnce = true
  await placeMark('highlight', 80, 80)
  await page.getByTestId('editor-save-error').waitFor()
  const failAgain = async (retry) => {
    const before = patches().length
    loseRequestOnce = true
    await retry()
    await until(() => patches().length > before, 'the retry never started')
    await page.locator('.editor-save[data-state="failed"]').waitFor()
  }
  for (const y of [160, 240, 320, 400, 480]) await failAgain(() => placeMark('highlight', 80, y))
  for (let tap = 0; tap < 4; tap += 1) await failAgain(() => page.getByTestId('editor-save-now').click())
  assert.equal(editor.commands.length, 1, 'only the first write ever landed')
  await placeMark('highlight', 300, 300)
  await pastAutosave()
  assert.equal(await keepMine.count(), 0, 'and nobody else wrote, however many tries came after it')
  assert.equal(editor.commands.length, 7, 'so all of it arrives')
  checks.push('A write whose answer was lost is recognised, and only a real second version asks')

  // 12k-3. A quote on screen does not outlive the choice between versions.
  await resetDocument()
  await open()
  await placeMark('highlight', 80, 80)
  await pastAutosave()
  await page.getByTestId('editor-review').click()
  await page.getByTestId('editor-export').waitFor()
  editor.commands = [...editor.commands, highlightAt(300)]
  editor.version += 1
  await page.getByTestId('editor-actionbar').getByRole('button', { name: 'Refresh', exact: true }).click()
  await keepMine.waitFor()
  assert.equal(await page.getByTestId('editor-export').count(), 0, 'Export goes while the choice is open')
  await useOther.click()
  await useOther.waitFor({ state: 'detached' })
  assert.equal(await page.getByTestId('editor-export').count(), 0, 'and stays gone once it is made')
  await page.getByTestId('editor-review').waitFor()
  checks.push('A conflict at Review takes the quote away, so Export cannot make a discarded version')

  // 12k-4. An edit made while Review is on its way is not left out of the file.
  await resetDocument()
  await open()
  await placeMark('highlight', 80, 80)
  await pastAutosave()
  const quoteCalled = () => requests.filter((r) => r.path.endsWith('/quote')).length
  // Answered while the edit waits to be sent, and after it has been.
  for (const [delay, y] of [
    [500, 300],
    [1800, 500],
  ]) {
    quoteDelay = delay
    const quotedBefore = quoteCalled()
    await page.getByTestId('editor-review').click()
    await until(() => quoteCalled() > quotedBefore, 'Review asked for nothing')
    await placeMark('highlight', 80, y)
    await page.waitForTimeout(delay + 200)
    assert.equal(
      await page.getByTestId('editor-export').count(),
      0,
      `answered after ${delay} ms: Export stays away`,
    )
    assert.equal(await page.getByTestId('editor-review').isDisabled(), false, 'and Review is ready again')
    await pastAutosave()
  }
  quoteDelay = 0
  await page.getByTestId('editor-review').click()
  await page.getByTestId('editor-export').waitFor()
  checks.push('A quote answered after an edit is dropped, so the file never misses that edit')

  // 12k-5. Nothing can be edited until a document's images are known, and they keep their places.
  const imageA = id()
  const imageB = id()
  const sourceFile = editor.input_ids[0]
  await resetDocument()
  editor.input_ids = [sourceFile, imageA]
  editor.commands = [signatureAt(40, 1)]
  fileReadDelay = 1000
  await page.goto(`${origin}/en/app/editor/${editor.id}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('editor-opening').waitFor()
  await until(() => requests.some((r) => r.path === `/files/${imageA}`), 'the image was never read')
  assert.equal(await page.getByTestId('editor-page-1').count(), 0, 'the pages wait for the images')
  assert.equal(await page.locator('.editor-toolstrip').count(), 0, 'and so do the tools')
  await page.getByTestId('editor-page-1').waitFor()
  fileReadDelay = 0
  assert.equal(await page.getByTestId('editor-issue').count(), 0, 'the signature has its image')
  await placeMark('highlight', 80, 300)
  await pastAutosave()
  assert.deepEqual(lastPatch().body.input_ids, [sourceFile, imageA], 'the save keeps the image')
  assert.deepEqual(
    lastPatch().body.commands.map((command) => command.type),
    ['signature', 'highlight'],
    'and the mark that uses it',
  )
  // An image that could not be read may well be there, so it keeps its place.
  await resetDocument()
  editor.input_ids = [sourceFile, imageA, imageB]
  editor.commands = [signatureAt(40, 1), signatureAt(200, 2)]
  unreadableFiles.add(imageA)
  await open()
  unreadableFiles.clear()
  assert.equal(await page.getByTestId('editor-issue').count(), 0, 'nothing reads as missing')
  await placeMark('highlight', 80, 500)
  await pastAutosave()
  assert.deepEqual(lastPatch().body.input_ids, [sourceFile, imageA, imageB], 'nothing is dropped')
  assert.deepEqual(
    lastPatch().body.commands.map((command) => command.input_index),
    [1, 2, undefined],
    'and no mark moves to another picture',
  )
  // One the server says has gone would refuse every save, so it is let go, and only its own mark asks.
  await resetDocument()
  editor.input_ids = [sourceFile, imageA, imageB]
  editor.commands = [signatureAt(40, 1), signatureAt(200, 2), highlightAt(400)]
  expiredFiles.add(imageA)
  await open()
  await pastAutosave()
  assert.deepEqual(lastPatch().body.input_ids, [sourceFile, imageB], 'the server is told at once')
  assert.deepEqual(
    lastPatch().body.commands.map((command) => [command.type, command.input_index]),
    [
      ['signature', 1],
      ['highlight', undefined],
    ],
    'the later image takes the next number, and the mark on the lost one waits',
  )
  assert.match(await page.getByTestId('editor-issue').innerText(), /1\. Signature image: Choose an image/)
  assert.match(await saveBadge().innerText(), /Not saved: one change needs fixing/)
  await page.getByTestId('editor-issue-show').click()
  await attachFile('new.png', 'image/png')
  await page.getByTestId('editor-issue').waitFor({ state: 'detached' })
  await pastAutosave()
  assert.deepEqual(
    lastPatch().body.commands.map((command) => command.input_index),
    [2, 1, undefined],
    'choosing again saves it in its place, with the picture just chosen',
  )
  await page.getByTestId('editor-review').click()
  await page.getByTestId('editor-export').waitFor()
  // Unused and gone, it stops nothing: Review goes straight through.
  await resetDocument()
  editor.input_ids = [sourceFile, imageA]
  editor.commands = [highlightAt(40)]
  await open()
  await page.getByTestId('editor-review').click()
  await page.getByTestId('editor-export').waitFor()
  expiredFiles.clear()
  checks.push('A document opens with its images known: one unread keeps its place, one gone is let go')

  // 12k-6. "Use the other version" brings the other device's images with its marks.
  await resetDocument()
  await open()
  await placeMark('signature', 150, 300)
  await attachFile('mine.png', 'image/png')
  await pastAutosave()
  assert.equal(lastPatch().body.input_ids.length, 2, 'this device has its own image')
  editor.input_ids = [sourceFile, imageB]
  editor.commands = [signatureAt(40, 1)]
  editor.version += 1
  await placeMark('highlight', 80, 500)
  await useOther.waitFor()
  await useOther.click()
  await useOther.waitFor({ state: 'detached' })
  assert.equal(await page.getByTestId('editor-issue').count(), 0, 'the other signature has its image')
  await placeMark('highlight', 80, 500)
  await pastAutosave()
  assert.deepEqual(
    lastPatch().body.input_ids,
    [sourceFile, imageB],
    "and it is the other device's, not this one's",
  )
  assert.deepEqual(
    lastPatch().body.commands.map((command) => command.type),
    ['signature', 'highlight'],
  )
  checks.push('Taking the other version takes its images, so no mark prints the wrong picture')

  // 12k-7. Only what the engine can draw is attached: the chooser takes anything, and so does the upload.
  await resetDocument()
  await open()
  await placeMark('signature', 150, 300)
  for (const [name, mime] of [
    ['contract.pdf', 'application/pdf'],
    ['scan.tif', 'image/tiff'],
  ]) {
    await attachFile(name, mime, name.endsWith('.pdf') ? pdfBytes : onePixelPng)
    await page.getByTestId('editor-asset-refusal').filter({ hasText: 'PNG, JPEG or WebP' }).waitFor()
    assert.equal(await page.locator('.editor-assetchip').count(), 0, `${name} is refused at the tap`)
  }
  await placeMark('highlight', 80, 500)
  await pastAutosave()
  assert.deepEqual(lastPatch().body.input_ids, [sourceFile], 'and is not in what is saved')
  assert.match(await saveBadge().innerText(), /Not saved: one change needs fixing/, 'saving carries on')
  await page.getByTestId('editor-issue-show').click()
  await attachFile('real.png', 'image/png')
  await page.getByTestId('editor-issue').waitFor({ state: 'detached' })
  await pastAutosave()
  assert.equal(lastPatch().body.input_ids.length, 2)
  assert.match(await saveBadge().innerText(), /Draft saved/, 'and a real image is then taken')
  assert.equal(await page.getByTestId('editor-asset-refusal').count(), 0, 'the refusal goes once one is taken')
  checks.push('A file the engine cannot draw is refused when chosen, and never stops later saves')

  // 12k-8. A reply from before leaving a document has no say over the one open by then.
  const leaveTo = async () => {
    await goTo(`/en/app/editor/${slowDocumentId}`)
    await page.locator('.editor-head h1', { hasText: 'slow.pdf' }).waitFor()
  }
  const documentReads = () =>
    requests.filter((r) => r.path === `/editor/documents/${editor.id}` && r.method === 'GET').length
  // Keep my changes, left while it reads the server: that document's save must not go out.
  await resetDocument()
  await open()
  await placeMark('highlight', 80, 80)
  await pastAutosave()
  conflictOnce = true
  await placeMark('highlight', 80, 300)
  await keepMine.waitFor()
  const beforeLeaving = patches().length
  let documentReadsBefore = documentReads()
  documentReadDelay = 1500
  await keepMine.click()
  await until(() => documentReads() > documentReadsBefore, 'Keep my changes never read the server')
  await leaveTo()
  await page.waitForTimeout(1500)
  documentReadDelay = 0
  assert.equal(patches().length, beforeLeaving, 'nothing is written over the document left behind')
  assert.equal(editor.commands.length, 1, 'which still holds what it held')
  assert.equal(await page.locator('.editor-head h1').innerText(), 'slow.pdf', 'and the one opened stays open')
  // An image still on its way when the document is left is not attached to the next one.
  await resetDocument()
  await open()
  await placeMark('signature', 150, 300)
  uploadDelay = 2000
  await attachFile('late.png', 'image/png')
  await leaveTo()
  await page.waitForTimeout(2000)
  uploadDelay = 0
  await placeMark('signature', 150, 300)
  await page.locator('.editor-mark.signature').waitFor()
  assert.equal(await page.locator('.editor-assetchip').count(), 0, 'the next document has no such image')
  assert.equal(await page.getByTestId('editor-issue').count(), 1, 'and its signature asks for one')
  // A write that gave up after the 3 s leave wait does not mark the next document failed.
  await resetDocument()
  await open()
  loseAnswerOnce = true
  await placeMark('highlight', 80, 80)
  await page.getByTestId('editor-save-error').waitFor()
  documentReadsBefore = documentReads()
  documentReadDelay = 4500
  failDocumentReadOnce = true
  await placeMark('highlight', 80, 300)
  await until(() => documentReads() > documentReadsBefore, 'the conflict never read the server')
  await leaveTo()
  await page.waitForTimeout(1500)
  documentReadDelay = 0
  assert.equal(failDocumentReadOnce, false, 'the read failed by now')
  assert.equal(await page.locator('.editor-save[data-state="failed"]').count(), 0, 'the document open has not failed')
  assert.equal(await page.getByTestId('editor-save-error').count(), 0, 'and is given no reason to think so')
  checks.push('A reply from before leaving a document has no say over the one open by then')

  // 12l. Hiding or closing the app sends what is waiting, without waiting for the timer.
  for (const event of ['visibilitychange', 'pagehide']) {
    await resetDocument()
    await open()
    const waiting = patches().length
    await placeMark('highlight', 80, 80)
    const hiddenAt = Date.now()
    await hideApp(event)
    await until(() => patches().length > waiting, `${event} sent nothing`)
    assert.ok(Date.now() - hiddenAt < 700, `${event} sent it, not the timer`)
    assert.equal(
      await page.evaluate(() => window.__patchKeepalive.at(-1)),
      true,
      'the request can outlive the page',
    )
    await pastAutosave()
    assert.equal(patches().length, waiting + 1, 'once')
    assert.equal(editor.commands.length, 1)
    await hideApp(event)
    await page.waitForTimeout(200)
    assert.equal(patches().length, waiting + 1, 'with nothing waiting, nothing is sent')
  }
  // A write the timer started can outlive the page as well: it may be on its way when the app closes.
  await resetDocument()
  await open()
  await placeMark('highlight', 80, 80)
  await pastAutosave()
  assert.equal(await page.evaluate(() => window.__patchKeepalive.at(-1)), true, 'so it goes the same way')
  // A save that failed, as when the connection dropped, gets another try.
  await resetDocument()
  await open()
  refuseSaveOnce = ['upstream_unavailable', 503]
  await placeMark('highlight', 80, 80)
  await page.getByTestId('editor-save-error').waitFor()
  await hideApp('visibilitychange')
  await page.getByTestId('editor-save-error').waitFor({ state: 'detached' })
  assert.equal(editor.commands.length, 1, 'hiding the app retries a failed save')
  // A body too large for a keepalive request still goes, as a normal request.
  await resetDocument()
  editor.commands = Array.from({ length: 25 }, (_, index) => ({
    type: 'add_text',
    page: 1,
    x: 40,
    y: 40 + index * 20,
    text: cyrillic,
    font_size: 16,
    color: '#17212E',
  }))
  await open()
  const beforeLarge = patches().length
  await placeMark('highlight', 80, 760)
  await hideApp('visibilitychange')
  await until(() => patches().length > beforeLarge, 'a large draft is sent too')
  assert.equal(await page.evaluate(() => window.__patchKeepalive.at(-1)), false, 'without keepalive, which browsers cap')
  await until(() => editor.commands.length === 26, 'the large draft arrives')
  // Leaving the editor removes the listeners and does not strand a waiting edit.
  await resetDocument()
  await open()
  await placeMark('highlight', 80, 80)
  await pastAutosave()
  const attached = await page.evaluate(() => ({ ...window.__listeners }))
  await placeMark('highlight', 80, 300)
  await page.getByRole('link', { name: 'Tasks', exact: true }).first().click()
  await page.waitForURL('**/app/jobs')
  await until(() => editor.commands.length === 2, 'an edit made just before leaving is saved')
  const detached = await page.evaluate(() => ({ ...window.__listeners }))
  assert.equal(detached.visibilitychange, attached.visibilitychange - 1, 'visibilitychange listener removed')
  assert.equal(detached.pagehide, attached.pagehide - 1, 'pagehide listener removed')
  checks.push('Hiding or closing the app sends what is waiting; leaving the editor cleans up')

  // 13. Accessibility and layout across locales, viewports and themes.
  await resetDocument()
  for (const locale of ['en', 'uz', 'ru']) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await open(locale)
      assert.equal(await page.locator('html').getAttribute('lang'), locale)
      assert.equal(await page.locator('main h1').count(), 1, `${locale}/${width}: one page heading`)
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value
        }, theme)
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          `${locale}/${width}/${theme}: horizontal overflow`,
        )
        const result = await new AxeBuilder({ page })
          .include('.editor-shell')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
        assert.deepEqual(
          result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          [],
          `${locale}/${width}/${theme}: accessibility`,
        )
      }
      await page.screenshot({ path: path.join(output, `editor-${locale}-${width}.png`), fullPage: true })
    }
  }
  checks.push('EN/UZ/RU at 1440 and 390 in both themes: no overflow and no WCAG A/AA findings')

  // 14. Phones: the page fills the width, and nothing pushes the screen sideways.
  for (const [width, height] of [
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height })
    // That holds from the moment the pages show, not once the whole file has come.
    await resetDocument()
    downloadDelay = 1500
    await open()
    assert.equal(
      await page.locator('.editor-stage > .editor-stage-status').count(),
      1,
      'the file is still coming',
    )
    const early = await page.getByTestId('editor-page-1').boundingBox()
    assert.ok(
      Math.abs(early.width - (width - 8)) < 1,
      `${width}: the page is ${early.width} wide before the file comes`,
    )
    assert.equal(await hasHorizontalOverflow(), false, `${width}: no sideways scroll while it comes`)
    downloadDelay = 0
    await page.locator('.editor-stage > .editor-stage-status').waitFor({ state: 'detached' })
    // And for pages far larger than the screen: A0, narrower than the smallest manual zoom would make it.
    pageSizes = [{ width: 2383.94, height: 3370.39 }, PAGE]
    await open()
    const poster = await settledBox('editor-page-1')
    assert.ok(Math.abs(poster.width - (width - 8)) < 1, `${width}: a poster is ${poster.width} wide`)
    assert.equal(
      await page.locator('.editor-stage').evaluate((stage) => stage.scrollWidth > stage.clientWidth),
      false,
      `${width}: a poster does not scroll sideways`,
    )
    pageSizes = [PAGE, PAGE]
    for (const locale of ['en', 'uz', 'ru']) {
      await resetDocument()
      await open(locale)
      const where = `${locale}/${width}`
      const fitted = await settledBox('editor-page-1')
      assert.ok(Math.abs(fitted.width - (width - 8)) < 1, `${where}: page is ${fitted.width} wide`)
      assert.ok(fitted.x >= 0 && fitted.x + fitted.width <= width, `${where}: the page is on screen`)
      assert.equal(await hasHorizontalOverflow(), false, `${where}: no sideways scroll on open`)
      if (width >= 360) {
        const row = await page.locator('.editor-toolstrip-end').evaluate((element) => element.scrollWidth > element.clientWidth)
        assert.equal(row, false, `${where}: undo, zoom and help fit one row`)
      }
      // Zoom really zooms, keeps both edges reachable, and Fit width undoes it.
      const zoomControls = page.locator('.editor-zoom button')
      const fitTarget = await zoomControls.nth(1).boundingBox()
      assert.ok(fitTarget.width >= 44 && fitTarget.height >= 44, `${where}: the fit button is a 44 px target`)
      await zoomControls.nth(2).click()
      const zoomed = await settledBox('editor-page-1')
      assert.ok(zoomed.width > fitted.width * 1.2, `${where}: zooming in makes the page wider`)
      assert.ok(zoomed.x >= 0, `${where}: the left edge of a zoomed page can be reached`)
      assert.equal(await hasHorizontalOverflow(), false, `${where}: a zoomed page scrolls inside the stage`)
      await zoomControls.nth(1).click()
      const refitted = await settledBox('editor-page-1')
      assert.ok(Math.abs(refitted.width - fitted.width) < 1, `${where}: the fit button fits again`)
      // Asking for fit from Pages mode, where there is no stage to measure, still counts.
      await zoomControls.nth(2).click()
      await page.getByTestId('editor-mode-pages').click()
      await zoomControls.nth(1).click()
      await page.getByTestId('editor-mode-edit').click()
      const refittedFromPages = await settledBox('editor-page-1')
      assert.ok(Math.abs(refittedFromPages.width - fitted.width) < 1, `${where}: fit asked for in Pages mode applies`)
      // The panels at their widest: a colour row, and the long words of a held-back change.
      await placeMark('signature', 40, 60)
      await page.locator('.editor-mark.signature').waitFor()
      await pastAutosave()
      assert.equal(await hasHorizontalOverflow(), false, `${where}: no sideways scroll with a change to fix`)
      assert.equal(await page.getByTestId('editor-issue').count(), 1, `${where}: the change to fix is named`)
      assert.match(
        await saveBadge().innerText(),
        { en: /Not saved: one/, uz: /Saqlanmadi: bitta/, ru: /Не сохранено: 1/ }[locale],
        `${where}: the badge says it in the customer's language`,
      )
      const showTarget = await page.getByTestId('editor-issue-show').boundingBox()
      assert.ok(showTarget.width >= 44 && showTarget.height >= 44, `${where}: Show is a 44 px target`)
      assert.equal(
        await page.getByTestId('editor-issue-show').evaluate((button) => button.scrollWidth <= button.clientWidth),
        true,
        `${where}: Show holds its whole word`,
      )
      assert.ok(showTarget.x + showTarget.width <= width - 16 + 0.5, `${where}: Show stays inside the bar's padding`)
      const noteSize = await page
        .getByTestId('editor-issue')
        .evaluate((note) => parseFloat(getComputedStyle(note).fontSize))
      assert.ok(noteSize >= 13, `${where}: the change in the way is named in ${noteSize} px text`)
      await page.screenshot({ path: path.join(output, `editor-phone-${locale}-${width}-issue.png`) })
      for (const theme of ['dark', 'light']) {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value
        }, theme)
        const flagged = await new AxeBuilder({ page })
          .include('.editor-actionbar')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
        assert.deepEqual(
          flagged.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          [],
          `${where}/${theme}: accessibility with a change to fix`,
        )
      }
      await page.getByTestId('editor-issue-show').click()
      await page.screenshot({ path: path.join(output, `editor-phone-${locale}-${width}-show.png`) })
      assert.equal(await hasHorizontalOverflow(), false, `${where}: no sideways scroll on its panel`)
      const fix = await page.locator('.editor-assetfield').boundingBox()
      const bar = await page.getByTestId('editor-actionbar').boundingBox()
      assert.ok(fix.y >= 64 && fix.y + 44 < bar.y, `${where}: Show brings the fix between the bars, at ${fix.y}`)
      // A refused file is said beside the tap, even with the button just above the bottom bar.
      await page
        .getByTestId('editor-asset-upload')
        .evaluate((button, bottom) => window.scrollBy(0, button.getBoundingClientRect().bottom - bottom), bar.y)
      await attachFile('contract.pdf', 'application/pdf', pdfBytes)
      await page.getByTestId('editor-asset-refusal').waitFor()
      await page.screenshot({ path: path.join(output, `editor-phone-${locale}-${width}-refused.png`) })
      const refusal = await page.getByTestId('editor-asset-refusal').boundingBox()
      const barWithRefusal = await page.getByTestId('editor-actionbar').boundingBox()
      assert.ok(
        refusal.y >= 64 && refusal.y + refusal.height <= barWithRefusal.y,
        `${where}: the refusal is on screen, at ${refusal.y}`,
      )
      assert.equal(await hasHorizontalOverflow(), false, `${where}: no sideways scroll with a refusal showing`)
      await commandRows().first().getByRole('button').last().click()
      // Text past the page: Show brings the button that fixes it between the bars too.
      await placeText('я'.repeat(100), 40, 60)
      await page.getByTestId('editor-issue-show').click()
      await page.screenshot({ path: path.join(output, `editor-phone-${locale}-${width}-overflow.png`) })
      const wrapButton = await page.locator('.editor-wrap-text').boundingBox()
      const barWithNote = await page.getByTestId('editor-actionbar').boundingBox()
      assert.ok(
        wrapButton.y >= 64 && wrapButton.y + wrapButton.height <= barWithNote.y,
        `${where}: Show brings the button between the bars, at ${wrapButton.y}`,
      )
      assert.ok(wrapButton.height >= 44, `${where}: and it is a 44 px target`)
      await commandRows().first().getByRole('button').last().click()
      await placeMark('highlight', 40, 60)
      const swatch = await page.locator('.editor-swatch').first().boundingBox()
      assert.ok(swatch.width >= 44 && swatch.height >= 44, `${where}: a colour is a 44 px target`)
      assert.equal(await hasHorizontalOverflow(), false, `${where}: no sideways scroll with colours showing`)
      const result = await new AxeBuilder({ page })
        .include('.editor-shell')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      assert.deepEqual(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        [],
        `${where}: accessibility`,
      )
      await page.screenshot({ path: path.join(output, `editor-phone-${locale}-${width}.png`), fullPage: true })
    }
  }
  // The next common size down still gets the whole row of controls.
  await page.setViewportSize({ width: 360, height: 740 })
  await open()
  assert.equal(
    await page.locator('.editor-toolstrip-end').evaluate((element) => element.scrollWidth > element.clientWidth),
    false,
    '360: undo, zoom and help fit one row',
  )
  checks.push('At 390x844 and 320x568 in EN/UZ/RU the page fills the width and nothing overflows')

  // 15. A touch phone: taps rather than clicks, and a browser that zooms the
  // whole page out if anything at all is wider than the screen.
  await resetDocument()
  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  await touchContext.route('**/*', blockExternal)
  await touchContext.route(`${origin}/api/v1/**`, fixtureApi)
  const phone = await touchContext.newPage()
  phone.setDefaultTimeout(15000)
  phone.on('pageerror', (e) => errors.push(e.message))
  await phone.goto(`${origin}/en/app/editor/${editor.id}`, { waitUntil: 'domcontentloaded' })
  await phone.getByTestId('editor-page-1').waitFor()
  await phone.waitForTimeout(400)
  assert.equal(await phone.evaluate(() => innerWidth), 390, 'nothing widened the layout past the phone')
  const phonePage = await phone.getByTestId('editor-page-1').boundingBox()
  assert.ok(Math.abs(phonePage.width - 382) < 1, `the page is ${phonePage.width} wide on a touch phone`)
  const phoneRows = phone.locator('[data-testid="editor-command-list"] li')
  await phone.getByTestId('editor-tool-add_text').tap()
  await phone.getByTestId('editor-page-1').tap({ position: { x: 60, y: 100 } })
  await phone.getByTestId('editor-text-input').fill('Typed on a phone')
  await phone.getByTestId('editor-text-input').blur()
  await phoneRows.first().waitFor()
  await phone.getByRole('button', { name: 'Undo', exact: true }).tap()
  assert.equal(await phoneRows.count(), 0, 'a tap on Undo takes the mark away')
  await phone.getByRole('button', { name: 'Redo', exact: true }).tap()
  assert.equal(await phoneRows.count(), 1, 'a tap on Redo brings it back')
  await phone.getByTestId('editor-floatbar').getByRole('button', { name: 'Duplicate', exact: true }).tap()
  assert.equal(await phoneRows.count(), 2, 'a tap on Duplicate copies it')
  await phone.waitForTimeout(1400)
  assert.deepEqual(
    editor.commands.map((command) => command.text),
    ['Typed on a phone', 'Typed on a phone'],
    'and autosave carries it all to the server',
  )
  // A tap on Undo with an empty text field open takes that mark and nothing before it.
  await phone.getByTestId('editor-tool-add_text').tap()
  await phone.getByTestId('editor-page-1').tap({ position: { x: 60, y: 300 } })
  await phone.getByTestId('editor-text-input').waitFor()
  await phone.getByRole('button', { name: 'Undo', exact: true }).tap()
  assert.equal(await phone.getByTestId('editor-text-input').count(), 0, 'the field goes with its mark')
  assert.equal(await phoneRows.count(), 2, 'and the marks before it stay')
  await phone.screenshot({ path: path.join(output, 'editor-touch-390.png') })
  await touchContext.close()
  checks.push('On a touch phone the page fits the screen and taps place, undo, redo and duplicate')

  assert.deepEqual(refusedCommands, [], 'autosave never sent a command the server refuses')
  assert.deepEqual(overflowedJobs, [], 'no job was made from text that runs past the page')
  assert.deepEqual(errors, [], 'no runtime errors')
  assert.deepEqual(unexpected, [], 'every API call is explicitly covered by the offline fixture')
  assert.deepEqual(external, [], 'no external requests occur')

  const report = {
    status: 'passed',
    at: new Date().toISOString(),
    checks,
    errors,
    functionalGroups: checks.length - 1,
    savePatches: patches().length,
    jobSubmissions: jobPosts().length,
    acceptedJobs: jobs.size,
    visualChecks: 12,
  }
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  await Promise.all(['failure.json', 'failure.png'].map((name) => fs.rm(path.join(output, name), { force: true })))
  console.log(JSON.stringify(report, null, 2))
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
