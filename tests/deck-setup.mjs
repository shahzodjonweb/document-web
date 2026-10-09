import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// The deck setup Mini App against fixtures: no live API, no Telegram. The
// count and design chosen here are sent as one setup call, and inside
// Telegram the app closes back to the chat afterwards.
const origin = process.env.STUDIO_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use the local web server')
const output = path.resolve(process.env.STUDIO_ARTIFACT_DIR || '../studio-review/deck-setup')
await fs.mkdir(output, { recursive: true })
const draftId = '00000000-0000-4000-8000-000000000042'
const account = {
  id: '00000000-0000-4000-8000-999999999999',
  display_name: 'Fixture Reader',
  locale: 'en',
  time_zone: 'UTC',
  mode: 'general',
  plan: 'premium',
  preferences: {},
  login_methods: { email: false, google: false, telegram: true },
}
const colours = (accent, fill, ink) => ({
  accent,
  surface: '#F8F9FA',
  cover_fill: fill,
  cover_ink: ink,
  heading: '#1F2328',
  ink: '#1F2328',
  muted: '#5B6779',
  accent_soft: '#DDE7F3',
  card: '#EEF1F4',
})
const design = (id, name, theme, accent, fill, ink, extra = {}) => ({
  id,
  name,
  theme,
  pattern: '',
  heading_font: 'Georgia',
  body_font: 'Calibri',
  colours: colours(accent, fill, ink),
  ...extra,
})
// Long enough that the category row has to scroll on a phone.
const fixture = {
  default_pages: 7,
  categories: [
    { id: 'classic', name: 'Classic', designs: [design('forest', 'Forest', 'light', '#1E6B45', '#F4F1E8', '#1A2B22'), design('boardroom', 'Boardroom', 'bold', '#1F3A68', '#1F3A68', '#FFFFFF')] },
    { id: 'business', name: 'Business', designs: [design('ledger', 'Ledger', 'light', '#14532D', '#F5F7F2', '#16201A', { pattern: 'grid' })] },
    { id: 'technology', name: 'Technology', designs: [design('circuit', 'Circuit', 'dark', '#00B37E', '#1A1E1C', '#F1F3F2', { pattern: 'grid' })] },
    { id: 'education', name: 'Education', designs: [design('lab', 'Lab', 'light', '#0284C7', '#FFFFFF', '#14202A', { pattern: 'hexagons' })] },
    { id: 'dark', name: 'Dark', designs: [design('obsidian', 'Obsidian', 'dark', '#A78BFA', '#1B1A22', '#F2F1F6', { pattern: 'glow' }), design('sapphire_night', 'Sapphire Night', 'dark', '#3B82F6', '#0F172A', '#F1F4F9', { pattern: 'rings' })] },
    { id: 'photo', name: 'Photo cover', designs: [design('horizon', 'Horizon', 'light', '#1F4E79', '#FFFFFF', '#15212D', { photo: true, pattern: 'waves' })] },
  ],
}
const realDesigns = process.env.DECK_DESIGNS_FIXTURE
if (realDesigns) Object.assign(fixture, JSON.parse(await fs.readFile(realDesigns, 'utf8')))
const draft = {
  id: draftId,
  feature_id: 'ai.pptx',
  version: 2,
  title: 'Tides',
  prompt: 'A dark green deck, 12 slides about tides',
  output_locale: 'en',
  output_format: 'pptx',
  options: { length: 12, requested_pages: 12, template_style: { deck_theme: 'dark' } },
  content: { title: 'Tides', sections: [], questions: [], citations: [] },
  expires_at: new Date(Date.now() + 300000).toISOString(),
}
const requests = []
const errors = []
const browser = await chromium.launch({ headless: true, channel: 'chrome' })

