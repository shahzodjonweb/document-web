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
const EMAIL = /[\p{L}\p{N}_.+\-']+@[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+/u
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
