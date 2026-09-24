import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const artifactDir = process.env.ANTIBOT_ARTIFACT_DIR
if (artifactDir) await fs.mkdir(artifactDir, { recursive: true })
const origin = process.env.AUTH_WEB_ORIGIN || 'http://127.0.0.1:3002'
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
page.setDefaultTimeout(10000)
const errors = [],
  checks = [],
  posts = []
page.on('pageerror', (error) => errors.push(error.message))
let enabled = true,
  configured = true,
  missing = false,
  signedIn = false,
  scriptFails = false,
  providerFails = false
let scriptRequests = 0,
  providerRequests = 0,
  failure = '',
  miniApp = false
const account = {
  id: 'account-one',
  display_name: 'Reader',
  locale: 'en',
  time_zone: 'UTC',
  mode: 'general',
  plan: 'free',
  preferences: {},
  email: '',
  google_email: '',
  login_methods: { email: false, google: false, telegram: false },
}
await context.route('https://telegram.org/**', (route) =>
  route.fulfill({
    contentType: 'application/javascript',
    body: miniApp ? "window.Telegram={WebApp:{initData:'signed-miniapp-data',ready(){},expand(){}}}" : '',
  }),
)
await context.route('https://accounts.google.com/**', (route) =>
  route.fulfill({ contentType: 'text/html', body: '<h1>Google authorization</h1>' }),
)
await context.route('https://challenges.cloudflare.com/turnstile/**', (route) => {
  scriptRequests++
  if (scriptFails) return route.abort('failed')
  return route.fulfill({
    contentType: 'application/javascript',
    body: `
    window.checkHarness = { renders: [], removed: [], current: null };
    window.turnstile = {
      ready(callback) { callback() },
      render(container, options) {
        const id = 'widget-' + window.checkHarness.renders.length;
        window.checkHarness.renders.push({ id, action: options.action, language: options.language, sitekey: options.sitekey, size: options.size, appearance: options.appearance, cData: options.cData });
        window.checkHarness.current = options;
        const button = document.createElement('button');
        button.textContent = 'Complete test check';
        button.onclick = () => options.callback('token-' + id);
        container.appendChild(button);
        return id;
      },
      remove(id) { window.checkHarness.removed.push(id) }
    };`,
  })
})
await context.route(`${origin}/api/v1/**`, async (route) => {
  const req = route.request(),
    path = new URL(req.url()).pathname.replace('/api/v1', ''),
    body = req.postDataJSON()
  const json = (value, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
  if (req.method() === 'POST') posts.push({ path, body })
  if (path === '/auth/providers') {
    providerRequests++
    if (providerFails) return json({}, 503)
    return json({
      email: { enabled: true, configured: true },
      google: { enabled: true, configured: true },
      telegram: { enabled: true, configured: true },
      ...(missing
        ? {}
        : {
            antibot: {
              enabled,
              configured,
              site_key: configured ? 'test-public-key' : '',
              binding: 'session-binding-one',
            },
          }),
    })
  }
  if (path === '/auth/session')
    return json({
      user: signedIn ? account : null,
      development_login_enabled: false,
      csrf_token: 'mock-csrf',
    })
  if (path === '/auth/email/login') return json({ error: { code: failure || 'invalid_credentials' } }, 401)
  if (path === '/auth/google/start')
    return failure
      ? json({ error: { code: failure } }, 503)
      : json({ authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth?state=test' })
  if (path === '/auth/browser/challenges')
    return json({ id: 'challenge-one', telegram_url: 'https://t.me/pdfmaster_test_bot?start=auth_test' })
  if (path === '/auth/telegram/miniapp') {
    signedIn = true
    return json({ user: account })
  }
  if (['/auth/email/register', '/auth/email/reset', '/auth/email/link'].includes(path))
    return json({ challenge_id: 'email-check' })
  if (path === '/catalog') return json({ features: [], draft: false })
  if (path === '/plans') return json({ plans: [], checkout_enabled: false })
  if (path === '/usage') return json({ plan: 'free', remaining: {} })
  if (path === '/jobs') return json({ results: [] })
  if (path === '/studio/config') return json({ features: [], providers: [], templates: [] })
  if (path === '/me') return json(account)
  return json({})
})
const go = (path = '/en/app') => page.goto(`${origin}${path}`)
const count = (path) => posts.filter((entry) => entry.path === path).length
const last = (path) => posts.filter((entry) => entry.path === path).at(-1)
const dialog = page.locator('dialog[open]')
async function login() {
  await page.getByLabel('Email address', { exact: true }).fill('reader@example.test')
  await page.getByLabel('Password', { exact: true }).fill('test-password-for-check')
  await page.locator('.auth-form').getByRole('button', { name: 'Sign in with email', exact: true }).click()
}
async function ready() {
  await dialog.getByRole('button', { name: 'Complete test check' }).waitFor()
}
async function complete() {
  await ready()
  await dialog.getByRole('button', { name: 'Complete test check' }).click()
  await dialog.waitFor({ state: 'hidden' })
}
try {
  enabled = false
  await go()
  await login()
  await page.getByText('Email or password is incorrect.', { exact: true }).waitFor()
  assert.equal(last('/auth/email/login').body.antibot_token, '')
  assert.equal(scriptRequests, 0)
  checks.push('Disabled protection submits normally and never requests the third-party script')

  enabled = true
  await go()
  const before = count('/auth/email/login')
  const beforeProviders = providerRequests
  await login()
  await ready()
  assert.equal(count('/auth/email/login'), before)
  assert.ok(providerRequests > beforeProviders)
  const options = await page.evaluate(() => window.checkHarness.renders.at(-1))
  assert.equal(options.cData, 'session-binding-one')
  assert.equal(options.action, 'customer_auth')
  assert.equal(options.sitekey, 'test-public-key')
  assert.equal(options.appearance, 'interaction-only')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  assert.equal((await new AxeBuilder({ page }).include('dialog[open]').analyze()).violations.length, 0)
  if (artifactDir) await page.screenshot({ path: path.join(artifactDir, 'antibot-en-mobile.png') })
  await complete()
  await page.getByText('Email or password is incorrect.', { exact: true }).waitFor()
  assert.equal(count('/auth/email/login'), before + 1)
  assert.equal(last('/auth/email/login').body.antibot_token, 'token-widget-0')
  await login()
  await complete()
  await page.getByText('Email or password is incorrect.', { exact: true }).waitFor()
  assert.equal(last('/auth/email/login').body.antibot_token, 'token-widget-1')
  assert.ok((await page.evaluate(() => window.checkHarness.removed.length)) >= 2)
  checks.push(
    'Enabled login waits for verification, fetches current config, sends one fresh token per attempt and removes completed widgets',
  )

  await login()
  await ready()
  const cancelledCount = count('/auth/email/login')
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  await page.getByText('Check cancelled. You can try again when ready.', { exact: true }).waitFor()
  await page.evaluate(() => window.checkHarness.current.callback('late-cancelled-token'))
  assert.equal(count('/auth/email/login'), cancelledCount)
  await login()
  await ready()
  await page.evaluate(() => window.checkHarness.current['error-callback']('test-error'))
  await dialog.getByText('The check did not pass. Please try again.', { exact: true }).waitFor()
  assert.equal(count('/auth/email/login'), cancelledCount)
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click()
  await ready()
  await page.evaluate(() => window.checkHarness.current['expired-callback']())
  await dialog.getByText('The check timed out. Please try again.', { exact: true }).waitFor()
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click()
  await complete()
  checks.push(
    'Escape cancels without an auth request; widget failure and expiry require a fresh successful retry',
  )

  await go()
  scriptFails = true
  await login()
  await dialog
    .getByText('The security check is unavailable. Please try again shortly.', { exact: true })
    .waitFor()
  scriptFails = false
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click()
  await complete()
  checks.push('Blocked script fails closed and reloads successfully on explicit retry')

  for (const condition of ['missing', 'unconfigured', 'providers-unavailable']) {
    await go()
    const previous = count('/auth/email/login')
    await page.getByLabel('Email address', { exact: true }).fill('reader@example.test')
    missing = condition === 'missing'
    configured = condition !== 'unconfigured'
    providerFails = condition === 'providers-unavailable'
    await login()
    await page
      .getByText('The security check is unavailable. Please try again shortly.', { exact: true })
      .waitFor()
    assert.equal(count('/auth/email/login'), previous)
    assert.equal(await dialog.count(), 0)
    missing = false
    configured = true
    providerFails = false
  }
  checks.push('Missing settings, missing key and unavailable configuration never bypass verification')

  for (const code of ['antibot_required', 'antibot_failed', 'antibot_unavailable']) {
    failure = code
    await go()
    await login()
    await complete()
    await page.locator('.auth-form .error-banner').waitFor()
    assert.equal(await page.getByText(code, { exact: true }).count(), 0)
  }
  failure = ''
  checks.push('Server verification rejection codes display localized recovery guidance')

  await go()
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await page.getByLabel('Your name', { exact: true }).fill('Reader')
  await page.getByLabel('Email address', { exact: true }).fill('reader@example.test')
  await page.getByLabel('Password', { exact: true }).fill('unique-password-123')
  await page.locator('.auth-form').getByRole('button', { name: 'Create account', exact: true }).click()
  await complete()
  await page.getByLabel('8-digit verification code').waitFor()
  assert.ok(last('/auth/email/register').body.antibot_token)
  await go()
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click()
  await page.getByLabel('Email address', { exact: true }).fill('reader@example.test')
  await page.getByRole('button', { name: 'Send reset code', exact: true }).click()
  await complete()
  await page.getByLabel('8-digit verification code').waitFor()
  assert.ok(last('/auth/email/reset').body.antibot_token)
  await go()
  await page.getByRole('button', { name: 'Continue with Telegram', exact: true }).click()
  await complete()
  await page.getByRole('link', { name: 'Open Telegram', exact: true }).waitFor()
  assert.ok(last('/auth/browser/challenges').body.antibot_token)
  await go()
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click()
  await complete()
  await page.waitForURL('https://accounts.google.com/**')
  assert.ok(last('/auth/google/start').body.antibot_token)
  checks.push('Registration, reset, Telegram and Google initiation all carry a verification token')

  signedIn = true
  await go('/en/app/settings')
  await page.getByRole('button', { name: 'Add email and password', exact: true }).click()
  await page.getByLabel('Email address', { exact: true }).fill('reader@example.test')
  await page.getByLabel('Password', { exact: true }).fill('unique-password-123')
  await page.getByRole('button', { name: 'Send verification code', exact: true }).click()
  await complete()
  await page.getByLabel('8-digit verification code').waitFor()
  assert.ok(last('/auth/email/link').body.antibot_token)
  await go('/en/app/settings')
  await page.getByRole('button', { name: 'Connect Telegram', exact: true }).click()
  await complete()
  await page.getByRole('link', { name: 'Open Telegram', exact: true }).waitFor()
  assert.equal(last('/auth/browser/challenges').body.intent, 'link')
  assert.ok(last('/auth/browser/challenges').body.antibot_token)
  await go('/en/app/settings')
  await page.getByRole('button', { name: 'Connect Google', exact: true }).click()
  await complete()
  await page.waitForURL('https://accounts.google.com/**')
  assert.equal(last('/auth/google/start').body.intent, 'link')
  assert.ok(last('/auth/google/start').body.antibot_token)
  signedIn = false
  checks.push(
    'Direct Settings links fetch verification config and protect email, Telegram and Google linking',
  )

  for (const [locale, heading, language] of [
    ['uz', 'Qisqa xavfsizlik tekshiruvi', 'en'],
    ['ru', 'Быстрая проверка безопасности', 'ru'],
  ]) {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.evaluate(
      (dark) => localStorage.setItem('pdf-master-theme', dark ? 'dark' : 'light'),
      locale === 'ru',
    )
    await go(`/${locale}/app`)
    await page.locator('.telegram-sign-in > button').click()
    await ready()
    await dialog.getByRole('heading', { name: heading }).waitFor()
    if (artifactDir) await page.screenshot({ path: path.join(artifactDir, `antibot-${locale}-320.png`) })
    assert.equal((await page.evaluate(() => window.checkHarness.renders.at(-1))).language, language)
    assert.equal((await page.evaluate(() => window.checkHarness.renders.at(-1))).size, 'compact')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.keyboard.press('Escape')
  }
  checks.push('Uzbek and Russian dialog copy, supported widget language and compact layout at 320px')

  miniApp = true
  await go()
  await ready()
  assert.equal(count('/auth/telegram/miniapp'), 0)
  await complete()
  await page.locator('.dashboard-drop').waitFor()
  assert.ok(last('/auth/telegram/miniapp').body.antibot_token)
  assert.equal(last('/auth/telegram/miniapp').body.init_data, 'signed-miniapp-data')
  checks.push('Automatic Telegram MiniApp sign-in waits for the same verification before posting signed data')
  assert.deepEqual(errors, [])
  const report = JSON.stringify(
    {
      status: 'passed',
      verified_at: new Date().toISOString(),
      boundary: 'Mocked Turnstile and API; no real customer or external verification traffic',
      checks,
    },
    null,
    2,
  )
  if (artifactDir) await fs.writeFile(path.join(artifactDir, 'antibot-verification.json'), report)
  console.log(report)
} finally {
  await browser.close()
}
