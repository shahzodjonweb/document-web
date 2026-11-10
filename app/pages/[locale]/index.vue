<script setup lang="ts">
// The home page (docs/site/design/pages/home.md, mockups/home.html).
definePageMeta({ layout: 'site' })
const { t, path, start, bot } = useSite()
const ws = useWorkspace()

const ai = computed(() =>
  [
    { key: 'Docs', to: '/ai/documents', stage: 'doc' },
    { key: 'Slides', to: '/ai/slides', stage: 'slides' },
    { key: 'Cv', to: '/ai/cv', stage: 'cv' },
  ].map((card) => ({
    ...card,
    to: path(card.to),
    title: t(`siteAiCard${card.key}Title`),
    line: t(`siteAiCard${card.key}Line`),
    chips: [1, 2, 3].map((n) => t(`siteAiCard${card.key}Chip${n}`)),
  })),
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
const compare = [
  ['siteCompareRowSize', 'siteCompareSizeWeb', 'siteCompareSizeBot'],
  ['siteCompareRowEditor', 'siteCompareEditorWeb', 'siteCompareEditorBot'],
  ['siteCompareRowAi', 'siteCompareYes', 'siteCompareYes'],
  ['siteCompareRowAccount', 'siteCompareSameAccount', 'siteCompareSameAccount'],
] as const
const life = [
  ['upload', 1],
  ['download', 2],
  ['trash', 3],
] as const
const facts = [
  ['redact', 'Analytics'],
  ['user', 'SignIn'],
  ['sparkle', 'Ai'],
] as const
</script>
<template>
  <div class="site-home">
    <section class="site-hero">
      <div class="site-container site-hero-grid">
        <div class="site-hero-copy">
          <h1 class="site-h1">{{ t('siteHomeHeroTitle') }}</h1>
          <p class="site-lead">{{ t('siteHomeHeroLead') }}</p>
          <div class="site-actions">
            <NuxtLink class="site-btn is-primary is-lg" :to="start()">{{ t('siteHomeHeroCta') }}</NuxtLink>
            <a v-if="bot?.url" class="site-btn is-secondary is-lg" :href="bot.url" target="_blank" rel="noopener"
              ><AppIcon name="send" class="site-icon" />{{ t('siteHomeHeroCtaTelegram') }}</a
            >
            <NuxtLink v-else class="site-btn is-secondary is-lg" :to="path('/telegram')"
              ><AppIcon name="send" class="site-icon" />{{ t('siteHomeHeroCtaTelegram') }}</NuxtLink
            >
          </div>
          <div class="site-hero-note">
            <span class="site-chip"><AppIcon name="check" class="site-icon" />{{ t('siteHomeHeroChip1') }}</span>
            <span class="site-chip"><AppIcon name="clock" class="site-icon" />{{ t('siteHomeHeroChip2') }}</span>
            <span>{{ t('siteHomeHeroLangLine') }}</span>
          </div>
        </div>
        <div class="site-vignette" aria-hidden="true">
          <div class="site-doc site-sheet">
            <p class="site-doc-title">{{ t('siteHomeVignetteDocTitle') }}</p>
            <div class="site-doc-meta">PDF · 4</div>
            <div v-for="n in 16" :key="n" class="site-doc-line" :class="{ 'is-h': n === 6 || n === 12, 'is-s': n % 4 === 3 }"></div>
          </div>
          <div class="site-task site-panel">
            <div class="site-task-head">
              <span class="site-tool-ico"><AppIcon name="merge" class="site-icon" /></span>{{ t('siteHomeVignetteTask') }}
            </div>
            <div v-for="n in 3" :key="n" class="site-filerow">
              <AppIcon name="file" class="site-icon" /><span>{{ t(`siteHomeVignetteFile${n}`) }}</span>
            </div>
            <div class="site-task-result">
              <div>
                <strong>{{ t('siteHomeVignetteResult') }}</strong
                ><small><AppIcon name="clock" class="site-icon is-sm" />{{ t('siteLifecycle3Time') }}</small>
              </div>
              <span class="site-status"><AppIcon name="check" class="site-icon is-sm" />{{ t('siteHomeVignetteStatus') }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="site-section" aria-labelledby="home-tools">
      <div class="site-container">
        <SiteSectionHead
          id="home-tools"
          :title="t('siteHomeToolsTitle')"
          :intro="t('siteHomeToolsIntro')"
          :to="path('/tools')"
          :link="t('siteHomeToolsAll')"
        />
        <SiteToolGroups />
      </div>
    </section>

    <section class="site-section is-band" aria-labelledby="home-ai">
      <div class="site-container">
        <SiteSectionHead id="home-ai" :title="t('siteHomeAiTitle')" :intro="t('siteHomeAiIntro')" :to="path('/ai')" :link="t('siteAiCardOpen')" />
        <div class="site-ai-grid">
          <NuxtLink v-for="card in ai" :key="card.key" class="site-ai-card" :to="card.to">
            <div class="site-ai-stage" aria-hidden="true">
              <div v-if="card.stage === 'doc'" class="site-mini-doc site-sheet">
                <div v-for="n in 11" :key="n" class="site-doc-line" :class="{ 'is-h': n === 4, 'is-s': n % 4 === 3 }"></div>
              </div>
              <template v-else-if="card.stage === 'slides'">
                <div class="site-mini-slide is-back"><b style="color: #2a2118">&nbsp;</b><i style="background: #2a2118; opacity: 0.3"></i></div>
                <div class="site-mini-slide is-mid"><b>&nbsp;</b><i></i></div>
                <div class="site-mini-slide"><b>{{ card.title }}</b><i></i></div>
              </template>
              <div v-else class="site-mini-cv site-sheet">
                <div><span></span><div class="site-doc-line"></div><div class="site-doc-line is-s"></div></div>
                <div><div v-for="n in 9" :key="n" class="site-doc-line" :class="{ 'is-h': n === 1 || n === 5 }"></div></div>
              </div>
            </div>
            <div class="site-ai-body">
              <h3 class="site-h3">{{ card.title }}</h3>
              <p>{{ card.line }}</p>
              <div class="site-ai-facts"><span v-for="chip in card.chips" :key="chip" class="site-chip">{{ chip }}</span></div>
              <span class="site-link-arrow">{{ t('siteAiCardOpen') }}<AppIcon name="right" class="site-icon is-sm" /></span>
            </div>
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="site-section" aria-labelledby="home-editor">
      <div class="site-container site-split">
        <div class="site-split-copy">
          <h2 id="home-editor" class="site-h2">{{ t('siteHomeEditorTitle') }}</h2>
          <p class="site-lead">{{ t('siteHomeEditorIntro') }}</p>
          <ul class="site-caps">
            <li v-for="[key, icon] in caps" :key="key"><AppIcon :name="icon" class="site-icon" />{{ t(`siteEditorCap${key}Title`) }}</li>
          </ul>
          <NuxtLink class="site-btn is-secondary" :to="path('/pdf-editor')">{{ t('siteHomeEditorCta') }}</NuxtLink>
        </div>
        <div class="site-editor site-panel" aria-hidden="true">
          <div class="site-editor-bar">
            <span v-for="([, icon], index) in caps.slice(0, 7)" :key="icon" :class="{ 'is-on': index === 2 }"
              ><AppIcon :name="icon" class="site-icon"
            /></span>
          </div>
          <div class="site-editor-canvas">
            <div class="site-editor-page site-sheet">
              <p><strong>{{ t('siteHomeVignetteDocTitle') }}</strong></p>
              <div class="site-doc-line"></div>
              <div class="site-doc-line is-s"></div>
              <p><mark>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</mark></p>
              <div class="site-doc-line"></div>
              <div class="site-doc-line is-s"></div>
              <div class="site-editor-sign">
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

    <section class="site-section is-band" aria-labelledby="home-telegram">
      <div class="site-container site-split is-reverse">
        <div class="site-split-copy">
          <h2 id="home-telegram" class="site-h2">{{ t('siteHomeTelegramTitle') }}</h2>
          <p class="site-lead">{{ t('siteHomeTelegramIntro') }}</p>
          <div class="site-actions">
            <a v-if="bot?.url" class="site-btn is-primary" :href="bot.url" target="_blank" rel="noopener"
              ><AppIcon name="send" class="site-icon" />{{ t('siteFooterBot') }}</a
            >
            <NuxtLink class="site-link-arrow" :to="path('/telegram')"
              >{{ t('siteHomeTelegramCta') }}<AppIcon name="right" class="site-icon is-sm"
            /></NuxtLink>
          </div>
        </div>
        <table class="site-compare">
          <caption class="site-visually-hidden">{{ t('siteCompareCaption') }}</caption>
          <thead>
            <tr>
              <th scope="col"><span class="site-visually-hidden">{{ t('siteCompareCaption') }}</span></th>
              <th scope="col">{{ t('siteCompareColWeb') }}</th>
              <th scope="col">{{ t('siteCompareColBot') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="[row, web, telegram] in compare" :key="row">
              <th scope="row">{{ t(row) }}</th>
              <td :data-label="t('siteCompareColWeb')" :class="{ 'is-yes': web === 'siteCompareYes' }">{{ t(web) }}</td>
              <td :data-label="t('siteCompareColBot')" :class="{ 'is-yes': telegram === 'siteCompareYes' }">{{ t(telegram) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="site-section" aria-labelledby="home-steps">
      <div class="site-container">
        <SiteSectionHead id="home-steps" :title="t('siteHomeStepsTitle')" />
        <ol class="site-steps">
          <li v-for="n in 3" :key="n">
            <h3 class="site-h3">{{ t(`siteHomeStep${n}Title`) }}</h3>
            <p>{{ t(`siteHomeStep${n}Text`) }}</p>
          </li>
        </ol>
      </div>
    </section>

    <section class="site-section is-band" aria-labelledby="home-privacy">
      <div class="site-container">
        <SiteSectionHead
          id="home-privacy"
          :title="t('siteHomePrivacyTitle')"
          :intro="t('siteHomePrivacyIntro')"
          :to="path('/legal/privacy')"
          :link="t('siteHomePrivacyLink')"
        />
        <ol class="site-life">
          <li v-for="[icon, n] in life" :key="n">
            <span class="site-life-dot"><AppIcon :name="icon" class="site-icon is-sm" /></span>
            <b>{{ t(`siteLifecycle${n}Title`) }}</b>
            <p>{{ t(`siteLifecycle${n}Text`) }}</p>
            <span class="site-life-time">{{ t(`siteLifecycle${n}Time`) }}</span>
          </li>
        </ol>
        <dl class="site-facts">
          <div v-for="[icon, key] in facts" :key="key">
            <dt><AppIcon :name="icon" class="site-icon" />{{ t(`siteHomeFact${key}Title`) }}</dt>
            <dd>{{ t(`siteHomeFact${key}Text`) }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section v-if="ws.plans.value.length" class="site-section" aria-labelledby="home-pricing">
      <div class="site-container">
        <SiteSectionHead
          id="home-pricing"
          :title="t('siteHomePricingTitle')"
          :intro="t('siteHomePricingIntro')"
          :to="path('/pricing')"
          :link="t('siteHomePricingLink')"
        />
        <SitePlans />
      </div>
    </section>

    <SiteFaq page="home" :title="t('siteHomeFaqTitle')" :to="path('/help')" :link="t('siteFooterHelpCentre')" open />
    <SiteCta :title="t('siteHomeFinalTitle')" :line="t('siteHomeFinalLine')" />
  </div>
</template>
