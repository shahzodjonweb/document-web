import { LOCALES, localized, sitemapPaths } from '../../content/site/routes'

// Every indexable page in every language, each naming its other two.
export default defineEventHandler((event) => {
  const { origin } = siteSettings()
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const urls = sitemapPaths().flatMap((path) =>
    LOCALES.map((locale) => {
      const alternates = [
        ...LOCALES.map(
          (other) =>
            `<xhtml:link rel="alternate" hreflang="${other}" href="${escape(origin + localized(other, path))}"/>`,
        ),
        `<xhtml:link rel="alternate" hreflang="x-default" href="${escape(path === '/' ? `${origin}/` : origin + localized('en', path))}"/>`,
      ]
      return `<url><loc>${escape(origin + localized(locale, path))}</loc>${alternates.join('')}</url>`
    }),
  )
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
})
