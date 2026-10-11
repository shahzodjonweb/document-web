<script setup lang="ts">
import type { Quote } from '../../generated/api/types'
const props = defineProps<{ toolId: string }>()
const { t, count, path, date } = useLocale()
const ws = useWorkspace()
const { icon, name, description } = useTools()
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
const schemaFields = computed(() => !basic.includes(props.toolId) && Object.keys(schema.value.properties || {}).length > 0)
const hasOptions = computed(
  () =>
    ['pdf.protect', 'pdf.rotate', 'pdf.images_to_pdf', 'pdf.to_images'].includes(props.toolId) ||
    hasPages.value ||
    isReorder.value ||
    schemaFields.value,
)
const hint = computed(() =>
  props.toolId === 'pdf.compress' ? t('compressionHint') : props.toolId === 'pdf.split' ? t('splitHint') : '',
)
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
// A saved draft is restored after this page is set up; one for a different
// tool must not bring its files here, so the restored tool is watched too.
watch(
  () => [props.toolId, ws.activeTool.value, param.value],
  () => {
    if (ws.activeTool.value !== props.toolId) {
      ws.activeUploads.value = []
      param.value = {}
      ws.quote.value = null
      ws.activeTool.value = props.toolId
    }
    if (props.toolId === 'pdf.rotate' && !param.value.angle) param.value.angle = 90
    if (props.toolId === 'pdf.images_to_pdf') {
      if (!param.value.paper_size) param.value.paper_size = 'fit'
      if (param.value.orientation === undefined) param.value.orientation = 'auto'
      if (param.value.margin === undefined) param.value.margin = 0
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
  <div v-if="supported" class="tool-page">
    <NuxtLink class="back-link" :to="path('/app/tools')"
      ><AppIcon name="back" :size="16" />{{ t('backTools') }}</NuxtLink
    >
    <div class="page-heading tool-head">
      <span class="tool-icon" aria-hidden="true"><AppIcon :name="icon(toolId)" :size="24" /></span>
      <div>
        <h1>{{ name(toolId, feature?.name) }}</h1>
        <p>{{ description(toolId) }}</p>
      </div>
    </div>
    <ErrorBanner v-if="error" :message="error" />
    <ol class="tool-steps">
      <li class="tool-step panel">
        <div class="step-head">
          <span class="step-number" aria-hidden="true">1</span>
          <h2>
            {{ t('inputFiles')
            }}<span v-if="ws.activeUploads.value.length" class="count-tag">{{
              ws.activeUploads.value.length
            }}</span>
          </h2>
          <button
            v-if="ws.activeUploads.value.length && isMulti"
            class="text-link"
            type="button"
            @click="fileInput?.click()"
            :disabled="!!busy"
          >
            <AppIcon name="plus" :size="16" />{{ t('addMore') }}
          </button>
        </div>
        <p v-if="hint" class="field-hint step-hint">{{ hint }}</p>
        <label v-if="toolId === 'pdf.unlock_known'" class="form-field password-field"
          ><span>{{ t('password') }}</span
          ><input v-model="password" type="password" autocomplete="off" /><small>{{
            t('passwordHint')
          }}</small></label
        >
        <div
          v-if="!ws.activeUploads.value.length || busy === 'upload'"
          class="workspace-drop"
          :class="{ dragging }"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <span class="upload-circle"
            ><AppIcon
              :name="busy === 'upload' ? 'loader' : 'upload'"
              :size="24"
              :class="{ spin: busy === 'upload' }"
          /></span>
          <div class="drop-copy">
            <h3>{{ busy === 'upload' ? t('uploading') : t('dropFiles') }}</h3>
            <small
              >{{ isImages ? t('images') : isOffice ? t('officeFiles') : t('pdfFiles')
              }}<template v-if="limits.max_file_mib">
                · {{ limits.max_file_mib }} MB {{ t('fileLimit') }} · {{ limits.max_pages_per_job }}
                {{ t('jobLimit') }}</template
              ></small
            >
          </div>
          <button class="button secondary" type="button" :disabled="!!busy" @click="fileInput?.click()">
            {{ t('chooseFiles') }}
          </button>
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
            <span v-if="isMulti" class="file-order">{{ index + 1 }}</span
            ><button
              v-if="file.preview_url && !thumbnailErrors[file.id]"
              class="file-preview-button"
              type="button"
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
              ><AppIcon :name="isImages ? 'image' : 'file'" :size="22"
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
                type="button"
                :disabled="index === 0 || !!busy"
                @click="move(index, -1)"
                :aria-label="t('moveUp')"
              >
                <AppIcon name="up" :size="16" /></button
              ><button
                v-if="isMulti"
                class="icon-button"
                type="button"
                :disabled="index === ws.activeUploads.value.length - 1 || !!busy"
                @click="move(index, 1)"
                :aria-label="t('moveDown')"
              >
                <AppIcon name="moveDown" :size="16" /></button
              ><button
                class="icon-button"
                type="button"
                :disabled="!!busy"
                @click="remove(index)"
                :aria-label="t('remove')"
              >
                <AppIcon name="x" :size="17" />
              </button>
            </div>
          </div>
          <p v-if="isMulti && ws.activeUploads.value.length > 1" class="input-hint">
            <AppIcon name="reorder" :size="15" />{{ t('reorderHint') }}
          </p>
          <button
            v-if="!isMulti"
            class="text-link replace-file"
            type="button"
            :disabled="!!busy"
            @click="fileInput?.click()"
          >
            <AppIcon name="upload" :size="15" />{{ t('chooseFiles') }}
          </button>
        </div>
        <section v-if="previewFile" class="document-preview" :aria-label="t('preview')">
          <div class="preview-toolbar">
            <strong>{{ t('preview') }}</strong>
            <div class="preview-controls">
              <button
                class="icon-button"
                type="button"
                :disabled="previewPage <= 1"
                @click="previewPage--"
                :aria-label="t('previousPage')"
              >
                <AppIcon name="back" :size="18" /></button
              ><span>{{ t('pageOf', { page: previewPage, count: previewFile.page_count || 1 }) }}</span
              ><button
                class="icon-button"
                type="button"
                :disabled="previewPage >= (previewFile.page_count || 1)"
                @click="previewPage++"
                :aria-label="t('nextPage')"
              >
                <AppIcon name="chevron" :size="18" />
              </button>
            </div>
            <button class="icon-button" type="button" @click="previewId = ''" :aria-label="t('closePreview')">
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
      </li>
      <li v-if="hasOptions" class="tool-step panel">
        <div class="step-head">
          <span class="step-number" aria-hidden="true">2</span>
          <h2>{{ t('options') }}</h2>
        </div>
        <label v-if="toolId === 'pdf.protect'" class="form-field"
          ><span>{{ t('password') }}</span
          ><input v-model="password" type="password" autocomplete="new-password" /><small>{{
            t('passwordHint')
          }}</small></label
        >
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
        <template v-if="isImages">
          <label class="form-field"
            ><span>{{ t('paperSize') }}</span
            ><select v-model="param.paper_size">
              <option value="fit">{{ t('scanFitPage') }}</option>
              <option>A4</option>
              <option>Letter</option>
              <option value="original">{{ t('original') }}</option>
            </select
            ><small v-if="param.paper_size === 'fit'">{{ t('scanFitPageHint') }}</small></label
          >
          <details class="advanced-options">
            <summary>{{ t('advancedOptions') }}</summary>
            <label class="form-field"
              ><span>{{ t('orientation') }}</span
              ><select v-model="param.orientation">
                <option value="auto">{{ t('auto') }}</option>
                <option value="portrait">{{ t('portrait') }}</option>
                <option value="landscape">{{ t('landscape') }}</option>
              </select></label
            >
          </details>
        </template>
        <template v-if="toolId === 'pdf.to_images'">
          <label class="form-field"
            ><span>{{ t('format') }}</span
            ><select v-model="param.format">
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
            </select></label
          >
          <details class="advanced-options">
            <summary>{{ t('advancedOptions') }}</summary>
            <label class="form-field"
              ><span>{{ t('resolution') }}</span
              ><select v-model.number="param.dpi">
                <option :value="72">72 DPI</option>
                <option :value="96">96 DPI</option>
                <option :value="150">150 DPI</option>
                <option :value="200">200 DPI</option>
              </select></label
            >
          </details>
        </template>
        <SchemaFields v-if="schemaFields" v-model="param" :schema="schema" />
      </li>
      <li class="tool-step panel tool-review">
        <div class="step-head">
          <span class="step-number" aria-hidden="true">{{ hasOptions ? 3 : 2 }}</span>
          <h2>{{ t('stepReview') }}</h2>
        </div>
        <p class="tool-summary">
          {{
            t('toolSummary', {
              files: count('outputs', ws.activeUploads.value.length),
              pages: countPages,
              size: bytes(totalSize),
            })
          }}
        </p>
        <template v-if="ws.quote.value">
          <div v-if="ws.quote.value.affordable === false" class="warning-banner">
            <AppIcon name="alert" :size="17" />{{ t('quotaExceeded') }}
          </div>
          <dl class="quote-meters">
            <div v-for="meter in quoteMeters" :key="meter.meter">
              <dt>
                {{
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
                >
              </dt>
              <dd>{{ meter.amount }}</dd>
            </div>
          </dl>
        </template>
      </li>
    </ol>
    <div class="tool-action">
      <template v-if="ws.quote.value"
        ><button
          class="button primary"
          type="button"
          @click="submit"
          :disabled="!!busy || ws.quote.value.affordable === false"
        >
          <AppIcon :name="busy ? 'loader' : 'right'" :size="17" :class="{ spin: !!busy }" />{{
            busy ? t('working') : t('startProcessing')
          }}</button
        ><small class="quote-footnote"
          >{{ t('quoteExpires') }} {{ date(ws.quote.value.expires_at, true) }} ·
          <button class="text-link" type="button" @click="review" :disabled="!!busy">
            {{ t('refreshQuote') }}
          </button></small
        ></template
      ><template v-else
        ><button
          class="button primary"
          type="button"
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
    </div>
    <p class="directory-note"><AppIcon name="shield" :size="16" />{{ t('retention') }}</p>
  </div>
  <div v-else class="empty-state panel">
    <AppIcon name="tools" :size="28" />
    <h2>{{ t('unavailableTool') }}</h2>
    <NuxtLink class="button primary" :to="path('/app/tools')">{{ t('viewAll') }}</NuxtLink>
  </div>
</template>
