/**
 * The deck editor: an AI-made deck's slides, changed by tapping their words, on phones and at 1440.
 *
 * Every API call is a fixture in the platform's own shapes (draft_data, render_state,
 * fit_section, quote_data with quote_summary, job_data) and Telegram is a stub with spies,
 * so this says what the app asks, not what Telegram or LibreOffice do with it. The slides
 * are small PNGs drawn here: each shows its number and its words in capitals, so a
 * screenshot tells slides apart and shows that an edit was drawn again. Every deck,
 * person and school is made up. Read the screenshots: checks have passed on broken
 * layouts before.
 *
 *   npm run build && PORT=3002 HOST=127.0.0.1 node .output/server/index.mjs   (in the background)
 *   DECK_EDITOR_SHOTS=<folder> DECK_EDITOR_ONLY=<part of a group name or a matrix label> npm run test:deck-editor
 */
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'

const origin = process.env.EDITOR_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(
  ['127.0.0.1', 'localhost'].includes(new URL(origin).hostname),
  'Use the local web server for this fixture test',
)
const output = process.env.DECK_EDITOR_SHOTS
  ? path.resolve(process.env.DECK_EDITOR_SHOTS)
  : path.resolve(process.env.EDITOR_ARTIFACT_DIR || '../editor-review/workspace', 'deck')
await fs.mkdir(output, { recursive: true })
const ONLY = (process.env.DECK_EDITOR_ONLY || '').toLowerCase()

const DRAFT = '00000000-0000-4000-8000-0000000000d1'
const SOURCE_DRAFT = '00000000-0000-4000-8000-0000000000d0'
// Another deck of the same account, for leaving one deck for the next.
const OTHER_DRAFT = '00000000-0000-4000-8000-0000000000d2'
const PHOTOS = [
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000103',
]
const PPTX_ARTIFACT = '00000000-0000-4000-8000-0000000000e2'
const PDF_ARTIFACT = '00000000-0000-4000-8000-0000000000e3'
const EXPORT_JOB = '00000000-0000-4000-8000-0000000000f5'
const DECK_JOB = '00000000-0000-4000-8000-0000000000f6'
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const COST = { kind: 'file_task', left: 11, limit: 15 }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const RENDER = `/generation/drafts/${DRAFT}/render`
const FIT = `/generation/drafts/${DRAFT}/fit`
const QUOTE = `/generation/drafts/${DRAFT}/export-quote`
const ORIGINAL_IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7']
const SECTION_KEYS = ['body', 'columns', 'heading', 'id', 'image_query', 'items', 'layout', 'notes']
const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const checks = []
const failures = []
const passed = (name) => {
  checks.push(name)
  console.log(`passed: ${name}`)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const clone = (value) => JSON.parse(JSON.stringify(value))
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex')

/* ------------------------------------------------------------------ the deck */

const section = (id, layout, heading, body = '', extra = {}) => ({
  id,
  heading,
  body,
  notes: '',
  layout,
  items: [],
  columns: [],
  image_query: '',
  ...extra,
})
const item = (label, text, value = '') => ({ label, text, value })
// Two made-up decks of the same seven slides, the second as an Uzbek deck is written (o‘ g‘ with U+2018).
const DECKS = {
  en: {
    title: 'Water cycle in nature',
    cover: 'Prepared by: Karimova Dilnoza\nChecked by: Rasulova M.\n9-B class\nSchool No. 21',
    sections: () => [
      section(
        's2',
        'bullets',
        'Evaporation',
        'The sun warms rivers and seas\nWater turns into vapour\nWarm air carries it upwards',
        {
          notes: 'Ask who has seen fog.',
        },
      ),
      section('s3', 'process', 'How rain forms', '', {
        items: [
          item('Rising', 'Vapour rises with warm air'),
          item('Cooling', 'High air is cold, so vapour cools'),
          item('Falling', 'Drops grow heavy and fall'),
        ],
      }),
      section('s4', 'stats', 'Where water is', '', {
        items: [
          item('Oceans', 'Salt water', '97%'),
          item('Ice', 'Glaciers and caps', '2%'),
          item('Fresh', 'Rivers, lakes, ground', '1%'),
        ],
      }),
      section('s5', 'image_split', 'Clouds', 'Clouds are tiny drops of water\nThey move with the wind', {
        image_query: 'rain clouds',
      }),
      section('s6', 'pros_cons', 'Rain in cities', '', {
        items: [
          item('Cleaner air', 'Rain washes dust away', 'pro'),
          item('Floods', 'Drains can overflow', 'con'),
        ],
        columns: ['For', 'Against'],
      }),
      section('s7', 'closing', 'Thank you', 'Questions?'),
    ],
  },
  uz: {
    title: 'Suvning tabiatda aylanishi',
    cover: 'Bajardi: Karimova Dilnoza\n9-B sinf\n21-maktab',
    sections: () => [
      section(
        's2',
        'bullets',
        'Bug‘lanish',
        'Quyosh daryo va dengizlarni isitadi\nSuv bug‘ga aylanadi\nIliq havo uni yuqoriga olib chiqadi',
        {
          notes: 'Kim tuman ko‘rganini so‘rang.',
        },
      ),
      section('s3', 'process', 'Yomg‘ir qanday hosil bo‘ladi', '', {
        items: [
          item('Ko‘tarilish', 'Bug‘ iliq havo bilan ko‘tariladi'),
          item('Sovish', 'Yuqorida havo sovuq'),
          item('Yog‘ish', 'Tomchilar og‘irlashib tushadi'),
        ],
      }),
      section('s4', 'stats', 'Suv qayerda', '', {
        items: [
          item('Okeanlar', 'Sho‘r suv', '97%'),
          item('Muz', 'Muzliklar', '2%'),
          item('Chuchuk', 'Daryo va ko‘llar', '1%'),
        ],
      }),
      section(
        's5',
        'image_split',
        'Bulutlar',
        'Bulutlar mayda suv tomchilaridan iborat\nUlar shamol bilan harakatlanadi',
        {
          image_query: 'rain clouds',
        },
      ),
      section('s6', 'pros_cons', 'Shahardagi yomg‘ir', '', {
        items: [
          item('Toza havo', 'Yomg‘ir changni yuvadi', 'pro'),
          item('Toshqin', 'Ariqlar to‘lib ketadi', 'con'),
        ],
        columns: ['Afzallik', 'Kamchilik'],
      }),
      section('s7', 'closing', 'Rahmat', 'Savollar?'),
    ],
  },
}
const TITLE_LINES = {
  en: ['Prepared by: Karimova Dilnoza', 'Checked by: Rasulova M.', '9-B class', 'School No. 21'],
  uz: ['Bajardi: Karimova Dilnoza', '9-B sinf', '21-maktab'],
}
const EXTRA_LINES = [
  'Fixture line four',
  'Fixture line five',
  'Fixture line six',
  'Fixture line seven',
  'Fixture line eight',
]

/**
 * 7 sections and 6 questions: 9 slides. `overBudget` gives those slides 8 lines, past the 6 a slide holds;
 * `bodies` gives slides lines of their own.
 */
function deckContent(deck, { coverBody, overBudget = [], bodies = {} } = {}) {
  const source = DECKS[deck]
  const sections = [
    section('s1', 'cover', source.title, coverBody ?? source.cover, { image_query: 'ocean clouds' }),
    ...source.sections(),
  ]
  for (const id of overBudget) {
    const found = sections.find((row) => row.id === id)
    found.body = [...found.body.split('\n'), ...EXTRA_LINES].slice(0, 8).join('\n')
  }
  for (const [id, body] of Object.entries(bodies)) sections.find((row) => row.id === id).body = body
  const questions = Array.from({ length: 6 }, (_, index) => ({
    id: `q${index + 1}`,
    stem: `Fixture question ${index + 1}?`,
    options: ['North', 'South', 'East', 'West'],
    answer: 'North',
    explanation: '',
    topic: source.title.slice(0, 100),
    marks: 1,
  }))
  return { title: source.title, sections, questions, citations: [] }
}

/* ------------------------------------------------------------------ how the platform lays it out */

const PHOTO_LAYOUTS = ['cover', 'image_split', 'image_full']
const ITEM_LAYOUTS = [
  'process',
  'stats',
  'pros_cons',
  'timeline',
  'cards',
  'comparison',
  'big_number',
  'chart',
  'table',
]
const frame = (field, x, y, w, h) => ({ field, x, y, w, h })
const QUESTION_FRAMES = [frame('heading', 0.06, 0.08, 0.88, 0.12), frame('body', 0.06, 0.24, 0.88, 0.64)]
const filledItems = (row) => (row.items || []).filter((entry) => entry.label || entry.text || entry.value)
const bodyLines = (row) =>
  (row.body || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

/** Where a drawn slide's words lie, as slide_fit.slide_frames tells it: only boxes that hold words, and the picture. */
function framesOf(row, pictured) {
  const heading = row.heading.trim() !== ''
  const words = bodyLines(row).length > 0 || filledItems(row).length > 0
  if (row.layout === 'cover')
    return [
      heading && frame('heading', 0.075, 0.32, 0.6, 0.16),
      words && frame('body', 0.075, 0.52, 0.6, 0.22),
      pictured && frame('picture', 0.65, 0, 0.35, 1),
    ].filter(Boolean)
  if (row.layout === 'image_split')
    return [
      heading && frame('heading', 0.06, 0.08, 0.44, 0.12),
      words && frame('body', 0.06, 0.24, 0.44, 0.64),
      pictured && frame('picture', 0.55, 0, 0.45, 1),
    ].filter(Boolean)
  if (ITEM_LAYOUTS.includes(row.layout) && filledItems(row).length)
    return [
      heading && frame('heading', 0.06, 0.08, 0.88, 0.12),
      ...filledItems(row)
        .slice(0, 3)
        .map((_, index) => frame('body', [0.06, 0.365, 0.67][index], 0.35, 0.27, 0.4)),
    ].filter(Boolean)
  return [
    heading && frame('heading', 0.06, 0.08, 0.88, 0.12),
    words && frame('body', 0.06, 0.24, 0.88, 0.64),
  ].filter(Boolean)
}

/**
 * The live budget as POST /fit answers it: a line each, a line over 90 characters twice, 6 to a slide
 * (8 on the cover), or the lines `room` gives that slide. Past FIT_SECONDS the platform gives up only on
 * the list of layouts.
 */
function fitOf(row, index, { unfit = [], timedOut = false, room = {} } = {}) {
  const lines = [
    ...bodyLines(row),
    ...filledItems(row).map((entry) => [entry.label, entry.text, entry.value].filter(Boolean).join(' ')),
  ]
  const units = lines.flatMap((line) => (line.length > 90 ? [line, ''] : [line]))
  const max = room[row.id] ?? (row.layout === 'cover' ? 8 : 6)
  const forced = unfit.includes(row.id)
  const fits = units.length <= max && !forced
  const words = units.slice(max).reduce((sum, line) => sum + line.split(/\s+/).filter(Boolean).length, 0)
  // image_split is offered when it fits so that a send short of a picture has something to leave out.
  const fitting = fits
    ? ['bullets', 'two_column', 'image_split']
    : units.length <= 8
      ? ['two_column', 'image_split']
      : []
  return {
    id: row.id,
    index,
    fits,
    words_over: fits ? 0 : Math.max(words, forced ? 2 : 1),
    lines_used: units.length,
    lines_max: max,
    layouts_fitting: timedOut ? [] : fitting,
  }
}

/* ------------------------------------------------------------------ slide pictures */

// A 5×7 face for the slides' words: capitals, digits and a little punctuation. Anything else is a block.
const FONT = {
  A: '0e11111f111111',
  B: '1e11111e11111e',
  C: '0e11101010110e',
  D: '1e11111111111e',
  E: '1f10101e10101f',
  F: '1f10101e101010',
  G: '0e11101711110f',
  H: '1111111f111111',
  I: '0e04040404040e',
  J: '0702020202120c',
  K: '11121418141211',
  L: '1010101010101f',
  M: '111b1515111111',
  N: '11111915131111',
  O: '0e11111111110e',
  P: '1e11111e101010',
  Q: '0e11111115120d',
  R: '1e11111e141211',
  S: '0f10100e01011e',
  T: '1f040404040404',
  U: '1111111111110e',
  V: '11111111110a04',
  W: '1111111515150a',
  X: '11110a040a1111',
  Y: '1111110a040404',
  Z: '1f01020408101f',
  0: '0e11131519110e',
  1: '040c040404040e',
  2: '0e11010204081f',
  3: '1f02040201110e',
  4: '02060a121f0202',
  5: '1f101e0101110e',
  6: '0608101e11110e',
  7: '1f010204080808',
  8: '0e11110e11110e',
  9: '0e11110f01020c',
  '?': '0e110102040004',
  '.': '00000000000c0c',
  ',': '000000000c0408',
  ':': '000c0c000c0c00',
  '-': '0000001f000000',
  '%': '18190204081303',
  '!': '04040404040004',
  "'": '04040800000000',
  '(': '02040808080402',
  ')': '08040202020408',
  '/': '01010204081010',
  ' ': '00000000000000',
}
const BLOCK = '000e0e0e0e0e00'
function glyph(character) {
  const key = /[‘’ʼ`]/.test(character) ? "'" : /\s/.test(character) ? ' ' : character.toUpperCase()
  const hex = FONT[key] ?? BLOCK
  return Array.from({ length: 7 }, (_, row) => parseInt(hex.slice(row * 2, row * 2 + 2), 16))
}
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function encodePng(width, height, pixels) {
  const chunk = (type, data) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(data.length, 0)
    head.write(type, 4, 'ascii')
    const tail = Buffer.alloc(4)
    tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
    return Buffer.concat([head, data, tail])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  const stride = width * 3 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) pixels.copy(raw, y * stride + 1, y * width * 3, (y + 1) * width * 3)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
function wrap(line, per) {
  const rows = []
  let current = ''
  for (const word of line.split(/\s+/).filter(Boolean)) {
    for (let piece = word; piece; piece = piece.slice(per)) {
      const part = piece.slice(0, per)
      if (!current) current = part
      else if (current.length + 1 + part.length <= per) current += ` ${part}`
      else {
        rows.push(current)
        current = part
      }
    }
  }
  if (current) rows.push(current)
  return rows
}
function canvas(width, height, colour) {
  const pixels = Buffer.alloc(width * height * 3)
  const fill = (x, y, w, h, [r, g, b]) => {
    for (let j = Math.max(0, Math.round(y)); j < Math.min(height, Math.round(y + h)); j += 1)
      for (let i = Math.max(0, Math.round(x)); i < Math.min(width, Math.round(x + w)); i += 1) {
        const at = (j * width + i) * 3
        pixels[at] = r
        pixels[at + 1] = g
        pixels[at + 2] = b
      }
  }
  const text = (value, x, y, scale, ink) => {
    let left = x
    for (const character of String(value)) {
      glyph(character).forEach((bits, row) => {
        for (let column = 0; column < 5; column += 1)
          if (bits & (16 >> column)) fill(left + column * scale, y + row * scale, scale, scale, ink)
      })
      left += 6 * scale
    }
  }
  /** Lines wrapped to a frame and cut where it ends, at the largest of `scales` that holds them all. */
  const block = (box, lines, scales, ink) => {
    const [x, y, w, h] = [box.x * width, box.y * height, box.w * width, box.h * height]
    const laid = [scales].flat().map((scale) => {
      const rows = lines.flatMap((line) => wrap(line, Math.max(1, Math.floor((w - 8) / (6 * scale)))))
      return { scale, rows, room: Math.max(1, Math.floor((h - 6) / (9 * scale))) }
    })
    const { scale, rows, room } = laid.find((entry) => entry.rows.length <= entry.room) ?? laid.at(-1)
    rows.slice(0, room).forEach((row, index) => text(row, x + 4, y + 4 + index * 9 * scale, scale, ink))
  }
  fill(0, 0, width, height, colour)
  return { fill, text, block, png: () => encodePng(width, height, pixels) }
}
const PAPERS = [
  [244, 241, 232],
  [232, 240, 246],
  [240, 236, 246],
]
const ACCENT = [37, 94, 73]
/** A slide as a picture: its frames as boxes, its words in them, its number, and a red edge when words would not show. */
function drawSlide(entry, small) {
  const [width, height] = small ? [160, 90] : [640, 360]
  const c = canvas(width, height, PAPERS[entry.index % PAPERS.length])
  const bodies = entry.frames.filter((box) => box.field === 'body')
  for (const box of entry.frames) {
    const colour =
      box.field === 'picture' ? [146, 168, 186] : box.field === 'heading' ? ACCENT : [255, 255, 255]
    c.fill(box.x * width, box.y * height, box.w * width, box.h * height, colour)
  }
  const number = entry.kind === 'questions' ? '?' : String(entry.index + 1)
  if (small) c.text(number, width - 6 - 18 * number.length, 6, 3, [23, 33, 46])
  else {
    const heading = entry.frames.find((box) => box.field === 'heading')
    if (heading) c.block(heading, [entry.words.heading], [3, 2], [255, 255, 255])
    bodies.forEach((box, index) =>
      c.block(
        box,
        bodies.length > 1 ? (entry.words.bodies[index] ?? []) : entry.words.bodies.flat(),
        2,
        [23, 33, 46],
      ),
    )
    c.text(number, width - 10 - 12 * number.length, 8, 2, [23, 33, 46])
  }
  if (!entry.fits) c.fill(0, height - (small ? 4 : 8), width, small ? 4 : 8, [200, 40, 40])
  return c.png()
}

/* ------------------------------------------------------------------ Telegram */

/** Telegram's object as the app sees it, refusing anything the claimed version would not have. */
function telegramStub({ inside, scheme, version, platform, stable, safeBottom, kept }) {
  const atLeast = (wanted) => {
    const a = String(version).split('.').map(Number)
    const b = String(wanted).split('.').map(Number)
    return (a[0] ?? 0) > (b[0] ?? 0) || ((a[0] ?? 0) === (b[0] ?? 0) && (a[1] ?? 0) >= (b[1] ?? 0))
  }
  const log = []
  const violations = []
  const gated =
    (name, minimum, run = () => {}) =>
    (...args) => {
      log.push([name, ...args])
      if (!atLeast(minimum)) violations.push(`${name} below ${minimum}`)
      return run(...args)
    }
  const button = (prefix, minimum) => {
    const clicks = new Set()
    const self = {
      isVisible: false,
      text: '',
      isActive: true,
      progress: false,
      setParams(params) {
        log.push([`${prefix}.setParams`, params])
        if (params.text !== undefined) self.text = params.text
        if (params.is_active !== undefined) self.isActive = params.is_active
        if (params.is_visible !== undefined) self.isVisible = params.is_visible
      },
      show: gated(`${prefix}.show`, minimum, () => (self.isVisible = true)),
      hide: gated(`${prefix}.hide`, minimum, () => (self.isVisible = false)),
      showProgress: gated(`${prefix}.showProgress`, minimum, () => (self.progress = true)),
      hideProgress: gated(`${prefix}.hideProgress`, minimum, () => (self.progress = false)),
      onClick: gated(`${prefix}.onClick`, minimum, (run) => clicks.add(run)),
      offClick: gated(`${prefix}.offClick`, minimum, (run) => clicks.delete(run)),
      press: () => [...clicks].forEach((run) => run()),
      handlers: () => clicks.size,
    }
    return self
  }
  const events = new Map()
  const app = {
    initData: inside ? 'fixture' : '',
    version,
    platform,
    colorScheme: scheme,
    viewportStableHeight: stable ?? window.innerHeight,
    safeAreaInset: { top: 0, bottom: safeBottom, left: 0, right: 0 },
    contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    isFullscreen: false,
    isVersionAtLeast: atLeast,
    ready: () => log.push(['ready']),
    expand: () => log.push(['expand']),
    close: () => log.push(['close']),
    onEvent(name, run) {
      if (!events.has(name)) events.set(name, new Set())
      events.get(name).add(run)
    },
    offEvent: (name, run) => events.get(name)?.delete(run),
    MainButton: button('MainButton', '6.0'),
    BackButton: button('BackButton', '6.1'),
    HapticFeedback: {
      notificationOccurred: gated('haptic', '6.1'),
      impactOccurred: gated('haptic', '6.1'),
      selectionChanged: gated('haptic', '6.1'),
    },
    enableClosingConfirmation: gated('enableClosingConfirmation', '6.2'),
    disableClosingConfirmation: gated('disableClosingConfirmation', '6.2'),
    disableVerticalSwipes: gated('disableVerticalSwipes', '7.7'),
    enableVerticalSwipes: gated('enableVerticalSwipes', '7.7'),
    requestFullscreen: gated('requestFullscreen', '8.0'),
    exitFullscreen: gated('exitFullscreen', '8.0'),
    hideKeyboard: gated('hideKeyboard', '9.1'),
  }
  // The phone's own storage, from 9.0: what it holds is Telegram's, not the web view's.
  const stored = new Map(kept ? [['pdf-master-signatures', kept]] : [])
  app.DeviceStorage = {
    setItem: gated('DeviceStorage.setItem', '9.0', (key, value, done) => {
      stored.set(key, value)
      setTimeout(() => done?.(null, true))
    }),
    getItem: gated('DeviceStorage.getItem', '9.0', (key, done) =>
      setTimeout(() => done?.(null, stored.get(key) ?? '')),
    ),
    removeItem: gated('DeviceStorage.removeItem', '9.0', (key, done) => {
      stored.delete(key)
      setTimeout(() => done?.(null, true))
    }),
  }
  window.Telegram = { WebApp: app }
  // A keyboard shows only in the visual viewport on iOS Telegram.
  const view = new EventTarget()
  Object.assign(view, {
    width: window.innerWidth,
    height: window.innerHeight,
    offsetTop: 0,
    offsetLeft: 0,
    scale: 1,
  })
  Object.defineProperty(window, 'visualViewport', { value: view, configurable: true })
  window.__tg = {
    app,
    log,
    violations,
    stored,
    emit: (name, argument) => events.get(name)?.forEach((run) => run(argument)),
    keyboard(height) {
      view.height = window.innerHeight - height
      view.dispatchEvent(new Event('resize'))
    },
  }
}

/* ------------------------------------------------------------------ the server */

// Readable words for the refusals a banner shows as the server says them.
const MESSAGES = {
  payload_too_large: 'This deck is too long to save in one go.',
  upstream_unavailable: 'The service is busy right now.',
  not_found: 'Not found.',
}
const DEFAULT_PLAN = ['none', 'queued', 'running', 'done']
const live = new Set()
const contextFailures = []
let checkedContexts = 0

/**
 * A context with the app's API answered from `server`, as the platform answers it.
 *
 * refuseSaves: (nth PATCH, body, server) or a fixed answer: [status, code] | 'drop' (saved, then the
 *   connection is lost) | 'hang' (never answered) | { delay } (saved and answered that many ms late).
 * renderPlan: what GET /render says of a version, one answer per look ('none' until a POST asks for it).
 * renderFails: a code, or ({version, n}) → code, for the looks after the nth POST of a version.
 * second: the locale of another deck of the account, at OTHER_DRAFT, edited but never drawn; otherSaveDelay
 *   holds its writes back.
 * accounts: sign-out and the development sign-in, which signs in a second account; that account has
 *   its own deck at the same address, with an empty cover, and keeps no cover lines.
 * The server's flags can be flipped mid-run: engineDown (no PDF), picturesDown (slide pictures fail),
 *   lateCoverLines ({POST: ms} or {DELETE: ms}: the next such write of kept lines is taken at once and
 *   answered that late), refuseCoverLines (the same shape: the next such write is refused that late,
 *   changing nothing).
 */
async function openDeck({
  width = 390,
  height = 656,
  theme = 'light',
  locale = 'en',
  inside = true,
  version = '9.1',
  platform = 'android',
  stable,
  safeBottom = 0,
  editor = { editor_v2: true, deck_editor: true },
  clock = false,
  deck = locale === 'uz' ? 'uz' : 'en',
  coverBody,
  overBudget = [],
  bodies = {},
  unfit = [],
  lineRoom = {},
  slides = 60,
  expiresIn = 86400000,
  notEditable = false,
  expired = false,
  openFails = 0,
  draftDelay = 0,
  revisionSelected = false,
  refuseSaves = null,
  renderPlan = DEFAULT_PLAN,
  renderFails = null,
  laneBusy = false,
  renderConflictOnce = false,
  fitTimeoutOnce = false,
  fitDelay = 150,
  pictureGone = false,
  engineUnavailable = false,
  quoteRefusal = null,
  quoteTtl = 600000,
  quoteDelay = 0,
  cost = COST,
  jobAnswer = null,
  queued = 1,
  jobOutcome = 'succeeded',
  remembered = [],
  // The language of the deck the remembered lines were kept from, as POST /studio/cover-lines was told it.
  rememberedLocale = remembered.length ? deck : null,
  // The Cover sheet row each remembered line was kept from, as POST /studio/cover-lines was told it; null unsaid.
  rememberedRoles = remembered.map(() => null),
  latinDelay = 0,
  presetJobs = [],
  second = null,
  // A slow uplink on the second deck: its writes are taken, and answered, only this many ms late.
  otherSaveDelay = 0,
  accounts = false,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: 'reduce',
    colorScheme: theme,
    hasTouch: width < 980,
    locale,
  })
  await context.addInitScript(telegramStub, {
    inside,
    scheme: theme,
    version,
    platform,
    stable: stable ?? null,
    safeBottom,
    kept: null,
  })
  await context.addInitScript((value) => {
    try {
      if (!localStorage.getItem('pdf-master-theme')) localStorage.setItem('pdf-master-theme', value)
    } catch {}
  }, theme)
  // WebKit (iPhone and iPad Telegram) takes a focused field away with no blur, focusout or change; Chrome
  // sends them. `asWebKit` holds them back while a check needs WebKit's way.
  await context.addInitScript(() => {
    window.__asWebKit = false
    for (const type of ['blur', 'focusout', 'change'])
      window.addEventListener(
        type,
        (event) => {
          if (window.__asWebKit) event.stopImmediatePropagation()
        },
        true,
      )
  })
  const content = deckContent(deck, { coverBody, overBudget, bodies })
  const server = {
    version: 3,
    content,
    history: new Map([[3, clone(content)]]),
    gone: expired,
    draftGets: 0,
    requests: [],
    patches: [],
    renders: [],
    renderPosts: [],
    renderStates: new Map(),
    fits: [],
    fitNow: 0,
    fitMost: 0,
    fitTimeoutNext: fitTimeoutOnce,
    quotes: [],
    jobPosts: [],
    jobs: [],
    latin: [],
    coverLines: [],
    remembered: [...remembered],
    rememberedLocale,
    rememberedRoles: [...rememberedRoles],
    account: 'u1',
    engineDown: engineUnavailable,
    picturesDown: false,
    pictureGets: {},
    thumbGets: {},
    keys: new Map(),
    pictures: new Map(),
    unexpected: [],
    expiresAt: new Date(Date.now() + expiresIn).toISOString(),
    down: true,
    render: notEditable
      ? null
      : {
          design: 'aurora',
          deck_seed: 'aurora|water cycle in nature',
          body_size: 18,
          variants: {
            s1: '',
            s2: 'bullets.fixture',
            s3: 'process.fixture',
            s4: 'stats.fixture',
            s5: 'image_split.fixture',
            s6: 'pros_cons.fixture',
            s7: '',
          },
          photos: {
            s1: { asset_id: PHOTOS[0], candidates: [{ asset_id: PHOTOS[1] }] },
            s5: { asset_id: PHOTOS[2], candidates: [] },
          },
        },
  }
  if (second) {
    const other = deckContent(second)
    other.title = other.sections[0].heading = 'Clouds and weather'
    server.other = { deck: second, version: 1, content: other, gets: 0, patches: [], drawAsked: false }
  }
  const questionSlides = (c) => Math.ceil(c.questions.length / 5)
  const pictured = (row) => !!server.render?.photos?.[row.id]?.asset_id && PHOTO_LAYOUTS.includes(row.layout)
  server.framesAt = (index, c = server.content) =>
    index < c.sections.length ? framesOf(c.sections[index], pictured(c.sections[index])) : QUESTION_FRAMES
  /** A version's slides as a done render lists them, keyed by what is drawn (never the notes). */
  server.slidesAt = (v) => {
    const c = server.history.get(v)
    if (!c) return null
    const pages = questionSlides(c)
    const total = c.sections.length + pages
    const rows = c.sections.map((row, index) => {
      const { id, notes, ...drawn } = row
      const fit = fitOf(row, index, { unfit, room: lineRoom })
      const words =
        ITEM_LAYOUTS.includes(row.layout) && filledItems(row).length
          ? filledItems(row).map((entry) => [entry.label, entry.text, entry.value].filter(Boolean))
          : [bodyLines(row)]
      return {
        index,
        kind: 'section',
        drawn,
        fits: fit.fits,
        fit,
        frames: framesOf(row, pictured(row)),
        words: { heading: row.heading, bodies: words },
      }
    })
    for (let page = 0; page < pages; page += 1) {
      const chunk = c.questions.slice(page * 5, page * 5 + 5)
      rows.push({
        index: c.sections.length + page,
        kind: 'questions',
        drawn: { questions: chunk },
        fits: true,
        frames: QUESTION_FRAMES,
        words: {
          heading: 'Questions',
          bodies: [chunk.map((question, n) => `${page * 5 + n + 1}. ${question.stem}`)],
        },
      })
    }
    return rows.map((row) => {
      const key = sha256(JSON.stringify([row.index, total, row.drawn]))
      const lettersOver = row.fits
        ? 0
        : Math.max(
            1,
            [...bodyLines(row.drawn), ...filledItems(row.drawn).map((entry) => entry.text)]
              .slice(row.fit.lines_max)
              .join('')
              .replace(/\s/g, '').length,
          )
      return { ...row, key, letters_over: lettersOver }
    })
  }
  /** draft_data of this deck, or of the second one (`server.other`), which is never drawn. */
  const draftBody = (store = server) => {
    const main = store === server
    const c = store.content
    const language = main ? deck : store.deck
    return {
      id: main ? DRAFT : OTHER_DRAFT,
      feature_id: 'ai.pptx',
      version: store.version,
      provider_mode: 'openai',
      expires_at: server.expiresAt,
      title: c.title,
      prompt: 'Water cycle, 7 slides',
      source_text: '',
      source_ids: [],
      excerpts: [],
      output_locale: language,
      locale_source: 'settings',
      output_format: 'pptx',
      options: {
        question_count: 6,
        length: c.sections.length + questionSlides(c),
        requested_pages: 7,
        question_slides: questionSlides(c),
        uz_script: 'latn',
        image_cap: 6,
        photo_style: 'photo',
        template_style: { accent: '#255e49', deck_design: 'aurora' },
        title_lines: TITLE_LINES[language],
      },
      content: c,
      ...(main && revisionSelected
        ? {
            revision: {
              request: 'Make the second slide shorter',
              source_draft_id: SOURCE_DRAFT,
              original_prompt: 'Water cycle, 7 slides',
              root_draft_id: SOURCE_DRAFT,
              selected_section_ids: ['s2'],
              base_version: 2,
              base_locale: deck,
            },
          }
        : {}),
      ...(main && server.render ? { render: server.render } : {}),
      ...(main
        ? {}
        : {
            render: {
              design: 'aurora',
              deck_seed: 'aurora|clouds and weather',
              body_size: 18,
              variants: {},
              photos: {},
            },
          }),
      outline: c.sections.map((row) => ({ id: row.id, title: row.heading, body: row.body })),
    }
  }
  const usage = () => ({
    ai_documents: { limit: 5, used: 0, remaining: 5 },
    file_jobs: { limit: 15, used: 4, remaining: 11 },
    edits_per_file: 3,
    resets_at: '2026-11-15T19:00:00Z',
  })
  const artifactRow = (id, fileId, name, mime, size) => ({
    id,
    name,
    size_bytes: size,
    page_count: mime === 'application/pdf' ? 9 : null,
    mime_type: mime,
    state: 'ready',
    expires_at: server.expiresAt,
    page_sizes: [],
    form_fields: [],
    image_counts: [],
    encrypted: false,
    password_secret_id: null,
    preview_url: mime === 'application/pdf' ? `/api/v1/artifacts/${id}/preview` : null,
    file_id: fileId,
    role: 'user_document',
    download_url: `/api/v1/artifacts/${id}/download`,
  })
  const errorBody = (code, params = {}, retryable = false) => ({
    code,
    message_key: `errors.${code}`,
    message: MESSAGES[code] || `Fixture ${code}`,
    message_params: params,
    request_id: 'fixture',
    field_errors: {},
    retryable,
  })
  /** A send's job as GET /jobs/{id} answers it: waiting for its turn, then running, then as it ends. */
  const jobBody = (job) => {
    const waits = typeof queued === 'function' ? queued(server.jobs.indexOf(job) + 1) : queued
    const status =
      job.polls < waits
        ? 'queued'
        : job.polls < waits + 1
          ? 'running'
          : Array.isArray(jobOutcome)
            ? 'failed'
            : jobOutcome
    const made = status === 'succeeded'
    return {
      id: job.id,
      feature_id: 'export.generated_pptx',
      status,
      created_at: job.created,
      started_at: status === 'queued' ? null : job.created,
      completed_at: ['succeeded', 'failed'].includes(status) ? new Date().toISOString() : null,
      input_files: [],
      artifacts: made
        ? [
            artifactRow(
              PPTX_ARTIFACT,
              '00000000-0000-4000-8000-0000000000e6',
              'Water_cycle_in_nature.pptx',
              PPTX,
              2_100_000,
            ),
            ...(job.format === 'both'
              ? [
                  artifactRow(
                    PDF_ARTIFACT,
                    '00000000-0000-4000-8000-0000000000e7',
                    'Water_cycle_in_nature.pdf',
                    'application/pdf',
                    1_900_000,
                  ),
                ]
              : []),
          ]
        : [],
      error: status === 'failed' ? errorBody(jobOutcome[0], jobOutcome[1] ?? {}) : null,
      warnings: [],
      parameters: {
        generation_draft_id: DRAFT,
        version: job.version,
        snapshot: job.snapshot,
        format: job.format,
        deliver: job.deliver,
      },
      origin_channel: job.toChat ? 'mini_app' : 'web',
    }
  }
  const refusalFor = (n, body) =>
    typeof refuseSaves === 'function' ? refuseSaves(n, body, server) : refuseSaves
  const failsFor = (v, n) => {
    if (!renderFails) return null
    if (typeof renderFails === 'function') return renderFails({ version: v, n })
    if (Array.isArray(renderFails)) return renderFails[n - 1] ?? null
    return renderFails
  }
  const planFor = (v) => (typeof renderPlan === 'function' ? renderPlan(v) : renderPlan)
  /** What GET /render?version=V says now: render_state's status, nothing drawn until a POST asked. */
  const renderAnswer = (v) => {
    if (!server.history.has(v)) return { status: 'stale' }
    const state = server.renderStates.get(v)
    if (!state?.posted) return { status: v === server.version ? 'none' : 'stale' }
    const failed = failsFor(v, state.posted)
    if (failed) return { status: 'failed', error: failed }
    const plan = planFor(v)
    const start = Math.max(
      0,
      plan.findIndex((answer) => answer !== 'none'),
    )
    state.polls += 1
    return { status: plan[Math.min(start + state.polls - 1, plan.length - 1)] }
  }
  const wantsEditor = () => editor?.deck_editor === true

  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin === origin || url.protocol === 'data:' || url.protocol === 'blob:') return route.continue()
    if (url.hostname === 'telegram.org')
      return route.fulfill({ contentType: 'application/javascript', body: '' })
    return route.abort('blockedbyclient')
  })
  await context.route(`${origin}/api/v1/**`, async (route) => {
    // Playwright still routes requests to these fixtures with the context offline: the fixtures go offline too.
    if (server.offline) return route.abort('internetdisconnected')
    const request = route.request()
    const url = new URL(request.url())
    const endpoint = url.pathname.replace('/api/v1', '')
    const method = request.method()
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    const refuse = (code, status, params = {}, retryable = false) =>
      json({ error: errorBody(code, params, retryable) }, status)
    let body = null
    try {
      body = request.postData() ? JSON.parse(request.postData()) : null
    } catch {}
    server.requests.push({
      endpoint,
      method,
      query: Object.fromEntries(url.searchParams),
      body,
      at: Date.now(),
    })

    const person =
      server.account === 'u2'
        ? { id: 'u2', email: 'second@example.test', display_name: 'Second fixture', plan: 'free', locale }
        : { id: 'u1', email: 'fixture@example.test', display_name: 'Fixture', plan: 'free', locale }
    if (endpoint === '/auth/session') {
      if (method === 'DELETE') {
        server.account = null
        return json({ ok: true })
      }
      return json({
        user: server.account ? person : null,
        csrf_token: 'x',
        development_login_enabled: accounts,
      })
    }
    if (endpoint === '/auth/providers') return json({ providers: [] })
    // The second account, in the same tab: its own deck at this address, with an empty cover, and no lines kept.
    if (endpoint === '/auth/dev-login' && method === 'POST' && accounts) {
      server.account = 'u2'
      server.remembered = []
      server.rememberedLocale = null
      server.rememberedRoles = []
      server.content = deckContent(deck, { coverBody: '' })
      server.version += 1
      server.history.set(server.version, clone(server.content))
      return json({ user: { ...person, id: 'u2', email: 'second@example.test' } })
    }
    if (endpoint === '/me') {
      const { email, ...profile } = person
      return json(profile)
    }
    if (endpoint === '/catalog') return json({ features: [], draft: true })
    if (endpoint === '/plans') return json({ plans: [{ id: 'free', name: 'free', limits: {} }], draft: true })
    if (endpoint === '/usage')
      return json({
        plan: 'free',
        week: {
          starts_at: '2026-11-08T19:00:00Z',
          resets_at: '2026-11-15T19:00:00Z',
          time_zone: 'Asia/Tashkent',
        },
        ...usage(),
      })
    if (endpoint === '/studio/config')
      return json({
        features: [{ id: 'ai.pptx', name: 'Slides', surface: 'generate', eligible: true, max_pages: 15 }],
        provider: { mode: 'openai', configured: true },
        limits: { slides, ...(editor ? { editor } : {}) },
      })
    if (endpoint === '/studio/deck-designs')
      return json({
        default_pages: 10,
        categories: [
          {
            id: 'classic',
            name: 'Classic',
            designs: [
              {
                id: 'aurora',
                name: 'Aurora',
                theme: 'light',
                photo: true,
                pattern: '',
                composition: 'classic',
                preview: '/api/v1/studio/deck-designs/aurora.png?locale=en&v=fixture',
                heading_font: 'Calibri',
                body_font: 'Calibri',
                colours: {
                  accent: '#255E49',
                  surface: '#F8F9FA',
                  cover_fill: '#255E49',
                  cover_ink: '#FFFFFF',
                  heading: '#1F2328',
                  ink: '#1F2328',
                  muted: '#5B6779',
                  accent_soft: '#DDE7F3',
                  card: '#EEF1F4',
                },
              },
            ],
          },
        ],
      })
    if (/^\/studio\/deck-designs\/[\w-]+\.png$/.test(endpoint))
      return route.fulfill({ status: 200, contentType: 'image/png', body: canvas(32, 18, ACCENT).png() })
    if (endpoint === '/jobs' && method === 'GET') return json({ results: [], count: 0 })
    if (endpoint === '/generation/drafts' && method === 'GET') return json({ results: [] })

    if (endpoint === '/jobs' && method === 'POST') {
      const key = request.headers()['idempotency-key']
      server.jobPosts.push({ key, body })
      if (!body || Object.keys(body).some((name) => !['quote_id', 'deliver_to_chat'].includes(name)))
        server.unexpected.push(`POST /jobs body ${JSON.stringify(body)}`)
      if (!key || key.length < 8 || key.length > 128)
        server.unexpected.push('POST /jobs without an Idempotency-Key')
      const answer = jobAnswer?.(server.jobPosts.length, body) ?? 'ok'
      if (answer === 'drop') return route.abort('connectionreset')
      if (answer === 'slow') await sleep(1500)
      if (Array.isArray(answer)) return refuse(answer[0], answer[1], answer[2] ?? {})
      const known = server.jobs.find((job) => job.key === key)
      if (known) return json(jobBody(known), 200)
      const quote = server.quotes.find((entry) => entry.id && entry.id === body.quote_id)
      if (!quote) return refuse('not_found', 404)
      const job = {
        id: `00000000-0000-4000-8000-0000000000c${server.jobs.length + 1}`,
        key,
        quote: body.quote_id,
        toChat: body.deliver_to_chat === true,
        version: quote.body.version,
        format: quote.body.format,
        deliver: quote.body.deliver,
        snapshot: sha256(JSON.stringify(server.content)),
        created: new Date().toISOString(),
        polls: 0,
      }
      server.jobs.push(job)
      return json(jobBody(job), 201)
    }
    if (/^\/jobs\/[^/]+$/.test(endpoint) && method === 'GET') {
      const id = endpoint.split('/')[2]
      const preset = presetJobs.find((entry) => entry.id === id)
      if (preset) return json(preset)
      const job = server.jobs.find((entry) => entry.id === id)
      if (!job) return refuse('not_found', 404)
      job.polls += 1
      return json(jobBody(job))
    }

    if (endpoint === '/studio/latin' && method === 'POST') {
      if (!wantsEditor()) return refuse('feature_unavailable', 409)
      server.latin.push(body)
      const texts = body?.texts
      if (
        !Array.isArray(texts) ||
        !texts.length ||
        texts.length > 40 ||
        texts.some((text) => typeof text !== 'string')
      ) {
        server.unexpected.push(`POST /studio/latin ${JSON.stringify(body)}`)
        return refuse('invalid_parameters', 400)
      }
      if (latinDelay) await sleep(latinDelay)
      const table = {
        'Ҳаво ифлосланиши': 'Havo ifloslanishi',
        Ўқувчилар: 'O‘quvchilar',
        Тошкент: 'Toshkent',
        'Тошкент шаҳри тарихи': 'Toshkent shahri tarixi',
        ТАТУ: 'TATU',
      }
      const out = texts.map((text) => table[text] ?? text)
      return json({ texts: out, changed: out.some((text, index) => text !== texts[index]) })
    }
    // Kept packed together with the language of the deck they were written for and the Cover sheet row of each:
    // {lines, locale, roles}, locale null unsaid, one role per line (null unsaid). Forget answers as none kept.
    if (endpoint === '/studio/cover-lines') {
      if (!wantsEditor()) return refuse('feature_unavailable', 409)
      const call = { method, body, account: server.account, at: Date.now() }
      server.coverLines.push(call)
      // A write refused, once: nothing changes, and the refusal comes that many ms later.
      const refused = server.refuseCoverLines?.[method]
      if (refused !== undefined) {
        delete server.refuseCoverLines[method]
        await sleep(refused)
        call.answered = Date.now()
        return refuse('unavailable', 503)
      }
      // A slow downlink, once: the write is taken at once and answered that many ms late.
      const late = server.lateCoverLines?.[method]
      if (late) delete server.lateCoverLines[method]
      if (method === 'POST') {
        const lines = body?.lines
        const roles = body?.roles ?? null
        if (
          !Array.isArray(lines) ||
          !lines.length ||
          lines.length > 8 ||
          lines.some((line) => typeof line !== 'string' || !line.trim() || line.length > 160) ||
          Object.keys(body).some((key) => !['lines', 'locale', 'roles'].includes(key)) ||
          (body.locale !== undefined && !['ru', 'uz', 'en'].includes(body.locale)) ||
          (roles !== null &&
            (!Array.isArray(roles) ||
              roles.length !== lines.length ||
              roles.some((role) => role !== null && !['made', 'checked', 'group', 'school'].includes(role))))
        ) {
          server.unexpected.push(`POST /studio/cover-lines ${JSON.stringify(body)}`)
          return refuse('invalid_parameters', 400)
        }
        server.remembered = lines.map((line) => line.trim())
        server.rememberedLocale = body.locale ?? null
        server.rememberedRoles = roles ? [...roles] : lines.map(() => null)
      }
      if (method === 'DELETE') {
        server.remembered = []
        server.rememberedLocale = null
        server.rememberedRoles = []
      }
      const answer = {
        lines: [...server.remembered],
        locale: server.remembered.length ? server.rememberedLocale : null,
        roles: server.remembered.map((_, index) => server.rememberedRoles[index] ?? null),
      }
      if (late) await sleep(late)
      call.answered = Date.now()
      return json(answer)
    }

    // The account's other deck: saved and measured as this one is, and never drawn (its preview is unavailable).
    if (server.other && endpoint.startsWith(`/generation/drafts/${OTHER_DRAFT}`)) {
      const other = server.other
      const rest = endpoint.slice(`/generation/drafts/${OTHER_DRAFT}`.length)
      if (rest === '' && method === 'GET') {
        other.gets += 1
        return json(draftBody(other))
      }
      if (rest === '' && method === 'PATCH') {
        const attempt = { body, status: 409, at: Date.now() }
        other.patches.push(attempt)
        if (otherSaveDelay) {
          attempt.status = 'slow'
          await sleep(otherSaveDelay)
          attempt.status = 409
        }
        if (body?.version !== other.version) return refuse('version_conflict', 409)
        other.version += 1
        other.content = clone(body.content)
        attempt.status = 200
        return json(draftBody(other))
      }
      if (rest === '/render' && method === 'POST') {
        other.drawAsked = true
        return json({ task_id: '00000000-0000-4000-8000-00000000b900', status: 'queued' }, 202)
      }
      if (rest === '/render')
        return json({
          status: other.drawAsked ? 'failed' : 'none',
          version: Number(url.searchParams.get('version')) || other.version,
          slides: [],
          error: other.drawAsked ? 'engine_unavailable' : null,
        })
      if (rest === '/fit' && method === 'POST' && body?.section) {
        const index = other.content.sections.findIndex((entry) => entry.id === body.section.id)
        const full = { ...section('', 'bullets', ''), ...body.section }
        return json(fitOf(full, index >= 0 ? index : other.content.sections.length))
      }
    }

    if (endpoint.startsWith(`/generation/drafts/${DRAFT}`)) {
      if (server.gone) return refuse('not_found', 404)
      const rest = endpoint.slice(`/generation/drafts/${DRAFT}`.length)
      if (rest === '' && method === 'GET') {
        server.draftGets += 1
        if (draftDelay) await sleep(draftDelay)
        if (server.draftGets <= openFails) return refuse('upstream_unavailable', 500, {}, true)
        return json(draftBody())
      }
      if (rest === '' && method === 'PATCH') {
        const attempt = { body, status: null, at: Date.now() }
        server.patches.push(attempt)
        const refusal = refusalFor(server.patches.length, body)
        if (Array.isArray(refusal)) {
          attempt.status = refusal[0]
          return refuse(refusal[1] ?? 'upstream_unavailable', refusal[0])
        }
        if (refusal === 'hang') {
          attempt.status = 'hang'
          return new Promise(() => {})
        }
        // A slow uplink: the write reaches the server, and is taken, only this late.
        if (refusal?.delay) {
          attempt.status = 'slow'
          await sleep(refusal.delay)
        }
        if (body?.version !== server.version) {
          attempt.status = 409
          return refuse('version_conflict', 409)
        }
        const problems = []
        if (JSON.stringify(Object.keys(body).sort()) !== '["content","version"]')
          problems.push(`keys ${Object.keys(body).sort().join(',')}`)
        const c = body.content
        if (!c || !Array.isArray(c.sections) || !Array.isArray(c.questions)) problems.push('content shape')
        else {
          const ids = c.sections.map((row) => row.id)
          if (new Set(ids).size !== ids.length) problems.push(`ids repeat: ${ids.join(',')}`)
          if (ids[0] !== 's1') problems.push(`the cover moved: ${ids.join(',')}`)
          for (const row of c.sections) {
            const keys = Object.keys(row).sort().join(',')
            if (keys !== SECTION_KEYS.join(',')) problems.push(`${row.id} keys ${keys}`)
            if ((row.items || []).length > 8) problems.push(`${row.id} has ${row.items.length} items`)
            if ((row.body || '').length > 3400) problems.push(`${row.id} body ${row.body.length}`)
            if (/^q\d+$/.test(row.id)) problems.push(`a section named ${row.id}`)
          }
        }
        if (problems.length) {
          server.unexpected.push(`PATCH: ${problems.join('; ')}`)
          attempt.status = 400
          return refuse('invalid_parameters', 400)
        }
        server.version += 1
        server.content = clone(c)
        server.history.set(server.version, clone(c))
        if (refusal === 'drop') {
          attempt.status = 'dropped'
          return route.abort('connectionreset')
        }
        attempt.status = 200
        return json(draftBody())
      }
      if (rest === '/render') {
        if (!wantsEditor()) return refuse('feature_unavailable', 409)
        if (!server.render) return refuse('deck_not_editable', 409)
        if (method === 'POST') {
          const v = body?.version
          const post = { version: v, answer: null }
          server.renderPosts.push(post)
          if (laneBusy) {
            post.answer = 429
            return refuse('lane_busy', 429, {}, true)
          }
          if (renderConflictOnce && server.renderPosts.length === 1) {
            post.answer = 409
            return refuse('version_conflict', 409)
          }
          if (typeof v !== 'number' || v !== server.version) {
            post.answer = 409
            return refuse('version_conflict', 409)
          }
          const state = server.renderStates.get(v) ?? { posted: 0, polls: 0 }
          const done =
            state.posted &&
            !failsFor(v, state.posted) &&
            planFor(v)[Math.min(state.polls, planFor(v).length - 1)] === 'done'
          if (!done) {
            state.posted += 1
            state.polls = 0
          }
          server.renderStates.set(v, state)
          post.answer = 202
          return json(
            {
              task_id: `00000000-0000-4000-8000-00000000b${String(server.renderPosts.length).padStart(3, '0')}`,
              status: done ? 'done' : 'queued',
            },
            202,
          )
        }
        const v = url.searchParams.has('version') ? Number(url.searchParams.get('version')) : server.version
        const answer = renderAnswer(v)
        server.renders.push({ version: v, answer: answer.status })
        let slides = []
        if (answer.status === 'done') {
          const base = `/api/v1/generation/drafts/${DRAFT}/slides/`
          slides = server.slidesAt(v).map((row) => {
            server.keys.set(row.key, row)
            return {
              index: row.index,
              key: row.key,
              frames: row.frames,
              fits: row.fits,
              letters_over: row.letters_over,
              url: `${base}${row.key}.png`,
              thumb_url: `${base}${row.key}.thumb.png`,
            }
          })
        }
        return json({
          status: answer.status,
          version: v,
          slides,
          error: answer.status === 'failed' ? answer.error : null,
        })
      }
      const picture = /^\/slides\/([0-9a-f]+)(\.thumb)?\.png$/.exec(rest)
      if (picture && method === 'GET') {
        if (!wantsEditor()) return refuse('feature_unavailable', 409)
        // The connection dropped for a moment: the fetch and the <img> both fail.
        if (server.picturesDown) return route.abort('internetdisconnected')
        const [, key, thumb] = picture
        const entry = server.keys.get(key)
        if (!entry) {
          server.unexpected.push(`a picture never listed: ${key.slice(0, 12)}`)
          return refuse('not_found', 404)
        }
        const counts = thumb ? server.thumbGets : server.pictureGets
        counts[key] = (counts[key] ?? 0) + 1
        const cached = `${key}${thumb ? '.thumb' : ''}`
        if (!server.pictures.has(cached)) server.pictures.set(cached, drawSlide(entry, !!thumb))
        // As the platform serves them: never kept by the browser, so the app keeps them itself.
        return route.fulfill({
          status: 200,
          headers: { 'content-type': 'image/png', 'cache-control': 'private, no-store' },
          body: server.pictures.get(cached),
        })
      }
      if (rest === '/fit' && method === 'POST') {
        if (!wantsEditor()) return refuse('feature_unavailable', 409)
        if (!server.render) return refuse('deck_not_editable', 409)
        const row = body?.section
        if (!row || typeof row !== 'object') {
          server.unexpected.push(`POST /fit ${JSON.stringify(body)}`)
          return refuse('invalid_parameters', 400)
        }
        const index = server.content.sections.findIndex((entry) => entry.id === row.id)
        const call = { section: row, known: index >= 0, at: Date.now() }
        server.fits.push(call)
        server.fitNow += 1
        server.fitMost = Math.max(server.fitMost, server.fitNow)
        await sleep(fitDelay)
        server.fitNow -= 1
        const timedOut = server.fitTimeoutNext
        server.fitTimeoutNext = false
        const full = { ...section('', 'bullets', ''), ...row, id: String(row.id || 'new-slide').slice(0, 40) }
        return json(
          fitOf(full, index >= 0 ? index : server.content.sections.length, {
            unfit,
            timedOut,
            room: lineRoom,
          }),
        )
      }
      if (rest === '/export-quote' && method === 'POST') {
        if (!wantsEditor()) return refuse('feature_unavailable', 409)
        const record = { id: null, body, at: Date.now() }
        server.quotes.push(record)
        if (quoteDelay) await sleep(quoteDelay)
        if (JSON.stringify(Object.keys(body ?? {}).sort()) !== '["deliver","format","version"]')
          server.unexpected.push(
            `export-quote keys ${Object.keys(body ?? {})
              .sort()
              .join(',')}`,
          )
        if (!['pptx', 'pdf', 'both'].includes(body?.format) || !['chat', 'download'].includes(body?.deliver))
          return refuse('invalid_parameters', 400)
        if (body.version !== server.version) return refuse('version_conflict', 409)
        if (server.jobs.some((job) => jobBody(job).status === 'queued'))
          return refuse('generation_running', 409)
        const refusal = quoteRefusal?.(server.quotes.length, body)
        if (refusal) return refuse(refusal[0], refusal[1], refusal[2] ?? {})
        if (!server.render) return refuse('deck_not_editable', 409)
        if (server.engineDown && body.format !== 'pptx') return refuse('engine_unavailable', 409)
        const sections = server.content.sections
        const s5 = sections.findIndex((row) => row.id === 's5')
        if (pictureGone && s5 >= 0 && PHOTO_LAYOUTS.includes(sections[s5].layout))
          return refuse('pinned_asset_expired', 409, { sections: [{ id: 's5', index: s5 }] })
        const over = sections
          .map((row, index) => fitOf(row, index, { unfit, room: lineRoom }))
          .filter((fit) => !fit.fits)
          .map((fit) => ({ id: fit.id, index: fit.index, words_over: fit.words_over }))
        if (over.length) return refuse('slide_text_too_long', 409, { sections: over })
        const made = server.quotes.filter((entry) => entry.id).length
        record.id = `00000000-0000-4000-8000-0000000000${(0xa0 + made).toString(16)}`
        const shown = sections.filter(pictured).map((row) => server.render.photos[row.id].asset_id)
        const parameters = {
          generation_draft_id: DRAFT,
          version: server.version,
          snapshot: sha256(JSON.stringify(server.content)),
          format: body.format,
          deliver: body.deliver,
        }
        return json(
          {
            id: record.id,
            quote_id: record.id,
            quote_version: '1',
            feature_id: 'export.generated_pptx',
            plan_version_id: 'fixture-policy',
            tariff_version_id: 'deck-render-v1',
            input_fingerprints: shown.map((id) => ({ id, sha256: sha256(id) })),
            normalized_parameters: parameters,
            affordable: true,
            usage: usage(),
            expires_at: new Date(Date.now() + quoteTtl).toISOString(),
            output_expectations: { retention_hours: 24 },
            limitations: ['development_beta'],
            plan: 'free',
            summary: {
              slides: sections.length + questionSlides(server.content),
              format: body.format,
              kept_until: new Date(Date.now() + 86400000).toISOString(),
              size_estimate: 2_400_000,
              cost: typeof cost === 'function' ? cost(made + 1) : cost,
              warnings: [],
            },
          },
          201,
        )
      }
    }
    server.unexpected.push(`${method} ${endpoint}`)
    return json({ error: { code: 'unexpected_fixture_request' } }, 404)
  })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  if (clock) await page.clock.install()
  const opened = { context, page, server, errors, locale, width, height, theme, inside, deck }
  live.add(opened)
  return opened
}

/** Page errors and requests the fixtures do not know end a context's run; the end check counts them. */
async function finish(opened, { lenient = false } = {}) {
  live.delete(opened)
  try {
    assert.deepEqual(opened.errors, [], `${label(opened)}: page errors`)
    if (!lenient)
      assert.deepEqual(
        opened.server.unexpected,
        [],
        `${label(opened)}: requests with no fixture or the wrong shape`,
      )
    checkedContexts += 1
  } catch (error) {
    contextFailures.push(error.message)
    throw error
  } finally {
    await opened.context.close().catch(() => {})
  }
}

/** One group of checks, one passed(…); a failure is reported and the next group still runs. */
async function group(name, run, { labels = [] } = {}) {
  const named = name.toLowerCase().includes(ONLY)
  if (ONLY && !named && !labels.some((tag) => tag.includes(ONLY))) return
  const wanted = (tag) => !ONLY || named || tag.includes(ONLY)
  try {
    passed((await run(wanted)) || name)
  } catch (error) {
    failures.push([name, error])
    console.error(`FAILED: ${name}\n${error.stack}`)
  } finally {
    for (const opened of live) await opened.context.close().catch(() => {})
    live.clear()
  }
}

/* ------------------------------------------------------------------ helpers */

const label = (o) => `${o.width}-${o.locale}-${o.theme}-${o.inside ? 'telegram' : 'browser'}`
const shot = (o, state) =>
  o.page.screenshot({ path: path.join(output, `${label(o)}-${state}.png`), fullPage: false })
async function until(check, what, timeout = 10000) {
  const end = Date.now() + timeout
  for (;;) {
    const value = await check()
    if (value) return value
    if (Date.now() > end) throw new assert.AssertionError({ message: `Waited ${timeout} ms for ${what}` })
    await sleep(50)
  }
}
const mark = (server) => server.patches.length
/** The first PATCH from `from` on that the server took and whose content passes `test`. */
const savedPatch = (server, test, from = 0, what = 'a save', timeout = 12000) =>
  until(
    () => server.patches.slice(from).find((attempt) => attempt.status === 200 && test(attempt.body.content)),
    what,
    timeout,
  ).then((attempt) => attempt.body)
const okPatches = (server) => server.patches.filter((attempt) => attempt.status === 200).length
const order = (c) => c.sections.map((row) => row.id).join(',')

async function goToDeck(o, { image = true, to = `/app/editor/deck/${DRAFT}` } = {}) {
  await o.page.goto(`${origin}/${o.locale}${to}`, { waitUntil: 'domcontentloaded' })
  await o.page.getByTestId('deck-editor').waitFor()
  if (image) await o.page.getByTestId('deck-slide-image').waitFor()
}
const slideBox = (page) => page.getByTestId('deck-slide').boundingBox()
const currentSlide = (page) =>
  page.evaluate(() => {
    const thumb = [...document.querySelectorAll('[data-testid^="deck-thumb-"]')].find(
      (node) => node.getAttribute('aria-current') && node.getAttribute('aria-current') !== 'false',
    )
    return thumb ? Number(thumb.dataset.testid.slice('deck-thumb-'.length)) : null
  })
/** Slide `n` (1-based) from its thumbnail, drawn unless asked not to wait for that. */
async function goTo(page, n, { drawn = true } = {}) {
  if ((await currentSlide(page)) !== n) {
    await page.getByTestId(`deck-thumb-${n}`).click()
    await until(async () => (await currentSlide(page)) === n, `slide ${n}`)
  }
  if (drawn) await page.locator('[data-testid="deck-slide"]:not([data-state="blank"])').waitFor()
}
const frameOf = (o, n, field) => o.server.framesAt(n - 1).find((box) => box.field === field)
/** A tap in the middle of a field's frame on slide `n`, which must be the one on screen. */
async function tapField(o, n, field) {
  const box = frameOf(o, n, field)
  assert.ok(box, `slide ${n} has a ${field}`)
  // At larger text the stage scrolls, and a click on a thumb below can have taken the slide out of sight.
  await o.page.getByTestId('deck-slide').scrollIntoViewIfNeeded()
  const slide = await slideBox(o.page)
  await o.page.mouse.click(
    slide.x + (box.x + box.w / 2) * slide.width,
    slide.y + (box.y + box.h / 2) * slide.height,
  )
}
async function swipe(page, way) {
  const box = await slideBox(page)
  const y = box.y + box.height / 2
  const from = box.x + box.width * (way === 'next' ? 0.75 : 0.25)
  const to = from + (way === 'next' ? -1 : 1) * Math.min(160, box.width * 0.45)
  await page.mouse.move(from, y)
  await page.mouse.down()
  await page.mouse.move(to, y, { steps: 6 })
  await page.mouse.up()
}
const headingDock = (page) => page.locator('[data-testid="deck-dock"][data-field="heading"]')
const linesDock = (page) => page.locator('[data-testid="deck-dock"][data-field="lines"]')
async function openHeading(o, n) {
  await goTo(o.page, n)
  await tapField(o, n, 'heading')
  await headingDock(o.page).waitFor()
}
async function openLines(o, n) {
  await goTo(o.page, n)
  await tapField(o, n, 'body')
  await linesDock(o.page).waitFor()
}
/** Lines added in the open lines dock until it holds `total`: "Fixture line four" and on. */
async function addLines(page, total) {
  const have = await page
    .locator('[data-testid^="deck-line-"]')
    .evaluateAll((nodes) => nodes.filter((node) => /^deck-line-\d+$/.test(node.dataset.testid)).length)
  for (let index = have; index < total; index += 1) {
    await page.getByTestId('deck-add-line').click()
    await page.getByTestId(`deck-line-${index}`).fill(`Fixture line ${NUMBER_WORDS[index]}`)
  }
}
const budgetSays = (page, text) =>
  until(
    () =>
      page.evaluate((text) => {
        const budget = document.querySelector('[data-testid="deck-dock-budget"]')
        return budget?.dataset.level === 'over' && budget.textContent.includes(text)
      }, text),
    `the budget to say ${text}`,
    9000,
  )
const layoutChoices = (page) =>
  page
    .getByTestId('deck-layout-sheet')
    .locator('[data-testid^="deck-layout-"]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.dataset.testid.slice('deck-layout-'.length))
        .filter((id) => !['retry', 'split'].includes(id)),
    )
async function closeSheet(page, testid) {
  await page.getByTestId(testid).getByTestId('editor-sheet-close').click()
  await page.getByTestId(testid).waitFor({ state: 'hidden' })
}
async function selectRow(page, n) {
  const row = page.getByTestId(`deck-row-${n}`)
  if ((await row.getAttribute('aria-pressed')) !== 'true') await row.click()
  await until(async () => (await row.getAttribute('aria-pressed')) === 'true', `row ${n} chosen`)
}
const pressedRows = (page) => page.locator('.deck-edit-list-row[aria-pressed="true"]').count()
const saved = (page) =>
  page.waitForFunction(() =>
    ['saved', 'clean'].includes(document.querySelector('[data-testid="editor-save-icon"]')?.dataset.state),
  )
const keyboardBand = (page) =>
  page.evaluate(
    () =>
      innerHeight -
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--editor-keyboard') || '0'),
  )
const setHidden = (page, hidden) =>
  page.evaluate((hidden) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
const isBare = (page) =>
  page.evaluate(
    () =>
      document.querySelector('[data-testid="deck-editor"]')?.classList.contains('bare') === true &&
      [...document.querySelectorAll('.mobile-nav, .app-topbar, .sidebar')].every(
        (node) => !node.checkVisibility(),
      ),
  )
const spy = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__tg.log)))
const spied = async (page, name) => (await spy(page)).filter((call) => call[0] === name)
const mainButton = (page) =>
  page.evaluate(() => {
    const { isVisible, text, isActive } = window.__tg.app.MainButton
    return { isVisible, text, isActive, handlers: window.__tg.app.MainButton.handlers() }
  })
const backButton = (page) =>
  page.evaluate(() => ({
    isVisible: window.__tg.app.BackButton.isVisible,
    handlers: window.__tg.app.BackButton.handlers(),
  }))
const pressBack = (page) => page.evaluate(() => window.__tg.app.BackButton.press())
const pressMain = (page) => page.evaluate(() => window.__tg.app.MainButton.press())
const closedApp = (page, timeout = 15000) =>
  page.waitForFunction(() => window.__tg.log.some((call) => call[0] === 'close'), null, { timeout })
const closes = async (page) => (await spied(page, 'close')).length
/** The send's button: Telegram's MainButton, or the one the frame draws in a browser. */
const send = (o) => (o.inside ? pressMain(o.page) : o.page.getByTestId('editor-primary').click())
async function reviewReady(page) {
  await page.getByTestId('deck-review-sheet').waitFor()
  await page.locator('[data-testid="deck-review-body"][data-stage="ready"]').waitFor()
  await page.getByTestId('editor-review-cost').waitFor()
}
const stageOf = (page) => page.getByTestId('deck-review-body').getAttribute('data-stage')
/** Chromium has no Uzbek months and writes "2026 M11 7"; nothing on screen may read that way. */
const noPlaceholderMonth = async (page, what) => {
  const text = await page.evaluate(() => document.body.innerText)
  assert.doesNotMatch(text, /\bM\d{1,2}\b/, `${what}: a month with no name`)
}
const noSidewaysScroll = async (page, what) => {
  const { scrollWidth, width } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }))
  assert.ok(scrollWidth <= width, `${what}: the page scrolls sideways (${scrollWidth} over ${width})`)
}
/** Every control a thumb can reach. The slide's regions are not: a tap is hit-tested on the slide (group 3). */
const smallTargets = (page, frame = '[data-testid="deck-editor"]') =>
  page.evaluate((frame) => {
    const seen = []
    const visible = (node) => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden'
    }
    const open = document.querySelector('dialog.editor-sheet:modal')
    const root = open ?? document.querySelector(frame)
    if (!root) return [`no ${frame}`]
    for (const node of root.querySelectorAll('button, a[href], select, summary, input:not([type=file])')) {
      if (!visible(node) || node.closest('.deck-edit-region, .deck-edit-regions')) continue
      if (node.matches('input[type=checkbox], input[type=color]')) continue
      if (node.closest('.visually-hidden')) continue
      const box = node.getBoundingClientRect()
      if (box.height < 43.5 || box.width < 43.5)
        seen.push(
          `${node.tagName} ${node.getAttribute('data-testid') || node.textContent.trim().slice(0, 24) || node.getAttribute('aria-label')}: ${Math.round(box.width)}x${Math.round(box.height)}`,
        )
    }
    return seen
  }, frame)
