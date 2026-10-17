# Customer visual and integration QA

Updated 2026-09-23 (Asia/Tashkent). This report supersedes the initial 13-tool checkpoint. The dedicated customer UI specialist implemented and inspected the screens; the root agent also reviewed screenshots and independently checked the earlier dashboard/result accessibility.

## Actual browser flows

The following run against the real localhost API and canonical test account, using Playwright with system Google Chrome:

- Upload/reorder/locale-switch/reload → quoted merge → downloaded three-page PDF. The recorded receipt settled one standard task and three processed pages.
- Plan cards in so'm → card transfer: the method, the owner's card with the exact amount and the payment code, the receipt upload, waiting for review (`tests/manual-payment.mjs`, mocked API). A discount set by the owner shows the regular price struck through, the percentage and its last day on the cards, the payment panel and the banner. No payment is charged automatically.
- Supplied source content → draft → edited outline → server quote → actual PDF. Russian output preferences also produced a downloadable editable PPTX archive.
- PDF editor preview → positioned text → versioned command save → actual exported PDF. Text overlays are explicitly described as pending previews.
- Authored teacher question → explicit 90-day project save → exact-match practice result 1/1. A practice grade is labeled as revision feedback.
- Teacher generation → separate learner and answer-key artifacts. Only learner material has a share control. Its real share download returned 200; revocation returned 404.
- Saved template CRUD and a saved rotation workflow → bound server quote confirmation → actual successful child job.
- Batch compression → aggregate quote → two real child receipts. Parent/child billing remains platform-owned.
- Actual Unicode AcroForm field values → saved versioned form template → two filled PDF outputs. `pypdf` independently verified `participant = Dilnoza Ўзбекистон` in the downloaded output.
- Owned logo, accent and brand name → actual branded PDF. The rendered first page was inspected and the brand text independently extracted.
- Version-bound rewrite → edited selected section; unselected section objects remained exactly equal to the source draft. Unselected sections are disabled in the review UI.
- Explicit outline quote → zero local credits → confirmation → new editable draft version. Reviewed sections/questions save as a private reusable template and survive creation of a new draft.
- All six published templates render in three locales; changing workspace mode persists to the account and opens the matching workspace. Unconfigured image/handwriting tools remain gated, with a single image/PDF source control for handwriting.
- Support ticket → owner conversation → persisted follow-up message.
- Local bot commands/callbacks/file delivery use actual aiogram handlers. A finished PPTX was delivered through the idempotent artifact API into the local transcript. The simulator clearly identifies that it does not send to external Telegram.

A live-server migration mismatch surfaced during form-batch integration as a database `IntegrityError`. The backend agent fixed the database default/migration compatibility, and the complete form batch and authoring journey subsequently passed. Earlier successful children were not recreated by recovery.

Final login verification found a stale anonymous tool catalog. Authentication now reloads the catalog and ignores an earlier response for a different account state; Telegram browser login follows the same refresh. A sandbox plan change inside the bot refreshes tool eligibility.

## Layout, state and accessibility

- English, Uzbek and Russian dashboards verified at1440,390 and320px; the eleven expanded routes verified at390 in all3 languages, with no horizontal overflow.
- Extended axe-core checks cover11 routes × light/dark at390px: **22 scans, zero WCAG2A/AA/2.1AA violations**. This is automated evidence, not a claim of full manual accessibility certification.
- Earlier independent root-agent scans found zero WCAG2A/AA violations on dashboard/result after contrast and touch-target fixes.
- Desktop editor evidence was recaptured at scroll position0 with focus blurred. The actual fixed sidebar starts at y0. Keyboard focus exposes the skip link; activating it reaches `#main-content`.
- API loading/error states, expired/error responses, actual quota/eligibility checks, empty collections, disabled unconfigured image generation, reviewed estimates and submission progress are present.
- Passwords remain transient; protection quotes contain a short-lived secret handle. Pending job submission retains its original idempotency key.
- Locale navigation and source draft restore preserve the basic file workspace. SPA navigation from an existing studio/editor/project to its list/new page resets the correct view.
- Bundled OFL DM Sans/Manrope fonts avoid remote font requests. Icons are Lucide. New screenshots include branded generation, editable canvas, practice, teacher exports, workflows, batches, billing, bot and support; mobile light/dark captures show real server data.

## Build and contract

Strict Nuxt typecheck passes. The production build passes under supported Node22.22.0. Dependencies and the public OpenAPI snapshot are pinned. `npm run check:catalog` checks complete en/uz/ru key parity, the exact schema checksum and absence of staff paths. The final emitted key count/checksum are recorded in `final-quality.json`.

## Evidence

- `extended-verification.json`: creation/editor/bot and localized responsive checks.
- `learning-verification.json`: practice, teacher roles/sharing, templates, workflow and batch.
- `final-flows-verification.json`: batch, support, PPTX, bot delivery and subscription controls.
- `advanced-authoring-verification.json`: actual form batch, branded PDF and preserved revision sections.
- `final-provider-verification.json`: provider gates, workspace modes, six localized presets, outline confirmation and reusable content templates.
- `extended-accessibility.json`: complete axe findings by route/theme.
- `screenshots/`: reviewed desktop/mobile screenshots and the rendered branded PDF page.
- `tests/fixtures/`: generated non-user test PDFs, logo and downloaded evidence artifacts.

## External validation limits

Live image and handwriting provider calls require configured credentials; the UI shows their provider requirement and does not manufacture a local result. The local authoring provider is explicitly deterministic and uses supplied/reviewed content. Real Telegram iOS/Android sessions, keyboard/safe-area behavior on physical devices, live provider quality and live payments are not verified by these localhost tests.

The backend owns production parser isolation, licensing, retention, ledger invariants and commercial gates. Legal pages remain clearly marked drafts. The customer site currently uses SPA rendering; public SSR/SEO work remains a separate release concern. Processing warnings explain OCR review, editable-conversion layout reflow, simple-font text-replacement support and rasterized redaction.
