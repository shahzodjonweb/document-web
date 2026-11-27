/**
 * The app opened inside Telegram (a Mini App): its Profile screen, its Home's bot-menu
 * shortcuts and saving a result through Telegram (docs/design/MINI_APP.md). The bot's
 * own words are reused where the bot has them (telegram/invites.py: Free gift).
 */
export const miniAppEntries: Record<string, [string, string, string]> = {
  navProfile: ['Profile', 'Profil', 'Профиль'],
  language: ['Language', 'Til', 'Язык'],
  profileMore: ['More', 'Yana', 'Ещё'],
  profileSeePlans: ['Plans and payment', 'Tariflar va to‘lov', 'Тарифы и оплата'],
  profileInviteHint: [
    'Invite friends and get Plus for free',
    'Do‘stlarni taklif qiling va Plus tarifini bepul oling',
    'Приглашайте друзей и получайте Plus бесплатно',
  ],
  profileSettingsHint: [
    'Output language, paper size and sign-in methods',
    'Natija tili, qog‘oz o‘lchami va kirish usullari',
    'Язык результата, формат бумаги и способы входа',
  ],
  profileEditorHint: [
    'Open a PDF and change it page by page',
    'PDF faylni oching va sahifama-sahifa o‘zgartiring',
    'Откройте PDF и измените его постранично',
  ],
  profileGuideHint: [
    'How to describe a document so it comes out right',
    'Hujjat to‘g‘ri chiqishi uchun uni qanday tasvirlash kerak',
    'Как описать документ, чтобы он получился правильно',
  ],
  profileSupport: ['Contacts and support', 'Aloqa va yordam', 'Контакты и поддержка'],
  profileSupportHint: [
    'Write to a person, read the answers to common questions',
    'Odamga yozing, ko‘p beriladigan savollar javoblarini o‘qing',
    'Напишите человеку, прочитайте ответы на частые вопросы',
  ],
  tgChooseFiles: ['Choose your files', 'Fayllaringizni tanlang', 'Выберите файлы'],
  tgFreeGift: ['Free gift', 'Bepul sovg‘a', 'Бесплатный подарок'],
  saveToPhone: ['Save to phone', 'Telefonga saqlash', 'Сохранить на телефон'],
  savedToPhone: ['Saved', 'Saqlandi', 'Сохранено'],
  resultInChat: [
    'The file is also in your chat with the bot.',
    'Fayl bot bilan chatingizda ham bor.',
    'Файл также есть в вашем чате с ботом.',
  ],
}
