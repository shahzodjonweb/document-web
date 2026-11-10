# Template: pricing (`/{locale}/pricing`)

Mockup: `mockups/pricing.html` (shown with an example discount on Plus to design that
state). Data: `plans`, `contacts`.

## Section order

| # | id | Background | Component | Reuse / new |
|---|---|---|---|---|
| 0 | (banner) | blue-50 strip | `DiscountBanner` site variant, only when a discount is live | **reuse** |
| 1 | (intro) | paper | H1 + lead (not a pages.json section; page heading) | — |
| 2 | plans | paper | 3 × `SitePlanCard` (full) | new card, reuse `usePricing` |
| 3 | table | paper | `SiteCompareTable` limits × plans with caption (week reset) | shared |
| 4 | how-to-pay | band | `SiteSteps` (4) + card-name chips; slot for automatic payment when it ships | shared |
| 5 | week | (merged into the table caption) | — | — |
| 6 | invite | paper | `SiteKv` tile 1 → /invite | shared |
| 7 | refunds | paper | `SiteKv` tiles 2–3: no auto-renewal, refunds → /legal/refunds, /legal/offer | shared |
| 8 | faq | paper | `SiteFaq` | shared |

## Layout

- **1440**: plans 3 equal columns; no "popular" badge; Plus's button is the primary style
  only because it is the main paid plan (owner may change). Table full width, 4 columns.
  Pay steps 4 across.
- **768**: plans 1 column, max 560 px, left aligned with the heading. Table still a table.
- **390**: table becomes stacked rows: row label as heading, then "Free 5 / Plus 20 /
  Premium Unlimited" as label–value pairs. Discount banner wraps to 2 lines; icon hidden.

## Content slots

| Slot | Budget |
|---|---|
| H1 | ≤ 26 ("Plans and prices") |
| Lead | ≤ 220 (every feature on every plan; limits differ; so‘m; 30 days; no auto-renewal) |
| Plan name / period line | ≤ 12 / ≤ 48 (with discount "for 30 days. Offer ends 30 November") |
| Plan limit lines (4) | ≤ 36 each |
| Plan button | ≤ 18 ("Start free", "Choose Plus") |
| Table row labels | ≤ 26 |
| Table caption | ≤ 120 |
| Pay steps (4) | title ≤ 22, text ≤ 90 |
| Tiles | label ≤ 20, value ≤ 32, note ≤ 120 |
| FAQ | q ≤ 60, a ≤ 280; approval time and upgrade rules are **owner placeholders** |

## Data bindings

- `plans` (via `pricing.plan_price` / `usePricing`): name, regular price, discounted price,
  percent, last day, weekly limits, edits, channel rule (Free and Plus must join; Premium
  exempt). Prices formatted with `Intl.NumberFormat(locale)` + "so‘m"/"сум"/"so‘m".
- `contacts`: support channel in the payment FAQ.
- Signed in: the visitor's plan card is `.is-current` and its button reads "Your plan".
- Offer/Product JSON-LD: one `Offer` per paid plan with `priceCurrency: UZS`.
