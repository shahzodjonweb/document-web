# DocMaster keyword map (uz / ru / en)

Status: SEO proposal, 2026-11-10. Companion files: `meta.json` (titles, descriptions, H1s),
`internal-linking.md`, `structured-data.md`, `redirects.json`, `launch-checklist.md`.

## 1. Method and limits

- **Evidence used:** Google Autocomplete with `gl=uz` (hl=uz, ru, en) and Yandex Suggest with
  `lr=10335` (Tashkent), both pulled on 2026-11-10 for ~110 seed phrases; competitor titles and
  H1s (iLovePDF, Smallpdf, PDF24, Gamma); my working knowledge of Wordstat patterns for RU/UZ.
- **No absolute volumes.** There was no Wordstat / Keyword Planner account in this session. Demand
  is given as a tier (**H** high, **M** medium, **L** low) judged from how early and how broadly a
  phrase autocompletes. Before launch, pull real numbers from Yandex Wordstat (region
  Uzbekistan) and Google Keyword Planner (Uzbekistan) and adjust the primaries if a secondary wins.
- **Spelling variants.** Uzbek users rarely type ‘ or ʼ. Autocomplete returns `o tkazish`,
  `o'tkazish`, `bo lish`, `sun iy` (apostrophe dropped or replaced by a space). On-page text uses
  the correct `o‘ g‘` (U+2018) and `ʼ` (U+02BC); the variants below go in keyword lists, FAQ
  phrasing checks and Search Console filters, never as visible misspellings. Google folds most
  apostrophe variants together; Yandex is less reliable, so the variants matter more there.
- **Spaced suffixes.** Users type `pdf ni wordga`, `word ni pdf ga`, `pdf ga parol`. Titles use the
  spaced form (`PDF ni Word ga`) because it mirrors queries; keep it consistent site-wide.
- **Uzbek Cyrillic** queries exist but are small (`пдф бирлаштириш`, `реферат тайёрлаш`,
  `резюме тайёрлаш`, `презентация тайёрлаш`). Content stays Latin-only as required; no Cyrillic
  pages. Russian pages pick up some of this traffic.

## 2. Findings

1. **Uzbek tool searches are verb-first and use three verbs interchangeably:** `aylantirish`
   (convert) dominates for format conversion (`pdf ni wordga aylantirish` is the top completion,
   ahead of `o tkazish` and `o zgartirish`); `qilish` (make) dominates for images
   (`rasmni pdf qilish`, `rasmlarni pdf qilish`, `word ni pdf qilish`); `o‘tkazish` is third.
   Titles use the dominant verb and H1/description carry the second one.
2. **Uzbek "bot" intent is strong and unique to this market:** `rasmni pdf qilish bot`,
   `rasmni pdf qilish telegram bot`, `rasmlarni pdf qiladigan bot`, `referat tayyorlash bot`,
   `referat tayyorlash bot bepul`, `slayd tayyorlash bot`, `slayd tayyorlash bot telegram`,
   `taqdimot tayyorlash bot`, `pdf bot telegram`. No global competitor answers these. Each
   matching page mentions the Telegram bot in body copy and FAQ, and `/telegram` owns
   `pdf bot telegram`.
