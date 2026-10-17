// Every API call is intercepted. No customer account, live upload or paid task is used.
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const origin = process.env.IMAGE_PDF_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use a local fixture server')
const output = path.resolve(process.env.IMAGE_PDF_ARTIFACT_DIR || '../image-pdf-review/web')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const checks = []
const errors = []
const unexpected = []
const external = []
const labels = {
  en: [
    'Documents get their matched page size (A4, Letter or Legal). Other photos keep their shape.',
    'Review task',
    'Start processing',
  ],
  uz: [
    'Hujjatlar o‘ziga mos sahifa o‘lchamini oladi (A4, Letter yoki Legal). Boshqa rasmlar o‘z shaklini saqlaydi.',
    'Vazifani tekshirish',
    'Qayta ishlashni boshlash',
  ],
  ru: [
    'Документы получат подходящий размер страницы (A4, Letter или Legal). Остальные фото сохранят свои пропорции.',
    'Проверить задачу',
    'Начать обработку',
  ],
}
// The scanner always runs; these switches were removed and must never reach a quote.
const removed = ['auto_crop', 'enhance_text']
const legacyKeys = (parameters) => removed.filter((key) => Object.hasOwn(parameters, key))
const image = {
  id: '00000000-0000-4000-8000-000000000101',
  name: 'document-photo.png',
  size_bytes: 4096,
  page_count: 1,
  mime_type: 'image/png',
  state: 'ready',
}
let sequence = 0
const id = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`

try {
  for (const locale of ['en', 'uz', 'ru']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    page.on('pageerror', (error) => errors.push({ locale, message: error.message }))
    const quotes = []
    const account = {
      id: 'fixture-reader',
      locale,
      plan: 'free',
      preferences: { paper_size: 'A4' },
      display_name: 'Fixture Reader',
      time_zone: 'UTC',
    }
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url())
      if (url.origin === origin && url.pathname.startsWith('/api/')) {
        unexpected.push({ locale, endpoint: url.pathname })
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
      const json = (value, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
      if (endpoint === '/auth/session')
        return json({ user: account, development_login_enabled: false, csrf_token: 'fixture-csrf' })
      if (endpoint === '/auth/providers')
        return json({ email: { enabled: true, configured: true }, google: {}, telegram: {}, antibot: {} })
      if (endpoint === '/me') return json(account)
      if (endpoint === '/catalog')
        return json({
          features: ['pdf.images_to_pdf', 'pdf.compress'].map((feature) => ({
            id: feature,
            name: feature,
            eligible: true,
            enabled: true,
          })),
          draft: false,
        })
      if (endpoint === '/plans')
        return json({
          plans: [{ id: 'free', limits: { max_file_mib: 25, max_pages_per_job: 100 } }],
          draft: false,
        })
      if (endpoint === '/usage')
        return json({ plan: 'free', week: { starts_at: '2026-10-11T19:00:00Z', resets_at: '2026-10-18T19:00:00Z', time_zone: 'Asia/Tashkent' }, resets_at: '2026-10-18T19:00:00Z',
      ai_documents: { limit: 5, used: 0, remaining: 5 }, file_jobs: { limit: 15, used: 0, remaining: 15 }, edits_per_file: 3 })
      if (endpoint === '/studio/config') return json({ features: [], provider: {}, limits: {} })
      if (endpoint === '/jobs' && method === 'GET') return json({ results: [], count: 0 })
      if (endpoint === '/channels') return json({ required: false, joined: true, channels: [] })
      if (endpoint === '/files/uploads') return json({ ...image, id: id() }, 201)
      if (/^\/files\/[^/]+$/.test(endpoint)) return json({ ...image, id: endpoint.split('/')[2] })
      if (endpoint === '/quotes' && method === 'POST') {
        const body = request.postDataJSON()
        quotes.push(body)
        return json(
          {
            id: id(),
            feature_id: body.feature_id,
            parameters: body.parameters,
            affordable: true,
            expires_at: new Date(Date.now() + 600000).toISOString(),
          },
          201,
        )
      }
      unexpected.push({ locale, endpoint, method })
      return route.abort('blockedbyclient')
    })
    const [fitHint, reviewLabel, startLabel] = labels[locale]
    const hint = page.getByText(fitHint, { exact: true })
    const review = page.getByRole('button', { name: reviewLabel, exact: true })
    const start = page.getByRole('button', { name: startLabel, exact: true })
    const paperSize = page.locator('.tool-page select').first()
    const savedDraft = () =>
      page.evaluate(() => JSON.parse(sessionStorage.getItem('pdf-master-draft') || 'null'))
    const quote = async () => {
      await review.click()
      await start.waitFor({ state: 'visible' })
      return quotes.at(-1).parameters
    }
    await page.goto(`${origin}/${locale}/app/tools/pdf.images_to_pdf`)
    await hint.waitFor()
    assert.equal(await paperSize.inputValue(), 'fit', 'Fresh scans ignore the generic A4 profile default')
    assert.equal(await paperSize.locator('option[value="fit"]').textContent(), {
      en: 'Automatic page size', uz: 'Avtomatik sahifa o‘lchami', ru: 'Автоматический размер страницы',
    }[locale])
    assert.deepEqual(
      await paperSize.locator('option').evaluateAll((options) => options.map((option) => option.value)),
      ['fit', 'A4', 'Letter', 'original'],
      'Legal is matched automatically and is not a paper choice',
    )
    assert.equal(await page.getByRole('switch').count(), 0, 'The scanning switches are gone')
    assert.equal(await page.locator('.tool-page input[type="checkbox"]').count(), 0)
    await page.locator('input[type="file"]').setInputFiles('tests/fixtures/brand-logo.png')
    await review.waitFor({ state: 'visible' })
    await page.waitForFunction(
      () => JSON.parse(sessionStorage.getItem('pdf-master-draft') || 'null')?.files?.length === 1,
    )
    const fresh = await quote()
    assert.deepEqual(legacyKeys(fresh), [], 'No scanning switch reaches the quote')
    assert.equal(fresh.paper_size, 'fit')
    assert.equal(fresh.margin, 0)
    assert.equal(fresh.orientation, 'auto')
    assert.deepEqual(legacyKeys((await savedDraft()).parameters), [])
    checks.push(`${locale}: no scanning switches are shown or sent; the fit hint names the matched sizes`)
    checks.push(`${locale}: fresh scans fit the image without paper margins or a forced portrait layout`)

    await paperSize.selectOption('A4')
    await review.waitFor({ state: 'visible' })
    assert.equal(await start.count(), 0, 'Changing paper layout invalidates the quote')
    assert.equal(await hint.count(), 0, 'The fit hint describes only the automatic page size')
    assert.equal((await quote()).paper_size, 'A4')
    await page.reload()
    await paperSize.waitFor()
    await review.waitFor({ state: 'visible' })
    assert.equal(await paperSize.inputValue(), 'A4', 'An explicit A4 tool choice survives reload')
    assert.equal((await quote()).paper_size, 'A4')
    await paperSize.selectOption('fit')
    await hint.waitFor()
    await review.waitFor({ state: 'visible' })
    await quote()
    checks.push(`${locale}: explicit paper layout choices persist and invalidate an existing quote`)

    // A draft saved while the switches existed keeps its paper settings and loses only the switches.
    await page.evaluate(
      (file) =>
        sessionStorage.setItem(
          'pdf-master-draft',
          JSON.stringify({
            tool: 'pdf.images_to_pdf',
            files: [file],
            parameters: {
              paper_size: 'Letter',
              orientation: 'landscape',
              margin: 24,
              auto_crop: false,
              enhance_text: true,
            },
          }),
        ),
      image,
    )
    await page.reload()
    await paperSize.waitFor()
    await review.waitFor({ state: 'visible' })
    assert.equal(await paperSize.inputValue(), 'Letter')
    const older = await quote()
    assert.deepEqual(legacyKeys(older), [], 'A restored draft does not send the removed switches')
    assert.equal(older.paper_size, 'Letter')
    assert.equal(older.orientation, 'landscape')
    assert.equal(older.margin, 24)
    assert.deepEqual(legacyKeys((await savedDraft()).parameters), [], 'The draft is saved without them')
    checks.push(`${locale}: older saved drafts drop the scanning switches and keep their paper settings`)
    await paperSize.selectOption('fit')
    await review.waitFor({ state: 'visible' })
    const fitted = await quote()
    assert.equal(fitted.paper_size, 'fit')
    assert.equal(fitted.margin, 24, 'Selecting Fit preserves an explicit custom margin')
    assert.equal(fitted.orientation, 'landscape', 'Selecting Fit preserves an explicit orientation')
    checks.push(`${locale}: selecting Fit preserves explicit custom margins and orientation`)

    for (const [width, theme] of [[1440, 'light'], [390, 'light'], [390, 'dark']]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      assert.equal(overflow, false, `${locale} ${width}px does not overflow`)
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      assert.deepEqual(
        accessibility.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.map((node) => node.target),
        })),
        [],
        `${locale} ${width}px ${theme} accessibility`,
      )
      await page.screenshot({ path: path.join(output, `${locale}-${width}-${theme}.png`), fullPage: true })
      checks.push(`${locale} ${width}px ${theme}: responsive and accessible`)
    }

    await page.goto(`${origin}/${locale}/app/tools/pdf.compress`)
    await page.locator('input[type="file"]').waitFor()
    assert.equal(await page.getByRole('switch').count(), 0)
    await page.locator('input[type="file"]').setInputFiles('tests/fixtures/research-notes.pdf')
    await page.waitForFunction(
      () =>
        JSON.parse(sessionStorage.getItem('pdf-master-draft') || 'null')?.tool === 'pdf.compress' &&
        JSON.parse(sessionStorage.getItem('pdf-master-draft') || 'null')?.files?.length === 1,
    )
    const otherTool = await quote()
    assert.deepEqual(legacyKeys(otherTool), [])
    checks.push(`${locale}: scanning parameters are absent from other tools`)
    await context.close()
  }
  assert.deepEqual(errors, [], 'No browser errors')
  assert.deepEqual(unexpected, [], 'All API requests use the fixture')
  assert.deepEqual(external, [], 'No external request')
  await fs.writeFile(
    path.join(output, 'report.json'),
    JSON.stringify({ passed: true, checks, errors, unexpected, external }, null, 2),
  )
  console.log(
    `Pass: ${checks.length} checks; no switches, fit hint, draft restoration and responsive accessibility in EN/UZ/RU`,
  )
} finally {
  await browser.close()
}
