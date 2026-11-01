# Editor v2: UI specification

Status: approved 2026-11-01. This is the design the editors are built to. It came out of a UX brief
(`document-platform/docs/product/editor-ux-brief.md`), three complete designs, three judges and a
constraint check.

## Owner decisions and engineering calls that override the text below

Where the body of this document says otherwise, these win:

1. **One file task per draft, counted once.** Later sends of the same draft that week use no task.
   (Overrides departure D6 and open decision 11.)
2. **R1 ships Black out** with a drawn box and per-page imaging behind an "I understand" tick; the
   bar has four tabs in R1 (Sign, ＋ Add, Black out, Pages). Search, presets and vector black-out
   arrive with the text layer in R2. (Overrides "today's redact tool hides until R2".)
3. **After Send** the app shows the accepted state for about 0.7 s and closes; it stays open only when
   the week's allowance is 80 % used. Share to a group is out of scope. (Closes open decision 9.)
4. **"Keep this signature on this phone" is off by default.** (Closes open decision 10.)
5. **Unresolved over-budget slide text blocks Send.** Review lists the slides with Pick another
   layout and Split into two slides. (Closes open decision 6.)
6. **Deck exports use the existing catalog id `export.generated_pptx`**, not a new `deck.export`.
7. **Free work runs in one lane**: table `EditorTask`, command `runeditor`, service `editor`
   (not `EditorCheck` / `runchecks`), and exports stay on the existing worker (no second lane).
8. **Page commands are `rotate_page`, `delete_page` and `reorder`** (not `page_rotate*`, `page_move*`,
   `page_delete*`).
9. **Size caps**: one measure, the UTF-8 bytes of compact JSON. Draft 100,000 bytes and 100 commands;
   the editor PATCH accepts a 128 KiB body. (Overrides the 30,000-byte cap in 4.6.)
10. **MainButton while typing**: kept while it stays usable above the iOS keyboard; if it cannot, the
    dock's Done stays and F1 counts 5 taps. (Closes open decision 1.)
11. **Swipe lock** applies while dragging or drawing and while a sheet is open. (Closes open decision 2.)
12. **Labels at 320 px** are measured in ru and uz at font scale 1.3 before they freeze. (Open decision 4.)

---

Base: sheet plus decided grafts and drops; targets from UX brief revision 2. dw = document-web, dp = document-platform; R1–R3 = release; * = new.

## 1 Summary and principles

One editor for PDFs and our generated decks, phone inside Telegram first. A tap opens the thing’s own form: a docked 16 px field for words, a labelled sheet below the page for a signature, picture, page or slide; every move has a button; drag is a shortcut. MainButton "Send to chat" opens Review, whose Confirm states the cost. R1: decks, PDF marks and page changes; R2: a PDF’s own words and Black out, through PdfCraft with the overlay engine as fallback.

Principles: fixes use no AI edits (✏️ none, ✨ one); each send is one quote, one job, one file task, stated before Confirm; forms, not modes; one filled primary; refuse at the tap; pinned photos, variants and seed; typed words never cut.

Departures: D1 compact labelled object forms, not "Close plus four verbs"; D2 the text dock replaces the top bar; D3 at most four tabs per bar (open decision 4); D4 a deck’s + adds a "Title and lines" slide; D5 an Adjust snackbar after placing; D6 1 file task per send, not per draft (open decision 11).

## 2 Frame and navigation

On editor routes inside Telegram or below 980 px, app.vue drops .sidebar, .app-topbar and .mobile-nav and locks html and body to var(--tg-stable-h); only the stage scrolls. Deep links skip loading plans and studio (app.vue:146, watcher :47–50). Decks open at /app/editor/deck/{draftId}*, matched before /app/editor (PageView.vue:100–101).

|Zone|390 (web view ≈656)|320×568|
|---|---|---|
|Top bar|52: name, save icon ✓/↑/✕, not-sent dot, Undo, Redo, More; HTML Back below 6.1|52|
|Stage|≈548, notice strip 40–64 on top; A4 page 382×540|A4 312 wide|
|Bar|56; 4 × 97, R1 PDF 3 × 130|4 × 76, 3 × 106|
|Compact sheet|≤295 (45%)|≤200, scrolling; secondary rows lower|
|Dock, keyboard up|164–212; band 241, 185 if the MainButton stays|156; band 95|
|Primary|MainButton ≈86; browser fallback 56 + safe area|same|

