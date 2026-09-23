<script setup lang="ts">
const { t } = useLocale()
const ws = useWorkspace()
const auth = useAuthentication()
const busy = ref(false)
const error = ref('')
const notice = ref('')
const emailOpen = ref(false)
const passwordOpen = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const methods = computed(
  () =>
    ws.user.value?.login_methods || { email: false, google: false, telegram: !!ws.user.value?.telegram_id },
)
onMounted(auth.loadProviders)
async function google() {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await auth.startGoogle('link')
  } catch (e) {
    error.value = auth.errorMessage(e)
    busy.value = false
  }
}
function linked() {
  emailOpen.value = false
  notice.value = t('authMethodLinked')
}
async function changePassword() {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await ws.api('/auth/password', {
      method: 'POST',
      body: { current_password: currentPassword.value, password: newPassword.value },
    })
    await auth.refreshAccount()
    passwordOpen.value = false
    notice.value = t('authPasswordChanged')
  } catch (e) {
    error.value = auth.errorMessage(e)
  } finally {
    currentPassword.value = ''
    newPassword.value = ''
    busy.value = false
  }
}
function closePassword() {
  passwordOpen.value = false
  currentPassword.value = ''
  newPassword.value = ''
}
</script>
<template>
  <section class="panel account-sign-in" :aria-label="t('authSignInMethods')">
    <h2>{{ t('authSignInMethods') }}</h2>
    <p class="field-hint">{{ t('authOneAccount') }}</p>
    <ErrorBanner v-if="error" :message="error" />
    <ErrorBanner v-if="auth.providerError.value" :message="t('authProvidersFailed')"
      ><button class="text-link" @click="auth.loadProviders">{{ t('retry') }}</button></ErrorBanner
    >
    <p v-if="notice" class="success-banner" role="status"><AppIcon name="check" :size="17" />{{ notice }}</p>
    <ul class="linked-methods">
      <li data-auth-method="email">
        <div class="method-summary">
          <div>
            <h3>{{ t('authEmailPassword') }}</h3>
            <p>{{ methods.email ? ws.user.value?.email : t('authNotLinked') }}</p>
          </div>
          <span v-if="methods.email" class="status-badge succeeded"
            ><AppIcon name="check" :size="13" />{{ t('authLinked') }}</span
          >
        </div>
        <template v-if="methods.email">
          <button
            v-if="!passwordOpen"
            class="button secondary"
            type="button"
            @click="passwordOpen = true"
            :disabled="busy || !auth.ready('email')"
          >
            {{ t('authChangePassword') }}
          </button>
          <form v-else class="auth-form linked-method-form" @submit.prevent="changePassword">
            <label class="form-field"
              ><span>{{ t('authCurrentPassword') }}</span
              ><input
                v-model="currentPassword"
                type="password"
                autocomplete="current-password"
                maxlength="128"
                required
                :disabled="busy"
            /></label>
            <label class="form-field"
              ><span>{{ t('authNewPassword') }}</span
              ><input
                v-model="newPassword"
                :aria-label="t('authNewPassword')"
                type="password"
                autocomplete="new-password"
                minlength="12"
                maxlength="128"
                required
                :disabled="busy"
              /><small>{{ t('authPasswordHint') }}</small></label
            >
            <div class="auth-form-actions">
              <button class="button primary" :disabled="busy">
                {{ busy ? t('working') : t('authSavePassword') }}</button
              ><button class="text-link" type="button" @click="closePassword" :disabled="busy">
                {{ t('cancel') }}
              </button>
            </div>
          </form>
        </template>
        <template v-else>
          <button
            v-if="!emailOpen"
            class="button secondary"
            type="button"
            @click="emailOpen = true"
            :disabled="busy || !auth.ready('email')"
          >
            {{ t('authAddEmailPassword') }}
          </button>
          <div v-else class="linked-method-form">
            <EmailSignIn linking :disabled="busy || !auth.ready('email')" @authenticated="linked" /><button
              class="text-link"
              type="button"
              @click="emailOpen = false"
            >
              {{ t('cancel') }}
            </button>
          </div>
        </template>
        <p v-if="auth.providers.value && !auth.ready('email')" class="field-hint">
          {{ t('authEmailUnavailable') }}
        </p>
      </li>
      <li data-auth-method="google">
        <div class="method-summary">
          <div>
            <h3>Google</h3>
            <p>
              {{ methods.google ? ws.user.value?.google_email || ws.user.value?.email : t('authNotLinked') }}
            </p>
          </div>
          <span v-if="methods.google" class="status-badge succeeded"
            ><AppIcon name="check" :size="13" />{{ t('authLinked') }}</span
          >
        </div>
        <button
          v-if="!methods.google"
          class="button secondary"
          type="button"
          @click="google"
          :disabled="busy || !auth.ready('google')"
        >
          <span class="google-letter" aria-hidden="true">G</span>{{ t('authLinkGoogle') }}
        </button>
        <p v-if="auth.providers.value && !auth.ready('google')" class="field-hint">
          {{ t('authGoogleUnavailable') }}
        </p>
      </li>
      <li data-auth-method="telegram">
        <div class="method-summary">
          <div>
            <h3>Telegram</h3>
            <p>
              {{
                methods.telegram
                  ? ws.user.value?.telegram_user_id || ws.user.value?.telegram_id
                  : t('authNotLinked')
              }}
            </p>
          </div>
          <span v-if="methods.telegram" class="status-badge succeeded"
            ><AppIcon name="check" :size="13" />{{ t('authLinked') }}</span
          >
        </div>
        <TelegramSignIn
          v-if="!methods.telegram"
          intent="link"
          :disabled="busy || !auth.ready('telegram')"
          @authenticated="linked"
        />
        <p v-if="auth.providers.value && !auth.ready('telegram')" class="field-hint">
          {{ t('telegramNotConfigured') }}
        </p>
      </li>
    </ul>
  </section>
</template>