const axe = async (page, what) => {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const found = result.violations.map((entry) => `${entry.id}: ${entry.nodes[0]?.target}`)
  assert.deepEqual(found, [], `${what}: axe`)
}
/** What Android's text size does: every line grows and the boxes are left to cope. */
const scaleText = (page, factor = 1.3) =>
  page.evaluate((scale) => {
    // Read first: a parent's new size would count again in the child that inherits it.
    const nodes = [...document.querySelectorAll('body *')]
    const sizes = nodes.map((node) => parseFloat(getComputedStyle(node).fontSize))
    nodes.forEach((node, index) => (node.style.fontSize = `${sizes[index] * scale}px`))
  }, factor)
/** Boxes whose words run past their edge. */
const overflowing = (page, selectors) =>
  page.evaluate(
    (selectors) =>
      selectors.flatMap((selector) =>
        [...document.querySelectorAll(selector)]
          .filter((node) => node.checkVisibility() && node.scrollWidth > node.clientWidth + 1)
          .map((node) => `${selector}: ${node.scrollWidth} in ${node.clientWidth}`),
      ),
    selectors,
  )
/** What a person counts: each tap or press is one, typing and scrolling none. */
function counter(o) {
  let taps = 1 // ✏️ Edit under the deck in the chat.
  return {
    get taps() {
      return taps
    },
    async tap(locator) {
      taps += 1
      await locator.click()
    },
    async field(n, field) {
      taps += 1
      await tapField(o, n, field)
    },
    async main() {
      taps += 1
      await pressMain(o.page)
    },
  }
}
async function look(o, state) {
  const what = `${label(o)} ${state}`
  await noSidewaysScroll(o.page, what)
  assert.deepEqual(await smallTargets(o.page), [], `${what}: tap targets`)
  await axe(o.page, what)
  await noPlaceholderMonth(o.page, what)
  await shot(o, state)
}
/** A link followed inside the app: no page load, so whatever the app holds in memory stays. */
const routeTo = (page, to) =>
  page.evaluate(
    (target) => document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push(target),
    to,
  )
const asWebKit = (page, on) => page.evaluate((on) => (window.__asWebKit = on), on)
/**
 * What keeps words from being read: '' when each of their lines (only the first, with `whole` false) is on
 * screen above the keyboard and nothing is painted over it. Lines, not the box: a note that wraps has gaps.
 */
const unreadable = (locator, whole = true) =>
  locator.evaluate((node, whole) => {
    const band =
      innerHeight -
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--editor-keyboard') || '0')
    const range = document.createRange()
    range.selectNodeContents(node)
    const lines = [...range.getClientRects()].filter((line) => line.width > 1 && line.height > 1)
    if (!node.checkVisibility() || !node.textContent.trim() || !lines.length) return 'not shown'
    for (const [n, line] of (whole ? lines : lines.slice(0, 1)).entries()) {
      if (line.top < -0.5 || line.bottom > band + 0.5 || line.left < -0.5 || line.right > innerWidth + 0.5)
        return `line ${n + 1} off the screen above the keyboard (${Math.round(line.top)}-${Math.round(line.bottom)} of ${Math.round(band)})`
      const hit = document.elementFromPoint(line.left + line.width / 2, line.top + line.height / 2)
      if (!hit || (hit !== node && !node.contains(hit)))
        return `line ${n + 1} under ${hit?.dataset?.testid || hit?.className || hit?.tagName || 'nothing'}`
    }
    return ''
  }, whole)
/**
 * A control that cannot do its job here is refused at the tap: there, disabled, and why said beside it in
 * words that can be read. Never taken away: a button gone says nothing. The reason's words come back.
 */
async function refusedAtTap(control, reason, what) {
  assert.equal(await control.count(), 1, `${what}: the refused control is there`)
  assert.equal(await control.isDisabled(), true, `${what}: and disabled`)
  await reason.waitFor({ timeout: 5000 })
  await reason.scrollIntoViewIfNeeded()
  assert.equal(await unreadable(reason, false), '', `${what}: the reason in sight`)
  return (await reason.innerText()).trim()
}
/** What covers a control: '' when a finger on it lands on it, across its width and above the keyboard. */
const coveredBy = (locator) =>
  locator.evaluate((node) => {
    const box = node.getBoundingClientRect()
    const band =
      innerHeight -
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--editor-keyboard') || '0')
    if (box.top < 0 || box.bottom > band + 0.5)
      return `off the screen above the keyboard (${box.top}-${box.bottom} of ${band})`
    for (const at of [0.25, 0.5, 0.75]) {
      const hit = document.elementFromPoint(box.left + box.width * at, box.top + box.height / 2)
      if (!hit || (hit !== node && !node.contains(hit)))
        return `${hit?.dataset?.testid || hit?.className || hit?.tagName || 'nothing'} at ${at * 100}%`
    }
    return ''
  })
/** The lines dock's own lines, as typed. */
const dockLines = (page) =>
  page
    .locator('[data-testid^="deck-line-"]')
    .evaluateAll((nodes) =>
      nodes.filter((node) => /^deck-line-\d+$/.test(node.dataset.testid)).map((node) => node.value),
    )
/** The caret after a field's words. Not the End key: on a Mac it scrolls the sheet and leaves the caret. */
const caretAtEnd = (locator) =>
  locator.evaluate((input) => input.setSelectionRange(input.value.length, input.value.length))
/** The Cover form's Other lines, as typed. */
const coverOthers = (scope) =>
  scope
    .locator('[data-testid^="deck-cover-other-"]:not([data-testid$="-remove"])')
    .evaluateAll((nodes) => nodes.map((node) => node.value))
