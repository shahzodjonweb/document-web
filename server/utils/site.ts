/** The site's address and whether search engines are welcome yet, as the page head reads them. */
export function siteSettings() {
  const config = useRuntimeConfig().public
  return {
    origin: String(config.siteOrigin).replace(/\/$/, ''),
    indexable: ['1', 'true', 1, true].includes(config.siteIndexable as never),
    brand: String(config.productName),
  }
}
