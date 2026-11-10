import { faq as allFaq } from '../../content/site/faq'
import { tools, type SiteTool } from '../../content/site/tools'

/** The tool directory's groups, in the mega menu's and the home page's order. */
export const TOOL_GROUPS = [
  {
    key: 'siteMegaOrganize',
    slugs: ['merge-pdf', 'split-pdf', 'extract-pdf-pages', 'delete-pdf-pages', 'reorder-pdf-pages', 'rotate-pdf'],
  },
  {
    key: 'siteMegaConvert',
    slugs: ['compress-pdf', 'jpg-to-pdf', 'word-to-pdf', 'powerpoint-to-pdf', 'pdf-to-jpg', 'pdf-to-word', 'pdf-to-excel'],
  },
  {
    key: 'siteMegaSecure',
    slugs: ['ocr-pdf', 'searchable-pdf', 'protect-pdf', 'unlock-pdf', 'sign-pdf', 'fill-pdf-form'],
  },
] as const

/**
 * What every public page needs: its copy with the owner's details filled in,
 * links into the app and to the bot, the tools and the FAQ.
 *
 * Copy may hold `{{bot.username}}`-style tokens for details the owner sets in
 * the admin (docs/site/copy/facts-checklist.md). `st()` fills the ones it knows
 * and returns '' for a line whose detail is not set yet, so a page hides it
 * (`v-if`) rather than showing a token.
 */
const RU_SHORT = /(^|[\s(«„])(в|во|о|об|на|с|со|к|ко|и|а|у|по|до|из|за|от|не|ни)\s(?=\S)/gi
export function useSite() {
  const { t, path, locale } = useLocale()
  const { contacts } = contactsState()
  const { destination } = useTools()
  const brand = String(useRuntimeConfig().public.productName)
  const plans = useState<any[]>('plans', () => [])
  const index = computed(() => (['en', 'uz', 'ru'] as const).indexOf(locale.value))

  const bot = computed(() => contacts.value?.bot ?? null)
  const known = computed<Record<string, string>>(() => ({
    'bot.username': bot.value?.username ? `@${bot.value.username}` : '',
    'bot.url': bot.value?.url || '',
    'support.url': contacts.value?.support?.url || '',
    'company.phone': contacts.value?.company?.phone || '',
    'company.email': contacts.value?.company?.email || '',
  }))
  /** Owner details in; '' when one is still missing. */
  const fill = (text: string) => {
    const numbers = planNumbers(plans.value)
    const done = text
      .replaceAll('{brand}', brand)
      .replaceAll('{formerBrand}', 'PDF Master')
      .replace(/\{(freeAi|freeFiles|plusAi)\}/g, (_match, field) => numbers[field]!)
      .replace(/\{\{([a-z_.]+)\}\}/g, (match, token) => known.value[token] || match)
    if (done.includes('{{')) return ''
    // "1 000", "20 MB" stay on one line.
    const kept = done.replace(/(\d) (\d{3})(?!\d)/g, '$1\u00a0$2').replace(/(\d) (MB|МБ|GB|ГБ)/g, '$1\u00a0$2')
    return locale.value === 'ru' ? kept.replace(RU_SHORT, '$1$2\u00a0') : kept
  }
  const st = (key: string, values: Record<string, string | number> = {}) => fill(t(key, values))

  const tool = (slug: string): SiteTool | undefined => tools.find((item) => item.slug === slug)
  const toolName = (item: SiteTool) => t(`${item.copyKeyPrefix}Name`)
  const toolLine = (item: SiteTool) => t(`${item.copyKeyPrefix}Line`)
  const toolPage = (slug: string) => path(`/tools/${slug}`)
  /** Where a "start" button goes: the app, or one tool or service in it. */
  const start = (feature?: string) => path(feature ? destination(feature) : '/app')
  const groups = computed(() =>
    TOOL_GROUPS.map((group) => ({
      key: group.key,
      title: t(group.key),
      tools: group.slugs.map((slug) => tool(slug)).filter((item): item is SiteTool => !!item),
    })),
  )

  /** The FAQ items a page shows, in its language. */
  const faq = (page: string) =>
    allFaq
      .filter((item) => (item.pages as readonly string[]).includes(page))
      .map((item) => ({ id: item.id, q: fill(item.q[index.value]!), a: fill(item.a[index.value]!) }))
      .filter((item) => item.q && item.a)

  return { t, st, fill, path, locale, bot, tool, toolName, toolLine, toolPage, start, groups, faq, tools }
}
