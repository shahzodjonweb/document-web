import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// The frame around every screen: the grouped sidebar, the top bar with the
// plan chip, the phone bar and its "More" sheet, the skip link, the theme
// toggle, and the plain frame a visitor who is not signed in sees.
const origin = process.env.FRAME_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use the local web server')
const output = path.resolve(process.env.FRAME_ARTIFACT_DIR || '../studio-review/app-frame')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
const page = await context.newPage()
page.setDefaultTimeout(10000)
const errors = []
const checks = []
page.on('pageerror', (error) => errors.push(error.message))

let signedIn = true
const account = {
  id: '00000000-0000-4000-8000-777777777777', display_name: 'Dilnoza Karimova', locale: 'en', time_zone: 'UTC',
  mode: 'general', plan: 'free', preferences: {}, login_methods: { email: false, google: false, telegram: true },
}
// Only the three weekly limits differ by plan; saved workflows, like every
// other limit, are the same on all of them.
const limits = (documents, files, edits) =>
  ({ weekly_ai_documents: documents, weekly_file_jobs: files, edits_per_file: edits, saved_workflows: 20 })
const plans = [
  { id: 'free', name: 'Free', price_xtr: 0, limits: limits(5, 15, 3) },
  { id: 'plus', name: 'Plus', price_xtr: null, limits: limits(20, null, 10) },
  { id: 'premium', name: 'Premium', price_xtr: null, limits: limits(null, null, null) },
]
// This week, as /usage reports it: a null limit is unlimited.
const allowance = (limit, used) => ({ limit, used, remaining: limit === null ? null : limit - used })
const week = { starts_at: '2026-10-11T19:00:00Z', resets_at: '2026-10-18T19:00:00Z', time_zone: 'Asia/Tashkent' }
let providers = { email: false, google: false, telegram: true }

