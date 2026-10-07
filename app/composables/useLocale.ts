import dictionaries, { type Locale } from '../../locales/catalog'
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
  const t = (key: string, values: Record<string, string | number> = {}) =>
    (dictionaries[locale.value][key] || dictionaries.en[key] || key).replace(/\{(\w+)\}/g, (_match, name) =>
      String(values[name] ?? `{${name}}`),
    )
  const count = (key: string, amount: number) =>
    t(`${key}_${new Intl.PluralRules(locale.value).select(amount)}`, { count: amount })
  const path = (value = '') => `/${locale.value}${value}`
  const localePath = (value: string) => route.fullPath.replace(/^\/(en|uz|ru)(?=\/|$)/, `/${value}`)
  const date = (value?: string, time = false) =>
    value
      ? new Intl.DateTimeFormat(locale.value === 'uz' ? 'uz-Latn' : locale.value, {
          dateStyle: 'medium',
          ...(time ? { timeStyle: 'short' as const } : {}),
        }).format(new Date(value))
      : '—'
  return { locale, t, count, path, localePath, date, timeZone: deviceTimeZone() }
}
