# Page templates

One file per template. Section ids are the ids in `../../pages.json`. Character budgets are
for **English**; every layout is built to take Uzbek and Russian at +40% without truncation,
so the copywriter writes to the English budget and translators may run longer.
"Reuse" means an existing component in `app/components`; "new" components are `Site*`
Vue components with `site-` classes (see `../spec.md` §11).

| Template | Pages (pages.json ids) | Mockup |
|---|---|---|
| [home](home.md) | home | `mockups/home.html` |
| [tools-index](tools-index.md) | tools-index | — |
| [tool](tool.md) | 17 file tools + sign-pdf, fill-pdf-form | `mockups/tool.html` |
| [pdf-editor](pdf-editor.md) | pdf-editor | — |
| [ai-hub](ai-hub.md) | ai-hub | — |
| [ai-service](ai-service.md) | ai-documents, ai-slides, ai-cv | `mockups/ai-service.html` (slides) |
| [pricing](pricing.md) | pricing | `mockups/pricing.html` |
| [telegram](telegram.md) | telegram | — |
| [invite](invite.md) | invite | — |
| [help](help.md) | help (and guide, which keeps its current GuideView) | — |
| [about](about.md) | about | — |
| [legal](legal.md) | legal-offer, legal-privacy, legal-refunds | `mockups/legal.html` |
| [not-found](not-found.md) | not-found | — |

Shared on every page: header (spec §9), footer with requisites (spec §10), discount banner
when active (`DiscountBanner`, data: `plans`), `hreflang` uz/ru/en + x-default uz.

New shared components (built once, used by many templates)

| Component | Used by | Why new |
|---|---|---|
| `SiteHeader` (+ mega menu, mobile sheet) | all | the app shell header has no mega menu or marketing nav |
| `SiteFooter` (wraps `CompanyDetails`, `ContactLinks`) | all | wide footer with requisites sheet |
| `SiteSectionHead` | all | H2 + intro + optional arrow link, one spacing rule |
| `SiteHero` / `SiteToolHero` | home, tool, ai, editor, telegram | two-column hero with action slot |
| `SiteSteps` | tool, ai, pricing, invite, editor | numbered real sequences |
| `SiteFaq` (`<details>` + FAQPage JSON-LD) | most | one accessible accordion with structured data |
| `SitePlanCard` (reads `usePricing`) | home, pricing, ai-hub | marketing variant of plan cards; `PlanCard` in billing stays for the app |
| `SiteCompareTable` | home, telegram, pricing | table that stacks under 600 px |
| `SiteFacts` / `SiteKv` | tool, ai, pricing | label + value tiles for limits |
| `SiteLifecycle` | home, tool (compact), help | the 24 h file timeline |
| `SiteSheet` (folded-corner wrapper) | vignettes, requisites, CTA | the one brand device |
| `SiteCta` | home, tools-index, ai-hub, editor | ink band with fold |
| `SiteBreadcrumb` (+ BreadcrumbList JSON-LD) | all but home | |
