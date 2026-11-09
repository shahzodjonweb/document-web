/**
 * The title slide's lines as a form: who made it, who checks it, the class, the
 * school, and whatever else the cover says.
 *
 * A cover is the customer's own wording, so nothing is rewritten that was not
 * changed: an untouched line goes back exactly as it was, and a changed one keeps
 * the customer's label ("Bajardi", "Ilmiy rahbar", "Выполнила"). Only a line that
 * was not there gets a label, in the deck's language. The cues are
 * `title_lines.ROLES`, read the same way: a role is what the label says.
 *
 * Remembered lines live on the account (`/studio/cover-lines`), packed at rest, with
 * the deck language they were written in: they fill only a deck in that language, as
 * they go on new decks (`title_lines.place`). Each keeps the row it was typed in, so a
 * school typed bare ("TATU") comes back as the school, here and on the next deck alike.
 */
import dictionaries from '../../locales/catalog.ts'

export type CoverRole = 'made' | 'checked' | 'group' | 'school'
export interface CoverRow {
  role: CoverRole | 'other'
  value: string
  /** The line's own label, as written: kept when the value changes. */
  label: string | null
  /** What came between a label and its words when it was not a colon ("Tayyorladi - "): kept too. */
  sep?: string
  /** The line as the cover had it; null for a row the cover did not have. */
  original: string | null
}
/** Rows in the cover's line order, then one empty row for each role it lacked. */
export interface CoverForm {
  topic: string
  rows: CoverRow[]
}
/** Lines kept for the next decks, each with the row it came from: null when that is not known, so its words say. */
export interface KeptLines {
  lines: string[]
  roles: (CoverRole | null)[]
}

export const COVER_ROLES: readonly CoverRole[] = ['made', 'checked', 'group', 'school']
/** `title_lines.TITLE_LINES`: the lines a title slide draws. */
export const COVER_LINES = 8
const LINE_CHARS = 160
const GLYPH = /^\s*[•·▪◦‣*\-–—]\s*/
const LABELLED = /^([^:]{1,40}):\s*(.*)$/
// Searched from any word of the label, as title_lines searches it: "Ilmiy rahbar", "Fan o‘qituvchisi".
// title_lines reads a line in Latin letters, so Uzbek written in Cyrillic has its cues here too. Most
// are the start of a word, so forms of it say the same: "Tuzdilar", "Tayyorlagan". The nouns title_lines
// takes only as a plural or possessive (`FORMED`) are those or nothing: "Ijrochilar", "Tuzuvchisi",
// "Authors", "Tutors"; "Tutorial" and "Authorities" are no label.
const NOUN_END = '(?![\\p{L}])'
const UZ_NOUN = `(?:tuzuvchi|ijrochi|тузувчи|ижрочи)(?:lar(?:i|ning)?|si|лар(?:и|нинг)?|си)?${NOUN_END}`
const EN_MADE = `authors?${NOUN_END}`
const EN_CHECKED = `(?:teacher|supervisor|instructor|lecturer|tutor)s?${NOUN_END}`
const MADE = new RegExp(
  `(?:^|[\\s(])(tayyorla|tayyorlov|bajar|topshir|tuzdi|${UZ_NOUN}|muallif|talaba|o['‘’ʻ]?quvchi|тайёрла|тайёрлов|бажар|топшир|тузди|муаллиф|талаба|ўқувчи|подготов|выполн|сдела|автор|студент|учени|prepared|made by|done by|presented|submitted by|completed by|created by|${EN_MADE}|student)`,
  'iu',
)
const CHECKED = new RegExp(
  `(?:^|[\\s(])(qabul|tekshir|rahbar|o['‘’ʻ]?qituvchi|ustoz|қабул|текшир|раҳбар|ўқитувчи|устоз|провер|принял|принят|руковод|преподав|учител|checked|reviewed|accepted|${EN_CHECKED})`,
  'iu',
)
// "Year 10" and "Form 10" are a class, as `title_lines.YEAR_CLASS` reads one; "Year 2026", "Academic
// year 2025-2026" and "School Year 24/25" are not. "2-bosqich" is a year of study, as `title_lines.CLASS`
// reads it. A piece of work is no class (`title_lines.NOT_WORK`): "KURS ISHI" heads a course paper's
// cover, and "Group project" names no group. Each noun opens a word, so "Diskurs" is none.
const NOT_WORK = '(?!\\p{L}*[ \\t]+(?:ishi|loyihasi|иши|лойиҳаси|work|project|paper)(?!\\p{L}))'
const GROUP = new RegExp(
  `(?<!\\p{L})(?:sinf|guruh|kurs|синф|гуруҳ|класс|группа|курс|\\bclass\\b|\\bgroup\\b|\\bgrade\\b|\\bcourse\\b)${NOT_WORK}|(?<![\\p{L}\\p{N}])\\d{1,2}[ \\t]?[-–]?[ \\t]?(?:bosqich|босқич)|(?<![\\p{L}\\p{N}_'‘’ʻʼ\`´])(?:year[ \\t]{0,2}|form[ \\t]+)\\d{1,2}(?![\\p{L}\\p{N}_'‘’ʻʼ\`´])(?![ \\t]*[-–/][ \\t]*\\d)`,
  'iu',
)
// A class or a group as a line says it alone, as `title_lines.CLASS_CODE` reads it: "9-B", "10 «A»", "305-22".
const CLASS_CODE =
  /^(?:(?:1[0-2]|[1-9])[ \t]?(?:[-–][ \t]?[«"“]?\p{L}[»"”]?|[«"“]\p{L}[»"”])|\d{3}[ \t]?[-–][ \t]?\d{2})$/u
