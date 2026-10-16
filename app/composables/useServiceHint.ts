/**
 * Which AI service a description asks for when the customer has picked the
 * other one: slides asked of the PDF service, or a written paper asked of the
 * Slides service. The answer is only ever offered as a suggestion, so a miss
 * costs nothing and a wrong guess costs a line of text. Wrong guesses are kept
 * rare by asking for more than the word: presentations, slides and papers are
 * as often a description's topic ("How to give a good presentation", "Referat
 * yozish qoidalari") as the thing it asks for, so the word only counts when it
 * is asked for: with a count ("10 ta slayd", "8 slides", "на 10 слайдов"), a
 * make/need verb beside it ("slayd yasab ber", "сделай презентацию") or a
 * subject of its own ("a presentation on volcanoes").
 */
const B = String.raw`(?<![\p{L}\p{N}'])`
const E = String.raw`(?![\p{L}\p{N}'])`
// A deck by any of its names, typos the customers make included ("slyad").
const SLIDE_WORD =
  String.raw`(?:sla[iy]d\p{L}*|sl[iy]ad\p{L}*|slides?|slideshow|taqdimot\p{L}*|pre[sz][ei]nta(?:ts|s)i\p{L}*` +
  String.raw`|presentations?|power\s*point|pptx?|презентац\p{L}*|слайд\p{L}*|та[кқ]димот\p{L}*)`
// A written paper asked of the Slides service. "PDF" is deliberately not one:
// there it nearly always names the file the deck is made from ("pdfni slayd
// qilib ber", "the attached PDF") or the file it is sent as. Essays are left
// out too: "how to write an essay" is a common lesson topic.
const PAPER_WORD =
  String.raw`(?:referat\p{L}*|реферат\p{L}*|kurs\s+ish(?:i|ini|iga|im)?|курс\s+иш(?:и|ини|ига)?` +
  String.raw`|курсов(?:ая|ую|ой)(?:\s+работ\p{L}*)?|term\s+papers?)`
// A written paper named as the thing to make keeps the PDF service, essays and
// articles included: "PowerPoint dasturi haqida referat" is a paper about slides.
const WRITTEN = new RegExp(
  B +
    String.raw`(?:${PAPER_WORD}|kurs\s+ish\p{L}*|essays?|эссе|maqola\p{L}*|мақола\p{L}*|yozma\s+ish\p{L}*` +
    String.raw`|ёзма\s+иш\p{L}*|письменн\p{L}*\s+работ\p{L}*)` +
    E,
  'iu',
)
// A paper's defence is made with slides: "Kurs ishi himoyasi uchun", "защита реферата".
const DEFENCE = new RegExp(B + String.raw`(?:himoya\p{L}*|ҳимоя\p{L}*|защит\p{L}*|defen[cs]\p{L}*)`, 'iu')

// The verbs that ask for something. Uzbek forms are listed rather than left
// open, because the verbal nouns name a topic, not a request: "taqdimot
// tayyorlash bo‘yicha qo‘llanma", "taqdimot qilish sirlari", "tuzilishi".
const VERB =
  String.raw`(?:yasa(?:b|ng|ngiz|gin|sang\p{L}*|ysiz\p{L}*)?|tayyorla(?:b|ng|ngiz|gin|sang\p{L}*|ysiz\p{L}*)?` +
  String.raw`|qil(?:ib|ing|ingiz|gin|sang\p{L}*)?|tuz(?:ib|ing|ingiz|gin)?|yoz(?:ib|ing|ingiz|gin)?` +
  String.raw`|ber(?:ing|ingiz|gin|ib|asiz\p{L}*|sangiz)?|chiqar(?:ib|ing|ingiz|gin)?|aylantir\p{L}*|o'tkaz(?:ib|ing|ingiz)?|kerak\p{L}*` +
  String.raw`|ясаб|тайёрла(?:б|нг|нгиз)?|қил(?:иб|инг|ингиз)?|тузиб|ёзиб|бер(?:инг|ингиз)?|керак\p{L}*` +
  String.raw`|make|create|prepare|need|want|build|do|write` +
  String.raw`|(?:с|пере)дела(?:й|йте|ть)|подготов(?:ь|ьте|ить)|нуж(?:на|ен|но|ны)|созда(?:й|йте|ть)` +
  String.raw`|оформи(?:те)?|напиш(?:и|ите)|написать|хочу)`
// "How to make a good presentation" asks how, not for one.
const NOT_HOW = String.raw`(?<!(?:how\s+to|how\s+do\s+i|как|qanday(?:\s+qilib)?|қандай(?:\s+қилиб)?)\s)`
// Two to 999: "IAS 1 Presentation" and "1-sinf" are not counts of slides.
const COUNT = String.raw`(?<![\p{L}\p{N}.,])(?:[2-9]|[1-9]\d{1,2})(?![.,]?\d)`

