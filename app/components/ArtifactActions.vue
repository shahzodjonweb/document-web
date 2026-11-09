<script setup lang="ts">
// `source` is the editor draft this file was sent from, if it was: Edit goes back to it.
// `deck` is the slide deck this file was made from, when the deck editor can open it.
const props = defineProps<{ artifact: any; source?: string; deck?: string }>()
const { t, path, date } = useLocale()
const ws = useWorkspace()
const editorV2 = useEditorV2()
const telegram = useTelegramApp()
/**
 * ✏️ Edit under a PDF, behind the editor's switch: a file sent from the editor
 * reopens the draft it came from, still undoable; any other opens a new one on it.
 */
const editable = computed(
  () =>
    !!props.deck ||
    (editorV2.value &&
      props.artifact.mime_type === 'application/pdf' &&
      !props.artifact.encrypted &&
      !!(props.source || props.artifact.file_id)),
)
// A deck's PDF opens the deck too: changing its slides is what remakes that PDF.
const editLink = computed(() =>
  path(
    props.deck
      ? `/app/editor/deck/${props.deck}`
      : props.source
        ? `/app/editor/${props.source}`
        : `/app/editor?file_id=${props.artifact.file_id}`,
  ),
)
/** Inside Telegram the bot is the chat this app was opened from. */
const inChat = computed(() => editorV2.value && telegram.isMiniApp.value)
const share = ref<any>(null)
const copied = ref(false)
const busy = ref(false)
const error = ref('')
const delivered = ref(false)
const telegramRequired = ref(false)
async function createShare() {
  busy.value = true
  error.value = ''
  try {
    share.value = await ws.api('/shares', {
      method: 'POST',
      body: { artifact_id: props.artifact.id, expires_hours: 24 },
    })
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
async function revoke() {
  busy.value = true
  try {
    await ws.api(`/shares/${share.value.id}`, { method: 'DELETE' })
    share.value = null
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
async function copy() {
  await navigator.clipboard.writeText(new URL(share.value.url, location.origin).href)
  copied.value = true
}
async function deliver() {
  busy.value = true
  error.value = ''
  try {
    await ws.api(`/artifacts/${props.artifact.id}/deliver`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    })
    delivered.value = true
  } catch (e: any) {
    telegramRequired.value = e.data?.error?.code === 'telegram_link_required'
    error.value = telegramRequired.value
      ? t('authTelegramRequired')
      : e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div class="artifact-secondary">
    <span v-if="artifact.role === 'teacher_key'" class="status-badge"
      ><AppIcon name="lock" :size="12" />{{ t('teacherKey') }}</span
    ><NuxtLink v-if="editable" :to="editLink" class="text-link" data-testid="artifact-edit">{{
      t('editorEdit')
    }}</NuxtLink
    ><button
      v-if="['learner_material', 'public_preview'].includes(artifact.role)"
      class="text-link"
      @click="createShare"
      :disabled="busy"
    >
      <AppIcon name="send" :size="15" />{{ t('shareMaterial') }}</button
    ><NuxtLink
      v-if="ws.user.value?.login_methods?.telegram === false"
      :to="path('/app/settings')"
      class="text-link"
      ><AppIcon name="send" :size="15" />{{ t('authLinkTelegram') }}</NuxtLink
    ><button v-else class="text-link" @click="deliver" :disabled="busy || delivered">
      <AppIcon name="send" :size="15" />{{
        t(delivered ? (inChat ? 'sentToChat' : 'sentToBot') : inChat ? 'sendToChat' : 'sendToBot')
      }}</button
    ><ErrorBanner v-if="error" :message="error"
      ><NuxtLink v-if="telegramRequired" :to="path('/app/settings')" class="text-link">{{
        t('authSignInMethods')
      }}</NuxtLink></ErrorBanner
    >
    <div v-if="share" class="share-panel">
      <p>{{ t('shareExpiry') }}</p>
      <div class="copy-field">
        <input :value="share.url" readonly :aria-label="t('yourLink')" /><button
          class="button secondary"
          @click="copy"
        >
          {{ t(copied ? 'copied' : 'copyLink') }}
        </button>
      </div>
      <p>{{ t('expires') }} {{ date(share.expires_at, true) }}</p>
      <button class="text-link danger-link" @click="revoke" :disabled="busy">{{ t('revokeShare') }}</button>
    </div>
  </div>
</template>
