# Template: help (`/{locale}/help`)

Data: `contacts`, `plans`. The prompt guide (`/guide`) keeps `GuideView`, wrapped in the site
header/footer and the narrow container; it is not redesigned here.

## Section order

| # | id | Background | Component | Reuse / new |
|---|---|---|---|---|
| 1 | search | paper | H1 "Help" + large search field (56 px) filtering all questions live; result count announced via `aria-live="polite"` | new; reuse `.search-box` logic |
| 2 | topics | paper | 8 topic links as a 4 × 2 grid of icon + title + question count; anchor to the topic group | new `SiteTopicLink` |
| 3 | faq | paper (narrow container 760) | one `SiteFaq` group per topic with an H2 per topic; deep-linkable question ids (`#q-files-deleted`) | shared |
| 4 | contact | band | `ContactLinks` (in-app Support, Telegram, email, phone) + working hours; placeholders shown amber | **reuse `ContactLinks`** |

Topics: Getting started · File tools and limits · PDF editor · AI services · Plans and payment ·
Invite rewards · Account and sign-in · Privacy and file deletion (the last one embeds the
compact `SiteLifecycle`).

## Layout

1440: search centred at 760 px under a left-aligned H1; topics 4 columns; FAQ narrow column
with a sticky topic list on the left (like the legal TOC). 768: topics 2 columns, no sticky
list. 390: topics 1 column as compact rows; search sticky under the header.

## Content slots

| Slot | Budget |
|---|---|
| H1 / lead | ≤ 20 / ≤ 120 |
| Search placeholder | ≤ 32 |
| Topic title | ≤ 28 |
| Question / answer | ≤ 70 / ≤ 400 (verified facts only) |
| Empty search | "No answers for “{query}”. Ask support in Telegram." |
| Contact block title / hours | ≤ 30 / ≤ 40 |

## Data bindings

`contacts` → contact block; `plans` → numbers inside answers (interpolated). FAQPage JSON-LD
for all questions.
