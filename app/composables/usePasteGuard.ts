/**
 * Nothing put in a field is cut short by its `maxlength` without a word: a paste, a drop,
 * or what the phone's keyboard puts in by itself (its clipboard strip, voice typing).
 * What fits goes in at the caret, in place of what is selected, and the form says that
 * the end was left out until the next change typed. Pasted lines become one line, joined
 * by spaces, in a field of one line. What fits as it is stays the browser's own.
 *
 * A word the keyboard is still composing cannot be held back: the browser cuts it as it
 * is committed, and the note says so then.
 *
 * The form binds the four handlers on its root and names, on each field, where the note
 * about it shows (`data-note`). The note is shown by the form: in the dock's head, or
 * under the field it is about. Under a field in a sheet it is scrolled into sight above
 * the keyboard.
 */
import type { Ref } from 'vue'

type Field = HTMLInputElement | HTMLTextAreaElement

/** Inserts placed at the selection: taken over as a paste is when they do not fit. */
const TAKEN = new Set([
  'insertText',
  'insertFromPaste',
  'insertFromPasteAsQuotation',
  'insertFromDrop',
  'insertFromYank',
])

/** The first `n` UTF-16 units, as `maxlength` counts them, never half an emoji. */
export function cutTo(text: string, n: number) {
  if (text.length <= n) return text
  const kept = text.slice(0, Math.max(0, n))
  const last = kept.charCodeAt(kept.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? kept.slice(0, -1) : kept
}

/** Pasted text as the server takes it: no control characters but a tab, and a newline where one may be. */
export function pastedText(raw: string, multiline: boolean) {
  let text = raw.replace(/\r\n?/g, '\n')
  if (!multiline && text.includes('\n'))
    text = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ')
  let out = ''
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0
    if (character === '\t') out += multiline ? '\t' : ' '
    else if (code >= 32 || (multiline && character === '\n')) out += character
  }
  return out
}

