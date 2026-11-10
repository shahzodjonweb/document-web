// Until launch nothing is crawled; after it, everything but the app, the
// sign-in hand-off and the APIs, which are for people and the app itself.
export default defineEventHandler((event) => {
  const { origin, indexable } = siteSettings()
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  if (!indexable) return 'User-agent: *\nDisallow: /\n'
  return [
    'User-agent: *',
    'Disallow: /*/app',
    'Disallow: /*/auth',
    'Disallow: /api/',
    'Disallow: /_site/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
})
