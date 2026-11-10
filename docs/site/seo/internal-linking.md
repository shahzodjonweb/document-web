# DocMaster internal linking

Status: SEO proposal, 2026-11-10. Page ids and routes as in `pages.json`; `ai-referat` is the
proposed page from `keywords.md` §3.

## 1. Hub and spoke map

```
home (/)
├── tools-index (/tools) ─────────── hub for 19 tool pages
│   ├── Organize:   merge-pdf, split-pdf, extract-pdf-pages, delete-pdf-pages, reorder-pdf-pages, rotate-pdf
│   ├── Optimize & convert: compress-pdf, jpg-to-pdf, pdf-to-jpg, word-to-pdf, powerpoint-to-pdf, pdf-to-word, pdf-to-excel
│   ├── OCR & security: ocr-pdf, searchable-pdf, protect-pdf, unlock-pdf
│   └── Edit: sign-pdf, fill-pdf-form  ──▶ pdf-editor
├── pdf-editor (/pdf-editor) ─────── hub for sign-pdf, fill-pdf-form
├── ai-hub (/ai) ─────────────────── hub for ai-documents, ai-referat, ai-slides, ai-cv, guide
├── pricing ── invite, legal-refunds, legal-offer
├── telegram ── top bot tools (jpg-to-pdf, merge-pdf, compress-pdf, word-to-pdf), ai-slides, ai-referat, pdf-editor
└── help ── about, legal-*, telegram, pricing
```

Rules:
1. **Every indexable page is ≤ 2 clicks from home** (home → hub → leaf). Tool and AI leaves are
   also linked directly from home (tool grid, AI cards), so most are 1 click away.
2. **Hubs link to all their spokes** with a crawlable `<a href>` (no JS-only click handlers),
   server-rendered. The mega menu must be in the HTML too, not built after hydration.
3. **Spokes link back** to their hub (breadcrumb) and **sideways** to 3–6 related spokes (below).
4. **The app is not a link target for SEO.** CTA buttons to `/{locale}/app/...` are fine, but they
   point to noindex pages; never count them as internal links in audits. App/auth paths are
   disallowed in robots.txt (see `launch-checklist.md`), so `rel="nofollow"` on those CTAs is
   optional and adds little.
5. **Same-locale only.** Body links stay in the current locale. Only the language switcher
   crosses locales, and it links to the *same page* in the other locale (it doubles as visible
   hreflang).
6. **No links to redirecting URLs.** After launch, nothing in templates, catalog data, the bot or
   e-mails may still point to `/tools/pdf.merge`-style URLs or the old host.

## 2. Related-tool clusters (the "related" block on each leaf)

| Page | Related links (in order) |
|---|---|
| merge-pdf | split-pdf, compress-pdf, jpg-to-pdf, reorder-pdf-pages, word-to-pdf |
| compress-pdf | merge-pdf, jpg-to-pdf, pdf-to-jpg, split-pdf, protect-pdf |
| split-pdf | extract-pdf-pages, delete-pdf-pages, merge-pdf, compress-pdf |
| extract-pdf-pages | split-pdf, delete-pdf-pages, reorder-pdf-pages, merge-pdf |
| delete-pdf-pages | extract-pdf-pages, reorder-pdf-pages, split-pdf, pdf-editor |
| reorder-pdf-pages | rotate-pdf, delete-pdf-pages, merge-pdf, pdf-editor |
| rotate-pdf | reorder-pdf-pages, jpg-to-pdf, searchable-pdf, merge-pdf |
| jpg-to-pdf | pdf-to-jpg, searchable-pdf, merge-pdf, compress-pdf, telegram |
| pdf-to-jpg | jpg-to-pdf, compress-pdf, split-pdf, powerpoint-to-pdf |
| word-to-pdf | pdf-to-word, powerpoint-to-pdf, merge-pdf, compress-pdf, ai-documents |
| powerpoint-to-pdf | word-to-pdf, ai-slides, compress-pdf, merge-pdf |
| pdf-to-word | word-to-pdf, ocr-pdf, pdf-to-excel, pdf-editor |
| pdf-to-excel | pdf-to-word, ocr-pdf, compress-pdf |
| ocr-pdf | searchable-pdf, pdf-to-word, jpg-to-pdf |
| searchable-pdf | ocr-pdf, jpg-to-pdf, compress-pdf |
| protect-pdf | unlock-pdf, compress-pdf, sign-pdf |
| unlock-pdf | protect-pdf, merge-pdf, pdf-editor |
| sign-pdf | pdf-editor, fill-pdf-form, protect-pdf |
| fill-pdf-form | pdf-editor, sign-pdf, word-to-pdf |
| pdf-editor | sign-pdf, fill-pdf-form, searchable-pdf, merge-pdf, compress-pdf |
| ai-documents | ai-referat, ai-slides, guide, word-to-pdf, pdf-editor |
| ai-referat | ai-slides, ai-documents, guide, pdf-editor |
| ai-slides | ai-referat, ai-documents, powerpoint-to-pdf, guide |
| ai-cv | ai-documents, pdf-to-word, pdf-editor, guide |
| guide | ai-documents, ai-slides, ai-cv, ai-referat |

**Cross-cluster bridges** (in body copy, not just the related block), where the user journey
really continues:
- jpg-to-pdf → searchable-pdf ("make the photo PDF searchable")
- pdf-to-word FAQ "my PDF is a scan" → ocr-pdf
- powerpoint-to-pdf ↔ ai-slides ("no deck yet? make one with AI" / "send your AI deck as PDF")
- ai-referat → ai-slides ("slides for the defence")
- sign-pdf, fill-pdf-form → pdf-editor ("everything else you can do in the editor")
- every tool page's limits block → pricing ("15 file tasks a week on Free")
- every privacy block → legal-privacy

