<script setup lang="ts">
/**
 * The editor behind the `editor_v2` switch: the phone's frame first, with more room
 * at 980 px and over. Shell owns the document and hands the pages in as the slot;
 * this owns what stands around them, and the Telegram buttons while it is up.
 */
import { isCommandType, isPageCommand } from '~/composables/useEditorCommands'
import { PLACE_LABEL, kindLabel, type ToolSheet } from '~/composables/useEditorTools'

const props = defineProps<{ pageCount: number; currentPage: number; lockedCount: number }>()
const emit = defineEmits<{ go: [page: number]; removeLocked: [] }>()

const { t, count, date, path } = useLocale()
const session = useEditorSession()
const telegram = useTelegramApp()
const frame = useEditorFrame()
const tools = useEditorTools()
const images = useEditorImages()
const hints = useEditorHints()
const snackbar = useEditorSnackbar()
const send = useEditorSend()
const pageOrder = useEditorPageOrder()
const render = useEditorRender()
const textLayer = useEditorTextLayer()
const ws = useWorkspace()

const moreOpen = ref(false)
const reviewOpen = ref(false)

telegram.useViewport()
telegram.bindClosingConfirmation(() =>
  ['dirty', 'saving', 'failed', 'paused'].includes(session.saveState.value),
)
telegram.useBackLayer(
  () => session.mode.value === 'pages',
  () => (session.mode.value = 'edit'),
)
// Placing is a step of its own: Back lets go of it as the bar's Cancel does, rather than closing the app.
telegram.useBackLayer(
  () => !!tools.armed.value && tools.armed.value.kind !== 'redact',
  () => tools.disarm(),
)
// A picture that landed while a send held the draft is saved once the job has read it.
watch(session.held, (held) => {
  if (!held && session.saveState.value === 'dirty') void session.save()
})
/** Send to chat inside Telegram, Download elsewhere: the same Review either way. */
telegram.usePrimaryAction('editor', () => {
  if (session.isBusy('load') || !session.doc.value) return 'hidden'
  return {
    text: t(send.deliver.value === 'chat' ? 'editorSendToChat' : 'editorDownload'),
    enabled: session.commands.value.length > 0 && !session.held.value && !session.conflict.value,
    onPress: openReview,
  }
})

// Words still in the field go with it: nothing typed is left out of a send.
function openReview() {
  tools.commitField()
  reviewOpen.value = true
  void send.begin()
}
/** `chosen`: the person closed it, having read what it said; not so when it gives way by itself. */
function closeReview(chosen = true) {
  // A send being asked for has to hear its answer first: that answer would close the app on what came next.
  if (send.stage.value === 'sending') return
  reviewOpen.value = false
  send.dismiss(chosen)
}
/** Review's Show goes to the page, in the frame as it will be. */
function showPage(page: number) {
  closeReview()
  session.mode.value = 'edit'
  void nextTick(() => emit('go', page))
}

// Each document starts with nothing open and nothing armed, and keeps its own pictures.
watch(
  () => session.doc.value?.id,
  (id) => {
    tools.reset()
    images.forDocument(id ?? '')
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  tools.commitField()
  tools.reset()
})

// Every picture is asked for through this one input, which stays while the frame does.
const pickerInput = ref<HTMLInputElement>()
onMounted(() => {
  tools.picker.value = pickerInput.value ?? null
  window.addEventListener('focus', tools.pickerLeft)
})
onBeforeUnmount(() => {
  if (tools.picker.value === pickerInput.value) tools.picker.value = null
  window.removeEventListener('focus', tools.pickerLeft)
})

/**
 * Escape and a deep link's `?feature=` speak the old strip's language: a tool, or
 * none. Here a tool is armed, or opens its sheet; none lets go of what is armed.
 */
watch(
  session.activeTool,
  (tool) => {
    const armed = tools.armed.value
    if (tool === 'select') {
      if (armed?.kind === 'redact') tools.stopBlackOut()
      else if (armed) tools.disarm()
    } else if (!armed && isCommandType(tool)) {
      session.activeTool.value = 'select'
      tools.fromTool(tool)
    }
  },
  { immediate: true },
)

