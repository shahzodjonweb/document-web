import process from 'node:process'
export default defineNuxtConfig({
  compatibilityDate: '2026-02-01',
  devtools: { enabled: false },
  ssr: false,
  css: ['~/assets/css/fonts.css', '~/assets/css/main.css', '~/assets/css/extended.css'],
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
        { name: 'theme-color', content: '#F7F8F5' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  typescript: { strict: true },
})
