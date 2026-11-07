<script setup lang="ts">
/**
 * The editor workspace.
 *
 * Owns the route, the layout and the global keyboard map. The session state is
 * `useState`-backed and therefore survives navigation, so it is reset on mount
 * and whenever the document in the URL changes.
 */
import { COMMAND_FEATURE, isCommandType, type CommandType } from '~/composables/useEditorCommands'
import { turnedSize } from '~/composables/useEditorPageOrder'
import type { Refusal } from '~/composables/useEditorSession'

const props = defineProps<{ documentId?: string }>()

const route = useRoute()
const { t, path } = useLocale()
const ws = useWorkspace()
const session = useEditorSession()
const render = useEditorRender()
const metrics = useEditorFontMetrics()
const board = useEditorPages()
const frame = useEditorFrame()
const studio = useStudio()
const pageOrder = useEditorPageOrder()

const stage = ref<HTMLElement>()
const railOpen = ref(true)
const currentPage = ref(1)

const doc = session.doc
const pageCount = computed(() => doc.value?.file.page_count ?? 0)
const pages = computed(() => doc.value?.pages ?? [])
/**
 * The new frame shows the file as it will be made: its pages in their new order,
 * turned, without the removed ones. Marks keep the numbers of the pages as uploaded.
 */
const shown = computed(() =>
  pageOrder.kept.value
    .filter((page) => pages.value[page - 1])
    .map((page) => {
      const size = pages.value[page - 1]!
      const turn = pageOrder.turnOf(page)
      return { page, size, turn, box: turnedSize(size, turn) }
    }),
)
/** Why the bot's link could not open its file, said as a state of its own rather than the launcher. */
const refusal = ref<Refusal | null>(null)

/**
 * Fit-width uses the widest page so nothing overflows horizontally. A phone has
 * no width to spare: the stage runs edge to edge there and keeps 4 px a side.
 */
function applyFit() {
  if (session.fitMode.value === 'custom') return
  const element = stage.value
  if (!element || !pages.value.length) return
  const widest = frame.v2.value
    ? Math.max(...shown.value.map((item) => item.box.width))
    : Math.max(...pages.value.map((page) => page.width))
  const available = element.clientWidth - (window.matchMedia('(max-width: 760px)').matches ? 8 : 48)
  // A poster fits too: as low as a page can be drawn, where the zoom buttons stop at 25 %.
  if (available > 0 && widest > 0) session.zoom.value = Math.min(2, Math.max(0.05, available / widest))
}

// The zoom control and the 0 key ask for fit-width by setting the mode, which
// Pages mode can do while there is no stage to measure. The page count is there
// because the fit cannot wait for the file: on a phone a page wider than the
// screen would scroll sideways for the whole download.
watch([session.fitMode, stage, () => pages.value.length], applyFit)
// A page turned a quarter is as wide as it was tall.
watch(() => shown.value.map((item) => item.box.width).join(), applyFit)

/**
 * The bot links here as `?file_id=…` after a file has been sent to the chat.
 * Open that file for editing rather than showing an empty launcher.
 */
async function openLinkedFile() {
  const [id] = linkedFileIds(route.query.file_id)
  refusal.value = null
  if (!id || props.documentId) return
  try {
    const created = await ws.api<{ id: string }>('/editor/documents', {
      method: 'POST',
      body: { file_id: id },
    })
    await navigateTo(path(`/app/editor/${created.id}`))
  } catch (e) {
    // Expired, deleted, encrypted or not ours. Today's editor falls back to the launcher;
    // the new frame says which, with the way on where there is one.
    refusal.value = session.refusalOf(e)
  }
}

/** Until the switch answers, which way the file is read is not known yet. */
function switchKnown() {
  if (studio.loaded.value) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timer = setTimeout(done, 5000)
    const stop = watch(studio.loaded, (loaded) => loaded && done())
    function done() {
      clearTimeout(timer)
      stop()
      resolve()
    }
  })
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
  // Only a device that last saw the new frame waits to hear: anyone else reads the file at once, as before.
  if (frame.expected.value) await switchKnown()
  const mode = await render.open(current.file.id)
  if (mode !== 'pdfjs') session.notice.value = t('editorRenderFallback')
  await nextTick()
  applyFit()
  // A tool card deep link (?feature=editor.add_text) arms that tool.
  const feature = String(route.query.feature || '')
  const tool = feature.replace('editor.', '') as CommandType
  if (feature && isCommandType(tool)) session.activeTool.value = tool
}

/**
 * Telegram can be minimised and the app closed without warning, and the timers
 * of a hidden page may never fire: this is the last chance to send the work.
 */
function onVisibilityChange() {
  if (document.visibilityState === 'hidden') void session.flush()
}
function onPageHide() {
  void session.flush()
}

