<script setup lang="ts">
// One tool page (docs/site/design/pages/tool.md, mockups/tool.html): hero with the
// "drop zone" that opens the app, how-to, details with a per-tool vignette, limits
// (file tools) or the editor's other abilities (sign / fill form), privacy, FAQ, related.
definePageMeta({ layout: 'site' })
const route = useRoute()
const { t, st, path, tool: findTool, toolName, toolPage, start, faq } = useSite()
const ws = useWorkspace()
const { figure } = usePricing()

const slug = computed(() => String(route.params.slug || ''))
const found = findTool(slug.value)
if (!found) throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: import.meta.client })
// A tool the live catalog no longer offers has no page (design: 404, not "coming soon").
// An empty catalog means the API did not answer; then the owner-verified list stands.
if (ws.features.value.length && !ws.features.value.some((feature) => feature.id === found.id))
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: import.meta.client })

const tool = computed(() => findTool(slug.value) ?? found)
const k = (suffix: string) => `${tool.value.copyKeyPrefix}${suffix}`
const editorBacked = computed(() => tool.value.category === 'edit')

/** In the bot: owner-verified, and not withdrawn by the live catalog when it says. */
const inBot = computed(() => {
  if (!(tool.value.channels as readonly string[]).includes('bot')) return false
  const live = ws.features.value.find((feature) => feature.id === tool.value.id) as { channels?: string[] } | undefined
  return !live?.channels || live.channels.includes('bot')
})

const chips = computed(() => [1, 2, 3].map((n) => t(k(`Chip${n}`))))

const freeTasks = computed(() => {
  const free = ws.plans.value.find((plan: any) => plan.id === 'free') as any
  const value = free?.limits?.weekly_file_jobs
  return typeof value === 'number' ? figure(value) : ''
})

const PAGE_LINKS: Record<string, { to: string; name: string; icon: string }> = {
  'pdf-editor': { to: '/pdf-editor', name: 'siteCrumbEditor', icon: 'edit' },
  'ai-slides': { to: '/ai/slides', name: 'siteAiCardSlidesTitle', icon: 'slides' },
  'ai-documents': { to: '/ai/documents', name: 'siteAiCardDocsTitle', icon: 'file' },
  telegram: { to: '/telegram', name: 'siteCrumbTelegram', icon: 'send' },
}
const related = computed(() =>
  tool.value.related.slice(0, 4).flatMap((id) => {
    const other = findTool(id)
    if (other) return [{ id, to: toolPage(id), name: toolName(other), icon: other.icon }]
    const page = PAGE_LINKS[id]
    return page ? [{ id, to: path(page.to), name: t(page.name), icon: page.icon }] : []
  }),
)

const caps = [
  ['EditText', 'type'],
  ['AddText', 'edit'],
  ['Highlight', 'highlighter'],
  ['Forms', 'form'],
  ['Signature', 'signature'],
  ['Images', 'image'],
  ['Redact', 'redact'],
  ['Annotate', 'sticky'],
] as const

/** The details vignette: built from file rows and page strips, never screenshots. */
const pic = computed(() => {
  switch (slug.value) {
    case 'merge-pdf':
      return 'merge'
    case 'split-pdf':
      return 'split'
    case 'compress-pdf':
      return 'compress'
    case 'extract-pdf-pages':
    case 'delete-pdf-pages':
    case 'reorder-pdf-pages':
    case 'rotate-pdf':
      return 'pages'
    case 'ocr-pdf':
    case 'searchable-pdf':
      return 'ocr'
    case 'protect-pdf':
    case 'unlock-pdf':
      return 'lock'
    case 'sign-pdf':
    case 'fill-pdf-form':
      return 'editor'
    default:
      return 'convert'
  }
})
const CONVERT: Record<string, [string, string]> = {
  'jpg-to-pdf': ['jpg', 'pdf'],
  'word-to-pdf': ['docx', 'pdf'],
  'powerpoint-to-pdf': ['pptx', 'pdf'],
  'pdf-to-jpg': ['pdf', 'jpg'],
  'pdf-to-word': ['pdf', 'docx'],
  'pdf-to-excel': ['pdf', 'xlsx'],
}
const base = computed(() => t('siteHomeVignetteFile1').replace(/\.pdf$/, ''))
const convert = computed(() => CONVERT[slug.value] ?? ['pdf', 'pdf'])
/** Which of five page thumbnails the page tool touches, and how. */
const strip = computed(() => {
  const n = [1, 2, 3, 4, 5]
  switch (slug.value) {
    case 'extract-pdf-pages':
      return n.map((page) => ({ label: page, on: page === 1 || page === 3 || page === 4, mark: '' }))
    case 'delete-pdf-pages':
      return n.map((page) => ({ label: page, on: page === 2 || page === 5, mark: 'x' }))
    case 'reorder-pdf-pages':
      return [1, 4, 2, 3, 5].map((page, index) => ({ label: page, on: index === 1, mark: '' }))
    default:
      return n.map((page) => ({ label: page, on: page === 2 || page === 3, mark: 'rotate' }))
  }
})

