/** One CV template as `GET /studio/cv-templates` lists it. */
export interface CvTemplate {
  id: string
  name: string
  category: string
  /** How the page is laid out: one column, a sidebar, a header band, … */
  drawer: string
  /** The template has a place for the customer's portrait. */
  photo: boolean
  /** `light`: tinted side or band, dark text; `dark`: filled with the accent, white text; `paper`: the whole page tinted. */
  tone: 'light' | 'dark' | 'paper' | string
  /** The template's first page, rendered by the platform with a fictional sample CV. */
  preview?: string
  fonts: { heading: 'serif' | 'sans' | string; body: 'serif' | 'sans' | string }
  colours: { accent: string; secondary?: string; tint?: string | null; ink?: string; fill?: string }
}
export interface CvCategory {
  id: string
  name: string
  templates: CvTemplate[]
}
export interface CvCatalogue {
  categories: CvCategory[]
  /** What Auto keeps to unless the description calls for another. */
  default: string
}
/** The server's own default, for the moment before the catalogue has loaded. */
export const CV_DEFAULT_TEMPLATE = 'classic_navy'

/**
 * The CV templates, in the page's language. Read once per language and shared
 * by the Mini App's setup page and Create with AI, which both show the picker.
 */
export function useCvTemplates() {
  const ws = useWorkspace()
  const { locale } = useLocale()
  const catalogue = useState<CvCatalogue | null>('cv-templates', () => null)
  const loadedFor = useState('cv-templates-locale', () => '')
  async function load() {
    const wanted = locale.value
    if (catalogue.value && loadedFor.value === wanted) return catalogue.value
    const listed = await ws.api<CvCatalogue>(`/studio/cv-templates?locale=${wanted}`)
    catalogue.value = listed
    loadedFor.value = wanted
    return listed
  }
  const categories = computed(() => catalogue.value?.categories || [])
  const defaultId = computed(() => catalogue.value?.default || CV_DEFAULT_TEMPLATE)
  const find = (id?: string | null) => {
    for (const group of categories.value) {
      const found = group.templates.find((entry) => entry.id === id)
      if (found) return found
    }
    return null
  }
  return { catalogue, categories, defaultId, load, find }
}
