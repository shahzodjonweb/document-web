<script setup lang="ts">
const { t } = useLocale()
const route = useRoute()
const ws = useWorkspace()
// Only the message is asked for. The topic comes from where the customer came
// from ("Ask about this payment", a task page), the subject from the payment
// reference or the message's first line.
const topic = computed(() => (route.query.topic === 'billing' ? 'billing' : route.query.job ? 'processing' : 'other'))
const about = computed(() =>
  route.query.topic === 'billing' && route.query.ref
    ? t('paymentQuestion', { ref: String(route.query.ref).slice(0, 40) })
    : '',
)
const message = ref('')
const busy = ref(false)
const error = ref('')
const ticket = ref('')
function subject() {
  if (about.value) return about.value
  const line = message.value.trim().split('\n')[0]!.trim()
  return line.length > 80 ? `${line.slice(0, 79).trimEnd()}…` : line
}
async function send() {
  busy.value = true
  error.value = ''
  try {
    const result = await ws.api('/support', {
      method: 'POST',
      body: {
        category: topic.value,
        subject: subject(),
        message: message.value.trim(),
        job_id: typeof route.query.job === 'string' ? route.query.job : undefined,
      },
    })
    ticket.value = result.id || result.ticket_id
    message.value = ''
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div class="help-page">
    <div class="page-heading">
      <div>
        <h1>{{ t('navHelp') }}</h1>
        <p>{{ t('helpLead') }}</p>
      </div>
    </div>
    <HelpArticles guide />
    <form class="panel support-form" @submit.prevent="send">
      <h2>{{ t('writeToUs') }}</h2>
      <p class="field-hint">{{ t('writeToUsHint') }}</p>
      <ErrorBanner v-if="error" :message="error" />
      <div v-if="ticket" class="success-banner" role="status">
        <AppIcon name="checks" :size="18" />{{ t('supportSent') }} {{ ticket }}
      </div>
      <p v-if="about" class="support-about"><AppIcon name="billing" :size="16" />{{ about }}</p>
      <label class="form-field"
        ><span>{{ t('message') }}</span
        ><textarea v-model="message" rows="6" minlength="10" maxlength="4000" required /></label
      ><div class="support-actions">
        <button class="button primary" :disabled="busy || message.trim().length < 10">
          {{ busy ? t('working') : t('sendMessage') }}<AppIcon name="send" :size="17" />
        </button>
      </div>
    </form>
    <SupportThreads :latest-id="ticket" />
  </div>
</template>
