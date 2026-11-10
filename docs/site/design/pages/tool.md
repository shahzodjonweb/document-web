# Template: tool (`/{locale}/tools/{slug}`, 19 pages)

Mockup: `mockups/tool.html` (Merge PDF). Data: `catalog`, `plans`.
Two variants share the template: **file tool** (17 slugs) and **editor-backed**
(`sign-pdf`, `fill-pdf-form`), which swap `limits` for `editor-more` and open the editor.

## Section order

| # | id | Background | Component | Reuse / new |
|---|---|---|---|---|
| 0 | (breadcrumb) | paper | `SiteBreadcrumb` Home / Tools / {Tool} | new shared |
| 1 | hero | paper | `SiteToolHero`: icon tile, H1, lead, fact chips / `SiteDrop` panel with one primary button | new |
| 2 | how-to | band | `SiteSteps` (3) | new shared |
| 3 | details | paper | split: H2 + 1–2 paragraphs + cross-links / tool illustration (per-tool vignette, see below) | new |
| 4 | limits (file tools) | band | `SiteKv` web / bot / plan | new shared |
| 4' | editor-more (editor-backed) | band | capability list (same as home editor) + link /pdf-editor | reuse home block |
| 5 | privacy | paper, tight | `.site-note` with shield: 24 h deletion + privacy link | new small |
| 6 | faq | paper | `SiteFaq` (3–5, per tool) | new shared |
| 7 | related | paper | 4 × `ToolCard compact` (related slugs from pages.json) | **reuse `ToolCard`** |

## Layout

- **1440**: hero 2 columns (copy / dropzone 50:50), H1 is the tool name only, so it fits one
  line in all languages ("PDF fayllarni birlashtirish" ≈ 28 chars still fits at 60 px in
  6 cols). Steps 3 columns. Details split. Limits 3 tiles. FAQ 4/8. Related 4 across.
- **768**: hero stacks, dropzone full width under copy. Related 2 across.
- **390**: dropzone button full width; chips wrap to 2 lines; steps stack; limits tiles stack;
  related 1 column.

Per-tool illustration (details): built from file rows, never screenshots.
Merge: 3 rows → arrow → 1 row. Split: 1 → 3. Compress: "4.8 MB" row → "1.1 MB" row
(sizes clearly labelled as an example). Convert: "otchet.docx" chip → "otchet.pdf".
Rotate/reorder/delete/extract: a strip of 5 page thumbnails with the affected ones
highlighted. OCR/searchable: a scanned page with a selectable text line. Protect/unlock:
row with a lock badge. Sign/fill: the editor page vignette with the signature box / form field.

## Content slots

| Slot | Budget | Notes |
|---|---|---|
| H1 | ≤ 28 | localized tool name = primary keyword ("Merge PDF", "PDF birlashtirish", "Объединить PDF") |
| Lead | 100–170 | what + typical use, in the user's words |
| Fact chips (3) | ≤ 26 each | web limit, pages, "Also in the Telegram bot" (only if catalog says so) |
| Drop panel title / button / note | ≤ 26 / ≤ 22 / ≤ 120 | button names the input: "Choose PDF files", "Choose Word file", "Choose images" |
| How-to H2 | ≤ 40 | "How to {verb} …" (SEO) |
| Steps (3) | title ≤ 26, text ≤ 100 | |
| Details H2 / body | ≤ 45 / ≤ 260 | honest limits (e.g. bookmarks not kept) |
| Limits tiles | label ≤ 22, value ≤ 22, note ≤ 90 | |
| Privacy note | ≤ 180 | |
| FAQ | q ≤ 60, a ≤ 300, 3–5 items | unique per tool and locale |
| Sign PDF details | must say "signature image", never "e-signature/ERI/EDS" | legal |

## Data bindings

- `catalog[feature]`: name, description, accepted formats (button label + chips), bot
  availability and bot limit, enabled state (a disabled tool returns 404 / redirect, not a
  "coming soon" page). Feature id → app link `/{locale}/app/tools/{feature}`.
- `plans`: Free weekly file tasks; "Unlimited on Plus and Premium".
- SEO: `<title>` "{Tool} online: DocMaster" (≤ 60), description ≤ 155, FAQPage + HowTo +
  BreadcrumbList JSON-LD, hreflang. Server-rendered.
