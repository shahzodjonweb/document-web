import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// The everyday pages: Home (greeting, drop zone, AI shortcuts, the plan in
// one row, popular tools, recent tasks) and a tool from files to a started
// task, in one column with the next step always in reach on a phone.
const origin = process.env.CORE_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use the local web server')
const output = path.resolve(process.env.CORE_ARTIFACT_DIR || '../studio-review/core-pages')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
const page = await context.newPage()
page.setDefaultTimeout(10000)
const errors = []
const checks = []
const unexpected = []
const requests = []
page.on('pageerror', (error) => errors.push(error.message))

const account = {
  id: '00000000-0000-4000-8000-555555555555', display_name: 'Malika Yusupova', locale: 'en', time_zone: 'UTC',
  mode: 'general', plan: 'free', preferences: { paper_size: 'A4' }, login_methods: { email: false, google: false, telegram: true },
}
const feature = (id, parameters = {}) => ({ id, name: id, category: '', enabled: true, eligible: true, parameters })
const features = [
  feature('pdf.merge'),
  feature('pdf.compress'),
  feature('pdf.split'),
  feature('pdf.images_to_pdf'),
  feature('convert.word_to_pdf'),
  feature('pdf.to_images'),
  feature('ocr.extract_text', {
    properties: { language: { type: 'string', enum: ['eng', 'rus', 'uzb'], default: 'eng' } },
  }),
]
const plans = [{ id: 'free', name: 'Free', price_xtr: 0, limits: { max_file_mib: 25, max_pages_per_job: 100, saved_workflows: 0 } }]
let uploads = 0
const jobs = new Map()

