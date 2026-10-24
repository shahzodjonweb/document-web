import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import dictionaries from '../locales/catalog.ts'
import {SLIDE_LAYOUTS,SLIDE_LAYOUT_GROUPS} from '../app/composables/useSlideLayouts.ts'
import {linkedinLinkOnly,cvFactTicks,warmCvFactTicks,CV_FACTS_FALLBACK} from '../app/composables/useCvSources.ts'
import {promptExamples} from '../locales/extended.ts'
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
// What a CV needs is ticked while it is typed, as the server reads it
// (apps/studio/cv/content.py name_in and facts): a full name, a phone number or
// an email, a job or an education entry. useCvSources.ts is a port of the
// server's detectors, so the ticks are held to the server's own answers below;
// these rows say in a few words what each rule is for.
const ticks=text=>{const found=cvFactTicks(text);return[found.name,found.contact,found.background]}
const ALL=[true,true,true]
const NONE=[false,false,false]
const cvTexts=[...['en','uz','ru'].map(locale=>['placeholder',dictionaries[locale].studioCvPlaceholder]),
 ...promptExamples['ai.cv'].flatMap((row,index)=>row.map((text,at)=>[`example ${index+1} in ${['en','uz','ru'][at]}`,text]))]
for(const[label,text]of cvTexts)assert.deepEqual(ticks(text),ALL,`ticks all three: ${label}`)
for(const[text,expected]of[
 // Names: on a line of their own, before a comma, after an introduction or a label, with a patronymic or a title.
 ['Dilnoza Rahimova',[true,false,false]],['Меня зовут Иван Петров, инженер',[true,false,false]],
 ['Kamolov Farrux Shavkat o‘g‘li',[true,false,false]],['Dr. Anvar Usmonov',[true,false,false]],
 ['Mening ismim Dilnoza Karimova',[true,false,false]],['Name: Dilnoza Karimova',[true,false,false]],
 ['Karimova Dilnoza 1996-yilda tug‘ilganman',[true,false,false]],['Шарипов Тимур 28 лет, водитель',[true,false,false]],
 // An O‘ or a G‘ typed with any apostrophe; a first name and a surname given apart; a surname that begins like a city.
 ["G'ayrat Karimov, haydovchi",[true,false,false]],['O‘tkir Aliyev — Python dasturchi',[true,false,false]],
 ["Bobur O'rinov",[true,false,false]],['Ibrohim G’ulomov',[true,false,false]],
 ['Ism: Dilnoza\nFamiliya: Karimova',[true,false,false]],['Ismim Jasur, familiyam Aliyev, dasturchiman',[true,false,false]],
 ['Full name Dilnoza Karimova',[true,false,false]],['Qarshiyev Anvar',[true,false,false]],['Москвин Сергей Иванович',[true,false,false]],
 // Not names: a heading, a title, a company, a greeting, a sentence, two spaces between the words (as the server reads them).
 ['Hello',NONE],['Assalomu alaykum',NONE],['WORK EXPERIENCE\nEDUCATION',NONE],['Company name: Example Retail',NONE],
 ['Xalq Banki, Kassir',NONE],['Dilnoza  Karimova',NONE],
 // Contacts: an email, a plus number, a long number, a short one after the word for a phone.
 ['dilnoza@example.com',[false,true,false]],['+998 90 123 45 67',[false,true,false]],['(90) 123-45-67',[false,true,false]],
 ['tel 1234567',[false,true,false]],['phone: 123 45 67',[false,true,false]],['Тел. 123-45-67',[false,true,false]],
 ['Raqam: 123 45 67',[false,true,false]],['Tel-901234567',[false,true,false]],
 // Not contacts: dates, a document's or a tax number, a price, a handle, digits in a link, a word that holds "tel".
 ['Born 12.05.1996',NONE],['2015-2019',NONE],['passport AB1234567',NONE],['JSHSHIR 12345678901234',NONE],
 ['паспорт 4510 123456',NONE],["Expected salary 3 500 000 - 5 000 000 so'm",NONE],['@dilnoza_r',NONE],
 ['linkedin.com/in/dilnoza-123456789',NONE],['Hotel 123 45 67',NONE],
 // Backgrounds: a job with its years or a period, a start, a length of service, a school with its year or said alone.
 ['03.2021 - 06.2024 marketing',[false,false,true]],['2019-2022 Bahor Foods',[false,false,true]],
 ['Bahor Foods 2021 - hozirgacha',[false,false,true]],['2 years as a cashier at Bahor Foods',[false,false,true]],
 ['5 лет опыта',[false,false,true]],['5+ years of experience as a data analyst',[false,false,true]],
 ['I am an accountant with five years of experience in a bank.',[false,false,true]],['10-летний опыт работы в продажах',[false,false,true]],
 ['3 yildan beri taksi haydovchisiman',[false,false,true]],['freelance video editing since 2019',[false,false,true]],
 ['с 2018 года занимаюсь ремонтом',[false,false,true]],['Samira Yusupova, 25 yoshda, 2022-yildan beri menejer',[true,false,true]],
 ['окончил ТУИТ в 2020',[false,false,true]],['Universitetida oʻqiganman',[false,false,true]],
 ['TDIU, marketing yo‘nalishi, 2018-yilda bitirganman',[false,false,true]],['Teacher at School 12, 2019–2024',[false,false,true]],
 ["Oliy ma'lumotli",[false,false,true]],['Высшее образование',[false,false,true]],['Universitetni tamomlaganman',[false,false,true]],
 // Not backgrounds: the job wanted, no experience, a driving licence, a heading, a birth year, an age, a time ago.
 ['Applying for a teacher job at a school',NONE],['IT kompaniyasida ishlashni xohlayman',NONE],
 ['Анна Смирнова, 22 года. Хочу работать менеджером.',[true,false,false]],['Looking for a manager job in 2025',NONE],
 ['Опыта работы нет',NONE],["I have a driver's license since 2015",NONE],['Haydovchilik guvohnomasi 2018-yildan',NONE],
 ['Education:\nSkills: Excel',NONE],['Born 1996. I am 28 years old, an accountant',NONE],['28 years old accountant',NONE],
 ['Сергей Ким, 1985 г.р., менеджер',[true,false,false]],['Менеджер, ДР 1996',NONE],['Мне 25 лет',NONE],
 ['2 yil oldin Toshkentga ko‘chdim',NONE],['Kitob o‘qiyman',NONE],
 // Nor a time lived somewhere, a marriage, a state of life or a course's time; an age in лет beside a job, or in years
 // alone in its clause; a course or a project finished; a year dreamed of. A greeting is no name.
 ['Алёна Крылова, 10 лет прожила в Москве, вернулась в 2020',[true,false,false]],['Иван Петров, женат уже 7 лет на учительнице',[true,false,false]],
 ['Ирина Гусева, 5 лет в декрете, ищу работу',[true,false,false]],['С 2020 года в декрете',NONE],['Dilnoza Karimova, 5 yildan beri nafaqadaman',[true,false,false]],
 ['Тимур Шарипов, курсы английского 6 месяцев',[true,false,false]],['Ingliz tili kursi, 2021-2022',NONE],['Took a barista course in 2023',NONE],
 ['Елена Ковалёва, 45 лет, работала продавцом',[true,false,false]],['Ivan Petrov, 30 years, driver',[true,false,false]],
 ['Иван Петров, 25 лет, в поиске работы',[true,false,false]],['Юлия Николаева, окончила курсы 1С в 2020 году',[true,false,false]],
 ['Павел Орлов, в 2021 году закончил проект по ремонту квартиры',[true,false,false]],['Ishni bitirdim',NONE],
 ['Feruza Nurmatova, mening orzuyim 2026-yilda bank xodimi bo‘lish',[true,false,false]],['My dream is to work at a bank',NONE],
 ['Loyiha: onlayn do‘kon sayti, 2022-yilda',NONE],['Good Morning',NONE],['Добрый День',NONE],['Hayrli Kun',NONE],
 // And still one: a length under its label, with a +, served; a graduation, a school finished; a name after a greeting.
 ['Стаж:\n20 лет',[false,false,true]],['Driver, 20+ years',[false,false,true]],['Служил в армии 2 года',[false,false,true]],
 ['graduated in 2020',[false,false,true]],['Maktabni yakunladim',[false,false,true]],['Good Morning\nDilnoza Karimova',[true,false,false]],
 // A name before "!", an emoji, a + phone, an email or (first line) a job in lower case; after greeting or request
 // sentences or a CV label. Not a place's job, someone's job, a job title after a label, a run of fillers.
 ['Aziz Karimov!',[true,false,false]],['Madina Sultanova 👩‍💼',[true,false,false]],['Dilnoza Karimova +998 90 123 45 67',[true,true,false]],
 ['Dilnoza Karimova dilnoza@example.com',[true,true,false]],['Aziz Karimov kassir 2019-2022',[true,false,true]],
 ['Добрый день, нужно резюме. Шерзод Мирзаев, кассир',[true,false,false]],['Xayrli kun! Rezyume uchun: Zuhra Islomova',[true,false,false]],
 ['Me: Ziyoda Rahmonova',[true,false,false]],['CV for Laziz Umarov please',[true,false,false]],['Резюме: Лола Назарова',[true,false,false]],
 ['Uzum Marketda menejer',NONE],['Yandex Go haydovchisi',NONE],['CV: Full Stack Developer',NONE],['Nima Gap',NONE],['Как Дела',NONE],
 ['Test Test',NONE],['Пока-Пока',NONE],
 // The day the person can start is a wish; a hobby's length or start is the hobby's; teaching on a course is a job.
 ['available from 01.11.2025',NONE],['Ready to start from November 2025',NONE],['Готова выйти на работу с 01.11.2025',NONE],
 ['01.11.2025 dan boshlab ishlay olaman',NONE],['Hobby: chess for 10 years',NONE],["sevimli mashg'ulotim futbol, 2010-yildan beri o'ynayman",NONE],
 ['Увлекаюсь фотографией с 2018 года',NONE],['Hobbim futbol, 2015-yildan beri Artelda ishlayman',[false,false,true]],
 ['Хобби — рыбалка, водитель с 2015 года',[false,false,true]],['Преподаватель курсов английского, 5 лет',[false,false,true]],
 ['Ingliz tili kursida o‘qituvchi, 3 yil',[false,false,true]],['Курсы английского, 5 лет',NONE],
 // Distances are counted as the server counts them: an emoji is one character, so this year is still the birth's.
 ["tug'ilganman 😀😀😀😀😀😀😀😀😀😀😀😀 1998, kassir",NONE],
 // All of it, and nothing.
 ['Dilnoza Rahimova, +998 90 111 22 33\nTeacher at School 12, 2019–2024',ALL],['',NONE],['   \n',NONE],
])assert.deepEqual(ticks(text),expected,`ticks ${JSON.stringify(text)}`)
// The server's own answers: contracts/cv_fact_cases.json of document-platform,
// copied here. To refresh it after the server's detectors or cases change, run
//   cd document-platform && .venv/bin/python manage.py export_cv_fact_cases
//   cp contracts/cv_fact_cases.json ../document-web/tests/fixtures/cv-fact-cases.json
// (the platform's env as in its tests: DEBUG=1 DEVELOPMENT_LOGIN_ENABLED=1
// ENABLE_BETA_TOOLS=1 LOCAL_SYNC_JOBS=1). A tick where the server finds the
// fact missing is never allowed: the customer would see it ticked and then be
// refused. A fact the server finds and the form does not tick is allowed only
// by name below, with the reason, and only a few (under 3% of the cases).
const cvCaseFile=await fs.readFile(new URL('./fixtures/cv-fact-cases.json',import.meta.url),'utf8')
const cvCases=JSON.parse(cvCaseFile)
const WITHHELD=[
 // ['the text exactly as in the fixture','name' | 'contact' | 'background','why the form does not tick it'],
]
assert.ok(cvCases.length>=900,'the parity cases are all there')
assert.ok(WITHHELD.length<cvCases.length*0.03,'fewer than 3% of the cases are allowed to differ')
const withheldNow=new Set()
for(const row of cvCases){
 const found=cvFactTicks(row.text)
 for(const fact of['name','contact','background']){
  assert.ok(!found[fact]||row[fact],`${fact} is ticked where the server finds none: ${JSON.stringify(row.text)}`)
  if(row[fact]&&!found[fact]){
   withheldNow.add(`${fact}\u0000${row.text}`)
   assert.ok(WITHHELD.some(([text,key])=>text===row.text&&key===fact),`${fact} is not ticked where the server finds it: ${JSON.stringify(row.text)}`)
  }
 }
}
for(const[text,fact]of WITHHELD)assert.ok(withheldNow.has(`${fact}\u0000${text}`),`allowed to differ but no longer does, take it off: ${fact} ${JSON.stringify(text)}`)
// When the platform is checked out beside this repo, a fixture behind the server's export is said.
const platformCases=await fs.readFile(new URL('../../document-platform/contracts/cv_fact_cases.json',import.meta.url),'utf8').catch(()=>null)
if(platformCases!==null&&platformCases!==cvCaseFile)
 console.warn('tests/fixtures/cv-fact-cases.json differs from ../document-platform/contracts/cv_fact_cases.json: copy it again (see above)')
