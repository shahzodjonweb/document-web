import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// The app inside Telegram (docs/design/MINI_APP.md): signed in from Telegram's launch
// data, the account's language, Telegram's colours and bars, three places with Telegram's
// Back between them, a start parameter, the tool's main button, saving a result through
// Telegram, and links out. Telegram is a fake that records what it is asked; the website
// in a plain browser keeps its own frame.
const origin = process.env.MINI_APP_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use the local web server')
const output = path.resolve(process.env.MINI_APP_ARTIFACT_DIR || '../studio-review/mini-app')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const checks = []
const errors = []

const account = {
  id: '00000000-0000-4000-8000-888888888888', display_name: 'Dilnoza Karimova', locale: 'uz', time_zone: 'UTC',
  mode: 'general', plan: 'free', preferences: {}, telegram_user_id: 7700123,
  login_methods: { email: false, google: false, telegram: true },
}
const limits = (documents, files, edits) =>
  ({ weekly_ai_documents: documents, weekly_file_jobs: files, edits_per_file: edits, saved_workflows: 20 })
const plans = [
  { id: 'free', name: 'Free', price_uzs: null, discount: null, limits: limits(5, 15, 3) },
  { id: 'plus', name: 'Plus', price_uzs: 20000, discount: null, limits: limits(20, null, 10) },
]
const week = { starts_at: '2026-11-22T19:00:00Z', resets_at: '2026-11-29T19:00:00Z', time_zone: 'Asia/Tashkent' }
const allowance = (limit, used) => ({ limit, used, remaining: limit === null ? null : limit - used })
const feature = (id) => ({ id, name: id, category: 'pdf', input_types: ['application/pdf'], parameters: {} })
const JOB = '6cfd655d-9028-4761-8e94-4dbfe6da0ef2'
const ARTIFACT = '11111111-2222-4333-8444-555555555555'
const job = {
  id: JOB, feature_id: 'pdf.rotate', status: 'succeeded', created_at: '2026-11-27T16:03:00Z',
  started_at: '2026-11-27T16:03:01Z', completed_at: '2026-11-27T16:03:02Z', input_files: [], warnings: [],
  error: null, parameters: {}, origin_channel: 'mini_app',
  artifacts: [{ id: ARTIFACT, file_id: ARTIFACT, name: 'Ariza-rotated.pdf', size_bytes: 2048, role: 'output',
    mime_type: 'application/pdf', state: 'ready', expires_at: '2026-11-28T16:03:02Z',
    download_url: `/api/v1/artifacts/${ARTIFACT}/download`, preview_url: null }],
}
const DARK = {
  bg_color: '#000000', text_color: '#ffffff', hint_color: '#98989e', link_color: '#3e88f7', button_color: '#3e88f7',
  button_text_color: '#ffffff', secondary_bg_color: '#1c1c1d', section_bg_color: '#2c2c2e',
  section_separator_color: '#545458', subtitle_text_color: '#98989e',
}
const LIGHT = {
  bg_color: '#ffffff', text_color: '#000000', hint_color: '#999999', link_color: '#2481cc', button_color: '#2481cc',
  button_text_color: '#ffffff', secondary_bg_color: '#efeff4', section_bg_color: '#ffffff',
  section_separator_color: '#c8c7cc', subtitle_text_color: '#999999',
}

/**
 * Telegram's WebApp object as a client gives it, recording each call in `window.__tg`.
 * `options.initData` empty is a plain browser: Telegram's script makes the object there too.
 */