## 3. Footer (all pages)

Follows `sitemap.md` §3; SEO additions in **bold**.
- Popular tools: merge-pdf, compress-pdf, split-pdf, jpg-to-pdf, word-to-pdf, pdf-to-word,
  powerpoint-to-pdf, ocr-pdf, **pdf-editor**, tools-index ("All tools")
- Product: pdf-editor, ai-documents, **ai-referat**, ai-slides, ai-cv, pricing, telegram, invite
- Help: help, guide, about
- Legal: legal-offer, legal-privacy, legal-refunds
- Keep the footer list identical on every page and locale (sitewide links are a ranking signal of
  importance; changing them per page dilutes it). About 25 links is fine.

## 4. Anchor-text guidance

Principles: anchors describe the target in the words users search (the target's primary or a
secondary keyword), vary naturally, and never use "click here / bu yerda / здесь". Use the short
tool name in grids and menus; use a keyword phrase in body sentences.

| Target | uz anchors | ru anchors | en anchors |
|---|---|---|---|
| merge-pdf | PDF birlashtirish; PDF fayllarni birlashtirish | Объединить PDF; объединить PDF-файлы в один | Merge PDF; combine PDF files |
| compress-pdf | PDF siqish; PDF hajmini kichraytirish | Сжать PDF; уменьшить размер PDF | Compress PDF; reduce PDF size |
| split-pdf | PDF ajratish; PDF ni qismlarga bo‘lish | Разделить PDF | Split PDF |
| extract-pdf-pages | Sahifalarni ajratib olish | Извлечь страницы | Extract pages |
| delete-pdf-pages | Sahifalarni o‘chirish | Удалить страницы из PDF | Delete pages |
| reorder-pdf-pages | Sahifalar tartibini o‘zgartirish | Поменять страницы местами | Reorder pages |
| rotate-pdf | PDF sahifalarini burish | Повернуть PDF | Rotate PDF |
| jpg-to-pdf | Rasmni PDF qilish; rasmlarni PDF ga aylantirish | JPG в PDF; фото в PDF | JPG to PDF; photos to PDF |
| pdf-to-jpg | PDF ni rasmga aylantirish | PDF в JPG | PDF to JPG |
| word-to-pdf | Word ni PDF ga aylantirish; Word faylni PDF ga o‘tkazish | Word в PDF; ворд в PDF | Word to PDF |
| powerpoint-to-pdf | Taqdimotni PDF ga o‘tkazish | PPT в PDF; презентацию в PDF | PowerPoint to PDF |
| pdf-to-word | PDF ni Word ga aylantirish | PDF в Word | PDF to Word |
| pdf-to-excel | PDF ni Excel ga aylantirish | PDF в Excel | PDF to Excel |
| ocr-pdf | Rasmdan matn olish (OCR) | Распознать текст | Extract text (OCR) |
| searchable-pdf | Skanerni qidiriladigan PDF qilish | PDF с распознаванием текста | Make PDF searchable |
| protect-pdf | PDF ga parol qo‘yish | Поставить пароль на PDF | Protect PDF |
| unlock-pdf | PDF parolini olib tashlash | Снять пароль с PDF | Unlock PDF |
| sign-pdf | PDF ga imzo qo‘yish | Подписать PDF | Sign PDF |
| fill-pdf-form | PDF formani to‘ldirish | Заполнить PDF-форму | Fill PDF form |
| pdf-editor | PDF tahrirlash; PDF muharriri | Редактор PDF; редактировать PDF | PDF editor; edit PDF |
| ai-hub | Sunʼiy intellekt xizmatlari | Сервисы с ИИ | AI tools |
| ai-documents | AI bilan hujjat tayyorlash | Документ с помощью нейросети | AI document generator |
| ai-referat | Referat tayyorlash; mustaqil ish tayyorlash | Реферат с помощью нейросети | AI report writer |
| ai-slides | Taqdimot tayyorlash; prezentatsiya tayyorlash | Сделать презентацию с ИИ | AI presentation maker |
| ai-cv | Rezyume tayyorlash | Создать резюме | AI CV maker |
| guide | So‘rov yozish bo‘yicha qo‘llanma | Как писать запросы | Prompt guide |
| pricing | Tariflar va narxlar | Тарифы | Pricing |
| telegram | Telegram bot | Telegram-бот | Telegram bot |

Locale notes:
- **uz:** anchors use the correct `o‘ g‘ ʼ`. Prefer the verb-noun form users type
  ("PDF birlashtirish", not "PDF birlashtiruvchi"). Rotate uses `burish` to stay clear of the
  conversion sense of `aylantirish`.
- **ru:** never write "AI" — use "ИИ" or "нейросеть". Mix PDF in Latin with
  colloquial "пдф/ворд" only in body copy, not in nav labels.
- **en:** sentence case, short tool names; "AI" is fine.

## 5. Breadcrumb trails

Visible breadcrumb on every page except home and 404; same labels go into BreadcrumbList
(`structured-data.md` §3.3). Root label: uz "Bosh sahifa", ru "Главная", en "Home".

| Page | Trail (en labels; translate per locale with the anchor table) |
|---|---|
| tools-index | Home › PDF tools |
| any tool (incl. sign-pdf, fill-pdf-form) | Home › PDF tools › {tool name} |
| pdf-editor | Home › PDF editor |
| ai-hub | Home › AI |
| ai-documents / ai-referat / ai-slides / ai-cv | Home › AI › {service} |
| guide | Home › AI › Prompt guide |
| pricing / telegram / invite / help / about | Home › {page} |
| legal-offer / legal-privacy / legal-refunds | Home › Legal › {document} (the "Legal" crumb is plain text unless a legal index page is added) |

The last crumb is plain text (current page), not a link.
