# DocMaster public site: sitemap and information architecture

Status: research proposal, 2026-11-10. Per-page sections are in `pages.json` (36 entries).
Only facts from the verified product brief are used; anything else is marked *placeholder*.

## 1. Final page list (36 pages per locale, x3 locales: `uz`, `ru`, `en`)

All routes live under `/{locale}`. The sign-in app (`/{locale}/app/...`) is outside the marketing site and gets `noindex`.

| # | Route | Status | Why it exists |
|---|---|---|---|
| 1 | `/` | upgrade | Entry point: tools, AI, editor, Telegram, pricing teaser, trust facts |
| 2 | `/tools` | upgrade | Tool directory and internal-link hub |
| 3-19 | `/tools/{slug}` x17 | upgrade | One landing page per file tool (search intent per tool) |
| 20-21 | `/tools/sign-pdf`, `/tools/fill-pdf-form` | new | Editor-backed pages for two strong search intents |
| 22 | `/pdf-editor` | new | Editor landing ("edit PDF") |
| 23 | `/ai` | new | Hub for the 3 AI services |
| 24-26 | `/ai/documents`, `/ai/slides`, `/ai/cv` | new | One landing per AI service and its intent |
| 27 | `/guide` | exists | Prompt guide (keep route) |
| 28 | `/pricing` | upgrade | Plans, prices, how to pay, refund link |
| 29 | `/telegram` | new | Bot + Mini App, limits, channel rule |
| 30 | `/invite` | new | Invite-rewards rules |
| 31 | `/help` | upgrade | FAQ by topic + support contacts |
| 32 | `/about` | new | Company, requisites, contacts (`/contacts` redirects here) |
| 33 | `/legal/offer` | upgrade | Ommaviy oferta = the one user contract (also Terms) |
| 34 | `/legal/privacy` | upgrade | Privacy policy under ZRU-547, incl. cookies section |
| 35 | `/legal/refunds` | new | Refund/cancellation policy (providers check for it) |
| 36 | 404 | new | Localized not-found with recovery links (HTTP 404, noindex) |

Tool slugs (English across all locales; localized H1/title/description):
`merge-pdf`, `compress-pdf`, `split-pdf`, `extract-pdf-pages`, `delete-pdf-pages`,
`reorder-pdf-pages`, `rotate-pdf`, `jpg-to-pdf` (images to PDF), `pdf-to-jpg`,
`word-to-pdf`, `powerpoint-to-pdf`, `pdf-to-word`, `pdf-to-excel`, `ocr-pdf`,
`searchable-pdf`, `protect-pdf`, `unlock-pdf`.

Redirects (301): `/tools/pdf.merge` etc. (current feature-id URLs) to the new slugs;
`/legal/terms` and `/legal/cookies` to `/legal/offer` and `/legal/privacy#cookies`;
`/contacts` to `/about`; bare `/` to the visitor's locale (default `uz`).

## 2. Changes vs the starting inventory

1. **Tool URLs become SEO slugs.** Today public tool pages are `/tools/pdf.merge`
   (internal feature ids, found in `PageView.vue`/`PublicToolView.vue`). Readable slugs
   match how people search and how every competitor names tool URLs. Old URLs redirect.
2. **Added `/tools/sign-pdf` and `/tools/fill-pdf-form`.** Both are editor features with
   their own high-volume intent; they reuse the tool template and open the editor. The
   sign page must not claim legal e-signature (ERI/EDS); it places a signature *image*.
3. **`/legal/terms` merged into `/legal/offer`.** For an Uzbek LLC the public offer *is* the
   contract; two parallel documents invite contradictions. One offer covers free and paid
   use, and works as the "Terms of Service" URL for Google/Telegram sign-in screens.
4. **`/legal/cookies` dropped** into a privacy-policy section. The product has no
   analytics; only functional storage (session, language, time zone). A separate page
   would be thin and suggests tracking that does not exist. No consent banner is needed
   for strictly necessary storage (lawyer to confirm).
5. **Added `/invite`.** Rules for referral rewards are referenced from pricing, bot and app;
   a public page gives one stable link.
