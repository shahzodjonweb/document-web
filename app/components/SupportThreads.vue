<script setup lang="ts">
const props = defineProps<{ latestId?: string }>()
const { t, date } = useLocale()
const ws = useWorkspace()
const tickets = ref<any[]>([])
const selected = ref<any>(null)
const thread = ref<any>(null)
const reply = ref('')
const error = ref('')
const busy = ref(false)
async function load() {
  try {
    tickets.value = (await ws.api('/support')).results || []
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  }
}
async function open(ticket: any) {
  selected.value = ticket
  error.value = ''
  try {
    thread.value = await ws.api(`/support/${ticket.id}/messages`)
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  }
}
onMounted(load)
watch(
  () => props.latestId,
  async (id) => {
    await load()
    const item = tickets.value.find((v) => v.id === id)
    if (item) await open(item)
  },
)
async function send() {
  busy.value = true
  error.value = ''
  try {
    thread.value = await ws.api(`/support/${selected.value.id}/messages`, {
      method: 'POST',
      body: { message: reply.value },
    })
    reply.value = ''
    await load()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="support-threads">
    <div class="section-heading">
      <h2>{{ t('supportConversations') }}</h2>
      <button class="text-link" @click="load"><AppIcon name="rotate" :size="15" />{{ t('refresh') }}</button>
    </div>
    <ErrorBanner v-if="error" :message="error" />
    <p v-if="!tickets.length" class="panel empty-conversations">{{ t('noConversations') }}</p>
    <div v-else class="support-thread-layout">
      <aside class="panel ticket-list">
        <button
          v-for="ticket in tickets"
          :key="ticket.id"
          :class="{ active: selected?.id === ticket.id }"
          @click="open(ticket)"
        >
          <span
            ><strong>{{ ticket.subject }}</strong
            ><small>{{ date(ticket.created_at, true) }}</small></span
          ><AppIcon name="chevron" :size="15" />
        </button>
      </aside>
      <section v-if="thread" class="panel ticket-thread">
        <div class="panel-heading">
          <h3>{{ selected.subject }}</h3>
          <button class="icon-button" @click="open(selected)" :aria-label="t('refresh')">
            <AppIcon name="rotate" :size="16" />
          </button>
        </div>
        <article
          v-for="message in thread.messages"
          :key="message.id"
          class="ticket-message"
          :class="message.sender"
        >
          <div>
            <strong>{{ t(message.sender === 'staff' ? 'supportTeam' : 'you') }}</strong
            ><time>{{ date(message.created_at, true) }}</time>
          </div>
          <p>{{ message.message }}</p>
        </article>
        <form @submit.prevent="send">
          <label class="form-field"
            ><span>{{ t('reply') }}</span
            ><textarea v-model="reply" rows="3" maxlength="4000" minlength="1" required /></label
          ><button class="button primary" :disabled="busy || !reply.trim()">
            {{ busy ? t('working') : t('sendMessage') }}<AppIcon name="send" :size="16" />
          </button>
        </form>
      </section>
      <section v-else class="panel empty-conversations">{{ t('selectConversation') }}</section>
    </div>
  </section>
</template>
