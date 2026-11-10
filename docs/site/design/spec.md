# DocMaster public site: design spec

Status: design proposal, 2026-11-10. Builds on `docs/site/sitemap.md` and `pages.json`.
Artefacts in this folder: `brand/` (logo concepts, OG template), `mockups/` (static HTML,
open `mockups/home.html`), `screenshots/` (1440 and 390, light and dark), `pages/` (one
file per template), `tokens-additions.css`.

## 1. Direction: "a well-kept folder"

DocMaster handles people's contracts, coursework and CVs. The site should feel like a tidy
desk: paper, ink, one blue that acts, and nothing that shouts. Premium comes from restraint
and exact facts, not from gradients or claims.

Principles

1. **Facts are the trust.** Every reassurance is a checkable fact: "deleted after 24 hours",
   "20 000 so‘m for 30 days", the STIR in the footer. No counts, ratings, testimonials or
   badges. If a fact is not verified, the slot shows a visible placeholder (`.site-placeholder`,
   amber) instead of invented copy.
2. **Show the product, not a stock photo.** Illustrations are vignettes built from real UI
   parts: file rows, the result card with its deletion countdown, the editor toolbar, real
   deck designs and CV templates. They are HTML/CSS (or exported SVG), so they translate,
   switch theme and stay sharp.
3. **One memorable device: the folded corner.** The logo's dog-ear reappears only on objects
   that *are documents*: AI output previews, the editor page, the requisites sheet, the
   final CTA band. It is never used on buttons, tool rows or plan cards. That keeps it
   meaningful ("this is a document") and stops it becoming decoration.
4. **Telegram is an equal channel.** "Open in Telegram" is a secondary action next to "Start
   free" in heroes; the bot has its own nav item and comparison table.
5. **Three languages at full length.** Layouts are tested with Uzbek and Russian, which run
   30–40% longer than English. Nothing truncates; headings wrap and buttons grow.
6. **Calm motion.** One page-load moment on the home hero; everything else moves only in
   response to the user.

## 2. Brand

Recommended logo: **concept A, Folded corner** (see `brand/concepts.html`). A geometric D
whose top-right corner is folded like a page; the fold is the only red.

| Asset | File |
|---|---|
| Wordmark, light surfaces | `public/brand/docmaster-logo.svg` |
| Wordmark, dark surfaces | `public/brand/docmaster-logo-dark.svg` |
| Bare mark (transparent) | `public/brand/docmaster-icon.svg` |
| App tile (blue, rounded) | `public/brand/docmaster-icon-tile.svg`, PNG 32/64/192/256/512 |
| Apple touch (square, opaque) | `public/brand/docmaster-icon-180.png` |
| Maskable (full bleed, 80% safe zone) | `public/brand/docmaster-icon-maskable.svg`, `-maskable-512.png` |
| Favicon | `public/favicon-docmaster.svg` (tile), fall back to `docmaster-icon-32.png` |
| OG images | `public/og/docmaster-{uz,ru,en}.png`, source `brand/og-template.html` |

Rules

- Wordmark is Manrope 700 outlined to paths, tracking −0.022em. Never retype it in a live font.
- Clear space: the height of the D's counter (≈ 1/5 of the mark height) on all sides.
  Minimum size: wordmark 96 px wide; mark 16 px (use the tile below 24 px).
