<script setup lang="ts">
const { t, path, date } = useLocale()
const ws = useWorkspace()
const usage = computed(() => ws.usage.value as any)
const meters = computed(() => usage.value?.meters || {})
const limit = (plan: any, key: string) => plan.limits?.[key] ?? plan[key]
</script>
<template>
  <div class="page-heading">
    <div>
      <div class="eyebrow">{{ t('billing') }}</div>
      <h1>{{ t('usageTitle') }}</h1>
      <p>{{ t('usageSub') }}</p>
    </div>
  </div>
  <section v-if="ws.user.value && usage" class="panel allowance-panel">
    <div class="section-heading">
      <h2>
        {{ t('currentPlan') }} <span class="plan-chip">{{ t(usage.plan || 'free') }}</span>
      </h2>
      <span class="muted"
        >{{ t('cycleEnd') }} {{ date(usage.resets_at || usage.period_end, true) }} ·
        {{ ws.user.value.time_zone || 'UTC' }}</span
      >
    </div>
    <div class="allowance-grid">
      <div v-for="key in ['file_tasks', 'file_page_units', 'ai_credits']" :key="key">
        <span>{{
          t(key === 'file_tasks' ? 'standardTasks' : key === 'file_page_units' ? 'pageUnits' : 'ai_credits')
        }}</span>
        <p>
          <strong>{{ meters[key]?.remaining ?? '—' }}</strong> / {{ meters[key]?.limit ?? '—' }}
          <small>{{ t('remaining') }}</small>
        </p>
        <div class="usage-track">
          <span
            :style="{
              width: meters[key]
                ? `${Math.max(0, Math.min(100, (meters[key].remaining / meters[key].limit) * 100))}%`
                : '0%',
            }"
          />
        </div>
      </div>
      <div>
        <span>{{ t('dailyAllowance') }}</span>
        <p>
          <strong>{{
            usage.daily?.limit === null ? t('unlimited') : (usage.daily?.remaining ?? '—')
          }}</strong>
          <template v-if="usage.daily?.limit !== null">/ {{ usage.daily?.limit ?? '—' }}</template>
          <small>{{ t('remaining') }}</small>
        </p>
        <small class="muted">UTC</small>
      </div>
    </div>
  </section>
  <CommercePanel v-if="ws.user.value" />
  <div v-else class="info-banner"><AppIcon name="alert" :size="19" />{{ t('checkoutUnavailable') }}</div>
  <div class="plan-grid">
    <section
      v-for="plan in ws.plans.value"
      :key="plan.id"
      class="panel plan-card"
      :class="{ current: plan.id === (ws.user.value?.plan || 'free') }"
    >
      <span class="plan-name">{{ plan.name || t(plan.id) }}</span>
      <p>
        {{ t(plan.id === 'free' ? 'planFreeBody' : plan.id === 'plus' ? 'planPlusBody' : 'planPremiumBody') }}
      </p>
      <div class="plan-price">
        <strong v-if="plan.price_xtr === 0">0 <span>Stars</span></strong
        ><strong v-else-if="plan.price_xtr !== null">{{ plan.price_xtr }} <span>Stars</span></strong
        ><span v-else>{{ t('unavailablePrice') }}</span
        ><small>{{ t('perPeriod') }}</small>
      </div>
      <ul>
        <li>
          <AppIcon name="check" :size="17" /><strong>{{ limit(plan, 'file_tasks') }}</strong
          >{{ t('standardTasks') }}
        </li>
        <li>
          <AppIcon name="check" :size="17" /><strong>{{ limit(plan, 'file_page_units') }}</strong
          >{{ t('pageUnits') }}
        </li>
        <li>
          <AppIcon name="check" :size="17" /><strong>{{ limit(plan, 'max_file_mib') }} MB</strong
          >{{ t('fileLimit') }}
        </li>
        <li>
          <AppIcon name="check" :size="17" /><strong>{{ limit(plan, 'max_pages_per_job') }}</strong
          >{{ t('jobLimit') }}
        </li>
        <!-- The length of an AI document is what separates the plans, so it is
             listed rather than left for someone to discover at a clamp. -->
        <li>
          <AppIcon name="check" :size="17" /><strong>{{ limit(plan, 'max_generated_pdf_pages') }}</strong
          >{{ t('generatedPagesLimit') }}
        </li>
        <li>
          <AppIcon name="check" :size="17" /><strong>{{ limit(plan, 'max_generated_slides') }}</strong
          >{{ t('generatedSlidesLimit') }}
        </li>
        <li v-if="limit(plan, 'max_deck_images') !== undefined">
          <AppIcon name="check" :size="17" /><strong>{{ limit(plan, 'max_deck_images') }}</strong
          >{{ t('photosPerDeck') }}
        </li>
        <li>
          <AppIcon name="check" :size="17" /><strong>{{ limit(plan, 'ai_credits') }}</strong
          >{{ t('ai_credits') }}
        </li>
      </ul>
      <span
        v-if="plan.id === (ws.user.value?.plan || 'free')"
        class="button secondary full current-plan-label"
        ><AppIcon name="check" :size="16" />{{ t('currentPlan') }}</span
      ><button v-else class="button secondary full" disabled>{{ t('notAvailable') }}</button>
    </section>
  </div>
  <p class="directory-note"><AppIcon name="shield" :size="16" />{{ t('retention') }}</p>
</template>