/** The Cover form's four rows, as typed. */
async function coverRows(scope) {
  const rows = {}
  for (const role of ['made', 'checked', 'group', 'school'])
    rows[role] = await scope.getByTestId(`deck-cover-${role}`).inputValue()
  return rows
}
/** What POST /studio/cover-lines was sent, in order. */
const keptPosts = (server) =>
  server.coverLines.filter((call) => call.method === 'POST').map((call) => call.body)

/* ------------------------------------------------------------------ 1-2: the route, opening and drawing */

await group('1 Route', async () => {
  for (const options of [
    { width: 390, height: 656 },
    { width: 390, height: 844, inside: false, editor: { editor_v2: false, deck_editor: true } },
  ]) {
    const o = await openDeck(options)
    const { page, server } = o
    await goToDeck(o, { image: false })
    await page.getByTestId('editor-topbar').waitFor()
    assert.equal(await page.getByTestId('editor-frame').count(), 0, `${label(o)}: not the PDF editor’s frame`)
    assert.ok(await isBare(page), `${label(o)}: bare on a phone, whatever editor_v2 says`)
    await until(async () => (await page.title()).includes('Slide editor'), 'the tab to say Slide editor')
    assert.equal(server.requests.filter((entry) => entry.endpoint.startsWith('/editor/documents')).length, 0)
    await finish(o)
  }
  const empty = await openDeck({})
  await goToDeck(empty, { image: false, to: '/app/editor/deck' })
  await empty.page.locator('[data-testid="deck-refusal"][data-state="gone"]').waitFor()
  await empty.page.waitForTimeout(300)
  assert.equal(
    empty.server.requests.filter((entry) => entry.endpoint.startsWith('/generation/drafts')).length,
    0,
    'no id, no request',
  )
  await finish(empty)
  return 'Route: the deck editor alone and bare at 390 (editor_v2 on or off), titled Slide editor; no id asks nothing'
})

await group('2 Open and render', async () => {
  const o = await openDeck({})
  const { page, server } = o
  await goToDeck(o)
  const requests = server.requests
  const at = (test) => requests.findIndex(test)
  const draft = at((entry) => entry.method === 'GET' && entry.endpoint === `/generation/drafts/${DRAFT}`)
  const first = at(
    (entry) => entry.method === 'GET' && entry.endpoint === RENDER && entry.query.version === '3',
  )
  const post = at((entry) => entry.method === 'POST' && entry.endpoint === RENDER)
  assert.ok(
    draft >= 0 && draft < first && first < post,
    `draft, then how version 3 stands, then a POST (${draft} ${first} ${post})`,
  )
  assert.equal(server.renders[0].answer, 'none')
  assert.deepEqual(requests[post].body, { version: 3 })
  const polls = requests.filter(
    (entry, index) => index > post && entry.method === 'GET' && entry.endpoint === RENDER,
  )
  assert.ok(polls.length >= 2, `polled until drawn (${polls.length})`)
  assert.ok(server.renders.some((entry) => entry.version === 3 && entry.answer === 'done'))
  assert.match(
    await page.getByTestId('deck-slide-image').getAttribute('src'),
    /^blob:/,
    'a picture from the blob cache',
  )
  assert.equal(await page.locator('[data-testid^="deck-thumb-"]').count(), 9, '7 slides and 2 of questions')
  for (const n of [8, 9])
    assert.equal(
      (await page.getByTestId(`deck-thumb-${n}`).locator('.deck-edit-thumb-number').textContent()).trim(),
      '?',
    )
  const cover = server.slidesAt(3)[0].key
  await until(() => server.pictureGets[cover] >= 1, 'the cover’s picture')
  await page.waitForTimeout(500)
  const fetched = server.pictureGets[cover]
  await swipe(page, 'next')
  await until(async () => (await currentSlide(page)) === 2, 'slide 2 after a swipe')
  await page.getByTestId('deck-slide-image').waitFor()
  await swipe(page, 'prev')
  await until(async () => (await currentSlide(page)) === 1, 'slide 1 after a swipe back')
  await page.waitForTimeout(500)
  assert.equal(server.pictureGets[cover], fetched, 'the cover was not fetched again')
  await look(o, 'root')
  await finish(o)
  return 'Open and render: draft, render none, POST {version:3}, polls, done; blob pictures, 9 thumbs with ? for questions, nothing fetched twice'
})

/* ------------------------------------------------------------------ 3-8: the field dock */

await group('3 Region edit', async () => {
  const o = await openDeck({ width: 390, height: 656 })
  const { page, server } = o
  await goToDeck(o)
  await goTo(page, 2)
  const slide = await slideBox(page)
  const heading = frameOf(o, 2, 'heading')
  const tall = heading.h * slide.height
  const above = Math.min(8, (44 - tall) / 2 - 1)
  assert.ok(above >= 4, `the heading is under 44 px tall here (${tall})`)
  // Above the heading's box, inside the 44 px it is grown to, and far from the lines.
  await page.mouse.click(
    slide.x + (heading.x + heading.w / 2) * slide.width,
    slide.y + heading.y * slide.height - above,
  )
  await headingDock(page).waitFor()
  assert.equal(await page.getByTestId('editor-topbar').count(), 0, 'the dock takes the top bar’s place')
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'deck-headline')
  await look(o, 'dock-headline')
  // Telegram keeps its MainButton above a keyboard on a screen 600 px or taller.
  await page.evaluate(() => window.__tg.keyboard(300))
  await page.waitForTimeout(200)
  assert.equal((await mainButton(page)).isVisible, true, 'a tall screen keeps Send to chat')
  await page.evaluate(() => window.__tg.keyboard(0))

  await page.getByTestId('deck-headline').fill('Evaporation and fog')
  const hides = (await spied(page, 'hideKeyboard')).length
  await page.getByTestId('deck-dock-done').click()
  await headingDock(page).waitFor({ state: 'detached' })
  await page.getByTestId('editor-topbar').waitFor()
  assert.ok((await spied(page, 'hideKeyboard')).length > hides, 'Done puts the keyboard away')
  const first = await savedPatch(server, (c) => c.sections[1].heading === 'Evaporation and fog')
  assert.equal(first.version, 3)
  assert.equal(first.content.sections.length, 7)
  assert.equal(first.content.questions.length, 6)
  assert.equal(first.content.sections[1].body, DECKS.en.sections()[0].body, 'the rest of the slide as it was')
  await until(() => server.renderPosts.some((entry) => entry.version === 4), 'a render of version 4')
  await page.getByTestId('deck-drawing').waitFor({ timeout: 5000 })
  const redrawn = server.slidesAt(4)[1].key
  assert.notEqual(redrawn, server.slidesAt(3)[1].key)
  await until(() => server.pictureGets[redrawn] >= 1, 'the new picture of slide 2')
  await page.getByTestId('deck-drawing').waitFor({ state: 'hidden', timeout: 8000 })

  let from = mark(server)
  await page.getByTestId('editor-undo').click()
  await savedPatch(server, (c) => c.sections[1].heading === 'Evaporation', from, 'the undo saved')
  from = mark(server)
  await page.getByTestId('editor-redo').click()
  await savedPatch(server, (c) => c.sections[1].heading === 'Evaporation and fog', from, 'the redo saved')
  await saved(page)

  // Back with nothing changed only closes, and the keyboard goes with it.
  await tapField(o, 2, 'heading')
  await headingDock(page).waitFor()
  const before = server.patches.length
  const hidden = (await spied(page, 'hideKeyboard')).length
  await pressBack(page)
  await headingDock(page).waitFor({ state: 'detached' })
  await page.waitForTimeout(1300)
  assert.equal(server.patches.length, before, 'nothing to save')
  assert.ok((await spied(page, 'hideKeyboard')).length > hidden)
  await finish(o)

  // A web view under 600 px hides the MainButton while the keyboard is up.
  const small = await openDeck({ width: 320, height: 426 })
  await goToDeck(small)
  await openHeading(small, 2)
  await small.page.waitForFunction(() => window.__tg.app.MainButton.isVisible)
  await small.page.evaluate(() => window.__tg.keyboard(253))
  await small.page.waitForFunction(() => !window.__tg.app.MainButton.isVisible)
  await small.page.evaluate(() => window.__tg.keyboard(0))
  await small.page.waitForFunction(() => window.__tg.app.MainButton.isVisible)
  await finish(small)
  return 'Region edit: a tap near the heading opens its dock in the top bar’s place; Done saves the whole deck, draws version 4, Undo and Redo save; Back closes'
})

await group('4 Dock fits at 320', async () => {
  const o = await openDeck({ width: 320, height: 426 })
  const { page } = o
  await goToDeck(o)
  await openLines(o, 2)
  await page.evaluate(() => window.__tg.keyboard(253))
  await page.waitForTimeout(300)
  const band = await keyboardBand(page)
  assert.ok(band > 150 && band < 200, `the keyboard leaves 173 px (${band})`)
  const done = await page.getByTestId('deck-dock-done').boundingBox()
  assert.ok(done, 'Done is on screen')
  assert.ok(
    done.y + done.height <= band + 0.5,
    `Done stays above the keyboard (${done.y + done.height} over ${band})`,
  )
  assert.ok(done.width >= 43.5 && done.height >= 43.5, `Done is 44 px (${done.width}x${done.height})`)
  assert.equal(
    await page.getByTestId('deck-dock-mini').isVisible(),
    false,
    'no slide picture in the dock under 360 px',
  )
  await page.waitForFunction(() => !window.__tg.app.MainButton.isVisible)
  await noSidewaysScroll(page, '320 dock')
  await shot(o, 'dock-320-keyboard')
  await finish(o)
  return 'At 320 with a 253 px keyboard the lines dock’s Done is 44 px above it, with no picture and no MainButton'
})

await group('5 Budget and over-budget', async () => {
  const o = await openDeck({})
  const { page, server } = o
  await goToDeck(o)
  await goTo(page, 2)
  const fitsBefore = server.fits.length
  await tapField(o, 2, 'body')
  await linesDock(page).waitFor()
  await addLines(page, 8)
  await budgetSays(page, '8 of 6 lines')
  await page.waitForTimeout(1700)
  const calls = server.fits.slice(fitsBefore)
  assert.ok(calls.length >= 1 && calls.length <= 4, `/fit asked 1 to 4 times (${calls.length})`)
  assert.ok(server.fitMost <= 1, `one /fit at a time (${server.fitMost})`)
  assert.match(
    await page.getByTestId('deck-dock-message').textContent(),
    /Too long for this slide: 6 words won’t show/,
  )
  await look(o, 'dock-lines-over')

  // Split: half the lines stay, the rest go to a new slide with the same headline.
  await page.getByTestId('deck-split').click()
  const split = await savedPatch(server, (c) => c.sections.length === 8, 0, 'the split saved')
  const added = split.content.sections[2]
  assert.equal(split.content.sections[1].id, 's2')
  assert.match(added.id, UUID)
  assert.equal(added.heading, 'Evaporation')
  assert.equal(added.layout, 'bullets')
  assert.deepEqual(split.content.sections[1].body.split('\n').length, 4)
  assert.deepEqual(added.body.split('\n'), EXTRA_LINES.slice(1))
  let from = mark(server)
  await page.getByTestId('editor-snackbar-action').click()
  await savedPatch(
    server,
    (c) => c.sections.length === 7 && c.sections[1].body.split('\n').length === 8,
    from,
    'Undo of the split',
  )

  // Pick another layout: only those that hold all of it.
  if (!(await linesDock(page).isVisible())) await openLines(o, 2)
  await budgetSays(page, '8 of 6 lines')
  await page.getByTestId('deck-pick-layout').click()
  await page.getByTestId('deck-layout-sheet').waitFor()
  await until(async () => (await layoutChoices(page)).length > 0, 'the layouts')
  assert.deepEqual((await layoutChoices(page)).sort(), ['image_split', 'two_column'])
  await look(o, 'layout-sheet')
  from = mark(server)
  await page.getByTestId('deck-layout-two_column').click()
  await savedPatch(server, (c) => c.sections[1].layout === 'two_column', from, 'the layout saved')
  await finish(o)

  // A measure that ran out of time lists nothing: the chooser measures once more by itself.
  const t = await openDeck({})
  await goToDeck(t)
  await openLines(t, 2)
  await addLines(t.page, 7)
  await budgetSays(t.page, '7 of 6 lines')
  await t.page.waitForTimeout(1700)
  t.server.fitTimeoutNext = true
  await addLines(t.page, 8)
  await until(() => !t.server.fitTimeoutNext, 'a measure that runs out of time', 9000)
  await budgetSays(t.page, '8 of 6 lines')
  await t.page.waitForTimeout(1800)
  const asked = t.server.fits.length
  await t.page.getByTestId('deck-pick-layout').click()
  await t.page.getByTestId('deck-layout-sheet').waitFor()
  await until(async () => (await layoutChoices(t.page)).length === 2, 'the layouts after one more measure')
  const extra = t.server.fits.length - asked
  assert.ok(extra >= 1 && extra <= 2, `one more measure (${extra})`)
  assert.equal(await t.page.getByTestId('deck-layout-retry').count(), 0)
  await finish(t)
  return 'Budget: at most 4 /fit calls, one at a time, "8 of 6 lines" and the words over; Split, its Undo, and the layouts that hold it; an empty list measures once more'
})

await group('6 New slide from the strip', async () => {
  const o = await openDeck({})
  const { page, server } = o
  await goToDeck(o)
  await goTo(page, 2)
  await page.getByTestId('deck-strip-add').click()
  await headingDock(page).waitFor()
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'deck-headline')
  await page.getByTestId('deck-dock-cancel').click()
  await headingDock(page).waitFor({ state: 'detached' })
  await page.waitForTimeout(1300)
  assert.equal(server.patches.length, 0, 'Cancel saves nothing')
  assert.equal(await page.locator('[data-testid^="deck-thumb-"]').count(), 9, 'and adds no slide')

  await page.getByTestId('deck-strip-add').click()
  await headingDock(page).waitFor()
  await page.getByTestId('deck-headline').fill('Fog and dew')
  await page.getByTestId('deck-dock-done').click()
  await headingDock(page).waitFor({ state: 'detached' })
  // Its lines at once: the measure has to wait for the save that holds the new slide.
  await page.getByTestId('deck-blank-lines').click()
  await linesDock(page).waitFor()
  const added = await savedPatch(server, (c) => c.sections.length === 8, 0, 'the new slide saved')
  const fresh = added.content.sections[2]
  assert.deepEqual(
    added.content.sections.map((row) => row.id).filter((id) => id !== fresh.id),
    ORIGINAL_IDS,
    'after the slide it was added from',
  )
  assert.match(fresh.id, UUID)
  assert.equal(fresh.heading, 'Fog and dew')
  assert.equal(fresh.layout, 'bullets')
  await until(() => server.fits.some((call) => call.section.id === fresh.id), 'a measure of the new slide')
  assert.deepEqual(
    server.fits.filter((call) => call.section.id === fresh.id && !call.known).length,
    0,
    'measured only once saved',
  )
  await page.getByTestId('deck-dock-cancel').click()
  await page.waitForTimeout(1300)
  assert.equal(
    server.patches.filter((attempt) => attempt.status === 200 && attempt.body.content.sections.length === 8)
      .length,
    1,
  )
  await finish(o)
  return 'New slide from the strip: Cancel adds nothing; a typed headline adds one bullets slide after the current one, measured only after it is saved'
})

await group('7 Navigation while docked', async () => {
  const o = await openDeck({})
  const { page, server } = o
  await goToDeck(o)
  await openHeading(o, 2)
  await page.getByTestId('deck-headline').fill('Evaporation today')
  await swipe(page, 'next')
  await headingDock(page).waitFor({ state: 'detached' })
  const done = await savedPatch(server, (c) => c.sections[1].heading === 'Evaporation today')
  assert.equal(done.content.sections[2].heading, 'How rain forms', 'the words went to slide 2, not 3')
  await until(async () => (await currentSlide(page)) === 3, 'slide 3')
  await finish(o)
  return 'A swipe with the dock open saves its words to that slide, closes the dock and moves on'
})

await group('8 Hide keeps the dock', async () => {
  const o = await openDeck({})
  const { page, server } = o
  await goToDeck(o)
  await openHeading(o, 2)
  await page.getByTestId('deck-headline').fill('Evaporation at noon')
  await setHidden(page, true)
  await savedPatch(server, (c) => c.sections[1].heading === 'Evaporation at noon', 0, 'the save on hide')
  assert.ok(await headingDock(page).isVisible(), 'the dock stays open')
  await setHidden(page, false)
  await page.getByTestId('deck-headline').fill('Evaporation at noon and dusk')
  const from = mark(server)
  await page.getByTestId('deck-dock-done').click()
  await savedPatch(server, (c) => c.sections[1].heading === 'Evaporation at noon and dusk', from)
  await saved(page)
  const back = mark(server)
  await page.getByTestId('editor-undo').click()
  await savedPatch(server, (c) => c.sections[1].heading === 'Evaporation', back, 'one Undo for both')
  await finish(o)
  return 'Hiding the app saves the open dock and keeps it; the next Done amends it, so one Undo takes back both'
})

/* ------------------------------------------------------------------ 9-12: sheets */

await group('9 Slides list', async () => {
  const o = await openDeck({})
  const { page, server } = o
  await goToDeck(o)
  const flow = counter(o)
  await flow.tap(page.getByTestId('deck-tab-slides'))
  const sheet = page.getByTestId('deck-slides-sheet')
  await sheet.waitFor()
  assert.equal(await page.locator('dialog.editor-sheet:modal').count(), 0, 'not modal')
  assert.equal(await sheet.getAttribute('data-size'), 'compact')
  await page.waitForFunction(() => window.__tg.app.MainButton.isVisible)
  await page.getByTestId('deck-row-cover-lock').waitFor()
  const cover = page.getByTestId('deck-row-1')
  if (await cover.isEnabled()) await cover.click()
  assert.notEqual(await cover.getAttribute('aria-pressed'), 'true', 'the cover is not chosen')
  await look(o, 'slides-list')
  await flow.tap(page.getByTestId('deck-row-6'))
  assert.equal(await page.getByTestId('deck-row-6').getAttribute('aria-pressed'), 'true')
  await page.getByTestId('deck-choose-spot').waitFor()
  await look(o, 'slides-moving')
  await flow.tap(page.getByTestId('deck-put-1'))
  await savedPatch(server, (c) => order(c) === 's1,s6,s2,s3,s4,s5,s7', 0, 'slide 6 put first after the cover')
  await until(
    async () => (await page.evaluate(() => document.activeElement?.dataset.testid)) === 'deck-row-2',
    'focus on the moved row',
  )
  const from = mark(server)
  await flow.tap(page.getByTestId('deck-add-slide'))
  const grown = await savedPatch(server, (c) => c.sections.length === 8, from, 'Add slide saved')
  const fresh = grown.content.sections.find((row) => !ORIGINAL_IDS.includes(row.id))
  assert.match(fresh.id, UUID)
  assert.equal(fresh.layout, 'bullets')
  assert.equal(fresh.heading, '')
  const freshRow = grown.content.sections.indexOf(fresh) + 1
  await until(
    async () => (await page.getByTestId(`deck-row-${freshRow}`).getAttribute('aria-pressed')) === 'true',
    'the new row chosen',
  )
  assert.equal(await page.getByTestId('deck-dock').count(), 0, 'no dock')
  assert.ok(
    !['INPUT', 'TEXTAREA'].includes(await page.evaluate(() => document.activeElement?.tagName)),
    'no keyboard',
  )
  await flow.main()
  await reviewReady(page)
  await flow.main()
  await page.getByTestId('editor-accepted').waitFor()
  assert.ok(flow.taps <= 7, `move and add a slide, send: 6 taps after Edit (${flow.taps})`)
  await closedApp(page)
  const taps = flow.taps
  await finish(o)

  // A deck changed on one slide by AI: once drawn, the platform lets it be reordered like any other.
  const p = await openDeck({ revisionSelected: true })
  await goToDeck(p)
  await p.page.getByTestId('deck-tab-slides').click()
  await p.page.getByTestId('deck-slides-sheet').waitFor()
  await selectRow(p.page, 3)
  let at = mark(p.server)
  await p.page.getByTestId('deck-move-later').click()
  await savedPatch(p.server, (c) => order(c) === 's1,s2,s4,s3,s5,s6,s7', at, 'Later')
  at = mark(p.server)
  await p.page.getByTestId('deck-move-earlier').click()
  await savedPatch(p.server, (c) => order(c) === ORIGINAL_IDS.join(','), at, 'Earlier')
  at = mark(p.server)
  await p.page.getByTestId('deck-duplicate').click()
  const copied = await savedPatch(p.server, (c) => c.sections.length === 8, at, 'Duplicate')
  const copy = copied.content.sections[3]
  assert.match(copy.id, UUID)
  assert.equal(copy.heading, 'How rain forms')
  assert.deepEqual(copy.items, copied.content.sections[2].items)
  await selectRow(p.page, 4)
  at = mark(p.server)
  await p.page.getByTestId('deck-delete').click()
  await savedPatch(p.server, (c) => c.sections.length === 7, at, 'Delete')
  await p.page.getByTestId('editor-snackbar').waitFor()
  at = mark(p.server)
  await p.page.getByTestId('editor-snackbar-action').click()
  await savedPatch(
    p.server,
    (c) => c.sections.length === 8 && c.sections[3].id === copy.id,
    at,
    'Undo of the delete',
  )
  // Back lets go of the chosen row first, then closes the sheet.
  await selectRow(p.page, 3)
  await pressBack(p.page)
  await until(async () => (await pressedRows(p.page)) === 0, 'no row chosen')
  assert.ok(await p.page.getByTestId('deck-slides-sheet').isVisible(), 'the sheet stays')
  await pressBack(p.page)
  await p.page.getByTestId('deck-slides-sheet').waitFor({ state: 'hidden' })
  await finish(p)

  const short = await openDeck({ width: 320, height: 426 })
  await goToDeck(short)
  await short.page.getByTestId('deck-tab-slides').click()
  await short.page.getByTestId('deck-slides-sheet').waitFor()
  assert.equal(
    await short.page.getByTestId('deck-slides-sheet').getAttribute('data-size'),
    'tall',
    'tall under 600 px',
  )
  await finish(short)
  return `Slides list: the cover stays first; Put here, Earlier, Later, Duplicate, Delete with Undo, Add without the keyboard; Back lets go first; ${taps} taps with Edit`
})

await group('10 Questions', async () => {
  const o = await openDeck({})
  const { page, server } = o
  await goToDeck(o)
  await page.getByTestId('deck-tab-slides').click()
  const row = page.getByTestId('deck-questions-row')
  await row.waitFor()
  assert.match(await row.textContent(), /Questions · 6/)
  let from = mark(server)
  await page.getByTestId('deck-fewer').click()
  await savedPatch(server, (c) => c.questions.length === 5, from, 'Fewer questions')
  await until(async () => (await page.locator('[data-testid^="deck-thumb-"]').count()) === 8, '8 slides')
  await page.getByTestId('deck-fewer').waitFor({ state: 'hidden' })
  from = mark(server)
  await page.getByTestId('deck-remove-quiz').click()
  await savedPatch(server, (c) => c.questions.length === 0, from, 'Remove quiz')
  from = mark(server)
  await page.getByTestId('editor-snackbar-action').click()
  await savedPatch(server, (c) => c.questions.length === 5, from, 'Undo of Remove quiz')
  await page.getByTestId('deck-questions-open').click()
  const sheet = page.getByTestId('deck-questions-sheet')
  await sheet.waitFor()
  await look(o, 'questions')
  await page.getByTestId('deck-question-0-stem').fill('Fixture question one, asked again?')
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'deck-question-0-stem')
  from = mark(server)
  await pressBack(page)
  await sheet.waitFor({ state: 'hidden' })
  const edited = await savedPatch(
    server,
    (c) => c.questions[0].stem === 'Fixture question one, asked again?',
    from,
  )
  assert.deepEqual(edited.content.questions[0].options, ['North', 'South', 'East', 'West'])
  assert.equal(edited.content.questions[0].marks, 1, 'what the sheet does not show stays')
  await finish(o)

  const small = await openDeck({ width: 320, height: 426, locale: 'ru', theme: 'dark' })
  await goToDeck(small)
  await goTo(small.page, 8)
  await tapField(small, 8, 'body')
  await small.page.getByTestId('deck-questions-sheet').waitFor()
  await small.page.getByTestId('deck-question-0-stem').click()
  await small.page.evaluate(() => window.__tg.keyboard(253))
  await small.page.waitForTimeout(300)
  const stem = await small.page.getByTestId('deck-question-0-stem').boundingBox()
  const band = await keyboardBand(small.page)
  assert.ok(
    stem.y + stem.height <= band + 0.5,
    `the question stays above the keyboard (${stem.y + stem.height} over ${band})`,
  )
  await shot(small, 'questions-keyboard')
  await finish(small)
  return 'Questions: Questions · 6, Fewer to 5, Remove quiz and its Undo; a question changed and Back saves it; above the keyboard at 320'
})

await group('11 Cover details', async () => {
  const o = await openDeck({})
  const { page, server } = o
  await goToDeck(o)
  const open = page.getByTestId('deck-cover-open')
  assert.equal((await open.textContent()).trim(), 'Cover')
  await open.click()
  const sheet = page.getByTestId('deck-cover-sheet')
  await sheet.waitFor()
  const value = (testid) => page.getByTestId(testid).inputValue()
  assert.equal(await value('deck-cover-topic'), 'Water cycle in nature')
  assert.equal(await value('deck-cover-made'), 'Karimova Dilnoza')
  assert.equal(await value('deck-cover-checked'), 'Rasulova M.')
  assert.equal(await value('deck-cover-group'), '9-B class')
  assert.equal(await value('deck-cover-school'), 'School No. 21')
  assert.equal(await page.getByTestId('deck-cover-remember').isChecked(), false)
  await look(o, 'cover')
  await page.getByTestId('deck-cover-made').fill('Karimova D.')
  await page.getByTestId('deck-cover-remember').check()
  await closeSheet(page, 'deck-cover-sheet')
  const lines = ['Prepared by: Karimova D.', 'Checked by: Rasulova M.', '9-B class', 'School No. 21']
  await savedPatch(
    server,
    (c) => c.sections[0].body === lines.join('\n'),
    0,
    'the cover saved, the other lines as they were',
  )
  await until(() => server.coverLines.some((call) => call.method === 'POST'), 'Remember')
  // With the deck's language: a new deck takes them only when it is in that language. And with the row each
  // was typed in, so the next deck never has to guess one from its words.
  assert.deepEqual(server.coverLines.filter((call) => call.method === 'POST').at(-1).body, {
    lines,
    locale: 'en',
    roles: ['made', 'checked', 'group', 'school'],
  })
  await open.click()
  await sheet.waitFor()
  assert.equal(await page.getByTestId('deck-cover-remember').isChecked(), true)
  await page.getByTestId('deck-cover-forget').click()
  await until(() => server.coverLines.some((call) => call.method === 'DELETE'), 'Forget')
  await page.getByTestId('editor-snackbar').filter({ hasText: 'Forgotten.' }).waitFor()
  await closeSheet(page, 'deck-cover-sheet')
  // The cover's own headline opens the headline dock, not the sheet.
  await tapField(o, 1, 'heading')
  await headingDock(page).waitFor()
  assert.equal(await sheet.isVisible(), false)
  await page.getByTestId('deck-dock-cancel').click()
  await finish(o)

  const uz = await openDeck({ locale: 'uz' })
  await goToDeck(uz)
  await uz.page.getByTestId('deck-cover-open').click()
  await uz.page.getByTestId('deck-cover-sheet').waitFor()
  assert.equal(await uz.page.getByTestId('deck-cover-made').inputValue(), 'Karimova Dilnoza')
  await uz.page.getByTestId('deck-cover-made').fill('Karimova D.')
  await closeSheet(uz.page, 'deck-cover-sheet')
  await savedPatch(
    uz.server,
    (c) => c.sections[0].body === 'Bajardi: Karimova D.\n9-B sinf\n21-maktab',
    0,
    'Bajardi: kept',
  )
  assert.equal(
    uz.server.coverLines.filter((call) => call.method === 'POST').length,
    0,
    'not asked to remember',
  )
  await finish(uz)

  // Remembered lines fill an empty cover, and Send takes them with it.
  const kept = await openDeck({ coverBody: '', remembered: ['Prepared by: Karimova Dilnoza', '9-B class'] })
  await goToDeck(kept)
  const flow = counter(kept)
  await flow.tap(kept.page.getByTestId('deck-cover-open'))
  await kept.page.getByTestId('deck-cover-sheet').waitFor()
  await kept.page.getByTestId('deck-cover-filled').waitFor()
  assert.equal(await kept.page.getByTestId('deck-cover-made').inputValue(), 'Karimova Dilnoza')
  assert.equal(await kept.page.getByTestId('deck-cover-group').inputValue(), '9-B class')
  await shot(kept, 'cover-filled')
  await flow.main()
  await reviewReady(kept.page)
  const requests = kept.server.requests
  const saveAt = requests.findIndex(
    (entry) =>
      entry.method === 'PATCH' &&
      entry.body?.content?.sections?.[0]?.body?.includes('Prepared by: Karimova Dilnoza'),
  )
  const quoteAt = requests.findIndex((entry) => entry.endpoint === QUOTE)
  assert.ok(
    saveAt >= 0 && saveAt < quoteAt,
    `the filled-in lines saved before the quote (${saveAt} ${quoteAt})`,
  )
  await flow.main()
  await kept.page.getByTestId('editor-accepted').waitFor()
  assert.equal(kept.server.jobPosts.length, 1)
  assert.equal(flow.taps, 4, `cover lines from the last deck in 4 taps (${flow.taps})`)
  await finish(kept)

  const small = await openDeck({ width: 320, height: 426 })
  await goToDeck(small)
  await small.page.getByTestId('deck-cover-open').click()
  await small.page.getByTestId('deck-cover-sheet').waitFor()
  await small.page.getByTestId('deck-cover-topic').click()
  await small.page.evaluate(() => window.__tg.keyboard(253))
  await small.page.waitForTimeout(300)
  const topic = await small.page.getByTestId('deck-cover-topic').boundingBox()
  const band = await keyboardBand(small.page)
  assert.ok(
    topic.y + topic.height <= band + 0.5,
    `the topic stays above the keyboard (${topic.y + topic.height} over ${band})`,
  )
  await shot(small, 'cover-keyboard')
  await finish(small)
  return 'Cover details: rows read from the cover, a changed row keeps its own label (Bajardi:), Remember and Forget; remembered lines fill an empty cover and go with Send in 4 taps'
})

await group('12 Latin letters', async () => {
  const a = await openDeck({ locale: 'uz' })
  await goToDeck(a)
  const flow = counter(a)
  await flow.field(1, 'heading')
  await headingDock(a.page).waitFor()
  await a.page.getByTestId('deck-headline').fill('Ҳаво ифлосланиши')
  await flow.tap(a.page.getByTestId('deck-dock-done'))
  await until(() => a.server.latin.length === 1, 'the Latin preview')
  assert.deepEqual(a.server.latin[0], { texts: ['Ҳаво ифлосланиши'] })
  const offer = a.page.getByTestId('deck-latin')
  await offer.waitFor()
  assert.match(await offer.textContent(), /Ҳаво ифлосланиши → Havo ifloslanishi/)
  await look(a, 'latin')
  await flow.tap(a.page.getByTestId('deck-latin-switch'))
  await savedPatch(a.server, (c) => c.sections[0].heading === 'Havo ifloslanishi', 0, 'Latin letters saved')
  await offer.waitFor({ state: 'hidden' })
  await flow.main()
  await reviewReady(a.page)
  await flow.main()
  await a.page.getByTestId('editor-accepted').waitFor()
  assert.equal(flow.taps, 6, `a Cyrillic headline in Latin letters, sent: 6 taps (${flow.taps})`)
  await closedApp(a.page)
  const taps = flow.taps
  await finish(a)

  const b = await openDeck({ locale: 'uz' })
  await goToDeck(b)
  await openHeading(b, 1)
  await b.page.getByTestId('deck-headline').fill('Ҳаво ифлосланиши')
  await b.page.getByTestId('deck-dock-done').click()
  await b.page.getByTestId('deck-latin').waitFor()
  await b.page.getByTestId('deck-latin-keep').click()
  await b.page.getByTestId('deck-latin').waitFor({ state: 'hidden' })
  const asked = b.server.latin.length
  // Kept as typed: the same words again ask nothing.
  await openHeading(b, 3)
  await b.page.getByTestId('deck-headline').fill('Ҳаво ифлосланиши')
  await b.page.getByTestId('deck-dock-done').click()
  await savedPatch(b.server, (c) => c.sections[2].heading === 'Ҳаво ифлосланиши')
  await b.page.waitForTimeout(800)
  assert.equal(b.server.latin.length, asked, 'no second offer for words kept')
  assert.equal(await b.page.getByTestId('deck-latin').count(), 0)
  // Send never stops for an offer.
  await openHeading(b, 2)
  await b.page.getByTestId('deck-headline').fill('Ўқувчилар')
  await pressMain(b.page)
  await reviewReady(b.page)
  assert.equal(b.server.latin.length, asked, 'Send asks no Latin preview')
  await finish(b)

  const en = await openDeck({ locale: 'en' })
  await goToDeck(en)
  await openHeading(en, 2)
  await en.page.getByTestId('deck-headline').fill('Ўқувчилар')
  await en.page.getByTestId('deck-dock-done').click()
  await savedPatch(en.server, (c) => c.sections[1].heading === 'Ўқувчилар')
  await en.page.waitForTimeout(800)
  assert.equal(en.server.latin.length, 0, 'an English deck is never offered Latin letters')
  await finish(en)

  // A cover line typed in the Cover details sheet is offered too.
  const c = await openDeck({ locale: 'uz' })
  await goToDeck(c)
  await c.page.getByTestId('deck-cover-open').click()
  await c.page.getByTestId('deck-cover-sheet').waitFor()
  await c.page.getByTestId('deck-cover-group').fill('Ўқувчилар')
  await closeSheet(c.page, 'deck-cover-sheet')
  await until(() => c.server.latin.length === 1, 'the Latin preview of a cover line')
  assert.deepEqual(c.server.latin[0], { texts: ['Ўқувчилар'] })
  await c.page.getByTestId('deck-latin').waitFor()
  await c.page.getByTestId('deck-latin-switch').click()
  await savedPatch(c.server, (content) => content.sections[0].body.split('\n').includes('O‘quvchilar'))
  await finish(c)
  return `Latin letters: an Uzbek deck’s Cyrillic headline offered as Havo ifloslanishi and switched (${taps} taps to the chat); Keep is remembered; a cover line from Cover details too; Send and English decks never ask`
})

/* ------------------------------------------------------------------ 13-15: what can go wrong */

