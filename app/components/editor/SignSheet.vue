<script setup lang="ts">
/**
 * Sign: a kept signature, a new one drawn with a finger, or one photographed on
 * paper. "Keep this signature on this phone" is off unless ticked, and a kept one
 * can be forgotten right here. With Replace in a mark's form, the choice becomes
 * that mark's picture instead of a new mark.
 */
import { signatureFromPhoto, type PreparedImage } from '~/composables/useEditorImages'
import { keptImage, type KeptSignature } from '~/composables/useEditorSignatures'

const { t } = useLocale()
const session = useEditorSession()
const tools = useEditorTools()
const signatures = useEditorSignatures()
const hints = useEditorHints()
const snackbar = useEditorSnackbar()

const padOpen = ref(false)
const keep = ref(false)
const refusal = ref('')
/** How long the phone has to keep a new signature before it is used unkept. */
const KEEP_WAIT = 3000

onMounted(() => void signatures.load())

/** The mark this replaces is changing already: another choice now would race that change, unwatched. */
const changing = computed(() => tools.changing.has(tools.replacing.value))

/**
 * A replacement goes back to the mark it was chosen for, and says whether it got
 * there; anything else lands at the spot, or waits for a tap.
 */
function use(image: PreparedImage, keptId?: string, replacing = tools.replacing.value) {
  const placement = { kind: 'signature' as const, image, keptId }
  const pin = tools.pin.value
  // A signature chosen after all: a photo this sheet refused before is done with.
  tools.missed.delete(tools.sheetKey('sign'))
  tools.closeSheet()
  if (replacing) {
    session.select(replacing)
    return tools.replacePicture(replacing, placement)
  }
  if (pin) tools.place(placement, pin)
  else tools.arm(placement)
  return true
}

function useKept(signature: KeptSignature) {
  void use(keptImage(signature), signature.id)
}

/** A finger landing a little low on the signature lands here, so Undo puts it back. */
async function forget(signature: KeptSignature, index: number) {
  await signatures.forget(signature.id)
  snackbar.show({
    message: t('editorSignatureForgotten'),
    actionLabel: t('editorUndo'),
    onAction: () => void signatures.restore(signature, index),
  })
}

/** Kept first when asked, so the next document offers it straight away. A mark it replaces is waited on from here. */
function useNew(image: PreparedImage, replacing = tools.replacing.value) {
  padOpen.value = false
  // Kept on the phone first, which takes a moment: a send waits for it from here, not from placing.
  tools.startPicture()
  session.begin('signature-keep')
  return tools
    .changePicture(replacing, async () => {
      // A phone that never answers keeps nothing, rather than hold every send.
      const kept = keep.value
        ? await Promise.race([signatures.keep(image), new Promise<null>((done) => setTimeout(() => done(null), KEEP_WAIT))])
        : null
      return use(kept ? keptImage(kept) : image, kept?.id, replacing)
    })
    .finally(() => session.end('signature-keep'))
}

/** A mark this replaces is the one the photo goes to, whatever is open by the time the phone hands it over. */
function askPhoto() {
  const replacing = tools.replacing.value
  tools.pickFile('image/*', (file) => void onPhoto(file, replacing))
}

async function onPhoto(file: File, replacing: string) {
  // Taken off meanwhile, the mark wants no signature.
  if (replacing && !session.commands.value.some((item) => item._id === replacing)) return
  refusal.value = ''
  tools.missed.delete(tools.sheetKey('sign'))
  tools.startPicture()
  // A send waits for it from here.
  session.begin('signature-photo')
  const doc = session.doc.value?.id
  try {
    await tools.changePicture(replacing, async () => {
      const image = await signatureFromPhoto(file)
      // Another document opened meanwhile: this signature was not chosen for it.
      if (session.doc.value?.id !== doc) return false
      if (image) return useNew(image, replacing)
      refusal.value = t('editorSignaturePhotoRefused')
      // Nothing was placed. This line may be under Review, or closed unread: Review says it too.
      if (!replacing) tools.miss(tools.sheetKey('sign'), 'picture_not_ready')
      return false
    })
  } finally {
    session.end('signature-photo')
  }
}
</script>

<template>
  <div class="editor-sign" data-testid="editor-sign">
    <p v-if="hints.showing('sign')" class="field-hint">{{ t('editorHintSign') }}</p>

    <ul v-if="signatures.kept.value.length" class="editor-kept-list" :aria-label="t('editorKeptSignatures')">
      <li v-for="(signature, index) in signatures.kept.value" :key="signature.id">
        <button
          type="button"
          class="editor-kept"
          :aria-label="t('editorKeptSignature', { n: index + 1 })"
          :data-testid="`editor-kept-${index + 1}`"
          :disabled="changing"
          @click="useKept(signature)"
        >
          <img :src="signature.src" alt="" />
        </button>
        <button
          type="button"
          class="text-link"
          :aria-label="t('editorForgetSignature', { n: index + 1 })"
          :data-testid="`editor-forget-${index + 1}`"
          @click="forget(signature, index)"
        >
          {{ t('editorForget') }}
        </button>
      </li>
    </ul>

    <div class="editor-sign-actions">
      <button
        type="button"
        class="button secondary small"
        data-testid="editor-sign-draw"
        :disabled="changing"
        @click="padOpen = true"
      >
        <AppIcon name="signature" :size="17" />{{ t('editorDrawNew') }}
      </button>
      <button
        type="button"
        class="button secondary small"
        data-testid="editor-sign-photo"
        :disabled="changing || session.isBusy('signature-photo') || tools.picking.value"
        @click="askPhoto()"
      >
        <AppIcon :name="session.isBusy('signature-photo') ? 'loader' : 'camera'" :size="17" />{{
          t('editorFromPhoto')
        }}
      </button>
    </div>

    <label class="check-label editor-keep">
      <input v-model="keep" type="checkbox" data-testid="editor-sign-keep" />
      <span>{{ t('editorKeepSignature') }}</span>
    </label>
    <p v-if="refusal" class="editor-invalid" role="alert" data-testid="editor-sign-refusal">{{ refusal }}</p>


    <!-- The whole height: a finger needs the room, and a signature has the screen's attention. -->
    <EditorSheet
      :open="padOpen"
      size="full"
      modal
      :title="t('editorDrawNew')"
      testid="editor-pad-sheet"
      @close="padOpen = false"
    >
      <EditorSignaturePad local @drawn="useNew">
        <label class="check-label editor-keep">
          <input v-model="keep" type="checkbox" data-testid="editor-pad-keep" />
          <span>{{ t('editorKeepSignature') }}</span>
        </label>
      </EditorSignaturePad>
    </EditorSheet>
  </div>
</template>
