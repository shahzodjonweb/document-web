import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// The Telegram channels a free account joins before using a service: the
// dashboard banner, the dialog, "I've joined", and a refused task opening it.
const origin = process.env.CHANNEL_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use the local web server')
const output = path.resolve(process.env.CHANNEL_ARTIFACT_DIR || '../studio-review/channel-gate')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
const page = await context.newPage()
page.setDefaultTimeout(10000)
const errors = []
const unexpected = []
const requests = []
page.on('pageerror', (error) => errors.push(error.message))

const CARD = '8600123456789012'
let signedIn = true
const account = {
  id: '00000000-0000-4000-8000-999999999999', display_name: 'Card payer', locale: 'en', time_zone: 'UTC',
  mode: 'general', plan: 'free', preferences: {}, login_methods: { email: false, google: false, telegram: true },
}
const limits = (credits, price) => ({
  file_tasks: 300, file_page_units: 3000, max_file_mib: 25, max_pages_per_job: 100, max_generated_pdf_pages: 7,
  max_generated_slides: 12, max_deck_images: 4, ai_credits: credits, price_uzs: price,
})
const plans = [
  { id: 'free', name: 'Free', price_xtr: 0, limits: limits(3150, null) },
  { id: 'plus', name: 'Plus', price_xtr: null, limits: limits(10500, 49000) },
  { id: 'premium', name: 'Premium', price_xtr: null, limits: limits(30000, 99000) },
]
let payment = null
let joinedAll = false
let checks_made = 0
let refuseTasks = false
const channelState = () => ({ required: true, joined: joinedAll, channels: [
  { title: 'PDF Master News', url: 'https://t.me/pdfmaster_news', joined: joinedAll },
  { title: 'PDF Tips', url: 'https://t.me/pdfmaster_tips', joined: true }] })
const options = () => ({
  enabled: true, currency: 'UZS', period_days: 30, automatic: { available: false },
  plans: [{ plan: 'plus', price: 49000 }, { plan: 'premium', price: 99000 }], payment,
})

await context.route('**/*', (route) => {
  const url = new URL(route.request().url())
  if (url.origin === origin && url.pathname.startsWith('/api/')) {
    unexpected.push(url.pathname)
    return route.abort('blockedbyclient')
  }
  if (url.origin === origin || url.protocol === 'data:') return route.continue()
  if (url.hostname === 'telegram.org') return route.fulfill({ contentType: 'application/javascript', body: '' })
  return route.abort('blockedbyclient')
})
await context.route(`${origin}/api/v1/**`, async (route) => {
  const request = route.request()
  const endpoint = new URL(request.url()).pathname.replace('/api/v1', '')
  const method = request.method()
  requests.push({ endpoint, method, type: request.headers()['content-type'] || '' })
  const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
  if (endpoint === '/auth/session')
    return json({ user: signedIn ? account : null, authenticated: signedIn, development_login_enabled: false, csrf_token: 'fixture' })
  if (endpoint === '/auth/providers')
    return json({ email: { enabled: false, configured: false }, google: { enabled: false, configured: false },
      telegram: { enabled: true, configured: true }, antibot: { enabled: false, configured: false, site_key: '', binding: '' } })
  if (endpoint === '/me') return json(account)
  if (endpoint === '/catalog') return json({ features: [], draft: false })
  if (endpoint === '/plans') return json({ plans, checkout_enabled: false, currency: 'XTR', draft: true })
  if (endpoint === '/usage')
    return json({ plan: 'free', meters: { file_tasks: { limit: 300, remaining: 300 }, file_page_units: { limit: 3000, remaining: 3000 },
      ai_credits: { limit: 3150, remaining: 3150 } }, daily: { limit: 20, remaining: 20 }, resets_at: '2026-11-01T00:00:00Z' })
  if (endpoint === '/billing/offers')
    return json({ offers: [], sandbox: false, checkout_enabled: false, currency: 'XTR', billing_mode: 'disabled' })
  if (endpoint === '/billing/subscription') return json({ plan: 'free', subscription: null, sandbox: false, checkout_enabled: false })
  if (endpoint === '/billing/transactions' || endpoint === '/billing/invoices') return json({ results: [] })
  if (endpoint === '/channels') return json(channelState())
  if (endpoint === '/channels/check') {
    checks_made += 1
    if (checks_made > 1) joinedAll = true
    return json(channelState())
  }
  if (endpoint === '/billing/manual' && method === 'POST' && refuseTasks)
    return json({ error: { code: 'channels_required', message: 'PDF Master is free for members of our Telegram community.',
      message_params: { channels: channelState().channels } } }, 403)
  if (endpoint === '/billing/manual' && method === 'GET') return json(options())
  if (endpoint === '/billing/manual' && method === 'POST') {
    const { plan } = request.postDataJSON()
    payment = { id: '00000000-0000-4000-8000-000000000101', reference: 'PM-7K3QX', plan, amount: plan === 'plus' ? 49000 : 99000,
      currency: 'UZS', status: 'awaiting', channel: 'web', card: { number: CARD, last4: '9012', holder: 'Shakhzod Uralov', label: 'Uzcard' },
      receipt_received: false, payer_note: '', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 172800000).toISOString(),
      submitted_at: null, decided_at: null, rejection_reason: null, starts_at: null, active_until: null }
    return json(payment, 201)
  }
  const receipt = endpoint.match(/^\/billing\/manual\/[^/]+\/receipt$/)
  if (receipt && method === 'POST') {
    payment = { ...payment, status: 'submitted', receipt_received: true, submitted_at: new Date().toISOString() }
    return json(payment)
  }
  if (/^\/billing\/manual\/[^/]+$/.test(endpoint) && method === 'DELETE') {
    payment = { ...payment, status: 'cancelled' }
    return json(payment)
  }
  if (endpoint === '/studio/config') return json({ provider: { mode: 'openai', configured: true }, features: [], default_pages: 5 })
  if (endpoint === '/jobs') return json({ results: [], count: 0 })
  if (endpoint === '/referrals') return json({ code: 'x', url: null, rewards_count: 0, pending_count: 0, awarded_credits: 0, monthly_cap: 5, expires_in_days: 7, qualification: '', sandbox: false })
  unexpected.push(`${method} ${endpoint}`)
  return json({ error: { code: 'not_found', message: 'not found' } }, 404)
})

