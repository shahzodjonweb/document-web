# DocMaster SEO launch checklist (pdfmaster.orderdesk.live → docmaster.live)

Status: SEO proposal, 2026-11-10. Owner: whoever ships the new site. Tick in order; the "before"
items block the switch.

## A. Before switching DNS / redirects

### A1. Technical on the new host
- [ ] `https://docmaster.live/{uz,ru,en}/...` serve 200, server-rendered HTML that contains the H1,
      title, description, body copy, FAQ and the related-links block (check with
      `curl -s URL | grep '<h1'` — not just in the browser).
- [ ] `<title>`, `<meta name="description">`, H1 and `og:title` come from `meta.json` per locale.
- [ ] `<html lang="uz">` / `ru` / `en` on each locale.
- [ ] Self-referencing `<link rel="canonical">` on every indexable page, absolute, https, apex,
      no query string, no trailing-slash variant (pick one form and 301 the other).
- [ ] **hreflang** on every indexable page, identical cluster on all three versions:
      `uz`, `ru`, `en`, and `x-default` → the `uz` URL. Absolute URLs, reciprocal, each pointing
      to a 200 canonical (never to a redirect). Also emit in `sitemap.xml` (`xhtml:link`) — either
      place is fine, both is fine if they agree. Use `uz` (not `uz-UZ`), and `ru` not `ru-RU`,
      because the pages target the language, not only the country.
- [ ] Bare `/` → 302 (not 301) to the visitor's locale, default `/uz`. A 302 here is correct
      because the target varies by visitor; the `x-default` hreflang tells search engines `/uz`.
      Crawlers without `Accept-Language` must land on `/uz`.
- [ ] Unknown paths return **HTTP 404** with the localized 404 page and `noindex`. No soft 404
      (200 with "not found" text).
- [ ] `robots.txt` on docmaster.live:
      ```
      User-agent: *
      Disallow: /api/
      Disallow: /*/app
      Disallow: /*/app/
      Disallow: /*/auth
      Disallow: /*/auth/
      Allow: /

      Sitemap: https://docmaster.live/sitemap.xml
      ```
      plus `<meta name="robots" content="noindex, nofollow">` (or `X-Robots-Tag`) on every
      `/{locale}/app/**` and `/{locale}/auth/**` response. Note: a page blocked in robots.txt
      cannot have its noindex read. Everything under app/auth needs sign-in and is not linked as
      content, so the Disallow is the main control. If any app/auth URL is already indexed, lift
      the Disallow for those paths until they drop out, then restore it.
      Do **not** add `Host:`; Yandex dropped that directive in 2018 and uses redirects instead.
      `Clean-param` is only needed if tracking parameters (utm_*, ref) appear in URLs:
      `Clean-param: utm_source&utm_medium&utm_campaign&ref /`.
- [ ] `sitemap.xml` (or a sitemap index with one file per locale): only canonical, indexable,
      200 URLs; 36 pages × 3 locales (minus 404) = 105 URLs, plus `ai/referat` if it ships;
      `<lastmod>` from real content changes; `priority` from `pages.json` (Google ignores it; Yandex
      may read it).
- [ ] Open Graph + Twitter tags (`og:title` from `meta.json` `ogTitle` or title, `og:description`,
      `og:image` 1200×630 per locale, `og:locale` uz_UZ / ru_RU / en_US with
      `og:locale:alternate`). Telegram link previews use these — important for this market.
- [ ] JSON-LD per `structured-data.md`; validate one page per template in the Rich Results Test
      and the Yandex validator.
- [ ] Core Web Vitals on a mid-range Android over 4G: LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on
      home and the top 5 tool pages. Self-host fonts (already in `public/fonts`), preload the
      hero font, keep pdf.js and editor bundles off marketing pages.
- [ ] No `noindex` left over from staging; no password protection on the marketing pages.

### A2. Redirect implementation
- [ ] Load `redirects.json` into the edge/nginx/Nuxt `routeRules`. Every rule is a single hop:
      old host + old feature-id path → new host + new slug directly.
- [ ] Keep path and query on the host-level rule; keep `#cookies` on the cookies rule.
- [ ] `pdfmaster.orderdesk.live/api/*` keeps serving (no redirect) until these are moved and
      tested: Telegram bot webhook, Mini App URL in BotFather, Google/Telegram OAuth redirect URIs
      and authorized domains, payment-provider callbacks, links in already-sent bot messages and
      e-mails, CORS allowlists. Moving them is an app change outside this SEO layer.
- [ ] Test with a list: every old URL from Search Console "Pages" export + the old
      sitemap + Yandex "Страницы в поиске" export → `curl -sI` shows exactly one 301 to a 200.
- [ ] Old host `robots.txt` must **not** block crawling (crawlers must see the 301s). Either the
      same rules as the new host or a 301 to the new robots.txt.

### A3. Accounts
- [ ] **Google Search Console:** add `docmaster.live` as a **Domain property** (DNS TXT) so www,
      http and https are all covered. Keep the old `pdfmaster.orderdesk.live` property (verify it
      if it is not verified yet; same Google account must own both, required for Change of
      Address). Add the owner and one backup owner.
- [ ] **Yandex Webmaster:** add `https://docmaster.live` and keep/verify
      `https://pdfmaster.orderdesk.live` (meta tag or DNS). Set region "Uzbekistan" in
      Региональность for the new site (needs the contact page with the address; use `/about`).
- [ ] Bing Webmaster Tools: import from GSC once GSC is verified (cheap; also feeds some AI
      assistants).

## B. Switch day

