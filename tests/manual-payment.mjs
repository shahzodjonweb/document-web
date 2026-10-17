import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// Paying by card transfer, against a mocked API: prices on the plan cards, the
// choice of method, the card and the code, the receipt, and waiting for review.
const origin = process.env.PAYMENT_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use the local web server')
const output = path.resolve(process.env.PAYMENT_ARTIFACT_DIR || '../studio-review/manual-payment')
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
// Limits as the plan seed sets them; null is unlimited. Only the three weekly
// ones differ by plan: every other limit is the same on all of them.
const limits = (price, documents, files, edits) => ({
  weekly_ai_documents: documents, weekly_file_jobs: files, edits_per_file: edits, max_file_mib: 200,
  max_pages_per_job: 1000, batch_files: 25, max_generated_pdf_pages: 35, max_generated_slides: 60,
  max_deck_images: 12, saved_workflows: 20, price_uzs: price,
})
// Plus is on discount for two more weeks: 15 000 instead of 20 000, as the
// server reports it (the last day as a Tashkent date, the percent rounded down).
const until = new Date(Date.now() + 14 * 86400000)
const untilDay = [until.getFullYear(), until.getMonth() + 1, until.getDate()].map((n) => String(n).padStart(2, '0')).join('-')
const discount = { price: 15000, regular: 20000, percent: 25, until: untilDay }
// The last day as each language writes it, spelt as the bot spells it, with
// the year only when it is not the current Tashkent (UTC+5) year.
const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
}
const [untilYear, untilMonth, untilDate] = untilDay.split('-').map(Number)
const dated = untilYear !== new Date(Date.now() + 5 * 3600000).getUTCFullYear()
const untilLabel = {
  en: `until ${untilDate} ${MONTHS.en[untilMonth - 1]}${dated ? ` ${untilYear}` : ''}`,
  uz: `${dated ? `${untilYear}-yil ` : ''}${untilDate}-${MONTHS.uz[untilMonth - 1]}gacha`,
  ru: `до ${untilDate} ${MONTHS.ru[untilMonth - 1]}${dated ? ` ${untilYear}` : ''}`,
}
const perThirtyDays = { en: 'per 30 days', uz: '30 kun uchun', ru: 'за 30 дней' }
const regularPrice = { en: 'Regular price', uz: 'Odatdagi narx', ru: 'Обычная цена' }
const plans = [
  { id: 'free', name: 'Free', price_uzs: null, discount: null, limits: limits(null, 5, 15, 3) },
  { id: 'plus', name: 'Plus', price_uzs: 20000, discount, limits: limits(20000, 20, null, 10) },
  { id: 'premium', name: 'Premium', price_uzs: 60000, discount: null, limits: limits(60000, null, null, null) },
]
// What /plans serves; swapped for an older platform's shape below.
let served = plans
let payment = null
const options = () => ({
  enabled: true, currency: 'UZS', period_days: 30, automatic: { available: false },
  plans: [
    { plan: 'plus', price: 15000, regular_price: 20000, discount },
    { plan: 'premium', price: 60000, regular_price: 60000, discount: null },
  ],
  payment,
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
  if (endpoint === '/plans') return json({ plans: served, currency: 'UZS', period_seconds: 2592000, draft: true })
  if (endpoint === '/usage')
    return json({ plan: 'free', week: { starts_at: '2026-10-11T19:00:00Z', resets_at: '2026-10-18T19:00:00Z', time_zone: 'Asia/Tashkent' },
      ai_documents: { limit: 5, used: 0, remaining: 5 }, file_jobs: { limit: 15, used: 0, remaining: 15 }, edits_per_file: 3,
      resets_at: '2026-10-18T19:00:00Z' })
  // The old checkout endpoints are not mocked on purpose: a call to one is unexpected.
  if (endpoint === '/billing/manual' && method === 'GET') return json(options())
  if (endpoint === '/billing/manual' && method === 'POST') {
    const { plan } = request.postDataJSON()
    payment = { id: '00000000-0000-4000-8000-000000000101', reference: 'PM-7K3QX', plan, amount: plan === 'plus' ? 15000 : 60000,
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
  if (endpoint === '/studio/config') return json({ provider: { mode: 'openai', configured: true }, features: [], default_pages: 10 })
  if (endpoint === '/jobs') return json({ results: [], count: 0 })
  if (endpoint === '/referrals') return json({ code: 'x', url: null, rewards_count: 0, pending_count: 0, monthly_cap: 5, expires_in_days: 7, qualification: '', sandbox: false })
  unexpected.push(`${method} ${endpoint}`)
  return json({ error: { code: 'not_found', message: 'not found' } }, 404)
})

async function audit(label) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}/${width}/${theme}: overflow`)
      const result = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      assert.deepEqual(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), [], `${label}/${width}/${theme}: accessibility`)
    }
    await page.screenshot({ path: path.join(output, `${label}-${width}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(() => (document.documentElement.dataset.theme = 'light'))
}

