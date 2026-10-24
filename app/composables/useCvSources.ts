/**
 * Where a CV starts from, chosen first in Create with AI: a description typed
 * in the form (`text`), the customer's LinkedIn profile as LinkedIn's own
 * Save to PDF or as screenshots (`linkedin`), or an old CV (`file`). In the
 * last two the description is notes on top of the files: the job wanted now,
 * what to change, what to add. The files are read for their text (or by OCR)
 * and never used as the portrait, which has its own control.
 */
export type CvSource = 'text' | 'linkedin' | 'file'
export type CvFileSource = Exclude<CvSource, 'text'>
export const CV_SOURCES: CvSource[] = ['text', 'linkedin', 'file']
/** What each mode reads when the server does not list it (GET studio/config `source_kinds`). */
export const CV_SOURCE_KINDS: Record<CvFileSource, string[]> = {
  linkedin: ['pdf', 'image'],
  file: ['pdf', 'docx', 'image'],
}
/** Most files one CV is made from, when the server does not say (`max_source_files`). */
export const CV_SOURCE_FILES = 10
/** Most pages all of a CV's files may have together, when the server does not say (`max_source_pages`). */
export const CV_SOURCE_PAGES = 30
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const ACCEPT: Record<string, string> = {
  pdf: '.pdf,application/pdf',
  docx: `.docx,${DOCX}`,
  image: '.jpg,.jpeg,.png,image/jpeg,image/png',
}
/** The file input's `accept` for these kinds. */
export const cvAccept = (kinds: string[]) =>
  kinds
    .map((kind) => ACCEPT[kind])
    .filter(Boolean)
    .join(',')
const KIND_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  [DOCX]: 'docx',
  'image/jpeg': 'image',
  'image/png': 'image',
}
const KIND_BY_EXTENSION: Record<string, string> = {
  pdf: 'pdf',
  docx: 'docx',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
}
/** The extension each type is uploaded with: the server tells files apart by it. */
const EXTENSION: Record<string, string> = {
  'application/pdf': '.pdf',
  [DOCX]: '.docx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
}
const extensionOf = (name = '') => /\.([^./\\]+)$/.exec(name)?.[1]?.toLowerCase() || ''

/**
 * `pdf`, `docx` or `image` (a JPG or PNG), by the name's extension or else the
 * type the browser gives; '' for anything else. An old Word `.doc` is not
 * read, nor is a HEIC photo (a phone sends its photos as JPEG when the picker
 * asks for one).
 */
export function cvFileKind(file: { name?: string; type?: string; mime_type?: string }) {
  return (
    KIND_BY_EXTENSION[extensionOf(file.name)] ||
    KIND_BY_TYPE[String(file.type || file.mime_type || '').toLowerCase()] ||
    ''
  )
}

/**
 * The file as it is uploaded. One whose name has no extension the server
 * knows (some phone pickers name a screenshot without one) is given the one
 * its type says, since the server reads the kind from the name.
 */
export function withExtension(file: File) {
  if (KIND_BY_EXTENSION[extensionOf(file.name)]) return file
  const extension = EXTENSION[file.type.toLowerCase()]
  return extension ? new File([file], `${file.name || 'file'}${extension}`, { type: file.type }) : file
}

// A LinkedIn profile's address, as the server reads one (apps/studio/cv/sources.py
// LINKEDIN_LINK): linkedin.com/in/…, an older /pub/ or /profile/ one, or a lnkd.in short link.
const LINKEDIN_PROFILE = /(?:https?:\/\/)?(?:[\w-]+\.)?(?:linkedin\.com\/(?:in|pub|profile)\/|lnkd\.in\/)[^\s<>]*/giu
// What makes a fact to put on a CV, as the server reads one (apps/studio/cv/content.py
// EMAIL, PHONE, YEAR): an email, a phone number, a year.
// EMAIL starts only where a run of its characters starts, as the server's does: the same matches,
// read in time that grows with the text, not its square (a long run of letters before an @).
const EMAIL = /(?<![\p{L}\p{N}_.+\-'])[\p{L}\p{N}_.+\-']+@[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+/u
const PHONE = /\+?\p{Nd}[\p{Nd} \t().-]{5,}\p{Nd}/u
const YEAR = /(?<!\p{Nd})(?:19|20)\p{Nd}{2}(?!\p{Nd})/u
// A word as the server counts one: letters only (Python's [^\W\d_]+).
const WORD = /[\p{L}\p{Nl}\p{No}]+/gu
/**
 * The words people ask with, greet with and point at their profile with, in
 * English, Uzbek and Russian. None of them is a fact about the person. The
 * same words as the server's ASKING (apps/studio/cv/sources.py), and never
 * one more: a word only this side took for asking would stop a description
 * the server makes a CV of.
 */
const ASKING = new Set(
  [
    'hello hi here is my the a an at from for me it please make create professional good cv resume profile link page',
    'thank thanks you very much this',
    'assalomu alaykum salom mana mening shu shundan menga yaxshi rezyume profil profilim havola qilib bering iltimos',
    'tayyorlab rahmat',
    'здравствуйте привет вот ссылка на мой моя мне профиль в из него по моему сделайте сделать составьте пожалуйста',
    'резюме спасибо',
  ]
    .join(' ')
    .split(' '),
)

/**
 * A description that is a LinkedIn profile's link and no fact about the
 * person: a bare link, or one in a request ("Здравствуйте, вот ссылка на мой
 * профиль, сделайте резюме: …", "Please make my CV from my profile at …").
 * LinkedIn shows profiles only to people signed in, so the server cannot read
 * one: the way is LinkedIn's own Save to PDF. Any other word, an email, a
 * phone number or a year is a fact, however short the description ("Ali
 * Valiyev, SMM manager. linkedin.com/in/…"), and it is sent.
 *
 * The server's rule (sources.linkedin_link_only) also takes the person's name
 * out before it reads the words. A name is not looked for here: its words are
 * no asking words, so a description with one goes to the server, which says
 * the same (`cv_linkedin_link`) when nothing but the name is left. So this
 * stops only what the server would refuse.
 */
export function linkedinLinkOnly(text: string) {
  const value = String(text || '')
  if (!value.match(LINKEDIN_PROFILE)) return false
  const rest = value.replace(LINKEDIN_PROFILE, ' ')
  if (EMAIL.test(rest) || PHONE.test(rest) || YEAR.test(rest)) return false
  return (rest.match(WORD) || [])
    .map((word) => word.toLowerCase())
    .every((word) => word === 'linkedin' || ASKING.has(word))
}

/**
 * What a CV is made from, and what the form shows of it: the facts a CV cannot
 * be made without (`required`), and those it may also have (`optional`). The
 * server lists them (GET studio/config `cv_facts`); these are the same lists
 * for a server that does not.
 */
export const CV_FACTS_FALLBACK = {
  required: ['name', 'contact', 'background'],
  optional: [
    'target',
    'location',
    'birth',
    'skills',
    'languages',
    'certificates',
    'projects',
    'links',
    'photo',
  ],
}
/** The facts the form knows a label for. */
export const CV_FACT_KEYS = new Set([...CV_FACTS_FALLBACK.required, ...CV_FACTS_FALLBACK.optional])
export interface CvFactTicks {
  name: boolean
  contact: boolean
  background: boolean
}

// --- The required facts, read while the description is typed -------------------
//
// A port of apps/studio/cv/content.py (name_in and facts), which is what
// decides: it asks for whichever of the three it cannot find (`cv_missing`).
// This one only ticks the list while the customer types, so it never stops a
// request, and where the two differ the server's refusal is believed. Each
// pattern is the server's Python source and each step the server's function
// of the same name, so the two read a description the same way.
// tests/catalog-check.mjs holds the ticks to the server's own answers
// (tests/fixtures/cv-fact-cases.json): a tick the server would refuse is never
// allowed. When the server's detectors change, change them here the same way.

/** What Python's \w, \s and [^\W\d_] match in a str pattern: a letter, a number or _; a blank; a letter. */
const W = '\\p{L}\\p{N}_'
const BLANK = '\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000'
const LETTER = '\\p{L}\\p{Nl}\\p{No}'
const TICK = '`'
/**
 * A Python pattern as JavaScript reads it the same way: \w, \d and \s are
 * Unicode's, `$` also matches before a line break that ends the text, and
 * with `multiline` `^` starts a line only after \n.
 */
function py(source: string, multiline = false) {
  let out = ''
  let inClass = false
  for (let at = 0; at < source.length; at++) {
    const char = source[at]
    if (!inClass && source.startsWith('[^\\W\\d_]', at)) {
      out += `[${LETTER}]`
      at += 7
    } else if (char === '\\') {
      const next = source[++at]
      if (next === 'w') out += inClass ? W : `[${W}]`
      else if (next === 'W') out += `[^${W}]`
      else if (next === 'd') out += '\\p{Nd}'
      else if (next === 'D') out += '\\P{Nd}'
      else if (next === 's') out += inClass ? BLANK : `[${BLANK}]`
      else if (next === '-' && !inClass) out += '-'
      else out += `\\${next}`
    } else if (inClass) {
      if (char === ']') inClass = false
      out += char
    } else if (char === '[') {
      inClass = true
      out += char
    } else if (char === '$') out += '(?=\\n?$)'
    else if (char === '^' && multiline) out += '(?<![^\\n])'
    else if (source.startsWith('(?P<', at)) {
      out += '(?<'
      at += 3
    } else out += char
  }
  return out
}
/** A pattern of the server's, ready for search (`g`), match (`y`) and fullmatch (`whole`). */
interface Look {
  g: RegExp
  y: RegExp
  whole: RegExp
}
function look(source: string, flags = '', multiline = false): Look {
  const js = py(source, multiline)
  return {
    g: new RegExp(js, `gu${flags}`),
    y: new RegExp(js, `yu${flags}`),
    whole: new RegExp(`(?:${js})(?![\\s\\S])`, `yu${flags}`),
  }
}
// Python's look.search(text, pos, endpos), match and fullmatch: a lookbehind
// sees the text before `pos`, and nothing is seen from `endpos` on.
const upTo = (text: string, end: number) => (end < text.length ? text.slice(0, end) : text)
function search(found: Look, text: string, pos = 0, end = text.length) {
  found.g.lastIndex = Math.max(0, pos)
  return found.g.exec(upTo(text, end))
}
function matchAt(found: Look, text: string, pos: number, end = text.length) {
  found.y.lastIndex = pos
  return found.y.exec(upTo(text, end))
}
function fullAt(found: Look, text: string, pos = 0, end = text.length) {
  found.whole.lastIndex = pos
  return found.whole.exec(upTo(text, end))
}
/** Python's list(look.finditer(text, pos, endpos)). */
function findAll(found: Look, text: string, pos = 0, end = text.length) {
  const within = upTo(text, end)
  const matches: RegExpExecArray[] = []
  found.g.lastIndex = Math.max(0, pos)
  for (let match = found.g.exec(within); match; match = found.g.exec(within)) {
    matches.push(match)
    if (!match[0]) found.g.lastIndex++
  }
  return matches
}
type Span = [number, number]
const spanOf = (match: RegExpExecArray): Span => [match.index, match.index + match[0].length]
const marksOf = (found: Look, text: string) => findAll(found, text).map((match) => match.index)
const blanked = (match: string) => ' '.repeat(match.length)
const blankOut = (found: Look, text: string) => text.replace(found.g, blanked)
function bisectLeft(list: number[], value: number) {
  let low = 0
  let high = list.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (list[middle]! < value) low = middle + 1
    else high = middle
  }
  return low
}
function bisectRight(list: number[], value: number) {
  let low = 0
  let high = list.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (value < list[middle]!) high = middle
    else low = middle + 1
  }
  return low
}
/** _near: whether the sorted `marks` have a position in [low, high]. */
function near(marks: number[], low: number, high: number) {
  const index = bisectLeft(marks, low)
  return index < marks.length && marks[index]! <= high
}
/** The value of a run of decimal digits of any script, as Python's int and float read it. */
function decimal(text: string) {
  return Number(
    text.replace(/\p{Nd}/gu, (char) => {
      const code = char.charCodeAt(0)
      if (code < 128) return char
      let back = 0
      while (back < 9 && /\p{Nd}/u.test(String.fromCharCode(code - back - 1))) back++
      return String(back)
    }),
  )
}
const digitCount = (text: string) => (text.match(/\p{Nd}/gu) || []).length
const sorted = (list: number[]) => list.sort((one, other) => one - other)
const list = (...lines: string[]) => lines.join(' ').split(' ')

// --- The person's name (name_in) ------------------------------------------------