BackButton pops field, sheet, then Pages or Slides; at the root Telegram shows Close. The page chip "2 / 12" opens Pages; decks move by ‹ Slide n of N ›, the strip or a swipe. More: All changes, Background picture, Zoom, Show tips again, Start over, Expand (Telegram Desktop, 8.0+). var(--tg-stable-h, 100dvh) replaces 100vh at extended.css:768, 889, 942, 1140, 1629; the .editor-actionbar offset (:1657) goes.

## 3 Screens

Where §9 has a string, wireframes use it verbatim.

S1 pdf-idle-390 (R1): MainButton inactive until a change; Black out joins in R2.
```
|Shartnoma_2024.pdf ✓          [↶][↷][≡]
|(i) You can sign, add text and pictures, and change pages. [x]
|(2/12) |Imzo: _______  Sana: _______|
|Tap where a signature, date or text should go
|[✍ Sign]     [＋ Add]     [▦ Pages]
```
S2 pdf-text-390 (R2): same font, so no size or colour.
```
|[Cancel]  Change words  [Done]  [Ijarachi: Karimova Dilnoza R.|]
|[↑ Line][↓ Line][▨ Black out][Highlight]   band 241 (185)
```
S3 pdf-object-390 (R1): ring --page-ring/--page-halo; one 44 px handle; form 228.
```
|Signature, page 2                    [x]
|Size [−] 100% [+]   Move [←][↑][↓][→]
|Exact position, mm ▸
|[Replace]  [Duplicate]  [Delete]
```
S4 pdf-pages-390 (R1): three columns (two below 360); page sheet 224.
```
|[1 ⠿] [2 ↻90° ⠿] [Removed Restore]
|Page 5 of 12                         [x]
|[↺ Turn left][Turn right ↻][↑ Earlier][Move][Later ↓][Delete page]
```
S5 pdf-blackout-390 (R2): matches outlined, confirmed boxes hatched; sheet 295.
```
|[Find a word or number] (Phone numbers)(Card)(Passport)(PINFL)
|[✓] p.1 Tel: +998 90 123 45 67      MainButton [Black out all 2]
```
S6 review-390 (R1): modal ≤75%; Confirm waits for the cost; over 50 MB arrives as a link.
```
|Page 3  Signature, date              [>]
|Pages 12 → 11; 1.2 MB; version 2
|Uses 1 file task; 11 of 15 left
|Nothing is used if it fails. Available until tomorrow 14:20
MainButton [Confirm · 1 file task]
```
S7 deck-slide-390 (R1): server PNG; regions outlined at first view and on press.
```
|Aral_Sea · until 18:40 ✓      [↶][↷][≡]
||The Aral Sea crisis :[photo]:|
|[‹] Slide 3 of 12 [›]   [1][2][(3)][＋][4] →
|[▣ Pictures][≡ Slides][◐ Design][✨ Ask AI]
```
S8 deck-field-390 (R1): budget in the header; 16 px inputs.
```
|Slide 3 · Lines  4 of 6 lines   [mini]
|1 [Havo ifloslanishi|       ] [⋯]
|[+ Add line]        [Cancel] [Done]
```
S9 deck-slides-390 (R1): reordering; the strip only jumps.
```
|[1] cover 🔒 first
|===== [Put slide 7 here] =====
|[(7)] What can be done      [⠿]
|[?] Questions · 5 [Fewer] [Remove quiz]
|[↑ Earlier][Later ↓][Duplicate][Delete][＋ Add slide]
```
S10 check-320: keyboard 253, PDF dock 156, page band 95 (MainButton hidden); deck dock 44 + ≥111 + 44.

S11 desktop-1440 (R3): rail 132, canvas 908, panel 320; R1 keeps today’s shell.

