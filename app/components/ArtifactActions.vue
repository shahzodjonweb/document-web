<script setup lang="ts">
const props = defineProps<{ artifact: any }>()
const { t, date } = useLocale()
const ws = useWorkspace()
const share = ref<any>(null)
const copied = ref(false)
const busy = ref(false)
const error = ref('')
const delivered = ref(false)
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
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div class="artifact-secondary">
    <span v-if="artifact.role === 'teacher_key'" class="status-badge"
      ><AppIcon name="lock" :size="12" />{{ t('teacherKey') }}</span
    ><button
      v-if="['learner_material', 'public_preview'].includes(artifact.role)"
      class="text-link"
      @click="createShare"
      :disabled="busy"
    >
      <AppIcon name="send" :size="15" />{{ t('shareMaterial') }}</button
    ><button class="text-link" @click="deliver" :disabled="busy || delivered">
      <AppIcon name="send" :size="15" />{{ t(delivered ? 'sentToBot' : 'sendToBot') }}</button
    ><ErrorBanner v-if="error" :message="error" />
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
