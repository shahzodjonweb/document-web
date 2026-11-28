/**
 * The AI PDF and AI Slides category picker on Create (StudioView, studio/CategoryList):
 * the words around the bot's lists. The categories' own names, lines, instructions and
 * examples come from the server (`GET /studio/categories`), in the page's language.
 * Uzbek is Latin only, with ‘ in o‘ and g‘.
 */
export const categoryEntries: Record<string, [string, string, string]> = {
  studioCatPdfLead: [
    'What do you need? Pick its kind: the structure and the title page follow it.',
    'Qanday hujjat kerak? Turini tanlang — tuzilishi va titul varag‘i shunga mos bo‘ladi.',
    'Какой документ нужен? Выберите тип — структура и титульный лист будут под него.',
  ],
  studioCatSlidesLead: [
    'What is the presentation for? Pick its kind: the slides are laid out for it.',
    'Taqdimot nima uchun kerak? Turini tanlang — slaydlar shunga qarab tuziladi.',
    'Для чего презентация? Выберите тип — слайды будут построены под него.',
  ],
  studioCatPdfKinds: ['Kinds of document', 'Hujjat turlari', 'Типы документов'],
  studioCatSlidesKinds: ['Kinds of presentation', 'Taqdimot turlari', 'Типы презентаций'],
  studioCatGroupPdfLead: ['Pick the kind of paper.', 'Hujjat turini tanlang.', 'Выберите тип документа.'],
  studioCatGroupSlidesLead: [
    'Pick the kind of event.',
    'Tadbir turini tanlang.',
    'Выберите тип мероприятия.',
  ],
  studioCatPdfFiles: [
    'With any kind you can add the teacher’s plan or your sources as a PDF, Word or TXT file.',
    'Istalgan turga o‘qituvchining rejasini yoki manbalaringizni PDF, Word yoki TXT faylda qo‘shishingiz mumkin.',
    'К любому типу можно добавить план преподавателя или свои источники файлом PDF, Word или TXT.',
  ],
  studioCatSlidesFiles: [
    'With any kind you can add a text, a plan or sources as a PDF, Word or TXT file.',
    'Istalgan turga matn, reja yoki manbalarni PDF, Word yoki TXT faylda qo‘shishingiz mumkin.',
    'К любому типу можно добавить текст, план или источники файлом PDF, Word или TXT.',
  ],
  studioCatOtherPdf: [
    'Any document: describe it yourself',
    'Istalgan hujjat: o‘zingiz yozib bering',
    'Любой документ — опишите его сами',
  ],
  studioCatOtherSlides: [
    'Any presentation: describe it yourself',
    'Istalgan taqdimot: o‘zingiz yozib bering',
    'Любая презентация — опишите её сами',
  ],
  studioCatOtherGroup: ['Describe it yourself', 'O‘zingiz yozib bering', 'Опишите сами'],
  studioCatBack: ['All kinds', 'Barcha turlar', 'Все типы'],
  studioCatDescribe: ['Description', 'Tavsif', 'Описание'],
  studioCatAddFile: ['Add a file', 'Fayl qo‘shish', 'Добавить файл'],
  studioCatFileKinds: ['PDF, Word or TXT', 'PDF, Word yoki TXT', 'PDF, Word или TXT'],
  studioCatFileKind: [
    'This kind takes PDF, Word or TXT files only.',
    'Bu turga faqat PDF, Word yoki TXT fayl qo‘shiladi.',
    'Этот тип принимает только файлы PDF, Word или TXT.',
  ],
  studioCatExample: ['Example: tap to use it', 'Namuna — qo‘yish uchun bosing', 'Пример — нажмите, чтобы вставить'],
  studioCatCreatePdf: ['Create the document', 'Hujjat yaratish', 'Создать документ'],
  studioCatCreateSlides: ['Create the slides', 'Taqdimot yaratish', 'Создать слайды'],
  studioCatGone: [
    'This kind is not offered any more. Pick another one, or describe the document yourself under Other.',
    'Bu tur endi yo‘q. Boshqasini tanlang yoki «Boshqa» bo‘limida hujjatni o‘zingiz yozib bering.',
    'Этот тип больше не предлагается. Выберите другой или опишите документ сами в пункте «Другое».',
  ],
}