const selected = computed(() => session.selected.value[0] ?? null)
/** The dock is up. A line of the file's own words typed over itself on the paper leaves the frame be. */
const editing = computed(() => !!session.editingId.value && !tools.inline.value)
/** What the compact sheet holds: the chosen mark's form first, then the open tool's sheet. */
const panel = computed<'object' | Exclude<ToolSheet, 'fields'> | null>(() => {
  if (session.mode.value === 'pages' || editing.value) return null
  if (selected.value) return 'object'
  const open = tools.sheet.value
  return open && open !== 'fields' ? open : null
})
/** At 980 px and over the panel is always there; on a phone only with something in it. */
const panelShown = computed(() =>
  frame.wide.value ? session.mode.value !== 'pages' && !editing.value : !!panel.value,
)
const panelTitle = computed(() => {
  switch (panel.value) {
    case 'object':
      return frame.wide.value
        ? t('editorProperties')
        : t('editorObjectTitle', {
            kind: t(kindLabel(selected.value!.type)),
            // Its place in the file being made, as the chip and Pages number it.
            page: pageOrder.positionOf(selected.value!.page ?? 1) || (selected.value!.page ?? 1),
          })
    case 'add':
      return tools.pin.value ? t('editorAddHere') : t('editorTabAdd')
    case 'sign':
      return t('editorTabSign')
    case 'blackout':
      return t('editorTabBlackOut')
    default:
      return t('editorProperties')
  }
})
function closePanel() {
  if (panel.value === 'object') session.select(null)
  else if (panel.value === 'blackout') tools.stopBlackOut()
  else tools.closeSheet()
}

// Review's Show goes to the change, and its form is under the sheet. The stage has
// just lost that sheet's height, and the mark may have been in it. Choosing a mark
// also puts away a tool's sheet and what was armed: the form is the place now.
watch(
  () => selected.value?._id,
  async (id) => {
    // A box's form put away in Black out: back to Black out, its tab lit and what it found outlined.
    if (!id) {
      if (tools.armed.value?.kind === 'redact' && tools.sheet.value === 'blackout' && session.mode.value === 'edit')
        session.mode.value = 'redact'
      return
    }
    // A page's own change is in Pages, where it is undone or changed.
    if (isPageCommand(selected.value!)) {
      session.select(null)
      session.mode.value = 'pages'
      return
    }
    // Review gives way to the form only before a send. Once one is on its way, or may have gone
    // unanswered, it stays: it says what became of it, and of a picture come late.
    const before = send.stage.value === 'ready' || (send.stage.value === 'failed' && !send.uncertain.value)
    if (reviewOpen.value && before && !send.late.value) closeReview(false)
    session.mode.value = 'edit'
    if (tools.sheet.value && tools.sheet.value !== 'blackout') tools.closeSheet()
    if (tools.armed.value && tools.armed.value.kind !== 'redact') tools.disarm()
    await nextTick()
    document.querySelector(`[data-testid="editor-mark-${id}"]`)?.scrollIntoView({ block: 'nearest' })
  },
)
// The spot Add here was opened at, above the sheet that just took the bottom of the stage.
watch(tools.pin, async (pin) => {
  if (!pin) return
  await nextTick()
  document.querySelector('[data-testid="editor-pin"]')?.scrollIntoView({ block: 'nearest' })
})

/** Armed from the bar: what the next tap on the page places, and the way out of it. */
const armedBar = computed(() => {
  const armed = tools.armed.value
  return armed && armed.kind !== 'redact' && !editing.value ? armed : null
})
/**
 * One first-use line at a time, only on a quiet page: the page's own words first, while
 * they can be changed and the page on screen has some, then placing.
 */
const rootHint = computed(() => {
  const quiet =
    session.mode.value === 'edit' &&
    !panel.value &&
    !tools.armed.value &&
    !session.editingId.value &&
    !snackbar.snack.value
  if (!quiet) return ''
  if (textLayer.enabled.value && textLayer.linesOn(props.currentPage).length && hints.showing('editText'))
    return 'editorHintEditText'
  return hints.showing('place') ? 'editorHintPlace' : ''
})

// A picture still on its way is not a change that needs fixing: it is held back until it lands.
const heldCount = computed(
  () =>
    session.issues.value.filter(
      (issue) => issue.code !== 'editorTextOverflow' && !tools.waiting.has(issue.id),
    ).length,
)
const firstIssue = computed(() => session.issues.value.find((issue) => !tools.waiting.has(issue.id)))
const saveFailed = computed(() => session.saveState.value === 'failed')

/** The file's clock is the server's; under three hours left is worth a line of its own. */
const EXPIRY_WARNING = 3 * 60 * 60 * 1000
const expiresSoon = computed(() => {
  const at = session.doc.value?.file.expires_at
  return at && new Date(at).getTime() - Date.now() < EXPIRY_WARNING ? at : ''
})