const checks = []
try {
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pay-premium').waitFor()
  const cards = await page.locator('.plan-card').allInnerTexts()
  assert.ok(cards[1].includes('20 000') && cards[1].includes("so'm") && cards[2].includes('60 000'), 'prices in so\'m on the cards')
  assert.match(await page.getByTestId('pay-premium').innerText(), /Pay 60 000 so'm/)
  // Plus on discount: the regular price struck through, today's price, the
  // percentage and the last day; the button asks for today's price.
  assert.ok(cards[1].includes('15 000') && cards[1].includes('−25%') && cards[1].includes('until'), 'the Plus card shows the discount')
  assert.match(await page.getByTestId('pay-plus').innerText(), /Pay 15 000 so'm/)
  assert.equal(await page.getByTestId('regular-plus').evaluate((node) => getComputedStyle(node).textDecorationLine), 'line-through')
  assert.equal(await page.getByTestId('discount-premium').count(), 0, 'Premium is at its regular price')
  // The last day shares the "per 30 days" line after a dot; it never starts a line with one.
  assert.ok(cards[1].includes(`per 30 days · ${untilLabel.en}`), `one "per 30 days · until" line: ${JSON.stringify(cards[1])}`)
  // Screen readers do not read strikethrough, so the struck price is named wherever it appears.
  assert.match(await page.getByTestId('regular-plus').innerText(), /^Regular price\s+20 000 so'm$/)
  assert.match(await page.getByTestId('discount-banner').innerText(),
    new RegExp(`Plus on discount:\\s+Regular price\\s+20 000 so'm\\s+15 000 so'm\\s+−25%\\s+· ${untilLabel.en}`))
  assert.ok(!cards.join(' ').match(/−0%|NaN/), 'nothing half-rendered')
  const features = (index) => page.locator('.plan-card').nth(index).locator('.plan-features li').allInnerTexts()
  const [free, plus, premium] = [await features(0), await features(1), await features(2)]
  // The weekly limits and Premium's channels are the whole list: size, pages,
  // slides and photos are the same on every plan, so no card shows them.
  assert.deepEqual(free, ['5 AI documents a week', '15 file tasks a week', '3 AI edits per file'])
  assert.deepEqual(plus, ['20 AI documents a week', 'Unlimited file tasks', '10 AI edits per file'])
  assert.deepEqual(premium,
    ['Unlimited AI documents', 'Unlimited file tasks', 'Unlimited AI edits', 'No channel subscription needed'])
  assert.ok(!cards.join(' ').match(/MB|per task|per AI|photos/), 'no per-plan size, page or photo lines')
  assert.ok(!free.concat(plus).some((row) => row.includes('channel')), 'only Premium skips the channels')
  assert.ok(!cards.join(' ').match(/credit|a day/i), 'no credits or daily caps left on the cards')
  // The subtitles speak of weekly volume, never of more tools or bigger files.
  assert.deepEqual(await page.locator('.plan-card .plan-card-body').allInnerTexts(),
    ['Every tool, with a weekly allowance', 'More each week for regular work', 'For people who work with lots of documents'])
  assert.deepEqual(await page.getByTestId('current-plan').locator('.plan-meter-label').allInnerTexts(),
    ['AI documents this week', 'File tasks this week', 'AI edits per file'])
  assert.match(await page.getByTestId('week-reset').innerText(), /^Limits renew .+ · \S+/)
  checks.push("Plan cards show so'm prices, only the weekly limits, volume-only subtitles, Premium without channels, and a Pay button")
  checks.push('Plus on discount: regular price struck through, 15 000 so\'m, −25%, the last day, a banner, and Pay 15 000')

  // Paying for the discounted plan: the chooser and the card screen both ask
  // for the discounted amount and name the regular price it replaces.
  const panel = page.getByTestId('manual-payment')
  await page.getByTestId('pay-plus').click()
  await panel.waitFor()
  assert.match(await panel.innerText(), /Plus · 15 000 so'm/)
  assert.match(await panel.getByTestId('manual-discount').innerText(),
    new RegExp(`^Regular price\\s+20 000 so'm\\s+−25%\\s+${untilLabel.en}$`))
  await page.getByTestId('manual-start').click()
  await page.getByTestId('manual-card-number').waitFor()
  const plusText = await panel.innerText()
  assert.ok(plusText.includes("Send exactly 15 000 so'm") && plusText.includes("20 000 so'm") && plusText.includes('−25%'))
  assert.match(await panel.getByTestId('manual-discount').innerText(),
    new RegExp(`^Regular price\\s+20 000 so'm\\s+−25%\\s+${untilLabel.en}$`), 'the open payment names the struck price too')
  await audit('card-discount')
  await panel.getByRole('button', { name: 'Cancel this payment' }).click()
  await panel.waitFor({ state: 'detached' })
  checks.push('Paying for Plus asks for exactly 15 000 so\'m and shows the 20 000 it replaces')

  await page.getByTestId('pay-premium').click()
  await panel.waitFor()
  assert.equal(await panel.getByTestId('manual-discount').count(), 0, 'Premium is paid at its regular price')
  assert.equal(await panel.getByRole('radio', { name: /Automatic payment/ }).isDisabled(), true, 'automatic is not offered yet')
  assert.equal(await panel.getByRole('radio', { name: /Card transfer/ }).isChecked(), true)
  await audit('method')
  checks.push('Choosing a method: card transfer, with automatic shown as coming soon')

  await page.getByTestId('manual-start').click()
  await page.getByTestId('manual-card-number').waitFor()
  assert.equal(await page.getByTestId('manual-card-number').innerText(), '8600 1234 5678 9012')
  const text = await panel.innerText()
  assert.ok(text.includes('PM-7K3QX') && text.includes("60 000 so'm") && text.includes('Shakhzod Uralov'))
  assert.equal(await page.getByTestId('manual-send').isDisabled(), true, 'nothing to send until a receipt is chosen')
  await audit('card')
  checks.push('The card, the exact amount, the holder and the payment code are shown')

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await page.getByTestId('manual-receipt').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: png })
  await page.getByLabel('Note (optional)').fill('card 4421')
  await page.getByTestId('manual-send').click()
  await page.getByTestId('manual-waiting').waitFor()
  const sent = requests.find((r) => r.endpoint.endsWith('/receipt'))
  assert.ok(sent.type.startsWith('multipart/form-data'), 'the receipt goes as a file upload')
  await audit('waiting')
  checks.push('Sending the receipt shows the payment waiting for review')

  // Web ships before the platform: an older platform prices a plan only under
  // its limits and sends no discount. The cards still show the prices, plainly.
  served = plans.map(({ price_uzs, discount, ...plan }) => plan)
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pay-premium').waitFor()
  assert.match(await page.getByTestId('pay-plus').innerText(), /Pay 20 000 so'm/)
  assert.equal(await page.getByTestId('discount-banner').count(), 0, 'no banner without a discount')
  assert.equal(await page.locator('.discount-badge').count(), 0)
  served = plans
  checks.push('An older platform without top-level prices or discounts still prices the cards')

  signedIn = false
  await page.goto(`${origin}/en/pricing`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: 'Sign in to pay' }).first().waitFor()
  assert.equal(await page.getByTestId('manual-payment').count(), 0, 'no card shown to someone signed out')
  assert.match(await page.getByTestId('discount-banner').innerText(), /Plus on discount/)
  await audit('pricing')
  checks.push('Signed out: prices, the discount banner, and a sign-in link instead of the card')

  // Uzbek and Russian write the last day as the bot does: "31-oktabrgacha"
  // (the affix joined to the day), "до 31 октября"; the struck price is named
  // in each language.
  for (const locale of ['uz', 'ru']) {
    await page.goto(`${origin}/${locale}/pricing`, { waitUntil: 'domcontentloaded' })
    await page.locator('.plan-card').nth(2).waitFor()
    const card = await page.locator('.plan-card').nth(1).innerText()
    assert.ok(card.includes(`${perThirtyDays[locale]} · ${untilLabel[locale]}`), `${locale} card: ${JSON.stringify(card)}`)
    assert.match(await page.getByTestId('regular-plus').innerText(), new RegExp(`^${regularPrice[locale]}\\s+20 000 so'm$`))
    assert.match(await page.getByTestId('discount-banner').innerText(),
      new RegExp(`${regularPrice[locale]}\\s+20 000 so'm\\s+15 000 so'm\\s+−25%\\s+· ${untilLabel[locale]}`))
  }
  checks.push('Uzbek and Russian write the last day as the bot does (31-oktabrgacha, до 31 октября) and name the struck price')

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
