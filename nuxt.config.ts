import process from 'node:process'
export default defineNuxtConfig({
  compatibilityDate: '2026-02-01',
  devtools: { enabled: false },
  ssr: false,
  css: [
    '~/assets/css/fonts.css',
    '~/assets/css/main.css',
    '~/assets/css/extended.css',
    '~/assets/css/brand.css',
  ],
  runtimeConfig: { public: { productName: 'PDF Master' } },
  nitro: {
    routeRules: { '/api/**': { proxy: `${process.env.API_ORIGIN || 'http://127.0.0.1:8000'}/api/**` } },
  },
  app: {
    head: {
      script: [{ src: 'https://telegram.org/js/telegram-web-app.js', defer: true }],
      title: 'PDF Master — a little less paperwork',
      meta: [
        {
          name: 'description',
          content:
            'A calm workspace for your PDFs. Merge, compress, organize and convert documents with transparent usage.',
        },
        { name: 'theme-color', content: '#F4F7FC' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg?v=pdf-master-2026' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/brand/pdf-master-icon-32.png' },
        { rel: 'icon', type: 'image/png', sizes: '64x64', href: '/brand/pdf-master-icon-64.png' },
        { rel: 'apple-touch-icon', sizes: '256x256', href: '/brand/pdf-master-icon-256.png' },
      ],
    },
  },
  typescript: { strict: true },
})
