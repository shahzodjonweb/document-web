/**
 * Black out by finding words, and which pages keep their words once blacked out.
 *
 * The file's own words on every page, as the text layer reads them (useEditorRender.textLines),
 * are searched in any case and spacing, with ‘ ’ ʻ ʼ ' ` all one apostrophe, as Uzbek is typed in
 * every one of them; or by the presets people here hide most: +998 phone numbers, 16-digit cards,
 * AA1234567 passports and 14-digit PINFL. Words laid out of sight over a scan (OCR) are the picture's
 * and are never found: a box drawn over the picture is what covers them.
 *
 * Each match is outlined on its page. "Black out all {n}" (the MainButton) or a tap on one makes it a
 * box that holds its words (`text`), which the server finds again inside the box, so the black lands
 * on the words themselves rather than on this estimate of where they are.
 *
 * Which pages keep their words is the server's to say, once the boxes are saved: a check
 * (…/blackout-check) does what a send will. Review asks "I understand" only for the pages it does
 * not find to keep them. With its switches off every page with a box becomes a picture, as before.
 */
import type { ComputedRef } from 'vue'
import type { ClientCommand } from './useEditorCommands'
import { newCommandId } from './useEditorCommands'
import { clampCommand, type Rect } from './useEditorGeometry'
import { matchLines, patternOf, type BlackOutMatch, type BlackOutPreset } from './useEditorTextLayer'

export interface BlackOutPage {
  page: number
  keeps_text: boolean
  reason: string
}
export interface BlackOutCheck {
  status: 'done' | 'queued' | 'running' | 'failed' | 'none'
  version: number
  pages: BlackOutPage[]
  error: string | null
}

/** What a page with a box comes to, as far as is known here. */
export type PageOutcome = 'keeps' | 'picture' | 'checking' | 'unknown'

/** A box's draft holds at most this many changes in all: more matches are not offered at once. */
const MOST = 100
const CHECK_EVERY = 900
const CHECK_FOR = 25_000
const SETTLE = 1200

/** How much of `inner` a box covers, 0 to 1. */
function covered(inner: Rect, box: Rect) {
  const width = Math.min(inner.x + inner.width, box.x + box.width) - Math.max(inner.x, box.x)
  const height = Math.min(inner.y + inner.height, box.y + box.height) - Math.max(inner.y, box.y)
  return width > 0 && height > 0 ? (width * height) / Math.max(1e-6, inner.width * inner.height) : 0
}

const query = ref('')
const preset = ref<BlackOutPreset | null>(null)
const found = shallowRef<BlackOutMatch[]>([])
const searching = ref(false)
/** Whether what is found is for what is asked: a search not run yet says nothing. */
const searched = ref(false)
/** The search stopped at MOST: later pages were not looked through. */
const truncated = ref(false)
/** Pages whose words could not be read just now (a range that did not come): not searched. */
const unread = ref(0)
const check = shallowRef<BlackOutCheck | null>(null)
const checking = ref(false)
let searches = 0
let checks = 0
/** The check being followed, and the draft version it is of: another ask for that version joins it. */
let inflight: { version: number; doc: string; answer: Promise<BlackOutCheck | null> } | null = null
let settle: ReturnType<typeof setTimeout> | null = null
let watching = false
/** Shared by every page's layer, so a page asks for its own matches without filtering them all again. */
let shared: {
  matches: ComputedRef<BlackOutMatch[]>
  byPage: ComputedRef<Map<number, BlackOutMatch[]>>
} | null = null