await context.route('**/*', (route) => {
  const url = new URL(route.request().url())
  if (url.origin === origin || url.protocol === 'data:') return route.continue()
  if (url.hostname === 'telegram.org') return route.fulfill({ contentType: 'application/javascript', body: '' })
  return route.abort('blockedbyclient')
})
await context.route(`${origin}/api/v1/**`, async (route) => {
  const request = route.request()
  const endpoint = new URL(request.url()).pathname.replace('/api/v1', '')
  const json = (value, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
  if (endpoint === '/auth/session') {
    if (request.method() === 'DELETE') signedIn = false
    return json({ user: signedIn ? account : null, development_login_enabled: false, csrf_token: 'fixture' })
  }
  if (endpoint === '/auth/providers')
    return json({
      ...Object.fromEntries(Object.entries(providers).map(([key, on]) => [key, { enabled: on, configured: on }])),
      antibot: { enabled: false, configured: false, site_key: '', binding: '' },
    })
  if (endpoint === '/me') return json(account)
  if (endpoint === '/catalog') return json({ features: [], draft: false })
  if (endpoint === '/plans') return json({ plans, checkout_enabled: false, currency: 'XTR', draft: true })
  if (endpoint === '/usage') {
    const plan = plans.find((row) => row.id === account.plan).limits
    return json({
      plan: account.plan, week, resets_at: week.resets_at, edits_per_file: plan.edits_per_file,
      ai_documents: allowance(plan.weekly_ai_documents, 1),
      file_jobs: allowance(plan.weekly_file_jobs, 3),
    })
  }
  if (endpoint === '/channels') return json({ required: false, joined: true, channels: [] })
  if (endpoint === '/studio/config')
    return json({ provider: { mode: 'openai', configured: true }, features: [], default_pages: 10 })
  if (endpoint === '/jobs') return json({ results: [], count: 0 })
  if (endpoint === '/billing/manual')
    return json({ enabled: true, currency: 'UZS', period_days: 30, automatic: { available: false }, plans: [], payment: null })
  if (endpoint.startsWith('/billing/')) return json({ results: [], offers: [], plan: account.plan, subscription: null })
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
  const result = await new AxeBuilder({ page })
    .include('.sidebar')
    .include('.app-topbar')
    .include('.mobile-nav')
    .include('.public-topbar')
    .include('.auth-panel')
    .analyze()
  const serious = result.violations.filter((item) => ['critical', 'serious'].includes(item.impact))
  assert.deepEqual(
    serious.map((item) => `${item.id}: ${item.nodes.map((node) => node.target.join(' ')).join(', ')}`),
    [],
    `${label} accessibility`,
  )
}
const shot = async (name) => {
  await page.mouse.move(0, page.viewportSize().height - 1) // no hover state in the picture
  await page.screenshot({ path: `${output}/${name}.png` })
}
const names = (locator) => locator.evaluateAll((items) => items.map((item) => item.textContent.trim()))

try {
  // Desktop: two groups, the plan chip, the page title.
  await go('/en/app')
  const sidebar = page.locator('.sidebar')
  await sidebar.locator('.side-nav a').first().waitFor()
  assert.deepEqual(await names(sidebar.locator('.nav-group')), ['Work', 'Account'])
  // Free has saved workflows too, now that every plan has every tool.
  assert.deepEqual(await names(sidebar.locator('.side-nav a')), [
    'Home', 'Create with AI', 'Tools', 'PDF editor', 'Tasks', 'Saved workflows',
    'Plan & billing', 'Settings', 'Help', 'Prompt guide',
  ])
  assert.equal(await page.getByText('Local bot').count(), 0, 'the development bot is not in the customer menu')
  assert.equal(await page.locator('.topbar-title').innerText(), 'Home')
  const chip = page.locator('.plan-chip')
  assert.equal(await chip.innerText().then((text) => text.replace(/\s+/g, ' ')), 'Free 12 tasks left')
  assert.equal(await chip.getAttribute('href'), '/en/app/billing')
  checks.push('Sidebar has Work and Account groups, saved workflows on Free; no Local bot; the top bar shows the page and tasks left')

  await page.locator('.side-nav a', { hasText: 'Tools' }).click()
  await page.waitForURL('**/en/app/tools')
  assert.equal(await page.locator('.topbar-title').innerText(), 'Tools')
  assert.equal(await page.locator('.side-nav a.active').innerText(), 'Tools')
  checks.push('The title and the highlighted item follow the page')

  for (const mode of ['light', 'dark']) {
    await go('/en/app')
    await theme(mode)
    await page.waitForTimeout(100)
    assert.equal(await overflow(), false, `desktop ${mode} overflow`)
    await axe(`desktop ${mode}`)
    await shot(`home-1440-${mode}`)
  }
  await theme('light')

  // A long page: the sidebar runs its full height and stays in view.
  await go('/en/app/billing')
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(100)
  const heights = await page.evaluate(() => ({
    page: document.documentElement.scrollHeight,
    sidebar: document.querySelector('.sidebar').getBoundingClientRect().height,
    brandTop: document.querySelector('.sidebar-brand').getBoundingClientRect().top,
    topbarTop: document.querySelector('.app-topbar').getBoundingClientRect().top,
  }))
  assert.ok(heights.sidebar >= heights.page - 1, `sidebar ${heights.sidebar} spans the page ${heights.page}`)
  assert.ok(heights.brandTop >= 0 && heights.brandTop < 60, 'the sidebar stays in view at the bottom of a page')
  assert.equal(heights.topbarTop, 0, 'the top bar stays at the top')
  await shot('billing-bottom-1440')
  checks.push('On a long page the sidebar spans the full height and its menu stays in view')

  // Plus has the same menu; its unlimited file tasks show no count.
  account.plan = 'plus'
  await go('/en/app')
  await sidebar.locator('.side-nav a').first().waitFor()
  assert.ok((await names(sidebar.locator('.side-nav a'))).includes('Saved workflows'))
  assert.equal(await page.locator('.plan-chip').innerText().then((text) => text.trim()), 'Plus',
    'unlimited file tasks show no count')
  // A cap set to zero still hides the page, since it could save nothing.
  plans[1].limits.saved_workflows = 0
  await go('/en/app')
  await sidebar.locator('.side-nav a').first().waitFor()
  assert.ok(!(await names(sidebar.locator('.side-nav a'))).includes('Saved workflows'))
  plans[1].limits.saved_workflows = 20
  account.plan = 'free'
  checks.push('Saved workflows is on every plan unless its cap is zero; unlimited file tasks show no count')

  // Skip link: hidden until focused, then visible and it moves focus to the page.
  await go('/en/app')
  const skip = page.locator('.skip-link')
  assert.ok((await skip.boundingBox()).width <= 1, 'the skip link is out of sight')
  await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement?.className), 'skip-link')
  const box = await skip.boundingBox()
  assert.ok(box.width > 60 && box.y >= 0, 'the focused skip link is visible')
  await shot('skip-link-1440')
  await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content')
  checks.push('The skip link stays out of sight until focused, then moves focus to the content')

  // Theme toggle: remembered, and its label says what it will do.
  const toggle = page.locator('.theme-toggle')
  assert.equal(await toggle.getAttribute('aria-label'), 'Switch to dark theme')
  await toggle.click()
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark')
  assert.equal(await page.evaluate(() => localStorage.getItem('pdf-master-theme')), 'dark')
  assert.equal(await toggle.getAttribute('aria-label'), 'Switch to light theme')
  await toggle.click()
  checks.push('The theme toggle switches and remembers light and dark')

  // Phone: the bottom bar and the "More" sheet.
  await page.setViewportSize({ width: 390, height: 844 })
  for (const mode of ['light', 'dark']) {
    await go('/en/app')
    await theme(mode)
    const bar = page.locator('.mobile-nav')
    await bar.waitFor()
    assert.equal(await sidebar.isVisible(), false)
    assert.deepEqual(await names(bar.locator('a, button')), ['Home', 'Create', 'Tools', 'Tasks', 'More'])
    assert.equal(await overflow(), false, `phone ${mode} overflow`)
    await axe(`phone ${mode}`)
    await shot(`home-390-${mode}`)
    await bar.getByRole('button', { name: 'More' }).click()
    const sheet = page.locator('.more-sheet')
    await sheet.waitFor()
    assert.deepEqual(await names(sheet.locator('.sheet-nav a')), [
      'PDF editor', 'Saved workflows', 'Plan & billing', 'Settings', 'Help', 'Prompt guide',
    ])
    assert.equal(
      await sheet.locator('.sheet-prefs .button').innerText(),
      mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      'the toggle follows a theme set elsewhere (Settings)',
    )
    const sheetAxe = await new AxeBuilder({ page }).include('.more-sheet').analyze()
    assert.deepEqual(
      sheetAxe.violations.filter((item) => ['critical', 'serious'].includes(item.impact)).map((item) => item.id),
      [],
      `sheet ${mode} accessibility`,
    )
    await shot(`more-390-${mode}`)
    await page.keyboard.press('Escape')
    await sheet.waitFor({ state: 'hidden' })
  }
  await theme('light')
  checks.push('Phones get Home, Create, Tools, Tasks and More; the sheet holds the rest and closes on Escape')

  await page.locator('.mobile-nav').getByRole('button', { name: 'More' }).click()
  await page.locator('.sheet-nav a', { hasText: 'Settings' }).click()
  await page.waitForURL('**/en/app/settings')
  await page.locator('.more-sheet').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('.mobile-nav button.active').count(), 1, 'More is marked while on a page it holds')
  checks.push('Choosing a page from the sheet opens it and closes the sheet')

  // Signing out from the sheet leads to the plain sign-in frame.
  await page.locator('.mobile-nav').getByRole('button', { name: 'More' }).click()
  await page.locator('.sheet-account').getByRole('button', { name: 'Sign out' }).click()
  await page.locator('.auth-panel').waitFor()
  assert.equal(await page.locator('.mobile-nav').count(), 0)
  assert.equal(await page.locator('.sidebar').count(), 0)
  assert.equal(await page.locator('.public-topbar').count(), 1)
  checks.push('Signing out from the sheet shows the sign-in page without the app menu')

  // A visitor: only the ways in that work, Telegram first.
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await page.setViewportSize({ width, height })
    await go('/en/app')
    await page.getByRole('button', { name: 'Continue with Telegram' }).waitFor()
    assert.equal(await page.locator('.auth-divider').count(), 0)
    assert.equal(await page.locator('.auth-form').count(), 0)
    assert.equal(await page.getByText(/not available|unavailable/i).count(), 0)
    assert.equal(await overflow(), false, `sign-in ${width} overflow`)
    await axe(`sign-in ${width}`)
    await shot(`sign-in-${width}`)
  }
  checks.push('A visitor sees the sign-in page in the public frame, with only working methods')

  assert.deepEqual(errors, [])
  const report = { status: 'passed', checks }
  await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
