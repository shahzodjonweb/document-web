/**
 * The layouts a slide can use. The server owns the catalogue
 * (`apps/studio/layouts.py`) and decides whether a layout's content holds; this
 * mirrors its ids so the outline editor can offer them, and
 * `tests/catalog-check.mjs` fails the build if the two drift apart.
 *
 * Which fields a layout reads decides which inputs the editor shows: a slide
 * keeps every field it has either way, so switching layout never loses text.
 */
export const SLIDE_LAYOUT_GROUPS = {
  text: ['bullets', 'two_column', 'statement', 'quote', 'section', 'cover', 'closing'],
  data: ['big_number', 'stats', 'chart', 'table', 'comparison'],
  structure: ['agenda', 'timeline', 'process', 'pros_cons', 'cards', 'matrix'],
  photo: ['image_split', 'image_full'],
} as const
export type SlideLayoutGroup = keyof typeof SLIDE_LAYOUT_GROUPS
export type SlideLayout = 'auto' | (typeof SLIDE_LAYOUT_GROUPS)[SlideLayoutGroup][number]
export const SLIDE_LAYOUTS: SlideLayout[] = Object.values(SLIDE_LAYOUT_GROUPS).flat()

/** Layouts whose content is a list of items rather than lines of body text. */
const ITEM_LAYOUTS = new Set<string>([
  'agenda', 'two_column', 'quote', 'big_number', 'stats', 'timeline', 'process',
  'comparison', 'pros_cons', 'cards', 'matrix', 'chart', 'table',
])
/** Layouts that name their columns, panels or axes. */
const COLUMN_LAYOUTS = new Set<string>(['table', 'comparison', 'pros_cons', 'matrix', 'chart'])
/** Layouts that can carry a stock photo. */
const PHOTO_LAYOUTS = new Set<string>(['cover', 'image_split', 'image_full'])
export const MAX_SLIDE_ITEMS = 8
export const MAX_SLIDE_COLUMNS = 3

export interface SlideItem {
  label: string
  text: string
  value: string
}

/** A deck section with every slide field present, so the inputs can bind to it. */
export function slideSection(section: any) {
  section.layout ||= 'auto'
  section.items = Array.isArray(section.items) ? section.items : []
  section.columns = Array.isArray(section.columns) ? section.columns : []
  section.image_query ||= ''
  section.notes ||= ''
  return section
}

export const layoutUsesItems = (section: any) =>
  ITEM_LAYOUTS.has(section.layout) || (section.layout === 'auto' && section.items?.length > 0)
export const layoutUsesColumns = (section: any) =>
  COLUMN_LAYOUTS.has(section.layout) || (section.layout === 'auto' && section.columns?.some(Boolean))
export const layoutUsesPhoto = (section: any) => PHOTO_LAYOUTS.has(section.layout)
export const isPhotoLayout = (layout: string) => layout === 'image_split' || layout === 'image_full'

/** A slide has something to render: body text, or at least one filled item. */
export const sectionHasContent = (section: any) =>
  !!section.body?.trim() ||
  (Array.isArray(section.items) &&
    section.items.some((item: SlideItem) => item.label?.trim() || item.text?.trim() || item.value?.trim()))