S12 pdf-add-390 (R1): sheet 284 at a pin; items land there, form open.
```
|Add here                             [x]
|[~sig 1~] [~sig 2~] [+ New signature]
|[＋ Add text][Today’s date][Tick][Picture]
|[Highlight][Draw][Note][Fill in the form]
```
S13 sign-390 (R1): tap paper to place.
```
|[~kept 1~] [~kept 2~] [✍ Draw new] [From a photo]
|[✓] Keep this signature on this phone
```
S14 deck-pictures-390 (R1): a check; editing goes on.
```
|[Add pictures to all slides]  Adding 3 of 12
|(● Photo)(○ Drawing)  This slide: [Another][Find more][From my phone][Remove]
```
S15 deck-cover-390 (R1): prefilled when remembered; nothing focused.
```
|Topic [Orol dengizi fojiasi]  Prepared by [Karimova D.]
|Checked by [Rasulova M.]  Group/Class [9-B]  School [21-maktab]
|[✓] Remember for my next decks
```
S16 deck-latin-390 (R1): after Done.
```
|Хаво ифлосланиши → Havo ifloslanishi
|[Switch to Latin letters]  [Keep as typed]
```
S17 deck-review-390 (R1): S6 for decks, over-budget slides first.
```
|Slide 7  6 words won’t show         [Show]
|Arrives as PowerPoint and PDF; 12 slides
```
S18 sending-390 (R1): closes 0.7 s after POST /jobs returns (open decision 9), unless 80% full; failure: editorSendFailed.
```
|⟳ Sending…  →  ✓ Accepted: the file will arrive in the chat.
|[Keep editing the sent file]
```

## 4 Selection and editing rules

4.1 Selection. A tap is a pointerup within 10 px and 350 ms. Order: own mark, text line (R2), file picture, empty paper ("Add here"). Pictures over 80% of the page are skipped (More → Background picture); a long press cycles stacked items; a cover title beats its photo. With a sheet open, a tap on paper only closes it.

4.2 Add versus change. In R1 the file’s words open "Add here" (open decision 3); in R2 a text box dropped on words asks "Change these words instead?". Hints retire after each task’s first success.

4.3 Changing words (R2). The selecting tap focuses the field in its own handler. A width bar in the line’s font: ≤10% longer sets letters closer; more offers "Cover and retype, smaller". Done runs PdfCraft text_edit as a check (§4.8) behind "Checking…". Lines refused at open show a dashed amber underline and open in Cover and retype, with Other ways (Change it in the document’s text; Make text editable). Typed words survive any refusal. Cover and retype: Noto Serif or Sans Bold at the line’s size on a sampled background, over a white redaction of uploaded digits.

4.4 Pictures and signatures. File pictures offer Replace and Remove; AI-made PDFs take pictures as render_pdf sections (execution.py:160). Up to three kept signatures stay on the device (DeviceStorage 9.0+, else localStorage); a placed one uploads at once as a 24 h input, so autosave and conflicts see it. Below 7.7 marks never drag. Duplicate copies every field (FloatBar.vue:45–49). R2: blanks (_ runs, "Imzo:", "Подпись:", "M.O‘.") open "Add here".

4.5 One draft, one job. POST /editor/documents returns the existing draft. Pages write page_rotate*, page_move* and page_delete* commands (FIELDS, editor.py:24–36; regenerate export_contract.py) instead of separate pdf.* jobs (useEditorPages.ts:137–172), never locked (PagesBoard.vue:17); marks keep source coordinates; deleting a page with marks asks first. One editor.execute applies overlays; rotate, reorder, delete; black-out (R2); the rendered check. Black out (R2) uses PdfCraft redact, checked for no extractable text in the boxes; on refusal the overlay engine images only boxed pages, named in Review behind [I understand]. It takes numbers whole and any apostrophe form. Jobs store editor_document_id or generation_draft_id, so Edit reopens the source draft, still undoable, and the send replaces the result. EditorDocument gains updated_at* and a device label* (editor_data, 409).

4.6 Size and cost. One measure, the UTF-8 bytes of json.dumps(commands, ensure_ascii=False, separators=(",", ":")), capped at 30,000 under the 32,768-byte body cap (core views.py:53–54) in the client meter (useEditorCommands.ts:62–65), PATCH (views.py:422) and quote (services.py:190; 30,100 with its wrapper); at most 100 commands. String 7 shows at 80 commands or 80% of the bytes; such a send ends on [Keep editing the sent file], a new EditorDocument on the result. Black out all and Change everywhere stop at the room left. Decks PATCH one slide at a time (/generation/drafts/{id}/sections/{sid}*). Quote once, at Review; if expired at Confirm, re-quote, with a banner only if the price changed; retries reuse the quote and Idempotency-Key.

