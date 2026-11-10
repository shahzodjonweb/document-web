// The 19 public tool pages (/{locale}/tools/{slug}). Copy lives in locales/site.ts under
// `${copyKeyPrefix}{Name|Line|Desc|H1|Lead|Chip1-3|DropTitle|DropButton|DropNote|HowToTitle|
// Step1-3Title|Step1-3Text|DetailsTitle|DetailsBody|Tip1|Tip2|LimitNote}`; editor-backed pages carry
// EditorMoreTitle/EditorMoreBody instead of LimitNote. FAQ items are in content/site/faq.ts (pages: [slug]).
// `id` is the catalog feature id the CTA opens (useTools().destination); `related` follows
// docs/site/seo/internal-linking.md §2 (tool slugs, or page ids such as pdf-editor / ai-slides / telegram).
// `channels` is the owner-verified availability; the page should still render the bot chip from the live catalog.
// `icon` is an AppIcon name that exists today; spec §7 asks for `scan-text`, `presentation`, `table`
// and `form` to be added, after which ocr-pdf, powerpoint-to-pdf, pdf-to-excel and fill-pdf-form can switch.
export type ToolCategory = 'organize' | 'optimize' | 'to-pdf' | 'from-pdf' | 'ocr' | 'security' | 'edit'
export type ToolChannel = 'web' | 'bot' | 'mini_app'
export type SiteTool = {
  id: string
  slug: string
  category: ToolCategory
  icon: string
  related: readonly string[]
  channels: readonly ToolChannel[]
  copyKeyPrefix: string
}

