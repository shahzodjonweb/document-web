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
 * The deck faces below are pinned the same way, to `slides._face_units` and
 * `slides._text_width` in the platform's apps/studio/slides.py, which measure a
 * generated deck per letter in the stand-ins of processors/deck_fonts.py:
 *   TTFontFace(path).charWidths / .defaultWidth, sorted by code point, with a
 *   width's `.0` dropped so that Python and JavaScript print it alike.
 * Width lists: every face against DECK_SAMPLES, at size 18.
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
// Trapped before the import: loading the app must not fetch a deck's fonts.
const fetched = []
globalThis.fetch = async (url) => {
  fetched.push(url)
  return new Response(await fs.readFile(path.join(root, 'public', url)))
}
const {
  parseFontMetrics,
  widthFromMetrics,
  splitLines,
  ensureDeckFace,
  deckUnits,
  deckTextWidth,
  DECK_STAND_INS,
  DECK_OTHER_FACE,
  DECK_DIGIT_FLOORS,
  DECK_WIDTH_SAFETY,
} = await import(path.join(root, 'app/composables/useEditorFontMetrics.ts'))
assert.deepEqual(fetched, [], 'importing the metrics fetched a font')

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

const DECK_FAMILIES = {
  Carlito: {
    file: 'carlito-regular.ttf',
    sha256: 'f6418f708baede9789daef5d458c0f53d2a888af9820e8062934e504fedc6595',
    entries: 2118,
    defaultWidth: 506.8359375,
    checksum: '9385dcbbd4bfe931701dbb3b5a71872da178fc0722317f545a600834c2806075',
  },
  Caladea: {
    file: 'caladea-regular.ttf',
    sha256: 'f1e899278b7b4491aba5b6a8253c4b04c050cc59b21865be5c37559a775153cd',
    entries: 436,
    defaultWidth: 617,
    checksum: '4e39a065b4f88ab6ee449cdb6e2f45cee9d86f331ace8157ce43c7279405786d',
  },
  'Liberation Sans': {
    file: 'liberation-sans-regular.ttf',
    sha256: '76d04c18ea243f426b7de1f3ad208e927008f961dc5945e5aad352d0dfde8ee8',
    entries: 2328,
    defaultWidth: 750,
    checksum: 'da7f0d8af5a11316512b87ba0159838c2e056487b5c27aea091f64b2a2843844',
  },
  'Noto Sans': {
    file: 'noto-sans-regular.ttf',
    sha256: 'f5f552c8c5edb61fe6efb824baf4d4de47b1a8689ab4925ff43f7bd6a4ebece5',
    entries: 3094,
    defaultWidth: 600,
    checksum: '9137e81de5a4bba24b2159cb3cf61e2ef183c8db160f83a42fca54eab245767a',
  },
  'Noto Serif': {
    file: 'noto-serif-regular.ttf',
    sha256: 'a15cfbbc1539d707115111d672d590a3d70d4f74b4c0a315956da20ae19a14e1',
    entries: 2965,
    defaultWidth: 600,
    checksum: '755585289d784181bc9f156ededcb1dfaced45a52e2c7dccc0231e2789f66eb3',
  },
}
// Latin, Russian with digits, Uzbek with U+02BC and U+2018, Uzbek Cyrillic, extremes, a letter no family has, figures.
const DECK_SAMPLES = [
  'The tides of the northern sea',
  'Приливы северного моря 2019',
  'O\u02bczbekiston va g\u2018alaba: o\u2018quvchilar',
  'Ўзбекистон',
  'iiiWWW',
  '\u{1F600} ok',
  '118% 4 200 Q3 2021',
  '',
]
// [units, width at 18] per sample, in that order.
const DECK_MEASURES = {
  Calibri: [
    [11810.546875, 233.848828125],
    [13149.4140625, 260.3583984375],
    [14095.21484375, 279.08525390625005],
    [4856.93359375, 96.16728515625],
    [3357.421875, 66.47695312500001],
    [1808.0078125, 35.79855468750001],
    [8374.0234375, 165.8056640625],
    [0, 0],
  ],
  Corbel: [
    [11810.546875, 233.848828125],
    [13149.4140625, 260.3583984375],
    [14095.21484375, 279.08525390625005],
    [4856.93359375, 96.16728515625],
    [3357.421875, 66.47695312500001],
    [1808.0078125, 35.79855468750001],
    [8374.0234375, 165.8056640625],
    [0, 0],
  ],
  Candara: [
    [11810.546875, 233.848828125],
    [13149.4140625, 260.3583984375],
    [14095.21484375, 279.08525390625005],
    [4856.93359375, 96.16728515625],
    [3357.421875, 66.47695312500001],
    [1808.0078125, 35.79855468750001],
    [8374.0234375, 165.8056640625],
    [0, 0],
  ],
  Arial: [
    [12785.64453125, 253.15576171875003],
    [14354.00390625, 284.20927734375005],
    [15397.4609375, 304.86972656250003],
    [5285.15625, 104.64609375],
    [3498.046875, 69.261328125],
    [1933.984375, 38.292890625000005],
    [9452.1484375, 187.1525390625],
    [0, 0],
  ],
  'Trebuchet MS': [
    [13621, 269.6958],
    [15115, 299.27700000000004],
    [16032, 317.43360000000007],
    [5570, 110.28600000000002],
    [3564, 70.56720000000001],
    [1999, 39.580200000000005],
    [9516, 188.41680000000002],
    [0, 0],
  ],
  Cambria: [
    [11731, 232.2738],
    [15296, 302.86080000000004],
    [14147, 280.11060000000003],
    [5780, 114.44400000000002],
    [3498, 69.26040000000002],
    [1825, 36.135000000000005],
    [9017, 178.5366],
    [0, 0],
  ],
  Georgia: [
    [13703, 271.31940000000003],
    [15608, 309.0384],
    [16637, 329.41260000000005],
    [5780, 114.44400000000002],
    [4101, 81.19980000000001],
    [2022, 40.0356],
    [9902, 196.05960000000005],
    [0, 0],
  ],
  Constantia: [
    [13703, 271.31940000000003],
    [15436, 305.63280000000003],
    [16637, 329.41260000000005],
    [5780, 114.44400000000002],
    [4101, 81.19980000000001],
    [2022, 40.0356],
    [9386, 185.8428],
    [0, 0],
  ],
  'Comic Sans MS': [
    [13621, 269.6958],
    [15115, 299.27700000000004],
    [16032, 317.43360000000007],
    [5570, 110.28600000000002],
    [3564, 70.56720000000001],
    [1999, 39.580200000000005],
    [9516, 188.41680000000002],
    [0, 0],
  ],
}
const STAND_INS = {
  Calibri: ['Carlito', 'Noto Sans'],
  Corbel: ['Carlito', 'Noto Sans'],
  Candara: ['Carlito', 'Noto Sans'],
  Arial: ['Liberation Sans', 'Noto Sans'],
  'Trebuchet MS': ['Noto Sans'],
  Cambria: ['Caladea', 'Noto Serif', 'Noto Sans'],
  Georgia: ['Noto Serif', 'Noto Sans'],
  Constantia: ['Noto Serif', 'Noto Sans'],
}
assert.deepEqual(DECK_STAND_INS, STAND_INS, 'stand-ins differ from processors/deck_fonts.py')
assert.deepEqual(DECK_OTHER_FACE, ['Noto Sans'], 'the face for anything else')
assert.deepEqual(DECK_DIGIT_FLOORS, { Cambria: 554, Georgia: 602 }, 'deck_fonts.DIGIT_FLOORS')
assert.equal(DECK_WIDTH_SAFETY, 1.1, 'slides.WIDTH_SAFETY')

