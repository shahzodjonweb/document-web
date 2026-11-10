<script setup lang="ts">
// The AI hub (docs/site/design/pages/ai-hub.md): the three services, AI edits,
// the weekly limits from the live plans, the prompt guide and the data note.
definePageMeta({ layout: 'site' })
const { t, path, bot, locale } = useSite()
const ws = useWorkspace()
const sample = computed(() => t(`siteAiSampleHeading${locale.value === 'uz' ? 'Uz' : locale.value === 'ru' ? 'Ru' : 'En'}`))
const { figure, price } = usePricing()

const services = computed(() =>
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

// Free / Plus / Premium: AI documents a week and AI edits per file, as the plans say today.
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
        label: amount ? `${t(plan.id)}, ${figure(amount)} so'm` : t(plan.id),
        value: docs == null ? t('sitePlanAiDocsUnlimited') : t('sitePlanAiDocs', { count: figure(Number(docs)) }),
        note: edits == null ? t('sitePlanEditsUnlimited') : t('sitePlanEdits', { count: figure(Number(edits)) }),
      }
    }),
)
</script>
<template>
  <div class="site-aihub">
    <SiteBreadcrumb />
    <section class="site-toolhero">
      <div class="site-container site-toolhero-grid">
        <div class="site-toolhero-copy">
          <h1 class="site-h1">{{ t('siteAiHubHeroTitle') }}</h1>
          <p class="site-lead">{{ t('siteAiHubHeroLead') }}</p>
          <div class="site-actions">
            <NuxtLink class="site-btn is-primary is-lg" :to="path('/app/create')">{{ t('siteAiHubHeroCta') }}</NuxtLink>
            <a v-if="bot?.url" class="site-btn is-secondary is-lg" :href="bot.url" target="_blank" rel="noopener"
              ><AppIcon name="send" class="site-icon" />{{ t('siteAiHubHeroCtaTelegram') }}</a
            >
            <NuxtLink v-else class="site-btn is-secondary is-lg" :to="path('/telegram')"
              ><AppIcon name="send" class="site-icon" />{{ t('siteAiHubHeroCtaTelegram') }}</NuxtLink
            >
          </div>
        </div>
        <div class="site-aihub-stage" aria-hidden="true">
          <div class="site-mini-doc site-sheet site-aihub-doc">
            <p class="site-doc-title">{{ sample }}</p>
            <div v-for="n in 15" :key="n" class="site-doc-line" :class="{ 'is-h': n === 3 || n === 10, 'is-s': n % 4 === 3 }"></div>
          </div>
          <div class="site-mini-slide site-aihub-slide">
            <b>{{ t('siteAiCardSlidesTitle') }}</b>
            <div class="site-slide-bars"><i style="height: 38%"></i><i style="height: 58%"></i><i style="height: 74%"></i><i style="height: 96%"></i></div>
          </div>
          <div class="site-mini-cv site-sheet site-aihub-cv">
            <div><span></span><div class="site-doc-line"></div><div class="site-doc-line is-s"></div></div>
            <div><div v-for="n in 9" :key="n" class="site-doc-line" :class="{ 'is-h': n === 1 || n === 5 }"></div></div>
          </div>
        </div>
      </div>
    </section>

    <section class="site-section is-band" aria-labelledby="ai-services">
      <div class="site-container">
        <SiteSectionHead id="ai-services" :title="t('siteAiHubServicesTitle')" :intro="t('siteAiHubServicesIntro')" />
        <div class="site-ai-grid">
          <NuxtLink v-for="card in services" :key="card.key" class="site-ai-card" :to="card.to">
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
        <p class="site-aihub-referat">
          <AppIcon name="book" class="site-icon" />
          <NuxtLink :to="path('/ai/referat')">{{ t('siteAiHubReferatLine') }}</NuxtLink>
        </p>
      </div>
    </section>

    <section class="site-section" aria-labelledby="ai-edits">
      <div class="site-container site-split">
        <div class="site-split-copy">
          <h2 id="ai-edits" class="site-h2">{{ t('siteAiHubEditsTitle') }}</h2>
          <p class="site-lead">{{ t('siteAiHubEditsBody') }}</p>
          <p class="site-aihub-plans"><AppIcon name="info" class="site-icon" />{{ t('siteAiHubEditsPlans') }}</p>
        </div>
        <div class="site-aihub-edit" aria-hidden="true">
          <div class="site-aihub-prompt site-panel">
            <AppIcon name="sparkle" class="site-icon" /><span>{{ t('siteAiHubEditsPrompt') }}</span>
          </div>
          <AppIcon name="down" class="site-icon site-aihub-arrow" />
          <div class="site-aihub-result">
            <div class="site-mini-slide site-aihub-old"><b>&nbsp;</b><i></i><i></i><i></i></div>
            <AppIcon name="right" class="site-icon" />
            <div class="site-mini-slide"><b>&nbsp;</b><i></i><div class="site-slide-bars"><i style="height: 40%"></i><i style="height: 62%"></i><i style="height: 90%"></i></div></div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="limits.length" class="site-section is-band" aria-labelledby="ai-limits">
      <div class="site-container">
        <SiteSectionHead
          id="ai-limits"
          :title="t('siteAiLimitsTitle')"
          :intro="t('siteAiLimitsCaption')"
          :to="path('/pricing')"
          :link="t('siteLinkComparePlans')"
        />
        <dl class="site-kv">
          <div v-for="row in limits" :key="row.id">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}<small>{{ row.note }}</small></dd>
          </div>
        </dl>
        <p class="site-aisvc-fine">{{ t('siteAiLimitsOutlineNote') }}</p>
      </div>
    </section>

    <section class="site-section" aria-labelledby="ai-guide">
      <div class="site-container">
        <div class="site-aisvc-guide">
          <span class="site-tool-ico"><AppIcon name="sparkle" class="site-icon" /></span>
          <div>
            <h2 id="ai-guide" class="site-h3">{{ t('siteAiGuideTitle') }}</h2>
            <p>{{ t('siteAiGuideLine') }}</p>
          </div>
          <NuxtLink class="site-btn is-secondary" :to="path('/guide')">{{ t('siteAiGuideButton') }}</NuxtLink>
        </div>
        <div class="site-note site-aihub-note">
          <AppIcon name="shield" class="site-icon" />
          <p>
            {{ t('siteAiDataNote') }}
            <NuxtLink :to="path('/legal/privacy')">{{ t('siteLinkPrivacy') }}</NuxtLink>
          </p>
        </div>
      </div>
    </section>

    <SiteFaq page="ai-hub" :title="t('siteSectionFaqTitle')" :to="path('/help')" :link="t('siteFooterHelpCentre')" open />
  </div>
</template>
