export interface PlanPhrase {
  pre: string
  value: unknown
  post: string
}
/**
 * Plan features as phrases: "5 AI documents a week", "Unlimited file tasks".
 * `{count}` in the copy marks where the number goes, so each language puts it
 * where it belongs and a plan card can set it in bold.
 */
export function usePlanPhrases() {
  const { t, locale } = useLocale()
  const number = (value: unknown) =>
    typeof value === 'number' ? value.toLocaleString('ru-RU').replace(/ /g, ' ') : value
  const phrase = (text: string, value: unknown = ''): PlanPhrase => {
    const [pre = '', post = ''] = text.includes('{count}') ? text.split('{count}') : ['', ` ${text}`]
    return { pre, value, post }
  }
  const plural = (key: string, amount: number) =>
    t(`${key}_${new Intl.PluralRules(locale.value).select(amount)}`)
  // A weekly limit the plan does not list is left out; null means unlimited.
  const weekly = (plan: any, key: string, label: string) => {
    if (!plan?.limits || !(key in plan.limits)) return null
    const value = plan.limits[key]
    return value === null
      ? phrase(t(`${label}Unlimited`), t('unlimitedMany'))
      : phrase(plural(label, Number(value)), number(value))
  }
  /** The week's AI documents and file tasks, then the AI edits each file allows. */
  const allowances = (plan: any) =>
    [
      weekly(plan, 'weekly_ai_documents', 'planAiWeek'),
      weekly(plan, 'weekly_file_jobs', 'planFilesWeek'),
      weekly(plan, 'edits_per_file', 'planEdits'),
    ].filter((row): row is PlanPhrase => !!row)
  return { number, phrase, allowances }
}
