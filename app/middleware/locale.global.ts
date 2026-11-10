import { movedTo, sitePage } from '../../content/site/routes'

const LOCALES = ['en', 'uz', 'ru'] as const
/**
 * The app's own pages under `/app`, and the sign-in hand-off, decide for
 * themselves; every public page is in content/site/routes.ts. Anything else is
 * a real 404, which search engines need.
 */
const APP = /^\/(app(\/.*)?|auth\/telegram)\/?$/

/** The first of our languages the visitor's browser asks for, else English. */
function preferred(header: string): string {
  const asked = header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().toLowerCase().split(';')
      const q = Number(params.find((param) => param.trim().startsWith('q='))?.split('=')[1] ?? 1)
      return { language: tag.split('-')[0], q: Number.isFinite(q) ? q : 0, index }
    })
    .filter((item) => item.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
  return asked.find((item) => (LOCALES as readonly string[]).includes(item.language!))?.language || 'en'
}

export default defineNuxtRouteMiddleware((to) => {
  const match = to.path.match(/^\/(en|uz|ru)(?=\/|$)/)
  if (!match) {
    // The bare address picks the visitor's language; it may differ next time, so it is not permanent.
    if (to.path === '/') {
      const header = import.meta.server
        ? useRequestHeaders(['accept-language'])['accept-language'] || ''
        : navigator.languages.join(',')
      return navigateTo(`/${preferred(header)}`, { replace: true, redirectCode: 302 })
    }
    return navigateTo(`/en${to.fullPath}`, { replace: true, redirectCode: 301 })
  }
  const view = to.path.slice(match[0].length) || '/'
  const moved = movedTo(view)
  if (moved) return navigateTo(`${match[0]}${moved}`, { replace: true, redirectCode: 301 })
  // On the server any error renders the error page; "fatal" would only add a stack
  // trace to the log for every crawler's guess. In the browser it is what shows the page.
  if (!APP.test(view) && !sitePage(view))
    return abortNavigation(
      createError({ statusCode: 404, statusMessage: 'Page not found', fatal: import.meta.client }),
    )
})
