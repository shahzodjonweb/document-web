import { tools } from './tools'

/**
 * The public pages that exist today, by the path after the locale, and the SEO
 * entry (content/site/seo.ts) each one takes. The sitemap lists the indexable
 * ones; the page head reads the rest. New pages are added here and to the 404
 * list in app/middleware/locale.global.ts.
 */
export const LOCALES = ['en', 'uz', 'ru'] as const
export type SiteLocale = (typeof LOCALES)[number]

export type SitePage = {
  /** Key into `pageSeo`. */
  seo: string
  /** Shown to search engines and listed in the sitemap. */
  indexable: boolean
  /** The pages above it, as breadcrumb paths after the locale. */
  parents: string[]
  /** For a tool page, the catalog feature it shows. */
  tool?: string
}

/** Tool pages today live at /tools/{feature id}; the readable slugs come with the new pages. */
const toolPages = tools.filter((tool) => !tool.id.startsWith('editor.'))

export function sitePage(view: string): SitePage | null {
  const path = view.replace(/\/$/, '') || '/'
  if (path === '/') return { seo: 'home', indexable: true, parents: [] }
  if (path === '/tools') return { seo: 'tools-index', indexable: true, parents: ['/'] }
  if (path.startsWith('/tools/')) {
    const id = decodeURIComponent(path.slice('/tools/'.length))
    const tool = toolPages.find((item) => item.id === id)
    return tool
      ? { seo: tool.slug, indexable: true, parents: ['/', '/tools'], tool: tool.id }
      : { seo: 'tools-index', indexable: false, parents: ['/', '/tools'], tool: id }
  }
  if (path === '/pricing') return { seo: 'pricing', indexable: true, parents: ['/'] }
  if (path === '/help') return { seo: 'help', indexable: true, parents: ['/'] }
  if (path.startsWith('/help/')) return { seo: 'help', indexable: false, parents: ['/', '/help'] }
  if (path === '/guide') return { seo: 'guide', indexable: true, parents: ['/'] }
  // The legal texts are drafts until the owner and a lawyer sign them off.
  if (path === '/legal/privacy') return { seo: 'legal-privacy', indexable: false, parents: ['/'] }
  if (path === '/legal/terms') return { seo: 'legal-offer', indexable: false, parents: ['/'] }
  return null
}

/** Every indexable public path, after the locale, for the sitemap. */
export function sitemapPaths(): string[] {
  const paths = ['/', '/tools', ...toolPages.map((tool) => `/tools/${tool.id}`), '/pricing', '/help', '/guide']
  return paths.filter((path) => sitePage(path)?.indexable)
}

/** The address of a page in a locale: `/en`, `/uz/pricing`. */
export const localized = (locale: string, path: string) => `/${locale}${path === '/' ? '' : path}`
