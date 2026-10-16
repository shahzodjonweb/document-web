import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import dictionaries from '../locales/catalog.ts'
import {SLIDE_LAYOUTS,SLIDE_LAYOUT_GROUPS} from '../app/composables/useSlideLayouts.ts'
const keys=Object.keys(dictionaries.en).sort()
for(const locale of ['uz','ru']){
 assert.deepEqual(Object.keys(dictionaries[locale]).sort(),keys,`${locale} translation parity`)
 assert.ok(Object.values(dictionaries[locale]).every(value=>typeof value==='string'&&value.trim()))
}
assert.match(dictionaries.uz['pdf.merge.description'],/[‘’]/)
assert.match(dictionaries.ru['pdf.merge.name'],/[А-Яа-я]/)
// Russian says ИИ, never the Latin AI (the landing headline once did).
for(const [key,value] of Object.entries(dictionaries.ru))assert.doesNotMatch(value,/\bAI\b/,`ru ${key} says ИИ, not AI`)
// Plans differ only in the weekly limits, the prices and Premium's channels.
// A plan's subtitle speaks of weekly volume: nothing that reads as more tools,
// more capability or bigger documents.
const planBodies=['planFreeBody','planPlusBody','planPremiumBody']
const featureWords={en:/essential|room|feature|capabilit|larger|bigger|size|basic/i,uz:/imkoniyat|hajm|katta|muhim|asosiy/i,ru:/возможност|объём|объем|больш(их|ие) (файл|документ)|основн|базов/i}
for(const locale of ['en','uz','ru'])for(const key of planBodies)
 assert.doesNotMatch(dictionaries[locale][key],featureWords[locale],`${locale} ${key} speaks of weekly volume only`)
const weekWord={en:/week/i,uz:/hafta/i,ru:/недел/i}
for(const locale of ['en','uz','ru'])for(const key of ['planFreeBody','planPlusBody'])
 assert.match(dictionaries[locale][key],weekWord[locale],`${locale} ${key} names the week`)
// The help answer lists everything that differs, Premium's channels included.
const channelWord={en:/channel subscription/i,uz:/kanallarga obuna/i,ru:/подписка на каналы/i}
for(const locale of ['en','uz','ru'])
 assert.match(dictionaries[locale].helpBillingBody,channelWord[locale],`${locale} helpBillingBody says Premium needs no channels`)
const schemaBytes=await fs.readFile(new URL('../generated/api/public.openapi.json',import.meta.url))
const expected=(await fs.readFile(new URL('../generated/api/public.openapi.json.sha256',import.meta.url),'utf8')).trim().split(/\s/)[0]
assert.equal(createHash('sha256').update(schemaBytes).digest('hex'),expected,'Pinned public API checksum')
const schema=JSON.parse(schemaBytes)
assert.ok(!Object.keys(schema.paths).some(path=>/ops|staff|django-admin/.test(path)),'No staff routes in public contract')
// The slide editor offers exactly the layouts the server draws: the contract's
// enum (less `auto`, which the editor offers on its own) is the server's list.
const layoutEnums=[]
JSON.stringify(schema,(key,value)=>{if(key==='layout'&&Array.isArray(value?.enum))layoutEnums.push(value.enum);return value})
assert.ok(layoutEnums.length>=2,'Slide layout enum present in the contract')
for(const values of layoutEnums){
 assert.equal(values[0],'auto','auto is the first layout')
 assert.deepEqual([...SLIDE_LAYOUTS].sort(),values.slice(1).sort(),'Web slide layouts match the contract')
}
assert.equal(new Set(SLIDE_LAYOUTS).size,SLIDE_LAYOUTS.length,'Each layout is in one group')
for(const id of ['auto',...SLIDE_LAYOUTS])assert.ok(dictionaries.en[`layout.${id}`],`layout.${id} is named`)
for(const id of SLIDE_LAYOUTS)assert.ok(dictionaries.en[`layoutHint.${id}`],`layoutHint.${id} is written`)
for(const group of Object.keys(SLIDE_LAYOUT_GROUPS))assert.ok(dictionaries.en[`layoutGroup.${group}`],`layoutGroup.${group} is named`)
console.log(`Pass: ${keys.length} keys × 3 complete locales; public schema SHA-256 verified; no staff routes; ${SLIDE_LAYOUTS.length} slide layouts match the contract`)
