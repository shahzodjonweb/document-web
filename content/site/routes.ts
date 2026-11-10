import { tools, type SiteTool } from './tools'

/**
 * Every public page, by its path after the locale: the SEO entry it takes
 * (content/site/seo.ts), the name it has in a breadcrumb, the pages above it,
 * and whether search engines may list it. The 404 check
 * (app/middleware/locale.global.ts), the page head (useSiteSeo), the visible
 * breadcrumb and the sitemap all read this one list.
 */
export const LOCALES = ['en', 'uz', 'ru'] as const
export type SiteLocale = (typeof LOCALES)[number]

export type SitePage = {
  /** Key into `pageSeo`. */
  seo: string
  /** Translation key of its name in a breadcrumb. */
  crumb: string
  /** Shown to search engines and listed in the sitemap. */
  indexable: boolean
  /** The pages above it, as paths after the locale. */
  parents: string[]
  /** For a tool page, the tool. */
  tool?: SiteTool
}

const page = (seo: string, crumb: string, parents: string[] = ['/'], indexable = true): SitePage => ({
  seo,
  crumb,
  parents,
  indexable,
})

const PAGES: Record<string, SitePage> = {
  '/': page('home', 'siteCrumbHome', []),
  '/tools': page('tools-index', 'siteCrumbTools'),
  '/pdf-editor': page('pdf-editor', 'siteCrumbEditor'),
  '/ai': page('ai-hub', 'siteCrumbAi'),
  '/ai/documents': page('ai-documents', 'siteAiCardDocsTitle', ['/', '/ai']),
  '/ai/referat': page('ai-referat', 'siteCrumbReferat', ['/', '/ai']),
  '/ai/slides': page('ai-slides', 'siteAiCardSlidesTitle', ['/', '/ai']),
  '/ai/cv': page('ai-cv', 'siteAiCardCvTitle', ['/', '/ai']),
  '/guide': page('guide', 'siteCrumbGuide', ['/', '/ai']),
  '/pricing': page('pricing', 'siteCrumbPricing'),
  '/telegram': page('telegram', 'siteCrumbTelegram'),
  '/invite': page('invite', 'siteCrumbInvite'),
  '/help': page('help', 'siteCrumbHelp'),
  '/about': page('about', 'siteCrumbAbout'),
  // The legal texts are drafts until the owner and a lawyer sign them off.
  '/legal/privacy': page('legal-privacy', 'siteLegalPrivacyTitle', ['/'], false),
  '/legal/terms': page('legal-offer', 'siteLegalOfferTitle', ['/'], false),
}
for (const tool of tools)
  PAGES[`/tools/${tool.slug}`] = { ...page(tool.slug, `${tool.copyKeyPrefix}Name`, ['/', '/tools']), tool }

export function sitePage(view: string): SitePage | null {
  return PAGES[view.replace(/\/$/, '') || '/'] ?? null
}

/** The tool page a catalog feature has, by its id: `pdf.merge` → `merge-pdf`. */
export const toolSlug = (id: string) => tools.find((tool) => tool.id === id)?.slug

/**
 * Addresses that moved, after the locale, and where they went: the first tool
 * pages were named by feature id, and contacts live on the about page.
 */
export function movedTo(view: string): string | null {
  const path = view.replace(/\/$/, '')
  if (path.startsWith('/tools/')) {
    const slug = toolSlug(decodeURIComponent(path.slice('/tools/'.length)))
    return slug ? `/tools/${slug}` : null
  }
  if (path === '/contacts') return '/about'
  if (path === '/legal/cookies') return '/legal/privacy'
  return null
}

/** Every indexable public path, after the locale, for the sitemap. */
export const sitemapPaths = () => Object.keys(PAGES).filter((path) => PAGES[path]!.indexable)

/** The address of a page in a locale: `/en`, `/uz/pricing`. */
export const localized = (locale: string, path: string) => `/${locale}${path === '/' ? '' : path}`
