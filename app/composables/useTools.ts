import type { Feature } from '../../generated/api/types'

/** Generation features live on `/studio/config`, not in `/catalog`. */
const GENERATION = /^(ai|study|school|teacher)\./
export const isGenerationFeature = (id: string) => GENERATION.test(id)

/**
 * What a first-time visitor should see first. The four AI services lead, then
 * the familiar file tools; everything else follows in catalogue order with the
 * remaining generation features last, where the category filter can reach them.
 */
const FEATURED = ['ai.pdf_topic', 'ai.pptx', 'study.summary', 'study.quiz']
const STAPLES = ['pdf.merge', 'pdf.compress', 'pdf.split', 'pdf.images_to_pdf', 'convert.word_to_pdf']

export function useTools() {
  const { t } = useLocale()
  const name = (id: string, fallback = '') =>
    t(`${id}.name`) === `${id}.name` ? fallback || id : t(`${id}.name`)
  const description = (id: string) =>
    t(`${id}.description`) === `${id}.description` ? t('simpleBody') : t(`${id}.description`)
  const destination = (id: string) =>
    id === 'ai.images'
      ? '/app/images'
      : id.startsWith('editor.')
        ? `/app/editor?feature=${encodeURIComponent(id)}`
        : GENERATION.test(id)
          ? `/app/create?feature=${encodeURIComponent(id)}`
          : `/app/tools/${id}`
  const icons: Record<string, string> = {
    'ocr.extract_text': 'word',
    'ocr.searchable_pdf': 'search',
    'convert.pdf_to_docx': 'word',
    'convert.pdf_to_xlsx': 'tools',
    'batch.convert': 'files',
    'batch.compress': 'compress',
    'batch.image_sets': 'image',
    'pdf.merge': 'merge',
    'pdf.compress': 'compress',
    'pdf.split': 'split',
    'pdf.images_to_pdf': 'image',
    'pdf.to_images': 'image',
    'convert.word_to_pdf': 'word',
    'convert.pptx_to_pdf': 'files',
    'pdf.extract_pages': 'files',
    'pdf.delete_pages': 'trash',
    'pdf.reorder': 'reorder',
    'pdf.rotate': 'rotate',
    'pdf.protect': 'lock',
    'pdf.unlock_known': 'unlock',
  }
  /** Generation ids are matched by shape rather than listed one by one. */
  const icon = (id: string) => {
    if (icons[id]) return icons[id]
    if (!GENERATION.test(id)) return 'file'
    if (id === 'ai.images') return 'image'
    if (/slide|pptx|poster|pack/.test(id)) return 'files'
    if (/quiz|test|mcq|marks|check|rubric|answer/.test(id)) return 'checks'
    if (/plan|outline|schedule|syllabus|revision/.test(id)) return 'reorder'
    if (id.startsWith('ai.')) return 'sparkle'
    return 'book'
  }
  const colors: Record<string, string> = {
    'pdf.merge': 'purple',
    'pdf.compress': 'green',
    'pdf.split': 'orange',
    'pdf.images_to_pdf': 'blue',
    'convert.word_to_pdf': 'sky',
    'convert.pptx_to_pdf': 'orange',
    'pdf.to_images': 'blue',
    'pdf.protect': 'rose',
    'pdf.unlock_known': 'rose',
    'ai.pdf_topic': 'purple',
    'ai.pptx': 'sky',
    'study.summary': 'green',
    'study.quiz': 'blue',
  }
  const { features } = useWorkspace()
  const studio = useStudio()
  // `/studio/config` is loaded for signed-in customers at boot; signed-out
  // visitors keep the file-tool directory, which is what they can actually use.
  const generation = computed<Feature[]>(() =>
    studio.features.value.map((feature) => ({
      id: feature.id,
      name: feature.name,
      category: 'ai',
      eligible: feature.eligible,
    })),
  )
  const rank = (id: string) =>
    FEATURED.includes(id)
      ? FEATURED.indexOf(id)
      : STAPLES.includes(id)
        ? FEATURED.length + STAPLES.indexOf(id)
        : GENERATION.test(id)
          ? 200
          : 100
  const sorted = computed(() =>
    [...generation.value, ...features.value].sort((a, b) => rank(a.id) - rank(b.id)),
  )
  const category = (id: string) =>
    GENERATION.test(id)
      ? 'aiCategory'
      : id.startsWith('ocr.')
        ? 'ocrCategory'
        : id.startsWith('editor.')
          ? 'editor'
          : id.startsWith('batch.')
            ? 'automationCategory'
            : id === 'pdf.compress'
              ? 'compressionCategory'
              : id.includes('protect') || id.includes('unlock')
                ? 'securityCategory'
                : id.includes('images') || id.startsWith('convert.')
                  ? 'conversionCategory'
                  : 'pagesCategory'
  return { icons, icon, colors, sorted, category, name, description, destination }
}
