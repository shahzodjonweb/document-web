/**
 * The words the editor's customers never read: click, export, quote, rasterize,
 * DPI, points, encoding, in any language. Every `editor*` and `deck*` string is
 * held to it, and so is any other string the editor's own code puts on screen.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import dictionaries from '../locales/catalog.ts'

export const BANNED = {
  en: /\b(click\w*|export\w*|quote\w*|quotation|rasteri[sz]\w*|dpi|points?|encoding|encoded)\b/i,
  uz: /(klik|eksport|kotirovka|smeta|iqtibos|rastr|\bdpi\b|punkt|nuqta|kodirovka|kodlash)/i,
  ru: /(клик|экспорт|смет[аеуы]|котировк|цитат|растр|\bdpi\b|пункт|кодировк)/i,
}
// The editor's parts and the composables behind them, where a key is written out in full.
const sources = []
for (const [dir, match] of [
  ['app/components/editor', /\.vue$/],
  ['app/composables', /^useEditor|^useTelegramApp/],
]) {
  for (const name of await fs.readdir(new URL(`../${dir}/`, import.meta.url))) {
    if (match.test(name)) sources.push(await fs.readFile(new URL(`../${dir}/${name}`, import.meta.url), 'utf8'))
  }
}
const keys = new Set(Object.keys(dictionaries.en).filter((key) => /^(editor|deck)/.test(key)))
for (const source of sources) {
  for (const found of source.matchAll(/\b(?:t|count)\('([\w.]+)'/g)) {
    const key = found[1]
    if (key in dictionaries.en) keys.add(key)
    for (const form of ['one', 'few', 'many', 'other'])
      if (`${key}_${form}` in dictionaries.en) keys.add(`${key}_${form}`)
  }
  // Keys passed along as data, such as `labelKey: 'editorModePages'`.
  for (const found of source.matchAll(/Key: '([\w.]+)'/g)) if (found[1] in dictionaries.en) keys.add(found[1])
}
const broken = []
for (const locale of ['en', 'uz', 'ru']) {
  for (const key of keys) {
    const value = dictionaries[locale][key]
    // Placeholders are for the code; what they are named is nobody's to read.
    if (BANNED[locale].test(value.replace(/\{\w+\}/g, ''))) broken.push(`${locale} ${key}: ${value}`)
  }
}
assert.deepEqual(broken, [], 'Customer copy in the editor uses a banned word')
// Uzbek is Latin only: o‘ and g‘ with U+2018, the tutuq belgisi as U+02BC.
for (const key of keys) {
  const value = dictionaries.uz[key]
  assert.doesNotMatch(value, /[А-Яа-яЁё]/, `uz ${key} is Latin`)
  assert.doesNotMatch(value, /[’'`ʻ]/, `uz ${key} uses ‘ and ʼ`)
}
// The checker must itself still catch these, or it would pass by catching nothing.
assert.ok(BANNED.en.test('Export PDF') && BANNED.uz.test('144 DPI') && BANNED.ru.test('Экспорт'))
console.log(`Pass: ${keys.size} editor strings × 3 locales use no banned word`)
