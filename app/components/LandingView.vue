<script setup lang="ts">
const { t, path } = useLocale()
const { sorted } = useTools()
</script>
<template>
  <section class="landing-hero">
    <div class="hero-copy">
      <span class="eyebrow"><span class="green-dot" />{{ t('landingLabel') }}</span>
      <h1>{{ t('landingTitle') }}</h1>
      <p>{{ t('landingBody') }}</p>
      <div class="hero-actions">
        <NuxtLink :to="path('/app')" class="button primary large"
          >{{ t('start') }}<AppIcon name="right" :size="18" /></NuxtLink
        ><NuxtLink :to="path('/tools')" class="text-link">{{ t('exploreTools') }}</NuxtLink>
      </div>
      <small><AppIcon name="check" :size="15" />{{ t('noInstall') }}</small>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="hero-orbit orbit-one" />
      <div class="hero-orbit orbit-two" />
      <span class="hero-spark s-one">✧</span><span class="hero-spark s-two">+</span>
      <BrandIcon class="hero-brand-icon" />
      <div class="hero-result">
        <span><AppIcon name="checks" :size="20" /></span>
        <div>
          <strong>{{ t('succeeded') }}</strong
          ><small>{{ t('secureNote') }}</small>
        </div>
        <AppIcon name="download" :size="18" />
      </div>
      <div class="hero-file-chip"><AppIcon name="merge" :size="17" />{{ t('pdf.merge.name') }}</div>
    </div>
  </section>
  <section class="landing-tools">
    <div class="section-heading">
      <div>
        <span class="eyebrow">{{ t('popularSub') }}</span>
        <h2>{{ t('popularTools') }}</h2>
      </div>
      <NuxtLink :to="path('/tools')" class="text-link"
        >{{ t('viewAll') }}<AppIcon name="right" :size="16"
      /></NuxtLink>
    </div>
    <div class="quick-tools">
      <ToolCard
        v-for="feature in sorted.slice(0, 5)"
        :key="feature.id"
        :feature="feature"
        compact
        public-view
      />
    </div>
    <p v-if="!sorted.length" class="muted">{{ t('noCatalog') }}</p>
  </section>
  <section class="value-section">
    <div>
      <span class="value-icon"><AppIcon name="shield" :size="26" /></span>
      <h2>{{ t('privateTitle') }}</h2>
      <p>{{ t('helpPrivacyBody') }}</p>
    </div>
    <div>
      <span class="value-icon"><AppIcon name="checks" :size="26" /></span>
      <h2>{{ t('simpleTitle') }}</h2>
      <p>{{ t('simpleBody') }}</p>
    </div>
    <div>
      <span class="value-icon"><AppIcon name="globe" :size="26" /></span>
      <h2>{{ t('consistentTitle') }}</h2>
      <p>{{ t('consistentBody') }}</p>
    </div>
  </section>
  <section class="landing-cta">
    <BrandIcon class="cta-brand-icon" />
    <h2>{{ t('publicPrivacy') }}</h2>
    <NuxtLink :to="path('/app')" class="button primary"
      >{{ t('start') }}<AppIcon name="right" :size="17"
    /></NuxtLink>
  </section>
</template>
