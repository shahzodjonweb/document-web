import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// Paying automatically through inPAY, against a mocked API: the choice of
// method, the hand-over to inPAY's page (never loaded: a stub answers for it),
// waiting for the payment on the billing page, and the page inPAY sends the
// browser back to, signed out. tests/manual-payment.mjs holds today's platform,
// which has no automatic payment, to the card-transfer experience as it was.
const origin = process.env.PAYMENT_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use the local web server')
const output = path.resolve(process.env.PAYMENT_ARTIFACT_DIR || '../studio-review/automatic-payment')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const errors = []
const unexpected = []
const requests = []
// Every address outside this site that a page asked for, inPAY's stub included.
const outside = []

const iso = (ahead = 0) => new Date(Date.now() + ahead).toISOString()
const INPAY = 'https://pay.inpay.uz'
const BOT = 'https://t.me/docmaster_fixture_bot'
const RECEIPT = 'https://ofd.soliq.uz/check?t=fixture&r=1'
const ID = {
  created: '10000000-0000-4000-8000-000000000001',
  pending: '10000000-0000-4000-8000-000000000002',
  failed: '10000000-0000-4000-8000-000000000003',
  bot: '10000000-0000-4000-8000-000000000004',
  test: '10000000-0000-4000-8000-000000000005',
  unknown: '10000000-0000-4000-8000-00000000ffff',
}
// Cards saved through inPAY Avto PAY: on the website's billing page, or in the bot.
const CARD = {
  web: '20000000-0000-4000-8000-0000000000a1',
  saved: '20000000-0000-4000-8000-0000000000a2',
  failed: '20000000-0000-4000-8000-0000000000a3',
  closed: '20000000-0000-4000-8000-0000000000a4',
  later: '20000000-0000-4000-8000-0000000000a5',
  bot: '00000000-0000-4000-8000-0000000000c1',
  unknown: '20000000-0000-4000-8000-00000000ffff',
}
const activeUntil = iso(30 * 86400000)
const checkout = (id, values = {}) => ({
  id, plan: 'plus', amount: 15000, currency: 'UZS', status: 'pending', test: false, channel: 'web',
  checkout_url: `${INPAY}/checkout/${id}`, bot_url: null, created_at: iso(), expires_at: iso(30 * 60000),
  paid_at: null, starts_at: null, active_until: null, receipt_url: null, ...values,
})
const paid = (value) => ({ ...value, status: 'paid', checkout_url: null, paid_at: iso(), starts_at: iso(),
  active_until: value.test ? null : activeUntil, receipt_url: value.test ? null : RECEIPT })
const ended = (value, status) => ({ ...value, status, checkout_url: null })

// What the mocked platform holds; each scenario sets it before it loads a page.
const account = {
  id: '00000000-0000-4000-8000-999999999999', display_name: 'Automatic payer', locale: 'en', time_zone: 'UTC',
  mode: 'general', plan: 'free', preferences: {}, login_methods: { email: false, google: false, telegram: true },
}
const state = {
  signedIn: true,
  miniApp: false,
  card: true,
  automatic: { available: true, provider: 'inpay' },
  // What `GET /billing/manual` names as the latest automatic payment.
  latest: null,
  // What `POST /billing/checkout` answers with.
  created: null,
  refuse: null,
  // Refusing with checkout_unavailable, the platform then offers card transfer in inPAY's place.
  fallback: false,
  checkouts: new Map(),
  reads: new Map(),
  // The saved card and its monthly renewal (`GET /billing/renewal`).
  renewal: null,
  // Cards being saved on inPAY's page, by id (`GET /billing/cards/{id}`), and how often they were read.
  cards: new Map(),
  cardReads: 0,
  // What `POST /billing/cards/{id}/charge` answers with, and a refusal for `POST /billing/cards`.
  chargeAnswer: null,
  cardRefuse: null,
}
const limits = (price, documents, files, edits) => ({
  weekly_ai_documents: documents, weekly_file_jobs: files, edits_per_file: edits, max_file_mib: 200,
  max_pages_per_job: 1000, batch_files: 25, max_generated_pdf_pages: 35, max_generated_slides: 60,
  max_deck_images: 12, saved_workflows: 20, price_uzs: price,
})
const until = new Date(Date.now() + 14 * 86400000)
const discount = { price: 15000, regular: 20000, percent: 25,
  until: [until.getFullYear(), until.getMonth() + 1, until.getDate()].map((n) => String(n).padStart(2, '0')).join('-') }
const plans = [
  { id: 'free', name: 'Free', price_uzs: null, discount: null, limits: limits(null, 5, 15, 3) },
  { id: 'plus', name: 'Plus', price_uzs: 20000, discount, limits: limits(20000, 20, null, 10) },
  { id: 'premium', name: 'Premium', price_uzs: 60000, discount: null, limits: limits(60000, null, null, null) },
]
// Telegram's own script, as far as the app reads it inside a Mini App.
const TELEGRAM = `window.Telegram={WebApp:{initData:'fixture',version:'8.0',platform:'android',isVersionAtLeast:()=>true,
  ready(){},expand(){},openLink(url){(window.__opened=window.__opened||[]).push(url)}}}`

