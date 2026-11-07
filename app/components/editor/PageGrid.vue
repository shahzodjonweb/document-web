<script setup lang="ts">
/**
 * Pages under the switch. Turning, moving and removing a page are changes of the
 * draft like any mark, sent in the same job, so nothing here is ever locked by the
 * marks. A tap chooses a page and its sheet has a labelled button for each change;
 * Move puts "Put page here" between the others, and the grip drags a page there as
 * a shortcut. Removing a page that holds changes asks first.
 */
import { turnedSize } from '~/composables/useEditorPageOrder'

const { t, locale } = useLocale()
const session = useEditorSession()
const render = useEditorRender()
const order = useEditorPageOrder()
const telegram = useTelegramApp()
const snackbar = useEditorSnackbar()

const chosen = ref<number | null>(null)
const moving = ref<number | null>(null)
const asking = ref(false)
const thumbnails = ref<Record<number, string>>({})

const plural = (key: string, amount: number, values: Record<string, string | number> = {}) =>
  t(`${key}_${new Intl.PluralRules(locale.value).select(amount)}`, { count: amount, ...values })

async function loadThumbnail(page: number) {
  if (thumbnails.value[page]) return
  const url = await render.thumbnail(page)
  if (url) thumbnails.value = { ...thumbnails.value, [page]: url }
}
watch(
  () => [render.mode.value, order.count.value] as const,
  ([mode, count]) => {
    if (mode !== 'pdfjs') return
    for (let page = 1; page <= count; page += 1) void loadThumbnail(page)
  },
  { immediate: true },
)

/** Each page as the file will have it: its place, its turn, whether it goes. */
const cards = computed(() =>
  order.plan.value.order.map((page) => ({
    page,
    position: order.positionOf(page),
    turn: order.turnOf(page),
    removed: order.isRemoved(page),
    marks: order.marksOn(page),
    size: turnedSize(session.pageSize(page), order.turnOf(page)),
  })),
)
const total = computed(() => order.kept.value.length)
/**
 * The picture is of the page as uploaded. Turned, it is drawn at the uploaded
 * page's shape inside the box of the turned one, then turned about the middle.
 */
function turnedThumb(card: { turn: number; size: { width: number; height: number } }) {
  const across = card.turn % 180 !== 0
  return {
    width: across ? `${(100 * card.size.height) / card.size.width}%` : '100%',
    height: across ? `${(100 * card.size.width) / card.size.height}%` : '100%',
    transform: `translate(-50%, -50%) rotate(${card.turn}deg)`,
  }
}
const chosenCard = computed(() => cards.value.find((card) => card.page === chosen.value) ?? null)
const sheetTitle = computed(() => {
  const card = chosenCard.value
  if (!card) return ''
  return card.removed
    ? t('editorPageRemovedTitle', { page: card.page })
    : t('editorPageLabel', { page: card.position, count: total.value })
})

function choose(page: number) {
  if (moving.value !== null) return
  asking.value = false
  chosen.value = chosen.value === page ? null : page
}
function closeSheet() {
  chosen.value = null
  asking.value = false
}

// Move is a place of its own: Back, or Cancel, leaves it with the page where it was.
telegram.useBackLayer(
  () => moving.value !== null,
  () => (moving.value = null),
)

function startMove() {
  moving.value = chosen.value
  closeSheet()
}
/** The places a moving page can go: before each other page, and last, where that changes anything. */
function targetBefore(page: number | null) {
  const from = moving.value
  if (from === null) return false
  const kept = order.kept.value
  const index = kept.indexOf(from)
  if (page === null) return index !== kept.length - 1
  if (page === from || order.isRemoved(page)) return false
  return kept.indexOf(page) !== index + 1
}
function putBefore(page: number | null) {
  const from = moving.value
  if (from === null) return
  const others = order.kept.value.filter((value) => value !== from)
  const moved = order.moveTo(from, page === null ? others.length : others.indexOf(page))
  moving.value = null
  // While a send holds the draft nothing moved, and nothing says it did.
  if (!moved) return
  telegram.haptic('light')
  snackbar.show({ message: t('editorPageMoved', { page: order.positionOf(from) }) })
}

