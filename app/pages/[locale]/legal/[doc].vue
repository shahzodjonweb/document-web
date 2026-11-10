<script setup lang="ts">
// The legal pages until the signed-off texts replace them (step W5): no draft is
// published, only the rules already in force, said plainly, and who to ask.
definePageMeta({ layout: 'site' })
const route = useRoute()
const { t, path } = useSite()
const { contacts } = contactsState()
const privacy = computed(() => route.params.doc === 'privacy')
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
const terms = [
  { icon: 'calendar', key: 'Renew' },
  { icon: 'receipt', key: 'Refund' },
  { icon: 'gift', key: 'Invite' },
] as const
</script>
<template>
  <div class="site-legal-interim">
    <SiteBreadcrumb />
    <section class="site-hero site-legal-hero">
      <div class="site-container site-legal-intro">
        <h1 class="site-h1">{{ t(privacy ? 'siteLegalPrivacyTitle' : 'siteLegalOfferTitle') }}</h1>
        <p class="site-note"><AppIcon name="info" class="site-icon" /><span>{{ t('siteLegalPendingLead') }}</span></p>
      </div>
    </section>

    <section v-if="privacy" class="site-section is-band" aria-labelledby="legal-files">
      <div class="site-container">
        <SiteSectionHead id="legal-files" :title="t('siteLegalFilesTitle')" />
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

    <section v-else class="site-section is-band" aria-labelledby="legal-plans">
      <div class="site-container">
        <SiteSectionHead
          id="legal-plans"
          :title="t('siteLegalPlansTitle')"
          :intro="t('sitePricingLead')"
          :to="path('/pricing')"
          :link="t('siteHomePricingLink')"
        />
        <dl class="site-kv site-legal-tiles">
          <div v-for="tile in terms" :key="tile.key">
            <dt><AppIcon :name="tile.icon" class="site-icon is-sm" /> {{ t(`sitePricing${tile.key}Label`) }}</dt>
            <dd>
              {{ t(`sitePricing${tile.key}Value`) }}<small>{{ t(`sitePricing${tile.key}Note`) }}</small>
            </dd>
          </div>
        </dl>
        <p class="site-muted site-small site-legal-vat">{{ t('sitePricingVatNote') }}</p>
      </div>
    </section>

    <section class="site-section" aria-labelledby="legal-questions">
      <div class="site-container site-legal-questions">
        <div>
          <h2 id="legal-questions" class="site-h3">{{ t('siteLegalQuestionsTitle') }}</h2>
          <p>{{ t('siteLegalQuestionsLine') }}</p>
        </div>
        <div class="site-actions">
          <a
            v-if="contacts?.support?.url"
            class="site-btn is-primary"
            :href="contacts.support.url"
            target="_blank"
            rel="noopener"
            ><AppIcon name="send" class="site-icon is-sm" />{{ t('siteLegalQuestionsSupport') }}</a
          >
          <NuxtLink class="site-btn is-secondary" :to="path('/about')">{{ t('siteCrumbAbout') }}</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
