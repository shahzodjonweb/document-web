<script setup lang="ts">
/**
 * The editor workspace.
 *
 * Owns the route, the layout and the global keyboard map. The session state is
 * `useState`-backed and therefore survives navigation, so it is reset on mount
 * and whenever the document in the URL changes.
 */
import { COMMAND_FEATURE, isCommandType, type CommandType } from '~/composables/useEditorCommands'

const props = defineProps<{ documentId?: string }>()

const route = useRoute()
const { t, path } = useLocale()
const ws = useWorkspace()
const session = useEditorSession()
const render = useEditorRender()
const metrics = useEditorFontMetrics()
const board = useEditorPages()

const stage = ref<HTMLElement>()
const railOpen = ref(true)
const currentPage = ref(1)

const doc = session.doc
const pageCount = computed(() => doc.value?.file.page_count ?? 0)
const pages = computed(() => doc.value?.pages ?? [])

/** Fit-width uses the widest page so nothing overflows horizontally. */
function applyFit() {
  if (session.fitMode.value === 'custom') return
  const element = stage.value
  if (!element || !pages.value.length) return
  const widest = Math.max(...pages.value.map((page) => page.width))
  const available = element.clientWidth - 48
  if (available > 0 && widest > 0) session.zoom.value = Math.min(2, Math.max(0.2, available / widest))
}

/**
 * The bot links here as `?file_id=…` after a file has been sent to the chat.
 * Open that file for editing rather than showing an empty launcher.
 */
async function openLinkedFile() {
  const [id] = linkedFileIds(route.query.file_id)
  if (!id || props.documentId) return
  try {
    const created = await ws.api<{ id: string }>('/editor/documents', {
      method: 'POST',
      body: { file_id: id },
    })
    await navigateTo(path(`/app/editor/${created.id}`))
  } catch {
    // Expired, deleted, encrypted or not ours: fall back to the launcher.
  }
}

async function start() {
  if (!props.documentId) {
    await openLinkedFile()
    return
  }
  await session.reset(props.documentId)
  void metrics.ensure()
  const current = session.doc.value
  if (!current) return
  const mode = await render.open(current.file.id)
  if (mode !== 'pdfjs') session.notice.value = t('editorRenderFallback')
  await nextTick()
  applyFit()
  // A tool card deep link (?feature=editor.add_text) arms that tool.
  const feature = String(route.query.feature || '')
  const tool = feature.replace('editor.', '') as CommandType
  if (feature && isCommandType(tool)) session.activeTool.value = tool
}

onMounted(() => {
  if (!ws.features.value.length) void ws.loadCatalog().catch(() => {})
  void start()
  window.addEventListener('resize', applyFit)
  window.addEventListener('keydown', onKeydown)
})

watch(() => props.documentId, start)

// Page organisation always starts from the document as it stands now.
watch(
  () => [session.mode.value, pageCount.value] as const,
  ([mode, count]) => {
    if (mode === 'pages' && count && board.order.value.length !== count) board.reset()
  },
)

/**
 * A draft can hold changes made with a tool that has since been switched off.
 * The server refuses the whole array, so say which changes are the problem
 * instead of letting every autosave fail. Every plan has the same tools, so
 * removing them is the only way on; no plan would bring the tool back.
 */
const lockedCommands = computed(() => {
  const features = ws.features.value
  if (!features.length) return []
  return session.commands.value.filter((command) => {
    const match = features.find((item) => item.id === COMMAND_FEATURE[command.type])
    return match ? match.eligible === false : false
  })
})

watch(lockedCommands, (list) => {
  if (list.length) session.saveState.value = 'paused'
})

