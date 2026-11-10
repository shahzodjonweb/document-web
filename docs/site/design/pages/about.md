# Template: about (`/{locale}/about`, `/contacts` redirects here)

Data: `contacts`. This is the page payment-provider reviewers look for: plain, complete,
nothing promotional.

## Section order

| # | id | Background | Component | Reuse / new |
|---|---|---|---|---|
| 1 | company | paper | H1 "Company and contacts", short paragraph: DocMaster (formerly PDF Master) is operated by “ARCANIUM TECHNOLOGIES” MCHJ, Tashkent; owner-approved mission line | text |
| 2 | requisites | paper | large `SiteSheet` requisites card (folded corner): legal name, STIR 313458514, legal address, bank details if required, director (if the owner publishes) as a two-column definition list; "Copy" button next to STIR and bank account | **reuse `CompanyDetails`** inside the new sheet wrapper |
| 3 | contacts | band | `ContactLinks` as tiles: phone (tel:), email (mailto:), Telegram support, working hours | **reuse `ContactLinks`** |
| 4 | legal-links | paper | three links with document icons: Public offer, Privacy policy, Refund policy | small list |

## Layout

Narrow container (760 px) at all sizes. 1440/768: requisites as a 2-column list. 390: 1
column, values wrap anywhere (`overflow-wrap: anywhere` for long account numbers).

## Content slots

| Slot | Budget |
|---|---|
| H1 | ≤ 30 |
| Company paragraph | ≤ 300 |
| Requisite labels | ≤ 24 (state-language wording first in uz: "STIR", "Yuridik manzil") |
| Contact tile label / hint | ≤ 20 / ≤ 40 |

## Data bindings

`contacts` (admin Contacts setting) for every requisite and contact. Missing values render
the amber placeholder in staging and are a release blocker for production (the law requires
phone, email and address).