async function audit(label) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}/${width}/${theme}: overflow`)
      const result = await new AxeBuilder({ page }).include(label === 'dialog' ? '[data-testid="channel-gate"]' : 'main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      assert.deepEqual(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), [], `${label}/${width}/${theme}: accessibility`)
    }
    await page.screenshot({ path: path.join(output, `${label}-${width}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(() => (document.documentElement.dataset.theme = 'light'))
}

const checks = []
try {
  await page.goto(`${origin}/en/app`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('channel-banner').waitFor()
  await page.getByTestId('channel-banner').getByRole('button').click()
  const dialog = page.getByTestId('channel-gate')
  await dialog.waitFor()
  const links = await dialog.locator('a[href^="https://t.me/"]').evaluateAll((nodes) => nodes.map((n) => [n.textContent.trim(), n.target, n.rel]))
  assert.deepEqual(links, [['PDF Master News', '_blank', 'noopener'], ['PDF Tips', '_blank', 'noopener']])
  await audit('dialog')
  checks.push('The dashboard says which channels to join, and the dialog links to each in a new tab')

  await page.getByTestId('channels-joined').click()
  await dialog.getByRole('alert').waitFor()
  assert.match(await dialog.getByRole('alert').innerText(), /PDF Master News/)
  await page.getByTestId('channels-joined').click()
  await dialog.getByText('Thanks for joining!').waitFor()
  await dialog.getByRole('button', { name: 'Continue' }).click()
  assert.equal(await dialog.evaluate((node) => node.open), false)
  await page.getByTestId('channel-banner').waitFor({ state: 'detached' })
  checks.push("\"I've joined\" says what is still missing, then welcomes and clears the banner")

  joinedAll = false
  refuseTasks = true
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pay-plus').click()
  await page.getByTestId('manual-start').click()
  await page.getByTestId('channel-gate').waitFor({ state: 'visible' })
  checks.push('Any task the server refuses for channels opens the same dialog')

  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [], 'every API call is covered by the fixture')
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2))
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
  console.error(JSON.stringify({ error: error.message, checks, errors, unexpected }, null, 2))
  throw error
} finally {
  await browser.close()
}
