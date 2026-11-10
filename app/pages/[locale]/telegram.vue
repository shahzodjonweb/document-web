<script setup lang="ts">
// The Telegram bot page (docs/site/design/pages/telegram.md): what the bot does,
// where the website is needed instead, and that both share one account.
definePageMeta({ layout: 'site' })
const { t, st, path, bot, tools, toolName, toolPage } = useSite()

const botTools = tools.filter((item) => (item.channels as readonly string[]).includes('bot'))
const webOnly = tools.filter((item) => {
  const channels = item.channels as readonly string[]
  return !channels.includes('bot') && !channels.includes('mini_app')
})
const ai = [
  ['siteTgColAiDocs', 'file'],
  ['siteTgColAiSlides', 'slides'],
  ['siteTgColAiCv', 'user'],
] as const
// A one- or two-letter word ("в", "и", "a") never ends a heading line.
const glue = (text: string) => text.replace(/(^|\s)([\p{L}]{1,2}) /gu, '$1$2\u00a0')
const compare = [
  ['siteCompareRowSize', 'siteCompareSizeWeb', 'siteCompareSizeBot'],
  ['siteCompareRowTools', 'siteCompareToolsWeb', 'siteCompareToolsBot'],
  ['siteCompareRowEditor', 'siteCompareEditorWeb', 'siteCompareEditorBot'],
  ['siteCompareRowAi', 'siteCompareYes', 'siteCompareYes'],
  ['siteCompareRowAccount', 'siteCompareSameAccount', 'siteCompareSameAccount'],
] as const
</script>
<template>
  <div class="site-tg">
    <SiteBreadcrumb />
    <section class="site-hero">
      <div class="site-container site-hero-grid">
        <div class="site-hero-copy">
          <h1 class="site-h1">{{ t('siteTgHeroTitle') }}</h1>
          <p class="site-lead">{{ t('siteTgHeroLead') }}</p>
          <div class="site-actions">
            <a v-if="bot?.url && st('siteTgHeroCta')" class="site-btn is-primary is-lg" :href="bot.url" target="_blank" rel="noopener"
              ><AppIcon name="send" class="site-icon" />{{ st('siteTgHeroCta') }}</a
            >
            <NuxtLink class="site-btn is-secondary is-lg" :to="path('/app')">{{ t('siteNavStart') }}</NuxtLink>
          </div>
        </div>
        <div class="site-tg-stage" aria-hidden="true">
          <div class="site-tg-phone site-panel">
            <div class="site-tg-bar">
              <span class="site-tg-avatar"><img src="/brand/docmaster-icon-tile.svg" alt="" width="32" height="32" /></span>
              <span class="site-tg-name"><b>{{ bot?.username ? `@${bot.username}` : t('siteCompareColBot') }}</b></span>
            </div>
            <div class="site-tg-chat">
              <div class="site-tg-msg is-out">
                <span class="site-tg-file"><AppIcon name="file" class="site-icon" /><span>{{ t('siteTgChatFile') }}</span></span>
              </div>
              <div class="site-tg-msg">
                <p>{{ t('siteTgChatReady') }}</p>
                <span class="site-tg-file"><span class="site-file-ext">PDF</span><span>{{ t('siteTgChatFile') }}</span></span>
              </div>
              <div class="site-tg-keys">
                <span>{{ t('siteTgChatButtonEdit') }}</span>
                <span>{{ t('siteTgChatButtonNew') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="site-section is-band" aria-labelledby="tg-what">
      <div class="site-container">
        <SiteSectionHead id="tg-what" :title="t('siteTgWhatTitle')" />
        <div class="site-tg-cols">
          <div class="site-tg-col is-tools">
            <h3 class="site-h4"><span class="site-tool-ico"><AppIcon name="tools" class="site-icon" /></span>{{ t('siteTgColToolsTitle') }}</h3>
            <ul>
              <li v-for="item in botTools" :key="item.slug">
                <NuxtLink :to="toolPage(item.slug)"><AppIcon :name="item.icon" class="site-icon is-sm" />{{ toolName(item) }}</NuxtLink>
              </li>
            </ul>
          </div>
          <div class="site-tg-col">
            <h3 class="site-h4"><span class="site-tool-ico"><AppIcon name="sparkle" class="site-icon" /></span>{{ t('siteTgColAiTitle') }}</h3>
            <ul>
              <li v-for="[key, icon] in ai" :key="key"><AppIcon :name="icon" class="site-icon is-sm" />{{ t(key) }}</li>
            </ul>
          </div>
          <div class="site-tg-col">
            <h3 class="site-h4"><span class="site-tool-ico"><AppIcon name="edit" class="site-icon" /></span>{{ t('siteTgColEditorTitle') }}</h3>
            <ul>
              <li v-for="n in 3" :key="n"><AppIcon name="check" class="site-icon is-sm" />{{ t(`siteTgColEditorItem${n}`) }}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="site-section" aria-labelledby="tg-limits">
      <div class="site-container">
        <SiteSectionHead id="tg-limits" :title="t('siteTgLimitsTitle')" :intro="t('siteTgLimitsIntro')" />
        <div class="site-tg-limits">
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
          <div v-if="webOnly.length" class="site-tg-webonly">
            <h3 class="site-h4">{{ t('siteTgWebOnlyTitle') }}</h3>
            <ul>
              <li v-for="item in webOnly" :key="item.slug">
                <NuxtLink class="site-toollink" :to="toolPage(item.slug)"
                  ><span class="site-tool-ico"><AppIcon :name="item.icon" class="site-icon" /></span
                  ><span><b>{{ toolName(item) }}</b></span
                  ><AppIcon name="chevron" class="site-icon is-sm"
                /></NuxtLink>
              </li>
            </ul>
          </div>
        </div>
        <div class="site-note site-tg-channel" role="note">
          <AppIcon name="info" class="site-icon" />
          <p><b>{{ t('siteTgChannelTitle') }}</b>{{ t('siteTgChannelNote') }}</p>
        </div>
      </div>
    </section>

    <section class="site-section is-band" aria-labelledby="tg-account">
      <div class="site-container site-split">
        <div class="site-split-copy">
          <h2 id="tg-account" class="site-h2">{{ glue(t('siteTgAccountTitle')) }}</h2>
          <p class="site-lead">{{ t('siteTgAccountBody') }}</p>
          <NuxtLink class="site-btn is-secondary" :to="path('/app')">{{ t('siteNavSignIn') }}</NuxtLink>
        </div>
        <div class="site-tg-devices" aria-hidden="true">
          <div class="site-tg-device is-web site-panel">
            <span class="site-tg-dots"><i></i><i></i><i></i></span>
            <div class="site-doc-line is-h"></div>
            <div class="site-doc-line"></div>
            <div class="site-doc-line is-s"></div>
            <span class="site-tg-device-ico"><AppIcon name="globe" class="site-icon" /></span>
          </div>
          <span class="site-tg-link"><AppIcon name="user" class="site-icon" /></span>
          <div class="site-tg-device is-phone site-panel">
            <div class="site-doc-line is-h"></div>
            <div class="site-doc-line is-s"></div>
            <div class="site-doc-line"></div>
            <div class="site-tg-bubble"></div>
            <div class="site-tg-bubble is-in"></div>
            <span class="site-tg-device-ico"><AppIcon name="send" class="site-icon" /></span>
          </div>
        </div>
      </div>
    </section>

    <SiteFaq page="telegram" :title="t('siteTgFaqTitle')" :to="path('/help')" :link="t('siteFooterHelpCentre')" open />
  </div>
</template>
