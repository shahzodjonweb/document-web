<script setup lang="ts">
const { t } = useLocale()
const ws = useWorkspace()
const data = ref<any>(null)
const code = ref('')
const busy = ref(false)
const error = ref('')
const copied = ref(false)
const notice = ref('')
async function load() {
  busy.value = true
  try {
    data.value = await ws.api('/referrals')
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
onMounted(load)
async function copy() {
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
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">{{ t('referrals') }}</span>
      <h1>{{ t('referralTitle') }}</h1>
      <p>{{ t('referralSub') }}</p>
    </div>
  </div>
  <ErrorBanner v-if="error" :message="error" />
  <div v-if="notice" class="success-banner">{{ notice }}</div>
  <template v-if="data"
    ><section class="panel referral-link-panel">
      <span class="tool-icon sage"><AppIcon name="send" :size="27" /></span>
      <h2>{{ t(data.url ? 'yourLink' : 'referralCode') }}</h2>
      <div class="copy-field">
        <input
          :value="data.url || data.code"
          readonly
          :aria-label="t(data.url ? 'yourLink' : 'referralCode')"
        /><button class="button primary" @click="copy">
          {{ t(copied ? 'copied' : data.url ? 'copyLink' : 'copyCode') }}
        </button>
      </div>
      <p>{{ t('rewardExpiry', { days: data.expires_in_days }) }}</p>
    </section>
    <section class="referral-stats">
      <div
        v-for="[key, label] in [
          ['rewards_count', 'qualifiedInvites'],
          ['pending_count', 'pendingInvites'],
          ['awarded_credits', 'rewardCredits'],
          ['monthly_cap', 'monthlyCap'],
        ]"
        :key="key"
        class="panel"
      >
        <strong>{{ data[key!] }}</strong
        ><span>{{ t(label!) }}</span>
      </div>
    </section>
    <form class="panel referral-code-panel" @submit.prevent="apply">
      <h2>{{ t('redeemCode') }}</h2>
      <div class="copy-field">
        <label class="form-field"
          ><span>{{ t('referralCode') }}</span
          ><input v-model="code" required /></label
        ><button class="button secondary" :disabled="busy || !code.trim()">{{ t('apply') }}</button>
      </div>
    </form></template
  >
</template>
