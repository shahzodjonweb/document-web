/**
 * The lines budget between keystrokes. The server decides what fits (`POST /fit`);
 * this only carries its last answer forward while the customer types, from the
 * widths of the very faces the server measures in (`useEditorFontMetrics`).
 *
 * Words wrap on the server and only whole lines are counted here, so the raw count
 * runs short. `calibrated` scales it by what `/fit` said of the text it last saw.
 */
import { deckTextWidth } from './useEditorFontMetrics.ts'

/** Layouts whose body is lines in one box, so a count of lines means something. */
export const LOCAL_LAYOUTS = [
  'bullets',
  'two_column',
  'statement',
  'section',
  'closing',
  'cover',
  'image_split',
  'image_full',
]
/** A slide is 13.333 in wide, 72 pt to the inch; frames are fractions of it. */
const SLIDE_WIDTH_PT = 960

/**
 * Lines `lines` take in a box `boxWidthPt` wide at `size`: each non-empty line at
 * least one. Null until `ensureDeckFace` has fetched what the words need.
 * `deckTextWidth` already carries `DECK_WIDTH_SAFETY`, as the server's width does.
 */
export function lineEstimate(lines: string[], face: string, size: number, boxWidthPt: number): number | null {
  if (!(boxWidthPt > 0) || !(size > 0)) return null
  let total = 0
  for (const line of lines) {
    if (!line.trim()) continue
    const width = deckTextWidth(face, line, size)
    if (width === null) return null
    total += Math.max(1, Math.ceil(width / boxWidthPt))
  }
  return total
}

/** The estimate as `/fit` would count it, by the ratio it showed for the text it was asked about. */
export function calibrated(estimate: number, fit: { lines_used: number }, estimateAtFit: number): number {
  if (!(estimateAtFit > 0)) return estimate
  return Math.round((estimate * fit.lines_used) / estimateAtFit)
}

/** The widest body box of a drawn slide, in points: where its lines wrap. Null with none. */
export function bodyWidthPt(frames: { field: string; w: number }[]): number | null {
  const widest = Math.max(0, ...frames.filter((frame) => frame.field === 'body').map((frame) => frame.w))
  return widest > 0 ? widest * SLIDE_WIDTH_PT : null
}
