<script setup lang="ts">
// The PDF editor landing (docs/site/design/pages/pdf-editor.md): hero with the editor
// vignette, eight capabilities, how-to, browser vs Mini App, plans line, privacy, FAQ, related.
definePageMeta({ layout: 'site' })
const { t, path, bot, tool, toolName, toolPage, start } = useSite()

const caps = [
  ['EditText', 'type'],
  ['AddText', 'edit'],
  ['Highlight', 'highlighter'],
  ['Annotate', 'sticky'],
  ['Forms', 'form'],
  ['Signature', 'signature'],
  ['Images', 'image'],
  ['Redact', 'redact'],
] as const
const bar = ['type', 'edit', 'highlighter', 'sticky', 'form', 'signature', 'image', 'redact'] as const
const channels = [
  ['siteEditorChanRowWhere', 'siteEditorChanWhereWeb', 'siteEditorChanWhereMiniApp'],
  ['siteEditorChanRowAccount', 'siteEditorChanAccountSame', 'siteEditorChanAccountSame'],
] as const
const related = computed(() =>
  ['sign-pdf', 'fill-pdf-form', 'merge-pdf', 'compress-pdf'].flatMap((slug) => {
    const item = tool(slug)
    return item ? [{ slug, name: toolName(item), icon: item.icon, to: toolPage(slug) }] : []
  }),
)
</script>
<template>
  <div class="site-editor-landing">
    <SiteBreadcrumb />
    <section class="site-hero site-pe-hero">
      <div class="site-container site-hero-grid site-pe-hero-grid">
        <div class="site-hero-copy">
          <h1 class="site-h1">{{ t('siteEditorHeroTitle') }}</h1>
          <p class="site-lead">{{ t('siteEditorHeroLead') }}</p>
          <div class="site-actions">
            <NuxtLink class="site-btn is-primary is-lg" :to="start('editor.visual')">{{ t('siteEditorHeroCta') }}</NuxtLink>
            <a v-if="bot?.url" class="site-btn is-secondary is-lg" :href="bot.url" target="_blank" rel="noopener"
              ><AppIcon name="send" class="site-icon" />{{ t('siteEditorHeroCtaTelegram') }}</a
            >
            <NuxtLink v-else class="site-btn is-secondary is-lg" :to="path('/telegram')"
              ><AppIcon name="send" class="site-icon" />{{ t('siteEditorHeroCtaTelegram') }}</NuxtLink
            >
          </div>
        </div>
        <div class="site-editor site-panel site-pe-vignette" aria-hidden="true">
          <div class="site-editor-bar">
            <span v-for="(icon, index) in bar" :key="icon" :class="{ 'is-on': index === 5 }"><AppIcon :name="icon" class="site-icon" /></span>
          </div>
          <div class="site-editor-canvas">
            <div class="site-editor-page site-sheet">
              <p><strong>{{ t('siteHomeVignetteDocTitle') }}</strong></p>
              <div class="site-doc-line"></div>
              <div class="site-doc-line is-s"></div>
              <div class="site-doc-line site-pe-hl"></div>
              <div class="site-doc-line"></div>
              <div class="site-pe-redact"></div>
              <div class="site-doc-line is-s"></div>
              <div class="site-editor-sign">
                <span></span
                ><svg viewBox="0 0 120 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M6 28c8-14 14-20 18-16s-6 18 0 16 10-18 16-14-4 14 2 12 8-10 14-8 4 8 10 6 10-6 16-4 10 2 20 0" />
                </svg>
              </div>
            </div>
          </div>
          <div class="site-pe-props">
            <span class="site-pe-swatch"></span><span class="site-pe-swatch is-2"></span><span class="site-pe-swatch is-3"></span>
            <i></i>
            <AppIcon name="undo" class="site-icon is-sm" /><AppIcon name="redo" class="site-icon is-sm" />
          </div>
        </div>
      </div>
    </section>

    <section class="site-section is-band" aria-labelledby="pe-caps">
      <div class="site-container">
        <SiteSectionHead id="pe-caps" :title="t('siteEditorCapsTitle')" />
        <ul class="site-pe-caps">
          <li v-for="[key, icon] in caps" :key="key">
            <span class="site-pe-scene" :class="`is-${key.toLowerCase()}`" aria-hidden="true">
              <i></i><i></i><i></i>
              <AppIcon :name="icon" class="site-icon" />
            </span>
            <div>
              <h3 class="site-h4">{{ t(`siteEditorCap${key}Title`) }}</h3>
              <p>{{ t(`siteEditorCap${key}Line`) }}</p>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <section class="site-section" aria-labelledby="pe-how">
      <div class="site-container">
        <SiteSectionHead id="pe-how" :title="t('siteEditorHowTitle')" />
        <ol class="site-steps">
          <li v-for="n in 3" :key="n">
            <h3 class="site-h3">{{ t(`siteEditorStep${n}Title`) }}</h3>
            <p>{{ t(`siteEditorStep${n}Text`) }}</p>
          </li>
        </ol>
      </div>
    </section>

    <section class="site-section is-band" aria-labelledby="pe-channels">
      <div class="site-container site-split">
        <div class="site-split-copy">
          <h2 id="pe-channels" class="site-h2">{{ t('siteEditorChannelsTitle') }}</h2>
          <p class="site-lead">{{ t('siteEditorChannelsIntro') }}</p>
        </div>
        <table class="site-compare">
          <caption class="site-visually-hidden">{{ t('siteEditorChannelsTitle') }}</caption>
          <thead>
            <tr>
              <th scope="col"><span class="site-visually-hidden">{{ t('siteEditorChannelsTitle') }}</span></th>
              <th scope="col">{{ t('siteEditorChanColWeb') }}</th>
              <th scope="col">{{ t('siteEditorChanColMiniApp') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="[row, web, mini] in channels" :key="row">
              <th scope="row">{{ t(row) }}</th>
              <td :data-label="t('siteEditorChanColWeb')">{{ t(web) }}</td>
              <td :data-label="t('siteEditorChanColMiniApp')">{{ t(mini) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="site-section" aria-labelledby="pe-plans">
      <div class="site-container">
        <div class="site-pe-plans">
          <span class="site-tool-ico" aria-hidden="true"><AppIcon name="billing" class="site-icon" /></span>
          <div>
            <h2 id="pe-plans" class="site-h3">{{ t('siteEditorPlansTitle') }}</h2>
            <p>{{ t('siteEditorPlansBody') }}</p>
          </div>
          <NuxtLink class="site-btn is-secondary" :to="path('/pricing')">{{ t('siteLinkComparePlans') }}</NuxtLink>
        </div>
        <div class="site-note site-pe-note">
          <AppIcon name="shield" class="site-icon" />
          <p>
            {{ t('siteEditorPrivacyNote') }}
            <NuxtLink class="site-link" :to="path('/legal/privacy')">{{ t('siteToolPrivacyLink') }}</NuxtLink>
          </p>
        </div>
      </div>
    </section>

    <SiteFaq page="pdf-editor" :title="t('siteEditorFaqTitle')" :to="path('/help')" :link="t('siteFooterHelpCentre')" open />

    <section class="site-section" aria-labelledby="pe-related">
      <div class="site-container">
        <SiteSectionHead id="pe-related" :title="t('siteRelatedTitle')" :to="path('/tools')" :link="t('siteHomeToolsAll')" />
        <div class="site-related">
          <NuxtLink v-for="item in related" :key="item.slug" :to="item.to"
            ><span class="site-tool-ico" aria-hidden="true"><AppIcon :name="item.icon" class="site-icon" /></span>{{ item.name }}</NuxtLink
          >
        </div>
      </div>
    </section>
  </div>
</template>
