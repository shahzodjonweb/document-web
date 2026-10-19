<script setup lang="ts">
const { t, path } = useLocale()
const ws = useWorkspace()
const { sorted, name, description } = useTools()
// The public page offers the file tools a visitor can use straight away; the
// AI services have their own section.
const tools = computed(() => sorted.value.filter((f) => !isGenerationFeature(f.id)).slice(0, 5))
const services = ['ai.pdf_topic', 'ai.pptx', 'ai.cv']
// Each plan's price in so'm, with its discount when one is on.
const { money, discount, price, untilLabel } = usePricing()
const priced = computed(() =>
  ws.plans.value.map((plan: any) => ({ plan, deal: discount(plan), today: price(plan) })),
)
// Each card says what a week holds: its AI documents and file tasks.
const { allowances } = usePlanPhrases()
const faq = ['faqFree', 'faqPay', 'faqFiles', 'faqTelegram']
</script>
<template>
  <section class="landing-hero">
    <div class="hero-copy">
      <h1>{{ t('heroTitle') }}</h1>
      <p>{{ t('heroBody') }}</p>
      <div class="hero-actions">
        <NuxtLink :to="path('/app')" class="button primary"
          >{{ t('start') }}<AppIcon name="right" :size="18" /></NuxtLink
        ><NuxtLink :to="path('/tools')" class="button secondary">{{ t('exploreTools') }}</NuxtLink>
      </div>
      <small><AppIcon name="check" :size="15" />{{ t('noInstall') }}</small>
    </div>
    <div class="hero-shot" aria-hidden="true">
      <div class="shot-window">
        <div class="shot-bar"><span /><span /><span /></div>
        <div class="shot-body">
          <div class="shot-prompt">
            <span class="tool-icon ai"><AppIcon name="sparkle" :size="18" /></span>
            <p>{{ t('heroShotPrompt') }}</p>
          </div>
          <div class="shot-chips"><span>PDF</span><span>O‘zbekcha</span><span>5 {{ t('pages') }}</span></div>
          <div class="shot-result">
            <span class="file-tile"><AppIcon name="file" :size="18" /></span>
            <div>
              <strong>{{ t('heroShotFile') }}</strong><small>5 {{ t('pages') }} · 1.2 MB</small>
            </div>
            <span class="status-badge succeeded">{{ t('succeeded') }}</span>
          </div>
          <div class="shot-tools">
            <span><AppIcon name="merge" :size="15" />{{ name('pdf.merge') }}</span>
            <span><AppIcon name="compress" :size="15" />{{ name('pdf.compress') }}</span>
            <span><AppIcon name="split" :size="15" />{{ name('pdf.split') }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
  <DiscountBanner compare />

  <section class="landing-benefits">
    <div>
      <span class="tool-icon"><AppIcon name="shield" :size="20" /></span>
      <h2>{{ t('privateTitle') }}</h2>
      <p>{{ t('benefitPrivateBody') }}</p>
    </div>
    <div>
      <span class="tool-icon"><AppIcon name="sparkle" :size="20" /></span>
      <h2>{{ t('benefitAiTitle') }}</h2>
      <p>{{ t('benefitAiBody') }}</p>
    </div>
    <div>
      <span class="tool-icon"><AppIcon name="send" :size="20" /></span>
      <h2>{{ t('consistentTitle') }}</h2>
      <p>{{ t('consistentBody') }}</p>
    </div>
  </section>

  <section class="landing-section">
    <div class="section-heading">
      <div>
        <h2>{{ t('navCreate') }}</h2>
        <p>{{ t('aiSectionBody') }}</p>
      </div>
    </div>
    <div class="ai-shortcuts">
      <NuxtLink
        v-for="service in services"
        :key="service"
        :to="path(`/app/create?feature=${encodeURIComponent(service)}`)"
        class="ai-shortcut panel"
        ><span class="tool-icon ai"><AppIcon name="sparkle" :size="22" /></span
        ><span class="ai-shortcut-copy"
          ><strong>{{ name(service) }}</strong><span>{{ description(service) }}</span></span
        ><span class="button secondary small">{{ t('tryIt') }}</span></NuxtLink
      >
    </div>
  </section>

  <section class="landing-section landing-tools">
    <div class="section-heading">
      <h2>{{ t('homeTools') }}</h2>
      <NuxtLink :to="path('/tools')" class="text-link"
        >{{ t('viewAll') }}<AppIcon name="right" :size="16"
      /></NuxtLink>
    </div>
    <div v-if="tools.length" class="quick-tools">
      <ToolCard v-for="feature in tools" :key="feature.id" :feature="feature" compact public-view />
    </div>
    <p v-else class="muted">{{ t('noCatalog') }}</p>
  </section>

  <section v-if="ws.plans.value.length" class="landing-section">
    <div class="section-heading">
      <div>
        <h2>{{ t('pricingTitle') }}</h2>
        <p>{{ t('pricingBody') }}</p>
      </div>
      <NuxtLink :to="path('/pricing')" class="text-link"
        >{{ t('comparePlans') }}<AppIcon name="right" :size="16"
      /></NuxtLink>
    </div>
    <div class="pricing-teaser">
      <NuxtLink v-for="{ plan, deal, today } in priced" :key="plan.id" :to="path('/pricing')" class="panel"
        ><strong>{{ t(plan.id) }}</strong
        ><s v-if="deal" class="teaser-regular"
          ><span class="visually-hidden">{{ t('regularPrice') + ' ' }}</span>{{ money(deal.regular) }}</s
        ><span class="teaser-price"
          >{{ money(today) }} <span v-if="deal" class="discount-badge">−{{ deal.percent }}%</span></span
        ><span v-if="deal" class="discount-until">{{ untilLabel(deal) }}</span
        ><span v-for="(row, index) in allowances(plan).slice(0, 2)" :key="index" class="teaser-week"
          >{{ row.pre }}{{ row.value }}{{ row.post }}</span
        ><small>{{
          t(plan.id === 'free' ? 'planFreeBody' : plan.id === 'plus' ? 'planPlusBody' : 'planPremiumBody')
        }}</small></NuxtLink
      >
    </div>
  </section>

  <section class="landing-section">
    <div class="section-heading">
      <h2>{{ t('faqTitle') }}</h2>
    </div>
    <div class="faq panel">
      <details v-for="item in faq" :key="item">
        <summary>{{ t(`${item}Q`) }}</summary>
        <p>{{ t(`${item}A`) }}</p>
      </details>
    </div>
  </section>

  <section class="landing-cta panel">
    <h2>{{ t('ctaTitle') }}</h2>
    <NuxtLink :to="path('/app')" class="button primary"
      >{{ t('start') }}<AppIcon name="right" :size="17"
    /></NuxtLink>
  </section>
</template>
