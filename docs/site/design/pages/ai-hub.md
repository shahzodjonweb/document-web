# Template: ai-hub (`/{locale}/ai`)

Data: `plans`.

## Section order

| # | id | Background | Component | Reuse / new |
|---|---|---|---|---|
| 1 | hero | paper | `SiteHero` text-only variant (H1 + lead + "Create with AI" button + Telegram), right side: the three AI previews from home, overlapped in one stage | new hero variant |
| 2 | services | band | 3 × `SiteAiCard` (same as home, with 3 facts each) | shared |
| 3 | ai-edits | paper | split: copy / vignette of an AI edit ("Make slide 6 shorter…" prompt chip → updated page) + per-plan edits line | new |
| 4 | limits | band | `SiteKv` Free / Plus / Premium AI docs per week + edits | shared |
| 5 | guide | paper | short band: "Write better requests" + link to /guide | `SiteCta` light variant |
| 6 | data-note | paper, tight | `.site-note` info: requests kept 30 days for quality review; processed via OpenAI; privacy link | shared |

## Layout

1440: hero 6/6, services 3 columns, ai-edits split. 768: stack, services as horizontal rows.
390: single column; AI previews reduce to one stage 190 px high per card.

## Content slots

| Slot | Budget |
|---|---|
| H1 | ≤ 55 ("Documents, presentations and CVs with AI") |
| Lead | ≤ 160 (mention uz/ru/en) |
| Card title / line / facts | ≤ 18 / ≤ 70 / ≤ 18 each |
| AI edits H2 / body | ≤ 40 / ≤ 200 |
| Limits tiles | label ≤ 24, value ≤ 26, note ≤ 60 |
| Data note | ≤ 200 |

## Data bindings

`plans`: AI docs per week and AI edits per file per plan, prices for tile labels. Week reset
line "Monday 00:00, Tashkent time" is static copy but must match the backend week rule.