async function open(width, theme, insideTelegram) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', colorScheme: theme })
  await context.addInitScript((inside) => {
    window.__closed = false
    window.Telegram = {
      WebApp: {
        initData: inside ? 'fixture' : '',
        colorScheme: 'light',
        ready() {},
        expand() {},
        close() {
          window.__closed = true
        },
      },
    }
  }, insideTelegram)
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
    const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null
    requests.push({ path: endpoint, method, body, query: url.search })
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (endpoint === '/auth/session') return json({ user: account, development_login_enabled: false, csrf_token: 'fixture' })
    if (endpoint === '/auth/providers')
      return json({ email: { enabled: false }, google: { enabled: false }, telegram: { enabled: true }, antibot: { enabled: false } })
    if (endpoint === '/me') return json(account)
    if (endpoint === '/catalog') return json({ features: [], draft: false })
    if (endpoint === '/plans') return json({ plans: [], checkout_enabled: false })
    if (endpoint === '/usage') return json({ plan: 'premium', remaining: { ai_credits: 100, file_tasks: 100 } })
    if (endpoint === '/studio/config')
      return json({ provider: { mode: 'openai', configured: true }, default_pages: 5, features: [{ id: 'ai.pptx', name: 'Slides', surface: 'generate', eligible: true, max_pages: 15 }] })
    if (endpoint === '/studio/deck-designs') return json(fixture)
    if (endpoint === `/generation/drafts/${draftId}` && method === 'GET') return json(draft)
    if (endpoint === `/generation/drafts/${draftId}/setup` && method === 'POST') {
      const options = { ...draft.options, pages: body.pages, length: body.pages, deck_design: body.deck_design }
      return json({ draft: { ...draft, version: 3, options }, quote: { id: 'quote-2' } })
    }
    return json({}, 200)
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${origin}/en/app/deck-setup?draft=${draftId}`)
  await page.getByTestId('deck-setup-pages').waitFor()
  return { context, page }
}

for (const [width, theme] of [[390, 'light'], [1440, 'dark']]) {
  const { context, page } = await open(width, theme, width === 390)
  const stepper = page.getByTestId('deck-setup-pages')
  await page.screenshot({ path: path.join(output, `deck-setup-${width}-${theme}-opened.png`) })
  // The setup screen starts at seven, whatever the description asked for, and says so.
  assert.equal((await stepper.locator('strong').textContent()).trim(), '7')
  assert.match(await page.getByTestId('deck-setup-asked').textContent(), /asked for 12/)
  assert.equal(await page.getByTestId('deck-design-auto').getAttribute('aria-checked'), 'true')
  await page.getByTestId('deck-setup-more').click()
  assert.equal((await stepper.locator('strong').textContent()).trim(), '8')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.locator('[data-design="sapphire_night"]').click()
  assert.equal(await page.locator('[data-design="sapphire_night"]').getAttribute('aria-checked'), 'true')
  assert.equal(await page.getByTestId('deck-design-auto').getAttribute('aria-checked'), 'false')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}: horizontal overflow`)
  const audit = await new AxeBuilder({ page }).include('.deck-setup').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  assert.deepEqual(audit.violations.map((violation) => violation.id), [], `${width}/${theme}: accessibility`)
  await page.screenshot({ path: path.join(output, `deck-setup-${width}-${theme}.png`) })
  await page.getByTestId('deck-setup-save').click()
  await page.getByTestId('deck-setup-saved').waitFor()
  const sent = requests.filter((request) => request.path.endsWith('/setup'))
  assert.deepEqual(sent.at(-1).body, { pages: 8, deck_design: 'sapphire_night' })
  assert.ok(requests.some((request) => request.path === '/studio/deck-designs' && request.query === '?locale=en'))
  if (width === 390) {
    await page.waitForFunction(() => window.__closed === true)
  } else {
    await page.waitForTimeout(900)
    assert.equal(await page.evaluate(() => window.__closed), false, 'outside Telegram the page stays open')
  }
  await context.close()
}
assert.deepEqual(errors, [])
await browser.close()
console.log(`Pass: deck setup at 390 and 1440, light and dark; screenshots in ${output}`)