function removeLocked() {
  session.removeCommands(lockedCommands.value.map((command) => command._id))
  session.saveState.value = 'dirty'
  void session.save()
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', applyFit)
  window.removeEventListener('keydown', onKeydown)
  void render.teardown()
})

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const typing = !!target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  if (typing) return
  const meta = event.metaKey || event.ctrlKey
  if (meta && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) session.redo()
    else session.undo()
  } else if (meta && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void session.save()
  } else if (event.key === 'Escape') session.activeTool.value = 'select'
  else if (event.key === '+' || event.key === '=') {
    session.fitMode.value = 'custom'
    session.zoom.value = Math.min(4, session.zoom.value * 1.25)
  } else if (event.key === '-') {
    session.fitMode.value = 'custom'
    session.zoom.value = Math.max(0.25, session.zoom.value / 1.25)
  } else if (event.key === '0') session.fitMode.value = 'width'
}

function goToPage(page: number) {
  currentPage.value = page
  document.querySelector(`[data-testid="editor-page-${page}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

/** Keep the rail in step with whichever page fills the stage. */
function onScroll() {
  const element = stage.value
  if (!element) return
  const middle = element.scrollTop + element.clientHeight / 2
  const frames = element.querySelectorAll<HTMLElement>('[data-page]')
  for (const frame of frames) {
    if (frame.offsetTop <= middle && frame.offsetTop + frame.offsetHeight > middle) {
      currentPage.value = Number(frame.dataset.page)
      return
    }
  }
}

// Leaving with unsaved work would lose it: the draft only exists server-side.
onBeforeRouteLeave(async () => {
  if (session.saveState.value === 'dirty') await session.save()
  return true
})
</script>

<template>
  <EditorLauncher v-if="!documentId" />
  <div v-else class="editor-shell" :class="{ 'rail-open': railOpen }">
    <div class="editor-head">
      <NuxtLink :to="path('/app/editor')" class="back-link"
        ><AppIcon name="back" :size="15" />{{ t('editor') }}</NuxtLink
      >
      <h1>{{ doc?.file.name || t('editorTitle') }}</h1>
    </div>

    <ErrorBanner v-if="session.error.value" :message="session.error.value" />
    <p v-if="session.notice.value" class="info-banner" role="status">
      <AppIcon name="alert" :size="17" />{{ session.notice.value }}
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

    <section v-if="lockedCommands.length" class="info-banner editor-conflict" role="alert">
      <div>
        <strong>{{ t('editorLockedCommands', { count: lockedCommands.length }) }}</strong>
      </div>
      <span>
        <button type="button" class="button primary small" @click="removeLocked">
          {{ t('editorRemoveLocked') }}
        </button>
      </span>
    </section>

    <EditorToolStrip @toggle-pages="railOpen = !railOpen" />

    <EditorPagesBoard v-if="session.mode.value === 'pages'" />

    <div v-else class="editor-body">
      <EditorPageRail v-if="railOpen && pageCount" :page-count="pageCount" :current="currentPage" @go="goToPage" />

      <!-- Focusable so the pages can be scrolled from the keyboard alone. -->
      <div
        ref="stage"
        class="editor-stage"
        role="region"
        tabindex="0"
        :aria-label="t('preview')"
        @scroll.passive="onScroll"
      >
        <p v-if="render.mode.value === 'loading'" class="editor-stage-status" role="status">
          <AppIcon name="loader" class="spin" :size="20" />{{ t('editorPreparingPages') }}
        </p>
        <EditorPageCanvas
          v-for="(page, index) in pages"
          :key="index"
          :page="index + 1"
          :page-width="page.width"
          :page-height="page.height"
          :page-count="pageCount"
          :zoom="session.zoom.value"
          :file-id="doc!.file.id"
        >
          <EditorMarkLayer
            :page="index + 1"
            :page-width="page.width"
            :page-height="page.height"
            :zoom="session.zoom.value"
          />
        </EditorPageCanvas>
      </div>

      <aside class="editor-side">
        <EditorFloatBar />
        <EditorFieldPanel v-if="session.mode.value === 'edit'" />
        <EditorCommandList />
      </aside>
    </div>

    <EditorActionBar v-if="session.mode.value !== 'pages'" />
  </div>
</template>
