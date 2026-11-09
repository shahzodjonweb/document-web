<script setup lang="ts">
/**
 * Everything a slide can have done to it, as buttons: the way in for a person who
 * does not tap the picture. Not modal, so closing it does not hand focus back over
 * the field that holds the keyboard up for the dock about to open.
 */
import { primeKeyboard, type DeckSection } from '~/composables/useDeckEditor'

const props = defineProps<{
  open: boolean
  section: DeckSection | null
  number: number
  canAdd: boolean
  canSplit: boolean
  editable: boolean
}>()
const emit = defineEmits<{
  close: []
  field: [f: 'heading' | 'lines' | 'notes']
  pickLayout: []
  split: []
  duplicate: []
  delete: []
}>()

const { t } = useLocale()
const deck = useDeckEditor()
const uid = useId()

const usable = computed(() => props.editable && !!props.section)
// The title slide is always drawn as the cover, stays first and stays one.
const cover = computed(() => props.number === 1)
/** A full deck takes no slide that Split or Duplicate would make: said under them, not left to guess. */
const full = computed(() =>
  usable.value && !cover.value && !props.canAdd ? t('deckSlidesFull', { max: deck.maxSlides.value }) : '',
)

/** iOS shows the keyboard only for a field focused inside the tap itself. */
function field(name: 'heading' | 'lines' | 'notes') {
  primeKeyboard()
  emit('field', name)
}
</script>

<template>
  <EditorSheet
    :open="open"
    size="tall"
    :modal="false"
    :title="t('deckSlideMenu')"
    testid="deck-slide-sheet"
    @close="emit('close')"
  >
    <div class="editor-more-rows">
      <button
        type="button"
        class="editor-more-row"
        :disabled="!usable"
        data-testid="deck-menu-headline"
        @click="field('heading')"
      >
        <AppIcon name="type" :size="19" /><span>{{ t('deckFieldHeadline') }}</span>
      </button>
      <button
        type="button"
        class="editor-more-row"
        :disabled="!usable"
        data-testid="deck-menu-lines"
        @click="field('lines')"
      >
        <AppIcon name="alignLeft" :size="19" /><span>{{ t('deckFieldLines') }}</span>
      </button>
      <button
        type="button"
        class="editor-more-row"
        :disabled="!usable"
        data-testid="deck-menu-notes"
        @click="field('notes')"
      >
        <AppIcon name="sticky" :size="19" /><span>{{ t('deckFieldNotes') }}</span>
      </button>
      <button
        type="button"
        class="editor-more-row"
        :disabled="!usable || cover"
        data-testid="deck-menu-layout"
        @click="emit('pickLayout')"
      >
        <AppIcon name="layers" :size="19" /><span>{{ t('deckPickLayout') }}</span>
      </button>
      <button
        type="button"
        class="editor-more-row"
        :disabled="!usable || cover || !canSplit || !canAdd"
        :title="full || (canSplit || cover ? undefined : t('deckSplitNeedsLines'))"
        :aria-describedby="full ? `${uid}-full` : undefined"
        data-testid="deck-menu-split"
        @click="emit('split')"
      >
        <AppIcon name="split" :size="19" /><span>{{ t('deckSplit') }}</span>
      </button>
      <button
        type="button"
        class="editor-more-row"
        :disabled="!usable || cover || !canAdd"
        :aria-describedby="full ? `${uid}-full` : undefined"
        data-testid="deck-menu-duplicate"
        @click="emit('duplicate')"
      >
        <AppIcon name="copy" :size="19" /><span>{{ t('editorDuplicate') }}</span>
      </button>
      <p v-if="full" :id="`${uid}-full`" class="field-hint deck-edit-row-note" data-testid="deck-menu-full">
        {{ full }}
      </p>
      <button
        type="button"
        class="editor-more-row"
        :disabled="!usable || cover"
        data-testid="deck-menu-delete"
        @click="emit('delete')"
      >
        <AppIcon name="trash" :size="19" /><span>{{ t('delete') }}</span>
      </button>
    </div>
  </EditorSheet>
</template>
