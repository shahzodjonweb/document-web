/**
 * The file's own words on the paper, line by line, for a tap to change in place.
 *
 * A page's lines are read once it has been drawn, so they are there before anyone
 * taps: the tap that opens a line must focus its field in its own handler, or iOS
 * keeps the keyboard down. A change is an `edit_text` mark over the line's box,
 * holding the line's words as `original` and the new ones as `text`; the server
 * finds the line again by that box and those words.
 *
 * Nothing here is sent: a mark keeps only the contract's fields, which every save
 * rebuilds from the server's copy, so how a change looks is read again from the
 * line its box sits on.
 */
import type { ClientCommand } from './useEditorCommands'
import { hitOrder, type PageSize, type Rect } from './useEditorGeometry'
import type { TextLine } from './useEditorRender'

/** Each page's lines, for the file last opened. */
const store = shallowReactive(new Map<number, TextLine[]>())
const pending = new Set<number>()
let watching = false

/** The page's colour beside a change and its words' colour, by the change's box: read off the drawn page. */
const colours = reactive(new Map<string, { paper: string; ink: string }>())

export function linesOn(page: number): TextLine[] {
  return store.get(page) ?? []
}

/** How much of the smaller of two boxes the other covers, 0 to 1. */
function overlap(a: Rect, b: Rect) {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  if (width <= 0 || height <= 0) return 0
  return (width * height) / Math.max(1e-6, Math.min(a.width * a.height, b.width * b.height))
}

const boxOf = (command: ClientCommand): Rect => ({
  x: command.x ?? 0,
  y: command.y ?? 0,
  width: command.width ?? 0,
  height: command.height ?? 0,
})
export const boxKey = (command: ClientCommand) =>
  `${command.page}:${command.x}:${command.y}:${command.width}:${command.height}`

/** The line a box sits on: the one it covers most, at least half of the smaller. */
export function lineUnder(box: Rect, lines: TextLine[]): TextLine | null {
  let best: TextLine | null = null
  let most = 0.5
  for (const line of lines) {
    const share = overlap(box, line)
    if (share >= most) {
      most = share
      best = line
    }
  }
  return best
}

/** Whether a change already stands over a line: a tap there opens that change, not a second one. */
export function coveredBy(line: TextLine, marks: ClientCommand[]) {
  return marks.find((command) => command.type === 'edit_text' && overlap(boxOf(command), line) >= 0.5) ?? null
}

/** How a change's words look: the line's size, family and face, or a guess from its box. */
export interface TextLook {
  size: number
  family: TextLine['family']
  bold: boolean
  /** The family the browser drew the line in, as pdf.js named it. */
  face: string
}
export function lookOf(command: ClientCommand, lines: TextLine[]): TextLook {
  const line = lineUnder(boxOf(command), lines)
  if (line) return { size: line.size, family: line.family, bold: line.bold, face: line.face }
  return { size: (command.height ?? 15) / 1.25, family: 'sans', bold: false, face: '' }
}

export type FitState = 'fits' | 'longer' | 'tooLong' | 'removed'
export interface TextFit {
  state: FitState
  /** The new words' estimated width at the line's size, in points. */
  width: number
  /** From the line's start to the page's margin or the next words on its baseline. */
  room: number
  /** What the server will shrink the words to, down to 60 % and never under 6: 1 when they fit. */
  scale: number
}

/**
 * How the new words fit the line, as the server will set them. Their width is
 * estimated from the line's own width and the ratio of the new words to the old in
 * Noto, which serif and bold share well enough. The room ends 9 points before the
 * page's edge, or a point before the next words on the same baseline. Longer than
 * the room, the server sets them smaller; longer than it can shrink them, they
 * cannot go.
 */
