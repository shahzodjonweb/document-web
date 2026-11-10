# DocMaster structured data (schema.org JSON-LD)

Status: SEO proposal, 2026-11-10. One `<script type="application/ld+json">` per page, built
server-side in the page's own locale (`inLanguage` = `uz` / `ru` / `en`). Visible text and markup
must match: never mark up anything that is not on the page.

## 1. What Google and Yandex still show in late 2026

| Type | Google rich result | Use on DocMaster | Notes |
|---|---|---|---|
| Organization | Yes: logo, knowledge panel facts | Home + About | Use `legalName`, `taxID`, `logo`, `sameAs`, `contactPoint` |
| WebSite | Yes: site name in results | Home only | Sets the site name "DocMaster" and `alternateName` "PDF Master". **Sitelinks search box was retired in Nov 2024**, so add no `SearchAction` |
| BreadcrumbList | Yes, desktop only; mobile shows the domain only | Every page except home and 404 | Cheap, still parsed; also helps Yandex |
| SoftwareApplication / WebApplication | Rich result **requires** `aggregateRating` or `review` | Home, tool pages, editor, AI pages, pricing | We have no real ratings and must not invent any, so **no rich result**. Keep the markup for entity, price and OS facts (Google/Bing/Yandex/AI answers read it). Never add fake `aggregateRating`. |
| Offer (inside the app) | Part of the app rich result | Pricing + home | Prices in `UZS`, `price` as a number |
| FAQPage | **Gone.** Google stopped showing FAQ rich results on 7 May 2026 and removed the docs on 15 June 2026 (before that it was limited to government/health sites since Aug 2023) | Optional | Unused markup does no harm. Keep it only where the FAQ is visible, mainly for Bing and AI answer engines. Low priority; don't build tooling around it |
| HowTo | **Gone.** Removed from mobile Aug 2023 and desktop Sep 2023; docs deleted | Do not add | Write the how-to steps as a visible `<ol>`, no markup |
| Retired in June 2025 | Book Actions, Course Info, ClaimReview, Estimated Salary, Learning Video, Special Announcement, Vehicle Listing | None apply | Listed so nobody adds them |
| Yandex | Reads schema.org JSON-LD and microdata; validator in Webmaster | Same markup | Yandex documents rich snippets mainly for organizations, products/offers, recipes, Q&A and video. There is no confirmed FAQ snippet. Organization and Offer markup are the useful parts |

