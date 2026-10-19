import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// The CV template Mini App against fixtures: no live API, no Telegram. The
// template chosen here is sent as one setup call, and inside Telegram the app
// closes back to the chat afterwards. Every person and template is fictional.
const origin = process.env.STUDIO_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use the local web server')
const output = path.resolve(process.env.STUDIO_ARTIFACT_DIR || '../studio-review/cv-setup')
await fs.mkdir(output, { recursive: true })
const draftId = '00000000-0000-4000-8000-000000000051'
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
const template = (id, name, category, drawer, accent, extra = {}) => ({
  id,
  name,
  category,
  drawer,
  photo: false,
  tone: 'light',
  preview: `/api/v1/studio/cv-templates/${id}.png?locale=en&v=fixture`,
  fonts: { heading: 'sans', body: 'sans' },
  colours: { accent, secondary: '#B08D57', tint: '#FFFFFF', ink: '#1A1A1A', fill: accent },
  ...extra,
})
// Long enough that the category row has to scroll on a phone, as the real six do.
const fixture = {
  default: 'classic_navy',
  categories: [
    {
      id: 'classic',
      name: 'Classic',
      templates: [
        template('classic_navy', 'Classic Navy', 'classic', 'column', '#1F3A68', { fonts: { heading: 'serif', body: 'sans' } }),
        template('charter', 'Charter', 'classic', 'column', '#14284B', { fonts: { heading: 'serif', body: 'serif' } }),
        template('oxford', 'Oxford', 'classic', 'timeline', '#0B3954'),
        template('ivory', 'Ivory', 'classic', 'column', '#3B2540', { tone: 'paper', colours: { accent: '#3B2540', secondary: '#B08D57', tint: '#FAF5EA', ink: '#1A1A1A', fill: '#3B2540' } }),
        template('slate_portrait', 'Slate Portrait', 'classic', 'column', '#37474F', { photo: true }),
      ],
    },
    {
      id: 'modern',
      name: 'Modern',
      templates: [
        template('azure_side', 'Azure Side', 'modern', 'sidebar_left', '#0F4C81', { photo: true, colours: { accent: '#0F4C81', secondary: '#5DA9E9', tint: '#EAF2FA', ink: '#1A1A1A', fill: '#0F4C81' } }),
        template('coral_band', 'Coral Band', 'modern', 'band', '#9F1239', { photo: true, tone: 'dark' }),
      ],
    },
    { id: 'minimal', name: 'Minimal', templates: [template('hairline', 'Hairline', 'minimal', 'centered', '#1C1917'), template('nordic', 'Nordic', 'minimal', 'compact', '#263238')] },
    {
      id: 'creative',
      name: 'Creative',
      templates: [
        template('tangerine_right', 'Tangerine Right', 'creative', 'sidebar_right', '#C2410C', { photo: true, colours: { accent: '#C2410C', secondary: '#FDBA74', tint: '#FDF1E7', ink: '#1A1A1A', fill: '#C2410C' } }),
        // Its cover is missing on the server, so the card draws its own.
        template('ocean_dark', 'Ocean Dark', 'creative', 'sidebar_left', '#0B3954', { photo: true, tone: 'dark', colours: { accent: '#0B3954', secondary: '#FF5A5F', tint: '#0B3954', ink: '#1A1A1A', fill: '#0B3954' } }),
      ],
    },
    { id: 'executive', name: 'Executive', templates: [template('boardroom_cv', 'Boardroom', 'executive', 'executive', '#1F3A68', { fonts: { heading: 'serif', body: 'serif' } })] },
    { id: 'academic', name: 'Academic & technical', templates: [template('lab', 'Lab', 'academic', 'sidebar_left', '#01579B'), template('syntax', 'Syntax', 'academic', 'compact', '#1F2937')] },
  ],
}
// CV_TEMPLATES_FIXTURE=<json> runs against the real catalogue (the body of GET studio/cv-templates).
const realTemplates = process.env.CV_TEMPLATES_FIXTURE
if (realTemplates) Object.assign(fixture, JSON.parse(await fs.readFile(realTemplates, 'utf8')))
const MISSING_COVER = realTemplates ? '' : 'ocean_dark'
// The template the test picks: the last one in the Creative category of whichever catalogue is used.
const creative = () => fixture.categories.find((group) => group.id === 'creative')
const picked = () => creative().templates.at(-1)
const firstId = () => fixture.categories[0].templates[0].id
const baseDraft = {
  id: draftId,
  feature_id: 'ai.cv',
  version: 2,
  title: 'Nodira Saidova',
  prompt: 'Nodira Saidova\nAn accountant in Tashkent.',
  output_locale: 'en',
  output_format: 'pdf',
  options: { length: 8 },
  content: { title: 'Nodira Saidova', sections: [], questions: [], citations: [] },
  expires_at: new Date(Date.now() + 300000).toISOString(),
}
let draft = structuredClone(baseDraft)
// A small A4-shaped PNG standing in for a rendered first page.
const THUMBNAIL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABUAAAAeCAIAAABMssICAAAAN0lEQVR42mOUt8pgoAAwMVAGRrp+xv///w9l97PAWSfPXSdem7mR5uDw/6j7R90/6v5R9w+U+wFRIC3rnHdRvQAAAABJRU5ErkJggg==',
  'base64',
)
const requests = []
const errors = []
const browser = await chromium.launch({ headless: true, channel: 'chrome' })

