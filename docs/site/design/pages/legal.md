# Template: legal (`/{locale}/legal/{offer|privacy|refunds}`)

Mockup: `mockups/legal.html` (offer). Data: `contacts`, `plans` (offer only).

## Section order

Header block (all three): breadcrumb → H1 → meta row (Uzbek document name, version, in force
from {date}) → language note ("This English/Russian text is a translation. The Uzbek text
prevails.", with a link to the Uzbek version; hidden on the uz page).

| Document | Sections (pages.json ids, in order) |
|---|---|
| offer | parties, subject, acceptance, plans-prices, payment, limits-usage, ai-content, refunds, liability, language, requisites |
| privacy | operator, data, purposes, retention, processors, cross-border, rights, cookies, changes |
| refunds | scope, no-renewal, when, how, method, receipts |

| Part | Component | Reuse / new |
|---|---|---|
| Contents | sticky TOC (`SiteToc`) with scroll-spy (`aria-current="true"`) on ≥ 900 px; a `<details>` "Contents" box on smaller screens | new |
| Body | `SiteProse` (16.5 px / 1.7, 64ch), numbered H2 per section with stable ids for linking from the offer, app and receipts | new |
| Retention table (privacy) | `.site-table` (files 24 h, AI requests 30 days, receipts 90 days, account until deletion) | shared |
| Processors (privacy) | table: processor, purpose, country | shared |
| Requisites (offer end, privacy operator) | `SiteSheet` + `CompanyDetails` | reuse |
| Print | `@media print`: hide header/footer/TOC, black text, show URLs after links | CSS only |

## Layout

1440: TOC 260 px column + prose 64ch; generous whitespace. 768 and 390: single column, TOC
collapsed into the details box under the header block.

## Content slots

| Slot | Budget |
|---|---|
| H1 | ≤ 30 ("Public offer", "Privacy policy", "Refund policy") |
| Meta items | ≤ 30 each |
| Section H2 | ≤ 40 |
| Paragraphs | no limit, but ≤ 4 sentences each; lists for enumerations |

Lawyer-owned text. The design only fixes structure, ids and readability. Version date and the
"Uzbek prevails" line are mandatory on every locale.

## Data bindings

`contacts`: seller requisites and data-request contact. `plans`: prices and limits quoted in
the offer are interpolated so the offer never disagrees with /pricing; changing them bumps the
offer version (owner process).