// HowTo and FAQPage for search engines: the same steps and answers as on the page.
const config = useRuntimeConfig().public
const origin = String(config.siteOrigin).replace(/\/$/, '')
useHead(() => {
  const questions = faq(slug.value)
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'HowTo',
      name: st(k('HowToTitle')),
      step: [1, 2, 3].map((n) => ({
        '@type': 'HowToStep',
        position: n,
        name: st(k(`Step${n}Title`)),
        text: st(k(`Step${n}Text`)),
      })),
    },
  ]
  if (questions.length)
    graph.push({
      '@type': 'FAQPage',
      mainEntity: questions.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    })
  return {
    script: [
      {
        key: 'ld-tool',
        type: 'application/ld+json',
        innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph, url: origin + route.path }),
      },
    ],
  }
})
</script>
<template>
  <div class="site-tool">
    <SiteBreadcrumb />
    <section class="site-toolhero">
      <div class="site-container site-toolhero-grid">
        <div class="site-toolhero-copy">
          <span class="site-tool-ico" aria-hidden="true"><AppIcon :name="tool.icon" class="site-icon" /></span>
          <h1 class="site-h1">{{ st(k('H1')) }}</h1>
          <p class="site-lead">{{ st(k('Lead')) }}</p>
          <ul class="site-hero-note site-tool-chips">
            <li v-for="chip in chips" :key="chip" class="site-chip"><AppIcon name="check" class="site-icon" />{{ chip }}</li>
            <li v-if="inBot" class="site-chip"><AppIcon name="send" class="site-icon" />{{ t('siteToolChipBot') }}</li>
          </ul>
        </div>
        <div class="site-drop">
          <span class="site-drop-ico" aria-hidden="true"><AppIcon :name="editorBacked ? 'edit' : 'upload'" class="site-icon" /></span>
          <h2 class="site-h3">{{ st(k('DropTitle')) }}</h2>
          <NuxtLink class="site-btn is-primary is-lg" :to="start(tool.id)">{{ st(k('DropButton')) }}</NuxtLink>
          <p>{{ st(k('DropNote')) }}</p>
        </div>
      </div>
    </section>

    <section class="site-section is-band" aria-labelledby="tool-how">
      <div class="site-container">
        <SiteSectionHead id="tool-how" :title="st(k('HowToTitle'))" />
        <ol class="site-steps">
          <li v-for="n in 3" :key="n">
            <h3 class="site-h3">{{ st(k(`Step${n}Title`)) }}</h3>
            <p>{{ st(k(`Step${n}Text`)) }}</p>
          </li>
        </ol>
      </div>
    </section>

    <section class="site-section" aria-labelledby="tool-details">
      <div class="site-container site-split">
        <div class="site-split-copy">
          <h2 id="tool-details" class="site-h2">{{ st(k('DetailsTitle')) }}</h2>
          <p class="site-lead">{{ st(k('DetailsBody')) }}</p>
          <ul class="site-tool-tips">
            <li v-for="n in 2" :key="n"><AppIcon name="info" class="site-icon" />{{ st(k(`Tip${n}`)) }}</li>
          </ul>
        </div>

        <div class="site-panel site-tool-pic" aria-hidden="true">
          <div v-if="pic === 'merge'" class="site-merge-pic">
            <div class="site-stack">
              <div v-for="n in 3" :key="n" class="site-filerow">
                <AppIcon name="file" class="site-icon" /><span>{{ t(`siteHomeVignetteFile${n}`) }}</span>
              </div>
            </div>
            <AppIcon name="right" class="site-icon" />
            <div class="site-filerow site-tool-result"><AppIcon name="file" class="site-icon" /><span>{{ t('siteHomeVignetteResult') }}</span></div>
          </div>

          <div v-else-if="pic === 'split'" class="site-merge-pic">
            <div class="site-filerow"><AppIcon name="file" class="site-icon" /><span>{{ t('siteHomeVignetteResult') }}</span></div>
            <AppIcon name="right" class="site-icon" />
            <div class="site-stack">
              <div v-for="n in 3" :key="n" class="site-filerow site-tool-result">
                <AppIcon name="file" class="site-icon" /><span>{{ base }}-{{ n }}.pdf</span>
              </div>
            </div>
          </div>

          <div v-else-if="pic === 'compress'" class="site-tool-sizes">
            <div class="site-filerow">
              <AppIcon name="file" class="site-icon" /><span>{{ t('siteHomeVignetteFile3') }}</span>
              <i class="site-tool-bar" style="--site-tool-bar: 100%"></i>
            </div>
            <AppIcon name="compress" class="site-icon" />
            <div class="site-filerow site-tool-result">
              <AppIcon name="file" class="site-icon" /><span>{{ t('siteHomeVignetteFile3') }}</span>
              <i class="site-tool-bar" style="--site-tool-bar: 28%"></i>
            </div>
          </div>

          <div v-else-if="pic === 'convert'" class="site-tool-convert">
            <template v-for="(ext, index) in convert" :key="index">
              <AppIcon v-if="index" name="right" class="site-icon" />
              <div class="site-tool-doc" :class="{ 'is-out': index === 1 }">
                <span v-if="ext === 'jpg'" class="site-tool-docpage is-jpg"><span><i></i><i></i><i></i><i></i></span></span>
                <span v-else-if="ext === 'pptx'" class="site-tool-docpage is-pptx"><i></i><i></i><i></i></span>
                <span v-else-if="ext === 'xlsx'" class="site-tool-docpage is-xlsx site-sheet"><i v-for="n in 24" :key="n"></i></span>
                <span v-else class="site-tool-docpage site-sheet"><i v-for="n in 6" :key="n"></i></span>
                <span class="site-tool-file"><b :class="`is-${ext}`">{{ ext }}</b>{{ base }}.{{ ext }}</span>
              </div>
            </template>
          </div>

          <ol v-else-if="pic === 'pages'" class="site-tool-strip">
            <li v-for="(page, index) in strip" :key="index" :class="{ 'is-on': page.on, 'is-cut': page.on && page.mark === 'x' }">
              <span class="site-tool-thumb" :class="{ 'is-turned': page.on && page.mark === 'rotate' }">
                <i></i><i></i><i></i><i></i>
              </span>
              <small>{{ page.label }}</small>
              <span v-if="page.on && page.mark === 'x'" class="site-tool-badge"><AppIcon name="x" class="site-icon is-sm" /></span>
              <span v-else-if="page.on && page.mark === 'rotate'" class="site-tool-badge"><AppIcon name="rotate" class="site-icon is-sm" /></span>
            </li>
          </ol>

          <div v-else-if="pic === 'ocr'" class="site-tool-scan">
            <div class="site-sheet site-tool-scanpage">
              <p class="site-tool-scantitle"><span>{{ t('siteHomeVignetteDocTitle') }}</span></p>
              <div class="site-doc-line"></div>
              <div class="site-doc-line is-s"></div>
              <div class="site-doc-line"></div>
              <div class="site-doc-line"></div>
              <div class="site-doc-line is-s"></div>
            </div>
          </div>

          <div v-else-if="pic === 'lock'" class="site-tool-sizes">
            <div class="site-filerow">
              <AppIcon name="file" class="site-icon" /><span>{{ t('siteHomeVignetteResult') }}</span>
              <span class="site-tool-badge is-inline"><AppIcon :name="slug === 'protect-pdf' ? 'unlock' : 'lock'" class="site-icon is-sm" /></span>
            </div>
            <AppIcon name="down" class="site-icon" />
            <div class="site-filerow site-tool-result">
              <AppIcon name="file" class="site-icon" /><span>{{ t('siteHomeVignetteResult') }}</span>
              <span class="site-tool-badge is-inline is-strong"><AppIcon :name="slug === 'protect-pdf' ? 'lock' : 'unlock'" class="site-icon is-sm" /></span>
            </div>
          </div>

          <div v-else class="site-editor-canvas site-tool-editorpic">
            <div class="site-editor-page site-sheet">
              <p><strong>{{ t('siteHomeVignetteDocTitle') }}</strong></p>
              <div class="site-doc-line"></div>
              <div class="site-doc-line is-s"></div>
              <template v-if="slug === 'fill-pdf-form'">
                <div v-for="n in 3" :key="n" class="site-tool-field" :class="{ 'is-on': n === 1 }">
                  <span></span><b><i v-if="n === 1"></i></b>
                </div>
                <div class="site-tool-check"><b><AppIcon name="check" class="site-icon" /></b><span></span></div>
              </template>
              <div v-else class="site-doc-line"></div>
              <div v-if="slug === 'sign-pdf'" class="site-editor-sign">
                <span></span
                ><svg viewBox="0 0 120 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M6 28c8-14 14-20 18-16s-6 18 0 16 10-18 16-14-4 14 2 12 8-10 14-8 4 8 10 6 10-6 16-4 10 2 20 0" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="!editorBacked" class="site-section is-band" aria-labelledby="tool-limits">
      <div class="site-container">
        <SiteSectionHead
          id="tool-limits"
          :title="t('siteToolLimitsTitle')"
          :intro="st(k('LimitNote'))"
          :to="path('/pricing')"
          :link="t('siteLinkComparePlans')"
        />
        <dl class="site-kv">
          <div>
            <dt>{{ t('siteToolLimitsWebLabel') }}</dt>
            <dd>{{ t('siteToolLimitsWebValue') }}<small>{{ t('siteToolLimitsWebNote') }}</small></dd>
          </div>
          <div>
            <dt>{{ t('siteToolLimitsBotLabel') }}</dt>
            <dd v-if="inBot">{{ t('siteToolLimitsBotValue') }}<small>{{ t('siteToolLimitsBotNote') }}</small></dd>
            <dd v-else>{{ t('siteToolsWebOnlyLabel') }}<small>{{ t('siteToolLimitsBotWebOnly') }}</small></dd>
          </div>
          <div v-if="freeTasks">
            <dt>{{ t('siteToolLimitsPlanLabel') }}</dt>
            <dd>{{ t('siteToolLimitsPlanValue', { count: freeTasks }) }}<small>{{ t('siteToolLimitsPlanNote') }}</small></dd>
          </div>
        </dl>
      </div>
    </section>

    <section v-else class="site-section is-band" aria-labelledby="tool-editor-more">
      <div class="site-container site-split">
        <div class="site-split-copy">
          <h2 id="tool-editor-more" class="site-h2">{{ st(k('EditorMoreTitle')) }}</h2>
          <p class="site-lead">{{ st(k('EditorMoreBody')) }}</p>
          <NuxtLink class="site-btn is-secondary" :to="path('/pdf-editor')">{{ t('siteToolEditorMoreLink') }}</NuxtLink>
        </div>
        <ul class="site-caps site-tool-caps">
          <li v-for="[key, icon] in caps" :key="key"><AppIcon :name="icon" class="site-icon" />{{ t(`siteEditorCap${key}Title`) }}</li>
        </ul>
      </div>
    </section>

    <div class="site-section is-tight">
      <div class="site-container">
        <div class="site-note">
          <AppIcon name="shield" class="site-icon" />
          <p>
            {{ t('siteToolPrivacyNote') }}
            <NuxtLink class="site-link" :to="path('/legal/privacy')">{{ t('siteToolPrivacyLink') }}</NuxtLink>
          </p>
        </div>
      </div>
    </div>

    <SiteFaq :page="tool.slug" :title="t('siteToolFaqTitle')" :to="path('/help')" :link="t('siteFooterHelpCentre')" open />

    <section v-if="related.length" class="site-section" aria-labelledby="tool-related">
      <div class="site-container">
        <SiteSectionHead id="tool-related" :title="t('siteRelatedTitle')" :to="path('/tools')" :link="t('siteHomeToolsAll')" />
        <div class="site-related">
          <NuxtLink v-for="item in related" :key="item.id" :to="item.to"
            ><span class="site-tool-ico" aria-hidden="true"><AppIcon :name="item.icon" class="site-icon" /></span>{{ item.name }}</NuxtLink
          >
        </div>
      </div>
    </section>
  </div>
</template>
