# Template: invite (`/{locale}/invite`)

Data: none beyond static rules (rules mirror `invite-rewards`; Uzbek says "Plus tarifi").

## Section order

| # | id | Background | Component | Reuse / new |
|---|---|---|---|---|
| 1 | how | paper | H1 + lead + a **reward ladder**: a horizontal track of steps "5 friends → 1 month", "10 → +2 months", "15 → +3 months"… with the monthly cap note | new `SiteLadder` (a real sequence, so numbered) |
| 2 | steps | band | `SiteSteps` (3): open My referrals in the app or bot, copy your link, friends sign up as new users | shared |
| 3 | cta | paper | primary "Open My referrals" (`/{locale}/app/referrals`) + secondary "Open in Telegram" | buttons |
| 4 | faq | paper | `SiteFaq` (who counts: only new users; at most 5 friends counted per month; already on Plus — owner to confirm) | shared |

## Layout

1440: ladder full width, 4 visible steps + "and so on". 768: ladder scrolls horizontally inside
its own container with visible edge fade and scroll-snap (the page itself never scrolls
sideways). 390: ladder becomes a vertical list.

## Content slots

| Slot | Budget |
|---|---|
| H1 | ≤ 40 ("Invite friends, get Plus") |
| Lead | ≤ 160 |
| Ladder step | count ≤ 14, reward ≤ 22 |
| Cap note | ≤ 100 |
| Steps | title ≤ 26, text ≤ 100 |
| FAQ | q ≤ 60, a ≤ 260 |

Rewards are Plus periods, never described as money or "free" revenue; no counters of
"friends invited" on the public page.
