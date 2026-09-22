<script setup lang="ts">
import type { Quote } from '../../generated/api/types'
const props = defineProps<{ toolId: string }>()
const { t, path, date } = useLocale()
const ws = useWorkspace()
const { icons, colors, name, description } = useTools()
const feature = computed(() => ws.features.value.find((f) => f.id === props.toolId))
const schema = computed(() => (feature.value as any)?.parameters || {})
const basic = [
  'pdf.merge',
  'pdf.compress',
  'pdf.split',
  'pdf.extract_pages',
  'pdf.delete_pages',
  'pdf.reorder',
  'pdf.rotate',
  'pdf.images_to_pdf',
  'pdf.to_images',
  'pdf.protect',
  'pdf.unlock_known',
  'convert.word_to_pdf',
  'convert.pptx_to_pdf',
]
const fileInput = ref<HTMLInputElement>()
const busy = ref('')
const error = ref('')
const password = ref('')
const dragging = ref(false)
const previewId = ref('')
const previewPage = ref(1)
const previewError = ref(false)
const thumbnailErrors = reactive<Record<string, boolean>>({})
const previewFile = computed(() => ws.activeUploads.value.find((file) => file.id === previewId.value))
function openPreview(id: string) {
  previewId.value = id
  previewPage.value = 1
  previewError.value = false
}
watch(previewPage, () => {
  previewError.value = false
})
const idempotency = useState<Record<string, string>>('idempotency', () => ({}))
const supported = computed(() => ws.features.value.some((f) => f.id === props.toolId))
const isImages = computed(() => props.toolId === 'pdf.images_to_pdf')
const isOffice = computed(() => ['convert.word_to_pdf', 'convert.pptx_to_pdf'].includes(props.toolId))
const isMulti = computed(
  () => ['pdf.merge', 'pdf.images_to_pdf'].includes(props.toolId) || props.toolId.startsWith('batch.'),
)
const hasPages = computed(() =>
  ['pdf.extract_pages', 'pdf.delete_pages', 'pdf.rotate', 'pdf.to_images'].includes(props.toolId),
)
const isReorder = computed(() => props.toolId === 'pdf.reorder')
const accept = computed(() =>
  isImages.value
    ? '.jpg,.jpeg,.png'
    : isOffice.value
      ? props.toolId === 'convert.word_to_pdf'
        ? '.docx'
        : '.pptx'
      : props.toolId.startsWith('ocr.')
        ? '.pdf,.jpg,.jpeg,.png'
        : props.toolId.startsWith('batch.')
          ? '.pdf,.jpg,.jpeg,.png,.docx,.pptx'
          : '.pdf',
)
const countPages = computed(() =>
  ws.activeUploads.value.reduce((n, f) => n + (f.page_count || f.pages || 1), 0),
)
const validInput = computed(() => ws.activeUploads.value.length >= (props.toolId === 'pdf.merge' ? 2 : 1))
const param = ws.activeParameters
const quoteMeters = computed(() => {
  const q = ws.quote.value
  return Array.isArray(q?.meters)
    ? q!.meters
    : Object.entries(q?.cost || q?.estimated_usage || {}).map(([meter, amount]) => ({ meter, amount }))
})
const limits = computed(
  () => ws.plans.value.find((p) => p.id === (ws.user.value?.plan || 'free'))?.limits || {},
)
const totalSize = computed(() =>
  ws.activeUploads.value.reduce((n, f) => n + (f.size_bytes || f.size || 0), 0),
)
const bytes = (n: number) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(0, Math.round(n / 1024))} KB`
const errorMessage = (e: any) => e.data?.error?.message || e.data?.message || t('genericError')
watch(
  () => props.toolId,
  () => {
    if (ws.activeTool.value !== props.toolId) {
      ws.activeUploads.value = []
      param.value = {}
      ws.quote.value = null
      ws.activeTool.value = props.toolId
    }
    if (props.toolId === 'pdf.rotate' && !param.value.angle) param.value.angle = 90
    if (props.toolId === 'pdf.images_to_pdf' && !param.value.paper_size) {
      param.value.paper_size = ws.user.value?.preferences?.paper_size || 'A4'
      param.value.orientation = 'portrait'
      param.value.margin = 24
    }
    if (props.toolId === 'pdf.to_images' && !param.value.format) {
      param.value.format = 'png'
      param.value.dpi = 96
    }
  },
  { immediate: true },
)
watch(password, () => {
  ws.quote.value = null
})
watch(
  param,
  () => {
    ws.quote.value = null
    ws.persistDraft()
  },
  { deep: true },
)
async function upload(files: FileList | File[] | null) {
  if (!files?.length) return
  busy.value = 'upload'
  error.value = ''
  try {
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      if (password.value) form.append('password', password.value)
      const asset = await ws.api('/files/uploads', { method: 'POST', body: form })
      if (!isMulti.value) ws.activeUploads.value = []
      ws.activeUploads.value.push(asset)
    }
    ws.quote.value = null
    ws.persistDraft()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
    if (fileInput.value) fileInput.value.value = ''
  }
}
async function remove(index: number) {
  const f = ws.activeUploads.value[index]
  if (!f) return
  try {
    await ws.api(`/files/${f.id}`, { method: 'DELETE' })
    ws.activeUploads.value.splice(index, 1)
    ws.quote.value = null
    ws.persistDraft()
  } catch (e) {
    error.value = errorMessage(e)
  }
}
function move(index: number, direction: number) {
  const target = index + direction
  if (target < 0 || target >= ws.activeUploads.value.length) return
  const list = [...ws.activeUploads.value]
  ;[list[index], list[target]] = [list[target]!, list[index]!]
  ws.activeUploads.value = list
  ws.quote.value = null
  ws.persistDraft()
}
function parameters() {
  const p = { ...param.value }
  if (isReorder.value) {
    p.order = String(p.order_text || '')
      .split(',')
      .map((x) => Number(x.trim()))
    delete p.order_text
  }
  if (props.toolId === 'pdf.split') {
    if (p.ranges_text)
      p.ranges = String(p.ranges_text)
        .split(';')
        .map((x) => x.trim())
    delete p.ranges_text
  }
  if (hasPages.value && !p.pages) p.pages = 'all'
  return p
}
async function review() {
  error.value = ''
  busy.value = 'quote'
  try {
    let secretId: string | undefined
    if (props.toolId === 'pdf.protect') {
      const secret = await ws.api('/secrets', { method: 'POST', body: { password: password.value } })
      secretId = secret.id
    }
    ws.quote.value = await ws.api<Quote>('/quotes', {
      method: 'POST',
      body: {
        feature_id: props.toolId,
        input_ids: ws.activeUploads.value.map((f) => f.id),
        parameters: parameters(),
        ...(secretId ? { secret_id: secretId } : {}),
      },
    })
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
async function submit() {
  if (!ws.quote.value) return
  error.value = ''
  busy.value = 'job'
  const id = ws.quote.value.id
  if (!idempotency.value[id]) idempotency.value[id] = crypto.randomUUID()
  sessionStorage.setItem(
    'pdf-master-pending-job',
    JSON.stringify({ quote_id: id, key: idempotency.value[id] }),
  )
  try {
    const job = await ws.api('/jobs', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotency.value[id] },
      body: { quote_id: id },
    })
    sessionStorage.removeItem('pdf-master-pending-job')
    ws.quote.value = null
    password.value = ''
    await ws.loadAccount()
    await navigateTo(path(`/app/jobs/${job.id}`))
  } catch (e: any) {
    if (e.statusCode && e.statusCode < 500) sessionStorage.removeItem('pdf-master-pending-job')
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
function onDrop(event: DragEvent) {
  dragging.value = false
  upload(event.dataTransfer?.files || null)
}
</script>
<template>
  <div v-if="supported">
    <NuxtLink class="back-link" :to="path('/app/tools')"
      ><AppIcon name="back" :size="16" />{{ t('backTools') }}</NuxtLink
    >
    <div class="page-heading tool-page-heading">
      <div class="tool-heading-icon" :class="colors[toolId] || 'sage'">
        <AppIcon :name="icons[toolId] || 'file'" :size="28" />
      </div>
      <div>
        <h1>{{ name(toolId, feature?.name) }}</h1>
        <p>{{ description(toolId) }}</p>
      </div>
    </div>
    <div class="flow-steps">
      <span class="active"><b>1</b>{{ t('stepUpload') }}</span
      ><i /><span :class="{ active: ws.activeUploads.value.length }"><b>2</b>{{ t('stepSettings') }}</span
      ><i /><span :class="{ active: ws.quote.value }"><b>3</b>{{ t('stepReady') }}</span>
    </div>
    <ErrorBanner v-if="error" :message="error" />
    <div class="operation-grid">
      <div>
        <section class="panel input-panel">
          <div class="panel-heading">
            <h2>
              {{ t('inputFiles')
              }}<span v-if="ws.activeUploads.value.length" class="count-tag">{{
                ws.activeUploads.value.length
              }}</span>
            </h2>
            <button
              v-if="ws.activeUploads.value.length"
              class="text-link"
              @click="fileInput?.click()"
              :disabled="!!busy"
            >
              <AppIcon name="plus" :size="16" />{{ t('addMore') }}
            </button>
          </div>
          <label v-if="toolId === 'pdf.unlock_known'" class="form-field password-field"
            ><span>{{ t('password') }}</span
            ><input v-model="password" type="password" autocomplete="off" /><small>{{
              t('passwordHint')
            }}</small></label
          >
          <div
            class="workspace-drop"
            :class="{ dragging, small: ws.activeUploads.value.length }"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
          >
            <span class="upload-circle"
              ><AppIcon
                :name="busy === 'upload' ? 'loader' : 'upload'"
                :size="26"
                :class="{ spin: busy === 'upload' }"
            /></span>
            <h3>{{ busy === 'upload' ? t('uploading') : t('dropFiles') }}</h3>
            <p>{{ t('orBrowse') }}</p>
            <button class="button secondary" :disabled="!!busy" @click="fileInput?.click()">
              {{ t('chooseFiles') }}</button
            ><small
              >{{ isImages ? t('images') : isOffice ? t('officeFiles') : t('pdfFiles')
              }}<template v-if="limits.max_file_mib">
                · {{ limits.max_file_mib }} MB {{ t('fileLimit') }} · {{ limits.max_pages_per_job }}
                {{ t('jobLimit') }}</template
              ></small
            >
          </div>
          <input
            ref="fileInput"
            class="visually-hidden"
            type="file"
            :multiple="isMulti"
            :accept="accept"
            @change="upload(($event.target as HTMLInputElement).files)"
            :aria-label="t('chooseFiles')"
          />
          <div v-if="ws.activeUploads.value.length" class="file-list">
            <div v-for="(file, index) in ws.activeUploads.value" :key="file.id" class="file-row">
              <span class="file-order">{{ index + 1 }}</span
              ><button
                v-if="file.preview_url && !thumbnailErrors[file.id]"
                class="file-preview-button"
                @click="openPreview(file.id)"
                :aria-label="t('previewFile', { name: file.name || file.filename || 'PDF' })"
              >
                <img
                  :src="file.preview_url"
                  alt=""
                  loading="lazy"
                  @error="thumbnailErrors[file.id] = true"
                /></button
              ><span v-else class="file-tile"
                ><AppIcon :name="isImages ? 'image' : 'file'" :size="24"
              /></span>
              <div class="file-details">
                <strong :title="file.name || file.filename">{{ file.name || file.filename }}</strong
                ><small
                  >{{ bytes(file.size_bytes || file.size || 0) }} · {{ file.page_count || file.pages || 1 }}
                  {{ t('pages') }}</small
                >
              </div>
              <div class="file-actions">
                <button
                  v-if="isMulti"
                  class="icon-button"
                  :disabled="index === 0 || !!busy"
                  @click="move(index, -1)"
                  :aria-label="t('moveUp')"
                >
                  <AppIcon name="up" :size="16" /></button
                ><button
                  v-if="isMulti"
                  class="icon-button"
                  :disabled="index === ws.activeUploads.value.length - 1 || !!busy"
                  @click="move(index, 1)"
                  :aria-label="t('moveDown')"
                >
                  <AppIcon name="moveDown" :size="16" /></button
                ><button
                  class="icon-button"
                  :disabled="!!busy"
                  @click="remove(index)"
                  :aria-label="t('remove')"
                >
                  <AppIcon name="x" :size="17" />
                </button>
              </div>
            </div>
            <p v-if="isMulti" class="input-hint">
              <AppIcon name="reorder" :size="15" />{{ t('reorderHint') }}
            </p>
          </div>
          <section v-if="previewFile" class="document-preview" :aria-label="t('preview')">
            <div class="preview-toolbar">
              <strong>{{ t('preview') }}</strong>
              <div class="preview-controls">
                <button
                  class="icon-button"
                  :disabled="previewPage <= 1"
                  @click="previewPage--"
                  :aria-label="t('previousPage')"
                >
                  <AppIcon name="back" :size="18" /></button
                ><span>{{ t('pageOf', { page: previewPage, count: previewFile.page_count || 1 }) }}</span
                ><button
                  class="icon-button"
                  :disabled="previewPage >= (previewFile.page_count || 1)"
                  @click="previewPage++"
                  :aria-label="t('nextPage')"
                >
                  <AppIcon name="chevron" :size="18" />
                </button>
              </div>
              <button class="icon-button" @click="previewId = ''" :aria-label="t('closePreview')">
                <AppIcon name="x" :size="18" />
              </button>
            </div>
            <img
              v-if="!previewError"
              :src="`${previewFile.preview_url}?page=${previewPage}`"
              :alt="`${previewFile.name} · ${t('pageOf', { page: previewPage, count: previewFile.page_count || 1 })}`"
              @error="previewError = true"
            />
            <p v-else class="preview-error" role="status">{{ t('previewUnavailable') }}</p>
            <p class="preview-note"><AppIcon name="shield" :size="14" />{{ t('previewFree') }}</p>
          </section>
        </section>
        <section class="panel options-panel">
          <h2>{{ t('options') }}</h2>
          <label v-if="toolId === 'pdf.protect'" class="form-field"
            ><span>{{ t('password') }}</span
            ><input v-model="password" type="password" autocomplete="new-password" /><small>{{
              t('passwordHint')
            }}</small></label
          >
          <p v-if="toolId === 'pdf.merge'" class="muted">{{ t('reorderHint') }}</p>
          <p v-if="toolId === 'pdf.compress'" class="muted">{{ t('compressionHint') }}</p>
          <p v-if="toolId === 'pdf.split'" class="muted">{{ t('splitHint') }}</p>
          <label v-if="hasPages" class="form-field"
            ><span>{{ t('rangeLabel') }}</span
            ><input v-model="param.pages" :placeholder="t('allPages')" /><small>{{
              t('rangeHint')
            }}</small></label
          ><label v-if="isReorder" class="form-field"
            ><span>{{ t('rangeLabel') }}</span
            ><input v-model="param.order_text" placeholder="3, 1, 2" /><small>{{
              t('orderHint')
            }}</small></label
          ><label v-if="toolId === 'pdf.rotate'" class="form-field"
            ><span>{{ t('angle') }}</span
            ><select v-model.number="param.angle">
              <option :value="90">90° {{ t('clockwise') }}</option>
              <option :value="180">180°</option>
              <option :value="270">270° {{ t('clockwise') }}</option>
            </select></label
          >
          <div v-if="isImages" class="form-row">
            <label class="form-field"
              ><span>{{ t('paperSize') }}</span
              ><select v-model="param.paper_size">
                <option>A4</option>
                <option>Letter</option>
                <option value="original">{{ t('original') }}</option>
              </select></label
            ><label class="form-field"
              ><span>{{ t('orientation') }}</span
              ><select v-model="param.orientation">
                <option value="auto">{{ t('auto') }}</option>
                <option value="portrait">{{ t('portrait') }}</option>
                <option value="landscape">{{ t('landscape') }}</option>
              </select></label
            >
          </div>
          <div v-if="toolId === 'pdf.to_images'" class="form-row">
            <label class="form-field"
              ><span>{{ t('format') }}</span
              ><select v-model="param.format">
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select></label
            ><label class="form-field"
              ><span>{{ t('resolution') }}</span
              ><select v-model.number="param.dpi">
                <option :value="72">72 DPI</option>
                <option :value="96">96 DPI</option>
                <option :value="150">150 DPI</option>
                <option :value="200">200 DPI</option>
              </select></label
            >
          </div>
          <SchemaFields v-if="!basic.includes(toolId)" v-model="param" :schema="schema" />
          <p v-if="isOffice" class="muted">{{ t('simpleBody') }}</p>
        </section>
      </div>
      <aside class="quote-rail">
        <section class="panel quote-panel">
          <span class="quote-icon"><AppIcon name="checks" :size="25" /></span>
          <h2>{{ t('reviewTitle') }}</h2>
          <p>{{ t('quoteBody') }}</p>
          <div class="quote-summary">
            <div>
              <span>{{ t('inputFiles') }}</span
              ><strong>{{ ws.activeUploads.value.length }}</strong>
            </div>
            <div>
              <span>{{ t('pages') }}</span
              ><strong>{{ countPages }}</strong>
            </div>
            <div>
              <span>{{ t('fileName') }}</span
              ><strong>{{ bytes(totalSize) }}</strong>
            </div>
          </div>
          <template v-if="ws.quote.value"
            ><div v-if="ws.quote.value.affordable === false" class="info-banner">
              {{ t('quotaExceeded') }}
            </div>
            <div class="quote-meters">
              <div v-for="meter in quoteMeters" :key="meter.meter">
                <span
                  >{{
                    t(
                      meter.meter === 'file_tasks'
                        ? 'standardTask'
                        : meter.meter === 'file_page_units'
                          ? 'pageUnits'
                          : meter.meter,
                    )
                  }}<small v-if="(ws.quote.value as any).available_balances?.[meter.meter]"
                    >{{ (ws.quote.value as any).available_balances[meter.meter].remaining }}
                    {{ t('remaining') }}</small
                  ></span
                ><strong>{{ meter.amount }}</strong>
              </div>
            </div>
            <p class="quote-expiry">
              <AppIcon name="clock" :size="14" />{{ t('quoteExpires') }}
              {{ date(ws.quote.value.expires_at, true) }}
            </p>
            <button
              class="button primary full"
              @click="submit"
              :disabled="!!busy || ws.quote.value.affordable === false"
            >
              <AppIcon :name="busy ? 'loader' : 'right'" :size="17" :class="{ spin: !!busy }" />{{
                busy ? t('working') : t('startProcessing')
              }}</button
            ><button class="text-link refresh-quote" @click="review" :disabled="!!busy">
              {{ t('refreshQuote') }}
            </button></template
          ><template v-else
            ><button
              class="button primary full"
              @click="review"
              :disabled="!validInput || !!busy || (toolId === 'pdf.protect' && !password)"
            >
              <AppIcon
                :name="busy === 'quote' ? 'loader' : 'right'"
                :size="17"
                :class="{ spin: busy === 'quote' }"
              />{{ busy === 'quote' ? t('working') : t('getQuote') }}</button
            ><small class="quote-footnote">{{
              validInput ? t('noChargeBefore') : toolId === 'pdf.merge' ? t('mergeMinimum') : t('pickFirst')
            }}</small></template
          >
        </section>
        <div class="rail-privacy">
          <AppIcon name="shield" :size="20" />
          <p>{{ t('retention') }}</p>
        </div>
      </aside>
    </div>
  </div>
  <div v-else class="empty-state panel">
    <AppIcon name="tools" :size="32" />
    <h2>{{ t('unavailableTool') }}</h2>
    <NuxtLink class="button primary" :to="path('/app/tools')">{{ t('viewAll') }}</NuxtLink>
  </div>
</template>
