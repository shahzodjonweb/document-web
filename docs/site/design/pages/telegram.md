# Template: telegram (`/{locale}/telegram`)

Data: `catalog`, `plans`. Bot username and channel link are owner placeholders.

## Section order

| # | id | Background | Component | Reuse / new |
|---|---|---|---|---|
| 1 | hero | paper | `SiteHero`: H1, lead, primary "Open @{bot}" (t.me link) / phone-frame vignette of the bot chat (real bot copy: "Hujjatingiz tayyor: hisobot.pdf" + file bubble + inline buttons); on ≥ 900 px a QR code card ("Scan with your phone") | new; QR generated at build time as inline SVG |
| 2 | what-it-does | band | three columns: File tools (list from catalog where bot = true), AI documents/slides/CV, PDF editor as Mini App | new list using tool rows |
| 3 | limits | paper | `SiteCompareTable` bot vs web + list of web-only tools (catalog) | shared |
| 4 | account | band | split: copy (same account and plan, sign in to web with Telegram) / two small device frames linked by a line | new small |
| 5 | channel | paper | `.site-note`: Free and Plus ask you to join the channel; Premium doesn't; link to channel | shared |
| 6 | faq | paper | `SiteFaq` (is the bot official — name the exact username; large files → web) | shared |

## Layout

1440: hero 6/6 with QR card overlapping the phone frame bottom-left. 768: stack, QR hidden
under 900 px (people are already on the phone), button stays. 390: chat vignette 300 px tall,
lists 1 column.

## Content slots

| Slot | Budget |
|---|---|
| H1 | ≤ 40 ("DocMaster in Telegram") |
| Lead | ≤ 160 |
| CTA | ≤ 24 (includes the @username) |
| QR caption | ≤ 30 |
| Column titles / items | ≤ 26 / ≤ 30 |
| Account H2 / body | ≤ 45 / ≤ 180 |
| Channel note | ≤ 180 |
| FAQ | q ≤ 60, a ≤ 260 |

## Data bindings

`catalog`: bot availability per tool, bot file limit (20 MB). `plans`: channel requirement per
plan. Config: bot username, channel URL (placeholders shown with `.site-placeholder` until set).
