<script setup lang="ts">
// The public site's footer (spec §10): link columns, then the seller's details,
// which the law and payment providers ask to see on every page. A detail the
// admin has not set yet (phone, email) is left out, never shown as a blank.
const { t, path, locale, tool, toolName, toolPage, bot } = useSite()
const { localePath } = useLocale()
const { contacts } = contactsState()
const brand = String(useRuntimeConfig().public.productName)
const company = computed(() => contacts.value?.company ?? null)
const support = computed(() => contacts.value?.support ?? null)
const popular = ['merge-pdf', 'compress-pdf', 'split-pdf', 'jpg-to-pdf', 'word-to-pdf', 'pdf-to-word', 'powerpoint-to-pdf', 'ocr-pdf']
  .map((slug) => tool(slug))
  .filter((item) => !!item)
const year = new Date().getFullYear()
const languages = [
  { code: 'uz', key: 'siteLangUz' },
  { code: 'ru', key: 'siteLangRu' },
  { code: 'en', key: 'siteLangEn' },
] as const
</script>
<template>
  <footer class="site-footer">
    <div class="site-container">
      <div class="site-footer-top">
        <div class="site-footer-brand">
          <img class="site-logo-light" src="/brand/docmaster-logo.svg" :alt="brand" width="176" height="28" />
          <img class="site-logo-dark" src="/brand/docmaster-logo-dark.svg" :alt="brand" width="176" height="28" />
          <p>{{ t('siteFooterBlurb') }}</p>
          <div v-if="bot?.url" class="site-actions">
            <a class="site-btn is-secondary is-sm" :href="bot.url" target="_blank" rel="noopener"
              ><AppIcon name="send" class="site-icon is-sm" />{{ t('siteFooterBot') }}</a
            >
          </div>
        </div>
        <div>
          <h2>{{ t('siteFooterPopular') }}</h2>
          <ul>
            <li v-for="item in popular" :key="item!.slug">
              <NuxtLink :to="toolPage(item!.slug)">{{ toolName(item!) }}</NuxtLink>
            </li>
            <li>
              <NuxtLink :to="path('/tools')">{{ t('siteNavAllTools') }}</NuxtLink>
            </li>
          </ul>
        </div>
        <div>
          <h2>{{ t('siteFooterProduct') }}</h2>
          <ul>
            <li><NuxtLink :to="path('/pdf-editor')">{{ t('siteNavEditor') }}</NuxtLink></li>
            <li><NuxtLink :to="path('/ai/documents')">{{ t('siteAiCardDocsTitle') }}</NuxtLink></li>
            <li><NuxtLink :to="path('/ai/slides')">{{ t('siteAiCardSlidesTitle') }}</NuxtLink></li>
            <li><NuxtLink :to="path('/ai/cv')">{{ t('siteAiCardCvTitle') }}</NuxtLink></li>
            <li><NuxtLink :to="path('/pricing')">{{ t('siteNavPricing') }}</NuxtLink></li>
            <li><NuxtLink :to="path('/telegram')">{{ t('siteNavTelegram') }}</NuxtLink></li>
            <li><NuxtLink :to="path('/invite')">{{ t('siteFooterInvite') }}</NuxtLink></li>
          </ul>
        </div>
        <div>
          <h2>{{ t('siteFooterHelp') }}</h2>
          <ul>
            <li><NuxtLink :to="path('/help')">{{ t('siteFooterHelpCentre') }}</NuxtLink></li>
            <li><NuxtLink :to="path('/guide')">{{ t('siteCrumbGuide') }}</NuxtLink></li>
            <li><NuxtLink :to="path('/about')">{{ t('siteFooterAbout') }}</NuxtLink></li>
          </ul>
        </div>
        <div>
          <h2>{{ t('siteFooterLegal') }}</h2>
          <ul>
            <li><NuxtLink :to="path('/legal/terms')">{{ t('siteLegalOfferTitle') }}</NuxtLink></li>
            <li><NuxtLink :to="path('/legal/privacy')">{{ t('siteLegalPrivacyTitle') }}</NuxtLink></li>
          </ul>
        </div>
      </div>
      <section v-if="company" id="company" class="site-requisites site-sheet" aria-labelledby="site-requisites-title">
        <h2 id="site-requisites-title">{{ t('siteFooterRequisites') }}</h2>
        <dl>
          <div>
            <dt>{{ t('siteFooterSeller') }}</dt>
            <dd>{{ company.name }}</dd>
          </div>
          <div>
            <dt>{{ t('siteFooterStir') }}</dt>
            <dd>{{ company.tin }}</dd>
          </div>
          <div>
            <dt>{{ t('siteFooterAddress') }}</dt>
            <dd>{{ company.address }}</dd>
          </div>
          <div v-if="company.phone || company.email || support?.url">
            <dt>{{ t('siteFooterSupport') }}</dt>
            <dd>
              <a v-if="company.phone" :href="`tel:${company.phone.replace(/[^+\d]/g, '')}`">{{ company.phone }}</a
              ><br v-if="company.phone && company.email" /><a v-if="company.email" :href="`mailto:${company.email}`">{{
                company.email
              }}</a
              ><br v-if="(company.phone || company.email) && support?.url" /><a
                v-if="support?.url"
                :href="support.url"
                target="_blank"
                rel="noopener"
                >@{{ support.username }}</a
              >
            </dd>
          </div>
        </dl>
      </section>
      <div class="site-footer-bottom">
        <span>{{ t('siteFooterCopyright', { year, company: company?.name || brand }) }}</span>
        <div class="site-cards" :aria-label="t('siteFooterCards')">
          <span>Uzcard</span><span>Humo</span><span>Visa</span><span>Mastercard</span>
        </div>
        <nav class="site-footer-langs" :aria-label="t('siteLangLabel')">
          <a
            v-for="language in languages"
            :key="language.code"
            :href="localePath(language.code)"
            :lang="language.code"
            :aria-current="language.code === locale ? 'true' : undefined"
            >{{ t(language.key) }}</a
          >
        </nav>
      </div>
    </div>
  </footer>
</template>