const parsedFamilies = {}
for (const [family, want] of Object.entries(DECK_FAMILIES)) {
  const bytes = await fs.readFile(path.join(root, 'public/fonts', want.file))
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    want.sha256,
    `${family}: not the platform's file`,
  )
  await fs.access(path.join(root, 'public/fonts', want.file.replace('-regular.ttf', '-OFL.txt')))
  const face = parseFontMetrics(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  assert.ok(face, `${family} could not be parsed`)
  assert.equal(face.defaultWidth, want.defaultWidth, `${family} defaultWidth`)
  assert.equal(face.widths.size, want.entries, `${family} mapped code point count`)
  const printed = [...face.widths.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([code, width]) => `${code}:${width}`)
    .join(';')
  assert.equal(
    createHash('sha256').update(printed).digest('hex'),
    want.checksum,
    `${family} advance widths differ from reportlab`,
  )
  parsedFamilies[family] = face
}

// A family that may hold a letter and is missing leaves the total unknown; one
// the text never reaches does not.
assert.equal(deckUnits([parsedFamilies.Caladea, undefined], 'Приливы'), null)
assert.equal(
  deckUnits([parsedFamilies.Caladea, undefined], 'Tides'),
  deckUnits([parsedFamilies.Caladea], 'Tides'),
)

