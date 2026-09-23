/** Real Django email lifecycle against scripts/dev_auth_e2e.py; mail stays in a local file spool. */
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const origin = process.env.AUTH_WEB_ORIGIN || 'http://127.0.0.1:3001'
const mailDir = process.env.AUTH_MAIL_DIR || '/tmp/pdfmaster-auth-e2e/mail'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Real fixture test is local only')
const email = `browser-${Date.now()}@example.test`
const password = `Signup-${randomBytes(15).toString('hex')}`
const changedPassword = `Changed-${randomBytes(15).toString('hex')}`
const resetPassword = `Reset-${randomBytes(15).toString('hex')}`
const seenCodes = new Set()
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1280, height: 1050 } })
const secondContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
for (const ctx of [context, secondContext]) {
  await ctx.route('https://telegram.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
  )
}
const page = await context.newPage()
const otherPage = await secondContext.newPage()
const runtimeErrors = []
for (const item of [page, otherPage]) {
  item.setDefaultTimeout(15000)
  item.setDefaultNavigationTimeout(15000)
  item.on('pageerror', (error) => runtimeErrors.push(error.message))
}
const checks = []
const shots = 'docs/design/screenshots/authentication'
await fs.mkdir(shots, { recursive: true })
async function codeFromLocalMail() {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    const names = await fs.readdir(mailDir).catch(() => [])
    for (const name of names.reverse()) {
      const message = await fs.readFile(path.join(mailDir, name), 'utf8')
      if (!message.includes(email)) continue
      const content = message
        .split(/\r?\n\r?\n/)
        .slice(1)
        .join('\n\n')
      const matches = content.match(/\b[0-9]{8}\b/g) || []
      for (const code of matches.reverse()) {
        if (!seenCodes.has(code)) {
          seenCodes.add(code)
          return code
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('No new verification code in local email spool')
}
async function session(ctx = context) {
  const response = await ctx.request.get(`${origin}/api/v1/auth/session`)
  assert.ok(response.ok(), 'Session endpoint responds')
  return response.json()
}
async function login(target, value) {
  await target.goto(`${origin}/en/app`, { waitUntil: 'domcontentloaded' })
  await target.getByLabel('Email address', { exact: true }).fill(email)
  await target.getByLabel('Password', { exact: true }).fill(value)
  await target.locator('.auth-form').getByRole('button', { name: 'Sign in with email', exact: true }).click()
  await target.locator('.dashboard-drop').waitFor()
}
async function logout() {
  await page.goto(`${origin}/en/app/settings`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Email address', { exact: true }).waitFor()
}
try {
  const providers = await (await context.request.get(`${origin}/api/v1/auth/providers`)).json()
  assert.ok(providers.email.enabled && providers.email.configured, 'Isolated fixture email is configured')
  await page.goto(`${origin}/en/app`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await page.getByLabel('Your name', { exact: true }).fill('Email Browser Test')
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.locator('.auth-form').getByRole('button', { name: 'Create account', exact: true }).click()
  await page.getByLabel('8-digit verification code').waitFor()
  assert.equal((await session()).user, null, 'Registration does not authenticate before verification')
  const verificationCode = await codeFromLocalMail()
  await page
    .getByLabel('8-digit verification code')
    .fill(verificationCode === '00000000' ? '11111111' : '00000000')
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await page.getByText('That code is incorrect. Check your email and try again.', { exact: true }).waitFor()
  await page.getByLabel('8-digit verification code').fill(verificationCode)
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await page.locator('.dashboard-drop').waitFor()
  const initial = (await session()).user
  assert.ok(initial.id)
  assert.equal(initial.email, email)
  assert.equal(initial.email_verified, true)
  assert.deepEqual(initial.login_methods, { email: true, google: false, telegram: false })
  checks.push(
    'Real registration sends local email, requires correct verification code and creates a verified email-only account',
  )
  await page.goto(`${origin}/en/app/settings`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-auth-method="email"]').getByText('Connected', { exact: true }).waitFor()
  await page.screenshot({ path: `${shots}/real-email-settings-desktop.png`, fullPage: true })
  await login(otherPage, password)
  assert.equal((await session(secondContext)).user.id, initial.id)
  checks.push('Email/password login in a separate browser session resolves the original account')
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await page.getByLabel('Current password', { exact: true }).fill(password)
  await page.getByLabel('New password', { exact: true }).fill(changedPassword)
  await page.getByRole('button', { name: 'Save password', exact: true }).click()
  await page.getByText('Password updated. Other sessions have been signed out.', { exact: true }).waitFor()
  assert.equal((await session()).user.id, initial.id)
  assert.equal((await session(secondContext)).user, null, 'Password change invalidates other sessions')
  checks.push('Password change preserves current account/session and invalidates the other browser session')
  await logout()
  await login(page, changedPassword)
  assert.equal((await session()).user.id, initial.id)
  await logout()
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click()
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Send reset code', exact: true }).click()
  await page.getByLabel('8-digit verification code').waitFor()
  await page.getByLabel('8-digit verification code').fill(await codeFromLocalMail())
  await page.getByLabel('New password', { exact: true }).fill(resetPassword)
  await page.getByRole('button', { name: 'Save password', exact: true }).click()
  await page.getByText('Password reset. Sign in with your new password.', { exact: true }).waitFor()
  assert.equal((await session()).user, null, 'Password reset does not automatically authenticate')
  await login(page, resetPassword)
  assert.equal((await session()).user.id, initial.id)
  checks.push('Real reset email/code sets a new password; subsequent sign-in preserves the same account')
  for (const [locale, heading] of [
    ['en', 'Sign-in methods'],
    ['uz', 'Kirish usullari'],
    ['ru', 'Способы входа'],
  ]) {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${origin}/${locale}/app/settings`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: heading, exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.screenshot({ path: `${shots}/real-email-settings-${locale}-mobile.png`, fullPage: true })
  }
  checks.push('Real account settings render EN/UZ/RU at mobile width without overflow')
  assert.deepEqual(runtimeErrors, [])
  const report = {
    status: 'passed',
    boundary:
      'Real Django API and browser cookies; email delivered only to isolated local file spool. No live Google or Telegram provider calls.',
    verified_at: new Date().toISOString(),
    account_id: initial.id,
    checks,
  }
  await fs.writeFile(
    'docs/design/authentication-email-verification.json',
    JSON.stringify(report, null, 2) + '\n',
  )
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