const NAME_WORD = look(String.raw`[^\W\d_](?:[^\W\d_]|['’‘ʼʻ${TICK}\-](?=[^\W\d_]))*`)
/** The modifier letters Uzbek writes o‘, g‘ and the tutuq with: not letters of a name's alphabet. */
const MARKS = 'ʻʼ'
const NAME_WORDS = 4
const A = `['’‘ʼʻ${TICK}]`
const NAME_LABEL = look(String.raw`^[ \t•*\-]*(?:full\s+)?name\s*[:\-–—]\s*`, 'i', true)
const LABEL = look(
  String.raw`(?<![\w'’‘ʼʻ])(?:my\s+(?:full\s+)?name(?:\s+is)?|(?:full\s+)?name\s+and\s+surname|full\s+name` +
    String.raw`|i\s+am|i['’]m|mening\s+ismim` +
    String.raw`|ismi?[\s,\-]+(?:va\s+)?familiya(?:m|si)?|ismi?[\s\-]+sharif(?:im|i)?` +
    String.raw`|familiya(?:si|m)?[\s,]+ismi?m?(?:[\s,]+(?:va\s+)?(?:otasining\s+ismi|sharifi?))?` +
    String.raw`|to` +
    A +
    String.raw`?liq\s+ism(?:im|i)?|ismim|ismi|ism|f\.?\s*i\.?\s*sh\.?|f\.?\s*i\.?\s*o\.?|men` +
    String.raw`|меня\s+зовут|мо[её]\s+имя|имя\s+и\s+фамилия|фамилия[\s,]+имя(?:[\s,]+(?:и\s+)?отчество)?|имя` +
    String.raw`|ф\.?\s*и\.?\s*о\.?|фио` +
    String.raw`|исми?[\s,\-]+(?:ва\s+)?фамилия(?:м|си)?|исми?[\s\-]+шариф(?:им|и)?` +
    String.raw`|фамилия(?:си|м)?[\s,]+исми?м?(?:[\s,]+(?:ва\s+)?(?:отасининг\s+исми|шарифи?))?` +
    String.raw`|тўлиқ\s+исм(?:им|и)?|исмим|исми|исм|мен|я)(?![\w'’‘ʼʻ])\s*[,:\-–—]?\s*`,
  'i',
)
const FIRST = look(
  String.raw`(?<![\w'’‘ʼʻ])(?<!otasining )(?<!отасининг )(?:(?:first\s+name|ismi?|исми?|имя)\s*[:\-–—]` +
    String.raw`|ismim|исмим)\s*`,
  'i',
)
const LAST = look(
  String.raw`(?<![\w'’‘ʼʻ])(?:(?:last\s+name|surname|familiya(?:si)?|фамилия(?:си)?)\s*[:\-–—]` +
    String.raw`|familiyam|фамилиям)\s*`,
  'i',
)
const PATRONYMIC = look(
  String.raw`\s+(?:o['’‘ʼʻ${TICK}]?g['’‘ʼʻ${TICK}]?li|ugli|qizi|kizi|ўғли|угли|қизи|кизи|кызы)(?![\w'’‘ʼʻ])`,
  'i',
)
/**
 * What ends the run of words that is a name on a line of its own: a stop, a
 * bracket, a dash, "!", or a symbol or an emoji ("Madina Sultanova 👩‍💼",
 * "Aziz Karimov!"), which SYMBOL_AFTER finds and `ends` reads by its category.
 */
const AFTER = look(String.raw`\s*(?:$|[,;.:(|/!]|[–—-]\s)`)
const SYMBOL_AFTER = look(String.raw`[ \t]*([^\w\s])`)
const SYMBOL = /^[\p{So}\p{Sk}]$/u
/** A phone written with its + or an email, on the name's line with no comma: "Dilnoza Karimova +998 90 …". */
const CONTACT_AFTER = look(String.raw`[ \t]+(?:\+[ \t]?\d|[\w.+\-']+@[\w\-]+\.\w)`)
/** An age or a birth year straight after the name on the first line: "Rahimov Otabek 25 yosh". */
const NUMBER_AFTER = look(String.raw`\s+\d`)
/**
 * The word after a name on the first line, a job title in lower case: "Aziz
 * Karimov kassir 2019-2022". Not after a word in an Uzbek case, which says where
 * the job is ("Uzum Marketda menejer"), nor a job that is someone's ("Yandex Go
 * haydovchisi").
 */
const WORD_AFTER = look(String.raw`[ \t]+([^\W\d_]+)`)
const CASE_ENDING = look(String.raw`(?:da|dan|dagi|ning|да|дан|даги|нинг)$`)
/**
 * The end of a sentence a line opens with, before the name: "Добрый день, нужно
 * резюме. Шерзод Мирзаев". The server's pattern, tried only where a run of
 * stops starts, which finds the same ones; tried at every stop of a run, it read
 * a run of 12,000 in its square (0.1 s here, 0.6 s on the server).
 */
const SENTENCE_OPENS = look(String.raw`(?<![.!?:])[.!?:]+[ \t]+`)
const SENTENCE_WORD = look(String.raw`[^\W\d_]+(?:['’‘ʼʻ${TICK}][^\W\d_]+)*`)
const SENTENCE_MARKS = new Set([...` \t,'’‘ʼʻ${TICK}-`])
/**
 * Labels that name a CV rather than its person, and so read a name only when no
 * capitalised word follows it (a job title: "CV: Full Stack Developer"): "CV for
 * Laziz Umarov please", "Резюме: Лола Назарова".
 */
const CV_LABEL = look(
  String.raw`(?<![\w'’‘ʼʻ])(?:(?:cv|resume|résumé|rezyume|резюме|obyektivka)(?:[ \t]+(?:for|uchun))?` +
    String.raw`[ \t]*:|(?:cv|resume|résumé)[ \t]+for)[ \t]*`,
  'i',
)
const CAPITAL_AFTER = look(String.raw`[ \t]+(?=[^\W\d_])`)
/** A CV asked for in Russian for someone named after "для", in the genitive: "резюме для Тимура Сафарова". */
const GENITIVE_FOR = look(String.raw`(?<![\w'’‘ʼʻ])(?:резюме|рез[юу]ме|cv|анкет[ау])[ \t]+для[ \t]+`, 'i')
/**
 * A later sentence of a line, after a full stop, "!" or "?" (not a colon:
 * "Skills: Adobe Photoshop"), and what makes the words it starts with a name: a
 * phone or an email straight after them or after a comma ("Хочу работать
 * бухгалтером. Наталья Павлова, natalya@…").
 */
const LATER_SENTENCE = look(String.raw`(?<![.!?])[.!?]+[ \t]+`)
const CONTACT_CLOSE = look(String.raw`[ \t]*,?[ \t]*(?:\+?[ \t]?\(?\d[\d \t()\-]{6}|[\w.+\-']+@[\w\-]+\.\w)`)
/**
 * The ending of a surname: a name may go on with dates from and to on the first
 * line ("Фарход Умаров, 2015–2019 …") where an employer's words ("UzAuto
 * Motors, 2018-2022") may not.
 */
const SURNAME_END = look(
  String.raw`(?:ov|ova|ev|eva|yev|yeva|ovich|evich|ovna|evna|in|ina|ов|ова|ев|ева|ёв|ёва|ин|ина` +
    String.raw`|ын|ына|ович|евич|овна|евна|ский|ская|цкий|цкая|ий|enko|енко|yan|ян|dze|дзе|shvili|швили)$`,
)
const SPAN_AFTER = look(
  String.raw`\s*(?:[,;(]\s*)?(?:\d{1,2}[./])?(?:19|20)\d{2}\s*[-–—]\s*` +
    String.raw`(?:(?:\d{1,2}[./])?(?:19|20)?\d{2}(?!\d)|hozir|present|now|current|наст|н\.\s*в)`,
  'i',
)
const COMPANY_AFTER = look(
  String.raw`\s*(?:,\s*)?(?:kompaniya\w*|firma\w*|korxona\w*|tashkilot\w*|mchj|xk|aj|ooo|ооо|оао|зао|ао|аж|llc|ltd|inc` +
    String.raw`|компани\w*|фирм\w*|предприяти\w*|da|dan|ga)(?![\w'’‘ʼʻ])`,
  'i',
)
const TITLE = look(String.raw`(?:dr|mr|mrs|ms|miss|prof|д-р)\.?\s+`, 'i')
const MONTHS = new Set(
  list(
    'january february march april may june july august september october november december yanvar fevral mart',
    'aprel iyun iyul avgust sentabr sentyabr oktabr oktyabr noyabr dekabr январь января февраль февраля март марта',
    'апрель апреля май мая июнь июня июль июля август августа сентябрь сентября октябрь октября ноябрь ноября',
    'декабрь декабря',
  ),
)
const PLACES = list(
  'toshkent tashkent ташкент samarqand samarkand самарканд buxoro bukhara бухар andijon andijan андижан namangan',
  "наманган farg'ona fargona fergana фергана navoiy navoi навои jizzax jizzakh джизак termiz termez термез urganch",
  "urgench ургенч qo'qon kokand коканд marg'ilon margilan маргилан chirchiq чирчик olmaliq алмалык angren ангрен",
  'nukus нукус xorazm khorezm хорезм xiva khiva хива qarshi karshi карши guliston gulistan гулистан surxondaryo',
  "qashqadaryo sirdaryo qoraqalpog'iston karakalpakstan каракалпакстан o'zbekiston uzbekistan узбекистан moskva",
  'moscow москв almaty алмат astana астан bishkek бишкек dushanbe душанбе london лондон seoul сеул istanbul стамбул',
  'dubai дубай',
)
const PLACE_ENDINGS = new Set([
  '',
  ...list('da dan ga ning ni dagi lik a e u y om ой а е у ы ом ский ская ское ского ской ском ую'),
])
/**
 * Greetings, farewells, thanks, a call for help and the fillers people send a
 * bot, in each language and alphabet: never part of a name, and a sentence of
 * nothing else is no more than a greeting (PREAMBLE). "Kun", "tong", "день" and
 * "утро" are left out: the word before them says it. Words that are also a name
 * (Salam) or another word (day, nice) are FILLERS.
 */
const GREETINGS = new Set(
  list(
    'hello salom assalomu alaykum привет здравствуйте dear hurmatli уважаемые hi hey hiya howdy greetings good',
    'morning afternoon evening welcome goodbye bye thanks thank thx help assalom vaalaykum aleykum hayrli xayrli',
    'salomlar qalaysiz qalesiz hormang xormang yordam raxmat ассалому ассалом алайкум алейкум салом хайрли ҳайрли',
    'раҳмат ёрдам приветствую здравствуй здрасте здрасьте добрый доброе доброй спасибо благодарю помогите помоги',
    'помощь privet zdravstvuyte zdravstvuite spasibo pomogite dobriy dobryy dobroe goodnight wassup whassup whatsup',
    'salomaleykum salomalaykum salomalekum assalomualaykum assalomualeykum assalamualaykum assalamu yaxshimisiz',
    "yaxshimisan yahshimisiz qalaysan qandaysiz qandaysan xayr hayr ko'rishguncha korishguncha tashakkur tushunmadim",
    'tushunmayapman bilmayman bilmadim яхшимисиз яхшимисан қалайсиз калайсиз хайр ҳайр тушунмадим билмайман здорово',
    'здарова здорова здаров здравия хорошего хорошей доброго пока свидания досвидания приветик приветики приветули',
    'хаюшки спасибки спс благодарствую знаю понимаю непонятно qwerty йцукен',
  ),
)
const NOT_NAMES = new Set([
  ...GREETINGS,
  ...list(
    'cv resume résumé rezyume резюме curriculum vitae profile profil профиль experience tajriba tajribasi tajribam',
    "опыт education ta'lim talim образование skills ko'nikmalar ko'nikmalari навыки contact contacts aloqa контакты",
    'phone telefon телефон email address manzil адрес summary objective maqsad цель personal professional additional',
    "languages projects certificates certifications references interests hobbies work ish shaxsiy kasbiy ma'lumot",
    "ma'lumotlar qo'shimcha tillar loyihalar sertifikatlar qiziqishlar личные данные дополнительно языки проекты",
    'сертификаты работы customer service support senior junior middle lead head chief intern stajyor стажёр стажер',
    "student talaba студент teacher o'qituvchi учитель doctor shifokor врач nurse hamshira медсестра director",
    'direktor директор mutaxassis marketing маркетинг sales savdo продажи product data hr it ielts toefl sat python',
    "java javascript excel microsoft google english ingliz английский russian rus русский uzbek o'zbek узбекский",
    'korean koreys корейский german nemis немецкий state national milliy национальный international xalqaro',
    'международный republic respublika республика bank банк llc mchj ооо ltd inc group company center centre markaz',
    'markazi центр school maktab школа college kollej колледж lyceum litsey лицей medical tibbiyot technical texnika',
    // The introductions themselves, so they never start a name: "Мен Каримов Акмал", "Ismim Jasur".
    'men мен ismim исмим familiyam фамилиям ism исм ismi исми',
    // Jobs written with a capital, and the words of a brand or an organisation.
    'bosh hisobchi kassir кассир operator оператор haydovchi водитель sotuvchi продавец oshpaz повар farrosh qorovul',
    'ofitsiant официант xalq market маркет motors systems electronics banki банки taxi такси group холдинг holding',
  ),
])
/** Short answers that are no one's name: "ha", "ok", "rahmat", "Mayli", "Понятно". */
const NOT_NAME_ANSWERS = new Set(
  list(
    "ha yo'q yoq ok okay yes no да нет ха йўқ rahmat рахмат спасибо thanks thank you please iltimos пожалуйста kerak",
    "нужно what why how yeah yep nope sure sorry alright understood there start menu cancel mayli xop xo'p xa yaxshi",
    'tushunarli tushundim albatta kechirasiz майли хоп хўп ҳа яхши тушунарли албатта кечирасиз хорошо понятно ладно',
    'окей ок угу ага конечно что ясно понял поняла отлично извините простите давайте horosho xorosho ponyatno ladno',
  ),
)
/**
 * Words that are no name only when every word beside them is one of these or of
 * the lists above: "Have a nice day", "Nima gap", "Как дела", "Test", while
 * Doris Day, Kun Li and Salam Karimov are names.
 */