// The institutions `title_lines.INSTITUTION` knows: "Toshkent 1-son texnikumi", "Гимназия №1", "Lyceum No. 2",
// "Tashkent Medical Academy".
// "School year 2025-2026" is a date, not a school.
const SCHOOL =
  /(maktab|litsey|kollej|universitet|institut|akademiya|fakultet|kafedra|texnikum|tekhnikum|gimnazi|мактаб|школ|лице|коллеж|колледж|университет|институт|академи|факультет|кафедр|техникум|гимнази|school|college|university|institute|faculty|department|gymnasium|lyceum|academy|academies)(?![ \t]+year(?![\p{L}\p{N}_'‘’ʻʼ`´]))/iu
/**
 * A label with no colon, as `title_lines.LATIN_LABEL` also reads one: a verb ("Tayyorladi",
 * "Tuzdi", "Qabul qildi", "Выполнила", "Prepared by") then a dash or a space, or a noun ("Talaba",
 * "Tuzuvchi", "Ilmiy rahbar", "Teacher") then a dash. A noun and a space is a line like "Talabalar uchun".
 */
const SPACED =
  /^((?:[\p{L}'‘’ʻ.]+\s+){0,2}?(?:tayyorla(?:di|gan|vchi)|tayyorlovchi|bajar(?:di|gan|uvchi)|topshir(?:di|gan|uvchi)|tuzdi|qabul\s+qil(?:di|gan|uvchi)|tekshir(?:di|gan|uvchi)|тайёрла(?:ди|ган|вчи)|тайёрловчи|бажар(?:ди|ган|увчи)|топшир(?:ди|ган|увчи)|тузди|қабул\s+қил(?:ди|ган|увчи)|текшир(?:ди|ган|увчи)|(?:подготовил|выполнил|сделал|проверил|принял)[аи]?|(?:prepared|made|done|presented|submitted|completed|created|checked|reviewed|accepted)\s+by)\p{L}*(?:\(\p{L}{1,2}\))?)(\s*[-–—]\s*|\s+)(\S.*)$/iu
const DASHED = new RegExp(
  `^((?:[\\p{L}'‘’ʻ.]+\\s+){0,2}?(?:(?:muallif|talaba|o['‘’ʻ]?quvchi|rahbar|o['‘’ʻ]?qituvchi|ustoz|муаллиф|талаба|ўқувчи|раҳбар|ўқитувчи|устоз|автор|студент|учени|руковод|преподав|учител|student)\\p{L}*|${UZ_NOUN}|${EN_MADE}|${EN_CHECKED})(?:\\(\\p{L}{1,2}\\))?)(\\s*[–—]\\s*|\\s+-\\s*|-\\s+)(\\S.*)$`,
  'iu',
)

/** Python's `[:n]`, by letters: a cut never splits an emoji the server keeps whole. */
function cut(text: string, n: number) {
  return text.length <= n ? text : Array.from(text).slice(0, n).join('')
}

function roleOf(label: string): CoverRole | 'other' {
  return MADE.test(label)
    ? 'made'
    : CHECKED.test(label)
      ? 'checked'
      : GROUP.test(label)
        ? 'group'
        : SCHOOL.test(label)
          ? 'school'
          : 'other'
}

/** What one cover line says: its role, its label if it has one, and the words after it. */
function readLine(raw: string): {
  role: CoverRole | 'other'
  label: string | null
  value: string
  sep?: string
} {
  const line = raw.replace(GLYPH, '').trim()
  const found = LABELLED.exec(line)
  if (found) {
    const label = found[1]!.trim()
    return { role: roleOf(label), label, value: found[2]!.trim() }
  }
  const spaced = SPACED.exec(line) ?? DASHED.exec(line)
  if (spaced) {
    const label = spaced[1]!.trim()
    const role = roleOf(label)
    if (role === 'made' || role === 'checked')
      return { role, label, value: spaced[3]!.trim(), sep: spaced[2]! }
  }
  return {
    role: GROUP.test(line) || CLASS_CODE.test(line) ? 'group' : SCHOOL.test(line) ? 'school' : 'other',
    label: null,
    value: line,
  }
}

export function parseCover(heading: string, body: string): CoverForm {
  const rows: CoverRow[] = []
  const taken = new Set<CoverRole | 'other'>()
  for (const raw of body.split('\n')) {
    if (!raw.trim()) continue
    const { role, label, value, sep } = readLine(raw)
    // A second "Bajardi" is a line like any other: only the first fills the form's row.
    const own = role === 'other' || taken.has(role) ? 'other' : role
    taken.add(own)
    rows.push({ role: own, value, label, ...(sep ? { sep } : {}), original: raw })
  }
  for (const role of COVER_ROLES)
    if (!taken.has(role)) rows.push({ role, value: '', label: null, original: null })
  return { topic: heading, rows }
}

/** One row as its cover line, or '' for a row left empty. */
function composeRow(row: CoverRow, labels: { made: string; checked: string }): string {
  const value = row.value.trim()
  if (row.original !== null && readLine(row.original).value === value) return row.original
  if (!value) return ''
  if (row.label) return `${row.label}${row.sep ?? ': '}${value}`
  if (row.original === null && (row.role === 'made' || row.role === 'checked'))
    return `${labels[row.role]}: ${value}`
  return value
}

/**
 * The cover's lines as the form has them now. A line the cover had is never dropped or
 * cut here, however long: only typing is limited, by the fields themselves. A typed row
 * that would be a line past the eighth is not put in but returned in `over`, for the
 * form to say so; the form refuses such a row at the tap (`coverRoleOpen`), so this is the
 * backstop, never a silent cut.
 */
export function composeCover(
  form: CoverForm,
  labels: { made: string; checked: string },
): { heading: string; body: string; over: string[] } {
  const order = [...COVER_ROLES, 'other']
  const added = form.rows
    .filter((row) => row.original === null)
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
  const lines = form.rows
    .filter((row) => row.original !== null)
    .map((row) => composeRow(row, labels))
    .filter(Boolean)
  const over: string[] = []
  for (const row of added) {
    const line = composeRow(row, labels)
    if (line) (lines.length < COVER_LINES ? lines : over).push(line)
  }
  return { heading: cut(form.topic, LINE_CHARS), body: lines.join('\n'), over }
}

/** Lines the form holds: each row with words, each line the cover had, and a line just added and not yet typed in. */
export function countCoverLines(form: CoverForm): number {
  const any = { made: '-', checked: '-' }
  return form.rows.filter(
    (row) => (row.role === 'other' && row.original === null) || composeRow(row, any) !== '',
  ).length
}

/** Whether a role's row may take words: it is a line already, or the slide has room for one more. */
export function coverRoleOpen(form: CoverForm, role: CoverRole): boolean {
  const row = form.rows.find((item) => item.role === role)
  return !!row && (row.original !== null || !!row.value.trim() || countCoverLines(form) < COVER_LINES)
}

/**
 * A line the cover has whole, that no word places in a row ("Northbrook"), back in the row it
 * was kept or typed with, where it stands: the cover is the same, and the next change keeps it
 * in its row. Only lines known with their row move; nothing is filled.
 */
export function adoptRows(form: CoverForm, lines: KeptLines | string[]) {
  const kept = rolesOf(lines)
  const stored = Array.isArray(lines) ? [] : keptRoles(lines.roles, lines.lines.length)
  for (const role of COVER_ROLES) {
    const value = stored.includes(role) ? kept[role]?.toLocaleLowerCase() : undefined
    const empty = form.rows.find((row) => row.role === role && row.original === null && !row.value.trim())
    const line = form.rows.find(
      (row) =>
        row.role === 'other' &&
        !row.label &&
        row.original !== null &&
        row.value.toLocaleLowerCase() === value,
    )
    if (!value || !empty || !line) continue
    line.role = role
    form.rows = form.rows.filter((row) => row !== empty)
  }
}

/**
 * The form as its own commit left the cover, with rows where they stand: each row with words
 * is now a line the cover has, a role row cleared is one it has not (on a full slide it waits for
 * room), and a line the cover had and lost leaves its field. No line moves to another row, so
 * one typed in School stays the school's, and a field under the finger keeps its words. A row
 * past the eighth line is still not one.
 */
export function settleRows(form: CoverForm, labels: { made: string; checked: string }) {
  const order = [...COVER_ROLES, 'other']
  // As composeCover writes them: the lines the cover had, then new ones by role, while there is room.
  const had = form.rows.filter((row) => row.original !== null && composeRow(row, labels))
  const added = form.rows
    .filter((row) => row.original === null && composeRow(row, labels))
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
    .slice(0, Math.max(0, COVER_LINES - had.length))
  const written = [...had, ...added]
  const placed = new Set(written)
  const lost = new Set(
    form.rows.filter((row) => row.role === 'other' && row.original !== null && !placed.has(row)),
  )
  for (const row of form.rows) {
    if (!placed.has(row)) {
      row.original = null
      continue
    }
    const line = composeRow(row, labels)
    if (line === row.original) continue
    // The label it went in with is its own now ("Prepared by"), so a change keeps it.
    const read = readLine(line)
    if (read.value === row.value.trim()) {
      row.label = read.label
      if (read.sep) row.sep = read.sep
      else delete row.sep
    }
    row.original = line
  }
  // In the cover's order, which the next commit writes again. An other line not on it yet (just added, or
  // past the eighth) keeps its place among the others.
  const others = form.rows.filter((row) => row.role === 'other' && !lost.has(row))
  const rows: CoverRow[] = []
  let next = 0
  for (const row of written) {
    if (row.role === 'other') {
      const at = others.indexOf(row)
      for (; next < at; next++) if (!placed.has(others[next]!)) rows.push(others[next]!)
      next = Math.max(next, at + 1)
    }
    rows.push(row)
  }
  for (; next < others.length; next++) if (!placed.has(others[next]!)) rows.push(others[next]!)
  rows.push(...form.rows.filter((row) => row.role !== 'other' && !placed.has(row)))
  form.rows = rows
}

/**
 * Each line of a cover's old body to the line now in its place, rewritten or not (Latin letters,
 * their Undo and Redo, the other side of a conflict, a change of topic only). None when lines
 * came or went: then no line's place says which it was.
 */
export function linesInPlace(was: string, now: string): Map<string, string> {
  const old = was.split('\n').filter((line) => line.trim())
  const next = now.split('\n').filter((line) => line.trim())
  return new Map(old.length === next.length ? old.map((line, index) => [line, next[index]!]) : [])
}

/**
 * Lines in place (`linesInPlace`), each in the role row the line before it was written from:
 * "ТАТУ" typed in School is "TATU" in School after Latin letters, though no word of it says a
 * school. `before` is the form that wrote the old lines.
 */
export function carryRows(
  form: CoverForm,
  before: CoverForm,
  rewritten: Map<string, string>,
  labels: { made: string; checked: string },
) {
  for (const role of COVER_ROLES) {
    const was = before.rows.find((row) => row.role === role)
    const now = was ? rewritten.get(composeRow(was, labels)) : undefined
    const empty = form.rows.find((row) => row.role === role && row.original === null && !row.value.trim())
    const line =
      now === undefined ? undefined : form.rows.find((row) => row.role === 'other' && row.original === now)
    if (!empty || !line) continue
    line.role = role
    form.rows = form.rows.filter((row) => row !== empty)
  }
}

type Rows = Map<string, CoverRole | 'other'>
/** What one deck's Cover forms have shown: each line's last row, and each cover body's rows. */
export interface CoverMemory {
  draft: string
  lines: Rows
  covers: Map<string, Rows>
}
/** Cover bodies held per deck, the newest last: past this the oldest goes. */
const COVERS_HELD = 100
let shown: CoverMemory = { draft: '', lines: new Map(), covers: new Map() }

/** The rows this deck's Cover forms have shown, so one opened again knows them too; another deck starts afresh. */
export function coverMemory(draft: string): CoverMemory {
  if (shown.draft !== draft) shown = { draft, lines: new Map(), covers: new Map() }
  return shown
}

/** The rows the form shows for this cover body, each line with its own: where `restoreRows` puts them back. */
export function noteRows(form: CoverForm, memory: CoverMemory, body: string) {
  const rows: Rows = new Map()
  for (const row of form.rows) {
    if (row.original === null) continue
    rows.set(row.original, row.role)
    memory.lines.set(row.original, row.role)
  }
  memory.covers.delete(body)
  memory.covers.set(body, rows)
  if (memory.covers.size > COVERS_HELD) memory.covers.delete(memory.covers.keys().next().value!)
}

/**
 * Each line back in the role row it had, when that row is empty: as this cover body had it when
 * a form showed it (Undo, Redo, the form opened again), else in the row it was last in. "ТАТУ"
 * typed in School is the school's again after the Undo of its Latin letters, though no word of it
 * says a school; a line among the others stays there, whatever line stood in its place. Returns
 * the rows it went by: the lines `carryRows` leaves alone.
 */
export function restoreRows(form: CoverForm, memory: CoverMemory, body: string): Rows {
  const rows = memory.covers.get(body) ?? memory.lines
  for (const role of COVER_ROLES) {
    const empty = form.rows.find((row) => row.role === role && row.original === null && !row.value.trim())
    const line = form.rows.find(
      (row) => row.role === 'other' && row.original !== null && rows.get(row.original) === role,
    )
    if (!empty || !line) continue
    line.role = role
    form.rows = form.rows.filter((row) => row !== empty)
  }
  return rows
}

/**
 * The empty role rows filled from kept lines (`rolesOf`), as the sheet opens; true when any
 * was. A value some line of the cover already has is not filled again ("Tayyorladi - Karimova
 * Dilnoza" read as unlabelled would otherwise get a second author), and nothing is filled past
 * the slide's eight lines: that kept line waits for the next deck. Kept lines the cover has
 * whole go back to their rows first (`adoptRows`).
 */
export function fillCoverFromKept(form: CoverForm, lines: KeptLines | string[]): boolean {
  adoptRows(form, lines)
  const kept = rolesOf(lines)
  const written = form.rows.map((row) => (row.original ?? row.value).toLocaleLowerCase())
  let filled = false
  for (const role of COVER_ROLES) {
    const row = form.rows.find((item) => item.role === role)
    const value = kept[role]
    if (!row || !value || row.value.trim()) continue
    if (written.some((line) => line.includes(value.toLocaleLowerCase()))) continue
    if (!coverRoleOpen(form, role)) continue
    row.value = value
    filled = true
  }
  return filled
}

/** The lines worth keeping for the next decks: the four roles' rows as the cover writes them, each with its row. */
export function roleLines(form: CoverForm, labels: { made: string; checked: string }): KeptLines {
  const kept: KeptLines = { lines: [], roles: [] }
  for (const role of COVER_ROLES) {
    const row = form.rows.find((item) => item.role === role)
    const line = row ? cut(composeRow(row, labels), LINE_CHARS) : ''
    if (!line) continue
    kept.lines.push(line)
    kept.roles.push(role)
  }
  return kept
}

function isRole(value: unknown): value is CoverRole {
  return (COVER_ROLES as readonly unknown[]).includes(value)
}

/** One role per line, as the server answers them: anything else, or a list of another length, is not known. */
export function keptRoles(roles: unknown, count: number): (CoverRole | null)[] {
  const given = Array.isArray(roles) && roles.length === count ? roles : []
  return Array.from({ length: count }, (_, index) => (isRole(given[index]) ? given[index] : null))
}

/**
 * The value each role has in the kept lines, the first of each. A line kept with its
 * row goes back to that row, whatever its words would say ("TATU", "21" typed in the
 * School row). Only a line whose row is not known is read: by its label or its words,
 * and one with no telling word ("302") is the group's, or the school's when the group
 * has one, as they went out in role order (`roleLines`).
 */
export function rolesOf(kept: KeptLines | string[]): Partial<Record<CoverRole, string>> {
  const lines = Array.isArray(kept) ? kept : kept.lines
  const roles = keptRoles(Array.isArray(kept) ? null : kept.roles, lines.length)
  const found: Partial<Record<CoverRole, string>> = {}
  const loose: string[] = []
  lines.forEach((raw, index) => {
    const role = roles[index]
    if (!role || role in found || !raw?.trim()) return
    const read = readLine(raw)
    // Its label is the row's own ("Tayyorladi:", "Maktab:"); a line typed whole is its value whole.
    const value = read.role === role ? read.value : raw.replace(GLYPH, '').trim()
    if (value) found[role] = value
  })
  lines.forEach((raw, index) => {
    if (roles[index] || !raw?.trim()) return
    const { role, label, value } = readLine(raw)
    if (role !== 'other' && !(role in found)) {
      if (value) found[role] = value
    } else if (role === 'other' && !label && value) loose.push(value)
  })
  for (const role of ['group', 'school'] as const)
    if (!(role in found) && loose.length) found[role] = loose.shift()!
  return found
}

/**
 * Whether `now` is what `then` keeps already: each role the same value, and each line of
 * `then` kept with its row. A label written another way ("Bajardi:" for "Tayyorladi:") is
 * not a change worth a write; a line kept without its row is, so the next deck need not guess it.
 */
export function keepsSame(now: KeptLines, then: KeptLines): boolean {
  const mine = rolesOf(now)
  const kept = rolesOf(then)
  return (
    then.lines.length === keptRoles(then.roles, then.lines.length).filter(Boolean).length &&
    COVER_ROLES.every((role) => (mine[role] ?? '') === (kept[role] ?? ''))
  )
}

/** The labels a new line gets, in the deck's language rather than the screen's. */
export function labelsFor(locale: 'en' | 'uz' | 'ru'): { made: string; checked: string } {
  const words = dictionaries[locale] ?? dictionaries.en
  return {
    made: words.deckCoverPreparedBy || dictionaries.en.deckCoverPreparedBy || 'Prepared by',
    checked: words.deckCoverCheckedBy || dictionaries.en.deckCoverCheckedBy || 'Checked by',
  }
}

type DeckLocale = 'en' | 'uz' | 'ru'
type CoverLinesAnswer = { lines: string[]; locale?: DeckLocale | null; roles?: (CoverRole | null)[] }
type Held = { owner: string; locale: DeckLocale | null } & KeptLines
type Writes = {
  remember: (given: KeptLines | string[], locale?: DeckLocale) => Promise<boolean>
  forget: () => Promise<boolean>
}

/**
 * Every write of kept lines, one after another, from the Cover sheet and the frame alike: each
 * reads what the last one left, so a write begun before another has answered never undoes it.
 */
let writing: Promise<unknown> = Promise.resolve()

export function useDeckCover() {
  const ws = useWorkspace()
  const deck = useDeckEditor()
  /**
   * What the account keeps, each line with its row, with whose it is and the deck language
   * it was written in. Held for one account only: after a sign-out and in on the same
   * device, another's names are never shown, as the app does not reload between them.
   */
  const held = useState<Held | null>('deck-cover-lines', () => null)
  const owner = () => String(ws.user.value?.id ?? '')
  /** Null until asked for this account; empty when it keeps none, or keeps them for decks in another language. */
  const kept = computed<KeptLines | null>(() => {
    const own = held.value
    if (!own || own.owner !== owner()) return null
    return own.locale === deck.deckLocale.value
      ? { lines: own.lines, roles: own.roles }
      : { lines: [], roles: [] }
  })
  const remembered = computed<string[] | null>(() => kept.value?.lines ?? null)

  /** The answer as held: the lines the server keeps, a role for each (null where it has none). */
  function hold(asker: string, answer: CoverLinesAnswer | null, sent?: KeptLines, locale?: DeckLocale) {
    const lines = Array.isArray(answer?.lines) ? answer.lines : (sent?.lines ?? [])
    const roles =
      !Array.isArray(answer?.roles) && sent && JSON.stringify(lines) === JSON.stringify(sent.lines)
        ? sent.roles
        : keptRoles(answer?.roles, lines.length)
    held.value = { owner: asker, lines, roles, locale: answer?.locale ?? locale ?? null }
  }

  async function loadRemembered() {
    const asker = owner()
    try {
      const answer = await ws.api<CoverLinesAnswer>('/studio/cover-lines')
      if (owner() === asker) hold(asker, answer)
    } catch {
      // Nothing to fill in from: the form is the same without it.
    }
  }

  /**
   * The lines as `roleLines` gives them, each with its row, kept for decks in `locale` (the
   * deck's own language). Lines alone have no row known, so their words say it. None left
   * means nothing is worth keeping, so what was kept for this language goes.
   */
  async function write(
    given: KeptLines | string[],
    locale: DeckLocale = deck.deckLocale.value,
  ): Promise<boolean> {
    const asker = owner()
    const lines = Array.isArray(given) ? given : given.lines
    const roles = keptRoles(Array.isArray(given) ? null : given.roles, lines.length)
    const clean: KeptLines = { lines: [], roles: [] }
    lines.forEach((line, index) => {
      if (!line.trim() || clean.lines.length >= COVER_LINES) return
      clean.lines.push(cut(line.trim(), LINE_CHARS))
      clean.roles.push(roles[index] ?? null)
    })
    if (!clean.lines.length) return remembered.value?.length ? drop() : true
    const own = held.value?.owner === asker ? held.value : null
    if (
      own?.locale === locale &&
      JSON.stringify(clean) === JSON.stringify({ lines: own.lines, roles: own.roles })
    )
      return true
    try {
      const answer = await ws.api<CoverLinesAnswer>('/studio/cover-lines', {
        method: 'POST',
        body: { ...clean, locale },
      })
      if (owner() === asker) hold(asker, answer, clean, locale)
      return true
    } catch {
      return false
    }
  }

  /** Whatever DELETE answers (`{lines: []}`, with or without an empty `roles` and a null `locale`), nothing is kept. */
  async function drop(): Promise<boolean> {
    const asker = owner()
    try {
      await ws.api('/studio/cover-lines', { method: 'DELETE' })
      if (owner() === asker) held.value = { owner: asker, lines: [], roles: [], locale: null }
      return true
    } catch {
      return false
    }
  }

  /**
   * The deck's lines just put in Latin letters (old line to new): kept lines among them go in
   * Latin too, each with its row, so the next deck and this cover say them alike.
   */
  async function rewrite(map: Map<string, string>): Promise<boolean> {
    return queue(async (now) => {
      // As the writes before it left them: after a Forget there is nothing to rewrite.
      const own = kept.value
      if (!own?.lines.some((line) => map.has(line))) return true
      return now.remember({ lines: own.lines.map((line) => map.get(line) ?? line), roles: own.roles })
    })
  }

  /** `work` once every earlier write has answered, with writes of its own that do not wait again. */
  function queue<T>(work: (now: Writes) => Promise<T>): Promise<T> {
    const turn = writing.then(() => work({ remember: write, forget: drop }))
    writing = turn.catch(() => undefined)
    return turn
  }
  const remember = (given: KeptLines | string[], locale?: DeckLocale) =>
    queue((now) => now.remember(given, locale))
  const forget = () => queue((now) => now.forget())

  return { kept, remembered, loadRemembered, remember, forget, rewrite, queue, labelsFor }
}
