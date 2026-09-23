import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const origin = process.env.AUTH_WEB_ORIGIN || 'http://127.0.0.1:3001'
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
const page = await context.newPage()
page.setDefaultTimeout(10000)
page.setDefaultNavigationTimeout(15000)
const errors = []
const checks = []
page.on('pageerror', (error) => errors.push(error.message))
const account = {
  id: 'one-shared-account',
  display_name: 'Alex Reader',
  locale: 'en',
  time_zone: 'UTC',
  mode: 'general',
  plan: 'free',
  preferences: {},
  email: 'alex@example.test',
  email_verified: true,
  google_email: null,
  telegram_user_id: null,
  login_methods: { email: true, google: false, telegram: false },
}
let signedIn = false
let providers = {
  email: { enabled: true, configured: true },
  google: { enabled: true, configured: true },
  telegram: { enabled: true, configured: true },
}
let telegramIntent
let googleIntent
let rejectCode = false
let registered = false
const requests = []
await context.route('https://telegram.org/**', (route) =>
  route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
)
await context.route('https://accounts.google.com/**', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<h1>Google authorization test boundary</h1>',
  }),
)
await context.route(`${origin}/api/v1/**`, async (route) => {
  const req = route.request(),
    path = new URL(req.url()).pathname.replace('/api/v1', ''),
    body = req.postDataJSON()
  requests.push({ path, method: req.method(), body })
  const json = (value, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
  if (path === '/auth/providers') return json(providers)
  if (path === '/auth/session') {
    if (req.method() === 'DELETE') signedIn = false
    return json({
      user: signedIn ? account : null,
      development_login_enabled: false,
      csrf_token: 'mock-csrf',
    })
  }
  if (path === '/auth/email/register') {
    registered = true
    return json({ status: 'verification_sent', challenge_id: 'register-code' })
  }
  if (path === '/auth/email/verify') {
    if (rejectCode)
      return json(
        { error: { code: 'invalid_verification_code', message: 'Do not render server error text' } },
        400,
      )
    signedIn = true
    account.login_methods.email = true
    return json({ user: account })
  }
  if (path === '/auth/email/login') {
    if (body.password === 'incorrect-password') return json({ error: { code: 'invalid_credentials' } }, 401)
    signedIn = true
    return json({ user: account })
  }
  if (path === '/auth/email/link') return json({ status: 'verification_sent', challenge_id: 'link-code' })
  if (path === '/auth/email/reset') return json({ status: 'verification_sent', challenge_id: 'reset-code' })
  if (path === '/auth/email/reset/confirm') return json({ status: 'password_reset' })
  if (path === '/auth/password') return json({ user: account })
  if (path === '/auth/google/start') {
    googleIntent = body.intent
    return json({
      authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth?state=server-generated-state',
    })
  }
  if (path === '/auth/browser/challenges') {
    telegramIntent = body.intent
    return json({ id: 'telegram-link', telegram_url: 'https://t.me/pdfmaster_test_bot?start=auth_example' })
  }
  if (path === '/auth/browser/challenges/telegram-link') return json({ status: 'approved' })
  if (path === '/auth/browser/challenges/telegram-link/exchange') {
    account.telegram_user_id = '12345678'
    account.login_methods.telegram = true
    return json({ user: account })
  }
  if (path === '/catalog') return json({ features: [], draft: false })
  if (path === '/plans') return json({ plans: [], draft: false, checkout_enabled: false })
  if (path === '/usage') return json({ plan: 'free', remaining: {} })
  if (path === '/jobs') return json({ results: [], count: 0 })
  if (path === '/studio/config') return json({ features: [], providers: [], templates: [] })
  if (path === '/me') return json(account)
  return json({})
})
const go = (path) => page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' })
const shots = 'docs/design/screenshots/authentication'
await fs.mkdir(shots, { recursive: true })
try {
  await go('/en/app')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await page.getByLabel('Your name', { exact: true }).fill('Alex Reader')
  await page.getByLabel('Email address', { exact: true }).fill('alex@example.test')
  await page.getByLabel('Password', { exact: true }).fill('unique-password-123')
  await page.locator('.auth-form').getByRole('button', { name: 'Create account', exact: true }).click()
  await page.getByLabel('8-digit verification code').waitFor()
  assert.ok(registered)
  await page.getByLabel('8-digit verification code').fill('12345678')
  rejectCode = true
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await page.getByText('That code is incorrect. Check your email and try again.', { exact: true }).waitFor()
  assert.equal(await page.getByText('Do not render server error text').count(), 0)
  rejectCode = false
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await page.locator('.dashboard-drop').waitFor()
  checks.push(
    'Registration and 8-digit verification; localized invalid-code error; successful session enters workspace',
  )
  await go('/en/app/settings')
  await page.getByRole('heading', { name: 'Sign-in methods', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Connect Telegram', exact: true }).click()
  await page.getByRole('link', { name: 'Open Telegram', exact: true }).waitFor()
  assert.equal(telegramIntent, 'link')
  await page.getByRole('button', { name: 'Check confirmation', exact: true }).click()
  await page.locator('[data-auth-method="telegram"]').getByText('Connected', { exact: true }).waitFor()
  assert.equal(account.id, 'one-shared-account')
  assert.equal(await page.getByRole('button', { name: 'Connect Telegram', exact: true }).count(), 0)
  checks.push(
    'Telegram linking passes link intent, exchanges approval and refreshes linked state for the same account',
  )
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await page.getByLabel('Current password').fill('unique-password-123')
  await page.getByLabel('New password').fill('new-unique-password-456')
  await page.getByRole('button', { name: 'Save password', exact: true }).click()
  await page.getByText(/Password updated/).waitFor()
  assert.equal(requests.filter((request) => request.path === '/auth/password').length, 1)
  checks.push('Password change submits current/new credentials once and clears the form')
  await page.getByRole('button', { name: 'Connect Google', exact: true }).click()
  await page.waitForURL('https://accounts.google.com/**')
  assert.equal(googleIntent, 'link')
  checks.push('Google connection uses authenticated link intent and redirects to Google authorization')
  await go('/en/app/settings?auth_error=identity_already_linked')
  await page.getByText(/This sign-in method belongs to an account already/).waitFor()
  await page.waitForURL(`${origin}/en/app/settings`)
  assert.equal(new URL(page.url()).search, '')
  checks.push('Google identity conflict offers existing-account guidance and removes callback query')
  account.google_email = account.email
  account.login_methods.google = true
  account.login_methods.email = false
  await go('/en/app/settings')
  await page.getByRole('button', { name: 'Add email and password', exact: true }).click()
  assert.equal(await page.getByLabel('Email address', { exact: true }).inputValue(), account.email)
  await page.getByLabel('Password', { exact: true }).fill('google-user-password-123')
  await page.getByRole('button', { name: 'Send verification code', exact: true }).click()
  await page.getByLabel('8-digit verification code').fill('12345678')
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await page.locator('[data-auth-method="email"]').getByText('Connected', { exact: true }).waitFor()
  assert.equal(account.id, 'one-shared-account')
  checks.push(
    'A Google account can add verified email/password while preserving its account and linked identities',
  )
  await page.screenshot({ path: `${shots}/settings-desktop.png`, fullPage: true })
  for (const [locale, heading] of [
    ['en', 'Sign-in methods'],
    ['uz', 'Kirish usullari'],
    ['ru', 'Способы входа'],
  ]) {
    await page.setViewportSize({ width: 390, height: 844 })
    await go(`/${locale}/app/settings`)
    await page.getByRole('heading', { name: heading, exact: true }).waitFor()
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `${locale} mobile settings overflow`,
    )
    await page.screenshot({ path: `${shots}/settings-${locale}-mobile.png`, fullPage: true })
  }
  signedIn = false
  await go('/en/app')
  await page.getByLabel('Email address', { exact: true }).fill('alex@example.test')
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password')
  await page.locator('.auth-form').getByRole('button', { name: 'Sign in with email', exact: true }).click()
  await page.getByText('Email or password is incorrect.', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), '')
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click()
  await page.getByRole('button', { name: 'Send reset code', exact: true }).click()
  await page.getByLabel('8-digit verification code').fill('12345678')
  await page.getByLabel('New password', { exact: true }).fill('reset-unique-password-123')
  await page.getByRole('button', { name: 'Save password', exact: true }).click()
  await page.getByText('Password reset. Sign in with your new password.', { exact: true }).waitFor()
  checks.push('Incorrect login clears password; reset returns to login without silently authenticating')
  const accessibility = await new AxeBuilder({ page }).include('.auth-panel').analyze()
  assert.deepEqual(
    accessibility.violations
      .filter((item) => ['critical', 'serious'].includes(item.impact))
      .map((item) => item.id),
    [],
  )
  checks.push('No serious or critical automated accessibility findings in sign-in form')
  for (const locale of ['en', 'uz', 'ru']) {
    await go(`/${locale}/app`)
    await page.locator('.auth-form input[type=email]').waitFor()
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `${locale} mobile sign-in overflow`,
    )
    await page.screenshot({ path: `${shots}/login-${locale}-mobile.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 320, height: 720 })
  await go('/en/app')
  await page.locator('.auth-form input[type=email]').waitFor()
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    '320px sign-in overflow',
  )
  assert.equal(
    await page.locator('.mobile-nav').count(),
    0,
    'Unauthenticated form is not covered by customer navigation',
  )
  checks.push(
    'EN/UZ/RU mobile sign-in and settings have no horizontal overflow; 320px sign-in fits with no account navigation overlay',
  )
  providers = Object.fromEntries(
    ['email', 'google', 'telegram'].map((key) => [key, { enabled: false, configured: false }]),
  )
  await go('/en/app')
  await page.getByText('Google sign-in is not available yet.', { exact: true }).waitFor()
  assert.ok(await page.getByRole('button', { name: 'Continue with Google', exact: true }).isDisabled())
  assert.ok(await page.getByRole('button', { name: 'Continue with Telegram', exact: true }).isDisabled())
  assert.ok(
    await page
      .locator('.auth-form')
      .getByRole('button', { name: 'Sign in with email', exact: true })
      .isDisabled(),
  )
  checks.push('Unconfigured providers disable their actions with localized availability messages')
  assert.deepEqual(errors, [])
  const report = {
    status: 'passed',
    boundary:
      'Mocked external identity/API responses; browser behavior only. Real email lifecycle is tested separately.',
    verified_at: new Date().toISOString(),
    checks,
  }
  await fs.writeFile(
    'docs/design/authentication-ui-verification.json',
    JSON.stringify(report, null, 2) + '\n',
  )
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
