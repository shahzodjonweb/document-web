/**
 * Pins the browser TTF parser to reportlab's metrics.
 *
 * The export engine refuses text with `editor_text_overflow` using reportlab's
 * `stringWidth` over NotoSans-Regular.ttf. The editor predicts that before
 * export, so the two must agree exactly — a drift here means users see "fits"
 * and then get a failed job.
 *
 * The expected values below were produced from the platform's own reportlab:
 *   pdfmetrics.registerFont(TTFont('N', 'processors/assets/fonts/NotoSans-Regular.ttf'))
 *   pdfmetrics.getFont('N').face.charWidths / .defaultWidth
 *
 * Runs in plain Node, no browser and no Python. Part of `npm run check:catalog`'s
 * sibling checks; wire it into CI alongside typecheck.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const { parseFontMetrics, widthFromMetrics, splitLines } = await import(
  path.join(root, 'app/composables/useEditorFontMetrics.ts')
)

const EXPECTED = {
  entries: 3094,
  defaultWidth: 600,
  // sha256 over `code:width` pairs sorted by code point.
  checksum: '9137e81de5a4bba24b2159cb3cf61e2ef183c8db160f83a42fca54eab245767a',
  widths: [
    ['Reviewed in PDF Master', 16, 180.416],
    ['Hello world', 16, 85.808],
    ['Dilnoza Ўзбекистон', 16, 149.28],
    ['iiiii', 16, 20.64],
    ['WWWWW', 16, 74.4],
    ['', 16, 0],
  ],
}

const file = await fs.readFile(path.join(root, 'public/fonts/noto-sans-regular.ttf'))
const font = parseFontMetrics(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength))
assert.ok(font, 'the bundled font could not be parsed')

assert.equal(font.defaultWidth, EXPECTED.defaultWidth, 'defaultWidth')
assert.equal(font.widths.size, EXPECTED.entries, 'mapped code point count')

const pairs = [...font.widths.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([code, width]) => `${code}:${width}`)
  .join(';')
assert.equal(
  createHash('sha256').update(pairs).digest('hex'),
  EXPECTED.checksum,
  'advance widths differ from reportlab — the font or the parser changed',
)

for (const [text, size, want] of EXPECTED.widths) {
  assert.equal(
    widthFromMetrics(font, text, size),
    want,
    `stringWidth(${JSON.stringify(text)}, ${size})`,
  )
}

// Python `str.splitlines()` parity — the engine counts lines that way, and a
// trailing newline must not add a phantom line to the overflow check.
for (const [input, want] of [
  ['a\nb', ['a', 'b']],
  ['a\n', ['a']],
  ['a\n\n', ['a', '']],
  ['\n', ['']],
  ['a', ['a']],
  ['a b', ['a', 'b']],
]) {
  assert.deepEqual(splitLines(input), want, `splitLines(${JSON.stringify(input)})`)
}

console.log(
  `Pass: ${EXPECTED.entries} advance widths match reportlab; ${EXPECTED.widths.length} string widths exact`,
)
