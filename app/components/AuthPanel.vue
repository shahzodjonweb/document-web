<script setup lang="ts">
const { t, path } = useLocale()
const route = useRoute()
const ws = useWorkspace()
const auth = useAuthentication()
const busy = ref(false)
const error = ref('')
onMounted(auth.loadProviders)
// Only the ways in that work right now are offered; a method that is switched
// off or not configured is left out rather than shown with an apology.
const telegram = computed(() => auth.ready('telegram'))
const google = computed(() => auth.ready('google'))
const email = computed(() => auth.ready('email'))
const loaded = computed(() => !!auth.providers.value)
const none = computed(() => loaded.value && !telegram.value && !google.value && !email.value)
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
async function startGoogle() {
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
    <span class="auth-mark" aria-hidden="true"><BrandIcon /></span>
    <h1>{{ t('signIn') }}</h1>
    <p class="auth-lead">{{ t('signInBody') }}</p>
    <div class="auth-card panel">
      <ErrorBanner v-if="error" :message="error" />
      <ErrorBanner v-if="auth.providerError.value" :message="t('authProvidersFailed')"
        ><button class="text-link" @click="auth.loadProviders">{{ t('retry') }}</button></ErrorBanner
      >
      <div v-if="!loaded && !auth.providerError.value" class="auth-loading" role="status">
        <span class="visually-hidden">{{ t('loading') }}</span>
        <span class="skeleton" /><span class="skeleton" />
      </div>
      <div v-else-if="none" class="info-banner" role="status">
        <AppIcon name="alert" :size="17" />
        <p>{{ t('signInUnavailable') }}</p>
        <button class="text-link" type="button" @click="auth.loadProviders">{{ t('retry') }}</button>
      </div>
      <template v-else-if="loaded">
        <div v-if="telegram || google" class="auth-social-options">
          <TelegramSignIn v-if="telegram" :disabled="busy" @authenticated="authenticated" />
          <button v-if="google" class="button secondary" type="button" :disabled="busy" @click="startGoogle">
            <span class="google-letter" aria-hidden="true">G</span>{{ t('authContinueGoogle') }}
          </button>
        </div>
        <div v-if="email && (telegram || google)" class="auth-divider">
          <span>{{ t('authOrEmail') }}</span>
        </div>
        <EmailSignIn v-if="email" :disabled="busy" @authenticated="authenticated" />
      </template>
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
