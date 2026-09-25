/**
 * The services a customer is offered first.
 *
 * Generation features come from `/studio/config` and file tools from
 * `/catalog`; the directory and the dashboard strip merge the two. This pins
 * the order those are shown in, that an AI card opens the studio rather than a
 * file-tool page, and that signed-out visitors are not offered generation —
 * which needs an account and has no public page.
 */
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const origin = process.env.STUDIO_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(
  ['127.0.0.1', 'localhost'].includes(new URL(origin).hostname),
  'Use the local web server for this fixture test',
)
const output = path.resolve(process.env.STUDIO_ARTIFACT_DIR || '../service-review/directory')
await fs.mkdir(output, { recursive: true })

const FEATURED = ['ai.pdf_topic', 'ai.pptx', 'study.summary', 'study.quiz']
const STAPLES = ['pdf.merge', 'pdf.compress', 'pdf.split', 'pdf.images_to_pdf', 'convert.word_to_pdf']
const generationIds = [
  ...FEATURED,
  'ai.pdf_text',
  'ai.pdf_sources',
  'study.flashcards',
  'teacher.lesson_plan',
  'school.explain',
]
const catalogIds = [...STAPLES, 'pdf.to_images', 'ocr.extract_text', 'batch.convert']

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
const page = await context.newPage()
page.setDefaultTimeout(10000)
page.setDefaultNavigationTimeout(15000)
const errors = [],
  checks = [],
  unexpected = [],
  external = []
let signedIn = true
page.on('pageerror', (error) => errors.push(error.message))

await page.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  if (url.origin !== origin) {
    // The Telegram mini-app shim is loaded on every page; stub it rather than
    // letting an offline test reach out.
    if (url.hostname === 'telegram.org')
      return route.fulfill({ contentType: 'application/javascript', body: '' })
    external.push(url.origin)
    return route.abort('blockedbyclient')
  }
  if (!url.pathname.startsWith('/api/')) return route.continue()

  const endpoint = url.pathname.replace('/api/v1', '')
  const json = (value, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })

  if (endpoint === '/auth/session')
    return json({
      authenticated: signedIn,
      user: signedIn
        ? { id: 'u1', plan: 'premium', locale: 'en', display_name: 'Directory', preferences: {}, time_zone: 'UTC' }
        : null,
      csrf_token: 'fixture',
      development_login_enabled: false,
    })
  if (endpoint === '/auth/providers') return json({ providers: [] })
  if (endpoint === '/me')
    return signedIn
      ? json({ id: 'u1', plan: 'premium', locale: 'en', preferences: {}, time_zone: 'UTC' })
      : json({ error: { code: 'not_authenticated' } }, 401)
  if (endpoint === '/catalog')
    return json({
      features: catalogIds.map((id) => ({ id, name: id, category: 'pdf', eligible: true })),
      draft: true,
    })
  if (endpoint === '/studio/config') {
    // Mirrors the server: signed-out visitors never reach this endpoint.
    if (!signedIn) return json({ error: { code: 'not_authenticated' } }, 401)
    return json({
      provider: { id: 'openai', mode: 'openai', label: 'OpenAI', configured: true },
      features: generationIds.map((id) => ({ id, name: id, surface: 'generate', eligible: true })),
      templates: [],
      limits: {},
    })
  }
  if (endpoint === '/plans') return json({ plans: [], checkout_enabled: false })
  if (endpoint === '/usage')
    return json({ meters: { file_tasks: { remaining: 40, limit: 90 } }, daily: {}, resets_at: null })
  if (endpoint === '/jobs') return json({ results: [], count: 0 })
  // Opening the studio from a card loads its own side lists.
  if (endpoint === '/education/projects') return json({ results: [], limit: 10 })
  if (endpoint === '/generation/drafts') return json({ results: [] })
  if (endpoint === '/templates') return json({ results: [], published: [] })

  unexpected.push({ path: endpoint, method: route.request().method() })
  return json({ error: { code: 'unexpected_fixture_request' } }, 404)
})

const cardIds = () =>
  page.$$eval('.tool-card', (nodes) =>
    nodes.map((node) => decodeURIComponent(node.getAttribute('href') || '')),
  )
/** Cards link by destination, so read the id back out of the href. */
const idFromHref = (href) =>
  href.includes('feature=') ? href.split('feature=')[1].split('&')[0] : href.split('/').at(-1)

