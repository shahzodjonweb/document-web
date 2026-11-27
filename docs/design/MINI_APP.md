# The app inside Telegram (Mini App)

The bot opens this web app inside Telegram: from the chat's menu button and the bot's
**📱 Open app** buttons once the owner ticks **Open the app inside Telegram (Mini App)** on
Admin → Integrations → Telegram bot, and, as before, from the editor's and deck/CV setup's own
buttons. It is the same `/{locale}/app` as the website, signed in from Telegram's launch data
(`POST /auth/telegram/miniapp`), with a frame of its own. Nothing changes in a plain browser.

Sources: core.telegram.org/bots/webapps (the Web App API) and the TelegramUI kit's tokens,
researched 2026-11-27.

## Frame

- Telegram draws the top bar (the bot's name, Close, the ⋮ menu) and Back. The app draws no
  sidebar, top bar or logo (`layouts/default.vue`, `html.tg-app`, `assets/css/miniapp.css`).
- **Three places** in a bar of the app's own: **Home** (`/app`, the bot's main menu as a screen),
  **Tasks** (`/app/jobs`) and **Profile** (`/app/account`: plan and weekly limits, Plans and
  payment, Invite friends, Settings, Language, PDF editor, Prompt guide, Contacts and support).
  The bar shows on those three screens only; switching places replaces history and taps a
  selection haptic.
- **Back is Telegram's.** Every other screen turns on Telegram's Back: it returns the way the
  customer came, or, opened straight from the chat, to the place the screen belongs to (a task →
  Tasks, Plans/Invite/Settings/Help/Guide → Profile, anything else → Home). In-page back links
  are hidden. A screen a bot button opens on its own (the editor, deck and CV setup) keeps
  Telegram's Close until the customer moves inside the app, as those screens run Back for their
  own sheets.
- **The main action is Telegram's button at the bottom** (`usePrimaryAction`): a tool's
  Check, then Start; a result's Save to phone. The page's own button gives way to it. It is
  shown disabled, never hidden, while the step cannot run, so the page does not jump.
- **Settings** is also in Telegram's ⋮ menu (SettingsButton). Coming back from being minimised
  (`activated`) reloads the account, as a task may have finished or a plan been paid.
- Inputs are at least 16px (iOS zooms otherwise); the page does not bounce past its ends.

## Colours

The customer's own Telegram theme, followed live (`themeChanged`): its page and card colours,
main text, links, separators and buttons are written into the app's tokens
(`useTelegramApp` `applyTelegramTheme`), and Telegram's header, background and bottom bar are
set to the page colour by key, so they follow the theme too. Secondary greys and danger stay the
app's own. Every text colour is held to 4.5:1 on what it sits on: a Telegram colour short of it
keeps its hue and is darkened or lightened just enough (Telegram's default blue under white
text is 4.2:1 in light and 3.5:1 in dark). The website's theme picker is hidden inside Telegram.

## Language

The menu button opens one address for everyone, so inside Telegram the **account's language
leads**: the app moves to it after signing in, and never rewrites the account's language from
the address (the website does the opposite). Profile's Language row changes both.

## Results reach the chat

As the bot's would, a task started inside Telegram (a tool, an AI document; the editor and the
deck editor already did) asks for `deliver_to_chat`, so the file arrives in the chat even if
the app is closed; the result screen says so. Telegram must be allowed to write to the person
first (`requestWriteAccess`, asked only of someone who never started the bot).

**Saving to the phone.** A download link does nothing in a phone's web view, and a PDF opened in
it has no way back. Telegram saves the file itself (`WebApp.downloadFile`, 8.0+) from a link
that needs no session: `POST /artifacts/{id}/link` signs one result of one account for five
minutes, stops when the account signs out everywhere, and the download answers Telegram Web's
origin. On older clients only Send to chat is offered.

## Links

A link to another site opens in the phone's browser (`openLink`), a t.me link inside Telegram
(`openTelegramLink`), with the app left open. Payment pages already open outside (inPAY); since
Bot API 10.2 Telegram's methods do not work on another site inside the web view.

## Opening a screen directly

`t.me/<bot>?startapp=<name>` (once the owner sets the bot's Main Mini App in @BotFather) opens:
`tools`, `jobs`, `plans`, `invite`, `settings`, `help`, `profile`, `create_pdf`,
`create_slides`, `create_cv`, `scan`, or `job_<id without dashes>`. Anything else is Home.

## Known limits

- Telegram Web (web.telegram.org) runs the app in an iframe, where browsers may refuse the
  session cookie as third-party; phones and Telegram Desktop are unaffected.
- Telegram's launch data is accepted for five minutes after opening; after that the session
  cookie carries the customer. A cleared cookie needs the app reopened from the bot.
- Not checked on real iOS/Android/Desktop clients yet; `tests/mini-app.mjs` drives a recorded
  fake of Telegram's object.

## Checks

`npm run test:mini-app` (needs the build served on :3002, or `MINI_APP_WEB_ORIGIN`).
