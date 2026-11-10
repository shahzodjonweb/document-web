import { pageSeo, type SeoText } from '../../content/site/seo'
import { LOCALES, localized } from '../../content/site/routes'

const OG_LOCALE: Record<string, string> = { en: 'en_US', uz: 'uz_UZ', ru: 'ru_RU' }

/**
 * The head of a public page: title, description, canonical, its three
 * languages, the link preview and its structured data, from
 * content/site/seo.ts and content/site/routes.ts. The app's own pages and any
 * address that is not a public page say `noindex` and nothing else.
 */
export function useSiteSeo() {
  const { t, locale } = useLocale()
  const ws = useWorkspace()
  const { regular } = usePricing()
  const { contacts } = contactsState()
  const { view, page, crumbs } = useSitePage()
  const config = useRuntimeConfig().public
  const brand = String(config.productName)
  const origin = String(config.siteOrigin).replace(/\/$/, '')
  const indexable = ['1', 'true', 1, true].includes(config.siteIndexable as never)

  const at = (l: string, path = view.value) => origin + localized(l, path)
  const text = (value: SeoText | undefined) =>
    (value?.[LOCALES.indexOf(locale.value)] || value?.[0] || '').replaceAll('{brand}', brand)

  useHead(() => {
    const current = page.value
    const seo = current ? pageSeo[current.seo] : undefined
    if (!current || !seo) return { meta: [{ key: 'robots', name: 'robots', content: 'noindex' }] }
    const url = at(locale.value)
    const title = text(seo.title)
    const description = text(seo.description)
    const image = `${origin}/og/docmaster-${locale.value}.png`
    const offers =
      current.seo === 'home' || current.seo === 'pricing'
        ? ws.plans.value
            .filter((plan: any) => ['free', 'plus', 'premium'].includes(plan.id))
            .map((plan: any) => ({ name: t(plan.id), price: regular(plan), url: at(locale.value, '/pricing') }))
        : []
    return {
      title,
      link: [
        { key: 'canonical', rel: 'canonical', href: url },
        ...LOCALES.map((l) => ({ key: `alt-${l}`, rel: 'alternate' as const, hreflang: l, href: at(l) })),
        // The bare address sends each visitor to their language; elsewhere English stands in.
        {
          key: 'alt-default',
          rel: 'alternate',
          hreflang: 'x-default',
          href: view.value === '/' ? `${origin}/` : at('en'),
        },
      ],
      meta: [
        { key: 'description', name: 'description', content: description },
        {
          key: 'robots',
          name: 'robots',
          content: indexable && current.indexable && !seo.noindex ? 'index, follow' : 'noindex, follow',
        },
        { key: 'og:type', property: 'og:type', content: 'website' },
        { key: 'og:site_name', property: 'og:site_name', content: brand },
        { key: 'og:title', property: 'og:title', content: text(seo.ogTitle) || title },
        { key: 'og:description', property: 'og:description', content: description },
        { key: 'og:url', property: 'og:url', content: url },
        { key: 'og:locale', property: 'og:locale', content: OG_LOCALE[locale.value] },
        ...LOCALES.filter((l) => l !== locale.value).map((l) => ({
          key: `og:locale:alternate:${l}`,
          property: 'og:locale:alternate',
          content: OG_LOCALE[l],
        })),
        { key: 'og:image', property: 'og:image', content: image },
        { key: 'og:image:width', property: 'og:image:width', content: '1200' },
        { key: 'og:image:height', property: 'og:image:height', content: '630' },
        { key: 'twitter:card', name: 'twitter:card', content: 'summary_large_image' },
      ],
      script: [
        {
          key: 'ld-json',
          type: 'application/ld+json',
          innerHTML: structuredData({
            origin,
            locale: locale.value,
            brand,
            url,
            name: title,
            description,
            home: current.seo === 'home',
            crumbs: crumbs.value.map((crumb) => ({ name: crumb.name, url: origin + crumb.path })),
            offers,
            company: contacts.value?.company ?? null,
          }),
        },
      ],
    }
  })
}