Sources: [Google FAQPage doc (deprecation notice)](https://developers.google.com/search/docs/appearance/structured-data/faqpage),
[Google Search Central: HowTo/FAQ changes (2023)](https://developers.google.com/search/blog/2023/08/howto-faq-changes),
[Google: simplifying search results, 12 Jun 2025](https://developers.google.com/search/blog/2025/06/simplifying-search-results),
[Google SoftwareApplication requirements](https://developers.google.com/search/docs/appearance/structured-data/software-app),
[Search Engine Journal on HowTo removal](https://www.searchenginejournal.com/google-completely-removes-how-to-rich-results/496479/),
[Yandex: what is schema.org](https://yandex.ru/support/webmaster/schema-org/what-is-schema-org.html).

## 2. Template-to-type map

| Template (page ids) | JSON-LD `@graph` |
|---|---|
| Home (`home`) | Organization, WebSite, WebApplication with 3 Offers |
| Tool (`merge-pdf` … `unlock-pdf`, `sign-pdf`, `fill-pdf-form`) | WebPage, BreadcrumbList, WebApplication (tool-specific `name`, `featureList`, `isAccessibleForFree: true`, Free offer only); FAQPage optional |
| Editor (`pdf-editor`) | Same as tool |
| AI hub / service (`ai-hub`, `ai-documents`, `ai-referat`, `ai-slides`, `ai-cv`) | WebPage, BreadcrumbList, WebApplication (service `name`, `featureList`); FAQPage optional |
| Directory (`tools-index`) | CollectionPage, BreadcrumbList, ItemList of tool URLs |
| Pricing (`pricing`) | WebPage, BreadcrumbList, WebApplication with 3 Offers |
| Telegram (`telegram`) | WebPage, BreadcrumbList, SoftwareApplication (`operatingSystem: "Telegram"`, `installUrl` = t.me link) |
| Help (`help`) | WebPage (or FAQPage if it is a single list of Q&A), BreadcrumbList |
| About (`about`) | AboutPage + full Organization, BreadcrumbList |
| Guide, invite, legal-* | WebPage, BreadcrumbList |
| 404 | none (noindex) |

Shared rules:
- Stable `@id`s so pages reference one entity: `https://docmaster.live/#organization`,
  `https://docmaster.live/#website`, `https://docmaster.live/#app`.
- Localized `name`/`description` come from `meta.json`; `url` is the canonical of the current
  locale page.
- `offers.price` is the **regular** price. Do not put admin discount prices in markup unless
  `priceValidUntil` is set to the discount's last day and the page shows the same price.
- Contact fields (`telephone`, `email`, `address`) are placeholders until the owner provides
  them (sitemap open question 1). Leave out a property rather than publish a placeholder.

## 3. Examples

### 3.1 Organization + WebSite (home, uz)
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://docmaster.live/#organization",
      "name": "DocMaster",
      "alternateName": ["PDF Master"],
      "legalName": "\"ARCANIUM TECHNOLOGIES\" MCHJ",
      "taxID": "313458514",
      "url": "https://docmaster.live/",
      "logo": {
        "@type": "ImageObject",
        "url": "https://docmaster.live/brand/docmaster-icon-512.png",
        "width": 512,
        "height": 512
      },
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "UZ",
        "addressLocality": "Toshkent",
        "streetAddress": "PLACEHOLDER: legal address"
      },
      "contactPoint": [{
        "@type": "ContactPoint",
        "contactType": "customer support",
        "availableLanguage": ["uz", "ru", "en"],
        "url": "https://t.me/PLACEHOLDER_support"
      }],
      "sameAs": ["https://t.me/PLACEHOLDER_bot", "https://t.me/PLACEHOLDER_channel"]
    },
    {
      "@type": "WebSite",
      "@id": "https://docmaster.live/#website",
      "url": "https://docmaster.live/",
      "name": "DocMaster",
      "alternateName": "PDF Master",
      "inLanguage": ["uz", "ru", "en"],
      "publisher": { "@id": "https://docmaster.live/#organization" }
    }
  ]
}
```
Note: `taxID` is the STIR. Remove `streetAddress` and `contactPoint.url` until real values exist.
The `logo` is `public/brand/docmaster-icon-512.png` from this worktree (≥112×112, crawlable).

### 3.2 WebApplication with plan Offers (home and pricing, ru)
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": "https://docmaster.live/#app",
  "name": "DocMaster",
  "url": "https://docmaster.live/ru",
  "inLanguage": "ru",
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "PDF editor and AI document generator",
  "operatingSystem": "Web browser, Telegram",
  "browserRequirements": "Requires JavaScript",
  "description": "Инструменты для PDF, редактор PDF и документы, презентации и резюме с помощью нейросети.",
  "publisher": { "@id": "https://docmaster.live/#organization" },
  "offers": [
    {
      "@type": "Offer",
      "name": "Free",
      "price": 0,
      "priceCurrency": "UZS",
      "description": "5 документов с ИИ и 15 задач с файлами в неделю",
      "url": "https://docmaster.live/ru/pricing"
    },
    {
      "@type": "Offer",
      "name": "Plus",
      "price": 20000,
      "priceCurrency": "UZS",
      "description": "30 дней, без автопродления",
      "url": "https://docmaster.live/ru/pricing"
    },
    {
      "@type": "Offer",
      "name": "Premium",
      "price": 60000,
      "priceCurrency": "UZS",
      "description": "30 дней, без автопродления",
      "url": "https://docmaster.live/ru/pricing"
    }
  ]
}
```
Do not model Plus/Premium as `UnitPriceSpecification` with `billingDuration` +
recurring semantics: they do not auto-renew. Plain `Offer` + description is accurate.

### 3.3 Tool page: WebPage + WebApplication + BreadcrumbList (merge-pdf, uz)
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://docmaster.live/uz/tools/merge-pdf#webpage",
      "url": "https://docmaster.live/uz/tools/merge-pdf",
      "name": "PDF birlashtirish onlayn, bepul boshlang | DocMaster",
      "description": "Bir nechta PDF faylni bitta faylga birlashtiring: tartibini tanlang va yuklab oling. Brauzerda yoki Telegram botda, fayllar 24 soatda o‘chiriladi.",
      "inLanguage": "uz",
      "isPartOf": { "@id": "https://docmaster.live/#website" },
      "breadcrumb": { "@id": "https://docmaster.live/uz/tools/merge-pdf#breadcrumb" },
      "mainEntity": { "@id": "https://docmaster.live/uz/tools/merge-pdf#tool" }
    },
    {
      "@type": "WebApplication",
      "@id": "https://docmaster.live/uz/tools/merge-pdf#tool",
      "name": "PDF fayllarni birlashtirish",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web browser, Telegram",
      "isAccessibleForFree": true,
      "featureList": ["Bir nechta PDF ni bitta faylga birlashtirish", "Sahifalar tartibini tanlash", "Brauzerda 200 MB gacha", "Fayllar 24 soatda o‘chiriladi"],
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "UZS", "name": "Free" },
      "provider": { "@id": "https://docmaster.live/#organization" }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://docmaster.live/uz/tools/merge-pdf#breadcrumb",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Bosh sahifa", "item": "https://docmaster.live/uz" },
        { "@type": "ListItem", "position": 2, "name": "PDF vositalari", "item": "https://docmaster.live/uz/tools" },
        { "@type": "ListItem", "position": 3, "name": "PDF birlashtirish" }
      ]
    }
  ]
}
```
For web-only tools (pdf-to-word, pdf-to-excel, ocr-pdf, protect-pdf, unlock-pdf) set
`operatingSystem` to `"Web browser"` — render it from the catalog, not by hand.

### 3.4 ItemList on the tool directory (tools-index, en)
```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "url": "https://docmaster.live/en/tools",
  "name": "All PDF tools online | DocMaster",
  "inLanguage": "en",
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "url": "https://docmaster.live/en/tools/merge-pdf", "name": "Merge PDF" },
      { "@type": "ListItem", "position": 2, "url": "https://docmaster.live/en/tools/compress-pdf", "name": "Compress PDF" },
      { "@type": "ListItem", "position": 3, "url": "https://docmaster.live/en/tools/split-pdf", "name": "Split PDF" }
    ]
  }
}
```
(Continue with all 19 tool pages; generate from the catalog.)

### 3.5 FAQPage (optional; ai-slides, ru)
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "inLanguage": "ru",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Сколько слайдов может быть в презентации?",
      "acceptedAnswer": { "@type": "Answer", "text": "До 60 слайдов. Презентация сохраняется как редактируемый файл PowerPoint (.pptx)." }
    },
    {
      "@type": "Question",
      "name": "На каких языках работает генератор?",
      "acceptedAnswer": { "@type": "Answer", "text": "На узбекском (латиница), русском и английском." }
    }
  ]
}
```
No Google rich result since 7 May 2026. Ship only if it costs nothing extra (render from the
same FAQ data as the visible block).

### 3.6 Telegram bot (telegram, en)
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "DocMaster Telegram bot",
  "operatingSystem": "Telegram",
  "applicationCategory": "BusinessApplication",
  "installUrl": "https://t.me/PLACEHOLDER_bot",
  "inLanguage": ["uz", "ru", "en"],
  "offers": { "@type": "Offer", "price": 0, "priceCurrency": "UZS", "name": "Free" },
  "publisher": { "@id": "https://docmaster.live/#organization" }
}
```

### 3.7 AboutPage (about, uz)
```json
{
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "url": "https://docmaster.live/uz/about",
  "inLanguage": "uz",
  "mainEntity": { "@id": "https://docmaster.live/#organization" }
}
```
(Include the full Organization node from 3.1 in the same `@graph` so the page stands alone.)

## 4. Validation

- Google Rich Results Test + Schema Markup Validator (validator.schema.org) for one page per
  template and locale.
- Yandex Webmaster → Инструменты → Валидатор микроразметки, same pages.
- Search Console → Enhancements: only Breadcrumbs (and Organization logo) will report; no app or
  FAQ report is expected.