6. **`/about` explicitly carries requisites + contacts**, `/contacts` redirects to it. The
   requisites block is also in the global footer (legal requirement, see section 5).
7. **`uz` is the default/x-default locale** and the Uzbek legal texts are authoritative
   (state-language rule, see section 5). Current pages default per previous setup; check.
8. **Not added (considered):** `/security` (too few verifiable facts; fold into privacy and
   home trust block), `/blog` (no content plan; revisit with SEO agent), `/business`/API,
   separate `/contacts`, per-locale translated slugs (complexity for little gain; SEO agent
   may revisit), a separate "payment and delivery" page (covered by pricing + offer; add
   only if the provider's reviewer asks for it).
9. Current legal pages show "Local development information … require review" (`legalDraft`
   key) and generic help articles. They must be replaced with real texts before the
   payment-provider review.

## 3. Navigation

### Header (all marketing pages)
- Logo (to `/`)
- **Tools** (mega menu): Organize | Optimize & convert | OCR & security | Edit (PDF editor,
  Sign, Fill form); "All tools" link
- **PDF editor**
- **AI** (dropdown): Documents, Slides, CV, Prompt guide
- **Pricing**
- **Telegram bot**
- Right side: language switch (O'zbekcha / Русский / English, keeps the same page),
  "Sign in", primary button "Start free" (to `/app`)
- Discount banner above header when an admin discount is active (exists: `DiscountBanner`)
- Mobile: hamburger with the same groups; "Start free" stays visible

### Footer (all pages)
- **Popular tools:** Merge, Compress, Split, JPG to PDF, Word to PDF, PDF to Word,
  PowerPoint to PDF, OCR, All tools
- **Product:** PDF editor, AI documents, AI slides, AI CV, Pricing, Telegram bot, Invite friends
- **Help:** Help centre, Prompt guide, Company & contacts
- **Legal:** Public offer, Privacy policy, Refund policy
- **Requisites block (required on every page):** "ARCANIUM TECHNOLOGIES" MCHJ ·
  STIR 313458514 · legal address *(placeholder)* · phone *(placeholder)* · email
  *(placeholder)* · Telegram support *(placeholder)*; render from the admin Contacts
  setting (`CompanyDetails.vue` already reads it)
- Accepted cards: Uzcard, Humo, Visa, Mastercard (plus provider logo once integrated)
- Language switch, Telegram channel/bot links, "© 2026 ARCANIUM TECHNOLOGIES"
- "DocMaster (formerly PDF Master)" once, for brand continuity

## 4. Competitor findings (short)

Studied: iLovePDF, Smallpdf, PDF24, Kickresume (AI CV), BILLZ (Uzbek SaaS, ru/uz),
Gamma (fetch blocked, 403; structure not verified, so not used).

- **Home order is consistent:** hero with one action, tool grid with category filter,
  product/channel promos (desktop/mobile apps), premium upsell, trust block, footer.
  iLovePDF puts the tool grid immediately after the hero; that is the right model for
  DocMaster's tool-intent traffic. ([ilovepdf.com](https://www.ilovepdf.com/))
- **Tool page template (Smallpdf):** breadcrumb, H1 + upload zone first, short intro,
  feature cards, numbered how-to steps, FAQ (about 7 questions), related content, rating,
  full tool directory at the bottom. ([smallpdf.com/merge-pdf](https://smallpdf.com/merge-pdf))
  We adopt hero/CTA, how-to, facts, limits, privacy, FAQ, related tools; we drop ratings
  and user counts (no verified numbers).
- **Footers are wide:** product, tools, company, legal, language list, socials, app badges.
  Smallpdf and PDF24 carry legal notice/imprint in the footer. ([tools.pdf24.org](https://tools.pdf24.org/en/))
- **Trust:** PDF24 states files are deleted "after a short time"; DocMaster can beat that
  with a concrete "24 hours" figure. iLovePDF uses ISO/PDF Association badges (we have none
  and must not imply any).
- **AI CV page (Kickresume):** hero + CTA, template gallery high on the page, feature
  blocks, examples, testimonials, FAQ, final CTA. Pricing lives on its own page, not in
  the landing. ([kickresume.com](https://www.kickresume.com/en/ai-resume-writer/))
- **Uzbek SaaS (BILLZ):** ru/uz toggle, Telegram bot link in the header, phone number
  prominent, prices on a separate page with FAQ, footer with privacy policy and *public
  offer* links. It shows no STIR on the page, but the e-commerce rules below still require
  it for a seller. ([billz.io](https://billz.io/))

Takeaways for DocMaster: tool grid right after the hero; Telegram as a first-class channel
in the header; real output galleries (designs, CV templates) on AI pages; concrete privacy
figures in place of badges; requisites in the footer.

## 5. Legal requirements (Uzbek LLC selling digital subscriptions)

Not legal advice. A local lawyer should review the final texts.

### 5.1 Public offer (ommaviy oferta)
- The Civil Code allows a contract to be concluded by offer and acceptance, where an
  offer addressed to everyone is a public offer and performing the actions it describes
  (e.g. registering, paying) is acceptance. Uzbek offers in practice cite Civil Code
  Art. 367 and Art. 369 part 2 (public offer) and Art. 370 (acceptance by action). Exact
  article wording to be confirmed on lex.uz. ([Civil Code, lex.uz](https://lex.uz/acts/98424))
- The e-commerce law lets the seller publish an offer on its website. The contract is
  concluded when the offeror receives acceptance, which may be an electronic message or
  performing the actions the offer specifies. The contract must state its language.
  ([gov.uz summary](https://gov.uz/en/advice/74/document/1895); law ZRU-792 of 29.09.2022,
  amended 2025 and 2026: [spinform text](https://base.spinform.ru/show_doc.fwx?rgn=144356),
  [lex.uz](https://lex.uz/ru/docs/6213428))

### 5.2 Seller information on the website (e-commerce law)
The seller must give buyers electronic access to reliable information about itself, in the
**state language** (other languages additionally): firm name, STIR, postal address,
e-mail, phone, and licence number/term if licensed; plus reliable information about the
services. Refunds go back by the same payment method; procedure and deadlines are set by
the contract. ([gov.uz](https://gov.uz/en/advice/74/document/1895))
This leads to: footer requisites block, `/about`, prices on `/pricing`, refund terms on `/legal/refunds`.

### 5.3 Consumer protection: language
Consumer-protection law Art. 6: information about goods and services is given in the state
language (others additionally). A 2022 amendment (ZRU-746) adds that information about the
seller and service rules is also given in the state language.
([norma.uz summary](https://norma.uz/novoe_v_zakonodatelstve/usilena_zashchita_prav_potrebiteley);
[anhor.uz on enforcement](https://anhor.uz/news/menu-in-uz/))
This leads to: full Uzbek (Latin) versions of every page and legal text, Uzbek prevailing.

### 5.4 Personal data (ZRU-547)
- Art. 27-1 (in force since April 2021) required Uzbek citizens' personal data to be
  collected and stored on technical means in Uzbekistan.
  ([DataGuidance](https://www.dataguidance.com/news/uzbekistan-data-localisation-rule-enters-force),
  [kun.uz](https://kun.uz/en/news/2025/07/22/experts-urge-uzbekistan-to-revise-data-localization-rules-to-support-innovation))
- **Amendment signed 26 March 2026:** localisation now kept only for biometric/genetic data
  and data of telecom-operator subscribers. Other personal data may be stored and processed
  abroad if one condition holds: the country is recognised as adequate, *or* the operator
  uses standard contractual clauses / binding corporate rules meeting the regulator's
  requirements, *or* it follows international standards on the regulator's list.
  ([spot.uz, 27.03.2026](https://www.spot.uz/ru/2026/03/27/personal-data/))
- DocMaster stores files in the EU (Contabo) and sends AI requests to OpenAI. The privacy
  policy must name the transfers and the condition relied on (adequacy list, SCCs or
  standards), and whether the amendment's effective date has passed. The lawyer should also
  check consent-capture wording at sign-up and whether the operator must register its
  personal-data databases with the authorised body (not verified in this research).

### 5.5 What payment providers check (Payme, Click, Uzum)
No provider publishes a site checklist (searched Payme Business, Click docs, Uzum; nothing
official found). Public material says onboarding requires a registered legal entity/IE,
a bank account and a signed contract; Payme applications go through its business cabinet
or call centre 1350; an acquiring bank requires the site's goods/services to match what
was registered. ([spot.uz on Payme Business](https://www.spot.uz/ru/2022/06/10/payme-business),
[Octobank procedure PDF](https://octobank.uz/assets/components/table_07/protsedura_podklyucheniya_internet_ekvayringa.pdf),
[docs.tgshop.io](https://docs.tgshop.io/osnovnye-nastroiki/sposoby-oplaty/payme))
Combined with 5.1-5.3, the practical reviewer checklist (inferred; **confirm with the
chosen provider**):
1. Company requisites (name, STIR, address, phone, email) visible on the site
2. Public offer with prices, payment, delivery/activation and refunds
3. Separate refund policy page
4. Prices in so'm for every plan, before payment
5. Privacy policy
6. Product description matching the registered activity (the tool and AI pages)
7. Working contacts and support channel

## 6. SEO-driven page needs (brief; a separate agent owns keywords)

- **Per-tool pages are worth it.** File-tool searches are tool-named and transactional in
  both languages ("pdf birlashtirish", "объединить pdf", "word pdf ga o'tkazish", "jpg в pdf",
  "сжать pdf"). Global leaders rank one page per tool per language; in Uzbek
  their localized coverage is thin, which is DocMaster's best opening. Each tool needs its
  own indexable, server-rendered page with unique H1/title/description/FAQ per locale and
  `hreflang` uz/ru/en + x-default (uz).
- **Intents that justify dedicated pages:** the 17 tools; "pdf tahrirlash / редактировать
  pdf" (`/pdf-editor`); "pdf imzolash / подписать pdf" (`sign-pdf`); "pdf formani to'ldirish /
  заполнить pdf форму" (`fill-pdf-form`); "prezentatsiya tayyorlash / сделать презентацию"
  (`/ai/slides`); "rezyume yaratish / создать резюме" (`/ai/cv`); "referat / mustaqil ish /
  реферат" style document generation (`/ai/documents`; the SEO agent should test whether a
  dedicated "referat" page is warranted, as it is a strong student intent).
- **Do not index:** `/app/**`, `/auth/**`, 404, redirects. Put pages in `sitemap.xml` with the
  `priority` from `pages.json`.
- Strong tool-page content requires server-side rendering of the catalog data (bot
  availability, accepted formats) so it appears in HTML.

## 7. Data sources pages need

- `plans`: names, prices, weekly limits, edits, discount price + last day (pricing.plan_price
  is the one price reader per platform notes).
- `catalog`: tool ids, names, accepted formats, bot/web availability (`/api/v1/catalog`).
- `contacts`: admin Contacts setting (legal name, STIR, address, phone, email) for footer,
  `/about`, legal pages.

## 8. Open questions for the owner

1. **Contacts to publish:** legal address, support phone, support email, Telegram support
   handle, working hours. Phone/email were blank at the last ship; the law (5.2) requires
   them.
2. **Bot and channel links:** official bot username and the Free-plan channel link for
   `/telegram`.
3. **Refund policy:** in which cases do you refund (plan not activated, duplicate payment,
   technical failure, change of mind within N days?), the request deadline, and how fast.
4. **Tax status of prices:** are you a VAT payer? Do the 20 000 / 60 000 so'm prices include
   VAT? The offer must say so.
5. **Which provider** (Payme, Click, Uzum, an aggregator) is being integrated, and has its
   manager sent a site checklist? This decides whether a "payment and delivery" page is
   also needed.
6. **Lawyer review:** who will review the Uzbek offer and privacy texts, especially the
   cross-border transfer basis (EU storage, OpenAI) under the March 2026 ZRU-547 amendment?
7. **Merge Terms into the Offer** (recommended): OK to retire `/legal/terms` as a separate
   document?
8. **Director's name** on `/about` and in the offer: publish or not? (Usually required in
   the offer's requisites.)
9. **Editor limits by plan:** does the PDF editor count against any plan limit? (Not in
   the verified facts, so the editor page currently says only "starts free".)