/** The field an event is about, when it has a limit to guard. */
function limited(target: EventTarget | null): Field | null {
  return (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
    target.maxLength >= 0
    ? target
    : null
}

/**
 * Puts in what fits of `raw` at the field's selection, as if typed: the field's own input
 * handler reads it. Left to the browser when all of it fits as it is. Says how many
 * characters the field holds when the end was left out, otherwise null.
 */
function takeOver(event: Event, field: Field, raw: string): number | null {
  const max = field.maxLength
  if (!raw) return null
  const text = pastedText(raw, field instanceof HTMLTextAreaElement)
  const before = field.value
  const start = field.selectionStart ?? before.length
  const end = field.selectionEnd ?? start
  const room = Math.max(0, max - (before.length - (end - start)))
  // Browsers count a line break differently against `maxlength`: text with one is always taken over.
  if (text === raw && !/[\r\n]/.test(raw) && text.length <= room) return null
  event.preventDefault()
  const kept = cutTo(text, room)
  if (kept || start !== end) {
    const expected = before.slice(0, start) + kept + before.slice(end)
    // As typing does, so Undo and the change event on leaving the field still work. It types
    // where the focus is: a drop has already moved it to this field, a paste is made in it.
    let typed = false
    if (document.activeElement === field)
      try {
        let heard = false
        const hear = () => (heard = true)
        field.addEventListener('input', hear, { once: true })
        typed = document.execCommand('insertText', false, kept)
        field.removeEventListener('input', hear)
        // Inside the keyboard's own insert or a drop, Chrome holds the input event back until that
        // is done, and the form would draw its old words over these first: the field's own handler
        // hears them now. Not the form's, which ends the note: that waits for the real event.
        if (typed && !heard) field.dispatchEvent(new Event('input'))
      } catch {}
    if (!typed || field.value !== expected) {
      field.value = before
      field.setRangeText(kept, start, end, 'end')
      field.dispatchEvent(new Event('input', { bubbles: true }))
      // A value set from here fires no change on leaving the field; the forms commit on that change.
      field.addEventListener('blur', () => field.dispatchEvent(new Event('change', { bubbles: true })), {
        once: true,
      })
    }
  }
  return kept.length < text.length ? max : null
}

/** Takes over a paste the field cannot hold as it is: see `takeOver`. */
export function guardPaste(event: ClipboardEvent): number | null {
  const field = limited(event.target)
  if (!field || event.defaultPrevented) return null
  return takeOver(event, field, event.clipboardData?.getData('text/plain') ?? '')
}

/**
 * The same for an insert announced by `beforeinput`: the keyboard's own (its clipboard strip,
 * a word chosen), a drop, a paste no paste event came before. A word being composed is
 * the browser's to the end, and a word put right replaces a range this cannot see.
 */
export function guardInsert(event: InputEvent): number | null {
  const field = limited(event.target)
  if (!field || event.defaultPrevented || event.isComposing || !TAKEN.has(event.inputType)) return null
  return takeOver(event, field, event.data ?? event.dataTransfer?.getData('text/plain') ?? '')
}

/**
 * Whether `maxlength` cut what the browser put in by itself: the field is full and holds
 * less of it than was sent, by what landed when the input event said, else by its words.
 */
function wasCut(field: Field, wanted: string | null, landed: string | null) {
  if (!wanted || field.value.length < field.maxLength - 1) return false
  return landed !== null ? landed.length < wanted.length : !field.value.includes(wanted)
}

/** A form's note on what its last insert left out, and which of its fields that was in. */
export function usePasteGuard(root: Ref<HTMLElement | undefined>) {
  const { t } = useLocale()
  const note = ref('')
  const field = ref('')
  /** A word put right, until it lands: the browser places it, and its cut is only seen then. */
  let replacing: { field: Field; wanted: string } | null = null
  /** The word being composed as it last landed. */
  let composed: { field: EventTarget; landed: string } | null = null
  /**
   * A field whose words, put in for an insert taken over, have yet to fire their input event:
   * inside the keyboard's own insert Chrome holds it back until that insert's event is done.
   * That event must not end the note it brings.
   */
  let owed: EventTarget | null = null
  let inputs = 0

  const nameOf = (target: EventTarget | null) =>
    target instanceof HTMLElement ? (target.dataset.note ?? '') : ''
  /** Runs a guard, and marks its field when what it put in is still to say so. */
  function guarded<E extends Event>(event: E, guard: (event: E) => number | null) {
    const target = limited(event.target)
    const before = target?.value
    const seen = inputs
    const max = guard(event)
    owed = max !== null && target && inputs === seen && target.value !== before ? target : null
    return max
  }

  /**
   * Under a field in a sheet, the note is scrolled into sight, never under what sticks at
   * the top, and never so far that the field it is about goes out of sight above.
   */
  function bringIntoSight() {
    const shown = root.value?.querySelector<HTMLElement>('.deck-edit-paste-note')
    const body = shown?.closest<HTMLElement>('.sheet-body')
    if (!shown || !body) return
    const room = body.getBoundingClientRect()
    const box = shown.getBoundingClientRect()
    const stuck = Math.max(
      room.top,
      ...[...body.querySelectorAll<HTMLElement>('.sheet-head, .deck-edit-sheet-done')].map(
        (node) => node.getBoundingClientRect().bottom,
      ),
    )
    const active = document.activeElement
    const fieldTop =
      active instanceof HTMLElement && body.contains(active) ? active.getBoundingClientRect().top : Infinity
    const by = Math.min(box.bottom + 4 - room.bottom, box.top - stuck, fieldTop - stuck)
    if (by > 0) body.scrollTop += by
  }
  function say(text: string, name: string) {
    note.value = text
    field.value = text ? name : ''
    if (text) void nextTick(bringIntoSight)
  }
  function sayCut(target: EventTarget | null, key: string, max = limited(target)?.maxLength ?? 0) {
    say(t(key, { max }), nameOf(target))
  }

  /** For the form's `@paste`. */
  function onPaste(event: ClipboardEvent) {
    // A field's own handler took it (a slide's lines stay lines) and said what it left out.
    if (event.defaultPrevented) return
    const max = guarded(event, guardPaste)
    // After the paste's own input event, which cleared the last note.
    if (max === null) say('', '')
    else sayCut(event.target, 'deckPasteCut', max)
  }
  /** For the form's `@beforeinput`. */
  function onBeforeInput(event: InputEvent) {
    if (event.inputType === 'insertReplacementText' && !event.isComposing) {
      const target = limited(event.target)
      const wanted = event.data ?? event.dataTransfer?.getData('text/plain') ?? ''
      replacing = target && wanted ? { field: target, wanted } : null
      return
    }
    const max = guarded(event, guardInsert)
    if (max !== null)
      sayCut(
        event.target,
        event.inputType.startsWith('insertFromPaste') ? 'deckPasteCut' : 'deckInsertCut',
        max,
      )
  }
  /** For the form's `@input`: what is typed next ends the note, and a cut the browser made itself is said. */
  function onInput(event: InputEvent) {
    inputs += 1
    const target = event.target
    const mine = owed === target
    owed = null
    if (!mine) clear()
    // What landed, when it says (the input a guard fires itself is a plain event).
    const landed = typeof event.data === 'string' ? event.data : null
    // Some browsers send the commit's own input as no longer composing: it is still the word's.
    if (event.isComposing || (composed && composed.field === target))
      composed = target && landed !== null ? { field: target, landed } : null
    const replaced = replacing
    replacing = null
    if (
      replaced?.field === target &&
      event.inputType === 'insertReplacementText' &&
      wasCut(replaced.field, replaced.wanted, landed)
    )
      sayCut(target, 'deckInsertCut')
  }
  /** For the form's `@compositionend`: the word committed, as the keyboard sent it, against what landed. */
  function onCompositionEnd(event: CompositionEvent) {
    const last = composed?.field === event.target ? composed.landed : null
    composed = null
    const target = limited(event.target)
    if (target && wasCut(target, event.data, last)) sayCut(target, 'deckInsertCut')
  }
  /** Ends the note: the next change typed, or the fields moving under it. */
  function clear() {
    note.value = ''
    field.value = ''
  }
  return { note, field, say, clear, onPaste, onBeforeInput, onInput, onCompositionEnd }
}
