# Template: pdf-editor (`/{locale}/pdf-editor`)

Data: `plans` (only "starts free" until the owner confirms editor limits). Reuses the home
editor block at full size.

## Section order

| # | id | Background | Component | Reuse / new |
|---|---|---|---|---|
| 1 | hero | paper | `SiteHero`: H1, lead, primary "Open the PDF editor", secondary "Open in Telegram" / large editor vignette (toolbar + page + properties strip) | new hero, vignette from home |
| 2 | capabilities | band | 8 capability tiles in a 4 × 2 grid, each a small cropped vignette (text edit caret, highlight, note, form field, signature, image swap, redaction bar) + title + one line | new `SiteFeatureTile` |
| 3 | how-to | paper | `SiteSteps` (upload, edit, download) | shared |
| 4 | channels | band | `SiteCompareTable` browser vs Telegram Mini App (same account, file limits) | shared |
| 5 | plans | paper | one line + link to pricing ("The editor starts free.") | text block |
| 6 | privacy | paper | `.site-note`: 24 h deletion, redaction removes the text from the file (wording to confirm with the editor rules) | shared |
| 7 | faq | paper | `SiteFaq` (scanned PDF → OCR link; signature image is not an e-signature) | shared |
| 8 | related | paper | `ToolCard compact` × 4: sign-pdf, fill-pdf-form, merge-pdf, compress-pdf | reuse |

## Layout

- **1440**: hero 5/7 split with the vignette larger than on home (it is the product).
  Capabilities 4 columns. **768**: hero stacks, capabilities 2 columns. **390**: capabilities 1
  column with vignette left (64 px) and text right to keep the list short.

## Content slots

| Slot | Budget |
|---|---|
| H1 | ≤ 30 ("Edit PDF online") |
| Lead | ≤ 160 |
| CTAs | ≤ 22 each |
| Capability title / line (8) | ≤ 26 / ≤ 80 |
| Steps | title ≤ 26, text ≤ 100 |
| Channels rows | label ≤ 26, cell ≤ 32 |
| FAQ | q ≤ 60, a ≤ 300 |

## Data bindings

`plans` only for the pricing link copy. Editor availability in the Mini App comes from the
catalog/bot config (`editor` feature flag). Do not state edit counts or limits until confirmed.