4.7 Refuse at the tap. An inspect-for-editing check at open, cached by sha256, returns per page overlay, text-edit and redact support, image boxes, field rectangles, scans and digital signatures; page boxes are normalised (editor.py:105). POST /editor/documents answers password_protected* instead of unsupported_file (studio views.py:407); Shell.vue:43–55 shows refusals as states, not the launcher. Tools switch off per page with the reason; export-time refusals ring the change before Send.

4.8 Checks*. An unbilled service built like the CV reader (apps/studio/cv/reads.py, runreader): own table (EditorCheck*), lease and container (runchecks*), and a warm soffice under its own limits (engine.py:689–709). It serves inspect-for-editing, PdfCraft checks, Add pictures, Find more and slide PNGs without Quote or Job rows, so nothing counts and update_draft never answers generation_running (domain.py:795). Exports get a second runworker lane, never behind AI generation (compose.yaml:81).

## 5 Deck editor (R1 unless marked)

Fields: Headline, Lines (≤ MAX_SLIDE_ITEMS = 8), Picture, Layout, Notes. Budgets count lines and letters (amber at 90%, red past 100%); over budget offers Split into two slides or Pick another layout, never cuts; Review lists unresolved slides (open decision 6). Cover details: 8 lines of 160 characters.

Pictures: "Add pictures to all slides" runs the existing Pixabay search and model pick as a check (≤ max_deck_images = 12; no AI edit), keeping slides that have pictures. Also Photo or Drawing (options.photo_style); per slide Another picture, Find more, Remove, From my phone.

Pinning: generation stores each slide’s photo as a FileAsset, 4 ranked candidates, deck_seed apart from the title (variants/__init__.py:195–197), each _variant (slides.py:962) and the font size; pinned variants get the fit trial (slides.py:895–897 skips it). Manual sends never call the model or photo_choice. Settled jobs extend the source GenerationDraft to the result’s expiry (domain.py:777).

Layout lists only fitting layouts; Design (R1 Should) reuses DesignPicker, saving through update_draft options (/setup refuses finished decks, studio views.py:216). The cover stays first; a closing Questions block offers Fewer questions and Remove quiz. Ask AI (R1 Should): ✨ This slide or Whole deck, presets including a language switch, cost above its button, Before/After.

Cyrillic to Latin: Cyrillic in an Uzbek deck’s committed field offers a free Switch to Latin letters preview (uzbek.py:36–99); kept text reaches artifact_violations as the user’s own, so script_policy never blocks a send.

Preview fidelity: check PNGs of the LibreOffice PDF in metric twins the image gains (Dockerfile:18–19): fonts-crosextra-carlito (the Calibri replacing Corbel), fonts-crosextra-caladea (Cambria), fonts-liberation2 (Arial), Gelasio (Georgia); Trebuchet MS, Candara and Constantia have none (open decision 7). Budgets use the same fonts (today Noto, slides.py:448). Warm soffice: p50 ≤2 s, p95 ≤5 s. Phones get PPTX plus PDF (deck.export*); browsers Download.

## 6 Telegram adapter (R1)

useTelegramApp.ts* is the only code touching window.Telegram.WebApp, absorbing ready, expand, colorScheme, haptics and close() from app.vue:107, 128, 140, CvSetupView.vue:21 and DeckSetupView.vue:55.
- Gates: BackButton and HapticFeedback 6.1 (below: HTML Back, no haptics); closing confirmation 6.2; disableVerticalSwipes 7.7; contentSafeAreaInset, requestFullscreen, shareMessage 8.0; DeviceStorage 9.0; hideKeyboard 9.1.
- MainButton: usePrimaryAction(layer, {text, enabled, busy, onPress}); the top layer drives setParams, showProgress and onClick/offClick; MainButtonFallback outside Telegram; offline, Send stays inactive.
- Viewport: viewportStableHeight → --tg-stable-h*; insets → --editor-safe-bottom*; the dock follows visualViewport. Below 600 px stable height the MainButton hides while typing; above, open decision 1.
- Closing confirmation only while unsaved (below 6.2, save on visibilitychange). disableVerticalSwipes is reference-counted with a 10 s safety release (open decision 2).
- Delivery*: POST /jobs sends origin "mini_app" (core views.py:258; Telegram-linked accounts only), which settle_job (services.py:296) and enqueue_notice (notifications.py:89, :160) treat like "bot". The bot posts botMaking on accept, edits it when work starts and replaces it with the file; failures use the existing notices (:22). close() waits for POST /jobs. Share to a group (Should): savePreparedInlineMessage, then shareMessage.
- Outside Telegram: HTML Back, beforeunload, localStorage, Download plus "Send to my Telegram". Rate limits key on the account, not REMOTE_ADDR (core views.py:59–67).

