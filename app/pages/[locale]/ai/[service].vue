<script setup lang="ts">
// One template for the AI services (docs/site/design/pages/ai-service.md,
// mockups/ai-service.html): documents, referat, slides and CV. Each variant
// lists its sections in order; the galleries are drawn in CSS because the
// design and template catalogues need a signed-in visitor.
definePageMeta({ layout: 'site' })
const route = useRoute()
const { t, path, bot, start, locale, tool, toolName, toolPage } = useSite()
const ws = useWorkspace()
const { figure, price } = usePricing()

type Section =
  | 'honest'
  | 'how'
  | 'languages'
  | 'structure'
  | 'mustaqil'
  | 'designs'
  | 'editable'
  | 'modes'
  | 'templates'
  | 'privacy'
  | 'limits'
  | 'guide'
type Related = 'documents' | 'referat' | 'slides' | 'cv' | 'guide' | 'editor' | 'powerpoint-to-pdf'
type RelatedLink = { id: Related; icon: string; name: string; to: string }
type Service = {
  key: 'Docs' | 'Referat' | 'Slides' | 'Cv'
  feature: string
  stage: 'doc' | 'referat' | 'slides' | 'cv'
  icons: [string, string, string]
  sections: Section[]
  related: Related[]
}

const SERVICES: Record<string, Service> = {
  documents: {
    key: 'Docs',
    feature: 'ai.pdf_topic',
    stage: 'doc',
    icons: ['file', 'languages', 'download'],
    sections: ['how', 'languages', 'limits', 'guide'],
    related: ['referat', 'slides', 'cv', 'guide'],
  },
  referat: {
    key: 'Referat',
    feature: 'ai.pdf_topic',
    stage: 'referat',
    icons: ['file', 'check', 'languages'],
    sections: ['honest', 'how', 'structure', 'mustaqil', 'limits'],
    related: ['slides', 'documents', 'editor', 'guide'],
  },
  slides: {
    key: 'Slides',
    feature: 'ai.pptx',
    stage: 'slides',
    icons: ['slides', 'layers', 'edit'],
    sections: ['how', 'designs', 'editable', 'limits'],
    related: ['documents', 'cv', 'powerpoint-to-pdf', 'guide'],
  },
  cv: {
    key: 'Cv',
    feature: 'ai.cv',
    stage: 'cv',
    icons: ['file', 'user', 'languages'],
    sections: ['modes', 'templates', 'how', 'languages', 'privacy'],
    related: ['documents', 'slides', 'editor', 'guide'],
  },
}

const svc = computed(() => SERVICES[String(route.params.service)])
// The middleware already 404s anything else; this keeps the page honest if it ever does not.
if (!svc.value) throw createError({ statusCode: 404, statusMessage: 'Page not found' })
const s = computed(() => svc.value!)
const k = (name: string) => t(`siteAi${s.value.key}${name}`)
const page = computed(() => `ai-${String(route.params.service)}`)
const cta = computed(() => start(s.value.feature))
const sample = computed(() => t(`siteAiSampleHeading${locale.value === 'uz' ? 'Uz' : locale.value === 'ru' ? 'Ru' : 'En'}`))
/** Sections after the hero alternate band and paper, so neighbours never merge. */
const band = (index: number) => s.value.sections[0] !== 'honest' ? index % 2 === 0 : index % 2 === 1

const languages = [
  { code: 'uz', label: 'siteLangUz', heading: 'siteAiSampleHeadingUz' },
  { code: 'ru', label: 'siteLangRu', heading: 'siteAiSampleHeadingRu' },
  { code: 'en', label: 'siteLangEn', heading: 'siteAiSampleHeadingEn' },
]
const referatParts = ['Plan', 'Intro', 'Body', 'Conclusion']
// Swatches standing in for the design and template pickers: colours only, no invented names.
const designs = [
  ['#0f2f57', '#ffffff'],
  ['#efe6d8', '#2a2118'],
  ['#1f7a5a', '#ffffff'],
  ['#ffffff', '#0e1726'],
  ['#2b2140', '#f1e8ff'],
  ['#f6d74a', '#1c1a10'],
  ['#d9e8f7', '#10304f'],
  ['#3b0d11', '#ffd9d2'],
  ['#e8efe6', '#20372c'],
  ['#101418', '#e9f0f7'],
  ['#fbe3d6', '#5a2412'],
  ['#5a6b7d', '#ffffff'],
]
const templates = [
  ['sidebar', '#1d3a5f'],
  ['header', '#0f6b5a'],
  ['single', '#2b2b2b'],
  ['sidebar', '#7a2e3a'],
  ['header', '#3157a8'],
  ['single', '#8a5a14'],
  ['sidebar', '#2f5d3a'],
  ['header', '#4b3a7a'],
  ['single', '#0e5c86'],
  ['sidebar', '#5a4636'],
  ['header', '#a13d2d'],
  ['single', '#364152'],
]
const modes = [
  { key: 'Message', icon: 'send' },
  { key: 'Linkedin', icon: 'user' },
  { key: 'Old', icon: 'file' },
]
const life = [
  ['upload', 1],
  ['download', 2],
  ['trash', 3],
] as const

