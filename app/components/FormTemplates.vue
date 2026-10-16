<script setup lang="ts">
const props = defineProps<{ commands: any[]; fileId: string }>()
const emit = defineEmits<{ apply: [commands: any[]] }>()
const { t, locale, path } = useLocale()
const ws = useWorkspace()
const items = ref<any[]>([])
const name = ref('')
const selected = ref<any>(null)
const busy = ref(false)
const error = ref('')
const limit = ref<number | null>(null)
const fields = computed(() => props.commands.filter((c) => c.type === 'fill_form'))
const additional = ref<any[]>([])
const input = ref<HTMLInputElement>()
const quote = ref<any>(null)
const result = ref<any>(null)
const runKeys = useState<Record<string, string>>('form-batch-keys', () => ({}))
async function upload(list: FileList | null) {
  if (!list?.length) return
  busy.value = true
  error.value = ''
  try {
    for (const file of Array.from(list)) {
      const body = new FormData()
      body.append('file', file)
      additional.value.push(await ws.api('/files/uploads', { method: 'POST', body }))
    }
    quote.value = null
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
function removeFile(id: string) {
  additional.value = additional.value.filter((f) => f.id !== id)
  quote.value = null
}
async function reviewBatch() {
  busy.value = true
  error.value = ''
  try {
    quote.value = await ws.api('/batches/quotes', {
      method: 'POST',
      body: {
        feature_id: 'editor.batch_forms',
        template_id: selected.value.id,
        template_version: selected.value.version,
        input_ids: [props.fileId, ...additional.value.map((f) => f.id)],
      },
    })
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
async function runBatch() {
  busy.value = true
  error.value = ''
  try {
    const id = quote.value.id
    result.value = await ws.api('/batches', {
      method: 'POST',
      headers: { 'Idempotency-Key': runKeys.value[id] || (runKeys.value[id] = crypto.randomUUID()) },
      body: { quote_id: id },
    })
    quote.value = null
    await ws.loadAccount()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
async function load() {
  try {
    const result = await ws.api('/editor/form-templates')
    items.value = result.results
    limit.value = result.limit
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  }
}
onMounted(load)
async function save() {
  busy.value = true
  error.value = ''
  try {
    await ws.api(selected.value ? `/editor/form-templates/${selected.value.id}` : '/editor/form-templates', {
      method: selected.value ? 'PATCH' : 'POST',
      body: {
        name: name.value,
        content: { commands: fields.value },
        output_locale: locale.value,
        ...(selected.value ? { version: selected.value.version } : {}),
      },
    })
    selected.value = null
    name.value = ''
    await load()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
function use(item: any) {
  selected.value = item
  name.value = item.name
  emit('apply', JSON.parse(JSON.stringify(item.content?.commands || [])))
  quote.value = null
}
function reset() {
  selected.value = null
  name.value = ''
}
async function remove(id: string) {
  busy.value = true
  try {
    await ws.api(`/editor/form-templates/${id}`, { method: 'DELETE' })
    if (selected.value?.id === id) reset()
    await load()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="panel form-templates">
    <h2>{{ t('formTemplates') }}</h2>
    <p class="field-hint">{{ t('formTemplateHint') }}</p>
    <ErrorBanner v-if="error" :message="error" />
    <!-- Every plan keeps the same number of form templates. A cap of zero means
         saving is switched off for everyone and would always 403, so say so
         instead of offering a form that cannot work, and offer no plan. -->
    <p v-if="limit === 0" class="editor-lock" data-testid="form-templates-locked">
      <AppIcon name="lock" :size="15" />
      <span>{{ t('editorLockedTool', { tool: t('formTemplates') }) }}</span>
    </p>
    <template v-else>
    <div v-for="item in items" :key="item.id" class="form-template-row">
      <button class="text-link" @click="use(item)"><AppIcon name="files" :size="15" />{{ item.name }}</button
      ><button class="icon-button" @click="remove(item.id)" :disabled="busy" :aria-label="t('delete')">
        <AppIcon name="trash" :size="16" />
      </button>
    </div>
    <form @submit.prevent="save">
      <label class="form-field"
        ><span>{{ t('templateName') }}</span
        ><input v-model="name" required maxlength="160" /></label
      ><button class="button secondary full" :disabled="busy || !fields.length || !name.trim()">
        {{ t('saveTemplate') }}</button
      ><button v-if="selected" type="button" class="text-link" @click="reset">{{ t('resetForm') }}</button>
    </form>
    <small v-if="limit !== null">{{ items.length }} / {{ limit }}</small>
    <details v-if="selected" class="form-batch">
      <summary>{{ t('batchForms') }}</summary>
      <p class="field-hint">{{ t('batchFormHint') }}</p>
      <p class="field-hint">{{ t('currentDocumentIncluded') }}</p>
      <button class="button secondary full" :disabled="busy" @click="input?.click()">
        <AppIcon name="upload" :size="16" />{{ t('addMore') }}</button
      ><input
        ref="input"
        type="file"
        class="visually-hidden"
        multiple
        accept=".pdf"
        @change="upload(($event.target as HTMLInputElement).files)"
        :aria-label="t('batchForms')"
      />
      <div v-for="file in additional" :key="file.id" class="source-chip">
        <span>{{ file.name }}</span
        ><button class="icon-button" @click="removeFile(file.id)" :aria-label="t('remove')">
          <AppIcon name="x" :size="15" />
        </button>
      </div>
      <template v-if="quote"
        ><WeeklyLine kind="file" />
        <p v-if="quote.affordable === false" class="info-banner" data-testid="weekly-limit">
          {{ t('quotaExceeded') }}
          <NuxtLink :to="path('/app/billing')" class="text-link">{{ t('studioSeePlans') }}</NuxtLink>
        </p>
        <button class="button primary full" :disabled="busy || quote.affordable === false" @click="runBatch">
          {{ t('startProcessing') }}
        </button></template
      ><button v-else class="button primary full" :disabled="busy" @click="reviewBatch">
        {{ t('getQuote') }}
      </button>
      <div v-if="result" class="form-batch-results">
        <StatusBadge :status="result.status" /><NuxtLink
          v-for="job in result.jobs || []"
          :key="job.id"
          :to="path(`/app/jobs/${job.id}`)"
          ><AppIcon name="ready" :size="15" />{{ t('output') }}<StatusBadge :status="job.status"
        /></NuxtLink>
      </div>
    </details>
    </template>
  </section>
</template>