const FILLERS = new Set(
  list(
    "have a an the nice great day night to too see meet soon later are is it going up what's whats sup yo bro dude i",
    "don't dont know test testing tests salam nima gap gaplar ishlar qalay nega nimaga qanday aka opa uka нима гап",
    'гаплар ишлар қалай калай ака опа салам как дела делишки ты вы жизнь нового не я до хай ку куку йоу бро брат тест',
    'тесты тестирую тестовый kun tong kech tun день дня утро вечер вечера ночи',
  ),
)
const FILLED = new Set([...FILLERS, ...NOT_NAME_ANSWERS])
/**
 * The words of a greeting or a request a line may open with before the name:
 * "Добрый день, нужно резюме. Шерзод Мирзаев, …", "Me: Ziyoda Rahmonova".
 */
const PREAMBLE = new Set([
  ...GREETINGS,
  ...NOT_NAME_ANSWERS,
  ...FILLERS,
  ...list(
    'me my for need want would like make create write do can could cv resume résumé here is details rezyume',
    'obyektivka menga meni mening uchun qilib qiling bering yozib tuzib tayyorlab berasizmi olasizmi ham bitta mana',
    "ma'lumotlarim ma'lumotlar резюме объективка мне нужен нужна надо сделайте сделать сделай составьте составить",
    'напишите написать помочь для меня хочу хотел хотела бы можно вот мои данные менга учун керак',
  ),
])
const NOT_NAME_STEMS = list(
  'universit университет institut институт academ akademi академи manager menejer менеджер developer dasturchi',
  'разработчик engineer muhandis инженер designer dizayner дизайнер specialist специалист accountant buxgalter',
  'бухгалтер преподават analyst analitik аналитик consultant konsultant консультант министерств vazirlig ministry',
  'department kompaniya компани',
)
/** apps/studio/pages.py UNIT_WORDS: a page count is no name. */
const UNIT_WORDS = look(
  String.raw`pages?|slides?|sahifa\w*|bet(?:lik|lar|li|dan)?|var[ao]q\w*|slayd\w*|страниц\w*|стр|слайд\w*|лист(?:а|ов)?`,
  'i',
)
const APOSTROPHES = /[‘’ʻʼ`´]/g
const LATIN_OR_CYRILLIC = /[\p{Script=Latin}\p{Script=Cyrillic}]/u
/** _folded: lower case, every apostrophe written as '. */
const folded = (text: string) => text.normalize('NFC').replace(APOSTROPHES, "'").toLowerCase()
/** _capital: two or more Latin or Cyrillic letters, the first a capital (ʻ and ʼ are marks, not letters). */
function capital(word: string) {
  const letters = [...word].filter((char) => /\p{L}/u.test(char) && !MARKS.includes(char))
  return (
    letters.length >= 2 &&
    /^\p{Uppercase}/u.test(word) &&
    letters.every((char) => LATIN_OR_CYRILLIC.test(char) && !/[\p{Lm}ªº]/u.test(char))
  )
}
/** _excluded: a month, a place, the word of a heading, a job, an organisation or a page count. */
function excluded(word: string) {
  const plain = folded(word)
  return (
    MONTHS.has(plain) ||
    NOT_NAMES.has(plain) ||
    NOT_NAME_STEMS.some((stem) => plain.startsWith(stem)) ||
    PLACES.some((place) => plain.startsWith(place) && PLACE_ENDINGS.has(plain.slice(place.length))) ||
    !!fullAt(UNIT_WORDS, plain)
  )
}
const LEADING_BLANK = new RegExp(`[${BLANK}]*`, 'yu')
/**
 * _run: the capitalised words from `start` on, the first after blank space only
 * and each next one a space or a tab after the last, up to the first that is no
 * part of a name; at most one word more than a name has.
 */
function run(text: string, start: number) {
  const words: Span[] = []
  LEADING_BLANK.lastIndex = start
  LEADING_BLANK.exec(text)
  let at = LEADING_BLANK.lastIndex
  for (;;) {
    const word = matchAt(NAME_WORD, text, at)
    if (!word || !capital(word[0]) || excluded(word[0])) break
    words.push(spanOf(word))
    const end = word.index + word[0].length
    if (words.length > NAME_WORDS || (text[end] !== ' ' && text[end] !== '\t')) break
    at = end + 1
  }
  return words
}
/** _end: where the name the words make ends, after its patronymic when one follows. */
function nameEnd(text: string, words: Span[]) {
  const end = words[words.length - 1]![1]
  const patronymic = matchAt(PATRONYMIC, text, end)
  return patronymic ? patronymic.index + patronymic[0].length : end
}
/**
 * _filled: whether every word of `words` is a filler or a short answer
 * (FILLERS): "Have a nice day", "Nima gap", "Как дела", "Test".
 */
function filled(text: string, words: Span[]) {
  return words.every(([start, end]) => {
    const plain = folded(text.slice(start, end)).replace(/\.+$/, '')
    return FILLED.has(plain) || plain.split('-').every((part) => FILLED.has(part))
  })
}
/**
 * _named: whether the words make a name: two to four of them, not all fillers,
 * and no organisation's after them.
 */
const named = (text: string, words: Span[]) =>
  words.length >= 2 &&
  words.length <= NAME_WORDS &&
  !filled(text, words) &&
  !matchAt(COMPANY_AFTER, text, nameEnd(text, words))
/** The first word alone after one of `labels` ("Ism: Dilnoza … Familiya: Karimova"). */
function single(labels: Look, text: string) {
  return findAll(labels, text).some((label) => run(text, label.index + label[0].length).length === 1)
}
const NOT_BLANK = new RegExp(`[^${BLANK}]`, 'u')
const LINE_START = /^[ \t•·*\-–—]*/u
/** Python's str.islower: a cased letter, and every cased one in lower case. */
const lower = (word: string) => /\p{Lowercase}/u.test(word) && !/[\p{Uppercase}\p{Lt}]/u.test(word)
/**
 * _ends: whether what follows a name's words at `end` on its line leaves them a
 * name: the end of the line, a stop, a bracket, a dash, "!", a symbol or an
 * emoji, a phone with its + or an email, and on the first line (`opening`) also
 * an age, a birth year or a job title in lower case after a word in no Uzbek case.
 */
function ends(line: string, words: Span[], end: number, opening: boolean) {
  if (matchAt(AFTER, line, end) || matchAt(CONTACT_AFTER, line, end)) return true
  const symbol = matchAt(SYMBOL_AFTER, line, end)
  if (symbol && SYMBOL.test(symbol[1]!)) return true
  if (!opening) return false
  if (matchAt(NUMBER_AFTER, line, end)) return true
  const word = matchAt(WORD_AFTER, line, end)
  const job = word && lower(word[1]!) ? folded(word[1]!) : ''
  const [lastStart, lastEnd] = words[words.length - 1]!
  return (
    !!matchAt(JOB, job, 0) &&
    !job.endsWith('si') &&
    !job.endsWith('си') &&
    !search(CASE_ENDING, folded(line.slice(lastStart, lastEnd)))
  )
}
/**
 * _openings: where a name may start on `line`: at `start`, and after each
 * sentence of greetings and requests the line opens with (PREAMBLE): "Добрый
 * день, нужно резюме. Шерзод Мирзаев", "Xayrli kun! Rezyume uchun: Zuhra Islomova".
 */
function* openings(line: string, start: number) {
  yield start
  let position = start
  for (let stop = search(SENTENCE_OPENS, line, position); stop; stop = search(SENTENCE_OPENS, line, position)) {
    const sentence = line.slice(position, stop.index)
    const said = findAll(SENTENCE_WORD, sentence).map((word) => word[0])
    if (
      !said.length ||
      [...sentence].some((char) => !(/\p{L}/u.test(char) || SENTENCE_MARKS.has(char))) ||
      said.some((word) => !PREAMBLE.has(folded(word)))
    )
      return
    position = stop.index + stop[0].length
    yield position
  }
}
/** _surnamed: whether one of a name's words ends as a surname does (SURNAME_END). */
const surnamed = (text: string, words: Span[]) =>
  words.some(([start, end]) => !!search(SURNAME_END, folded(text.slice(start, end))))
/**
 * _line_name: whether the words at `start` of `line` make a name (`ends`).
 * Words that go on with dates from and to are an employer's or a school's line,
 * unless on the first line one of them is a surname.
 */
function lineName(line: string, start: number, opening: boolean) {
  const title = matchAt(TITLE, line, start)
  const words = run(line, title ? title.index + title[0].length : start)
  if (!words.length) return false
  const end = nameEnd(line, words)
  if (matchAt(SPAN_AFTER, line, end) && !(opening && surnamed(line, words))) return false
  if (!ends(line, words, end, opening)) return false
  return named(line, words)
}
/** Python's str.isalpha for the one character at `at`. */
const letterAt = (text: string, at: number) => /^\p{L}$/u.test(String.fromCodePoint(text.codePointAt(at) ?? 32))
/**
 * _later_name: whether a name starts a later sentence of `line` and is followed
 * by a phone or an email (CONTACT_CLOSE).
 */
function laterName(line: string) {
  for (const stop of findAll(LATER_SENTENCE, line)) {
    const at = stop.index + stop[0].length
    if (!letterAt(line, at)) continue
    const words = run(line, at)
    if (words.length && matchAt(CONTACT_CLOSE, line, nameEnd(line, words)) && named(line, words)) return true
  }
  return false
}
/** name_in: whether the description names the person (the server's own docstring says how). */
function nameIn(raw: string) {
  const text = raw.normalize('NFC')
  const labels = [...findAll(NAME_LABEL, text), ...findAll(LABEL, text)].sort(
    (one, other) => one.index - other.index,
  )
  if (labels.some((label) => named(text, run(text, label.index + label[0].length)))) return true
  if (single(FIRST, text) && single(LAST, text)) return true
  const lines = text.split('\n')
  const opening = Math.max(
    0,
    lines.findIndex((line) => NOT_BLANK.test(line)),
  )
  for (const [index, line] of lines.entries())
    for (const start of openings(line, LINE_START.exec(line)![0].length))
      if (lineName(line, start, index === opening)) return true
  for (const label of findAll(CV_LABEL, text)) {
    const words = run(text, label.index + label[0].length)
    if (!words.length) continue
    const after = matchAt(CAPITAL_AFTER, text, nameEnd(text, words))
    if (after && /^\p{Uppercase}/u.test(text.slice(after.index + after[0].length))) continue
    if (named(text, words)) return true
  }
  for (const label of findAll(GENITIVE_FOR, text)) {
    const at = label.index + label[0].length
    if (letterAt(text, at) && named(text, run(text, at))) return true
  }
  return lines.some(laterName)
}

// --- A contact and a background (facts) -------------------------------------------

const BEGIN = String.raw`(?<![\w'])`
const END = String.raw`(?![\w'])`
const SPACE_RUN = /[ \t]{2,}/g
/**
 * _words: whole words, `words` exactly and `stems` with any ending, an apostrophe
 * in them optional. The server writes each stem with its own \w* and each word
 * with its own END; here they share one, which matches the same (the first stem
 * that matches wins either way, and \w* always does) and is compiled in a
 * fraction of the time: hundreds of copies of a Unicode class took the first
 * keystroke tens of milliseconds.
 */
function words(stems: string[] = [], whole: string[] = []) {
  const optional = (word: string) => word.replaceAll("'", "'?")
  const parts = [
    ...(stems.length ? [`(?:${stems.map(optional).join('|')})\\w*`] : []),
    ...(whole.length ? [`(?:${whole.map(optional).join('|')})${END}`] : []),
  ]
  return look(`${BEGIN}(?:${parts.join('|')})`)
}
const WORK = words(
  list(
    'experience employ internship position career freelanc business job ishla ishxona ishchi lavozim tajriba amaliyot',
    "kompaniya korxona biznes tadbirkor do'kon shug'ullan faoliyat stajirovka работ опыт стаж должност стажир компани",
    'сотрудни карьер занимал предпринимат бизнес ремонт деятельност трудов ишла тажриба лавозим корхона',
  ),
  [
    ...list(String.raw`work(?:ed|ing|s)? intern compan(?:y|ies) self-employed mchj ooo ооо занимаюсь`),
    ...list(String.raw`ish(?:ga|da|dan|ni|i|im|lari)? иш(?:га|да|дан)? сво[её]\s+дело ип`),
  ],
)
const JOB = words(
  [
    ...list(
      'manager developer programmer engineer designer specialist accountant analyst consultant teacher tutor doctor',
      'nurse director operator cashier driver seller cook chef waiter waitress barista administrator assistant',
      'secretar coordinator supervisor officer executive architect technician mechanic electrician plumber welder',
      'builder courier cleaner lawyer translator interpreter photographer editor journalist marketer recruiter',
      'trainer coach pharmacist dentist lecturer professor researcher economist auditor dispatcher tester',
      'hairdresser hairstylist stylist barber tailor seamstress nann babysitter psychologist therapist founder',
      'co-founder entrepreneur copywriter worker baker farmer carpenter bricklayer locksmith janitor housekeeper',
      'caregiver cosmetologist masseu florist merchandiser storekeeper librarian actor actress singer musician',
      'steward veterinar agronomist geologist chemist notary loader packer salesperson realtor logistician forwarder',
    ),
    'tour guide',
    ...list(
      "menejer dasturchi muhandis dizayner mutaxassis buxgalter hisobchi analitik konsultant o'qituvchi ustoz murabbiy",
      'shifokor vrach hamshira direktor rahbar kassir haydovchi sotuvchi oshpaz ofitsiant yordamchi kotib koordinator',
      'nazoratchi arxitektor texnik mexanik elektrik payvandchi santexnik quruvchi kuryer farrosh qorovul advokat',
      'yurist tarjimon fotograf muharrir jurnalist marketolog treyner farmatsevt stomatolog tadqiqotchi iqtisodchi',
      'dispetcher omborchi savdo stajyor sartarosh tikuvchi taksichi tarbiyachi usta novvoy pazanda konditer',
      "duradgor bo'yoqchi plitkachi prorab inspektor massajchi kosmetolog vizajist stilist mudir kutubxonachi aktyor",
      "qo'shiqchi musiqachi fermer dehqon bog'bon chorvador traktorchi tokar repetitor targetolog montajchi mashinist",
      'uchuvchi styuardessa xodim agronom geolog kimyogar psixolog huquqshunos notarius sudya politsiya militsiya',
      'asoschi enaga менеджер разработчик программист инженер дизайнер специалист бухгалтер аналитик консультант',
      'учител преподават репетитор врач медсестр директор оператор кассир водител продав повар официант бариста',
      'администратор секретар ассистент помощник координатор руководител архитектор техник механик электрик',
      'сварщик сантехник строител мастер курьер уборщи охранник юрист адвокат переводчик фотограф редактор журналист',
      'маркетолог тренер фармацевт стоматолог лектор исследовател экономист аудитор диспетчер кладовщик продаж',
      'стажёр стажер парикмахер грузчик таксист воспитател тестировщик владел основател маляр плотник фермер',
      'косметолог массажист бармен сторож дворник консьерж риелтор риэлтор нотариус таргетолог копирайтер монтажер',
      'монтажёр экскурсовод слесар токар каменщик штукатур кровельщик тракторист комбайнер комбайнёр пекар кондитер',
      'горничн логист экспедитор товаровед мерчендайзер прораб ветеринар психолог стилист визажист швейн закройщи',
      'портних агроном библиотекар стюард актёр актер музыкант певец певиц полицейск ҳайдовчи хайдовчи сотувчи',
      'ўқитувчи укитувчи муҳандис мухандис дастурчи ҳисобчи хисобчи ошпаз ҳамшира хамшира шифокор тикувчи сартарош',
    ),
  ],
  list(
    String.raw`head lead(?:er)? senior junior smm hr sales(?:man|woman|person)? qa owner owners ceo cto cfo guard`,
    String.raw`guards maid egasi egasiman швея швеёй швеей ня(?:ня|ней|ни|ню) агент агентом пилот пилотом портной`,
  ),
)
const ORG = words(
  list(
    'kompaniya korxona firma tashkilot agentlig bank klinika shifoxona restoran studiya zavod компани фирм',
    'предприяти агентств банк клиник больниц ресторан студи завод холдинг',
  ),
  list(
    String.raw`mchj llc ltd inc ooo ооо оао зао compan(?:y|ies) firm corporation enterprise organi[sz]ation agency`,
    'clinic hospital restaurant studio factory holding',
  ),
)
const DONE_VERB = words(list('ishlay ishlag ishlad ishlamoqda работал проработал трудил'), [
  ...list(String.raw`work(?:ed|ing|s)? employed ishlab работаю работаем`),
  String.raw`faoliyat\s+yurit\w*`,
])
const WISH = [
  String.raw`looking\s+(?:for|to)`,
  String.raw`look(?:s|ed)?\s+for`,
  String.raw`seek(?:s|ing)?`,
  String.raw`search(?:ing)?\s+(?:for|of)`,
  'applying',
  String.raw`apply(?:ing)?\s+(?:for|to)`,
  String.raw`applicant\w*`,
  String.raw`candidate\w*`,
  String.raw`open\s+to`,
  String.raw`interested\s+in`,
  // The day the person is free to start from is a wish too: "available from 01.11.2025", "ready to start from
  // November 2025", "can start work from", "free from 2025", "готова выйти на работу с", "могу выйти с ноября".
  String.raw`availab(?:le|ility)`,
  String.raw`ready\s+to\s+(?:start|begin|join|work)`,
  String.raw`(?:can|could)\s+(?:start|begin|join)`,
  String.raw`free\s+(?:from|since|starting)`,
  String.raw`(?:готов\w*|могу|смогу|можем|сможем)\s+(?:выйти|приступить|начать)`,
  'выйду',
  'приступлю',
  String.raw`свобод(?:ен|на|ны)(?=\s+(?:с|со|от)\s)`,
  String.raw`доступ(?:ен|на)(?=\s+(?:с|со|от)\s)`,
  String.raw`(?:want|wish|hope|plan|would\s+like|like|love|aim|need|dream)(?:s|ed)?\s+to`,
  String.raw`(?:planning|hoping|aiming|wanting|wishing)\s+to`,
  String.raw`dreaming\s+(?:to|of)`,
  String.raw`(?:want|wish|need|seek)(?:s|ed)?\s+(?:a|an|the)\s+(?:[\w-]+\s+){0,2}` +
    '(?:job|position|role|work|internship|vacancy)',
  'objective',
  String.raw`aspir\w+`,
  String.raw`vacanc\w+`,
  'desired',
  'wanted',
  'ищу',
  'ищем',
  'хочу',
  String.raw`хотел\w*`,
  'желаю',
  'планирую',
  'мечтаю',
  'стремлюсь',
  String.raw`соискател\w*`,
  String.raw`претенд\w+`,
  'рассматриваю',
  String.raw`готов\w*\s+(?:к|на)`,
  String.raw`открыт\w*\s+к`,
  'вакансия',
  'цель',
  String.raw`maqsad\w*`,
  String.raw`в[ \t]поиск\w*`,
]
const WISH_UZ = [
  String.raw`ish\s+izla\w*`,
  String.raw`ish\s+qidir\w*`,
  String.raw`ish\s+axtar\w*`,
  String.raw`ishlamoqchi\w*`,
  String.raw`ishlashni\s+(?:xohla\w*|istay\w*|istardim)`,
  String.raw`ishga\s+(?:kirmoqchi\w*|joylash\w*|kirish\w*)`,
  String.raw`ish\s+topmoqchi\w*`,
  String.raw`ish\s+topish\w*`,
  String.raw`ish\s+kerak`,
  'lavozimiga',
  String.raw`lavozim\s+uchun`,
  String.raw`vakansiya\w*`,
  // "1-noyabrdan ishga chiqa olaman", "01.11.2025 dan boshlab ishlay olaman", "ishga tayyorman".
  String.raw`(?:ishga\s+)?(?:chiqa|kirisha|boshlay|ishlay)\s+olaman`,
  String.raw`ishga\s+chiqaman`,
  String.raw`ishga\s+chiqishim\s+mumkin`,
  String.raw`(?:ishga|ishlashga|ishga\s+chiqishga|ish\s+boshlashga)\s+tayyor\w*`,
  String.raw`bo'?shman`,
]
const STOP =
  'with|and|but|who|where|which|that|i|my|have|having|и|но|а|у|с|имею|есть|bor|va|lekin|ammo|hamda|men|menda'
const SAID =
  String.raw`experience|опыт\w*|стаж\w*|tajriba\w*|тажриба\w*|работал\w*|проработал\w*|ishlag\w*|ishlad\w*|worked` +
  String.raw`|graduated|studied|bitirgan\w*|bitird\w*|tamomlagan\w*|tamomlad\w*|tugatgan\w*|tugatd\w*|окончил\w*` +
  String.raw`|закончил\w*`
const WISH_WORD = `(?!(?:${STOP}|${SAID})${END})(?![^\\s.,;:!?\\-]*\\d)[^\\s.,;:!?\\-]+`
/** What a person writes about the job they want, with up to eight words after it (the server says how far). */
const WISHED = look(
  `${BEGIN}(?:${WISH.join('|')})(?:[ \\t:\\-]+${WISH_WORD}){0,8}|${BEGIN}(?:${WISH_UZ.join('|')})${END}`,
)
/**
 * A dream, a hope or a plan of the person's own: "Mening orzuyim", "umidim",
 * "rejam", "Мечтаю", "My dream is to". Only the forms that say whose it is, as
 * Umid, Umida and Orzu are names.
 */
const DREAM =
  String.raw`orzu(?:yim|im|m|miz|imiz|yimiz)|orzu[ \t]qil\w*|umid(?:im|imiz|vor\w*)|umid[ \t]qil\w*|rejam(?:iz)?` +
  String.raw`|rejalashtir\w*|мечта\w*|мечтаю|планиру\w*|запланир\w*|my[ \t]dream` +
  String.raw`|dream(?:s|ed|ing)?[ \t](?:is|was|of|to)|plan(?:s|ned|ning)?[ \t]to`
/** A wish in the clause of what it is about: after it ("Universitetga kirmoqchiman"), or before a school. */
const WISH_AFTER = look(
  `${BEGIN}(?:\\w*moqchi\\w*|xohla\\w*|istay\\w*|istardim|хочу|хотел\\w*|${DREAM})${END}`,
)
/** A dream or a plan before a year makes it a year wished for, of a job or a school ("Rejam 2026-yildan"). */
const DREAMED = look(`${BEGIN}(?:${DREAM}|reja)${END}`)
const WISH_GAP = look(
  String.raw`[ \t:\-]{0,3}(?:(?:in|from|since|starting|by|for|с|со|в|на|от|до|dan)[ \t])?`,
)
const EXPERIENCE = String.raw`(?:experience|tajriba\w*|опыт\w*|стаж\w*)`
const NO_EXPERIENCE = look(
  BEGIN +
    String.raw`(?:no|without|zero|hech\s+qanday|без|нет)\s+(?:(?:work|working|professional|real|any|prior|previous|ish|` +
    String.raw`работы|трудового)\s+){0,2}` +
    EXPERIENCE +
    String.raw`(?:\s+(?:работы|ishi))?` +
    '|' +
    BEGIN +
    String.raw`(?:(?:ish|work|job)\s+)?` +
    EXPERIENCE +
    String.raw`(?:\s+(?:работы|ishi))?[ \t]*(?:[:\-][ \t]*)?` +
    String.raw`(?:none|nil|no|yo'?q|нет|отсутствует|mavjud\s+emas|hali\s+yo'?q|0)` +
    END,
)
/** A licence to drive is not a job as a driver, nor is the year it was issued. */
const LICENCE = look(
  BEGIN +
    String.raw`(?:driv\w*|haydovchilik|водительск\w*)(?:'s)?[ \t]+(?:licen[cs]e\w*|guvohnoma\w*|litsenziya\w*|huquq\w*|` +
    String.raw`прав\w*|удостоверени\w*)(?:[ \t:\-]+(?!(?:` +
    STOP +
    ')' +
    END +
    String.raw`)[^\s.,;:!?\-]+){0,6}`,
)
const DATEISH = look(String.raw`(?<![\d.])(?:\d{1,2}[./-]){0,2}(?:19|20)\d{2}(?!\d)`)
const MONTH_SPAN = look(String.raw`(?<![\d.])\d{1,2}[./-](?:19|20)\d{2}(?!\d)`)
const SHORT_DATE = look(String.raw`(?<![\d.])(?:0?[1-9]|[12]\d|3[01])\.(?:0?[1-9]|1[0-2])\.\d{2}(?!\d)`)
const MONTH_NAMES =
  String.raw`(?:january|february|march|april|may|june|july|august|september|october|november|december` +
  String.raw`|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec|yanvar|fevral|mart|aprel|iyun|iyul|avgust|sentabr` +
  String.raw`|sentyabr|oktabr|oktyabr|noyabr|dekabr|январ\w*|феврал\w*|март\w*|апрел\w*|ма[йяю]|июн\w*|июл\w*` +
  String.raw`|август\w*|сентябр\w*|октябр\w*|ноябр\w*|декабр\w*)`
/** A period: "2019-2022", "03.2021 - 06.2024", "2021 - present", "2019-21", "yanvar 2019 - dekabr 2022". */
const PERIOD = look(
  String.raw`(?<![\d.])(?:\d{1,2}[./-]){0,2}(?:19|20)\d{2}(?:[ \t]*(?:-|to|until|till|до|по)[ \t]*(?:(?:` +
    MONTH_NAMES +
    String.raw`\.?[ \t])?(?:\d{1,2}[./-]){0,2}(?:19|20)\d{2}(?!\d)` +
    String.raw`|(?:по[ \t]+)?(?:present|now|current|today|hozir\w*|bugun\w*|наст\w*|н\.[ \t]?в\.?|сей[ \t]+день))` +
    String.raw`|-\d{2}(?![\d.,/-]))`,
)
const SHORT_END = look(String.raw`-\d{2}$`)
/** The start of a job or a school with no end: "since 2019", "с 2019 года", "2019-yildan beri". */
const SINCE = look(
  BEGIN +
    String.raw`(?:since|from|[сc]|начиная[ \t]с)[ \t](?:` +
    MONTH_NAMES +
    String.raw`\.?[ \t])?(?:\d{1,2}[./-]){0,2}` +
    String.raw`(?:19|20)\d{2}(?!\d)(?:[ \t]?(?:года?|г\.?|yil\w*|year))?` +
    String.raw`|(?<![\d.])(?:\d{1,2}[./-]){0,2}(?:19|20)\d{2}(?:[ \t]?-?[ \t]?(?:yil|йил))?(?:[ \t](?:` +
    MONTH_NAMES +
    String.raw`)\w*?)?[ \t]?-?[ \t]?(?:dan|дан)(?:[ \t](?:beri|buyon|бери|буён))?` +
    END,
)
/** The words beside a period that say only that it is one, not what it was. */
const GLUE = look(
  String.raw`yil\w*|йил\w*|год\w*|лет|years?|yrs|yy|гг|наст\w*|время|present|now|current\w*|today|hozir\w*` +
    String.raw`|bugun\w*|until|till|since|from|beri|buyon|бери|буён|` +
    MONTH_NAMES +
    String.raw`(?:dan|gacha|da|idan|igacha)?`,
)
/** The server's WORD: a word of three letters or more. */
const LONG_WORD = look(String.raw`[^\W\d_]{3,}`)
const PERIOD_REACH = 50
const BIRTH = words(
  list("tug'il туғил тугил tavallud birth родил рожд"),
  list(String.raw`born dob d\.o\.b г\.р др`),
)
const BREAK = look(String.raw`[,;\n!?]|\.(?=\s|$)`)
const SENTENCE_STOP = look(String.raw`\n|\.(?=\s|$)`)
const LICENCE_REACH = 40
const BIRTH_REACH = 24
const BORN_AFTER = look(String.raw`[ \t]?-?[ \t]?(?:(?:yil(?:da|i)?|y\.|года?|г\.|year|in)[ \t]?)?`)
const BORN_BEFORE = look(
  String.raw`[ \t:=\-]{0,3}(?:(?:yil\w*|sana\w*|kun\w*|in|on|of|date|в|year|y\.)[ \t:=\-]{0,3}){0,2}`,
)
const UNIT_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  several: 3,
  bir: 1,
  ikki: 2,
  uch: 3,
  "to'rt": 4,
  besh: 5,
  olti: 6,
  yetti: 7,
  sakkiz: 8,
  "to'qqiz": 9,
  бир: 1,
  икки: 2,
  уч: 3,
  тўрт: 4,
  беш: 5,
  олти: 6,
  етти: 7,
  саккиз: 8,
  тўққиз: 9,
  один: 1,
  два: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17,
  восемнадцать: 18,
  девятнадцать: 19,
  несколько: 3,
  yarim: 0.5,
  полтора: 1.5,
  полторы: 1.5,
}
const TENS_NUMBERS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  "o'n": 10,
  yigirma: 20,
  "o'ttiz": 30,
  qirq: 40,
  ellik: 50,
  ўн: 10,
  йигирма: 20,
  ўттиз: 30,
  қирқ: 40,
  эллик: 50,
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
}
/** _alternatives: the names, the longest first (Python's sort is stable), an apostrophe in them optional. */
const alternatives = (names: Record<string, number>) =>
  Object.keys(names)
    .map((name, index) => [name, index] as const)
    .sort((one, other) => other[0].length - one[0].length || one[1] - other[1])
    .map(([name]) => name.replaceAll("'", "'?"))
    .join('|')
/** The numbers as words, with no apostrophe, as _amount reads them. */
const NUMBERS = new Map(
  Object.entries({ ...UNIT_NUMBERS, ...TENS_NUMBERS }).map(([word, value]) => [
    word.replaceAll("'", ''),
    value,
  ]),
)
const NUMBER_WORDS =
  `${BEGIN}(?:(?:${alternatives(TENS_NUMBERS)})(?:[ \\t\\-](?:${alternatives(UNIT_NUMBERS)}))?` +
  `|(?:${alternatives(UNIT_NUMBERS)})[ \\t]yarim|${alternatives(UNIT_NUMBERS)}|bir[ \\t]necha)${END}`
const AGE_UNITS = String.raw`лет|года?|летн\w*`
const AMBIGUOUS = look(AGE_UNITS)
/** A length of service: "5 yillik", "3 yildan beri", "2 years", "5 лет", "10-летний", "five years". */
const DURATION = look(
  String.raw`(?:(?P<number>(?<![\d.,])\d{1,2}(?:[.,]\d)?\+?|` +
    NUMBER_WORDS +
    String.raw`)[ \t]?(?:-[ \t]?)?` +
    String.raw`(?P<unit>yil(?:lik|dan|ga|da)?|oy(?:lik|dan)?|years?|yrs?|months?|месяц\w*|мес|йил(?:лик|дан|га|да)?` +
    String.raw`|ой(?:лик|дан)|` +
    AGE_UNITS +
    String.raw`)|(?P<oy>(?<![\d.,])\d{1,2})[ \t](?P<month>ой)` +
    '|' +
    BEGIN +
    String.raw`(?P<half>пол[ \t]?года|half[ \t]a[ \t]year))` +
    END,
)
/** "Мне 25 лет", "yoshim 25", "25 years old": an age, not a length of service. */
const AGE_BEFORE = look(
  String.raw`(?<![\w'])(?:мне|ему|ей|возраст\w*|age|aged|yoshim|yoshi|i[ \t]am|i'm|сын\w*|доч\w*` +
    String.raw`|реб[её]н\w*|дет\w*|внук\w*|внучк\w*)[ \t]?(?:[:=\-][ \t\n]?)?(?:уже[ \t])?$` +
    String.raw`|(?<![\w'])yosh[ \t]?[:=\-][ \t\n]?$`,
)
const AGE_AFTER = look(String.raw`[ \t\-]{0,2}(?:old|of[ \t]age|от[ \t]роду|yosh|y\.o)`)
const AGE_REACH = 16
/**
 * Where a person lives or lived: a length of time or a start in its clause is
 * not a job unless a job title or a word of work stands in the clause too
 * ("10 лет живу и работаю в Ташкенте").
 */
const LIFE =
  String.raw`(?:yasha\w*|live|lived|lives|living|живу|жив[её]м|жил|жила|жили|прожива\w*|прожил\w*` +
  String.raw`|вернул\w*|переех\w*|returned|moved|relocated|qaytd\w*|qaytib|ko'?chib|ko'?chd\w*|ko'?chgan\w*)`
/** That a person is married: a length of time in its clause is the marriage's ("женат уже 7 лет"). */
const MARRIED = String.raw`(?:married|uylan\w*|turmush\w*|женат\w*|замуж\w*|в[ \t]браке)`
/**
 * A state of life that is no job: on maternity or sick leave, retired, out of
 * work, keeping house, in the army (a job only when the clause says the person
 * served: SERVICE).
 */
const STATE =
  String.raw`(?:в[ \t]декрет(?:е|ном)\w*|в[ \t]отпуске|на[ \t]пенсии|пенсионер\w*|на[ \t]больничном` +
  String.raw`|в[ \t]армии|безработн\w*|без[ \t]работы|домохозяйк\w*|dekret\w*|nafaqada\w*|nafaqaga` +
  String.raw`|nafaqaxo'?r\w*|ta'?til\w*|armiya\w*|ishsiz\w*|uy[ \t]bekasi\w*|maternity|paternity` +
  String.raw`|parental[ \t]leave|on[ \t]leave|sick[ \t]leave|retired|retirement|in[ \t]the[ \t]army|unemployed` +
  String.raw`|out[ \t]of[ \t]work|housewife|homemaker|stay-at-home)`
const SERVICE = String.raw`(?:служ\w*|отслуж\w*|xizmat\w*|served|serving|service)`
type LifeKind = 'life' | 'married' | 'state' | 'service'
const LIFE_KINDS: [LifeKind, string][] = [
  ['life', LIFE],
  ['married', MARRIED],
  ['state', STATE],
  ['service', SERVICE],
]
/** All four in one pass, each a whole word: which of them a clause holds (_life). */
const LIVED = look(LIFE_KINDS.map(([kind, words]) => `(?P<${kind}>${BEGIN}${words}${END})`).join('|'))
/**
 * Where one of them may begin, read once for the whole text: a clause holds
 * one of LIVED's kinds only where one begins, so only there is LIVED tried
 * (thousands of lengths of service, each read in its clause, otherwise took
 * the slowest keystroke near its limit).
 */
const LIVED_START = look(`(?=${BEGIN}(?:${LIFE_KINDS.map(([, words]) => words).join('|')}))`)
/**
 * A course, not a school's year ("3-kurs", "на 3 курсе"): a length of time or
 * a date in its clause is the course's ("Курсы английского 6 месяцев"), as a
 * finished course is a certificate, not a background.
 */
const COURSE = look(String.raw`(?<![\w'])(?<!\d[ \t\-])(?:kurs|курс|course)\w*`)
/** What makes a course's clause the person's job: teaching on it, or a verb that says they worked there. */
const TEACH = words(
  list(
    "teach tutor instructor lectur mentor trainer o'qituvchi ustoz murabbiy repetitor treyner учител преподава тренер",
    'репетитор наставни ўқитувчи укитувчи',
  ),
  [String.raw`dars[ \t]ber\w*`],
)
/**
 * A hobby: a length of time or a start in its clause, or in the clause before
 * when a comma ends it, is the hobby's ("Hobby: chess for 10 years", "sevimli
 * mashg'ulotim futbol, 2010-yildan beri o'ynayman") unless a job title or a word
 * of work stands in the clause of its own.
 */
const HOBBY = look(
  BEGIN +
    String.raw`(?:hobb(?:y|ies)|hobbi\w*|xobbi\w*|хобби|увлека\w*|увлечени\w*|sevimli[ \t]mashg'?ulot\w*` +
    String.raw`|(?:in[ \t]my[ \t])?(?:free|spare)[ \t]time|bo'?sh[ \t]vaqt\w*|свободное[ \t]время|на[ \t]досуге)` +
    END,
)
/** English lengths of service, as often an age when they stand alone: "Ivan Petrov, 30 years, driver". */
const YEARS = look(String.raw`years?|yrs?`)
const IN_PLACE = look(BEGIN + String.raw`(?:во?|на|за)[ \t][^\W\d_]{3,}`)
const SHORT_SERVICE = 15
/** A time ago, not a length of service: "2 yil oldin", "3 years ago", "5 лет назад". */
const AGO = look(
  String.raw`[ \t]?(?:ago|before|oldin\w*|avval\w*|ilgari|burun|олдин\w*|аввал\w*|илгари|бурун|назад|тому)` +
    END,
)
/** The universities customers name by their initials. */
const INITIALS = list(
  'tatu tuit tdiu tsue tdyu tsul wiut inha samdu buxdu andu namdu nuuz тату туит тгэу тгюу нууз tdpu тгпу tdtu тгту',
  'tma тма мгу ташгу',
)
const EDU_INST = words(
  list(
    'universit institut kollej колледж maktab мактаб школ litsey лицей tehnikum texnikum техникум academ akademi',
    "академи университет институт вуз fakultet факультет ta'lim таълим образовани",
  ),
  [...list('college school lyceum faculty education'), ...INITIALS],
)
const HEADED_SCHOOL = look(
  BEGIN +
    String.raw`(?:education|ta'?lim|ma'?lumot\w*|образовани\w*|o'?qish(?:[ \t]joyi)?)[ \t]?` +
    String.raw`(?:[:\-][ \t]?)?(?:` +
    INITIALS.join('|') +
    ')' +
    END,
)
const STRONG_SCHOOL = look(
  BEGIN +
    String.raw`(?:universit\w*|университет\w*|institut(?!sion|ion)\w*|институт\w*|colleges?|kollej\w*|колледж\w*` +
    String.raw`|akademiya\w*|academy|academies|академи\w*)` +
    END +
    String.raw`(?![ \t](?:ko'?cha\w*|street|st\.|avenue|ave\.|улиц\w*|ул\.|проспект\w*|prospekt\w*|mavze\w*))`,
)
const FINISHED = look(
  BEGIN +
    String.raw`(?:tugat(?!\w*moqchi)\w*|tugall\w*|tamomla(?!\w*moqchi)\w*|тугат\w*|тамомла\w*` +
    String.raw`|yakunla(?!\w*moqchi)\w*|finish(?:ed|ing)?|complet(?:ed|ing)|attend(?:s|ed|ing)?|enrol\w*` +
    String.raw`|обуча\w*|поступил\w*|went[ \t]to)` +
    END,
)
const FINISH_REACH = 40
/**
 * Graduating, and the word for a graduate: said of a school or a degree, so
 * counted on their own ("graduated in 2020", "Окончила ТашМИ в 2010 году")
 * unless what was finished is plainly no school (UNSCHOOLED) and no school
 * stands beside it: "окончила курсы 1С", "haydovchilik kursini bitirdim".
 */
const GRADUATED = words(
  list(String.raw`graduat bitir(?!\w*moqchi) битир(?!\w*моқчи) окончил закончил выпускни`),
)
const UNSCHOOLED = words(
  list(
    "kurs курс course loyiha project проект ремонт ta'mir repair renovat haydovchilik вождени автошкол driving",
    'trening тренинг training stajirovk стажировк internship контракт contract shartnoma строительств qurilish',
  ),
)
/**
 * A job or a task finished, just after the word or (in Uzbek) before it:
 * "закончил работу", "ishni bitirdim".
 */
const UNFINISHED_AFTER = look(
  String.raw`[ \t](?:(?:the|a|an|my|свою|мою|эту|всю)[ \t])?(?:work|job|tasks?|работу|задани\w*|задач\w*)` +
    END,
)
const UNFINISHED_BEFORE = look(String.raw`(?<![\w'])(?:ish(?:ni|imni|larni|lar)?|vazifa\w*)[ \t]$`)
const EDU_DEGREE = words(
  list(
    'bachelor bakalavr бакалавр magistr магистр diplom диплом alumn talaba student студент аспирант школьни талаба',
    "o'quvchi undergrad postgrad freshm sophomore",
  ),
  [
    ...list(String.raw`master's master\s+of bsc msc mba phd diploma degree study studied studying studies`),
    String.raw`(?<!kitob )o'qi(?:yman|yapman|ganman|gan\w*|dim|b|moqdaman|yotgan\w*)`,
    String.raw`ta'lim\s+ol\w*`,
    String.raw`(?<!китоб )ўқи(?:йман|япман|ганман|ган\w*|дим|б|моқдаман|ётган\w*)`,
    'учусь',
    String.raw`учи(?:лся|лась|лись)`,
    String.raw`обуча(?:юсь|лся|лась|лись)`,
    String.raw`\d+[ \t]?(?:-[ \t]?)?(?:kurs|курс)\w*`,
    String.raw`\d+(?:st|nd|rd|th)[ -]year`,
    // A school grade: "11-sinfni tugatganman", "ученица 10 класса", "10th grade".
    String.raw`\d{1,2}[ \t]?(?:-[ \t]?)?(?:sinf|класс)\w*`,
    String.raw`\d{1,2}(?:st|nd|rd|th)?[ \t]grade`,
    String.raw`grade[ \t]\d{1,2}`,
    // The degrees written with dots, and a bachelor's or master's said with its field.
    String.raw`b\.[ \t]?sc\.?`,
    String.raw`m\.[ \t]?sc\.?`,
    String.raw`ph\.[ \t]?d\.?`,
    String.raw`b\.[ \t]?a\.`,
    String.raw`m\.[ \t]?a\.`,
    String.raw`b\.[ \t]?s\.`,
    String.raw`(?:ba|bba|bs|ma|ms)[ \t](?:in|of)`,
    String.raw`b\.?[ \t]?tech`,
    String.raw`m\.?[ \t]?tech`,
    'alum',
    String.raw`final[ \t]year`,
    String.raw`year[ \t]\d{1,2}`,
    // Said without a school: "Oliy ma'lumotli", "высшее образование".
    String.raw`oliy\s+ma'lumot\w*`,
    String.raw`ma'lumot\w*[ \t]?(?:[:\-][ \t]?)?(?:oliy|o'rta)\w*`,
    String.raw`o'rta\s+maxsus`,
    String.raw`(?:oliy|o'rta)[ \t](?:ma'lumot|ta'lim)\w*`,
    String.raw`ta'lim\w*[ \t]?(?:[:\-][ \t]?)?(?:oliy|o'rta)\w*`,
    String.raw`(?:олий|ўрта|урта)[ \t](?:маълумот|малумот|таълим|махсус)\w*`,
    String.raw`(?:маълумот|таълим)\w*[ \t]?(?:[:\-][ \t]?)?(?:олий|ўрта|урта)\w*`,
    String.raw`higher\s+education`,
    String.raw`secondary\s+education`,
    String.raw`высше\w*\s+(?:профессиональн\w*\s+)?образовани\w*`,
    String.raw`(?:высш|средн)\w*[ \t](?:специальн\w*[ \t])?образовани\w*`,
    String.raw`образовани\w*[ \t]?(?:[:\-][ \t]?)?(?:высш|средн)\w*`,
    String.raw`средне\w*\s+специальн\w*`,
  ],
)
/** A project: its clause says what it was about, not where the person worked ("loyiha: onlayn do‘kon"). */
const PROJECTS = words(list('project loyiha проект portfolio'))
const DATE_REACH = 160
const SCHOOL_REACH = 120
const DURATION_REACH = 40
const VERB_REACH = 60
const PHONE_CUE = look(
  String.raw`(?<![\w'])(?:tel|тел|phone|mob|raqam|номер|number|nomer|aloqa|контакт|contact|whatsapp|call)\w*|\(`,
)
const CUES = String.raw`(?:tel|тел|phone|mob|raqam|номер|number|nomer|aloqa|контакт|contact|whatsapp|call)\w*`
/** A phone's cue written straight before it: "Tel-901234567", "tel901234567". */
const CUED = look(String.raw`(?<![\w'@/.])` + CUES + '(?:/' + CUES + String.raw`)?[\-/]?$`)
/** The word for a document, tax, card or account number, then at most four words that describe it. */
const ID_WORD =
  String.raw`(?:passport\w{0,3}|pasport\w{0,4}|паспорт\w{0,3}|jshshir\w{0,3}|жшшир\w{0,3}|pinfl\w{0,3}|пинфл\w{0,3}` +
  String.raw`|seriya\w{0,3}|сери[яи]|stir|tin|inn|инн|иин|id|iban|cards?|karta(?:si|sining|sini|m|ning)?|карт[аыу]` +
  String.raw`|картой|hisob(?:[ \t]raqam\w*)?|accounts?|acct|сч[её]т(?:а|у|ом)?|лицев\w*)`
const ID_DESCRIPTOR =
  String.raw`(?:raqam\w*|numbers?|nomer\w*|номер\w*|no|№|#|seriya\w*|сери[яи]|va|и|and|of|cards?|karta\w*|карт\w*` +
  String.raw`|hisob\w*|accounts?|[a-zа-я]{1,2})`
const ID_DESCRIBED = String.raw`(?:[^\w\n]{1,8}` + ID_DESCRIPTOR + String.raw`(?![\w']))?`
const ID_CUE = look(
  String.raw`(?<![\w'])` +
    ID_WORD +
    String.raw`(?![\w'])` +
    ID_DESCRIBED.repeat(4) +
    String.raw`[^\w\n]{0,8}$`,
)
const ID_REACH = 44
/** A price: groups of three digits before a currency ("5 000 000 so'm"). */
const MONEY = look(
  String.raw`(?<![\d+])\d{1,3}(?: \d{3}){1,6}(?=\s*(?:\$|€|(?:usd|uzs|eur|euros?|rub|rubl\w*|so'm\w*|som` +
    String.raw`|sum|sumlar|sumga|sumda|dollar\w*|сум|сума|сумов|руб\w*|доллар\w*|млн|mln|mlrd|млрд|ming|минг)` +
    String.raw`(?![\w'])))`,
)
const UZBEK_NUMBER = look(String.raw`998\d{9}`)
const JOINED = look(String.raw`[\w/@\-]`)
const EMAIL_AT = look(String.raw`(?<=[\w.+\-'])@[\w\-]+(?:\.[\w\-]+)+`)
/** The digit groups of a phone number before a year-like group ("93 123 1999"). */
const NUMBER_HEAD = look(String.raw`(?:\d+[ \t().\-]{1,3})+$`)
const NUMBER_REACH = 16
const YEAR_ONLY = look(String.raw`(?<!\d)(?:19|20)\d{2}(?!\d)`)
const PHONE_RUN = look(String.raw`\+?\d[\d \t().\-]{5,}\d`)
const DATE = look(
  String.raw`(?<!\d)\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}(?!\d)|(?<!\d)(?:19|20)\d{2}[./-]\d{1,2}[./-]\d{1,2}` +
    String.raw`(?!\d)|(?<!\d)(?:19|20)\d{2}\s*-\s*(?:19|20)\d{2}(?!\d)`,
)
const SPACES = /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g
const DASHES = /[\u2010-\u2015\u2212]/g
const INVISIBLE = /[\u200b-\u200d\u2060\ufeff]/g
const SCHEME = look(String.raw`https?://|(?<![\w.])www\.`)
/** _plain: one apostrophe, one kind of space and dash, lower case, no scheme. */
const plain = (text: string) =>
  folded(text.normalize('NFKC').replace(SPACES, ' ').replace(DASHES, '-').replace(INVISIBLE, '')).replace(
    SCHEME.g,
    '',
  )
// Python counts a character outside the first plane as one, JavaScript as two: each is
// read as one of its kind (a letter, a digit, a number, anything else), so every
// distance the reading measures is the server's.
const ASTRAL = /[\u{10000}-\u{10ffff}]/gu
const standIn = (char: string) =>
  /\p{L}/u.test(char) ? 'ꀀ' : /\p{Nd}/u.test(char) ? '٠' : /\p{N}/u.test(char) ? '½' : '□'

/** _in_number: whether the year-like group at `start` ends a phone number's groups ("90 123 2019"). */
function inNumber(text: string, start: number) {
  const head = search(NUMBER_HEAD, text, Math.max(0, start - NUMBER_REACH), start)
  const digits = head ? digitCount(head[0]) : 0
  return digits >= 5 && digits <= 8
}
/** _dateless: every date, month and year blanked, but a year that ends a phone number's groups. */
function dateless(text: string) {
  let out = text
  for (const found of [DATE, MONTH_SPAN, SHORT_DATE]) out = blankOut(found, out)
  const dated = out
  return dated.replace(YEAR_ONLY.g, (year: string, at: number) =>
    inNumber(dated, at) ? year : blanked(year),
  )
}
/** _phone_spans: the phone numbers, as the server reads one (its docstring says how). */
function phoneSpans(text: string) {
  const spans: Span[] = []
  for (const found of findAll(PHONE_RUN, dateless(blankOut(MONEY, text)))) {
    const start = found.index
    const plus = text[start] === '+'
    const coded = plus || !!fullAt(UZBEK_NUMBER, found[0].replace(/\P{Nd}/gu, ''))
    const glued =
      start > 0 &&
      !plus &&
      !!matchAt(JOINED, text, start - 1, start) &&
      !search(CUED, text, Math.max(0, start - 20), start)
    if (glued || (!coded && search(ID_CUE, text, Math.max(0, start - ID_REACH), start))) continue
    if (coded || digitCount(found[0]) >= 9 || search(PHONE_CUE, text.slice(Math.max(0, start - 12), start)))
      spans.push(spanOf(found))
  }
  return spans
}
/** _unbroken: whether `text[low:high]` is one clause. */
const unbroken = (text: string, low: number, high: number) => low <= high && !search(BREAK, text, low, high)
/** Where the clause that ends at `start` begins, no further back than `low`. */
function clauseStart(text: string, low: number, start: number) {
  const cuts = findAll(BREAK, text, low, start)
  const cut = cuts[cuts.length - 1]
  return cut ? cut.index + cut[0].length : low
}
/** Where the clause that begins at `end` stops, no further on than `high`. */
function clauseEnd(text: string, end: number, high: number) {
  const stop = search(BREAK, text, end, high)
  return stop ? stop.index : high
}
/** _periods: each period, and whether it is written in full; one written short ends after it starts. */
function periods(text: string) {
  const found: [RegExpExecArray, boolean][] = []
  for (const period of findAll(PERIOD, text)) {
    const short = search(SHORT_END, period[0])
    const year = matchAt(DATEISH, text, period.index)
    if (!short) found.push([period, true])
    else if (year && decimal(short[0].slice(1)) > decimal(year[0].slice(-2))) found.push([period, false])
  }
  return found
}
/** _claimed: the starts of the dates a word for birth claims, each its own, never one end of a period. */
function claimed(text: string, dates: Span[], ranged: Set<number>) {
  const starts = dates.map(([start]) => start)
  const ends = dates.map(([, end]) => end)
  const found = new Set<number>()
  for (const birth of findAll(BIRTH, text)) {
    const [low, high] = spanOf(birth)
    const before = bisectRight(ends, low) - 1
    const after = bisectLeft(starts, high)
    const left =
      before >= 0 && low - ends[before]! <= BIRTH_REACH && unbroken(text, ends[before]!, low)
        ? dates[before]!
        : null
    const right =
      after < dates.length && starts[after]! - high <= BIRTH_REACH && unbroken(text, high, starts[after]!)
        ? dates[after]!
        : null
    if (left && fullAt(BORN_AFTER, text, left[1], low)) found.add(left[0])
    else if (right && fullAt(BORN_BEFORE, text, high, right[0])) found.add(right[0])
    else if (left || right) found.add((left || right)![0])
  }
  for (const start of ranged) found.delete(start)
  return found
}
/** _licensed: the starts of the dates a driving licence was issued in. */
function licensed(text: string, dates: Span[], licences: Span[]) {
  const starts = dates.map(([start]) => start)
  const found = new Set<number>()
  for (const [, end] of licences) {
    const index = bisectLeft(starts, end)
    if (
      index < starts.length &&
      starts[index]! - end <= LICENCE_REACH &&
      !search(SENTENCE_STOP, text, end, starts[index])
    )
      found.add(starts[index]!)
  }
  return found
}
/** Whether the position `at` is inside one of the phone numbers. */
function inPhone(phones: Span[], starts: number[], at: number) {
  const index = bisectRight(starts, at) - 1
  return index >= 0 && at < phones[index]![1]
}
interface Reading {
  text: string
  phones: Span[]
  phoneStarts: number[]
  wishes: Span[]
  wishStarts: number[]
  /** Where one of LIVED's kinds may begin in `text` (LIVED_START), read when first asked for. */
  lifeStarts?: number[]
}
/** _wish_follows: whether a wish follows `end` in its clause. */
function wishFollows(reading: Reading, end: number) {
  const { text, wishes, wishStarts } = reading
  const high = clauseEnd(text, end, Math.min(text.length, end + DURATION_REACH))
  const index = bisectLeft(wishStarts, end)
  return (index < wishes.length && wishes[index]![0] < high) || !!search(WISH_AFTER, text, end, high)
}
/** _wish_names: whether what starts at `start` comes straight after a wish. */
function wishNames(reading: Reading, start: number) {
  const index = bisectLeft(reading.wishStarts, start) - 1
  const wish = reading.wishes[index]
  return !!wish && wish[1] <= start && !!fullAt(WISH_GAP, reading.text, wish[1], start)
}
/** _wish_before: whether a wish comes before `start` in its clause. */
const wishBefore = (text: string, start: number) =>
  !!search(WISH_AFTER, text, clauseStart(text, Math.max(0, start - DURATION_REACH), start), start)
/** Whether `text[low:at]`, its spaces and tabs left out at the end, ends with a label's colon. */
function labelled(text: string, low: number, at: number) {
  let back = at
  while (back > low && (text[back - 1] === ' ' || text[back - 1] === '\t')) back--
  return back > low && text[back - 1] === ':'
}
/**
 * _clause: (low, high), the clause around `text[start:end]`, from the break
 * before it to the break after it, at most `reach` either side. A line that
 * ends with a label's colon goes on in the next one: "Стаж:\n20 лет".
 */
function clause(text: string, start: number, end: number, reach = DURATION_REACH): Span {
  let low = Math.max(0, start - reach)
  const high = Math.min(text.length, end + reach)
  const cuts = findAll(BREAK, text, low, start)
  const last = cuts[cuts.length - 1]
  if (last) {
    if (last[0] === '\n' && labelled(text, low, last.index)) {
      const before = cuts[cuts.length - 2]
      if (before) low = before.index + before[0].length
    } else low = last.index + last[0].length
  }
  return [low, clauseEnd(text, end, high)]
}
/**
 * _life: adds to `kinds` which of LIVED's kinds `reading.text[low:high]` holds,
 * as LIVED.finditer(text, low, high) finds them: tried only where one may begin
 * (LIVED_START), each after the end of the one before.
 */
function life(reading: Reading, low: number, high: number, kinds: Set<LifeKind>) {
  if (low >= high) return kinds
  const starts = (reading.lifeStarts ??= marksOf(LIVED_START, reading.text))
  let next = low
  for (let index = bisectLeft(starts, low); index < starts.length && starts[index]! < high; index++) {
    if (starts[index]! < next) continue
    const found = matchAt(LIVED, reading.text, starts[index]!, high)
    if (!found) continue
    next = found.index + found[0].length
    const kind = LIFE_KINDS.find(([name]) => found.groups?.[name] !== undefined)
    if (kind) kinds.add(kind[0])
  }
  return kinds
}
/** The clause around `text[start:end]` (_clause), and the kinds of LIVED either side of it there (_life). */
function lifeAround(reading: Reading, start: number, end: number): [Set<LifeKind>, number, number] {
  const [low, high] = clause(reading.text, start, end)
  return [life(reading, end, high, life(reading, low, start, new Set())), low, high]
}
/**
 * _lived: whether the clause is about where the person lives or lived, that
 * they are married, or a state of life that is no job unless they served in it.
 */
function lived(reading: Reading, start: number, end: number) {
  const [kinds] = lifeAround(reading, start, end)
  return kinds.has('life') || kinds.has('married') || (kinds.has('state') && !kinds.has('service'))
}
/** Whether a word in `text[from:to]` says more than that a period is one (GLUE). */
const says = (text: string, from: number, to: number) =>
  findAll(LONG_WORD, text, from, to).some((word) => !fullAt(GLUE, word[0]))
/** _alone: whether `text[start:end]` is all its clause says. */
function alone(text: string, start: number, end: number) {
  const [low, high] = clause(text, start, end)
  return !says(text, low, start) && !says(text, end, high)
}
/**
 * _dreamed: whether a dream or a plan (DREAMED, whose ends are the sorted
 * `dreams`) comes before `start` in its clause, at most VERB_REACH before it.
 */
function dreamed(text: string, start: number, dreams: number[]) {
  const index = bisectRight(dreams, start) - 1
  return index >= 0 && start - dreams[index]! <= VERB_REACH && unbroken(text, dreams[index]!, start)
}
/** _courses: where the courses, the job titles and words of work, and words of teaching or working start. */
interface Courses {
  marks: number[]
  titled: number[]
  taught: number[]
}
function courses(text: string, titled?: number[], taught?: number[]): Courses | null {
  const marks = marksOf(COURSE, text)
  if (!marks.length) return null
  return {
    marks,
    titled: titled ?? sorted([...marksOf(WORK, text), ...marksOf(JOB, text)]),
    taught: taught ?? sorted([...marksOf(DONE_VERB, text), ...marksOf(TEACH, text)]),
  }
}
/**
 * _coursed: whether `text[start:end]`, a length of time or a date, is a
 * course's: a course in its clause, or in the clause before when its own names
 * no job, and nothing in its clause says the person taught on it or worked there.
 */
function coursed(text: string, start: number, end: number, found: Courses | null) {
  if (!found) return false
  const [low, high] = clause(text, start, end)
  if (near(found.taught, low, high)) return false
  if (near(found.marks, low, high)) return true
  if (low && matchAt(BREAK, text, low - 1) && !near(found.titled, low, high)) {
    const before = clause(text, low - 1, low - 1)[0]
    return near(found.marks, before, low - 1) && !near(found.taught, before, low - 1)
  }
  return false
}
/** The hobbies (_hobbied's `hobbies`), with the words of work and the job titles beside them. */
interface Hobbies {
  marks: number[]
  works: number[]
  titled: number[]
}
function hobbiesOf(text: string, works?: number[], titled?: number[]): Hobbies | null {
  const marks = marksOf(HOBBY, text)
  if (!marks.length) return null
  const worked = works ?? marksOf(WORK, text)
  return { marks, works: worked, titled: titled ?? sorted([...worked, ...marksOf(JOB, text)]) }
}
/**
 * _hobbied: whether `text[start:end]`, a length of time or a start, is a
 * hobby's: a hobby in its clause and no word of work there, as what the hobby is
 * may look like a job ("Увлекаюсь фотографией с 2018 года"); or a hobby in the
 * clause before, when a comma or a semicolon ends that one, and no job title or
 * word of work in its own.
 */
function hobbied(text: string, start: number, end: number, found: Hobbies | null) {
  if (!found) return false
  const [low, high] = clause(text, start, end)
  if (near(found.marks, low, high)) return !near(found.works, low, high)
  return (
    low > 0 &&
    (text[low - 1] === ',' || text[low - 1] === ';') &&
    !near(found.titled, low, high) &&
    near(found.marks, clause(text, low - 1, low - 1)[0], low - 1)
  )
}
/**
 * _subjects: the clauses of `spans`, merged and in order, that hold no
 * position of the sorted `keep`: what a course or a project was about.
 */
function subjects(text: string, spans: Span[], keep: number[]) {
  const clauses = spans
    .map(([start, end]) => clause(text, start, end, VERB_REACH))
    .sort((one, other) => one[0] - other[0] || one[1] - other[1])
  const merged: Span[] = []
  for (const [low, high] of clauses) {
    if (near(keep, low, high)) continue
    const last = merged[merged.length - 1]
    if (last && low <= last[1]) last[1] = Math.max(last[1], high)
    else merged.push([low, high])
  }
  return merged
}
/** _inside: whether `position` lies in one of the merged, sorted `spans` (_subjects). */
function inside(spans: Span[], position: number) {
  let low = 0
  let high = spans.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (position < spans[middle]![0]) high = middle
    else low = middle + 1
  }
  return low > 0 && position <= spans[low - 1]![1]
}
/** _worded: whether a word stands beside `text[start:end]` on its line, and not one of glue. */
function worded(text: string, start: number, end: number) {
  const low = Math.max(0, start - PERIOD_REACH)
  const high = Math.min(text.length, end + PERIOD_REACH)
  const newline = text.slice(low, start).lastIndexOf('\n')
  const stop = text.slice(end, high).indexOf('\n')
  return (
    says(text, newline < 0 ? low : low + newline + 1, start) || says(text, end, stop < 0 ? high : end + stop)
  )
}
/** _entries: a period or a start of an entry, with a word beside it (the server's docstring says which). */
function entries(
  reading: Reading,
  born: Set<number>,
  licences: Set<number>,
  found: [RegExpExecArray, boolean][],
  dreams: number[],
) {
  const { text, phones, phoneStarts } = reading
  // The courses and hobbies are read when an entry first needs them (the server reads them first, to the same end).
  let taught: Courses | null | undefined
  let hobbies: Hobbies | null | undefined
  const free = (start: number, end: number, year: number) =>
    !inPhone(phones, phoneStarts, start) &&
    !licences.has(year) &&
    worded(text, start, end) &&
    !lived(reading, start, end) &&
    !coursed(text, start, end, taught === undefined ? (taught = courses(text)) : taught)
  for (const [period] of found)
    if (!born.has(period.index) && free(period.index, period.index + period[0].length, period.index))
      return true
  for (const since of findAll(SINCE, text)) {
    const [start, end] = spanOf(since)
    const year = search(DATEISH, text, start, end)
    if (
      !year ||
      born.has(year.index) ||
      wishNames(reading, start) ||
      wishFollows(reading, end) ||
      dreamed(text, start, dreams)
    )
      continue
    if (
      free(start, end, year.index) &&
      !hobbied(text, start, end, hobbies === undefined ? (hobbies = hobbiesOf(text)) : hobbies)
    )
      return true
  }
  return false
}
/** _amount: the number a length of service gives, and whether a + follows it. */
function amount(length: RegExpExecArray): [number, boolean] {
  const groups = length.groups || {}
  if (groups.half) return [0.5, false]
  const number = groups.number || groups.oy || ''
  if (/^\p{Nd}/u.test(number))
    return [decimal(number.replace(/\++$/, '').replaceAll(',', '.')), number.endsWith('+')]
  const values = number.replaceAll("'", '').split(/[ \t-]+/)
  return [values.reduce((sum, word) => sum + (NUMBERS.get(word) ?? 3), 0), false]
}
/** _gives_job: a job, where or as what and when or for how long (the server's docstring says which). */
function givesJob(reading: Reading, dates: Span[], hasEntries: boolean) {
  if (hasEntries) return true
  const { text } = reading
  const orgs = marksOf(ORG, text)
  const durations = findAll(DURATION, text)
  if (!orgs.length && !dates.length && !durations.length) return false
  // A verb of work after a dream in its clause is the dream's: "My dream is to work at a bank".
  const dreams = findAll(DREAMED, text).map((found) => found.index + found[0].length)
  const verbs = marksOf(DONE_VERB, text).filter((verb) => !dreamed(text, verb, dreams))
  if (dates.length || durations.length) {
    const works = marksOf(WORK, text)
    const jobs = marksOf(JOB, text)
    const titled = sorted([...works, ...jobs])
    const taught = courses(text, titled, sorted([...verbs, ...marksOf(TEACH, text)]))
    const hobbies = hobbiesOf(text, works, titled)
    if (dates.length) {
      // Not a word of work, a job or a company a course taught or a project was about.
      const coursed = taught ? subjects(text, findAll(COURSE, text).map(spanOf), taught.taught) : []
      const projected = subjects(text, findAll(PROJECTS, text).map(spanOf), verbs)
      // What a hobby is, in its clause with no word of work, is no job: "Увлекаюсь фотографией с 2018 года".
      const hobbyish = hobbies ? subjects(text, findAll(HOBBY, text).map(spanOf), works) : []
      const marks = sorted([
        ...[...works, ...orgs].filter((mark) => !(inside(coursed, mark) || inside(projected, mark))),
        ...jobs.filter((mark) => !(inside(coursed, mark) || inside(hobbyish, mark))),
      ])
      if (marks.length && dates.some(([start, end]) => near(marks, start - DATE_REACH, end + DATE_REACH)))
        return true
    }
    const placed = durations.length ? sorted([...titled, ...orgs, ...marksOf(IN_PLACE, text)]) : []
    for (const length of durations) {
      const [start, end] = spanOf(length)
      const [value, plus] = amount(length)
      if (
        !value ||
        search(AGE_BEFORE, text, Math.max(0, start - AGE_REACH), start) ||
        matchAt(AGE_AFTER, text, end)
      )
        continue
      const [kinds, low, high] = lifeAround(reading, start, end)
      if (
        kinds.has('married') ||
        ((kinds.has('life') || (kinds.has('state') && !kinds.has('service'))) && !near(titled, low, high))
      )
        continue
      if (coursed(text, start, end, taught) || hobbied(text, start, end, hobbies)) continue
      const unit = length.groups?.unit || ''
      const adult = !plus && value > SHORT_SERVICE
      if (adult && fullAt(YEARS, unit) && alone(text, start, end)) continue
      const ago = !!matchAt(AGO, text, end)
      if (fullAt(AMBIGUOUS, unit)) {
        if (adult) {
          if (near(works, low, high)) return true
        } else if (near(ago ? titled : placed, start - DURATION_REACH, end + DURATION_REACH)) return true
      } else if (
        near(titled, start - DURATION_REACH, end + DURATION_REACH) ||
        !(ago || wishFollows(reading, end) || (value > SHORT_SERVICE && alone(text, start, end)))
      )
        return true
    }
  }
  return verbs.length > 0 && orgs.some((org) => near(verbs, org - VERB_REACH, org + VERB_REACH))
}
/**
 * _graduated: whether the person graduated, with no wish beside it in its
 * clause: beside a school (`schools`), or with nothing in its clause that is
 * plainly no school (UNSCHOOLED, or a job or a task straight before or after it).
 */