// The fetches: nothing until asked, then only what the text reaches.
const asked = async (face, text) => {
  fetched.length = 0
  assert.equal(await ensureDeckFace(face, text), true, `${face}: ${text}`)
  return [...fetched]
}
assert.equal(deckTextWidth('Calibri', 'Word', 18), null, 'measured before the file came')
assert.deepEqual(await asked('Calibri', ''), [], 'no letters, no file')
assert.deepEqual(await asked('Calibri', 'Word Слово'), ['/fonts/carlito-regular.ttf'])
assert.deepEqual(await asked('Corbel', 'Word'), [], 'already here')
assert.deepEqual(await asked('Cambria', 'Tides 2019'), ['/fonts/caladea-regular.ttf'])
assert.deepEqual(await asked('Cambria', 'Приливы 2019'), ['/fonts/noto-serif-regular.ttf'])
assert.equal(deckTextWidth('Calibri', '\u{1F600}', 18), null, 'the last family may still hold it')

// A dropped connection is forgotten, so the next try can still work.
const realFetch = globalThis.fetch
globalThis.fetch = async () => new Response('', { status: 503 })
assert.equal(await ensureDeckFace('Arial', 'Word'), false, 'a failed file')
assert.equal(deckTextWidth('Arial', 'Word', 18), null)
globalThis.fetch = async () => {
  throw new TypeError('offline')
}
assert.equal(await ensureDeckFace('Arial', 'Word'), false, 'no connection')
globalThis.fetch = realFetch
assert.deepEqual(await asked('Arial', 'Word'), ['/fonts/liberation-sans-regular.ttf'])

let measured = 0
for (const [face, rows] of Object.entries(DECK_MEASURES)) {
  const standIn = Object.hasOwn(STAND_INS, face) ? STAND_INS[face] : DECK_OTHER_FACE
  const stack = standIn.map((family) => parsedFamilies[family])
  for (const [index, [units, width]] of rows.entries()) {
    const text = DECK_SAMPLES[index]
    assert.equal(await ensureDeckFace(face, text), true, `${face} ${text}`)
    assert.equal(
      deckUnits(stack, text, DECK_DIGIT_FLOORS[face]),
      units,
      `_face_units(${JSON.stringify(text)}, ${face})`,
    )
    assert.equal(deckTextWidth(face, text, 18), width, `_text_width(${JSON.stringify(text)}, 18) in ${face}`)
    measured += 1
  }
}

// Not in the page's fonts or head: a font here is fetched for every visitor.
for (const shell of ['app/assets/css/fonts.css', 'nuxt.config.ts']) {
  const source = await fs.readFile(path.join(root, shell), 'utf8')
  for (const { file } of Object.values(DECK_FAMILIES))
    assert.ok(!source.includes(file), `${shell} loads ${file}`)
}

console.log(`Pass: 5 deck families match reportlab; ${measured} deck widths exact`)
