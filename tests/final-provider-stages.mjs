import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const base = 'http://127.0.0.1:3000'
const checks = []
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const api = async (path, options = {}) => {
  const token = (await context.cookies()).find((cookie) => cookie.name === 'csrftoken')?.value
  const response = await context.request.fetch(`${base}/api/v1${path}`, {
    ...options,
    headers: { 'X-CSRFToken': token, ...options.headers },
  })
  const data = response.status() === 204 ? null : await response.json()
  assert.ok(response.ok(), `${path}: ${response.status()} ${JSON.stringify(data)}`)
  return data
}

try {
  await page.goto(`${base}/en/app`)
  await page.getByRole('button', { name: 'Use local development account' }).click()
  await page.locator('.dashboard-drop').waitFor()
  await page.locator('.tool-card').first().waitFor()
  const config = await api('/studio/config')
  assert.equal(config.provider.mode, 'local_fixture')
  assert.equal(config.provider.image_configured, false)
  assert.equal(config.provider.handwriting_configured, false)
  await page.goto(`${base}/en/app/images`)
  await page.getByText('Image provider is not configured', { exact: true }).waitFor()
  assert.equal(await page.locator('.studio-quote button').first().isDisabled(), true)
  await page.goto(`${base}/en/app/create?feature=study.handwriting`)
  await page.getByText('Handwriting needs careful review', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Create draft', exact: true }).isDisabled(), true)
  const upload = page.locator('.studio-source input[type=file]')
  assert.equal(await upload.getAttribute('accept'), '.png,.jpg,.jpeg,.pdf')
  assert.equal(await upload.getAttribute('multiple'), null)
  checks.push(
    'Image and handwriting tools accurately require a configured provider; handwriting accepts exactly one PNG/JPG/PDF source',
  )

  await page.getByRole('combobox', { name: 'Workspace mode', exact: true }).selectOption('teacher')
  await page.waitForURL('**/app/teach')
  assert.equal((await api('/me')).mode, 'teacher')
  await page.getByRole('combobox', { name: 'Workspace mode', exact: true }).selectOption('general')
  await page.waitForURL('**/en/app')
  assert.equal((await api('/me')).mode, 'general')
  checks.push('Workspace mode changes persist to the server and open the matching workspace')

  const templates = await api('/templates')
  assert.deepEqual(
    templates.published.map((item) => item.id).sort(),
    ['clean', 'classroom', 'presentation', 'executive_report', 'compact_brief', 'study_notes'].sort(),
  )
  for (const locale of ['en', 'uz', 'ru']) {
    await page.goto(`${base}/${locale}/app/templates`)
    await page.locator('.template-card').first().waitFor()
    assert.ok((await page.locator('.template-card').count()) >= 6)
  }
  checks.push('All six published presets render in English, Uzbek and Russian with server eligibility')

  await page.goto(`${base}/en/app/create?feature=ai.pdf_text`)
  const title = `Outline review ${Date.now()}`
  await page.getByLabel('Title', { exact: true }).fill(title)
  await page
    .getByRole('textbox', { name: /^Your source text/ })
    .fill(
      'Collect reliable sources and record their authors.\n\nCompare findings and identify differences.\n\nWrite an evidence-based conclusion.',
    )
  await page.getByRole('combobox', { name: 'Output language', exact: true }).selectOption('en')
  await page.getByRole('button', { name: 'Create draft', exact: true }).click()
  await page.waitForURL('**/app/create/*')
  const draftId = page.url().split('/').at(-1)
  const original = await api(`/generation/drafts/${draftId}`)
  await page.getByRole('button', { name: 'Review outline generation', exact: true }).click()
  await page.getByRole('button', { name: 'Generate this outline', exact: true }).waitFor()
  const meterAmounts = await page.locator('.studio-quote .meter-row strong').allTextContents()
  assert.ok(meterAmounts.every((value) => Number(value) === 0))
  await page.getByRole('button', { name: 'Generate this outline', exact: true }).click()
  await page.getByText('Generated outline is ready for review.', { exact: true }).waitFor()
  const outlined = await api(`/generation/drafts/${draftId}`)
  assert.ok(outlined.version > original.version)
  assert.ok(outlined.content.sections.length > 0)
  checks.push(
    'Separate outline stage is explicitly quoted at zero local credits, confirmed, then reloaded as a new editable draft version',
  )

  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await page.getByText('Reusable template saved.', { exact: true }).waitFor()
  const saved = (await api('/templates')).results.find((item) => item.name === title)
  assert.ok(saved)
  assert.deepEqual(saved.content.sections, outlined.content.sections)
  assert.equal(saved.content.options.source_draft_id, undefined)
  assert.equal(saved.content.options.project_id, undefined)
  await page.goto(`${base}/en/app/create?template=${saved.id}`)
  await page.getByRole('button', { name: 'Create draft', exact: true }).click()
  await page.waitForURL('**/app/create/*')
  const reused = await api(`/generation/drafts/${page.url().split('/').at(-1)}`)
  assert.deepEqual(reused.content.sections, saved.content.sections)
  assert.deepEqual(reused.content.questions, saved.content.questions)
  await api(`/templates/${saved.id}`, { method: 'DELETE' })
  checks.push(
    'Reviewed content saves as a reusable owner template and creates a new draft with its sections/questions intact',
  )

  await page.evaluate(() => {
    document.activeElement?.blur()
    window.scrollTo({ top: 0, behavior: 'instant' })
  })
  await page.screenshot({ path: 'docs/design/screenshots/outline-final-desktop.png', fullPage: true })
  assert.deepEqual(errors, [])
  await fs.writeFile(
    'docs/design/final-provider-verification.json',
    JSON.stringify(
      { status: 'passed', at: new Date().toISOString(), checks, errors, outlineDraft: draftId },
      null,
      2,
    ),
  )
  console.log(JSON.stringify({ checks, errors }, null, 2))
} catch (error) {
  console.error('PAGE', page.url(), await page.locator('main').innerText())
  await page.screenshot({ path: '/tmp/final-provider-failure.png', fullPage: true })
  throw error
} finally {
  await browser.close()
}
