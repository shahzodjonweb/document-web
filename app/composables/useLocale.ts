import dictionaries, { type Locale } from '../../locales/catalog'
import { dayLabel } from './usePricing'
/** The zone of this device's clock (e.g. Asia/Tashkent); every time on screen is shown in it. */
export const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    return ''
  }
}
/**
 * The weekly limits copy names, from the live plans (the admin can change them
 * at /ops/plans): `{freeAi}`, `{freeFiles}`, `{plusAi}`. Until the plans are
 * known, the shipped defaults (docs/product/plan_seed.json) stand in. Callers
 * pass the plans state they took during setup: text is also made later, in a
 * head or a computed, where no Nuxt context exists to look it up.
 */
export function planNumbers(plans: readonly any[]): Record<string, string> {
  const limit = (id: string, field: string, fallback: number) => {
    const value = plans.find((plan) => plan?.id === id)?.limits?.[field]
    return String(typeof value === 'number' ? value : fallback)
  }
  return {
    freeAi: limit('free', 'weekly_ai_documents', 5),
    freeFiles: limit('free', 'weekly_file_jobs', 15),
    plusAi: limit('plus', 'weekly_ai_documents', 20),
  }
}
/** Russian short words that should not end a line: "в", "о", "с", "и", "по"… */
const RU_SHORT_WORD = /(^|[\s(«„])(в|во|о|об|на|с|со|к|ко|и|а|у|по|до|из|за|от|не|ни)\s(?=\S)/gi
export function useLocale() {
  const route = useRoute()
  const locale = computed<Locale>(() =>
    ['en', 'uz', 'ru'].includes(String(route.params.locale)) ? (route.params.locale as Locale) : 'en',
  )
  // Keys often come straight from API data (a plan, a status, a warning code). A
  // missing one renders as nothing instead of taking the whole section down.
  // The product's name is never typed in a string: `{brand}` is filled here, and
  // `{formerBrand}` names it as it was called before.
  const plans = useState<any[]>('plans', () => [])
  const names: Record<string, string> = {
    brand: String(useRuntimeConfig().public.productName),
    formerBrand: 'PDF Master',
  }
  const t = (key: string | null | undefined, values: Record<string, string | number> = {}) => {
    const name = String(key ?? '')
    const raw = dictionaries[locale.value][name] || dictionaries.en[name] || name
    // On the public site's Russian pages a one- or two-letter preposition or conjunction
    // stays with the word after it; the app's own strings are left exactly as written.
    const text = locale.value === 'ru' && name.startsWith('site') ? raw.replace(RU_SHORT_WORD, '$1$2\u00a0') : raw
    if (!text.includes('{')) return text
    const numbers = /\{(freeAi|freeFiles|plusAi)\}/.test(text) ? planNumbers(plans.value) : {}
    return text.replace(
      /\{(\w+)\}/g,
      (_match, field) => String(values[field] ?? names[field] ?? numbers[field] ?? `{${field}}`),
    )
  }
  const count = (key: string, amount: number) =>
    t(`${key}_${new Intl.PluralRules(locale.value).select(amount)}`, { count: amount })
  const path = (value = '') => `/${locale.value}${value}`
  const localePath = (value: string) => route.fullPath.replace(/^\/(en|uz|ru)(?=\/|$)/, `/${value}`)
  const date = (value?: string, time = false) => {
    if (!value) return '—'
    const at = new Date(value)
    // Chromium, which Android's Telegram and Telegram Desktop run on, has no Uzbek months and
    // writes "2026 M11 7": the day is spelt from the bot's own table, "7-noyabr, 21:09".
    if (locale.value === 'uz') {
      const day = dayLabel(`${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`, 'uz')
      const pad = (part: number) => String(part).padStart(2, '0')
      return time ? `${day}, ${pad(at.getHours())}:${pad(at.getMinutes())}` : day
    }
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      ...(time ? { timeStyle: 'short' as const } : {}),
    }).format(at)
  }
  return { locale, t, count, path, localePath, date, timeZone: deviceTimeZone() }
}
