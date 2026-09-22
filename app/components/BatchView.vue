<script setup lang="ts">
const props = defineProps<{ featureId: string }>()
const { t, path } = useLocale()
const ws = useWorkspace()
const { name } = useTools()
const groups = ref<any[]>([])
const input = ref<HTMLInputElement>()
const busy = ref('')
const error = ref('')
const quote = ref<any>(null)
const result = ref<any>(null)
const target = ref('convert.pdf_to_docx')
const submissionKeys = useState<Record<string, string>>('batch-submission-keys', () => ({}))
const imageGroup = ref(0)
const conversionIds = [
  'convert.word_to_pdf',
  'convert.pptx_to_pdf',
  'convert.pdf_to_docx',
  'convert.pdf_to_xlsx',
  'pdf.to_images',
]
const child = computed(() =>
  props.featureId === 'batch.compress'
    ? 'pdf.compress'
    : props.featureId === 'batch.image_sets'
      ? 'pdf.images_to_pdf'
      : target.value,
)
const schema = computed(() => (ws.features.value.find((f) => f.id === child.value) as any)?.parameters)
const parameters = ref<Record<string, any>>({})
async function run(task: string, fn: () => Promise<void>) {
  busy.value = task
  error.value = ''
  try {
    await fn()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = ''
  }
}
watch(
  () => props.featureId,
  () => {
    groups.value = []
    quote.value = null
    result.value = null
  },
)
watch([target, parameters], () => (quote.value = null), { deep: true })
async function upload(list: FileList | null) {
  if (!list?.length) return
  await run('upload', async () => {
    const uploaded = []
    for (const file of Array.from(list)) {
      const body = new FormData()
      body.append('file', file)
      uploaded.push(await ws.api('/files/uploads', { method: 'POST', body }))
    }
    if (props.featureId === 'batch.image_sets') {
      groups.value.push({ files: uploaded, feature_id: child.value, parameters: { ...parameters.value } })
    } else
      for (const file of uploaded)
        groups.value.push({ files: [file], feature_id: child.value, parameters: { ...parameters.value } })
    quote.value = null
  })
}
function remove(index: number) {
  groups.value.splice(index, 1)
  quote.value = null
}
async function review() {
  await run('quote', async () => {
    quote.value = await ws.api('/batches/quotes', {
      method: 'POST',
      body: {
        feature_id: props.featureId,
        groups: groups.value.map((g) => ({
          input_ids: g.files.map((f: any) => f.id),
          feature_id: g.feature_id,
          parameters: g.parameters,
        })),
      },
    })
  })
}
async function execute() {
  await run('run', async () => {
    const id = quote.value.id
    const key = submissionKeys.value[id] || (submissionKeys.value[id] = crypto.randomUUID())
    sessionStorage.setItem(
      'pdf-master-pending-batch',
      JSON.stringify({ quote_id: id, key, feature_id: props.featureId }),
    )
    result.value = await ws.api('/batches', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: { quote_id: quote.value.id },
    })
    sessionStorage.removeItem('pdf-master-pending-batch')
    quote.value = null
    await ws.loadAccount()
  })
}
onMounted(async () => {
  const pending = JSON.parse(sessionStorage.getItem('pdf-master-pending-batch') || 'null')
  if (pending && pending.feature_id === props.featureId)
    await run('resume', async () => {
      result.value = await ws.api('/batches', {
        method: 'POST',
        headers: { 'Idempotency-Key': pending.key },
        body: { quote_id: pending.quote_id },
      })
      sessionStorage.removeItem('pdf-master-pending-batch')
      await ws.loadAccount()
    })
})
async function resume() {
  await run('resume', async () => {
    result.value = await ws.api(`/batches/${result.value.id}/resume`, { method: 'POST' })
    await ws.loadAccount()
  })
}
</script>
<template>
  <NuxtLink class="back-link" :to="path('/app/tools')"
    ><AppIcon name="back" :size="16" />{{ t('backTools') }}</NuxtLink
  >
  <div class="page-heading">
    <div>
      <span class="eyebrow">{{ t('automationCategory') }}</span>
      <h1>{{ name(featureId) }}</h1>
      <p>{{ t('batchSub') }}</p>
    </div>
  </div>
  <ErrorBanner v-if="error" :message="error" />
  <div class="studio-layout">
    <section class="panel studio-form">
      <h2>{{ t('inputFiles') }}</h2>
      <label v-if="featureId === 'batch.convert'" class="form-field"
        ><span>{{ t('tool') }}</span
        ><select v-model="target">
          <option v-for="id in conversionIds" :key="id" :value="id">{{ name(id) }}</option>
        </select></label
      ><SchemaFields v-model="parameters" :schema="schema" />
      <p class="field-hint">
        {{ t(featureId === 'batch.image_sets' ? 'imageGroupHint' : 'batchFilesHint') }}
      </p>
      <button class="button secondary" :disabled="!!busy" @click="input?.click()">
        <AppIcon name="upload" :size="17" />{{
          t(featureId === 'batch.image_sets' ? 'addImageGroup' : 'chooseFiles')
        }}</button
      ><input
        ref="input"
        type="file"
        class="visually-hidden"
        multiple
        :accept="
          featureId === 'batch.image_sets'
            ? '.jpg,.jpeg,.png'
            : featureId === 'batch.compress'
              ? '.pdf'
              : '.pdf,.docx,.pptx'
        "
        @change="upload(($event.target as HTMLInputElement).files)"
        :aria-label="t('chooseFiles')"
      />
      <div v-for="(group, index) in groups" :key="index" class="batch-group">
        <div class="panel-heading">
          <h3>{{ index + 1 }} · {{ name(group.feature_id) }}</h3>
          <button class="icon-button" @click="remove(index)" :aria-label="t('remove')">
            <AppIcon name="x" :size="17" />
          </button>
        </div>
        <div v-for="file in group.files" :key="file.id" class="source-chip">
          <AppIcon name="file" :size="18" /><span>{{ file.name }}</span
          ><small>{{ file.page_count }} {{ t('pages') }}</small>
        </div>
      </div>
      <p v-if="!groups.length" class="empty-batch">{{ t('pickFirst') }}</p>
    </section>
    <aside>
      <section class="panel studio-quote">
        <h2>{{ t('reviewTitle') }}</h2>
        <p>{{ t('batchBilling') }}</p>
        <template v-if="quote"
          ><div v-for="meter in quote.meters" :key="meter.meter" class="meter-row">
            <span>{{
              t(
                meter.meter === 'file_tasks'
                  ? 'standardTasks'
                  : meter.meter === 'file_page_units'
                    ? 'pageUnits'
                    : meter.meter,
              )
            }}</span
            ><strong>{{ meter.amount }}</strong>
          </div>
          <button
            class="button primary full"
            :disabled="!!busy || quote.affordable === false"
            @click="execute"
          >
            {{ busy ? t('working') : t('startProcessing') }}
          </button></template
        ><button v-else class="button primary full" :disabled="!!busy || !groups.length" @click="review">
          {{ busy ? t('working') : t('getQuote') }}
        </button>
      </section>
    </aside>
  </div>
  <section v-if="result" class="panel batch-result">
    <div class="panel-heading">
      <h2>{{ t('output') }}</h2>
      <StatusBadge :status="result.status" />
    </div>
    <div v-for="child in result.children" :key="child.index" class="batch-child">
      <span>{{ child.index + 1 }}</span
      ><strong>{{ name(child.feature_id) }}</strong
      ><StatusBadge :status="child.status" /><NuxtLink
        v-if="child.job"
        class="text-link"
        :to="path(`/app/jobs/${child.job.id}`)"
        >{{ t('view') }}<AppIcon name="arrow" :size="15"
      /></NuxtLink>
      <p v-if="child.error">{{ child.error.message || child.error.code || child.error }}</p>
    </div>
    <button
      v-if="!['succeeded', 'failed'].includes(result.status)"
      class="button secondary"
      :disabled="!!busy"
      @click="resume"
    >
      {{ t('resumeBatch') }}
    </button>
  </section>
</template>
