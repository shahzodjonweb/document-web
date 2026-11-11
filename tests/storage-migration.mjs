import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'

// Choices a browser kept while the product was PDF Master (`pdf-master-…` keys)
// move to their DocMaster names (`docmaster-…`) before the app reads them, and
// the theme is right before the first paint even before they move.
const origin = process.env.CORE_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use the local web server')
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const checks = []

const seed = () => {
  if (localStorage.getItem('test-seeded')) return
  localStorage.setItem('test-seeded', '1')
  localStorage.setItem('pdf-master-theme', 'dark')
  localStorage.setItem('pdf-master-deck-seen:account-1', '{"deck":3}')
  localStorage.setItem('pdf-master-editor-tips', '["old"]')
  localStorage.setItem('docmaster-editor-tips', '["new"]')
  localStorage.setItem('unrelated', 'kept')
  sessionStorage.setItem('pdf-master-draft', '{"tool":"pdf.merge"}')
}

async function open({ scripts = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.abort('blockedbyclient')
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, body: '' })
    if (!scripts && url.pathname.startsWith('/_nuxt/')) return route.abort('blockedbyclient')
    return route.continue()
  })
  await context.addInitScript(seed)
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  return { context, page }
}

const read = (page) =>
  page.evaluate(() => {
    const all = (store) => Object.fromEntries(Object.keys(store).map((key) => [key, store.getItem(key)]))
    return { local: all(localStorage), session: all(sessionStorage), theme: document.documentElement.dataset.theme }
  })

{
  // Without the app's scripts only the pre-paint line runs: it still finds the old theme key.
  const { context, page } = await open({ scripts: false })
  await page.goto(`${origin}/en`, { waitUntil: 'domcontentloaded' })
  const state = await read(page)
  assert.equal(state.theme, 'dark', 'the pre-paint theme falls back to the old key')
  assert.equal(state.local['pdf-master-theme'], 'dark', 'nothing moves before the app runs')
  await context.close()
  checks.push('Before the first paint the theme falls back to the PDF Master key')
}

{
  const { context, page } = await open()
  await page.goto(`${origin}/en`)
  await page.waitForFunction(() => localStorage.getItem('pdf-master-theme') === null)
  const state = await read(page)
  assert.equal(state.local['docmaster-theme'], 'dark')
  assert.equal(state.local['docmaster-deck-seen:account-1'], '{"deck":3}', 'a suffixed key keeps its suffix')
  assert.equal(state.local['docmaster-editor-tips'], '["new"]', 'a value already under the new name wins')
  assert.equal(state.local.unrelated, 'kept', 'other keys are left alone')
  assert.equal(state.session['docmaster-draft'], '{"tool":"pdf.merge"}', 'session storage moves too')
  const left = [...Object.keys(state.local), ...Object.keys(state.session)].filter((key) => key.startsWith('pdf-master-'))
  assert.deepEqual(left, [], 'no PDF Master key is left')
  assert.equal(state.theme, 'dark')
  await context.close()
  checks.push('On load every pdf-master-… key in local and session storage moves to docmaster-…, nothing lost')
}

await browser.close()
for (const check of checks) console.log(`✓ ${check}`)
