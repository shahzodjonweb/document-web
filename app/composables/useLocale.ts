import dictionaries, { type Locale } from '../../locales/catalog'
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
          timeZone: useWorkspace().user.value?.time_zone || useWorkspace().user.value?.timezone || 'UTC',
        }).format(new Date(value))
      : '—'
  return { locale, t, count, path, localePath, date }
}