/**
 * The word asked for: a count before it, a request verb within a word or two,
 * or a subject given to it ("a presentation on volcanoes", "Amir Temur haqida
 * slayd"). A subject the word is given to is the topic instead: "tips on
 * presentations", "taqdimot haqida".
 */
function asked(word: string, noun = word) {
  return new RegExp(
    [
      B + noun + String.raw`\s+(?:on|about|про|об?|на\s+тему)` + E,
      B + String.raw`(?:haqida|mavzusida|ҳақида|мавзусида)\s+(?:\p{L}+\s+)?` + word + E,
      // "10 ta slayd", "20 sahifalik prezentatsiya", "15-slide", "10sahifali referat"
      COUNT + String.raw`\s*(?:-?\s*(?:ta|та)\s+|-\s*)?(?:\p{L}+\s+)?` + word + E,
      // "slayd 10 ta"
      B + word + String.raw`\s*[:–-]?\s*` + COUNT + String.raw`\s*-?\s*(?:ta|та|шт)` + E,
      // "slayd yasab ber", "slide kerak", "referat kerak"
      B + word + String.raw`(?:\s+\p{L}+)?\s+` + NOT_HOW + VERB + E,
      // "make bright slides", "сделай презентацию", "I need a referat"
      NOT_HOW + B + VERB + String.raw`(?:\s+\p{L}+){0,2}\s+` + word + E,
    ].join('|'),
    'iu',
  )
}
const SLIDES = new RegExp(B + SLIDE_WORD + E, 'iu')
// Software is a topic far more often than a deck is: "the effect of PowerPoint on learning".
const SLIDES_ASKED = asked(
  SLIDE_WORD,
  String.raw`(?:sla[iy]d\p{L}*|slides?|slideshow|taqdimot\p{L}*|pre[sz][ei]nta(?:ts|s)i\p{L}*|presentations?|презентац\p{L}*|слайд\p{L}*)`,
)
// A deck made out of something: "into a presentation", "в презентацию", "slayd ko‘rinishida".
const SLIDES_INTO = new RegExp(
  B +
    String.raw`(?:(?:into|в\s+виде)\s+(?:(?:a|an)\s+)?(?:\p{L}+\s+)?${SLIDE_WORD}` +
    String.raw`|в\s+(?:презентацию|слайды)|${SLIDE_WORD}\s+ko'rinishida)` +
    E,
  'iu',
)
const PAPER = new RegExp(B + PAPER_WORD + E, 'iu')
const PAPER_ASKED = asked(PAPER_WORD)
const PDF = new RegExp(B + String.raw`(?:pdf|пдф)`, 'iu')
// The PDF a description works from, not one it asks for: "pdfdan", "pdfdagi",
// "pdfni", "this PDF", "этот pdf", "from the attached PDF", "из этого PDF",
// "pdf asosida", "the PDF into slides".
const PDF_SOURCE = new RegExp(
  B +
    String.raw`(?:(?:pdf|пдф)\s*['-]?\s*(?:(?:fayl|файл)\s*)?(?:ni|ни|dan|дан|dagi|даги)` +
    String.raw`|(?:from|из|по)\s+(?:\p{L}+\s+){0,2}(?:pdf|пдф)` +
    String.raw`|(?:this|that|the\s+attached|attached|my|этот|этого|этом|эту|мой|bu|shu|ushbu|бу|шу)\s+(?:pdf|пдф)` +
    String.raw`|(?:pdf|пдф)\s+asosida|на\s+основе\s+(?:\p{L}+\s+)?(?:pdf|пдф)` +
    String.raw`|(?:pdf|пдф)(?=\s+(?:into|в|во)\s))` +
    E,
  'giu',
)

/** Lower case, one apostrophe, no stray spacing: how the customers type varies. */
function normalised(text: string) {
  return text
    .normalize('NFC')
    .replace(/[‘’ʼʻ`´]/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/**
 * The other service's id when the description asks for it, else ''. A PDF or
 * a written paper named as the thing to make ("a PDF handout for my slides",
 * "PowerPoint haqida referat") keeps the PDF service: the customer has said
 * what they want.
 */
export function serviceHint(prompt: string, featureId: string, attached = false): string {
  const text = normalised(prompt || '')
  if (!text.trim()) return ''
  if (featureId === 'ai.pdf_topic') {
    if (!SLIDES_ASKED.test(text) && !SLIDES_INTO.test(text)) return ''
    if (PDF.test(text.replace(PDF_SOURCE, ' '))) return ''
    return WRITTEN.test(text) && !DEFENCE.test(text) ? '' : 'ai.pptx'
  }
  // Attached files make a paper's name ambiguous: "shorten this referat"
  // is about the file the slides are made from.
  if (featureId === 'ai.pptx' && !attached)
    return PAPER.test(text) && PAPER_ASKED.test(text) && !SLIDES.test(text) && !DEFENCE.test(text)
      ? 'ai.pdf_topic'
      : ''
  return ''
}
