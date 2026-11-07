<script setup lang="ts">
/**
 * What rises from the bottom of the frame, on the app's own `.more-sheet`.
 *
 * Compact stays in the frame's flow, so the stage shrinks and all of the page can
 * still be scrolled to and tapped. Tall and full cover it; `modal` traps focus for
 * the ones that need an answer. Docked sits on the keyboard. At 980 px and over the
 * same sheet is the right-hand panel, and `permanent` keeps it there: then there is
 * nothing to close, go back from or hold the page still for. `locked` is a sheet that
 * cannot be closed for now, as Review while a send is being asked for.
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    size?: 'compact' | 'tall' | 'full' | 'docked'
    modal?: boolean
    permanent?: boolean
    locked?: boolean
    testid?: string
  }>(),
  { title: '', size: 'compact', modal: false, permanent: false, locked: false, testid: undefined },
)
const emit = defineEmits<{ close: [] }>()

const { t } = useLocale()
const telegram = useTelegramApp()
const element = ref<HTMLDialogElement>()

const dismissible = computed(() => props.open && !props.permanent)
// Locked, Back still has its layer and does nothing: without one Telegram would show Close.
telegram.useBackLayer(dismissible, () => close())
function close() {
  if (!props.locked) emit('close')
}

let releaseSwipes: (() => void) | null = null
watch(
  dismissible,
  (on) => {
    releaseSwipes?.()
    releaseSwipes = on ? telegram.holdSwipes({ lasting: true }) : null
  },
  { immediate: true },
)
onBeforeUnmount(() => releaseSwipes?.())

// With a modal sheet up, the button underneath it would be a second way out.
const layer = `sheet-${useId()}`
telegram.usePrimaryAction(layer, () => (props.open && props.modal ? 'hidden' : null))

/**
 * `show()` would move focus into a sheet that is meant to leave it on the page, so
 * a non-modal one only gets the attribute. Closing is the same for both.
 */
function sync() {
  const dialog = element.value
  if (!dialog) return
  if (!props.open) {
    if (dialog.open) dialog.close()
    return
  }
  if (dialog.open) return
  if (props.modal) dialog.showModal()
  else dialog.setAttribute('open', '')
}
watch(() => props.open, sync, { flush: 'post' })
onMounted(sync)

/**
 * Escape pressed again and again stops being refusable, and the browser closes the
 * dialog itself; `closedby` stops that for a locked sheet where it is known. Still
 * open here, it is asked to close; one that stays open, as a locked sheet does, goes
 * back up rather than staying open out of sight. The event comes a moment late, so
 * one from closing it here can land after it opened again: that one is not heard.
 */
function onClose() {
  if (!props.open || element.value?.open) return
  close()
  void nextTick(sync)
}

function onClick(event: MouseEvent) {
  if (props.modal && event.target === element.value) close()
}
</script>

<template>
  <dialog
    ref="element"
    class="more-sheet editor-sheet"
    :class="{ permanent }"
    :data-size="size"
    :data-modal="modal || undefined"
    :aria-label="title || undefined"
    :data-testid="testid"
    :closedby="locked ? 'none' : undefined"
    @cancel.prevent="close"
    @close="onClose"
    @click="onClick"
  >
    <!-- Nothing inside stays mounted behind a closed sheet, where it would keep answering and announcing. -->
    <div v-if="open" class="sheet-body">
      <div v-if="title" class="sheet-head">
        <strong>{{ title }}</strong
        ><button
          v-if="!permanent && !locked"
          type="button"
          class="icon-button"
          :aria-label="t('closeMenu')"
          data-testid="editor-sheet-close"
          @click="emit('close')"
        >
          <AppIcon name="x" :size="18" />
        </button>
      </div>
      <slot />
    </div>
  </dialog>
</template>
