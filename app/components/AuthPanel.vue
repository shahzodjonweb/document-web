<script setup lang="ts">
const { t, path } = useLocale()
const route = useRoute()
const ws = useWorkspace()
const auth = useAuthentication()
const busy = ref(false)
const error = ref('')
onMounted(auth.loadProviders)
async function authenticated() {
  if (route.path.includes('/auth/')) await navigateTo(path('/app'))
}
async function loginDev() {
  busy.value = true
  error.value = ''
  try {
    await ws.loginDev()
    await authenticated()
  } catch (e) {
    error.value = auth.errorMessage(e)
  } finally {
    busy.value = false
  }
}
async function google() {
  busy.value = true
  error.value = ''
  try {
    await auth.startGoogle('login')
  } catch (e) {
    error.value = auth.errorMessage(e)
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
    <div class="auth-methods">
      <ErrorBanner v-if="error" :message="error" />
      <ErrorBanner v-if="auth.providerError.value" :message="t('authProvidersFailed')"
        ><button class="text-link" @click="auth.loadProviders">{{ t('retry') }}</button></ErrorBanner
      >
      <p v-if="auth.providerLoading.value" role="status" class="field-hint">{{ t('loading') }}</p>
      <div class="auth-social-options">
        <button
          class="button secondary"
          type="button"
          @click="google"
          :disabled="busy || !auth.ready('google')"
        >
          <span class="google-letter" aria-hidden="true">G</span>{{ t('authContinueGoogle') }}
        </button>
        <small v-if="auth.providers.value && !auth.ready('google')" class="field-hint">{{
          t('authGoogleUnavailable')
        }}</small>
        <TelegramSignIn :disabled="busy || !auth.ready('telegram')" @authenticated="authenticated" />
        <small v-if="auth.providers.value && !auth.ready('telegram')" class="field-hint">{{
          t('telegramNotConfigured')
        }}</small>
      </div>
      <div class="auth-divider">
        <span>{{ t('authOrEmail') }}</span>
      </div>
      <EmailSignIn :disabled="busy || !auth.ready('email')" @authenticated="authenticated" />
      <p v-if="auth.providers.value && !auth.ready('email')" class="field-hint auth-unavailable">
        {{ t('authEmailUnavailable') }}
      </p>
    </div>
    <div v-if="ws.devAvailable.value" class="dev-login">
      <span>{{ t('beta') }}</span
      ><button class="button secondary" @click="loginDev" :disabled="busy">
        {{ busy ? t('working') : t('devLogin') }}<AppIcon name="right" :size="16" /></button
      ><small>{{ t('devNotice') }}</small>
    </div>
    <p class="auth-privacy"><AppIcon name="shield" :size="15" />{{ t('secureNote') }}</p>
  </section>
</template>
