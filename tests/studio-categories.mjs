import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// The AI PDF and AI Slides category picker on Create: the bot's lists from
// `GET /studio/categories` (fixtures/studio-categories.json is the server's own
// answer), a group's list, a category's screen with its instructions, files,
// example, language and weekly line, and one tap that makes the draft with
// `options.category`, quotes it and sends the job. Inside Telegram the tap is
// Telegram's main button and Back walks up the picker; in a plain browser the
// page has its own button and back link. Boshqa, and a server with no lists,
// are today's form. Telegram is a fake that records what it is asked.
const origin = process.env.CATEGORIES_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use the local web server')
const output = path.resolve(process.env.CATEGORIES_ARTIFACT_DIR || '../studio-review/categories')
await fs.mkdir(output, { recursive: true })
const fixture = JSON.parse(await fs.readFile(new URL('./fixtures/studio-categories.json', import.meta.url), 'utf8'))
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const checks = []
const errors = []

const account = {
  id: '00000000-0000-4000-8000-777777777777', display_name: 'Dilnoza Karimova', locale: 'uz', time_zone: 'UTC',
  mode: 'general', plan: 'free', preferences: {}, telegram_user_id: 7700123,
  login_methods: { email: false, google: false, telegram: true },
}
const week = { starts_at: '2026-11-22T19:00:00Z', resets_at: '2026-11-29T19:00:00Z', time_zone: 'Asia/Tashkent' }
const allowance = (limit, used) => ({ limit, used, remaining: limit === null ? null : limit - used })
const studioFeature = (id) => ({
  id, name: id, surface: 'generate', eligible: true, requires_provider: false, max_pages: 40, max_images: 0,
  parameter_schema: { output_locale: { enum: ['en', 'uz', 'ru'] }, output_format: { enum: [id === 'ai.pptx' ? 'pptx' : 'pdf'] } },
  locales: ['en', 'uz', 'ru'],
})
const DRAFT = '9b1f7e4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const JOB = '6cfd655d-9028-4761-8e94-4dbfe6da0ef2'
const UPLOAD = '3a4b5c6d-7e8f-4a0b-9c1d-2e3f4a5b6c7d'
const job = {
  id: JOB, feature_id: 'ai.pdf_topic', status: 'queued', created_at: '2026-11-27T16:03:00Z', input_files: [],
  warnings: [], error: null, parameters: {}, origin_channel: 'mini_app', artifacts: [],
}
const LIGHT = {
  bg_color: '#ffffff', text_color: '#000000', hint_color: '#999999', link_color: '#2481cc', button_color: '#2481cc',
  button_text_color: '#ffffff', secondary_bg_color: '#efeff4', section_bg_color: '#ffffff',
  section_separator_color: '#c8c7cc', subtitle_text_color: '#999999',
}
const DARK = {
  bg_color: '#000000', text_color: '#ffffff', hint_color: '#98989e', link_color: '#3e88f7', button_color: '#3e88f7',
  button_text_color: '#ffffff', secondary_bg_color: '#1c1c1d', section_bg_color: '#2c2c2e',
  section_separator_color: '#545458', subtitle_text_color: '#98989e',
}
const EMOJI = /^[\u{1F000}-\u{1FAFF}←-⇿⌀-⏿①-➿⬀-⯿]/u

/** Telegram's WebApp object, recording what it is asked; empty `initData` is a plain browser. */
function fakeTelegram({ initData, theme, scheme }) {
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
      show() { state.isVisible = true },
      hide() { state.isVisible = false },
      showProgress() { state.isProgressVisible = true; state.isActive = false },
      hideProgress() { state.isProgressVisible = false; state.isActive = true },
      onClick(fn) { state.clicks.push(fn) },
      offClick(fn) { state.clicks = state.clicks.filter((item) => item !== fn) },
      press() { state.clicks.forEach((fn) => fn()) },
    })
  }
  const app = {
    initData,
    initDataUnsafe: initData ? { user: { id: 7700123, allows_write_to_pm: true } } : {},
    version: '8.0', platform: initData ? 'ios' : 'unknown', colorScheme: scheme, themeParams: theme,
    viewportStableHeight: innerHeight,
    isVersionAtLeast: (version) => Number(version) <= 8.0,
    ready() {}, expand() {}, close() { calls.push(['close']) },
    setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {},
    openLink(url) { calls.push(['openLink', url]) }, openTelegramLink(url) { calls.push(['openTelegramLink', url]) },
    showConfirm(message, callback) { callback(true) },
    requestWriteAccess(callback) { callback(true) },
    onEvent(name, fn) { (handlers[name] ||= []).push(fn) },
    offEvent(name, fn) { handlers[name] = (handlers[name] || []).filter((item) => item !== fn) },
    HapticFeedback: { selectionChanged() { calls.push(['haptic', 'selection']) }, impactOccurred() {}, notificationOccurred() {} },
    MainButton: button('MainButton'), BackButton: button('BackButton'), SettingsButton: button('SettingsButton'),
    SecondaryButton: button('SecondaryButton'),
  }
  window.Telegram = { WebApp: app }
  window.__tg = { calls, handlers, app }
}

