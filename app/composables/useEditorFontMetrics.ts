/**
 * Exact text metrics for the single font the export engine uses.
 *
 * The server raises `editor_text_overflow` using reportlab's `stringWidth`,
 * which is `0.001 * size * sum(charWidths.get(ord(ch), defaultWidth))`. To
 * predict that before export we read the very same NotoSans-Regular.ttf and
 * rebuild `charWidths` the way reportlab does: last-match-wins cmap subtable
 * selection, hmtx advance widths, and the last advance reused for every glyph
 * past `numberOfHMetrics`.
 *
 * Canvas `measureText` is deliberately not used — it applies kerning and
 * ligatures that reportlab does not, so it would disagree with the export.
 */

const FONT_URL = '/fonts/noto-sans-regular.ttf'
export const FONT_FAMILY = 'PDFMasterNoto'
/** `_overlay` advances each line by exactly `1.3 * font_size`. */
export const LINE_FACTOR = 1.3

export interface FontMetrics {
  widths: Map<number, number>
  defaultWidth: number
}
type Metrics = FontMetrics

let metrics: Metrics | null = null
let loading: Promise<Metrics | null> | null = null
let approximate = false

function tableDirectory(view: DataView) {
  const tables = new Map<string, number>()
  const count = view.getUint16(4)
  for (let i = 0; i < count; i += 1) {
    const entry = 12 + 16 * i
    let tag = ''
    for (let byte = 0; byte < 4; byte += 1) tag += String.fromCharCode(view.getUint8(entry + byte))
    tables.set(tag, view.getUint32(entry + 8))
  }
  return tables
}

/**
 * reportlab walks every subtable and keeps the last acceptable one, so a font
 * carrying both (3,1)/format 4 and (3,10)/format 12 resolves to format 12.
 */
function selectCmap(view: DataView, cmap: number) {
  const count = view.getUint16(cmap + 2)
  let offset: number | null = null
  let encoded = 0
  for (let i = 0; i < count; i += 1) {
    const record = cmap + 4 + 8 * i
    const platform = view.getUint16(record)
    const encoding = view.getUint16(record + 2)
    const subtable = view.getUint32(record + 4)
    if (platform === 3) {
      encoded = 1
      offset = subtable
    } else if (platform === 1 && encoding === 0 && encoded !== 1) {
      encoded = 2
      offset = subtable
    } else if (platform === 1 && encoding === 1) {
      encoded = 1
      offset = subtable
    } else if (platform === 0 && encoding !== 5) {
      encoded = 1
      offset = subtable
    }
  }
  return offset === null ? null : cmap + offset
}

function readCharToGlyph(view: DataView, start: number) {
  const charToGlyph = new Map<number, number>()
  const format = view.getUint16(start)
  if (format === 12) {
    const groups = view.getUint32(start + 12)
    for (let i = 0; i < groups; i += 1) {
      const group = start + 16 + 12 * i
      const first = view.getUint32(group)
      const last = view.getUint32(group + 4)
      const glyph = view.getUint32(group + 8)
      // Guard against a corrupt group claiming the whole code space.
      const end = Math.min(last, first + 0x10ffff)
      for (let code = first; code <= end; code += 1) charToGlyph.set(code, glyph + (code - first))
    }
    return charToGlyph
  }
  if (format === 4) {
    const segments = view.getUint16(start + 6) / 2
    const endBase = start + 14
    const startBase = endBase + segments * 2 + 2
    const deltaBase = startBase + segments * 2
    const rangeBase = deltaBase + segments * 2
    for (let segment = 0; segment < segments; segment += 1) {
      const end = view.getUint16(endBase + segment * 2)
      const first = view.getUint16(startBase + segment * 2)
      const delta = view.getInt16(deltaBase + segment * 2)
      const rangeOffset = view.getUint16(rangeBase + segment * 2)
      if (first > end || end === 0xffff) continue
      for (let code = first; code <= end; code += 1) {
        let glyph: number
        if (rangeOffset === 0) glyph = (code + delta) & 0xffff
        else {
          const at = rangeBase + segment * 2 + rangeOffset + (code - first) * 2
          if (at + 1 >= view.byteLength) continue
          const raw = view.getUint16(at)
          if (raw === 0) continue
          glyph = (raw + delta) & 0xffff
        }
        if (glyph) charToGlyph.set(code, glyph)
      }
    }
    return charToGlyph
  }
  if (format === 6) {
    const first = view.getUint16(start + 6)
    const count = view.getUint16(start + 8)
    for (let i = 0; i < count; i += 1) charToGlyph.set(first + i, view.getUint16(start + 10 + i * 2))
    return charToGlyph
  }
  if (format === 0) {
    for (let code = 0; code < 256; code += 1) charToGlyph.set(code, view.getUint8(start + 6 + code))
    return charToGlyph
  }
  return null
}

