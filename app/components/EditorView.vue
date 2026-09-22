<script setup lang="ts">
const props = defineProps<{ documentId?: string }>()
const { t, path } = useLocale()
const route = useRoute()
const ws = useWorkspace()
const editor = ref<any>(null)
const documents = ref<any[]>([])
const commands = ref<any[]>([])
const assets = ref<any[]>([])
const input = ref<HTMLInputElement>()
const imageInput = ref<HTMLInputElement>()
const page = ref(1)
const selected = ref(-1)
const busy = ref('')
const error = ref('')
const quote = ref<any>(null)
const raster = ref(false)
const naturalSize = ref({ width: 794, height: 1123 })
const previewFailed = ref(false)
const newType = ref('add_text')
const saved = ref(false)
const actions = [
  ['add_text', 'addText', 'word'],
  ['highlight', 'highlight', 'edit'],
  ['note', 'note', 'file'],
  ['fill_form', 'fillForm', 'files'],
  ['signature', 'signature', 'edit'],
  ['insert_image', 'insertImage', 'image'],
  ['replace_text', 'replaceText', 'word'],
  ['replace_image', 'replaceImage', 'image'],
  ['remove_image', 'removeImage', 'trash'],
  ['redact', 'redact', 'shield'],
]
const active = computed(() => commands.value[selected.value])
const imageActions = ['insert_image', 'signature', 'replace_image']
const size = computed(() => {
  const s = editor.value?.pages?.[page.value - 1]
  return {
    width: Number(s?.width || s?.[0] || naturalSize.value.width * 0.75),
    height: Number(s?.height || s?.[1] || naturalSize.value.height * 0.75),
  }
})
const redacted = computed(() => commands.value.some((c) => c.type === 'redact'))
const positional = (type: string) =>
  ['add_text', 'highlight', 'note', 'insert_image', 'signature', 'redact'].includes(type)
