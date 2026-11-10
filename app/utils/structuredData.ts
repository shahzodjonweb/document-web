/**
 * schema.org JSON-LD for the public pages, after docs/site/seo/structured-data.md:
 * Organization and WebSite on the home page, the app with its plans' offers on
 * the home and pricing pages, and breadcrumbs everywhere below the home page.
 * Only what the page itself shows: no ratings, no placeholder contacts, and the
 * regular price (a discount is a visible banner, not markup).
 */
export type Crumb = { name: string; url: string }
export type LdOffer = { name: string; price: number; url: string }
export type LdCompany = { name: string; tin: string; address: string; phone: string; email: string }

export type LdInput = {
  origin: string
  locale: string
  brand: string
  url: string
  name: string
  description: string
  home: boolean
  crumbs: Crumb[]
  offers: LdOffer[]
  company: LdCompany | null
}

export function structuredData(input: LdInput) {
  const { origin, locale, brand } = input
  const organization = `${origin}/#organization`
  const graph: Record<string, unknown>[] = []
  if (input.home) {
    const company = input.company
    graph.push({
      '@type': 'Organization',
      '@id': organization,
      name: brand,
      url: `${origin}/`,
      logo: `${origin}/brand/docmaster-icon-512.png`,
      ...(company?.name ? { legalName: company.name } : {}),
      ...(company?.tin ? { taxID: company.tin } : {}),
      ...(company?.address
        ? { address: { '@type': 'PostalAddress', streetAddress: company.address, addressCountry: 'UZ' } }
        : {}),
      ...(company?.email ? { email: company.email } : {}),
      ...(company?.phone ? { telephone: company.phone } : {}),
    })
    graph.push({
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      name: brand,
      url: `${origin}/`,
      inLanguage: ['en', 'uz', 'ru'],
      publisher: { '@id': organization },
    })
  } else {
    graph.push({
      '@type': 'WebPage',
      '@id': `${input.url}#webpage`,
      url: input.url,
      name: input.name,
      description: input.description,
      inLanguage: locale,
      isPartOf: { '@id': `${origin}/#website` },
    })
  }
  if (input.offers.length)
    graph.push({
      '@type': 'WebApplication',
      '@id': `${origin}/#app`,
      name: brand,
      url: `${origin}/${locale}`,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Telegram',
      inLanguage: ['en', 'uz', 'ru'],
      publisher: { '@id': organization },
      offers: input.offers.map((offer) => ({
        '@type': 'Offer',
        name: offer.name,
        price: offer.price,
        priceCurrency: 'UZS',
        url: offer.url,
      })),
    })
  if (input.crumbs.length > 1)
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: input.crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    })
  // `</script>` inside a string must not end the tag.
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')
}
