// Render files to PNG with system Chrome via Playwright.
// Usage: node shot.mjs jobs.json   where jobs = [{src, out, w, h, transparent, full, theme, scale}]
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
const require = createRequire('/Users/shakhzoduralov/Desktop/projects/pdf-master/document-web/package.json')
const { chromium } = require('playwright')

const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const browser = await chromium.launch({ channel: 'chrome' })
for (const j of jobs) {
  const ctx = await browser.newContext({
    viewport: { width: j.w, height: j.h },
    deviceScaleFactor: j.scale || 1,
    colorScheme: j.theme === 'dark' ? 'dark' : 'light',
  })
  const page = await ctx.newPage()
  if (j.svg) {
    const body = fs.readFileSync(j.src, 'utf8')
    await page.setContent(
      `<html><body style="margin:0;background:transparent">` +
        `<img src="data:image/svg+xml;base64,${Buffer.from(body).toString('base64')}" style="display:block;width:${j.w}px;height:${j.h}px"></body></html>`,
    )
  } else {
    await page.goto('file://' + path.resolve(j.src) + (j.q || ''))
    if (j.theme && !j.q) await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), j.theme)
  }
  await page.evaluate(() => document.fonts && document.fonts.ready)
  await page.waitForTimeout(150)
  if (j.check) {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    if (over > 0) console.log('OVERFLOW', j.out, over)
  }
  if (j.clipY != null) {
    const ph = await page.evaluate(() => document.documentElement.scrollHeight)
    if (j.clipY >= ph) { await ctx.close(); continue }
    j.clipH = Math.min(j.clipH || 900, ph - j.clipY)
  }
  fs.mkdirSync(path.dirname(j.out), { recursive: true })
  await page.screenshot({ path: j.out, omitBackground: !!j.transparent, fullPage: !!j.full, ...(j.clipY != null ? { clip: { x: 0, y: j.clipY, width: j.w, height: j.clipH || 900 }, fullPage: true } : {}) })
  await ctx.close()
  console.log('ok', j.out)
}
await browser.close()
