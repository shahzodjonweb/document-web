<script setup lang="ts">
const { t, path, date } = useLocale()
const ws = useWorkspace()
const messages = ref<any[]>([])
const text = ref('')
const busy = ref(false)
const error = ref('')
const input = ref<HTMLInputElement>()
const feed = ref<HTMLElement>()
const quick = [
  '/start',
  '/tools',
  '/create',
  '/study',
  '/school',
  '/teach',
  '/editor',
  '/buy',
  '/usage',
  '/help',
]
function plain(value: string) {
  if (!import.meta.client) return value
  const parsed = new DOMParser().parseFromString(value || '', 'text/html')
  return parsed.body.textContent || ''
}
async function sync(data: any) {
  messages.value = data.messages || []
  await nextTick()
  feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: 'smooth' })
  const previousPlan = ws.user.value?.plan
  await ws.init()
  await ws.loadAccount()
  if (previousPlan !== ws.user.value?.plan) await ws.loadCatalog()
}
async function load() {
  busy.value = true
  try {
    await sync(await ws.api('/telegram/local/messages'))
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
onMounted(load)
async function send(value = text.value, callback = false) {
  if (!value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await sync(
      await ws.api('/telegram/local/messages', {
        method: 'POST',
        body: callback ? { callback_data: value } : { text: value },
      }),
    )
    if (!callback) text.value = ''
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
async function upload(file: File | undefined) {
  if (!file) return
  busy.value = true
  error.value = ''
  try {
    const body = new FormData()
    body.append('file', file)
    await sync(await ws.api('/telegram/local/messages', { method: 'POST', body }))
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
async function clear() {
  busy.value = true
  try {
    await sync(await ws.api('/telegram/local/messages', { method: 'DELETE' }))
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
      <span class="eyebrow">TELEGRAM · LOCAL</span>
      <h1>{{ t('botTitle') }}</h1>
      <p>{{ t('botSub') }}</p>
    </div>
    <button class="button secondary" :disabled="busy" @click="clear">
      <AppIcon name="trash" :size="17" />{{ t('clearConversation') }}
    </button>
  </div>
  <div class="provider-banner">
    <span class="provider-icon"><AppIcon name="send" :size="23" /></span>
    <div>
      <strong>{{ t('localBot') }}</strong>
      <p>{{ t('localBotNote') }}</p>
    </div>
  </div>
  <ErrorBanner v-if="error" :message="error" />
  <div class="bot-layout">
    <section class="panel bot-chat">
      <div class="bot-chat-heading">
        <span class="avatar guest-avatar"><BrandIcon /></span>
        <div>
          <strong>PDF Master</strong><small>aiogram · {{ t('localBot') }}</small>
        </div>
        <span class="status-badge">LOCAL</span>
      </div>
      <div ref="feed" class="bot-feed" aria-live="polite" :aria-label="t('botMessages')">
        <div v-if="!messages.length" class="empty-state">
          <AppIcon name="send" :size="30" />
          <h2>{{ t('botWelcome') }}</h2>
          <button class="button primary" :disabled="busy" @click="send('/start')">
            /start<AppIcon name="right" :size="16" />
          </button>
        </div>
        <article v-for="message in messages" :key="message.id" class="bot-message" :class="message.direction">
          <p>{{ plain(message.text) }}</p>
          <a
            v-if="message.asset"
            :href="message.asset.download_url"
            class="bot-asset"
            target="_blank"
            rel="noopener"
            ><img
              v-if="message.asset.preview_url"
              :src="message.asset.preview_url"
              alt=""
              loading="lazy" /><AppIcon v-else name="file" :size="25" /><span
              ><strong>{{ message.asset.name }}</strong
              ><small>{{ Math.ceil(message.asset.size_bytes / 1024) }} KB</small></span
            ><AppIcon name="download" :size="19"
          /></a>
          <div v-for="(row, index) in message.buttons || []" :key="index" class="bot-buttons">
            <template v-for="(button, i) in row" :key="i"
              ><a v-if="button.url" :href="button.url" target="_blank" rel="noopener"
                >{{ button.label }}<AppIcon name="external" :size="14" /></a
              ><button v-else :disabled="busy" @click="send(button.callback_data, true)">
                {{ button.label }}
              </button></template
            >
          </div>
          <time>{{ date(message.created_at, true) }}</time>
        </article>
        <div v-if="busy" class="bot-typing">
          <AppIcon name="loader" :size="16" class="spin" />{{ t('working') }}
        </div>
      </div>
      <form class="bot-compose" @submit.prevent="send()">
        <button
          type="button"
          class="icon-button"
          :disabled="busy"
          @click="input?.click()"
          :aria-label="t('upload')"
        >
          <AppIcon name="upload" :size="20" /></button
        ><input
          v-model="text"
          :placeholder="t('botPlaceholder')"
          :aria-label="t('message')"
          :disabled="busy"
        /><button class="button primary icon-button" :disabled="busy || !text.trim()" :aria-label="t('send')">
          <AppIcon name="send" :size="20" /></button
        ><input
          ref="input"
          class="visually-hidden"
          type="file"
          accept=".pdf,.jpg,.png,.docx,.pptx"
          @change="upload(($event.target as HTMLInputElement).files?.[0])"
          :aria-label="t('chooseFiles')"
        />
      </form>
    </section>
    <aside class="panel bot-commands">
      <h2>{{ t('botCommands') }}</h2>
      <button v-for="command in quick" :key="command" :disabled="busy" @click="send(command)">
        <code>{{ command }}</code
        ><AppIcon name="right" :size="16" /></button
      ><NuxtLink class="text-link" :to="path('/app/billing')"
        >{{ t('billing') }}<AppIcon name="arrow" :size="15"
      /></NuxtLink>
    </aside>
  </div>
</template>