## 7 Components

|Component|File, class|Why (if new); states|R|
|---|---|---|---|
|EditorShell|Shell.vue, .editor-shell|loading, ready, pictures fallback, password, signed, scan, expired|R1|
|EditorTopBar*|TopBar.vue, .editor-topbar|phones need a 52 px row; saved, saving, not saved, not sent, expiring|R1|
|EditorSheet*|Sheet.vue, .editor-sheet on .more-sheet, .sheet-head, .sheet-body|.more-sheet is a modal nav dialog; compact, tall, docked, panel|R1|
|EditorTextForm*|TextForm.vue, .editor-dock|the inline textarea is under 16 px and the keyboard; new text, form value, deck field, refused|R1, R2|
|EditorAddSheet*|AddSheet.vue|one list, not pick-a-tool-then-click; anchored, placing|R1|
|EditorReviewSheet*|ReviewSheet.vue, .weekly-line, .retention-note|one Confirm for PDFs and decks; cost, sending, accepted, failed|R1|
|EditorSnackbar*, MainButtonFallback*|Snackbar.vue (.editor-snackbar), .button.primary.full|no Toast exists; one primary in browsers|R1|
|BlackOutSheet*, useEditorTextLayer*|.search-box, .category-tabs; composables/|no search black-out or text layer exists|R2|
|DeckEditor*, SlideView*, SlideStrip*, SlideList*, SlideFields*|deck/ (.deck-*), .outline-actions, .form-field, .slide-item, useSlideLayouts.ts|no deck editor exists; updating, failed, near limit, over, Latin preview|R1|
|Cover, Pictures, Layout, Design and Ask AI sheets*|deck/; DesignPicker from DeckSetupView.vue (.deck-grid, .deck-card)|remembered, adding n of 12, applying, Before/After|R1; Design, Ask AI Should|
|useTelegramApp*, useDeckSession*, useEditorSession|composables/|§6; one Undo history per document; valid-subset autosave|R1|
|Modified|ToolStrip.vue (.editor-toolpill), SignaturePad.vue, MarkLayer.vue (.editor-mark, .editor-handle), PageCanvas.vue, FloatBar.vue (.editor-swatch), PagesBoard.vue (.editor-board-card), AssetField, FieldPanel, CommandList, ActionBar, PageRail|behaviour in §2–§4|R1|
|Entry points|JobDetail.vue, ArtifactActions.vue, ChannelGateDialog.vue; dp telegram/delivery.py result_controls (:116), ux_copy.py:190, bot.py /editor|web_app ✏️ Edit under PDFs and our decks only; "✨ Ask AI to change"; channel gate at open|R1|

New tokens: --tg-stable-h, --editor-safe-bottom (runtime); --page-ring #0E1726, --page-halo #FFFFFF, --editor-select, --hide-hatch (paper is white in both themes). New icons: left, calendar, camera, palette, grip.

## 8 Flows

Typing and scrolling don’t count; Send = MainButton plus Confirm; flows that type add Done if the MainButton hides (open decision 1). PDFs reach the chat within 20 s, decks with new pictures within 90 s.

|Flow|Counted taps|Taps/s|
|---|---|---|
|F1 Fix a word (R2)|Edit, the word, Send to chat, Confirm|4/30|
|F1 refused (R2)|at open: 4, the line opening in Cover and retype; at the Send check: +Cover and retype, +Send to chat|4/45; 6/45|
|F2 Sign and date|Edit, Sign, kept signature, the line, the date blank, Today’s date, Send to chat, Confirm|8/50; first time +2|
|F3 Pictures on every slide|Edit, Pictures, Add pictures to all slides, Send to chat, Confirm|5/≤90|
|F4 Cover details|Edit, Cover details, Send to chat, Confirm|4/40|
|F5 Black out a number (R2)|Edit, Black out, Phone numbers, Black out all, Send to chat, Confirm|6/25; 7 with I understand|
|F6 Delete a page among edits|Edit, Pages, the page, Delete page, Send to chat, Confirm|6/15; 7 if it has marks|
|F7 Move and add slides|Slides, number 7, Put slide 7 here, ＋ Add slide, Send to chat, Confirm|6/50; grip drag 5|
|F8 Cyrillic in an Uzbek deck|Edit, the headline, Done, Switch to Latin letters, Send to chat, Confirm|6/45, proposed|

