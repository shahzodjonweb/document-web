// What a page may say about how long a customer's files and AI documents are kept.
//
// File tools' uploads and results go after 24 hours, but an AI document's request,
// text, what was read from its files and the files a change of it needs stay in the
// account until it is deleted (document-platform apps/studio/keeping.py), and only
// the team's quality-review copy goes after 30 days. So a general statement that
// files are not kept, or are deleted after 24 hours or 30 days, is untrue unless the
// same block names the AI document's exception. Statements scoped to a file tool, a
// result file or the quality-review copy are true, and so is anything on a file
// tool's own page, which speaks of that tool's files.
//
// A block is what a reader takes in as one statement: a paragraph, a list (each item
// is checked; the list as a whole may name the exception, as the file band's last
// step does), a question with its answer, a table row, a meta description.

const TIME = /\b24\s*(?:hours?|h)\b|\b30\s*days?\b|24\s*soat|30\s*kun|24\s*час|30\s*(?:дней|дня|день)/i
const GONE = /delet|remov|o[‘'’ʻ]chiril|o[‘'’ʻ]chiramiz|удаля|удалён|удален|удалят|стира/i
// Said without a time: the files are not kept, or kept only for the task.
const NOT_KEPT = new RegExp(
  [
    String.raw`\b(?:files?|data|documents?|requests?|uploads?|results?)\b[^.;]{0,30}\b(?:are|is)\s+not\s+(?:kept|stored|saved)\b`,
    String.raw`\bnot\s+(?:kept|stored)\s+with\b`,
    String.raw`\bkept\s+only\b`,
    String.raw`\b(?:we\s+)?(?:do\s+not|don[’']t|never)\s+(?:keep|store)\b`,
    String.raw`(?:fayl|ma[ʼ’']lumot|so[‘'’ʻ]rov|natija|hujjat)\S*\s+(?:\S+\s+){0,3}?(?:saqlanib\s+qolmaydi|saqlanmaydi)`,
    String.raw`saqlamaymiz`,
    String.raw`faqat\s[^.;]{0,60}uchun\s+saqlanadi`,
    String.raw`не\s+хран(?:ятся|ится|им)`,
    String.raw`хран(?:ится|ятся)\s+только`,
  ].join('|'),
  'i',
)
// Kept "for up to 24 hours" is the same claim, said as a limit.
const LIMIT = /\bup\s+to\s+24\s+hours\b|\bkept\s+(?:for\s+)?24\s+hours\b|ko[‘'’ʻ]pi\s+bilan\s+24\s+soat|24\s+soatgacha|не\s+(?:дольше|более)\s+24\s+час/i

/** Does this sentence (or list item) say files or AI documents go, or are not kept? */
export const claims = (unit) => (TIME.test(unit) && GONE.test(unit)) || NOT_KEPT.test(unit) || LIMIT.test(unit)

// The exception, said anywhere in the block: what an AI document needs stays.
export const EXCEPTION = new RegExp(
  [
    // en
    String.raw`\bAI\s+document\s+needs\b`,
    String.raw`\bdocument\s+needs\s+(?:it|them)\b`,
    String.raw`\bstays?\s+(?:in\s+your\s+account|with\s+it|until)\b`,
    String.raw`\buntil\s+the\s+account\s+is\s+deleted\b`,
    // uz
    String.raw`\bAI\s+hujjat\S*\s+(?:\S+\s+){0,4}?kerakli\b`,
    String.raw`o[‘'’ʻ]zgartirish\s+uchun\s+kerak`,
    String.raw`hisobingizda\s+saqlanadi`,
    String.raw`u\s+bilan\s+birga\s+saqlanadi`,
    String.raw`hisob\s+o[‘'’ʻ]chirilguncha`,
    // ru
    String.raw`нужн\S*\s+(?:для\s+(?:последующего\s+)?изменения|ИИ-документу)`,
    String.raw`хран(?:ится|ятся)\s+в\s+вашем\s+аккаунте`,
    String.raw`хран(?:ится|ятся)\s+вместе\s+с\s+ним`,
    String.raw`пока\s+аккаунт\s+не\s+удал`,
  ].join('|'),
  'i',
)

// True statements that are about something narrower than "your files", said in the sentence itself.
export const SCOPED = new RegExp(
  [
    // A file tool's files.
    String.raw`\btool\s+files\b|vosita\s+fayllari|vositalardagi\s+fayllar|файлы\s+инструментов`,
    // A result file, or our copies of the files sent to Telegram (results).
    String.raw`\bresult\s+file\b|natija\s+fayli|tayyor\s+fayl\b|файл\s+результата`,
    String.raw`\bour\s+copies\b|o[‘'’ʻ]z\s+nusxalarimiz|o[‘'’ʻ]zimizdagi\s+nusxa|свои\s+копии`,
    // The team's quality-review copy of AI requests and results (30 days).
    String.raw`\bcop(?:y|ies)\b[^.;]{0,90}\bquality\s+review\b`,
    String.raw`nusxa\S*\s[^.;]{0,90}sifatni\s+tekshirish|sifatni\s+tekshirish\s[^.;]{0,40}nusxa`,
    String.raw`копи\S*\s[^.;]{0,90}проверки\s+качества`,
    // PDF passwords, which are never kept.
    String.raw`\bpasswords?\b|\bparol|парол`,
  ].join('|'),
  'i',
)

const decode = (text) =>
  text
    .replace(/&nbsp;| /g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
const INLINE = /<\/?(?:a|abbr|b|code|em|i|kbd|label|mark|q|s|small|span|strong|sub|sup|time|u)\b[^>]*>/gi
const squash = (text) => text.replace(/\s+/g, ' ').trim()
const plain = (html) => squash(decode(html.replace(/<[^>]+>/g, ' ')))
const sentences = (text) => text.split(/(?<=[.!?])\s+/).map(squash).filter(Boolean)

/** A block of text: `units` are judged one by one, `text` may name the exception for all of them. */
export const block = (text, units = sentences(text)) => ({ text, units })

/** The blocks of a page's HTML, as a reader meets them. */
export function blocks(html) {
  const found = []
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (!/(?:name|property)="(?:description|og:description|twitter:description)"/i.test(tag)) continue
    const content = /content="([^"]*)"/i.exec(tag)
    if (content) found.push(block(squash(decode(content[1]))))
  }
  let body = (/<body\b[\s\S]*<\/body>/i.exec(html) || [html])[0]
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ')
  const take = (pattern, make) => {
    let before
    do {
      before = body
      body = body.replace(pattern, (...match) => {
        const made = make(...match)
        if (made.text) found.push(made)
        return '\n<br>\n'
      })
    } while (body !== before)
  }
  // A question with its answer.
  take(/<details\b[^>]*>[\s\S]*?<\/details>/gi, (whole) => block(plain(whole)))
  // A list with no list inside: each item is judged, the list may name the exception.
  take(/<(ol|ul)\b[^>]*>((?:(?!<(?:ol|ul)\b)[\s\S])*?)<\/\1>/gi, (_, __, inner) => {
    const items = inner.split(/<li\b[^>]*>/i).slice(1).map(plain).filter(Boolean)
    return block(items.join(' '), items)
  })
  // A table row.
  take(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (whole) => {
    const text = plain(whole)
    return block(text, [text])
  })
  // Everything else, one block per paragraph, heading or other block element.
  for (const line of decode(body.replace(INLINE, ' ').replace(/<[^>]+>/g, '\n')).split('\n')) {
    const text = squash(line)
    if (text) found.push(block(text))
  }
  return found
}

/** The sentences of a block that say files or AI documents go, with no exception or narrower scope. */
export function untrue(found) {
  if (EXCEPTION.test(found.text)) return []
  return found.units.filter((unit) => claims(unit) && !SCOPED.test(unit))
}