await group('13 Save failures and conflict', async () => {
  const elsewhere = (server, change) => {
    const c = clone(server.content)
    change(c)
    server.version += 1
    server.content = c
    server.history.set(server.version, clone(c))
  }
  const editHeading = async (o, n, text) => {
    await openHeading(o, n)
    await o.page.getByTestId('deck-headline').fill(text)
    await o.page.getByTestId('deck-dock-done').click()
    await headingDock(o.page).waitFor({ state: 'detached' })
  }

  const o = await openDeck({})
  const { page, server } = o
  await goToDeck(o)
  elsewhere(server, (c) => (c.sections[2].heading = 'How rain forms, by a teacher'))
  await editHeading(o, 2, 'Evaporation, mine')
  await page.getByTestId('deck-conflict').waitFor()
  assert.equal(await page.getByTestId('editor-save-icon').getAttribute('data-state'), 'paused')
  await look(o, 'conflict')
  let from = mark(server)
  await page.getByTestId('deck-conflict-keep').click()
  const mine = await savedPatch(
    server,
    (c) => c.sections[1].heading === 'Evaporation, mine',
    from,
    'Keep mine',
  )
  assert.equal(mine.version, 4, 'sent over the version from elsewhere')
  await page.getByTestId('deck-conflict').waitFor({ state: 'hidden' })
  await saved(page)
  elsewhere(server, (c) => (c.sections[1].heading = 'Evaporation, theirs'))
  await editHeading(o, 2, 'Evaporation, mine again')
  await page.getByTestId('deck-conflict').waitFor()
  const before = okPatches(server)
  await page.getByTestId('deck-conflict-take').click()
  await page.getByTestId('deck-conflict').waitFor({ state: 'hidden' })
  await until(
    async () =>
      (await page.getByTestId('deck-slide-image').getAttribute('alt'))?.includes('Evaporation, theirs'),
    'their headline on screen',
  )
  await page.waitForTimeout(1200)
  assert.equal(okPatches(server), before, 'taking theirs sends nothing')
  from = mark(server)
  await page.getByTestId('editor-undo').click()
  await savedPatch(
    server,
    (c) => c.sections[1].heading === 'Evaporation, mine again',
    from,
    'one Undo brings mine back',
  )
  await finish(o)

  const busy = await openDeck({ refuseSaves: (n) => (n === 1 ? [409, 'generation_running'] : null) })
  await goToDeck(busy)
  await editHeading(busy, 2, 'Evaporation while busy')
  await savedPatch(
    busy.server,
    (c) => c.sections[1].heading === 'Evaporation while busy',
    0,
    'the save after generation_running',
  )
  const [refused, retried] = busy.server.patches
  assert.ok(retried.at - refused.at >= 1800, `tried again after 2 s (${retried.at - refused.at} ms)`)
  assert.equal(await busy.page.getByTestId('deck-conflict').count(), 0)
  await finish(busy)

  const down = await openDeck({ refuseSaves: (n, body, server) => (server.down ? [500] : null) })
  await goToDeck(down)
  await editHeading(down, 2, 'Evaporation offline')
  await down.page.locator('[data-testid="editor-save-icon"][data-state="failed"]').waitFor()
  await down.page.getByTestId('editor-save-failed').waitFor()
  await down.page.getByTestId('editor-save-now').waitFor()
  await shot(down, 'save-failed')
  down.server.down = false
  await down.page.getByTestId('editor-save-now').click()
  await savedPatch(down.server, (c) => c.sections[1].heading === 'Evaporation offline', 0, 'Save now')
  await saved(down.page)
  await finish(down)

  const large = await openDeck({ refuseSaves: [413, 'payload_too_large'] })
  await goToDeck(large)
  await editHeading(large, 2, 'Evaporation, too much')
  const banner = large.page.getByTestId('editor-save-failed')
  await banner.waitFor()
  assert.ok((await banner.textContent()).includes(MESSAGES.payload_too_large), 'the server’s own words')
  await large.page.getByTestId('deck-save-undo').waitFor()
  assert.equal(await large.page.getByTestId('editor-save-now').count(), 0, 'no Save now for a refusal')
  const tries = large.server.patches.length
  await large.page.waitForTimeout(2600)
  assert.equal(large.server.patches.length, tries, 'and no retry')
  await finish(large)

  // Saved, but the answer was lost: the next try meets a conflict with the same deck, taken quietly.
  const lost = await openDeck({ refuseSaves: (n) => (n === 1 ? 'drop' : null) })
  await goToDeck(lost)
  await editHeading(lost, 2, 'Evaporation, answered late')
  await until(() => lost.server.patches.length >= 2, 'a second try', 15000)
  await saved(lost.page)
  assert.equal(lost.server.version, 4, 'saved once')
  assert.equal(await lost.page.getByTestId('deck-conflict').count(), 0, 'no conflict for its own save')
  assert.ok(
    lost.server.requests.filter(
      (entry) => entry.method === 'GET' && entry.endpoint === `/generation/drafts/${DRAFT}`,
    ).length >= 2,
    'the draft read again to compare',
  )
  await finish(lost)

  const hang = await openDeck({ clock: true, refuseSaves: (n) => (n === 1 ? 'hang' : null) })
  await goToDeck(hang)
  await editHeading(hang, 2, 'Evaporation, no answer')
  await until(() => hang.server.patches.length === 1, 'the first try')
  await hang.page.clock.fastForward(21000)
  await hang.page.locator('[data-testid="editor-save-icon"][data-state="failed"]').waitFor({ timeout: 25000 })
  await hang.page.clock.fastForward(2500)
  await savedPatch(
    hang.server,
    (c) => c.sections[1].heading === 'Evaporation, no answer',
    1,
    'the try after 20 s without an answer',
    15000,
  )
  await finish(hang)

  const offline = await openDeck({})
  await goToDeck(offline)
  await goTo(offline.page, 2)
  await offline.context.setOffline(true)
  offline.server.offline = true
  await offline.page.getByTestId('deck-offline').waitFor()
  await until(
    async () => (await mainButton(offline.page)).isActive === false,
    'Send to chat inactive offline',
  )
  await editHeading(offline, 2, 'Evaporation, back online')
  await offline.page
    .locator('[data-testid="editor-save-icon"][data-state="failed"]')
    .waitFor({ timeout: 25000 })
  await shot(offline, 'offline')
  offline.server.offline = false
  await offline.context.setOffline(false)
  await savedPatch(
    offline.server,
    (c) => c.sections[1].heading === 'Evaporation, back online',
    0,
    'the save once online',
  )
  await offline.page.getByTestId('deck-offline').waitFor({ state: 'hidden' })
  await finish(offline)
  return 'Saves: a conflict asks, Keep mine and Take theirs (one Undo back); generation_running waits 2 s; 500 offers Save now; 413 says why with Undo; a lost answer is taken quietly; 20 s without one fails; offline waits for online'
})

await group('14 Preview off', async () => {
  const o = await openDeck({
    renderFails: ({ version }) => (version >= 4 ? 'render_deck_interrupted' : null),
  })
  const { page, server } = o
  await goToDeck(o)
  await openHeading(o, 2)
  await page.getByTestId('deck-headline').fill('Evaporation, not drawn')
  await page.getByTestId('deck-dock-done').click()
  await savedPatch(server, (c) => c.sections[1].heading === 'Evaporation, not drawn')
  const off = page.locator('[data-testid="deck-preview-off"][data-reason="unavailable"]')
  await off.waitFor({ timeout: 12000 })
  await page.locator('[data-testid="deck-slide"][data-state="dim"]').waitFor()
  assert.equal(
    server.renderPosts.filter((entry) => entry.version === 4).length,
    2,
    'an interrupted render is asked for once more',
  )
  await saved(page)
  assert.match(await off.textContent(), /Your changes are saved and will be in the file\./)
  await look(o, 'preview-off')
  assert.equal((await mainButton(page)).isActive, true, 'Send stays')
  await tapField(o, 2, 'heading')
  await headingDock(page).waitFor()
  await page.getByTestId('deck-dock-cancel').click()
  await page.waitForTimeout(1200)
  assert.equal(server.renderPosts.filter((entry) => entry.version === 4).length, 2, 'and no third')
  await finish(o)

  const busy = await openDeck({ laneBusy: true })
  await goToDeck(busy, { image: false })
  await busy.page.locator('[data-testid="deck-preview-off"][data-reason="busy"]').waitFor()
  await busy.page.getByTestId('deck-blank-heading').waitFor()
  assert.equal(await busy.page.getByTestId('deck-blank-heading').isEnabled(), true, 'editing stays')
  await finish(busy)

  const raced = await openDeck({ renderConflictOnce: true })
  await goToDeck(raced)
  assert.equal(raced.server.renderPosts[0].answer, 409)
  assert.ok(
    raced.server.renderPosts.length >= 2 && raced.server.renderPosts.at(-1).version === 3,
    'asked again for the version it has',
  )
  assert.equal(await raced.page.getByTestId('deck-preview-off').count(), 0, 'nothing said of a race')
  await finish(raced)
  return 'Preview off: interrupted twice says Preview unavailable over the dimmed picture, saved and sendable; lane_busy says paused; a version race asks again quietly'
})

await group('15 Shortened deck', async () => {
  const o = await openDeck({ unfit: ['s4'] })
  const { page } = o
  await goToDeck(o)
  const notice = page.getByTestId('deck-shortened')
  await notice.waitFor()
  assert.match(await notice.textContent(), /1 slide has words that don’t show/)
  assert.equal(
    await page.getByTestId('deck-thumb-4').getAttribute('data-fits'),
    'false',
    'a red dot on slide 4',
  )
  await look(o, 'shortened')
  await notice.getByRole('button', { name: 'Show it' }).click()
  await until(async () => (await currentSlide(page)) === 4, 'slide 4')
  await page.getByTestId('deck-over').filter({ hasText: 'Too long for this slide' }).waitFor()
  await finish(o)
  return 'A deck drawn short says 1 slide has words that don’t show, marks it in the strip, and Show it goes there'
})

/* ------------------------------------------------------------------ 16-19: sending */

await group('16 Send in Telegram', async () => {
  const o = await openDeck({ quoteDelay: 700 })
  const { page, server } = o
  await goToDeck(o)
  await goTo(page, 2)
  const flow = counter(o)
  await flow.field(2, 'heading')
  await headingDock(page).waitFor()
  await page.getByTestId('deck-headline').fill('Evaporation in spring')
  await flow.main()
  await page.getByTestId('deck-review-sheet').waitFor()
  await page.locator('[data-testid="deck-review-body"][data-stage="checking"]').waitFor()
  await shot(o, 'review-checking')
  await reviewReady(page)
  const requests = server.requests
  const saveAt = requests.findIndex(
    (entry) =>
      entry.method === 'PATCH' && entry.body?.content?.sections?.[1]?.heading === 'Evaporation in spring',
  )
  const quoteAt = requests.findIndex((entry) => entry.endpoint === QUOTE)
  assert.ok(saveAt >= 0 && saveAt < quoteAt, 'the typed words saved before the quote')
  const quote = server.quotes.at(-1)
  assert.deepEqual(Object.keys(quote.body).sort(), ['deliver', 'format', 'version'])
  assert.equal(quote.body.format, 'both')
  assert.equal(quote.body.deliver, 'chat')
  assert.match(await page.getByTestId('deck-review-changes').textContent(), /Slide 2 · words changed/)
  assert.match(await page.getByTestId('editor-review-cost').textContent(), /Uses 1 file task; 11 of 15 left/)
  await page.waitForFunction(() => window.__tg.app.MainButton.text === 'Confirm · 1 file task')
  assert.equal((await mainButton(page)).handlers, 1, 'one press handler')
  await look(o, 'review-ready')
  await flow.main()
  await page.getByTestId('editor-accepted').waitFor()
  const accepted = Date.now()
  assert.equal(server.jobPosts.length, 1)
  assert.deepEqual(server.jobPosts[0].body, { quote_id: quote.id, deliver_to_chat: true })
  assert.match(server.jobPosts[0].key, UUID)
  assert.ok(
    (await spied(page, 'haptic')).some((call) => call[1] === 'success'),
    'a success haptic',
  )
  assert.match(
    await page.getByTestId('editor-accepted').textContent(),
    /Accepted: the files will arrive in the chat\./,
  )
  await shot(o, 'review-accepted')
  await closedApp(page, 3000)
  assert.ok(Date.now() - accepted < 1800, 'closed about 700 ms after')
  assert.ok(flow.taps <= 4, `fix a title and send: 4 taps (${flow.taps})`)
  const taps = flow.taps
  await finish(o)

  const stay = await openDeck({ cost: { kind: 'file_task', left: 3, limit: 15 } })
  await goToDeck(stay)
  await pressMain(stay.page)
  await reviewReady(stay.page)
  await pressMain(stay.page)
  await stay.page.getByTestId('editor-accepted').waitFor()
  await stay.page.waitForTimeout(1200)
  assert.equal(await closes(stay.page), 0, 'at 80 % of the week the app stays')
  await stay.page.getByTestId('editor-keep-editing').click()
  await stay.page.getByTestId('deck-review-sheet').waitFor({ state: 'hidden' })
  await finish(stay)

  const dropped = await openDeck({ jobAnswer: (n) => (n === 1 ? 'drop' : null) })
  await goToDeck(dropped)
  await pressMain(dropped.page)
  await reviewReady(dropped.page)
  await pressMain(dropped.page)
  await dropped.page.locator('[data-testid="editor-refused"][data-code="unanswered"]').waitFor()
  await dropped.page.waitForFunction(() => window.__tg.app.MainButton.text === 'Try again')
  await pressMain(dropped.page)
  await dropped.page.getByTestId('editor-accepted').waitFor()
  assert.equal(dropped.server.jobPosts.length, 2)
  assert.equal(dropped.server.jobPosts[1].key, dropped.server.jobPosts[0].key, 'Try again sends the same key')
  await finish(dropped)

  const late = await openDeck({ quoteTtl: 5000 })
  await goToDeck(late)
  await pressMain(late.page)
  await reviewReady(late.page)
  await pressMain(late.page)
  await late.page.getByTestId('editor-accepted').waitFor()
  const quoted = late.server.quotes.filter((entry) => entry.id)
  assert.equal(quoted.length, 2, 'a quote about to end is asked for again first')
  assert.equal(late.server.jobPosts[0].body.quote_id, quoted[1].id)
  await finish(late)
  return `Send in Telegram: typed words saved before the quote, Slide 2 · words changed, Confirm · 1 file task; one job with a key, closed after 700 ms (${taps} taps); stays at 80 %; Try again keeps the key; a quote about to end is renewed`
})

await group('17 Send in a browser', async () => {
  const o = await openDeck({ width: 390, height: 844, inside: false })
  const { page, server } = o
  await goToDeck(o)
  assert.equal((await page.getByTestId('editor-primary').textContent()).trim(), 'Download')
  await page.getByTestId('editor-primary').click()
  await reviewReady(page)
  assert.equal(server.quotes.at(-1).body.deliver, 'download')
  await page.getByTestId('editor-confirm').click()
  const pptx = page.getByTestId('deck-download-pptx')
  await pptx.waitFor({ timeout: 15000 })
  assert.equal(server.jobPosts[0].body.deliver_to_chat, undefined, 'a browser asks for no chat')
  assert.equal(await pptx.getAttribute('href'), `/api/v1/artifacts/${PPTX_ARTIFACT}/download`)
  assert.match(await pptx.getAttribute('class'), /\bprimary\b/)
  const pdf = page.getByTestId('deck-download-pdf')
  assert.equal(await pdf.getAttribute('href'), `/api/v1/artifacts/${PDF_ARTIFACT}/download`)
  assert.match(await pdf.getAttribute('class'), /\bsecondary\b/)
  assert.equal(await closes(page), 0)
  await look(o, 'review-made-browser')
  await finish(o)
  return 'Send in a browser: Download, no chat asked, the job followed until made, then PowerPoint first and PDF second'
})

await group('18 Review refusals', async () => {
  const fix = await openDeck({ overBudget: ['s2'] })
  await goToDeck(fix)
  await pressMain(fix.page)
  await fix.page.locator('[data-testid="deck-review-body"][data-stage="needs_fix"]').waitFor()
  await fix.page.getByTestId('deck-review-fix-1').waitFor()
  assert.match(await fix.page.getByTestId('deck-review-fix-1').textContent(), /Slide 2: 6 words won’t show/)
  await look(fix, 'review-fix')
  await fix.page.getByTestId('deck-review-fix-1-split').click()
  await savedPatch(fix.server, (c) => c.sections.length === 8, 0, 'the split from Review')
  await reviewReady(fix.page)
  await finish(fix)

  const gone = await openDeck({ pictureGone: true })
  await goToDeck(gone)
  await pressMain(gone.page)
  await gone.page.locator('[data-testid="deck-review-body"][data-stage="pictures"]').waitFor()
  await gone.page.getByTestId('deck-review-picture-4').waitFor()
  await look(gone, 'review-pictures')
  await gone.page.getByTestId('deck-review-picture-4-layout').click()
  await gone.page.getByTestId('deck-layout-sheet').waitFor()
  await until(async () => (await layoutChoices(gone.page)).length > 0, 'the layouts without a picture')
  const offered = await layoutChoices(gone.page)
  assert.ok(
    !offered.includes('image_split') && !offered.includes('cover'),
    `no layout with a picture (${offered})`,
  )
  assert.ok(offered.includes('two_column'))
  await gone.page.getByTestId('deck-layout-two_column').click()
  await savedPatch(
    gone.server,
    (c) => c.sections[4].layout === 'two_column',
    0,
    'slide 5 without its picture',
  )
  await gone.page.getByTestId('deck-layout-sheet').waitFor({ state: 'hidden' })
  // A layout picked to fix a send opens Review again by itself; pressed there, the button would confirm.
  if (!(await gone.page.getByTestId('deck-review-sheet').isVisible())) await pressMain(gone.page)
  await reviewReady(gone.page)
  await finish(gone)

  const week = await openDeck({ quoteRefusal: (n) => (n === 1 ? ['weekly_file_limit', 429] : null) })
  await goToDeck(week)
  await pressMain(week.page)
  const refusedWeek = week.page.locator('[data-testid="editor-refused"][data-code="weekly_file_limit"]')
  await refusedWeek.waitFor()
  assert.equal(await refusedWeek.locator('a').first().getAttribute('href'), '/en/app/billing')
  await look(week, 'review-refused-week')
  await finish(week)

  const limited = await openDeck({
    jobAnswer: (n) =>
      n === 1
        ? ['send_limit', 429, { per: 'hour', limit: 5 }]
        : n === 2
          ? ['send_limit', 429, { per: 'day', limit: 3 }]
          : null,
  })
  await goToDeck(limited)
  await pressMain(limited.page)
  await reviewReady(limited.page)
  await pressMain(limited.page)
  const refusedSend = limited.page.locator('[data-testid="editor-refused"][data-code="send_limit"]')
  await refusedSend.waitFor()
  assert.match(await refusedSend.textContent(), /That’s 5 sends in an hour\. Try again in a little while\./)
  await pressBack(limited.page)
  await limited.page.getByTestId('deck-review-sheet').waitFor({ state: 'hidden' })
  await pressMain(limited.page)
  await reviewReady(limited.page)
  await pressMain(limited.page)
  await refusedSend.filter({ hasText: 'This file has been sent 3 times today.' }).waitFor()
  await finish(limited)

  const unlinked = await openDeck({ jobAnswer: () => ['telegram_link_required', 403] })
  await goToDeck(unlinked)
  await pressMain(unlinked.page)
  await reviewReady(unlinked.page)
  await pressMain(unlinked.page)
  const refusedLink = unlinked.page.locator(
    '[data-testid="editor-refused"][data-code="telegram_link_required"]',
  )
  await refusedLink.waitFor()
  assert.match(await refusedLink.textContent(), /This account has no Telegram chat to send to\./)
  assert.equal(await refusedLink.locator('a').first().getAttribute('href'), '/en/app/settings')
  await finish(unlinked)

  const noPdf = await openDeck({ engineUnavailable: true })
  await goToDeck(noPdf)
  await pressMain(noPdf.page)
  await reviewReady(noPdf.page)
  assert.deepEqual(
    noPdf.server.quotes.map((entry) => entry.body.format),
    ['both', 'pptx'],
  )
  await noPdf.page.getByText('A PDF can’t be made right now, so it comes as PowerPoint.').waitFor()
  assert.match(
    await noPdf.page.getByTestId('editor-review-facts').textContent(),
    /Arrives as PowerPoint(?! and)/,
  )
  await finish(noPdf)

  const conflict = await openDeck({ jobAnswer: () => ['version_conflict', 409] })
  await goToDeck(conflict)
  await pressMain(conflict.page)
  await reviewReady(conflict.page)
  await pressMain(conflict.page)
  await conflict.page.getByTestId('deck-review-sheet').waitFor({ state: 'hidden' })
  await conflict.page.getByTestId('deck-conflict').waitFor()
  await finish(conflict)
  return 'Review refusals: words over budget (Split, quoted again), a picture gone (a layout without one), the week used, send limits by hour and day, no chat, no PDF (PowerPoint only), a conflict at the job'
})

await group('19 Held while sending', async () => {
  const o = await openDeck({ width: 390, height: 844, inside: false, queued: 3 })
  const { page, server } = o
  await goToDeck(o)
  await page.getByTestId('editor-primary').click()
  await reviewReady(page)
  await page.getByTestId('editor-confirm').click()
  await page.getByTestId('editor-accepted').waitFor()
  await closeSheet(page, 'deck-review-sheet')
  await page.getByTestId('editor-held').waitFor()
  assert.equal(await page.getByTestId('deck-strip-add').isDisabled(), true, 'no new slide while held')
  await goTo(page, 2)
  await tapField(o, 2, 'heading')
  await page.waitForTimeout(500)
  assert.equal(await page.getByTestId('deck-dock').count(), 0, 'a tap opens nothing while held')
  await page.getByTestId('deck-tab-slides').click()
  await page.getByTestId('deck-slides-sheet').waitFor()
  assert.equal(await page.getByTestId('deck-add-slide').isDisabled(), true, 'nor in the list')
  await closeSheet(page, 'deck-slides-sheet')
  await page.getByTestId('editor-held').waitFor({ state: 'hidden', timeout: 15000 })
  // Three looks find it queued (the POST's own answer is the first); the third finds it running.
  assert.ok(server.jobs[0].polls >= 3, 'held until the job started')
  await until(async () => page.getByTestId('deck-strip-add').isEnabled(), 'editing back once it runs')
  await finish(o)
  return 'Held: after Confirm nothing changes the deck until its job leaves the queue'
})

/* ------------------------------------------------------------------ 20-22: Telegram, the strip, desktop */

await group('20 Telegram buttons', async () => {
  const o = await openDeck({})
  const { page, server } = o
  await goToDeck(o)
  await page.waitForFunction(() => window.__tg.app.MainButton.isVisible)
  const main = await mainButton(page)
  assert.equal(main.text, 'Send to chat')
  assert.equal(main.handlers, 1, 'one press handler')
  assert.deepEqual(
    await backButton(page),
    { isVisible: false, handlers: 0 },
    'at the root Telegram shows Close',
  )
  await page.getByTestId('editor-more').click()
  await page.getByTestId('deck-more-sheet').waitFor()
  await page.waitForFunction(() => !window.__tg.app.MainButton.isVisible)
  assert.equal((await mainButton(page)).handlers, 0, 'a modal sheet takes the button away')
  await pressBack(page)
  await page.getByTestId('deck-more-sheet').waitFor({ state: 'hidden' })
  await page.waitForFunction(() => window.__tg.app.MainButton.isVisible)

  // Back on the dock saves what it holds.
  await openHeading(o, 2)
  await page.getByTestId('deck-headline').fill('Evaporation by Back')
  await until(
    async () => (await spied(page, 'enableClosingConfirmation')).length > 0,
    'closing asks while typed words wait',
  )
  await pressBack(page)
  await headingDock(page).waitFor({ state: 'detached' })
  await savedPatch(server, (c) => c.sections[1].heading === 'Evaporation by Back')
  await saved(page)
  await until(
    async () => (await spied(page, 'disableClosingConfirmation')).length > 0,
    'closing quietly once saved',
  )

  // The slide menu's field opens the dock above it: Back pops the dock, then the menu.
  await page.getByTestId('deck-slide-menu').click()
  await page.getByTestId('deck-slide-sheet').waitFor()
  await page.getByTestId('deck-menu-headline').click()
  await headingDock(page).waitFor()
  await pressBack(page)
  await headingDock(page).waitFor({ state: 'detached' })
  if (await page.getByTestId('deck-slide-sheet').isVisible()) {
    await pressBack(page)
    await page.getByTestId('deck-slide-sheet').waitFor({ state: 'hidden' })
  }
  await page.getByTestId('deck-tab-slides').click()
  await page.getByTestId('deck-slides-sheet').waitFor()
  await selectRow(page, 3)
  await pressBack(page)
  await until(async () => (await pressedRows(page)) === 0, 'the row let go')
  await pressBack(page)
  await page.getByTestId('deck-slides-sheet').waitFor({ state: 'hidden' })
  await until(async () => {
    const back = await backButton(page)
    return !back.isVisible && back.handlers === 0
  }, 'BackButton gone at the root')

  // A cover buffer with words not yet committed counts as unsaved too.
  const enables = (await spied(page, 'enableClosingConfirmation')).length
  await goTo(page, 1)
  await page.getByTestId('deck-cover-open').click()
  await page.getByTestId('deck-cover-sheet').waitFor()
  await page.getByTestId('deck-cover-checked').fill('Rasulova Malika')
  await until(
    async () => (await spied(page, 'enableClosingConfirmation')).length > enables,
    'closing asks for the cover’s words',
  )
  await closeSheet(page, 'deck-cover-sheet')
  await savedPatch(server, (c) => c.sections[0].body.includes('Checked by: Rasulova Malika'))
  assert.deepEqual(await page.evaluate(() => window.__tg.violations), [])
  await finish(o)

  const old = await openDeck({ version: '6.0' })
  await goToDeck(old)
  await old.page.getByTestId('editor-back-link').waitFor()
  await old.page.waitForFunction(() => window.__tg.app.MainButton.isVisible)
  assert.deepEqual(await old.page.evaluate(() => window.__tg.violations), [], 'nothing past 6.0 is called')
  await finish(old)

  const safe = await openDeck({ width: 390, height: 700, stable: 640, safeBottom: 34, version: '8.0' })
  await goToDeck(safe)
  await openHeading(safe, 2)
  await safe.page.evaluate(() => window.__tg.keyboard(300))
  await safe.page.waitForTimeout(300)
  const input = await safe.page.getByTestId('deck-headline').boundingBox()
  const band = await keyboardBand(safe.page)
  assert.ok(
    input.y + input.height <= band + 0.5,
    `the headline stays above the keyboard (${input.y + input.height} over ${band})`,
  )
  await finish(safe)
  return 'Telegram: one MainButton handler, none under a modal sheet; Back pops dock (saving), menu, chosen row, sheet; closing asks while words wait; 6.0 gets the HTML Back; the dock clears a keyboard'
})

await group('21 Strip scroll', async () => {
  const o = await openDeck({ width: 320, height: 426 })
  const { page } = o
  await goToDeck(o)
  const stage = () => page.evaluate(() => document.querySelector('.deck-edit-stage').scrollTop)
  const before = await stage()
  for (let step = 0; step < 6; step += 1) {
    // A click in the page itself: Playwright scrolling the button into view would hide what is measured.
    await page.getByTestId('deck-slide-next').evaluate((node) => node.click())
    await page.waitForTimeout(80)
  }
  await until(async () => (await currentSlide(page)) === 7, 'slide 7')
  await page.waitForTimeout(400)
  assert.equal(await stage(), before, 'the stage stays where it was')
  const inView = await page.evaluate(() => {
    const strip = document.querySelector('[data-testid="deck-strip"]').getBoundingClientRect()
    const thumb = document.querySelector('[data-testid="deck-thumb-7"]').getBoundingClientRect()
    return thumb.left >= strip.left - 1 && thumb.right <= strip.right + 1
  })
  assert.ok(inView, 'thumb 7 scrolled into the strip')
  await finish(o)
  return 'At 320, ‹ › to slide 7 scrolls only the strip, to its thumb'
})

await group('22 Desktop 1440', async () => {
  const o = await openDeck({ width: 1440, height: 900, inside: false })
  const { page, server } = o
  await goToDeck(o)
  assert.equal(await isBare(page), false, 'a wide browser keeps the app around it')
  const rail = page.locator('.deck-edit-strip.rail')
  await rail.waitFor()
  const railBox = await rail.boundingBox()
  assert.ok(railBox.height > railBox.width, 'the strip is a vertical rail')
  assert.equal(await page.locator('.editor-sheet[data-size="compact"]:visible').count(), 1, 'one panel')
  const panel = page.getByTestId('deck-panel')
  await panel.waitFor()
  assert.equal(Math.round((await panel.boundingBox()).width), 320)
  await panel.getByTestId('deck-cover-topic').waitFor()
  await look(o, 'root')
  await goTo(page, 2)
  await panel.getByTestId('deck-headline').waitFor()
  await look(o, 'panel')
  await page.getByTestId('deck-tab-slides').click()
  await panel.getByTestId('deck-row-1').waitFor()
  assert.equal(await page.locator('.editor-sheet[data-size="compact"]:visible').count(), 1, 'the same panel')
  await look(o, 'slides')
  await page.getByTestId('deck-tab-slides').click()
  await panel.getByTestId('deck-headline').waitFor()

  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press('ArrowRight')
  await until(async () => (await currentSlide(page)) === 3, 'ArrowRight to slide 3')
  await page.getByTestId('deck-thumb-3').focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
  assert.equal(await currentSlide(page), 3, 'arrows in the strip stay in the strip')

  await goTo(page, 2)
  let from = mark(server)
  await panel.getByTestId('deck-headline').fill('Evaporation in summer')
  await panel.getByTestId('deck-headline').blur()
  await savedPatch(
    server,
    (c) => c.sections[1].heading === 'Evaporation in summer',
    from,
    'the panel saved on blur',
  )
  await saved(page)
  await page.evaluate(() => document.activeElement?.blur())
  from = mark(server)
  await page.keyboard.press('Control+z')
  await savedPatch(server, (c) => c.sections[1].heading === 'Evaporation', from, 'Ctrl+Z')
  await page.evaluate(() => {
    window.__saveDefault = null
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyS') window.__saveDefault = event.defaultPrevented
    })
  })
  await page.keyboard.press('Control+s')
  assert.equal(
    await page.evaluate(() => window.__saveDefault),
    true,
    'Ctrl+S saves here, not the browser’s page',
  )
  await finish(o)
  return 'At 1440: the app around it, a vertical rail, one 320 px panel with the slide’s fields, the cover or the list; arrows outside the strip, blur saves, Ctrl+Z, Ctrl+S kept'
})

/* ------------------------------------------------------------------ 23-25: states, hints, the way in */

await group('23 States', async () => {
  const expired = await openDeck({ expired: true })
  await goToDeck(expired, { image: false })
  await expired.page.locator('[data-testid="deck-refusal"][data-state="gone"]').waitFor()
  assert.equal(
    await expired.page.getByTestId('deck-make-again').getAttribute('href'),
    '/en/app/create?feature=ai.pptx',
  )
  await look(expired, 'expired')
  await finish(expired)

  // Opened, then gone: Make again brings the description along, never in the address.
  const later = await openDeck({})
  await goToDeck(later)
  later.server.gone = true
  await openHeading(later, 2)
  await later.page.getByTestId('deck-headline').fill('Evaporation, too late')
  await later.page.getByTestId('deck-dock-done').click()
  await later.page.locator('[data-testid="deck-refusal"][data-state="gone"]').waitFor()
  await later.page.getByTestId('deck-make-again').click()
  await later.page.waitForURL(/\/en\/app\/create\?feature=ai\.pptx$/)
  await until(
    async () =>
      (await later.page.getByTestId('studio-primary-input').inputValue()) === 'Water cycle, 7 slides',
    'the description filled in',
  )
  assert.equal(new URL(later.page.url()).searchParams.has('prompt'), false)
  await finish(later, { lenient: true })

  const plain = await openDeck({ notEditable: true })
  await goToDeck(plain, { image: false })
  await plain.page.locator('[data-testid="deck-refusal"][data-state="not_editable"]').waitFor()
  assert.equal(
    await plain.page.getByTestId('deck-make-again').getAttribute('href'),
    '/en/app/create?feature=ai.pptx',
  )
  assert.equal(plain.server.requests.filter((entry) => entry.endpoint === RENDER).length, 0, 'nothing drawn')
  await finish(plain)

  const off = await openDeck({ editor: { editor_v2: true, deck_editor: false } })
  await goToDeck(off, { image: false })
  const refusal = off.page.locator('[data-testid="deck-refusal"][data-state="off"]')
  await refusal.waitFor()
  assert.equal(await refusal.locator('a').first().getAttribute('href'), '/en/app/jobs')
  assert.equal(off.server.requests.filter((entry) => entry.endpoint === RENDER).length, 0)
  await finish(off)

  // $fetch asks a GET once more by itself after a 500, so the open fails on the second answer.
  const failed = await openDeck({ openFails: 2 })
  await goToDeck(failed, { image: false })
  const failedState = failed.page.locator('[data-testid="deck-refusal"][data-state="failed"]')
  await failedState.waitFor()
  await failedState.getByRole('button').click()
  await failed.page.getByTestId('deck-slide-image').waitFor()
  await finish(failed)

  const soon = await openDeck({ expiresIn: 2 * 3600000, draftDelay: 600 })
  await goToDeck(soon, { image: false })
  await soon.page.getByTestId('deck-opening').waitFor()
  await soon.page.getByTestId('editor-expiring').waitFor()
  assert.equal(await soon.page.getByTestId('deck-until').getAttribute('data-soon'), 'true')
  await noPlaceholderMonth(soon.page, 'expiring')
  await finish(soon)
  return 'States: gone with Make again (filled in, not in the address, when it was open here), not editable, switched off, a failed open with Try again, opening, and two hours left'
})