export function editTextFit(
  command: ClientCommand,
  page: PageSize,
  lines: TextLine[],
  measure: ((text: string, size: number) => number) | null,
): TextFit {
  const text = command.text ?? ''
  const original = command.original ?? ''
  const x = command.x ?? 0
  const lineWidth = command.width ?? 0
  const before = measure ? measure(original, 10) : 0
  const width = before > 0 && measure ? (lineWidth * measure(text, 10)) / before : lineWidth
  const own = lineUnder(boxOf(command), lines)
  const size = own?.size ?? (command.height ?? 15) / 1.25
  const baseline = own?.baseline ?? (command.y ?? 0) + 0.95 * size
  let limit = page.width - 9
  for (const line of lines) {
    if (line === own || Math.abs(line.baseline - baseline) > 0.25 * size) continue
    if (line.x >= x + lineWidth - 0.5) limit = Math.min(limit, line.x - 1)
  }
  const room = Math.max(0, limit - x)
  const least = Math.min(1, Math.max(0.6, 6 / size))
  if (!text.trim()) return { state: 'removed', width: 0, room, scale: 1 }
  if (width <= room) return { state: 'fits', width, room, scale: 1 }
  const scale = room / width
  return scale >= least
    ? { state: 'longer', width, room, scale }
    : { state: 'tooLong', width, room, scale: least }
}

/** The middle value of a list of channel values. */
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 255
}
const hex = (rgb: number[]) =>
  `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`

/**
 * The page's colour in a 2-point ring just outside a box, and the words' colour
 * inside it, from the canvas pdf.js drew: the server samples the same ring for a
 * line it has to cover. Null while the canvas is blank, as between zoom steps.
 */
export function samplePaper(canvas: HTMLCanvasElement, pageWidth: number, box: Rect) {
  if (!canvas.width || !canvas.height) return null
  const scale = canvas.width / pageWidth
  const ring = 2 * scale
  const left = Math.max(0, Math.floor(box.x * scale - ring))
  const top = Math.max(0, Math.floor(box.y * scale - ring))
  const right = Math.min(canvas.width, Math.ceil((box.x + box.width) * scale + ring))
  const bottom = Math.min(canvas.height, Math.ceil((box.y + box.height) * scale + ring))
  if (right - left < 2 || bottom - top < 2) return null
  let data: Uint8ClampedArray
  try {
    const context = canvas.getContext('2d')
    if (!context) return null
    data = context.getImageData(left, top, right - left, bottom - top).data
  } catch {
    return null
  }
  const inner = {
    left: box.x * scale - left,
    top: box.y * scale - top,
    right: (box.x + box.width) * scale - left,
    bottom: (box.y + box.height) * scale - top,
  }
  const width = right - left
  const outside: number[][] = [[], [], []]
  const inside: number[][] = []
  for (let index = 0; index < data.length; index += 4) {
    // A canvas being drawn again is transparent until it is done.
    if (data[index + 3]! < 250) continue
    const px = (index / 4) % width
    const py = Math.floor(index / 4 / width)
    const rgb = [data[index]!, data[index + 1]!, data[index + 2]!]
    if (px >= inner.left && px < inner.right && py >= inner.top && py < inner.bottom) inside.push(rgb)
    else rgb.forEach((value, channel) => outside[channel]!.push(value))
  }
  if (outside[0]!.length < 8) return null
  const paper = outside.map(median)
  // The words are what stands out from the paper inside the box; most of the box is paper.
  const distance = (rgb: number[]) =>
    Math.max(...rgb.map((value, channel) => Math.abs(value - paper[channel]!)))
  const marked = inside.filter((rgb) => distance(rgb) > 100)
  const strongest = marked
    .sort((a, b) => distance(b) - distance(a))
    .slice(0, Math.max(1, Math.ceil(marked.length / 3)))
  const ink = strongest.length
    ? [0, 1, 2].map((channel) => median(strongest.map((rgb) => rgb[channel]!)))
    : null
  return { paper: hex(paper), ink: ink ? hex(ink) : '#17212e' }
}


/* ------------------------------------------------------------ finding words */

