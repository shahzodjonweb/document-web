<script setup lang="ts">
/**
 * Page organisation board.
 *
 * Every drag-style action also has a button, so reordering is reachable from
 * the keyboard. The result of applying is a new file — the editing draft keeps
 * pointing at the original, which is why content edits block this.
 */
const { t } = useLocale()
const session = useEditorSession()
const render = useEditorRender()
const pages = useEditorPages()

const selected = ref<number[]>([])
const thumbnails = ref<Record<number, string>>({})

const blockedByEdits = computed(() => session.commands.value.length > 0)

async function loadThumbnail(page: number) {
  if (thumbnails.value[page]) return
  const url = await render.thumbnail(page)
  if (url) thumbnails.value = { ...thumbnails.value, [page]: url }
}

watch(
  () => [render.mode.value, pages.pageCount.value] as const,
  ([mode, count]) => {
    if (mode !== 'pdfjs') return
    for (let page = 1; page <= count; page += 1) void loadThumbnail(page)
  },
  { immediate: true },
)

function toggleSelected(page: number) {
  selected.value = selected.value.includes(page)
    ? selected.value.filter((value) => value !== page)
    : [...selected.value, page]
}

const planLabel = computed(() =>
  pages.plan.value.map((step) => t(`${step.feature_id}.name`)).join(' · '),
)
</script>

<template>
  <section class="editor-board-panel" :aria-label="t('editorModePages')" data-testid="editor-pages-board">
    <p class="field-hint">{{ t('editorPagesIntro') }}</p>

    <div v-if="blockedByEdits" class="info-banner" role="status">
      <AppIcon name="alert" :size="17" />
      <span>{{ t('editorPagesBlockedByEdits') }}</span>
    </div>

    <div class="editor-board-toolbar">
      <button type="button" class="button secondary small" @click="selected = pages.order.value.slice()">
        {{ t('editorPagesSelectAll') }}
      </button>
      <button type="button" class="button secondary small" :disabled="!selected.length" @click="selected = []">
        {{ t('editorPagesClearSelection') }}
      </button>
      <button
        type="button"
        class="button secondary small"
        :disabled="!selected.length || blockedByEdits || pages.busy.value"
        @click="pages.extract(selected)"
      >
        <AppIcon name="split" :size="15" />{{ t('editorPagesExtract') }}
      </button>
      <button type="button" class="button secondary small" @click="pages.reset">
        <AppIcon name="rotate" :size="15" />{{ t('editorPagesReset') }}
      </button>
    </div>

    <p v-if="pages.error.value" class="editor-invalid" role="status">{{ pages.error.value }}</p>

    <ul class="editor-board">
      <li
        v-for="page in pages.order.value"
        :key="page"
        class="editor-board-card"
        :class="{ removed: pages.removed.value.includes(page), selected: selected.includes(page) }"
      >
        <label class="check-label">
          <input
            type="checkbox"
            :checked="selected.includes(page)"
            :aria-label="t('editorPageLabel', { page, count: pages.pageCount.value })"
            @change="toggleSelected(page)"
          />
          <span class="visually-hidden">{{ t('editorPageLabel', { page, count: pages.pageCount.value }) }}</span>
        </label>
        <span
          class="editor-board-thumb"
          :style="{ transform: `rotate(${pages.rotation.value[page] ?? 0}deg)` }"
        >
          <img v-if="thumbnails[page]" :src="thumbnails[page]" alt="" />
        </span>
        <strong>{{ page }}</strong>
        <div class="editor-board-actions">
          <button type="button" class="icon-button" :aria-label="t('editorRotateLeft')" @click="pages.rotate(page, -1)">
            <AppIcon name="rotateLeft" :size="16" />
          </button>
          <button type="button" class="icon-button" :aria-label="t('editorRotateRight')" @click="pages.rotate(page, 1)">
            <AppIcon name="rotate" :size="16" />
          </button>
          <button
            type="button"
            class="icon-button"
            :aria-label="t('editorPageMoveEarlier')"
            @click="pages.move(page, -1)"
          >
            <AppIcon name="up" :size="16" />
          </button>
          <button type="button" class="icon-button" :aria-label="t('editorPageMoveLater')" @click="pages.move(page, 1)">
            <AppIcon name="moveDown" :size="16" />
          </button>
          <button
            type="button"
            class="icon-button"
            :aria-label="pages.removed.value.includes(page) ? t('editorPageRestore') : t('editorPageRemove')"
            @click="pages.toggleRemoved(page)"
          >
            <AppIcon :name="pages.removed.value.includes(page) ? 'rotate' : 'trash'" :size="16" />
          </button>
        </div>
      </li>
    </ul>

    <div class="editor-board-apply">
      <p v-if="!pages.plan.value.length" class="field-hint">{{ t('editorPagesNoChange') }}</p>
      <template v-else>
        <p class="field-hint">{{ t('editorPagesPlan', { feature: planLabel }) }}</p>
        <p v-if="pages.plan.value.length > 1" class="info-banner" role="status">
          {{ t('editorPagesMultiStep', { count: pages.plan.value.length }) }}
        </p>
        <p class="field-hint">{{ t('editorPagesResult') }}</p>
      </template>
      <button
        type="button"
        class="button primary"
        data-testid="editor-pages-apply"
        :disabled="!pages.plan.value.length || blockedByEdits || pages.busy.value"
        @click="pages.apply"
      >
        {{ pages.busy.value ? t('working') : t('editorPagesApply') }}<AppIcon name="right" :size="16" />
      </button>
    </div>
  </section>
</template>
