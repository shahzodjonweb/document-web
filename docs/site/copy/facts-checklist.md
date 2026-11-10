# Site copy: facts checklist

Status: copy draft, 2026-11-10. Covers `locales/site.ts` (997 keys), `content/site/faq.ts`
(136 items), `content/site/tools.ts` (19 tools) and `content/legal/{offer,privacy,refunds}.{uz,ru,en}.md`.
Code paths are on `document-platform` **origin/main** (820e549, 10 Nov 2026) unless marked `web:`
(document-web origin/main). Status: **verified** = read in code; **owner** = owner decision in the
brief; **placeholder** = value still to be supplied; **flag** = code and brief disagree or a claim
needs a decision.

## 1. Claims

| Claim | Where used | Source | Status |
|---|---|---|---|
| Free: 5 AI docs/week, 15 file tasks/week, 3 AI edits per file | `sitePlan*` (via `{count}`), `siteAiHubEditsPlans`, `siteEditorPlansBody`, faq `home-free`, `ai-docs-count`, `ai-docs-edit`, `cv-edit`, `slides-count`, tool `LimitNote`s | `docs/product/plan_seed.json` (free) | verified |
| Plus: 20 AI docs/week, unlimited file tasks, 10 edits per file | same as above | `plan_seed.json` (plus) | verified |
| Premium: no weekly limits, no channel requirement, not faster | `sitePlanPremiumBody`, faq `pricing-premium-speed` | `plan_seed.json`; `apps/core/channel_gate.py`; brief | verified / owner |
| Every feature and every file limit is the same on every plan | `sitePricingLead`, `siteToolLimitsWebNote`, faq `home-size` | `plan_seed.json` `config_note` | verified |
| **Free and Plus** must join the owner's Telegram channels (plural, listed in the panel); Premium exempt | `sitePlanChannel`, `siteTgChannelNote`, faq `home-free`, `tg-channel`, offer §10, legal drafts | `apps/core/channel_gate.py` docstring and gate | **flag**: brief said Free only; copy follows the code |
| Week starts Monday 00:00 Tashkent time, for everyone | `siteToolLimitsPlanNote`, `sitePricingTableCaption`, `siteAiLimitsCaption`, faq `pricing-week` | `apps/core/allowance.py` `WEEK_ZONE`, `week_bounds` | verified |
| Failed, cancelled, expired or no-change tasks don't count; outline planning doesn't count | `siteAiLimitsOutlineNote`, `siteAiDocsStep2Text`, faq `pricing-week`, `ai-docs-count`, compress FAQ | `allowance.py` `NOT_COUNTED`, `require_quote` | verified |
| PDF editor counts as a file task on Free (downloading the edited PDF); editing itself does not | `siteEditorPlansBody`, faq `editor-plan`, tool copy sign/fill | `allowance.py` `file_jobs_this_week` (every non-generation job incl. `editor.*`) | verified; with the admin `count_once` flag on, one draft counts once however often it is sent; with it off every send counts. Copy says "uses a file task", true either way |
| Prices live and discountable; no prices in prose | `sitePlanPrice` `{price}`, `sitePlanDiscountPeriod`, `sitePlanRegular`; legal docs refer to the Pricing page | brief; `plan_seed.json` discount fields | owner |
| Prices final, VAT not charged (not a VAT payer) | `sitePricingVatNote`, `siteAboutVatValue`, faq `plans-vat`, offer §5 | owner decision | owner |
| No auto-renewal; pay again for the next 30 days | `sitePlanNoRenewal`, `sitePricingRenew*`, faq `pricing-renew`, offer §8, refunds §2 | brief; `plan_seed.json` `period_seconds` 2592000 | owner / verified |
| Payment: card transfer (Uzcard, Humo, Visa, Mastercard) + receipt upload; staff check; no time promised | `sitePricingPay*`, faq `home-pay`, `pricing-approval`, offer §6–7 | brief; `apps/commerce/manual.py` | owner |
| Refunds: full within 3 days of activation if no task run on the paid plan; duplicates and never-activated plans always; same card within 10 working days; via support | `sitePricingRefund*`, faq `pricing-refund`, refunds doc, offer §9 | owner decision | owner |
| After a refund the account returns to Free; a refunded duplicate leaves the plan running | refunds §7 | inferred by the legal draft, not in code or brief | **flag**: owner to confirm |
| Invite: every 5 counted friends earn Plus, 1 month then 2, 3…; month = 30 days | `siteInvite*`, `sitePricingInvite*`, faq `invite-ladder` | `apps/commerce/referrals.py` `STEP`, `months_for`, `MONTH_DAYS` | verified |
| Invite: max 5 friends counted per calendar month (Tashkent); extra friends roll over to next month | `siteInviteCapNote`, faq `invite-cap` | `referrals.py` `MONTHLY_CAP`, `month_bounds`, `_settle` | verified (roll-over is in the code, not in the brief) |
| Invite: friend must claim the link within 7 days of account creation and finish a first (any successful) task; one inviter per account; no self-invites | `siteInviteHowStep3Text`, faq `invite-who` | `apps/commerce/services.py` `claim_referral`; `referrals.py` `_ready` | verified |
| Invite reward follows a paid Plus period and waits for a paid Premium period to end; never money | `siteInviteNotMoney`, faq `invite-have-plus`, `invite-money` | `referrals.py` docstring; `periods.grant` | verified |
| Web: 200 MB per file, 1,000 pages per task; bot: 20 MB per file | `siteMegaLimits`, `siteToolLimits*`, `siteCompare*`, faq `home-size`, `tg-large` | `plan_seed.json` `max_file_mib`, `max_pages_per_job`; bot 20 MB: brief (Telegram Bot API) | verified / owner |
| Merge: 2–50 PDFs, combined upload up to 400 MB | merge copy + FAQ | `apps/core/services.py` `validate_inputs`; `plan_seed.json` `max_merge_input_files`, `max_aggregate_input_mib` | verified |
| Compress is lossless; under 1% saving returns "no change" and isn't counted | compress copy + FAQ | `processors/engine.py` (pdf.compress branch, `no_op`) | verified |
| Split by page ranges (each range one PDF), default one PDF per page; rotate 90/180/270 | split/rotate copy | `processors/engine.py` `PARAMETER_SCHEMAS`, split branch | verified |
| Images to PDF: JPG, PNG, WEBP; up to 50 images; document photos straightened | jpg-to-pdf copy | `engine.py` `inspect_file`; `services.py`; brief | verified |
| PDF to images: PNG or JPG | pdf-to-jpg copy | `engine.py` `pdf.to_images` schema | verified |
| Word to PDF: .docx only, macros refused; PowerPoint to PDF: .pptx only | word/powerpoint copy | `services.py` kind checks; `engine.py` `_office_inspect` | verified |
| PDF to Word: reflowed text, layout not preserved; PDF to Excel: native tables only | pdf-to-word / pdf-to-excel copy | `processors/advanced.py` warnings, `engine.py` limitations | verified |
| OCR: Uzbek, Russian, English (+ English combinations); output .txt; reads PDF or images | ocr copy, faq `home-languages` | `advanced.py` `LANGUAGES`, outputs; `services.py` | verified |
| Protect: AES-256; unlock needs the known password; protected PDFs must be unlocked before other tools | protect/unlock copy, faq `editor-password` | `engine.py` protect branch; `services.py` `unlock_first` | verified |
| Web-only tools: PDF→Word, PDF→Excel, OCR, searchable PDF, protect, unlock; the rest also in the bot | `tools.ts` `channels`, `siteCompareToolsBot`, faq `home-telegram-vs-web`, `tg-what` | brief (feature_catalog.json lists bot for all; production catalog is the authority) | owner; page should render the chip from `/api/v1/catalog` |
| Editor on the web and as a Telegram Mini App; capabilities (add/edit text, highlight, notes, forms, signature image, images, redact) | `siteEditor*`, `siteEditorCap*`, sign/fill copy | brief; `docs/product/feature_catalog.json` editor rows; `web: locales/extended.ts` | verified / owner |
| Sign PDF = signature image, never ERI/ЭЦП | `siteEditorCapSignature*`, faq `editor-signature-legal`, sign copy | brief; `feature_catalog.json` `editor.signature_image` | owner |
| AI documents up to 35 pages; slides up to 60; 110 designs; editable .pptx; CV 50 templates, 1–2 pages, three start modes | AI pages, `siteAiCard*` | `plan_seed.json` `max_generated_pdf_pages`, `max_generated_slides`; brief | verified / owner |
| A bare LinkedIn link is not enough for a CV; missing name/contact/experience is asked for | `siteAiCvModeLinkedinText`, `siteAiCvStep3Text`, faq `cv-linkedin`, `cv-missing` | `web: app/composables/useCvSources.ts` `linkedinLinkOnly`, `cvFactTicks` (port of `apps/studio/cv/content.py`) | verified |
| Output language order: picked > named in request > request language > settings; Uzbek Latin only | `siteAiLangRule`, faq `ai-docs-language` | brief | owner |
| Slide pictures come from Pixabay; only search words are sent | faq `slides-images`, privacy processors table | brief (third parties) | owner; wording on what is sent to confirm with engineering |
| Files deleted after 24 h; AI requests/results kept 30 days; receipts 90 days after the decision | lifecycle, privacy notes, faq, privacy §5 | `plan_seed.json` `retention_hours`; `apps/studio/review.py` `REVIEW_DAYS`; `apps/commerce/manual.py` `RECEIPT_RETENTION_DAYS` | verified |
| AI records are opened only by support staff and every opening is recorded | faq `cv-privacy`, privacy §8 | existing help copy `web: locales/catalog.ts` `helpPrivacyBody` | owner (taken from shipped copy; engineering to reconfirm) |
| Password reset by an emailed code | faq `account-forgot` | `web: locales/authentication.ts` `authSendResetCode` | verified |
| Account deletion deactivates the account and revokes its files | faq `account-delete`, offer §15, privacy §9 | `apps/core/views.py` `me` (DELETE) | verified; **flag**: no delete button exists in the web app or the bot on origin/main, so the copy routes deletion through support. Update the copy when a Settings button ships |
| Sign-in: Telegram, email + password, Google; one account for web, bot, Mini App | hero, facts, faq `account-sign-in`, `tg-same-account` | brief; `apps/core/identity.py` | verified |
| No analytics, no ad trackers; only session, CSRF, language, theme; Cloudflare Turnstile | `siteHomeFactAnalytics*`, faq `files-cookies`, privacy §11 | owner decision | owner |
| Processors: OpenAI, Contabo (EU), Telegram, Google, Cloudflare Turnstile, Pixabay, an email provider | `siteAiDataNote`, faq `files-where`, privacy §6–7 | brief | owner |
| Company: "ARCANIUM TECHNOLOGIES" MCHJ, STIR 313458514, Yunusobod address | `siteCompany*`, about, offer §1/§20, privacy §1 | brief | owner |