function fakeTelegram({ initData, startParam, theme, scheme }) {
  const calls = []
  const handlers = {}
  const button = (name) => {
    const state = { name, text: '', isVisible: false, isActive: true, isProgressVisible: false, clicks: [] }
    return Object.assign(state, {
      setParams(params) {
        calls.push([`${name}.setParams`, params])
        if ('text' in params) state.text = params.text
        if ('is_visible' in params) state.isVisible = params.is_visible
        if ('is_active' in params) state.isActive = params.is_active
      },
      show() { state.isVisible = true; calls.push([`${name}.show`]) },
      hide() { state.isVisible = false; calls.push([`${name}.hide`]) },
      // As Telegram's own: hiding the progress switches the button back on.
      showProgress() { state.isProgressVisible = true; state.isActive = false },
      hideProgress() { state.isProgressVisible = false; state.isActive = true },
      onClick(fn) { state.clicks.push(fn) },
      offClick(fn) { state.clicks = state.clicks.filter((item) => item !== fn) },
      press() { state.clicks.forEach((fn) => fn()) },
    })
  }
  const app = {
    initData,
    initDataUnsafe: initData ? { start_param: startParam || undefined, user: { id: 7700123, allows_write_to_pm: true } } : {},
    version: '8.0',
    platform: initData ? 'ios' : 'unknown',
    colorScheme: scheme,
    themeParams: theme,
    viewportStableHeight: innerHeight,
    isVersionAtLeast: (version) => Number(version) <= 8.0,
    ready() { calls.push(['ready']) },
    expand() { calls.push(['expand']) },
    close() { calls.push(['close']) },
    setHeaderColor(value) { calls.push(['setHeaderColor', value]) },
    setBackgroundColor(value) { calls.push(['setBackgroundColor', value]) },
    setBottomBarColor(value) { calls.push(['setBottomBarColor', value]) },
    openLink(url) { calls.push(['openLink', url]) },
    openTelegramLink(url) { calls.push(['openTelegramLink', url]) },
    downloadFile(params, callback) { calls.push(['downloadFile', params]); setTimeout(() => callback(true), 50) },
    showConfirm(message, callback) { callback(true) },
    onEvent(name, fn) { (handlers[name] ||= []).push(fn) },
    offEvent(name, fn) { handlers[name] = (handlers[name] || []).filter((item) => item !== fn) },
    HapticFeedback: {
      selectionChanged() { calls.push(['haptic', 'selection']) },
      impactOccurred(kind) { calls.push(['haptic', kind]) },
      notificationOccurred(kind) { calls.push(['haptic', kind]) },
    },
    MainButton: button('MainButton'),
    BackButton: button('BackButton'),
    SettingsButton: button('SettingsButton'),
    SecondaryButton: button('SecondaryButton'),
  }
  window.Telegram = { WebApp: app }
  window.__tg = { calls, handlers, app, emit: (name) => (handlers[name] || []).forEach((fn) => fn()) }
}