function graduated(text: string, schools: number[]) {
  for (const found of findAll(GRADUATED, text)) {
    const [start, end] = spanOf(found)
    const [low, high] = clause(text, start, end, FINISH_REACH)
    if (wishBefore(text, start) || search(WISH_AFTER, text, end, high)) continue
    if (near(schools, start - FINISH_REACH, end + FINISH_REACH)) return true
    if (
      !(
        search(UNSCHOOLED, text, low, high) ||
        matchAt(UNFINISHED_AFTER, text, end) ||
        search(UNFINISHED_BEFORE, text, Math.max(low, start - 16), start)
      )
    )
      return true
  }
  return false
}
/**
 * _gives_education: a degree or a study, a university not wished for, a school
 * with a year, a graduation from what is not plainly no school, or a school
 * finished; never a centre that only gave a course.
 */
function givesEducation(reading: Reading, dates: Span[]) {
  const { text } = reading
  if (search(EDU_DEGREE, text)) return true
  const courseSpans = findAll(COURSE, text).map(spanOf)
  const coursed = courseSpans.length
    ? subjects(text, courseSpans, sorted([...marksOf(DONE_VERB, text), ...marksOf(TEACH, text)]))
    : []
  const strong = new Set(marksOf(STRONG_SCHOOL, text))
  const schools = marksOf(EDU_INST, text).filter((school) => strong.has(school) || !inside(coursed, school))
  if (schools.length && dates.some(([start, end]) => near(schools, start - SCHOOL_REACH, end + SCHOOL_REACH)))
    return true
  for (const found of [STRONG_SCHOOL, HEADED_SCHOOL])
    for (const school of findAll(found, text))
      if (!wishFollows(reading, school.index + school[0].length) && !wishBefore(text, school.index))
        return true
  if (graduated(text, schools)) return true
  return (
    schools.length > 0 &&
    findAll(FINISHED, text).some((verb) =>
      near(schools, verb.index - FINISH_REACH, verb.index + verb[0].length + FINISH_REACH),
    )
  )
}
/** facts (contact and background), read as _reading reads the description. */
function contactAndBackground(raw: string) {
  const text = plain(raw).replace(SPACE_RUN, ' ').replace(ASTRAL, standIn)
  const phones = phoneSpans(text)
  const wishes = findAll(WISHED, text).map(spanOf)
  let masked = blankOut(NO_EXPERIENCE, blankOut(WISHED, text))
  const licenceSpans = findAll(LICENCE, masked).map(spanOf)
  masked = blankOut(LICENCE, masked)
  const reading: Reading = {
    text: masked,
    phones,
    phoneStarts: phones.map(([start]) => start),
    wishes,
    wishStarts: wishes.map(([start]) => start),
  }
  const dates = findAll(DATEISH, masked).map(spanOf)
  const found = periods(masked)
  const ranged = new Set(
    found
      .filter(([, full]) => full)
      .flatMap(([period]) =>
        findAll(DATEISH, masked, period.index, period.index + period[0].length).map((date) => date.index),
      ),
  )
  const born = claimed(masked, dates, ranged)
  const licences = licensed(masked, dates, licenceSpans)
  // The year a wish or a dream names is not a year of work: "Looking for a job from 2025", "Mening
  // orzuyim 2026-yilda bank xodimi bo‘lish". The dreams are read before the wishes are blanked, as the
  // server reads them.
  const dreams = findAll(DREAMED, text).map((dream) => dream.index + dream[0].length)
  const work = dates.filter(
    ([start, end]) =>
      !inPhone(phones, reading.phoneStarts, start) &&
      !born.has(start) &&
      !wishNames(reading, start) &&
      !wishFollows(reading, end) &&
      !dreamed(masked, start, dreams),
  )
  const hasEntries = entries(reading, born, licences, found, dreams)
  return {
    contact: !!search(EMAIL_AT, text) || phones.length > 0,
    background: givesJob(reading, work, hasEntries) || givesEducation(reading, work),
  }
}