await group('24 Hints', async () => {
  const o = await openDeck({
    renderPlan: (v) => (v === 3 ? ['none', 'queued', 'queued', 'queued', 'running', 'done'] : DEFAULT_PLAN),
  })
  const { page, server } = o
  await goToDeck(o, { image: false })
  await page.getByTestId('deck-blank-heading').waitFor()
  assert.equal(await page.locator('.editor-hint').count(), 0, 'no hint before a picture')
  const outlined = () =>
    page.locator('[data-testid="deck-slide"].outlined, [data-testid="deck-slide"] .outlined').count()
  assert.equal(await outlined(), 0, 'no outline before a picture')
  await page.getByTestId('deck-blank-heading').click()
  await headingDock(page).waitFor()
  await page.getByTestId('deck-dock-cancel').click()
  await headingDock(page).waitFor({ state: 'detached' })
  await page.getByTestId('deck-slide-image').waitFor({ timeout: 12000 })
  await until(async () => (await outlined()) > 0, 'the parts outlined', 2000)
  await page.getByText('Tap a part of the slide to change it').first().waitFor({ timeout: 2000 })
  // The same line says the flash's words for 2 s, so the tip is told by what it says.
  const hint = page
    .locator('p.editor-hint.deck-edit-hint')
    .filter({ hasText: 'Tap any words to change them' })
  await hint.waitFor({ timeout: 6000 })
  await openHeading(o, 1)
  await page.getByTestId('deck-headline').fill('Water cycle in nature today')
  await page.getByTestId('deck-dock-done').click()
  await savedPatch(server, (c) => c.sections[0].heading === 'Water cycle in nature today')
  await hint.waitFor({ state: 'hidden' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('deck-slide-image').waitFor()
  await page.waitForTimeout(500)
  assert.equal(await hint.count(), 0, 'retired for good')
  await page.getByTestId('editor-more').click()
  await page.getByTestId('deck-more-sheet').waitFor()
  await page.getByTestId('deck-more-tips').click()
  await page.getByTestId('editor-snackbar').filter({ hasText: 'Tips will show again.' }).waitFor()
  await hint.waitFor()
  await finish(o)
  return 'Hints: nothing before the first picture (its blank card still opens the headline); then the outline and Tap any words; retired by the first change, back from More'
})

await group('25 Edit from a task', async () => {
  const when = new Date().toISOString()
  const artifact = (id, fileId, name, mime) => ({
    id,
    name,
    size_bytes: 2_000_000,
    page_count: mime === 'application/pdf' ? 9 : null,
    mime_type: mime,
    state: 'ready',
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    page_sizes: [],
    form_fields: [],
    image_counts: [],
    encrypted: false,
    password_secret_id: null,
    preview_url: mime === 'application/pdf' ? `/api/v1/artifacts/${id}/preview` : null,
    file_id: fileId,
    role: 'user_document',
    download_url: `/api/v1/artifacts/${id}/download`,
  })
  const job = (id, feature, parameters, artifacts) => ({
    id,
    feature_id: feature,
    status: 'succeeded',
    created_at: when,
    started_at: when,
    completed_at: when,
    input_files: [],
    artifacts,
    error: null,
    warnings: [],
    parameters,
    origin_channel: 'mini_app',
  })
  const pptxRow = artifact(
    PPTX_ARTIFACT,
    '00000000-0000-4000-8000-0000000000e6',
    'Water_cycle_in_nature.pptx',
    PPTX,
  )
  const pdfRow = artifact(
    PDF_ARTIFACT,
    '00000000-0000-4000-8000-0000000000e7',
    'Water_cycle_in_nature.pdf',
    'application/pdf',
  )
  const presetJobs = [
    job(
      EXPORT_JOB,
      'export.generated_pptx',
      { generation_draft_id: DRAFT, version: 3, snapshot: 'f'.repeat(64), format: 'both', deliver: 'chat' },
      [pptxRow, pdfRow],
    ),
    job(DECK_JOB, 'ai.pptx', { generation_draft_id: DRAFT }, [pptxRow]),
  ]
  const draftReads = (server) =>
    server.requests.filter(
      (entry) => entry.method === 'GET' && entry.endpoint === `/generation/drafts/${DRAFT}`,
    ).length

  const o = await openDeck({ width: 390, height: 844, presetJobs })
  const { page, server } = o
  await page.goto(`${origin}/en/app/jobs/${EXPORT_JOB}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('artifact-edit').first().waitFor()
  await until(
    async () => (await page.getByTestId('artifact-edit').count()) === 2,
    'Edit under the PowerPoint and the PDF',
  )
  for (const href of await page
    .getByTestId('artifact-edit')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href'))))
    assert.equal(href, `/en/app/editor/deck/${DRAFT}`)
  assert.equal(await page.getByText('Review draft').count(), 0, 'one writer: no Review draft')
  await shot(o, 'job-export')
  const before = draftReads(server)
  await page.goto(`${origin}/en/app/jobs/${DECK_JOB}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('artifact-edit').first().waitFor()
  await page.waitForTimeout(500)
  assert.equal(draftReads(server) - before, 1, 'an AI deck’s draft is read once')
  assert.equal(
    await page.getByTestId('artifact-edit').first().getAttribute('href'),
    `/en/app/editor/deck/${DRAFT}`,
  )
  assert.equal(await page.getByText('Review draft').count(), 0)
  await page.getByTestId('artifact-edit').first().click()
  await page.getByTestId('deck-editor').waitFor()
  await finish(o)

  const off = await openDeck({
    width: 390,
    height: 844,
    presetJobs,
    editor: { editor_v2: true, deck_editor: false },
  })
  await off.page.goto(`${origin}/en/app/jobs/${EXPORT_JOB}`, { waitUntil: 'domcontentloaded' })
  await off.page.locator('.artifact-row').first().waitFor()
  await off.page.waitForTimeout(500)
  const hrefs = await off.page
    .getByTestId('artifact-edit')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))
  assert.deepEqual(
    hrefs,
    ['/en/app/editor?file_id=00000000-0000-4000-8000-0000000000e7'],
    'off: the PDF opens in the PDF editor, the PowerPoint in nothing',
  )
  // Slides sent from the deck editor never open the AI studio on their drawn deck, switch or not.
  assert.equal(await off.page.getByText('Review draft').count(), 0, 'off: no Review draft on sent slides')
  await off.page.goto(`${origin}/en/app/jobs/${DECK_JOB}`, { waitUntil: 'domcontentloaded' })
  await off.page.getByText('Review draft').first().waitFor()
  await finish(off)
  return 'Edit from a task: ✏️ Edit under a deck’s PowerPoint and PDF opens the deck editor and Review draft goes; an AI deck’s draft is read once; off, Review draft is back on the AI deck’s task and never on sent slides'
})

/* ------------------------------------------------------------------ 26-29: accounts, decks and Latin letters */

await group('26 Another account in the same tab', async () => {
  // Two pupils on one school computer: the first has lines kept and a Latin offer up, signs out, and the
  // second signs in without the page loading again.
  const o = await openDeck({
    width: 390,
    height: 844,
    inside: false,
    locale: 'uz',
    accounts: true,
    remembered: ['Bajardi: Karimova Dilnoza', '9-B sinf'],
  })
  const { page, server } = o
  await goToDeck(o)
  await page.getByTestId('deck-cover-open').click()
  await page.getByTestId('deck-cover-sheet').waitFor()
  await until(async () => page.getByTestId('deck-cover-remember').isChecked(), 'her kept lines read')
  await closeSheet(page, 'deck-cover-sheet')
  await openHeading(o, 2)
  await page.getByTestId('deck-headline').fill('Ҳаво ифлосланиши')
  await page.getByTestId('deck-dock-done').click()
  await page.getByTestId('deck-latin').waitFor()

  await routeTo(page, '/uz/app/settings')
  await page.getByRole('button', { name: 'Chiqish' }).first().click()
  await until(() => server.account === null, 'signed out')
  await page.getByRole('button', { name: /Mahalliy sinov hisobidan foydalanish/ }).click()
  await until(() => server.account === 'u2', 'the second account signed in')
  await page.locator('.auth-panel').waitFor({ state: 'detached' })
  const signedIn = server.requests.length
  await routeTo(page, `/uz/app/editor/deck/${DRAFT}`)
  await page.getByTestId('deck-editor').waitFor()
  await page.getByTestId('deck-slide-image').waitFor()
  await page.waitForTimeout(800)
  assert.equal(await page.getByTestId('deck-latin').count(), 0, 'no Latin offer from her deck')
  await page.getByTestId('deck-cover-open').click()
  await page.getByTestId('deck-cover-sheet').waitFor()
  await page.waitForTimeout(500)
  assert.equal(await page.getByTestId('deck-cover-filled').count(), 0, 'nothing filled in from her lines')
  for (const role of ['made', 'checked', 'group', 'school'])
    assert.equal(await page.getByTestId(`deck-cover-${role}`).inputValue(), '', `${role}: empty`)
  assert.equal(
    await page.getByTestId('deck-cover-remember').isChecked(),
    false,
    'nothing kept on this account',
  )
  await shot(o, 'second-account-cover')
  await closeSheet(page, 'deck-cover-sheet')
  await page.waitForTimeout(1200)
  assert.deepEqual(
    server.requests
      .slice(signedIn)
      .filter((entry) => JSON.stringify(entry.body ?? '').includes('Karimova'))
      .map((entry) => `${entry.method} ${entry.endpoint}`),
    [],
    'her name goes nowhere from the second account',
  )
  // The settings page asks for what it shows; the deck's own requests must still all be known.
  assert.deepEqual(
    server.unexpected.filter((entry) => /drafts|studio/.test(entry)),
    [],
  )
  await finish(o, { lenient: true })
  return 'Another account in the same tab: after sign-out and an in-page sign-in, no names kept by the last account fill the cover, and her Latin offer is gone'
})

await group('27 Leaving during a slow save', async () => {
  const first = 'Evaporation, sent first'
  const next = 'How rain forms, typed while it went'
  const both = (c) => c.sections[1].heading === first && c.sections[2].heading === next
  // A slow uplink: the first write takes 9 s, and the next words wait behind it.
  const slow = (n) => (n === 1 ? { delay: 9000 } : null)
  const editTwo = async (o) => {
    await openHeading(o, 2)
    await o.page.getByTestId('deck-headline').fill(first)
    await o.page.getByTestId('deck-dock-done').click()
    await until(() => o.server.patches.length === 1, 'the first write on its way')
    await openHeading(o, 3)
    await o.page.getByTestId('deck-headline').fill(next)
    await o.page.getByTestId('deck-dock-done').click()
    await headingDock(o.page).waitFor({ state: 'detached' })
  }

  // Away to the tasks and straight back to the same deck, as the bot's Edit link opens it.
  const o = await openDeck({ refuseSaves: slow })
  await goToDeck(o)
  await editTwo(o)
  await routeTo(o.page, '/en/app/jobs')
  await o.page.getByTestId('deck-editor').waitFor({ state: 'detached' })
  await routeTo(o.page, `/en/app/editor/deck/${DRAFT}`)
  await savedPatch(o.server, both, 0, 'the words typed during the slow write', 30000)
  await o.page.getByTestId('deck-slide').waitFor()
  await saved(o.page)
  await o.page.waitForTimeout(1500)
  assert.equal(
    await o.page.getByTestId('deck-conflict').count(),
    0,
    'no choice of versions over its own writes',
  )
  assert.ok(both(o.server.content), 'the server keeps both')
  await openHeading(o, 3)
  assert.equal(await o.page.getByTestId('deck-headline').inputValue(), next, 'and the deck shows them')
  await o.page.getByTestId('deck-dock-cancel').click()
  assert.deepEqual(
    o.server.unexpected.filter((entry) => /drafts|studio/.test(entry)),
    [],
  )
  await finish(o, { lenient: true })

  // Away to another deck: the words are saved to their own deck first, and none reach the next one.
  const d = await openDeck({ refuseSaves: slow, second: 'en' })
  await goToDeck(d)
  await editTwo(d)
  await routeTo(d.page, `/en/app/editor/deck/${OTHER_DRAFT}`)
  await savedPatch(d.server, both, 0, 'the words typed during the slow write, in their own deck', 30000)
  await until(() => d.server.other.gets > 0, 'the next deck opened')
  await d.page.getByTestId('deck-slide').waitFor()
  await d.page.waitForTimeout(1500)
  assert.deepEqual(
    d.server.other.patches.filter((attempt) =>
      [first, next].some((words) => JSON.stringify(attempt.body).includes(words)),
    ),
    [],
    'nothing of the first deck written to the second',
  )
  assert.equal(d.server.other.content.title, 'Clouds and weather')
  await finish(d)
  return 'Leaving during a slow save: words typed behind a 9 s write reach the server when the same deck is opened again at once (no false conflict) and when another deck is opened, and never land in that one'
})

await group('28 Latin letters only where taken', async () => {
  const o = await openDeck({ locale: 'uz' })
  const { page, server } = o
  // Speaker notes the customer wrote and never offered: in the deck, in no commit.
  server.content.sections[1].notes = 'Тошкент ҳақида гапиринг'
  server.history.set(server.version, clone(server.content))
  await goToDeck(o)
  await openHeading(o, 2)
  await page.getByTestId('deck-headline').fill('Тошкент шаҳри тарихи')
  await page.getByTestId('deck-dock-done').click()
  await page.getByTestId('deck-latin').waitFor()
  await page.getByTestId('deck-latin-keep').click()
  await page.getByTestId('deck-latin').waitFor({ state: 'hidden' })
  await openLines(o, 2)
  await page.getByTestId('deck-line-0').fill('Тошкент')
  await page.getByTestId('deck-dock-done').click()
  const offer = page.getByTestId('deck-latin')
  await offer.waitFor()
  assert.match(await offer.textContent(), /Тошкент → Toshkent/)
  const from = mark(server)
  await page.getByTestId('deck-latin-switch').click()
  const taken = await savedPatch(
    server,
    (c) => c.sections[1].body.split('\n')[0] === 'Toshkent',
    from,
    'the line in Latin letters',
  )
  const slide = taken.content.sections[1]
  assert.equal(slide.heading, 'Тошкент шаҳри тарихи', 'the headline kept as typed stays whole')
  assert.equal(slide.notes, 'Тошкент ҳақида гапиринг', 'notes never offered stay as written')
  assert.deepEqual(
    slide.body.split('\n').slice(1),
    DECKS.uz.sections()[0].body.split('\n').slice(1),
    'the other lines as they were',
  )
  await finish(o)
  return 'Latin letters: Switch changes the line offered, whole, and not the same letters inside a headline kept as typed or notes never offered'
})

await group('29 A Latin offer stays with its deck', async () => {
  const o = await openDeck({ locale: 'uz', second: 'en' })
  const { page, server } = o
  await goToDeck(o)
  await openHeading(o, 2)
  await page.getByTestId('deck-headline').fill('Ҳаво ифлосланиши')
  await page.getByTestId('deck-dock-done').click()
  await page.getByTestId('deck-latin').waitFor()
  await routeTo(page, `/uz/app/editor/deck/${OTHER_DRAFT}`)
  await until(() => server.other.gets > 0, 'the English deck opened')
  await page.getByTestId('deck-slide').waitFor()
  await page.waitForTimeout(800)
  assert.equal(await page.getByTestId('deck-latin').count(), 0, 'the Uzbek deck’s offer stays behind')
  await finish(o)

  // Answered only once the deck was left: nothing is offered on the next one, nor changed there.
  const late = await openDeck({ locale: 'uz', second: 'en', latinDelay: 2500 })
  await goToDeck(late)
  await openHeading(late, 2)
  await late.page.getByTestId('deck-headline').fill('Ҳаво ифлосланиши')
  await late.page.getByTestId('deck-dock-done').click()
  await until(() => late.server.latin.length === 1, 'the Latin preview asked')
  await routeTo(late.page, `/uz/app/editor/deck/${OTHER_DRAFT}`)
  await until(() => late.server.other.gets > 0, 'the English deck opened')
  await late.page.waitForTimeout(3500)
  assert.equal(
    await late.page.getByTestId('deck-latin').count(),
    0,
    'a late answer offers nothing on another deck',
  )
  assert.equal(late.server.other.patches.length, 0, 'and changes nothing there')
  await finish(late)
  return 'A Latin offer stays with its deck: gone on the next deck, and an answer that comes after leaving offers nothing there'
})

/* ------------------------------------------------------------------ 30-32: covers, pictures, drawings */

await group('30 Full and long covers', async () => {
  const FULL = [
    'Ministry of Education',
    'Subject: Natural science',
    'Topic: Water cycle in nature',
    'Prepared by: Karimova Dilnoza',
    'Checked by: Rasulova M.',
    'School No. 21',
    'Tashkent',
    '2026',
  ]
  // Eight lines and no class: a class typed now has no room, so it is refused where it would be typed, saying why.
  const full = await openDeck({ coverBody: FULL.join('\n') })
  await goToDeck(full)
  await full.page.getByTestId('deck-cover-open').click()
  await full.page.getByTestId('deck-cover-sheet').waitFor()
  await shot(full, 'cover-full')
  for (const [testid, what] of [
    ['deck-cover-group', 'the Group row of a full cover'],
    ['deck-cover-add', 'Add line on a full cover'],
  ])
    assert.match(
      await refusedAtTap(full.page.getByTestId(testid), full.page.getByTestId('deck-cover-full'), what),
      /\b8\b/,
      what,
    )
  await closeSheet(full.page, 'deck-cover-sheet')
  await full.page.waitForTimeout(1200)
  assert.equal(full.server.patches.length, 0, 'nothing changed')
  await finish(full)

  // Filled in from the last deck, on a cover with one free line: whatever the form shows goes on the cover.
  const seven = FULL.filter((line) => line !== 'School No. 21')
  const filled = await openDeck({
    coverBody: seven.join('\n'),
    remembered: ['Prepared by: Karimova Dilnoza', 'Checked by: Rasulova M.', '9-B class', 'School No. 21'],
  })
  await goToDeck(filled)
  await filled.page.getByTestId('deck-cover-open').click()
  await filled.page.getByTestId('deck-cover-sheet').waitFor()
  await filled.page.getByTestId('deck-cover-filled').waitFor()
  const shown = [
    await filled.page.getByTestId('deck-cover-group').inputValue(),
    await filled.page.getByTestId('deck-cover-school').inputValue(),
  ].filter(Boolean)
  await closeSheet(filled.page, 'deck-cover-sheet')
  const written = await savedPatch(
    filled.server,
    (c) => c.sections[0].body !== seven.join('\n'),
    0,
    'the lines filled in, saved',
  )
  const lines = written.content.sections[0].body.split('\n')
  for (const line of seven) assert.ok(lines.includes(line), `${line}: still on the cover`)
  for (const value of shown)
    assert.ok(
      lines.some((line) => line.includes(value)),
      `"${value}" was shown in the form and left off the cover: ${JSON.stringify(lines)}`,
    )
  await finish(filled)

  // A ninth line and one past 160 letters, neither touched: a new topic keeps both whole.
  const LONG =
    'Fixture subtitle on evaporation, condensation, precipitation and collection, written out at such a length that it runs well past one hundred and sixty letters in all'
  assert.ok(LONG.length > 160, `the long line is long (${LONG.length})`)
  const nine = [...FULL, LONG]
  const long = await openDeck({ coverBody: nine.join('\n') })
  await goToDeck(long)
  await long.page.getByTestId('deck-cover-open').click()
  await long.page.getByTestId('deck-cover-sheet').waitFor()
  await long.page.getByTestId('deck-cover-topic').fill('Water cycle in nature, revised')
  await closeSheet(long.page, 'deck-cover-sheet')
  const topic = await savedPatch(
    long.server,
    (c) => c.sections[0].heading === 'Water cycle in nature, revised',
    0,
    'the topic saved',
  )
  assert.equal(
    topic.content.sections[0].body,
    nine.join('\n'),
    'every line as it was, the ninth and the long one whole',
  )
  await finish(long)
  return 'Covers: on an 8-line cover the Group row and Add line stay, disabled, with the reason in sight; lines filled in all go on; a ninth line and a long one survive an edit untouched'
})

await group('31 Pictures after a dropped connection', async () => {
  const o = await openDeck({})
  const { page, server } = o
  server.picturesDown = true
  await goToDeck(o, { image: false })
  await until(() => server.renders.some((entry) => entry.answer === 'done'), 'the deck drawn')
  await page.locator('[data-testid="deck-slide"][data-state="blank"]').waitFor()
  await page.waitForTimeout(500)
  server.picturesDown = false
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'))
    window.dispatchEvent(new Event('online'))
  })
  await goTo(page, 2)
  await goTo(page, 1, { drawn: false })
  await page.locator('[data-testid="deck-slide"]:not([data-state="blank"])').waitFor({ timeout: 8000 })
  await until(
    async () => /^blob:/.test((await page.getByTestId('deck-slide-image').getAttribute('src')) || ''),
    'the cover’s picture fetched again',
    8000,
  )
  await until(
    async () =>
      /^blob:/.test(
        await page
          .getByTestId('deck-thumb-1')
          .evaluate((node) => node.querySelector('img')?.getAttribute('src') ?? ''),
      ),
    'its thumbnail fetched again',
    8000,
  )
  await finish(o)
  return 'Pictures whose fetch failed while the connection dropped are fetched again once it is back: the cover and its thumbnail show'
})

await group('32 A drawing that never ends', async () => {
  for (const forgotten of [false, true]) {
    const o = await openDeck({
      clock: true,
      renderPlan: (v) => (v >= 4 ? ['none', 'queued', 'running'] : DEFAULT_PLAN),
    })
    const { page, server } = o
    await goToDeck(o)
    await openHeading(o, 2)
    await page.getByTestId('deck-headline').fill('Evaporation, drawn late')
    await page.getByTestId('deck-dock-done').click()
    await savedPatch(server, (c) => c.sections[1].heading === 'Evaporation, drawn late')
    await until(() => server.renderPosts.some((entry) => entry.version === 4), 'a render of version 4')
    await page.getByTestId('deck-drawing').waitFor()
    // Telegram minimised for 7 minutes while the editor lane is backed up.
    await setHidden(page, true)
    await page.clock.fastForward(7 * 60_000)
    // Or away long enough for the platform to let the render go: it says `none`, and asked again, queued.
    if (forgotten) server.renderStates.delete(4)
    await setHidden(page, false)
    await page.waitForTimeout(1500)
    const off = page.locator('[data-testid="deck-preview-off"][data-reason="unavailable"]')
    // Following it again from the return is fine too, as long as that ends where it says so.
    if (!(await off.count())) await page.clock.fastForward(61_000)
    await off.waitFor({ timeout: 10000 })
    await page.getByTestId('deck-preview-retry').waitFor()
    assert.equal(await page.getByTestId('deck-drawing').count(), 0, 'no picture promised for good')
    await finish(o)
  }
  return 'A drawing still running after 7 minutes away, or let go by the platform and queued again, ends in Preview unavailable with Try again'
})

/* ------------------------------------------------------------------ 33-34: sends */

await group('33 Asked again before the send', async () => {
  // The quote ends within 15 s, so Confirm asks again first; meanwhile a PDF can no longer be made.
  const o = await openDeck({ quoteTtl: 5000 })
  const { page, server } = o
  await goToDeck(o)
  await pressMain(page)
  await reviewReady(page)
  assert.match(await page.getByTestId('editor-review-facts').textContent(), /Arrives as PowerPoint and PDF/)
  server.engineDown = true
  await pressMain(page)
  await until(
    () => server.quotes.some((entry) => entry.id && entry.body.format === 'pptx'),
    'asked again for the PowerPoint alone',
  )
  await page.waitForTimeout(1200)
  assert.equal(server.jobPosts.length, 0, 'not sent: what Review said has changed')
  await reviewReady(page)
  assert.match(await page.getByTestId('editor-review-facts').textContent(), /Arrives as PowerPoint(?! and)/)
  await page.getByTestId('deck-pptx-only').waitFor()
  await shot(o, 'review-pdf-dropped')
  await pressMain(page)
  await page.getByTestId('editor-accepted').waitFor()
  assert.equal(server.jobPosts.length, 1)
  assert.equal(
    server.quotes.find((entry) => entry.id === server.jobPosts[0].body.quote_id).body.format,
    'pptx',
  )
  await finish(o)

  // Refused at the job as expired: asked again by itself, it goes on only as Review showed it.
  const e = await openDeck({ jobAnswer: (n) => (n === 1 ? ['quote_expired', 409] : null) })
  await goToDeck(e)
  await pressMain(e.page)
  await reviewReady(e.page)
  e.server.engineDown = true
  await pressMain(e.page)
  await until(
    () => e.server.quotes.some((entry) => entry.id && entry.body.format === 'pptx'),
    'asked again for the PowerPoint alone',
  )
  await e.page.waitForTimeout(1200)
  assert.equal(e.server.jobPosts.length, 1, 'the refused send is not made again unseen')
  await reviewReady(e.page)
  await e.page.getByTestId('deck-pptx-only').waitFor()
  await pressMain(e.page)
  await e.page.getByTestId('editor-accepted').waitFor()
  assert.equal(e.server.jobPosts.length, 2)
  await finish(e)
  return 'Asked again before the send (a quote about to end, or quote_expired): with the PDF gone at the same cost, Review shows PowerPoint alone and waits for Confirm'
})

await group('34 A send that failed', async () => {
  const o = await openDeck({ width: 390, height: 844, inside: false, jobOutcome: ['render_failed'] })
  const { page } = o
  await goToDeck(o)
  await openHeading(o, 2)
  await page.getByTestId('deck-headline').fill('Evaporation, not yet sent')
  await page.getByTestId('deck-dock-done').click()
  await page.getByTestId('editor-primary').click()
  await reviewReady(page)
  assert.match(await page.getByTestId('deck-review-changes').textContent(), /Slide 2 · words changed/)
  await page.getByTestId('editor-confirm').click()
  await page.locator('[data-testid="editor-refused"][data-code="render_failed"]').waitFor({ timeout: 15000 })
  await page.getByTestId('editor-review-again').click()
  await reviewReady(page)
  const listed = await page.getByTestId('deck-review-changes').textContent()
  assert.match(listed, /Slide 2 · words changed/, 'what never arrived is still listed')
  assert.doesNotMatch(listed, /No changes since/)
  await closeSheet(page, 'deck-review-sheet')
  await page.getByTestId('editor-primary').click()
  await reviewReady(page)
  assert.match(
    await page.getByTestId('deck-review-changes').textContent(),
    /Slide 2 · words changed/,
    'and in Review opened again',
  )
  await finish(o)
  return 'After a send whose job failed, Review still lists Slide 2 · words changed, on Try again and opened again'
})

/* ------------------------------------------------------------------ 35-39: the dock and the sheets */

await group('35 The dock after hiding', async () => {
  const o = await openDeck({})
  const { page, server } = o
  await goToDeck(o)
  // Typed, saved as the app hid, then put back as it was before Done: the deck goes back too.
  await openHeading(o, 2)
  await page.getByTestId('deck-headline').fill('Evaporation at noon')
  await setHidden(page, true)
  await savedPatch(server, (c) => c.sections[1].heading === 'Evaporation at noon', 0, 'the save on hide')
  await setHidden(page, false)
  await page.getByTestId('deck-headline').fill('Evaporation')
  let from = mark(server)
  await page.getByTestId('deck-dock-done').click()
  await headingDock(page).waitFor({ state: 'detached' })
  await savedPatch(server, (c) => c.sections[1].heading === 'Evaporation', from, 'the headline put back')
  await saved(page)
  // A line added, saved on hide, and taken out again before Done.
  await openLines(o, 2)
  await addLines(page, 4)
  from = mark(server)
  await setHidden(page, true)
  await savedPatch(server, (c) => c.sections[1].body.split('\n').length === 4, from, 'the line saved on hide')
  await setHidden(page, false)
  await page.getByTestId('deck-line-3').fill('')
  from = mark(server)
  await page.getByTestId('deck-dock-done').click()
  await savedPatch(
    server,
    (c) => c.sections[1].body === DECKS.en.sections()[0].body,
    from,
    'the line taken out again',
  )
  await finish(o)

  // A new slide saved as the app hid, then cancelled: no empty slide is left behind.
  const n = await openDeck({})
  await goToDeck(n)
  await goTo(n.page, 2)
  await n.page.getByTestId('deck-strip-add').click()
  await headingDock(n.page).waitFor()
  await n.page.getByTestId('deck-headline').fill('Results')
  await setHidden(n.page, true)
  await savedPatch(n.server, (c) => c.sections.length === 8, 0, 'the new slide saved on hide')
  await setHidden(n.page, false)
  from = mark(n.server)
  await n.page.getByTestId('deck-dock-cancel').click()
  await headingDock(n.page).waitFor({ state: 'detached' })
  await savedPatch(n.server, (c) => order(c) === ORIGINAL_IDS.join(','), from, 'the cancelled slide gone')
  await until(
    async () => (await n.page.locator('[data-testid^="deck-thumb-"]').count()) === 9,
    '9 slides again',
  )
  await finish(n)
  return 'The dock after hiding: a headline or a line put back before Done is saved as put back; a new slide cancelled after a hide is taken out'
})

await group('36 Turning a tablet', async () => {
  // An iPad in Telegram: 820 wide upright, 1180 on its side, the panel from 980. WebKit says nothing as fields go.
  const o = await openDeck({ width: 820, height: 1180, inside: false })
  const { page, server } = o
  const turn = async (width, height) => {
    await asWebKit(page, true)
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(300)
    await asWebKit(page, false)
  }
  await goToDeck(o)
  await openHeading(o, 2)
  await page.getByTestId('deck-headline').fill('Evaporation, turned')
  await turn(1180, 820)
  const panel = page.getByTestId('deck-panel')
  await panel.waitFor()
  await savedPatch(
    server,
    (c) => c.sections[1].heading === 'Evaporation, turned',
    0,
    'the dock’s words, turned',
    8000,
  )
  await until(
    async () => (await panel.getByTestId('deck-headline').inputValue()) === 'Evaporation, turned',
    'the panel shows them',
  )
  // Typed in the panel and turned back within a moment.
  await goTo(page, 3)
  let from = mark(server)
  await panel.getByTestId('deck-headline').fill('How rain forms, turned back')
  await turn(820, 1180)
  await savedPatch(
    server,
    (c) => c.sections[2].heading === 'How rain forms, turned back',
    from,
    'the panel’s words, turned back',
    8000,
  )
  // The cover's details in the panel, the same.
  await turn(1180, 820)
  await panel.waitFor()
  await goTo(page, 1)
  from = mark(server)
  await panel.getByTestId('deck-cover-checked').fill('Rasulova Malika')
  await turn(820, 1180)
  await savedPatch(
    server,
    (c) => c.sections[0].body.includes('Checked by: Rasulova Malika'),
    from,
    'the cover’s words, turned back',
    8000,
  )
  await finish(o)
  return 'Turning a tablet across 980 px keeps what was typed: the dock’s words go to the panel, the panel’s and the cover’s into the deck'
})

await group('37 Split at the slide limit', async () => {
  const ten = [
    ...DECKS.en.sections()[0].body.split('\n'),
    ...EXTRA_LINES,
    'Fixture line nine',
    'Fixture line ten',
  ].join('\n')
  // A plan of 7 slides, all used, and a slide no layout holds: nowhere is Split offered to do nothing.
  const o = await openDeck({ slides: 7, bodies: { s2: ten } })
  const { page, server } = o
  // Each place says why in its own words, and the reason names the plan's count.
  const refused = async (control, reason, what) =>
    assert.match(await refusedAtTap(page.getByTestId(control), page.getByTestId(reason), what), /\b7\b/, what)
  await goToDeck(o)
  await goTo(page, 2)
  await page.getByTestId('deck-over').filter({ hasText: 'Too long for this slide' }).waitFor()
  await refused('deck-over-split', 'deck-over-full', 'under the slide')
  assert.equal(await page.getByTestId('deck-strip-add').isDisabled(), true, 'no slide added from the strip')
  await tapField(o, 2, 'body')
  await linesDock(page).waitFor()
  await budgetSays(page, 'of 6 lines')
  await page.getByTestId('deck-dock-message').getByTestId('deck-split').waitFor()
  await refused('deck-split', 'deck-split-full', 'in the dock')
  await page.getByTestId('deck-pick-layout').click()
  await page.getByTestId('deck-layout-sheet').waitFor()
  await page.getByTestId('deck-layouts-none').waitFor()
  await refused('deck-layout-split', 'deck-layout-split-why', 'among the layouts, none of which fits')
  // The reason starts where the row's words start, not under its icon.
  const edges = await page.evaluate(() =>
    ['[data-testid="deck-layout-split-why"]', '[data-testid="deck-layout-split"] > span'].map((selector) => {
      const range = document.createRange()
      range.selectNodeContents(document.querySelector(selector))
      return [...range.getClientRects()].find((line) => line.width > 1)?.left ?? NaN
    }),
  )
  assert.ok(
    Math.abs(edges[0] - edges[1]) <= 1,
    `the reason lines up with the row’s words (${edges.join(' and ')})`,
  )
  await shot(o, 'split-at-limit')
  await closeSheet(page, 'deck-layout-sheet')
  if (await linesDock(page).isVisible()) await page.getByTestId('deck-dock-cancel').click()
  await pressMain(page)
  await page.locator('[data-testid="deck-review-body"][data-stage="needs_fix"]').waitFor()
  await refused('deck-review-fix-1-split', 'deck-review-full', 'in Review')
  assert.ok(
    server.patches.every((attempt) => (attempt.body?.content?.sections?.length ?? 0) <= 7),
    'never past the limit',
  )
  await finish(o)
  return 'At the plan’s slide limit Split stays there, disabled, with the reason in sight under the slide, in the dock, among the layouts and in Review'
})

/** A paste into a field as the clipboard gives it, at the caret, or over all of it with `replace`. */
const paste = (locator, text, { replace = false } = {}) =>
  locator.evaluate(
    (input, [text, replace]) => {
      input.focus()
      input.setSelectionRange(replace ? 0 : input.value.length, input.value.length)
      const data = new DataTransfer()
      data.setData('text/plain', text)
      input.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      )
    },
    [text, replace],
  )

await group('38 Pasting more than fits', async () => {
  const pasted = NUMBER_WORDS.slice(0, 6).map(
    (word) =>
      `Fixture pasted sentence ${word}: warm air rises over the sea, cools high above the hills and turns into cloud`,
  )
  // One line past the 400 letters a line holds, made of words so the cut falls inside one.
  const longLine = Array.from(
    { length: 12 },
    (_, n) => `Fixture long pasted clause ${n + 1} about vapour rising over the warm sea`,
  ).join(', ')
  assert.ok(longLine.length > 450, `the long line is long (${longLine.length})`)
  for (const [width, height] of [
    [320, 426],
    [390, 656],
  ]) {
    // Measured slowly, so what the dock says just after the paste is about the paste alone.
    const o = await openDeck({ width, height, fitDelay: 4000 })
    const { page } = o
    await goToDeck(o)
    await openLines(o, 2)
    await addLines(page, 6)
    // A phone pastes with the keyboard up: the dock's body is then 64 px tall at 320 and 247 at 390, too
    // short to keep a note in it while the caret goes to the last row pasted.
    await page.evaluate(() => window.__tg.keyboard(253))
    await page.waitForTimeout(400)
    await paste(page.getByTestId('deck-line-5'), pasted.join('\n'))
    await page.waitForTimeout(400)
    const kept = (await dockLines(page)).join('\n')
    const lost = pasted.filter((line) => !kept.includes(line))
    assert.ok(lost.length > 0, `${label(o)}: a dock with room for two more lines took all six`)
    const note = page.getByTestId('deck-paste-note')
    assert.ok(
      ((await note.textContent({ timeout: 3000 }).catch(() => '')) || '').trim(),
      `${label(o)}: ${lost.length} pasted lines were left out and the dock says nothing`,
    )
    // Said where it can be read, not scrolled away above the row the caret went to.
    assert.equal(
      await unreadable(note),
      '',
      `${label(o)}: the note of the lines left out in sight with the keyboard up`,
    )
    await shot(o, 'dock-pasted-keyboard')

    // One line too long for a row, over the words of the last: the end is left out, and said.
    await paste(page.getByTestId('deck-line-7'), longLine, { replace: true })
    await page.waitForTimeout(400)
    const row = await page.getByTestId('deck-line-7').inputValue()
    assert.ok(
      row.length > 0 && row.length <= 400 && longLine.startsWith(row),
      `${label(o)}: the row holds the start of the long line (${row.length})`,
    )
    assert.match(
      (await note.textContent({ timeout: 3000 }).catch(() => '')) || '',
      /400/,
      `${label(o)}: the note says a row holds 400 letters`,
    )
    // In the dock's head, two lines at 320: all of it, at both sizes.
    assert.equal(
      await unreadable(note),
      '',
      `${label(o)}: the note of the line cut in sight with the keyboard up`,
    )
    await shot(o, 'dock-pasted-long-keyboard')
    await finish(o)
  }
  return 'Pasting with the keyboard up at 320x426 and 390x656: six lines into room for two, then a line past 400 letters; each time the dock says what was left out where it can be read'
})

await group('39 A sheet closed while typing in it', async () => {
  const o = await openDeck({ width: 390, height: 656 })
  const { page } = o
  await goToDeck(o)
  const tab = page.getByTestId('deck-tab-slides')
  // Telegram's Back with the field still focused, as iOS takes the field away: no blur, no focusout.
  const backAsWebKit = async (testid) => {
    await asWebKit(page, true)
    await pressBack(page)
    await page.getByTestId(testid).waitFor({ state: 'hidden' })
    await page.waitForTimeout(300)
    await asWebKit(page, false)
  }
  await page.getByTestId('deck-cover-open').click()
  await page.getByTestId('deck-cover-sheet').waitFor()
  await page.getByTestId('deck-cover-group').click()
  await until(
    async () => !(await tab.isVisible()),
    'the tab bar put away while a sheet’s field has the keyboard',
  )
  await backAsWebKit('deck-cover-sheet')
  await until(async () => tab.isVisible(), 'the Slides tab back after the cover sheet', 3000)
  await goTo(page, 8)
  await tapField(o, 8, 'body')
  await page.getByTestId('deck-questions-sheet').waitFor()
  await page.getByTestId('deck-question-0-stem').click()
  await until(async () => !(await tab.isVisible()), 'the tab bar put away in the questions sheet')
  await backAsWebKit('deck-questions-sheet')
  await until(async () => tab.isVisible(), 'the Slides tab back after the questions sheet', 3000)
  await finish(o)
  return 'A cover or questions sheet closed by Back while its field has focus brings the Slides tab back, even with no focusout (iOS)'
})

/* ------------------------------------------------------------------ 40-43: phones at 320 and 390, plurals */