async function open(width, theme, insideTelegram, locale = 'en') {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', colorScheme: theme })
  // The app takes its theme from Telegram's, so the dark passes say dark there too.
  await context.addInitScript(({ inside, scheme }) => {
    window.__closed = false
    window.Telegram = {
      WebApp: {
        initData: inside ? 'fixture' : '',
        colorScheme: scheme,
        ready() {},
        expand() {},
        close() {
          window.__closed = true
        },
      },
    }
  }, { inside: insideTelegram, scheme: theme })
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
    if (endpoint === '/plans') return json({ plans: [], draft: false })
    if (endpoint === '/usage')
      return json({ plan: 'premium', week: { starts_at: '2026-10-11T19:00:00Z', resets_at: '2026-10-18T19:00:00Z', time_zone: 'Asia/Tashkent' }, resets_at: '2026-10-18T19:00:00Z',
      ai_documents: { limit: null, used: 0, remaining: null }, file_jobs: { limit: null, used: 0, remaining: null }, edits_per_file: null })
    if (endpoint === '/studio/config')
      return json({ provider: { mode: 'openai', configured: true }, default_pages: 10, features: [{ id: 'ai.cv', name: 'CV', surface: 'generate', eligible: true, max_pages: 2, max_images: 0 }] })
    if (endpoint === '/studio/cv-templates') return json(fixture)
    // A template's first page: any small PNG will do; one is missing on purpose.
    if (/^\/studio\/cv-templates\/[\w-]+\.png$/.test(endpoint)) {
      const id = path.basename(endpoint, '.png')
      if (id === MISSING_COVER) return route.fulfill({ status: 404, body: '' })
      // CV_THUMBNAILS=<dir> serves real rendered pages (<dir>/<id>.png) for a visual check.
      const real = process.env.CV_THUMBNAILS && path.join(process.env.CV_THUMBNAILS, `${id}.png`)
      const png = real ? await fs.readFile(real).catch(() => THUMBNAIL) : THUMBNAIL
      return route.fulfill({ status: 200, contentType: 'image/png', body: png })
    }
    if (endpoint === `/generation/drafts/${draftId}` && method === 'GET')
      return draft ? json(draft) : json({ error: { code: 'not_found', message: 'Not found' } }, 404)
    if (endpoint === `/generation/drafts/${draftId}/setup` && method === 'POST') {
      const options = { ...draft.options, cv_template: body.cv_template }
      return json({ draft: { ...draft, version: draft.version + 1, options }, quote: { id: 'quote-2' } })
    }
    return json({}, 200)
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${origin}/${locale}/app/cv-setup?draft=${draftId}`)
  await page.waitForFunction((scheme) => document.documentElement.dataset.theme === scheme, theme)
  return { context, page }
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
async function audit(page, label) {
  const result = await new AxeBuilder({ page }).include('.cv-setup').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  assert.deepEqual(
    result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) })),
    [],
    `${label}: accessibility`,
  )
}

for (const [width, theme] of [[390, 'light'], [1440, 'dark']]) {
  const { context, page } = await open(width, theme, width === 390)
  await page.getByTestId('cv-setup-templates').waitFor()
  const auto = page.getByTestId('cv-template-auto')
  // Auto is where a new CV starts, and it says which template it keeps to.
  assert.equal(await auto.getAttribute('aria-checked'), 'true')
  assert.match(await auto.innerText(), /Classic Navy, unless your description suits another one better\./)
  assert.match(await page.getByTestId('cv-setup-save').innerText(), /^Save: Auto$/)
  assert.equal(await page.getByTestId('cv-setup-photo').count(), 0, 'No photo, so nothing is said about one')
  // The tabs open on the default's category, and each card shows its real first page.
  assert.equal(await page.getByRole('button', { name: fixture.categories[0].name, exact: true }).getAttribute('aria-pressed'), 'true')
  const thumb = page.locator(`[data-template="${firstId()}"] img.cv-thumb`)
  await thumb.waitFor()
  await page.waitForFunction((id) => document.querySelector(`[data-template="${id}"] img.cv-thumb`)?.complete, firstId())
  assert.ok(await thumb.evaluate((img) => img.naturalWidth > 0), 'the cover loads')
  // The cover keeps the A4 page's proportions.
  const box = await page.locator(`[data-template="${firstId()}"] .cv-cover`).boundingBox()
  assert.ok(Math.abs(box.height / box.width - 297 / 210) < 0.03, `A4 cover, got ${box.width}×${box.height}`)
  await page.screenshot({ path: path.join(output, `cv-setup-${width}-${theme}-opened.png`) })
  await page.getByRole('button', { name: creative().name, exact: true }).click()
  const card = page.locator(`[data-template="${picked().id}"]`)
  await card.click()
  assert.equal(await card.getAttribute('aria-checked'), 'true')
  assert.equal(await auto.getAttribute('aria-checked'), 'false', 'picking a template un-checks Auto')
  assert.equal(await page.locator('.cv-grid [aria-checked="true"]').count(), 1, 'one template at a time')
  // A missing cover is drawn instead, once its image has failed to load.
  if (MISSING_COVER) await card.locator('.cv-draw').waitFor({ timeout: 5000 })
  assert.equal(await page.getByTestId('cv-setup-save').innerText(), `Save: ${picked().name}`)
  assert.equal(await noOverflow(page), false, `${width}: horizontal overflow`)
  await audit(page, `${width}/${theme}`)
  await page.screenshot({ path: path.join(output, `cv-setup-${width}-${theme}.png`) })
  await page.screenshot({ path: path.join(output, `cv-setup-${width}-${theme}-full.png`), fullPage: true })
  await page.getByTestId('cv-setup-save').click()
  await page.getByTestId('cv-setup-saved').waitFor()
  const sent = requests.filter((request) => request.path.endsWith('/setup'))
  assert.deepEqual(sent.at(-1).body, { cv_template: picked().id })
  assert.ok(requests.some((request) => request.path === '/studio/cv-templates' && request.query === '?locale=en'))
  if (width === 390) {
    await page.waitForFunction(() => window.__closed === true)
  } else {
    await page.waitForTimeout(900)
    assert.equal(await page.evaluate(() => window.__closed), false, 'outside Telegram the page stays open')
  }
  await context.close()
}

// A CV whose template was picked before opens on it, in its category; one with
// a portrait says where the photo goes. Choosing Auto again is sent as Auto.
{
  const lab = fixture.categories.at(-1).templates[0]
  draft = { ...structuredClone(baseDraft), options: { length: 8, cv_template: lab.id, portrait_asset_id: '00000000-0000-4000-8000-000000000077' } }
  const { context, page } = await open(1440, 'light', false)
  await page.getByTestId('cv-setup-templates').waitFor()
  assert.equal(await page.locator(`[data-template="${lab.id}"]`).getAttribute('aria-checked'), 'true')
  assert.equal(await page.getByRole('button', { name: fixture.categories.at(-1).name, exact: true }).getAttribute('aria-pressed'), 'true')
  assert.equal(await page.getByTestId('cv-template-auto').getAttribute('aria-checked'), 'false')
  assert.match(await page.getByTestId('cv-setup-photo').innerText(), /Your photo goes on the templates marked “Photo”\./)
  await page.getByTestId('cv-template-auto').click()
  assert.equal(await page.locator('.cv-grid [aria-checked="true"]').count(), 0)
  await page.getByTestId('cv-setup-save').click()
  await page.getByTestId('cv-setup-saved').waitFor()
  assert.deepEqual(requests.filter((request) => request.path.endsWith('/setup')).at(-1).body, { cv_template: 'auto' })
  await context.close()
}

// Uzbek on a phone inside Telegram: the longest copy, checked the same way.
{
  draft = { ...structuredClone(baseDraft), output_locale: 'uz', options: { length: 8, portrait_asset_id: '00000000-0000-4000-8000-000000000077' } }
  const { context, page } = await open(390, 'dark', true, 'uz')
  await page.getByTestId('cv-setup-templates').waitFor()
  assert.equal(await page.locator('html').getAttribute('lang'), 'uz')
  assert.match(await page.getByTestId('cv-setup-save').innerText(), /^Saqlash: Avto$/)
  assert.ok(requests.some((request) => request.path === '/studio/cv-templates' && request.query === '?locale=uz'))
  assert.equal(await noOverflow(page), false, 'uz/390: horizontal overflow')
  await audit(page, 'uz/390/dark')
  await page.screenshot({ path: path.join(output, 'cv-setup-390-dark-uz.png') })
  await context.close()
}

// Only a CV has a template here, and a CV that has gone says so.
{
  draft = { ...structuredClone(baseDraft), feature_id: 'ai.pptx', output_format: 'pptx' }
  const { context, page } = await open(1440, 'light', false)
  await page.getByText('Only a CV has a template to choose.').waitFor()
  assert.equal(await page.getByTestId('cv-setup-save').count(), 0)
  await context.close()
}
{
  draft = null
  const { context, page } = await open(390, 'light', true)
  await page.getByText('This CV is no longer open. Tell the bot about yourself again.').waitFor()
  assert.equal(await page.getByTestId('cv-setup-save').count(), 0)
  await context.close()
}
assert.deepEqual(errors, [])
await browser.close()
console.log(`Pass: CV setup at 390 and 1440, light and dark, en and uz; screenshots in ${output}`)