## 2. Copy decisions to review

- **CTA "Start free" became "Get started" / "Boshlash" / "Начать работу".** The language rule allows
  "free/bepul/бесплатно" only next to "within the Free plan limits", which a 16-character button cannot
  carry. The one place "free"-type wording appears is faq `home-free` ("within the Free plan limits").
- **meta.json H1 changes (two):** ai-hub uz "Sunʼiy intellekt bilan hujjat tayyorlash" repeated the
  ai-documents H1 word for word, so it is now "Sunʼiy intellekt bilan hujjat, taqdimot va rezyume
  tayyorlash"; ai-slides ru "Презентация с помощью ИИ за несколько минут" promised a speed the product
  does not state, so it is now "Сделать презентацию с помощью ИИ". Brand names in H1s (pricing, invite,
  about) are written `{brand}`. meta.json itself was not edited.
- **H1s over the design budget, kept as given by SEO:** OCR (40 > 28), unlock (38 > 28), protect
  (29 > 28). The uz split H1 "PDF faylni ajratish" conflicts with the split/extract guardrail; the tool
  name uses "PDF ni qismlarga bo‘lish".
- **Prices are never in prose.** Plan cards use `{price}`; limits in plan cards use `{count}` so they
  follow `plans`. FAQ answers and AI-page lines state the current limit numbers in text (FAQPage JSON-LD
  needs plain text); change them together with `plan_seed.json`.
