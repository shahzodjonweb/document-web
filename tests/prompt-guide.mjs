/**
 * The prompt guide.
 *
 * The two services take one free-text description and read everything out of
 * it, so the guide is the whole manual. Its examples are not illustrations:
 * each one is a complete brief that must load into the form and be ready to
 * review without another field being touched.
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
const output = path.resolve(process.env.STUDIO_ARTIFACT_DIR || '../service-review/guide')
await fs.mkdir(output, { recursive: true })

const SERVICES = ['ai.pdf_topic', 'ai.pptx']
// Three per service: one is shown up front in the bot, the other two sit
// behind its expandable quote, and the guide lists all three.
const EXAMPLES_PER_SERVICE = 3
const requiredTopics = {
  en: [
    'Length', 'Who it is for', 'Tone', 'Structure', 'How a deck looks',
    'Slide layouts', 'Photos in slides', 'Questions', 'Your own material', 'What to leave out',
  ],
  uz: [
    'Hajm', 'Kim uchun', 'Uslub', 'Tuzilishi', 'Taqdimot ko‘rinishi',
    'Slayd ko‘rinishlari', 'Slayddagi rasmlar', 'Savollar', 'O‘z materialingiz', 'Nimani yozmaslik kerak',
  ],
  ru: [
    'Объём', 'Для кого', 'Тон', 'Структура', 'Вид презентации',
    'Макеты слайдов', 'Фото в слайдах', 'Вопросы', 'Ваш материал', 'Что не нужно писать',
  ],
}
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
const page = await context.newPage()
page.setDefaultTimeout(10000)
const errors = [],
  checks = [],
  unexpected = []
page.on('pageerror', (error) => errors.push(error.message))

await page.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  if (url.origin !== origin) {
    if (url.hostname === 'telegram.org')
      return route.fulfill({ contentType: 'application/javascript', body: '' })
    return route.abort('blockedbyclient')
  }
  if (!url.pathname.startsWith('/api/')) return route.continue()
  const endpoint = url.pathname.replace('/api/v1', '')
  const json = (value, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })

  if (endpoint === '/auth/session')
    return json({
      authenticated: true,
      user: { id: 'u1', plan: 'premium', locale: 'en', display_name: 'Reader', preferences: {}, time_zone: 'UTC' },
      csrf_token: 'fixture',
      development_login_enabled: false,
    })
  if (endpoint === '/auth/providers') return json({ providers: [] })
  if (endpoint === '/me') return json({ id: 'u1', plan: 'premium', locale: 'en', display_name: 'Reader', preferences: {}, time_zone: 'UTC' })
  if (endpoint === '/catalog') return json({ features: [], draft: true })
  if (endpoint === '/plans') return json({ plans: [], checkout_enabled: false })
  if (endpoint === '/usage')
    return json({ plan: 'free', week: { starts_at: '2026-10-11T19:00:00Z', resets_at: '2026-10-18T19:00:00Z', time_zone: 'Asia/Tashkent' }, resets_at: '2026-10-18T19:00:00Z',
      ai_documents: { limit: 5, used: 0, remaining: 5 }, file_jobs: { limit: 15, used: 0, remaining: 15 }, edits_per_file: 3 })
  if (endpoint === '/jobs') return json({ results: [], count: 0 })
  if (endpoint === '/generation/drafts') return json({ results: [] })
  if (endpoint === '/studio/config')
    return json({
      provider: { mode: 'openai', configured: true },
      default_pages: 5,
      features: SERVICES.map((id) => ({
        id,
        name: id,
        surface: 'generate',
        eligible: true,
        parameter_schema: {
          output_locale: { enum: ['en', 'uz', 'ru'] },
          output_format: { enum: id === 'ai.pptx' ? ['pptx'] : ['pdf'] },
        },
        max_pages: 10,
        locales: ['en', 'uz', 'ru'],
      })),
      limits: { sections: 10, slides: 20, questions: 5, source_chars: 12000 },
    })

  unexpected.push({ path: endpoint, method: route.request().method() })
  return json({ error: { code: 'unexpected_fixture_request' } }, 404)
})

try {
  await page.goto(`${origin}/en/app/guide`, { waitUntil: 'domcontentloaded' })
  await page.locator('.guide-examples li').first().waitFor()

  // 1. Every row of the reference table says something, in every language.
  for (const locale of ['en', 'uz', 'ru']) {
    await page.goto(`${origin}/${locale}/app/guide`, { waitUntil: 'domcontentloaded' })
    await page.locator('.guide-table dt').first().waitFor()
    const terms = await page.locator('.guide-table dt').allInnerTexts()
    const bodies = await page.locator('.guide-table dd').allInnerTexts()
    for (const topic of requiredTopics[locale]) {
      assert.ok(terms.includes(topic), `${locale}: the guide must explain “${topic}”`)
    }
    assert.equal(new Set(terms).size, terms.length, `${locale}: each topic appears once`)
    assert.equal(bodies.length, terms.length)
    for (const text of [...terms, ...bodies]) {
      assert.ok(text.trim(), `${locale}: an empty row teaches nothing`)
      assert.ok(!/^guideRow/.test(text), `${locale}: untranslated key "${text}"`)
    }
    // The default page count is stated, not left to be discovered.
    assert.match(bodies[terms.indexOf(requiredTopics[locale][0])], /5/)
  }
  checks.push('The reference table is complete and translated in all three languages')

  // 2. Both services get examples, and each one names a page count.
  await page.goto(`${origin}/en/app/guide`, { waitUntil: 'domcontentloaded' })
  await page.locator('.guide-examples li').first().waitFor()
  const services = await page.locator('.guide-service').count()
  assert.equal(services, SERVICES.length, 'Both services are covered')
  const examples = await page.locator('.guide-examples p').allInnerTexts()
  assert.equal(
    examples.length,
    SERVICES.length * EXAMPLES_PER_SERVICE,
    `${EXAMPLES_PER_SERVICE} examples per service, saw ${examples.length}`,
  )
  for (const example of examples) {
    assert.match(example, /\d+\s*(pages?|slides?)/i, `"${example.slice(0, 40)}" names no page count`)
    assert.ok(example.length > 60, 'an example should be a real brief, not a fragment')
  }
  checks.push('Every example is a complete brief that names its own page count')

  // 3. "Use this" hands the description to the form, ready to review.
  const first = page.getByTestId('guide-use-ai.pdf_topic-0')
  const expected = await page.locator('.guide-examples p').first().innerText()
  await first.click()
  await page.waitForURL('**/app/create**')
  await page.getByTestId('studio-brief').waitFor()
  assert.equal(await page.getByTestId('studio-primary-input').inputValue(), expected)
  assert.equal(await page.getByTestId('studio-purpose').inputValue(), 'ai.pdf_topic')
  assert.equal(await page.getByTestId('studio-review').isDisabled(), false, 'ready to review as-is')
  checks.push('“Use this” opens the studio with the description already filled in and reviewable')

  // 4. The slides examples open the slides service, not the document one.
  await page.goto(`${origin}/en/app/guide`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('guide-use-ai.pptx-0').click()
  await page.waitForURL('**/app/create**')
  await page.getByTestId('studio-brief').waitFor()
  assert.equal(await page.getByTestId('studio-purpose').inputValue(), 'ai.pptx')
  checks.push('Each example opens the service it was written for')

  // 5. Three locales, two widths, both themes.
  for (const locale of ['en', 'uz', 'ru']) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(`${origin}/${locale}/app/guide`, { waitUntil: 'domcontentloaded' })
      await page.locator('.guide-examples li').first().waitFor()
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
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
        assert.deepEqual(
          result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          [],
          `${locale}/${width}/${theme}: accessibility violations`,
        )
      }
      await page.screenshot({ path: path.join(output, `guide-${locale}-${width}.png`), fullPage: true })
    }
  }
  checks.push('EN/UZ/RU at 1440 and 390 in both themes: no overflow and no WCAG A/AA findings')

  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [], 'Every API call is explicitly covered by the offline fixture')
  const report = { status: 'passed', at: new Date().toISOString(), checks, errors }
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
