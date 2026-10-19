import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// The everyday pages: Home (greeting, drop zone, AI shortcuts, the plan in
// one row, popular tools, recent tasks) and a tool from files to a started
// task, in one column with the next step always in reach on a phone.
const origin = process.env.CORE_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use the local web server')
const output = path.resolve(process.env.CORE_ARTIFACT_DIR || '../studio-review/core-pages')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
const page = await context.newPage()
page.setDefaultTimeout(10000)
const errors = []
const checks = []
const unexpected = []
const requests = []
page.on('pageerror', (error) => errors.push(error.message))

const account = {
  id: '00000000-0000-4000-8000-555555555555', display_name: 'Malika Yusupova', locale: 'en', time_zone: 'UTC',
  mode: 'general', plan: 'free', preferences: { paper_size: 'A4' }, login_methods: { email: false, google: false, telegram: true },
}
const feature = (id, parameters = {}) => ({ id, name: id, category: '', enabled: true, eligible: true, parameters })
const features = [
  feature('pdf.merge'),
  feature('pdf.compress'),
  feature('pdf.split'),
  feature('pdf.images_to_pdf'),
  feature('convert.word_to_pdf'),
  feature('pdf.to_images'),
  feature('ocr.extract_text', {
    properties: { language: { type: 'string', enum: ['eng', 'rus', 'uzb'], default: 'eng' } },
  }),
]
// Only the three weekly limits differ by plan; every other limit is shared.
const limits = (price, documents, files, edits) => ({ max_file_mib: 200, max_pages_per_job: 1000, saved_workflows: 20,
  price_uzs: price, weekly_ai_documents: documents, weekly_file_jobs: files, edits_per_file: edits })
// Plus is on discount for two more weeks, as the server reports it.
const until = new Date(Date.now() + 14 * 86400000)
const untilDay = [until.getFullYear(), until.getMonth() + 1, until.getDate()].map((n) => String(n).padStart(2, '0')).join('-')
const discount = { price: 15000, regular: 20000, percent: 25, until: untilDay }
const plans = [
  { id: 'free', name: 'Free', price_uzs: null, discount: null, limits: limits(null, 5, 15, 3) },
  { id: 'plus', name: 'Plus', price_uzs: 20000, discount, limits: limits(20000, 20, null, 10) },
  { id: 'premium', name: 'Premium', price_uzs: 60000, discount: null, limits: limits(60000, null, null, null) },
]
// This week's allowance, as /usage and a quote report it.
const week = { starts_at: '2026-10-11T19:00:00Z', resets_at: '2026-10-18T19:00:00Z', time_zone: 'Asia/Tashkent' }
const usage = {
  plan: 'free', week, resets_at: week.resets_at, edits_per_file: 3,
  ai_documents: { limit: 5, used: 2, remaining: 3 },
  file_jobs: { limit: 15, used: 3, remaining: 12 },
}
let uploads = 0
// Compress is refused once the week is used up, as the server says it.
let fileWeekUsedUp = false
const jobs = new Map()