1. [ ] Deploy the new site, then enable the redirects (same release or within minutes).
2. [ ] **Google Change of Address:** old property → Settings → Change of address → select
       `docmaster.live`. The tool supports subdomain-to-domain moves at the domain level and
       checks a sample of 301s; fix anything it flags first. Source:
       [Google Change of Address](https://support.google.com/webmasters/answer/9370220).
3. [ ] **Yandex move:** old site → Индексирование → Переезд сайта → enter `https://docmaster.live`
       → Сохранить. Preconditions: both sites verified, new site returns 200, old returns 301,
       robots.txt allows crawling on both. Source:
       [Yandex: moving a site](https://yandex.ru/support/webmaster/yandex-indexing/moving-site.html).
4. [ ] Submit `https://docmaster.live/sitemap.xml` in GSC (Sitemaps) and Yandex (Индексирование →
       Файлы Sitemap). Keep the **old** sitemap available on the old host for ~2 weeks (served
       from the new app, listing old URLs) so crawlers find and follow the redirects faster, then
       remove it.
5. [ ] GSC URL Inspection → Request indexing for home ×3 locales, tools-index, top 10 tool pages,
       ai-slides, ai-cv, ai-referat. Yandex: Переобход страниц for the same list (daily quota).
6. [ ] Update every link you control: bot `/start` and menu buttons, BotFather description and
       Mini App URL, Telegram channel posts and pinned message, the old web app's in-app links,
       e-mail templates, payment-provider merchant profile, social bios.

## C. hreflang validation

- [ ] Crawl the site (Screaming Frog or similar, with JS rendering off): every indexable URL has
      3 hreflang + x-default, all return 200, all reciprocal, canonical = self.
- [ ] Spot-check with an hreflang testing tool on home, one tool, one AI page, pricing.
- [ ] GSC no longer has an International Targeting report; watch for "Alternate page with
      proper canonical tag" vs "Duplicate, Google chose different canonical" in Pages. The latter
      on a locale page means the locales look too similar; make the copy more distinct (most likely
      on short legal or utility pages).
- [ ] Yandex has no hreflang report; check in Страницы в поиске that ru pages are indexed rather
      than uz (Yandex may prefer the ru version for ru queries; that is the desired result).

## D. First 4 weeks: what to watch

| When | Check | Healthy | Act if |
|---|---|---|---|
| Daily, week 1 | Server logs: Googlebot/YandexBot hits on old host | Mostly 301s, falling | 404/5xx on old URLs → add a redirect |
| Daily, week 1 | GSC Pages → "Page with redirect" (old property) rising; "Indexed" (new property) rising | Mirror image | New property stuck at 0 after 5 days → check robots, canonical, DNS |
| Week 1–2 | GSC Change of Address status; Yandex Переезд status | "Moving" / application accepted | Errors → fix flagged redirect samples |
| Week 1–4 | Crawl stats (GSC Settings) and Yandex Статистика обхода | New host crawled daily | Crawl rate drops → check 5xx and response time (<1 s TTFB) |
| Week 1–4 | 404s in GSC + Yandex Исключённые страницы | Only junk URLs | Real old URLs → redirect |
| Week 2–4 | Impressions per locale and per page (GSC Performance, filter by `/uz/`, `/ru/`, `/en/`) | Back to old-host level by week 4–8 | Persistent drop on a page → compare title/content to old one |
| Week 2–4 | Queries: brand (`docmaster`, `pdf master`) and top terms (`pdf birlashtirish`, `rasmni pdf qilish`, `pdf ni wordga aylantirish`, `prezentatsiya tayyorlash`, `rezyume tayyorlash`, `сжать pdf`, `реферат нейросеть`) | Ranking pages are the intended leaves | Wrong page ranking → fix internal anchors (cannibalisation rules in `keywords.md` §5) |
| Week 2–4 | CTR per title (GSC) | ≥ old CTR for same query | Low CTR on high-impression page → rewrite title/description (keep the primary keyword) |
| Weekly | Core Web Vitals (GSC, CrUX once data exists) | Good | Poor on mobile → trim JS on marketing pages |
| Weekly | Enhancements: Breadcrumbs errors | 0 errors | Fix markup |
| Week 4 | Yandex Webmaster: ИКС, region set to Uzbekistan, site name shown as DocMaster | Set | Region missing → add address to `/about`, resubmit |

Expect a 2–6 week dip in Google and longer (weeks to months) in Yandex, which says moves take
several weeks to several months and guarantees nothing about rankings.

## E. Keep afterwards
- [ ] Keep all 301s **at least 12 months** (Google minimum 180 days; longer while old URLs still
      get traffic). Keep `pdfmaster.orderdesk.live` registered and redirecting indefinitely if cheap.
- [ ] Re-run the redirect test list monthly for 3 months.
- [ ] Pull real volumes (Wordstat region Uzbekistan, Keyword Planner) and revisit the primaries
      in `keywords.md` after 8 weeks of GSC data.
- [ ] Decide on `ai-referat` (recommended) and add it to `pages.json`, sitemap and footer.

## F. Risks to flag to the owner
1. **API and integrations on the old host.** If the host rule ever redirects `/api/*`, the bot
   webhook, OAuth and payment callbacks break (POST bodies are not reliably re-sent across 301s).
2. **"Bepul / бесплатно / free" copy** must stay true: Free plan limits (5 AI docs, 15 file
   tasks per week) need to be stated on the pricing page and in each tool's limits block. Never
   "unlimited free", "100% free" or "без регистрации" (sign-in is required).
3. **Referat page** carries academic-integrity and reputation risk; keep it a "draft/outline"
   framing (see `keywords.md` §3).
4. **Sign PDF** must not be presented as an ERI/ЭЦП legal signature.
5. **Thin locale duplicates**: legal pages in ru/en are translations of the Uzbek original; if
   Google folds them, that is acceptable, but do not noindex them (payment reviewers and users
   need them).
