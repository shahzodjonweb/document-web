# Uzbek copy: glossary and style

All Uzbek in `locales/*.ts` and `content/site/faq.ts` was rewritten on 2026-11-28 by a native-copywriter pass
(1,249 of 3,050 strings), because the earlier text read as a word-for-word translation of the English.
Write new Uzbek to this page so the app, the Mini App, the website and the FAQ keep using the same words.
`npm run check:catalog` enforces the orthography (Latin only, ‘ for o‘/g‘, ʼ for the tutuq belgisi).

## 1. Terms

| Concept | Use | Avoid |
|---|---|---|
| upload (process) | fayl yuklash, «Fayl yuklanmoqda…» | yuklab olish (that means download) |
| upload button | Fayl tanlash / Fayl qo‘shish | Yuklash (alone, ambiguous) |
| download | yuklab olish, «Yuklab olish» | yuklash, ko‘chirib olish, skachat |
| load (page/list) | yuklanmoqda, «Sahifa yuklanmadi» | yuklab bo‘lmadi (reads as download) |
| task / job (one run) | amal: «Yangi amal», «Amalni bajarib bo‘lmadi» | vazifa, ish, operatsiya |
| file task (the limit) | fayl amali: «Haftasiga 10 ta fayl amali» | fayl vazifasi |
| task list page | «Tarix» (nav tab and «Tarix» bo‘limi) | Vazifalar, Vazifa tarixi |
| tool | vosita, «Barcha vositalar» | asbob, instrument, funksiya |
| workspace / signed-in area | kabinet, «Shaxsiy kabinet», «Kabinetga kirish» | ish maydoni |
| account | hisob | akkaunt, profil (profil = the profile screen only) |
| sign in / out / up | kirish, kiring / chiqish / ro‘yxatdan o‘tish | tizimga kirish, avtorizatsiya, hisob yaratish |
| Continue with Google | Google orqali kirish | Google orqali davom etish |
| connect (account) | ulash: «Telegramni ulash» | bog‘lash, birlashtirish |
| share | ulashish: «Telegramda ulashish» | bo‘lishish |
| plan | tarif: Free tarifi, Plus tarifi, Premium tarifi | reja (reja = document outline!), obuna |
| weekly limit | haftalik limit; «Limit tugadi», «dushanba kuni yangilanadi» | kvota, ruxsat etilgan miqdor, cheklov |
| unlimited | cheksiz; «haftalik limit yo‘q» | limitsiz |
| AI document | AI hujjat (pl. AI hujjatlar) | SI hujjat, sunʼiy intellekt hujjati |
| presentation (whole deck) | taqdimot: «Taqdimot yaratish» | prezentatsiya, slaydlar to‘plami |
| one slide | slayd: «10 ta slayd» | — |
| CV | rezyume; tool name «CV (rezyume)» | — |
| title page | titul varag‘i (short: titul) | sarlavha sahifasi, muqova |
| outline | reja | konspekt (that is a separate document type) |
| describe (a prompt) | yozing / yozib bering; noun: tavsif | tasvirlang, tasvirlab bering |
| edit (verb) / AI edit (count) | tahrirlash / AI tahrir: «3 ta AI tahrir» | redaktsiya |
| change (plain request) | o‘zgartirish | modifikatsiya |
| editor | PDF muharriri, slayd muharriri | redaktor, tahrirlagich |
| result | natija; warmer: tayyor fayl | chiqish fayli, output |
| retry | button «Qayta urinish»; text «Qayta urinib ko‘ring.» | Qayta urining |
| settings | Sozlamalar (also tool options) | parametrlar, opsiyalar |
| delete / remove | o‘chirish (gone) / olib tashlash (off the list) | yo‘q qilish |
| convert | PDFga aylantirish; tool names with an arrow: «Word → PDF», «PDF → rasmlar» | o‘girish, konvertatsiya, Word’dan PDF |
| rotate / split / extract | burish / bo‘lish / ajratib olish | aylantirish (= convert here) |
| compress | siqish; tool name «PDF hajmini kamaytirish» | optimallashtirish |
| receipt / card transfer | chek / kartaga pul o‘tkazish | kvitansiya |
| image file / photo | rasm / surat (camera photo) | tasvir |
| website | sayt | veb-sayt, veb ilova, platforma |
| Telegram bot | bot: «botga yuboring», «botda» | Telegram bot ga |
| Telegram Mini App | mini-ilova; first mention «Telegramdagi mini-ilova» | Mini App da, Mini App sifatida |
| dark/light theme | Qorong‘i rejim / Yorug‘ rejim | qorong‘i mavzu (mavzu = topic) |
| portrait / landscape | Tik / Yotiq | Portret / Albom |
| unavailable | hozircha yo‘q / ishlamayapti / …ib bo‘lmadi | mavjud emas |

Screen names in running text go in « » with a noun: «Tarif va to‘lov» bo‘limi, «Sozlamalar» bo‘limida, «To‘lash» tugmasi.