function turn(direction: 1 | -1) {
  if (chosen.value !== null) order.turn(chosen.value, direction)
}
function step(direction: 1 | -1) {
  if (chosen.value !== null) order.moveBy(chosen.value, direction)
}
/** Asks first when the page holds changes, which go with it. */
function askRemove() {
  const card = chosenCard.value
  if (!card) return
  if (card.marks) asking.value = true
  else remove(card.page)
}
function remove(page: number) {
  const position = order.positionOf(page)
  if (!order.remove(page)) {
    asking.value = false
    // The last page stays; while a send holds the draft nothing goes, which the frame's own line says.
    if (!session.held.value) snackbar.show({ message: t('editorPagesKeepOne') })
    return
  }
  closeSheet()
  telegram.haptic('light')
  snackbar.show({
    message: t('editorPageGone', { page: position }),
    actionLabel: t('editorUndo'),
    onAction: session.undo,
    step: session.steps.value,
  })
}
function restore(page: number) {
  order.restore(page)
  if (chosen.value === page) closeSheet()
}

/* -------------------------------------------------------------- the grip */

const dragging = ref<number | null>(null)
const dropBefore = ref<number | null | undefined>(undefined)
let releaseSwipes: (() => void) | null = null
/** A drag ends in a click on the grip too, which is not a tap to choose the page. */
let dragged = false

/** Which page a finger is over, and whether it is on that page's later half. */
function dropAt(event: PointerEvent) {
  const card = (
    document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
  )?.closest<HTMLElement>('[data-grid-page]')
  if (!card) return undefined
  const page = Number(card.dataset.gridPage)
  if (order.isRemoved(page)) return undefined
  const box = card.getBoundingClientRect()
  if (event.clientX < box.left + box.width / 2) return page
  const kept = order.kept.value
  return kept[kept.indexOf(page) + 1] ?? null
}
function grab(event: PointerEvent, page: number) {
  if (event.button !== 0 || !telegram.canDragMarks.value) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  dragging.value = page
  dropBefore.value = undefined
  releaseSwipes = telegram.holdSwipes()
}
function drag(event: PointerEvent) {
  if (dragging.value === null) return
  const at = dropAt(event)
  dropBefore.value = at === dragging.value ? undefined : at
  if (dropBefore.value !== undefined) dragged = true
}
function drop() {
  const page = dragging.value
  const before = dropBefore.value
  dragging.value = null
  dropBefore.value = undefined
  releaseSwipes?.()
  releaseSwipes = null
  if (page === null || before === undefined) return
  const others = order.kept.value.filter((value) => value !== page)
  order.moveTo(page, before === null ? others.length : others.indexOf(before))
}
function tapGrip(page: number) {
  if (dragged) dragged = false
  else choose(page)
}
onBeforeUnmount(() => releaseSwipes?.())
</script>