async function open(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', ...options })
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin === origin && url.pathname.startsWith('/api/')) {
      unexpected.push(url.pathname)
      return route.abort('blockedbyclient')
    }
    if (url.origin === origin || url.protocol === 'data:') return route.continue()
    if (url.hostname === 'telegram.org')
      return route.fulfill({ contentType: 'application/javascript', body: state.miniApp ? TELEGRAM : '' })
    outside.push(url.href)
    // inPAY's page is never loaded: this stands where it would be.
    if (url.origin === INPAY) return route.fulfill({ contentType: 'text/html', body: '<title>inPAY stub</title><h1>inPAY stub</h1>' })
    return route.abort('blockedbyclient')
  })
  await context.route(`${origin}/api/v1/**`, async (route) => {
    const request = route.request()
    const endpoint = new URL(request.url()).pathname.replace('/api/v1', '')
    const method = request.method()
    requests.push({ endpoint, method, body: method === 'POST' ? request.postData() : null })
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    const refusal = (code, message, status) => json({ error: { code, message } }, status)
    if (endpoint === '/auth/session')
      return json({ user: state.signedIn ? account : null, authenticated: state.signedIn, development_login_enabled: false, csrf_token: 'fixture' })
    if (endpoint === '/auth/providers')
      return json({ email: { enabled: false, configured: false }, google: { enabled: false, configured: false },
        telegram: { enabled: true, configured: true }, antibot: { enabled: false, configured: false, site_key: '', binding: '' } })
    if (endpoint === '/catalog') return json({ features: [], draft: false })
    if (endpoint === '/plans')
      return json({ plans, currency: 'UZS', period_seconds: 2592000, draft: true,
        checkout: { automatic: state.automatic.available && !state.automatic.test, card: state.card } })
    if (endpoint === '/contacts')
      return json({ support: { username: '', url: '' }, ads: { username: '', url: '' }, bot: { username: '', url: '' },
        company: { name: '"ARCANIUM TECHNOLOGIES" MCHJ', tin: '313458514', address: 'Toshkent', phone: '', email: '' } })
    // Signed out, only the public answers above and one payment by its id are served.
    const one = endpoint.match(/^\/billing\/checkout\/([^/]+)$/)
    if (one && method === 'GET') {
      state.reads.set(one[1], (state.reads.get(one[1]) || 0) + 1)
      const found = state.checkouts.get(one[1])
      if (!found) return refusal('not_found', 'Not found.', 404)
      return json(state.signedIn ? found : { ...found, checkout_url: null })
    }
    if (!state.signedIn) {
      unexpected.push(`signed out: ${method} ${endpoint}`)
      return refusal('authentication_required', 'Sign in.', 401)
    }
    if (endpoint === '/me') return json(account)
    if (endpoint === '/usage')
      return json({ plan: account.plan, week: { starts_at: '2026-10-11T19:00:00Z', resets_at: '2026-10-18T19:00:00Z', time_zone: 'Asia/Tashkent' },
        ai_documents: { limit: 5, used: 0, remaining: 5 }, file_jobs: { limit: 15, used: 0, remaining: 15 }, edits_per_file: 3,
        resets_at: '2026-10-18T19:00:00Z' })
    if (endpoint === '/billing/manual' && method === 'GET')
      return json({
        enabled: state.card, currency: 'UZS', period_days: 30, automatic: state.automatic,
        plans: [
          { plan: 'plus', price: 15000, regular_price: 20000, discount },
          { plan: 'premium', price: 60000, regular_price: 60000, discount: null },
        ],
        payment: null, checkout: state.latest ? state.checkouts.get(state.latest) : null,
      })
    const none = { offered: false, card: null, renewal: null, can_turn_on: false }
    if (endpoint === '/billing/renewal' && method === 'GET') return json(state.renewal || none)
    if (endpoint === '/billing/renewal' && method === 'DELETE') {
      state.renewal = { ...state.renewal, can_turn_on: true, renewal: { ...state.renewal.renewal, status: 'off' } }
      return json(state.renewal)
    }
    if (endpoint === '/billing/renewal' && method === 'POST') {
      state.renewal = { ...state.renewal, can_turn_on: false, renewal: { ...state.renewal.renewal, status: 'on' } }
      return json(state.renewal)
    }
    if (endpoint === '/billing/cards' && method === 'POST') {
      if (state.cardRefuse) return refusal(...state.cardRefuse)
      const saving = { id: CARD.web, status: 'binding', plan: JSON.parse(request.postData()).plan, last4: '',
        bind_url: `${INPAY}/cards/bind/${CARD.web}`, charge: null }
      state.cards.set(saving.id, saving)
      return json(saving, 201)
    }
    const charging = endpoint.match(/^\/billing\/cards\/([^/]+)\/charge$/)
    if (charging && method === 'POST') {
      if (charging[1] !== state.renewal?.card?.id) return refusal('card_unavailable', 'This saved card can’t be used any more.', 409)
      const { plan, renew } = JSON.parse(request.postData())
      const amount = plan === 'plus' ? 15000 : 60000
      const answer = { ...state.chargeAnswer, plan, amount, renews_at: renew && state.chargeAnswer.status === 'paid' ? activeUntil : null }
      if (answer.renews_at)
        state.renewal = { ...state.renewal, can_turn_on: false, renewal: { status: 'on', plan, renews_at: activeUntil, amount, attempts: 0,
          next_try_at: null, stopped_reason: '', card_last4: answer.last4 } }
      return json(answer)
    }
    const card = endpoint.match(/^\/billing\/cards\/([^/]+)$/)
    if (card && method === 'GET') {
      state.cardReads += 1
      const found = state.cards.get(card[1])
      return found ? json(found) : refusal('not_found', 'Not found.', 404)
    }
    if (card && method === 'DELETE') {
      if (card[1] !== state.renewal?.card?.id) return refusal('not_found', 'Not found.', 404)
      state.renewal = { ...state.renewal, card: null, can_turn_on: false,
        renewal: { ...state.renewal.renewal, status: 'stopped', stopped_reason: 'card_removed' } }
      return json(state.renewal)
    }
    if (endpoint === '/billing/checkout' && method === 'POST') {
      if (state.refuse) {
        if (state.fallback) Object.assign(state, { card: true, automatic: { available: false } })
        return refusal(...state.refuse)
      }
      state.checkouts.set(state.created.id, state.created)
      state.latest = state.created.id
      return json(state.created, 201)
    }
    if (endpoint === '/studio/config') return json({ provider: { mode: 'openai', configured: true }, features: [], default_pages: 10 })
    if (endpoint === '/jobs') return json({ results: [], count: 0 })
    unexpected.push(`${method} ${endpoint}`)
    return refusal('not_found', 'not found', 404)
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', (error) => errors.push(error.message))
  return { context, page }
}

// `part` is the piece under review: a full-page picture lays the fixed bars over
// the middle of a long page, so the piece is also pictured alone, in each theme.
async function audit(page, label, part) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}/${width}/${theme}: overflow`)
      const result = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      assert.deepEqual(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), [], `${label}/${width}/${theme}: accessibility`)
      if (part) {
        await part.evaluate((node) => node.scrollIntoView({ block: 'center' }))
        await part.screenshot({ path: path.join(output, `${label}-${width}-${theme}-part.png`) })
      }
    }
    await page.screenshot({ path: path.join(output, `${label}-${width}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(() => (document.documentElement.dataset.theme = 'light'))
}
const reset = (values = {}) =>
  Object.assign(state, { signedIn: true, miniApp: false, card: true, automatic: { available: true, provider: 'inpay' },
    latest: null, created: null, refuse: null, fallback: false, renewal: null, cards: new Map(), chargeAnswer: null,
    cardRefuse: null }, values)
const charges = () => requests.filter((r) => /^\/billing\/cards\/[^/]+\/charge$/.test(r.endpoint)).map((r) => JSON.parse(r.body))
// What the platform says once a saved card was charged.
const chargeOf = (values = {}) => ({ id: '30000000-0000-4000-8000-000000000001', status: 'paid', plan: 'plus', amount: 15000,
  currency: 'UZS', last4: '1234', reason: null, active_until: activeUntil, renews_at: null, ...values })
