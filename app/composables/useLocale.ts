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
export function useLocale() {
  const route = useRoute()
  const locale = computed<Locale>(() =>
    ['en', 'uz', 'ru'].includes(String(route.params.locale)) ? (route.params.locale as Locale) : 'en',
  )
  // Keys often come straight from API data (a plan, a status, a warning code). A
  // missing one renders as nothing instead of taking the whole section down.
  // The product's name is never typed in a string: `{brand}` is filled here, and
  // `{formerBrand}` names it as it was called before.
  const names: Record<string, string> = {
    brand: String(useRuntimeConfig().public.productName),
    formerBrand: 'PDF Master',
  }
  const t = (key: string | null | undefined, values: Record<string, string | number> = {}) => {
    const name = String(key ?? '')
    return (dictionaries[locale.value][name] || dictionaries.en[name] || name).replace(
      /\{(\w+)\}/g,
      (_match, field) => String(values[field] ?? names[field] ?? `{${field}}`),
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
