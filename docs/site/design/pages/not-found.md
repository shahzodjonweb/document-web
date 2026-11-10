# Template: not-found (any unknown path, HTTP 404, noindex)

Data: `catalog` (tool search).

## Section order

| # | id | Component | Reuse / new |
|---|---|---|---|
| 1 | message | a single `SiteSheet` page drawn large with its corner folded and an empty body (the only illustration), H1 "This page doesn’t exist", one line with the requested path in `<code>` | new, tiny |
| 2 | links | tool search field (same as tools index) + four links as buttons: Home, All tools, AI, Help | reuse search; buttons |

## Layout

Centered column, 560 px max, vertically centered in the viewport minus header (min 60vh).
390: sheet illustration 120 px, links stacked full width.

## Content slots

| Slot | Budget |
|---|---|
| H1 | ≤ 36 ("This page doesn’t exist"; uz "Bunday sahifa yo‘q"; ru "Такой страницы нет") |
| Line | ≤ 100 ("Check the address, or find the tool you need below.") |
| Search placeholder | ≤ 28 |
| Link labels | ≤ 14 each |

No jokes, no apology. The header, footer and language switch stay, so the visitor can still
navigate; the language switch on a 404 goes to the home page of the chosen locale.
