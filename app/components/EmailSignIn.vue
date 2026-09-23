<script setup lang="ts">
const props = withDefaults(defineProps<{ linking?: boolean; disabled?: boolean }>(), {
  linking: false,
  disabled: false,
})
const emit = defineEmits<{ authenticated: [] }>()
const { t, locale } = useLocale()
const ws = useWorkspace()
const auth = useAuthentication()
type Mode = 'login' | 'register' | 'reset'
const mode = ref<Mode>(props.linking ? 'register' : 'login')
const challenge = ref('')
const email = ref(props.linking ? ws.user.value?.email || ws.user.value?.google_email || '' : '')
const password = ref('')
const name = ref('')
const code = ref('')
const busy = ref(false)
const error = ref('')
const notice = ref('')
const needsPassword = computed(() => mode.value !== 'reset' || !!challenge.value)
function changeMode(value: Mode) {
  mode.value = value
  challenge.value = ''
  password.value = ''
  code.value = ''
  error.value = ''
  notice.value = ''
}
async function submit() {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    if (challenge.value) {
      if (mode.value === 'reset') {
        await ws.api('/auth/email/reset/confirm', {
          method: 'POST',
          body: { challenge_id: challenge.value, code: code.value.trim(), password: password.value },
        })
        changeMode('login')
        notice.value = t('authPasswordReset')
      } else {
        await ws.api('/auth/email/verify', {
          method: 'POST',
          body: { challenge_id: challenge.value, code: code.value.trim() },
        })
        await auth.refreshAccount()
        challenge.value = ''
        code.value = ''
        emit('authenticated')
      }
    } else if (mode.value === 'login') {
      await ws.api('/auth/email/login', {
        method: 'POST',
        body: { email: email.value.trim(), password: password.value },
      })
      await auth.refreshAccount()
      emit('authenticated')
    } else {
      const endpoint = props.linking
        ? '/auth/email/link'
        : mode.value === 'reset'
          ? '/auth/email/reset'
          : '/auth/email/register'
      const result = await ws.api<{ challenge_id: string }>(endpoint, {
        method: 'POST',
        body: {
          email: email.value.trim(),
          ...(mode.value !== 'reset' ? { password: password.value, display_name: name.value.trim() } : {}),
          locale: locale.value,
        },
      })
      challenge.value = result.challenge_id
      code.value = ''
    }
  } catch (e) {
    error.value = auth.errorMessage(e)
  } finally {
    password.value = ''
    busy.value = false
  }
}
</script>
<template>
  <div class="email-sign-in">
    <div v-if="!linking && !challenge" class="auth-tabs" :aria-label="t('authEmailOptions')">
      <button
        v-for="item in ['login', 'register'] as const"
        :key="item"
        type="button"
        :aria-pressed="mode === item"
        :class="{ selected: mode === item }"
        @click="changeMode(item)"
        :disabled="busy"
      >
        {{ t(item === 'login' ? 'authEmailSignIn' : 'authCreateAccount') }}
      </button>
    </div>
    <form @submit.prevent="submit" :aria-busy="busy" class="auth-form">
      <h3 v-if="mode === 'reset'">{{ t('authResetPassword') }}</h3>
      <ErrorBanner v-if="error" :message="error" />
      <p v-if="notice" class="success-banner" role="status">{{ notice }}</p>
      <template v-if="challenge">
        <p class="auth-code-notice" role="status">{{ t('authCodeSent', { email }) }}</p>
        <p class="field-hint">{{ t('authCodeHelp') }}</p>
        <label class="form-field"
          ><span>{{ t('authVerificationCode') }}</span
          ><input
            v-model="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]{8}"
            minlength="8"
            maxlength="8"
            required
            :disabled="busy || disabled"
        /></label>
      </template>
      <template v-else>
        <label v-if="mode === 'register' && !linking" class="form-field"
          ><span>{{ t('authDisplayName') }}</span
          ><input
            v-model="name"
            type="text"
            autocomplete="name"
            maxlength="120"
            required
            :disabled="busy || disabled"
        /></label>
        <label class="form-field"
          ><span>{{ t('authEmailAddress') }}</span
          ><input
            v-model="email"
            type="email"
            autocomplete="email"
            maxlength="254"
            required
            :disabled="busy || disabled"
        /></label>
      </template>
      <label v-if="needsPassword && (!challenge || mode === 'reset')" class="form-field"
        ><span>{{ t(mode === 'reset' ? 'authNewPassword' : 'authPassword') }}</span
        ><input
          v-model="password"
          :aria-label="t(mode === 'reset' ? 'authNewPassword' : 'authPassword')"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          :minlength="mode === 'login' ? 1 : 12"
          maxlength="128"
          required
          :disabled="busy || disabled"
        /><small v-if="mode !== 'login'">{{ t('authPasswordHint') }}</small></label
      >
      <button class="button primary" :disabled="busy || disabled" type="submit">
        {{
          busy
            ? t('working')
            : challenge
              ? t(mode === 'reset' ? 'authSavePassword' : 'authVerifyEmail')
              : t(
                  mode === 'login'
                    ? 'authEmailSignIn'
                    : mode === 'reset'
                      ? 'authSendResetCode'
                      : linking
                        ? 'authSendVerification'
                        : 'authCreateAccount',
                )
        }}<AppIcon name="right" :size="16" />
      </button>
      <button
        v-if="!linking && mode === 'login' && !challenge"
        class="text-link auth-form-switch"
        type="button"
        @click="changeMode('reset')"
        :disabled="busy"
      >
        {{ t('authForgotPassword') }}
      </button>
      <button
        v-if="challenge || mode === 'reset'"
        class="text-link auth-form-switch"
        type="button"
        @click="changeMode(linking ? 'register' : 'login')"
        :disabled="busy"
      >
        {{ t(challenge ? 'authStartAgain' : 'authBackToLogin') }}
      </button>
    </form>
  </div>
</template>