/**
 * Which of a CV's required facts the description gives: a full name, a phone
 * number or an email, and a job or an education entry. Advisory (see above).
 */
export function cvFactTicks(text: string): CvFactTicks {
  const raw = String(text || '')
  if (!raw.trim()) return { name: false, contact: false, background: false }
  return { name: nameIn(raw), ...contactAndBackground(raw) }
}
// Made-up descriptions that between them reach every pattern above (a label,
// a pair of labels, a line of its own; a phone, an id, a price; a period, a
// start, a length of service, an age, a company and its verb; a wish, a
// licence, a birth; a school wished for and one finished).
const WARM_UP = [
  'Universitetga kirmoqchiman, maktabni tugatganman.',
  'Men Dilnoza Karimova o‘g‘li. Namuna Savdo MChJ da ishlayman.',
  'Ism: Dilnoza, Familiya: Karimova. since 2019 cashier. 2019-21 Namuna Savdo. 1998 yilda tug‘ilganman, born in 1998. ' +
    'Oliy maʼlumotli.',
  'Name: Dilnoza Karimova\n+998 90 123 45 67, 90 123 2019, dilnoza@example.com. 2019-2022 Namuna Savdo MChJ. ' +
    'Driver’s license (B), 2016. 5 000 000 so‘m. 01.09.18. Yashayman 15 yil.',
  'Dr. Karimova Dilnoza 25\nNamuna Savdo kompaniyasida ishlayman. 5 yil tajriba, kassir. 3 года в банке, мне 25 лет. ' +
    '2 years ago. 20 years old. tel 1234567, Tel-901234567, passport 1234567. Looking for a job from 2025.',
  'Ingliz tili kursi, 2021-2022. Loyiha: onlayn do‘kon sayti, 2022-yilda. Rejam 2026-yildan. С 2020 года в декрете.',
  'Ingliz tili kursi, 6 oy. Женат 7 лет, 3 года в декрете. Ivan Petrov, 30 years. Стаж:\n20 лет.',
  'Good Morning\nОкончила курсы 1С, ishni bitirdim, закончил работу. Graduated from a driving course.',
]
let warmed = 0
/**
 * Reads the next of the made-up descriptions, so that, read twice each, every
 * pattern is compiled, and compiled again as the browser does on a second
 * run, before the customer types: the first keystroke would otherwise wait up
 * to a tenth of a second for it. The Studio calls it while the page is idle,
 * one at a time; it says whether one is left.
 */