## 2. Buttons and labels
- Buttons, tabs, menu items: verbal noun (-ish): «Yuklab olish», «Saqlash», «Bekor qilish», «Davom etish», «Sinab ko‘rish».
- Hints, errors and instructions: polite imperative (-ing): «Fayl qo‘shing», «Tarif tanlang», «Qayta urinib ko‘ring».
- No -ni on a generic object in a button: «Hujjat yaratish», «Fayl qo‘shish». Use -ni only for one specific known thing: «Faylni o‘chirish», «Parolni o‘zgartirish».
- Cut words the screen already says: «Vazifani bekor qilish» → «Bekor qilish», «Qayta ishlashni boshlash» → «Boshlash».
- Status chips: past or present-continuous: Navbatda, Jarayonda, Tayyor, Xatolik, Bekor qilindi, Muddati tugagan, O‘zgarishsiz.
- A label followed by a date in code ends with a colon: «Limitlar yangilanadi:», «Muddati:».
- FAQ questions sound spoken: «Qanday to‘layman?», «Telegramda ishlaydimi?», «…qilsa bo‘ladimi?».

## 3. Suffixes on names, codes and numbers
- Attach directly, no space, no apostrophe, no hyphen: Telegramda, Telegramga, Telegramdagi, PDFga, PDFni, PDFdan, Excelga, {brand}da, {brand}ning, 20 MBgacha, 200 MBdan.
- ʼ is a letter (maʼlumot, sunʼiy, eʼlon, taʼlim, suiisteʼmol), never a separator: not Telegramʼda, PDFʼga, Premium’da.
- Never split a suffix off: not «PDF ga», «Word ni», «PDF lar», «20 MB lik».
- When a Latin name looks odd with a suffix, add a noun: «Word fayl(ni)», «PDF fayllar», «Google hisobi», «Payme ilovasi», «PowerPoint taqdimot».
- Numbers: «{count} ta fayl» (noun singular, never «ta fayllar»); «{date}gacha», «{day}dan», «{cap} tagacha»; ordinals with a hyphen: 9-sinf, 2-bo‘lim, 1-dekabr; ranges with an en dash: 8–20 sahifa; thousands with a space: 1 000.
- After «Cheksiz» or a number, keep the noun singular: «{count} AI hujjat», not «{count} AI hujjatlar».

## 4. Weird patterns found and how to fix them
1. «mavjud emas» for unavailable. «Google orqali kirish hali mavjud emas.» → «Google orqali kirish hozircha yo‘q.»
2. «… orqali davom etish» for Continue with. «Telegram orqali davom etish» → «Telegram orqali kirish».
3. «vazifa» for a job. «Vazifani yakunlab bo‘lmadi.» → «Amalni bajarib bo‘lmadi.»
4. «ish maydoni» for workspace. «Ish maydonini ochish» → «Kabinetga kirish».
5. Double possessive. «Sizning tarifingiz» → «Tarifingiz».
6. Literal idioms. «Nimadir xato ketdi» → «Xatolik yuz berdi»; «Oddiy tariflar» (Simple plans) → «Tushunarli tariflar»; «noyob parol» → «boshqa joyda ishlatilmagan parol».
7. Word-for-word noun phrases. «Maxfiy, vaqtinchalik qayta ishlash» → «Fayllar maxfiy va vaqtincha saqlanadi»; «Ko‘rinadigan ism» → «Ismingiz».
8. «tasvirlash» for describe. «O‘zingiz tasvirlab bering» → «O‘zingiz yozib bering».
9. Apostrophe and spaced suffixes. «Telegram’da», «PDF ga», «Word’dan PDF» → «Telegramda», «PDFga», «Word → PDF».
10. English word order. «Har bir tanlangan sahifa» → «Tanlangan har bir sahifa»; «Hisob yaratish» → «Ro‘yxatdan o‘tish».
11. Wrong meaning. «A fresh start» (empty list) was «Hammasi tayyor» (= all done) → «Hozircha bo‘sh.» Read the English, not only the old Uzbek.
12. «mavzu» for a UI theme, «Kiritilgan» for Included. «Qorong‘i mavzuga o‘tish» → «Qorong‘i rejimga o‘tish»; «Kiritilgan» → «Tarifda bor».

## 5. Terms settled in the rest of the app
| Concept | Use |
|---|---|
| title slide | Titul slaydi |
| slide layout | Ko‘rinish (Slayd ko‘rinishlari) |
| deck design | Dizayn |
| speaker notes (deck editor) | Eslatmalar |
| agenda slide / timeline / section divider | Reja / Xronologiya / Bo‘lim boshi |
| density | Zich / O‘rtacha / Keng |
| PDF form | forma (shakl is a drawn shape) |
| highlight | Belgilash |
| black-out box | bo‘yalgan joy; redact = yashirish |
| undo / redo / restore | Bekor qilish / Qaytarish / Tiklash |
| page X of Y | Sahifa {page} / {count} |
| keyboard shortcuts | Tezkor tugmalar |
| margins | hoshiya |
| waiting for review (payment) | Tekshiruvda |
| unchanged result | O‘zgarishsiz |

The public site keeps search words in tool names and headings (PDF siqish, PDFni Wordga o‘tkazish), while the
app's tool names use the short forms (PDF hajmini kamaytirish, Word → PDF).

Retention sentences are checked by `tests/retention-claims.mjs`: a sentence that says files go after 24 hours
must name its scope (vositalardagi fayllar, tayyor fayl, o‘zimizdagi nusxalar) or the AI document's exception
in the same sentence. Don't split such a sentence in two.

## 6. Notes
- The Telegram bot (document-platform `telegram/ux_copy.py`) is not in this pass. It still says «vazifa», «fayl vazifalari», «veb ilova» and uses «aylantirish» for rotate. Tell the owner, but follow this glossary in the web chunks.
- The plan names Free, Plus and Premium stay in Latin. Write prices with a space for thousands: 132 000 so‘m.
