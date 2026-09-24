<script setup lang="ts">
/** Empty state: drop a PDF in, or reopen an editing session already in progress. */
const { t, path, date } = useLocale()
const ws = useWorkspace()
const session = useEditorSession()

const input = ref<HTMLInputElement>()
const dragging = ref(false)
const documents = ref<any[]>([])
const busy = ref('')
const error = ref('')

async function load() {
  try {
    documents.value = (await ws.api<{ results: any[] }>('/editor/documents')).results ?? []
  } catch {
    // An empty list is the right fallback; the upload path still works.
  }
}
onMounted(load)

async function upload(list: FileList | null) {
  const file = list?.[0]
  if (!file) return
  busy.value = 'upload'
  error.value = ''
  try {
    const body = new FormData()
    body.append('file', file)
    const asset = await ws.api<{ id: string }>('/files/uploads', { method: 'POST', body })
    const created = await ws.api<{ id: string }>('/editor/documents', {
      method: 'POST',
      body: { file_id: asset.id },
    })
    await navigateTo(path(`/app/editor/${created.id}`))
  } catch (e) {
    error.value = session.requestError(e)
  } finally {
    busy.value = ''
    if (input.value) input.value.value = ''
  }
}

function onDrop(event: DragEvent) {
  dragging.value = false
  void upload(event.dataTransfer?.files || null)
}

async function remove(id: string) {
  try {
    await ws.api(`/editor/documents/${id}`, { method: 'DELETE' })
    documents.value = documents.value.filter((item) => item.id !== id)
  } catch (e) {
    error.value = session.requestError(e)
  }
}
</script>

<template>
  <div class="editor-launcher">
    <div class="page-heading">
      <div>
        <span class="eyebrow">{{ t('editor') }}</span>
        <h1>{{ t('editorTitle') }}</h1>
        <p>{{ t('editorSub') }}</p>
      </div>
    </div>

    <ErrorBanner v-if="error" :message="error" />

    <div
      class="workspace-drop"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <span class="upload-circle"><AppIcon name="upload" :size="26" /></span>
      <h2>{{ t('openEditor') }}</h2>
      <p>{{ t('editorToolHint') }}</p>
      <button type="button" class="button primary" :disabled="!!busy" @click="input?.click()">
        <AppIcon name="upload" :size="17" />{{ busy ? t('working') : t('chooseFiles') }}
      </button>
      <input
        ref="input"
        type="file"
        accept=".pdf"
        class="visually-hidden"
        data-testid="editor-upload"
        :aria-label="t('chooseFiles')"
        @change="upload(($event.target as HTMLInputElement).files)"
      />
    </div>

    <section v-if="documents.length" class="editor-recent">
      <h2>{{ t('editorRecentDocuments') }}</h2>
      <div v-for="item in documents" :key="item.id" class="editor-recent-row">
        <NuxtLink :to="path(`/app/editor/${item.id}`)">
          <AppIcon name="file" :size="18" />
          <span>{{ item.file?.name }}</span>
          <small>{{ t('version') }} {{ item.version }} · {{ date(item.file?.expires_at) }}</small>
          <AppIcon name="chevron" :size="16" />
        </NuxtLink>
        <button type="button" class="icon-button" :aria-label="t('editorDeleteDocument')" @click="remove(item.id)">
          <AppIcon name="trash" :size="16" />
        </button>
      </div>
    </section>
  </div>
</template>
