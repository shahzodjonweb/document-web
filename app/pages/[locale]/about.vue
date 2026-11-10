<script setup lang="ts">
// Company and contacts (docs/site/design/pages/about.md): the page payment
// providers' reviewers look for. Plain and complete: the operator, its legal
// details from the admin Contacts setting, how to reach it and its documents.
// A detail the admin has not set yet (phone, email) is left out, never invented.
definePageMeta({ layout: 'site' })
const { t, path } = useSite()
const { contacts } = contactsState()
const company = computed(() => contacts.value?.company ?? null)
const support = computed(() => contacts.value?.support ?? null)

const copied = ref('')
async function copy(field: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = field
    setTimeout(() => {
      if (copied.value === field) copied.value = ''
    }, 2000)
  } catch {
    copied.value = ''
  }
}
const legal = [
  ['/legal/terms', 'siteLegalOfferTitle', 'siteAboutLegalOfferLine'],
  ['/legal/privacy', 'siteLegalPrivacyTitle', 'siteAboutLegalPrivacyLine'],
] as const
</script>
<template>
  <div class="site-about">
    <SiteBreadcrumb />
    <section class="site-section is-tight site-about-company" aria-labelledby="about-title">
      <div :class="['site-container site-about-top', { 'is-solo': !company }]">
        <div class="site-about-intro">
          <h1 id="about-title" class="site-h1">{{ t('siteAboutTitle') }}</h1>
          <p class="site-lead">{{ t('siteAboutBody') }}</p>
        </div>
        <div v-if="company" class="site-about-sheet site-sheet" role="region" aria-labelledby="about-requisites">
          <h2 id="about-requisites" class="site-h3">{{ t('siteAboutRequisitesTitle') }}</h2>
          <dl>
            <div v-if="company.name" class="is-wide">
              <dt>{{ t('siteAboutLegalName') }}</dt>
              <dd>{{ company.name }}</dd>
            </div>
            <div v-if="company.tin">
              <dt>{{ t('siteAboutStir') }}</dt>
              <dd class="site-about-copyrow">
                <span class="site-about-num">{{ company.tin }}</span>
                <ClientOnly>
                  <button type="button" class="site-btn is-ghost is-sm" @click="copy('tin', company.tin)">
                    <AppIcon :name="copied === 'tin' ? 'check' : 'copy'" class="site-icon is-sm" />{{
                      t(copied === 'tin' ? 'siteAboutCopied' : 'siteAboutCopy')
                    }}
                  </button>
                </ClientOnly>
              </dd>
            </div>
            <div>
              <dt>{{ t('siteAboutVat') }}</dt>
              <dd>{{ t('siteAboutVatValue') }}</dd>
            </div>
            <div v-if="company.address" class="is-wide">
              <dt>{{ t('siteAboutAddress') }}</dt>
              <dd>{{ company.address }}</dd>
            </div>
            <div v-if="company.phone">
              <dt>{{ t('siteFooterPhone') }}</dt>
              <dd><a class="site-link" :href="`tel:${company.phone.replace(/[^+\d]/g, '')}`">{{ company.phone }}</a></dd>
            </div>
            <div v-if="company.email">
              <dt>{{ t('siteFooterEmail') }}</dt>
              <dd><a class="site-link" :href="`mailto:${company.email}`">{{ company.email }}</a></dd>
            </div>
          </dl>
        </div>
      </div>
    </section>

    <section class="site-section is-band" aria-labelledby="about-contacts">
      <div class="site-container site-help-contact">
        <SiteSectionHead id="about-contacts" :title="t('siteAboutContactsTitle')" :intro="t('siteHelpContactLine')" />
        <ul class="site-help-contacts">
          <li v-if="company?.phone">
            <a :href="`tel:${company.phone.replace(/[^+\d]/g, '')}`"
              ><span class="site-tool-ico"><AppIcon name="phone" class="site-icon" /></span
              ><span><b>{{ t('siteContactPhone') }}</b><small>{{ company.phone }}</small><small>{{ t('siteContactPhoneHint') }}</small></span
              ><AppIcon name="chevron" class="site-icon is-sm"
            /></a>
          </li>
          <li v-if="company?.email">
            <a :href="`mailto:${company.email}`"
              ><span class="site-tool-ico"><AppIcon name="mail" class="site-icon" /></span
              ><span><b>{{ t('siteContactEmail') }}</b><small>{{ company.email }}</small><small>{{ t('siteContactEmailHint') }}</small></span
              ><AppIcon name="chevron" class="site-icon is-sm"
            /></a>
          </li>
          <li v-if="support?.url">
            <a :href="support.url" target="_blank" rel="noopener"
              ><span class="site-tool-ico"><AppIcon name="send" class="site-icon" /></span
              ><span><b>{{ t('siteContactTelegram') }}</b><small>@{{ support.username }}</small><small>{{ t('siteContactTelegramHint') }}</small></span
              ><AppIcon name="external" class="site-icon is-sm"
            /></a>
          </li>
          <li>
            <NuxtLink :to="path('/app/support')"
              ><span class="site-tool-ico"><AppIcon name="help" class="site-icon" /></span
              ><span><b>{{ t('siteContactInApp') }}</b><small>{{ t('siteContactInAppHint') }}</small></span
              ><AppIcon name="chevron" class="site-icon is-sm"
            /></NuxtLink>
          </li>
        </ul>
      </div>
    </section>

    <section class="site-section" aria-labelledby="about-legal">
      <div class="site-container">
        <h2 id="about-legal" class="site-h2 site-about-h2">{{ t('siteAboutLegalTitle') }}</h2>
        <ul class="site-about-docs">
          <li v-for="[to, title, line] in legal" :key="to">
            <NuxtLink :to="path(to)"
              ><span class="site-tool-ico"><AppIcon name="file" class="site-icon" /></span
              ><span><b>{{ t(title) }}</b><small>{{ t(line) }}</small></span
              ><AppIcon name="chevron" class="site-icon is-sm"
            /></NuxtLink>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
