<script setup lang="ts">
/**
 * Choose which attached image a signature/image command points at.
 *
 * Attached images are ordinary file assets, so each one also costs a page unit
 * at export — that is said plainly rather than discovered on the quote.
 */
const props = defineProps<{ commandId: string; inputIndex?: number; signature?: boolean }>()

const { t } = useLocale()
const session = useEditorSession()

const input = ref<HTMLInputElement>()
const padOpen = ref(false)
const previews = ref<Record<string, string>>({})

const assets = computed(() => session.assets.value)
const missing = computed(() => !props.inputIndex || props.inputIndex > assets.value.length)

/** Thumbnails come from the uploaded bytes: image assets have no preview_url. */
async function previewFor(asset: { id: string }) {
  if (previews.value[asset.id]) return
  try {
    const bytes = await useWorkspace().api<Blob>(`/files/${asset.id}/download`, { responseType: 'blob' })
    previews.value = { ...previews.value, [asset.id]: URL.createObjectURL(bytes) }
  } catch {
    // The chooser still works by name if the preview cannot be fetched.
  }
}

watch(assets, (list) => list.forEach((asset) => void previewFor(asset)), { immediate: true })
onBeforeUnmount(() => Object.values(previews.value).forEach((url) => URL.revokeObjectURL(url)))

function choose(index: number) {
  session.patchCommand(props.commandId, { input_index: index }, 'image')
}

async function upload(list: FileList | null) {
  const file = list?.[0]
  if (!file) return
  const index = await session.uploadAsset(file)
  if (index !== null) choose(index)
  if (input.value) input.value.value = ''
}

function onSigned(index: number) {
  padOpen.value = false
  choose(index)
}
</script>

<template>
  <div class="editor-assetfield">
    <span class="editor-assetfield-label">{{ t('image') }}</span>
    <p v-if="missing" class="editor-invalid">{{ t('editorIssueNoImage') }}</p>

    <div v-if="assets.length" class="editor-assetgrid" role="group" :aria-label="t('chooseImage')">
      <button
        v-for="(asset, index) in assets"
        :key="asset.id"
        type="button"
        class="editor-assetchip"
        :class="{ active: inputIndex === index + 1 }"
        :aria-pressed="inputIndex === index + 1"
        @click="choose(index + 1)"
      >
        <img v-if="previews[asset.id]" :src="previews[asset.id]" alt="" />
        <AppIcon v-else name="image" :size="18" />
        <small>{{ asset.name }}</small>
      </button>
    </div>

    <div class="editor-assetfield-actions">
      <button
        type="button"
        class="button secondary small"
        :disabled="session.isBusy('asset')"
        data-testid="editor-asset-upload"
        @click="input?.click()"
      >
        <AppIcon name="upload" :size="15" />{{ t('chooseImage') }}
      </button>
      <button
        v-if="signature"
        type="button"
        class="button secondary small"
        data-testid="editor-signature-open"
        @click="padOpen = !padOpen"
      >
        <AppIcon name="signature" :size="15" />{{ t('editorSignatureDraw') }}
      </button>
    </div>

    <input
      ref="input"
      type="file"
      accept=".png,.jpg,.jpeg,.webp"
      class="visually-hidden"
      :aria-label="t('chooseImage')"
      @change="upload(($event.target as HTMLInputElement).files)"
    />

    <EditorSignaturePad v-if="padOpen" @saved="onSigned" @close="padOpen = false" />

    <p class="field-hint">{{ t('editorImageTypes') }}</p>
  </div>
</template>
