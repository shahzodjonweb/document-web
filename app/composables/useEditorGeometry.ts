/**
 * Screen pixels ↔ PDF points, and the bounds the export engine enforces.
 *
 * `processors/editor.py: _geometry` is deliberately asymmetric and this file
 * encodes it rather than approximating it:
 *
 *   commands with x/y : x <  W  and  y <  H  and  x + (width||0) <= W
 *                                              and  y + (height||0) <= H
 *   draw points       : x <= W  and  y <= H          (inclusive)
 *   every number      : 0 <= v <= 14400             (width/height min 1)
 *
 * A value that survives `clampCommand` cannot produce `editor_out_of_bounds`.
 */
import { COMMAND_SHAPE, LIMITS, quantize, type ClientCommand } from './useEditorCommands'

export interface PageSize {
  width: number
  height: number
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low
  return Math.min(Math.max(value, low), high)
}

/** Largest 2-decimal value strictly below `limit` (page sizes are fractional). */
export function strictMax(limit: number): number {
  return Math.floor((limit - 0.01) * 100) / 100
}

/** Largest 2-decimal value at or below `limit`. */
export function inclusiveMax(limit: number): number {
  return Math.floor(limit * 100) / 100
}

/**
 * The page container carries `aspect-ratio` and no border or padding, so its
 * rect is the page. Pinch-zoom cancels out because both `clientX` and the rect
 * are in layout-viewport CSS pixels.
 */
export function pointFromEvent(
  event: { clientX: number; clientY: number },
  rect: DOMRect,
  page: PageSize,
): { x: number; y: number } {
  const scale = rect.width / page.width || 1
  return {
    x: quantize((event.clientX - rect.left) / scale),
    y: quantize((event.clientY - rect.top) / scale),
  }
}

/** CSS pixels per PDF point for the rendered page. */
export function pageScale(rect: { width: number }, page: PageSize): number {
  return rect.width / page.width || 1
}

export type ClampMode = 'move' | 'resize'

/**
 * Returns a copy whose geometry the server will accept.
 *
 * `move` keeps the size and slides the position; `resize` keeps the position
 * and shrinks the size. Dragging an edge must not teleport the opposite one.
 */
export function clampCommand(command: ClientCommand, page: PageSize, mode: ClampMode = 'move'): ClientCommand {
  const next: ClientCommand = { ...command }
  const shape = COMMAND_SHAPE[command.type]
  const maxCoordinate = LIMITS.coordinate

  if (next.points) {
    next.points = next.points.map(([x, y]) => [
      quantize(clamp(x, 0, Math.min(maxCoordinate, inclusiveMax(page.width)))),
      quantize(clamp(y, 0, Math.min(maxCoordinate, inclusiveMax(page.height)))),
    ])
  }

  if (!shape.positional || next.x === undefined || next.y === undefined) return next

  if (shape.box) {
    const widthCeiling = Math.min(maxCoordinate, inclusiveMax(page.width))
    const heightCeiling = Math.min(maxCoordinate, inclusiveMax(page.height))
    if (mode === 'resize') {
      const x = quantize(clamp(next.x, 0, Math.max(0, inclusiveMax(page.width - LIMITS.minSize))))
      const y = quantize(clamp(next.y, 0, Math.max(0, inclusiveMax(page.height - LIMITS.minSize))))
      next.x = x
      next.y = y
      next.width = quantize(
        clamp(next.width ?? LIMITS.minSize, LIMITS.minSize, Math.max(LIMITS.minSize, inclusiveMax(page.width - x))),
      )
      next.height = quantize(
        clamp(next.height ?? LIMITS.minSize, LIMITS.minSize, Math.max(LIMITS.minSize, inclusiveMax(page.height - y))),
      )
      return next
    }
    const width = quantize(clamp(next.width ?? LIMITS.minSize, LIMITS.minSize, widthCeiling))
    const height = quantize(clamp(next.height ?? LIMITS.minSize, LIMITS.minSize, heightCeiling))
    next.width = width
    next.height = height
    next.x = quantize(clamp(next.x, 0, Math.max(0, inclusiveMax(page.width - width))))
    next.y = quantize(clamp(next.y, 0, Math.max(0, inclusiveMax(page.height - height))))
    return next
  }

  // Point-only commands: strictly inside the page.
  next.x = quantize(clamp(next.x, 0, Math.min(maxCoordinate, strictMax(page.width))))
  next.y = quantize(clamp(next.y, 0, Math.min(maxCoordinate, strictMax(page.height))))
  return next
}

/** True when the server would reject this command's geometry. */
export function outOfBounds(command: ClientCommand, page: PageSize): boolean {
  if (command.points) {
    if (command.points.some(([x, y]) => x > page.width || y > page.height)) return true
  }
  if (command.x === undefined || command.y === undefined) return false
  if (command.x >= page.width || command.y >= page.height) return true
  if ((command.width ?? 0) + command.x > page.width) return true
  if ((command.height ?? 0) + command.y > page.height) return true
  return false
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** The on-page footprint used for overlays, snapping and hit testing. */
export function commandRect(command: ClientCommand, fontSize = 16, textWidth = 0, lines = 1): Rect | null {
  if (command.points?.length) {
    const xs = command.points.map(([x]) => x)
    const ys = command.points.map(([, y]) => y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
  }
  if (command.x === undefined || command.y === undefined) return null
  if (command.width !== undefined && command.height !== undefined)
    return { x: command.x, y: command.y, width: command.width, height: command.height }
  if (command.type === 'note') return { x: command.x, y: command.y, width: 22, height: 22 }
  // add_text: the box follows the measured text and the engine's 1.3 leading.
  const size = command.font_size ?? fontSize
  return { x: command.x, y: command.y, width: textWidth, height: lines * size * 1.3 }
}

/** Page edges and centre lines, plus the edges of every other mark. */
export function snapCandidates(rects: Rect[], page: PageSize) {
  const vertical = [0, page.width / 2, page.width]
  const horizontal = [0, page.height / 2, page.height]
  for (const rect of rects) {
    vertical.push(rect.x, rect.x + rect.width / 2, rect.x + rect.width)
    horizontal.push(rect.y, rect.y + rect.height / 2, rect.y + rect.height)
  }
  return { vertical, horizontal }
}

/** Snap `value` to the nearest candidate within `tolerance` PDF points. */
export function snap(value: number, candidates: number[], tolerance: number): number {
  let best = value
  let distance = tolerance
  for (const candidate of candidates) {
    const gap = Math.abs(candidate - value)
    if (gap < distance) {
      distance = gap
      best = candidate
    }
  }
  return best
}

export function useEditorGeometry() {
  return {
    pointFromEvent,
    pageScale,
    clampCommand,
    outOfBounds,
    commandRect,
    snapCandidates,
    snap,
    strictMax,
    inclusiveMax,
  }
}