- **"PDF Master" is never typed**: the footer and About use `{formerBrand}`.
- **Uzbek case endings after Latin names** are written as separate words ("PDF ga", "Word ni"), as in
  meta.json and the search terms.

## 3. Placeholders

Owner tokens (`{{…}}`, not substituted by `t()`):

| Token | Used in |
|---|---|
| `{{company.phone}}` | legal docs (offer §20, privacy §13, refunds §9) |
| `{{company.email}}` | legal docs (data requests, refunds, contacts) |
| `{{support.url}}` | legal docs (refund and data requests, contacts) |
| `{{bot.url}}` | offer §20; site CTAs link to it through config (`siteTgHeroCta`, `siteFooterBot`, "Open in Telegram") |
| `{{bot.username}}` (added) | `siteTgHeroCta`, faq `tg-official` |
| `{{channel.url}}` | href for `siteTgChannelButton`, `siteFooterChannel` (config); the legal docs say "channels listed in the Service" instead |
| `{{company.director}}` | offer §20, About requisites row (`siteAboutDirector`) |
| `{{effective}}` | front matter of all nine legal drafts |
| `{{support.hours}}` (added) | `siteHelpHours` |
| `{{company.bank_details}}` (added) | offer §20 |
| `{{email_provider.name}}`, `{{email_provider.country}}` (added) | privacy §6 |

