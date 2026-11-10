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

const apiOrigin = process.env.API_ORIGIN || 'http://127.0.0.1:8000'
const locales = ['en', 'uz', 'ru']
// The signed-in app and its sign-in hand-off render in the browser only, as
// they always have: they read the device, Telegram and the session from the
// first line. Every other page is rendered on the server, so search engines and
// link previews get the page itself. Nitro takes `**` only at the end of a rule.
const browserOnly = Object.fromEntries(
  locales.flatMap((locale) =>
    [`/${locale}/app`, `/${locale}/app/**`, `/${locale}/auth/**`].map((rule) => [rule, { ssr: false }]),
  ),
)
// Before the first paint, so a dark-theme visitor never sees a server-rendered
// page flash white. The app frame applies the same choice again once it mounts.
const themeBeforePaint =
  "try{var s=localStorage.getItem('pdf-master-theme');if(s==='dark'||(s==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.dataset.theme='dark'}catch(e){}"

export default defineNuxtConfig({
  compatibilityDate: '2026-02-01',
  devtools: { enabled: false },
  ssr: true,
  // Tokens first, so every sheet reads the palette; the shared components and
  // the app frame last, so they are the canonical look of a button, a card, a
  // field and the menus around every screen.
  css: [
    '~/assets/css/tokens.css',
    '~/assets/css/fonts.css',
    '~/assets/css/main.css',
    '~/assets/css/extended.css',
    '~/assets/css/brand.css',
    '~/assets/css/components.css',
    '~/assets/css/screens.css',
    '~/assets/css/frame.css',
    // The public site last: its classes and tokens are its own (site-, --site-).
    '~/assets/css/site.css',
    '~/assets/css/site-tools.css',
    '~/assets/css/site-ai.css',
    '~/assets/css/site-info.css',
  ],
  // `apiOrigin` is where the server reads the public plans, catalog and contacts
  // for a server-rendered page; NUXT_API_ORIGIN overrides it at run time. The
  // `/api/**` proxy below is fixed at build time.
  runtimeConfig: {
    apiOrigin,
    public: {
      productName: 'DocMaster',
      // The address pages call canonical; NUXT_PUBLIC_SITE_ORIGIN sets it in production.
      siteOrigin: 'https://pdfmaster.orderdesk.live',
      // Until launch every page says noindex and robots.txt keeps crawlers out.
      siteIndexable: false,
    },
  },
  nitro: {
    routeRules: { '/api/**': { proxy: `${apiOrigin}/api/**` }, ...browserOnly },
    publicAssets: [...pdfjsAssets('cmaps'), ...pdfjsAssets('standard_fonts'), ...pdfjsAssets('wasm')],
  },
  app: {
    head: {
      // Telegram's script is added only to the app's pages, by server/plugins/telegram-script.ts.
      script: [{ innerHTML: themeBeforePaint }],
      title: 'DocMaster — PDF tools and AI documents',
      meta: [
        {
          name: 'description',
          content:
            'PDF tools and AI documents in Uzbek, Russian and English: merge, compress and convert files, or describe what you need and get a finished PDF or slide deck.',
        },
        { name: 'theme-color', content: '#f5f7fa' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg?v=docmaster-2026' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/brand/docmaster-icon-32.png' },
        { rel: 'icon', type: 'image/png', sizes: '64x64', href: '/brand/docmaster-icon-64.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/brand/docmaster-icon-180.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
  },
  typescript: { strict: true },
})
