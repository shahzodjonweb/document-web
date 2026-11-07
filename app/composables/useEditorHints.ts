/**
 * First-use hints: one line per task, shown until that task first works, then not
 * again on this device. More → Show tips again brings them all back. No wizards.
 */
export type HintTask = 'place' | 'sign' | 'blackout'

const KEY = 'pdf-master-editor-tips'
const retired = ref<HintTask[] | null>(null)

function read(): HintTask[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
function write(list: HintTask[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list))
    else localStorage.removeItem(KEY)
  } catch {
    // Without storage the hints come back next time, which is the safe side.
  }
}

export function useEditorHints() {
  if (retired.value === null && import.meta.client) retired.value = read()

  const showing = (task: HintTask) => retired.value !== null && !retired.value.includes(task)

  /** The task worked once: its hint has done its job. */
  function retire(task: HintTask) {
    if (!showing(task)) return
    retired.value = [...(retired.value ?? []), task]
    write(retired.value)
  }

  function showAgain() {
    retired.value = []
    write([])
  }

  return { showing, retire, showAgain, anyRetired: computed(() => !!retired.value?.length) }
}