// The examples a refusal gives, in each language, satisfy their own fact; the
// copy that names the facts is complete, in the same placeholders, and as the
// owner's rules say (Latin-only Uzbek with ‘ and ʼ, no angle brackets or ampersands).
const factKey=key=>`studioCvFact${key[0].toUpperCase()}${key.slice(1)}`
for(const key of[...CV_FACTS_FALLBACK.required,...CV_FACTS_FALLBACK.optional])assert.ok(dictionaries.en[factKey(key)],`${factKey(key)} is named`)
for(const[key,at]of[['name',0],['contact',1],['background',2]])
 for(const locale of['en','uz','ru']){
  const example=dictionaries[locale][`${factKey(key)}Example`]
  assert.equal(ticks(example)[at],true,`${locale} ${key} example gives its own fact: ${example}`)
 }
const needCopy=keys.filter(key=>/^studioCv(Needs|Fact|MissingLead|CanAdd)/.test(key))
assert.equal(needCopy.length,23,'the copy for what a CV needs is there: eight lines, twelve facts, three examples')
const placeholders=text=>[...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort().join()
for(const key of needCopy){
 for(const locale of['en','uz','ru']){
  const text=dictionaries[locale][key]
  assert.equal(placeholders(text),placeholders(dictionaries.en[key]),`${locale} ${key} keeps the placeholders`)
  assert.doesNotMatch(text,/[<>&]/,`${locale} ${key} has no angle bracket or ampersand`)
 }
 assert.doesNotMatch(dictionaries.en[key],/[Ѐ-ӿ]/,`en ${key} has no Cyrillic`)
 assert.doesNotMatch(dictionaries.uz[key],/[Ѐ-ӿ]|['’ʻ`]/,`uz ${key} is Latin, with ‘ and ʼ only`)
 assert.match(dictionaries.ru[key],/[Ѐ-ӿ]|^[A-Za-z0-9+@. –—;,-]+$/,`ru ${key} is Russian`)
}
assert.equal(placeholders(dictionaries.en.studioCvNeedsOptional),'facts')
// Typed in the form, on a description at its longest: never slow. The
// patterns are compiled first, as the Studio does while the page is idle
// (warmCvFactTicks); then each shape is read in time that grows with its
// length, not its square (a run of Cyrillic letters before an @ once took 2 s).
// About 9 ms is the slowest here; a shared CI runner is given more room.
while(warmCvFactTicks());
const CV_LIMIT=12000
const fill=(head,unit,tail='x')=>head+unit.repeat(Math.floor((CV_LIMIT-head.length-tail.length)/unit.length))+tail
const hostile=['Men '.repeat(3000),'2019 '.repeat(2400),'universitet '.repeat(1000),'a'.repeat(CV_LIMIT),'1 '.repeat(6000),'a@'.repeat(6000),
 'Aa Bb, '.repeat(1700),'я'.repeat(CV_LIMIT-1)+'@','я'.repeat(CV_LIMIT-10)+' a@b','中'.repeat(CV_LIMIT-1)+'@','я'+'a'.repeat(CV_LIMIT-2)+'@',
 fill('5',' '),fill('5','\n'),fill('Dilnoza Karimova',' '),fill('образование',' -'),fill('опыт','\n'),fill('Ism',' \t'),
 fill('','5 лет '),fill('','в банке 5 лет '),fill('ищу ','работу '),fill('','pasport raqami '),fill('','+998 90 123 45 67 '),
 fill('1',' 000'," so'm"),fill('','2019-2022 '),fill('','2019 yildan beri '),fill('','looking for '),fill('',"O'tkir G'ayrat "),
 'A'+'ʻ'.repeat(CV_LIMIT-2)+'1','A'+'aʻ'.repeat(CV_LIMIT/2-1)+'1',fill('','😀1 '),fill('','01.09.18 '),fill('',"tug'ilgan 2019 "),
 // Each length, date and graduation read in its clause: a course's, a marriage's, a state of life's, a dream's, an age's.
 fill('','курсы 6 месяцев, '),fill('','kurs 2019 '),fill('','5 лет в декрете '),fill('','женат 7 лет, '),fill('','orzuyim 2026 '),
 fill('','окончил курсы, '),fill('','bitirdim ishni '),fill('','Стаж:\n20 лет\n'),fill('','Стаж:\n'),fill('','30 years, '),
 fill('','loyiha 2022 ishladim '),fill('','my dream is to work '),
 // A name's endings, the sentences before it and a CV's label: a run of stops is read once, not from each stop.
 '.'.repeat(CV_LIMIT),'!'.repeat(CV_LIMIT-1)+'x',fill('','Добрый день, нужно резюме. '),fill('','Salam Salam. '),fill('','CV: Aa '),
 fill('','CV for Aa Bb Cc Dd Ee '),fill('Aziz Karimov','🙂'),fill('Aziz Karimov ','a.')+'@',fill('','hobbi, 2015-yildan beri '),
 fill('','available from 2025 '),fill('','Преподаватель курсов, 5 лет, ')]
const slowest=Math.max(...hostile.map(text=>Math.min(...[0,1,2].map(()=>{const started=performance.now();cvFactTicks(text);return performance.now()-started}))))
assert.ok(slowest<(process.env.CI?60:20),`a 12,000-character description is read in under 20 ms (the slowest took ${slowest.toFixed(1)} ms)`)
console.log(`Pass: ${keys.length} keys × 3 complete locales; public schema SHA-256 verified; no staff routes; ${SLIDE_LAYOUTS.length} slide layouts match the contract; ${linkOnly.length+sent.length} CV LinkedIn descriptions; ${cvTexts.length} CV briefs tick every required fact; ${cvCases.length} CV fact cases read as the server reads them (slowest ${slowest.toFixed(1)} ms)`)