try {
  // 1. The directory leads with the four AI services, then the file staples.
  await page.goto(`${origin}/en/app/tools`, { waitUntil: 'domcontentloaded' })
  await page.locator('.tool-card').first().waitFor()
  const listed = (await cardIds()).map(idFromHref)
  assert.deepEqual(listed.slice(0, 4), FEATURED, 'The four AI services lead the directory')
  assert.deepEqual(listed.slice(4, 9), STAPLES, 'Then the familiar file tools, merge first')
  assert.equal(new Set(listed).size, listed.length, 'No feature is listed twice')
  assert.deepEqual(
    [...listed].sort(),
    [...generationIds, ...catalogIds].sort(),
    'Every feature from both endpoints is offered',
  )
  checks.push('The services directory leads with the four AI services, then the file tools')

  // 2. Each featured card carries its own name and description, not filler.
  for (const id of FEATURED) {
    const card = page.locator(`.tool-card[href*="${encodeURIComponent(id)}"]`).first()
    const heading = await card.locator('h3').innerText()
    const body = await card.locator('p').innerText()
    assert.ok(heading.trim() && heading !== id, `${id}: needs a real name`)
    assert.ok(body.trim().length > 20, `${id}: needs a real description`)
    assert.notEqual(body, await page.locator(`.tool-card[href*="pdf.merge"] p`).innerText())
  }
  checks.push('Featured AI cards carry their own name and description in place of the generic copy')

  // 3. An AI card opens the studio; a file tool still opens its tool page.
  await page.locator(`.tool-card[href*="${encodeURIComponent('ai.pptx')}"]`).first().click()
  await page.waitForURL('**/app/create**')
  assert.equal(new URL(page.url()).searchParams.get('feature'), 'ai.pptx')
  checks.push('The slide maker card opens the studio with that tool selected')

  await page.goto(`${origin}/en/app/tools`, { waitUntil: 'domcontentloaded' })
  await page.locator('.tool-card').first().waitFor()
  await page.locator('.tool-card[href$="pdf.merge"]').first().click()
  await page.waitForURL('**/app/tools/pdf.merge')
  checks.push('File tools keep their own workspace route')

  // 4. The category tab narrows to generation features only.
  await page.goto(`${origin}/en/app/tools`, { waitUntil: 'domcontentloaded' })
  await page.locator('.tool-card').first().waitFor()
  await page.getByRole('button', { name: 'Create with AI', exact: true }).click()
  const inCategory = (await cardIds()).map(idFromHref)
  assert.deepEqual(inCategory, generationIds, 'The AI tab shows exactly the generation features')
  checks.push('The "Create with AI" category holds exactly the generation features')

  // 5. The dashboard strip is the head of the same list.
  await page.goto(`${origin}/en/app`, { waitUntil: 'domcontentloaded' })
  await page.locator('.quick-tools .tool-card').first().waitFor()
  const strip = await page.$$eval('.quick-tools .tool-card', (nodes) =>
    nodes.map((node) => decodeURIComponent(node.getAttribute('href') || '')),
  )
  assert.deepEqual(strip.map(idFromHref), [...FEATURED, 'pdf.merge'], 'Popular tools leads with AI')
  await page.screenshot({ path: path.join(output, 'dashboard-popular.png'), fullPage: true })
  checks.push('The dashboard "Popular tools" strip is the head of the same ordering')

  // 6. Signed out, generation is not offered: it needs an account and
  //    `/tools/<id>` has no page for a studio feature.
  signedIn = false
  await context.clearCookies()
  await page.goto(`${origin}/en/tools`, { waitUntil: 'domcontentloaded' })
  await page.locator('.tool-card').first().waitFor()
  const publicIds = (await cardIds()).map(idFromHref)
  assert.deepEqual(publicIds, catalogIds, 'The public directory is file tools only')
  checks.push('Signed-out visitors are offered only the tools they can actually use')

  // 7. The new cards and tab survive three locales, two widths, both themes.
  signedIn = true
  for (const locale of ['en', 'uz', 'ru']) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(`${origin}/${locale}/app/tools`, { waitUntil: 'domcontentloaded' })
      await page.locator('.tool-card').first().waitFor()
      assert.equal(await page.locator('html').getAttribute('lang'), locale)
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme)
        await page.evaluate(
          () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        )
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          `${locale}/${width}/${theme}: horizontal overflow`,
        )
        const result = await new AxeBuilder({ page })
          .include('.tool-grid')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
        assert.deepEqual(
          result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          [],
          `${locale}/${width}/${theme}: accessibility violations`,
        )
      }
      await page.screenshot({ path: path.join(output, `tools-${locale}-${width}.png`), fullPage: true })
    }
  }
  checks.push('EN/UZ/RU at 1440 and 390 in both themes: no overflow and no WCAG A/AA findings')

  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [], 'Every API call is explicitly covered by the offline fixture')
  assert.deepEqual(external, [], 'No external calls occur')
  const report = { status: 'passed', at: new Date().toISOString(), checks, errors }
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
