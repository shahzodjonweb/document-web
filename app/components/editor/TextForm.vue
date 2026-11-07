<script setup lang="ts">
/**
 * The docked field for new words: it takes the top bar's place, as iOS Telegram does
 * not make room for the keyboard and the page below the top has to stay in sight.
 * 16 px, or iOS zooms the page in. What it has to say goes under the field, where the
 * eyes already are. The page's own words are not changed here in this release.
 */
import { LIMITS } from '~/composables/useEditorCommands'

const { t } = useLocale()
const session = useEditorSession()
const tools = useEditorTools()
const metrics = useEditorFontMetrics()
const telegram = useTelegramApp()

const input = ref<HTMLTextAreaElement>()
const command = computed(
  () => session.commands.value.find((item) => item._id === session.editingId.value) ?? null,
)
const title = computed(() => (command.value?.type === 'note' ? t('editorKindNote') : t('editorKindText')))

// Back keeps what was typed, as Done does: going back loses nothing.
telegram.useBackLayer(() => !!command.value, tools.commitField)

/** Above the keyboard, between it and this field: where the words being typed are. */
function showMark() {
  const id = command.value?._id
  if (id) document.querySelector(`[data-testid="editor-mark-${id}"]`)?.scrollIntoView({ block: 'nearest' })
}
onMounted(() => {
  input.value?.focus({ preventScroll: true })
  // The primer that held the keyboard up has done its job.
  document.querySelectorAll('[data-keyboard-primer]').forEach((node) => node.remove())
  void nextTick(showMark)
})
watch(telegram.keyboardInset, () => void nextTick(showMark))

/** The server's rule: no control characters but newline and tab, and no more than it takes. */
function onInput(event: Event) {
  const current = command.value
  if (!current) return
  const raw = (event.target as HTMLTextAreaElement).value
  let clean = ''
  for (const character of raw) {
    const code = character.codePointAt(0) ?? 0
    if (code >= 32 || character === '\n' || character === '\t') clean += character
  }
  const capped = [...clean].slice(0, LIMITS.text).join('')
  if (capped !== raw) (event.target as HTMLTextAreaElement).value = capped
  session.patchCommand(current._id, { text: capped }, `text:${current._id}`)
}

const overflowing = computed(() => {
  const current = command.value
  if (!current || current.type !== 'add_text' || !metrics.ready.value) return false
  const page = session.pageSize(current.page ?? 1)
  const result = metrics.textOverflow(
    current.text ?? '',
    current.font_size ?? 16,
    current.x ?? 0,
    current.y ?? 0,
    page.width,
    page.height,
  )
  return result.horizontal || result.vertical
})
const left = computed(() => LIMITS.text - [...(command.value?.text ?? '')].length)

/** The engine never wraps: real line breaks where the page ends. */
function fitToPage() {
  const current = command.value
  if (!current) return
  const page = session.pageSize(current.page ?? 1)
  const wrapped = metrics.wrapToWidth(
    current.text ?? '',
    current.font_size ?? 16,
    page.width - (current.x ?? 0),
  )
  session.patchCommand(current._id, { text: wrapped }, 'wrap')
  input.value?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    tools.cancelField()
  } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    tools.commitField()
  }
}
</script>

<template>
  <div v-if="command" class="editor-dock" role="group" :aria-label="title" data-testid="editor-text-form">
    <div class="editor-dock-head">
      <button type="button" class="text-link" data-testid="editor-text-cancel" @click="tools.cancelField">
        {{ t('cancel') }}
      </button>
      <strong>{{ title }}</strong>
      <button
        type="button"
        class="button primary small"
        data-testid="editor-text-done"
        @click="tools.commitField"
      >
        {{ t('editorDone') }}
      </button>
    </div>
    <textarea
      ref="input"
      class="editor-dock-input"
      rows="2"
      :value="command.text"
      :placeholder="t('editorTextPlaceholder')"
      :aria-label="title"
      aria-describedby="editor-dock-message"
      spellcheck="false"
      autocapitalize="sentences"
      data-testid="editor-text-input"
      @input="onInput"
      @keydown="onKeydown"
    />
    <!-- Mounted while the field is, so what it says is announced as it changes. -->
    <p id="editor-dock-message" class="editor-dock-message" role="status" data-testid="editor-text-message">
      <template v-if="overflowing">
        <span>{{ t('editorTextOverflow') }}</span>
        <button type="button" class="text-link" data-testid="editor-text-fit" @click="fitToPage">
          {{ t('editorWrapToPage') }}
        </button>
      </template>
      <span v-else-if="left < 200">{{ t('editorTextLeft', { count: left }) }}</span>
    </p>
  </div>
</template>