## 9 States and messaging

Rules: no click, export, quote, rasterize, DPI, points or encoding in any language; CI checks editor* and deck* keys and new strings, and the same change rewords or retires reviewExport, exportPDF, acceptRasterization, editorRedactIntro, editorExportRedacted, editorMovedTo, editorResizedTo and the Click hints. ✏️ = no AI edit, ✨ = one; never "free" on Free; formal вы; Uzbek Latin, o‘/g‘ U+2018, ʼ U+02BC. # = count() keys (_one, _few, _many, _other, {count}) as in catalog.ts:238–241: en and uz a/b = _one/_other; ru a/b/c = _one/_few/_many, _other = _few.

|Key|en|ru|uz|
|---|---|---|---|
|editorEdit, editorAskAi, editorAiCost*|✏️ Edit; ✨ Ask AI to change; Uses 1 AI edit; {left} of {limit} left|✏️ Редактировать; ✨ Изменить с ИИ; Спишется 1 ИИ-правка; останется {left} из {limit}|✏️ Tahrirlash; ✨ AI bilan o‘zgartirish; 1 ta AI tahriri sarflanadi; {limit} tadan {left} ta qoladi|
|editorWhatWorks|You can sign, add text and pictures, and change pages.|Можно подписать, добавить текст и картинки, изменить страницы.|Imzo, matn va rasm qo‘shish, sahifalarni o‘zgartirish mumkin.|
|editorRenderFallback|Pages shown as pictures: word taps and search are off.|Страницы показаны картинками: нажатие на слова и поиск выключены.|Sahifalar rasm ko‘rinishida: so‘zni bosish va qidiruv o‘chiq.|
|editorPassword, editorSigned, editorScan*|Password-protected. [Unlock PDF]; Digitally signed: changes break the signature. Send an unsigned copy.; Scan: you can sign and add text. [Make text editable]|Защищён паролем. [Снять пароль]; Есть электронная подпись: изменения её нарушат. Пришлите копию без подписи.; Скан: можно подписать и добавить текст. [Сделать текст редактируемым]|Parol bilan himoyalangan. [Parolni olib tashlash]; Elektron imzoli: o‘zgarishlar imzoni buzadi. Imzosiz nusxasini yuboring.; Skan: imzo va matn qo‘shish mumkin. [Matnni tahrirlanadigan qilish]|
|editorAvailableUntil, string 8|Available until {time}; Deleted after 24 hours [Send again] [Make again]|Доступно до {time}; Удалено через 24 часа [Отправить снова] [Сделать заново]|{time} gacha mavjud; 24 soatdan keyin o‘chirildi [Qayta yuborish] [Qayta yaratish]|
|editorWeekUsed|Sending opens Monday 00:00 (Tashkent); this file is deleted at {time}. [See plans]|Отправка — с понедельника 00:00 (Ташкент); файл удалится в {time}. [Тарифы]|Yuborish dushanba 00:00 dan (Toshkent); fayl {time} da o‘chiriladi. [Tariflar]|
|editorSave*|Not saved: no connection; Not saved: one change needs fixing [Show]; Not sent yet|Не сохранено: нет связи; Не сохранено: одно изменение нужно исправить [Показать]; Ещё не отправлено|Saqlanmadi: aloqa yo‘q; Saqlanmadi: bitta o‘zgarishni tuzatish kerak [Ko‘rsatish]; Hali yuborilmagan|
|string 7, editorKeepEditing*|Too much for one file: send it, then keep editing the sent file; [Keep editing the sent file]|Слишком много для одного файла: отправьте и продолжайте с отправленным; [Продолжить с отправленным файлом]|Bitta fayl uchun juda ko‘p: yuboring va yuborilganini tahrirlang; [Yuborilgan faylni tahrirlash]|
|editorConflict|Changed elsewhere at {time}. [Keep this phone’s ({n})] [Keep the other ({m})]|Изменено в другом месте в {time}. [Оставить с этого телефона ({n})] [Оставить другую ({m})]|{time} da boshqa joyda o‘zgartirildi. [Shu telefondagini qoldirish ({n})] [Boshqasini qoldirish ({m})]|
|editorSending*, botMaking*|Sending…; Accepted: the file will arrive in the chat.; Making your file…|Отправляем…; Принято: файл придёт в чат.; Готовим файл…|Yuborilmoqda…; Qabul qilindi: fayl chatga keladi.; Fayl tayyorlanmoqda…|
|strings 5, 6|Uses 1 file task; {left} of {limit} left; Included in your plan; Nothing is used if it fails.|Спишется 1 задача с файлами; останется {left} из {limit}; Входит в ваш тариф; Если не получится, ничего не спишется.|1 ta fayl vazifasi sarflanadi; {limit} tadan {left} ta qoladi; Tarifingizga kiritilgan; Xato bo‘lsa, hech narsa sarflanmaydi.|
|editorSendFailed, editorCheckFailed|Couldn’t send. Nothing was used. [Try again]; One change didn’t come out right; nothing was sent or used. [Show it] [Send without it]|Не удалось отправить. Ничего не списано. [Повторить]; Одно изменение вышло неправильно; ничего не отправлено и не списано. [Показать] [Отправить без него]|Yuborib bo‘lmadi. Hech narsa sarflanmadi. [Qayta urinish]; Bitta o‘zgarish to‘g‘ri chiqmadi; hech narsa yuborilmadi va sarflanmadi. [Ko‘rsatish] [Usiz yuborish]|
|editorDeletePage #|Delete page {n} and its {count} change/changes?|Удалить страницу {n} и {count} изменение/изменения/изменений на ней?|{n}-sahifa va undagi {count} ta o‘zgarish o‘chirilsinmi?|
|deckTooLong #|Too long for this slide: {count} word/words won’t show [Split into two slides] [Pick another layout]|Слишком длинно для слайда: не поместится {count} слово/слова/слов [Разделить на два слайда] [Выбрать другое расположение]|Slayd uchun uzun: {count} ta so‘z ko‘rinmaydi [Ikki slaydga bo‘lish] [Boshqa joylashuvni tanlash]|
|editorHint*|Tap any words to change them; Tap where a signature, date or text should go|Нажмите на любые слова, чтобы изменить их; Нажмите туда, где нужна подпись, дата или текст|O‘zgartirish uchun istalgan so‘zni bosing; Imzo, sana yoki matn kerak joyni bosing|
|deckLatin, deckCover*|[Switch to Latin letters] [Keep as typed]; Topic, Prepared by, Checked by, Group/Class, School; Remember for my next decks|[Перевести на латиницу] [Оставить как есть]; Тема, Подготовил(а), Принял(а), Группа/класс, Школа; Запомнить для следующих презентаций|[Lotinga o‘girish] [O‘zgarishsiz qoldirish]; Mavzu, Tayyorladi, Qabul qildi, Guruh/Sinf, Maktab; Keyingi taqdimotlar uchun eslab qolish|
|labels|Sign, ＋ Add, Pages, Black out (R2); Pictures, Slides, Design, Ask AI; Layout; ＋ Add text; Send to chat|Подпись, ＋ Добавить, Страницы, Закрасить (R2); Картинки, Слайды, Оформление, ИИ; Расположение; ＋ Добавить текст; Отправить в чат|Imzo, ＋ Qo‘shish, Sahifalar, Bo‘yab yopish (R2); Rasmlar, Slaydlar, Bezak, AI; Joylashuv; ＋ Matn qo‘shish; Chatga yuborish|
|R2: editorChecking, editorLonger|Checking…; Changed [Change everywhere ({count})]; Longer than the line [Cover and retype, smaller]|Проверяем…; Изменено [Изменить везде ({count})]; Длиннее строки [Закрыть и напечатать мельче]|Tekshirilmoqda…; O‘zgartirildi [Hammasini o‘zgartirish ({count})]; Qatordan uzun [Yopib, kichikroq yozish]|
|R2: editorRefused, editorChangeInstead|These words can’t be changed in this file [Cover and retype] [Other ways]; Change these words instead?|Эти слова нельзя изменить в этом файле [Закрыть и напечатать] [Другие способы]; Изменить сами эти слова?|Bu so‘zlarni ushbu faylda o‘zgartirib bo‘lmaydi [Yopib, qayta yozish] [Boshqa usullar]; Shu so‘zlarning o‘zini o‘zgartirasizmi?|
|R2: editorBlackOut* #|Check the black boxes. Tap one to keep it visible.; Black out {count} place/places for good?; Pages that become pictures: {pages} [I understand]|Проверьте чёрные плашки; нажмите на плашку, чтобы оставить место видимым.; Закрасить {count} место/места/мест навсегда?; Страницы, которые станут картинками: {pages} [Понятно]|Qora qutilarni tekshiring; ochiq qoldirish uchun qutini bosing.; {count} ta joy butunlay bo‘yab yopilsinmi?; Rasmga aylanadigan sahifalar: {pages} [Tushundim]|

