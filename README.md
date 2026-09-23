# PDF Master · customer workspace

A Nuxt 4 / Vue 3 / TypeScript workspace in English, Uzbek Latin and Russian. This repository contains the public website, customer application and Telegram Mini App shell. The API, workers, actual aiogram bot, ledger and staff interface live in the sibling `document-platform` repository.

Private GitHub repositories: [document-web](https://github.com/shahzodjonweb/document-web) and [document-platform](https://github.com/shahzodjonweb/document-platform).

The complete local workspace uses real server accounts, quotes, jobs, output files and transactions. The local authoring provider is explicitly labeled: it renders supplied and reviewed content deterministically and does not pretend to return live AI output. Live generation and Telegram transport depend on credentials configured through the staff interface. Local sandbox invoices do not charge real Telegram Stars.

## Run

Use Node 22.19+ in the Node 22 LTS line (`.nvmrc` pins 22.22.0), or supported Node 24 LTS. Start `document-platform` on `127.0.0.1:8000` first.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:3000/en/app`. `/uz` and `/ru` select the other languages. **Use local development account** explicitly signs into the backend-owned test account. Telegram launch data is verified server-side; no account or balance is fabricated in the frontend.

`API_ORIGIN` defaults to `http://127.0.0.1:8000`. Nuxt proxies `/api/**` to keep cookies and CSRF same-origin. This value is read when building; set it before a deployment build when the upstream differs.

## Workspace

- `/app/tools`: server-enabled file tools, including PDF page operations, compression, images, password protection/unlock, Office/PDF conversion, OCR and batches. Upload → metadata/preview → settings → actual quote → idempotent job → private download.
- `/app/create`: topic, supplied text or PDF sources → versioned draft → separately quoted outline → editable sections, questions and speaker notes → quote → PDF/PPTX. Existing drafts can be selected for rewriting or selected-slide revision. Branding accepts a name, accent color and owned logo. Unselected revision sections are preserved. Reviewed sections and questions can be saved as reusable private templates.
- `/app/images`: provider-gated PNG generation with a real quote and confirmation. Handwriting accepts one image or one-page PDF, requires a qualified vision provider, and supports corrected transcription export without another provider charge.
- `/app/study`, `/app/school`, `/app/teach`: education tools selected from the server configuration, with source/subject/level inputs, reviewed content, separate teacher and learner files, and adaptive follow-up based on an owned saved project.
- `/app/projects`: explicit 90-day encrypted-content consent, private saved material, real exact-match practice results, weak topics and deletion. Practice feedback is not presented as a final academic grade.
- `/app/editor`: authenticated page previews, point-based positioning, actual text/highlight/note/form/image/signature/replacement/redaction commands, saved form-value templates, batch form filling and quoted PDF export. The pending overlay is distinguished from the actual exported file. Redaction requires explicit rasterization consent.
- `/app/workflows`, `/app/templates`: owner-scoped versioned definitions. Workflows submit the server's bound confirmation token and show real child results; failed steps stop subsequent work.
- `/app/billing`, `/app/referrals`: server balances, invoices, explicit sandbox payment confirmation, subscription renewal controls, next-period plan scheduling, transaction/refund requests, invitation codes and actual reward counts.
- `/app/bot`: the actual aiogram handlers through a clearly labeled local transport. Text, callback buttons, file uploads and artifact delivery are persisted by the platform; the local conversation does not send to external Telegram.
- `/app/support`: tickets, owner-only conversation history and replies. Settings persist language, timezone, output preferences and light/dark theme.
- `/app/jobs`: real job progress, positive settled usage, private downloads, idempotent bot delivery and expiring/revocable learner-only share links. Teacher answer keys have no public sharing control.

The server remains authoritative for eligibility, limits, prices, ownership, retention and payment state. Raw PDF passwords stay out of persisted quote/job parameters; protection uses a short-lived secret handle. Original source files and edited output files remain separate. No staff assets or routes are bundled here.

## Verification

```sh
npm run typecheck
npm run build
npm run check:catalog
SKIP_JOURNEY=1 npm run test:browser
npm run test:preview
node tests/extended-smoke.mjs
node tests/learning-smoke.mjs
node tests/final-flows.mjs
node tests/advanced-authoring.mjs
node tests/final-provider-stages.mjs
node tests/extended-accessibility.mjs
```

Browser scripts use system Google Chrome via Playwright `channel: 'chrome'`. The extended scripts create real local test records and perform explicit sandbox transactions or consume granted test allowances. They must run against the configured local test account. Fixture PDFs contain no user documents. `docs/design/QA.md` and JSON reports record the checks and their limits.

`tests/extended-accessibility.mjs` uses the pinned axe-core Playwright dependency. It scans representative extended routes in both themes at 390px.

## API and deployment

`generated/api/public.openapi.json` is the pinned public schema exported by the platform. `npm run check:catalog` verifies its SHA-256 and excludes staff routes. Regenerate `schema.d.ts` with `npm run generate:api` after copying a new public schema and checksum. The shared CSRF-aware transport powers the base typed client and the extended domain screens.

The Dockerfile pins the Node image manifest and serves the production output as an unprivileged user on port 3000. Use `--build-arg API_ORIGIN=http://api:8000` with the sibling Compose setup. No remote deployment or production purchase has been performed.

The [CI/CD guide](docs/cicd.md) documents automatic testing, production image smoke checks and SSH deployment from `main`. Set `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS` as Actions secrets in both repositories. Missing credentials are reported as **Deployment not configured**; the workflow does not attempt a server connection until all four are supplied.

## Design and remaining external validation

`docs/design/FOUNDATION.md`, `EXTENDED_WORKSPACE.md` and `wireframes.html` describe the flows before implementation. The interface uses forest/sage/ivory tokens, locally hosted OFL DM Sans/Manrope fonts, Lucide icons, visible focus states, safe-area padding and responsive layouts. The complete workspace remains usable at 390px and 1440px in light and dark themes.

Real Telegram iOS/Android device validation, live credentials/providers, commercial and legal approval, production parser isolation/licensing and public SSR/SEO optimization remain external release work. Local legal pages identify their draft status. Actual processing has documented limitations: Office conversion can reflow layout, OCR needs review, exact text replacement supports qualified simple fonts, and redaction rasterizes all pages of the exported document.