/** The presets Black out offers: what people here hide most. */
export type BlackOutPreset = 'phone' | 'card' | 'passport' | 'pinfl'
export const BLACK_OUT_PRESETS: BlackOutPreset[] = ['phone', 'card', 'passport', 'pinfl']

/** Words found on a page: where they stand, and the words as the page has them. */
export interface BlackOutMatch extends Rect {
  key: string
  page: number
  text: string
}

const APOSTROPHES = new Set(['‘', '’', 'ʻ', 'ʼ', '`', "'"])
// On the folded words: lower case, one space for any run of spaces, one apostrophe. The first group is
// what may stand before a match, the second the match: Safari before 16.4, in older Telegrams, has no lookbehind.
const PRESETS: Record<BlackOutPreset, RegExp> = {
  phone: /(^|[^\d+])((?:\+ ?)?998[ ().-]*\d{2}[ ().-]*\d{3}[ .-]*\d{2}[ .-]*\d{2})(?!\d)/gu,
  card: /(^|\D)(\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4})(?!\d)/gu,
  passport: /(^|[^\p{L}\d])([a-z]{2} ?\d{7})(?![\p{L}\d])/gu,
  pinfl: /(^|\D)(\d{14})(?!\d)/gu,
}
/** Points a box reaches past its words each side: an estimate, which the server finds the words inside. */
const SIDE = 0.12

/** Words as compared, with where each of their letters came from in the line. */
export function fold(text: string) {
  let folded = ''
  const at: number[] = []
  let space = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!
    if (/\s/u.test(char)) {
      if (!space && folded) {
        folded += ' '
        at.push(index)
      }
      space = true
      continue
    }
    space = false
    const lower = APOSTROPHES.has(char) ? "'" : char.toLocaleLowerCase()
    for (const part of lower) {
      folded += part
      at.push(index)
    }
  }
  if (folded.endsWith(' ')) {
    folded = folded.slice(0, -1)
    at.pop()
  }
  return { folded, at }
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** What a search looks for: a preset's pattern, or the words typed, in any spacing. The match is its second group. */
export function patternOf(query: string, preset: BlackOutPreset | null): RegExp | null {
  if (preset) return new RegExp(PRESETS[preset].source, PRESETS[preset].flags)
  const letters = [...fold(query).folded.replace(/ /g, '')]
  if (letters.length < 2) return null
  return new RegExp(`()(${letters.map(escape).join(' ?')})`, 'gu')
}

/** Where a stretch of a line's letters stands on the page, from where its runs were drawn. */
export function wordsBox(
  line: TextLine,
  start: number,
  end: number,
  measure: (text: string) => number = (text) => text.length,
): Rect {
  const pieces = line.pieces?.length ? line.pieces : [{ start: 0, end: line.text.length, x: line.x, width: line.width }]
  let left = Infinity
  let right = -Infinity
  for (const piece of pieces) {
    const from = Math.max(start, piece.start)
    const to = Math.min(end, piece.end)
    if (to <= from) continue
    const words = line.text.slice(piece.start, piece.end)
    const whole = measure(words) || words.length || 1
    const share = (stop: number) => measure(line.text.slice(piece.start, stop)) / whole
    left = Math.min(left, piece.x + piece.width * share(from))
    right = Math.max(right, piece.x + piece.width * share(to))
  }
  if (!Number.isFinite(left)) {
    left = line.x
    right = line.x + line.width
  }
  const side = SIDE * line.size
  return { x: left - side, y: line.y, width: right - left + 2 * side, height: line.height }
}

