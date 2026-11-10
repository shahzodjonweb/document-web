// What a phone shows when the site is added to the home screen.
export default defineEventHandler((event) => {
  const { brand } = siteSettings()
  setResponseHeader(event, 'Content-Type', 'application/manifest+json; charset=utf-8')
  return {
    name: brand,
    short_name: brand,
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f7fa',
    theme_color: '#f5f7fa',
    icons: [
      { src: '/brand/docmaster-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/docmaster-icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/brand/docmaster-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
})
