# Authentication browser checks

These checks use an isolated local app. They do not configure providers or send real email.

Start the platform fixture in `document-platform`:

```sh
.venv/bin/python scripts/dev_auth_e2e.py
```

It listens on `127.0.0.1:8001` with its own database and a file-based email spool. Then start `document-web`:

```sh
API_ORIGIN=http://127.0.0.1:8001 npm run dev -- --port 3001
```

Run:

```sh
npm run test:auth:email
npm run test:auth:ui
npm run typecheck
npm run check:catalog
```

`AUTH_WEB_ORIGIN` overrides the default `http://127.0.0.1:3001`. `AUTH_MAIL_DIR` overrides `/tmp/pdfmaster-auth-e2e/mail`. The real email test only accepts a localhost origin. It generates a unique test email address and random passwords on every run and never prints passwords or verification codes.

The email test exercises the real Django API, verification email in the private local spool, browser session cookies, password login, password change with other-session invalidation, password reset, and EN/UZ/RU account settings.

The UI test substitutes API responses and external identity-provider pages. It checks Google authorization navigation and link intent, callback/conflict messaging, Telegram approval/linking, adding email/password to a Google account, disabled providers, mobile layouts, and form accessibility. These mocked boundaries do not establish that real Google credentials or a real Telegram bot are configured.

Reports are written to `docs/design/authentication-*-verification.json` and screenshots to `docs/design/screenshots/authentication/`.

## Optional browser verification

```sh
AUTH_WEB_ORIGIN=http://127.0.0.1:3002 npm run test:auth:antibot
```

This check mocks Cloudflare and the API; it never solves a real challenge or sends account credentials to an external service. It covers disabled/no-script operation, fresh one-use tokens, the fixed `customer_auth` action and browser-session binding, cancellation and late callbacks, script load errors, widget failure/expiry and retry, fail-closed missing configuration, backend rejection messages, every sign-in/link initiation (including automatic MiniApp entry), EN/UZ/RU copy, 320px layout and dialog accessibility.

The shared dialog uses explicit Turnstile rendering only after an account-access attempt. It fetches the current public settings before each attempt, displays only the public site key/binding, and never persists the token. Email verification/reset confirmation and Telegram approval exchange continue their existing owner-bound challenge flow. A site administrator configures the public site key and secret in the platform settings; the secret never reaches the customer bundle.

Implementation references: [explicit rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/) and [widget callbacks, appearance and configuration](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/).