Runtime variables (substituted by `t()` / the component): `{brand}`, `{formerBrand}`, `{company}`, `{year}`,
`{price}`, `{count}`, `{date}`, `{query}`, `{path}`, `{language}`, `{name}`, `{version}`.

Missing data, not tokens: gallery images for AI documents, slide designs and CV templates
(`siteAiDocsExamplesSoon` is shown until real exports are committed).

## 4. LAWYER points

Offer (10):
1. Cite the Civil Code public-offer and acceptance articles (practice: Art. 367, 369 part 2, 370) and ZRU-792 provisions.
2. Minimum age to accept independently; rule for minors.
3. VAT-status wording; whether the tax regime must be named.
4. Liability cap and its fit with consumer-protection and Civil Code limits.
5. Whether a long outage gives a period extension or partial refund.
6. Deletion route (owner): no delete button on origin/main, deletion via support until one ships.
7. Notice period and channel for changes to the offer for existing users.
8. Whether consent to data processing must be a separate checkbox.
9. Jurisdiction, claim-response deadline, consumers' right to sue at their residence.
10. Whether the director's name and bank details must appear.

Privacy (11):
1. Registration of personal-data databases with the authorised body.
2. Retention period of technical logs.
3. Legal bases under ZRU-547; explicit consent for CV data and transfers.
4. Retention of account data after deletion and of accounting records.
5. Processor countries (Contabo region, Telegram, Google, Cloudflare, Pixabay, email provider).
6. Cross-border transfer basis under Art. 27-1 as amended 26 March 2026 (adequacy list / SCCs / listed standards), whether the amendment is in force, any data that must stay in Uzbekistan.
7. Security wording with engineering, incl. the PDF-password line.
8. Deletion route (owner), as offer point 6.
9. Response deadline for data-subject requests and how to verify them.
10. Age requiring parental consent.
11. No consent banner for strictly necessary storage.

Refunds (2):
1. Consumer-protection rules on unused services and partial periods.
2. Whether a request needs a set form; statutory answer deadline.