export const tools = [
  { id: 'pdf.merge', slug: 'merge-pdf', category: 'organize', icon: 'merge', related: ['split-pdf', 'compress-pdf', 'jpg-to-pdf', 'reorder-pdf-pages', 'word-to-pdf'], channels: ['web', 'bot'], copyKeyPrefix: 'siteToolMergePdf' },
  { id: 'pdf.split', slug: 'split-pdf', category: 'organize', icon: 'split', related: ['extract-pdf-pages', 'delete-pdf-pages', 'merge-pdf', 'compress-pdf'], channels: ['web', 'bot'], copyKeyPrefix: 'siteToolSplitPdf' },
  { id: 'pdf.extract_pages', slug: 'extract-pdf-pages', category: 'organize', icon: 'files', related: ['split-pdf', 'delete-pdf-pages', 'reorder-pdf-pages', 'merge-pdf'], channels: ['web', 'bot'], copyKeyPrefix: 'siteToolExtractPdfPages' },
  { id: 'pdf.delete_pages', slug: 'delete-pdf-pages', category: 'organize', icon: 'trash', related: ['extract-pdf-pages', 'reorder-pdf-pages', 'split-pdf', 'pdf-editor'], channels: ['web', 'bot'], copyKeyPrefix: 'siteToolDeletePdfPages' },
  { id: 'pdf.reorder', slug: 'reorder-pdf-pages', category: 'organize', icon: 'reorder', related: ['rotate-pdf', 'delete-pdf-pages', 'merge-pdf', 'pdf-editor'], channels: ['web', 'bot'], copyKeyPrefix: 'siteToolReorderPdfPages' },
  { id: 'pdf.rotate', slug: 'rotate-pdf', category: 'organize', icon: 'rotate', related: ['reorder-pdf-pages', 'jpg-to-pdf', 'searchable-pdf', 'merge-pdf'], channels: ['web', 'bot'], copyKeyPrefix: 'siteToolRotatePdf' },
  { id: 'pdf.compress', slug: 'compress-pdf', category: 'optimize', icon: 'compress', related: ['merge-pdf', 'jpg-to-pdf', 'pdf-to-jpg', 'split-pdf', 'protect-pdf'], channels: ['web', 'bot'], copyKeyPrefix: 'siteToolCompressPdf' },
  { id: 'pdf.images_to_pdf', slug: 'jpg-to-pdf', category: 'to-pdf', icon: 'image', related: ['pdf-to-jpg', 'searchable-pdf', 'merge-pdf', 'compress-pdf', 'telegram'], channels: ['web', 'bot'], copyKeyPrefix: 'siteToolJpgToPdf' },
  { id: 'convert.word_to_pdf', slug: 'word-to-pdf', category: 'to-pdf', icon: 'word', related: ['pdf-to-word', 'powerpoint-to-pdf', 'merge-pdf', 'compress-pdf', 'ai-documents'], channels: ['web', 'bot'], copyKeyPrefix: 'siteToolWordToPdf' },
  { id: 'convert.pptx_to_pdf', slug: 'powerpoint-to-pdf', category: 'to-pdf', icon: 'files', related: ['word-to-pdf', 'ai-slides', 'compress-pdf', 'merge-pdf'], channels: ['web', 'bot'], copyKeyPrefix: 'siteToolPowerpointToPdf' },
  { id: 'pdf.to_images', slug: 'pdf-to-jpg', category: 'from-pdf', icon: 'image', related: ['jpg-to-pdf', 'compress-pdf', 'split-pdf', 'powerpoint-to-pdf'], channels: ['web', 'bot'], copyKeyPrefix: 'siteToolPdfToJpg' },
  { id: 'convert.pdf_to_docx', slug: 'pdf-to-word', category: 'from-pdf', icon: 'word', related: ['word-to-pdf', 'ocr-pdf', 'pdf-to-excel', 'pdf-editor'], channels: ['web'], copyKeyPrefix: 'siteToolPdfToWord' },
  { id: 'convert.pdf_to_xlsx', slug: 'pdf-to-excel', category: 'from-pdf', icon: 'tools', related: ['pdf-to-word', 'ocr-pdf', 'compress-pdf'], channels: ['web'], copyKeyPrefix: 'siteToolPdfToExcel' },
  { id: 'ocr.extract_text', slug: 'ocr-pdf', category: 'ocr', icon: 'type', related: ['searchable-pdf', 'pdf-to-word', 'jpg-to-pdf'], channels: ['web'], copyKeyPrefix: 'siteToolOcrPdf' },
  { id: 'ocr.searchable_pdf', slug: 'searchable-pdf', category: 'ocr', icon: 'search', related: ['ocr-pdf', 'jpg-to-pdf', 'compress-pdf'], channels: ['web'], copyKeyPrefix: 'siteToolSearchablePdf' },
  { id: 'pdf.protect', slug: 'protect-pdf', category: 'security', icon: 'lock', related: ['unlock-pdf', 'compress-pdf', 'sign-pdf'], channels: ['web'], copyKeyPrefix: 'siteToolProtectPdf' },
  { id: 'pdf.unlock_known', slug: 'unlock-pdf', category: 'security', icon: 'unlock', related: ['protect-pdf', 'merge-pdf', 'pdf-editor'], channels: ['web'], copyKeyPrefix: 'siteToolUnlockPdf' },
  { id: 'editor.signature_image', slug: 'sign-pdf', category: 'edit', icon: 'signature', related: ['pdf-editor', 'fill-pdf-form', 'protect-pdf'], channels: ['web', 'mini_app'], copyKeyPrefix: 'siteToolSignPdf' },
  { id: 'editor.fill_forms', slug: 'fill-pdf-form', category: 'edit', icon: 'edit', related: ['pdf-editor', 'sign-pdf', 'word-to-pdf'], channels: ['web', 'mini_app'], copyKeyPrefix: 'siteToolFillPdfForm' },
] as const satisfies readonly SiteTool[]

// Category → section heading key in locales/site.ts (tools index groups and mega-menu filters).
export const toolCategoryKeys = {
  organize: 'siteGroupOrganize',
  optimize: 'siteGroupOptimize',
  'to-pdf': 'siteGroupToPdf',
  'from-pdf': 'siteGroupFromPdf',
  ocr: 'siteGroupOcr',
  security: 'siteGroupSecurity',
  edit: 'siteGroupEdit',
} as const satisfies Record<ToolCategory, string>
