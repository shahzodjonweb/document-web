/** A live discount on a plan, as the server reports it. */
export interface PlanDiscount {
  /** Today's price in so'm. */
  price: number
  /** The regular price it replaces. */
  regular: number
  /** Whole percent off, rounded down by the server so it never overstates. */
  percent: number
  /** The last day it applies, YYYY-MM-DD in Tashkent. */
  until: string
}
export interface DiscountedPlan {
  plan: any
  discount: PlanDiscount
}
/**
 * Month names spelt here rather than asked of Intl, so the bot and the web
 * write a day the same way on every device: Chrome's ICU has no Uzbek Latin
 * months (it prints "M10 31"), en-GB abbreviates September as "Sept" where the
 * bot writes "Sep", and Russian with a year gains a " г." The same tables live
 * in the platform's `telegram/clock.py`.
 */
const MONTHS: Record<'en' | 'uz' | 'ru', string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ],
}
/**
 * The calendar year in Tashkent right now, the clock the plans run on.
 * Asia/Tashkent is UTC+5 all year round, so five hours on the UTC clock is
 * exact and no zone table is needed.
 */
export const tashkentYear = (now: number = Date.now()) => new Date(now + 5 * 3600_000).getUTCFullYear()
/**
 * A YYYY-MM-DD day as the language writes it: "31 Oct", "31-oktabr",
 * "31 октября". The year is added only when it is not the current Tashkent
 * year, as the bot does: "5 Jan 2027", "2027-yil 5-yanvar", "5 января 2027".
 * Built from the date's parts: `new Date('2026-10-31')` is midnight UTC,
 * which is still the 30th on a device west of Greenwich. Anything that is
 * not such a day is returned as it came, never thrown on.
 */
export function dayLabel(iso: string, locale: string, thisYear: number = tashkentYear()): string {
  const [year, month, day] = String(iso).split('-').map(Number)
  if (!year || !month || !day || month > 12 || day > 31) return String(iso)
  const name = ((MONTHS as Record<string, string[] | undefined>)[locale] ?? MONTHS.en)[month - 1]
  if (locale === 'uz') return year === thisYear ? `${day}-${name}` : `${year}-yil ${day}-${name}`
  return year === thisYear ? `${day} ${name}` : `${day} ${name} ${year}`
}
/**
 * Prices in so'm, read the same way everywhere: the plan cards, the landing
 * teaser, the card-transfer panel and the discount banner. The readers are
 * tolerant because the web ships before the platform: a plan from an older
 * platform has its price only under `limits`, and a discount is shown only
 * when it is a whole, sensible object — a half-filled one is treated as none,
 * so "−0%" can never render.
 */
export function usePricing() {
  const { locale, t } = useLocale()
  const ws = useWorkspace()
  // ru-RU groups thousands with a (narrow) no-break space; a plain space reads
  // the same and keeps the tests and the bot's "15 000" spelling in step.
  const figure = (amount: number) => amount.toLocaleString('ru-RU').replace(/[  ]/g, ' ')
  const money = (amount: number) => `${figure(amount)} so'm`
  /**
   * The regular price in so'm, or 0 when a plan isn't for sale: a plan's
   * `price_uzs`, a card-transfer option's `regular_price` (falling back to its
   * `price`), or, from an older platform, the limit of the same name.
   */
  const regular = (plan: any): number => {
    const value = Number(plan?.price_uzs ?? plan?.regular_price ?? plan?.limits?.price_uzs ?? plan?.price)
    return value > 0 ? value : 0
  }
  const discount = (plan: any): PlanDiscount | null => {
    const full = regular(plan)
    const raw = plan?.discount
    if (!full || !raw || typeof raw !== 'object') return null
    const price = Number(raw.price)
    const percent = Math.floor(Number(raw.percent))
    if (!(price > 0 && price < full) || !(percent >= 1) || typeof raw.until !== 'string') return null
    return { price, regular: full, percent, until: raw.until }
  }
  /** What a plan costs today. */
  const price = (plan: any): number => discount(plan)?.price ?? regular(plan)
  /** "31 Oct", "31-oktabr", "31 октября" in the page's language. */
  const day = (iso: string) => dayLabel(iso, locale.value)
  /** "until 31 Oct", "31-oktabrgacha", "до 31 октября", in the page's language. */
  const untilLabel = (item: PlanDiscount) => t('discountUntil', { date: day(item.until) })
  /** The plans on discount right now, with their discounts. */
  const active = computed<DiscountedPlan[]>(() =>
    (ws.plans.value || [])
      .map((plan: any) => ({ plan, discount: discount(plan) }))
      .filter((row): row is DiscountedPlan => !!row.discount),
  )
  return { figure, money, regular, discount, price, dayLabel: day, untilLabel, active }
}
