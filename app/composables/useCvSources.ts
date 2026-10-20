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

// A LinkedIn address: a profile (linkedin.com/in/…), any other page of the
// site, or its short links.
const LINKEDIN = /(?:https?:\/\/)?(?:[\w-]+\.)*(?:linkedin\.com(?:\/[^\s]*)?|lnkd\.in\/[^\s]*)/giu

/**
 * A description that is only a LinkedIn link, with a few words around it at
 * most ("my profile:", "Mening LinkedIn profilim", "Вот мой профиль").
 * LinkedIn shows profiles only to people signed in, so the server cannot read
 * one: the way is LinkedIn's own Save to PDF. A link inside a real
 * description is left to the server, which reads the description itself.
 */
export function linkedinLinkOnly(text: string) {
  if (!text.match(LINKEDIN)) return false
  const words = text
    .replace(LINKEDIN, ' ')
    .replace(/linked\s*in/giu, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
  return words.length <= 4
}
