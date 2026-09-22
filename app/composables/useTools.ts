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
  }
  const priority = ['pdf.merge', 'pdf.compress', 'pdf.split', 'pdf.images_to_pdf', 'convert.word_to_pdf']
  const { features } = useWorkspace()
  const sorted = computed(() =>
    [...features.value].sort(
      (a, b) =>
        (priority.includes(a.id) ? priority.indexOf(a.id) : 100) -
        (priority.includes(b.id) ? priority.indexOf(b.id) : 100),
    ),
  )
  const category = (id: string) =>
    id.startsWith('ocr.')
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
  return { icons, colors, sorted, category, name, description, destination }
}
