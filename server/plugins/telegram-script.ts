/**
 * Telegram's Mini App script, on the app's pages only.
 *
 * The bot opens every Mini App under `/{locale}/app` (see the platform's
 * `telegram/delivery.py` `app_url`), and the sign-in hand-off is under
 * `/{locale}/auth`. The public pages never needed it, and it is a third-party
 * script on every visit. It goes first in the head: deferred scripts run in
 * document order, so `window.Telegram.WebApp` exists before the app mounts and
 * reads `initData` to sign the customer in.
 */
const APP_PAGE = /^\/(en|uz|ru)\/(app|auth)(\/|\?|#|$)/
const SCRIPT = '<script src="https://telegram.org/js/telegram-web-app.js" defer></script>'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    if (APP_PAGE.test(event.path)) html.head.unshift(SCRIPT)
  })
})