onMounted(() => {
  if (!ws.features.value.length) void ws.loadCatalog().catch(() => {})
  void start()
  window.addEventListener('resize', applyFit)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

watch(() => props.documentId, start)
// Edit under a result links here with the file; the old editor never did.
watch(
  () => route.query.file_id,
  () => frame.v2.value && !props.documentId && void openLinkedFile(),
)

// Page organisation always starts from the document as it stands now.
watch(
  () => [session.mode.value, pageCount.value] as const,
  ([mode, count]) => {
    if (mode === 'pages' && count && board.order.value.length !== count) board.reset()
  },
)

/**
 * A draft can hold changes made with a tool that has since been switched off.
 * The server refuses the whole array, so say which changes are the problem:
 * every autosave fails until they go. Every plan has the same tools, so
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

function removeLocked() {
  session.removeCommands(lockedCommands.value.map((command) => command._id))
  session.saveState.value = 'dirty'
  void session.save()
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', applyFit)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pagehide', onPageHide)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  // Most links stay on this route record, so the guard below does not see them.
  void session.flush()
  void render.teardown()
})

function onKeydown(event: KeyboardEvent) {
  // The launcher is this component too, and a document opening is not on screen yet.
  if (!props.documentId || session.isBusy('load')) return
  const target = event.target as HTMLElement | null
  const typing = !!target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  if (typing) return
  const meta = event.metaKey || event.ctrlKey
  // `code` as well: on a Russian layout the Z key reports "я".
  const pressed = (letter: string) =>
    event.key.toLowerCase() === letter || event.code === `Key${letter.toUpperCase()}`
  if (meta && pressed('z')) {
    event.preventDefault()
    // A sheet that waits for an answer has the screen: a step undone under it, as under Review, changes what it says.
    if (frame.v2.value && document.querySelector('dialog[open][data-modal]')) return
    if (event.shiftKey) session.redo()
    else session.undo()
  } else if (meta && pressed('s')) {
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
  // A turned page sits inside its slot, which is what takes the room on the stage.
  const frames = element.querySelectorAll<HTMLElement>(frame.v2.value ? '[data-page-slot]' : '[data-page]')
  for (const frame of frames) {
    if (frame.offsetTop <= middle && frame.offsetTop + frame.offsetHeight > middle) {
      currentPage.value = Number(frame.dataset.page ?? frame.dataset.pageSlot)
      return
    }
  }
}

// A new order, or the stage back from Pages, puts a different page on screen.
watch(
  () => [shown.value.map((item) => item.page).join(), session.mode.value],
  () => void nextTick(onScroll),
)

/** A refused save says why in the action bar, which stays on screen on a phone. Pages mode has none. */
const bannerError = computed(
  () => session.error.value || (session.mode.value === 'pages' ? session.saveError.value : ''),
)

// Leaving with unsaved work would lose it: the draft only exists server-side.
onBeforeRouteLeave(async () => {
  await session.flushBriefly()
  return true
})
</script>

<template>
  <EditorOpenRefusal v-if="!documentId && refusal && frame.v2.value" :refusal="refusal" />
  <EditorLauncher v-else-if="!documentId" />
  <!-- On a device that last saw the new frame, the switch's answer decides it: swapping under someone's work would be worse than a moment's wait. -->
  <p
    v-else-if="!frame.known.value && frame.expected.value"
    class="editor-stage-status"
    role="status"
    data-testid="editor-opening"
  >
    <AppIcon name="loader" class="spin" :size="20" />{{ t('editorPreparingPages') }}
  </p>
  <EditorFrame
    v-else-if="frame.v2.value"
    :page-count="pageCount"
    :current-page="currentPage"
    :locked-count="lockedCommands.length"
    @go="goToPage"
    @remove-locked="removeLocked"
  >
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
      <div
        v-for="(item, index) in shown"
        :key="item.page"
        class="editor-page-slot"
        :data-page-slot="item.page"
        :style="{
          width: `${item.box.width * session.zoom.value}px`,
          aspectRatio: `${item.box.width} / ${item.box.height}`,
        }"
      >
        <EditorPageCanvas
          :page="item.page"
          :page-width="item.size.width"
          :page-height="item.size.height"
          :page-count="shown.length"
          :position="index + 1"
          :zoom="session.zoom.value"
          :file-id="doc!.file.id"
          :turn="item.turn"
          :early="index === 0"
        >
          <EditorMarkLayer
            :page="item.page"
            :page-width="item.size.width"
            :page-height="item.size.height"
            :zoom="session.zoom.value"
            :turn="item.turn"
          />
        </EditorPageCanvas>
      </div>
    </div>
  </EditorFrame>
  <div v-else class="editor-shell" :class="{ 'rail-open': railOpen }">
    <div class="editor-head">
      <NuxtLink :to="path('/app/editor')" class="back-link"
        ><AppIcon name="back" :size="15" />{{ t('editor') }}</NuxtLink
      >
      <h1>{{ (!session.isBusy('load') && doc?.file.name) || t('editorTitle') }}</h1>
    </div>

    <!-- The document on screen goes as soon as another is asked for, so nothing can be edited in the gap. -->
    <p v-if="session.isBusy('load')" class="editor-stage-status" role="status" data-testid="editor-opening">
      <AppIcon name="loader" class="spin" :size="20" />{{ t('editorPreparingPages') }}
    </p>

    <template v-else>
      <ErrorBanner v-if="bannerError" :message="bannerError" />
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
        <EditorPageRail
          v-if="railOpen && pageCount"
          :page-count="pageCount"
          :current="currentPage"
          @go="goToPage"
        />

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
    </template>
  </div>
</template>
