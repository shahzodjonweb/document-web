/**
 * Cyrillic typed into an Uzbek deck: offered in Latin letters once, never changed
 * unasked. The server writes the Latin (`/studio/latin`, the same `to_script` a send
 * uses), so the offer shows exactly what the file would say.
 *
 * Only a commit the customer made and is looking at raises it (Done, closing a
 * sheet, leaving a field). Send, hiding the app and leaving the page never do, so
 * no offer waits behind Review.
 */
import type { CommitReason, DeckContent } from './useDeckEditor.ts'

/** `language.CYRILLIC`: every Cyrillic block, not only the basic one. */
export const CYRILLIC = /[\u0400-\u052f\u1c80-\u1c8f\u2de0-\u2dff\ua640-\ua69f\u1d2b\u1d78]/
/** `views.LATIN_TEXTS` and `LATIN_CHARS`: more waits for the next check. */
const LATIN_TEXTS = 40
const LATIN_CHARS = 12000
const SHOWN = 60
const ASKED_ON: CommitReason[] = ['done', 'close', 'blur']

/** Strings the customer chose to keep as typed, for this visit and this account. */
const kept = new Set<string>()
let keptBy = ''
let asking = 0
let pending: {
  owner: string
  draft: string
  target: string
  texts: string[]
  map: Map<string, string>
  apply: (converted: Map<string, string>) => void
} | null = null

function shorten(text: string) {
  const letters = Array.from(text)
  return letters.length > SHOWN ? `${letters.slice(0, SHOWN - 1).join('')}…` : text
}

/**
 * Each converted string where it is a whole value: a headline, one line of the body, an
 * item's text, a question's stem. Never inside a longer one, so words kept as typed, or
 * never asked about, are not half changed ("Toshkent шаҳри").
 */
function convert(content: DeckContent, target: string, map: Map<string, string>) {
  const one = (text: string | undefined) => {
    const value = text ?? ''
    return map.get(value) ?? value
  }
  if (target === 'questions') {
    for (const question of content.questions) {
      question.stem = one(question.stem)
      question.answer = one(question.answer)
      question.options = (question.options ?? []).map(one)
    }
    return
  }
  const section = content.sections.find((item) => item.id === target)
  if (!section) return
  section.heading = one(section.heading)
  section.body = (section.body ?? '').split('\n').map(one).join('\n')
  section.notes = one(section.notes)
  section.items = (section.items ?? []).map((item) => ({
    label: one(item.label),
    text: one(item.text),
    value: one(item.value),
  }))
  section.columns = (section.columns ?? []).map(one)
}

export function useDeckLatin() {
  const ws = useWorkspace()
  const deck = useDeckEditor()
  const shown = useState<{ owner: string; draft: string; target: string; from: string; to: string } | null>(
    'deck-latin-offer',
    () => null,
  )
  const owner = () => String(ws.user.value?.id ?? '')
  /** Shown only on the deck and account it was made for, while that deck is in Uzbek. */
  const offer = computed(() => {
    const made = shown.value
    return made &&
      made.owner === owner() &&
      made.draft === deck.draftId.value &&
      deck.deckLocale.value === 'uz'
      ? { target: made.target, from: made.from, to: made.to }
      : null
  })

  /** Whatever was offered, or is being asked, is let go. */
  function reset() {
    asking += 1
    pending = null
    shown.value = null
  }
  // Another deck, or the editor gone: an offer goes with the deck it was about.
  if (getCurrentScope()) {
    watch(deck.draftId, reset)
    onScopeDispose(reset)
  }

  /** `target` is a section id or 'questions'; `strings` what that commit wrote. */
  async function check(
    target: string,
    strings: string[],
    apply: (converted: Map<string, string>) => void,
    reason: CommitReason,
  ) {
    if (deck.deckLocale.value !== 'uz' || !ASKED_ON.includes(reason)) return
    const asker = owner()
    const draft = deck.draftId.value
    if (keptBy !== asker) {
      kept.clear()
      keptBy = asker
    }
    const texts: string[] = []
    let letters = 0
    for (const text of new Set(strings)) {
      if (!text || !CYRILLIC.test(text) || kept.has(text)) continue
      if (texts.length >= LATIN_TEXTS || letters + text.length > LATIN_CHARS) break
      texts.push(text)
      letters += text.length
    }
    if (!texts.length) return
    const asked = ++asking
    try {
      const answer = await ws.api<{ texts: string[]; changed: boolean }>('/studio/latin', {
        method: 'POST',
        body: { texts },
      })
      if (asked !== asking || !answer?.changed) return
      // Moved on meanwhile: an offer for a deck no longer open would change the one that is.
      if (owner() !== asker || deck.draftId.value !== draft || deck.deckLocale.value !== 'uz') return
      const map = new Map<string, string>()
      texts.forEach((text, index) => {
        const latin = answer.texts?.[index]
        if (typeof latin === 'string' && latin !== text) map.set(text, latin)
      })
      const [first] = map
      if (!first) return
      pending = { owner: asker, draft, target, texts, map, apply }
      shown.value = { owner: asker, draft, target, from: shorten(first[0]), to: shorten(first[1]) }
    } catch {
      // An offer is a kindness: without an answer there is simply none.
    }
  }

  /**
   * One step of history, so Undo puts the Cyrillic back. `apply` hears the map after,
   * for a form still open on those words; a caller that saves through `setSection`
   * instead finds the deck already changed, and adds no step.
   */
  function accept() {
    const chosen = pending
    pending = null
    shown.value = null
    if (!chosen || chosen.owner !== owner() || chosen.draft !== deck.draftId.value) return
    deck.mutate('latin', (content) => convert(content, chosen.target, chosen.map))
    chosen.apply(chosen.map)
  }

  function keep() {
    if (pending && pending.owner === owner() && keptBy === owner())
      for (const text of pending.texts) kept.add(text)
    pending = null
    shown.value = null
  }

  return { offer, check, accept, keep, reset }
}
