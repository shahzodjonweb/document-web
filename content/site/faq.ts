// FAQ items for the public site. q/a tuples are [en, uz, ru]; answers are plain text (they feed FAQPage JSON-LD).
// `group` is the help-centre topic; `pages` are pages.json ids (plus ai-referat) that show the item.
export type FaqItem = { id: string; group: string; pages: readonly string[]; q: readonly [string, string, string]; a: readonly [string, string, string] }
export const faq = [

  // ── Home (6) ──
  {
    id: 'home-free', group: 'plans', pages: ['home', 'pricing', 'help'],
    q: ['Can I use {brand} without paying?', '{brand} dan to‘lovsiz foydalansa bo‘ladimi?', 'Можно ли пользоваться {brand} без оплаты?'],
    a: [
      'Yes, within the Free plan limits: every tool, 5 AI documents and 15 file tasks a week, and 3 AI edits per file. Free asks you to join our Telegram channels. Plus and Premium give more each week.',
      'Ha, Free tarifi doirasida: barcha vositalar, haftasiga 5 ta AI hujjat va 15 ta fayl vazifasi, har bir faylga 3 ta AI tahrir. Free tarifida Telegram kanallarimizga obuna bo‘lish kerak. Plus va Premium haftasiga ko‘proq beradi.',
      'Да, в пределах тарифа Free: все инструменты, 5 документов с ИИ и 15 задач с файлами в неделю, 3 правки с ИИ на файл. На Free нужно подписаться на наши Telegram-каналы. Plus и Premium дают больше в неделю.',
    ],
  },
  {
    id: 'home-files-safe', group: 'files', pages: ['home', 'help'],
    q: ['What happens to my files?', 'Fayllarim bilan nima bo‘ladi?', 'Что происходит с моими файлами?'],
    a: [
      'They are used only to run your task. Uploaded files and results are deleted after 24 hours, so download what you need before then. We use no analytics or advertising trackers.',
      'Ular faqat vazifangizni bajarish uchun ishlatiladi. Yuklangan fayllar va natijalar 24 soatdan keyin o‘chiriladi, shuning uchun keraklisini undan oldin yuklab oling. Biz analitika va reklama trekerlaridan foydalanmaymiz.',
      'Они используются только для вашей задачи. Загруженные файлы и результаты удаляются через 24 часа, поэтому скачайте нужное заранее. Мы не используем аналитику и рекламные трекеры.',
    ],
  },
  {
    id: 'home-languages', group: 'ai', pages: ['home', 'ai-hub', 'help'],
    q: ['Which languages does it work in?', 'Qaysi tillarda ishlaydi?', 'На каких языках работает?'],
    a: [
      'The site and the bot speak English, Uzbek and Russian. AI documents, presentations and CVs can be written in any of the three, and text recognition reads all three. Uzbek output is always in Latin script.',
      'Sayt va bot o‘zbek, rus va ingliz tillarida ishlaydi. AI hujjat, taqdimot va rezyume shu uch tilning istalganida yoziladi, matnni tanib olish ham uchala tilni o‘qiydi. O‘zbekcha natija doim lotin yozuvida.',
      'Сайт и бот работают на русском, узбекском и английском. Документы, презентации и резюме с ИИ пишутся на любом из трёх языков, распознавание текста тоже понимает все три. Узбекский текст всегда на латинице.',
    ],
  },
  {
    id: 'home-telegram-vs-web', group: 'telegram', pages: ['home', 'telegram', 'help'],
    q: ['Is the Telegram bot different from the website?', 'Telegram bot saytdan farq qiladimi?', 'Чем Telegram-бот отличается от сайта?'],
    a: [
      'It is the same account, plan and weekly limits. The bot takes files up to 20 MB; the website takes up to 200 MB and 1,000 pages per task. PDF to Word, PDF to Excel, OCR, searchable PDF and passwords are on the website only.',
      'Hisob, tarif va haftalik limitlar bir xil. Bot 20 MB gacha fayl qabul qiladi, sayt esa har bir fayl uchun 200 MB va bir vazifada 1 000 sahifagacha. PDF dan Word, PDF dan Excel, OCR, qidiriladigan PDF va parollar faqat saytda.',
      'Аккаунт, тариф и недельные лимиты одни и те же. Бот принимает файлы до 20 МБ, сайт — до 200 МБ и 1000 страниц за задачу. PDF в Word, PDF в Excel, OCR, PDF с поиском и пароли есть только на сайте.',
    ],
  },
  {
    id: 'home-pay', group: 'plans', pages: ['home', 'help'],
    q: ['How do I pay for Plus or Premium?', 'Plus yoki Premium uchun qanday to‘lanadi?', 'Как оплатить Plus или Premium?'],
    a: [
      'By card transfer from your bank app: Uzcard, Humo, Visa or Mastercard. Upload the receipt in Plan and billing. Our staff check it, then the plan starts for 30 days. It never renews on its own.',
      'Bank ilovangizdan karta orqali o‘tkazma bilan: Uzcard, Humo, Visa yoki Mastercard. Kvitansiyani «Tarif va to‘lov» bo‘limiga yuklang. Xodimlarimiz tekshirgach, tarif 30 kunga yoqiladi. U o‘z-o‘zidan uzaytirilmaydi.',
      'Переводом с карты из банковского приложения: Uzcard, Humo, Visa или Mastercard. Загрузите квитанцию в разделе «Тариф и оплата». После проверки сотрудниками тариф включается на 30 дней. Сам он не продлевается.',
    ],
  },
  {
    id: 'home-size', group: 'tools', pages: ['home', 'tools-index', 'help'],
    q: ['How big can my files be?', 'Fayl hajmi qancha bo‘lishi mumkin?', 'Какого размера могут быть файлы?'],
    a: [
      'On the website, up to 200 MB per file and 1,000 pages per task. In the Telegram bot, up to 20 MB per file. These limits are the same on every plan.',
      'Saytda har bir fayl 200 MB gacha, bir vazifada 1 000 sahifagacha. Telegram botda har bir fayl 20 MB gacha. Bu cheklovlar barcha tariflarda bir xil.',
      'На сайте — до 200 МБ на файл и до 1000 страниц за задачу. В Telegram-боте — до 20 МБ на файл. Эти ограничения одинаковы на всех тарифах.',
    ],
  },

  // ── Pricing (6) ──
  {
    id: 'pricing-renew', group: 'plans', pages: ['pricing', 'help'],
    q: ['Does my plan renew automatically?', 'Tarif avtomatik uzaytiriladimi?', 'Тариф продлевается автоматически?'],
    a: [
      'No. A paid plan lasts 30 days and nothing is charged after that. To continue, pay again for the next 30 days.',
      'Yo‘q. Pullik tarif 30 kun amal qiladi, undan keyin hech narsa yechilmaydi. Davom ettirish uchun keyingi 30 kunga yana to‘lang.',
      'Нет. Платный тариф действует 30 дней, после этого ничего не списывается. Чтобы продолжить, оплатите следующие 30 дней.',
    ],
  },
  {
    id: 'pricing-ends', group: 'plans', pages: ['pricing', 'help'],
    q: ['What happens when the 30 days end?', '30 kun tugagach nima bo‘ladi?', 'Что будет, когда 30 дней закончатся?'],
    a: [
      'Your account moves to the Free plan with its weekly limits. Nothing is deleted from your account, but remember that files are removed 24 hours after upload anyway.',
      'Hisobingiz o‘z haftalik limitlari bilan Free tarifiga o‘tadi. Hisobdan hech narsa o‘chirilmaydi, lekin fayllar baribir yuklangandan 24 soat o‘tib o‘chirilishini unutmang.',
      'Аккаунт переходит на тариф Free с его недельными лимитами. Из аккаунта ничего не удаляется, но файлы и так удаляются через 24 часа после загрузки.',
    ],
  },
  {
    id: 'pricing-approval', group: 'plans', pages: ['pricing', 'help'],
    q: ['How long does it take to switch the plan on?', 'Tarif qancha vaqtda yoqiladi?', 'Как быстро включат тариф?'],
    a: [
      'A member of staff checks every receipt by hand, and the plan starts as soon as it is approved. You see the status in Plan and billing. If it is taking long, write to support.',
      'Har bir kvitansiyani xodim qo‘lda tekshiradi, tasdiqlangach tarif darhol yoqiladi. Holatni «Tarif va to‘lov» bo‘limida ko‘rasiz. Uzoq cho‘zilsa, yordam xizmatiga yozing.',
      'Каждую квитанцию сотрудник проверяет вручную, и тариф включается сразу после подтверждения. Статус виден в разделе «Тариф и оплата». Если ждать приходится долго, напишите в поддержку.',
    ],
  },
  {
    id: 'pricing-week', group: 'plans', pages: ['pricing', 'help'],
    q: ['When do weekly limits reset?', 'Haftalik limitlar qachon yangilanadi?', 'Когда обновляются недельные лимиты?'],
    a: [
      'Every Monday at 00:00 Tashkent time, for everyone. A task counts when you start it; one that fails, is cancelled or changes nothing gives its place back.',
      'Har dushanba soat 00:00 da (Toshkent vaqti), hamma uchun bir xil. Vazifa boshlanganda hisoblanadi; xato bilan tugagan, bekor qilingan yoki hech narsani o‘zgartirmagan vazifa limitni qaytaradi.',
      'Каждый понедельник в 00:00 по Ташкенту, для всех одинаково. Задача засчитывается при запуске; если она завершилась ошибкой, отменена или ничего не изменила, лимит возвращается.',
    ],
  },
  {
    id: 'pricing-premium-speed', group: 'plans', pages: ['pricing', 'help'],
    q: ['Is Premium faster or does it have more tools?', 'Premium tezroqmi yoki vositalari ko‘pmi?', 'Premium быстрее или в нём больше функций?'],
    a: [
      'Neither. Every plan has every tool, the same file limits and the same speed. Premium removes the weekly limits and the channel requirement; that is the whole difference.',
      'Yo‘q. Har bir tarifda barcha vositalar, bir xil fayl cheklovlari va bir xil tezlik bor. Premium haftalik limitlarni va kanalga obuna talabini olib tashlaydi — farq shundan iborat.',
      'Нет. На каждом тарифе все инструменты, одинаковые ограничения на файлы и одинаковая скорость. Premium снимает недельные лимиты и требование подписки на каналы — в этом вся разница.',
    ],
  },
  {
    id: 'pricing-refund', group: 'plans', pages: ['pricing', 'help'],
    q: ['Can I get my money back?', 'Pulimni qaytarib olsam bo‘ladimi?', 'Можно ли вернуть деньги?'],
    a: [
      'Yes, in full, if you ask within 3 days of activation and haven’t run a task on the paid plan. A duplicate payment or a plan that was never switched on is always refunded. The money returns to the same card within 10 working days.',
      'Ha, faollashtirilgandan keyin 3 kun ichida so‘rasangiz va pullik tarifda vazifa bajarmagan bo‘lsangiz, to‘liq qaytariladi. Ikki marta to‘langan summa yoki yoqilmagan tarif uchun pul har doim qaytariladi. Pul 10 ish kuni ichida o‘sha kartaga tushadi.',
      'Да, полностью, если вы обратились в течение 3 дней после включения и не запускали задач на платном тарифе. Двойную оплату и тариф, который так и не включили, возвращаем всегда. Деньги приходят на ту же карту в течение 10 рабочих дней.',
    ],
  },

  // ── PDF editor (5) ──
  {
    id: 'editor-scanned', group: 'editor', pages: ['pdf-editor', 'help'],
    q: ['Can I edit text in a scanned PDF?', 'Skanerlangan PDF dagi matnni tahrirlasa bo‘ladimi?', 'Можно ли править текст в отсканированном PDF?'],
    a: [
      'A scan is a picture of a page, so there are no words to change. You can still add new text, notes and images on top. To get the text out, use OCR; to make the scan searchable, use Searchable PDF.',
      'Skaner — bu sahifaning rasmi, unda o‘zgartiriladigan so‘z yo‘q. Lekin ustiga yangi matn, izoh va rasm qo‘shish mumkin. Matnni olish uchun OCR, skanerni qidiriladigan qilish uchun «Qidiriladigan PDF» vositasidan foydalaning.',
      'Скан — это картинка страницы, в нём нет слов, которые можно изменить. Но поверх можно добавить текст, заметки и картинки. Чтобы получить текст, используйте OCR, а чтобы искать по скану — «PDF с поиском».',
    ],
  },
  {
    id: 'editor-signature-legal', group: 'editor', pages: ['pdf-editor', 'sign-pdf', 'help'],
    q: ['Is a signature image legally binding?', 'Imzo rasmi yuridik kuchga egami?', 'Имеет ли изображение подписи юридическую силу?'],
    a: [
      'The editor places a picture of your signature on the page. It is not an electronic digital signature (ERI). Whether a document signed this way is accepted depends on who receives it, so check with them.',
      'Muharrir sahifaga imzongiz rasmini qo‘yadi. Bu elektron raqamli imzo (ERI) emas. Bunday imzolangan hujjat qabul qilinishi uni oladigan tomonga bog‘liq, shuning uchun ulardan aniqlab oling.',
      'Редактор ставит на страницу изображение вашей подписи. Это не электронная цифровая подпись (ЭЦП). Примут ли такой документ, решает получатель — уточните у него.',
    ],
  },
  {
    id: 'editor-plan', group: 'editor', pages: ['pdf-editor', 'help'],
    q: ['Does the editor use my weekly limit?', 'Muharrir haftalik limitni sarflaydimi?', 'Расходует ли редактор недельный лимит?'],
    a: [
      'Editing itself doesn’t. On the Free plan, downloading the edited PDF uses one file task from your 15 a week. Plus and Premium have no weekly file-task limit.',
      'Tahrirlashning o‘zi sarflamaydi. Free tarifida tahrirlangan PDF ni yuklab olish haftalik 15 ta fayl vazifasidan birini sarflaydi. Plus va Premiumʼda haftalik fayl vazifalari cheklanmagan.',
      'Сама правка — нет. На тарифе Free скачивание отредактированного PDF расходует одну из 15 задач с файлами в неделю. На Plus и Premium недельного лимита задач нет.',
    ],
  },
  {
    id: 'editor-telegram', group: 'editor', pages: ['pdf-editor', 'telegram', 'help'],
    q: ['Does the editor work on a phone?', 'Muharrir telefonda ishlaydimi?', 'Работает ли редактор на телефоне?'],
    a: [
      'Yes. Open it in your phone’s browser, or inside Telegram as a Mini App. Both use the same account.',
      'Ha. Uni telefon brauzerida yoki Telegram ichida Mini App sifatida oching. Ikkalasida ham hisob bir xil.',
      'Да. Откройте его в браузере телефона или прямо в Telegram как мини-приложение. Аккаунт в обоих случаях один.',
    ],
  },
  {
    id: 'editor-password', group: 'editor', pages: ['pdf-editor', 'help'],
    q: ['Why won’t my PDF open in the editor?', 'Nega PDF muharrirda ochilmayapti?', 'Почему PDF не открывается в редакторе?'],
    a: [
      'Most often it has a password. Remove it first with Unlock PDF, using the password you know. A file that is not a PDF has to be converted first, for example with Word to PDF.',
      'Ko‘pincha unda parol bo‘ladi. Avval o‘zingiz bilgan parol bilan «PDF parolini olib tashlash» vositasidan foydalaning. PDF bo‘lmagan faylni avval aylantirish kerak, masalan, «Word ni PDF ga aylantirish» bilan.',
      'Чаще всего на нём пароль. Сначала снимите его инструментом «Снять пароль с PDF», зная пароль. Файл не в формате PDF сначала нужно конвертировать, например через «Word в PDF».',
    ],
  },

  // ── AI documents (5) ──
  {
    id: 'ai-docs-length', group: 'ai', pages: ['ai-documents', 'help'],
    q: ['How long can an AI document be?', 'AI hujjat qancha hajmda bo‘lishi mumkin?', 'Какого объёма может быть документ?'],
    a: [
      'Up to 35 pages. Say the length you need in your request, and check the planned sections before the document is written.',
      '35 sahifagacha. Kerakli hajmni so‘rovda yozing va hujjat yozilishidan oldin rejadagi bo‘limlarni tekshiring.',
      'До 35 страниц. Укажите нужный объём в запросе и проверьте разделы плана до того, как документ будет написан.',
    ],
  },
  {
    id: 'ai-docs-language', group: 'ai', pages: ['ai-documents', 'help'],
    q: ['Which language will my document be in?', 'Hujjat qaysi tilda bo‘ladi?', 'На каком языке будет документ?'],
    a: [
      'In the language you pick. If you don’t pick one, the language named in your request is used, then the language you wrote in, then your account settings. Uzbek is always in Latin script.',
      'Siz tanlagan tilda. Til tanlanmasa, so‘rovda aytilgan til, keyin so‘rov yozilgan til, so‘ng hisob sozlamalaridagi til olinadi. O‘zbek tili doim lotin yozuvida.',
      'На выбранном вами языке. Если язык не выбран — на языке, указанном в запросе, затем на языке самого запроса, затем на языке из настроек аккаунта. Узбекский — всегда на латинице.',
    ],
  },
  {
    id: 'ai-docs-edit', group: 'ai', pages: ['ai-documents', 'ai-hub', 'help'],
    q: ['Can I change the result?', 'Natijani o‘zgartirsa bo‘ladimi?', 'Можно ли изменить результат?'],
    a: [
      'Yes. Ask for an AI edit in plain words, such as “shorten section 2” or “add an example”. Each file gets 3 AI edits on Free, 10 on Plus and unlimited on Premium. You can also change a PDF by hand in the PDF editor.',
      'Ha. Oddiy so‘zlar bilan AI tahrir so‘rang, masalan, «2-bo‘limni qisqartir» yoki «misol qo‘sh». Har bir faylga Free tarifida 3 ta, Plus tarifida 10 ta AI tahrir beriladi, Premiumʼda cheklanmagan. PDF ni PDF muharririda qo‘lda ham o‘zgartirish mumkin.',
      'Да. Попросите правку с ИИ обычными словами: «сократи раздел 2» или «добавь пример». На один файл даётся 3 правки на Free, 10 на Plus и без лимита на Premium. PDF также можно поправить вручную в редакторе PDF.',
    ],
  },
  {
    id: 'ai-docs-stored', group: 'ai', pages: ['ai-documents', 'ai-hub', 'help'],
    q: ['Is my request stored?', 'So‘rovim saqlanadimi?', 'Хранится ли мой запрос?'],
    a: [
      'Yes, for 30 days. Your request, its outline and the result are kept so our team can check quality and stop misuse, then deleted. Requests are processed by OpenAI. Uploaded files are deleted after 24 hours.',
      'Ha, 30 kun. So‘rovingiz, uning rejasi va natija jamoamiz sifatni tekshirishi va suiisteʼmolning oldini olishi uchun saqlanadi, keyin o‘chiriladi. So‘rovlar OpenAI orqali qayta ishlanadi. Yuklangan fayllar 24 soatdan keyin o‘chiriladi.',
      'Да, 30 дней. Запрос, его план и результат хранятся, чтобы команда могла проверять качество и предотвращать злоупотребления, затем удаляются. Запросы обрабатывает OpenAI. Загруженные файлы удаляются через 24 часа.',
    ],
  },
  {
    id: 'ai-docs-count', group: 'ai', pages: ['ai-documents', 'ai-hub', 'help'],
    q: ['How many AI documents can I make a week?', 'Haftasiga nechta AI hujjat tayyorlash mumkin?', 'Сколько документов с ИИ можно сделать в неделю?'],
    a: [
      '5 on Free, 20 on Plus and unlimited on Premium. Documents, presentations and CVs all count. Planning an outline doesn’t, and a task that fails gives its place back. The week starts Monday 00:00 Tashkent time.',
      'Free tarifida 5 ta, Plus tarifida 20 ta, Premiumʼda cheklanmagan. Hujjat, taqdimot va rezyume — barchasi hisoblanadi. Reja tuzish hisoblanmaydi, xato bilan tugagan vazifa esa limitni qaytaradi. Hafta dushanba soat 00:00 da (Toshkent vaqti) boshlanadi.',
      '5 на Free, 20 на Plus и без лимита на Premium. Считаются документы, презентации и резюме. Составление плана не считается, а неудачная задача возвращает лимит. Неделя начинается в понедельник в 00:00 по Ташкенту.',
    ],
  },

  // ── Referat (6) ──
  {
    id: 'referat-what', group: 'ai', pages: ['ai-referat'],
    q: ['What exactly do I get?', 'Aynan nima olaman?', 'Что именно я получу?'],
    a: [
      'A PDF draft of up to 35 pages with a plan, introduction, main sections and conclusion, written on your topic. It is a starting point to check, rework and complete, not a finished assignment.',
      'Mavzuingiz bo‘yicha yozilgan, reja, kirish, asosiy bo‘limlar va xulosadan iborat 35 sahifagacha PDF qoralama. Bu tayyor topshiriq emas, balki tekshirib, qayta ishlab, yakunlash uchun boshlang‘ich nuqta.',
      'Черновик в PDF до 35 страниц на вашу тему: план, введение, основные главы и заключение. Это основа, которую нужно проверить, переработать и доделать, а не готовая работа.',
    ],
  },
  {
    id: 'referat-plagiarism', group: 'ai', pages: ['ai-referat'],
    q: ['Will it pass a plagiarism check?', 'Antiplagiatdan o‘tadimi?', 'Пройдёт ли проверку на антиплагиат?'],
    a: [
      'We don’t promise that, and no one honestly can. Treat the text as a draft: rewrite it in your own words, add your own thinking and follow your institution’s rules on AI help.',
      'Biz buni vaʼda qilmaymiz va hech kim halol vaʼda bera olmaydi. Matnni qoralama deb biling: o‘z so‘zlaringiz bilan qayta yozing, fikringizni qo‘shing va taʼlim muassasangizning AI yordami haqidagi qoidalariga amal qiling.',
      'Мы этого не обещаем, и честно пообещать это никто не может. Считайте текст черновиком: перепишите его своими словами, добавьте свои мысли и соблюдайте правила вашего вуза о помощи ИИ.',
    ],
  },
  {
    id: 'referat-sources', group: 'ai', pages: ['ai-referat'],
    q: ['Can it add a list of literature?', 'Adabiyotlar ro‘yxatini qo‘sha oladimi?', 'Может ли добавить список литературы?'],
    a: [
      'You can ask for one in your request. Check every item yourself before using it: AI can name books and articles that don’t exist or get details wrong.',
      'So‘rovda buni so‘rashingiz mumkin. Foydalanishdan oldin har bir manbani o‘zingiz tekshiring: AI mavjud bo‘lmagan kitob va maqolalarni keltirishi yoki tafsilotlarda adashishi mumkin.',
      'Попросите об этом в запросе. Перед использованием проверьте каждый пункт сами: ИИ может назвать несуществующие книги и статьи или ошибиться в деталях.',
    ],
  },
  {
    id: 'referat-pages', group: 'ai', pages: ['ai-referat'],
    q: ['Can I ask for 10 or 15 pages?', '10 yoki 15 sahifa so‘rasa bo‘ladimi?', 'Можно ли заказать 10 или 15 страниц?'],
    a: [
      'Yes. Write the number of pages in your request; the limit is 35. Check the plan first so the sections fit the length you need.',
      'Ha. Sahifalar sonini so‘rovda yozing, chegarasi — 35 sahifa. Bo‘limlar kerakli hajmga mos kelishi uchun avval rejani tekshiring.',
      'Да. Укажите число страниц в запросе, максимум — 35. Сначала проверьте план, чтобы главы подходили под нужный объём.',
    ],
  },
  {
    id: 'referat-title-page', group: 'ai', pages: ['ai-referat'],
    q: ['Does it make the title page?', 'Titul varag‘ini ham tayyorlaydimi?', 'Делает ли титульный лист?'],
    a: [
      'Every institution has its own title page format, so add yours after: in the PDF editor, or by converting your Word title page and merging it with the draft.',
      'Har bir taʼlim muassasasining o‘z titul varag‘i talabi bor, shuning uchun o‘zingiznikini keyin qo‘shing: PDF muharririda yoki Word dagi titul varag‘ini PDF ga aylantirib, qoralama bilan birlashtirib.',
      'У каждого вуза свои требования к титульному листу, поэтому добавьте его потом: в редакторе PDF или конвертировав титульный лист из Word и объединив его с черновиком.',
    ],
  },
  {
    id: 'referat-telegram', group: 'ai', pages: ['ai-referat', 'telegram'],
    q: ['Can I prepare a referat in Telegram?', 'Referatni Telegramʼda tayyorlasa bo‘ladimi?', 'Можно ли подготовить реферат в Telegram?'],
    a: [
      'Yes. Send your topic to the bot and you get the PDF in the chat. It uses the same account and weekly limits as the website.',
      'Ha. Mavzuni botga yuboring va PDF ni chatda olasiz. Hisob va haftalik limitlar sayt bilan bir xil.',
      'Да. Отправьте тему боту — PDF придёт в чат. Аккаунт и недельные лимиты те же, что на сайте.',
    ],
  },

  // ── AI presentations (5; ai-docs-edit is shared) ──
  {
    id: 'slides-max', group: 'ai', pages: ['ai-slides', 'help'],
    q: ['How many slides can a presentation have?', 'Taqdimotda nechta slayd bo‘lishi mumkin?', 'Сколько слайдов может быть в презентации?'],
    a: [
      'Up to 60. Say how many you need in your request, or let the topic decide.',
      '60 tagacha. Nechta kerakligini so‘rovda yozing yoki mavzuga qarab tanlanishiga qo‘yib bering.',
      'До 60. Укажите нужное число в запросе или доверьте выбор теме.',
    ],
  },
  {
    id: 'slides-format', group: 'ai', pages: ['ai-slides', 'powerpoint-to-pdf', 'help'],
    q: ['What file do I get?', 'Qanday fayl olaman?', 'Какой файл я получу?'],
    a: [
      'An editable PowerPoint file (.pptx): text stays text. If you need a PDF for printing or sending, convert it with PowerPoint to PDF.',
      'Tahrirlanadigan PowerPoint fayl (.pptx): matn matnligicha qoladi. Chop etish yoki yuborish uchun PDF kerak bo‘lsa, «Taqdimotni PDF ga o‘tkazish» vositasidan foydalaning.',
      'Редактируемый файл PowerPoint (.pptx): текст остаётся текстом. Если для печати или отправки нужен PDF, конвертируйте через «PowerPoint в PDF».',
    ],
  },
  {
    id: 'slides-images', group: 'ai', pages: ['ai-slides'],
    q: ['Where do the pictures on slides come from?', 'Slayddagi rasmlar qayerdan olinadi?', 'Откуда берутся картинки на слайдах?'],
    a: [
      'From the Pixabay stock photo library, chosen to match what the slide is about. Only search words for the pictures are sent there, not your file.',
      'Pixabay fotobankidan, slayd mavzusiga mos ravishda tanlanadi. U yerga faylingiz emas, faqat rasm qidirish uchun so‘zlar yuboriladi.',
      'Из фотобанка Pixabay — под тему слайда. Туда отправляются только слова для поиска картинок, а не ваш файл.',
    ],
  },
  {
    id: 'slides-language', group: 'ai', pages: ['ai-slides'],
    q: ['Can I make slides in Uzbek?', 'Slaydlarni o‘zbek tilida tayyorlasa bo‘ladimi?', 'Можно ли сделать слайды на узбекском?'],
    a: [
      'Yes, in Uzbek (Latin script), Russian or English. Pick the language, or name it in your request.',
      'Ha, o‘zbek (lotin yozuvida), rus yoki ingliz tilida. Tilni tanlang yoki so‘rovda yozing.',
      'Да, на узбекском (латиница), русском или английском. Выберите язык или укажите его в запросе.',
    ],
  },
  {
    id: 'slides-count', group: 'ai', pages: ['ai-slides'],
    q: ['Does a presentation use my weekly limit?', 'Taqdimot haftalik limitni sarflaydimi?', 'Расходует ли презентация недельный лимит?'],
    a: [
      'Yes, it counts as one AI document: 5 a week on Free, 20 on Plus, unlimited on Premium. AI edits are counted per file instead.',
      'Ha, u bitta AI hujjat sifatida hisoblanadi: Free tarifida haftasiga 5 ta, Plus tarifida 20 ta, Premiumʼda cheklanmagan. AI tahrirlar esa har bir fayl uchun alohida hisoblanadi.',
      'Да, она считается одним документом с ИИ: 5 в неделю на Free, 20 на Plus, без лимита на Premium. Правки с ИИ считаются отдельно для каждого файла.',
    ],
  },

  // ── AI CV (5) ──
  {
    id: 'cv-linkedin', group: 'ai', pages: ['ai-cv', 'help'],
    q: ['Can I use my LinkedIn profile?', 'LinkedIn profilimdan foydalansa bo‘ladimi?', 'Можно ли использовать профиль LinkedIn?'],
    a: [
      'Yes. Save your profile as a PDF in LinkedIn, or take screenshots, and upload them. A link alone is not enough, because the profile behind it can’t be read.',
      'Ha. Profilingizni LinkedInʼda PDF qilib saqlang yoki skrinshot oling va yuklang. Faqat havolaning o‘zi yetarli emas, chunki uning ortidagi profilni o‘qib bo‘lmaydi.',
      'Да. Сохраните профиль в LinkedIn как PDF или сделайте скриншоты и загрузите их. Одной ссылки недостаточно: профиль по ней прочитать нельзя.',
    ],
  },
  {
    id: 'cv-missing', group: 'ai', pages: ['ai-cv'],
    q: ['Why does it ask me for more details?', 'Nega qo‘shimcha maʼlumot so‘raydi?', 'Почему просит дополнительные данные?'],
    a: [
      'A CV needs your full name, a phone number or email, and at least one job or place of study. If one is missing, you are asked for it before the CV is made, so nothing is invented.',
      'Rezyumeda to‘liq ism, telefon yoki email va kamida bitta ish joyi yoki o‘qish joyi bo‘lishi kerak. Ulardan biri yetishmasa, rezyume tayyorlanishidan oldin so‘raladi — hech narsa o‘ylab topilmaydi.',
      'В резюме нужны полное имя, телефон или почта и хотя бы одно место работы или учёбы. Если чего-то нет, вас спросят до создания резюме, чтобы ничего не выдумывать.',
    ],
  },
  {
    id: 'cv-pages', group: 'ai', pages: ['ai-cv'],
    q: ['How long will my CV be?', 'Rezyume necha sahifa bo‘ladi?', 'Какого объёма будет резюме?'],
    a: [
      'One or two pages, depending on how much experience you have and the template you pick.',
      'Tajribangiz hajmi va tanlangan shablonga qarab bir yoki ikki sahifa.',
      'Одна или две страницы — в зависимости от опыта и выбранного шаблона.',
    ],
  },
  {
    id: 'cv-edit', group: 'ai', pages: ['ai-cv'],
    q: ['Can I change the CV afterwards?', 'Rezyumeni keyin o‘zgartirsa bo‘ladimi?', 'Можно ли изменить резюме потом?'],
    a: [
      'Yes. Ask for an AI edit, such as “add my English level” or “make the summary shorter”. Each file gets 3 AI edits on Free, 10 on Plus and unlimited on Premium.',
      'Ha. AI tahrir so‘rang, masalan, «ingliz tili darajamni qo‘sh» yoki «qisqacha maʼlumotni qisqartir». Har bir faylga Free tarifida 3 ta, Plus tarifida 10 ta AI tahrir, Premiumʼda cheklanmagan.',
      'Да. Попросите правку с ИИ, например «добавь уровень английского» или «сократи раздел о себе». На файл даётся 3 правки на Free, 10 на Plus и без лимита на Premium.',
    ],
  },
  {
    id: 'cv-privacy', group: 'ai', pages: ['ai-cv', 'help'],
    q: ['Who can see my CV data?', 'Rezyumedagi maʼlumotlarimni kim ko‘ra oladi?', 'Кто видит данные моего резюме?'],
    a: [
      'Your request and CV are kept 30 days for quality review. Only support staff can open them, and every opening is recorded. Uploaded files and results are deleted after 24 hours.',
      'So‘rovingiz va rezyume sifatni tekshirish uchun 30 kun saqlanadi. Ularni faqat yordam xodimlari ochishi mumkin va har bir ochish qayd etiladi. Yuklangan fayllar va natijalar 24 soatdan keyin o‘chiriladi.',
      'Запрос и резюме хранятся 30 дней для проверки качества. Открыть их могут только сотрудники поддержки, и каждое открытие записывается. Загруженные файлы и результаты удаляются через 24 часа.',
    ],
  },

  // ── Telegram (5; home-telegram-vs-web and editor-telegram are shared) ──
  {
    id: 'tg-official', group: 'telegram', pages: ['telegram', 'help'],
    q: ['Which bot is the official one?', 'Qaysi bot rasmiy?', 'Какой бот официальный?'],
    a: [
      'Only {{bot.username}}. The button on this page and the links in the app lead to it. Check the exact username before you send a file to any other bot.',
      'Faqat {{bot.username}}. Ushbu sahifadagi tugma va ilovadagi havolalar aynan unga olib boradi. Boshqa botga fayl yuborishdan oldin nomini aniq tekshiring.',
      'Только {{bot.username}}. Кнопка на этой странице и ссылки в приложении ведут именно к нему. Прежде чем отправить файл другому боту, проверьте точное имя.',
    ],
  },
  {
    id: 'tg-large', group: 'telegram', pages: ['telegram', 'help'],
    q: ['My file is over 20 MB. What now?', 'Faylim 20 MB dan katta. Nima qilish kerak?', 'Файл больше 20 МБ. Что делать?'],
    a: [
      'Telegram doesn’t let bots take bigger files. Open the website, sign in with Telegram and upload it there: up to 200 MB per file. Or make it smaller first with Compress PDF.',
      'Telegram botlarga kattaroq fayl qabul qilishga ruxsat bermaydi. Saytni oching, Telegram orqali kiring va faylni o‘sha yerga yuklang: har bir fayl 200 MB gacha. Yoki avval «PDF siqish» bilan hajmini kichraytiring.',
      'Telegram не даёт ботам принимать файлы больше. Откройте сайт, войдите через Telegram и загрузите файл там — до 200 МБ. Или сначала уменьшите его через «Сжать PDF».',
    ],
  },
  {
    id: 'tg-channel', group: 'telegram', pages: ['telegram', 'pricing', 'help'],
    q: ['Why do I have to join a channel?', 'Nega kanalga obuna bo‘lish kerak?', 'Зачем подписываться на канал?'],
    a: [
      'Joining our Telegram channels is a condition of the Free and Plus plans. The bot and the app show which channels to join. Premium doesn’t ask for it.',
      'Telegram kanallarimizga obuna bo‘lish Free va Plus tariflarining sharti. Qaysi kanallarga obuna bo‘lishni bot va ilova ko‘rsatadi. Premiumʼda bu talab yo‘q.',
      'Подписка на наши Telegram-каналы — условие тарифов Free и Plus. Бот и приложение покажут, на какие каналы подписаться. На Premium этого не требуется.',
    ],
  },
  {
    id: 'tg-same-account', group: 'account', pages: ['telegram', 'help'],
    q: ['How do I use the same account on the website?', 'Saytda o‘sha hisobdan qanday foydalanaman?', 'Как войти на сайт тем же аккаунтом?'],
    a: [
      'Choose “Sign in with Telegram” on the website. You land in the account you use in the bot, with the same plan, limits and results.',
      'Saytda «Telegram orqali kirish»ni tanlang. Botdagi hisobingizga o‘sha tarif, limitlar va natijalar bilan kirasiz.',
      'Выберите на сайте «Войти через Telegram». Вы попадёте в тот же аккаунт, что в боте, с тем же тарифом, лимитами и результатами.',
    ],
  },
  {
    id: 'tg-what', group: 'telegram', pages: ['telegram'],
    q: ['What can I do in the bot?', 'Botda nimalar qilsa bo‘ladi?', 'Что можно делать в боте?'],
    a: [
      'Merge, split, compress and rotate PDFs, turn photos into a PDF, convert Word and PowerPoint to PDF, create AI documents, presentations and CVs, and open the PDF editor as a Mini App.',
      'PDF larni birlashtirish, ajratish, siqish va burish, suratlardan PDF yasash, Word va PowerPoint ni PDF ga aylantirish, AI hujjat, taqdimot va rezyume tayyorlash hamda PDF muharririni Mini App sifatida ochish.',
      'Объединять, разделять, сжимать и поворачивать PDF, делать PDF из фото, конвертировать Word и PowerPoint в PDF, создавать документы, презентации и резюме с ИИ и открывать редактор PDF как мини-приложение.',
    ],
  },

  // ── Invite (5) ──
  {
    id: 'invite-who', group: 'invite', pages: ['invite', 'help'],
    q: ['Who counts as an invited friend?', 'Kim taklif qilingan do‘st hisoblanadi?', 'Кто считается приглашённым другом?'],
    a: [
      'Someone who opens your link within 7 days of creating a new account and then finishes a first task. People who already had an account, or who used another person’s link, don’t count.',
      'Yangi hisob ochganidan keyin 7 kun ichida havolangizni ochgan va birinchi vazifasini bajargan odam. Avval hisobi bo‘lganlar yoki boshqa birovning havolasidan foydalanganlar hisoblanmaydi.',
      'Тот, кто открыл вашу ссылку в течение 7 дней после создания нового аккаунта и выполнил первую задачу. Те, у кого аккаунт уже был или кто пришёл по чужой ссылке, не считаются.',
    ],
  },
  {
    id: 'invite-cap', group: 'invite', pages: ['invite', 'help'],
    q: ['Is there a limit on invitations?', 'Takliflar soni cheklanganmi?', 'Есть ли ограничение на приглашения?'],
    a: [
      'You can share your link with anyone. At most 5 friends are counted in a calendar month, Tashkent time. Friends above that wait and are counted next month, so none are lost.',
      'Havolani istalgan odamga yuborishingiz mumkin. Bir kalendar oyida (Toshkent vaqti) ko‘pi bilan 5 do‘st hisoblanadi. Ortiqchalari keyingi oyda hisoblanadi, hech kim yo‘qolmaydi.',
      'Ссылкой можно делиться с кем угодно. В календарный месяц (по Ташкенту) засчитываются не больше 5 друзей. Остальные будут засчитаны в следующем месяце — никто не потеряется.',
    ],
  },
  {
    id: 'invite-have-plus', group: 'invite', pages: ['invite', 'help'],
    q: ['What if I already have Plus or Premium?', 'Menda Plus yoki Premium bo‘lsa-chi?', 'А если у меня уже есть Plus или Premium?'],
    a: [
      'The reward isn’t lost. Reward months are added after your paid Plus period, and they wait for a paid Premium period to end before they start.',
      'Mukofot yo‘qolmaydi. Mukofot oylari to‘langan Plus muddatidan keyin qo‘shiladi, to‘langan Premium muddati bo‘lsa, u tugagach boshlanadi.',
      'Награда не пропадёт. Месяцы награды добавляются после оплаченного периода Plus, а при оплаченном Premium начинаются, когда он закончится.',
    ],
  },
  {
    id: 'invite-ladder', group: 'invite', pages: ['invite'],
    q: ['How do the rewards grow?', 'Mukofotlar qanday oshib boradi?', 'Как растут награды?'],
    a: [
      'The first 5 counted friends earn 1 month of Plus, the next 5 earn 2 months, the next 5 earn 3 months, and so on. A month here is 30 days.',
      'Hisoblangan dastlabki 5 do‘st uchun 1 oylik Plus tarifi, keyingi 5 do‘st uchun 2 oylik, undan keyingi 5 do‘st uchun 3 oylik va hokazo. Bu yerda bir oy — 30 kun.',
      'Первые 5 засчитанных друзей дают Plus на 1 месяц, следующие 5 — на 2 месяца, следующие — на 3 и так далее. Месяц здесь — 30 дней.',
    ],
  },
  {
    id: 'invite-money', group: 'invite', pages: ['invite'],
    q: ['Can I get the reward as money?', 'Mukofotni pul ko‘rinishida olsa bo‘ladimi?', 'Можно ли получить награду деньгами?'],
    a: [
      'No. Rewards are Plus periods only. They can’t be exchanged for money or moved to another account.',
      'Yo‘q. Mukofot faqat Plus tarifi muddati ko‘rinishida beriladi. Uni pulga almashtirib yoki boshqa hisobga o‘tkazib bo‘lmaydi.',
      'Нет. Награда — только период тарифа Plus. Её нельзя обменять на деньги или перенести на другой аккаунт.',
    ],
  },

  // ── Help: account and sign-in ──
  {
    id: 'account-sign-in', group: 'account', pages: ['help'],
    q: ['How can I sign in?', 'Qanday kirish mumkin?', 'Как войти?'],
    a: [
      'With Telegram, with Google, or with an email and a password. Sign-in is needed to run a task, so your results and limits stay with your account.',
      'Telegram, Google yoki email va parol orqali. Vazifani bajarish uchun kirish kerak — shunda natija va limitlar hisobingizda saqlanadi.',
      'Через Telegram, Google или по почте и паролю. Вход нужен, чтобы запускать задачи: так результаты и лимиты привязаны к вашему аккаунту.',
    ],
  },
  {
    id: 'account-delete', group: 'account', pages: ['help'],
    q: ['How do I delete my account?', 'Hisobimni qanday o‘chiraman?', 'Как удалить аккаунт?'],
    a: [
      'Write to support from the account you want to delete. Once it is deleted, you can no longer sign in and its files can’t be opened. Remaining records are removed when their retention periods end, as the privacy policy describes.',
      'O‘chirmoqchi bo‘lgan hisobingizdan yordam xizmatiga yozing. Hisob o‘chirilgach, unga kirib bo‘lmaydi va fayllarini ochib bo‘lmaydi. Qolgan yozuvlar maxfiylik siyosatida ko‘rsatilgan saqlash muddatlari tugagach o‘chiriladi.',
      'Напишите в поддержку из аккаунта, который хотите удалить. После удаления войти в него нельзя, а его файлы больше не открываются. Остальные записи удаляются по окончании сроков хранения, описанных в политике конфиденциальности.',
    ],
  },
  {
    id: 'account-forgot', group: 'account', pages: ['help'],
    q: ['I forgot my password. What can I do?', 'Parolimni unutdim. Nima qilay?', 'Забыл пароль. Что делать?'],
    a: [
      'If you signed up with email, choose “Forgot password?” on the sign-in page. We email you a code to set a new password. If you use Telegram or Google, you don’t need a password here.',
      'Email orqali ro‘yxatdan o‘tgan bo‘lsangiz, kirish sahifasida «Parolni unutdingizmi?» ni tanlang. Emailingizga yangi parol o‘rnatish uchun kod yuboramiz. Telegram yoki Google orqali kirsangiz, bu yerda parol kerak emas.',
      'Если вы регистрировались по почте, нажмите «Забыли пароль?» на странице входа. Мы пришлём на почту код, чтобы задать новый пароль. Если входите через Telegram или Google, пароль здесь не нужен.',
    ],
  },
  {
    id: 'account-several', group: 'account', pages: ['help'],
    q: ['Can I have several accounts?', 'Bir nechta hisob ochsa bo‘ladimi?', 'Можно ли завести несколько аккаунтов?'],
    a: [
      'Please use one. Opening extra accounts to get around weekly limits breaks the public offer and can lead to them being blocked.',
      'Iltimos, bittasidan foydalaning. Haftalik limitlarni chetlab o‘tish uchun qo‘shimcha hisob ochish ommaviy ofertani buzadi va ular bloklanishiga olib kelishi mumkin.',
      'Пожалуйста, пользуйтесь одним. Дополнительные аккаунты, чтобы обойти недельные лимиты, нарушают публичную оферту и могут быть заблокированы.',
    ],
  },
  {
    id: 'account-language', group: 'account', pages: ['help'],
    q: ['How do I change the site language?', 'Sayt tilini qanday o‘zgartiraman?', 'Как сменить язык сайта?'],
    a: [
      'Use the language switch in the header or footer. Signed in, you can also set the interface language in Settings.',
      'Sarlavha yoki pastki qismdagi til tugmasidan foydalaning. Hisobga kirgan bo‘lsangiz, interfeys tilini sozlamalarda ham o‘zgartirishingiz mumkin.',
      'Воспользуйтесь переключателем языка вверху или внизу страницы. После входа язык интерфейса можно выбрать и в настройках.',
    ],
  },

  // ── Help: files and privacy ──
  {
    id: 'files-download-later', group: 'files', pages: ['help'],
    q: ['Can I download a result again later?', 'Natijani keyinroq yana yuklab olsa bo‘ladimi?', 'Можно ли скачать результат позже?'],
    a: [
      'Yes, from your task history, for 24 hours after the task. After that the file is deleted and the task has to be run again.',
      'Ha, vazifadan keyin 24 soat davomida vazifalar tarixidan. Shundan so‘ng fayl o‘chiriladi va vazifani qaytadan bajarish kerak bo‘ladi.',
      'Да, из истории задач в течение 24 часов после выполнения. Потом файл удаляется, и задачу придётся запустить снова.',
    ],
  },
  {
    id: 'files-telegram-copies', group: 'files', pages: ['help'],
    q: ['Are files I received in Telegram deleted too?', 'Telegramʼda olgan fayllarim ham o‘chiriladimi?', 'Удаляются ли файлы, полученные в Telegram?'],
    a: [
      'We delete our copies after 24 hours. Files already in your Telegram chat or saved on your device stay there until you delete them.',
      'Biz o‘z nusxalarimizni 24 soatdan keyin o‘chiramiz. Telegram chatingizdagi yoki qurilmangizga saqlangan fayllar siz o‘chirmaguningizcha qoladi.',
      'Свои копии мы удаляем через 24 часа. Файлы, которые уже есть в вашем чате Telegram или на устройстве, остаются, пока вы их не удалите.',
    ],
  },
  {
    id: 'files-where', group: 'files', pages: ['help'],
    q: ['Where are my files stored?', 'Fayllarim qayerda saqlanadi?', 'Где хранятся мои файлы?'],
    a: [
      'In object storage run by Contabo in the European Union, for up to 24 hours. AI requests are processed by OpenAI. The privacy policy lists every service we use and why.',
      'Yevropa Ittifoqidagi Contabo obyekt omborida, ko‘pi bilan 24 soat. AI so‘rovlari OpenAI orqali qayta ishlanadi. Biz foydalanadigan barcha xizmatlar va sabablari maxfiylik siyosatida keltirilgan.',
      'В объектном хранилище Contabo в Евросоюзе, не дольше 24 часов. Запросы к ИИ обрабатывает OpenAI. Все сервисы, которыми мы пользуемся, и зачем — в политике конфиденциальности.',
    ],
  },
  {
    id: 'files-cookies', group: 'files', pages: ['help'],
    q: ['Do you use cookies or trackers?', 'Cookie yoki trekerlardan foydalanasizmi?', 'Вы используете cookie или трекеры?'],
    a: [
      'Only what the site needs to work: your sign-in session, security protection, and your language and theme. Cloudflare Turnstile checks that you are not a bot. There are no analytics or advertising trackers.',
      'Faqat sayt ishlashi uchun keraklilari: kirish sessiyasi, xavfsizlik himoyasi, til va mavzu. Cloudflare Turnstile siz bot emasligingizni tekshiradi. Analitika va reklama trekerlari yo‘q.',
      'Только то, без чего сайт не работает: сессия входа, защита безопасности, язык и тема. Cloudflare Turnstile проверяет, что вы не бот. Аналитики и рекламных трекеров нет.',
    ],
  },

  // ── Help: plans and payment (extra to the pricing items) ──
  {
    id: 'plans-vat', group: 'plans', pages: ['pricing', 'help'],
    q: ['Is VAT added to the price?', 'Narxga QQS qo‘shiladimi?', 'Добавляется ли НДС к цене?'],
    a: [
      'No. The price you see is the price you pay. The company is not a VAT payer, so VAT is not charged.',
      'Yo‘q. Ko‘rgan narxingizni to‘laysiz. Kompaniya QQS to‘lovchisi emas, shuning uchun QQS undirilmaydi.',
      'Нет. Вы платите ту цену, которую видите. Компания не является плательщиком НДС, поэтому НДС не взимается.',
    ],
  },

  // ── merge-pdf ──
  {
    id: 'tool-merge-pdf-1', group: 'tools', pages: ['merge-pdf'],
    q: ['How many PDFs can I merge at once?', 'Bir vaqtda nechta PDF birlashtirsa bo‘ladi?', 'Сколько PDF можно объединить за раз?'],
    a: [
      'From 2 to 50 PDFs in one task. Each file can be up to 200 MB, all files together up to 400 MB, and the merged result up to 1,000 pages.',
      'Bir vazifada 2 tadan 50 tagacha PDF. Har bir fayl 200 MB gacha, hammasi birgalikda 400 MB gacha, birlashgan natija esa 1 000 sahifagacha bo‘lishi mumkin.',
      'От 2 до 50 PDF в одной задаче. Каждый файл — до 200 МБ, все вместе — до 400 МБ, а итоговый документ — до 1000 страниц.',
    ],
  },
  {
    id: 'tool-merge-pdf-2', group: 'tools', pages: ['merge-pdf'],
    q: ['Can I change the page order after merging?', 'Birlashtirgandan keyin sahifalar tartibini o‘zgartirsa bo‘ladimi?', 'Можно ли поменять порядок страниц после объединения?'],
    a: [
      'Yes. Open the merged file in Reorder pages and set a new order, or remove pages you don’t need with Delete pages.',
      'Ha. Birlashgan faylni «Sahifalar tartibini o‘zgartirish» vositasida oching va yangi tartib bering yoki keraksiz sahifalarni «Sahifalarni o‘chirish» bilan olib tashlang.',
      'Да. Откройте готовый файл в инструменте «Поменять страницы местами» и задайте новый порядок или уберите лишнее в «Удалить страницы из PDF».',
    ],
  },
  {
    id: 'tool-merge-pdf-3', group: 'tools', pages: ['merge-pdf'],
    q: ['Will the pages look the same after merging?', 'Birlashtirgandan keyin sahifalar o‘zgarmaydimi?', 'Страницы после объединения не изменятся?'],
    a: [
      'Yes. Pages are copied as they are, so text, images and page size stay the same. Only their order follows the file order you set.',
      'O‘zgarmaydi. Sahifalar asl holicha ko‘chiriladi: matn, rasmlar va sahifa o‘lchami avvalgidek qoladi. Faqat ularning tartibi siz bergan fayllar tartibiga mos bo‘ladi.',
      'Не изменятся. Страницы копируются как есть: текст, изображения и размер остаются прежними. Меняется только их порядок — по порядку файлов, который вы задали.',
    ],
  },
  {
    id: 'tool-merge-pdf-4', group: 'tools', pages: ['merge-pdf'],
    q: ['Does merging count against my weekly limit?', 'Birlashtirish haftalik limitdan hisoblanadimi?', 'Засчитывается ли объединение в недельный лимит?'],
    a: [
      'On the Free plan one merge uses one of your 15 file tasks a week, whatever the number of files. Plus and Premium have no weekly file-task limit.',
      'Free tarifida bitta birlashtirish fayllar sonidan qatʼi nazar haftalik 15 ta fayl vazifasidan bittasini sarflaydi. Plus va Premium tariflarida fayl vazifalari uchun haftalik cheklov yo‘q.',
      'На тарифе Free одно объединение расходует одну из 15 задач в неделю, сколько бы файлов в нём ни было. На Plus и Premium недельного лимита на задачи с файлами нет.',
    ],
  },
  {
    id: 'tool-merge-pdf-5', group: 'tools', pages: ['merge-pdf'],
    q: ['Can I merge PDFs in Telegram?', 'Telegramʼda PDF birlashtirsa bo‘ladimi?', 'Можно ли объединить PDF в Telegram?'],
    a: [
      'Yes. Send the PDFs to the bot, up to 20 MB each. For larger files use the website, where the limit is 200 MB per file.',
      'Ha. PDF larni botga yuboring, har biri 20 MB gacha. Kattaroq fayllar uchun veb-saytdan foydalaning, u yerda har bir fayl 200 MB gacha bo‘lishi mumkin.',
      'Да. Отправьте PDF боту, каждый до 20 МБ. Для файлов побольше используйте сайт — там до 200 МБ на файл.',
    ],
  },

  // ── compress-pdf ──
  {
    id: 'tool-compress-pdf-1', group: 'tools', pages: ['compress-pdf'],
    q: ['How much smaller will my PDF be?', 'PDF qanchalik kichrayadi?', 'Насколько уменьшится мой PDF?'],
    a: [
      'It depends on the content, so we don’t promise a fixed percentage. Files with repeated objects or loosely packed pages shrink the most; already optimised files change little.',
      'Bu fayl mazmuniga bog‘liq, shuning uchun aniq foiz vaʼda qilmaymiz. Takrorlanuvchi obyektlari ko‘p yoki zich joylanmagan fayllar ko‘proq kichrayadi, allaqachon ixchamlangan fayllar kam o‘zgaradi.',
      'Это зависит от содержимого, поэтому точный процент мы не обещаем. Сильнее сжимаются файлы с повторяющимися объектами и неплотно упакованными страницами, а уже оптимизированные меняются мало.',
    ],
  },
  {
    id: 'tool-compress-pdf-2', group: 'tools', pages: ['compress-pdf'],
    q: ['Does compression lower the quality?', 'Siqish sifatni pasaytiradimi?', 'Снижает ли сжатие качество?'],
    a: [
      'No. Compression is lossless: page content is recompressed and duplicate objects are stored once. Images and text are not downscaled.',
      'Yo‘q. Siqish sifatni buzmaydi: sahifa mazmuni qayta siqiladi, takroriy obyektlar bir marta saqlanadi. Rasmlar va matn kichraytirilmaydi.',
      'Нет. Сжатие без потерь: содержимое страниц пересжимается, а повторяющиеся объекты хранятся один раз. Изображения и текст не уменьшаются.',
    ],
  },
  {
    id: 'tool-compress-pdf-3', group: 'tools', pages: ['compress-pdf'],
    q: ['What if the file doesn’t get smaller?', 'Fayl kichraymasa nima bo‘ladi?', 'Что, если файл не уменьшится?'],
    a: [
      'If the saving is under 1%, you get the original back marked “no change needed”, and the task is not counted in your weekly limit.',
      'Tejash 1% dan kam bo‘lsa, asl fayl «O‘zgartirish kerak emas» belgisi bilan qaytadi va vazifa haftalik limitdan hisoblanmaydi.',
      'Если экономия меньше 1%, вы получите исходный файл с пометкой «Изменения не нужны», а задача не засчитается в недельный лимит.',
    ],
  },
  {
    id: 'tool-compress-pdf-4', group: 'tools', pages: ['compress-pdf'],
    q: ['Can I compress a file to send through the bot?', 'Botga yuborish uchun faylni siqsa bo‘ladimi?', 'Можно ли сжать файл, чтобы отправить через бота?'],
    a: [
      'Yes. Compress it on the website, which accepts files up to 200 MB, then send the result to the bot if it fits the bot’s 20 MB limit. If not, split it into parts.',
      'Ha. Faylni 200 MB gacha qabul qiladigan veb-saytda siqing, natija 20 MB lik bot chegarasiga sig‘sa, uni botga yuboring. Sig‘masa, qismlarga bo‘ling.',
      'Да. Сожмите файл на сайте, где принимаются файлы до 200 МБ, и отправьте результат боту, если он укладывается в 20 МБ. Если нет — разделите его на части.',
    ],
  },

  // ── split-pdf ──
  {
    id: 'tool-split-pdf-1', group: 'tools', pages: ['split-pdf', 'extract-pdf-pages'],
    q: ['What is the difference between split and extract?', 'Bo‘lish va ajratib olishning farqi nima?', 'Чем разделение отличается от извлечения?'],
    a: [
      'Split makes several PDFs at once, one for each range you enter. Extract pages makes one new PDF with only the pages you pick.',
      'Bo‘lish bir yo‘la bir nechta PDF yaratadi: siz yozgan har bir oraliq uchun bittadan. «Sahifalarni ajratib olish» esa faqat tanlangan sahifalardan bitta yangi PDF yasaydi.',
      'Разделение сразу создаёт несколько PDF, по одному на каждый диапазон. «Извлечь страницы» создаёт один новый PDF только с выбранными страницами.',
    ],
  },
  {
    id: 'tool-split-pdf-2', group: 'tools', pages: ['split-pdf'],
    q: ['Can I save every page as a separate file?', 'Har bir sahifani alohida fayl qilsa bo‘ladimi?', 'Можно ли сохранить каждую страницу отдельным файлом?'],
    a: [
      'Yes. Don’t enter any ranges, and each page becomes its own PDF.',
      'Ha. Oraliq yozmang, shunda har bir sahifa alohida PDF bo‘ladi.',
      'Да. Не указывайте диапазоны, и каждая страница станет отдельным PDF.',
    ],
  },
  {
    id: 'tool-split-pdf-3', group: 'tools', pages: ['split-pdf'],
    q: ['How do I write page ranges?', 'Sahifa oraliqlarini qanday yozish kerak?', 'Как указать диапазоны страниц?'],
    a: [
      'Use page numbers and dashes, for example 1-3 for the first part and 4-10 for the second. Each range becomes one file, and ranges may overlap.',
      'Sahifa raqamlari va chiziqcha ishlating, masalan birinchi qism uchun 1-3, ikkinchisi uchun 4-10. Har bir oraliq bitta fayl bo‘ladi, oraliqlar ustma-ust tushishi ham mumkin.',
      'Используйте номера страниц и дефис: например, 1-3 для первой части и 4-10 для второй. Каждый диапазон станет файлом, диапазоны могут пересекаться.',
    ],
  },
  {
    id: 'tool-split-pdf-4', group: 'tools', pages: ['split-pdf'],
    q: ['Is the original file changed?', 'Asl fayl o‘zgaradimi?', 'Меняется ли исходный файл?'],
    a: [
      'No. The parts are new files and your uploaded PDF stays as it was. Uploaded and result files are deleted after 24 hours.',
      'Yo‘q. Qismlar yangi fayllar, yuklagan PDF ingiz esa o‘zgarmaydi. Yuklangan fayllar va natijalar 24 soatdan keyin o‘chiriladi.',
      'Нет. Части — это новые файлы, а загруженный PDF остаётся прежним. Загруженные файлы и результаты удаляются через 24 часа.',
    ],
  },

  // ── extract-pdf-pages ──
  {
    id: 'tool-extract-pdf-pages-1', group: 'tools', pages: ['extract-pdf-pages'],
    q: ['Can I pick pages that are not next to each other?', 'Ketma-ket bo‘lmagan sahifalarni tanlasa bo‘ladimi?', 'Можно ли выбрать страницы не подряд?'],
    a: [
      'Yes. List them with commas, for example 1,4,9, and add ranges like 12-15. They all go into one new PDF.',
      'Ha. Ularni vergul bilan yozing, masalan 1,4,9, va 12-15 kabi oraliqlar qo‘shing. Hammasi bitta yangi PDF ga tushadi.',
      'Да. Перечислите их через запятую, например 1,4,9, и добавьте диапазоны вроде 12-15. Все они попадут в один новый PDF.',
    ],
  },
  {
    id: 'tool-extract-pdf-pages-2', group: 'tools', pages: ['extract-pdf-pages'],
    q: ['What happens to the original PDF?', 'Asl PDF bilan nima bo‘ladi?', 'Что будет с исходным PDF?'],
    a: [
      'Nothing. Extracting creates a new file and your upload stays complete. Both are deleted from our servers after 24 hours.',
      'Hech narsa. Ajratib olish yangi fayl yaratadi, yuklagan faylingiz to‘liq qoladi. Ikkalasi ham 24 soatdan keyin serverlarimizdan o‘chiriladi.',
      'Ничего. Извлечение создаёт новый файл, а загруженный остаётся целым. Оба удаляются с наших серверов через 24 часа.',
    ],
  },
  {
    id: 'tool-extract-pdf-pages-3', group: 'tools', pages: ['extract-pdf-pages'],
    q: ['Can I extract pages in the Telegram bot?', 'Telegram botda sahifalarni ajratib olsa bo‘ladimi?', 'Можно ли извлечь страницы в Telegram-боте?'],
    a: [
      'Yes, for PDFs up to 20 MB. Larger files work on the website, up to 200 MB and 1,000 pages.',
      'Ha, 20 MB gacha bo‘lgan PDF lar uchun. Kattaroq fayllar veb-saytda ishlaydi: 200 MB va 1 000 sahifagacha.',
      'Да, для PDF до 20 МБ. Файлы побольше обрабатываются на сайте — до 200 МБ и 1000 страниц.',
    ],
  },

  // ── delete-pdf-pages ──
  {
    id: 'tool-delete-pdf-pages-1', group: 'tools', pages: ['delete-pdf-pages'],
    q: ['Can I undo a deletion?', 'O‘chirishni bekor qilsa bo‘ladimi?', 'Можно ли отменить удаление?'],
    a: [
      'Your uploaded file is not changed, so you can run the task again with other pages. Keep in mind that files are deleted after 24 hours.',
      'Yuklagan faylingiz o‘zgarmaydi, shuning uchun vazifani boshqa sahifalar bilan qayta boshlashingiz mumkin. Fayllar 24 soatdan keyin o‘chirilishini unutmang.',
      'Загруженный файл не меняется, поэтому задачу можно запустить заново с другими страницами. Учтите, что файлы удаляются через 24 часа.',
    ],
  },
  {
    id: 'tool-delete-pdf-pages-2', group: 'tools', pages: ['delete-pdf-pages'],
    q: ['Can I delete several pages at once?', 'Bir nechta sahifani birdaniga o‘chirsa bo‘ladimi?', 'Можно ли удалить сразу несколько страниц?'],
    a: [
      'Yes. Enter them with commas and dashes, for example 1,5,8-10, and they are all removed in one task.',
      'Ha. Ularni vergul va chiziqcha bilan yozing, masalan 1,5,8-10, va hammasi bitta vazifada olib tashlanadi.',
      'Да. Перечислите их через запятую и дефис, например 1,5,8-10, и все они удалятся за одну задачу.',
    ],
  },
  {
    id: 'tool-delete-pdf-pages-3', group: 'tools', pages: ['delete-pdf-pages'],
    q: ['Will the other pages change?', 'Qolgan sahifalar o‘zgaradimi?', 'Изменятся ли остальные страницы?'],
    a: [
      'No. The pages that remain are copied as they are and keep their order.',
      'Yo‘q. Qolgan sahifalar asl holicha ko‘chiriladi va tartibini saqlaydi.',
      'Нет. Оставшиеся страницы копируются как есть и сохраняют порядок.',
    ],
  },
  {
    id: 'tool-delete-pdf-pages-4', group: 'tools', pages: ['delete-pdf-pages'],
    q: ['Can I remove pages on my phone?', 'Telefonda sahifalarni o‘chirsa bo‘ladimi?', 'Можно ли удалить страницы с телефона?'],
    a: [
      'Yes. Use the website in your phone’s browser, or send the PDF to the Telegram bot if it is under 20 MB.',
      'Ha. Telefon brauzerida veb-saytdan foydalaning yoki PDF 20 MB dan kichik bo‘lsa, uni Telegram botga yuboring.',
      'Да. Откройте сайт в браузере телефона или отправьте PDF Telegram-боту, если он меньше 20 МБ.',
    ],
  },

  // ── reorder-pdf-pages ──
  {
    id: 'tool-reorder-pdf-pages-1', group: 'tools', pages: ['reorder-pdf-pages'],
    q: ['Can I also rotate pages?', 'Sahifalarni burish ham mumkinmi?', 'Можно ли заодно повернуть страницы?'],
    a: [
      'Rotation is a separate tool. After reordering, open the result in Rotate PDF and turn the pages you need by 90, 180 or 270 degrees.',
      'Burish alohida vosita. Tartiblagandan keyin natijani «PDF sahifalarini burish»da oching va kerakli sahifalarni 90, 180 yoki 270 gradusga buring.',
      'Поворот — отдельный инструмент. После перестановки откройте результат в «Повернуть PDF» и поверните нужные страницы на 90, 180 или 270 градусов.',
    ],
  },
  {
    id: 'tool-reorder-pdf-pages-2', group: 'tools', pages: ['reorder-pdf-pages'],
    q: ['Will reordering change how pages look?', 'Tartiblash sahifalar ko‘rinishini o‘zgartiradimi?', 'Изменится ли вид страниц после перестановки?'],
    a: [
      'No. Pages are moved as they are, so text, images and page size stay the same.',
      'Yo‘q. Sahifalar asl holicha ko‘chiriladi: matn, rasmlar va sahifa o‘lchami o‘zgarmaydi.',
      'Нет. Страницы переставляются как есть: текст, изображения и размер не меняются.',
    ],
  },
  {
    id: 'tool-reorder-pdf-pages-3', group: 'tools', pages: ['reorder-pdf-pages'],
    q: ['Can I move pages between two PDFs?', 'Ikki PDF orasida sahifalarni ko‘chirsa bo‘ladimi?', 'Можно ли перенести страницы между двумя PDF?'],
    a: [
      'Merge the two files with Merge PDF first, then set the page order of the combined file here.',
      'Avval ikki faylni «PDF birlashtirish» bilan jamlang, keyin bu yerda birlashgan faylning sahifalar tartibini bering.',
      'Сначала соедините два файла в «Объединить PDF», затем задайте порядок страниц общего файла здесь.',
    ],
  },
  {
    id: 'tool-reorder-pdf-pages-4', group: 'tools', pages: ['reorder-pdf-pages'],
    q: ['Is it available in the Telegram bot?', 'Bu Telegram botda bormi?', 'Это есть в Telegram-боте?'],
    a: [
      'Yes, for PDFs up to 20 MB. For larger files use the website, up to 200 MB and 1,000 pages.',
      'Ha, 20 MB gacha bo‘lgan PDF lar uchun. Kattaroq fayllar uchun veb-saytdan foydalaning: 200 MB va 1 000 sahifagacha.',
      'Да, для PDF до 20 МБ. Для файлов побольше используйте сайт — до 200 МБ и 1000 страниц.',
    ],
  },

  // ── rotate-pdf ──
  {
    id: 'tool-rotate-pdf-1', group: 'tools', pages: ['rotate-pdf'],
    q: ['Is the rotation saved permanently in the file?', 'Burilish faylda doimiy saqlanadimi?', 'Поворот сохраняется в файле навсегда?'],
    a: [
      'Yes. The new orientation is written into the PDF, so it opens the right way in any viewer and on any device.',
      'Ha. Yangi holat PDF ga yoziladi, shuning uchun fayl istalgan dasturda va qurilmada to‘g‘ri ochiladi.',
      'Да. Новая ориентация записывается в PDF, поэтому файл правильно открывается в любой программе и на любом устройстве.',
    ],
  },
  {
    id: 'tool-rotate-pdf-2', group: 'tools', pages: ['rotate-pdf'],
    q: ['Can I rotate just one page?', 'Faqat bitta sahifani bursa bo‘ladimi?', 'Можно ли повернуть только одну страницу?'],
    a: [
      'Yes. Enter that page number, or several like 2,5-6, and only those pages turn. The rest stay as they were.',
      'Ha. O‘sha sahifa raqamini yoki 2,5-6 kabi bir nechtasini yozing, faqat ular buriladi. Qolganlari o‘z holicha qoladi.',
      'Да. Укажите номер страницы или несколько, например 2,5-6, и повернутся только они. Остальные останутся как были.',
    ],
  },
  {
    id: 'tool-rotate-pdf-3', group: 'tools', pages: ['rotate-pdf'],
    q: ['Which angles can I choose?', 'Qaysi burchaklarni tanlash mumkin?', 'Какие углы можно выбрать?'],
    a: [
      '90, 180 or 270 degrees. 90 and 270 turn a page a quarter turn either way; 180 turns an upside-down page upright.',
      '90, 180 yoki 270 gradus. 90 va 270 sahifani u yoki bu tomonga chorak aylantiradi, 180 esa teskari sahifani to‘g‘rilaydi.',
      '90, 180 или 270 градусов. 90 и 270 поворачивают страницу на четверть оборота в одну или другую сторону, 180 переворачивает страницу, лежащую вверх ногами.',
    ],
  },
  {
    id: 'tool-rotate-pdf-4', group: 'tools', pages: ['rotate-pdf'],
    q: ['Can I rotate a PDF in Telegram?', 'Telegramʼda PDF ni bursa bo‘ladimi?', 'Можно ли повернуть PDF в Telegram?'],
    a: [
      'Yes, the bot rotates PDFs up to 20 MB. Larger files work on the website, up to 200 MB.',
      'Ha, bot 20 MB gacha bo‘lgan PDF larni buradi. Kattaroq fayllar veb-saytda ishlaydi, 200 MB gacha.',
      'Да, бот поворачивает PDF до 20 МБ. Файлы побольше обрабатываются на сайте, до 200 МБ.',
    ],
  },

  // ── jpg-to-pdf ──
  {
    id: 'tool-jpg-to-pdf-1', group: 'tools', pages: ['jpg-to-pdf'],
    q: ['Does it work with phone photos of documents?', 'Hujjatlarning telefon suratlari bilan ishlaydimi?', 'Подойдут ли фото документов с телефона?'],
    a: [
      'Yes. When a photo shows a document, it is straightened automatically, so the page looks scanned. Photos that are not documents keep their shape.',
      'Ha. Suratda hujjat bo‘lsa, u avtomatik tekislanadi va sahifa skanerdagidek ko‘rinadi. Hujjat bo‘lmagan suratlar o‘z shaklini saqlaydi.',
      'Да. Если на фото документ, он автоматически выравнивается и выглядит как скан. Снимки, на которых не документ, сохраняют свою форму.',
    ],
  },
  {
    id: 'tool-jpg-to-pdf-2', group: 'tools', pages: ['jpg-to-pdf'],
    q: ['Which image formats can I use?', 'Qaysi rasm formatlari qabul qilinadi?', 'Какие форматы изображений подходят?'],
    a: [
      'JPG, PNG and WEBP. You can add up to 50 images to one PDF, and each image becomes one page.',
      'JPG, PNG va WEBP. Bitta PDF ga 50 tagacha rasm qo‘shish mumkin, har bir rasm bitta sahifa bo‘ladi.',
      'JPG, PNG и WEBP. В один PDF можно добавить до 50 изображений, каждое станет страницей.',
    ],
  },
  {
    id: 'tool-jpg-to-pdf-3', group: 'tools', pages: ['jpg-to-pdf'],
    q: ['Can I make the PDF searchable?', 'PDF ni qidiriladigan qilsa bo‘ladimi?', 'Можно ли сделать PDF с поиском по тексту?'],
    a: [
      'The PDF holds pictures of pages. To search and copy the text, run it through Make PDF searchable, which adds a text layer in Uzbek, Russian or English.',
      'Bu PDF da sahifalar rasm ko‘rinishida bo‘ladi. Matnni qidirish va nusxalash uchun uni «Skanerni qidiriladigan PDF qilish»dan o‘tkazing, u o‘zbek, rus yoki ingliz tilida matn qatlamini qo‘shadi.',
      'В таком PDF страницы — это картинки. Чтобы искать и копировать текст, пропустите его через «PDF с распознаванием текста»: он добавит текстовый слой на узбекском, русском или английском.',
    ],
  },
  {
    id: 'tool-jpg-to-pdf-4', group: 'tools', pages: ['jpg-to-pdf'],
    q: ['Can I choose A4 page size?', 'A4 o‘lchamini tanlasa bo‘ladimi?', 'Можно ли выбрать формат A4?'],
    a: [
      'Yes. By default each page fits its picture; you can also choose A4, Letter or the original size, and portrait or landscape.',
      'Ha. Odatda har sahifa o‘z rasmiga moslashadi, lekin A4, Letter yoki asl o‘lchamni, shuningdek tik yoki yotiq holatni tanlash mumkin.',
      'Да. По умолчанию страница подстраивается под снимок, но можно выбрать A4, Letter или исходный размер, а также книжную или альбомную ориентацию.',
    ],
  },
  {
    id: 'tool-jpg-to-pdf-5', group: 'tools', pages: ['jpg-to-pdf', 'telegram'],
    q: ['Can I turn photos into a PDF in Telegram?', 'Telegramʼda suratlardan PDF qilsa bo‘ladimi?', 'Можно ли сделать PDF из фото в Telegram?'],
    a: [
      'Yes. Send your photos to the bot, each up to 20 MB, and it sends back one PDF. It is the quickest way from a phone.',
      'Ha. Suratlaringizni botga yuboring, har biri 20 MB gacha, bot sizga bitta PDF qaytaradi. Telefondan eng tez yo‘l shu.',
      'Да. Отправьте фото боту, каждое до 20 МБ, и он пришлёт один PDF. С телефона так быстрее всего.',
    ],
  },

  // ── pdf-to-jpg ──
  {
    id: 'tool-pdf-to-jpg-1', group: 'tools', pages: ['pdf-to-jpg'],
    q: ['Which image format do I get?', 'Qaysi rasm formatida olaman?', 'В каком формате будут изображения?'],
    a: [
      'You choose: JPG or PNG. JPG makes lighter files; PNG keeps text and thin lines sharper.',
      'O‘zingiz tanlaysiz: JPG yoki PNG. JPG yengilroq fayl beradi, PNG esa matn va ingichka chiziqlarni aniqroq saqlaydi.',
      'Вы выбираете сами: JPG или PNG. JPG легче, а PNG чётче передаёт текст и тонкие линии.',
    ],
  },
  {
    id: 'tool-pdf-to-jpg-2', group: 'tools', pages: ['pdf-to-jpg'],
    q: ['Can I convert only some pages?', 'Faqat ayrim sahifalarni aylantirsa bo‘ladimi?', 'Можно ли конвертировать только часть страниц?'],
    a: [
      'Yes. Enter the pages, for example 1 or 3-5, and only those become images.',
      'Ha. Sahifalarni yozing, masalan 1 yoki 3-5, faqat ular rasmga aylanadi.',
      'Да. Укажите страницы, например 1 или 3-5, и картинками станут только они.',
    ],
  },
  {
    id: 'tool-pdf-to-jpg-3', group: 'tools', pages: ['pdf-to-jpg'],
    q: ['Will I get one image per page?', 'Har sahifa uchun bitta rasm chiqadimi?', 'Каждая страница станет отдельной картинкой?'],
    a: [
      'Yes. Every page you choose becomes its own image file. The PDF itself is not changed.',
      'Ha. Tanlagan har bir sahifangiz alohida rasm fayliga aylanadi. PDF ning o‘zi o‘zgarmaydi.',
      'Да. Каждая выбранная страница становится отдельным файлом-изображением. Сам PDF не меняется.',
    ],
  },
  {
    id: 'tool-pdf-to-jpg-4', group: 'tools', pages: ['pdf-to-jpg'],
    q: ['Is it available in the Telegram bot?', 'Bu Telegram botda bormi?', 'Это есть в Telegram-боте?'],
    a: [
      'Yes, for PDFs up to 20 MB. Use the website for larger files, up to 200 MB and 1,000 pages.',
      'Ha, 20 MB gacha bo‘lgan PDF lar uchun. Kattaroq fayllarni veb-saytda aylantiring: 200 MB va 1 000 sahifagacha.',
      'Да, для PDF до 20 МБ. Файлы побольше конвертируйте на сайте — до 200 МБ и 1000 страниц.',
    ],
  },

  // ── word-to-pdf ──
  {
    id: 'tool-word-to-pdf-1', group: 'tools', pages: ['word-to-pdf'],
    q: ['Will my formatting be kept?', 'Formatlash saqlanadimi?', 'Сохранится ли форматирование?'],
    a: [
      'Text, tables, images and page layout are converted as laid out in the document. If a font in your file isn’t available, a similar one may be used, so check the PDF before sending it.',
      'Matn, jadvallar, rasmlar va sahifa joylashuvi hujjatdagidek o‘tkaziladi. Faylingizdagi shrift mavjud bo‘lmasa, o‘xshashi ishlatilishi mumkin, shuning uchun yuborishdan oldin PDF ni tekshiring.',
      'Текст, таблицы, изображения и разметка страниц переносятся так, как свёрстан документ. Если какого-то шрифта нет, его может заменить похожий, поэтому проверьте PDF перед отправкой.',
    ],
  },
  {
    id: 'tool-word-to-pdf-2', group: 'tools', pages: ['word-to-pdf'],
    q: ['Which Word formats are accepted?', 'Qaysi Word formatlari qabul qilinadi?', 'Какие форматы Word принимаются?'],
    a: [
      'Only .docx. Save an older .doc file as .docx first. Files with macros are refused for safety.',
      'Faqat .docx. Eski .doc faylni avval .docx qilib saqlang. Makrosli fayllar xavfsizlik uchun qabul qilinmaydi.',
      'Только .docx. Старый файл .doc сначала сохраните как .docx. Файлы с макросами отклоняются ради безопасности.',
    ],
  },
  {
    id: 'tool-word-to-pdf-3', group: 'tools', pages: ['word-to-pdf', 'pdf-to-word'],
    q: ['Can I turn the PDF back into Word?', 'PDF ni yana Word ga qaytarsa bo‘ladimi?', 'Можно ли превратить PDF обратно в Word?'],
    a: [
      'Yes, with PDF to Word on the website. The text becomes editable again, but the original layout is not kept exactly.',
      'Ha, veb-saytdagi «PDF ni Word ga aylantirish» bilan. Matn yana tahrirlanadigan bo‘ladi, lekin asl maket aynan saqlanmaydi.',
      'Да, инструментом «PDF в Word» на сайте. Текст снова станет редактируемым, но исходная вёрстка точно не сохранится.',
    ],
  },
  {
    id: 'tool-word-to-pdf-4', group: 'tools', pages: ['word-to-pdf'],
    q: ['Can I convert Word to PDF in Telegram?', 'Telegramʼda Word ni PDF ga o‘tkazsa bo‘ladimi?', 'Можно ли конвертировать Word в PDF в Telegram?'],
    a: [
      'Yes. Send the .docx file to the bot, up to 20 MB, and it returns a PDF.',
      'Ha. .docx faylni botga yuboring, 20 MB gacha, bot PDF qaytaradi.',
      'Да. Отправьте файл .docx боту, до 20 МБ, и он вернёт PDF.',
    ],
  },

  // ── powerpoint-to-pdf ──
  {
    id: 'tool-powerpoint-to-pdf-1', group: 'tools', pages: ['powerpoint-to-pdf'],
    q: ['Which PowerPoint formats are accepted?', 'Qaysi PowerPoint formatlari qabul qilinadi?', 'Какие форматы PowerPoint принимаются?'],
    a: [
      'Only .pptx. Save an older .ppt file as .pptx first. Files with macros are refused.',
      'Faqat .pptx. Eski .ppt faylni avval .pptx qilib saqlang. Makrosli fayllar qabul qilinmaydi.',
      'Только .pptx. Старый файл .ppt сначала сохраните как .pptx. Файлы с макросами отклоняются.',
    ],
  },
  {
    id: 'tool-powerpoint-to-pdf-2', group: 'tools', pages: ['powerpoint-to-pdf'],
    q: ['Will animations be kept?', 'Animatsiyalar saqlanadimi?', 'Сохранятся ли анимации?'],
    a: [
      'No. A PDF holds still pages, so each slide becomes one page without animations or transitions.',
      'Yo‘q. PDF da harakatsiz sahifalar bo‘ladi, shuning uchun har slayd animatsiya va o‘tishlarsiz bitta sahifaga aylanadi.',
      'Нет. PDF состоит из статичных страниц, поэтому каждый слайд становится страницей без анимаций и переходов.',
    ],
  },
  {
    id: 'tool-powerpoint-to-pdf-3', group: 'tools', pages: ['powerpoint-to-pdf', 'ai-slides'],
    q: ['Can I convert slides made with AI?', 'Sunʼiy intellekt yasagan slaydlarni o‘tkazsa bo‘ladimi?', 'Можно ли конвертировать слайды, сделанные с ИИ?'],
    a: [
      'Yes. AI slides gives you an editable .pptx, and this tool turns it into a PDF for sharing or printing.',
      'Ha. Sunʼiy intellekt bilan taqdimot tahrirlanadigan .pptx fayl beradi, bu vosita esa uni ulashish yoki chop etish uchun PDF ga aylantiradi.',
      'Да. Презентация с помощью ИИ — это редактируемый файл .pptx, а этот инструмент превратит его в PDF для отправки или печати.',
    ],
  },
  {
    id: 'tool-powerpoint-to-pdf-4', group: 'tools', pages: ['powerpoint-to-pdf'],
    q: ['Can I do it in the Telegram bot?', 'Buni Telegram botda qilsa bo‘ladimi?', 'Можно ли сделать это в Telegram-боте?'],
    a: [
      'Yes. Send the .pptx to the bot, up to 20 MB, and get a PDF back. Larger presentations work on the website, up to 200 MB.',
      'Ha. .pptx ni botga yuboring, 20 MB gacha, va PDF oling. Kattaroq taqdimotlar veb-saytda ishlaydi, 200 MB gacha.',
      'Да. Отправьте .pptx боту, до 20 МБ, и получите PDF. Презентации побольше обрабатываются на сайте, до 200 МБ.',
    ],
  },

  // ── pdf-to-word ──
  {
    id: 'tool-pdf-to-word-1', group: 'tools', pages: ['pdf-to-word'],
    q: ['Can I edit the result?', 'Natijani tahrirlasa bo‘ladimi?', 'Можно ли редактировать результат?'],
    a: [
      'Yes. You get a .docx file you can change in Word, Google Docs or any editor that opens Word files.',
      'Ha. Word, Google Docs yoki Word fayllarini ochadigan istalgan dasturda o‘zgartirish mumkin bo‘lgan .docx fayl olasiz.',
      'Да. Вы получите файл .docx, который можно править в Word, Google Docs или любом редакторе, открывающем файлы Word.',
    ],
  },
  {
    id: 'tool-pdf-to-word-2', group: 'tools', pages: ['pdf-to-word'],
    q: ['Will it look like the original PDF?', 'Natija asl PDF ga o‘xshaydimi?', 'Будет ли результат выглядеть как исходный PDF?'],
    a: [
      'Not exactly. The text is reflowed into paragraphs, so columns, images and precise positions are not kept. The tool is meant for reusing text.',
      'Aynan emas. Matn xatboshilarga qayta joylanadi, shuning uchun ustunlar, rasmlar va aniq joylashuv saqlanmaydi. Vosita matndan qayta foydalanish uchun mo‘ljallangan.',
      'Не совсем. Текст перестраивается в абзацы, поэтому колонки, изображения и точное расположение не сохраняются. Инструмент нужен, чтобы использовать текст повторно.',
    ],
  },
  {
    id: 'tool-pdf-to-word-3', group: 'tools', pages: ['pdf-to-word'],
    q: ['Does it work on scanned PDFs?', 'Skanerlangan PDF bilan ishlaydimi?', 'Работает ли это со сканами PDF?'],
    a: [
      'A scan holds pictures, not text. Run it through OCR to get the text, or use Make PDF searchable to add a text layer to the scan.',
      'Skanerda matn emas, rasm bo‘ladi. Matnni olish uchun uni OCR dan o‘tkazing yoki skanerga matn qatlamini qo‘shish uchun «Skanerni qidiriladigan PDF qilish»dan foydalaning.',
      'В скане не текст, а картинки. Чтобы получить текст, используйте «Распознать текст», или добавьте к скану текстовый слой через «PDF с распознаванием текста».',
    ],
  },
  {
    id: 'tool-pdf-to-word-4', group: 'tools', pages: ['pdf-to-word'],
    q: ['Why isn’t it in the Telegram bot?', 'Nega bu Telegram botda yo‘q?', 'Почему этого нет в Telegram-боте?'],
    a: [
      'PDF to Word is available on the website only. Sign in there with the same Telegram account, and your plan and limits are the same.',
      '«PDF ni Word ga aylantirish» faqat veb-saytda ishlaydi. U yerga o‘sha Telegram hisobingiz bilan kiring, tarif va limitlaringiz bir xil bo‘ladi.',
      '«PDF в Word» работает только на сайте. Войдите туда через тот же аккаунт Telegram — тариф и лимиты будут общими.',
    ],
  },

  // ── pdf-to-excel ──
  {
    id: 'tool-pdf-to-excel-1', group: 'tools', pages: ['pdf-to-excel'],
    q: ['What if my PDF is a scan?', 'PDF im skaner bo‘lsa-chi?', 'Что, если мой PDF — скан?'],
    a: [
      'A scanned table is a picture, so there is no text to put into cells. This tool works only with tables whose text you can select in a PDF viewer.',
      'Skanerlangan jadval rasm hisoblanadi, kataklarga qo‘yadigan matn yo‘q. Bu vosita faqat matnini PDF ko‘rish dasturida belgilab bo‘ladigan jadvallar bilan ishlaydi.',
      'Отсканированная таблица — это картинка, в ней нет текста для ячеек. Инструмент работает только с таблицами, текст которых выделяется в просмотрщике PDF.',
    ],
  },
  {
    id: 'tool-pdf-to-excel-2', group: 'tools', pages: ['pdf-to-excel'],
    q: ['What happens to text outside the tables?', 'Jadvaldan tashqaridagi matn nima bo‘ladi?', 'Что будет с текстом вне таблиц?'],
    a: [
      'It is left out. Only tables go into the workbook, each on its own sheet named after its page and table number.',
      'U olinmaydi. Kitobga faqat jadvallar tushadi, har biri sahifa va jadval raqami bilan nomlangan alohida varaqda.',
      'Он не переносится. В книгу попадают только таблицы, каждая на своём листе с номером страницы и таблицы.',
    ],
  },
  {
    id: 'tool-pdf-to-excel-3', group: 'tools', pages: ['pdf-to-excel'],
    q: ['Can I calculate with the numbers right away?', 'Raqamlar bilan darhol hisoblasa bo‘ladimi?', 'Можно ли сразу считать по числам?'],
    a: [
      'Values arrive as text, exactly as written in the PDF. Convert the columns to numbers in Excel before you sum or sort them.',
      'Qiymatlar PDF da qanday yozilgan bo‘lsa, shunday matn sifatida keladi. Qo‘shish yoki saralashdan oldin Excel da ustunlarni raqamga o‘tkazing.',
      'Значения приходят как текст, ровно как в PDF. Перед суммированием или сортировкой преобразуйте столбцы в числа в Excel.',
    ],
  },
  {
    id: 'tool-pdf-to-excel-4', group: 'tools', pages: ['pdf-to-excel'],
    q: ['What if no tables are found?', 'Jadval topilmasa-chi?', 'Что, если таблицы не найдутся?'],
    a: [
      'The task ends without a file and is not counted in your weekly limit. Check that the PDF has tables made of selectable text.',
      'Vazifa faylsiz tugaydi va haftalik limitdan hisoblanmaydi. PDF da belgilab bo‘ladigan matnli jadvallar borligini tekshiring.',
      'Задача завершится без файла и не засчитается в недельный лимит. Проверьте, что в PDF есть таблицы из выделяемого текста.',
    ],
  },

  // ── ocr-pdf ──
  {
    id: 'tool-ocr-pdf-1', group: 'tools', pages: ['ocr-pdf'],
    q: ['Which languages are supported?', 'Qaysi tillar qo‘llab-quvvatlanadi?', 'Какие языки поддерживаются?'],
    a: [
      'Uzbek, Russian and English, and English mixed with Russian or Uzbek, or all three. Choose the language of the page before you start.',
      'O‘zbek, rus va ingliz tillari, shuningdek ingliz tili rus yoki o‘zbek tili bilan aralash yoki uchalasi birga. Boshlashdan oldin sahifa tilini tanlang.',
      'Узбекский, русский и английский, а также английский вместе с русским или узбекским и все три сразу. Выберите язык страницы перед запуском.',
    ],
  },
  {
    id: 'tool-ocr-pdf-2', group: 'tools', pages: ['ocr-pdf'],
    q: ['Does it read handwriting?', 'Qo‘lyozmani o‘qiydimi?', 'Распознаёт ли рукописный текст?'],
    a: [
      'It is made for printed text. Handwriting is not reliably recognised, so we don’t promise results for it.',
      'Vosita bosma matn uchun mo‘ljallangan. Qo‘lyozma ishonchli tanilmaydi, shuning uchun unga natija vaʼda qilmaymiz.',
      'Инструмент рассчитан на печатный текст. Рукописный текст надёжно не распознаётся, поэтому результат для него мы не обещаем.',
    ],
  },
  {
    id: 'tool-ocr-pdf-3', group: 'tools', pages: ['ocr-pdf'],
    q: ['What do I get as a result?', 'Natijada nima olaman?', 'Что я получу в результате?'],
    a: [
      'A plain text (.txt) file with the recognised words, ready to paste into Word, a chat or a form.',
      'Tanilgan so‘zlardan iborat oddiy matn (.txt) fayli. Uni Word, chat yoki shaklga qo‘yish mumkin.',
      'Обычный текстовый файл .txt с распознанными словами — его можно вставить в Word, чат или форму.',
    ],
  },
  {
    id: 'tool-ocr-pdf-4', group: 'tools', pages: ['ocr-pdf', 'searchable-pdf'],
    q: ['How is OCR different from a searchable PDF?', 'OCR qidiriladigan PDF dan nimasi bilan farq qiladi?', 'Чем распознавание отличается от PDF с поиском?'],
    a: [
      'OCR gives you the text on its own. Make PDF searchable keeps the scanned pages and adds an invisible text layer, so you search and copy inside the PDF.',
      'OCR matnni alohida beradi. «Skanerni qidiriladigan PDF qilish» esa skanerlangan sahifalarni saqlab, ko‘rinmas matn qatlamini qo‘shadi va PDF ichida qidirish hamda nusxalash mumkin bo‘ladi.',
      'Распознавание выдаёт текст отдельно. «PDF с распознаванием текста» сохраняет страницы скана и добавляет невидимый текстовый слой, чтобы искать и копировать прямо в PDF.',
    ],
  },
  {
    id: 'tool-ocr-pdf-5', group: 'tools', pages: ['ocr-pdf'],
    q: ['Can I use OCR in the Telegram bot?', 'OCR dan Telegram botda foydalansa bo‘ladimi?', 'Можно ли распознать текст в Telegram-боте?'],
    a: [
      'OCR is available on the website only. Sign in there with the same Telegram account to use your plan.',
      'OCR faqat veb-saytda ishlaydi. Tarifingizdan foydalanish uchun u yerga o‘sha Telegram hisobingiz bilan kiring.',
      'Распознавание доступно только на сайте. Войдите туда через тот же аккаунт Telegram, чтобы пользоваться своим тарифом.',
    ],
  },

  // ── searchable-pdf ──
  {
    id: 'tool-searchable-pdf-1', group: 'tools', pages: ['searchable-pdf'],
    q: ['How is it different from OCR text?', 'OCR matnidan farqi nima?', 'Чем это отличается от распознанного текста?'],
    a: [
      'OCR gives you a separate text file. A searchable PDF keeps the scanned pages and puts a hidden text layer inside, so you search and copy in the PDF itself.',
      'OCR alohida matn faylini beradi. Qidiriladigan PDF esa skanerlangan sahifalarni saqlab, ichiga yashirin matn qatlamini qo‘yadi, shuning uchun PDF ning o‘zida qidirasiz va nusxalaysiz.',
      'Распознавание даёт отдельный текстовый файл. PDF с поиском сохраняет страницы скана и прячет внутри текстовый слой, так что искать и копировать можно прямо в PDF.',
    ],
  },
  {
    id: 'tool-searchable-pdf-2', group: 'tools', pages: ['searchable-pdf'],
    q: ['Can I copy text afterwards?', 'Keyin matnni nusxalasa bo‘ladimi?', 'Можно ли потом копировать текст?'],
    a: [
      'Yes. Select text in any PDF viewer and copy it. Check important numbers and names, since recognition depends on the quality of the scan.',
      'Ha. Istalgan PDF dasturida matnni belgilab, nusxalang. Muhim raqam va ismlarni tekshiring, chunki tanish aniqligi skaner sifatiga bog‘liq.',
      'Да. Выделите текст в любом просмотрщике PDF и скопируйте. Проверяйте важные цифры и имена: точность зависит от качества скана.',
    ],
  },
  {
    id: 'tool-searchable-pdf-3', group: 'tools', pages: ['searchable-pdf'],
    q: ['Will the pages look different?', 'Sahifalar ko‘rinishi o‘zgaradimi?', 'Изменится ли вид страниц?'],
    a: [
      'They keep their scanned look, stamps and signatures included. The text layer is invisible.',
      'Sahifalar skanerdagi ko‘rinishini, muhr va imzolari bilan birga saqlaydi. Matn qatlami ko‘rinmaydi.',
      'Страницы сохраняют вид скана вместе с печатями и подписями. Текстовый слой невидим.',
    ],
  },
  {
    id: 'tool-searchable-pdf-4', group: 'tools', pages: ['searchable-pdf'],
    q: ['Which languages work?', 'Qaysi tillar ishlaydi?', 'Какие языки поддерживаются?'],
    a: [
      'Uzbek, Russian and English, and English mixed with Russian or Uzbek. Choose the language of the document before you start.',
      'O‘zbek, rus va ingliz tillari, shuningdek ingliz tili rus yoki o‘zbek tili bilan aralash. Boshlashdan oldin hujjat tilini tanlang.',
      'Узбекский, русский и английский, а также английский вместе с русским или узбекским. Выберите язык документа перед запуском.',
    ],
  },

  // ── protect-pdf ──
  {
    id: 'tool-protect-pdf-1', group: 'tools', pages: ['protect-pdf'],
    q: ['What if I forget the password?', 'Parolni unutsam nima bo‘ladi?', 'Что, если я забуду пароль?'],
    a: [
      'We cannot recover it or open the file for you. Keep the unprotected original, or note the password somewhere safe, before you send the file.',
      'Biz uni tiklay olmaymiz va faylni ochib bera olmaymiz. Faylni yuborishdan oldin himoyasiz aslini saqlab qo‘ying yoki parolni xavfsiz joyga yozib oling.',
      'Мы не сможем его восстановить или открыть файл. Перед отправкой сохраните незащищённый оригинал или запишите пароль в надёжном месте.',
    ],
  },
  {
    id: 'tool-protect-pdf-2', group: 'tools', pages: ['protect-pdf'],
    q: ['How strong is the protection?', 'Himoya qanchalik kuchli?', 'Насколько надёжна защита?'],
    a: [
      'The PDF is encrypted with AES-256. Use a long password that is hard to guess: a short one is the weak point.',
      'PDF AES-256 bilan shifrlanadi. Topish qiyin bo‘lgan uzun parol tanlang: qisqa parol himoyaning zaif joyi.',
      'PDF шифруется по AES-256. Выбирайте длинный пароль, который трудно угадать: короткий пароль — слабое место.',
    ],
  },
  {
    id: 'tool-protect-pdf-3', group: 'tools', pages: ['protect-pdf', 'unlock-pdf'],
    q: ['Can I remove the password later?', 'Keyin parolni olib tashlasa bo‘ladimi?', 'Можно ли потом снять пароль?'],
    a: [
      'Yes, if you know it. Use Unlock PDF on the website, enter the current password and download an open copy.',
      'Ha, agar uni bilsangiz. Veb-saytdagi «PDF parolini olib tashlash» vositasida joriy parolni kiriting va ochiq nusxani yuklab oling.',
      'Да, если вы его знаете. Откройте на сайте «Снять пароль с PDF», введите текущий пароль и скачайте открытую копию.',
    ],
  },
  {
    id: 'tool-protect-pdf-4', group: 'tools', pages: ['protect-pdf'],
    q: ['Can other tools work on a protected PDF?', 'Boshqa vositalar himoyalangan PDF bilan ishlaydimi?', 'Работают ли другие инструменты с защищённым PDF?'],
    a: [
      'Not until it is unlocked. Merge, compress and the other tools ask you to remove the password first with Unlock PDF.',
      'Qulfdan chiqarilmaguncha yo‘q. Birlashtirish, siqish va boshqa vositalar avval «PDF parolini olib tashlash» bilan parolni olib tashlashni so‘raydi.',
      'Нет, пока PDF не разблокирован. Объединение, сжатие и другие инструменты попросят сначала снять пароль в «Снять пароль с PDF».',
    ],
  },

  // ── unlock-pdf ──
  {
    id: 'tool-unlock-pdf-1', group: 'tools', pages: ['unlock-pdf'],
    q: ['Can you open a PDF without the password?', 'Parolsiz PDF ni ochib bera olasizmi?', 'Можете ли вы открыть PDF без пароля?'],
    a: [
      'No. The tool only removes a password you enter. It does not guess or crack unknown passwords.',
      'Yo‘q. Vosita faqat siz kiritgan parolni olib tashlaydi. U nomaʼlum parollarni topmaydi va buzmaydi.',
      'Нет. Инструмент снимает только тот пароль, который вы вводите. Неизвестные пароли он не подбирает и не взламывает.',
    ],
  },
  {
    id: 'tool-unlock-pdf-2', group: 'tools', pages: ['unlock-pdf'],
    q: ['I forgot the password. What can I do?', 'Parolni unutdim. Nima qilay?', 'Я забыл пароль. Что делать?'],
    a: [
      'Ask whoever created or sent the file for the password or an unprotected copy. We cannot recover it.',
      'Faylni yaratgan yoki yuborgan odamdan parolni yoki himoyasiz nusxani so‘rang. Biz parolni tiklay olmaymiz.',
      'Попросите пароль или незащищённую копию у того, кто создал или прислал файл. Мы не можем восстановить пароль.',
    ],
  },
  {
    id: 'tool-unlock-pdf-3', group: 'tools', pages: ['unlock-pdf'],
    q: ['Is the content changed?', 'Mazmun o‘zgaradimi?', 'Меняется ли содержимое?'],
    a: [
      'No. Only the password protection is removed; pages, text and images stay the same.',
      'Yo‘q. Faqat parol himoyasi olib tashlanadi, sahifalar, matn va rasmlar o‘zgarmaydi.',
      'Нет. Снимается только защита паролем, страницы, текст и изображения остаются прежними.',
    ],
  },
  {
    id: 'tool-unlock-pdf-4', group: 'tools', pages: ['unlock-pdf'],
    q: ['Why do other tools ask me to unlock first?', 'Nega boshqa vositalar avval qulfni ochishni so‘raydi?', 'Почему другие инструменты просят сначала снять пароль?'],
    a: [
      'A locked PDF can’t be read until its password is entered. Unlock it here once, then use any other tool on the open copy.',
      'Qulflangan PDF parol kiritilmaguncha o‘qilmaydi. Uni bu yerda bir marta oching, so‘ng ochiq nusxa bilan istalgan vositadan foydalaning.',
      'Защищённый PDF нельзя прочитать без пароля. Снимите пароль здесь один раз и работайте с открытой копией в любом инструменте.',
    ],
  },

  // ── sign-pdf ──
  {
    id: 'tool-sign-pdf-1', group: 'tools', pages: ['sign-pdf', 'pdf-editor'],
    q: ['Is this a legal electronic signature?', 'Bu qonuniy elektron imzomi?', 'Это юридически значимая электронная подпись?'],
    a: [
      'No. It is an image of your signature placed on the page, not an electronic digital signature (ERI) with a certificate. Whether it is accepted depends on who receives the document.',
      'Yo‘q. Bu sahifaga qo‘yilgan imzongiz rasmi, sertifikatli elektron raqamli imzo (ERI) emas. U qabul qilinishi hujjatni oluvchiga bog‘liq.',
      'Нет. Это изображение вашей подписи на странице, а не электронная цифровая подпись (ЭЦП) с сертификатом. Примут ли её, решает получатель документа.',
    ],
  },
  {
    id: 'tool-sign-pdf-2', group: 'tools', pages: ['sign-pdf'],
    q: ['Can I sign a PDF on my phone or in Telegram?', 'Telefonda yoki Telegramʼda PDF imzolasa bo‘ladimi?', 'Можно ли подписать PDF с телефона или в Telegram?'],
    a: [
      'Yes. The PDF editor works in a phone browser and as a Telegram Mini App, with the same account.',
      'Ha. PDF muharriri telefon brauzerida ham, Telegram Mini App sifatida ham bitta hisob bilan ishlaydi.',
      'Да. Редактор PDF работает в браузере телефона и как Telegram Mini App с тем же аккаунтом.',
    ],
  },
  {
    id: 'tool-sign-pdf-3', group: 'tools', pages: ['sign-pdf'],
    q: ['Does signing use my weekly limit?', 'Imzolash haftalik limitni sarflaydimi?', 'Расходует ли подпись недельный лимит?'],
    a: [
      'Downloading the edited PDF uses one file task on the Free plan, which has 15 a week. Plus and Premium have no weekly file-task limit.',
      'Tahrirlangan PDF ni yuklab olish Free tarifida bitta fayl vazifasini sarflaydi, unda haftasiga 15 ta vazifa bor. Plus va Premium tariflarida fayl vazifalari uchun haftalik cheklov yo‘q.',
      'Скачивание отредактированного PDF расходует одну задачу на тарифе Free, где их 15 в неделю. На Plus и Premium недельного лимита на задачи с файлами нет.',
    ],
  },
  {
    id: 'tool-sign-pdf-4', group: 'tools', pages: ['sign-pdf'],
    q: ['Can I sign a password-protected PDF?', 'Parolli PDF ni imzolasa bo‘ladimi?', 'Можно ли подписать PDF с паролем?'],
    a: [
      'Remove the password first with Unlock PDF, sign the open copy, then add a password again with Protect PDF if you need one.',
      'Avval «PDF parolini olib tashlash» bilan parolni olib tashlang, ochiq nusxani imzolang, kerak bo‘lsa «PDF ga parol qo‘yish» bilan yana parol qo‘ying.',
      'Сначала снимите пароль в «Снять пароль с PDF», подпишите открытую копию, а затем при необходимости снова поставьте пароль.',
    ],
  },

  // ── fill-pdf-form ──
  {
    id: 'tool-fill-pdf-form-1', group: 'tools', pages: ['fill-pdf-form'],
    q: ['Does filling a form use my weekly limit?', 'Formani to‘ldirish haftalik limitni sarflaydimi?', 'Расходует ли заполнение формы недельный лимит?'],
    a: [
      'Downloading the filled PDF uses one file task on the Free plan: 15 a week, counted from Monday 00:00 Tashkent time. Plus and Premium have no weekly file-task limit.',
      'To‘ldirilgan PDF ni yuklab olish Free tarifida bitta fayl vazifasini sarflaydi: haftasiga 15 ta, hafta dushanba 00:00 dan (Toshkent vaqti) boshlanadi. Plus va Premium tariflarida haftalik cheklov yo‘q.',
      'Скачивание заполненного PDF расходует одну задачу на тарифе Free: 15 в неделю, отсчёт с понедельника 00:00 по Ташкенту. На Plus и Premium недельного лимита на задачи с файлами нет.',
    ],
  },
  {
    id: 'tool-fill-pdf-form-2', group: 'tools', pages: ['fill-pdf-form'],
    q: ['Does it work on a phone or in Telegram?', 'Telefonda yoki Telegramʼda ishlaydimi?', 'Работает ли это на телефоне или в Telegram?'],
    a: [
      'Yes. Open the form in your phone’s browser, or in the Telegram Mini App with the same account.',
      'Ha. Formani telefon brauzerida yoki o‘sha hisob bilan Telegram Mini App da oching.',
      'Да. Откройте форму в браузере телефона или в Telegram Mini App с тем же аккаунтом.',
    ],
  },
  {
    id: 'tool-fill-pdf-form-3', group: 'tools', pages: ['fill-pdf-form'],
    q: ['What if my PDF has no form fields?', 'PDF imda forma maydonlari bo‘lmasa-chi?', 'Что, если в моём PDF нет полей формы?'],
    a: [
      'Then it is a flat or scanned page. Use the editor’s text tool to type on top of the lines and boxes.',
      'Demak, bu tekis yoki skanerlangan sahifa. Qatorlar va katakchalar ustiga muharrirning matn vositasi bilan yozing.',
      'Значит, это «плоская» или отсканированная страница. Печатайте поверх строк и клеток инструментом добавления текста.',
    ],
  },
  {
    id: 'tool-fill-pdf-form-4', group: 'tools', pages: ['fill-pdf-form'],
    q: ['Can I change the answers later?', 'Javoblarni keyin o‘zgartirsa bo‘ladimi?', 'Можно ли потом изменить ответы?'],
    a: [
      'Yes. The fields stay editable in the downloaded PDF, so you or the recipient can correct them.',
      'Ha. Yuklab olingan PDF da maydonlar tahrirlanadigan bo‘lib qoladi, siz yoki oluvchi ularni tuzatishi mumkin.',
      'Да. В скачанном PDF поля остаются редактируемыми, и вы или получатель сможете их исправить.',
    ],
  },
] as const satisfies readonly FaqItem[]
