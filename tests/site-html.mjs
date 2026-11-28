// The HTML the server sends, before any script runs: what search engines and
// link previews read. Runs the built server (`npm run build` first) against a
// stub of the platform's public API, then against no API at all.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
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

// Under /automatic the same platform, once automatic payment (inPAY) is on beside card transfer.
const stub = http.createServer((req, res) => {
  const path = req.url.split('?')[0]
  const automatic = path.startsWith('/automatic/')
  const body = {
    '/api/v1/plans': automatic ? { ...plans, checkout: { automatic: true, card: true } } : plans,
    '/api/v1/catalog': catalog,
    '/api/v1/contacts': contacts,
  }[path.replace(/^\/automatic/, '')]
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
    assert.ok(html.includes('docmaster-theme'), 'the theme is set before the first paint')
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
    // The last is where inPAY sends a browser back, signed in or not, with whatever it adds to the address.
    for (const path of ['/en/app', '/uz/app/tools', '/ru/auth/telegram', '/en/app?file_id=1',
      '/uz/app/pay/10000000-0000-4000-8000-000000000001?status=success']) {
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

  // An AI document's draft, what was read from its files and the files a change of it needs stay in the account
  // until it is deleted (document-platform apps/studio/keeping.py): no page may still say they go on their own.
  await check('no page says an AI document, or the files a change of it needs, is deleted after 30 days or 24 hours', async () => {
    const stale = [
      'AI: 30 days', 'AI: 30 kun', 'ИИ: 30 дней',
      'Your AI requests and results are kept for 30 days for quality review, then deleted.',
      'AI so‘rovlaringiz va natijalar sifatni tekshirish uchun 30 kun saqlanadi, keyin o‘chiriladi.',
      'Запросы к ИИ и результаты хранятся 30 дней для проверки качества, затем удаляются.',
      'for up to 24 hours. AI', 'ko‘pi bilan 24 soat. AI', 'не дольше 24 часов. Запросы',
    ]
    // Wherever the file band is shown (home, help, privacy, the AI CV page) its last step names the exception.
    const staleBand = ['Uploaded files and results are removed.', 'Yuklangan fayllar va natijalar o‘chiriladi.', 'Загруженные файлы и результаты удаляются.',
      // Its first step no longer says the file is kept only for the task.
      'The file is kept only to run your task.', 'Fayl faqat vazifangizni bajarish uchun saqlanadi.', 'Файл хранится только для вашей задачи.']
    const said = {
      en: { home: 'AI: kept for changes', help: 'the files an AI document needs to be changed stay until the account is deleted',
            kept: 'except those an AI document needs for a change', cv: 'what was read from your files', meta: 'unless an AI document needs them',
            later: 'For an AI document, ask for a change instead.' },
      uz: { home: 'AI: o‘zgartirish uchun saqlanadi', help: 'AI hujjatni o‘zgartirish uchun kerak bo‘ladigan fayllar esa hisobingiz o‘chirilguncha',
            kept: 'faqat AI hujjatni o‘zgartirish uchun kerakli fayllar qoladi', cv: 'fayllaringizdan o‘qilgan maʼlumotlar', meta: 'AI hujjatga kerakli fayllardan tashqari',
            later: 'AI hujjatni esa qaytadan yaratish o‘rniga unga o‘zgartirish so‘rang.' },
      ru: { home: 'ИИ: хранится для правок', help: 'файлы, нужные для изменения ИИ-документа, хранятся, пока аккаунт не удалён',
            kept: 'кроме нужных для изменения ИИ-документа', cv: 'то, что прочитано из ваших файлов', meta: 'кроме нужных ИИ-документу',
            later: 'Для ИИ-документа вместо этого попросите его изменить.' },
    }
    for (const [locale, lines] of Object.entries(said)) {
      const pages = {}
      for (const [name, page] of [['home', ''], ['privacy', '/legal/privacy'], ['help', '/help'], ['cv', '/ai/cv']]) {
        const response = await get(site, `/${locale}${page}`)
        assert.equal(response.status, 200, `/${locale}${page}`)
        pages[name] = (await response.text()).replaceAll('\u00a0', ' ')
        for (const line of [...stale, ...staleBand]) {
          assert.ok(!pages[name].includes(line), `/${locale}${page} still says “${line}”`)
        }
      }
      assert.ok(pages.home.includes(lines.home) && pages.privacy.includes(lines.home), `${locale}: the AI fact says it is kept`)
      assert.ok(pages.help.includes(lines.help), `${locale}: where files are stored names the AI document’s files`)
      // A result that is gone must be run again, but an AI document is changed instead (its draft stays).
      assert.ok(pages.help.includes(lines.later), `${locale}: “Can I download a result again later?” names the AI document`)
      for (const name of ['home', 'help', 'privacy', 'cv']) assert.ok(pages[name].includes(lines.kept), `${locale} ${name}: the file band names what is kept`)
      assert.ok(pages.cv.includes(lines.cv), `${locale}: the CV page says what was read from the files stays`)
      const description = head(pages.privacy, /<meta[^>]*name="description"[^>]*content="([^"]*)"/g)[0] || ''
      assert.ok(description.includes(lines.meta), `${locale}: the privacy page’s description names the exception: ${description}`)
    }
  })

  // The text read from the files an AI document was made from (an old CV, a LinkedIn PDF) stays in its kept draft
  // after those files go, as /terms, the privacy policy and the offer say: so do the app's privacy article, the AI
  // hub's note, the answer to “Is my request stored?” and the AI fact on the home and privacy pages. The article
  // ('Temporary files & privacy' on /app/support and a tool's page) is drawn in the browser, so its catalog string
  // is read; the note, the answer and the fact are read on the pages too.
  await check('what an AI document keeps names what was read from the files it was made from, wherever it is said', async () => {
    const read = ['what was read from the files it was made from', 'fayllardan o‘qilgan maʼlumotlar', 'то, что прочитано из файлов, по которым']
    // The AI fact is a short tile: in English and Russian it says “its files”.
    const fact = ['what was read from its files', 'fayllaridan o‘qilgan maʼlumotlar', 'то, что прочитано из его файлов']
    const { default: dictionaries } = await import('../locales/catalog.ts')
    const { site: copy } = await import('../locales/site.ts')
    const { faq: questions } = await import('../content/site/faq.ts')
    const stored = questions.find((item) => item.id === 'ai-docs-stored')
    for (const [index, locale] of ['en', 'uz', 'ru'].entries()) {
      assert.ok(dictionaries[locale].helpPrivacyBody.includes(read[index]), `${locale}: the app's privacy article says it`)
      assert.ok(copy.siteAiDataNote[index].includes(read[index]), `${locale}: the AI hub's note says it`)
      assert.ok(stored.a[index].includes(read[index]), `${locale}: “${stored.q[index]}” says it`)
      assert.ok(copy.siteHomeFactAiText[index].includes(fact[index]), `${locale}: the AI fact says it`)
      for (const page of ['', '/legal/privacy']) {
        const html = (await (await get(site, `/${locale}${page}`)).text()).replaceAll(' ', ' ')
        assert.ok(html.includes(fact[index]), `/${locale}${page}: the AI fact says it`)
      }
      for (const page of ['/ai', '/help']) {
        const html = (await (await get(site, `/${locale}${page}`)).text()).replaceAll(' ', ' ')
        assert.ok(html.includes(read[index]), `/${locale}${page} says it`)
      }
    }
  })

  // Every page in the sitemap, the legal pages and the app's billing page, in three languages: a general
  // statement that files are not kept, or go after 24 hours or 30 days, names the AI document's exception
  // (tests/retention-claims.mjs says what counts as general).
  await check('no page says a customer’s files or AI documents are not kept, or go after 24 hours or 30 days, without the AI document’s exception', async () => {
    const { block, blocks, untrue } = await import('./retention-claims.mjs')
    // What the pages said before this was checked is caught; what they say now, and true narrower statements, are not.
    const caught = [
      'Your files are not kept', 'Fayllaringiz saqlanib qolmaydi', 'Ваши файлы не хранятся',
      'Files deleted after 24 hours', 'Fayllar 24 soatda o‘chiriladi', 'Файлы удаляются через 24 часа',
      'Save it to your device or get it in Telegram. Files are deleted after 24 hours.',
      'Nothing is deleted from your account, but remember that files are removed 24 hours after upload anyway.',
      'Hisobdan hech narsa o‘chirilmaydi, lekin fayllar baribir yuklangandan 24 soat o‘tib o‘chirilishini unutmang.',
      'Из аккаунта ничего не удаляется, но файлы и так удаляются через 24 часа после загрузки.',
      'Files are automatically deleted after 24 hours.', 'Fayllar 24 soatdan keyin avtomatik o‘chiriladi.', 'Файлы автоматически удаляются через 24 часа.',
      'Your AI requests and results are kept for 30 days for quality review, then deleted.',
      'AI so‘rovlaringiz va natijalar sifatni tekshirish uchun 30 kun saqlanadi, keyin o‘chiriladi.',
      'Запросы к ИИ и результаты хранятся 30 дней для проверки качества, затем удаляются.',
      'In object storage run by Contabo in the European Union, for up to 24 hours.',
      'Yevropa Ittifoqidagi Contabo obyekt omborida, ko‘pi bilan 24 soat.', 'В объектном хранилище Contabo в Евросоюзе, не дольше 24 часов.',
      'The file is kept only to run your task.', 'Fayl faqat vazifangizni bajarish uchun saqlanadi.', 'Файл хранится только для вашей задачи.',
    ].map((text) => block(text))
    caught.push(block('You upload Start Result is ready When the task ends Deleted After 24 hours', ['You upload Start', 'Result is ready When the task ends', 'Deleted After 24 hours']))
    for (const piece of caught) assert.notDeepEqual(untrue(piece), [], `the check lets “${piece.text}” through`)
    const allowed = [
      'Tool files deleted after 24 hours', 'Vosita fayllari 24 soatda o‘chiriladi', 'Файлы инструментов удаляются через 24 часа',
      'Vositalardagi fayllar 24 soatdan keyin o‘chiriladi', 'Tayyor fayl 24 soatdan keyin o‘chiriladi.',
      'Biz o‘zimizdagi nusxalarni 24 soatdan keyin o‘chiramiz.',
      'Save it to your device or get it in Telegram. The result file is deleted after 24 hours.',
      'Uploaded files and results are removed, except those an AI document needs for a change.',
      'A document’s request and text, and what was read from its files, stay in your account so you can ask for changes; a copy kept for quality review is deleted after 30 days.',
      'Hujjatning so‘rovi va matni hamda u yaratilgan fayllardan o‘qilgan ma’lumotlar o‘zgartirish so‘rashingiz uchun hisobingizda saqlanadi; sifatni tekshirish uchun olingan nusxa 30 kundan keyin o‘chiriladi.',
      'Запрос и текст документа, а также то, что прочитано из его файлов, хранятся в вашем аккаунте, чтобы вы могли попросить изменения; копия для проверки качества удаляется через 30 дней.',
      'The file is used to run your task.', 'Fayl vazifangizni bajarish uchun ishlatiladi.', 'Файл используется для вашей задачи.',
      'We delete our copies after 24 hours. Files already in your Telegram chat or saved on your device stay there until you delete them.',
      'PDF passwords you enter are used for the task and not kept with your files.',
      'The text becomes editable again, but the original layout is not kept exactly.',
      'Nothing is charged after the 30 days. To continue, pay again for the next period.',
    ]
    for (const text of allowed) assert.deepEqual(untrue(block(text)), [], `the check refuses “${text}”`)

    const sitemap = head(await (await get(site, '/sitemap.xml')).text(), /<loc>([^<]+)<\/loc>/g).map((url) => new URL(url).pathname)
    assert.ok(sitemap.length >= 99, `${sitemap.length} sitemap pages`)
    const legal = ['en', 'uz', 'ru'].flatMap((locale) => [`/${locale}/legal/privacy`, `/${locale}/legal/terms`])
    const found = []
    let judged = 0
    for (const path of [...sitemap, ...legal]) {
      // A file tool's own page speaks of that tool's files, which do go after 24 hours.
      if (/^\/(?:en|uz|ru)\/(?:tools\/[^/]+|pdf-editor)$/.test(path)) continue
      const response = await get(site, path)
      assert.equal(response.status, 200, path)
      judged += 1
      for (const piece of blocks(await response.text())) for (const unit of untrue(piece)) found.push(`${path}: “${unit}”`)
    }
    assert.ok(judged >= 30, `${judged} pages judged`)

    // The app's billing page (and the app's landing) are drawn in the browser, not sent as HTML: what they
    // can say is every catalog string their components name.
    const { default: dictionaries } = await import('../locales/catalog.ts')
    const named = async (component, depth) => {
      const source = await fs.readFile(new URL(`../app/components/${component}.vue`, import.meta.url), 'utf8').catch(() => '')
      const keys = [...source.matchAll(/'([A-Za-z][\w.]*)'/g)].map((match) => match[1]).filter((key) => key in dictionaries.en)
      if (depth) for (const [, child] of source.matchAll(/<([A-Z][A-Za-z]+)\b/g)) keys.push(...(await named(child, depth - 1)))
      return keys
    }
    for (const [page, component] of [['app/billing', 'BillingView'], ['app', 'LandingView']]) {
      const keys = [...new Set(await named(component, 1))]
      assert.ok(component !== 'BillingView' || keys.includes('navBilling'), `${component}'s strings were read`)
      for (const locale of ['en', 'uz', 'ru'])
        for (const key of keys)
          for (const unit of untrue(block(dictionaries[locale][key])))
            found.push(`/${locale}/${page} (${component}, ${key}): “${unit}”`)
    }
    const said = [...new Set(found)]
    assert.ok(!said.length, `${said.length} general statements with no exception:\n     ${said.join('\n     ')}`)
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

  // How to pay is said as the platform has it. One that names no ways to pay (today's) is card transfer.
  await check('without automatic payment, the pages describe card transfer as they did', async () => {
    const pricing = (await (await get(site, '/en/pricing')).text()).replaceAll('\u00a0', ' ')
    for (const words of ['Transfer by card', 'Upload the receipt', 'We check and switch on', 'Mastercard', 'A member of staff checks every receipt by hand'])
      assert.ok(pricing.includes(words), `the pricing page says “${words}”`)
    assert.ok(!pricing.includes('inPAY'), 'and nothing of automatic payment')
    assert.ok(!(await (await get(site, '/en')).text()).includes('inPAY'), 'nor does the home page')
  })
  const paying = await serve(3193, `${stubOrigin}/automatic`, {
    NUXT_PUBLIC_SITE_ORIGIN: 'https://docmaster.live',
    NUXT_PUBLIC_SITE_INDEXABLE: '1',
  })
  await check('with automatic payment on, the pricing page, the questions and the footer say so in the HTML', async () => {
    const pricing = (await (await get(paying, '/en/pricing')).text()).replaceAll('\u00a0', ' ')
    for (const words of ['Pay on inPAY’s page', 'The plan switches on by itself', 'You can also pay by card transfer', 'Payme',
      'After an automatic payment, by itself, usually within a minute.'])
      assert.ok(pricing.includes(words), `the pricing page says “${words}”`)
    for (const words of ['Transfer by card', 'Upload the receipt', 'A member of staff checks every receipt by hand'])
      assert.ok(!pricing.includes(words), `the pricing page no longer says “${words}”`)
    const home = (await (await get(paying, '/en')).text()).replaceAll('\u00a0', ' ')
    assert.ok(home.includes('On the page of inPAY, a payment service, with Click, Payme, Uzcard or Humo'), 'the home page answers “How do I pay”')
    for (const locale of ['uz', 'ru']) {
      const html = await (await get(paying, `/${locale}/pricing`)).text()
      assert.ok(html.includes('inPAY') && html.includes('Payme'), `/${locale}/pricing names inPAY and Payme`)
    }
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