async function open({ telegram = true, theme = LIGHT, scheme = 'light', lists = fixture.uz, quote = {}, draftRefusal = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', colorScheme: scheme })
  const initData = telegram ? 'auth_date=1&hash=fixture&user=%7B%22id%22%3A7700123%7D' : ''
  await context.addInitScript(fakeTelegram, { initData, theme, scheme })
  const posted = []
  let made = null
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin === origin || url.protocol === 'data:') return route.continue()
    if (url.hostname === 'telegram.org') return route.fulfill({ contentType: 'application/javascript', body: '' })
    return route.abort('blockedbyclient')
  })
  await context.route(`${origin}/api/v1/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const endpoint = url.pathname.replace('/api/v1', '')
    const method = request.method()
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    let body = null
    if (method !== 'GET') {
      try { body = request.postDataJSON() } catch { body = request.postData() }
      posted.push([endpoint, body])
    }
    if (endpoint === '/auth/telegram/miniapp') return json({ user: account })
    if (endpoint === '/auth/session') return json({ user: account, development_login_enabled: false, csrf_token: 'fixture' })
    if (endpoint === '/auth/providers')
      return json({ email: { enabled: false }, google: { enabled: false }, telegram: { enabled: true, configured: true }, antibot: { enabled: false, configured: false, site_key: '', binding: '' } })
    if (endpoint === '/me') return json(account)
    if (endpoint === '/catalog') return json({ features: [], draft: false })
    if (endpoint === '/plans') return json({ plans: [], currency: 'UZS', period_seconds: 2592000, draft: true })
    if (endpoint === '/usage')
      return json({ plan: 'free', week, resets_at: week.resets_at, edits_per_file: 3, ai_documents: allowance(5, 1), file_jobs: allowance(15, 3) })
    if (endpoint === '/channels') return json({ required: false, joined: true, channels: [] })
    if (endpoint === '/studio/config')
      return json({ provider: { id: 'openai', mode: 'openai', label: 'OpenAI', configured: true },
        features: ['ai.pdf_topic', 'ai.pptx', 'ai.cv'].map(studioFeature), default_pages: 10, limits: { source_chars: 12000 } })
    if (endpoint === '/studio/categories') return json({ features: lists, locale: url.searchParams.get('locale') })
    if (endpoint === '/studio/categories/chosen') return json({ recorded: true })
    if (endpoint === '/files/uploads')
      return json({ id: UPLOAD, name: 'reja.txt', size_bytes: 120, page_count: 1, mime_type: 'text/plain', state: 'ready' }, 201)
    if (endpoint === '/generation/drafts' && method === 'POST') {
      if (draftRefusal) return json({ error: draftRefusal }, draftRefusal.code === 'category_unavailable' ? 409 : 400)
      made = { id: DRAFT, feature_id: body.feature_id, version: 1, provider_mode: 'openai', expires_at: null,
        title: body.title, prompt: body.prompt, source_text: '', source_ids: body.source_ids || [],
        output_locale: body.output_locale, output_format: body.output_format,
        options: { ...body.options, length: 10 }, content: { title: body.title, sections: [], questions: [] } }
      return json(made, 201)
    }
    if (endpoint === `/generation/drafts/${DRAFT}` && made) return json(made)
    if (endpoint === `/generation/drafts/${DRAFT}/quote`)
      return json({ id: 'quote-1', expires_at: '2099-01-01T00:00:00Z', affordable: true, usage: { ai_documents: allowance(5, 1) }, ...quote }, 201)
    if (endpoint === '/jobs' && method === 'POST') return json(job, 201)
    if (endpoint === '/jobs') return json({ results: [job], count: 1 })
    if (endpoint === `/jobs/${JOB}`) return json(job)
    if (endpoint.startsWith('/billing/')) return json({ results: [], plan: 'free', subscription: null })
    return json({})
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', (error) => errors.push(error.message))
  return { context, page, posted }
}
const telegramButton = (page, name) =>
  page.evaluate((key) => {
    const { text, isVisible, isActive } = window.__tg.app[key]
    return { text, isVisible, isActive }
  }, name)
const pressTelegram = (page, name) => page.evaluate((key) => window.__tg.app[key].press(), name)
const shot = (page, name) => page.screenshot({ path: `${output}/${name}.png`, fullPage: true })
const rows = (page) => page.locator('.category-cell .tg-cell-text strong').allInnerTexts()
const serious = async (page, selector) => {
  const found = await new AxeBuilder({ page }).include(selector).analyze()
  return found.violations.filter((item) => ['critical', 'serious'].includes(item.impact))
    .map((item) => `${item.id}: ${item.nodes.map((node) => node.target.join(' ')).join(', ')}`)
}
const pdfTop = fixture.uz['ai.pdf_topic']
const mustaqil = pdfTop[0]

try {
  // Inside Telegram, light: the list, a group, Back, a category's screen and the one tap.
  {
    const { context, page, posted } = await open()
    await page.goto(`${origin}/uz/app/create?feature=ai.pdf_topic`)
    await page.getByTestId('category-picker').waitFor()
    await page.waitForLoadState('networkidle')
    assert.deepEqual(await rows(page), pdfTop.map((node) => node.label))
    assert.deepEqual(await page.locator('.category-count').allInnerTexts(), ['7', '6'])
    assert.equal(await page.locator('.category-head h1').innerText(), 'PDF hujjat')
    assert.equal(await page.locator('[data-testid="category-pdf.mustaqil_ish"] small').innerText(), 'Titul, reja, matn va adabiyotlar · 8–20 sahifa')
    assert.equal(await page.locator('[data-testid="category-other"] small').innerText(), 'Istalgan hujjat: o‘zingiz yozib bering')
    assert.match(await page.getByTestId('category-files-note').innerText(), /PDF, Word yoki TXT/)
    assert.equal(await page.locator('.studio-steps, .studio-head').count(), 0, 'the picker stands in for the steps')
    assert.equal((await telegramButton(page, 'MainButton')).isVisible, false, 'nothing to make on a list')
    assert.equal((await telegramButton(page, 'BackButton')).isVisible, true)
    assert.deepEqual(await serious(page, '.category-picker'), [], 'the list passes axe')
    await shot(page, 'pdf-list-light')
    checks.push('AI PDF opens with the bot’s list in its order: names without emoji, lines, counts, the files note')

    await page.locator('[data-testid="category-pdf.biz"]').click()
    await page.locator('[data-screen="group"]').waitFor()
    assert.equal(await page.locator('.category-head h1').innerText(), 'Biznes va ish')
    assert.deepEqual(await rows(page), pdfTop[5].children.map((node) => node.label))
    assert.equal(await page.locator('[data-testid="category-other"] small').innerText(), 'O‘zingiz yozib bering')
    assert.equal(await page.locator('.category-cell small').count(), 1, 'inside a group only Boshqa has a line')
    await shot(page, 'pdf-group-light')
    await pressTelegram(page, 'BackButton')
    await page.locator('[data-screen="list"]').waitFor()
    assert.ok(page.url().endsWith('/uz/app/create?feature=ai.pdf_topic'), 'Back walks up the picker, not out of the page')
    checks.push('A group opens its own list, and Telegram’s Back returns to the top without leaving Create')

    await page.locator('[data-testid="category-pdf.mustaqil_ish"]').click()
    await page.getByTestId('category-screen').waitFor()
    assert.equal(await page.locator('.category-title h1').innerText(), 'Mustaqil ish / Referat')
    const brief = await page.locator('[data-testid="category-brief"] p').allInnerTexts()
    assert.deepEqual(brief, mustaqil.prompt)
    assert.ok(brief.every((line) => !EMOJI.test(line)), 'the instructions carry no emoji')
    assert.ok(parseFloat(await page.getByTestId('studio-primary-input').evaluate((node) => getComputedStyle(node).fontSize)) >= 16)
    assert.ok(await page.getByTestId('category-add-file').isVisible())
    assert.equal(await page.getByTestId('category-create').isVisible(), false, 'the page’s button gives way to Telegram’s')
    assert.deepEqual(await telegramButton(page, 'MainButton'), { text: 'Hujjat yaratish', isVisible: true, isActive: false })
    // Counted without waiting for: the request goes out beside the screen.
    for (let tries = 0; tries < 50 && !posted.some(([endpoint]) => endpoint === '/studio/categories/chosen'); tries += 1)
      await page.waitForTimeout(50)
    assert.deepEqual(posted.find(([endpoint]) => endpoint === '/studio/categories/chosen')?.[1], { category: 'pdf.mustaqil_ish' })
    assert.match(await page.getByTestId('weekly-line').innerText(), /5/)
    checks.push('A category’s screen: its own instructions without emoji, a 16px description, files, Telegram’s button off until written; the opening is counted')

    await page.getByTestId('category-example').click()
    assert.equal(await page.getByTestId('studio-primary-input').inputValue(), mustaqil.examples[0])
    assert.deepEqual(await telegramButton(page, 'MainButton'), { text: 'Hujjat yaratish', isVisible: true, isActive: true })
    await page.getByTestId('category-file-input').setInputFiles({ name: 'rasm.png', mimeType: 'image/png', buffer: Buffer.from('png') })
    assert.match(await page.getByTestId('category-file-error').innerText(), /faqat PDF, Word yoki TXT/)
    assert.ok(!posted.some(([endpoint]) => endpoint === '/files/uploads'), 'a picture is refused before it is sent')
    await page.getByTestId('category-file-input').setInputFiles({ name: 'reja.txt', mimeType: 'text/plain', buffer: Buffer.from('1. Kirish\n2. Asosiy qism') })
    await page.locator('[data-testid="category-files"] li').waitFor()
    assert.match(String(posted.find(([endpoint]) => endpoint === '/files/uploads')?.[1]), /name="purpose"\s+ai_source/)
    await shot(page, 'category-light')
    checks.push('The example fills the description; a picture is refused beside the button; a TXT goes up as ai_source')

    await pressTelegram(page, 'BackButton')
    await page.locator('[data-screen="list"]').waitFor()
    assert.equal((await telegramButton(page, 'MainButton')).isVisible, false)
    await page.locator('[data-testid="category-pdf.mustaqil_ish"]').click()
    assert.equal(await page.getByTestId('studio-primary-input').inputValue(), mustaqil.examples[0], 'what was written waits')
    await pressTelegram(page, 'MainButton')
    await page.waitForURL(`**/uz/app/jobs/${JOB}`)
    const draft = posted.find(([endpoint]) => endpoint === '/generation/drafts')?.[1]
    assert.equal(draft.feature_id, 'ai.pdf_topic')
    assert.equal(draft.options.category, 'pdf.mustaqil_ish')
    assert.deepEqual(draft.source_ids, [UPLOAD])
    assert.equal(draft.prompt, mustaqil.examples[0])
    assert.deepEqual(posted.find(([endpoint]) => endpoint === '/jobs')?.[1], { quote_id: 'quote-1', deliver_to_chat: true })
    checks.push('Telegram’s button makes the draft with options.category and its file, quotes it and sends the job to the chat in one tap')
    await context.close()
  }

  // Inside Telegram, dark: the same screens in the customer's dark theme.
  {
    const { context, page } = await open({ theme: DARK, scheme: 'dark' })
    await page.goto(`${origin}/uz/app/create?feature=ai.pdf_topic`)
    await page.getByTestId('category-picker').waitFor()
    await page.waitForLoadState('networkidle')
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark')
    assert.deepEqual(await serious(page, '.category-picker'), [], 'the list passes axe in dark')
    await shot(page, 'pdf-list-dark')
    await page.locator('[data-testid="category-pdf.mustaqil_ish"]').click()
    await page.getByTestId('category-screen').waitFor()
    await page.getByTestId('category-example').click()
    assert.deepEqual(await serious(page, '.category-screen'), [], 'the category screen passes axe in dark')
    await shot(page, 'category-dark')
    await page.goto(`${origin}/uz/app/create?feature=ai.pptx`)
    await page.getByTestId('category-picker').waitFor()
    assert.equal(await page.locator('.category-head h1').innerText(), 'PowerPoint taqdimot')
    assert.deepEqual(await rows(page), fixture.uz['ai.pptx'].map((node) => node.label))
    assert.equal(await page.locator('[data-testid="category-other"] small').innerText(), 'Istalgan taqdimot: o‘zingiz yozib bering')
    await shot(page, 'slides-list-dark')
    checks.push('Telegram’s dark theme: the lists and a category pass axe; AI Slides opens with its own list')
    await context.close()
  }

  // A plain browser: the page's own button and back link; Boshqa is today's form.
  {
    const { context, page, posted } = await open({ telegram: false })
    await page.goto(`${origin}/uz/app/create?feature=ai.pdf_topic`)
    await page.getByTestId('category-picker').waitFor()
    await page.locator('[data-testid="category-pdf.xat"]').click()
    await page.locator('[data-testid="category-pdf.xat.ariza"]').click()
    await page.getByTestId('category-screen').waitFor()
    assert.equal(await page.locator('.category-screen .back-link').innerText(), 'Xat va hujjatlar')
    assert.ok(await page.getByTestId('category-create').isVisible())
    assert.equal(await page.getByTestId('category-create').isDisabled(), true)
    assert.equal(await page.evaluate(() => window.__tg.calls.some(([call]) => call === 'MainButton.setParams')), false)
    await shot(page, 'category-browser')
    await page.locator('.category-screen .back-link').click()
    await page.locator('[data-screen="group"]').waitFor()
    await page.locator('[data-testid="category-other"]').click()
    await page.getByTestId('studio-brief').waitFor()
    assert.ok(await page.getByTestId('studio-purpose').isVisible(), 'Boshqa is today’s form, unchanged')
    assert.equal(await page.getByTestId('category-back').innerText(), 'Xat va hujjatlar')
    await page.getByTestId('studio-primary-input').fill('Maktab direktoriga ta’til uchun ariza.')
    await page.getByTestId('studio-review').click()
    await page.waitForURL(`**/uz/app/create/${DRAFT}`)
    const draft = posted.find(([endpoint]) => endpoint === '/generation/drafts')?.[1]
    assert.equal(draft.options.category, undefined, 'Boshqa sends no category')
    checks.push('In a browser the page’s own Create and back link; Boshqa is today’s form and sends no category')
    await context.close()
  }

  // No list from the server (switched off, or an older server): today's form at once.
  {
    const { context, page } = await open({ lists: { 'ai.pdf_topic': [], 'ai.pptx': [] } })
    await page.goto(`${origin}/uz/app/create?feature=ai.pdf_topic`)
    await page.getByTestId('studio-brief').waitFor()
    assert.equal(await page.getByTestId('category-picker').count(), 0)
    assert.equal(await page.getByTestId('category-back').count(), 0)
    checks.push('With no list from the server, Create is today’s form')
    await context.close()
  }

  // The review speaks first when there is something to say: no document left this week.
  {
    const { context, page, posted } = await open({ quote: { affordable: false, usage: { ai_documents: allowance(5, 5) } } })
    await page.goto(`${origin}/uz/app/create?feature=ai.pdf_topic&category=pdf.konspekt`)
    await page.getByTestId('category-screen').waitFor()
    await page.getByTestId('category-example').click()
    await pressTelegram(page, 'MainButton')
    await page.getByTestId('weekly-limit').waitFor()
    assert.ok(!posted.some(([endpoint]) => endpoint === '/jobs'), 'nothing is sent past the weekly limit')
    checks.push('A category in the address opens its screen; past the weekly limit the review says so and nothing is sent')
    await context.close()
  }

  // A category the owner took off the list meanwhile: said, and back on the list.
  {
    const { context, page } = await open({ draftRefusal: { code: 'category_unavailable', message: 'x', message_params: {} } })
    await page.goto(`${origin}/uz/app/create?feature=ai.pdf_topic&category=pdf.test`)
    await page.getByTestId('category-screen').waitFor()
    await page.getByTestId('category-example').click()
    await pressTelegram(page, 'MainButton')
    await page.locator('[data-screen="list"]').waitFor()
    assert.match(await page.locator('.error-banner, [role="alert"]').first().innerText(), /Bu tur endi yo‘q/)
    checks.push('A category no longer offered is said, and the customer is back on the list')
    await context.close()
  }

  assert.deepEqual(errors, [], 'no page errors')
  console.log(`Category picker: ${checks.length} checks passed`)
  for (const check of checks) console.log(`  ✓ ${check}`)
} finally {
  await browser.close()
}