const savedHere = { id: CARD.saved, masked: '860038******1234', last4: '1234', expiry: '09/29', consent_max: null, here: true }
const posted = () => requests.filter((r) => r.endpoint === '/billing/checkout' && r.method === 'POST')
const reads = (id) => state.reads.get(id) || 0

const checks = []
let page
try {
  // ── Choosing automatic payment, and the hand-over to inPAY's page ──
  let session = await open()
  page = session.page
  reset({ created: checkout(ID.created) })
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pay-plus').waitFor()
  assert.equal(await page.getByTestId('checkout-status').count(), 0, 'nothing is waiting yet')
  await page.getByTestId('pay-plus').click()
  const panel = page.getByTestId('manual-payment')
  await panel.waitFor()
  const radios = panel.getByRole('radio')
  assert.equal(await radios.count(), 2, 'two ways to pay')
  assert.deepEqual(await panel.locator('.payment-method strong').allInnerTexts(), ['Automatic payment', 'Card transfer'], 'automatic is listed first')
  assert.equal(await panel.getByRole('radio', { name: /Automatic payment/ }).isChecked(), true, 'and chosen to begin with')
  const automaticText = await panel.getByTestId('method-automatic').innerText()
  assert.match(automaticText, /Pay on inPAY’s page with Click, Payme, Uzcard or Humo\./)
  assert.match(automaticText, /switches on by itself, usually within a minute\. Nothing renews by itself\./)
  assert.doesNotMatch(await panel.innerText(), /!|Coming soon|hurry|only today/i, 'said plainly')
  assert.match(await panel.innerText(), /Plus · 15 000 so'm/)
  assert.match(await panel.getByTestId('manual-discount').innerText(), /^Regular price\s+20 000 so'm\s+−25%\s+until /)
  assert.match(await page.getByTestId('checkout-pay').innerText(), /^Pay 15 000 so'm$/)
  assert.match((await page.getByTestId('pay-stepper').innerText()).replace(/\s+/g, ' '), /How to pay.*Pay on inPAY.*Plan switches on/)
  assert.equal(await panel.getByTestId('checkout-test-mode').count(), 0, 'no test note on a live payment')
  await audit(page, 'automatic-method', panel)
  // Card transfer is the other way, with its own steps and its own button.
  await panel.getByRole('radio', { name: /Card transfer/ }).check()
  assert.equal(await page.getByTestId('checkout-pay').count(), 0)
  assert.match(await page.getByTestId('manual-start').innerText(), /^Continue$/)
  assert.match((await page.getByTestId('pay-stepper').innerText()).replace(/\s+/g, ' '), /How to pay.*Transfer and receipt.*We check it/)
  await panel.getByRole('radio', { name: /Automatic payment/ }).check()
  checks.push('Automatic payment is listed first and chosen; it says inPAY, Click, Payme, Uzcard, Humo, a minute and no renewal; card transfer is the other way')

  await page.getByTestId('checkout-pay').click()
  await page.waitForURL(`${INPAY}/**`)
  assert.equal(page.url(), `${INPAY}/checkout/${ID.created}`, 'the browser goes to inPAY’s page')
  assert.deepEqual(posted().map((r) => JSON.parse(r.body)), [{ plan: 'plus' }], 'one payment asked for, for the chosen plan')
  assert.deepEqual(outside, [`${INPAY}/checkout/${ID.created}`], 'and nowhere else')
  checks.push('Pay 15 000 so\'m asks the server for the payment and sends the browser to inPAY’s page')

  // ── Back on the billing page: waiting, asking by hand, and the answer arriving by itself ──
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  const status = page.getByTestId('checkout-status')
  await status.getByTestId('checkout-waiting').waitFor()
  assert.match(await status.innerText(), /Plus · 15 000 so'm/)
  assert.match(await status.getByTestId('checkout-waiting').innerText(), /Waiting for your payment/)
  assert.match(await status.innerText(), /Finish the payment on inPAY’s page\./)
  assert.equal(await page.getByTestId('manual-payment').count(), 0, 'no chooser until a plan is picked again')
  await audit(page, 'automatic-pending', status)
  await status.getByTestId('checkout-check').click()
  await status.getByTestId('checkout-not-yet').waitFor()
  assert.match(await status.getByTestId('checkout-not-yet').innerText(), /inPAY has not confirmed the payment yet\./)
  // Choosing a plan again leaves the waiting payment on screen: it may already be paid.
  await page.getByTestId('pay-premium').click()
  await page.getByTestId('manual-payment').waitFor()
  assert.equal(await status.getByTestId('checkout-waiting').count(), 1)
  await page.getByTestId('manual-payment').getByRole('button', { name: 'Close' }).click()
  // inPAY confirms: the next read by the clock shows it, with no reload and no press.
  const before = reads(ID.created)
  account.plan = 'plus'
  state.checkouts.set(ID.created, paid(state.checkouts.get(ID.created)))
  await status.getByTestId('checkout-paid').waitFor()
  assert.ok(reads(ID.created) > before, 'the page read the payment again by itself')
  const day = await page.evaluate((value) => new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value)), activeUntil)
  assert.match(await status.getByTestId('checkout-paid').innerText(), new RegExp(`^Payment confirmed\\. Plus is active until ${day}\\.\\s+Receipt$`))
  assert.equal(await status.getByRole('link', { name: 'Receipt' }).getAttribute('href'), RECEIPT)
  // The new plan shows in the frame and on the cards without a reload.
  await page.getByTestId('current-plan').getByRole('heading', { name: 'Plus' }).waitFor()
  assert.equal(await page.locator('.plan-chip-name').innerText(), 'Plus')
  assert.match(await page.getByTestId('pay-plus').innerText(), /Add 30 days/)
  await audit(page, 'automatic-paid', status)
  account.plan = 'free'
  checks.push('The billing page shows the waiting payment, checks it every few seconds, and turns to "Payment confirmed" with the plan, its last day and the receipt; the frame takes the new plan')

  // Continue to payment goes to the same inPAY page.
  reset({ latest: ID.pending })
  state.checkouts.set(ID.pending, checkout(ID.pending))
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await status.getByTestId('checkout-continue').click()
  await page.waitForURL(`${INPAY}/**`)
  assert.equal(page.url(), `${INPAY}/checkout/${ID.pending}`)
  checks.push('Continue to payment returns to inPAY’s page')

  // An address that is not inPAY's is never opened, whatever the answer says.
  for (const address of ['https://inpay.uz.example.com/pay', 'http://pay.inpay.uz/pay', 'https://notinpay.uz/pay', 'javascript:alert(1)']) {
    reset({ created: checkout(ID.pending, { checkout_url: address }) })
    outside.length = 0
    await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('pay-plus').click()
    await page.getByTestId('checkout-pay').click()
    await status.getByRole('alert').waitFor()
    assert.equal(new URL(page.url()).pathname, '/en/app/billing', `${address} is not opened`)
    assert.equal(await status.getByTestId('checkout-continue').count(), 0, `${address} is not offered`)
    assert.deepEqual(outside, [], `${address} is never asked for`)
  }
  checks.push('Only https on inpay.uz or a subdomain of it is ever opened')

  // inPAY not answering is said inline, and the chooser stays to try again.
  reset({ refuse: ['checkout_unavailable', 'The payment service did not answer. Try again in a moment.', 503] })
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pay-plus').click()
  await page.getByTestId('checkout-pay').click()
  assert.match(await page.getByTestId('manual-payment').getByRole('alert').innerText(), /The payment service did not answer/)
  assert.equal(await page.getByTestId('checkout-pay').isEnabled(), true)
  checks.push('A refusal from the server is shown inline')

  // inPAY failing with card transfer set up: the platform offers card transfer in its place, and the panel says why.
  reset({ card: false, fallback: true, refuse: ['checkout_unavailable', 'The payment service did not answer. Try again in a moment.', 503] })
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pay-plus').click()
  await page.getByTestId('checkout-pay').click()
  const fallback = page.getByTestId('checkout-fallback')
  await fallback.waitFor()
  assert.match(await fallback.innerText(), /^Online payment isn’t working right now, so you can pay by card transfer instead\.$/)
  const fallbackPanel = page.getByTestId('manual-payment')
  assert.equal(await page.getByTestId('checkout-pay').count(), 0, 'no inPAY button meanwhile')
  assert.match(await page.getByTestId('manual-start').innerText(), /^Continue$/)
  assert.match(await fallbackPanel.locator('.eyebrow').innerText(), /^Card transfer$/i)
  assert.equal(await fallbackPanel.getByRole('alert').count(), 0, 'not an error: there is a way on')
  assert.equal(await fallbackPanel.getByRole('radio').count(), 0, 'one way, nothing to pick')
  await audit(page, 'automatic-fallback', fallbackPanel)
  // Another plan is a fresh start: the note was about the payment that failed.
  await fallbackPanel.getByRole('button', { name: 'Close' }).click()
  await page.getByTestId('pay-premium').click()
  await page.getByTestId('manual-payment').waitFor()
  assert.equal(await page.getByTestId('checkout-fallback').count(), 0)
  checks.push('When inPAY cannot open the payment and the platform offers card transfer instead, the panel turns to it and says why')

  // ── One way only: no picker ──
  reset({ card: false, created: checkout(ID.created) })
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pay-premium').click()
  await page.getByTestId('manual-payment').waitFor()
  assert.equal(await page.getByTestId('manual-payment').getByRole('radio').count(), 0, 'nothing to pick')
  assert.match(await page.getByTestId('manual-payment').locator('.eyebrow').innerText(), /^Automatic payment$/i)
  assert.match(await page.getByTestId('payment-way').innerText(), /^Pay on inPAY’s page with Click, Payme, Uzcard or Humo\./)
  assert.match(await page.getByTestId('checkout-pay').innerText(), /^Pay 60 000 so'm$/)
  assert.doesNotMatch(await page.getByTestId('manual-payment').innerText(), /Card transfer/)
  await audit(page, 'automatic-only', page.getByTestId('manual-payment'))
  checks.push('With automatic payment alone there is no picker, only what happens and the Pay button')

  // ── The owner trying it with test keys ──
  reset({ automatic: { available: true, provider: 'inpay', test: true }, created: checkout(ID.test, { test: true }) })
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pay-plus').click()
  assert.match(await page.getByTestId('checkout-test-mode').innerText(), /Test mode: only you see automatic payment\. No money moves and no plan is granted\./)
  reset({ automatic: { available: true, provider: 'inpay', test: true }, latest: ID.test })
  state.checkouts.set(ID.test, checkout(ID.test, { test: true }))
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  assert.match(await status.getByTestId('checkout-test').innerText(), /This is a test payment: no money moves and the plan does not change\./)
  const sessionsBefore = requests.filter((r) => r.endpoint === '/auth/session').length
  state.checkouts.set(ID.test, paid(state.checkouts.get(ID.test)))
  await status.getByTestId('checkout-paid').waitFor()
  assert.match(await status.getByTestId('checkout-paid').innerText(), /^The test payment went through\. No money moved and the plan was not changed\.$/)
  assert.equal(requests.filter((r) => r.endpoint === '/auth/session').length, sessionsBefore, 'a test payment changes no plan, so the account is not read again')
  await audit(page, 'automatic-test', status)
  checks.push('A test payment is marked as one: no money, no plan')

  // ── A payment that did not go through: calm, with the way to try again ──
  for (const [ending, words] of [
    ['failed', /The payment didn’t go through, so your plan has not changed\. You can try again\./],
    ['cancelled', /The payment was cancelled, so your plan has not changed\./],
    ['expired', /The payment page expired before the payment was made/],
  ]) {
    reset({ latest: ID.failed, created: checkout(ID.created) })
    state.checkouts.set(ID.failed, ended(checkout(ID.failed, { plan: 'premium', amount: 60000 }), ending))
    await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
    assert.match(await status.getByTestId('checkout-ended').innerText(), words)
    assert.doesNotMatch(await status.innerText(), /!/)
    if (ending === 'failed') await audit(page, 'automatic-failed', status)
    await status.getByTestId('checkout-retry').click()
    assert.match(await page.getByTestId('manual-payment').innerText(), /Premium · 60 000 so'm/, `${ending}: trying again opens the same plan`)
    assert.equal(await status.count(), 0, 'the old result steps aside for the new choice')
  }
  checks.push('Failed, cancelled and expired payments say so calmly and offer Try again for the same plan')

  // ── The page stops checking by itself after ten minutes; asking by hand still works ──
  reset({ latest: ID.pending })
  state.checkouts.set(ID.pending, checkout(ID.pending))
  await page.clock.install()
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await status.getByTestId('checkout-waiting').waitFor()
  await page.clock.fastForward(10 * 60_000 + 6000)
  await status.getByText('This page has stopped checking by itself.').waitFor()
  const stopped = reads(ID.pending)
  await page.clock.fastForward(60_000)
  assert.equal(reads(ID.pending), stopped, 'no more reads by the clock')
  state.checkouts.set(ID.pending, paid(state.checkouts.get(ID.pending)))
  await status.getByTestId('checkout-check').click()
  await status.getByTestId('checkout-paid').waitFor()
  checks.push('After ten minutes the billing page stops checking by itself and says so; "I’ve paid — check" still finds the payment')
  await session.context.close()

  // ── Inside the Telegram Mini App the payment page opens in the phone's browser ──
  session = await open({ viewport: { width: 390, height: 844 } })
  page = session.page
  reset({ miniApp: true, created: checkout(ID.created) })
  state.checkouts.set(ID.created, checkout(ID.created))
  outside.length = 0
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pay-plus').click()
  await page.getByTestId('checkout-pay').click()
  await page.getByTestId('checkout-status').getByTestId('checkout-waiting').waitFor()
  assert.deepEqual(await page.evaluate(() => window.__opened), [`${INPAY}/checkout/${ID.created}`], 'Telegram is asked to open inPAY’s page')
  assert.equal(new URL(page.url()).pathname, '/en/app/billing', 'the Mini App stays where it was')
  assert.deepEqual(outside, [], 'and does not load the payment page itself')
  assert.equal(await page.getByTestId('manual-payment').count(), 0, 'the chooser gives way to the waiting payment')
  checks.push('In the Telegram Mini App the payment page opens through Telegram and the panel waits for the payment')
  await session.context.close()

  // ── The page inPAY sends the browser back to, signed out ──
  session = await open()
  page = session.page
  reset({ signedIn: false })
  state.checkouts.set(ID.pending, checkout(ID.pending))
  // inPAY may add what it likes to the address; none of it is read.
  await page.goto(`${origin}/en/app/pay/${ID.pending}?status=failed&paid=0&order=1`, { waitUntil: 'domcontentloaded' })
  const back = page.getByTestId('pay-return')
  await back.getByRole('heading', { name: 'Confirming your payment' }).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'Sign in' }).count(), 0, 'no sign-in in the way')
  assert.equal(await page.title(), 'Payment · DocMaster')
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex')
  assert.match(await back.innerText(), /This usually takes under a minute, and this page updates by itself\./)
  assert.match(await back.getByTestId('pay-return-sum').innerText(), /^Plus · 15 000 so'm$/)
  assert.equal(await back.getByRole('link').count() + await back.getByRole('button').count(), 0, 'nothing to press while it is confirming')
  await audit(page, 'return-confirming', page.locator('#main-content'))
  const seen = reads(ID.pending)
  state.checkouts.set(ID.pending, paid(state.checkouts.get(ID.pending)))
  await back.getByRole('heading', { name: 'Payment received' }).waitFor()
  assert.ok(reads(ID.pending) > seen, 'the page read the payment again by itself')
  assert.match(await back.innerText(), new RegExp(`Plus is active until ${day}\\.`))
  assert.equal(await back.getByTestId('pay-return-open').getAttribute('href'), '/en/app')
  assert.match(await back.getByTestId('pay-return-open').innerText(), /^Open DocMaster$/)
  assert.match(await back.getByTestId('pay-return-open').getAttribute('class'), /primary/)
  assert.equal(await back.getByTestId('pay-return-receipt').getAttribute('href'), RECEIPT)
  assert.equal(await back.getByTestId('pay-return-telegram').count(), 0)
  await audit(page, 'return-paid', page.locator('#main-content'))
  const settled = reads(ID.pending)
  await page.waitForTimeout(3500)
  assert.equal(reads(ID.pending), settled, 'a settled payment is not read again')
  checks.push('Signed out, the return page waits for inPAY (ignoring what inPAY put in the address), then shows the plan, its last day, the receipt and Open DocMaster')

  // Failed, in Russian: the page's own language, and the way back to the plans.
  state.checkouts.set(ID.failed, ended(checkout(ID.failed), 'failed'))
  await page.goto(`${origin}/ru/app/pay/${ID.failed}`, { waitUntil: 'domcontentloaded' })
  await back.getByRole('heading', { name: 'Оплата не завершена' }).waitFor()
  assert.match(await back.innerText(), /Оплата не прошла, поэтому тариф не изменился\./)
  assert.equal(await back.getByTestId('pay-return-billing').getAttribute('href'), '/ru/app/billing')
  assert.match(await back.getByTestId('pay-return-billing').innerText(), /^Попробовать снова$/)
  assert.equal(await back.getByRole('link', { name: 'Помощь' }).getAttribute('href'), '/ru/help')
  assert.equal(await page.title(), 'Оплата · DocMaster')
  await audit(page, 'return-failed', page.locator('#main-content'))
  for (const [ending, words] of [['cancelled', /Оплата отменена/], ['expired', /Срок действия страницы оплаты истёк/]]) {
    state.checkouts.set(ID.failed, ended(checkout(ID.failed), ending))
    await page.goto(`${origin}/ru/app/pay/${ID.failed}`, { waitUntil: 'domcontentloaded' })
    await back.getByRole('heading', { name: 'Оплата не завершена' }).waitFor()
    assert.match(await back.innerText(), words)
    assert.equal(await back.getByTestId('pay-return-billing').getAttribute('href'), '/ru/app/billing')
  }
  checks.push('A failed, cancelled or expired payment is explained in the page’s language with the way back to Plan & billing')

  // Started in the bot, in Uzbek: back to Telegram, paid or not.
  state.checkouts.set(ID.bot, paid(checkout(ID.bot, { channel: 'bot', bot_url: BOT })))
  await page.goto(`${origin}/uz/app/pay/${ID.bot}`, { waitUntil: 'domcontentloaded' })
  await back.getByRole('heading', { name: 'To‘lov qabul qilindi' }).waitFor()
  assert.match(await back.innerText(), /Plus tarifi .+ gacha faol\./)
  assert.equal(await back.getByTestId('pay-return-telegram').getAttribute('href'), BOT)
  assert.match(await back.getByTestId('pay-return-telegram').innerText(), /^Telegram’ga qaytish$/)
  assert.match(await back.getByTestId('pay-return-telegram').getAttribute('class'), /primary/)
  assert.equal(await back.getByTestId('pay-return-open').count(), 0, 'Telegram is the one way on')
  assert.doesNotMatch(await back.innerText(), /[А-Яа-яЁё]/, 'Uzbek is Latin')
  await audit(page, 'return-bot', page.locator('#main-content'))
  state.checkouts.set(ID.bot, ended(checkout(ID.bot, { channel: 'bot', bot_url: BOT }), 'failed'))
  await page.goto(`${origin}/uz/app/pay/${ID.bot}`, { waitUntil: 'domcontentloaded' })
  await back.getByRole('heading', { name: 'To‘lov yakunlanmadi' }).waitFor()
  assert.equal(await back.getByTestId('pay-return-telegram').getAttribute('href'), BOT)
  assert.equal(await back.getByTestId('pay-return-billing').count(), 0)
  // A bot address that is not Telegram's is not offered.
  state.checkouts.set(ID.bot, paid(checkout(ID.bot, { channel: 'bot', bot_url: 'https://t.me.example.com/x' })))
  await page.goto(`${origin}/uz/app/pay/${ID.bot}`, { waitUntil: 'domcontentloaded' })
  await back.getByRole('heading', { name: 'To‘lov qabul qilindi' }).waitFor()
  assert.equal(await back.getByTestId('pay-return-telegram').count(), 0)
  assert.equal(await back.getByTestId('pay-return-open').getAttribute('href'), '/uz/app')
  checks.push('A payment started in the bot offers Back to Telegram, paid or not')

  // No such payment (also what today's platform answers), and an address that is no id at all.
  await page.goto(`${origin}/en/app/pay/${ID.unknown}`, { waitUntil: 'domcontentloaded' })
  await back.getByRole('heading', { name: 'Payment not found' }).waitFor()
  assert.match(await back.innerText(), /This link does not match any payment\./)
  assert.equal(await back.getByTestId('pay-return-open').getAttribute('href'), '/en/app')
  await audit(page, 'return-missing', page.locator('#main-content'))
  const asked = requests.length
  for (const address of ['/en/app/pay/not-an-id', '/en/app/pay', '/en/app/pay/']) {
    await page.goto(`${origin}${address}`, { waitUntil: 'domcontentloaded' })
    await back.getByRole('heading', { name: 'Payment not found' }).waitFor()
  }
  assert.equal(requests.slice(asked).filter((r) => r.endpoint.startsWith('/billing/')).length, 0, 'what is not an id is never sent to the server')
  checks.push('An unknown payment, or an address with no id, says "Payment not found"')

  // Two minutes without an answer: the page stops, says what will happen, and offers Check again.
  state.checkouts.set(ID.pending, checkout(ID.pending))
  await page.clock.install()
  await page.goto(`${origin}/en/app/pay/${ID.pending}`, { waitUntil: 'domcontentloaded' })
  await back.getByRole('heading', { name: 'Confirming your payment' }).waitFor()
  await page.clock.fastForward(2 * 60_000 + 4000)
  await back.getByRole('heading', { name: 'Not confirmed yet' }).waitFor()
  assert.match(await back.innerText(), /Your plan will switch on as soon as inPAY confirms the payment\./)
  const quiet = reads(ID.pending)
  await page.clock.fastForward(30_000)
  assert.equal(reads(ID.pending), quiet, 'no more reads by the clock')
  assert.equal(await back.getByText('inPAY has not confirmed the payment yet.').count(), 0, 'said only once it is asked')
  await audit(page, 'return-later', page.locator('#main-content'))
  await back.getByTestId('pay-return-check').click()
  await back.getByText('inPAY has not confirmed the payment yet.').waitFor()
  state.checkouts.set(ID.pending, paid(state.checkouts.get(ID.pending)))
  await back.getByTestId('pay-return-check').click()
  await back.getByRole('heading', { name: 'Payment received' }).waitFor()
  checks.push('After two minutes the return page stops, says the plan will switch on once inPAY confirms, and Check again finds it')
  await session.context.close()

  // ── Signed in, the return page sits in the app and the frame takes the new plan ──
  session = await open()
  page = session.page
  reset()
  state.checkouts.set(ID.pending, checkout(ID.pending))
  await page.goto(`${origin}/en/app/pay/${ID.pending}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pay-return').getByRole('heading', { name: 'Confirming your payment' }).waitFor()
  assert.equal(await page.locator('.plan-chip-name').innerText(), 'Free')
  assert.equal(await page.locator('.topbar-title').innerText(), 'Payment')
  account.plan = 'plus'
  state.checkouts.set(ID.pending, paid(state.checkouts.get(ID.pending)))
  await page.getByTestId('pay-return').getByRole('heading', { name: 'Payment received' }).waitFor()
  await page.locator('.plan-chip-name', { hasText: 'Plus' }).waitFor()
  account.plan = 'free'
  checks.push('Signed in, the return page is in the app frame, which shows the new plan once it is paid')

  // ── The public pages say how to pay as it now is ──
  reset({ signedIn: false })
  await page.goto(`${origin}/en/pricing`, { waitUntil: 'domcontentloaded' })
  await page.locator('.site-pricing-steps li').nth(2).waitFor()
  // The server rendered the page from its own plans; the browser's fresh read brings the ways to pay.
  await page.locator('.site-pricing-steps li', { hasText: 'Pay on inPAY’s page' }).waitFor()
  assert.deepEqual(await page.locator('.site-pricing-steps h3').allInnerTexts(), ['Choose a plan', 'Pay on inPAY’s page', 'The plan switches on by itself'])
  assert.match(await page.locator('.site-pricing-also').innerText(), /^You can also pay by card transfer/)
  assert.deepEqual(await page.locator('.site-pricing-cards span').allInnerTexts(), ['Click', 'Payme', 'Uzcard', 'Humo', 'Visa', 'Mastercard'])
  assert.deepEqual(await page.locator('.site-footer .site-cards span').allInnerTexts(), ['Click', 'Payme', 'Uzcard', 'Humo', 'Visa', 'Mastercard'])
  assert.match((await page.locator('.site-faq').evaluate((node) => node.textContent)).replace(/\u00a0/g, ' '), /After an automatic payment, by itself, usually within a minute\. After a card transfer, a member of staff checks the receipt by hand/)
  await audit(page, 'pricing-automatic', page.locator('#pricing-pay').locator('xpath=ancestor::section'))
  reset({ signedIn: false, card: false })
  await page.goto(`${origin}/en/pricing`, { waitUntil: 'domcontentloaded' })
  await page.locator('.site-pricing-steps li', { hasText: 'Pay on inPAY’s page' }).waitFor()
  assert.equal(await page.locator('.site-pricing-also').count(), 0, 'card transfer is not named when it is off')
  assert.deepEqual(await page.locator('.site-pricing-cards span').allInnerTexts(), ['Click', 'Payme', 'Uzcard', 'Humo'])
  assert.doesNotMatch(await page.locator('.site-pricing').innerText(), /receipt|Visa|Mastercard/i)
  // The owner's test mode is the owner's alone: the public pages keep today's words.
  reset({ signedIn: false, automatic: { available: true, provider: 'inpay', test: true } })
  await page.goto(`${origin}/en/pricing`, { waitUntil: 'domcontentloaded' })
  await page.locator('.site-pricing-steps li').nth(3).waitFor()
  assert.deepEqual(await page.locator('.site-pricing-steps h3').allInnerTexts(), ['Choose a plan', 'Transfer by card', 'Upload the receipt', 'We check and switch on'])
  checks.push('The pricing page, its questions and the footer name automatic payment once it is on, with card transfer only while it is offered')

  // ── Saving a card on the website: «Pay and renew every month» hands over to inPAY's page for the card ──
  reset({ card: false, created: checkout(ID.created), renewal: { offered: true, card: null, renewal: null, can_turn_on: false } })
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pay-plus').click()
  const ways = page.getByTestId('card-ways')
  await ways.waitFor()
  assert.deepEqual(await ways.locator('.payment-method strong').allInnerTexts(), ['Pay once', 'Pay and renew every month'])
  assert.equal(await ways.getByRole('radio', { name: /Pay once/ }).isChecked(), true, 'paying once is chosen to begin with: nothing renews unasked')
  assert.match(await page.getByTestId('way-renew').innerText(),
    /Save your card on inPAY’s page: 15 000 so'm now and every 30 days, with no SMS code\. Turn it off any time\./)
  assert.equal(await page.getByTestId('payment-way').count(), 0, 'the ways say it: no second line')
  assert.match(await page.getByTestId('checkout-pay').innerText(), /^Pay 15 000 so'm$/)
  await ways.getByRole('radio', { name: /Pay and renew every month/ }).check()
  assert.equal(await page.getByTestId('checkout-pay').count(), 0)
  assert.match(await page.getByTestId('card-save').innerText(), /^Save card and pay 15 000 so'm$/)
  await audit(page, 'card-ways', page.getByTestId('manual-payment'))
  const openedBefore = posted().length
  await page.getByTestId('card-save').click()
  await page.waitForURL(`${INPAY}/cards/bind/${CARD.web}`)
  assert.deepEqual(requests.filter((r) => r.endpoint === '/billing/cards' && r.method === 'POST').map((r) => JSON.parse(r.body)), [{ plan: 'plus' }])
  assert.equal(posted().length, openedBefore, 'no one-off payment was opened')
  checks.push('Where saved cards are offered, inPAY is «Pay once» (chosen) or «Pay and renew every month», which hands over to inPAY’s page for the card')

  // ── Back from inPAY's page: waiting for the card, then the first month paid and renewal on ──
  await page.goto(`${origin}/en/app/card/${CARD.web}`, { waitUntil: 'domcontentloaded' })
  const cardReturn = page.getByTestId('card-return')
  await page.locator('[data-testid="card-return"][data-state="waiting"]').waitFor()
  assert.match(await cardReturn.innerText(), /Saving your card/)
  // inPAY says the card is saved and the server pays for the plan: the page's next look shows it.
  state.cards.set(CARD.web, { ...state.cards.get(CARD.web), status: 'active', last4: '1234', bind_url: null,
    charge: chargeOf({ renews_at: activeUntil }) })
  await page.locator('[data-testid="card-return"][data-state="paid"]').waitFor()
  assert.match((await cardReturn.innerText()).replace(/\s+/g, ' '),
    /Payment confirmed\. Plus is active until .+?\. Auto-renewal is on: next charge .+, 15 000 so'm from card •••• 1234\./)
  assert.match(await page.getByTestId('card-return-billing').innerText(), /^Plan & billing$/)
  await audit(page, 'card-return-paid', page.locator('#main-content'))
  // A charge the card's limit was below: why, in the customer's language.
  state.cards.set(CARD.failed, { id: CARD.failed, status: 'active', plan: null, last4: '1234', bind_url: null,
    charge: chargeOf({ id: '30000000-0000-4000-8000-000000000002', status: 'failed', reason: 'consent_limit', active_until: null }) })
  await page.goto(`${origin}/ru/app/card/${CARD.failed}`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="card-return"][data-state="failed"]').waitFor()
  assert.match(await cardReturn.innerText(), /Не удалось списать с карты •••• 1234: цена выше лимита/)
  await audit(page, 'card-return-failed', page.locator('#main-content'))
  // inPAY's page closed without a card: nothing was charged.
  state.cards.set(CARD.closed, { id: CARD.closed, status: 'expired', plan: 'plus', last4: '', bind_url: null, charge: null })
  await page.goto(`${origin}/uz/app/card/${CARD.closed}`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="card-return"][data-state="closed"]').waitFor()
  assert.match(await cardReturn.innerText(), /Karta saqlanmadi[\s\S]*hech narsa yechilmadi/)
  for (const address of [`/en/app/card/${CARD.unknown}`, '/en/app/card/not-an-id']) {
    await page.goto(`${origin}${address}`, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid="card-return"][data-state="missing"]').waitFor()
  }
  // inPAY has not answered for a minute: look again, or go back to inPAY's page (and nowhere else).
  const waitingSession = await open()
  const slow = waitingSession.page
  await slow.clock.install()
  state.cards.set(CARD.later, { id: CARD.later, status: 'binding', plan: 'plus', last4: '', bind_url: `${INPAY}/cards/bind/${CARD.later}`, charge: null })
  await slow.goto(`${origin}/en/app/card/${CARD.later}`, { waitUntil: 'domcontentloaded' })
  await slow.locator('[data-testid="card-return"][data-state="waiting"]').waitFor()
  for (let tick = 0; tick < 20 && (await slow.getByTestId('card-return').getAttribute('data-state')) === 'waiting'; tick++) {
    const before = state.cardReads
    await slow.clock.fastForward(4000)
    for (let spin = 0; spin < 100 && state.cardReads === before; spin++) await new Promise((resolve) => setTimeout(resolve, 20))
  }
  await slow.locator('[data-testid="card-return"][data-state="later"]').waitFor()
  assert.equal(await slow.getByTestId('card-return-inpay').getAttribute('href'), `${INPAY}/cards/bind/${CARD.later}`)
  assert.match(await slow.getByTestId('card-return').innerText(), /inPAY hasn’t confirmed your card yet/)
  await audit(slow, 'card-return-later', slow.locator('#main-content'))
  await waitingSession.context.close()
  checks.push('Back from inPAY, /app/card/{id} waits for the card, then shows the month paid and the next charge, a failure and why, a page closed, or an unknown card')

  // ── A card saved on the website pays in one tap, after a confirm ──
  reset({ card: false, renewal: { offered: true, card: savedHere, renewal: null, can_turn_on: false }, chargeAnswer: chargeOf() })
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pay-plus').click()
  await ways.waitFor()
  assert.deepEqual(await ways.locator('.payment-method strong').allInnerTexts(),
    ['Pay with card •••• 1234', 'Pay with •••• 1234 and renew every month', 'Pay once with another card'])
  assert.equal(await ways.getByRole('radio', { name: /^Pay with card •••• 1234/ }).isChecked(), true)
  await page.getByTestId('card-pay').click()
  const confirm = page.getByTestId('card-confirm')
  assert.match(await confirm.innerText(), /^Charge 15 000 so'm to card •••• 1234 now\?/)
  assert.doesNotMatch(await confirm.innerText(), /every 30 days/, 'paying once renews nothing')
  assert.deepEqual(charges(), [], 'nothing is charged before the confirm tap')
  await audit(page, 'card-confirm', page.getByTestId('manual-payment'))
  await page.getByTestId('card-pay-yes').click()
  await page.getByTestId('card-charge-paid').waitFor()
  assert.match(await page.getByTestId('card-charge-paid').innerText(), /^Payment confirmed\. Plus is active until .+\.$/)
  assert.equal(await page.getByTestId('manual-payment').count(), 0, 'paid: the panel closes')
  await audit(page, 'card-charge-paid', page.getByTestId('card-charge'))
  // Premium, renewing every month from the card.
  await page.getByTestId('pay-premium').click()
  assert.equal(await page.getByTestId('card-charge').count(), 0, 'a new plan, a new payment')
  await ways.getByRole('radio', { name: /and renew every month/ }).check()
  await page.getByTestId('card-pay').click()
  assert.match((await confirm.innerText()).replace(/\s+/g, ' '),
    /Charge 60 000 so'm to card •••• 1234 now\? Then 60 000 so'm every 30 days, until you turn auto-renewal off\./)
  await page.getByTestId('card-pay-yes').click()
  await page.getByTestId('card-charge-paid').waitFor()
  assert.match(await page.getByTestId('card-charge-paid').innerText(), /Auto-renewal is on: next charge .+, 60 000 so'm from card •••• 1234\./)
  await page.getByTestId('renewal').getByTestId('renewal-on').waitFor()
  // Declined by the bank: why, and the panel stays for another way.
  state.chargeAnswer = chargeOf({ id: '30000000-0000-4000-8000-000000000003', status: 'failed', reason: 'declined', active_until: null })
  await page.getByTestId('pay-plus').click()
  await page.getByTestId('card-pay').click()
  await page.getByTestId('card-pay-yes').click()
  await page.getByTestId('card-charge-failed').waitFor()
  assert.match(await page.getByTestId('card-charge-failed').innerText(),
    /^Couldn’t charge card •••• 1234: the bank declined the payment\. Check the balance, or pay with another card\.$/)
  assert.equal(await page.getByTestId('manual-payment').count(), 1, 'still open to pay another way')
  await audit(page, 'card-charge-failed', page.getByTestId('card-charge'))
  assert.deepEqual(charges(), [{ plan: 'plus', renew: false }, { plan: 'premium', renew: true }, { plan: 'plus', renew: false }])
  checks.push('A card saved on the website pays once or with renewal in one tap after a confirm, and a decline says why')

  // ── A card saved in the bot: its monthly renewal, turned off, on again and the card removed here ──
  const renewsAt = new Date(Date.now() + 9 * 86400000).toISOString()
  reset({ renewal: { offered: true, can_turn_on: false,
    card: { id: CARD.bot, masked: '860038******1234', last4: '1234', expiry: '09/29', consent_max: null, here: false },
    renewal: { status: 'on', plan: 'plus', renews_at: renewsAt, amount: 15000, attempts: 0, next_try_at: null, stopped_reason: '', card_last4: '1234' } } })
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  const renewalPanel = page.getByTestId('renewal')
  await renewalPanel.getByTestId('renewal-on').waitFor()
  assert.match(await renewalPanel.getByTestId('renewal-on').innerText(), /^On\. Next charge .+: 15 000 so'm from card •••• 1234\.$/)
  assert.match(await renewalPanel.innerText(), /Saved card: •••• 1234/)
  assert.match(await renewalPanel.getByTestId('renewal-saved-in-bot').innerText(), /^This card was saved in the Telegram bot\./)
  await audit(page, 'renewal', renewalPanel)
  // The bot's card is not offered for paying here in one tap.
  await page.getByTestId('pay-plus').click()
  await ways.waitFor()
  assert.deepEqual(await ways.locator('.payment-method strong').allInnerTexts(), ['Pay once', 'Pay and renew every month'])
  await page.locator('[data-testid="manual-payment"] .panel-heading .icon-button').click()
  await page.getByTestId('manual-payment').waitFor({ state: 'detached' })
  await renewalPanel.getByTestId('renewal-turn-off').click()
  await renewalPanel.getByTestId('renewal-off').waitFor()
  assert.equal(await renewalPanel.getByTestId('renewal-turn-off').count(), 0, 'nothing left to turn off')
  await renewalPanel.getByTestId('renewal-turn-on').click()
  await renewalPanel.getByTestId('renewal-on').waitFor()
  await renewalPanel.getByTestId('renewal-turn-off').click()
  await renewalPanel.getByTestId('renewal-off').waitFor()
  await renewalPanel.getByTestId('card-remove').click()
  assert.match(await renewalPanel.innerText(), /Remove the card\? Auto-renewal stops/)
  await renewalPanel.getByTestId('card-remove-yes').click()
  await renewalPanel.waitFor({ state: 'detached' })
  assert.deepEqual(requests.filter((r) => r.method === 'DELETE' && /^\/billing\/(renewal|cards)/.test(r.endpoint)).map((r) => r.endpoint),
    ['/billing/renewal', '/billing/renewal', `/billing/cards/${CARD.bot}`])
  assert.equal(requests.filter((r) => r.method === 'POST' && r.endpoint === '/billing/renewal').length, 1)
  // Nothing saved: no panel at all.
  reset()
  await page.goto(`${origin}/en/app/billing`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pay-plus').waitFor()
  assert.equal(await page.getByTestId('renewal').count(), 0)
  checks.push('A card saved in the bot shows its renewal on the billing page, which turns it off and on and removes the card, and is not paid with here in one tap')

  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [], 'every API call is covered by the fixture')
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2))
} catch (error) {
  await page?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {})
  console.error(JSON.stringify({ error: error.message, checks, errors, unexpected }, null, 2))
  throw error
} finally {
  await browser.close()
}
