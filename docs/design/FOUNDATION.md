# PDF Master customer design, v1

Author: dedicated customer UI/UX specialist. Scope: browser and Telegram Mini App, P1 file tools. Created before screen implementation, 2026-09-22.

## Task flow

Public landing → released tool directory → Telegram account entry → upload private files → inspect file names/pages → reorder with explicit buttons → choose settings → review server quote and remaining allowance → confirm once → actual processing stages → download private output → history. Account entry supports a clearly labeled local development account only when server configuration allows it. No anonymous account or made-up usage.

Locale switch preserves the route/query and in-memory draft. Draft identifiers and non-secret settings are retained in sessionStorage for same-browser recovery, never access tokens or passwords. A quote is invalidated after settings/file changes. Running jobs use the server ID and reload safely. Disabled releases are absent from active tools and purchase claims.

## Tokens

Canvas #F7F8F5; surface #FFFFFF; ink #20372C; body #57645B; muted #859088; border #E3E8E1; forest #285F48; forest hover #1E4B38; sage #EAF2E7; warm accent #F1DDAA. Error #AB3737 on #FFF0EF. Focus #568C6C with 3px visible ring. Dark equivalents are scoped to data-theme=dark and honor preference. Typography: locally hosted DM Sans and Manrope variable fonts with system fallback for full Latin/Cyrillic support, 14px body, 1.55 line height, 32px desktop heading, 28px mobile heading. Radii 8/12/18px. Spacing 4/8/12/16/24/32/40px. Card shadows minimal.

## Layout / wireframes

Desktop 1440: [232px fixed sidebar | topbar then 1120px max main with 40px padding]. Dashboard: heading and task action; 2/3-width upload panel + 1/3 privacy/usage rail; 5 priority tool cards; recent activity table; contextual help. Tool: breadcrumb/title; 2/3 inputs/settings + 1/3 quote summary. Job: staged status + output list and allowance receipt. Billing: three comparable plans plus actual current allowance. Public: simple header, editorial two-column hero, tool row, privacy principles, footer.

Mobile 390 and down to 320: brand + language at top; 20px horizontal inset; one-column upload/card/summary; 2-column compact tool cards; cards replace wide tables; 4-item bottom navigation (Home, Tools, Tasks, Account) with safe-area padding. Primary buttons are reachable, 44px min height. Detail summary follows inputs. Long filenames truncate visually but expose full title/accessible label.

Future scope wireframes (gated): AI Content → Outline → Style → Generate with source/quote rail; teacher results separate learner and teacher artifacts; editor page strip | canvas | properties with explicit saving/export states. These are design context only, no active routes or paid benefits.

## Component inventory and keyboard interaction

AppShell (public/customer), BrandMark, Icon, ToolCard, FileDropzone, FileRow, QuoteSummary, StageList, ArtifactRow, StatusBadge, EmptyState, ErrorBanner, LanguagePicker, PlanCard. Buttons use native button elements; links are navigation. Dropzone has accessible file input fallback. File order has Move up/down controls in addition to visual ordering. Forms have visible labels and errors. Status/error changes use polite/assertive live regions. Escape closes modal if introduced; no keyboard traps. Focus remains visible. Navigation marks aria-current.

## State matrix

Session: loading / signed out / Telegram confirmation pending / authenticated / expired / unavailable.
Catalog: loading / real released tools / empty / unavailable.
Upload: idle / drag-over / uploading / accepted / unsupported / encrypted or malformed / removed / expired.
Quote: absent / loading / available with actual meter and expiry / quota exceeded / expired / unavailable.
Job: queued / preparing / processing / finalizing / succeeded / no-op / failed / expired. Do not fabricate numeric progress. Download exists only for returned artifacts.
Billing: real staging limits / prices not configured / checkout disabled / Free active. No invented payment history.
History: loading / empty / rows / error; unavailable API never renders zero statistics.
Support: input / sending / accepted ID / server failure.

## Locale glossary / review

uz: O‘zbekcha, Fayl yuklash, PDF fayllarni birlashtirish, Qayta ishlanmoqda, Yuklab olish, To‘lov.
ru: Русский, Загрузить файл, Объединить PDF, Обработка, Скачать, Оплата.
Use Intl date/number formatting, account timezone independent from interface language, UTF-8 originals for filenames, no v-html for user content. Date deadlines show timezone. Long Russian controls wrap; font size never shrinks to make labels fit.

## API dependencies

Backend owns session/account, released catalog, input schema, limits, plans, quote price/expiry, current balances, job status, file ownership and downloads. Client submits only selected feature ID, owner-scoped input IDs, parameters and quote ID. CSRF header on unsafe requests, cookies same-origin via /api proxy. No staff route or client is present.

## Review gates

Build/typecheck; API integrated merge with real output; 1440px desktop / 390px mobile / 320px overflow checks; English, Uzbek, Russian; keyboard upload/order/start/download; no null-price checkout; honest API failure/empty states. Real Telegram iOS/Android safe-area/cookie tests remain a deployment requirement.