async function open({ initData = 'auth_date=1&hash=fixture&user=%7B%22id%22%3A7700123%7D', startParam = '', theme = LIGHT, scheme = 'light', width = 390, sessionOf = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' })
  await context.addInitScript(fakeTelegram, { initData, startParam, theme, scheme })
  // `sessionOf`: someone already signed in in this web view (another Telegram account on the phone).
  let current = sessionOf
  const posted = []
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin === origin || url.protocol === 'data:') return route.continue()
    // Telegram's own script would replace the fake: the fake is the client here.
    if (url.hostname === 'telegram.org') return route.fulfill({ contentType: 'application/javascript', body: '' })
    return route.abort('blockedbyclient')
  })
  await context.route(`${origin}/api/v1/**`, async (route) => {
    const request = route.request()
    const endpoint = new URL(request.url()).pathname.replace('/api/v1', '')
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (request.method() !== 'GET') posted.push([endpoint, request.postDataJSON?.() ?? null])
    if (endpoint === '/auth/telegram/miniapp') {
      current = account
      return json({ user: account })
    }
    if (endpoint === '/auth/session') {
      if (request.method() === 'DELETE') current = null
      return json({ user: current, development_login_enabled: false, csrf_token: 'fixture' })
    }
    if (endpoint === '/auth/providers')
      return json({ email: { enabled: false }, google: { enabled: false }, telegram: { enabled: true, configured: true }, antibot: { enabled: false, configured: false, site_key: '', binding: '' } })
    if (endpoint === '/me') return json(account)
    if (endpoint === '/catalog') return json({ features: ['pdf.rotate', 'pdf.images_to_pdf', 'pdf.merge'].map(feature), draft: false })
    if (endpoint === '/plans') return json({ plans, currency: 'UZS', period_seconds: 2592000, draft: true })
    if (endpoint === '/usage')
      return json({ plan: 'free', week, resets_at: week.resets_at, edits_per_file: 3, ai_documents: allowance(5, 1), file_jobs: allowance(15, 3) })
    if (endpoint === '/channels') return json({ required: false, joined: true, channels: [] })
    if (endpoint === '/studio/config') return json({ provider: { mode: 'openai', configured: true }, features: [], default_pages: 10 })
    if (endpoint === '/jobs') return json({ results: [job], count: 1 })
    if (endpoint === `/jobs/${JOB}`) return json(job)
    if (endpoint === `/artifacts/${ARTIFACT}/link`)
      return json({ url: `/api/v1/artifacts/${ARTIFACT}/download?link=signed`, name: 'Ariza-rotated.pdf', expires_in: 300 })
    if (endpoint === '/referrals')
      return json({ code: 'ABC', url: 'https://t.me/docmaster_bot?start=ref_ABC', rewards_count: 0, pending_count: 0, monthly_cap: 5, qualification: '', sandbox: true, step: 5, counted: 0, counted_this_month: 0, month_full: false, next_month: week.resets_at, waiting_next_month: 0, next_reward: { tier: 1, months: 1, invites: 5, have: 0, remaining: 5 }, rewards: [] })
    if (endpoint === '/billing/manual')
      return json({ enabled: true, currency: 'UZS', period_days: 30, automatic: { available: false }, plans: [], payment: null })
    if (endpoint.startsWith('/billing/')) return json({ results: [], plan: 'free', subscription: null })
    return json({})
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', (error) => errors.push(error.message))
  return { context, page, posted }
}
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const calls = (page, name) => page.evaluate((key) => window.__tg.calls.filter(([call]) => call === key), name)
const telegramButton = (page, name) =>
  page.evaluate((key) => {
    const { text, isVisible, isActive } = window.__tg.app[key]
    return { text, isVisible, isActive }
  }, name)
const settle = (page) => page.waitForLoadState('networkidle')
const shot = (page, name) => page.screenshot({ path: `${output}/${name}.png` })

try {
  // Opened from the menu button: one address for everyone, the account's language wins.
  {
    const { context, page, posted } = await open()
    await page.goto(`${origin}/en/app`)
    await page.waitForURL('**/uz/app')
    await page.locator('.tg-tabbar a').first().waitFor()
    await settle(page)
    assert.deepEqual(posted.find(([endpoint]) => endpoint === '/auth/telegram/miniapp')?.[1]?.init_data, 'auth_date=1&hash=fixture&user=%7B%22id%22%3A7700123%7D')
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('tg-app')), true)
    assert.equal(await page.locator('.sidebar, .app-topbar, .public-topbar').count(), 0, 'Telegram draws the top bar')
    assert.deepEqual(await page.locator('.tg-tabbar a span').allInnerTexts(), ['Bosh sahifa', 'Vazifalar', 'Profil'])
    checks.push('Signed in from the launch data, sent to the account’s language, three places and no website frame')

    const tokens = await page.evaluate(() => ['--paper', '--surface', '--ink', '--action', '--link'].map((name) => document.documentElement.style.getPropertyValue(name)))
    assert.deepEqual(tokens.slice(0, 3), ['#efeff4', '#ffffff', '#000000'])
    // Telegram's blue under white text is 4.2:1: darkened just enough, its hue kept.
    assert.ok(contrast(tokens[3], '#ffffff') >= 4.5 && contrast(tokens[3], '#ffffff') < 5.2, tokens[3])
    assert.ok(contrast(tokens[4], '#efeff4') >= 4.5, tokens[4])
    assert.deepEqual((await calls(page, 'setHeaderColor')).at(-1), ['setHeaderColor', 'secondary_bg_color'])
    assert.equal((await telegramButton(page, 'SettingsButton')).isVisible, true)
    assert.equal((await telegramButton(page, 'BackButton')).isVisible, false, 'a tab is a root: Telegram shows Close')
    assert.ok(await page.getByTestId('home-invite').isVisible(), 'Free gift sits on Home, as in the bot')
    // Home asks for no file: what to do with one comes first, the file on the tool's own screen.
    assert.equal(await page.locator('main input[type="file"]').count(), 0, 'no file is asked for on Home')
    assert.ok(await page.getByTestId('home-files').isVisible(), 'the file tools follow the AI services')
    assert.match(await page.getByTestId('home-files').innerText(), /Fayl bilan ishlash/)
    await shot(page, 'home-light')
    checks.push('Telegram’s colours on the tokens and its bars, Settings in the ⋮ menu, Free gift on Home, and no file asked for there')

    // Telegram's own theme switch is followed at once.
    await page.evaluate((theme) => {
      Object.assign(window.__tg.app, { themeParams: theme, colorScheme: 'dark' })
      window.__tg.emit('themeChanged')
    }, DARK)
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark')
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--surface')), '#2c2c2e')
    checks.push('A theme changed in Telegram changes the app with it')

    // Profile, then a step away from it, with Telegram's Back and no bar.
    await page.locator('.tg-tabbar a', { hasText: 'Profil' }).click()
    await page.waitForURL('**/uz/app/account')
    await page.locator('.tg-cell').first().waitFor()
    assert.equal(await page.locator('.profile-signout').count(), 0, 'no signing out of a Telegram account')
    assert.deepEqual((await calls(page, 'haptic')).at(-1), ['haptic', 'selection'])
    const axe = await new AxeBuilder({ page }).include('.profile-page').include('.tg-tabbar').analyze()
    const serious = axe.violations.filter((item) => ['critical', 'serious'].includes(item.impact))
    assert.deepEqual(serious.map((item) => `${item.id}: ${item.nodes.map((node) => node.target.join(' ')).join(', ')}`), [], 'Profile accessibility')
    await shot(page, 'profile-dark')
    await page.locator('.tg-cell', { hasText: 'Do‘stlarni taklif qilish' }).click()
    await page.waitForURL('**/uz/app/referrals')
    await page.waitForFunction(() => window.__tg.app.BackButton.isVisible === true)
    assert.equal(await page.locator('.tg-tabbar').count(), 0)
    await page.evaluate(() => window.__tg.app.BackButton.press())
    await page.waitForURL('**/uz/app/account')
    // Back to a place: Telegram's Close again, once the frame has caught up with the address.
    await page.waitForFunction(() => window.__tg.app.BackButton.isVisible === false)
    checks.push('Profile has no sign-out; a step away hides the bar and shows Back, which returns; Profile passes axe in dark')

    // A link out opens in Telegram, the app left open.
    await page.locator('.tg-cell', { hasText: 'Do‘stlarni taklif qilish' }).click()
    await page.waitForURL('**/uz/app/referrals')
    await page.evaluate(() => {
      const link = Object.assign(document.createElement('a'), { href: 'https://t.me/docmaster_bot?start=ref_ABC', target: '_blank', textContent: 'out' })
      document.querySelector('main').append(link)
      link.click()
    })
    assert.deepEqual((await calls(page, 'openTelegramLink')).at(-1), ['openTelegramLink', 'https://t.me/docmaster_bot?start=ref_ABC'])
    assert.ok(page.url().endsWith('/uz/app/referrals'))
    checks.push('A t.me link opens through Telegram and the app stays where it was')
    await context.close()
  }

  // A start parameter opens one screen; Back leads home, where Telegram's Close is.
  {
    const { context, page } = await open({ startParam: 'plans' })
    await page.goto(`${origin}/uz/app`)
    await page.waitForURL('**/uz/app/billing')
    await settle(page)
    assert.equal((await telegramButton(page, 'BackButton')).isVisible, true)
    await page.evaluate(() => window.__tg.app.BackButton.press())
    await page.waitForURL(/\/uz\/app$/)
    checks.push('startapp=plans opens Plans, and Back leads to Home')
    await context.close()
  }

  // A result: Telegram's main button saves it to the phone; the file is in the chat too.
  {
    const { context, page, posted } = await open()
    await page.goto(`${origin}/uz/app/jobs/${JOB}`)
    await page.getByTestId('result-in-chat').waitFor()
    await settle(page)
    assert.equal(await page.locator('.artifact-row a[download]').count(), 0, 'a download link does nothing in a phone’s web view')
    // Opened straight from the chat: no way back in the app, so Back leads to Tasks.
    assert.equal((await telegramButton(page, 'BackButton')).isVisible, true)
    assert.deepEqual(await telegramButton(page, 'MainButton'), { text: 'Telefonga saqlash', isVisible: true, isActive: true })
    await page.evaluate(() => window.__tg.app.MainButton.press())
    await page.waitForFunction(() => window.__tg.app.MainButton.text === 'Saqlandi')
    assert.ok(posted.some(([endpoint]) => endpoint === `/artifacts/${ARTIFACT}/link`))
    assert.deepEqual((await calls(page, 'downloadFile')).at(-1)?.[1], { url: `${origin}/api/v1/artifacts/${ARTIFACT}/download?link=signed`, file_name: 'Ariza-rotated.pdf' })
    await shot(page, 'result')
    await page.evaluate(() => window.__tg.app.BackButton.press())
    await page.waitForURL('**/uz/app/jobs')
    checks.push('A result: no download link, Telegram saves it from a signed link, the chat note shows, Back leads to Tasks')
    await context.close()
  }

  // A tool step: Telegram's main button stays off until it can run (hideProgress must not switch it on).
  {
    const { context, page } = await open()
    await page.goto(`${origin}/uz/app/tools/pdf.rotate`)
    await page.locator('.tool-page').waitFor()
    await settle(page)
    assert.deepEqual(await telegramButton(page, 'MainButton'), { text: 'Vazifani tekshirish', isVisible: true, isActive: false })
    assert.equal(await page.locator('.tool-action > .button').isVisible(), false, 'the page’s button gives way to Telegram’s')
    checks.push('A tool’s main button waits, off, for a file; the page’s own button gives way to it')
    await context.close()
  }

  // The web view still holds another Telegram account's session: the one Telegram opened the app for signs in.
  {
    const other = { ...account, id: '00000000-0000-4000-8000-999999999999', display_name: 'Boshqa', telegram_user_id: '5550001' }
    const { context, page, posted } = await open({ sessionOf: other })
    await page.goto(`${origin}/uz/app`)
    await page.locator('.tg-tabbar a').first().waitFor()
    await settle(page)
    const order = posted.map(([endpoint]) => endpoint)
    assert.ok(order.indexOf('/auth/session') >= 0 && order.indexOf('/auth/session') < order.indexOf('/auth/telegram/miniapp'), order.join(' '))
    assert.match(await page.locator('.page-heading h1').innerText(), /Dilnoza/)
    checks.push('A session left by another Telegram account is signed out and the person Telegram opened the app for signs in')
    await context.close()
  }

  // A plain browser keeps the website's frame.
  {
    const { context, page } = await open({ initData: '', width: 1440 })
    await page.goto(`${origin}/en/app`)
    await page.locator('.auth-panel, .sidebar').first().waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('tg-app')), false)
    assert.equal(await page.locator('.tg-tabbar').count(), 0)
    checks.push('Outside Telegram nothing changes')
    await context.close()
  }

  assert.deepEqual(errors, [], 'no page errors')
  console.log(`Mini App: ${checks.length} checks passed`)
  for (const check of checks) console.log(`  ✓ ${check}`)
} finally {
  await browser.close()
}