3. **Global leaders have no Uzbek pages.** `tools.pdf24.org/uz/merge-pdf` serves the English
   page ("Merge PDF - 100% free & online"), iLovePDF lists no Uzbek locale, Smallpdf neither.
   Uzbek autocomplete still shows brand navigation (`i love pdf birlashtirish`,
   `pdf birlashtirish 24`), so users find them by brand and get English UI. A native Uzbek page
   per tool is DocMaster's clearest opening. Sources:
   [PDF24 /uz/merge-pdf](https://tools.pdf24.org/uz/merge-pdf), [iLovePDF ru](https://www.ilovepdf.com/ru/merge_pdf).
4. **Russian tool SERPs are saturated** by iLovePDF ("Объединить PDF файлы онлайн. Бесплатный
   сервис для слияния PDF") and Smallpdf ("Инструмент слияния PDF - объединяйте PDF-файлы онлайн
   бесплатно"), and Yandex suggest literally contains iLovePDF's title
   (`объединить pdf файлы онлайн бесплатный сервис для слияния pdf`). Expect RU tool pages to rank
   slowly; RU AI pages (`реферат нейросеть`, `презентация нейросеть`) are the better RU bet.
   Sources: [iLovePDF ru](https://www.ilovepdf.com/ru/merge_pdf), [Smallpdf ru](https://smallpdf.com/ru/merge-pdf).
5. **"Бесплатно" / "bepul" / "free" modifiers are everywhere** (`сжать pdf онлайн бесплатно`,
   `pdf ni wordga aylantirish bepul`, `rezyume tayyorlash bepul`). DocMaster can truthfully say it
   starts free / has a Free plan; it must not say unlimited or 100% free. `без регистрации` /
   `ro‘yxatdansiz` is also common and **cannot** be targeted (the workspace requires sign-in).
6. **Size-target modifiers for compress:** `сжать pdf до 1 мб / 2 мб / 5 мб`,
   `compress pdf to 200kb`, `jpg pdf 200kb / 100 kb`, `pdf mb siqish`. These come from government
   and university upload portals. Mention typical portal limits in the FAQ, without promising a
   target size.
7. **AI slides in Uzbek:** `prezentatsiya tayyorlash`, `taqdimot tayyorlash`, `slayd tayyorlash`
   are three near-equal head terms, each with `ai`, `sun iy intellekt`, `sayt`, `bot`, `telefonda`
   completions. Gamma has a localized Uzbek landing (`gamma.app/uz/ai-presentation-maker`), the
   only serious native-language competitor seen. Source:
   [Gamma uz](https://gamma.app/uz/ai-presentation-maker).
8. **CV in Uzbek:** `rezyume tayyorlash` > `rezyume namuna` > `rezyume yaratish` (the last only
   completes late). `cv tayyorlash`, `obyektivka` (a state-format personnel form, a separate
   intent DocMaster does not claim to produce) and `ma’lumotnoma` are adjacent. Primary is
   `rezyume tayyorlash`, not `rezyume yaratish` as the brief guessed.
9. **Student writing intent is large in both languages:** uz `referat tayyorlash`
   (+ `bot`, `ai`, `sun iy intellekt`, `xizmati`, `rus tilida`), `mustaqil ish tayyorlash`,
   `mustaqil ish tayyorlovchi sayt`, `mustaqil ish ai`, `kurs ishi tayyorlash`, `esse yozish`;
   ru `реферат нейросеть` (+ `онлайн`, `бесплатно`, `на 10/15 страниц`), `написать реферат с
   помощью ии`, `сделать реферат онлайн`, `доклад нейросеть`. Much of the Uzbek head volume
   (`referat namuna`, `referat yuzi`, `mustaqil ish namuna`) is informational (samples, cover page
   format), which a generator page can partly capture with a format section.
   Source on what a mustaqil ish is in Uzbek universities: [infoedu.uz guide](https://infoedu.uz/mustaqil-ish-qanday-yoziladi-toliq-qollanma).
10. **Sign PDF in Russian skews to qualified e-signature** (`подписать pdf электронной
    подписью`, `... электронная подпись документов`). DocMaster places a signature image only, so
    the page must say so and should not chase ЭЦП terms. Uzbek `pdf imzo` returns no completions:
    low demand; keep the page for RU/EN and editor discovery.
11. **Unlock intent:** uz `pdf qulfini ochish`, `pdf parolini ochish`, `himoyalangan pdf faylni
    ochish`, also `pdf parolini buzish` (cracking). Target the first three; state plainly that
    unknown passwords are not cracked (also protects against unhappy users and policy risk).
12. **Structured data:** Google removed HowTo rich results (2023) and stopped showing FAQ rich
    results on 7 May 2026; details and sources in `structured-data.md`.

## 3. Recommendation: dedicated referat / mustaqil ish page

**Yes — add `/{locale}/ai/referat` (uz + ru required, en optional).** Draft meta is in
`meta.json` under `ai-referat` (marked `"proposed": true`; it is not yet in `pages.json`).

- Why a separate page and not `/ai/documents`: the head terms differ from "document generator"
  in both languages (`referat tayyorlash`, `mustaqil ish tayyorlash`, `реферат нейросеть`), the
  searchers are students with a specific format expectation (reja/plan, kirish, asosiy qism,
  xulosa, adabiyotlar; title page), and RU suggest shows page-count intent (`на 10/15 страниц`) that
  maps to the real 35-page cap. A generic "AI document" page will not rank for these.
- Slug `referat` (not English) is a deliberate exception to the English-slug rule: it is the
  word both uz and ru users type, and the same in both. For en, either publish the same route with
  "AI report writer" copy, or omit en and declare hreflang for uz/ru only (x-default uz).
- Content: what the generator produces (structure, languages, up to 35 pages, AI edits), a sample
  structure, title-page note (only what the product really does), a short "how to use it
  responsibly" note (check your institution's rules, treat the output as a draft, verify facts and
  sources). Link to `/ai/documents`, `/ai/slides` ("make slides for the defence"), `/guide`,
  `word-to-pdf`, `pdf-editor`.
- Risk: academic-integrity complaints and possible manual review. Keep wording to "tayyorlash /
  qoralama / подготовить черновик", never "sotib olish / купить реферат / antiplagiat bypass",
  and do not promise originality or plagiarism-check scores.
- `mustaqil ish` rides on the same page (H2 + FAQ + title secondary). `kurs ishi` / `курсовая` is
  out of scope (35-page cap and formal requirements) — do not target.

## 4. Keyword table per page

Columns: primary keyword, secondaries (3–6), intent (T transactional / I informational /
N navigational), tier, notes. Uzbek variants after `≈` are spellings users type.

### home `/`
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf bilan ishlash | pdf vositalari; pdf onlayn; pdf qilish; sunʼiy intellekt hujjat ≈ sun iy intellekt; docmaster | N/T | M |
| ru | pdf онлайн | pdf инструменты; работа с pdf онлайн; нейросеть для документов; docmaster; pdfmaster | N/T | M |
| en | pdf tools online | online pdf tools; ai documents; pdf and ai; docmaster | N/T | L |

Notes: home is a brand + hub page; real traffic comes from leaf pages. Include "DocMaster
(formerly PDF Master)" in body copy so brand searches for `pdf master bot` / `pdfmaster` match
during the transition.

### tools-index `/tools`
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf vositalari | pdf fayl bilan ishlash; pdf konvertor; pdf ni aylantirish ≈ pdf aylantirish | T | L |
| ru | pdf инструменты онлайн | конвертер pdf; все инструменты pdf; pdf онлайн бесплатно | T | M |
| en | pdf tools | pdf converter; all pdf tools; online pdf tools | T | L |

### merge-pdf
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf birlashtirish | pdf fayllarni birlashtirish; pdf fayllarni birlashtirish online; ikki pdf birlashtirish; pdf hujjatlarni birlashtirish; pdf jpg birlashtirish | T | H |
| ru | объединить pdf | объединить pdf файлы в один; объединить pdf онлайн бесплатно; объединить pdf и jpg; соединить pdf; склеить pdf | T | H |
| en | merge pdf | merge pdf files; combine pdf; merge pdf online free; merge pdf and jpg | T | H |

Notes: "pdf + jpg" merge is a real sub-intent; FAQ should say whether images can be mixed in
(if not, link `jpg-to-pdf` first, then merge).

### compress-pdf
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf siqish | pdf hajmini kichraytirish; pdf hajmini kamaytirish; pdf faylni siqish; pdf siqish online ≈ onlayn; pdf mb siqish | T | H |
| ru | сжать pdf | сжать pdf онлайн; уменьшить размер pdf; сжать pdf до 1 мб; сжать pdf без потери качества; сжать pdf файл | T | H |
| en | compress pdf | reduce pdf size; compress pdf to 1mb; compress pdf online free; shrink pdf | T | H |

Notes: never promise a target size ("до 1 МБ") unless the tool lets the user pick one.

### split-pdf
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf ajratish | pdf fayllarni ajratish; pdf ni bo‘lish ≈ pdf bo lish; pdf faylni kesish; pdf ni ajratish | T | M |
| ru | разделить pdf | разделить pdf на страницы; разделить pdf на части; разделить pdf онлайн; разбить pdf | T | H |
| en | split pdf | split pdf pages; split pdf into multiple files; split pdf online free | T | H |

### extract-pdf-pages
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf sahifalarini ajratib olish | pdf ajratib olish; pdf varaqlarini ajratish; pdf dan sahifa olish | T | M |
| ru | извлечь страницы из pdf | извлечь страницы из pdf онлайн; вырезать страницы из pdf; сохранить отдельные страницы pdf | T | M |
| en | extract pages from pdf | extract pdf pages; save pages from pdf; pdf page extractor | T | M |

Notes: overlaps `split-pdf` in uz (`ajratish` = split *and* extract). Keep the H1s distinct
(split = into parts, extract = pick pages) and cross-link.

### delete-pdf-pages
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf sahifalarini olib tashlash | pdf sahifasini o‘chirish ≈ o chirish, ochirish; pdf sahifasini olib tashlash; pdf dan sahifa o‘chirish | T | M |
| ru | удалить страницы из pdf | удалить страницы из pdf онлайн; удалить страницу из pdf бесплатно; убрать страницы из pdf | T | H |
| en | delete pages from pdf | remove pages from pdf; delete pdf pages online | T | M |

### reorder-pdf-pages
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf sahifalarini almashtirish | pdf sahifalari tartibini o‘zgartirish ≈ o zgartirish; pdf sahifalarini joylashtirish | T | L |
| ru | поменять страницы местами pdf | изменить порядок страниц pdf; переставить страницы в pdf; поменять страницы местами в pdf онлайн | T | M |
| en | reorder pdf pages | rearrange pdf pages; organize pdf pages; change page order pdf | T | M |

### rotate-pdf
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf aylantirish | pdf sahifalarini burish; pdf ni burish; pdf ni to‘g‘irlash | T | M |
| ru | повернуть pdf | повернуть pdf и сохранить; повернуть страницу pdf онлайн; повернуть pdf на 90 градусов | T | M |
| en | rotate pdf | rotate pdf pages; rotate pdf and save; turn pdf pages | T | M |

Notes: **ambiguity** — in uz `pdf aylantirish` also means "convert PDF" (`pdf wordga aylantirish`).
Use `burish` in H1 and description; do not expect strong uz rankings from the primary alone.

### jpg-to-pdf
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | rasmni pdf qilish | rasmlarni pdf qilish; rasmni pdf ga aylantirish; rasmni pdf qilish telegram bot; jpg pdf qilish; telefonda rasmlarni pdf qilish; rasmni pdf ga o‘tkazish ≈ o tkazish | T | H |
| ru | jpg в pdf | фото в pdf; картинку в pdf; jpg в pdf онлайн бесплатно; несколько фото в один pdf; фото в pdf на андроид | T | H |
| en | jpg to pdf | image to pdf; photo to pdf; png to pdf; jpg to pdf high quality | T | H |

Notes: the strongest uz page. Lead with the bot (phone users) and the automatic straightening of
document photos. `rasmlarni pdf qiladigan bot` belongs here and on `/telegram`.

### pdf-to-jpg
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf ni rasmga aylantirish | pdf ni rasm qilish; pdf ni jpg ga aylantirish; pdf dan rasm olish | T | M |
| ru | pdf в jpg | pdf в jpg онлайн; pdf в картинку; конвертировать pdf в jpg; pdf в jpg высокое качество | T | H |
| en | pdf to jpg | pdf to image; pdf to png; convert pdf to jpg online | T | H |

### word-to-pdf
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | word ni pdf ga aylantirish | word ni pdf qilish; wordni pdf qilish online; word faylni pdf ga o‘tkazish ≈ o tkazish; word dan pdf ga o‘tkazish; docx pdf | T | H |
| ru | word в pdf | ворд в пдф; word в pdf онлайн бесплатно; docx в pdf; конвертировать word в pdf | T | H |
| en | word to pdf | docx to pdf; word to pdf converter; doc to pdf | T | H |

Notes: RU needs the transliterated `ворд в пдф` in body copy and FAQ (separate Yandex demand).

### powerpoint-to-pdf
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | powerpoint ni pdf ga aylantirish | prezentatsiyani pdf ga o‘tkazish; taqdimotni pdf qilish; ppt pdf; pptx ni pdf ga | T | L |
| ru | ppt в pdf | презентацию в pdf; pptx в pdf; ппт в пдф; конвертировать презентацию в pdf | T | M |
| en | powerpoint to pdf | ppt to pdf; pptx to pdf; presentation to pdf | T | M |

### pdf-to-word
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf ni wordga aylantirish | pdf ni word qilish; pdf ni wordga aylantirish bepul; pdf ni wordga aylantirish online; pdf ni wordga o‘tkazish ≈ o tkazish; pdf ni wordga o‘zgartirish ≈ o zgartirish | T | H |
| ru | pdf в word | пдф в ворд; pdf в word онлайн бесплатно; pdf в word с распознаванием текста; конвертер pdf в word | T | H |
| en | pdf to word | pdf to docx; pdf to word converter; pdf to word with ocr | T | H |

Notes: `с распознаванием текста` / `with ocr` is a big sub-intent. If the converter does not
OCR scans, say so and link `ocr-pdf` / `searchable-pdf`.

### pdf-to-excel
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf ni excelga aylantirish | pdf ni excel ga o‘tkazish; pdf jadvalni excelga | T | L |
| ru | pdf в excel | pdf в excel онлайн бесплатно; конвертировать pdf в excel; pdf в xlsx | T | H |
| en | pdf to excel | pdf to xlsx; convert pdf table to excel | T | M |

### ocr-pdf
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | rasmdan matn olish | rasmdan matnni ajratib olish; pdf dan matn olish; skanerdan matn olish; ocr o‘zbek tilida | T | M |
| ru | распознать текст | распознать текст с фото; распознать текст с картинки; распознать текст pdf; распознавание текста онлайн | T | H |
| en | ocr pdf | extract text from image; image to text; ocr online | T | H |

Notes: Uzbek-language OCR is a real differentiator; say "o‘zbek tilidagi matnni ham taniydi" high
on the page. Do not claim handwriting.

### searchable-pdf
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | skanerlangan pdf ni matnga aylantirish | qidiriladigan pdf; skaner pdf matn | T | L |
| ru | pdf с распознаванием текста | сделать pdf с поиском; скан в pdf с текстовым слоем; pdf с распознаванием текста онлайн | T | M |
| en | searchable pdf | make pdf searchable; ocr pdf searchable; scanned pdf to text | T | M |

### protect-pdf
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf ga parol qo‘yish | pdf ni himoyalash; pdf faylga parol o‘rnatish | T | L |
| ru | поставить пароль на pdf | поставить пароль на pdf файл онлайн; защитить pdf паролем; зашифровать pdf | T | M |
| en | password protect pdf | protect pdf; encrypt pdf; add password to pdf | T | M |

### unlock-pdf
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf qulfini ochish | pdf parolini ochish; himoyalangan pdf faylni ochish; pdf paroli olib tashlash | T | L |
| ru | снять пароль с pdf | снять защиту с pdf; разблокировать pdf; снять пароль с pdf онлайн | T | M |
| en | unlock pdf | remove pdf password; unlock pdf online | T | M |

Notes: do not target `pdf parolini buzish` / `взломать пароль pdf`.

### sign-pdf
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf ga imzo qo‘yish | pdf imzolash; hujjatga imzo qo‘yish; pdf ga imzo rasmi | T | L |
| ru | подписать pdf | подписать pdf онлайн; поставить подпись в pdf; вставить подпись в pdf | T | H |
| en | sign pdf | sign pdf online; add signature to pdf | T | H |

Notes: avoid ЭЦП / ERI targeting; FAQ answers "is this a legal e-signature?" with a clear no.

### fill-pdf-form
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf formani to‘ldirish | pdf ariza to‘ldirish; pdf hujjatni to‘ldirish; pdf ga yozish | T | L |
| ru | заполнить pdf онлайн | заполнить pdf форму онлайн; заполнить pdf документ; написать текст в pdf | T | M |
| en | fill pdf form | fill pdf online; fill in pdf form; type on pdf | T | M |

### pdf-editor
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf tahrirlash | pdf faylni tahrirlash; pdf ichini o‘zgartirish ≈ o zgartirish; pdf yozuvni o‘zgartirish; pdf editor | T | M |
| ru | редактировать pdf | редактор pdf онлайн; редактировать pdf онлайн бесплатно; изменить текст в pdf; редактор pdf файлов | T | H |
| en | pdf editor | edit pdf online; edit pdf text; pdf editor online | T | H |

Notes: uz `pdf ichini o‘zgartirish`, `pdf yozuvni o‘zgartirish` = "edit text inside" — match
with the "edit existing text" capability.

### ai-hub `/ai`
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | sunʼiy intellekt hujjat tayyorlash ≈ sun iy intellekt, suniy intellekt | ai bilan hujjat; ai sayt; sunʼiy intellekt sayt | T/I | M |
| ru | нейросеть для документов | нейросеть для учёбы; нейросеть онлайн; ии для документов | T/I | M |
| en | ai document generator | ai writing tool; ai for documents | T | L |

### ai-documents `/ai/documents`
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | ai bilan hujjat tayyorlash | esse yozish ai; maqola yozish ai; hisobot tayyorlash; matn yozish sunʼiy intellekt | T | M |
| ru | нейросеть для написания текста | доклад нейросеть; эссе нейросеть; написать текст нейросетью; сделать доклад онлайн | T | H |
| en | ai document generator | ai essay writer; ai report generator; ai writer pdf | T | M |

Notes: if `/ai/referat` ships, keep referat/mustaqil ish terms off this page (avoid cannibalising);
`доклад` stays here.

### ai-referat `/ai/referat` (proposed)
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | referat tayyorlash | referat tayyorlash ai; referat tayyorlash bot; referat tayyorlash sunʼiy intellekt ≈ sun iy intellekt; mustaqil ish tayyorlash; mustaqil ish tayyorlovchi sayt; mustaqil ish ai | T | H |
| ru | реферат нейросеть | написать реферат с помощью ии; сделать реферат онлайн; реферат нейросеть бесплатно; реферат на 10 страниц нейросеть; самостоятельная работа нейросеть | T | H |
| en | ai report writer | ai essay generator; write a report with ai | T | L |

### ai-slides `/ai/slides`
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | prezentatsiya tayyorlash | taqdimot tayyorlash; slayd tayyorlash; prezentatsiya tayyorlash ai; slayd tayyorlash bot; taqdimot tayyorlash sunʼiy intellekt ≈ sun iy intellekt; prezentatsiya tayyorlash telefonda | T | H |
| ru | сделать презентацию нейросеть | презентация нейросеть онлайн; сделать презентацию онлайн; презентация с помощью ии; нейросеть для презентаций бесплатно на русском | T | H |
| en | ai presentation maker | ai slides generator; ai ppt maker; ai presentation maker powerpoint | T | M |

Notes: uz has three equal synonyms; title carries `taqdimot`, H1 carries `prezentatsiya`, body
and FAQ carry `slayd`. Primary keyword stays `prezentatsiya tayyorlash` (widest completions).
`.pptx` editability and 110 designs are the differentiators vs Gamma.

### ai-cv `/ai/cv`
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | rezyume tayyorlash | rezyume yaratish; cv tayyorlash; rezyume tayyorlash bepul; rezyume namuna; rezyume tayyorlash telefonda; rezyume tayyorlash rus tilida | T | H |
| ru | создать резюме | создать резюме онлайн; резюме нейросеть; составить резюме через нейросеть; конструктор резюме; создать резюме в формате pdf | T | H |
| en | ai cv maker | ai resume builder; cv maker; resume from linkedin | T | M |

Notes: `rezyume namuna` / `rezyume shablon` (samples, templates) — show the 50 template
thumbnails. Not `obyektivka`.

### guide `/guide`
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | ai uchun so‘rov yozish | prompt yozish; sunʼiy intellektga savol berish | I | L |
| ru | как составить запрос для нейросети | промпт для презентации; как написать промпт | I | M |
| en | ai prompt guide | how to write a prompt; prompt examples | I | L |

### pricing
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | docmaster narxlari | docmaster tariflari; docmaster premium; pdf master narxi | N/T | L |
| ru | docmaster тарифы | docmaster цена; docmaster premium; pdf master подписка | N/T | L |
| en | docmaster pricing | docmaster plans; docmaster premium | N/T | L |

### telegram
| | Primary | Secondaries | Intent | Tier |
|---|---|---|---|---|
| uz | pdf bot telegram | rasmni pdf qilish bot; rasmlarni pdf qiladigan bot; slayd tayyorlash bot; referat tayyorlash bot; pdf master bot | T/N | M |
| ru | pdf бот телеграм | бот для pdf в телеграм; бот фото в pdf; бот для презентаций телеграм | T/N | M |
| en | pdf telegram bot | telegram bot pdf converter; telegram pdf editor | T/N | L |

### invite / help / about / legal / 404
Brand-navigational only (`docmaster taklif`, `docmaster yordam`, `docmaster kontakt`,
`docmaster oferta`, …). No keyword targeting beyond the page name. 404 is `noindex`.

## 5. Cannibalisation guardrails

| Pair | Rule |
|---|---|
| split-pdf vs extract-pdf-pages (uz `ajratish`) | split = "qismlarga bo‘lish"; extract = "kerakli sahifalarni ajratib olish" |
| rotate-pdf vs conversions (uz `aylantirish`) | rotate uses `burish` in H1/description |
| ocr-pdf vs searchable-pdf | OCR = get text out; searchable = keep the scan, add a text layer |
| pdf-editor vs sign-pdf vs fill-pdf-form | editor = general; sign/fill own their verbs; all link to editor |
| ai-documents vs ai-referat | referat/mustaqil ish only on ai-referat; доклад/эссе/hisobot on ai-documents |
| ai-hub vs ai-* | hub targets the generic "AI for documents"; each service owns its noun |
