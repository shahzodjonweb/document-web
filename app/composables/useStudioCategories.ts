import type { components } from '../../generated/api/schema'

/** A button of a category list: a category, a group of them, or Boshqa (`other`, today's description). */
export type StudioCategory = components['schemas']['StudioCategory']
/** The two services that open with a list, as the bot's AI PDF and AI Slides do. */
export const CATEGORY_FEATURES = ['ai.pdf_topic', 'ai.pptx'] as const
/** The kinds of file a category reads (`purpose` `ai_source`); any other is refused before it is sent. */
export const CATEGORY_FILE_KINDS = ['pdf', 'docx', 'doc', 'txt']

/**
 * Each button's tile: an icon and a tone (miniapp.css `.category-tile[data-tone]`),
 * the web's own where the bot has an emoji. A group's children share its tone.
 * An id the web does not know yet (a category added later) gets a document on
 * its service's first tone, so a new category shows before the web knows it.
 */
const LOOKS: Record<string, [string, string]> = {
  'pdf.mustaqil_ish': ['graduation', 'blue'],
  'pdf.kurs_ishi': ['library', 'violet'],
  'pdf.konspekt': ['book', 'teal'],
  'pdf.dars_ishlanmasi': ['slides', 'green'],
  'pdf.test': ['listChecks', 'amber'],
  'pdf.biz': ['briefcase', 'slate'],
  'pdf.biz.biznes_reja': ['trend', 'slate'],
  'pdf.biz.tijorat_taklifi': ['send', 'slate'],
  'pdf.biz.hisobot': ['chart', 'slate'],
  'pdf.biz.yoriqnoma': ['file', 'slate'],
  'pdf.biz.lavozim_yoriqnomasi': ['badge', 'slate'],
  'pdf.biz.bayonnoma': ['form', 'slate'],
  'pdf.biz.marketing_reja': ['megaphone', 'slate'],
  'pdf.xat': ['mail', 'rose'],
  'pdf.xat.motivatsion': ['target', 'rose'],
  'pdf.xat.ishga_kirish': ['briefcase', 'rose'],
  'pdf.xat.ariza': ['edit', 'rose'],
  'pdf.xat.tavsifnoma': ['user', 'rose'],
  'pdf.xat.tavsiya': ['handshake', 'rose'],
  'pdf.xat.tushuntirish': ['message', 'rose'],
  'slides.mavzu': ['graduation', 'blue'],
  'slides.himoya': ['shield', 'violet'],
  'slides.dars': ['slides', 'green'],
  'slides.tadbir': ['party', 'amber'],
  'slides.tadbir.tarbiyaviy_soat': ['sprout', 'amber'],
  'slides.tadbir.bayram': ['party', 'amber'],
  'slides.tadbir.ota_onalar': ['people', 'amber'],
  'slides.tadbir.pedkengash': ['school', 'amber'],
  'slides.pitch': ['rocket', 'teal'],
  'slides.hisobot': ['chart', 'slate'],
  'slides.kompaniya': ['building', 'rose'],
}
export function categoryLook(node: Pick<StudioCategory, 'id' | 'kind'>): { icon: string; tone: string } {
  if (node.kind === 'other') return { icon: 'edit', tone: 'grey' }
  const [icon, tone] = LOOKS[node.id] || [node.id.startsWith('slides.') ? 'slides' : 'file', 'blue']
  return { icon, tone }
}

/**
 * The AI PDF and AI Slides category lists, as the bot shows them (`GET
 * /studio/categories`), in the page's language. A service whose list is empty
 * (the owner's switch off, nothing of it ticked, or a server without lists)
 * opens today's description, so a failed request is an empty list, never an
 * error. One request serves every screen while the language stays the same.
 */
let loading: Promise<void> | null = null
export function useStudioCategories() {
  const ws = useWorkspace()
  const { locale } = useLocale()
  const lists = useState<Record<string, StudioCategory[]> | null>('studio-categories', () => null)
  const loadedFor = useState('studio-categories-locale', () => '')
  async function load() {
    if (!ws.user.value) return
    if (lists.value && loadedFor.value === locale.value) return
    const asked = locale.value
    loading ??= (async () => {
      try {
        const answer: any = await ws.api(`/studio/categories?locale=${asked}`)
        lists.value = answer?.features && typeof answer.features === 'object' ? answer.features : {}
      } catch {
        lists.value = {}
      } finally {
        loadedFor.value = asked
        loading = null
      }
    })()
    return loading
  }
  /** Whether the answer for this language is in: until then the page waits rather than flashing today's form. */
  const ready = computed(() => !!lists.value && loadedFor.value === locale.value)
  const list = (featureId: string): StudioCategory[] => {
    const nodes = lists.value?.[featureId]
    return Array.isArray(nodes) ? nodes : []
  }
  /** A category or group of a service's list by id, groups' children included. */
  function find(featureId: string, id: string): StudioCategory | null {
    for (const node of list(featureId)) {
      if (node.id === id && node.kind !== 'other') return node
      const child = node.children?.find((item) => item.id === id && item.kind === 'category')
      if (child) return child
    }
    return null
  }
  /** The group a category sits in, or null at the top of its list. */
  const groupOf = (featureId: string, id: string) =>
    list(featureId).find(
      (node) => node.kind === 'group' && node.children?.some((child) => child.id === id),
    ) || null
  /** A category's screen opened: counted as the bot counts a tap on it. Never in the customer's way. */
  function chosen(id: string) {
    ws.api('/studio/categories/chosen', { method: 'POST', body: { category: id } }).catch(() => {})
  }
  return { lists, ready, load, list, find, groupOf, chosen }
}
