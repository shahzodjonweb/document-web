<script setup lang="ts">
const { t, path } = useLocale()
const ws = useWorkspace()
const form = reactive({ category: 'processing', subject: '', job_id: '', message: '' })
const busy = ref(false)
const error = ref('')
const ticket = ref('')
async function send() {
  busy.value = true
  error.value = ''
  try {
    const result = await ws.api('/support', {
      method: 'POST',
      body: { ...form, job_id: form.job_id || undefined },
    })
    ticket.value = result.id || result.ticket_id
    form.message = ''
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
      <h1>{{ t('supportTitle') }}</h1>
      <p>{{ t('supportSub') }}</p>
    </div>
  </div>
  <div class="support-grid">
    <form class="panel support-form" @submit.prevent="send">
      <ErrorBanner v-if="error" :message="error" />
      <div v-if="ticket" class="success-banner" role="status">
        <AppIcon name="checks" :size="18" />{{ t('supportSent') }} {{ ticket }}
      </div>
      <label class="form-field"
        ><span>{{ t('category') }}</span
        ><select v-model="form.category">
          <option value="processing">{{ t('processingIssue') }}</option>
          <option value="account">{{ t('accountIssue') }}</option>
          <option value="billing">{{ t('billingIssue') }}</option>
          <option value="other">{{ t('otherIssue') }}</option>
        </select></label
      ><label class="form-field"
        ><span>{{ t('subject') }}</span
        ><input v-model="form.subject" maxlength="160" required /></label
      ><label class="form-field"
        ><span>{{ t('jobReference') }}</span
        ><input v-model="form.job_id" /></label
      ><label class="form-field"
        ><span>{{ t('message') }}</span
        ><textarea v-model="form.message" rows="7" minlength="10" maxlength="4000" required /></label
      ><button class="button primary" :disabled="busy">
        {{ busy ? t('working') : t('sendMessage') }}<AppIcon name="send" :size="17" />
      </button>
    </form>
    <aside class="panel support-help">
      <span class="privacy-symbol"><AppIcon name="help" :size="27" /></span>
      <h2>{{ t('helpGetting') }}</h2>
      <p>{{ t('helpGettingBody') }}</p>
      <NuxtLink :to="path('/help')" class="text-link"
        >{{ t('learnMore') }}<AppIcon name="right" :size="16"
      /></NuxtLink>
    </aside>
  </div>
</template>
