<script setup lang="ts">
const { t, path } = useLocale()
const ws = useWorkspace()
const { name } = useTools()
const workflows = ref<any[]>([])
const selected = ref<any>(null)
const error = ref('')
const busy = ref('')
const title = ref('')
const steps = ref<any[]>([{ feature_id: 'pdf.compress', parameters: {} }])
const files = ref<any[]>([])
const input = ref<HTMLInputElement>()
const quote = ref<any>(null)
const outcome = ref<any>(null)
const runKeys = useState<Record<string, string>>('workflow-run-keys', () => ({}))
const allowedOperations = [
  'pdf.rotate',
  'pdf.extract_pages',
  'pdf.delete_pages',
  'pdf.reorder',
  'pdf.compress',
  'pdf.to_images',
  'convert.word_to_pdf',
  'convert.pptx_to_pdf',
  'ocr.searchable_pdf',
  'ocr.extract_text',
  'convert.pdf_to_docx',
  'convert.pdf_to_xlsx',
]
const operations = computed(() => ws.features.value.filter((f) => allowedOperations.includes(f.id)))
async function run(action: string, fn: () => Promise<void>) {
  busy.value = action
  error.value = ''
  try {
    await fn()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = ''
  }
}
async function load() {
  await run('load', async () => {
    const data = await ws.api('/workflows')
    workflows.value = data.results || []
  })
}
onMounted(load)
function edit(item: any) {
  selected.value = item
  title.value = item.name
  steps.value = JSON.parse(JSON.stringify(item.steps || []))
  quote.value = null
  outcome.value = null
}
function reset() {
  selected.value = null
  title.value = ''
  steps.value = [{ feature_id: 'pdf.compress', parameters: {} }]
  quote.value = null
  outcome.value = null
}
function changeStep(step: any) {
  step.parameters = {}
  quote.value = null
}
function removeStep(index: number) {
  steps.value.splice(index, 1)
  quote.value = null
}
function removeFile(id: string) {
  files.value = files.value.filter((f) => f.id !== id)
  quote.value = null
}
function move(index: number, direction: number) {
  const to = index + direction
  if (to < 0 || to >= steps.value.length) return
  ;[steps.value[index], steps.value[to]] = [steps.value[to], steps.value[index]]
  quote.value = null
}
async function save() {
  await run('save', async () => {
    const data = await ws.api(selected.value ? `/workflows/${selected.value.id}` : '/workflows', {
      method: selected.value ? 'PATCH' : 'POST',
      body: {
        name: title.value,
        steps: steps.value,
        ...(selected.value ? { version: selected.value.version } : {}),
      },
    })
    edit(data)
    const all = await ws.api('/workflows')
    workflows.value = all.results || []
  })
}
async function remove(id: string) {
  await run('delete', async () => {
    await ws.api(`/workflows/${id}`, { method: 'DELETE' })
    reset()
    const all = await ws.api('/workflows')
    workflows.value = all.results || []
  })
}
async function upload(list: FileList | null) {
  if (!list?.length) return
  await run('upload', async () => {
    for (const f of Array.from(list)) {
      const data = new FormData()
      data.append('file', f)
      files.value.push(await ws.api('/files/uploads', { method: 'POST', body: data }))
    }
    quote.value = null
  })
}
async function review() {
  await run('quote', async () => {
    quote.value = await ws.api(`/workflows/${selected.value.id}/quote`, {
      method: 'POST',
      body: { input_ids: files.value.map((f) => f.id) },
    })
  })
}
async function execute() {
  await run('run', async () => {
    outcome.value = await ws.api(`/workflows/${selected.value.id}/run`, {
      method: 'POST',
      headers: {
        'Idempotency-Key':
          runKeys.value[quote.value.confirmation_token] ||
          (runKeys.value[quote.value.confirmation_token] = crypto.randomUUID()),
      },
      body: {
        version: quote.value.version,
        input_ids: quote.value.input_ids || files.value.map((f) => f.id),
        confirmed: true,
        confirmation_token: quote.value.confirmation_token,
      },
    })
    await ws.loadAccount()
    quote.value = null
  })
}
const meters = computed(() =>
  Array.isArray(quote.value?.meters)
    ? quote.value.meters
    : Object.entries(quote.value?.meters || {}).map(([meter, amount]) => ({ meter, amount })),
)
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">{{ t('workflows') }}</span>
      <h1>{{ t('workflowTitle') }}</h1>
      <p>{{ t('workflowSub') }}</p>
    </div>
    <button class="button secondary" @click="reset">
      <AppIcon name="plus" :size="17" />{{ t('newTask') }}
    </button>
  </div>
  <ErrorBanner v-if="error" :message="error" />
  <div class="workflow-layout">
    <aside class="panel workflow-list">
      <h2>{{ t('workflows') }}</h2>
      <button
        v-for="item in workflows"
        :key="item.id"
        :class="{ active: selected?.id === item.id }"
        @click="edit(item)"
      >
        <span class="tool-icon sage"><AppIcon name="reorder" :size="20" /></span
        ><span
          ><strong>{{ item.name }}</strong
          ><small>{{ item.steps?.length || 0 }} {{ t('steps') }}</small></span
        ><AppIcon name="chevron" :size="16" />
      </button>
      <p v-if="!workflows.length" class="muted">{{ t('emptyWorkflows') }}</p>
    </aside>
    <section class="panel workflow-editor">
      <div class="panel-heading">
        <h2>{{ t(selected ? 'edit' : 'saveWorkflow') }}</h2>
        <button v-if="selected" class="icon-button" @click="remove(selected.id)" :aria-label="t('delete')">
          <AppIcon name="trash" :size="18" />
        </button>
      </div>
      <label class="form-field"
        ><span>{{ t('workflowName') }}</span
        ><input v-model="title" maxlength="200"
      /></label>
      <div v-for="(step, index) in steps" :key="index" class="workflow-step">
        <span class="step-number">{{ index + 1 }}</span>
        <div>
          <label class="form-field"
            ><span>{{ t('tool') }}</span
            ><select v-model="step.feature_id" @change="changeStep(step)">
              <option v-for="feature in operations" :key="feature.id" :value="feature.id">
                {{ name(feature.id, feature.name) }}
              </option>
            </select></label
          ><SchemaFields
            v-model="step.parameters"
            :schema="(operations.find((f) => f.id === step.feature_id) as any)?.parameters"
          />
        </div>
        <div class="outline-actions">
          <button
            class="icon-button"
            :disabled="index === 0"
            @click="move(index, -1)"
            :aria-label="t('moveUp')"
          >
            <AppIcon name="up" :size="16" /></button
          ><button
            class="icon-button"
            :disabled="index === steps.length - 1"
            @click="move(index, 1)"
            :aria-label="t('moveDown')"
          >
            <AppIcon name="moveDown" :size="16" /></button
          ><button
            class="icon-button"
            :disabled="steps.length === 1"
            @click="removeStep(index)"
            :aria-label="t('delete')"
          >
            <AppIcon name="x" :size="16" />
          </button>
        </div>
      </div>
      <div class="studio-form-actions">
        <button class="button secondary" @click="steps.push({ feature_id: 'pdf.compress', parameters: {} })">
          <AppIcon name="plus" :size="16" />{{ t('addStep') }}</button
        ><button class="button primary" :disabled="!!busy || !title.trim() || !steps.length" @click="save">
          {{ busy === 'save' ? t('working') : t('saveWorkflow') }}
        </button>
      </div>
      <section v-if="selected" class="workflow-run">
        <h3>{{ t('runWorkflow') }}</h3>
        <button class="button secondary" @click="input?.click()" :disabled="!!busy">
          <AppIcon name="upload" :size="17" />{{ t('chooseFiles') }}</button
        ><input
          ref="input"
          class="visually-hidden"
          type="file"
          multiple
          accept=".pdf,.jpg,.png,.docx,.pptx"
          @change="upload(($event.target as HTMLInputElement).files)"
          :aria-label="t('chooseFiles')"
        />
        <div v-for="file in files" :key="file.id" class="source-chip">
          <AppIcon name="file" :size="17" /><span>{{ file.name }}</span
          ><button class="icon-button" @click="removeFile(file.id)" :aria-label="t('remove')">
            <AppIcon name="x" :size="15" />
          </button>
        </div>
        <div v-if="quote" class="workflow-quote">
          <div v-for="meter in meters" :key="meter.meter" class="meter-row">
            <span>{{
              t(
                meter.meter === 'file_tasks'
                  ? 'standardTask'
                  : meter.meter === 'file_page_units'
                    ? 'pageUnits'
                    : meter.meter,
              )
            }}</span
            ><strong>{{ meter.amount }}</strong>
          </div>
          <button class="button primary full" :disabled="!!busy" @click="execute">
            {{ busy === 'run' ? t('working') : t('runWorkflow') }}
          </button>
        </div>
        <button v-else class="button primary" :disabled="!!busy || !files.length" @click="review">
          {{ busy === 'quote' ? t('working') : t('getQuote') }}
        </button>
        <div v-if="outcome" class="workflow-results">
          <StatusBadge :status="outcome.status" /><NuxtLink
            v-for="job in outcome.jobs || []"
            :key="job.id"
            :to="path(`/app/jobs/${job.id}`)"
            ><AppIcon name="ready" :size="18" />{{ name(job.feature_id)
            }}<StatusBadge :status="job.status" /><AppIcon name="arrow" :size="15"
          /></NuxtLink>
        </div>
      </section>
    </section>
  </div>
</template>
