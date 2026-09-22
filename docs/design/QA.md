# Customer visual and integration QA

2026-09-22. Reviewed by the dedicated customer UI/UX implementation specialist, with an independent root-agent accessibility pass.

## Verified

- Real API-backed browser account sign-in, upload of a two-page PDF plus one-page PDF, explicit source reordering, Uzbek locale switch, page reload with retained draft, returned quote, one idempotent job, usable three-page PDF download and job-detail refresh.
- The validated job returned `succeeded`, `settled_meters.file_tasks = 1`, `settled_meters.file_page_units = 3`, and the chosen appendix-first input order. The downloaded fixture begins with `%PDF-` and is preserved as a local evidence sample in `tests/fixtures/merged-result.pdf`.
- The initial broad browser test caught horizontal overflow in the Russian category strip; constrained flex sizing and horizontal category scrolling resolved it.
- English, Uzbek and Russian dashboards at 1440, 390 and 320 pixels have no horizontal document overflow. Directory, billing, settings and support at390 also pass.
- Settings persist timezone, output language, paper size and dark/light appearance through `/me`; no client runtime exceptions were emitted in the final visual/settings suite.
- Independent axe-core WCAG2A/AA scans at390 of the dashboard and completed result returned **zero violations** after adjusting muted foregrounds, status colors, readable metadata and44px file controls. This automated result does not replace full manual accessibility or real-device testing.
- Typecheck and production build pass, including a final production build under supported Node22.22.0. Exact versions are locked; npm audit reports zero vulnerabilities at this checkpoint.

- Private authenticated first-page thumbnail and selected page2 PNG render through the actual API; preview at390 does not overflow. A corrupt additional upload preserves the valid file. Protect quotes submit only a secret handle, and the raw test password does not appear in the persisted draft. Upload, preview and quote consume no allowance. Both qualified Office tool IDs are present in the13-tool local catalog.
- Public OpenAPI schema repinned to `f08ac4118b4b53668af054f913ebcd7bdc544c05b9ed5e55643dffca6baf4583`;260 complete translation keys across all3 locales.

## Review changes

- Replaced unlabelled zero AI receipt data with only positive settled meters; localized file-count plural forms using `Intl.PluralRules`.
- Raised secondary text contrast and metadata sizing, enlarged file reorder/remove targets to44px, and verified Russian/Uzbek text expansion.
- Bundled DM Sans and Manrope plus their OFL notices locally, eliminating external font requests.
- Active Office tools are determined by the server's qualified local capability list. No legacy DOC/PPT or future AI/editor feature is advertised as currently available.

## Evidence

`browser-verification.json` records the final no-new-job visual/settings pass. `browser-smoke.mjs` documents the full executable merge journey; the earlier integration iterations already exercised that mutation successfully, so subsequent layout passes used `SKIP_JOURNEY=1` to preserve the development account's remaining daily quota. Screenshots in `screenshots/` show the desktop/mobile landing, three-language dashboards, Uzbek merge, completed output, plans, settings and support.

## Limits

Legal pages are labeled local-development drafts. Live Telegram iOS/Android cookies, safe areas, keyboard behavior and verified bot delivery have not been signed off on real devices. Production checkout is off. Parser isolation/production licensing, retention, ledger invariants and engine-output quality are platform-owned gates. Public rendering is currently a SPA, and a full public SEO/SSR pass is pending.
