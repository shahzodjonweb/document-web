import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// Offline API fixtures: no customer changes, provider requests or paid generation.
const origin = process.env.STUDIO_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use the local web server')
const output = path.resolve(process.env.STUDIO_ARTIFACT_DIR || '../studio-review/image-forms')
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
const page = await context.newPage()
page.setDefaultTimeout(10000)
page.setDefaultNavigationTimeout(15000)
const requests = [],
  errors = [],
  unexpected = [],
  external = [],
  checks = []
const drafts = new Map(),
  quotes = new Map(),
  jobs = new Map(),
  acceptedKeys = new Map()
let sequence = 0,
  imageConfigured = true,
  imageEligible = true,
  affordable = true,
  failJobOnce = false,
  expireJobOnce = false
const id = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
const account = {
  id: '00000000-0000-4000-8000-999999999999',
  display_name: 'Fixture Reader',
  locale: 'en',
  time_zone: 'UTC',
  mode: 'general',
  plan: 'free',
  preferences: {},
  login_methods: { email: true },
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
  const request = route.request(),
    method = request.method()
  const endpoint = new URL(request.url()).pathname.replace('/api/v1', '')
  const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null
  requests.push({ path: endpoint, method, body, key: request.headers()['idempotency-key'] })
  const json = (value, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
  const failure = (code, status = 409) => json({ error: { code, message: code } }, status)
  if (endpoint === '/auth/session')
    return json({ user: account, development_login_enabled: false, csrf_token: 'fixture-csrf' })
  if (endpoint === '/auth/providers')
    return json({
      email: { enabled: true, configured: true },
      google: { enabled: false },
      telegram: { enabled: false },
      antibot: { enabled: false },
    })
  if (endpoint === '/me') return json(account)
  if (endpoint === '/catalog') return json({ features: [], draft: false })
  if (endpoint === '/plans') return json({ plans: [], checkout_enabled: false })
  if (endpoint === '/usage') return json({ plan: 'free', remaining: { ai_credits: 100, file_tasks: 100 } })
  if (endpoint === '/studio/config')
    return json({
      provider: { mode: 'openai', configured: true, image_configured: imageConfigured },
      features: [
        {
          id: 'ai.images',
          name: 'Illustrations',
          surface: 'generate',
          eligible: imageEligible,
          parameter_schema: { output_format: { enum: ['png'] } },
          locales: ['en', 'uz', 'ru'],
        },
      ],
      limits: { sections: 2, slides: 4, questions: 5 },
      templates: [],
    })
  if (endpoint === '/generation/drafts' && method === 'POST') {
    assert.equal(imageConfigured && imageEligible, true, 'Unavailable image tools must not create drafts')
    const draft = { id: id(), version: 1, ...body }
    drafts.set(draft.id, draft)
    return json(draft, 201)
  }
  const quoteRoute = endpoint.match(/^\/generation\/drafts\/([^/]+)\/quote$/)
  if (quoteRoute) {
    const draft = drafts.get(quoteRoute[1])
    assert.equal(body.version, draft.version)
    const quote = {
      id: id(),
      feature_id: 'ai.images',
      expires_at: new Date(Date.now() + 300000).toISOString(),
      affordable,
      meters: [{ meter: 'ai_credits', amount: 4 }],
      parameters: {
        generation_draft_id: draft.id,
        generation_draft_version: draft.version,
        generation_stage: 'document',
      },
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
    const previous = acceptedKeys.get(request.headers()['idempotency-key'])
    if (previous) return json(previous)
    const quote = quotes.get(body.quote_id)
    assert.ok(quote && quote.affordable, 'Only an affordable reviewed quote can generate')
    const job = {
      id: id(),
      feature_id: 'ai.images',
      status: 'succeeded',
      stage: 'succeeded',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 300000).toISOString(),
      parameters: quote.parameters,
      artifacts: [],
      warnings: [],
      settled_meters: {},
    }
    jobs.set(job.id, job)
    acceptedKeys.set(request.headers()['idempotency-key'], job)
    if (failJobOnce) {
      failJobOnce = false
      return failure('fixture_network_interruption', 503)
    }
    return json(job, 201)
  }
  if (endpoint.startsWith('/jobs/')) return json(jobs.get(endpoint.split('/')[2]) || {})
  unexpected.push({ path: endpoint, method })
  return failure('unexpected_fixture_request', 404)
})
const calls = (endpoint) => requests.filter((item) => item.path === endpoint && item.method === 'POST')
const primary = () => page.locator('.studio-form textarea')
const more = () => page.locator('.image-more-options')
const review = () => page.getByRole('button', { name: 'Review cost', exact: true })
const generate = () => page.getByRole('button', { name: /^(Generate image|Try again)$/ })
async function open(locale = 'en') {
  const configurationLoaded = page.waitForResponse((response) => response.url().endsWith('/studio/config'))
  await page.goto(`${origin}/${locale}/app/images`, { waitUntil: 'domcontentloaded' })
  await primary().waitFor()
  await configurationLoaded
}
async function makeQuote(description) {
  await primary().fill(description)
  const before = requests.length,
    beforeJobs = calls('/jobs').length
  await review().click()
  await generate().waitFor()
  const writes = requests.slice(before).filter((item) => item.method !== 'GET')
  assert.deepEqual(
    writes.map((item) =>
      item.path === '/generation/drafts' ? 'draft' : item.path.endsWith('/quote') ? 'quote' : item.path,
    ),
    ['draft', 'quote'],
  )
  assert.equal(calls('/jobs').length, beforeJobs, 'Review does not run generation')
  return calls('/generation/drafts').at(-1).body
}
async function confirm() {
  const before = calls('/jobs').length
  await generate().click()
  await page.waitForURL('**/app/jobs/*')
  await page.locator('.job-detail').waitFor()
  assert.equal(calls('/jobs').length, before + 1)
  assert.ok(calls('/jobs').at(-1).key)
}
try {
  await open()
  assert.equal(await review().isDisabled(), true)
  assert.equal(await more().getAttribute('open'), null)
  assert.equal(await page.locator('.studio-form input:visible').count(), 0)
  assert.equal(await primary().getAttribute('maxlength'), '4000')
  const description = `A friendly fox in a sunlit garden. ${'Soft blue accents. '.repeat(10)}\nNo lettering.`
  const simple = await makeQuote(description)
  assert.equal(simple.title, Array.from(description.split('\n')[0]).slice(0, 160).join(''))
  assert.equal(simple.prompt, description)
  assert.equal(simple.output_format, 'png')
  assert.equal(simple.options.length, 1)
  await confirm()
  checks.push('A description derives a title, reviews cost first, and generates only after confirmation')

  await open()
  await primary().fill('A botanical sketch of a tomato plant.')
  await more().locator('summary').click()
  await page.getByLabel('Title (optional)', { exact: false }).fill('Tomato study')
  const override = await makeQuote('A botanical sketch of a tomato plant.')
  assert.equal(override.title, 'Tomato study')
  await primary().fill('A botanical sketch with the roots visible.')
  assert.equal(await generate().count(), 0, 'Editing the description invalidates its quote')
  assert.equal(await review().isEnabled(), true)
  await primary().fill('x'.repeat(4001))
  assert.equal((await primary().inputValue()).length, 4000)
  checks.push(
    'Optional title is retained, edits invalidate review, and the prompt is capped at 4,000 characters',
  )

  await open()
  await makeQuote('A simple icon of a green leaf.')
  failJobOnce = true
  const beforeJobs = jobs.size
  await generate().click()
  await page.locator('.error-banner').waitFor()
  const interrupted = calls('/jobs').at(-1)
  assert.equal(await primary().isDisabled(), true, 'Uncertain submission preserves the original request')
  assert.equal(await page.getByRole('button', { name: 'Refresh estimate', exact: true }).isDisabled(), true)
  await confirm()
  const retried = calls('/jobs').at(-1)
  assert.equal(retried.key, interrupted.key)
  assert.equal(retried.body.quote_id, interrupted.body.quote_id)
  assert.equal(jobs.size, beforeJobs + 1)
  checks.push('Retrying interrupted confirmation keeps its quote and key and recovers one accepted job')

  await open()
  await makeQuote('A paper boat on a quiet lake.')
  expireJobOnce = true
  await generate().click()
  await page.locator('.error-banner').waitFor()
  const expired = calls('/jobs').at(-1),
    beforeRefresh = calls('/jobs').length
  await page.getByRole('button', { name: 'Refresh estimate', exact: true }).click()
  await generate().waitFor()
  assert.equal(calls('/jobs').length, beforeRefresh)
  await confirm()
  const refreshed = calls('/jobs').at(-1)
  assert.notEqual(refreshed.key, expired.key)
  assert.notEqual(refreshed.body.quote_id, expired.body.quote_id)
  checks.push('Expired estimates refresh without generation and receive a new quote and submission key')

  affordable = false
  await open()
  await makeQuote('A watercolor tree.')
  assert.equal(await generate().isDisabled(), true)
  affordable = true
  checks.push('An unaffordable quote cannot generate')

  imageConfigured = false
  await open()
  await primary().fill('An unavailable provider fixture.')
  assert.equal(await review().isDisabled(), true)
  assert.ok((await page.locator('.provider-banner').textContent()).trim())
  imageConfigured = true
  checks.push('An unavailable image provider blocks review')

  imageEligible = false
  await open()
  await primary().fill('A plan-excluded image fixture.')
  assert.equal(await review().isDisabled(), true)
  imageEligible = true
  checks.push('A plan-excluded image tool blocks review')

  for (const locale of ['en', 'uz', 'ru']) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await open(locale)
      assert.equal(await more().getAttribute('open'), null)
      assert.equal(await page.locator('html').getAttribute('lang'), locale)
      assert.ok((await primary().getAttribute('placeholder')).length > 20)
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value
        }, theme)
        await page.evaluate(
          () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        )
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          `${locale}/${width}/${theme}: overflow`,
        )
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
          `${locale}/${width}/${theme}: accessibility`,
        )
      }
      await page.screenshot({ path: path.join(output, `image-${locale}-${width}.png`), fullPage: true })
    }
  }
  checks.push('EN/UZ/RU desktop/mobile in light/dark has no overflow or WCAG A/AA findings')
  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [])
  assert.deepEqual(external, [])
  const result = {
    status: 'passed',
    at: new Date().toISOString(),
    checks,
    functionalGroups: checks.length - 1,
    visualChecks: 12,
    errors,
    jobSubmissionRequests: calls('/jobs').length,
    acceptedJobs: jobs.size,
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