/** Every match of `pattern` in a page's lines, in reading order. */
export function matchLines(
  lines: TextLine[],
  pattern: RegExp,
  measure?: (text: string) => number,
): BlackOutMatch[] {
  const found: BlackOutMatch[] = []
  for (const line of lines) {
    const { folded, at } = fold(line.text)
    pattern.lastIndex = 0
    for (const hit of folded.matchAll(pattern)) {
      const words = hit[2] ?? ''
      if (!words.trim()) continue
      const start = hit.index! + (hit[1] ?? '').length
      const first = at[start]!
      const last = at[start + words.length - 1]!
      const box = wordsBox(line, first, last + 1, measure)
      found.push({ key: `${line.id}:${first}`, page: line.page, text: line.text.slice(first, last + 1), ...box })
    }
  }
  return found
}

export function useEditorTextLayer() {
  const studio = useStudio()
  const v2 = useEditorV2()
  const render = useEditorRender()
  const tools = useEditorTools()
  const session = useEditorSession()
  const metrics = useEditorFontMetrics()

  // A file opened again is read again: its lines, and pdf.js's names for its faces, are new.
  if (!watching && import.meta.client) {
    watching = true
    effectScope(true).run(() =>
      watch(render.generation, () => {
        store.clear()
        pending.clear()
        colours.clear()
      }),
    )
  }

  const switched = computed(() => v2.value && studio.config.value?.limits?.editor?.text_edit === true)
  /** The new frame, the switch, the tool in the catalog, and pages pdf.js draws: scans and server pictures have no lines. */
  const enabled = computed(() => switched.value && render.mode.value === 'pdfjs' && tools.allows('edit_text'))

  /** Reads a drawn page's lines, once. */
  async function ensure(page: number) {
    if (!switched.value || render.mode.value !== 'pdfjs' || store.has(page) || pending.has(page)) return
    const generation = render.generation.value
    pending.add(page)
    const lines = await render.textLines(page)
    if (generation !== render.generation.value) return
    pending.delete(page)
    if (lines) store.set(page, lines)
  }

  /** The line under a point, at least a fingertip tall however small its words are. */
  function lineAt(
    page: number,
    at: { x: number; y: number },
    slop = 0,
    skip: (line: TextLine) => boolean = () => false,
  ) {
    const candidates = linesOn(page)
      .filter((line) => !skip(line))
      .map((line) => ({ id: line.id, kind: 'line' as const, rect: line }))
    const hit = hitOrder(candidates, at, session.pageSize(page), slop)[0]
    return hit ? (linesOn(page).find((line) => line.id === hit.id) ?? null) : null
  }

  function fitOf(command: ClientCommand): TextFit | null {
    if (command.type !== 'edit_text') return null
    const page = command.page ?? 1
    return editTextFit(
      command,
      session.pageSize(page),
      linesOn(page),
      metrics.ready.value ? metrics.stringWidth : null,
    )
  }

  /**
   * The preview's look: the document's own face first, which pdf.js has given the
   * browser, so the letters its subset has show in it; then the Noto face the
   * server would set new letters in.
   */
  function fontOf(command: ClientCommand) {
    const look = lookOf(command, linesOn(command.page ?? 1))
    const serif = look.family === 'serif'
    const noto = metrics.previewFamily(serif, look.bold)
    const generic = serif ? 'serif' : look.family === 'mono' ? 'monospace' : 'sans-serif'
    return {
      size: look.size,
      fontFamily: [look.face ? `"${look.face}"` : '', noto, generic].filter(Boolean).join(', '),
      fontWeight: look.bold ? 700 : 400,
    }
  }

  /** Reads the colours for a change once its page has been drawn; kept by its box. */
  function sample(canvas: HTMLCanvasElement | null | undefined, pageWidth: number, command: ClientCommand) {
    const key = boxKey(command)
    if (!canvas || colours.has(key) || render.mode.value !== 'pdfjs') return
    const found = samplePaper(canvas, pageWidth, boxOf(command))
    if (found) colours.set(key, found)
  }
  const colourOf = (command: ClientCommand) => colours.get(boxKey(command)) ?? null

  return { enabled, switched, ensure, linesOn, lineAt, fitOf, fontOf, sample, colourOf }
}