await group('40 The strip at 320', async () => {
  for (const locale of ['en', 'ru', 'uz']) {
    const o = await openDeck({ width: 320, height: 426, locale })
    const { page } = o
    await goToDeck(o)
    // With the first visit's line under the slide: the flash's words, then the tip's.
    for (const wait of [300, 2500]) {
      await page.waitForTimeout(wait)
      const what = `${label(o)} after ${wait} ms`
      const boxes = await page.evaluate(() => {
        const box = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON() ?? null
        return {
          strip: box('[data-testid="deck-strip"]'),
          bar: box('.editor-tabbar'),
          cover: box('[data-testid="deck-cover-open"]'),
        }
      })
      assert.ok(boxes.strip && boxes.bar && boxes.cover, `${what}: the strip, the tab bar and Cover`)
      assert.ok(
        boxes.strip.top >= 0 && boxes.strip.bottom <= boxes.bar.top + 0.5,
        `${what}: the whole strip above the tab bar (${boxes.strip.top}-${boxes.strip.bottom}, the bar at ${boxes.bar.top})`,
      )
      assert.ok(
        boxes.cover.bottom <= Math.min(boxes.strip.top, boxes.bar.top) + 0.5,
        `${what}: Cover above the strip and the bar (${boxes.cover.top}-${boxes.cover.bottom})`,
      )
      assert.equal(await coveredBy(page.getByTestId('deck-cover-open')), '', `${what}: Cover can be tapped`)
    }
    await shot(o, 'root-strip')
    await finish(o)
  }
  return 'At 320x426 the whole strip and the Cover button sit above the tab bar in en, ru and uz, with the first visit’s line showing'
})

await group('41 Slides list actions in reach', async () => {
  for (const [width, height] of [
    [320, 426],
    [390, 656],
  ])
    for (const locale of ['ru', 'uz']) {
      const o = await openDeck({ width, height, locale })
      const { page } = o
      await goToDeck(o)
      await page.getByTestId('deck-tab-slides').click()
      await page.getByTestId('deck-slides-sheet').waitFor()
      await selectRow(page, 3)
      await page
        .getByTestId('deck-delete')
        .evaluate((node) => node.parentElement.scrollIntoView({ block: 'nearest' }))
      await page.waitForTimeout(200)
      const out = []
      for (const testid of ['deck-move-earlier', 'deck-move-later', 'deck-duplicate', 'deck-delete']) {
        const control = page.getByTestId(testid)
        // Slide 3 of a deck with room can do all four: each is there and can be used, none taken away.
        if ((await control.count()) !== 1 || (await control.isDisabled())) {
          out.push(`${testid}: ${(await control.count()) ? 'disabled' : 'not there'}`)
          continue
        }
        const clipped = await control.evaluate((node) => {
          const box = node.getBoundingClientRect()
          const row = (node.closest('.deck-edit-list-actions') ?? node.parentElement).getBoundingClientRect()
          const left = Math.max(0, row.left)
          const right = Math.min(innerWidth, row.right)
          return box.left < left - 0.5 || box.right > right + 0.5
            ? `${Math.round(box.left)}-${Math.round(box.right)} in ${Math.round(left)}-${Math.round(right)}`
            : ''
        })
        if (clipped) out.push(`${testid}: ${clipped}`)
        const covered = await coveredBy(control)
        if (covered) out.push(`${testid}: ${covered}`)
      }
      assert.deepEqual(out, [], `${label(o)}: every action of the chosen slide in sight`)
      await look(o, 'slides-actions')
      await finish(o)
    }
  return 'The chosen slide’s Earlier, Later, Duplicate and Delete all in sight at 320 and 390 in ru and uz'
})

await group('42 Typing over the budget at 320', async () => {
  const TOO_LONG = { en: /Too long for this slide/, ru: /Слишком длинно для слайда/, uz: /Slayd uchun uzun/ }
  for (const locale of ['en', 'ru', 'uz']) {
    const o = await openDeck({ width: 320, height: 426, locale })
    const { page } = o
    await goToDeck(o)
    await openLines(o, 2)
    await addLines(page, 8)
    await budgetSays(page, '8')
    // The message comes with the server's count, asked a pause (FIT_PAUSE, 1.5 s) after the last line typed.
    await page.waitForTimeout(1700)
    const message = page.getByTestId('deck-dock-message')
    await message.getByTestId('deck-pick-layout').waitFor({ timeout: 9000 })
    assert.match(await message.innerText(), TOO_LONG[locale], `${label(o)}: the too-long message up`)
    // The last line typed keeps the keyboard: the message about the budget must not sit on it.
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'deck-line-7')
    await page.evaluate(() => window.__tg.keyboard(253))
    await page.waitForTimeout(500)
    assert.equal(
      await message.getByTestId('deck-pick-layout').count(),
      1,
      `${label(o)}: the message still up with the keyboard`,
    )
    assert.equal(
      await coveredBy(page.getByTestId('deck-line-7')),
      '',
      `${label(o)}: the line being typed in sight above the keyboard`,
    )
    await shot(o, 'dock-over-keyboard')
    await finish(o)
  }
  return 'At 320 with a 253 px keyboard the line being typed stays in sight with the too-long message up, in en, ru and uz'
})

await group('43 One line', async () => {
  const want = {
    en: ['1 of 1 line', '3 of 21 lines'],
    ru: ['1 из 1 строки', '3 из 21 строки'],
    uz: ['1 qatordan 1 ta', '21 qatordan 3 ta'],
  }
  for (const locale of ['en', 'ru', 'uz']) {
    // The closing slide holds one line, slide 2 twenty-one, as the platform can count them.
    const o = await openDeck({ locale, lineRoom: { s7: 1, s2: 21 } })
    const { page } = o
    await goToDeck(o)
    for (const [n, said] of [
      [7, want[locale][0]],
      [2, want[locale][1]],
    ]) {
      await openLines(o, n)
      await until(
        async () =>
          (await page.evaluate(
            () => document.querySelector('[data-testid="deck-dock-budget"]')?.textContent.trim() ?? '',
          )) === said,
        `${label(o)}: slide ${n}’s budget to read "${said}"`,
      )
      await page.getByTestId('deck-dock-cancel').click()
      await linesDock(page).waitFor({ state: 'detached' })
    }
    await finish(o)
  }
  return 'The lines budget takes the plural of what the slide holds: 1 of 1 line, 1 из 1 строки, 3 из 21 строки'
})

/* ------------------------------------------------------------------ 45-50: pastes, small phones, leaving */

/** Made-up words to `length` letters, with a letter, not a space, where a field's limit `cut` falls. */
function longText(
  length,
  cut,
  part = (n) => `Fixture pasted words ${n} about clouds over the hills`,
  joiner = ' ',
) {
  let text = ''
  for (let n = 1; text.length < length; n += 1) text += `${n > 1 ? joiner : ''}${part(n)}`
  text = text.slice(0, length)
  return /\s/.test(text[cut - 1]) ? `${text.slice(0, cut - 1)}x${text.slice(cut)}` : text
}
/** The note a paste left in `scope`: by its own test id where it has one, else the words there that say so. */
async function pasteNoteIn(scope, max, what) {
  let note = null
  await until(
    async () => {
      const tagged = scope.locator('[data-testid$="paste-note"]')
      note = (await tagged.count())
        ? tagged.first()
        : scope
            .locator('p, span, div')
            .filter({ hasText: new RegExp(`not added|left out|\\b${max}\\b`, 'i') })
            .last()
      return (await note.count()) > 0 && ((await note.textContent()) || '').trim() !== ''
    },
    what,
    3000,
  )
  return note
}

await group('45 Pasting past what a field holds', async () => {
  const o = await openDeck({})
  const { page, server } = o
  await goToDeck(o)
  /** Pasted over a field's words: it shows the start of the paste, a note says the end was left out. */
  const pasteInto = async (field, text, max, scope, what) => {
    await paste(page.getByTestId(field), text, { replace: true })
    await page.waitForTimeout(300)
    const shown = await page.getByTestId(field).inputValue()
    assert.ok(
      shown.length >= max / 2 && shown.length <= max && text.startsWith(shown),
      `${what}: the field holds the start of the paste (${shown.length} of ${text.length})`,
    )
    const note = await pasteNoteIn(scope, max, `${what}: a note that the end was not added`)
    assert.equal(await unreadable(note), '', `${what}: the note in sight`)
    return shown
  }

  // The dock's headline (160) and speaker notes (2,000), each saved as the field shows it.
  await openHeading(o, 2)
  await pasteInto('deck-headline', longText(220, 160), 160, headingDock(page), 'a 220-letter headline')
  await shot(o, 'dock-headline-pasted')
  // The note has the title's place in the dock's head until the next key, which brings the title back.
  const dockTitle = headingDock(page).locator('.editor-dock-head > strong')
  assert.equal(await dockTitle.count(), 0, 'the dock’s title gives way to the note')
  await page.keyboard.press('Backspace')
  await headingDock(page).getByTestId('deck-paste-note').waitFor({ state: 'detached' })
  await dockTitle.waitFor()
  const heading = await page.getByTestId('deck-headline').inputValue()
  assert.equal(heading.length, 159, 'the key went into the headline')
  await page.getByTestId('deck-dock-done').click()
  await headingDock(page).waitFor({ state: 'detached' })
  await until(
    () => server.content.sections[1].heading === heading,
    'the headline saved as the field showed it',
  )

  const speakerNotes = longText(
    2500,
    2000,
    (n) => `Fixture speaker note ${n}: ask the class where the rain over the hills comes from.`,
    '\n',
  )
  await goTo(page, 2)
  await page.getByTestId('deck-slide-menu').click()
  await page.getByTestId('deck-slide-sheet').waitFor()
  await page.getByTestId('deck-menu-notes').click()
  const notesDock = page.locator('[data-testid="deck-dock"][data-field="notes"]')
  await notesDock.waitFor()
  const notes = await pasteInto('deck-notes', speakerNotes, 2000, notesDock, '2,500 letters of speaker notes')
  await shot(o, 'dock-notes-pasted')
  await page.getByTestId('deck-dock-done').click()
  await notesDock.waitFor({ state: 'detached' })
  await until(() => server.content.sections[1].notes === notes, 'the notes saved as the field showed them')

  // The Cover sheet's Topic (160).
  await goTo(page, 1)
  await page.getByTestId('deck-cover-open').click()
  const sheet = page.getByTestId('deck-cover-sheet')
  await sheet.waitFor()
  const topicText = longText(200, 160, (n) => `Fixture topic part ${n} on the water cycle`)
  const topic = await pasteInto('deck-cover-topic', topicText, 160, sheet, 'a 200-letter Topic')
  await shot(o, 'cover-topic-pasted')
  // A role line (160), its note under it.
  const madeText = longText(200, 160, (n) => `Karimova Dilnoza va Sinov O‘quvchi ${n}`)
  const made = await pasteInto('deck-cover-made', madeText, 160, sheet, 'a 200-letter Prepared by')
  await closeSheet(page, 'deck-cover-sheet')
  await until(() => server.content.sections[0].heading === topic, 'the topic saved as the field showed it')
  await until(
    () => server.content.sections[0].body.split('\n').includes(`Prepared by: ${made}`),
    'the role line saved as the field showed it',
  )

  // A question's option (500), in the Questions sheet.
  await goTo(page, 8)
  await tapField(o, 8, 'body')
  const questions = page.getByTestId('deck-questions-sheet')
  await questions.waitFor()
  const option = await pasteInto(
    'deck-question-0-option-0',
    longText(600, 500, (n) => `Fixture option ${n} about the rain`),
    500,
    questions,
    'a 600-letter option',
  )
  await shot(o, 'questions-option-pasted')
  await pressBack(page)
  await questions.waitFor({ state: 'hidden' })
  await until(
    () => server.content.questions[0].options[0] === option,
    'the option saved as the field showed it',
  )

  // A stats slide's item, pasted over the middle of its label, then its words and its value; a pros and
  // cons slide's column. Each note in the dock's head.
  await openLines(o, 4)
  const labelText = longText(200, 157, (n) => `Fixture label ${n}`)
  await page.getByTestId('deck-item-0-label').evaluate((input, text) => {
    input.focus()
    input.setSelectionRange(1, 4) // "Oceans": "cea" goes, "O" and "ns" stay
    const data = new DataTransfer()
    data.setData('text/plain', text)
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, labelText)
  await page.waitForTimeout(300)
  const itemLabel = await page.getByTestId('deck-item-0-label').inputValue()
  assert.equal(itemLabel, `O${labelText.slice(0, 157)}ns`, 'a paste over the middle keeps the words after it')
  await pasteNoteIn(linesDock(page), 160, 'a paste over the middle of a label: a note')
  const text = await pasteInto(
    'deck-item-0-text',
    longText(700, 600),
    600,
    linesDock(page),
    "a 700-letter item's words",
  )
  const value = await pasteInto(
    'deck-item-0-value',
    longText(200, 160),
    160,
    linesDock(page),
    'a 200-letter value',
  )
  await shot(o, 'dock-item-pasted')
  await page.getByTestId('deck-dock-done').click()
  await linesDock(page).waitFor({ state: 'detached' })
  await until(() => {
    const entry = server.content.sections[3].items[0]
    return entry.label === itemLabel && entry.text === text && entry.value === value
  }, 'the item saved as its fields showed it')
  await openLines(o, 6)
  const column = await pasteInto(
    'deck-column-0',
    longText(100, 80),
    80,
    linesDock(page),
    'a 100-letter column',
  )
  await page.getByTestId('deck-dock-done').click()
  await linesDock(page).waitFor({ state: 'detached' })
  await until(
    () => server.content.sections[5].columns[0] === column,
    'the column saved as the field showed it',
  )

  await page.waitForTimeout(1000)
  assert.deepEqual(
    [
      server.content.sections[1].heading,
      server.content.sections[1].notes,
      server.content.sections[0].heading,
      server.content.questions[0].options[0],
      server.content.sections[5].columns[0],
    ],
    [heading, notes, topic, option, column],
    'nothing saved later that the fields did not show',
  )
  await finish(o)

  // In the panel at 1440, the note is right under the field pasted in.
  const wide = await openDeck({ width: 1440, height: 900, inside: false })
  await goToDeck(wide)
  await goTo(wide.page, 2)
  const panel = wide.page.getByTestId('deck-panel')
  await paste(panel.getByTestId('deck-headline'), longText(220, 160), { replace: true })
  await pasteNoteIn(panel, 160, 'a 220-letter headline in the panel: a note')
  assert.equal(
    await panel
      .getByTestId('deck-headline')
      .evaluate((input) => input.nextElementSibling?.dataset.testid ?? input.nextElementSibling?.tagName),
    'deck-paste-note',
    'the panel’s note right after the field',
  )
  await shot(wide, 'panel-headline-pasted')
  await finish(wide)
  return 'Pastes past a field’s limit (headline, speaker notes, Topic, a role line, an option, an item’s label over a selection, its words and value, a column): each field shows the start, a note in sight says the end was not added (in the dock’s head in the title’s place until the next key, under the field in the sheets and the panel), and the deck saves what the field shows'
})

await group('46 Too long on a small phone', async () => {
  /** What sits over a part of the row under the slide where the stage shows it: '' when every point of it there is its own. */
  const coveredInStage = (locator) =>
    locator.evaluate((node) => {
      const view = node.closest('.deck-edit-stage').getBoundingClientRect()
      const box = node.getBoundingClientRect()
      for (const y of [box.top + 3, box.top + box.height / 2, box.bottom - 3])
        for (const at of [0.25, 0.5, 0.75]) {
          const x = box.left + box.width * at
          if (y < view.top || y > view.bottom) continue
          const hit = document.elementFromPoint(x, y)
          if (!hit || (hit !== node && !node.contains(hit)))
            return `${hit?.dataset?.testid || hit?.className || hit?.tagName || 'nothing'} at ${Math.round(x)},${Math.round(y)}`
        }
      return ''
    })
  /** The strip pinned at the foot, just above the tab bar, whole, with nothing over it. */
  const stripPinned = (page) =>
    page.evaluate(() => {
      const node = document.querySelector('[data-testid="deck-strip"]')
      const strip = node?.getBoundingClientRect()
      const bar = document.querySelector('.editor-tabbar')?.getBoundingClientRect()
      if (!strip || !bar) return 'no strip or no tab bar'
      if (strip.top < 0 || strip.bottom > bar.top + 0.5 || bar.top - strip.bottom > 16)
        return `the strip at ${Math.round(strip.top)}-${Math.round(strip.bottom)}, the bar at ${Math.round(bar.top)}`
      for (const at of [0.25, 0.5, 0.75]) {
        const hit = document.elementFromPoint(strip.left + strip.width * at, strip.top + strip.height / 2)
        if (!hit || !node.contains(hit))
          return `${hit?.dataset?.testid || hit?.className || 'nothing'} over the strip`
      }
      return ''
    })
  for (const { width, height, locale, notice } of [
    { width: 320, height: 426, locale: 'en', notice: false },
    { width: 320, height: 426, locale: 'ru', notice: false },
    { width: 320, height: 426, locale: 'uz', notice: false },
    { width: 360, height: 560, locale: 'ru', notice: true },
  ]) {
    // Slide 2 has eight lines where six fit, so the deck is drawn short.
    const o = await openDeck({ width, height, locale, overBudget: ['s2'] })
    const { page } = o
    const what = `${label(o)}${notice ? ' with the notice' : ''}`
    await goToDeck(o)
    await page.getByTestId('deck-shortened').waitFor()
    if (!notice) {
      await page.getByTestId('deck-shortened-dismiss').click()
      await page.getByTestId('deck-shortened').waitFor({ state: 'hidden' })
    }
    await page.waitForTimeout(300)
    assert.equal(await stripPinned(page), '', `${what}: on the cover, which fits, the strip pinned and whole`)

    await goTo(page, 2)
    const over = page.getByTestId('deck-over')
    await over.locator('button').first().waitFor()
    await page.evaluate(() => (document.querySelector('.deck-edit-stage').scrollTop = 0))
    await page.waitForTimeout(300)
    // As the slide first shows: the words that say it is too long whole and in sight, and nothing of the
    // row under the strip. A fix cut off by the stage's own edge says the stage scrolls; one under the strip hides.
    assert.equal(await unreadable(over.locator('span').first()), '', `${what}: the too-long words in sight`)
    const fixes = await over
      .locator('button')
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.testid))
    assert.ok(fixes.includes('deck-over-layout'), `${what}: Pick another layout under the slide (${fixes})`)
    for (const testid of fixes)
      assert.equal(await coveredInStage(page.getByTestId(testid)), '', `${what}: ${testid} under nothing`)
    await shot(o, notice ? 'over-notice' : 'over')
    // Scrolled to its end, as a thumb does: every fix whole and above the bar.
    await page.evaluate(() => {
      const stage = document.querySelector('.deck-edit-stage')
      stage.scrollTop = stage.scrollHeight
    })
    await page.waitForTimeout(200)
    for (const testid of fixes)
      assert.equal(await coveredBy(page.getByTestId(testid)), '', `${what}: ${testid} can be tapped`)
    await shot(o, notice ? 'over-notice-scrolled' : 'over-scrolled')

    await goTo(page, 3)
    await page.waitForTimeout(300)
    assert.equal(await stripPinned(page), '', `${what}: on a slide that fits, the strip pinned and whole`)
    await finish(o)
  }
  return 'A slide too long for itself at 320x426 (en, ru, uz) and 360x560 ru with the notice: its words in sight, Split and Pick another layout under nothing and tappable once scrolled to; the strip still pinned on slides that fit'
})

await group('47 Until when, at 320 in a browser', async () => {
  // Kept into tomorrow, at a time with the most to it: 12:48 PM, past the day it ends.
  const at = new Date()
  at.setDate(at.getDate() + 1)
  at.setHours(12, 48, 0, 0)
  for (const locale of ['en', 'ru', 'uz']) {
    const o = await openDeck({
      width: 320,
      height: 568,
      locale,
      inside: false,
      expiresIn: at.getTime() - Date.now(),
    })
    const { page } = o
    await goToDeck(o)
    assert.ok(
      (await page.getByTestId('editor-back').isVisible()) ||
        (await page.getByTestId('editor-back-link').isVisible()),
      `${label(o)}: the back button takes its 44 px of the bar`,
    )
    // The time's own letters, as laid out, against every box that clips them across and down (the line it
    // wraps to included), less the ellipsis drawn where one cuts: at the end of a line too wide, or of the
    // last line a clamp keeps.
    const seen = await page.getByTestId('deck-until').evaluate((node) => {
      const text = node.textContent
      const time = /\d{1,2}:\d{2}(?:\s?[AP]\.?M\.?)?/i.exec(text)
      if (!time) return { text, time: '', problem: 'no time in it' }
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      let offset = 0
      let start = null
      let end = null
      for (let leaf = walker.nextNode(); leaf; leaf = walker.nextNode()) {
        if (!start && time.index < offset + leaf.data.length) start = [leaf, time.index - offset]
        if (!end && time.index + time[0].length <= offset + leaf.data.length)
          end = [leaf, time.index + time[0].length - offset]
        offset += leaf.data.length
      }
      const range = document.createRange()
      range.setStart(...start)
      range.setEnd(...end)
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 0)
      if (!node.checkVisibility() || !rects.length) return { text, time: time[0], problem: 'not shown' }
      const clip = { left: 0, right: innerWidth, top: 0, bottom: innerHeight }
      for (let box = node; box && box !== document.body; box = box.parentElement) {
        const style = getComputedStyle(box)
        if (box !== node && style.overflowX === 'visible' && style.overflowY === 'visible') continue
        const r = box.getBoundingClientRect()
        clip.left = Math.max(clip.left, r.left + box.clientLeft)
        clip.right = Math.min(clip.right, r.left + box.clientLeft + box.clientWidth)
        clip.top = Math.max(clip.top, r.top + box.clientTop)
        clip.bottom = Math.min(clip.bottom, r.top + box.clientTop + box.clientHeight)
      }
      const style = getComputedStyle(node)
      const probe = document.createElement('span')
      probe.textContent = '…'
      Object.assign(probe.style, {
        position: 'absolute',
        visibility: 'hidden',
        whiteSpace: 'nowrap',
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
      })
      document.body.append(probe)
      const ellipsis = probe.getBoundingClientRect().width
      probe.remove()
      const wide = node.scrollWidth > node.clientWidth + 1
      const clamped = node.scrollHeight > node.clientHeight + 1
      const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3
      for (const rect of rects) {
        const lastLine = rect.bottom > clip.bottom - line + 0.5
        const right = clip.right - (wide || (clamped && lastLine) ? ellipsis : 0)
        // A range's box is the font's whole height, taller than a 1.3 line and placed by its rounded ascent
        // (measured 1 px above the first line's box at 12 px): that much past the line, above or below, is the
        // font's own room over and under the letters, not letters cut.
        const spill = Math.max(0, rect.height - line) + 1
        if (
          rect.left < clip.left - 0.5 ||
          rect.right > right + 0.5 ||
          rect.top < clip.top - 0.5 - spill ||
          rect.bottom > clip.bottom + 0.5 + spill
        )
          return {
            text,
            time: time[0],
            problem: `the time at ${Math.round(rect.left)}-${Math.round(rect.right)} x ${Math.round(rect.top)}-${Math.round(rect.bottom)}, shown ${Math.round(clip.left)}-${Math.round(right)} x ${Math.round(clip.top)}-${Math.round(clip.bottom)}`,
          }
      }
      return { text, time: time[0], problem: '' }
    })
    assert.equal(seen.problem, '', `${label(o)}: "${seen.time}" of "${seen.text}" in sight`)
    if (locale === 'en') assert.match(seen.time, /[AP]\.?M/i, `${label(o)}: AM or PM with the time`)
    await shot(o, 'root-until')
    await finish(o)
  }
  return 'At 320 in a browser, with the back button, the time a deck is kept until is whole in en (with PM), ru and uz'
})

