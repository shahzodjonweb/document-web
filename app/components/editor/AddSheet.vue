<script setup lang="ts">
/**
 * One list of what can go on a page, rather than a tool to pick and then a place to
 * find. Opened from bare paper it is "Add here", and what is chosen lands on that
 * spot; opened from the bar, the next tap on the page places it.
 */
import type { CommandType } from '~/composables/useEditorCommands'
import { preparePicture } from '~/composables/useEditorImages'
import { keptImage } from '~/composables/useEditorSignatures'
import { PICTURE_TYPES, type Placement } from '~/composables/useEditorTools'

const { t } = useLocale()
const session = useEditorSession()
const tools = useEditorTools()
const signatures = useEditorSignatures()

const refusal = ref('')
const locked = ref('')

onMounted(() => void signatures.load())

const hasFields = computed(() => (session.doc.value?.form_fields ?? []).some((field) => field.type === '/Tx'))

const ITEMS: { kind: Placement['kind'] | 'fields'; icon: string; label: string; type: CommandType }[] = [
  { kind: 'text', icon: 'type', label: 'editorAddText', type: 'add_text' },
  { kind: 'date', icon: 'calendar', label: 'editorToday', type: 'add_text' },
  { kind: 'tick', icon: 'tick', label: 'editorTick', type: 'draw' },
  { kind: 'picture', icon: 'image', label: 'editorKindPicture', type: 'insert_image' },
  { kind: 'highlight', icon: 'highlighter', label: 'editorKindHighlight', type: 'highlight' },
  { kind: 'draw', icon: 'draw', label: 'editorToolDraw', type: 'draw' },
  { kind: 'note', icon: 'sticky', label: 'editorKindNote', type: 'note' },
  { kind: 'fields', icon: 'files', label: 'editorFillForm', type: 'fill_form' },
]

/** At the spot it was opened from, or armed for the next tap. A line is drawn, not placed. */
function choose(placement: Placement, pin = tools.pin.value) {
  // Something else chosen here instead: a refusal this sheet showed is done with, and goes with it.
  tools.missed.delete(tools.sheetKey('add'))
  tools.closeSheet()
  if (pin && placement.kind !== 'draw') tools.place(placement, pin)
  else tools.arm(placement)
}

function pick(item: (typeof ITEMS)[number]) {
  refusal.value = ''
  tools.missed.delete(tools.sheetKey('add'))
  if (!tools.allows(item.type)) {
    locked.value = locked.value === item.kind ? '' : item.kind
    return
  }
  locked.value = ''
  if (item.kind === 'fields') return tools.openSheet('fields')
  if (item.kind === 'picture') {
    // To the spot it was asked for at, even with the sheet put away by the time the photo comes.
    const pin = tools.pin.value
    return tools.pickFile(PICTURE_TYPES, (file) => void onFile(file, pin))
  }
  choose({ kind: item.kind as Placement['kind'] })
}

async function onFile(file: File, pin: typeof tools.pin.value) {
  tools.missed.delete(tools.sheetKey('add'))
  tools.startPicture()
  // A send waits while it is made ready, and then, once placed, while it goes up. Under a
  // name of its own: a Replace or Turn ending meanwhile does not end this, nor this one them.
  session.begin('picture-ready')
  const doc = session.doc.value?.id
  try {
    const image = await preparePicture(file)
    // Another document opened meanwhile: this picture was not chosen for it.
    if (session.doc.value?.id !== doc) return
    if (!image) {
      refusal.value = t('editorImageRefused')
      // Nothing was placed. This line may be under Review, or closed unread: Review says it too.
      tools.miss(tools.sheetKey('add'), 'picture_not_ready')
      return
    }
    choose({ kind: 'picture', image }, pin)
  } finally {
    session.end('picture-ready')
  }
}

const signatureLocked = computed(() => !tools.allows('signature'))
</script>

<template>
  <div class="editor-add" data-testid="editor-add">
    <div
      v-if="signatures.kept.value.length || !signatureLocked"
      class="editor-add-signatures"
      role="group"
      :aria-label="t('editorTabSign')"
    >
      <template v-if="!signatureLocked">
        <button
          v-for="(signature, index) in signatures.kept.value"
          :key="signature.id"
          type="button"
          class="editor-kept"
          :aria-label="t('editorKeptSignature', { n: index + 1 })"
          :data-testid="`editor-add-kept-${index + 1}`"
          @click="choose({ kind: 'signature', image: keptImage(signature), keptId: signature.id })"
        >
          <img :src="signature.src" alt="" />
        </button>
      </template>
      <button
        type="button"
        class="editor-add-item wide"
        data-testid="editor-add-new-signature"
        :data-locked="signatureLocked || undefined"
        @click="
          signatureLocked
            ? (locked = locked === 'signature' ? '' : 'signature')
            : tools.openSheet('sign', tools.pin.value)
        "
      >
        <AppIcon name="signature" :size="20" /><span>{{ t('editorNewSignature') }}</span>
        <AppIcon v-if="signatureLocked" name="lock" :size="13" />
      </button>
    </div>

    <div class="editor-add-grid">
      <button
        v-for="item in ITEMS"
        v-show="item.kind !== 'fields' || hasFields"
        :key="item.kind"
        type="button"
        class="editor-add-item"
        :data-locked="!tools.allows(item.type) || undefined"
        :data-testid="`editor-add-${item.kind}`"
        @click="pick(item)"
      >
        <AppIcon :name="item.icon" :size="20" /><span>{{ t(item.label) }}</span>
        <template v-if="!tools.allows(item.type)"
          ><AppIcon name="lock" :size="13" /><span class="visually-hidden">{{
            t('editorLocked')
          }}</span></template
        >
      </button>
    </div>

    <p v-if="locked" class="editor-lock" role="status">
      <AppIcon name="lock" :size="15" />
      <span>{{
        t('editorLockedTool', {
          tool: t(
            locked === 'signature'
              ? 'editorKindSignature'
              : ITEMS.find((item) => item.kind === locked)!.label,
          ),
        })
      }}</span>
    </p>
    <p v-if="refusal" class="editor-invalid" role="alert" data-testid="editor-add-refusal">{{ refusal }}</p>

  </div>
</template>
