<script setup lang="ts">
import type { operations } from '../../generated/api/schema'
/**
 * Invite friends, earn Plus: the link, how far to the next reward, and the
 * Plus months earned so far. The server owns the rules (5 friends a step, one
 * month more each step, 5 counted a Tashkent month) and says them in its numbers.
 */
type Referrals = operations['getReferrals']['responses']['200']['content']['application/json']
const { t, count, date } = useLocale()
const { dayLabel } = usePricing()
const ws = useWorkspace()
const data = ref<Referrals | null>(null)
const code = ref('')
const busy = ref(false)
const error = ref('')
const copied = ref(false)
const notice = ref('')
async function load() {
  busy.value = true
  try {
    data.value = await ws.api<Referrals>('/referrals')
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
onMounted(load)
async function copy() {
  if (!data.value) return
  await navigator.clipboard.writeText(data.value.url || data.value.code)
  copied.value = true
}
async function apply() {
  busy.value = true
  error.value = ''
  try {
    await ws.api('/referrals', { method: 'POST', body: { code: code.value } })
    notice.value = t('referralApplied')
    await load()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
const months = (value: number) => count('referralMonths', value)
const share = computed(() =>
  data.value?.url
    ? `https://t.me/share/url?url=${encodeURIComponent(data.value.url)}&text=${encodeURIComponent(t('referralShareText'))}`
    : '',
)
const progress = computed(() => {
  const next = data.value?.next_reward
  return next ? `${Math.max(0, Math.min(100, (next.have / Math.max(1, data.value!.step)) * 100))}%` : '0%'
})
// Friends who joined but have not finished a task; those waiting for next month are counted apart.
const noTaskYet = computed(() =>
  data.value ? Math.max(0, data.value.pending_count - data.value.waiting_next_month) : 0,
)
// The first day of next month in Tashkent, as the plans write a day: "1 Dec", "1-dekabr", "1 декабря".
const nextMonth = computed(() => (data.value ? dayLabel(data.value.next_month.slice(0, 10)) : ''))
</script>
<template>
  <div class="referrals-page">
    <div class="page-heading">
      <div>
        <h1>{{ t('referrals') }}</h1>
        <p>{{ t('referralLead') }}</p>
      </div>
    </div>
    <ErrorBanner v-if="error" :message="error" />
    <div v-if="notice" class="success-banner" role="status"><AppIcon name="check" :size="17" />{{ notice }}</div>
    <template v-if="data">
      <section class="panel referral-link-panel">
        <h2>{{ t(data.url ? 'yourLink' : 'referralCode') }}</h2>
        <div class="copy-field">
          <input
            :value="data.url || data.code"
            readonly
            :aria-label="t(data.url ? 'yourLink' : 'referralCode')"
          /><button class="button primary" type="button" @click="copy">
            <AppIcon :name="copied ? 'check' : 'copy'" :size="16" />{{
              t(copied ? 'copied' : data.url ? 'copyLink' : 'copyCode')
            }}
          </button>
        </div>
        <a v-if="share" class="button secondary referral-share" :href="share" target="_blank" rel="noopener">
          <AppIcon name="share" :size="16" />{{ t('referralShare') }}
        </a>
      </section>
      <section class="panel referral-progress-panel" data-testid="referral-progress">
        <h2>{{ t('referralNext', { months: months(data.next_reward.months) }) }}</h2>
        <p class="referral-progress-count">
          <strong class="tabular">{{ t('referralProgress', { have: data.next_reward.have, step: data.step }) }}</strong>
        </p>
        <div
          class="usage-track"
          role="progressbar"
          :aria-valuenow="data.next_reward.have"
          aria-valuemin="0"
          :aria-valuemax="data.step"
          :aria-label="t('referralProgress', { have: data.next_reward.have, step: data.step })"
        >
          <span :style="{ width: progress }" />
        </div>
        <p v-if="data.month_full" class="referral-month-full" data-testid="referral-month-full">
          {{ t('referralMonthFull', { cap: data.monthly_cap, day: nextMonth }) }}
        </p>
        <div class="referral-numbers">
          <div>
            <strong class="tabular">{{ data.counted }}</strong><span>{{ t('referralCounted') }}</span>
          </div>
          <div v-if="data.waiting_next_month">
            <strong class="tabular">{{ data.waiting_next_month }}</strong><span>{{ t('referralNextMonth') }}</span>
          </div>
          <div>
            <strong class="tabular">{{ noTaskYet }}</strong><span>{{ t('referralNoTaskYet') }}</span>
          </div>
        </div>
        <p class="field-hint" data-testid="referral-rules">
          {{ t('referralRules', { step: data.step, cap: data.monthly_cap }) }}
        </p>
      </section>
      <section v-if="data.rewards.length" class="panel referral-rewards-panel" data-testid="referral-rewards">
        <h2>{{ t('referralEarned') }}</h2>
        <ul>
          <li v-for="reward in data.rewards" :key="reward.tier">
            <strong>{{ t('referralRewardRow', { months: months(reward.months) }) }}</strong>
            <span>{{ date(reward.starts_at || undefined) }} – {{ date(reward.ends_at || undefined) }}</span>
          </li>
        </ul>
      </section>
      <details class="panel referral-code-panel">
        <summary>{{ t('haveCode') }}</summary>
        <form class="copy-field" @submit.prevent="apply">
          <input v-model="code" required :aria-label="t('referralCode')" :placeholder="t('referralCode')" /><button
            class="button secondary"
            :disabled="busy || !code.trim()"
          >
            {{ t('apply') }}
          </button>
        </form>
      </details>
    </template>
  </div>
</template>
