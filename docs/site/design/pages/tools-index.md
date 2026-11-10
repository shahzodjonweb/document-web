# Template: tools-index (`/{locale}/tools`)

Data: `catalog`, `plans`. No mockup; reuses home's tool groups and the tool page's limits tiles.

## Section order

| # | id | Background | Component | Reuse / new |
|---|---|---|---|---|
| 1 | hero | paper | breadcrumb, H1, lead, search field + group filter chips | reuse `.search-box` / `.category-tabs` behaviour from `ToolsView`, restyled with `site-` classes |
| 2 | groups | paper | one `SiteToolGroup` per group (6 groups), rows with description; editor-backed Sign / Fill form in an "Edit" group | new list (same as home) — or `ToolCard` in a 3-col grid if the owner prefers cards |
| 3 | limits | band | `SiteKv` (web / bot / Free plan) | new shared |
| 4 | ai-crosslink | paper | `SiteCta` variant (band without fold, secondary style) linking to /ai | new shared |

## Layout

- **1440**: hero copy left 7 cols, search right-aligned 5 cols on the same baseline. Groups in
  a 3-column masonry-free grid (Organize, Optimize, Convert to PDF / Convert from PDF, OCR,
  Security / Edit), each panel with a group H2 (20 px). Search filters rows live and shows
  "No tool matches “{query}”. Try ‘merge’, ‘word’ or ‘jpg’." with a link to all tools.
- **768**: 2 columns. **390**: 1 column, rows with description kept (this page is for browsing),
  search full width and sticky under the header while scrolling the list.

## Content slots

| Slot | Budget |
|---|---|
| H1 | ≤ 24 ("All PDF tools") |
| Lead | ≤ 120 |
| Search placeholder | ≤ 28 ("Search tools") |
| Group titles | ≤ 26 |
| Tool row name / description | ≤ 22 / ≤ 48 (longer than home: description is the point here) |
| Limits tiles | label ≤ 22, value ≤ 22, note ≤ 80 |
| AI cross-link H2 / line / button | ≤ 40 / ≤ 90 / ≤ 20 |

## Data bindings

`catalog`: tool list, names, descriptions, accepted formats (shown as a muted suffix
"PDF" / "DOC, DOCX"), bot availability icon (paper-plane, with text "Also in Telegram" for
screen readers). `plans`: Free weekly file-task number in the limits tile. Search is client-side
over localized names plus synonyms (uz/ru search words from the SEO list).