const related = computed(() =>
  s.value.related.map((id): RelatedLink | null => {
    if (id === 'guide') return { id, icon: 'book', name: t('siteMenuGuide'), to: path('/guide') }
    if (id === 'editor') return { id, icon: 'edit', name: t('siteNavEditor'), to: path('/pdf-editor') }
    if (id === 'powerpoint-to-pdf') {
      const item = tool(id)
      return item ? { id, icon: 'slides', name: toolName(item), to: toolPage(id) } : null
    }
    const names = { documents: 'Documents', referat: 'Referat', slides: 'Slides', cv: 'Cv' } as const
    const icons = { documents: 'file', referat: 'book', slides: 'slides', cv: 'user' } as const
    return { id, icon: icons[id], name: t(`siteMenuAi${names[id]}`), to: path(`/ai/${id}`) }
  }).filter((item): item is RelatedLink => !!item),
)

const limits = computed(() =>
  ['free', 'plus', 'premium']
    .map((id) => ws.plans.value.find((plan: any) => plan.id === id))
    .filter((plan): plan is any => !!plan)
    .map((plan) => {
      const amount = Number(price(plan) || 0)
      const docs = plan.limits?.weekly_ai_documents
      const edits = plan.limits?.edits_per_file
      return {
        id: plan.id as string,
        label: amount ? `${t(plan.id)}, ${figure(amount)} so‘m` : t(plan.id),
        value: docs == null ? t('sitePlanAiDocsUnlimited') : t('sitePlanAiDocs', { count: figure(Number(docs)) }),
        note: edits == null ? t('sitePlanEditsUnlimited') : t('sitePlanEdits', { count: figure(Number(edits)) }),
      }
    }),
)
const limitsTitle = computed(() => (s.value.key === 'Cv' ? t('siteAiLimitsTitle') : k('LimitsTitle')))
</script>
<template>
  <div class="site-aisvc" :data-service="route.params.service">
    <SiteBreadcrumb />
    <section class="site-toolhero">
      <div class="site-container site-toolhero-grid">
        <div class="site-toolhero-copy">
          <h1 class="site-h1">{{ k('HeroTitle') }}</h1>
          <p class="site-lead">{{ k('HeroLead') }}</p>
          <div class="site-actions">
            <NuxtLink class="site-btn is-primary is-lg" :to="cta">{{ k('HeroCta') }}</NuxtLink>
            <a v-if="bot?.url" class="site-btn is-secondary is-lg" :href="bot.url" target="_blank" rel="noopener"
              ><AppIcon name="send" class="site-icon" />{{ t('siteLinkInTelegram') }}</a
            >
            <NuxtLink v-else class="site-btn is-secondary is-lg" :to="path('/telegram')"
              ><AppIcon name="send" class="site-icon" />{{ t('siteLinkInTelegram') }}</NuxtLink
            >
          </div>
          <div class="site-hero-note">
            <span v-for="n in 3" :key="n" class="site-chip"
              ><AppIcon :name="s.icons[n - 1]!" class="site-icon" />{{ k(`HeroChip${n}`) }}</span
            >
          </div>
        </div>

        <div v-if="s.stage === 'slides'" class="site-slides-stage" aria-hidden="true">
          <div class="site-slide is-under"><b>&nbsp;</b><small>&nbsp;</small></div>
          <div class="site-slide">
            <b>{{ sample }}</b>
            <div class="site-slide-bars">
              <i style="height: 30%"></i><i style="height: 45%"></i><i style="height: 52%"></i><i style="height: 70%"></i
              ><i style="height: 92%"></i>
            </div>
          </div>
          <span class="site-chip site-slide-count">{{ t('siteAiSlidesVignetteChip') }}</span>
        </div>

        <div v-else-if="s.stage === 'cv'" class="site-aisvc-stage is-cv" aria-hidden="true">
          <div class="site-aisvc-cv site-sheet">
            <div class="site-aisvc-cv-side">
              <span></span>
              <div v-for="n in 5" :key="n" class="site-doc-line" :class="{ 'is-s': n % 2 === 0 }"></div>
            </div>
            <div class="site-aisvc-cv-main">
              <div v-for="n in 14" :key="n" class="site-doc-line" :class="{ 'is-h': n === 1 || n === 6 || n === 11, 'is-s': n % 3 === 0 }"></div>
            </div>
          </div>
          <div class="site-aisvc-picker site-panel">
            <span v-for="([kind, colour], index) in templates.slice(0, 5)" :key="index" :class="[`is-${kind}`, { 'is-on': index === 0 }]" :style="{ '--site-tpl': colour }"><i></i></span>
          </div>
        </div>

        <div v-else class="site-aisvc-stage" aria-hidden="true">
          <div class="site-aisvc-page site-sheet is-inner">
            <template v-if="s.stage === 'referat'">
              <p class="site-doc-title">{{ t('siteAiReferatPartPlan') }}</p>
              <ol class="site-aisvc-toc">
                <li v-for="part in referatParts.slice(1)" :key="part">{{ t(`siteAiReferatPart${part}`) }}</li>
              </ol>
              <div v-for="n in 6" :key="n" class="site-doc-line" :class="{ 'is-h': n === 3, 'is-s': n % 3 === 0 }"></div>
            </template>
            <div v-for="n in 14" v-else :key="n" class="site-doc-line" :class="{ 'is-h': n === 1 || n === 8, 'is-s': n % 4 === 3 }"></div>
          </div>
          <div class="site-aisvc-page site-sheet is-cover">
            <span class="site-aisvc-cover-band"></span>
            <p class="site-doc-title">{{ sample }}</p>
            <div class="site-doc-meta">PDF</div>
            <div v-for="n in 4" :key="n" class="site-doc-line" :class="{ 'is-s': n % 2 === 0 }"></div>
          </div>
        </div>
      </div>
    </section>

    <template v-for="(id, index) in s.sections" :key="id">
      <section v-if="id === 'honest'" class="site-section" aria-labelledby="ai-honest">
        <div class="site-container">
          <div class="site-aisvc-honest">
            <span class="site-aisvc-honest-ico"><AppIcon name="alert" class="site-icon" /></span>
            <div>
              <h2 id="ai-honest" class="site-h2">{{ t('siteAiReferatHonestTitle') }}</h2>
              <ul>
                <li v-for="n in 3" :key="n"><AppIcon name="check" class="site-icon" />{{ t(`siteAiReferatHonest${n}`) }}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section v-else-if="id === 'how'" class="site-section" :class="{ 'is-band': band(index) }" aria-labelledby="ai-how">
        <div class="site-container">
          <SiteSectionHead id="ai-how" :title="k('HowTitle')" />
          <ol class="site-steps">
            <li v-for="n in 3" :key="n">
              <h3 class="site-h3">{{ k(`Step${n}Title`) }}</h3>
              <p>{{ k(`Step${n}Text`) }}</p>
            </li>
          </ol>
        </div>
      </section>

      <section v-else-if="id === 'languages'" class="site-section" :class="{ 'is-band': band(index) }" aria-labelledby="ai-languages">
        <div class="site-container">
          <SiteSectionHead id="ai-languages" :title="t('siteAiLanguagesTitle')" :intro="k('LanguagesIntro')" />
          <ul class="site-aisvc-langs">
            <li v-for="item in languages" :key="item.code">
              <span class="site-badge">{{ t(item.label) }}</span>
              <p :lang="item.code">{{ t(item.heading) }}</p>
              <div class="site-doc-line"></div>
              <div class="site-doc-line is-s"></div>
            </li>
          </ul>
          <div class="site-note site-aisvc-after"><AppIcon name="languages" class="site-icon" /><p>{{ t('siteAiLangRule') }}</p></div>
        </div>
      </section>

      <section v-else-if="id === 'structure'" class="site-section" :class="{ 'is-band': band(index) }" aria-labelledby="ai-structure">
        <div class="site-container">
          <SiteSectionHead id="ai-structure" :title="t('siteAiReferatStructureTitle')" :intro="t('siteAiReferatStructureIntro')" />
          <ol class="site-aisvc-parts">
            <li v-for="part in referatParts" :key="part">{{ t(`siteAiReferatPart${part}`) }}</li>
          </ol>
          <div class="site-aisvc-notes">
            <div class="site-note site-aisvc-warn"><AppIcon name="alert" class="site-icon" /><p>{{ t('siteAiReferatSourcesNote') }}</p></div>
            <div class="site-note"><AppIcon name="edit" class="site-icon" /><p>{{ t('siteAiReferatTitlePageNote') }}</p></div>
          </div>
        </div>
      </section>

      <section v-else-if="id === 'mustaqil'" class="site-section" :class="{ 'is-band': band(index) }" aria-labelledby="ai-mustaqil">
        <div class="site-container site-split">
          <div class="site-split-copy">
            <h2 id="ai-mustaqil" class="site-h2">{{ t('siteAiReferatMustaqilTitle') }}</h2>
            <p class="site-lead">{{ t('siteAiReferatMustaqilBody') }}</p>
          </div>
          <div class="site-aisvc-cross">
            <span class="site-tool-ico"><AppIcon name="slides" class="site-icon" /></span>
            <h3 class="site-h3">{{ t('siteAiReferatSlidesTitle') }}</h3>
            <p>{{ t('siteAiReferatSlidesLine') }}</p>
            <NuxtLink class="site-btn is-secondary" :to="path('/ai/slides')">{{ t('siteAiReferatSlidesButton') }}</NuxtLink>
          </div>
        </div>
      </section>

      <section v-else-if="id === 'designs'" class="site-section" :class="{ 'is-band': band(index) }" aria-labelledby="ai-designs">
        <div class="site-container">
          <SiteSectionHead id="ai-designs" :title="t('siteAiSlidesDesignsTitle')" :intro="t('siteAiSlidesDesignsIntro')" :to="cta" :link="t('siteAiSlidesDesignsAll')" />
          <div class="site-designs" aria-hidden="true">
            <div v-for="([bg, fg], n) in designs" :key="n" class="site-design site-aisvc-swatch" :style="{ background: bg, color: fg }">
              <span class="site-aisvc-swatch-title"></span><span class="site-aisvc-swatch-sub"></span><i></i>
            </div>
          </div>
        </div>
      </section>

      <section v-else-if="id === 'editable'" class="site-section" :class="{ 'is-band': band(index) }" aria-labelledby="ai-editable">
        <div class="site-container site-split">
          <div class="site-split-copy">
            <h2 id="ai-editable" class="site-h2">{{ t('siteAiSlidesEditableTitle') }}</h2>
            <p class="site-lead">{{ t('siteAiSlidesEditableBody') }}</p>
          </div>
          <div class="site-aisvc-pills">
            <span class="site-file-pill"><span class="site-file-ext">PPTX</span><b>{{ t('siteAiSlidesPillFile') }}</b></span>
            <span class="site-file-pill"><AppIcon name="edit" class="site-icon" /><span>{{ t('siteAiSlidesPillEdit') }}</span></span>
            <span class="site-file-pill"><AppIcon name="sparkle" class="site-icon" /><span>{{ t('siteAiSlidesPillAi') }}</span></span>
          </div>
        </div>
      </section>

      <section v-else-if="id === 'modes'" class="site-section" :class="{ 'is-band': band(index) }" aria-labelledby="ai-modes">
        <div class="site-container">
          <SiteSectionHead id="ai-modes" :title="t('siteAiCvModesTitle')" />
          <ul class="site-aisvc-modes">
            <li v-for="mode in modes" :key="mode.key">
              <div class="site-aisvc-mode-pic" :class="`is-${mode.key.toLowerCase()}`" aria-hidden="true">
                <template v-if="mode.key === 'Message'">
                  <span class="site-aisvc-bubble"><i></i><i></i><i class="is-s"></i></span>
                </template>
                <template v-else-if="mode.key === 'Linkedin'">
                  <span class="site-file-pill"><span class="site-file-ext site-aisvc-ext">PDF</span><i></i></span>
                  <span class="site-aisvc-shot"><i></i><i></i></span>
                </template>
                <div v-else class="site-aisvc-oldcv site-sheet">
                  <div v-for="n in 6" :key="n" class="site-doc-line" :class="{ 'is-h': n === 1, 'is-s': n % 2 === 0 }"></div>
                </div>
              </div>
              <h3 class="site-h3"><AppIcon :name="mode.icon" class="site-icon" />{{ t(`siteAiCvMode${mode.key}Title`) }}</h3>
              <p>{{ t(`siteAiCvMode${mode.key}Text`) }}</p>
            </li>
          </ul>
        </div>
      </section>

      <section v-else-if="id === 'templates'" class="site-section" :class="{ 'is-band': band(index) }" aria-labelledby="ai-templates">
        <div class="site-container">
          <SiteSectionHead id="ai-templates" :title="t('siteAiCvTemplatesTitle')" :intro="t('siteAiCvTemplatesIntro')" :to="cta" :link="t('siteAiCvTemplatesAll')" />
          <div class="site-aisvc-templates" aria-hidden="true">
            <div v-for="([kind, colour], n) in templates" :key="n" class="site-aisvc-tpl" :class="`is-${kind}`" :style="{ '--site-tpl': colour }">
              <i class="site-aisvc-tpl-accent"></i>
              <div>
                <b></b>
                <div v-for="m in 7" :key="m" class="site-doc-line" :class="{ 'is-s': m % 3 === 0 }"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-else-if="id === 'privacy'" class="site-section" :class="{ 'is-band': band(index) }" aria-labelledby="ai-privacy">
        <div class="site-container">
          <SiteSectionHead id="ai-privacy" :title="t('siteAiCvPrivacyTitle')" :to="path('/legal/privacy')" :link="t('siteLinkPrivacy')" />
          <div class="site-note site-aisvc-before"><AppIcon name="shield" class="site-icon" /><p>{{ t('siteAiCvPrivacyNote') }}</p></div>
          <ol class="site-life site-aisvc-life">
            <li v-for="[icon, n] in life" :key="n">
              <span class="site-life-dot"><AppIcon :name="icon" class="site-icon is-sm" /></span>
              <b>{{ t(`siteLifecycle${n}Title`) }}</b>
              <p>{{ t(`siteLifecycle${n}Text`) }}</p>
              <span class="site-life-time">{{ t(`siteLifecycle${n}Time`) }}</span>
            </li>
          </ol>
        </div>
      </section>

      <section v-else-if="id === 'limits' && limits.length" class="site-section" :class="{ 'is-band': band(index) }" aria-labelledby="ai-limits">
        <div class="site-container">
          <SiteSectionHead id="ai-limits" :title="limitsTitle" :intro="t('siteAiLimitsCaption')" :to="path('/pricing')" :link="t('siteLinkComparePlans')" />
          <dl class="site-kv">
            <div v-for="row in limits" :key="row.id">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}<small>{{ row.note }}</small></dd>
            </div>
          </dl>
          <p class="site-aisvc-fine">{{ t('siteAiLimitsOutlineNote') }}</p>
        </div>
      </section>

      <section v-else-if="id === 'guide'" class="site-section" :class="{ 'is-band': band(index) }" aria-labelledby="ai-guide">
        <div class="site-container">
          <div class="site-aisvc-guide">
            <span class="site-tool-ico"><AppIcon name="book" class="site-icon" /></span>
            <div>
              <h2 id="ai-guide" class="site-h3">{{ t('siteAiGuideTitle') }}</h2>
              <p>{{ t('siteAiGuideLine') }}</p>
            </div>
            <NuxtLink class="site-btn is-secondary" :to="path('/guide')">{{ t('siteAiGuideButton') }}</NuxtLink>
          </div>
        </div>
      </section>
    </template>

    <SiteFaq :page="page" :title="k('FaqTitle')" :to="path('/help')" :link="t('siteFooterHelpCentre')" open />

    <section class="site-section" aria-labelledby="ai-related">
      <div class="site-container">
        <SiteSectionHead id="ai-related" :title="t('siteRelatedTitleAi')" />
        <div class="site-related">
          <NuxtLink v-for="item in related" :key="item.id" :to="item.to"
            ><span class="site-tool-ico"><AppIcon :name="item.icon" class="site-icon" /></span>{{ item.name }}</NuxtLink
          >
        </div>
      </div>
    </section>
  </div>
</template>