/**
 * A scan: its pages are pictures with no words of their own. Marks go on it as on
 * any file; changing its words needs them made into text first, which is a task of
 * its own, opened here with this file already in it. Only the first pages are read:
 * a file that starts as a scan is taken for one.
 */
const SCAN_PAGES = 3
const scanned = ref(false)
const scanHidden = ref(false)
watch(
  () => [render.mode.value, session.doc.value?.id] as const,
  async ([mode, id]) => {
    scanned.value = false
    scanHidden.value = false
    const current = session.doc.value
    if (mode !== 'pdfjs' || !current) return
    const pages = Array.from({ length: Math.min(SCAN_PAGES, current.pages.length) }, (_, index) => index + 1)
    if (!pages.length || pages.some((page) => !current.image_counts?.[page - 1])) return
    for (const page of pages) if ((await render.hasWords(page)) !== false) return
    if (session.doc.value?.id === id) scanned.value = true
  },
  { immediate: true },
)
function makeEditable() {
  const file = session.doc.value?.file
  if (!file) return
  ws.activeTool.value = 'ocr.searchable_pdf'
  ws.activeUploads.value = [file as any]
  ws.activeParameters.value = {}
  ws.quote.value = null
  ws.persistDraft()
  void navigateTo(path('/app/tools/ocr.searchable_pdf'))
}

/** The chip counts the pages of the file being made, in their new order. */
const chipPage = computed(() => pageOrder.positionOf(props.currentPage) || 1)
const chipCount = computed(() => pageOrder.kept.value.length || props.pageCount)
</script>