export function warmCvFactTicks() {
  if (warmed < WARM_UP.length * 2) cvFactTicks(WARM_UP[warmed++ % WARM_UP.length]!)
  return warmed < WARM_UP.length * 2
}

/**
 * How far the server has got reading one of a CV's files. Each file uploaded
 * for a CV is put in line to be read (`cv_read` on the upload), and the line
 * takes turns between customers; a CV draft is made only from what was read,
 * so it waits until every file is read, or could not be (`failed`, or
 * `done` with no page of text: said on the review as not read).
 */
export type CvReadStatus = 'queued' | 'reading' | 'done' | 'failed'
export interface CvRead {
  status: CvReadStatus
  /** Reads that will be done before this one: 0 once it is next or being read. */
  ahead: number
  /** Pages read from the file, and how many of those by OCR, once it is read. */
  pages?: number | null
  ocr_pages?: number | null
  error?: string | null
}
const UNFINISHED: CvReadStatus[] = ['queued', 'reading']
/** In line or being read: the draft waits for it. */
export const cvReadUnfinished = (read?: CvRead | null) => !!read && UNFINISHED.includes(read.status)
/**
 * Not read: the server could not read the file (`failed`), or read it and
 * found no text in it (`done` with no page read), as in a blank photo. The
 * draft has nothing from it either way, and the review says so. A read whose
 * pages are not known yet (an upload's answer) is not this.
 */