## 10 Accessibility

WCAG 2.2 AA. Targets ≥44 px: raise .auth-tabs buttons (38), .category-tabs buttons and .button.small (36), .check-label rows and .editor-swatch. Every drag has a button path (2.5.7) and starts only on grips or selected objects. --page-ring/--page-halo reach 3:1 on white paper in both themes. Compact sheets are non-modal; Review traps focus; focus stays visible above the dock. R2 adds More → Change words from a list. Save words, checks and sending lines are live regions. Text ≥13 px, inputs 16 px; labels wrap at font scale 1.3; shortcuts can be switched off.

## 11 Release scoping

R1 (phone, decks first): fields saved per slide, Cover details, Pictures, Layout, slide moves, Questions block, Switch to Latin letters, pinned re-export, metric-twin fonts, PPTX plus PDF as deck.export* (catalog, TOOL_LABELS at ux_copy.py:473 for bot.py:712, 941, 950, 1123, extendedToolNames, coverage_report.py:22); Should: Design, Ask AI, Share to a group. PDF: Sign, Add, object form, Pages as commands, inspect-for-editing, refusal states, server PNG first, range loading, AI-made PDF pictures; today’s redact tool hides until R2. Shared: adapter, web_app Edit, mini_app delivery, checks, export lane, size measure, conflict fields, account rate limits, expiry extension, CSS fixes, banned-word check, Undo fix, valid-subset autosave. Tests: 3G at 750 kbps/300 ms, 2 GB Android, iPhone SE, oldest Telegram, NVDA, VoiceOver (ru, uz), N-user load, 8 GB host memory.

