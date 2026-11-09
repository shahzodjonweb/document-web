<script setup lang="ts">
/**
 * The layouts that hold all of this slide's words, as the server measured them.
 *
 * The server stops measuring after half a second and then names none, so an empty
 * list may only mean it ran out of time: it is asked once more before the slide is
 * said to fit nowhere, and even then the words claim no certainty.
 */
import type { DeckFit } from '~/composables/useDeckEditor'
import { isPhotoLayout } from '~/composables/useSlideLayouts'

const props = defineProps<{
  open: boolean
  current: string
  fit: DeckFit | null
  checking: boolean
  /** Its picture is gone: only layouts without one. */
  pictureMode: boolean
  /** What stops Split on this slide (a full deck, one line alone), or '' when it can be done. */
  splitBlocked: string
}>()
const emit = defineEmits<{ close: []; pick: [layout: string]; retry: []; split: [] }>()

const { t } = useLocale()
const uid = useId()

const layouts = computed<string[]>(() =>
  (props.fit?.layouts_fitting ?? []).filter(
    (id) => !props.pictureMode || (!isPhotoLayout(id) && id !== 'cover'),
  ),
)
const nameOf = (id: string) => (id === 'quote' ? t('deckLayoutQuote') : t(`layout.${id}`))

/**
 * The one automatic second ask, until this sheet is closed. The parent says while it
 * is asking (`checking`); its answer, or the same one again, settles the list.
 */
const asked = ref(false)
watch(
  () => props.open,
  (open) => {
    if (!open) asked.value = false
  },
)
watch(
  () => props.open && !props.checking && !layouts.value.length && !asked.value,
  (again) => {
    if (!again) return
    asked.value = true
    emit('retry')
  },
  { immediate: true },
)
</script>

<template>
  <EditorSheet
    :open="open"
    size="tall"
    modal
    :title="t('deckPickLayout')"
    testid="deck-layout-sheet"
    @close="emit('close')"
  >
    <p v-if="checking" class="editor-review-status" role="status" data-testid="deck-layouts-checking">
      {{ t('deckLayoutsChecking') }}
    </p>
    <template v-else-if="!layouts.length">
      <p role="status" data-testid="deck-layouts-none">{{ t('deckNoLayoutFits') }}</p>
      <div class="editor-more-rows">
        <button type="button" class="editor-more-row" data-testid="deck-layout-retry" @click="emit('retry')">
          <AppIcon name="rotate" :size="19" /><span>{{ t('editorTryAgain') }}</span>
        </button>
        <button
          type="button"
          class="editor-more-row"
          :disabled="!!splitBlocked"
          :aria-describedby="splitBlocked ? `${uid}-split` : undefined"
          data-testid="deck-layout-split"
          @click="emit('split')"
        >
          <AppIcon name="split" :size="19" /><span>{{ t('deckSplit') }}</span>
        </button>
        <p
          v-if="splitBlocked"
          :id="`${uid}-split`"
          class="field-hint deck-edit-row-note"
          data-testid="deck-layout-split-why"
        >
          {{ splitBlocked }}
        </p>
      </div>
    </template>
    <div v-else class="deck-edit-layouts" role="group" :aria-label="t('deckLayout')">
      <button
        v-for="id in layouts"
        :key="id"
        type="button"
        :aria-current="id === current"
        :data-testid="`deck-layout-${id}`"
        @click="emit('pick', id)"
      >
        <span>{{ nameOf(id) }}</span>
        <AppIcon v-if="id === current" name="check" :size="17" />
      </button>
    </div>
  </EditorSheet>
</template>