- Mark colours: `--site-mark-blue` (#0275FC light, #3D91FF dark) and `--site-mark-red`
  (#FA3331). The app tile is white D on brand blue, with the red fold.
- **How red changes:** red used to fill half the old icon. Now it is about 8% of the mark
  and it stays out of the UI except for errors and destructive actions (`--danger`,
  `--error-*`). Discounts, prices and CTAs never use red. Red text is never used: #FA3331 on
  white is 3.8:1 (enough for a graphic, not for text).
- "DocMaster (formerly PDF Master)" appears once in the footer brand blurb and on /about
  during the transition. The old `pdf-master-*` files stay untouched until the switch.
- Regenerate everything with `tools/gen.py` (needs `pip install fonttools`; paths at the top of each script point at the worktree). It outlines the
  wordmark from `public/fonts`, so swapping to concept B or C is one variable (`rec`).

## 3. Grid, containers, breakpoints

| | 390 (phone) | 768 (tablet) | 1440 (desktop) |
|---|---|---|---|
| Side gutter `--site-gutter` | 20 px | ≈25 px | 40 px max (content 1200 → 120 px margins) |
| Columns | 4 | 8 | 12 |
| Column gap `--site-grid-gap` | 16 px | ≈16 px | 24 px |
| Section rhythm `--site-section` | 64 px | ≈86 px | 120 px |
| Header | 72 px, logo + short CTA + menu | same | full nav |

- Containers: `.site-container` 1200 px content; `.is-narrow` 760 px for help and legal
  prose. Text measure: `--site-measure` 64ch, lead 52ch.
- Layout switch points used in CSS: 1100 (nav → menu button), 1000 (3 → 2 columns), 900
  (split layouts → stacked), 760/680/600 (steps, tables, tool rows), 520 (phone tweaks).
  The three design breakpoints sit inside those ranges.
- No horizontal scroll at 390: verified on every mockup in EN, UZ and RU (scrollWidth check
  in the screenshot script). Tables turn into stacked label/value lists under 600 px.
- Consecutive sections on the same background collapse their shared padding, so the gap is
  always one `--site-section`, not two. Alternate `.is-band` (sunken) sections to separate
  topics instead of rules or cards.

## 4. Type

Fonts stay as they are: self-hosted Manrope (display) and DM Sans (body), both with full
Latin and Cyrillic. The site adds a fluid display scale (`tokens-additions.css`):

| Role | Token | 390 → 1440 | Weight / leading |
|---|---|---|---|
| H1 hero | `--site-display-1` | 36 → 60 px | Manrope 700, 1.08, −0.022em, `text-wrap: balance` |
| H2 section | `--site-display-2` | 28 → 40 px | Manrope 700, 1.18, −0.018em |
| H3 card/step | `--site-display-3` | 20 → 26 px | Manrope 650, 1.25 |
| H4 / FAQ question | 17 px | | DM Sans 600 |
| Lead | `--site-lead` | 17 → 20 px | DM Sans 400, 1.55, max 52ch |
| Body | `--site-body` | 16 px | 1.6 (the app keeps 15 px) |
| Small / meta | `--site-small` | 14 px | muted colour |
| Legal prose | 16.5 px | | 1.7, max 64ch |

Rules: sentence case everywhere; no all-caps labels, no eyebrow text above headings, no
single highlighted word in a headline. H1 max width 15ch on home (forces a calm 3-line
shape at 1440 in all three languages). Do **not** use `hyphens: auto` on headings (it broke
"presenta-tion"); rely on balance and wrapping. In Russian, join compounds with a
non-breaking hyphen (U+2011): "PDF‑инструменты", "AI‑документы". Uzbek uses the
modifier letter turned comma ‘ (U+2018) in o‘, g‘, matching the app glossary; the tutuq
belgisi is ’ (U+2019). Prices use `font-variant-numeric: tabular-nums` and a thin space
grouping ("20 000 so‘m") from `Intl.NumberFormat`.

## 5. Colour roles

All values come from `tokens.css`; new site tokens are in `tokens-additions.css`.

| Role | Light | Dark | Notes |
|---|---|---|---|
| Page | `--paper` #F5F7FA | #0B111C | |
| Band (alternating sections) | `--site-band` = `--surface-sunken` #EEF2F7 | #0E1522 | |
| Card / panel | `--surface` #FFF | #121A27 | 1 px `--hairline` |
| Raised (menus, vignettes) | `--surface-raised` | #18233A | `--shadow-lg` |
| Heading text | `--ink` #0E1726 | #EEF3FA | 16.7:1 / 17.0:1 |
| Body text | `--text` #3B4859 | #C2CDDC | 8.7:1 / 11.8:1 |
| Muted text | `--muted` #5B6779 | #93A2B7 | 5.3:1 / 7.3:1 (minimum for 14 px) |
| Primary action | `--action` #0062D6, text white | #6AA8FF, text #0B111C | 5.7:1 / 7.8:1 |
| Link | `--link` #0059C2 | #8CBFFF | |
| Tint (icon tiles, hover) | `--blue-50` | #13233D | |
| Focus ring | `--focus` 3 px, 2 px offset | #8CBFFF | |
| Final CTA band | `--site-ink-band` #0E1726 | #18233A | text `--site-on-ink-band` |
| Success / warning / error | existing `--success-*`, `--warning-*`, `--error-*` | | |
| Logo only | `--site-mark-blue`, `--site-mark-red` | | never for text |

Dark theme is first-class: same layout, tokens swap under `:root[data-theme='dark']`. The
CTA band moves from ink to `--surface-raised` so it stays a step above the page instead of
disappearing. Vignettes use tokens, so they follow the theme; the deck design swatches are
the exception because they show real output colours.

## 6. Imagery and illustration

- Home hero: an AI document page (folded corner, Uzbek title) behind a Merge PDF task card
  with two file rows and a result row ("Deleted in 23 h 58 min", Download). It tells the
  whole product (AI + tools + 24 h deletion) without words.
- AI cards: a document page, a fan of three 16:9 slides, a two-column CV page.
- Editor: toolbar with the highlighter selected, a contract page with a highlight and a
  signature in its dashed selection box.
- Galleries (AI slides designs, CV templates, document examples) must use **real** exported
  thumbnails from the product (`deck-designs`, `ai-cv` tools). The mockup tiles are stand-ins
  and say so.
- Sample file names and titles are realistic Uzbek or Russian (shartnoma.pdf, mustaqil ish),
  matched to the page locale. Never show a real customer's file.
- No stock photography, no people, no 3D blobs, no gradient washes.

## 7. Iconography

Lucide, through the existing `AppIcon` (1.8 stroke in the mockups; AppIcon's default stroke
is fine). Sizes: 16 (inline, chips), 18–20 (lists, nav), 24 (tool hero). Tool icons sit in a
36 px `--blue-50` tile (`.site-tool-ico`), 52 px in the tool hero. Icons never stand alone
without a text label except the menu, close and theme buttons, which carry `aria-label`.
AppIcon additions needed: `scan-text` (OCR), `presentation` (PowerPoint), `table` (Excel),
`form` (fill form), `languages`, `receipt`, `eye-off`, `user`. Others exist (merge,
compress, split, rotate, signature, highlighter, redact, type, send, gift, percent…).

## 8. Motion

- One orchestrated moment: on home, the document settles into its 2° tilt and the task card
  rises (420 ms, `--site-ease-out`, staggered 100 ms). Nothing else animates on load.
- Responses to input: menu open/close 180 ms fade + 4 px slide; FAQ icon rotates 45°; link
  arrows nudge 3 px on hover; buttons press 1 px on `:active`.
- No scroll-triggered reveals, parallax or auto-playing carousels.
- `prefers-reduced-motion: reduce` sets the durations to 0 and removes the hero animation.

## 9. Header, mega menu, mobile menu

Order (sitemap §3): logo · Tools ▾ · PDF editor · AI ▾ · Pricing · Telegram bot ·
[language] [Sign in] [Start free]. The discount banner (when active) sits above the header
and scrolls away; the header is sticky with a translucent paper background and a hairline.

- **Tools mega menu**: 4 columns (Organize pages / Convert and compress / Text, security and
  signing / Edit), every tool with its icon, footer row with the file limits and "All tools".
  Opens on click (not hover) and on Enter/Space; `aria-expanded` on the button,
  `aria-controls` to the panel; Esc closes and returns focus to the button; clicking outside
  closes. On hover devices, a 120 ms hover-intent open is allowed in addition.
- **AI dropdown**: 4 items with one-line descriptions (Documents, Slides, CV, Prompt guide).
- **Mobile (< 1100 px)**: logo, a short CTA ("Start" / "Boshlash" / "Начать", the full
  label returns above 520 px) and a 44 px menu button. The menu is a full-height sheet under
  the header: Tools (open by default, two-column list) and AI as disclosure groups, plain
  rows for the rest, then a three-way language switch and "Sign in". Body scroll is locked
  while open; Esc and the button close it.
- Active section: `aria-current="page"` on the nav item, shown in `--link` colour.

## 10. Footer

Five columns at 1440 (brand blurb + bot/channel buttons, Popular tools, Product, Help,
Legal), two at 768, two at 390 with the brand row full width. Below: the **requisites sheet**
(folded corner) with Seller, STIR, Legal address, Support, rendered from the admin Contacts
setting through `CompanyDetails`; missing fields show the amber placeholder, never a blank.
Bottom row: © line with the legal name, card names as text chips (Uzcard, Humo, Visa,
Mastercard; swap in official marks only with the provider's brand files), language links.

## 11. Components and states

Reuse first: `ToolCard` (related tools, tools index), `DiscountBanner`, `ContactLinks`,
`CompanyDetails`, `AppIcon`, existing `.button` behaviour. New marketing components are
listed per template in `pages/*.md`; all new classes are `site-` prefixed.

| Component | Default | Hover | Focus-visible | Active | Disabled | Loading |
|---|---|---|---|---|---|---|
| Primary button `.site-btn.is-primary` (48 px; `is-lg` 56, `is-sm` 40) | `--action` bg | `--action-hover` | 3 px `--focus` ring, 2 px offset | 1 px press | 50% opacity, `aria-disabled`, no pointer | label hidden, spinner, `aria-busy="true"`, width kept |
| Secondary `.is-secondary` | surface + strong hairline | border → ink | ring | press | as above | spinner in ink |
| Ghost `.is-ghost` | transparent | sunken bg | ring | press | as above | |
| Text link `.site-link` | underlined 40% | full underline | ring | | | |
| Arrow link `.site-link-arrow` | link colour, 600 | underline + arrow 3 px | ring | | | |
| Tool row `.site-toollink` | icon tile, name, one line | `--blue-50` bg, chevron appears | ring + chevron | | hidden from catalog when disabled | |
| AI card `.site-ai-card` (whole card is one link) | | border strong, arrow nudge | ring on card | | | |
| Plan card `.site-plan` | | none (not a link) | button inside | | | `.is-current` outlines the visitor's plan when signed in |
| FAQ `<details>` | first open | question → link colour | ring on summary | plus rotates 45° | | |
| Breadcrumb `.site-crumbs` | muted links, "/" separators, last item `aria-current="page"` | | | | | |
| Dropzone `.site-drop` (tool hero) | dashed `--blue-200` | border `--action`, tint | ring on button | | tool disabled → hidden, "coming soon" never shown | |

Patterns

- **Tool hero**: breadcrumb → icon tile → H1 (tool name) → lead (one sentence, what it does
  for whom) → 3 fact chips (web limit, pages, Telegram availability from catalog) | the
  dropzone panel with one primary button ("Choose PDF files") that opens
  `/{locale}/app/tools/{feature}`. The panel tells the truth: it opens the workspace and asks
  to sign in. Real drag-and-drop handoff across sign-in is a phase 2 product change.
- **Pricing card**: name (+ discount badge) → price in display type with "so‘m" at half size
  → period line → 3–4 limits with check icons, the channel rule with an info icon → full
  width button. Discount: struck regular price (with visually hidden "Regular price"),
  today's price, "Offer ends {date}". No "most popular" label (unverified).
- **Discount banner**: reuse `DiscountBanner` content; the site variant is a full-width
  `--blue-50` strip above the header with "See plans". `role="status"`. Not red.
- **Language switch**: globe + current language name in its own language (O‘zbekcha,
  Русский, English); a menu of the three; keeps the same page and query; sets `lang` and
  `hreflang` links. On mobile a three-button segmented row in the menu and the footer.
- **Steps**: only for real sequences (how-to, how to pay). Numbered circle, 2 px top rule,
  first rule in `--action`.
- **File lifecycle** (privacy): three dots on a line, blue for the user's part, ink for
  deletion; vertical under 760 px.
- **Comparison table** (web vs Telegram, plan limits): real `<table>` with `scope`, a
  visually hidden caption; stacks into label/value rows under 600 px using `data-label`.

## 12. Accessibility

- WCAG 2.1 AA: all text pairs above are ≥ 4.5:1, large display text ≥ 3:1, UI borders that
  convey state ≥ 3:1 (`--hairline-strong` on paper is decorative only; inputs and buttons
  carry text). Checked in both themes.
- Skip link to `#main`; one H1 per page; landmarks: header, nav (labelled "Main"), main,
  footer; breadcrumb is `nav aria-label="Breadcrumb"`.
- Targets ≥ 44 × 44 px on touch (buttons 48, menu button 44, FAQ rows ≥ 56).
- Vignettes are `aria-hidden="true"`; they contain no information that isn't also in text.
- Struck prices include visually hidden "Regular price"; status banners use `role="status"`.
- Menus: real `<button>`s with `aria-expanded`, Esc to close, focus returns, no traps; the
  mobile menu moves focus to its first item and locks page scroll.
- `lang` on `<html>` per locale; inline foreign-language samples (Uzbek file names in an
  English page) don't need marking because they are decorative and hidden.
- Respect `prefers-reduced-motion`; the theme follows `prefers-color-scheme` until the user
  picks one (existing `data-theme` logic).

## 13. Mockup notes and limits

- Mockups are static: the theme button, the EN/UZ/RU switch (home only: nav, H1, lead, CTAs
  and section headings) and the menus are tiny inline scripts. URL flags for review:
  `?theme=dark`, `?lang=uz|ru`, `?menu=tools|ai|mobile`, `?shot=1` (hides the mockup bar).
- The pricing mockup shows the discount state with an example (Plus −25% to 15 000 so‘m
  until 30 November) only to design that state. It is not a real offer.
- Placeholder copy is English; Uzbek/Russian samples are on home and in the OG images.
- Screenshot script: `tools/shot.mjs` with `tools/shots.py`; mockups are written by `tools/build_mockups.py` (system Chrome through
  Playwright from `document-web/node_modules`).
