/** One short message over the page, with at most one thing to do about it. The newest replaces the last. */
export interface EditorSnack {
  message: string
  actionLabel?: string
  onAction?: () => void
  /** The history step its Undo takes back: once another step follows, it would take that one, so it goes. */
  step?: number
}

export const SNACK_TIME = 6000
let timer: ReturnType<typeof setTimeout> | null = null

export function useEditorSnackbar() {
  const snack = useState<EditorSnack | null>('editor-snack', () => null)

  function dismiss() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    snack.value = null
  }
  function show(next: EditorSnack) {
    dismiss()
    snack.value = next
    timer = setTimeout(dismiss, SNACK_TIME)
  }
  function act() {
    const action = snack.value?.onAction
    dismiss()
    action?.()
  }
  return { snack, show, dismiss, act }
}