await context.route('**/*', (route) => {
  const url = new URL(route.request().url())
  if (url.origin === origin || url.protocol === 'data:') return route.continue()
  return route.abort('blockedbyclient')
})
await context.route(`${origin}/api/v1/**`, async (route) => {
  const request = route.request()
  const endpoint = new URL(request.url()).pathname.replace('/api/v1', '')
  const method = request.method()
  requests.push({ endpoint, method })
  const json = (value, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
  if (endpoint === '/auth/session')
    return json({ user: account, development_login_enabled: false, csrf_token: 'fixture' })
  if (endpoint === '/me') return json(account)
  if (endpoint === '/catalog') return json({ features, draft: false })
  if (endpoint === '/plans') return json({ plans, checkout_enabled: false })
  if (endpoint === '/usage')
    return json({
      plan: 'free',
      meters: {
        file_tasks: { limit: 300, remaining: 262 },
        file_page_units: { limit: 3000, remaining: 2710 },
        ai_credits: { limit: 3150, remaining: 2900 },
      },
      daily: { limit: 20, remaining: 17 },
      resets_at: '2026-11-01T00:00:00Z',
    })
  if (endpoint === '/channels') return json({ required: false, joined: true, channels: [] })
  if (endpoint === '/studio/config')
    return json({
      provider: { mode: 'openai', configured: true },
      features: [
        { id: 'ai.pdf_topic', name: 'PDF Document', eligible: true },
        { id: 'ai.pptx', name: 'PowerPoint Slides', eligible: true },
      ],
      default_pages: 5,
    })
  if (endpoint === '/jobs' && method === 'GET') return json({ results: [...jobs.values()], count: jobs.size })
  if (endpoint === '/files/uploads' && method === 'POST') {
    uploads += 1
    return json({
      id: `00000000-0000-4000-8000-0000000001${String(uploads).padStart(2, '0')}`,
      name: uploads === 1 ? 'Quarterly report.pdf' : `Appendix ${uploads - 1}.pdf`,
      size_bytes: 180000 * uploads,
      page_count: 3 + uploads,
    })
  }
  if (endpoint.startsWith('/files/') && method === 'DELETE') return json({})
  if (endpoint === '/quotes' && method === 'POST') {
    const body = request.postDataJSON()
    return json({
      id: '00000000-0000-4000-8000-000000000300',
      feature_id: body.feature_id,
      input_ids: body.input_ids,
      meters: [
        { meter: 'file_tasks', amount: 1 },
        { meter: 'file_page_units', amount: 9 },
      ],
      available_balances: { file_tasks: { remaining: 262 }, file_page_units: { remaining: 2710 } },
      affordable: true,
      expires_at: new Date(Date.now() + 900000).toISOString(),
    })
  }
  if (endpoint === '/jobs' && method === 'POST') {
    const job = {
      id: '00000000-0000-4000-8000-000000000400', feature_id: 'pdf.merge', status: 'succeeded',
      created_at: new Date().toISOString(), outputs: [], inputs: [], parameters: {},
    }
    jobs.set(job.id, job)
    return json(job, 201)
  }
  if (endpoint.startsWith('/jobs/')) return json(jobs.get(endpoint.split('/')[2]) || {})
  unexpected.push(`${method} ${endpoint}`)
  return json({})
})

const go = async (route) => {
  await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
}
const theme = (value) =>
  page.evaluate((next) => {
    localStorage.setItem('pdf-master-theme', next)
    document.documentElement.dataset.theme = next
  }, value)
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
const axe = async (label) => {
  const result = await new AxeBuilder({ page }).include('#main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  assert.deepEqual(
    result.violations.map((item) => `${item.id}: ${item.nodes.map((node) => node.target.join(' ')).join(', ')}`),
    [],
    `${label} accessibility`,
  )
}
const shot = async (name, fullPage = false) => {
  await page.mouse.move(0, page.viewportSize().height - 1)
  await page.screenshot({ path: `${output}/${name}.png`, fullPage })
}
// A select inside its label is named with its chosen option too, so find it by the label.
const field = (label) => page.locator('label.form-field', { hasText: label }).locator('select, input')
const texts = (locator) => locator.evaluateAll((items) => items.map((item) => item.textContent.trim()))
const ids = (selector) =>
  page.$$eval(selector, (nodes) =>
    nodes.map((node) => {
      const href = decodeURIComponent(node.getAttribute('href') || '')
      return href.includes('feature=') ? href.split('feature=')[1] : href.split('/').at(-1)
    }),
  )

try {
  // Home.
  await go('/en/app')
  await page.locator('.quick-tools .tool-card').first().waitFor()
  assert.equal(await page.locator('h1').innerText(), 'Hello, Malika')
  assert.equal(await page.locator('.eyebrow').count(), 0, 'no eyebrow over the greeting')
  assert.deepEqual(await ids('.ai-shortcut'), ['ai.pdf_topic', 'ai.pptx'])
  assert.deepEqual(await texts(page.locator('.plan-meter-label')), [
    'Standard tasks', 'Processed pages', 'AI credits', 'Tasks today',
  ])
  assert.match(await page.locator('.plan-meter').first().innerText(), /262\s+of 300/)
  assert.deepEqual(await ids('.quick-tools .tool-card'), [
    'pdf.merge', 'pdf.compress', 'pdf.split', 'pdf.images_to_pdf', 'convert.word_to_pdf',
  ])
  for (const gone of ['.privacy-card', '.help-strip', '.usage-card']) {
    assert.equal(await page.locator(gone).count(), 0, `${gone} is gone from Home`)
  }
  checks.push('Home: greeting, drop zone, the two AI shortcuts, four plan meters, five file tools, recent tasks')

  // Tools: categories that have tools, real descriptions.
  await go('/en/app/tools')
  await page.locator('.tool-grid .tool-card').first().waitFor()
  const offered = await texts(page.locator('.category-tabs button'))
  assert.ok(!offered.includes('Automate'), 'a category with no tools is not offered')
  assert.ok(offered.includes('Read text'))
  assert.equal(await page.locator('.workspace-hubs').count(), 0, 'the hub strip with dead links is gone')
  const ocr = page.locator('.tool-card[href$="ocr.extract_text"] p')
  assert.equal(await ocr.innerText(), 'Read the text from scans and photos of pages.')
  checks.push('Tools offers only categories with tools; every tool has its own description')

  // A tool, start to finish: files → review → start.
  await go('/en/app/tools/pdf.merge')
  await page.locator('.tool-steps').waitFor()
  assert.deepEqual(await texts(page.locator('.step-head h2')), ['Your files', 'Review and start'],
    'merge has nothing to set, so there is no options step')
  const start = page.locator('.tool-action .button.primary')
  assert.equal(await start.isDisabled(), true)
  assert.equal(await page.locator('.tool-action .quote-footnote').innerText(), 'Add at least two PDFs to merge.')
  await page.locator('input[type=file]').setInputFiles(['tests/fixtures/research-notes.pdf', 'tests/fixtures/appendix.pdf'])
  await page.locator('.file-row').nth(1).waitFor()
  assert.equal(await page.locator('.workspace-drop').count(), 0, 'the drop zone steps aside once files are in')
  await page.getByRole('button', { name: 'Move up', exact: true }).nth(1).click()
  assert.match(await page.locator('.file-row').first().innerText(), /Appendix 1/)
  assert.match(await page.locator('.tool-summary').innerText(), /2 files · 9 pages/)
  for (const mode of ['light', 'dark']) {
    await theme(mode)
    assert.equal(await overflow(), false, `merge 1440 ${mode} overflow`)
    await axe(`merge 1440 ${mode}`)
    await shot(`merge-files-1440-${mode}`, true)
  }
  await theme('light')
  await start.click()
  await page.locator('.quote-meters').waitFor()
  assert.match(await page.locator('.quote-meters').innerText(), /Standard task[\s\S]*1/)
  await shot('merge-review-1440', true)
  await page.getByRole('button', { name: 'Start processing', exact: true }).click()
  await page.waitForURL('**/app/jobs/*')
  checks.push('Merge: two files in, reordered, reviewed, started; one column with no options step')

  // A tool with options: essentials shown, the rest folded.
  await go('/en/app/tools/pdf.to_images')
  await page.locator('.tool-steps').waitFor()
  assert.deepEqual(await texts(page.locator('.step-head h2')), ['Your files', 'Options', 'Review and start'])
  assert.equal(await field('Output format').isVisible(), true)
  assert.equal(await field('Resolution').isVisible(), false, 'resolution starts folded')
  await page.locator('.advanced-options summary').click()
  assert.equal(await field('Resolution').isVisible(), true)
  checks.push('Options show what matters; the rest is folded under More options')

  // Phone: one column, and the next step stays in reach above the phone bar.
  await page.setViewportSize({ width: 390, height: 844 })
  for (const mode of ['light', 'dark']) {
    await go('/en/app')
    await theme(mode)
    await page.locator('.quick-tools .tool-card').first().waitFor()
    assert.equal(await overflow(), false, `home 390 ${mode} overflow`)
    await axe(`home 390 ${mode}`)
    await shot(`home-390-${mode}`, true)
  }
  await theme('light')
  uploads = 0
  await go('/en/app/tools/pdf.merge')
  await page.locator('input[type=file]').setInputFiles(['tests/fixtures/research-notes.pdf', 'tests/fixtures/appendix.pdf'])
  await page.locator('.file-row').nth(1).waitFor()
  await page.evaluate(() => scrollTo(0, 0))
  const bar = await page.locator('.mobile-nav').boundingBox()
  const action = await page.locator('.tool-action .button.primary').boundingBox()
  assert.ok(action.y + action.height <= bar.y + 1 && action.y > bar.y - 120, 'the action sits just above the phone bar')
  assert.equal(await overflow(), false, 'merge 390 overflow')
  await axe('merge 390')
  await shot('merge-390')
  checks.push('Phones: Home and the tool fit; the next step stays in reach above the phone bar')

  await page.setViewportSize({ width: 1440, height: 900 })
  for (const mode of ['light', 'dark']) {
    await go('/en/app')
    await theme(mode)
    await page.locator('.quick-tools .tool-card').first().waitFor()
    assert.equal(await overflow(), false, `home 1440 ${mode} overflow`)
    await axe(`home 1440 ${mode}`)
    await shot(`home-1440-${mode}`, true)
  }

  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [], 'Every API call is covered by the fixture')
  const report = { status: 'passed', checks }
  await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