await group('48 A save that failed, then Back and Edit', async () => {
  const edit = 'Evaporation, typed before the connection dropped'
  const editHeadline = async (o) => {
    await openHeading(o, 2)
    await o.page.getByTestId('deck-headline').fill(edit)
    await o.page.getByTestId('deck-dock-done').click()
    await headingDock(o.page).waitFor({ state: 'detached' })
  }
  /** Back to the tasks, then ✏️ Edit on the same deck, as the bot's link opens it. */
  const backAndEdit = async (o) => {
    await routeTo(o.page, '/en/app/jobs')
    await o.page.getByTestId('deck-editor').waitFor({ state: 'detached' })
    await routeTo(o.page, `/en/app/editor/deck/${DRAFT}`)
  }
  /** Slide 2's headline as its dock shows it, closed again unchanged. */
  const headlineShown = async (page) => {
    await goTo(page, 2, { drawn: false })
    await page.getByTestId('deck-slide-menu').click()
    await page.getByTestId('deck-slide-sheet').waitFor()
    await page.getByTestId('deck-menu-headline').click()
    await headingDock(page).waitFor()
    const value = await page.getByTestId('deck-headline').inputValue()
    await page.getByTestId('deck-dock-cancel').click()
    await headingDock(page).waitFor({ state: 'detached' })
    return value
  }
  const failedIcon = (page) => page.locator('[data-testid="editor-save-icon"][data-state="failed"]')
  const savedEdit = (server, from) =>
    server.patches
      .slice(from)
      .some((attempt) => attempt.status === 200 && attempt.body.content.sections[1].heading === edit)

  // A server that is down (500): the edit is still on the slide, Not saved, and goes once it can.
  const o = await openDeck({ refuseSaves: (n, body, server) => (server.down ? [500] : null) })
  await goToDeck(o)
  await editHeadline(o)
  await failedIcon(o.page).waitFor()
  await backAndEdit(o)
  await o.page.getByTestId('deck-slide').waitFor({ timeout: 30000 })
  await failedIcon(o.page).waitFor({ timeout: 8000 })
  const banner = o.page.getByTestId('editor-save-failed')
  await banner.waitFor()
  assert.match(await banner.innerText(), /Not saved/, 'after a 500: said to be not saved')
  assert.equal(await headlineShown(o.page), edit, 'after a 500: the edit still on the slide')
  assert.equal(await o.page.getByTestId('deck-conflict').count(), 0, 'after a 500: no choice of versions')
  await shot(o, 'not-saved-reopened')
  let from = mark(o.server)
  o.server.down = false
  await savedPatch(
    o.server,
    (c) => c.sections[1].heading === edit,
    from,
    'the edit tried again by itself',
    30000,
  )
  await saved(o.page)
  assert.deepEqual(
    o.server.unexpected.filter((entry) => /drafts|studio/.test(entry)),
    [],
  )
  await finish(o, { lenient: true })

  // No answer at all, each write let go after 20 s (on the fake clock): the edit is sent again, not read over.
  const h = await openDeck({ clock: true, refuseSaves: (n, body, server) => (server.down ? 'hang' : null) })
  await goToDeck(h)
  await editHeadline(h)
  await until(() => h.server.patches.length === 1, 'the first try')
  await h.page.clock.fastForward(21000)
  await failedIcon(h.page).waitFor({ timeout: 25000 })
  await backAndEdit(h)
  // Opening sees each write on its way through to its own end first.
  await until(
    async () => {
      if (await h.page.getByTestId('deck-slide').count()) return true
      await h.page.clock.fastForward(21000)
      await sleep(300)
      return false
    },
    'the deck open again after the writes with no answer',
    30000,
  )
  from = mark(h.server)
  h.server.down = false
  await until(
    async () => {
      if (savedEdit(h.server, from)) return true
      await h.page.clock.fastForward(6000)
      await sleep(300)
      return false
    },
    'the edit sent again once the server answers',
    40000,
  )
  assert.equal(await headlineShown(h.page), edit, 'after no answer: the edit on the slide')
  assert.equal(h.server.content.sections[1].heading, edit)
  await finish(h, { lenient: true })

  // Another deck instead: the edit reaches its own deck once it can, or the next deck says it was not saved.
  const d = await openDeck({ refuseSaves: (n, body, server) => (server.down ? [500] : null), second: 'en' })
  await goToDeck(d)
  await editHeadline(d)
  await failedIcon(d.page).waitFor()
  // Said on the next deck's own screen (its name in the bar), so the first deck's banner, still up while the
  // page changes over, never counts.
  const toldNotSaved = () =>
    d.page.evaluate(
      (other) =>
        location.pathname.includes(other) &&
        (document.querySelector('[data-testid="editor-topbar"] h1')?.textContent || '').includes(
          'Clouds and weather',
        ) &&
        [
          ...document.querySelectorAll('[data-testid="editor-snackbar"], [role="alert"], [role="status"]'),
        ].some((node) => {
          const box = node.getBoundingClientRect()
          return (
            box.width > 2 &&
            box.height > 2 &&
            node.checkVisibility() &&
            /\b(?:not|\w+n[’']t)\b[^.!?]*\bsaved?\b|\bunsaved\b/i.test(node.textContent)
          )
        }),
      OTHER_DRAFT,
    )
  let told = false
  await routeTo(d.page, `/en/app/editor/deck/${OTHER_DRAFT}`)
  await until(
    async () => {
      told ||= await toldNotSaved()
      return d.server.other.gets > 0 && (await d.page.getByTestId('deck-slide').count()) > 0
    },
    'the next deck open',
    30000,
  )
  for (let n = 0; n < 40 && !told; n += 1) {
    told = await toldNotSaved()
    await sleep(100)
  }
  from = mark(d.server)
  d.server.down = false
  const kept =
    told ||
    (await savedPatch(
      d.server,
      (c) => c.sections[1].heading === edit,
      from,
      'the edit in its own deck',
      25000,
    ).then(
      () => true,
      () => false,
    ))
  assert.ok(
    kept,
    'the edit left behind in a deck that failed to save is saved there later, or the person is told',
  )
  assert.deepEqual(
    d.server.other.patches.filter((attempt) => JSON.stringify(attempt.body).includes(edit)),
    [],
    'nothing of it in the next deck',
  )
  await finish(d)
  return 'A save that failed (500, or no answer in 20 s), then Back and Edit: the edit is still on the slide, Not saved, and goes once the server answers; another deck instead keeps it for its own or says so'
})

await group('49 Leaving while the next deck opens', async () => {
  // The second deck's write takes 9 s: this deck waits for it before it opens, and is left meanwhile.
  const o = await openDeck({ second: 'en', otherSaveDelay: 9000 })
  const { page, server } = o
  await goToDeck(o, { image: false, to: `/app/editor/deck/${OTHER_DRAFT}` })
  await page.getByTestId('deck-slide').waitFor()
  await goTo(page, 2, { drawn: false })
  await page.getByTestId('deck-slide-menu').click()
  await page.getByTestId('deck-slide-sheet').waitFor()
  await page.getByTestId('deck-menu-headline').click()
  await headingDock(page).waitFor()
  await page.getByTestId('deck-headline').fill('Evaporation, sent on a slow line')
  await page.getByTestId('deck-dock-done').click()
  await headingDock(page).waitFor({ state: 'detached' })
  await until(() => server.other.patches.length === 1, 'the slow write on its way')
  await routeTo(page, `/en/app/editor/deck/${DRAFT}`)
  await page.getByTestId('deck-opening').waitFor()
  await routeTo(page, '/en/app/jobs')
  await page.getByTestId('deck-editor').waitFor({ state: 'detached' })
  const left = server.requests.length
  await until(() => server.other.patches[0].status === 200, 'the slow write answered', 15000)
  // Long enough for a deck that went on opening to ask for its drawing and its pictures.
  await page.waitForTimeout(5000)
  const asked = server.requests.slice(left).map((entry) => `${entry.method} ${entry.endpoint}`)
  assert.deepEqual(
    asked.filter((line) => /\/render$|\/slides\//.test(line)),
    [],
    'no drawing followed and no slide picture fetched for a deck left while it opened',
  )
  assert.equal(
    server.other.content.sections[1].heading,
    'Evaporation, sent on a slow line',
    'the slow write landed',
  )
  assert.deepEqual(
    server.unexpected.filter((entry) => /drafts|studio/.test(entry)),
    [],
  )
  await finish(o, { lenient: true })
  return 'A deck left by Back while it waits on a slow save of the deck before: once that save lands, nothing more is asked for it, no drawing and no pictures'
})

await group('50 A line’s menu with the keyboard up', async () => {
  const o = await openDeck({ width: 320, height: 426 })
  const { page } = o
  await goToDeck(o)
  await openLines(o, 2)
  await addLines(page, 6)
  await page.evaluate(() => window.__tg.keyboard(253))
  await page.waitForTimeout(400)
  // The last line, whose Up, Down and Remove open below the 64 px the dock shows, and the first.
  for (const n of [5, 0]) {
    const menu = page.getByTestId(`deck-line-menu-${n}`)
    await menu.scrollIntoViewIfNeeded()
    await menu.click()
    await page.getByTestId(`deck-line-remove-${n}`).waitFor()
    await page.waitForTimeout(300)
    for (const action of ['up', 'down', 'remove'])
      assert.equal(
        await coveredBy(page.getByTestId(`deck-line-${action}-${n}`)),
        '',
        `${label(o)}: line ${n + 1}’s ${action} in sight above the keyboard`,
      )
    await shot(o, `dock-line-menu-${n + 1}-keyboard`)
    await menu.click()
    await page.getByTestId(`deck-line-remove-${n}`).waitFor({ state: 'detached' })
  }
  assert.match(
    (await page.evaluate(() => document.activeElement?.dataset.testid)) || '',
    /^deck-line-\d+$/,
    'the keyboard kept: a line still has focus',
  )
  await finish(o)
  return 'At 320 with a 253 px keyboard, a line’s ⋯ brings its Up, Down and Remove into sight above the keyboard, for the last line and the first'
})

await group('51 Kept lines come back in their own rows', async () => {
  // Only who made it and the school filled in, the school typed bare: no word in "Northbrook" says what it
  // is, so only the row it was typed in can say it, here and on the next deck.
  const o = await openDeck({ coverBody: '' })
  const { page, server } = o
  await goToDeck(o)
  await page.getByTestId('deck-cover-open').click()
  await page.getByTestId('deck-cover-sheet').waitFor()
  await page.getByTestId('deck-cover-made').fill('Karimova Dilnoza')
  await page.getByTestId('deck-cover-school').fill('Northbrook')
  await page.getByTestId('deck-cover-remember').check()
  await closeSheet(page, 'deck-cover-sheet')
  await savedPatch(
    server,
    (c) => c.sections[0].body.split('\n').includes('Northbrook'),
    0,
    'the cover saved with the school',
  )
  await until(() => server.coverLines.some((call) => call.method === 'POST'), 'Remember')
  assert.deepEqual(
    server.coverLines.filter((call) => call.method === 'POST').at(-1).body,
    { lines: ['Prepared by: Karimova Dilnoza', 'Northbrook'], locale: 'en', roles: ['made', 'school'] },
    'each kept line sent with the row it was typed in',
  )
  // Open again on this deck, its cover now reads "Northbrook" as no row's: the row it was kept with has it.
  await page.getByTestId('deck-cover-open').click()
  await page.getByTestId('deck-cover-sheet').waitFor()
  await until(
    async () => (await page.getByTestId('deck-cover-school').inputValue()) === 'Northbrook',
    'back in the School row',
  )
  assert.equal(await page.getByTestId('deck-cover-other-0').count(), 0, 'not an other line')
  await closeSheet(page, 'deck-cover-sheet')
  const kept = {
    remembered: [...server.remembered],
    rememberedLocale: server.rememberedLocale,
    rememberedRoles: [...server.rememberedRoles],
  }
  await finish(o)

  // The next deck, its kept lines as GET /studio/cover-lines answers them: the school back in the School row.
  const next = await openDeck({ coverBody: '', ...kept })
  await goToDeck(next)
  await next.page.getByTestId('deck-cover-open').click()
  await next.page.getByTestId('deck-cover-sheet').waitFor()
  await next.page.getByTestId('deck-cover-filled').waitFor()
  const rows = {}
  for (const role of ['made', 'checked', 'group', 'school'])
    rows[role] = await next.page.getByTestId(`deck-cover-${role}`).inputValue()
  assert.deepEqual(
    rows,
    { made: 'Karimova Dilnoza', checked: '', group: '', school: 'Northbrook' },
    'a school kept from the School row fills the School row, never the Group row',
  )
  await shot(next, 'cover-filled-school-row')
  await closeSheet(next.page, 'deck-cover-sheet')
  await savedPatch(
    next.server,
    (c) => c.sections[0].body === 'Prepared by: Karimova Dilnoza\nNorthbrook',
    0,
    'the rows filled in, saved as they were kept',
  )
  await finish(next)
  return 'Kept lines and their rows: Remember sends {lines, locale, roles} from the Cover sheet rows (made, school), and a school typed bare in the School row comes back in the School row on the next deck'
})

await group('52 Open it with words still in a dock', async () => {
  const edit = 'Evaporation, typed before the connection dropped'
  const typed = 'Clouds form, typed in the next deck and not yet done'
  const d = await openDeck({ refuseSaves: (n, body, server) => (server.down ? [500] : null), second: 'en' })
  const { page, server } = d
  await goToDeck(d)
  await openHeading(d, 2)
  await page.getByTestId('deck-headline').fill(edit)
  await page.getByTestId('deck-dock-done').click()
  await headingDock(page).waitFor({ state: 'detached' })
  await page.locator('[data-testid="editor-save-icon"][data-state="failed"]').waitFor()
  // The next deck says the last one's change was not saved, with Open it, for a few seconds.
  await routeTo(page, `/en/app/editor/deck/${OTHER_DRAFT}`)
  await until(() => server.other.gets > 0, 'the next deck read', 30000)
  await page.getByTestId('deck-slide').waitFor()
  const action = page.getByTestId('editor-snackbar-action')
  await action.waitFor()
  // Meanwhile words go into a dock there, with the keyboard up, and Done is never tapped: the headline of the
  // slide on screen, from its menu, as the note lies over the strip of slides. The deck opens on its cover,
  // whose button is Cover, not a menu: one › first.
  if ((await currentSlide(page)) === 1) {
    await page.getByTestId('deck-slide-next').click()
    await until(async () => (await currentSlide(page)) === 2, 'slide 2 from ›')
  }
  const n = await currentSlide(page)
  assert.ok(n >= 2, `a slide with a menu on screen (${n})`)
  await page.getByTestId('deck-slide-menu').click()
  await page.getByTestId('deck-slide-sheet').waitFor()
  await page.getByTestId('deck-menu-headline').click()
  await headingDock(page).waitFor()
  await page.getByTestId('deck-headline').fill(typed)
  await page.evaluate(() => window.__tg.keyboard(253))
  await page.waitForTimeout(300)
  // This deck was opened from another one, whose going must not take the keyboard's height with it.
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--editor-keyboard').trim(),
    ),
    '253px',
    'the keyboard still followed on the deck opened from the last one',
  )
  // The note lies under the keyboard, as every note does; the keyboard goes down and the dock stays open.
  await page.evaluate(() => window.__tg.keyboard(0))
  await page.waitForTimeout(300)
  assert.equal(await coveredBy(action), '', 'Open it in reach with the dock still open')
  await shot(d, 'open-it-over-a-dock')
  const tapped = server.requests.length
  await action.click()
  await until(() => page.url().includes(DRAFT), 'the first deck again', 10000)
  // The words go to the deck they were typed in, before the first deck is read again: never lost, never moved.
  await until(
    () =>
      server.other.patches.some(
        (attempt) => attempt.status === 200 && attempt.body.content.sections[n - 1].heading === typed,
      ),
    'the words typed in the dock saved to their own deck',
    15000,
  )
  const after = server.requests.slice(tapped)
  const wrote = after.findIndex(
    (entry) =>
      entry.method === 'PATCH' &&
      entry.endpoint === `/generation/drafts/${OTHER_DRAFT}` &&
      entry.body?.content?.sections?.[n - 1]?.heading === typed,
  )
  const read = after.findIndex(
    (entry) => entry.method === 'GET' && entry.endpoint === `/generation/drafts/${DRAFT}`,
  )
  assert.ok(
    wrote >= 0 && (read < 0 || wrote < read),
    `the typed words written before the first deck opens (write ${wrote}, read ${read})`,
  )
  server.down = false
  await page.getByTestId('deck-slide').waitFor({ timeout: 30000 })
  await savedPatch(
    server,
    (c) => c.sections[1].heading === edit,
    0,
    'the first deck’s own edit, saved once it can be',
    30000,
  )
  assert.equal(
    server.other.content.sections[n - 1].heading,
    typed,
    'the next deck keeps the words typed there',
  )
  assert.deepEqual(
    server.patches.filter((attempt) => JSON.stringify(attempt.body).includes(typed)),
    [],
    'none of them in the first deck',
  )
  await finish(d)
  return 'Open it on the next deck’s “not saved” note, with words typed in a dock there and not Done: they are saved to that deck before the first one opens, and the first deck’s own edit saves once it can'
})

await group('53 Words the keyboard puts in past what a field holds', async () => {
  const o = await openDeck({ width: 390, height: 656 })
  const { page, server } = o
  await goToDeck(o)
  const cdp = await o.context.newCDPSession(page)
  /** The headline shows the start of what came in, a note in sight says the end was not added: what it shows. */
  const cutAndSaid = async (text, what) => {
    const shown = await page.getByTestId('deck-headline').inputValue()
    assert.ok(
      shown.length >= 80 && shown.length <= 160 && text.startsWith(shown),
      `${what}: the headline holds the start of it (${shown.length} of ${text.length})`,
    )
    const note = await pasteNoteIn(headingDock(page), 160, `${what}: a note that the end was not added`)
    assert.equal(await unreadable(note), '', `${what}: the note in sight with the keyboard up`)
    return shown
  }

  // Android's clipboard strip and voice typing put words in as the keyboard's own: an insertText, not a paste.
  await openHeading(o, 2)
  await page.getByTestId('deck-headline').evaluate((input) => {
    input.focus()
    input.select()
  })
  await page.evaluate(() => window.__tg.keyboard(253))
  await page.waitForTimeout(300)
  const clip = longText(220, 160)
  await cdp.send('Input.insertText', { text: clip })
  await page.waitForTimeout(300)
  const inserted = await cutAndSaid(clip, 'a 220-letter insert over the headline')
  await shot(o, 'dock-headline-inserted-keyboard')
  // Full at 160, a key is refused at the tap with the note; Backspace ends it, and a key that fits says nothing.
  assert.equal(inserted.length, 160, 'the insert filled the headline')
  const dockNote = headingDock(page).locator('[data-testid="deck-paste-note"]')
  await page.keyboard.press('Backspace')
  await until(async () => (await dockNote.count()) === 0, 'Backspace ends the note')
  await page.keyboard.type('x')
  await page.waitForTimeout(200)
  assert.equal(await dockNote.count(), 0, 'a key that fits says nothing')
  await page.keyboard.type('y')
  await pasteNoteIn(headingDock(page), 160, 'a key past the 160: a note')
  const keyed = `${inserted.slice(0, -1)}x`
  assert.equal(await page.getByTestId('deck-headline').inputValue(), keyed, 'the key past the 160 refused')
  await page.getByTestId('deck-dock-done').click()
  await headingDock(page).waitFor({ state: 'detached' })
  await page.evaluate(() => window.__tg.keyboard(0))
  await until(
    () => server.content.sections[1].heading === keyed,
    'the inserted headline saved as the field showed it',
  )

  // Words the keyboard composes and commits whole: all 200 show while composing, 40 past what fits.
  await openHeading(o, 3)
  await page.getByTestId('deck-headline').fill('')
  await page.evaluate(() => window.__tg.keyboard(253))
  await page.waitForTimeout(300)
  const spoken = longText(200, 160, (n) => `Fixture spoken words ${n} about rain over the hills`)
  await cdp.send('Input.imeSetComposition', {
    text: spoken,
    selectionStart: spoken.length,
    selectionEnd: spoken.length,
  })
  await cdp.send('Input.insertText', { text: spoken })
  await page.waitForTimeout(300)
  const composed = await cutAndSaid(spoken, 'a 200-letter composition committed in the headline')
  await shot(o, 'dock-headline-composed-keyboard')
  await page.getByTestId('deck-dock-done').click()
  await headingDock(page).waitFor({ state: 'detached' })
  await until(
    () => server.content.sections[2].heading === composed,
    'the composed headline saved as the field showed it',
  )
  await finish(o)
  return 'Words the keyboard puts in past the headline’s 160 (an insert of 220 over it, a composition of 200 committed): the field shows the start, the note says the end was not added where it can be read with the keyboard up, and the deck saves what the field shows; full, a key is refused with the note and Backspace ends it'
})

await group('54 A paste note under the field pasted in', async () => {
  /**
   * '' when the paste note in `scope` sits under the field pasted in: below it, across from it, and with no
   * other field between them but `besides` (the rest of that field's own item).
   */
  const noteUnder = (page, scope, field, besides = []) =>
    page.evaluate(
      ([scope, field, besides]) => {
        const root = document.querySelector(scope)
        const input = root?.querySelector(`[data-testid="${field}"]`)
        const note = [...(root?.querySelectorAll('[data-testid$="paste-note"]') ?? [])].find((node) =>
          node.checkVisibility(),
        )
        if (!input || !note) return input ? 'no note' : `no ${field}`
        const f = input.getBoundingClientRect()
        const n = note.getBoundingClientRect()
        const across = (box) => Math.min(box.right, n.right) - Math.max(box.left, n.left) > 0
        if (n.top < f.bottom - 1)
          return `the note starts above the field’s end (${Math.round(n.top)} over ${Math.round(f.bottom)})`
        if (!across(f)) return 'the note is beside the field, not under it'
        const between = [...root.querySelectorAll('input, textarea, select')]
          .filter(
            (node) => node !== input && !besides.includes(node.dataset.testid) && node.checkVisibility(),
          )
          .filter((node) => {
            const box = node.getBoundingClientRect()
            return box.height > 0 && box.top >= f.bottom - 1 && box.bottom <= n.top + 1 && across(box)
          })
          .map((node) => node.dataset.testid || node.tagName)
        return between.length ? `${between.join(', ')} between the field and its note` : ''
      },
      [scope, field, besides],
    )

  // In the panel at 1280x720, a stats slide filled to 8 items, pasted into the first item's label.
  const wide = await openDeck({ width: 1280, height: 720, inside: false })
  await goToDeck(wide)
  await goTo(wide.page, 4)
  const panel = wide.page.getByTestId('deck-panel')
  await panel.getByTestId('deck-item-0-label').waitFor()
  for (let index = 3; index < 8; index += 1) {
    await panel.getByTestId('deck-add-line').click()
    await panel.getByTestId(`deck-item-${index}-label`).fill(`Fixture label ${NUMBER_WORDS[index]}`)
  }
  await wide.page.waitForTimeout(500)
  const first = panel.getByTestId('deck-item-0-label')
  await paste(
    first,
    longText(220, 154, (n) => `Fixture label words ${n}`),
  )
  await wide.page.waitForTimeout(500)
  assert.ok((await first.inputValue()).startsWith('Oceans'), 'the paste went in after the label’s words')
  const itemNote = await pasteNoteIn(panel, 160, 'a 220-letter paste into item 1’s label: a note')
  assert.equal(await coveredBy(first), '', 'item 1’s label still in sight after the paste')
  assert.equal(
    await noteUnder(wide.page, '[data-testid="deck-panel"]', 'deck-item-0-label', [
      'deck-item-0-text',
      'deck-item-0-value',
    ]),
    '',
    'the note under item 1, not under item 8',
  )
  assert.equal(await unreadable(itemNote), '', 'the note under item 1 in sight')
  await shot(wide, 'panel-item-pasted-note-under')
  // Twelve lines pasted into slide 2's first body line: the note sits in the last row the paste wrote, which
  // has the focus, not after the slide's last line.
  await goTo(wide.page, 2)
  const firstLine = panel.getByTestId('deck-line-0')
  await firstLine.waitFor()
  await paste(firstLine, Array.from({ length: 12 }, (_, n) => `Fixture pasted line ${n + 1}`).join('\n'))
  const lineNote = await pasteNoteIn(panel, 160, 'twelve lines into slide 2’s body: a note')
  assert.equal(
    await wide.page.evaluate(() => {
      const active = document.activeElement
      if (!/^deck-line-\d+$/.test(active?.dataset.testid ?? ''))
        return `the focus on ${active?.dataset.testid}`
      const note = [
        ...document.querySelectorAll('[data-testid="deck-panel"] [data-testid="deck-paste-note"]'),
      ].find((node) => node.checkVisibility())
      if (!note) return 'no note'
      return active.closest('.deck-edit-line')?.contains(note)
        ? ''
        : `the note is not in ${active.dataset.testid}’s row`
    }),
    '',
    'the note in the last row the paste wrote',
  )
  assert.equal(await unreadable(lineNote), '', 'the note in that row in sight')
  await shot(wide, 'panel-lines-pasted-note-in-row')
  await finish(wide)

  // The Questions sheet at 320 (options in one column) with the keyboard up: Option B at 426, Option A at 568.
  for (const [height, n, letter] of [
    [426, 1, 'B'],
    [568, 0, 'A'],
  ]) {
    const o = await openDeck({ width: 320, height })
    const { page } = o
    await goToDeck(o)
    await goTo(page, 8)
    await tapField(o, 8, 'body')
    const sheet = page.getByTestId('deck-questions-sheet')
    await sheet.waitFor()
    const option = page.getByTestId(`deck-question-0-option-${n}`)
    await option.click()
    await page.evaluate(() => window.__tg.keyboard(253))
    await page.waitForTimeout(600)
    const before = await option.inputValue()
    await paste(
      option,
      longText(2100, 500 - before.length, (k) => `Fixture option words ${k} about the rain`),
    )
    await page.waitForTimeout(600)
    const what = `${label(o)} Option ${letter} of question 1`
    const note = await pasteNoteIn(sheet, 500, `${what}: a note that the end was not added`)
    assert.equal(
      await coveredBy(option),
      '',
      `${what}: the option pasted in stays in sight above the keyboard`,
    )
    assert.equal(
      await noteUnder(page, '[data-testid="deck-questions-sheet"]', `deck-question-0-option-${n}`),
      '',
      `${what}: the note under that option`,
    )
    assert.equal(await unreadable(note), '', `${what}: the note in sight above the keyboard`)
    await shot(o, `questions-option-${letter}-pasted-keyboard`)
    await finish(o)
  }
  return 'A paste note goes under the field pasted in: item 1 of 8 in the panel at 1280x720 (and twelve lines pasted into a body line, in the last row written), Option B at 320x426 and Option A at 320x568 with the keyboard up; that field stays in sight and uncovered, and the note under it can be read'
})

await group('55 A row cleared on a full cover', async () => {
  /** The Other lines in the Cover panel, as typed. */
  const otherLines = (panel) =>
    panel
      .locator('[data-testid^="deck-cover-other-"]:not([data-testid$="-remove"])')
      .evaluateAll((nodes) => nodes.map((node) => node.value))
  /** A field emptied and left: the change goes in as the field gives up the focus. */
  const clearField = async (field) => {
    await field.fill('')
    await field.blur()
  }

  // Eight lines; who made it is cleared and a line added in its place. Read again from the saved cover, the
  // cleared row is a new one with no room on the slide, so nothing typed there can push a saved line off.
  const EIGHT = [...TITLE_LINES.en, ...EXTRA_LINES.slice(1)]
  const o = await openDeck({ width: 1280, height: 800, inside: false, coverBody: EIGHT.join('\n') })
  const { page, server } = o
  await goToDeck(o)
  const panel = page.getByTestId('deck-panel')
  await panel.getByTestId('deck-cover-topic').waitFor()
  await panel.getByTestId('deck-cover-full').waitFor()
  let from = mark(server)
  await clearField(panel.getByTestId('deck-cover-made'))
  await savedPatch(
    server,
    (c) => c.sections[0].body === EIGHT.slice(1).join('\n'),
    from,
    'the cleared row saved, seven lines',
  )
  await page.waitForTimeout(300)
  await panel.getByTestId('deck-cover-add').click()
  const added = panel.getByTestId(`deck-cover-other-${(await otherLines(panel)).length - 1}`)
  from = mark(server)
  await added.fill('Extra line')
  await added.blur()
  const eight = [...EIGHT.slice(1), 'Extra line']
  await savedPatch(
    server,
    (c) => c.sections[0].body === eight.join('\n'),
    from,
    'the added line saved, eight',
  )
  await page.waitForTimeout(300)
  assert.match(
    await refusedAtTap(
      panel.getByTestId('deck-cover-made'),
      panel.getByTestId('deck-cover-full'),
      'the cleared Prepared by row once the slide is full again',
    ),
    /\b8\b/,
  )
  assert.equal(await panel.getByTestId('deck-cover-over').count(), 0, 'nothing typed past the eight')
  assert.equal(
    await otherLines(panel).then((lines) => lines.at(-1)),
    'Extra line',
    'the added line in the form',
  )
  await shot(o, 'cover-cleared-row-refused')
  // Read again from the deck, the cover and the form say the same.
  await goTo(page, 2)
  await goTo(page, 1)
  await panel.getByTestId('deck-cover-topic').waitFor()
  assert.equal(await panel.getByTestId('deck-cover-made').isDisabled(), true, 'still refused on coming back')
  assert.equal(server.content.sections[0].body, eight.join('\n'), 'the added line stays on the slide')
  // A line the cover had, cleared: gone from the form once saved, not left as an empty field that takes words.
  from = mark(server)
  await clearField(panel.getByTestId('deck-cover-other-0'))
  await savedPatch(
    server,
    (c) => c.sections[0].body === eight.filter((line) => line !== 'Fixture line five').join('\n'),
    from,
    'the cleared other line saved',
  )
  await page.waitForTimeout(300)
  assert.deepEqual(
    await otherLines(panel),
    ['Fixture line six', 'Fixture line seven', 'Fixture line eight', 'Extra line'],
    'no empty field left where the cleared line was',
  )
  assert.equal(
    await panel.getByTestId('deck-cover-made').isDisabled(),
    false,
    'seven lines: the Prepared by row takes words again',
  )
  await finish(o)

  // Seven lines and no school: a line added and saved, then cleared and saved, is no line, so the slide has
  // room again and the School row and Add line take words.
  const SEVEN = [...TITLE_LINES.en.slice(0, 3), ...EXTRA_LINES.slice(0, 4)]
  const s = await openDeck({ width: 1280, height: 800, inside: false, coverBody: SEVEN.join('\n') })
  await goToDeck(s)
  const sevenPanel = s.page.getByTestId('deck-panel')
  await sevenPanel.getByTestId('deck-cover-topic').waitFor()
  await sevenPanel.getByTestId('deck-cover-add').click()
  const extra = sevenPanel.getByTestId('deck-cover-other-4')
  from = mark(s.server)
  await extra.fill('Extra line')
  await extra.blur()
  await savedPatch(
    s.server,
    (c) => c.sections[0].body === [...SEVEN, 'Extra line'].join('\n'),
    from,
    'the added line saved, eight',
  )
  await s.page.waitForTimeout(300)
  for (const [testid, what] of [
    ['deck-cover-school', 'the School row with eight lines'],
    ['deck-cover-add', 'Add line with eight lines'],
  ])
    await refusedAtTap(sevenPanel.getByTestId(testid), sevenPanel.getByTestId('deck-cover-full'), what)
  from = mark(s.server)
  await clearField(extra)
  await savedPatch(
    s.server,
    (c) => c.sections[0].body === SEVEN.join('\n'),
    from,
    'the cleared line saved, seven',
  )
  await s.page.waitForTimeout(300)
  assert.deepEqual(
    await otherLines(sevenPanel),
    EXTRA_LINES.slice(0, 4),
    'the cleared line gone from the form',
  )
  for (const [testid, what] of [
    ['deck-cover-school', 'the School row'],
    ['deck-cover-add', 'Add line'],
  ])
    assert.equal(
      await sevenPanel.getByTestId(testid).isDisabled(),
      false,
      `seven lines on the slide: ${what} open`,
    )
  assert.equal(
    await sevenPanel.getByTestId('deck-cover-full').count(),
    0,
    'and no note that the slide is full',
  )
  await shot(s, 'cover-cleared-added-line-room-again')
  await finish(s)
  return 'In the Cover panel at 1280, each save reads the cover again: a role row cleared on a full cover is refused at the tap once a line is added (the added line stays on the slide), a cleared line the cover had leaves no empty field, and a saved line cleared again frees its place for the School row and Add line'
})

await group('56 Undo keeps a kept school in its row', async () => {
  // A school kept from the School row, typed bare, and on the cover as the platform places it: no word in
  // "Northbrook" says what it is. Undo reads the cover again; only the kept row puts it back in the School row,
  // so the next change keeps it as the school.
  const o = await openDeck({
    width: 1280,
    height: 800,
    inside: false,
    coverBody: 'Prepared by: Karimova Dilnoza\nNorthbrook',
    remembered: ['Prepared by: Karimova Dilnoza', 'Northbrook'],
    rememberedRoles: ['made', 'school'],
  })
  const { page, server } = o
  await goToDeck(o)
  const panel = page.getByTestId('deck-panel')
  const school = panel.getByTestId('deck-cover-school')
  await panel.getByTestId('deck-cover-topic').waitFor()
  await until(async () => (await school.inputValue()) === 'Northbrook', 'Northbrook in the School row')
  let from = mark(server)
  await panel.getByTestId('deck-cover-topic').fill('Water cycle, revised')
  await panel.getByTestId('deck-cover-topic').blur()
  await savedPatch(server, (c) => c.sections[0].heading === 'Water cycle, revised', from, 'the topic saved')
  assert.equal(await school.inputValue(), 'Northbrook', 'the School row keeps it through its own save')
  from = mark(server)
  await page.getByTestId('editor-undo').click()
  await savedPatch(server, (c) => c.sections[0].heading !== 'Water cycle, revised', from, 'Undo saved')
  await page.waitForTimeout(300)
  assert.equal(await school.inputValue(), 'Northbrook', 'after Undo, Northbrook still in the School row')
  assert.equal(await panel.getByTestId('deck-cover-other-0').count(), 0, 'not an other line')
  await shot(o, 'cover-undo-kept-school')
  const posts = () => server.coverLines.filter((call) => call.method === 'POST')
  const before = posts().length
  from = mark(server)
  await panel.getByTestId('deck-cover-made').fill('Karimova Dilnoza A.')
  await panel.getByTestId('deck-cover-made').blur()
  await savedPatch(
    server,
    (c) => c.sections[0].body === 'Prepared by: Karimova Dilnoza A.\nNorthbrook',
    from,
    'the name saved',
  )
  await until(() => posts().length > before, 'the changed name kept')
  assert.deepEqual(
    posts().at(-1).body,
    { lines: ['Prepared by: Karimova Dilnoza A.', 'Northbrook'], locale: 'en', roles: ['made', 'school'] },
    'the kept school still kept, as the school',
  )
  await finish(o)
  return 'Undo under the Cover panel at 1280 leaves a kept bare school ("Northbrook") in the School row, and the next change keeps it with role school'
})

await group('57 Open it tapped once from a Cover field', async () => {
  // While a Cover field has the focus the Slides tab is hidden. A field giving the focus up to Open it would
  // bring the tab back, move the note up under the finger and land the tap on the sheet: one tap must open.
  const edit = 'Evaporation, typed before the connection dropped'
  const d = await openDeck({ refuseSaves: (n, body, server) => (server.down ? [500] : null), second: 'en' })
  const { page, server } = d
  await goToDeck(d)
  await openHeading(d, 2)
  await page.getByTestId('deck-headline').fill(edit)
  await page.getByTestId('deck-dock-done').click()
  await headingDock(page).waitFor({ state: 'detached' })
  await page.locator('[data-testid="editor-save-icon"][data-state="failed"]').waitFor()
  await routeTo(page, `/en/app/editor/deck/${OTHER_DRAFT}`)
  await until(() => server.other.gets > 0, 'the next deck read', 30000)
  await page.getByTestId('deck-slide').waitFor()
  const action = page.getByTestId('editor-snackbar-action')
  await action.waitFor()
  // Words typed in the next deck's topic with the keyboard up, then the keyboard down and the field still focused.
  await page.getByTestId('deck-cover-open').click()
  await page.getByTestId('deck-cover-sheet').waitFor()
  await page.getByTestId('deck-cover-topic').click()
  await caretAtEnd(page.getByTestId('deck-cover-topic'))
  await page.evaluate(() => window.__tg.keyboard(253))
  await page.keyboard.type(' more')
  await page.evaluate(() => window.__tg.keyboard(0))
  await page.waitForTimeout(300)
  assert.equal(
    await page.evaluate(() => document.activeElement?.dataset.testid),
    'deck-cover-topic',
    'the topic still has the focus',
  )
  assert.equal(await coveredBy(action), '', 'Open it in reach')
  const box = await action.boundingBox()
  await shot(d, 'open-it-over-the-cover-sheet')
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  await until(() => page.url().includes(DRAFT), 'the first deck from one tap on Open it', 5000)
  await until(
    () =>
      server.other.patches.some(
        (attempt) =>
          attempt.status === 200 && attempt.body.content.sections[0].heading === 'Clouds and weather more',
      ),
    'the words typed in the topic saved to their own deck',
    15000,
  )
  server.down = false
  await page.getByTestId('deck-slide').waitFor({ timeout: 30000 })
  await savedPatch(
    server,
    (c) => c.sections[1].heading === edit,
    0,
    'the first deck’s own edit, saved',
    30000,
  )
  assert.equal(
    server.other.content.sections[0].heading,
    'Clouds and weather more',
    'the next deck keeps them',
  )
  assert.deepEqual(
    server.patches.filter((attempt) => JSON.stringify(attempt.body).includes('Clouds and weather more')),
    [],
    'none of them in the first deck',
  )
  await finish(d)
  return 'Open it on the “not saved” note, tapped once with a Cover field focused and the keyboard down: the first deck opens, the words typed in the Cover go to the deck they were typed in, and the first deck’s own edit saves once it can'
})

await group('58 A line just added outlives the save before it', async () => {
  // WebKit (iPhone Telegram) leaves the focus where it is on a button's tap: Add line opens a row and focuses it,
  // and only then does the topic give the focus up and go in. The form reads the saved cover again at once; the
  // row just opened, not yet typed in, must stay, and keep the focus.
  const o = await openDeck({})
  const { page, server } = o
  await goToDeck(o)
  await page.getByTestId('deck-cover-open').click()
  await page.getByTestId('deck-cover-sheet').waitFor()
  const others = page.locator('[data-testid^="deck-cover-other-"]:not([data-testid$="-remove"])')
  const had = await others.count()
  const topic = page.getByTestId('deck-cover-topic')
  await topic.click()
  await caretAtEnd(topic)
  await page.keyboard.type(', revised')
  const heading = await topic.inputValue()
  let from = mark(server)
  // The tap as WebKit gives it: a click, and no focus taken by the button.
  await page.getByTestId('deck-cover-add').dispatchEvent('click')
  await savedPatch(server, (c) => c.sections[0].heading === heading, from, 'the topic saved')
  await page.waitForTimeout(300)
  assert.equal(await others.count(), had + 1, 'the line just added still there')
  assert.equal(await page.getByTestId(`deck-cover-other-${had}`).inputValue(), '', 'empty, as opened')
  assert.equal(
    await page.evaluate(() => document.activeElement?.dataset.testid),
    `deck-cover-other-${had}`,
    'and focused, so typing goes on in it',
  )
  await shot(o, 'cover-added-line-kept-focus')
  await page.keyboard.type('Fixture added line')
  from = mark(server)
  await page.getByTestId('deck-cover-done').click()
  await savedPatch(
    server,
    (c) => c.sections[0].body === [...TITLE_LINES.en, 'Fixture added line'].join('\n'),
    from,
    'the added line saved',
  )
  await finish(o)
  return 'A line opened with Add line and not yet typed in, tapped as WebKit taps (the topic keeps the focus until the new line takes it): the topic saves, and the new line stays, empty and focused, and saves what is typed in it'
})

/** The 4 title lines and three more, the three as Other lines. */
const SEVEN_LINES = [...TITLE_LINES.en, ...EXTRA_LINES.slice(1, 4)]

await group('59 A line emptied, then its own trash tapped', async () => {
  // Chrome and the Android WebView move the focus to a button at the press: the emptied line goes in before
  // the trash's click, and the deck answers. The lines after it move up under the finger, and the trash
  // there must not be the one the tap lands on: only the emptied line goes.
  const left = [...TITLE_LINES.en, 'Fixture line six', 'Fixture line seven']
  for (const size of [
    { width: 1280, height: 800, inside: false },
    { width: 390, height: 656, inside: true },
  ]) {
    const o = await openDeck({ ...size, coverBody: SEVEN_LINES.join('\n') })
    const { page, server } = o
    await goToDeck(o)
    let scope = page.getByTestId('deck-panel')
    if (!size.inside) await scope.getByTestId('deck-cover-topic').waitFor()
    else {
      await page.getByTestId('deck-cover-open').click()
      scope = page.getByTestId('deck-cover-sheet')
      await scope.waitFor()
    }
    assert.deepEqual(await coverOthers(scope), EXTRA_LINES.slice(1, 4), `${label(o)}: three other lines`)
    const field = scope.getByTestId('deck-cover-other-0')
    await field.click()
    await field.fill('')
    const trash = scope.getByTestId('deck-cover-other-0-remove')
    const from = mark(server)
    if (size.inside) {
      // One finger on the trash, without leaving the field first.
      await trash.scrollIntoViewIfNeeded()
      const box = await trash.boundingBox()
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    } else await trash.click()
    await savedPatch(
      server,
      (c) => !c.sections[0].body.split('\n').includes('Fixture line five'),
      from,
      `${label(o)}: line five gone`,
    )
    // A second save, if the tap took another line, would be in by now.
    await page.waitForTimeout(1500)
    assert.equal(
      server.content.sections[0].body,
      left.join('\n'),
      `${label(o)}: six and seven still on the slide`,
    )
    assert.deepEqual(
      await coverOthers(scope),
      ['Fixture line six', 'Fixture line seven'],
      `${label(o)}: and in the form`,
    )
    await shot(o, 'cover-emptied-line-trash')
    await finish(o)
  }
  return 'A line the cover had, emptied and its own trash tapped before leaving the field (a mouse at 1280, one finger at 390 Telegram): only that line goes from the slide and the form; the lines after it stay'
})

await group('60 Words typed go on in the line tapped', async () => {
  // A line emptied, then the next one tapped to change it: the emptied line goes in as its field is left, and
  // the lines after it move up. The field tapped keeps its own line, so the words go on at its end.
  const o = await openDeck({ width: 1280, height: 800, inside: false, coverBody: SEVEN_LINES.join('\n') })
  const { page, server } = o
  await goToDeck(o)
  const panel = page.getByTestId('deck-panel')
  await panel.getByTestId('deck-cover-topic').waitFor()
  await panel.getByTestId('deck-cover-other-0').fill('')
  let from = mark(server)
  await panel.getByTestId('deck-cover-other-1').click()
  await savedPatch(
    server,
    (c) => c.sections[0].body === [...TITLE_LINES.en, 'Fixture line six', 'Fixture line seven'].join('\n'),
    from,
    'the emptied line saved',
  )
  await page.waitForTimeout(300)
  assert.equal(
    await page.evaluate(() => document.activeElement?.value),
    'Fixture line six',
    'the field tapped holds its own line',
  )
  await page.keyboard.type(' (edited)')
  from = mark(server)
  await panel.getByTestId('deck-cover-topic').click()
  await savedPatch(
    server,
    (c) =>
      c.sections[0].body ===
      [...TITLE_LINES.en, 'Fixture line six (edited)', 'Fixture line seven'].join('\n'),
    from,
    'the edit saved, line seven untouched',
  )
  assert.deepEqual(await coverOthers(panel), ['Fixture line six (edited)', 'Fixture line seven'], 'the form')
  await finish(o)

  // Two lines added, the second typed, then the first tapped: the save of the second leaves the first empty,
  // where it stood, and what is typed in it is a line of its own.
  const a = await openDeck({ width: 1280, height: 800, inside: false })
  await goToDeck(a)
  const addPanel = a.page.getByTestId('deck-panel')
  await addPanel.getByTestId('deck-cover-topic').waitFor()
  await addPanel.getByTestId('deck-cover-add').click()
  await addPanel.getByTestId('deck-cover-add').click()
  assert.deepEqual(await coverOthers(addPanel), ['', ''], 'two lines added')
  await addPanel.getByTestId('deck-cover-other-1').fill('Fixture second line')
  from = mark(a.server)
  await addPanel.getByTestId('deck-cover-other-0').click()
  await savedPatch(
    a.server,
    (c) => c.sections[0].body === [...TITLE_LINES.en, 'Fixture second line'].join('\n'),
    from,
    'the second line saved',
  )
  await a.page.waitForTimeout(300)
  assert.deepEqual(
    await a.page.evaluate(() => [document.activeElement?.dataset.testid, document.activeElement?.value]),
    ['deck-cover-other-0', ''],
    'the first line tapped, still empty',
  )
  await a.page.keyboard.type('Fixture first line')
  from = mark(a.server)
  await addPanel.getByTestId('deck-cover-topic').click()
  const body = (
    await savedPatch(
      a.server,
      (c) => c.sections[0].body.split('\n').includes('Fixture first line'),
      from,
      'the first line saved',
    )
  ).content.sections[0].body.split('\n')
  assert.deepEqual(body.slice(0, 4), TITLE_LINES.en, 'the title lines as they were')
  // Saved second, the first line goes in after the second: the form follows the slide.
  assert.deepEqual(body.slice(4), ['Fixture second line', 'Fixture first line'], 'both lines whole')
  assert.deepEqual(await coverOthers(addPanel), body.slice(4), 'the form says them as the slide does')
  await shot(a, 'cover-two-added-lines')
  await finish(a)
  return 'After a save of the Cover form at 1280, the field tapped keeps its own line: a line emptied then the next tapped takes " (edited)" at its end, and of two lines added the first, tapped after the second is saved, takes its own words; no words merge into another line'
})

await group('61 A typed row stays in its row through its save', async () => {
  // Remember is ticked by one kept line. Words typed in School that read as no school, or as a class, are the
  // school's still after their own save, so the next change keeps them as the school.
  for (const [locale, value] of [
    ['uz', 'Ta’lim muassasasi: TATU'],
    ['en', '9-B'],
  ]) {
    const made = locale === 'uz' ? 'Tayyorladi: Karimova Dilnoza' : 'Prepared by: Karimova Dilnoza'
    const o = await openDeck({
      width: 1280,
      height: 800,
      inside: false,
      locale,
      coverBody: made,
      remembered: [made],
      rememberedRoles: ['made'],
    })
    const { page, server } = o
    await goToDeck(o)
    const panel = page.getByTestId('deck-panel')
    await panel.getByTestId('deck-cover-topic').waitFor()
    assert.equal(
      await panel.getByTestId('deck-cover-remember').isChecked(),
      true,
      `${locale}: Remember ticked`,
    )
    const school = panel.getByTestId('deck-cover-school')
    let from = mark(server)
    await school.fill(value)
    await school.blur()
    await savedPatch(
      server,
      (c) => c.sections[0].body === `${made}\n${value}`,
      from,
      `${locale}: the school saved`,
    )
    await until(() => keptPosts(server).length, `${locale}: the school kept`)
    await page.waitForTimeout(300)
    assert.deepEqual(
      await coverRows(panel),
      { made: 'Karimova Dilnoza', checked: '', group: '', school: value },
      `${locale}: "${value}" still in the School row after its save`,
    )
    assert.deepEqual(await coverOthers(panel), [], `${locale}: not an other line`)
    if (locale === 'uz') await shot(o, 'cover-typed-school-kept-in-row')
    from = mark(server)
    await panel
      .getByTestId('deck-cover-topic')
      .fill(locale === 'uz' ? 'Suv aylanishi' : 'Water cycle, revised')
    await panel.getByTestId('deck-cover-topic').blur()
    await savedPatch(
      server,
      (c) => c.sections[0].heading !== DECKS[o.deck].title,
      from,
      `${locale}: the topic saved`,
    )
    await page.waitForTimeout(500)
    assert.deepEqual(
      keptPosts(server).at(-1),
      { lines: [made, value], locale, roles: ['made', 'school'] },
      `${locale}: after the next change, still kept as the school`,
    )
    assert.deepEqual(server.rememberedRoles, ['made', 'school'], `${locale}: what the account keeps`)
    await finish(o)
  }
  return 'With Remember ticked, words typed in School that read as another row ("Ta’lim muassasasi: TATU", "9-B") stay in the School row through their own save, and the next change keeps them with role school'
})

await group('62 Latin letters keep a typed school in its row', async () => {
  // An Uzbek deck, Remember ticked by one kept line, and a school typed in Cyrillic in the School row, then put
  // in Latin letters: no word of "TATU" says a school, so only the row it was typed in can. It stays in the
  // School row, through their Undo and Redo too, and the account keeps it in Latin, as the school. On a phone the
  // sheet may be closed by then.
  const asKept = {
    locale: 'uz',
    coverBody: 'Bajardi: Karimova Dilnoza\n9-B sinf',
    remembered: ['Bajardi: Karimova Dilnoza'],
    rememberedRoles: ['made'],
  }
  const cyrillic = ['Bajardi: Karimova Dilnoza', '9-B sinf', 'ТАТУ']
  const latin = ['Bajardi: Karimova Dilnoza', '9-B sinf', 'TATU']
  const roles = ['made', 'group', 'school']
  /** The school typed and gone in, kept in Cyrillic, and the Latin offer taken: the kept lines posted since. */
  async function typedThenLatin(o, scope, close) {
    const { page, server } = o
    let from = mark(server)
    await scope.getByTestId('deck-cover-school').fill('ТАТУ')
    await close()
    await savedPatch(server, (c) => c.sections[0].body === cyrillic.join('\n'), from, 'the school saved')
    await until(() => keptPosts(server).length, 'the school kept')
    assert.deepEqual(keptPosts(server).at(-1), { lines: cyrillic, locale: 'uz', roles }, 'kept in Cyrillic')
    await page.getByTestId('deck-latin').waitFor()
    const posted = keptPosts(server).length
    from = mark(server)
    await page.getByTestId('deck-latin-switch').click()
    await savedPatch(server, (c) => c.sections[0].body === latin.join('\n'), from, 'the Latin letters saved')
    return posted
  }
  async function keptInLatin(o, posted) {
    await until(() => keptPosts(o.server).length > posted, `${label(o)}: the kept lines in Latin letters`)
    assert.deepEqual(
      keptPosts(o.server).at(-1),
      { lines: latin, locale: 'uz', roles },
      `${label(o)}: kept in Latin letters, each with its row`,
    )
  }
  /** Undo or Redo tapped and saved: the cover's lines back as `lines`, the school in the School row still. */
  async function stepped(o, scope, testid, lines, what) {
    const from = mark(o.server)
    await o.page.getByTestId(testid).click()
    await savedPatch(o.server, (c) => c.sections[0].body === lines.join('\n'), from, `${what} saved`)
    await o.page.waitForTimeout(300)
    assert.equal(
      await scope.getByTestId('deck-cover-school').inputValue(),
      lines[2],
      `${what}: in the School row`,
    )
    assert.deepEqual(await coverOthers(scope), [], `${what}: not an other line`)
  }

  const o = await openDeck({ width: 1280, height: 800, inside: false, ...asKept })
  await goToDeck(o)
  const panel = o.page.getByTestId('deck-panel')
  await panel.getByTestId('deck-cover-topic').waitFor()
  const posted = await typedThenLatin(o, panel, () => panel.getByTestId('deck-cover-school').blur())
  await o.page.waitForTimeout(300)
  assert.equal(await panel.getByTestId('deck-cover-school').inputValue(), 'TATU', 'TATU in the School row')
  assert.deepEqual(await coverOthers(panel), [], 'not an other line')
  await keptInLatin(o, posted)
  await shot(o, 'cover-latin-school-in-row')
  // Undo puts it back in Cyrillic, though the account keeps it in Latin by then; Redo in Latin again. No word
  // of either says a school: its place on the cover does.
  await stepped(o, panel, 'editor-undo', cyrillic, 'Undo of the Latin letters')
  await shot(o, 'cover-latin-undone-school-in-row')
  await stepped(o, panel, 'editor-redo', latin, 'Redo of the Latin letters')
  // The next change keeps it as the school.
  let from = mark(o.server)
  await panel.getByTestId('deck-cover-made').fill('Karimova Dilnoza A.')
  await panel.getByTestId('deck-cover-made').blur()
  await savedPatch(
    o.server,
    (c) => c.sections[0].body.includes('Karimova Dilnoza A.'),
    from,
    'the name saved',
  )
  await until(
    () => keptPosts(o.server).at(-1).lines[0] === 'Bajardi: Karimova Dilnoza A.',
    'the changed name kept',
  )
  assert.deepEqual(
    keptPosts(o.server).at(-1),
    { lines: ['Bajardi: Karimova Dilnoza A.', '9-B sinf', 'TATU'], locale: 'uz', roles },
    'the school still kept, as the school',
  )
  // Back to Cyrillic past the name's Undo, and the next change keeps the Cyrillic school as the school.
  await stepped(o, panel, 'editor-undo', latin, 'Undo of the name')
  await stepped(o, panel, 'editor-undo', cyrillic, 'Undo of the Latin letters again')
  const before = keptPosts(o.server).length
  from = mark(o.server)
  await panel.getByTestId('deck-cover-topic').fill('Suv aylanishi')
  await panel.getByTestId('deck-cover-topic').blur()
  await savedPatch(o.server, (c) => c.sections[0].heading === 'Suv aylanishi', from, 'the topic saved')
  await until(() => keptPosts(o.server).length > before, 'kept after the topic')
  assert.deepEqual(
    keptPosts(o.server).at(-1),
    { lines: cyrillic, locale: 'uz', roles },
    'after Undo of the Latin letters, the next change keeps ТАТУ as the school',
  )
  await finish(o)

  // A phone: the sheet closed before the offer is taken, so no form is open to hear it.
  const p = await openDeck(asKept)
  const { page } = p
  await goToDeck(p)
  await page.getByTestId('deck-cover-open').click()
  const sheet = page.getByTestId('deck-cover-sheet')
  await sheet.waitFor()
  await keptInLatin(p, await typedThenLatin(p, sheet, () => closeSheet(page, 'deck-cover-sheet')))
  await page.getByTestId('deck-cover-open').click()
  await sheet.waitFor()
  await until(
    async () => (await sheet.getByTestId('deck-cover-school').inputValue()) === 'TATU',
    'TATU in the School row, opened again',
  )
  assert.deepEqual(await coverOthers(sheet), [], 'not an other line, nor a Cyrillic one')
  assert.ok(
    !Object.values(await coverRows(sheet)).some((value) => /[Ѐ-ӿ]/u.test(value)),
    'no row filled in Cyrillic',
  )
  await sheet.getByTestId('deck-cover-school').scrollIntoViewIfNeeded()
  await shot(p, 'cover-latin-school-reopened')
  await closeSheet(page, 'deck-cover-sheet')
  await finish(p)
  return 'A school typed in Cyrillic in the School row (ТАТУ) and put in Latin letters stays in the School row as TATU, and the account keeps it in Latin with role school, at 1280 and on a phone with the sheet closed before the offer is taken; at 1280 their Undo and Redo leave it in the School row, and a change after the Undo keeps ТАТУ as the school'
})

await group('63 KURS ISHI is no class', async () => {
  // "KURS ISHI" heads an Uzbek course paper's cover: a piece of work, not a year of study. It is an other line,
  // the Class row stays empty, and Remember never keeps it as the group.
  const o = await openDeck({
    width: 1280,
    height: 800,
    inside: false,
    locale: 'uz',
    coverBody: 'KURS ISHI\nBajardi: Karimova Dilnoza',
    remembered: ['Bajardi: Karimova Dilnoza'],
    rememberedRoles: ['made'],
  })
  const { page, server } = o
  await goToDeck(o)
  const panel = page.getByTestId('deck-panel')
  await panel.getByTestId('deck-cover-topic').waitFor()
  assert.deepEqual(
    await coverRows(panel),
    { made: 'Karimova Dilnoza', checked: '', group: '', school: '' },
    'the Class row empty',
  )
  assert.deepEqual(await coverOthers(panel), ['KURS ISHI'], 'an other line')
  await shot(o, 'cover-kurs-ishi')
  const from = mark(server)
  await panel.getByTestId('deck-cover-made').fill('Karimova Dilnoza A.')
  await panel.getByTestId('deck-cover-made').blur()
  await savedPatch(
    server,
    (c) => c.sections[0].body === 'KURS ISHI\nBajardi: Karimova Dilnoza A.',
    from,
    'the name saved',
  )
  await until(() => keptPosts(server).length, 'the changed name kept')
  await page.waitForTimeout(300)
  assert.ok(
    keptPosts(server).every(
      (post) => !post.lines.some((line, n) => line === 'KURS ISHI' && post.roles[n] === 'group'),
    ),
    'KURS ISHI never kept as the group',
  )
  assert.deepEqual(
    keptPosts(server).at(-1),
    { lines: ['Bajardi: Karimova Dilnoza A.'], locale: 'uz', roles: ['made'] },
    'only who made it kept',
  )
  await finish(o)
  return 'A cover headed "KURS ISHI" reads it as an other line with the Class row empty, and Remember keeps only who made it, never KURS ISHI as the group'
})

await group('64 Kept-line writes go one at a time', async () => {
  // Remember ticked by two kept lines, the school in Cyrillic. A write of kept lines answered late (a slow
  // downlink) is the one the next write starts from: Latin letters taken while the class just typed is on its
  // way keep the class too, and taken while Forget is on its way keep nothing again.
  const asKept = {
    width: 1280,
    height: 800,
    inside: false,
    locale: 'uz',
    coverBody: 'Bajardi: Karimova Dilnoza\nТошкент',
    remembered: ['Bajardi: Karimova Dilnoza', 'Тошкент'],
    rememberedRoles: ['made', 'school'],
  }
  /** The deck open at 1280 with the kept school in the School row. */
  async function opened() {
    const o = await openDeck(asKept)
    await goToDeck(o)
    const panel = o.page.getByTestId('deck-panel')
    await panel.getByTestId('deck-cover-topic').waitFor()
    await until(
      async () => (await panel.getByTestId('deck-cover-school').inputValue()) === 'Тошкент',
      'Тошкент in the School row',
    )
    return { o, panel }
  }
  const answered = (server) => server.coverLines.every((call) => call.answered)

  const { o, panel } = await opened()
  const { page, server } = o
  server.lateCoverLines = { POST: 3000 }
  let from = mark(server)
  await panel.getByTestId('deck-cover-group').fill('9-B sinf')
  await panel.getByTestId('deck-cover-group').blur()
  await savedPatch(server, (c) => c.sections[0].body.includes('9-B sinf'), from, 'the class saved')
  await until(() => keptPosts(server).length, 'the class on its way to the account')
  await page.getByTestId('deck-latin').waitFor()
  assert.equal(server.coverLines.at(-1).answered, undefined, 'the offer taken before the class is answered')
  from = mark(server)
  await page.getByTestId('deck-latin-switch').click()
  await savedPatch(server, (c) => c.sections[0].body.includes('Toshkent'), from, 'the Latin letters saved')
  await until(() => keptPosts(server).length === 2 && answered(server), 'every write answered', 8000)
  await page.waitForTimeout(300)
  const posts = server.coverLines.filter((call) => call.method === 'POST')
  assert.deepEqual(
    posts.map((call) => call.body),
    [
      {
        lines: ['Bajardi: Karimova Dilnoza', '9-B sinf', 'Тошкент'],
        locale: 'uz',
        roles: ['made', 'group', 'school'],
      },
      {
        lines: ['Bajardi: Karimova Dilnoza', '9-B sinf', 'Toshkent'],
        locale: 'uz',
        roles: ['made', 'group', 'school'],
      },
    ],
    'the class kept, then all of it in Latin letters',
  )
  assert.ok(posts[1].at >= posts[0].answered, 'the Latin letters sent once the class was answered')
  assert.deepEqual(
    [server.remembered, server.rememberedRoles],
    [
      ['Bajardi: Karimova Dilnoza', '9-B sinf', 'Toshkent'],
      ['made', 'group', 'school'],
    ],
    'what the account keeps',
  )
  assert.deepEqual(
    await coverRows(panel),
    { made: 'Karimova Dilnoza', checked: '', group: '9-B sinf', school: 'Toshkent' },
    'each in its row',
  )
  await shot(o, 'cover-latin-after-a-late-keep')
  await finish(o)

  // Remember unticked, its Forget answered late, and the offer taken meanwhile.
  const { o: q, panel: form } = await opened()
  from = mark(q.server)
  await form.getByTestId('deck-cover-topic').fill('Suv aylanishi')
  await form.getByTestId('deck-cover-topic').blur()
  await savedPatch(q.server, (c) => c.sections[0].heading === 'Suv aylanishi', from, 'the topic saved')
  await q.page.getByTestId('deck-latin').waitFor()
  q.server.lateCoverLines = { DELETE: 3000 }
  await form.getByTestId('deck-cover-remember').click()
  await until(() => q.server.coverLines.some((call) => call.method === 'DELETE'), 'Forget on its way')
  assert.equal(q.server.coverLines.at(-1).answered, undefined, 'the offer taken before Forget is answered')
  from = mark(q.server)
  await q.page.getByTestId('deck-latin-switch').click()
  await savedPatch(q.server, (c) => c.sections[0].body.includes('Toshkent'), from, 'the Latin letters saved')
  await until(() => answered(q.server), 'Forget answered', 8000)
  await q.page.waitForTimeout(800)
  const forgot = q.server.coverLines.findIndex((call) => call.method === 'DELETE')
  assert.deepEqual(
    q.server.coverLines.slice(forgot + 1).map((call) => [call.method, call.body]),
    [],
    'nothing kept again after Forget',
  )
  assert.deepEqual(q.server.remembered, [], 'the account keeps nothing')
  assert.equal(await form.getByTestId('deck-cover-remember').isChecked(), false, 'Remember unticked')
  await finish(q)

  // The Forget link, answered late, and the topic changed meanwhile: that commit keeps nothing again.
  const f = await openDeck({
    ...asKept,
    coverBody: 'Bajardi: Karimova Dilnoza\n9-B sinf',
    remembered: ['Bajardi: Karimova Dilnoza', '9-B sinf'],
    rememberedRoles: ['made', 'group'],
  })
  await goToDeck(f)
  const sheet = f.page.getByTestId('deck-panel')
  await sheet.getByTestId('deck-cover-forget').waitFor()
  f.server.lateCoverLines = { DELETE: 3000 }
  await sheet.getByTestId('deck-cover-forget').click()
  await until(() => f.server.coverLines.some((call) => call.method === 'DELETE'), 'Forget on its way')
  assert.equal(await sheet.getByTestId('deck-cover-remember').isChecked(), false, 'Remember unticked at once')
  from = mark(f.server)
  await sheet.getByTestId('deck-cover-topic').fill('Suv aylanishi')
  await sheet.getByTestId('deck-cover-topic').blur()
  await savedPatch(f.server, (c) => c.sections[0].heading === 'Suv aylanishi', from, 'the topic saved')
  assert.equal(
    f.server.coverLines.find((call) => call.method === 'DELETE').answered,
    undefined,
    'the topic saved before Forget is answered',
  )
  await until(() => answered(f.server), 'Forget answered', 8000)
  await f.page.waitForTimeout(800)
  const gone = f.server.coverLines.findIndex((call) => call.method === 'DELETE')
  assert.deepEqual(
    f.server.coverLines.slice(gone + 1).map((call) => [call.method, call.body]),
    [],
    'nothing kept again after the Forget link',
  )
  assert.deepEqual(f.server.remembered, [], 'the account keeps nothing after the Forget link')
  assert.equal(await sheet.getByTestId('deck-cover-remember').isChecked(), false, 'Remember still unticked')
  assert.equal(await sheet.getByTestId('deck-cover-forget').count(), 0, 'the Forget link gone')
  await finish(f)

  // The Forget link refused, late, and the class changed meanwhile: Remember is ticked again and the change kept.
  const r = await openDeck({
    ...asKept,
    coverBody: 'Bajardi: Karimova Dilnoza\n9-B sinf',
    remembered: ['Bajardi: Karimova Dilnoza', '9-B sinf'],
    rememberedRoles: ['made', 'group'],
  })
  await goToDeck(r)
  const refusedSheet = r.page.getByTestId('deck-panel')
  await refusedSheet.getByTestId('deck-cover-forget').waitFor()
  r.server.refuseCoverLines = { DELETE: 2500 }
  await refusedSheet.getByTestId('deck-cover-forget').click()
  await until(() => r.server.coverLines.some((call) => call.method === 'DELETE'), 'Forget on its way')
  // A second tap while the first is on its way is not a second Forget.
  await refusedSheet.getByTestId('deck-cover-forget').click()
  from = mark(r.server)
  await refusedSheet.getByTestId('deck-cover-group').fill('10-A sinf')
  await refusedSheet.getByTestId('deck-cover-group').blur()
  await savedPatch(r.server, (c) => c.sections[0].body.includes('10-A sinf'), from, 'the class saved')
  await until(
    () => answered(r.server) && keptPosts(r.server).length,
    'the class kept after the refusal',
    8000,
  )
  await r.page.waitForTimeout(600)
  assert.deepEqual(
    r.server.coverLines.filter((call) => call.method !== 'GET').map((call) => call.method),
    ['DELETE', 'POST'],
    'one Forget, then one write',
  )
  assert.deepEqual(
    keptPosts(r.server).at(-1),
    { lines: ['Bajardi: Karimova Dilnoza', '10-A sinf'], locale: 'uz', roles: ['made', 'group'] },
    'the class changed meanwhile kept',
  )
  assert.deepEqual(
    [r.server.remembered, r.server.rememberedRoles],
    [
      ['Bajardi: Karimova Dilnoza', '10-A sinf'],
      ['made', 'group'],
    ],
    'the account keeps the changed class',
  )
  assert.equal(
    await refusedSheet.getByTestId('deck-cover-remember').isChecked(),
    true,
    'Remember ticked again',
  )
  await finish(r)

  // The same refusal with the form opened again meanwhile (another slide and back): the closed form
  // keeps nothing again, and what the person does in the new one stands.
  const nonGet = (server) =>
    server.coverLines.filter((call) => call.method !== 'GET').map((call) => call.method)
  async function reopenedWhileRefused() {
    const o = await openDeck({
      ...asKept,
      coverBody: 'Bajardi: Karimova Dilnoza\n9-B sinf',
      remembered: ['Bajardi: Karimova Dilnoza', '9-B sinf'],
      rememberedRoles: ['made', 'group'],
    })
    await goToDeck(o)
    const panel = o.page.getByTestId('deck-panel')
    await panel.getByTestId('deck-cover-forget').waitFor()
    o.server.refuseCoverLines = { DELETE: 3500 }
    await panel.getByTestId('deck-cover-forget').click()
    await until(() => o.server.coverLines.some((call) => call.method === 'DELETE'), 'Forget on its way')
    await goTo(o.page, 2)
    await goTo(o.page, 1)
    await panel.getByTestId('deck-cover-topic').waitFor()
    return { o, panel }
  }
  // Forget tapped again in the new form: the account keeps nothing.
  const { o: g, panel: again } = await reopenedWhileRefused()
  await again.getByTestId('deck-cover-forget').click()
  await until(() => nonGet(g.server).length === 2 && answered(g.server), 'both Forgets answered', 9000)
  await g.page.waitForTimeout(800)
  assert.deepEqual(nonGet(g.server), ['DELETE', 'DELETE'], 'opened again: two Forgets and no write')
  assert.deepEqual(g.server.remembered, [], 'opened again: the account keeps nothing')
  assert.equal(
    await again.getByTestId('deck-cover-remember').isChecked(),
    false,
    'opened again: Remember unticked',
  )
  await finish(g)
  // The class changed in the new form: that change is what the account keeps.
  const { o: c, panel: changed } = await reopenedWhileRefused()
  from = mark(c.server)
  await changed.getByTestId('deck-cover-group').fill('10-A sinf')
  await changed.getByTestId('deck-cover-group').blur()
  await savedPatch(
    c.server,
    (s) => s.sections[0].body.includes('10-A sinf'),
    from,
    'opened again: the class saved',
  )
  await until(() => answered(c.server) && keptPosts(c.server).length, 'opened again: the class kept', 9000)
  await c.page.waitForTimeout(800)
  assert.deepEqual(nonGet(c.server), ['DELETE', 'POST'], 'opened again: one Forget, then one write')
  assert.deepEqual(
    [c.server.remembered, c.server.rememberedRoles],
    [
      ['Bajardi: Karimova Dilnoza', '10-A sinf'],
      ['made', 'group'],
    ],
    'opened again: the account keeps the changed class',
  )
  await finish(c)
  return 'Writes of kept lines go one at a time: Latin letters taken while the class just typed is answered late keep [made, 9-B sinf, Toshkent] with roles made/group/school, sent after that answer; taken while Forget is answered late, nothing is kept again; a topic changed while the Forget link is answered late keeps nothing again; a refused Forget ticks Remember again and keeps the class changed meanwhile, and a second tap is no second Forget; refused with the form opened again meanwhile, the closed form keeps nothing and the new one’s Forget or change stands'
})

await group('65 A typed school keeps its row through Undo of a later change', async () => {
  // Remember ticked by one kept line. Words typed in School that read as no school stay the school's when Undo
  // takes back a later change of the topic: the cover's lines stand where they stood, so the next change still
  // keeps them as the school.
  const made = 'Tayyorladi: Karimova Dilnoza'
  const school = 'Ta’lim muassasasi: TATU'
  const o = await openDeck({
    width: 1280,
    height: 800,
    inside: false,
    locale: 'uz',
    coverBody: made,
    remembered: [made],
    rememberedRoles: ['made'],
  })
  const { page, server } = o
  await goToDeck(o)
  const panel = page.getByTestId('deck-panel')
  await panel.getByTestId('deck-cover-topic').waitFor()
  assert.equal(await panel.getByTestId('deck-cover-remember').isChecked(), true, 'Remember ticked')
  let from = mark(server)
  await panel.getByTestId('deck-cover-school').fill(school)
  await panel.getByTestId('deck-cover-school').blur()
  await savedPatch(server, (c) => c.sections[0].body === `${made}\n${school}`, from, 'the school saved')
  await until(() => keptPosts(server).length, 'the school kept')
  // A step of its own: changes of the cover within half a second are one.
  await page.waitForTimeout(600)
  from = mark(server)
  await panel.getByTestId('deck-cover-topic').fill('Suv aylanishi')
  await panel.getByTestId('deck-cover-topic').blur()
  await savedPatch(server, (c) => c.sections[0].heading === 'Suv aylanishi', from, 'the topic saved')
  from = mark(server)
  await page.getByTestId('editor-undo').click()
  await savedPatch(
    server,
    (c) => c.sections[0].heading === DECKS[o.deck].title && c.sections[0].body === `${made}\n${school}`,
    from,
    'Undo saved',
  )
  await page.waitForTimeout(300)
  // Read again, a line shows its words after its own label, as any labelled line does; the label stays on it.
  assert.deepEqual(
    await coverRows(panel),
    { made: 'Karimova Dilnoza', checked: '', group: '', school: 'TATU' },
    'after Undo, still in the School row',
  )
  assert.deepEqual(await coverOthers(panel), [], 'not an other line')
  await shot(o, 'cover-undo-typed-school')
  const before = keptPosts(server).length
  from = mark(server)
  await panel.getByTestId('deck-cover-made').fill('Karimova Dilnoza A.')
  await panel.getByTestId('deck-cover-made').blur()
  await savedPatch(
    server,
    (c) => c.sections[0].body === `Tayyorladi: Karimova Dilnoza A.\n${school}`,
    from,
    'the name saved',
  )
  await until(() => keptPosts(server).length > before, 'the changed name kept')
  assert.deepEqual(
    keptPosts(server).at(-1),
    { lines: ['Tayyorladi: Karimova Dilnoza A.', school], locale: 'uz', roles: ['made', 'school'] },
    'the school still kept, as the school',
  )
  await finish(o)

  // The other way round: School typed and an other line's trash tapped are one step (the tap leaves the field).
  // Undo brings the other line back where the school stood, and it is an other line still, never the school.
  const extra = 'Prepared by: Karimova Dilnoza\nFixture extra'
  const u = await openDeck({
    width: 1280,
    height: 800,
    inside: false,
    coverBody: extra,
    remembered: ['Prepared by: Karimova Dilnoza'],
    rememberedRoles: ['made'],
  })
  await goToDeck(u)
  const form = u.page.getByTestId('deck-panel')
  await form.getByTestId('deck-cover-topic').waitFor()
  from = mark(u.server)
  await form.getByTestId('deck-cover-school').fill('Northbrook')
  await form.getByTestId('deck-cover-other-0-remove').click()
  await savedPatch(
    u.server,
    (c) => c.sections[0].body === 'Prepared by: Karimova Dilnoza\nNorthbrook',
    from,
    'the school in, the other line out',
  )
  await u.page.waitForTimeout(600)
  from = mark(u.server)
  await u.page.getByTestId('editor-undo').click()
  await savedPatch(u.server, (c) => c.sections[0].body === extra, from, 'Undo saved, one step')
  await u.page.waitForTimeout(400)
  assert.deepEqual(
    await coverRows(form),
    { made: 'Karimova Dilnoza', checked: '', group: '', school: '' },
    'after Undo, School empty',
  )
  assert.deepEqual(await coverOthers(form), ['Fixture extra'], 'the line back as an other line')
  await shot(u, 'cover-undo-other-line-stays-other')
  const posted = keptPosts(u.server).length
  from = mark(u.server)
  await form.getByTestId('deck-cover-topic').fill('Fixture topic two')
  await form.getByTestId('deck-cover-topic').blur()
  await savedPatch(u.server, (c) => c.sections[0].heading === 'Fixture topic two', from, 'the topic saved')
  await until(() => keptPosts(u.server).length > posted, 'kept again after the topic', 3000)
  assert.deepEqual(
    keptPosts(u.server).at(-1),
    { lines: ['Prepared by: Karimova Dilnoza'], locale: 'en', roles: ['made'] },
    'the other line not kept as the school',
  )
  await finish(u)

  // The same with the form opened again between (another slide and back): it knows the rows it showed.
  const v = await openDeck({
    width: 1280,
    height: 800,
    inside: false,
    coverBody: extra,
    remembered: ['Prepared by: Karimova Dilnoza'],
    rememberedRoles: ['made'],
  })
  await goToDeck(v)
  const again = v.page.getByTestId('deck-panel')
  await again.getByTestId('deck-cover-topic').waitFor()
  from = mark(v.server)
  await again.getByTestId('deck-cover-school').fill('Northbrook')
  await again.getByTestId('deck-cover-other-0-remove').click()
  await savedPatch(
    v.server,
    (c) => c.sections[0].body === 'Prepared by: Karimova Dilnoza\nNorthbrook',
    from,
    'the school in, the other line out, once more',
  )
  await v.page.waitForTimeout(600)
  await goTo(v.page, 2)
  await goTo(v.page, 1)
  await again.getByTestId('deck-cover-topic').waitFor()
  assert.equal(
    await again.getByTestId('deck-cover-school').inputValue(),
    'Northbrook',
    'opened again, the school in its row',
  )
  from = mark(v.server)
  await v.page.getByTestId('editor-undo').click()
  await savedPatch(
    v.server,
    (c) => c.sections[0].body === extra,
    from,
    'Undo saved after the form opened again',
  )
  await v.page.waitForTimeout(400)
  assert.deepEqual(
    await coverRows(again),
    { made: 'Karimova Dilnoza', checked: '', group: '', school: '' },
    'opened again, after Undo, School empty',
  )
  assert.deepEqual(
    await coverOthers(again),
    ['Fixture extra'],
    'opened again, the line back as an other line',
  )
  await finish(v)

  // A cover shown before comes back as it was shown: an other line taken out, then the same words typed in School as
  // a step of their own, and both undone, is an other line again.
  const shownBody = 'Prepared by: Karimova Dilnoza\nNorthbrook\nFixture extra'
  const n = await openDeck({ width: 1280, height: 800, inside: false, coverBody: shownBody })
  await goToDeck(n)
  const shownForm = n.page.getByTestId('deck-panel')
  await shownForm.getByTestId('deck-cover-topic').waitFor()
  from = mark(n.server)
  await shownForm.getByTestId('deck-cover-other-0-remove').click()
  await savedPatch(
    n.server,
    (c) => c.sections[0].body === 'Prepared by: Karimova Dilnoza\nFixture extra',
    from,
    'the other line out',
  )
  await n.page.waitForTimeout(600)
  from = mark(n.server)
  await shownForm.getByTestId('deck-cover-school').fill('Northbrook')
  await shownForm.getByTestId('deck-cover-school').blur()
  await savedPatch(
    n.server,
    (c) => c.sections[0].body === 'Prepared by: Karimova Dilnoza\nFixture extra\nNorthbrook',
    from,
    'the same words typed in School',
  )
  await n.page.waitForTimeout(600)
  for (const [body, step] of [
    ['Prepared by: Karimova Dilnoza\nFixture extra', 'first Undo'],
    [shownBody, 'second Undo'],
  ]) {
    from = mark(n.server)
    await n.page.getByTestId('editor-undo').click()
    await savedPatch(n.server, (c) => c.sections[0].body === body, from, step)
    await n.page.waitForTimeout(400)
  }
  assert.deepEqual(
    await coverRows(shownForm),
    { made: 'Karimova Dilnoza', checked: '', group: '', school: '' },
    'back as shown: School empty',
  )
  assert.deepEqual(
    await coverOthers(shownForm),
    ['Northbrook', 'Fixture extra'],
    'back as shown: two other lines',
  )
  await finish(n)
  return 'A school typed in School that reads as no school ("Ta’lim muassasasi: TATU") stays in the School row after Undo of a later topic change, and the next name change keeps it with role school; an other line brought back by Undo where a typed school stood stays an other line and is not kept, also after the form is opened again; a cover shown before comes back with the rows it was shown with'
})

/* ------------------------------------------------------------------ every combination */

const DEVICES = [
  { name: '390', width: 390, height: 844, webView: 656 },
  { name: '320', width: 320, height: 568, webView: 426 },
]
const MATRIX = DEVICES.flatMap((device) =>
  ['en', 'uz', 'ru'].flatMap((locale) =>
    ['light', 'dark'].flatMap((theme) =>
      [true, false].map((inside) => ({
        device,
        locale,
        theme,
        inside,
        tag: `${device.name}-${locale}-${theme}-${inside ? 'telegram' : 'browser'}`,
      })),
    ),
  ),
)
/** The sheets and docks of one combination, each looked at. */
async function everyState(o) {
  const { page, server } = o
  await openHeading(o, 2)
  await look(o, 'dock-headline')
  await page.getByTestId('deck-headline').fill(`${server.content.sections[1].heading}!`)
  await page.getByTestId('deck-dock-done').click()
  await headingDock(page).waitFor({ state: 'detached' })
  await openLines(o, 2)
  await addLines(page, 8)
  await budgetSays(page, '8')
  await look(o, 'dock-lines-over')
  await page.getByTestId('deck-pick-layout').click()
  await page.getByTestId('deck-layout-sheet').waitFor()
  await look(o, 'layout-sheet')
  await closeSheet(page, 'deck-layout-sheet')
  // The chooser takes the typed lines in with it (they are what it measured): Undo leaves a deck that fits.
  if (await linesDock(page).isVisible()) await page.getByTestId('deck-dock-cancel').click()
  else await page.getByTestId('editor-undo').click()
  await linesDock(page).waitFor({ state: 'detached' })
  await until(() => server.content.sections[1].body.split('\n').length === 3, 'the 8 lines taken back')
  await page.getByTestId('deck-slide-menu').click()
  await page.getByTestId('deck-slide-sheet').waitFor()
  await look(o, 'slide-menu')
  await closeSheet(page, 'deck-slide-sheet')
  await page.getByTestId('deck-tab-slides').click()
  await page.getByTestId('deck-slides-sheet').waitFor()
  await look(o, 'slides-list')
  await selectRow(page, 3)
  await look(o, 'slides-moving')
  await pressBack(page)
  await closeSheet(page, 'deck-slides-sheet')
  await goTo(page, 8)
  await tapField(o, 8, 'body')
  await page.getByTestId('deck-questions-sheet').waitFor()
  await look(o, 'questions')
  await closeSheet(page, 'deck-questions-sheet')
  await goTo(page, 1)
  await page.getByTestId('deck-cover-open').click()
  await page.getByTestId('deck-cover-sheet').waitFor()
  await look(o, 'cover')
  await closeSheet(page, 'deck-cover-sheet')
  await page.getByTestId('editor-more').click()
  await page.getByTestId('deck-more-sheet').waitFor()
  await look(o, 'more')
  await closeSheet(page, 'deck-more-sheet')
  if (o.deck === 'uz') {
    await openHeading(o, 2)
    await page.getByTestId('deck-headline').fill('Ҳаво ифлосланиши')
    await page.getByTestId('deck-dock-done').click()
    await page.getByTestId('deck-latin').waitFor()
    await look(o, 'latin')
    await page.getByTestId('deck-latin-keep').click()
  }
  await goTo(page, 1)
}
/** Android's larger text at 320: the tab, the counter row with Cover, and the dock's head still fit. */
async function atLargerText(o) {
  const { page } = o
  await goTo(page, 1)
  await scaleText(page)
  assert.deepEqual(
    await overflowing(page, [
      '[data-testid="deck-tab-slides"]',
      '.deck-edit-row',
      '[data-testid="deck-cover-open"]',
    ]),
    [],
    `${label(o)}: the tab and the counter row at 1.3`,
  )
  await noSidewaysScroll(page, `${label(o)} at 1.3`)
  await shot(o, 'root-at-1.3')
  await openHeading(o, 2)
  await scaleText(page)
  assert.deepEqual(
    await overflowing(page, ['.deck-edit-dock .editor-dock-head']),
    [],
    `${label(o)}: the dock’s head at 1.3`,
  )
  await noSidewaysScroll(page, `${label(o)} dock at 1.3`)
  await shot(o, 'dock-at-1.3')
  await page.getByTestId('deck-dock-cancel').click()
}

await group(
  'Matrix',
  async (wanted) => {
    let seen = 0
    for (const { device, locale, theme, inside, tag } of MATRIX) {
      if (!wanted(tag)) continue
      const o = await openDeck({
        width: device.width,
        height: inside ? device.webView : device.height,
        theme,
        locale,
        inside,
      })
      await goToDeck(o)
      await o.page.waitForTimeout(300)
      await look(o, 'root')
      const every = inside && ((device.name === '390' && theme === 'light') || tag === '320-ru-dark-telegram')
      if (every) await everyState(o)
      await send(o)
      await reviewReady(o.page)
      await look(o, 'review-ready')
      await closeSheet(o.page, 'deck-review-sheet')
      if (
        device.name === '320' &&
        locale !== 'en' &&
        inside &&
        (theme === 'light' || tag === '320-ru-dark-telegram')
      )
        await atLargerText(o)
      await finish(o)
      seen += 1
    }
    assert.ok(seen > 0, 'no combination matched')
    return `390x844 and 320x568, en uz ru, light and dark, Telegram and browser (${seen}): axe, 44 px, no sideways scroll, root and Review; every sheet at 390 light and 320 ru dark; 1.3 text at 320`
  },
  { labels: MATRIX.map((entry) => entry.tag) },
)

await group(
  '66 End checks',
  async () => {
    assert.deepEqual(contextFailures, [], 'page errors or requests without a fixture')
    assert.ok(checkedContexts > 0, 'no context was checked')
    return `End checks: no page error and no request without a fixture in any of the ${checkedContexts} contexts`
  },
  { labels: [ONLY] },
)

await browser.close()
console.log(`\nPass: ${checks.length} groups of checks`)
for (const check of checks) console.log(`  ${check}`)
if (failures.length) {
  console.log(`\nFailed: ${failures.length}`)
  for (const [name, error] of failures) console.log(`  ${name}: ${String(error.message).split('\n')[0]}`)
  process.exitCode = 1
}