<template>
  <section class="editor-pages-panel" :aria-label="t('editorModePages')" data-testid="editor-pages-board">
    <p v-if="moving !== null" class="editor-pages-moving" role="status" data-testid="editor-pages-moving">
      <span>{{ t('editorPageMoveHint', { page: order.positionOf(moving) }) }}</span>
      <button
        type="button"
        class="button secondary small"
        data-testid="editor-move-cancel"
        @click="moving = null"
      >
        {{ t('cancel') }}
      </button>
    </p>
    <ul class="editor-pages-grid" :class="{ moving: moving !== null }">
      <template v-for="card in cards" :key="card.page">
        <li v-if="targetBefore(card.page)" class="editor-pages-slot">
          <button
            type="button"
            class="editor-pages-target"
            :data-testid="`editor-put-before-${card.page}`"
            @click="putBefore(card.page)"
          >
            {{ t('editorPutPageHere', { page: order.positionOf(moving!) }) }}
          </button>
        </li>
        <li
          class="editor-pages-card"
          :class="{
            removed: card.removed,
            chosen: chosen === card.page || moving === card.page,
            'drop-before': dragging !== null && dropBefore === card.page,
          }"
          :data-grid-page="card.page"
        >
          <button
            type="button"
            class="editor-pages-pick"
            :aria-pressed="chosen === card.page"
            :aria-label="
              card.removed
                ? t('editorPageRemovedTitle', { page: card.page })
                : card.marks
                  ? `${t('editorPageLabel', { page: card.position, count: total })}, ${plural('editorReviewChanges', card.marks)}`
                  : t('editorPageLabel', { page: card.position, count: total })
            "
            :data-testid="`editor-grid-page-${card.page}`"
            @click="choose(card.page)"
          >
            <span
              class="editor-pages-thumb"
              :style="{ aspectRatio: `${card.size.width} / ${card.size.height}` }"
            >
              <img
                v-if="thumbnails[card.page]"
                :src="thumbnails[card.page]"
                alt=""
                :class="{ turned: card.turn }"
                :style="card.turn ? turnedThumb(card) : undefined"
              />
            </span>
            <strong>{{ card.removed ? t('editorPageRemoved') : card.position }}</strong>
            <small v-if="card.turn" class="editor-pages-turn"
              ><AppIcon name="rotate" :size="12" />{{ card.turn }}°</small
            >
            <!-- A pencil with it, as a bare number in the corner reads as the page's own. -->
            <small v-if="card.marks && !card.removed" class="count-tag editor-pages-marks" aria-hidden="true"
              ><AppIcon name="edit" :size="11" />{{ card.marks }}</small
            >
          </button>
          <button
            v-if="card.removed"
            type="button"
            class="button secondary small"
            :data-testid="`editor-restore-${card.page}`"
            @click="restore(card.page)"
          >
            {{ t('editorRestore') }}
          </button>
          <button
            v-else
            type="button"
            class="editor-pages-grip icon-button"
            :aria-label="t('editorPageDrag', { page: card.position })"
            :data-testid="`editor-grip-${card.page}`"
            @pointerdown="grab($event, card.page)"
            @pointermove="drag"
            @pointerup="drop"
            @pointercancel="drop"
            @click="tapGrip(card.page)"
          >
            <AppIcon name="grip" :size="18" />
          </button>
        </li>
      </template>
      <li v-if="targetBefore(null)" class="editor-pages-slot">
        <button
          type="button"
          class="editor-pages-target"
          data-testid="editor-put-last"
          @click="putBefore(null)"
        >
          {{ t('editorPutPageHere', { page: order.positionOf(moving!) }) }}
        </button>
      </li>
    </ul>
  </section>

  <EditorSheet :open="!!chosenCard" :title="sheetTitle" testid="editor-page-sheet" @close="closeSheet">
    <div v-if="asking && chosenCard" class="editor-page-ask" role="alertdialog" :aria-label="sheetTitle">
      <p>{{ plural('editorDeletePage', chosenCard.marks, { n: chosenCard.position }) }}</p>
      <span>
        <button
          type="button"
          class="button secondary"
          data-testid="editor-page-delete-cancel"
          @click="asking = false"
        >
          {{ t('cancel') }}
        </button>
        <button
          type="button"
          class="button secondary editor-object-delete"
          data-testid="editor-page-delete-confirm"
          @click="remove(chosenCard.page)"
        >
          {{ t('editorDeletePageAction') }}
        </button>
      </span>
    </div>
    <div v-else-if="chosenCard && chosenCard.removed" class="editor-page-actions">
      <button type="button" class="button secondary" @click="restore(chosenCard.page)">
        <AppIcon name="undo" :size="16" />{{ t('editorRestore') }}
      </button>
    </div>
    <div v-else-if="chosenCard" class="editor-page-actions">
      <button type="button" class="button secondary" data-testid="editor-page-turn-left" @click="turn(-1)">
        <AppIcon name="rotateLeft" :size="16" />{{ t('editorTurnLeft') }}
      </button>
      <button type="button" class="button secondary" data-testid="editor-page-turn-right" @click="turn(1)">
        <AppIcon name="rotate" :size="16" />{{ t('editorTurnRight') }}
      </button>
      <button
        type="button"
        class="button secondary"
        :disabled="chosenCard.position <= 1"
        data-testid="editor-page-earlier"
        @click="step(-1)"
      >
        <AppIcon name="up" :size="16" />{{ t('editorEarlier') }}
      </button>
      <button
        type="button"
        class="button secondary"
        :disabled="total < 2"
        data-testid="editor-page-move"
        @click="startMove"
      >
        <AppIcon name="move" :size="16" />{{ t('editorMove') }}
      </button>
      <button
        type="button"
        class="button secondary"
        :disabled="chosenCard.position >= total"
        data-testid="editor-page-later"
        @click="step(1)"
      >
        <AppIcon name="moveDown" :size="16" />{{ t('editorLater') }}
      </button>
      <button
        type="button"
        class="button secondary editor-object-delete"
        data-testid="editor-page-delete"
        @click="askRemove"
      >
        <AppIcon name="trash" :size="16" />{{ t('editorDeletePageAction') }}
      </button>
    </div>
  </EditorSheet>
</template>