const boxTypes = ['highlight', 'insert_image', 'signature', 'redact']
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
function accept(data: any) {
  editor.value = data
  commands.value = structuredClone(data.commands || [])
  quote.value = null
  saved.value = true
}
async function load() {
  if (props.documentId)
    await run('load', async () => {
      accept(await ws.api(`/editor/documents/${props.documentId}`))
      const extras = editor.value.input_ids?.slice(1) || []
      assets.value = await Promise.all(extras.map((id: string) => ws.api(`/files/${id}`)))
      selected.value = commands.value.length ? 0 : -1
    })
  else
    await run('list', async () => {
      editor.value = null
      commands.value = []
      assets.value = []
      selected.value = -1
      page.value = 1
      documents.value = (await ws.api('/editor/documents')).results || []
    })
}
onMounted(load)
watch(() => props.documentId, load)
watch(page, () => (previewFailed.value = false))
watch(
  commands,
  () => {
    quote.value = null
    saved.value = false
  },
  { deep: true, flush: 'sync' },
)
watch(raster, () => (quote.value = null))
async function upload(file: File | undefined) {
  if (!file) return
  await run('upload', async () => {
    const body = new FormData()
    body.append('file', file)
    const asset = await ws.api('/files/uploads', { method: 'POST', body })
    accept(await ws.api('/editor/documents', { method: 'POST', body: { file_id: asset.id } }))
    await navigateTo(path(`/app/editor/${editor.value.id}`))
  })
}
async function uploadImage(file: File | undefined) {
  if (!file) return
  await run('image', async () => {
    const body = new FormData()
    body.append('file', file)
    const asset = await ws.api('/files/uploads', { method: 'POST', body })
    assets.value.push(asset)
    if (active.value) active.value.input_index = assets.value.length
  })
}
function add(type = newType.value) {
  const command: any = type === 'fill_form' ? { type } : { type, page: page.value }
  if (positional(type)) Object.assign(command, { x: 40, y: 60 })
  if (boxTypes.includes(type)) Object.assign(command, { width: 160, height: 40 })
  if (['add_text', 'note'].includes(type)) command.text = ''
  if (type === 'add_text') Object.assign(command, { font_size: 16, color: '#203c2c' })
  if (type === 'highlight') command.color = '#ffff00'
  if (type === 'replace_text') Object.assign(command, { find: '', replacement: '' })
  if (type === 'fill_form') Object.assign(command, { field: '', value: '' })
  if (imageActions.includes(type)) command.input_index = assets.value.length ? 1 : 0
  if (['replace_image', 'remove_image'].includes(type)) command.image_index = 0
  commands.value.push(command)
  selected.value = commands.value.length - 1
}
function applyFormTemplate(value: any[]) {
  commands.value = [...commands.value.filter((c) => c.type !== 'fill_form'), ...value]
  selected.value = commands.value.length - 1
}
function remove(index: number) {
  commands.value.splice(index, 1)
  selected.value = Math.min(selected.value, commands.value.length - 1)
}
function position(event: MouseEvent) {
  if (!active.value || !positional(active.value.type)) return
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  active.value.x = Math.round(((event.clientX - bounds.left) / bounds.width) * size.value.width)
  active.value.y = Math.round(((event.clientY - bounds.top) / bounds.height) * size.value.height)
  active.value.page = page.value
}
function onImage(event: Event) {
  const el = event.target as HTMLImageElement
  naturalSize.value = { width: el.naturalWidth, height: el.naturalHeight }
}
function overlay(c: any) {
  return {
    left: `${(100 * c.x) / size.value.width}%`,
    top: `${(100 * c.y) / size.value.height}%`,
    width: c.width ? `${(100 * c.width) / size.value.width}%` : undefined,
    height: c.height ? `${(100 * c.height) / size.value.height}%` : undefined,
    fontSize: c.font_size ? `${(c.font_size / size.value.width) * 100}cqw` : undefined,
    color: c.color,
    background: c.type === 'highlight' ? c.color : c.type === 'redact' ? '#111' : undefined,
  }
}
function label(type: string) {
  return t(actions.find((a) => a[0] === type)?.[1] || type)
}
async function save() {
  accept(
    await ws.api(`/editor/documents/${editor.value.id}`, {
      method: 'PATCH',
      body: {
        version: editor.value.version,
        commands: commands.value,
        input_ids: [editor.value.file.id, ...assets.value.map((a) => a.id)],
      },
    }),
  )
}
async function review() {
  await run('quote', async () => {
    await save()
    quote.value = await ws.api(`/editor/documents/${editor.value.id}/quote`, {
      method: 'POST',
      body: { version: editor.value.version, accept_rasterization: raster.value },
    })
  })
}
async function exportPDF() {
  await run('export', async () => {
    const key = crypto.randomUUID()
    sessionStorage.setItem('pdf-master-pending-job', JSON.stringify({ quote_id: quote.value.id, key }))
    const job = await ws.api('/jobs', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: { quote_id: quote.value.id },
    })
    sessionStorage.removeItem('pdf-master-pending-job')
    await ws.loadAccount()
    await navigateTo(path(`/app/jobs/${job.id}`))
  })
}
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">{{ t('editor') }}</span>
      <h1>{{ editor?.file?.name || t('editorTitle') }}</h1>
      <p>{{ t('editorSub') }}</p>
    </div>
    <button class="button secondary" @click="input?.click()" :disabled="!!busy">
      <AppIcon name="upload" :size="17" />{{ t('openEditor') }}</button
    ><input
      ref="input"
      class="visually-hidden"
      type="file"
      accept=".pdf"
      @change="upload(($event.target as HTMLInputElement).files?.[0])"
      :aria-label="t('openEditor')"
    />
  </div>
  <ErrorBanner v-if="error" :message="error" />
  <div v-if="!editor" class="panel editor-welcome">
    <div class="editor-welcome-art">
      <span class="editor-paper"><i /><i /><b /><i /><i /></span
      ><span class="editor-pencil"><AppIcon name="edit" :size="32" /></span>
    </div>
    <h2>{{ t('editorTitle') }}</h2>
    <p>{{ t('pointHint') }}</p>
    <button class="button primary" @click="input?.click()" :disabled="!!busy">
      <AppIcon name="upload" :size="17" />{{ busy ? t('working') : t('chooseFiles') }}
    </button>
    <div v-if="documents.length" class="editor-recent">
      <NuxtLink v-for="item in documents" :key="item.id" :to="path(`/app/editor/${item.id}`)"
        ><AppIcon name="file" :size="19" /><span>{{ item.file.name }}</span
        ><small>{{ t('version') }} {{ item.version }}</small
        ><AppIcon name="right" :size="16"
      /></NuxtLink>
    </div>
  </div>
  <div v-else class="editor-layout">
    <section class="editor-stage">
      <div class="panel editor-toolbar">
        <div class="preview-controls">
          <button class="icon-button" :disabled="page <= 1" @click="page--" :aria-label="t('previousPage')">
            <AppIcon name="back" :size="18" /></button
          ><span>{{ t('pageOf', { page, count: editor.file.page_count }) }}</span
          ><button
            class="icon-button"
            :disabled="page >= editor.file.page_count"
            @click="page++"
            :aria-label="t('nextPage')"
          >
            <AppIcon name="chevron" :size="18" />
          </button>
        </div>
        <span class="muted">{{ Math.round(size.width) }} × {{ Math.round(size.height) }} pt</span
        ><span class="status-badge">{{ t(saved ? 'draftSaved' : 'unsaved') }}</span>
      </div>
      <div class="editor-canvas-wrap">
        <div
          class="editor-canvas"
          @click="position"
          :style="{ aspectRatio: `${size.width}/${size.height}` }"
          :aria-label="t('preview')"
        >
          <img
            v-if="!previewFailed"
            :src="`${editor.file.preview_url}?page=${page}`"
            :alt="`${editor.file.name} · ${page}`"
            @load="onImage"
            @error="previewFailed = true"
          />
          <div v-else class="preview-error">{{ t('previewUnavailable') }}</div>
          <template v-for="(command, index) in commands" :key="index"
            ><button
              v-if="command.page === page && positional(command.type)"
              class="editor-overlay"
              :class="[command.type, { selected: index === selected }]"
              :style="overlay(command)"
              @click.stop="selected = index"
              :aria-label="`${label(command.type)} ${index + 1}`"
            >
              <template v-if="command.type === 'add_text'">{{ command.text || t('text') }}</template
              ><AppIcon v-else-if="command.type === 'note'" name="file" :size="20" /><img
                v-else-if="
                  imageActions.includes(command.type) && assets[command.input_index - 1]?.preview_url
                "
                :src="
                  assets[command.input_index - 1].preview_url ||
                  `/api/v1/files/${assets[command.input_index - 1].id}/download`
                "
                alt=""
              /><AppIcon v-else-if="imageActions.includes(command.type)" name="image" :size="24" /></button
          ></template>
        </div>
      </div>
      <p class="preview-note"><AppIcon name="help" :size="16" />{{ t('editPreviewNote') }}</p>
      <section v-if="commands.length" class="panel editor-command-list">
        <h2>
          {{ t('editorCommands') }} <span class="count-tag">{{ commands.length }}</span>
        </h2>
        <div v-for="(command, index) in commands" :key="index" :class="{ active: index === selected }">
          <button class="command-select" @click="selected = index">
            <span>{{ index + 1 }}</span
            ><strong>{{ label(command.type) }}</strong
            ><small>{{ t('page') }} {{ command.page || 1 }}</small></button
          ><button class="icon-button" @click="remove(index)" :aria-label="t('delete')">
            <AppIcon name="trash" :size="17" />
          </button>
        </div>
      </section>
    </section>
    <aside class="editor-inspector">
      <section class="panel">
        <h2>{{ t('addCommand') }}</h2>
        <div class="editor-action-grid">
          <button
            v-for="action in actions"
            :key="action[0]"
            @click="add(action[0])"
            :disabled="redacted || (action[0] === 'redact' && commands.length > 0)"
          >
            <AppIcon :name="action[2]!" :size="19" /><span>{{ t(action[1]!) }}</span>
          </button>
        </div>
      </section>
      <section v-if="active" class="panel command-fields">
        <div class="panel-heading">
          <h2>{{ label(active.type) }}</h2>
          <span class="count-tag">{{ selected + 1 }}</span>
        </div>
        <label v-if="active.type !== 'fill_form'" class="form-field"
          ><span>{{ t('page') }}</span
          ><input v-model.number="active.page" type="number" min="1" :max="editor.file.page_count" /></label
        ><template v-if="positional(active.type)"
          ><p class="field-hint">{{ t('pointHint') }}</p>
          <div class="form-row">
            <label class="form-field"
              ><span>{{ t('xCoordinate') }}</span
              ><input v-model.number="active.x" type="number" min="0" :max="size.width" /></label
            ><label class="form-field"
              ><span>{{ t('yCoordinate') }}</span
              ><input v-model.number="active.y" type="number" min="0" :max="size.height"
            /></label></div
        ></template>
        <div v-if="boxTypes.includes(active.type)" class="form-row">
          <label class="form-field"
            ><span>{{ t('width') }}</span
            ><input v-model.number="active.width" type="number" min="1" /></label
          ><label class="form-field"
            ><span>{{ t('height') }}</span
            ><input v-model.number="active.height" type="number" min="1"
          /></label>
        </div>
        <label v-if="['add_text', 'note'].includes(active.type)" class="form-field"
          ><span>{{ t('text') }}</span
          ><textarea v-model="active.text" rows="3" />
        </label>
        <div v-if="active.type === 'add_text'" class="form-row">
          <label class="form-field"
            ><span>{{ t('fontSize') }}</span
            ><input v-model.number="active.font_size" type="number" min="6" max="96" /></label
          ><label class="form-field"
            ><span>{{ t('color') }}</span
            ><input v-model="active.color" type="color"
          /></label>
        </div>
        <label v-if="active.type === 'highlight'" class="form-field"
          ><span>{{ t('color') }}</span
          ><input v-model="active.color" type="color" /></label
        ><template v-if="active.type === 'replace_text'"
          ><p class="field-hint">{{ t('existingTextNote') }}</p>
          <label class="form-field"
            ><span>{{ t('findText') }}</span
            ><input v-model="active.find" /></label
          ><label class="form-field"
            ><span>{{ t('replacement') }}</span
            ><input v-model="active.replacement" /></label></template
        ><template v-if="active.type === 'fill_form'"
          ><label class="form-field"
            ><span>{{ t('fieldName') }}</span
            ><input v-model="active.field" list="pdf-form-fields" /><datalist id="pdf-form-fields">
              <option
                v-for="field in editor.file.form_fields || []"
                :key="field.name"
                :value="field.name"
              /></datalist></label
          ><label class="form-field"
            ><span>{{ t('fieldValue') }}</span
            ><input v-model="active.value" /></label></template
        ><label v-if="['replace_image', 'remove_image'].includes(active.type)" class="form-field"
          ><span>{{ t('imageIndex') }}</span
          ><input v-model.number="active.image_index" type="number" min="0" /></label
        ><template v-if="imageActions.includes(active.type)"
          ><label v-if="assets.length" class="form-field"
            ><span>{{ t('image') }}</span
            ><select v-model.number="active.input_index">
              <option v-for="(asset, i) in assets" :key="asset.id" :value="i + 1">{{ asset.name }}</option>
            </select></label
          ><button class="button secondary full" :disabled="!!busy" @click="imageInput?.click()">
            <AppIcon name="upload" :size="16" />{{ t('chooseImage') }}</button
          ><input
            ref="imageInput"
            class="visually-hidden"
            type="file"
            accept=".jpg,.jpeg,.png"
            @change="uploadImage(($event.target as HTMLInputElement).files?.[0])"
            :aria-label="t('chooseImage')"
        /></template>
      </section>
      <FormTemplates :commands="commands" :file-id="editor.file.id" @apply="applyFormTemplate" />
      <section class="panel editor-export">
        <p v-if="redacted" class="field-hint">{{ t('redactionWarning') }}</p>
        <label v-if="redacted" class="check-label"
          ><input v-model="raster" type="checkbox" /><span>{{ t('acceptRasterization') }}</span></label
        ><template v-if="quote"
          ><div v-for="meter in quote.meters" :key="meter.meter" class="meter-row">
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
          <button
            class="button primary full"
            :disabled="!!busy || quote.affordable === false"
            @click="exportPDF"
          >
            <AppIcon name="download" :size="17" />{{ busy ? t('working') : t('exportPDF') }}
          </button></template
        ><button
          v-else
          class="button primary full"
          :disabled="!!busy || !commands.length || (redacted && !raster)"
          @click="review"
        >
          {{ busy ? t('working') : t('reviewExport') }}<AppIcon name="right" :size="17" /></button
        ><button
          class="button secondary full"
          :disabled="!!busy || !commands.length"
          @click="run('save', save)"
        >
          {{ t('saveEdits') }}
        </button>
      </section>
    </aside>
  </div>
</template>