export const cvReadFailed = (read?: CvRead | null) =>
  !!read && (read.status === 'failed' || (read.status === 'done' && read.pages === 0))
/** How a read is shown: as the server says it, except that a file read with no text in it was not read. */
export const cvReadShown = (read?: CvRead | null): CvReadStatus | undefined =>
  cvReadFailed(read) ? 'failed' : read?.status
/** How often the reads are asked after while one is unfinished, and the longest wait after failures. */
const CV_READ_POLL_MS = 2000
const CV_READ_BACKOFF_MS = 30000
/** Most files one request names: as many as one CV is made from. */
const CV_READ_IDS = CV_SOURCE_FILES
const statusOf = (e: any) => e?.statusCode || e?.status || e?.response?.status
const readQuery = (list: string[]) => list.map((id) => `ids=${encodeURIComponent(id)}`).join('&')

/**
 * The reads of a CV's files (`ids`), asked after (GET studio/cv-reads) every
 * two seconds while one is unfinished, `active` holds (a file mode is chosen)
 * and the page is in view; never otherwise, and never once the page is gone.
 * A request that fails waits twice as long each time, up to 30 seconds.
 *
 * A file the server answers 404 for is no longer there (or never was the
 * customer's): what its read was is forgotten, so nothing waits for it, and
 * the draft is left to the server, which says what is wrong with the file.
 */
