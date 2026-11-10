# Template: home (`/{locale}`)

Mockup: `mockups/home.html` (EN, with UZ/RU switch for nav, H1, lead, CTAs, H2s).
Screenshots: `screenshots/home-*`. Data: `plans`, `catalog`.

## Section order

| # | pages.json id | Background | Component | Reuse / new |
|---|---|---|---|---|
| 1 | hero | paper | `SiteHero` + hero vignette (`SiteSheet` doc page + task card built from `FileRow`-like rows, `StatusBadge`) | new hero; vignette reuses app styles of file rows |
| 2 | tool-grid | paper | `SiteSectionHead` + three `SiteToolGroup` panels of tool rows | new (a list variant of `ToolCard`; same data via `useTools`) |
| 3 | ai-services | band | 3 × `SiteAiCard` (preview stage + body) | new |
| 4 | editor | paper | split: copy + capability list / editor vignette | new |
| 5 | telegram | band | split reversed: copy + CTA / `SiteCompareTable` | new |
| 6 | how-it-works | paper | `SiteSteps` (3) | new shared |
| 7 | privacy | band | `SiteLifecycle` + 3 fact tiles | new shared |
| 8 | pricing-teaser | paper | 3 × `SitePlanCard` compact; `DiscountBanner` prices when active | new card, reuse `usePricing` |
| 9 | faq | paper | `SiteFaq` (6) with sticky heading column | new shared |
| 10 | final-cta | paper | `SiteCta` ink band | new shared |

## Layout per breakpoint

- **1440**: hero 12-col split (copy 6.5 / vignette 5.5), H1 3 lines max at 60 px. Tool
  groups 3 columns, each row icon + name + description. AI cards 3 columns with 220 px
  preview stage. Editor and Telegram are 2-column splits. Steps 3 columns. Lifecycle
  horizontal. Plans 3 columns. FAQ 4/8 split.
- **768**: hero stacks (copy, then vignette at max 560 px). Tool groups 2 columns. AI cards
  become horizontal rows (240 px stage left). Splits stack, copy first. Steps 3 → 1 column
  under 760. Plans single column max 560 px.
- **390**: header shows logo, short CTA, menu. Hero buttons full width, chips wrap. Vignette
  becomes a short document card overlapped by the task card. Tool rows go 2-up compact
  (icon + name, no description). Comparison table stacks into label/value rows. Lifecycle
  vertical.

## Content slots (EN character budgets)

| Slot | Budget | Notes / example |
|---|---|---|
| H1 | 40–55 | Names tools + AI. "PDF tools, an editor and AI documents in one place" (51). UZ 51, RU 56 tested. |
| Lead | 120–180 | What it does + where + languages. |
| CTA primary / secondary | ≤ 16 / ≤ 20 | "Start free" / "Open in Telegram" |
| Hero chips (2) | ≤ 28 each | "No install", "Files deleted after 24 hours" |
| Vignette strings | file names ≤ 28; doc title ≤ 40 | locale-matched samples, decorative |
| Section H2 | ≤ 45 | sentence case, no eyebrow |
| Section intro | ≤ 140 | one or two sentences |
| Tool row name / line | ≤ 22 / ≤ 34 | from `useTools().name/description`; line hidden on phones |
| AI card title / line / chips | ≤ 18 / ≤ 60 / ≤ 18 each | facts only (35 pages, 60 slides, 110 designs, 50 templates) |
| Editor capability items (8) | ≤ 28 each | from pages.json editor list |
| Comparison rows (4) | label ≤ 26, cell ≤ 32 | |
| Step title / text (3) | ≤ 28 / ≤ 110 | |
| Lifecycle (3) | title ≤ 18, text ≤ 60, time ≤ 22 | |
| Fact tiles (3) | title ≤ 18, text ≤ 120 | No analytics / sign-in / AI 30 days |
| Plan card lines | ≤ 34 each | |
| FAQ | question ≤ 60, answer ≤ 320 | 6 items; feeds FAQPage JSON-LD |
| Final CTA H2 / line | ≤ 40 / ≤ 90 | |

## Data bindings

- `catalog` → tool groups (enabled tools only, grouped by the mapping in sitemap §3),
  Telegram availability chips. Disabled tools disappear; never "coming soon".
- `plans` → plan cards (name, price via `usePricing().price/money`, discount + `untilLabel`),
  FAQ numbers (weekly limits, edits). Hard-coded numbers in copy must match `plans`; prefer
  interpolation (`{free_ai_docs}`) so a plan change updates the page.
- Auth state: when signed in, header CTA becomes "Open workspace" and the visitor's plan card
  gets `.is-current`.