/** Pure: TTF bytes in, reportlab-equivalent `charWidths` out. */
export function parseFontMetrics(buffer: ArrayBuffer): FontMetrics | null {
  const view = new DataView(buffer)
  const tables = tableDirectory(view)
  const head = tables.get('head')
  const hhea = tables.get('hhea')
  const maxp = tables.get('maxp')
  const hmtx = tables.get('hmtx')
  const cmap = tables.get('cmap')
  if (head === undefined || hhea === undefined || maxp === undefined || hmtx === undefined || cmap === undefined) return null

  const unitsPerEm = view.getUint16(head + 18)
  const numberOfHMetrics = view.getUint16(hhea + 34)
  const numGlyphs = view.getUint16(maxp + 4)
  if (!unitsPerEm || !numGlyphs) return null

  const subtable = selectCmap(view, cmap)
  if (subtable === null) return null
  const charToGlyph = readCharToGlyph(view, subtable)
  if (!charToGlyph) return null

  // reportlab keeps integer widths when unitsPerEm is already 1000.
  const scale = unitsPerEm === 1000 ? (value: number) => value : (value: number) => (value * 1000) / unitsPerEm
  const advances = new Array<number>(numGlyphs)
  let advance = 0
  for (let glyph = 0; glyph < numGlyphs; glyph += 1) {
    // Past numberOfHMetrics the table stores side bearings only and the last
    // advance width applies to every remaining glyph.
    if (glyph < numberOfHMetrics) advance = scale(view.getUint16(hmtx + glyph * 4))
    advances[glyph] = advance
  }

  const widths = new Map<number, number>()
  for (const [code, glyph] of charToGlyph) {
    const width = advances[glyph]
    if (width !== undefined) widths.set(code, width)
  }
  return { widths, defaultWidth: advances[0] ?? 0 }
}

async function registerFace(buffer: ArrayBuffer) {
  if (!import.meta.client || typeof FontFace === 'undefined') return
  try {
    const face = new FontFace(FONT_FAMILY, buffer)
    await face.load()
    document.fonts.add(face)
  } catch {
    // Rendering falls back to the stack in CSS; measurement is unaffected.
  }
}

async function load(): Promise<Metrics | null> {
  if (metrics) return metrics
  if (!loading) {
    loading = (async () => {
      try {
        const response = await fetch(FONT_URL)
        if (!response.ok) throw new Error(String(response.status))
        const buffer = await response.arrayBuffer()
        // The face needs its own copy: parsing keeps the original readable.
        await registerFace(buffer.slice(0))
        metrics = parseFontMetrics(buffer)
      } catch {
        metrics = null
      }
      approximate = metrics === null
      return metrics
    })()
  }
  return loading
}

/**
 * Canvas fallback when the font cannot be fetched or parsed. Kerning is turned
 * off to get closer to reportlab, and a 2% margin keeps the warning on the
 * safe side of a late export failure.
 */
function approximateWidth(text: string, size: number) {
  if (!import.meta.client) return text.length * size * 0.5
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return text.length * size * 0.5
  context.font = `${size}px ${FONT_FAMILY}, 'DM Sans', sans-serif`
  if ('fontKerning' in context) context.fontKerning = 'none'
  return context.measureText(text).width * 1.02
}

/**
 * Pure: reportlab's `0.001 * size * sum(charWidths.get(ord(ch), defaultWidth))`.
 * Summed left to right so the floating-point result matches Python's `sum()`.
 */
export function widthFromMetrics(font: FontMetrics, text: string, size: number): number {
  let units = 0
  // Iterate code points, matching Python's `for u in text: ord(u)`.
  for (const character of text) units += font.widths.get(character.codePointAt(0) ?? 0) ?? font.defaultWidth
  return 0.001 * size * units
}

/** Mirrors Python `str.splitlines()` for text the server already validated. */
export function splitLines(text: string): string[] {
  const parts = text.split(/\n|\u0085|\u2028|\u2029/)
  // Python drops the empty tail a trailing separator would otherwise produce.
  if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
  return parts
}

export function useEditorFontMetrics() {
  const ready = useState('editor-font-ready', () => false)

  async function ensure() {
    await load()
    ready.value = true
  }

  function stringWidth(text: string, size: number): number {
    if (!metrics) return approximateWidth(text, size)
    return widthFromMetrics(metrics, text, size)
  }

  /** The exact condition `_overlay` uses before it draws a text command. */
  function textOverflow(
    text: string,
    size: number,
    x: number,
    y: number,
    pageWidth: number,
    pageHeight: number,
  ) {
    const lines = splitLines(text)
    const widest = lines.reduce((most, line) => Math.max(most, stringWidth(line, size)), 0)
    return {
      horizontal: x + widest > pageWidth,
      vertical: y + lines.length * size * LINE_FACTOR > pageHeight,
      widest,
      lines: lines.length,
    }
  }

  /** Insert real newlines at measured break points — the engine never wraps. */
  function wrapToWidth(text: string, size: number, maxWidth: number): string {
    if (maxWidth <= 0) return text
    return splitLines(text)
      .map((line) => {
        if (stringWidth(line, size) <= maxWidth) return line
        const out: string[] = []
        let current = ''
        for (const word of line.split(' ')) {
          const candidate = current ? `${current} ${word}` : word
          if (current && stringWidth(candidate, size) > maxWidth) {
            out.push(current)
            current = word
          } else current = candidate
          // A single word longer than the line still has to break somewhere.
          while (stringWidth(current, size) > maxWidth && [...current].length > 1) {
            const characters = [...current]
            let taken = ''
            for (const character of characters) {
              if (stringWidth(taken + character, size) > maxWidth && taken) break
              taken += character
            }
            out.push(taken)
            current = characters.slice([...taken].length).join('')
          }
        }
        if (current) out.push(current)
        return out.join('\n')
      })
      .join('\n')
  }

  return { ready, ensure, stringWidth, textOverflow, wrapToWidth, isApproximate: () => approximate }
}