export function useEditorBlackOut() {
  const session = useEditorSession()
  const render = useEditorRender()
  const studio = useStudio()
  const v2 = useEditorV2()
  const metrics = useEditorFontMetrics()
  const ws = useWorkspace()
  const pageOrder = useEditorPageOrder()
  const { t } = useLocale()

  /** Whether the server tries to keep a page's words: both switches on, and the new frame. */
  const keepsText = computed(() => {
    const flags = studio.config.value?.limits?.editor as Record<string, boolean> | undefined
    return v2.value && flags?.pdfcraft === true && flags?.vector_blackout === true
  })
  /** Searching needs the file's words, which only pdf.js reads here: a server picture has none. */
  const canSearch = computed(() => v2.value && render.mode.value === 'pdfjs')

  const boxes = computed(() => session.commands.value.filter((command) => command.type === 'redact'))
  /** What is found and not covered yet, on pages that stay in the file: what Black out all would cover. */
  const uncovered = () =>
    found.value.filter(
      (match) =>
        !pageOrder.isRemoved(match.page) &&
        !boxes.value.some((box) => box.page === match.page && covered(match, box as Rect) >= 0.6),
    )
  const group = (list: BlackOutMatch[]) => {
    const pages = new Map<number, BlackOutMatch[]>()
    for (const match of list) pages.set(match.page, [...(pages.get(match.page) ?? []), match])
    return pages
  }

  if (!watching && import.meta.client) {
    watching = true
    effectScope(true).run(() => {
      const matches = computed(uncovered)
      shared = { matches, byPage: computed(() => group(matches.value)) }
      // A file opened again is searched and checked again.
      watch(render.generation, () => {
        query.value = ''
        preset.value = null
        found.value = []
        searched.value = false
        truncated.value = false
        unread.value = 0
        check.value = null
        checking.value = false
        inflight = null
        searches += 1
        checks += 1
      })
      watch([query, preset], () => void search())
    })
  }
  const matches = shared?.matches ?? computed(uncovered)
  const byPage = shared?.byPage ?? computed(() => group(matches.value))
  const matchesOn = (page: number) => byPage.value.get(page) ?? []

  const measure = (text: string) => (metrics.ready.value ? metrics.stringWidth(text, 10) : text.length)

  /** Every page that stays in the file looked through for what is asked, the first matches up to MOST. */
  async function search() {
    const run = ++searches
    const pattern = patternOf(query.value, preset.value)
    // What the last search found is not this one's: nothing is offered until this one has looked.
    found.value = []
    truncated.value = false
    unread.value = 0
    if (!pattern || !canSearch.value) {
      searched.value = !!pattern
      searching.value = false
      return
    }
    searching.value = true
    searched.value = false
    // The draft's pages, as far as the file pdf.js opened has them.
    const count = Math.min(session.doc.value?.pages.length ?? Infinity, render.pageCount.value || Infinity)
    const all: BlackOutMatch[] = []
    let missed = 0
    for (let page = 1; page <= count; page++) {
      if (pageOrder.isRemoved(page)) continue
      if (all.length >= MOST) {
        truncated.value = true
        break
      }
      const lines = await render.textLines(page)
      if (run !== searches) return
      if (lines) all.push(...matchLines(lines, pattern, measure))
      else missed += 1
    }
    if (all.length > MOST) truncated.value = true
    found.value = all.slice(0, MOST)
    unread.value = missed
    searching.value = false
    searched.value = true
  }

  function setPreset(value: BlackOutPreset | null) {
    preset.value = preset.value === value ? null : value
    if (preset.value) query.value = ''
  }
  function setQuery(value: string) {
    query.value = value
    if (value) preset.value = null
  }

  /** Boxes over these matches, holding their words, as one step Undo takes back. How many went on. */
  function blackOut(list: BlackOutMatch[]) {
    const current = session.doc.value
    if (!current || session.held.value || !list.length) return 0
    const room = Math.max(0, (current.limits?.commands ?? MOST) - session.commands.value.length)
    if (!room) {
      session.error.value = t('editorBudgetFull')
      return 0
    }
    const made: ClientCommand[] = list.slice(0, room).map((match) =>
      clampCommand(
        {
          _id: newCommandId(),
          type: 'redact',
          page: match.page,
          x: match.x,
          y: match.y,
          width: match.width,
          height: match.height,
          text: match.text,
        },
        session.pageSize(match.page),
      ),
    )
    const placed = session.mutate(`blackout:${made.map((command) => command._id).join()}`, () => {
      session.commands.value = [...session.commands.value, ...made]
      session.selection.value = []
    })
    if (!placed) return 0
    if (made.length < list.length) session.error.value = t('editorBudgetFull')
    return made.length
  }
  const blackOutAll = () => blackOut(matches.value)

  /** The match under a point on a page, `slop` points around it counting, if any: a tap there covers it alone. */
  function matchAt(page: number, at: { x: number; y: number }, slop = 0) {
    return matchesOn(page).find(
      (match) =>
        at.x >= match.x - slop &&
        at.x <= match.x + match.width + slop &&
        at.y >= match.y - slop &&
        at.y <= match.y + match.height + slop,
    )
  }

  /** The pages with a box, numbered as uploaded: a box on a page being deleted draws nothing. */
  const boxedPages = computed(() => {
    const deleted = new Set(
      session.commands.value
        .filter((command) => command.type === 'delete_page')
        .map((command) => command.page),
    )
    return [...new Set(boxes.value.map((box) => box.page ?? 1))]
      .filter((page) => !deleted.has(page))
      .sort((a, b) => a - b)
  })

  /** What a page with a box comes to: the check's answer for the saved draft, while it is the one shown. */
  function outcomeOf(page: number): PageOutcome {
    if (!keepsText.value) return 'picture'
    const answer = check.value
    const saved = ['saved', 'clean'].includes(session.saveState.value)
    if (!answer || !saved || answer.version !== session.doc.value?.version)
      return checking.value ? 'checking' : 'unknown'
    const row = answer.pages.find((item) => item.page === page)
    if (!row) return answer.status === 'queued' || answer.status === 'running' ? 'checking' : 'unknown'
    return row.keeps_text ? 'keeps' : 'picture'
  }
  const reasonOf = (page: number) => check.value?.pages.find((item) => item.page === page)?.reason ?? ''

  /** One check of a version: asked for and followed until it says, for at most `patience`. */
  async function follow(id: string, version: number, run: number, patience: number) {
    const started = Date.now()
    try {
      let answer = await ws.api<BlackOutCheck>(`/editor/documents/${id}/blackout-check`, { method: 'POST' })
      while (
        run === checks &&
        (answer.status === 'queued' || answer.status === 'running') &&
        Date.now() - started < patience
      ) {
        await new Promise((resolve) => setTimeout(resolve, CHECK_EVERY))
        if (run !== checks) return null
        answer = await ws.api<BlackOutCheck>(`/editor/documents/${id}/blackout-check`)
      }
      if (run !== checks) return null
      check.value = answer
      return answer
    } catch {
      // The quote asks about every page with a box not known to keep its words: nothing is lost.
      return null
    } finally {
      if (run === checks) {
        checking.value = false
        inflight = null
      }
    }
  }

  /**
   * The check of the draft as saved. One already being followed for this version is joined, not
   * replaced: Review asking while the sheet's own check runs waits for that one's answer. Nothing is
   * asked with the switches off or no box, or while a save is outstanding.
   */
  async function ensureChecked(patience = CHECK_FOR): Promise<BlackOutCheck | null> {
    if (!keepsText.value || !boxes.value.length) {
      checks += 1
      inflight = null
      check.value = null
      checking.value = false
      return null
    }
    await session.flush()
    const current = session.doc.value
    if (!current || !['saved', 'clean'].includes(session.saveState.value)) return null
    if (inflight && inflight.version === current.version && inflight.doc === current.id)
      return inflight.answer
    const run = ++checks
    checking.value = true
    const answer = follow(current.id, current.version, run, patience)
    inflight = { version: current.version, doc: current.id, answer }
    return answer
  }

  /** While the sheet is open: checked again once the boxes have been saved and left alone a moment. */
  function checkSoon() {
    if (settle) clearTimeout(settle)
    settle = setTimeout(() => {
      settle = null
      void ensureChecked()
    }, SETTLE)
  }
  function stopChecking() {
    if (settle) clearTimeout(settle)
    settle = null
  }

  return {
    query: computed(() => query.value),
    preset: computed(() => preset.value),
    setQuery,
    setPreset,
    searching: computed(() => searching.value),
    /** Everything the search found on pages that stay, covered or not. */
    foundCount: computed(() => found.value.filter((match) => !pageOrder.isRemoved(match.page)).length),
    searched: computed(() => searched.value),
    truncated: computed(() => truncated.value),
    unread: computed(() => unread.value),
    most: MOST,
    matches,
    matchesOn,
    matchAt,
    blackOut,
    blackOutAll,
    boxes,
    boxedPages,
    keepsText,
    canSearch,
    check: computed(() => check.value),
    checking: computed(() => checking.value),
    outcomeOf,
    reasonOf,
    ensureChecked,
    checkSoon,
    stopChecking,
    search,
  }
}
