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
        <div class="referral-numbers">
          <div>
            <strong class="tabular">{{ data.rewards_count }}</strong><span>{{ t('qualifiedInvites') }}</span>
          </div>
          <div>
            <strong class="tabular">{{ data.awarded_credits }}</strong><span>{{ t('rewardCredits') }}</span>
          </div>
        </div>
        <p class="field-hint">
          {{ t('rewardExpiry', { days: data.expires_in_days }) }} · {{ t('pendingInvites') }}:
          {{ data.pending_count }} · {{ t('monthlyCap') }}: {{ data.monthly_cap }}
        </p>
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
