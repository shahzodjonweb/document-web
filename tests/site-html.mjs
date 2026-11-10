// The HTML the server sends, before any script runs: what search engines and
// link previews read. Runs the built server (`npm run build` first) against a
// stub of the platform's public API, then against no API at all.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import http from 'node:http'
import process from 'node:process'

const plans = {
  currency: 'UZS',
  period_seconds: 2592000,
  plans: [
    { id: 'free', name: 'Free', price_uzs: 0, discount: null, limits: { weekly_ai_documents: 5, weekly_file_jobs: 15, edits_per_file: 3 } },
    // A discount whose last day has passed must not reach the page.
    { id: 'plus', name: 'Plus', price_uzs: 20000, discount: { price: 15000, regular: 20000, percent: 25, until: '2020-01-01' }, limits: { weekly_ai_documents: 20, weekly_file_jobs: null, edits_per_file: 10 } },
    { id: 'premium', name: 'Premium', price_uzs: 60000, discount: { price: 45000, regular: 60000, percent: 25, until: '2099-12-31' }, limits: { weekly_ai_documents: null, weekly_file_jobs: null, edits_per_file: null } },
  ],
}
const catalog = {
  draft: true,
  features: [
    { id: 'pdf.merge', name: 'Merge PDFs', category: 'organize', enabled: true, eligible: true, parameters: {}, release: 'development_beta' },
    { id: 'pdf.compress', name: 'Compress PDF', category: 'optimize', enabled: true, eligible: true, parameters: {}, release: 'development_beta' },
  ],
}
const contacts = {
  support: { username: 'stub_support', url: 'https://t.me/stub_support' },
  ads: { username: '', url: '' },
  company: { name: '"ARCANIUM TECHNOLOGIES" MCHJ', tin: '313458514', address: 'Toshkent', phone: '', email: '' },
}

const stub = http.createServer((req, res) => {
  const body = { '/api/v1/plans': plans, '/api/v1/catalog': catalog, '/api/v1/contacts': contacts }[req.url.split('?')[0]]
  res.writeHead(body ? 200 : 404, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body ?? { error: 'not found' }))
})
await new Promise((resolve) => stub.listen(0, '127.0.0.1', resolve))
const stubOrigin = `http://127.0.0.1:${stub.address().port}`