R2: text layer; PdfCraft edits and redaction behind a per-file flag; _redact (editor.py:227–263) gains black or white fill, boxed-page imaging, a page-scoped text check (:255), many rectangles per command (:35) and the shared job (:90, :263); width bar; Change everywhere; Cover and retype; Black out tab; AI-made PDF text; blank detection.

R3: offline queue, Combine, tap-to-fill fields, desktop extras. Later: uploaded .pptx.

## 12 Open decisions for the owner

1. MainButton while typing (600 px+ stable height): usable (F1 = 4, band 185) or hidden (F1 = 5, band 241).
2. Swipe lock while dragging or drawing only, or with sheets and fields too.
3. R1 taps on a PDF’s own words: a "Cover with white" box, or "coming later" copy.
4. Freeze four 76 px tabs at 320 after measuring ru and uz at font scale 1.3.
5. AI-made PDFs: re-anchor marks after picture changes, or warn; Pictures as a tab or an Add item.
6. Unresolved slide text: send shrunk and pinned, or block Send.
7. Trebuchet MS, Candara, Constantia: remap like Corbel → Calibri, or label previews approximate; fit meter on phone or server.
8. Strip at 320 × 568: pinned, or folded into ‹ Slide n of N ›.
9. After Send: close 0.7 s after acceptance, or offer Share to a group.
10. "Keep this signature on this phone" default: off or on.
11. One file task per draft (revision 2) needs the export decision amended and allowance counting distinct editor_document_id or root_draft_id.
12. Revision 2’s questions: PdfCraft on AI PDFs, 24 h restart, Caladea Cyrillic, Free picture cap, oldest Telegram, biometric signatures.

## Declined

- Minor 17, picture-search feature id: not added; picture search is a check now (§4.8), not a job.