export function useCvReads(ids: () => string[], active: () => boolean) {
  const ws = useWorkspace()
  const reads = ref<Record<string, CvRead>>({})
  /** Reads ahead of the last of these files, and about how long until it is read (null: not known). */
  const ahead = ref(0)
  const estimate = ref<number | null>(null)
  // Files the server says are not read yet, before it has said how far each one is.
  const expected = ref<string[]>([])
  // Files asked after once although read already: their pages, on the next request.
  let extra: string[] = []
  const unfinished = computed(() =>
    ids().filter((id) => cvReadUnfinished(reads.value[id]) || expected.value.includes(id)),
  )
  const pending = computed(() => unfinished.value.length > 0)
  let timer: ReturnType<typeof setTimeout> | undefined
  let asking = false
  let failures = 0
  // Times the server said "still reading" and the reads then said done: asked
  // more slowly each time it happens again, so the two never loop.
  let contradictions = 0
  let mounted = true
  const backoff = (times: number) => Math.min(CV_READ_POLL_MS * 2 ** times, CV_READ_BACKOFF_MS)
  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'
  function stop() {
    if (timer) clearTimeout(timer)
    timer = undefined
  }
  function schedule(delay = CV_READ_POLL_MS) {
    stop()
    if (!mounted || asking || !active() || hidden()) return
    const wanted = new Set(ids())
    if (!pending.value && !extra.some((id) => wanted.has(id))) return
    timer = setTimeout(poll, failures ? backoff(failures) : delay)
  }
  async function poll() {
    timer = undefined
    const wanted = new Set(ids())
    const list = [...new Set([...unfinished.value, ...extra.filter((id) => wanted.has(id))])]
    extra = []
    if (!list.length) return
    asking = true
    try {
      // No automatic retry: $fetch asks a GET again at once on a 429, doubling
      // the requests that made it; the next poll, two seconds on, is the retry.
      const answer: any = await ws.api(`/studio/cv-reads?${readQuery(list)}`, { retry: 0 })
      failures = 0
      const next = { ...reads.value }
      for (const read of answer?.reads || [])
        if (read?.asset_id && read.status)
          next[String(read.asset_id)] = { ...read, ahead: Number(read.ahead) || 0 }
      reads.value = next
      if (list.some((id) => cvReadUnfinished(next[id]))) contradictions = 0
      else if (list.some((id) => expected.value.includes(id))) contradictions += 1
      expected.value = expected.value.filter((id) => !list.includes(id))
      ahead.value = Number(answer?.ahead) || 0
      estimate.value = Number.isFinite(answer?.estimated_seconds) ? answer.estimated_seconds : null
    } catch (e) {
      failures += 1
      if (statusOf(e) === 404) {
        const next = { ...reads.value }
        for (const id of list) delete next[id]
        reads.value = next
        expected.value = expected.value.filter((id) => !list.includes(id))
      }
    } finally {
      asking = false
    }
    sendCancels()
    schedule()
  }
  // Reads to take out of the line once no request asks after them: one asked
  // after while it is taken out could be put back in line by that request.
  let cancelling: string[] = []
  function sendCancels() {
    const list = [...new Set(cancelling)]
    cancelling = []
    for (let start = 0; start < list.length; start += CV_READ_IDS)
      ws.api(`/studio/cv-reads?${readQuery(list.slice(start, start + CV_READ_IDS))}`, { method: 'DELETE' })
        // The line is shorter now: the files still in it say so at once.
        .then(() => mounted && pending.value && refresh())
        // A server without the queue, or a file gone: nothing was in line for it.
        .catch(() => {})
  }
  /**
   * Files taken off the form (a chip removed, the page left), or not sent with
   * the CV (another way to start's): a read of theirs still in line is taken
   * out of it (DELETE studio/cv-reads), so neither the customer's other files
   * nor anyone else's wait for it. One being read finishes. The file itself
   * stays, since a saved draft may list it, and what was known of its read is
   * kept: a file shown again is asked after, and the server puts it back in line.
   */
  function cancel(list: string[]) {
    cancelling.push(
      ...list.filter((id) => reads.value[id]?.status === 'queued' || expected.value.includes(id)),
    )
    if (!asking) sendCancels()
  }
  /** A read as the upload said it. One read already is asked after once, for its pages. */
  function take(id: string, read?: CvRead | null) {
    if (!read?.status) return
    reads.value = { ...reads.value, [id]: { ...read, ahead: Number(read.ahead) || 0 } }
    const known = ids().map((key) => reads.value[key])
    ahead.value = Math.max(0, ...known.map((entry) => (cvReadUnfinished(entry) ? entry!.ahead : 0)))
    if (!cvReadUnfinished(read) && read.pages == null) extra.push(id)
  }
  /** The server said these files are still being read (`cv_reading`): they are asked after now. */
  function expect(list: string[], params: Record<string, any> = {}) {
    expected.value = [...new Set([...expected.value, ...list])]
    if (Number.isFinite(params.ahead)) ahead.value = params.ahead
    if (Number.isFinite(params.estimated_seconds)) estimate.value = params.estimated_seconds
    if (!asking) schedule(contradictions > 1 ? backoff(contradictions) : 0)
  }
  /** Asks after these files now (or the unfinished ones), when nothing is being asked already. */
  function refresh(list: string[] = []) {
    extra.push(...list)
    if (!asking) schedule(0)
  }
  watch([pending, active], ([nowPending, nowActive], [, wasActive]) => {
    if (!nowActive || !nowPending) stop()
    // Back in view of a file mode: asked at once, since the line has moved meanwhile.
    if (!timer && !asking) schedule(nowActive && !wasActive ? 0 : CV_READ_POLL_MS)
  })
  const onVisibility = () => (hidden() ? stop() : asking || schedule(0))
  onMounted(() => document.addEventListener('visibilitychange', onVisibility))
  onBeforeUnmount(() => {
    mounted = false
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
  })
  return { reads, ahead, estimate, pending, take, expect, refresh, cancel }
}
