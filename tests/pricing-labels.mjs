import assert from 'node:assert/strict'
import dictionaries from '../locales/catalog.ts'
import { dayLabel, tashkentYear } from '../app/composables/usePricing.ts'

// A discount's last day is written the way the bot writes it (the platform's
// telegram/clock.day_label): "31 Oct", "31-oktabr", "31 октября", with the
// year only when it is not the current Tashkent year: "5 Jan 2027",
// "2027-yil 5-yanvar", "5 января 2027". Spelt from tables, never Intl, so no
// device prints "Sept", " г." or "M10 31".
const year = tashkentYear()
const next = year + 1
const cases = [
  ['en', '31 Oct', '5 Sep', `5 Jan ${next}`],
  ['uz', '31-oktabr', '5-sentabr', `${next}-yil 5-yanvar`],
  ['ru', '31 октября', '5 сентября', `5 января ${next}`],
]
for (const [locale, october, september, january] of cases) {
  assert.equal(dayLabel(`${year}-10-31`, locale), october, `${locale}: a day this year has no year`)
  assert.equal(dayLabel(`${year}-09-05`, locale), september, `${locale}: September is Sep, not Sept`)
  assert.equal(dayLabel(`${next}-01-05`, locale), january, `${locale}: a day in another year is dated`)
}
// Pinned to a year, so the shape is checked whatever today is.
assert.equal(dayLabel('2026-10-31', 'en', 2026), '31 Oct')
assert.equal(dayLabel('2027-01-05', 'en', 2026), '5 Jan 2027')
assert.equal(dayLabel('2027-01-05', 'uz', 2026), '2027-yil 5-yanvar')
assert.equal(dayLabel('2027-01-05', 'ru', 2026), '5 января 2027')
assert.equal(dayLabel('2026-10-31', 'en', 2027), '31 Oct 2026', 'last year is dated too')
// Through the catalog: "until 31 Oct", "31-oktabrgacha" (the affix joined to
// the day, as Uzbek writes it after a word), "до 31 октября".
const until = (locale, iso, thisYear) =>
  dictionaries[locale].discountUntil.replace('{date}', dayLabel(iso, locale, thisYear))
assert.equal(until('en', '2026-10-31', 2026), 'until 31 Oct')
assert.equal(until('uz', '2026-10-31', 2026), '31-oktabrgacha')
assert.equal(until('ru', '2026-10-31', 2026), 'до 31 октября')
assert.equal(until('en', '2027-01-05', 2026), 'until 5 Jan 2027')
assert.equal(until('uz', '2027-01-05', 2026), '2027-yil 5-yanvargacha')
assert.equal(until('ru', '2027-01-05', 2026), 'до 5 января 2027')
// An unknown language reads as English; what is not a day is shown as it came.
assert.equal(dayLabel('2026-10-31', 'xx', 2026), '31 Oct')
for (const odd of ['', '31 Oct', '2026-13-01', '2026-10-32', 'soon']) assert.equal(dayLabel(odd, 'en'), odd)
// The year is Tashkent's (UTC+5): 19:00 UTC on 31 December is already the new year there.
assert.equal(tashkentYear(Date.UTC(2026, 11, 31, 18, 59)), 2026)
assert.equal(tashkentYear(Date.UTC(2026, 11, 31, 19, 0)), 2027)
console.log(`Pass: a discount's last day in ${cases.length} languages, this year and another; the Tashkent year`)