await context.route('**/*', (route) => {
  const url = new URL(route.request().url())
  if (url.origin === origin || url.protocol === 'data:') return route.continue()
  return route.abort('blockedbyclient')
})
await context.route(`${origin}/api/v1/**`, async (route) => {
  const request = route.request()
  const endpoint = new URL(request.url()).pathname.replace('/api/v1', '')
  const method = request.method()
  requests.push({ endpoint, method })
  const json = (value, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
  if (endpoint === '/auth/session')
    return json({ user: account, development_login_enabled: false, csrf_token: 'fixture' })
  if (endpoint === '/me') return json(account)
  if (endpoint === '/catalog') return json({ features, draft: false })
  if (endpoint === '/plans') return json({ plans, currency: 'UZS', period_seconds: 2592000, draft: false })
  if (endpoint === '/usage') return json(usage)
  if (endpoint === '/channels') return json({ required: false, joined: true, channels: [] })
  if (endpoint === '/studio/config')
    return json({
      provider: { mode: 'openai', configured: true },
      features: [
        { id: 'ai.pdf_topic', name: 'PDF Document', eligible: true },
        { id: 'ai.pptx', name: 'PowerPoint Slides', eligible: true },
        { id: 'ai.cv', name: 'CV', eligible: true },
      ],
      default_pages: 10,
    })
  if (endpoint === '/jobs' && method === 'GET') return json({ results: [...jobs.values()], count: jobs.size })
  if (endpoint === '/files/uploads' && method === 'POST') {
    uploads += 1
    return json({
      id: `00000000-0000-4000-8000-0000000001${String(uploads).padStart(2, '0')}`,
      name: uploads === 1 ? 'Quarterly report.pdf' : `Appendix ${uploads - 1}.pdf`,
      size_bytes: 180000 * uploads,
      page_count: 3 + uploads,
    })
  }
  if (endpoint.startsWith('/files/') && method === 'DELETE') return json({})
  if (endpoint === '/quotes' && method === 'POST') {
    const body = request.postDataJSON()
    if (fileWeekUsedUp)
      return json({ error: { code: 'weekly_file_limit', message: 'This week’s file tasks are used up.',
        message_params: { limit: 15, used: 15, requested: 1, resets_at: week.resets_at } } }, 429)
    const { plan, week: _, ...summary } = usage
    return json({
      id: '00000000-0000-4000-8000-000000000300',
      feature_id: body.feature_id,
      input_ids: body.input_ids,
      affordable: true,
      usage: summary,
      expires_at: new Date(Date.now() + 900000).toISOString(),
    })
  }
  if (endpoint === '/jobs' && method === 'POST') {
    const job = {
      id: '00000000-0000-4000-8000-000000000400', feature_id: 'pdf.merge', status: 'succeeded',
      created_at: new Date().toISOString(), outputs: [], inputs: [], parameters: {},
    }
    jobs.set(job.id, job)
    return json(job, 201)
  }
  if (endpoint.startsWith('/jobs/')) return json(jobs.get(endpoint.split('/')[2]) || {})
  if (endpoint === '/contacts')
    return json({ support: { username: 'pdfmaster_help', url: 'https://t.me/pdfmaster_help' },
      ads: { username: 'pdfmaster_ads', url: 'https://t.me/pdfmaster_ads' } })
  if (endpoint === '/referrals')
    return json({ code: 'MALIKA7', url: 'https://pdfmaster.orderdesk.live/r/MALIKA7', rewards_count: 2, pending_count: 1,
      monthly_cap: 5, expires_in_days: 90, qualification: '', sandbox: false })
  unexpected.push(`${method} ${endpoint}`)
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
  const result = await new AxeBuilder({ page }).include('#main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  assert.deepEqual(
    result.violations.map((item) => `${item.id}: ${item.nodes.map((node) => node.target.join(' ')).join(', ')}`),
    [],
    `${label} accessibility`,
  )
}
const shot = async (name, fullPage = false) => {
  await page.mouse.move(0, page.viewportSize().height - 1)
  await page.screenshot({ path: `${output}/${name}.png`, fullPage })
}
// A select inside its label is named with its chosen option too, so find it by the label.
const field = (label) => page.locator('label.form-field', { hasText: label }).locator('select, input')
const texts = (locator) => locator.evaluateAll((items) => items.map((item) => item.textContent.trim()))
const ids = (selector) =>
  page.$$eval(selector, (nodes) =>
    nodes.map((node) => {
      const href = decodeURIComponent(node.getAttribute('href') || '')
      return href.includes('feature=') ? href.split('feature=')[1] : href.split('/').at(-1)
    }),
  )

try {
  // Home.
  await go('/en/app')
  await page.locator('.quick-tools .tool-card').first().waitFor()
  assert.equal(await page.locator('h1').innerText(), 'Hello, Malika')
  assert.equal(await page.locator('.eyebrow').count(), 0, 'no eyebrow over the greeting')
  assert.deepEqual(await ids('.ai-shortcut'), ['ai.pdf_topic', 'ai.pptx', 'ai.cv'])
  assert.deepEqual(await texts(page.locator('.plan-meter-label')), ['AI documents this week', 'File tasks this week'])
  assert.match(await page.locator('.plan-meter').first().innerText(), /2\s+of 5 used/)
  assert.match(await page.locator('.plan-meter').nth(1).innerText(), /3\s+of 15 used/)
  assert.match(await page.locator('.week-reset').innerText(), /^Limits renew .+ · \S+/)
  assert.deepEqual(await ids('.quick-tools .tool-card'), [
    'pdf.merge', 'pdf.compress', 'pdf.split', 'pdf.images_to_pdf', 'convert.word_to_pdf',
  ])
  for (const gone of ['.privacy-card', '.help-strip', '.usage-card']) {
    assert.equal(await page.locator(gone).count(), 0, `${gone} is gone from Home`)
  }
  checks.push('Home: greeting, drop zone, the three AI shortcuts, the week in two meters with its reset, five file tools, recent tasks')

  // Tools: categories that have tools, real descriptions.
  await go('/en/app/tools')
  await page.locator('.tool-grid .tool-card').first().waitFor()
  const offered = await texts(page.locator('.category-tabs button'))
  assert.ok(!offered.includes('Automate'), 'a category with no tools is not offered')
  assert.ok(offered.includes('Read text'))
  assert.equal(await page.locator('.workspace-hubs').count(), 0, 'the hub strip with dead links is gone')
  const ocr = page.locator('.tool-card[href$="ocr.extract_text"] p')
  assert.equal(await ocr.innerText(), 'Read the text from scans and photos of pages.')
  const filler = await page.locator('.tool-card p', { hasText: 'in-between' }).count()
  assert.equal(filler, 0, 'no tool falls back to the generic description')
  checks.push('Tools offers only categories with tools; every tool has its own description')

  // A tool, start to finish: files → review → start.
  await go('/en/app/tools/pdf.merge')
  await page.locator('.tool-steps').waitFor()
  assert.deepEqual(await texts(page.locator('.step-head h2')), ['Your files', 'Review and start'],
    'merge has nothing to set, so there is no options step')
  const start = page.locator('.tool-action .button.primary')
  assert.equal(await start.isDisabled(), true)
  assert.equal(await page.locator('.tool-action .quote-footnote').innerText(), 'Add at least two PDFs to merge.')
  await page.locator('input[type=file]').setInputFiles(['tests/fixtures/research-notes.pdf', 'tests/fixtures/appendix.pdf'])
  await page.locator('.file-row').nth(1).waitFor()
  assert.equal(await page.locator('.workspace-drop').count(), 0, 'the drop zone steps aside once files are in')
  await page.getByRole('button', { name: 'Move up', exact: true }).nth(1).click()
  assert.match(await page.locator('.file-row').first().innerText(), /Appendix 1/)
  assert.match(await page.locator('.tool-summary').innerText(), /2 files · 9 pages/)
  for (const mode of ['light', 'dark']) {
    await theme(mode)
    assert.equal(await overflow(), false, `merge 1440 ${mode} overflow`)
    await axe(`merge 1440 ${mode}`)
    await shot(`merge-files-1440-${mode}`, true)
  }
  await theme('light')
  await start.click()
  await page.locator('.weekly-line').waitFor()
  assert.match(await page.locator('.weekly-line').innerText(), /File tasks this week\s+3 of 15 used/)
  await shot('merge-review-1440', true)
  await page.getByRole('button', { name: 'Start processing', exact: true }).click()
  await page.waitForURL('**/app/jobs/*')
  await page.locator('.job-detail').waitFor()
  assert.equal(await page.locator('.job-detail h1').count(), 1)
  await shot('job-1440', true)
  checks.push('Merge: two files in, reordered, reviewed with the week’s file tasks, started; no options step')

  // A week used up: the refusal says so and offers the plans.
  fileWeekUsedUp = true
  await go('/en/app/tools/pdf.compress')
  await page.locator('input[type=file]').setInputFiles(['tests/fixtures/research-notes.pdf'])
  await page.locator('.file-row').first().waitFor()
  await page.locator('.tool-action .button.primary').click()
  await page.getByTestId('limit-plans').waitFor()
  assert.match(await page.locator('.error-banner').innerText(), /file tasks are used up/)
  assert.match(await page.getByTestId('limit-plans').getAttribute('href'), /\/en\/app\/billing$/)
  fileWeekUsedUp = false
  checks.push('A used-up week is refused with the way to the plans')

  // Tasks: newest first, filtered by what people ask — done, going, or not finished.
  await go('/en/app/jobs')
  await page.locator('.job-row').first().waitFor()
  assert.deepEqual(await texts(page.locator('.task-filter button')), ['All', 'Ready', 'In progress', 'Did not finish'])
  assert.equal(await page.locator('.job-row').count(), 1)
  assert.doesNotMatch(await page.locator('.job-row').innerText(), /00000000/, 'no raw task id up front')
  await page.locator('.task-filter button', { hasText: 'Did not finish' }).click()
  assert.equal(await page.locator('.job-row').count(), 0)
  await page.getByText('Nothing here with this status.', { exact: true }).waitFor()
  await page.locator('.task-filter button', { hasText: 'All' }).click()
  for (const mode of ['light', 'dark']) {
    await theme(mode)
    assert.equal(await overflow(), false, `tasks 1440 ${mode} overflow`)
    await axe(`tasks 1440 ${mode}`)
  }
  await theme('light')
  await shot('tasks-1440', true)
  checks.push('Tasks: one row per task without raw ids, and status chips that filter')

  // A tool with options: essentials shown, the rest folded.
  await go('/en/app/tools/pdf.to_images')
  await page.locator('.tool-steps').waitFor()
  assert.deepEqual(await texts(page.locator('.step-head h2')), ['Your files', 'Options', 'Review and start'])
  assert.equal(await field('Output format').isVisible(), true)
  assert.equal(await field('Resolution').isVisible(), false, 'resolution starts folded')
  await page.locator('.advanced-options summary').click()
  assert.equal(await field('Resolution').isVisible(), true)
  checks.push('Options show what matters; the rest is folded under More options')

  // Help: the two Telegram contacts, then articles with a search and the guide. No form.
  await go('/en/app/support')
  await page.locator('.contact-row').first().waitFor()
  assert.deepEqual(await page.locator('.contact-row').evaluateAll((rows) => rows.map((row) => row.getAttribute('href'))),
    ['https://t.me/pdfmaster_help', 'https://t.me/pdfmaster_ads'])
  assert.equal(await page.locator('textarea').count(), 0, 'nothing to fill in: people write on Telegram')
  await page.locator('.help-card').first().waitFor()
  const articles = await page.locator('section.help-card').count()
  await page.getByPlaceholder('Search help…').fill('24 hours')
  assert.ok((await page.locator('section.help-card').count()) < articles, 'search narrows the articles')
  await page.getByPlaceholder('Search help…').fill('')
  // What sets the plans apart is listed in full: the week's limits, the edits
  // per file, and that Premium needs no channel subscription.
  const billingHelp = await page.locator('section.help-card', { hasText: 'Usage & payments' }).innerText()
  assert.match(billingHelp, /Every plan has every tool/)
  assert.match(billingHelp, /Premium also needs no channel subscription\./)
  for (const mode of ['light', 'dark']) {
    await theme(mode)
    await axe(`help 1440 ${mode}`)
  }
  await theme('light')
  await shot('help-1440', true)
  checks.push('Help: the support and advertising Telegram contacts, searchable articles and the guide; no form; the plans answer names Premium’s channels')

  // The public front page: what it does, the AI services, tools, plans and questions.
  await go('/en')
  await page.locator('.landing-hero h1').waitFor()
  assert.equal(await page.locator('.landing-hero h1').innerText(), 'PDF tools and AI documents, in one place.')
  assert.equal(await page.getByText(/paperwork/i).count(), 0, 'no old taglines')
  assert.equal(await page.locator('.landing-section .ai-shortcut').count(), 3)
  assert.equal(await page.locator('.faq details').count(), 4)
  assert.deepEqual(await texts(page.locator('.pricing-teaser .panel').first().locator('.teaser-week')),
    ['5 AI documents a week', '15 file tasks a week'])
  assert.deepEqual(await texts(page.locator('.pricing-teaser .panel').last().locator('.teaser-week')),
    ['Unlimited AI documents', 'Unlimited file tasks'])
  // Subtitles speak of weekly volume only: no tool set, capability or size.
  assert.deepEqual(await texts(page.locator('.pricing-teaser .panel small')),
    ['Every tool, with a weekly allowance', 'More each week for regular work', 'For people who work with lots of documents'])
  // Plus on discount: the regular price struck through, today's price, the
  // percentage and the last day; Free and Premium are priced plainly.
  const teasers = page.locator('.pricing-teaser .panel')
  // The struck price is named for screen readers, which do not read strikethrough.
  assert.deepEqual(await texts(teasers.locator('.teaser-regular')), ["Regular price 20 000 so'm"])
  assert.match(await teasers.nth(1).locator('.teaser-price').innerText(), /^15 000 so'm\s*−25%$/)
  assert.match(await teasers.nth(1).locator('.discount-until').innerText(), /^until /)
  assert.equal(await teasers.nth(2).locator('.discount-badge').count(), 0)
  assert.match(await page.getByTestId('discount-banner').innerText(),
    /Plus on discount:\s+Regular price\s+20 000 so'm\s+15 000 so'm\s+−25%\s+· until /)
  assert.equal(await page.getByTestId('discount-banner').getByRole('link').innerText(), 'Compare plans')
  await page.locator('.faq summary').first().click()
  assert.ok(await page.locator('.faq details').first().getAttribute('open') !== null)
  for (const mode of ['light', 'dark']) {
    await theme(mode)
    assert.equal(await overflow(), false, `landing 1440 ${mode} overflow`)
    await axe(`landing 1440 ${mode}`)
  }
  await theme('light')
  await shot('landing-1440', true)
  // Russian says ИИ, the landing headline included.
  await go('/ru')
  await page.locator('.landing-hero h1').waitFor()
  assert.equal(await page.locator('.landing-hero h1').innerText(), 'Инструменты PDF и ИИ-документы — в одном месте.')
  assert.deepEqual(await texts(page.locator('.pricing-teaser .panel small')),
    ['Все инструменты с недельным лимитом', 'Больше в неделю для регулярной работы', 'Для тех, кто работает с большим числом документов'])
  assert.match(await page.getByTestId('discount-banner').innerText(),
    /Скидка на Plus:\s+Обычная цена\s+20 000 so'm\s+15 000 so'm\s+−25%\s+· до \d+ [а-я]+/)

  // Referrals: the link with a copy button, and two numbers.
  await go('/en/app/referrals')
  await page.locator('.referral-link-panel').waitFor()
  assert.equal(await page.locator('.copy-field input').first().inputValue(), 'https://pdfmaster.orderdesk.live/r/MALIKA7')
  assert.deepEqual(await texts(page.locator('.referral-numbers strong')), ['2', '1'])
  assert.equal(await page.getByTestId('referral-rewards').innerText(), 'Rewards for invitations are coming soon.')
  await axe('referrals 1440')
  await shot('referrals-1440', true)
  checks.push('Landing: what it does, AI services, tools, plans with their weeks and volume-only subtitles, the Plus discount on the teaser and the banner (Russian too), questions, Russian ИИ; referrals: link, copy and two numbers')

  // The AI shortcuts, as many to a row as their words fit, in every language:
  // from a tablet up, nothing runs out of its card or under its arrow or button.
  const crowded = () =>
    page.$$eval('.ai-shortcut', (cards) =>
      cards.flatMap((card) => {
        const copy = card.querySelector('.ai-shortcut-copy')
        const end = card.querySelector('.tool-arrow, .button')
        const clipped = [...copy.children].some((line) => line.scrollWidth > line.clientWidth + 1)
        const under = end && copy.getBoundingClientRect().right > end.getBoundingClientRect().left + 1
        const box = card.getBoundingClientRect()
        return card.scrollWidth > card.clientWidth + 1 || clipped || under
          ? [`${card.getAttribute('href')} ${Math.round(box.width)}px`]
          : []
      }),
    )
  for (const width of [768, 820, 900, 1024, 1180, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const locale of ['en', 'ru', 'uz']) {
      for (const where of ['/app', '']) {
        await go(`/${locale}${where}`)
        await page.locator('.ai-shortcut').first().waitFor()
        assert.equal(await page.locator('.ai-shortcut').count(), 3)
        assert.deepEqual(await crowded(), [], `${where ? 'home' : 'landing'} ${locale} ${width}: AI shortcuts crowded`)
      }
    }
  }
  await page.setViewportSize({ width: 768, height: 900 })
  await go('/ru/app')
  await page.locator('.ai-shortcut').first().waitFor()
  await shot('home-ru-768', true)
  checks.push('Home and landing: the three AI shortcuts fit their words from 768 to 1280 px in EN/RU/UZ')

  // Phone: one column, and the next step stays in reach above the phone bar.
  await page.setViewportSize({ width: 390, height: 844 })
  for (const mode of ['light', 'dark']) {
    await go('/en/app')
    await theme(mode)
    await page.locator('.quick-tools .tool-card').first().waitFor()
    assert.equal(await overflow(), false, `home 390 ${mode} overflow`)
    await axe(`home 390 ${mode}`)
    await shot(`home-390-${mode}`, true)
  }
  await theme('light')
  uploads = 0
  await go('/en')
  await page.locator('.landing-hero h1').waitFor()
  assert.equal(await overflow(), false, 'landing 390 overflow')
  await axe('landing 390')
  await shot('landing-390', true)
  await go('/en/app/tools/pdf.merge')
  await page.locator('input[type=file]').setInputFiles(['tests/fixtures/research-notes.pdf', 'tests/fixtures/appendix.pdf'])
  await page.locator('.file-row').nth(1).waitFor()
  await page.evaluate(() => scrollTo(0, 0))
  const bar = await page.locator('.mobile-nav').boundingBox()
  const action = await page.locator('.tool-action .button.primary').boundingBox()
  assert.ok(action.y + action.height <= bar.y + 1 && action.y > bar.y - 120, 'the action sits just above the phone bar')
  assert.equal(await overflow(), false, 'merge 390 overflow')
  await axe('merge 390')
  await shot('merge-390')
  checks.push('Phones: Home and the tool fit; the next step stays in reach above the phone bar')

  await page.setViewportSize({ width: 1440, height: 900 })
  for (const mode of ['light', 'dark']) {
    await go('/en/app')
    await theme(mode)
    await page.locator('.quick-tools .tool-card').first().waitFor()
    assert.equal(await overflow(), false, `home 1440 ${mode} overflow`)
    await axe(`home 1440 ${mode}`)
    await shot(`home-1440-${mode}`, true)
  }

  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [], 'Every API call is covered by the fixture')
  const report = { status: 'passed', checks }
  await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
