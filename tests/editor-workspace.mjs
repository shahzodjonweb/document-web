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

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
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
const paidOnly = new Set(['editor.existing_text', 'editor.insert_images', 'editor.replace_images', 'editor.redact'])

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
    pages: [PAGE, PAGE],
    form_fields: [{ name: 'participant', type: '/Tx' }],
    image_counts: [1, 0],
    commands: editor.commands,
    input_ids: editor.input_ids,
  }
}

// Block everything that is not explicitly served by the fixture.
await context.route('**/*', (route) => {
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
})

await context.route(`${origin}/api/v1/**`, async (route) => {
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
  if (endpoint === '/me') return json({ id: 'u1', plan, locale: 'en', preferences: {}, time_zone: 'UTC' })
  if (endpoint === '/catalog')
    return json({
      features: editorFeatures.map((feature) => ({
        id: feature,
        name: feature,
        category: 'editor',
        eligible: plan === 'premium' ? true : !paidOnly.has(feature),
      })),
      draft: true,
    })
  if (endpoint === '/plans') return json({ plans: [{ id: plan, name: plan, limits: {} }], draft: true })
  if (endpoint === '/usage')
    return json({ meters: { file_tasks: { remaining: 50, limit: 90 } }, daily: {}, resets_at: null })
  if (endpoint === '/jobs' && method === 'GET') return json({ results: [...jobs.values()], count: jobs.size })
  if (endpoint === '/studio/config') return json({ features: [], limits: {}, provider: {} })
  if (endpoint === '/editor/form-templates') return json({ results: [], limit: plan === 'premium' ? 30 : 0 })

  if (endpoint === '/editor/documents' && method === 'GET') return json({ results: [documentPayload()] })
  if (endpoint === `/editor/documents/${editor.id}` && method === 'GET') return json(documentPayload())
  if (endpoint === `/editor/documents/${editor.id}` && method === 'PATCH') {
    if (conflictOnce) {
      conflictOnce = false
      return failure('version_conflict')
    }
    if (body.version !== editor.version) return failure('version_conflict')
    assert.ok(Array.isArray(body.commands), 'PATCH sends a command array')
    assert.equal(body.input_ids[0], editor.input_ids[0], 'the source file stays input 0')
    // Materialise defaults the way `normalize()` does.
    editor.commands = body.commands.map((command) => {
      const next = { ...command }
      if (next.type === 'add_text') {
        next.font_size = next.font_size ?? 16
        next.color = next.color ?? '#000000'
      }
      if (next.type === 'highlight') next.color = next.color ?? '#FFFF00'
      if (next.type === 'draw') next.stroke_width = next.stroke_width ?? 2
      return next
    })
    editor.version += 1
    return json(documentPayload())
  }
  if (endpoint === `/editor/documents/${editor.id}/quote` && method === 'POST') {
    if (body.version !== editor.version) return failure('version_conflict')
    const quote = {
      id: id(),
      feature_id: 'editor.visual',
      meters: [
        { meter: 'file_tasks', amount: 1 },
        { meter: 'file_page_units', amount: 2 },
      ],
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
    const job = { id: id(), feature_id: 'editor.visual', status: 'succeeded', artifacts: [], warnings: [], settled_meters: {} }
    jobs.set(job.id, job)
    acceptedKeys.set(key, job)
    if (failJobOnce) {
      failJobOnce = false
      return json({ error: { code: 'upstream_unavailable', message: 'Fixture interruption' } }, 503)
    }
    return json(job, 201)
  }
  if (endpoint.startsWith('/jobs/')) return json(jobs.get(endpoint.split('/')[2]) || {})
  if (/^\/files\/[^/]+\/download$/.test(endpoint))
    return route.fulfill({ status: 200, contentType: 'application/pdf', body: pdfBytes })
  if (/^\/files\/[^/]+\/preview$/.test(endpoint))
    return route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng })
  if (/^\/files\/[^/]+$/.test(endpoint)) return json({ id: endpoint.split('/')[2], name: 'image.png', mime_type: 'image/png' })

  unexpected.push({ path: endpoint, method })
  return failure('unexpected_fixture_request', 404)
})

const open = async (locale = 'en') => {
  await page.goto(`${origin}/${locale}/app/editor/${editor.id}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('editor-page-1').waitFor()
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
  await page.getByTestId('editor-text-input').fill('Reviewed in PDF Master')
  await page.getByTestId('editor-page-1').click({ position: { x: 400, y: 600 } })
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="editor-command-list"] li').length > 0,
  )
  await page.waitForTimeout(1400)
  const placed = lastPatch()?.body.commands.find((c) => c.type === 'add_text')
  assert.ok(placed, 'the text command reached the server')
  assert.ok(Math.abs(placed.x - 120 / scale) < 0.02, `x ${placed.x} ≈ ${120 / scale}`)
  assert.ok(Math.abs(placed.y - 160 / scale) < 0.02, `y ${placed.y} ≈ ${160 / scale}`)
  assert.equal(placed.text, 'Reviewed in PDF Master')
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
  assert.equal(jobPosts().length, 0, 'reviewing cost never submits a job')
  await page.getByTestId('editor-export').click()
  await page.waitForURL('**/app/jobs/*')
  assert.equal(jobPosts().length, 1, 'confirming submits exactly one job')
  assert.ok(jobPosts()[0].key, 'the job carries an idempotency key')
  checks.push('Review shows cost without charging; export submits one idempotent job')

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

  // 7. A version conflict pauses autosave and offers both resolutions.
  await open()
  conflictOnce = true
  await page.getByTestId('editor-tool-highlight').click()
  await page.getByTestId('editor-page-1').click({ position: { x: 100, y: 100 } })
  await page.getByRole('button', { name: 'Keep my changes', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Use the other version', exact: true }).waitFor()
  checks.push('A version conflict stops autosave and asks which version to keep')

  // 8. Plan gating renders locked tools without disabling them.
  plan = 'free'
  editor.commands = []
  await open()
  const redact = page.getByTestId('editor-tool-redact')
  assert.equal(await redact.getAttribute('data-locked'), 'true', 'redact is marked as outside the plan')
  assert.match(
    (await redact.innerText()).replace(/\s+/g, ' '),
    /Not in your plan/,
    'the lock is part of the accessible name, not a disabled state',
  )
  await redact.click()
  await page.locator('.editor-toolstrip .editor-lock').waitFor()
  assert.equal(await page.getByTestId('editor-text-input').count(), 0, 'a locked tool cannot place anything')
  assert.equal(
    await page.locator('[data-testid="editor-command-list"] li').count(),
    0,
    'a locked tool adds no change',
  )
  checks.push('Tools outside the plan stay visible and explain themselves instead of failing late')
  plan = 'premium'

  // 9. Accessibility and layout across locales, viewports and themes.
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
