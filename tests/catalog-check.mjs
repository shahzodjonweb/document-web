import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import dictionaries from '../locales/catalog.ts'
import {SLIDE_LAYOUTS,SLIDE_LAYOUT_GROUPS} from '../app/composables/useSlideLayouts.ts'
import {linkedinLinkOnly} from '../app/composables/useCvSources.ts'
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
// The discount copy keeps its placeholders in every language. Uzbek says
// "-gacha" after the day, joined to it as the affix is written after a word
// ("31-oktabrgacha"), not a word before it.
for(const [key,fields] of [['discountUntil',['date']],['discountBannerLead',['plan']],['regularPrice',[]]])
 for(const locale of ['en','uz','ru'])
  for(const field of fields)assert.ok(dictionaries[locale][key].includes(`{${field}}`),`${locale} ${key} keeps {${field}}`)
assert.equal(dictionaries.uz.discountUntil,'{date}gacha')
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
// A CV described by a LinkedIn link and no fact about the person is stopped
// before it is sent, however politely it is asked for; a fact, however short
// the description, is sent, and so is a name, which only the server takes out
// (apps/studio/cv/sources.py linkedin_link_only).
const linkOnly=['https://www.linkedin.com/in/fixture-person/','Mening LinkedIn profilim: lnkd.in/abc','Вот мой профиль: linkedin.com/pub/fixture/1/2/3',
 'Please make my CV from my profile at linkedin.com/in/fixture-person, thank you very much.',
 'Hello, here is my LinkedIn profile, please make a professional CV for me from it: https://www.linkedin.com/in/fixture-person',
 'Assalomu alaykum, mana mening LinkedIn profilim, shundan menga yaxshi rezyume qilib bering iltimos: https://www.linkedin.com/in/fixture-person',
 'Здравствуйте, вот ссылка на мой профиль в LinkedIn, сделайте, пожалуйста, из него резюме: https://www.linkedin.com/in/fixture-person']
const sent=['Ali Valiyev, SMM manager. linkedin.com/in/fixture-person','Ali Valiyev, Python developer at EPAM, Django and AWS. LinkedIn: linkedin.com/in/fixture-person',
 'Ali Valiyev, dasturchi, 3 yil tajriba, Python, Django. linkedin.com/in/fixture-person','Али Валиев, бухгалтер, опыт 5 лет, 1С. linkedin.com/in/fixture-person',
 'Ali Valiyev. Please make my CV from my profile at linkedin.com/in/fixture-person','My CV please: linkedin.com/in/fixture-person, fixture@example.com',
 'My CV please: linkedin.com/in/fixture-person +998 90 000 00 00','Make my CV, 2024: linkedin.com/in/fixture-person','linkedin.com/company/fixture','Make my CV from LinkedIn']
for(const text of linkOnly)assert.equal(linkedinLinkOnly(text),true,`stopped as a bare LinkedIn link: ${text}`)
for(const text of sent)assert.equal(linkedinLinkOnly(text),false,`sent to the server: ${text}`)
console.log(`Pass: ${keys.length} keys × 3 complete locales; public schema SHA-256 verified; no staff routes; ${SLIDE_LAYOUTS.length} slide layouts match the contract; ${linkOnly.length+sent.length} CV LinkedIn descriptions`)
