<script setup lang="ts">
const props = withDefaults(defineProps<{ intent?: 'login' | 'link'; disabled?: boolean }>(), {
  intent: 'login',
  disabled: false,
})
const emit = defineEmits<{ authenticated: [] }>()
const { t } = useLocale()
const ws = useWorkspace()
const auth = useAuthentication()
const busy = ref(false)
const error = ref('')
const challenge = ref<{ id: string; telegram_url?: string; deep_link?: string } | null>(null)
const link = computed(() => {
  const value = challenge.value?.telegram_url || challenge.value?.deep_link
  if (!value) return ''
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' && url.hostname === 't.me') || url.protocol === 'tg:' ? value : ''
  } catch {
    return ''
  }
})
async function start() {
  busy.value = true
  error.value = ''
  try {
    challenge.value = await auth.startRequest('/auth/browser/challenges', {
      intent: props.intent,
      device_description: navigator.userAgent.split(' ').slice(-2).join(' '),
    })
    if (!link.value) error.value = t('telegramNotConfigured')
  } catch (e) {
    error.value = auth.errorMessage(e)
  } finally {
    busy.value = false
  }
}
async function check() {
  if (!challenge.value) return
  busy.value = true
  error.value = ''
  try {
    const id = encodeURIComponent(challenge.value.id)
    const result = await ws.api(`/auth/browser/challenges/${id}`)
    if (result.status === 'approved') {
      await ws.api(`/auth/browser/challenges/${id}/exchange`, { method: 'POST', body: {} })
      await auth.refreshAccount()
      challenge.value = null
      emit('authenticated')
    } else if (['expired', 'denied', 'consumed', 'rejected'].includes(result.status)) {
      challenge.value = null
      error.value = t('authTelegramExpired')
    } else error.value = t(props.intent === 'link' ? 'authAwaitingTelegramLink' : 'awaitingTelegram')
  } catch (e) {
    error.value = auth.errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div class="telegram-sign-in">
    <ErrorBanner v-if="error" :message="error" />
    <button class="button secondary" type="button" @click="start" :disabled="busy || disabled">
      <AppIcon name="send" :size="18" />{{ t(intent === 'link' ? 'authLinkTelegram' : 'openTelegram') }}
    </button>
    <div v-if="challenge && link" class="login-challenge">
      <a class="text-link" :href="link" target="_blank" rel="noopener noreferrer"
        >{{ t('authOpenTelegram') }}<AppIcon name="external" :size="15"
      /></a>
      <p>{{ t(intent === 'link' ? 'authAwaitingTelegramLink' : 'awaitingTelegram') }}</p>
      <button class="button secondary" type="button" @click="check" :disabled="busy">
        {{ busy ? t('working') : t('checkLogin') }}
      </button>
    </div>
  </div>
</template>