const servers = []
async function serve(port, apiOrigin, extra = {}) {
  const child = spawn(process.execPath, ['.output/server/index.mjs'], {
    env: { ...process.env, NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port), NUXT_API_ORIGIN: apiOrigin, ...extra },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  servers.push(child)
  const origin = `http://127.0.0.1:${port}`
  for (let tries = 0; tries < 100; tries += 1) {
    try {
      if ((await fetch(`${origin}/en/app`)).ok) return origin
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`the server on ${port} did not start`)
}
// As a browser or a crawler asks: without text/html, an error comes back as JSON.
const get = (origin, path, headers = {}) =>
  fetch(origin + path, { redirect: 'manual', headers: { accept: 'text/html', ...headers } })

let failures = 0
async function check(name, run) {
  try {
    await run()
    console.log(`ok   ${name}`)
  } catch (error) {
    failures += 1
    console.log(`FAIL ${name}\n     ${error.message}`)
  }
}

try {
  // As after launch: the new address, and search engines welcome.
  const site = await serve(3191, stubOrigin, {
    NUXT_PUBLIC_SITE_ORIGIN: 'https://docmaster.live',
    NUXT_PUBLIC_SITE_INDEXABLE: '1',
  })
  const head = (html, pattern) => [...html.matchAll(pattern)].map((match) => match[1])
  const ld = (html) => JSON.parse(head(html, /<script[^>]*application\/ld\+json[^>]*>([^<]*)<\/script>/g)[0] || 'null')

  await check('the bare address goes to the browser’s language, temporarily', async () => {
    const ru = await get(site, '/', { 'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8' })
    assert.equal(ru.status, 302)
    assert.equal(new URL(ru.headers.get('location'), site).pathname, '/ru')
    const uz = await get(site, '/', { 'accept-language': 'de-DE,de;q=0.9,uz;q=0.5' })
    assert.equal(new URL(uz.headers.get('location'), site).pathname, '/uz')
    const other = await get(site, '/', { 'accept-language': 'de-DE' })
    assert.equal(new URL(other.headers.get('location'), site).pathname, '/en')
  })

  await check('an address without a language moves to English for good', async () => {
    const response = await get(site, '/pricing')
    assert.equal(response.status, 301)
    assert.equal(new URL(response.headers.get('location'), site).pathname, '/en/pricing')
  })

  await check('the home page is in the HTML, with its tools and live prices', async () => {
    const response = await get(site, '/en')
    assert.equal(response.status, 200)
    const html = await response.text()
    assert.match(html, /<html[^>]*\blang="en"/)
    assert.match(html, /<h1[\s>]/)
    assert.ok(html.includes('Merge PDF'), 'every tool, by name')
    assert.ok(html.includes('20 000'), 'the Plus price')
    assert.ok(html.includes('45 000'), 'a discount still running')
    assert.ok(!html.includes('15 000'), 'a discount whose last day has passed')
    assert.ok(html.includes('pdf-master-theme'), 'the theme is set before the first paint')
    assert.ok(!html.includes('telegram-web-app.js'), 'no Telegram script on a public page')
  })

  await check('each language renders as itself', async () => {
    const html = await (await get(site, '/uz')).text()
    assert.match(html, /<html[^>]*\blang="uz"/)
  })

  await check('the help page carries the company details', async () => {
    const response = await get(site, '/en/help')
    assert.equal(response.status, 200)
    assert.ok((await response.text()).includes('313458514'))
  })

  await check('the pricing page renders on the server', async () => {
    const response = await get(site, '/ru/pricing')
    assert.equal(response.status, 200)
    assert.ok((await response.text()).includes('60 000'))
  })

  await check('a page that does not exist is a 404, not the home page', async () => {
    for (const path of ['/en/nope', '/ru/legal/unknown', '/uz/tools/a/b']) {
      const response = await get(site, path)
      assert.equal(response.status, 404, path)
      const html = await response.text()
      assert.ok(html.includes('noindex'), `${path} is not indexed`)
    }
  })

  await check('the app renders in the browser, with Telegram’s script ahead of it', async () => {
    for (const path of ['/en/app', '/uz/app/tools', '/ru/auth/telegram', '/en/app?file_id=1']) {
      const response = await get(site, path)
      assert.equal(response.status, 200, path)
      const html = await response.text()
      const telegram = html.indexOf('telegram-web-app.js')
      assert.ok(telegram > 0, `${path} has the Telegram script`)
      assert.ok(telegram < html.indexOf('/_nuxt/'), `${path} loads it before the app`)
      assert.ok(!/<h1[\s>]/.test(html), `${path} is not rendered on the server`)
    }
  })


  await check('a page names its canonical address, its languages and its preview', async () => {
    const html = await (await get(site, '/ru/pricing')).text()
    assert.deepEqual(head(html, /<link[^>]*rel="canonical"[^>]*href="([^"]+)"/g), ['https://docmaster.live/ru/pricing'])
    const languages = head(html, /<link[^>]*hreflang="([^"]+)"/g).sort()
    assert.deepEqual(languages, ['en', 'ru', 'uz', 'x-default'])
    assert.ok(html.includes('href="https://docmaster.live/en/pricing"'), 'x-default and en name the English page')
    assert.match(html, /<meta[^>]*name="robots"[^>]*content="index, follow"/)
    assert.match(html, /<meta[^>]*property="og:image"[^>]*content="https:\/\/docmaster.live\/og\/docmaster-ru.png"/)
    assert.match(html, /<meta[^>]*name="description"[^>]*content="[^"]{60,}"/)
    assert.equal(head(html, /<meta[^>]*name="description"/g).length, 1, 'one description')
    assert.ok(!html.includes('{brand}'), 'the product name is filled in')
  })

  await check('the home page says who runs it and what the plans cost', async () => {
    const html = await (await get(site, '/en')).text()
    assert.ok(html.includes('hreflang="x-default" href="https://docmaster.live/"'), 'x-default is the language chooser')
    const graph = ld(html)['@graph']
    const organization = graph.find((item) => item['@type'] === 'Organization')
    assert.equal(organization.taxID, '313458514')
    assert.ok(!('telephone' in organization) && !('email' in organization), 'no blank contacts')
    const offers = graph.find((item) => item['@type'] === 'WebApplication').offers.map((offer) => offer.price)
    assert.deepEqual(offers, [0, 20000, 60000], 'regular prices')
    assert.ok(!graph.some((item) => 'aggregateRating' in item), 'no ratings')
  })

  await check('a tool page has its own address, title and breadcrumb; the old address moved', async () => {
    const moved = await get(site, '/uz/tools/pdf.merge')
    assert.equal(moved.status, 301)
    assert.equal(new URL(moved.headers.get('location'), site).pathname, '/uz/tools/merge-pdf')
    const html = await (await get(site, '/uz/tools/merge-pdf')).text()
    assert.match(html, /<title>PDF birlashtirish[^<]*<\/title>/)
    const crumbs = ld(html)['@graph'].find((item) => item['@type'] === 'BreadcrumbList').itemListElement
    assert.deepEqual(crumbs.map((crumb) => crumb.item), [
      'https://docmaster.live/uz', 'https://docmaster.live/uz/tools', 'https://docmaster.live/uz/tools/merge-pdf',
    ])
  })

  await check('draft legal pages are kept out of search', async () => {
    const html = await (await get(site, '/en/legal/privacy')).text()
    assert.match(html, /<meta[^>]*name="robots"[^>]*content="noindex, follow"/)
  })

  await check('robots.txt keeps crawlers out of the app and points at the sitemap', async () => {
    const text = await (await get(site, '/robots.txt')).text()
    assert.ok(text.includes('Disallow: /*/app') && text.includes('Disallow: /api/'))
    assert.ok(text.includes('Sitemap: https://docmaster.live/sitemap.xml'))
    assert.ok(!/^Disallow: \/$/m.test(text))
  })

  await check('the sitemap lists every public page in three languages, and nothing else', async () => {
    const response = await get(site, '/sitemap.xml')
    assert.match(response.headers.get('content-type'), /xml/)
    const xml = await response.text()
    const urls = head(xml, /<loc>([^<]+)<\/loc>/g)
    assert.equal(urls.length, 3 * 33, `${urls.length} addresses`)
    assert.ok(urls.includes('https://docmaster.live/ru/tools/merge-pdf'))
    assert.ok(!urls.some((url) => /\/(app|auth|legal)(\/|$)/.test(url)), 'no app, sign-in or draft pages')
    assert.equal((xml.match(/hreflang="x-default"/g) || []).length, urls.length)
  })

  await check('the web manifest names the product', async () => {
    const manifest = await (await get(site, '/site.webmanifest')).json()
    assert.equal(manifest.name, 'DocMaster')
    assert.equal(manifest.icons.length, 3)
  })

  // As before launch: the defaults keep search engines away.
  const lonely = await serve(3192, 'http://127.0.0.1:9')
  await check('before launch every page says noindex and robots.txt shuts the door', async () => {
    const html = await (await get(lonely, '/en/pricing')).text()
    assert.match(html, /<meta[^>]*name="robots"[^>]*content="noindex, follow"/)
    assert.equal((await (await get(lonely, '/robots.txt')).text()).trim(), 'User-agent: *\nDisallow: /')
  })

  await check('with the API unreachable, a page still renders, quickly', async () => {
    const started = Date.now()
    const response = await get(lonely, '/en')
    assert.equal(response.status, 200)
    assert.match(await response.text(), /<h1[\s>]/)
    assert.ok(Date.now() - started < 5000, `took ${Date.now() - started} ms`)
  })
} finally {
  for (const child of servers) child.kill()
  stub.close()
}

if (failures) {
  console.log(`\n${failures} failed`)
  process.exit(1)
}
console.log('\nPass: the server sends real pages')
