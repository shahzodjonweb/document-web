import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// pdf.js fetches character maps, standard fonts and its wasm decoders at
// runtime. They are served from our own origin so no document characteristic
// ever reaches a CDN. The guard keeps a future pdfjs layout change from
// failing `nuxt build`: the page still renders, non-embedded fonts substitute.
const here = dirname(fileURLToPath(import.meta.url))
const pdfjsAssets = (name: string) => {
  const dir = resolve(here, 'node_modules/pdfjs-dist', name)
  return existsSync(dir) ? [{ baseURL: `pdfjs/${name}`, dir, maxAge: 60 * 60 * 24 * 365 }] : []
}

export default defineNuxtConfig({
  compatibilityDate: '2026-02-01',
  devtools: { enabled: false },
  ssr: false,
  // Tokens first, so every sheet reads the palette; the shared components
  // last, so they are the canonical look of a button, card or field.
  css: [
    '~/assets/css/tokens.css',
    '~/assets/css/fonts.css',
    '~/assets/css/main.css',
    '~/assets/css/extended.css',
    '~/assets/css/brand.css',
    '~/assets/css/components.css',
  ],
  runtimeConfig: { public: { productName: 'PDF Master' } },
  nitro: {
    routeRules: { '/api/**': { proxy: `${process.env.API_ORIGIN || 'http://127.0.0.1:8000'}/api/**` } },
    publicAssets: [...pdfjsAssets('cmaps'), ...pdfjsAssets('standard_fonts'), ...pdfjsAssets('wasm')],
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