<template>
  <div class="editor-frame" :class="{ bare: frame.bare.value, typing: editing }" data-testid="editor-frame">
    <EditorTextForm v-if="editing" />
    <EditorTopBar v-else @more="moreOpen = true" />
    <!-- Outside everything that comes and goes, opening a document included: a photo handed over late still lands. -->
    <input
      ref="pickerInput"
      type="file"
      class="visually-hidden"
      tabindex="-1"
      :aria-label="t('editorKindPicture')"
      data-testid="editor-picker"
      @change="tools.picked(($event.target as HTMLInputElement).files?.[0] ?? null)"
      @cancel="tools.picked(null)"
    />

    <p v-if="session.isBusy('load')" class="editor-stage-status" role="status" data-testid="editor-opening">
      <AppIcon name="loader" class="spin" :size="20" />{{ t('editorPreparingPages') }}
    </p>

    <template v-else>
      <div class="editor-frame-notices">
        <ErrorBanner v-if="session.error.value && !reviewOpen" :message="session.error.value" />
        <p v-if="saveFailed" class="warning-banner" role="alert" data-testid="editor-save-failed">
          <span>{{ session.saveError.value || t('editorNotSaved') }}</span
          ><button type="button" class="text-link" data-testid="editor-save-now" @click="session.save()">
            {{ t('editorSaveNow') }}
          </button>
        </p>
        <p
          v-else-if="heldCount && firstIssue"
          class="warning-banner"
          role="status"
          data-testid="editor-frame-issue"
        >
          <span>{{ count('editorSaveNeedsFix', heldCount) }}</span
          ><button
            type="button"
            class="text-link"
            data-testid="editor-frame-issue-show"
            @click="session.select(firstIssue!.id)"
          >
            {{ t('editorShowIssue') }}
          </button>
        </p>
        <p v-if="expiresSoon" class="warning-banner" role="status" data-testid="editor-expiring">
          <AppIcon name="clock" :size="17" /><span>{{
            t('editorAvailableUntil', { time: date(expiresSoon, true) })
          }}</span>
        </p>
        <p
          v-if="scanned && !scanHidden"
          class="info-banner editor-scan"
          role="status"
          data-testid="editor-scan"
        >
          <AppIcon name="image" :size="17" /><span>{{ t('editorScan') }}</span
          ><button type="button" class="text-link" data-testid="editor-scan-ocr" @click="makeEditable">
            {{ t('editorMakeEditable') }}</button
          ><button
            type="button"
            class="icon-button"
            :aria-label="t('editorDismiss')"
            @click="scanHidden = true"
          >
            <AppIcon name="x" :size="16" />
          </button>
        </p>
        <p v-if="session.notice.value" class="info-banner" role="status">
          <AppIcon name="alert" :size="17" /><span>{{ session.notice.value }}</span
          ><button
            type="button"
            class="icon-button"
            :aria-label="t('editorDismiss')"
            @click="session.notice.value = ''"
          >
            <AppIcon name="x" :size="16" />
          </button>
        </p>
        <section v-if="session.conflict.value" class="editor-conflict info-banner" role="alert">
          <div>
            <strong>{{ t('editorConflictTitle') }}</strong>
            <p>{{ t('editorConflictBody') }}</p>
          </div>
          <span>
            <button type="button" class="button secondary small" @click="session.resolveTakeServer">
              {{ t('editorConflictTakeServer') }}
            </button>
            <button type="button" class="button primary small" @click="session.resolveKeepMine">
              {{ t('editorConflictKeepMine') }}
            </button>
          </span>
        </section>
        <p
          v-if="session.held.value && !reviewOpen"
          class="info-banner"
          role="status"
          data-testid="editor-held"
        >
          <AppIcon name="loader" class="spin" :size="17" /><span>{{ t('editorHeld') }}</span>
        </p>
        <section v-if="lockedCount" class="info-banner editor-conflict" role="alert">
          <div>
            <strong>{{ t('editorLockedCommands', { count: lockedCount }) }}</strong>
          </div>
          <span>
            <button type="button" class="button primary small" @click="emit('removeLocked')">
              {{ t('editorRemoveLocked') }}
            </button>
          </span>
        </section>
      </div>

      <div class="editor-frame-work">
        <EditorPageRail
          v-if="frame.wide.value && pageCount && session.mode.value !== 'pages'"
          :page-count="pageCount"
          :pages="pageOrder.kept.value"
          :current="currentPage"
          @go="emit('go', $event)"
        />

        <div class="editor-frame-canvas">
          <EditorPageGrid v-if="session.mode.value === 'pages'" />
          <template v-else>
            <button
              v-if="pageCount"
              type="button"
              class="editor-page-chip"
              :aria-label="t('editorPageChip', { page: chipPage, count: chipCount })"
              data-testid="editor-page-chip"
              @click="session.mode.value = 'pages'"
            >
              {{ chipPage }} / {{ chipCount }}
            </button>
            <slot />
          </template>
          <p v-if="rootHint" class="editor-hint" data-testid="editor-hint">{{ t(rootHint) }}</p>
          <EditorSnackbar />
        </div>

        <!-- At 980 px and over this is the right-hand panel, always there, with the lists a phone keeps in More. -->
        <EditorSheet
          v-if="panelShown"
          :open="panelShown"
          :permanent="frame.wide.value && (!panel || panel === 'object')"
          :title="panelTitle"
          :testid="panel && panel !== 'object' ? `editor-${panel}-sheet` : 'editor-object-sheet'"
          @close="closePanel"
        >
          <EditorAddSheet v-if="panel === 'add'" />
          <EditorSignSheet v-else-if="panel === 'sign'" />
          <EditorBlackOutSheet v-else-if="panel === 'blackout'" />
          <template v-else>
            <EditorFloatBar />
            <EditorCommandList v-if="frame.wide.value" />
          </template>
        </EditorSheet>
      </div>

      <div v-if="armedBar" class="editor-armed" role="status" data-testid="editor-armed">
        <span>{{
          t(armedBar.kind === 'draw' ? 'editorArmedDraw' : 'editorArmedPlace', {
            what: t(PLACE_LABEL[armedBar.kind]),
          })
        }}</span>
        <button
          type="button"
          class="button secondary small"
          data-testid="editor-armed-cancel"
          @click="tools.disarm()"
        >
          {{ t(armedBar.kind === 'draw' ? 'editorDone' : 'cancel') }}
        </button>
      </div>
      <EditorToolStrip v-else-if="!editing && (frame.wide.value || !selected)" bar />
      <EditorMainButtonFallback />

      <EditorMoreSheet v-model="moreOpen" />
      <EditorSheet
        :open="tools.sheet.value === 'fields'"
        size="tall"
        modal
        :title="t('editorFillForm')"
        testid="editor-fields-sheet"
        @close="tools.closeSheet()"
      >
        <EditorFieldPanel />
      </EditorSheet>
      <EditorSheet
        :open="reviewOpen"
        size="tall"
        modal
        :title="t(send.deliver.value === 'chat' ? 'editorReviewSend' : 'editorReviewDownload')"
        :locked="send.stage.value === 'sending'"
        testid="editor-review-sheet"
        @close="closeReview"
      >
        <EditorReviewSheet @close="closeReview" @show-page="showPage" />
      </EditorSheet>
    </template>
  </div>
</template>
