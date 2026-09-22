<script setup lang="ts">
const { t, path } = useLocale()
const ws = useWorkspace()
const busy = ref(false)
const error = ref('')
const challenge = ref<any>(null)
async function login() {
  busy.value = true
  error.value = ''
  try {
    await ws.loginDev()
  } catch (e: any) {
    error.value = e.data?.error?.message || e.data?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
async function telegram() {
  busy.value = true
  error.value = ''
  try {
    challenge.value = await ws.api('/auth/browser/challenges', {
      method: 'POST',
      body: { device_description: navigator.userAgent.split(' ').slice(-2).join(' ') },
    })
    if (!challenge.value.telegram_url && !challenge.value.deep_link) error.value = t('telegramNotConfigured')
  } catch (e: any) {
    error.value = e.data?.error?.message || t('telegramNotConfigured')
  } finally {
    busy.value = false
  }
}
async function check() {
  busy.value = true
  try {
    const id = challenge.value.id
    const c = await ws.api(`/auth/browser/challenges/${id}`)
    if (c.status === 'approved') {
      await ws.api(`/auth/browser/challenges/${id}/exchange`, { method: 'POST', body: {} })
      await ws.init()
      await Promise.all([ws.loadAccount(), ws.loadCatalog(), ws.loadPlans()])
    } else error.value = t('awaitingTelegram')
  } catch {
    error.value = t('genericError')
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="auth-panel">
    <div class="auth-illustration">
      <span class="floating-paper"><AppIcon name="file" :size="60" /><i /><i /><i /></span
      ><span class="auth-seal"><AppIcon name="shield" :size="29" /></span>
    </div>
    <span class="eyebrow">{{ t('loginTitle') }}</span>
    <h1>{{ t('signIn') }}</h1>
    <p>{{ t('signInBody') }}</p>
    <ErrorBanner v-if="error" :message="error" /><button
      class="button primary"
      @click="telegram"
      :disabled="busy"
    >
      <AppIcon name="send" :size="18" />{{ t('openTelegram') }}
    </button>
    <div v-if="challenge && (challenge.telegram_url || challenge.deep_link)" class="login-challenge">
      <a
        class="text-link"
        :href="challenge.telegram_url || challenge.deep_link"
        target="_blank"
        rel="noopener"
        >{{ t('openTelegram') }}<AppIcon name="external" :size="15"
      /></a>
      <p>{{ t('awaitingTelegram') }}</p>
      <button class="button secondary" @click="check" :disabled="busy">{{ t('checkLogin') }}</button>
    </div>
    <div v-if="ws.devAvailable.value" class="dev-login">
      <span>{{ t('beta') }}</span
      ><button class="button secondary" @click="login" :disabled="busy">
        {{ busy ? t('working') : t('devLogin') }}<AppIcon name="right" :size="16" /></button
      ><small>{{ t('devNotice') }}</small>
    </div>
    <p class="auth-privacy"><AppIcon name="shield" :size="15" />{{ t('secureNote') }}</p>
  </section>
</template>
