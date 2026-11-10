"""Write the static DocMaster site mockups from shared partials.

python3 build_mockups.py  ->  WT/docs/site/design/mockups/{home,tool,pricing,ai-service,legal}.html
The output is plain HTML + CSS; this script only avoids copy-pasting the
header, footer and icon sprite five times.
"""
import html

WT = ('/private/tmp/claude-501/-Users-shakhzoduralov--claude-spares-spare-3xH9lN/'
      '3abbc986-6d98-4d1a-bb5b-f0ab8efba645/scratchpad/web-site')
OUT = f'{WT}/docs/site/design/mockups'
BRAND = '../../../../public/brand'

# lucide-style outlines, 24 grid; mirrors names used by AppIcon where they exist
ICONS = {
    'file': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    'merge': '<path d="m8 6 4-4 4 4"/><path d="M12 2v10.3a4 4 0 0 1-1.17 2.87L4 22"/><path d="m20 22-5-5"/>',
    'compress': '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="m14 10 7-7"/><path d="m3 21 7-7"/>',
    'split': '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88"/><path d="M14.47 14.48 20 20"/><path d="M8.12 8.12 12 12"/>',
    'rotate': '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    'image': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    'word': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    'lock': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'unlock': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    'scan': '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8h8"/><path d="M7 12h10"/><path d="M7 16h6"/>',
    'trash': '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'reorder': '<path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
    'files': '<path d="M15 2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M15 2v5h5"/><path d="M4 7v13a2 2 0 0 0 2 2h10"/>',
    'table': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
    'slides': '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>',
    'sparkle': '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
    'send': '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    'globe': '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    'down': '<path d="m6 9 6 6 6-6"/>',
    'right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'chev': '<path d="m9 18 6-6-6-6"/>',
    'menu': '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'plus': '<path d="M12 5v14"/><path d="M5 12h14"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    'edit': '<path d="M12 20h9"/><path d="M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z"/>',
    'signature': '<path d="m21 17-2.16-1.87a.5.5 0 0 0-.84.37v.5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1c0-2.55-4-3.97-8.5-4a1 1 0 0 0 0 5c4.15 0 4.75-11.3 5.71-13.5a2.5 2.5 0 1 1 3.31 3.28"/><path d="M3 21h18"/>',
    'highlighter': '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    'type': '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
    'note': '<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5z"/><path d="M15 3v6h6"/>',
    'form': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h4"/><path d="M7 14h10"/><rect x="14" y="7.5" width="3" height="3" rx=".5"/>',
    'redact': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 10h10v4H7z"/>',
    'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'percent': '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    'eyeoff': '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
    'card': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    'receipt': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    'gift': '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    'calendar': '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    'languages': '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
    'layers': '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    'phone': '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
}


def ic(name, cls=''):
    c = f'site-icon {cls}'.strip()
    return f'<svg class="{c}" aria-hidden="true"><use href="#i-{name}"/></svg>'


def sprite():
    syms = ''.join(f'<symbol id="i-{k}" viewBox="0 0 24 24">{v}</symbol>' for k, v in ICONS.items())
    return f'<svg width="0" height="0" style="position:absolute" aria-hidden="true">{syms}</svg>'


def t(en, uz=None, ru=None, tag='span', cls='', attrs=''):
    """Text that the mockup language switch can swap (home only uses uz/ru)."""
    a = f' class="{cls}"' if cls else ''
    if uz:
        a += f' data-en="{html.escape(en)}" data-uz="{html.escape(uz)}"'
    if ru:
        a += f' data-ru="{html.escape(ru)}"'
    return f'<{tag}{a}{attrs}>{en}</{tag}>'


TOOLS = {
    'organize': ('Organize pages', [
        ('merge', 'Merge PDF', 'Combine files into one'),
        ('split', 'Split PDF', 'Cut one file into several'),
        ('files', 'Extract pages', 'Save chosen pages as a new PDF'),
        ('trash', 'Delete pages', 'Remove pages you don’t need'),
        ('reorder', 'Reorder pages', 'Put pages in the right order'),
        ('rotate', 'Rotate PDF', 'Turn sideways pages upright'),
    ]),
    'convert': ('Convert and compress', [
        ('compress', 'Compress PDF', 'Make a file smaller to send'),
        ('image', 'JPG to PDF', 'Photos and scans into one PDF'),
        ('word', 'Word to PDF', 'DOC and DOCX to PDF'),
        ('slides', 'PowerPoint to PDF', 'PPT and PPTX to PDF'),
        ('image', 'PDF to JPG', 'Every page as an image'),
        ('word', 'PDF to Word', 'An editable DOCX'),
        ('table', 'PDF to Excel', 'Tables into XLSX'),
    ]),
    'secure': ('Text, security and signing', [
        ('scan', 'OCR PDF', 'Read text from scans'),
        ('search', 'Searchable PDF', 'Make a scan searchable'),
        ('lock', 'Protect PDF', 'Add a password'),
        ('unlock', 'Unlock PDF', 'Remove a password you know'),
        ('signature', 'Sign PDF', 'Place your signature image'),
        ('form', 'Fill PDF form', 'Type into form fields'),
    ]),
}


def header(active='', lang_switch=False, menu_open=''):
    def mega():
        cols = ''
        for key in ('organize', 'convert', 'secure'):
            title, items = TOOLS[key]
            lis = ''.join(f'<li><a href="tool.html">{ic(i)}{n}</a></li>' for i, n, _ in items)
            cols += f'<div><h3>{title}</h3><ul>{lis}</ul></div>'
        cols += (f'<div><h3>Edit</h3><ul><li><a href="#">{ic("edit")}PDF editor</a></li>'
                 f'<li><a href="tool.html">{ic("signature")}Sign PDF</a></li>'
                 f'<li><a href="tool.html">{ic("form")}Fill PDF form</a></li></ul></div>')
        cols += ('<div class="site-mega-foot"><span>Web: up to 200 MB and 1000 pages per task. Telegram bot: 20 MB per file.</span>'
                 f'<a class="site-link-arrow" href="#">All tools{ic("right", "is-sm")}</a></div>')
        return cols

    ai_items = ''.join(
        f'<li><a href="ai-service.html">{ic(i)}<div>{n}<span>{d}</span></div></a></li>'
        for i, n, d in [('file', 'AI documents', 'A PDF on your topic, up to 35 pages'),
                        ('slides', 'AI slides', 'Editable PowerPoint, up to 60 slides'),
                        ('user', 'AI CV', '50 templates, from a message or old CV'),
                        ('note', 'Prompt guide', 'How to ask for a good result')])
    o_tools = ' is-open' if menu_open == 'tools' else ''
    o_ai = ' is-open' if menu_open == 'ai' else ''
    cur = lambda k: ' aria-current="page"' if active == k else ''  # noqa: E731
    return f'''
<a class="site-skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="site-container site-header-row">
    <a class="site-header-logo" href="home.html" aria-label="DocMaster home">
      <img class="site-logo-light" src="{BRAND}/docmaster-logo.svg" alt="DocMaster" width="150" height="28">
      <img class="site-logo-dark" src="{BRAND}/docmaster-logo-dark.svg" alt="DocMaster" width="150" height="28">
    </a>
    <nav class="site-nav" aria-label="Main">
      <div class="site-nav-item{o_tools}">
        <button class="site-nav-link" aria-expanded="{'true' if o_tools else 'false'}" aria-controls="site-mega-tools"{cur('tools')}>{t('Tools', 'Vositalar', 'Инструменты')}{ic('down')}</button>
        <div class="site-mega" id="site-mega-tools">{mega()}</div>
      </div>
      <div class="site-nav-item"><a class="site-nav-link" href="#">{t('PDF editor', 'PDF muharriri', 'PDF-редактор')}</a></div>
      <div class="site-nav-item{o_ai}">
        <button class="site-nav-link" aria-expanded="{'true' if o_ai else 'false'}" aria-controls="site-mega-ai"{cur('ai')}>AI{ic('down')}</button>
        <div class="site-mega is-small" id="site-mega-ai"><ul>{ai_items}</ul></div>
      </div>
      <div class="site-nav-item"><a class="site-nav-link" href="pricing.html"{cur('pricing')}>{t('Pricing', 'Narxlar', 'Тарифы')}</a></div>
      <div class="site-nav-item"><a class="site-nav-link" href="#">{t('Telegram bot', 'Telegram bot', 'Telegram-бот')}</a></div>
    </nav>
    <div class="site-header-end">
      <button class="site-lang" aria-label="Language: English">{ic('globe', 'is-sm')}{t('English', 'O‘zbekcha', 'Русский')}{ic('down', 'is-sm')}</button>
      <a class="site-btn is-ghost is-sm site-signin" href="#">{t('Sign in', 'Kirish', 'Войти')}</a>
      <a class="site-btn is-primary is-sm site-header-cta" href="#">{t('Start free', 'Bepul boshlash', 'Начать бесплатно', cls='site-cta-long')}{t('Start', 'Boshlash', 'Начать', cls='site-cta-short')}</a>
      <button class="site-burger" aria-label="Menu" aria-expanded="false" aria-controls="site-mobile-menu" onclick="siteMenu(this)">{ic('menu')}</button>
    </div>
  </div>
</header>
<div class="site-mobile-menu{' is-open' if menu_open == 'mobile' else ''}" id="site-mobile-menu">
  <details open><summary>{t('Tools', 'Vositalar', 'Инструменты')}{ic('down')}</summary>
    <ul>{''.join(f'<li><a href="tool.html">{n}</a></li>' for k in ('organize', 'convert', 'secure') for _, n, _ in TOOLS[k][1])}<li><a href="#"><b>All tools</b></a></li></ul>
  </details>
  <a href="#">{t('PDF editor', 'PDF muharriri', 'PDF-редактор')}{ic('chev')}</a>
  <details><summary>AI{ic('down')}</summary><ul><li><a href="ai-service.html">AI documents</a></li><li><a href="ai-service.html">AI slides</a></li><li><a href="ai-service.html">AI CV</a></li><li><a href="#">Prompt guide</a></li></ul></details>
  <a href="pricing.html">{t('Pricing', 'Narxlar', 'Тарифы')}{ic('chev')}</a>
  <a href="#">{t('Telegram bot', 'Telegram bot', 'Telegram-бот')}{ic('chev')}</a>
  <div class="site-mobile-menu-end">
    <div class="site-mobile-menu-langs" role="group" aria-label="Language"><a href="#">O‘zbekcha</a><a href="#">Русский</a><a href="#" aria-current="true">English</a></div>
    <a class="site-btn is-secondary" href="#">{t('Sign in', 'Kirish', 'Войти')}</a>
  </div>
</div>'''


def footer():
    col = lambda title, items: (f'<div><h2>{title}</h2><ul>' +  # noqa: E731
                                ''.join(f'<li><a href="#">{i}</a></li>' for i in items) + '</ul></div>')
    return f'''
<footer class="site-footer">
  <div class="site-container">
    <div class="site-footer-top">
      <div class="site-footer-brand">
        <img class="site-logo-light" src="{BRAND}/docmaster-logo.svg" alt="DocMaster" width="150" height="28">
        <img class="site-logo-dark" src="{BRAND}/docmaster-logo-dark.svg" alt="DocMaster" width="150" height="28">
        <p>PDF tools, a PDF editor and AI documents, on the web and in Telegram. DocMaster was called PDF Master until 2026.</p>
        <div class="site-actions"><a class="site-btn is-secondary is-sm" href="#">{ic('send', 'is-sm')}Telegram bot</a><a class="site-btn is-ghost is-sm" href="#">Channel</a></div>
      </div>
      {col('Popular tools', ['Merge PDF', 'Compress PDF', 'Split PDF', 'JPG to PDF', 'Word to PDF', 'PDF to Word', 'PowerPoint to PDF', 'OCR PDF', 'All tools'])}
      {col('Product', ['PDF editor', 'AI documents', 'AI slides', 'AI CV', 'Pricing', 'Telegram bot', 'Invite friends'])}
      {col('Help', ['Help centre', 'Prompt guide', 'Company and contacts'])}
      {col('Legal', ['Public offer', 'Privacy policy', 'Refund policy'])}
    </div>
    {requisites()}
    <div class="site-footer-bottom">
      <span>© 2026 “ARCANIUM TECHNOLOGIES” MCHJ</span>
      <div class="site-cards" aria-label="Accepted cards"><span>Uzcard</span><span>Humo</span><span>Visa</span><span>Mastercard</span></div>
      <nav class="site-footer-langs" aria-label="Language"><a href="#">O‘zbekcha</a><a href="#">Русский</a><a href="#" aria-current="true">English</a></nav>
    </div>
  </div>
</footer>'''


def requisites(title='Company details'):
    ph = lambda s: f'<span class="site-placeholder">{s}</span>'  # noqa: E731
    return f'''<section class="site-requisites site-sheet" aria-labelledby="site-req-{title[:4]}">
      <h2 id="site-req-{title[:4]}">{title}</h2>
      <dl>
        <div><dt>Seller</dt><dd>“ARCANIUM TECHNOLOGIES” MCHJ</dd></div>
        <div><dt>STIR (TIN)</dt><dd>313458514</dd></div>
        <div><dt>Legal address</dt><dd>Toshkent sh., Yunusobod t., {ph('street, building')}</dd></div>
        <div><dt>Support</dt><dd>{ph('phone')} {ph('email')} {ph('@support')}</dd></div>
      </dl>
    </section>'''


def faq(items, title='Questions', intro='', more=True):
    det = ''.join(
        f'<details{" open" if i == 0 else ""}><summary>{q}{ic("plus")}</summary><div><p>{a}</p></div></details>'
        for i, (q, a) in enumerate(items))
    link = f'<a class="site-link-arrow" href="#">Help centre{ic("right", "is-sm")}</a>' if more else ''
    return f'''<section class="site-section" aria-labelledby="faq-h">
  <div class="site-container site-faq-grid">
    <div><h2 class="site-h2" id="faq-h">{title}</h2>{f'<p class="site-muted">{intro}</p>' if intro else ''}{link}</div>
    <div class="site-faq">{det}</div>
  </div>
</section>'''


def page(name, title, body, lang='en', active='', banner=''):
    return f'''<!doctype html>
<html lang="{lang}" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link rel="icon" href="../../../../public/favicon-docmaster.svg" type="image/svg+xml">
<link rel="stylesheet" href="../../../../app/assets/css/tokens.css">
<link rel="stylesheet" href="site.css">
</head>
<body class="site-body">
{sprite()}
{banner}
{header(active)}
<main id="main">
{body}
</main>
{footer()}
<div class="site-mockbar" aria-label="Mockup controls">
  <button class="site-theme-toggle" type="button" onclick="siteTheme()">{ic('moon', 'is-sm')}Theme</button>
  {'<div class="site-mock-langs" role="group" aria-label="Mockup language"><button type="button" onclick="siteLang(\'en\')" aria-pressed="true">EN</button><button type="button" onclick="siteLang(\'uz\')">UZ</button><button type="button" onclick="siteLang(\'ru\')">RU</button></div>' if name == 'home' else ''}
</div>
<script>
/* Mockup-only helpers: theme, language swap, menus. ?theme=dark&lang=uz&menu=tools&shot=1 */
function siteTheme(v) {{
  var r = document.documentElement
  r.setAttribute('data-theme', v || (r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'))
}}
function siteLang(l) {{
  document.documentElement.lang = l
  document.querySelectorAll('[data-en]').forEach(function (el) {{ el.textContent = el.getAttribute('data-' + l) || el.getAttribute('data-en') }})
  document.querySelectorAll('.site-mock-langs button').forEach(function (b) {{ b.setAttribute('aria-pressed', String(b.textContent.toLowerCase() === l)) }})
}}
function siteMenu(btn) {{
  var m = document.getElementById('site-mobile-menu'), open = !m.classList.contains('is-open')
  m.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open))
}}
document.querySelectorAll('.site-nav-item > button').forEach(function (b) {{
  b.addEventListener('click', function () {{
    var item = b.parentElement, open = !item.classList.contains('is-open')
    document.querySelectorAll('.site-nav-item.is-open').forEach(function (i) {{ i.classList.remove('is-open'); i.firstElementChild.setAttribute('aria-expanded', 'false') }})
    item.classList.toggle('is-open', open); b.setAttribute('aria-expanded', String(open))
  }})
}})
document.addEventListener('keydown', function (e) {{
  if (e.key === 'Escape') document.querySelectorAll('.site-nav-item.is-open').forEach(function (i) {{ i.classList.remove('is-open'); i.firstElementChild.setAttribute('aria-expanded', 'false'); i.firstElementChild.focus() }})
}})
var q = new URLSearchParams(location.search)
if (q.get('theme')) siteTheme(q.get('theme'))
if (q.get('lang')) siteLang(q.get('lang'))
if (q.get('shot')) document.body.classList.add('site-shot')
if (q.get('menu') === 'mobile') siteMenu(document.querySelector('.site-burger'))
else if (q.get('menu')) {{ var n = document.querySelector('[aria-controls="site-mega-' + q.get('menu') + '"]'); if (n) n.click() }}
</script>
</body>
</html>
'''


def section_head(h2, p='', link='', uz=None, ru=None, hid=''):
    lk = f'<a class="site-link-arrow" href="#">{link}{ic("right", "is-sm")}</a>' if link else ''
    return (f'<div class="site-section-head"><div>{t(h2, uz, ru, "h2", "site-h2", f" id=\"{hid}\"" if hid else "")}'
            f'{f"<p>{p}</p>" if p else ""}</div>{lk}</div>')


def steps(items):
    return '<ol class="site-steps">' + ''.join(
        f'<li><h3 class="site-h3">{a}</h3><p>{b}</p></li>' for a, b in items) + '</ol>'


def doc_lines(n=6):
    return ''.join(f'<div class="site-doc-line{" is-s" if i % 3 == 2 else ""}"></div>' for i in range(n))


# ======================================================================= HOME
def home():
    groups = ''
    for key in ('organize', 'convert', 'secure'):
        title, items = TOOLS[key]
        lis = ''.join(
            f'<li><a class="site-toollink" href="tool.html"><span class="site-tool-ico">{ic(i)}</span>'
            f'<span><b>{n}</b><span>{d}</span></span>{ic("chev", "is-sm")}</a></li>' for i, n, d in items)
        groups += f'<div class="site-toolgroup"><h3>{title}</h3><ul>{lis}</ul></div>'

    body = f'''
<section class="site-hero">
  <div class="site-container site-hero-grid">
    <div class="site-hero-copy">
      {t('PDF tools, an editor and AI documents in one place',
         'PDF vositalari, muharrir va AI hujjatlar bir joyda',
         'PDF‑инструменты, редактор и AI‑документы в одном месте', 'h1', 'site-h1')}
      {t('Merge, compress and convert files, edit PDFs, and create documents, slides and CVs with AI. In your browser or in Telegram, in Uzbek, Russian or English.',
         'Fayllarni birlashtiring, siqing va aylantiring, PDF’ni tahrirlang, AI yordamida hujjat, taqdimot va rezyume yarating. Brauzerda yoki Telegramda, o‘zbek, rus yoki ingliz tilida.',
         'Объединяйте, сжимайте и конвертируйте файлы, редактируйте PDF, создавайте документы, презентации и резюме с AI. В браузере или в Telegram, на узбекском, русском или английском.',
         'p', 'site-lead')}
      <div class="site-actions">
        <a class="site-btn is-primary is-lg" href="#">{t('Start free', 'Bepul boshlash', 'Начать бесплатно')}</a>
        <a class="site-btn is-secondary is-lg" href="#">{ic('send')}{t('Open in Telegram', 'Telegramda ochish', 'Открыть в Telegram')}</a>
      </div>
      <div class="site-hero-note">
        <span class="site-chip">{ic('check')}{t('No install', 'O‘rnatish shart emas', 'Без установки')}</span>
        <span class="site-chip">{ic('clock')}{t('Files deleted after 24 hours', 'Fayllar 24 soatdan keyin o‘chiriladi', 'Файлы удаляются через 24 часа')}</span>
      </div>
    </div>
    <div class="site-vignette" aria-hidden="true">
      <div class="site-doc site-sheet">
        <p class="site-doc-title">Iqlim o‘zgarishi va qishloq xo‘jaligi</p>
        <div class="site-doc-meta">Mustaqil ish, 12 bet, O‘zbekcha</div>
        {doc_lines(5)}<div class="site-doc-line is-h"></div>{doc_lines(6)}<div class="site-doc-line is-h"></div>{doc_lines(4)}
      </div>
      <div class="site-task site-panel">
        <div class="site-task-head"><span class="site-tool-ico">{ic('merge')}</span>Merge PDF</div>
        <div class="site-filerow">{ic('file')}<span>shartnoma-2026.pdf</span><small>2.4 MB</small></div>
        <div class="site-filerow">{ic('file')}<span>ilova-1-texnik-topshiriq.pdf</span><small>860 KB</small></div>
        <div class="site-task-result">
          <div><strong>shartnoma-toliq.pdf</strong><small>{ic('clock', 'is-sm')}Deleted in 23 h 58 min</small></div>
          <span class="site-btn is-primary is-sm">{ic('download', 'is-sm')}Download</span>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="site-section" aria-labelledby="tools-h">
  <div class="site-container">
    {section_head('PDF tools for everyday tasks', 'Open a tool, add your files, download the result. Nineteen tools, all in one account.', 'All tools', 'Har kungi ishlar uchun PDF vositalari', 'PDF-инструменты на каждый день', 'tools-h')}
    <div class="site-toolgroups">{groups}</div>
  </div>
</section>

<section class="site-section is-band" aria-labelledby="ai-h">
  <div class="site-container">
    {section_head('Create with AI', 'Describe what you need. DocMaster writes it in Uzbek, Russian or English, and you can ask for changes afterwards.', 'About AI services', 'AI bilan yarating', 'Создавайте с AI', 'ai-h')}
    <div class="site-ai-grid">
      <a class="site-ai-card" href="ai-service.html">
        <div class="site-ai-stage" aria-hidden="true">
          <div class="site-mini-doc site-sheet"><p class="site-doc-title">Raqamli iqtisodiyot</p>{doc_lines(3)}<div class="site-doc-line is-h"></div>{doc_lines(7)}</div>
        </div>
        <div class="site-ai-body">
          <h3 class="site-h3">AI documents</h3>
          <p>A PDF on your topic: essays, reports, coursework.</p>
          <div class="site-ai-facts"><span class="site-chip">Up to 35 pages</span><span class="site-chip">uz, ru, en</span></div>
          <span class="site-link-arrow">Create a document{ic('right', 'is-sm')}</span>
        </div>
      </a>
      <a class="site-ai-card" href="ai-service.html">
        <div class="site-ai-stage" aria-hidden="true">
          <div class="site-mini-slide is-back"><b style="color:#2a2118">Bozor tahlili</b><i style="background:#2a2118;opacity:.3"></i></div>
          <div class="site-mini-slide is-mid"><b>Yashil energiya</b><i></i></div>
          <div class="site-mini-slide"><b>Startap uchun biznes-reja</b><i></i></div>
        </div>
        <div class="site-ai-body">
          <h3 class="site-h3">AI slides</h3>
          <p>A presentation you can edit, as a PowerPoint file.</p>
          <div class="site-ai-facts"><span class="site-chip">Up to 60 slides</span><span class="site-chip">110 designs</span></div>
          <span class="site-link-arrow">Make a presentation{ic('right', 'is-sm')}</span>
        </div>
      </a>
      <a class="site-ai-card" href="ai-service.html">
        <div class="site-ai-stage" aria-hidden="true">
          <div class="site-mini-cv site-sheet"><div><span></span><div class="site-doc-line"></div><div class="site-doc-line is-s"></div><div class="site-doc-line"></div></div><div><div class="site-doc-line is-h"></div>{doc_lines(4)}<div class="site-doc-line is-h"></div>{doc_lines(4)}</div></div>
        </div>
        <div class="site-ai-body">
          <h3 class="site-h3">AI CV</h3>
          <p>From a short message, a LinkedIn PDF or your old CV.</p>
          <div class="site-ai-facts"><span class="site-chip">50 templates</span><span class="site-chip">uz, ru, en</span></div>
          <span class="site-link-arrow">Build a CV{ic('right', 'is-sm')}</span>
        </div>
      </a>
    </div>
  </div>
</section>

<section class="site-section" aria-labelledby="ed-h">
  <div class="site-container site-split">
    <div class="site-split-copy">
      {t('Edit the PDF itself', 'PDF’ning o‘zini tahrirlang', 'Редактируйте сам PDF', 'h2', 'site-h2', ' id="ed-h"')}
      <p class="site-lead">Change the words already on the page, add your own, sign and send. In the browser or as a Telegram Mini App.</p>
      <ul class="site-caps">
        <li>{ic('type')}Edit existing text</li><li>{ic('edit')}Add text</li>
        <li>{ic('highlighter')}Highlight and annotate</li><li>{ic('form')}Fill forms</li>
        <li>{ic('signature')}Place a signature image</li><li>{ic('image')}Insert or replace images</li>
        <li>{ic('redact')}Redact private details</li><li>{ic('send')}Works inside Telegram</li>
      </ul>
      <a class="site-btn is-secondary" href="#">Open the PDF editor</a>
    </div>
    <div class="site-editor site-panel" aria-hidden="true">
      <div class="site-editor-bar"><span>{ic('cursor' if False else 'type')}</span><span class="is-on">{ic('highlighter')}</span><span>{ic('edit')}</span><span>{ic('signature')}</span><span>{ic('image')}</span><span>{ic('redact')}</span><span>{ic('form')}</span></div>
      <div class="site-editor-canvas">
        <div class="site-editor-page site-sheet">
          <p><strong style="color:var(--ink)">Ijara shartnomasi № 14</strong></p>
          <p>Ijarachi binoni <mark>2026-yil 1-dekabrdan</mark> boshlab foydalanishga oladi. Oylik to‘lov har oyning 5-sanasigacha amalga oshiriladi.</p>
          <p>Tomonlar shartnoma shartlarini o‘qib chiqdilar va rozilik bildirdilar.</p>
          <div class="site-editor-sign"><span>Ijarachi imzosi</span><svg viewBox="0 0 120 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 28c8-14 14-20 18-16s-6 18 0 16 10-18 16-14-4 14 2 12 8-10 14-8 4 8 10 6 10-6 16-4 10 2 20 0"/></svg></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="site-section is-band" aria-labelledby="tg-h">
  <div class="site-container site-split is-reverse">
    <div class="site-split-copy">
      {t('The same account on the web and in Telegram', 'Veb va Telegramda bitta hisob', 'Один аккаунт на сайте и в Telegram', 'h2', 'site-h2', ' id="tg-h"')}
      <p class="site-lead">Start a task in the bot on your phone and find it on the web later. Your plan and weekly limits are shared.</p>
      <div class="site-actions"><a class="site-btn is-primary" href="#">{ic('send')}Open the bot</a><a class="site-link-arrow" href="#">How the bot works{ic('right', 'is-sm')}</a></div>
    </div>
    <table class="site-compare">
      <caption class="site-visually-hidden">Web and Telegram compared</caption>
      <thead><tr><th scope="col"><span class="site-visually-hidden">Feature</span></th><th scope="col">On the web</th><th scope="col">In Telegram</th></tr></thead>
      <tbody>
        <tr><th scope="row">File size</th><td data-label="Web">200 MB and 1000 pages per task</td><td data-label="Telegram">20 MB per file</td></tr>
        <tr><th scope="row">PDF editor</th><td data-label="Web">In the browser</td><td data-label="Telegram">As a Mini App</td></tr>
        <tr><th scope="row">AI documents, slides, CV</th><td data-label="Web" class="is-yes">Yes</td><td data-label="Telegram" class="is-yes">Yes</td></tr>
        <tr><th scope="row">Account and plan</th><td data-label="Web">Shared</td><td data-label="Telegram">Shared</td></tr>
      </tbody>
    </table>
  </div>
</section>

<section class="site-section" aria-labelledby="how-h">
  <div class="site-container">
    {section_head('How it works', '', '', 'Qanday ishlaydi', 'Как это работает', 'how-h')}
    {steps([('Upload or describe', 'Add a file, or tell DocMaster the topic of the document you need.'),
            ('DocMaster does the work', 'Files are processed on our servers. Nothing to install on your phone or computer.'),
            ('Download the result', 'Save it, or get it in the Telegram chat. The files are deleted after 24 hours.')])}
  </div>
</section>

<section class="site-section is-band" aria-labelledby="priv-h">
  <div class="site-container">
    {section_head("Your files don’t stay with us", 'What happens to a file from the moment you upload it.', 'Privacy policy', 'Fayllaringiz bizda qolmaydi', 'Ваши файлы у нас не остаются', 'priv-h')}
    <ol class="site-life">
      <li><span class="site-life-dot">{ic('upload', 'is-sm')}</span><b>You upload</b><p>Only you can open the file, from your account.</p><span class="site-life-time">0 h</span></li>
      <li><span class="site-life-dot">{ic('download', 'is-sm')}</span><b>You download</b><p>The result waits in your history.</p><span class="site-life-time">Any time within 24 h</span></li>
      <li><span class="site-life-dot">{ic('trash', 'is-sm')}</span><b>We delete both</b><p>The upload and the result are removed from storage.</p><span class="site-life-time">24 h</span></li>
    </ol>
    <dl class="site-facts">
      <div><dt>{ic('eyeoff')}No analytics</dt><dd>No ad trackers or analytics scripts. Cookies only keep you signed in and remember your language.</dd></div>
      <div><dt>{ic('user')}Your sign-in</dt><dd>Sign in with Telegram, Google or email. No new password needed if you use Telegram.</dd></div>
      <div><dt>{ic('sparkle')}AI requests</dt><dd>Kept for 30 days so we can check quality, then deleted.</dd></div>
    </dl>
  </div>
</section>

<section class="site-section" aria-labelledby="price-h">
  <div class="site-container">
    {section_head('Start free, pay in so‘m when you need more', 'Every plan has every feature. Plans differ only in weekly limits. Paid plans last 30 days and don’t renew on their own.', 'Compare plans', 'Bepul boshlang, ko‘proq kerak bo‘lsa so‘mda to‘lang', 'Начните бесплатно, платите в сумах, когда нужно больше', 'price-h')}
    {plans(compact=True)}
  </div>
</section>

{faq([
    ('Is DocMaster free?', 'Yes. The Free plan includes 5 AI documents and 15 file tasks a week, and 3 AI edits per file. Plus and Premium raise the limits.'),
    ('Is it safe to upload my files?', 'Uploaded files and results are deleted after 24 hours. There are no analytics or ad trackers. AI requests are kept for 30 days for quality review. The privacy policy has the details.'),
    ('Which languages does it work in?', 'The site and the bot work in Uzbek, Russian and English. AI documents, slides and CVs can be written in any of the three.'),
    ('Should I use the bot or the website?', 'Either: it is the same account and plan. The bot takes files up to 20 MB. On the web a task can be up to 200 MB and 1000 pages.'),
    ('How do I pay?', 'By card transfer from Uzcard, Humo, Visa or Mastercard. Upload the receipt in the app and the plan starts once it is approved.'),
    ('Can I change an AI document after it is made?', 'Yes, with AI edits: 3 per file on Free, 10 on Plus, unlimited on Premium.'),
], 'Questions')}

<section class="site-cta">
  <div class="site-container">
    <div class="site-cta-band">
      <span class="site-cta-fold" aria-hidden="true"></span>
      <div>{t('Start with a file or a topic', 'Fayl yoki mavzudan boshlang', 'Начните с файла или темы', 'h2', 'site-h2')}<p>Free plan, no card needed. Sign in with Telegram, Google or email.</p></div>
      <div class="site-actions"><a class="site-btn is-primary is-lg" href="#">{t('Start free', 'Bepul boshlash', 'Начать бесплатно')}</a><a class="site-btn is-secondary is-lg" href="#">{ic('send')}Telegram</a></div>
    </div>
  </div>
</section>'''
    return page('home', 'DocMaster: PDF tools and AI documents', body)


def plans(compact=False, discount=False):
    tick = ic('check')
    note = ic('info')
    plus_price = ('<s><span class="site-visually-hidden">Regular price </span>20 000 so‘m</s>'
                  '<strong>15 000<small>so‘m</small></strong><span>for 30 days. Offer ends 30 November</span>') if discount else \
        '<strong>20 000<small>so‘m</small></strong><span>for 30 days</span>'
    plus_badge = '<span class="site-badge">−25%</span>' if discount else ''
    btn = 'is-sm' if compact else ''
    return f'''<div class="site-plans">
  <article class="site-plan">
    <div class="site-plan-name"><h3 class="site-h3">Free</h3></div>
    <div class="site-plan-price"><strong>0<small>so‘m</small></strong><span>no time limit</span></div>
    <ul><li>{tick}5 AI documents a week</li><li>{tick}15 file tasks a week</li><li>{tick}3 AI edits per file</li><li class="is-note">{note}Join the DocMaster Telegram channel</li></ul>
    <a class="site-btn is-secondary {btn}" href="#">Start free</a>
  </article>
  <article class="site-plan">
    <div class="site-plan-name"><h3 class="site-h3">Plus</h3>{plus_badge}</div>
    <div class="site-plan-price">{plus_price}</div>
    <ul><li>{tick}20 AI documents a week</li><li>{tick}Unlimited file tasks</li><li>{tick}10 AI edits per file</li><li class="is-note">{note}Join the DocMaster Telegram channel</li></ul>
    <a class="site-btn is-primary {btn}" href="#">Choose Plus</a>
  </article>
  <article class="site-plan">
    <div class="site-plan-name"><h3 class="site-h3">Premium</h3></div>
    <div class="site-plan-price"><strong>60 000<small>so‘m</small></strong><span>for 30 days</span></div>
    <ul><li>{tick}Unlimited AI documents</li><li>{tick}Unlimited file tasks</li><li>{tick}Unlimited AI edits</li><li>{tick}No channel requirement</li></ul>
    <a class="site-btn is-secondary {btn}" href="#">Choose Premium</a>
  </article>
</div>'''


# ======================================================================= TOOL
def tool():
    related = ''.join(f'<a href="tool.html"><span class="site-tool-ico">{ic(i)}</span>{n}</a>'
                      for i, n in [('split', 'Split PDF'), ('reorder', 'Reorder pages'), ('compress', 'Compress PDF'), ('image', 'JPG to PDF')])
    body = f'''
<nav class="site-crumbs site-container" aria-label="Breadcrumb"><ol><li><a href="home.html">Home</a></li><li><a href="#">Tools</a></li><li><span aria-current="page">Merge PDF</span></li></ol></nav>
<section class="site-toolhero">
  <div class="site-container site-toolhero-grid">
    <div class="site-toolhero-copy">
      <span class="site-tool-ico" aria-hidden="true">{ic('merge')}</span>
      <h1 class="site-h1">Merge PDF</h1>
      <p class="site-lead">Combine several PDF files into one, in the order you choose. Contracts with their annexes, scanned pages, chapters of a thesis.</p>
      <div class="site-hero-note"><span class="site-chip">{ic('files')}Up to 200 MB per task</span><span class="site-chip">{ic('note')}Up to 1000 pages</span><span class="site-chip">{ic('send')}Also in the Telegram bot</span></div>
    </div>
    <div class="site-drop">
      <span class="site-drop-ico">{ic('upload', 'is-lg')}</span>
      <h2 class="site-h3">Add your PDF files</h2>
      <a class="site-btn is-primary is-lg" href="#">Choose PDF files</a>
      <p>Opens the DocMaster workspace. Sign in with Telegram, Google or email; the Free plan is enough.</p>
    </div>
  </div>
</section>

<section class="site-section is-band" aria-labelledby="how-h">
  <div class="site-container">
    {section_head('How to merge PDF files', hid='how-h')}
    {steps([('Upload your PDFs', 'Add two or more PDF files from your phone or computer.'),
            ('Set the order', 'Move files up or down until they are in the order you want.'),
            ('Download one PDF', 'DocMaster joins them into a single file. Download it or send it to Telegram.')])}
  </div>
</section>

<section class="site-section" aria-labelledby="det-h">
  <div class="site-container site-split">
    <div class="site-split-copy">
      <h2 class="site-h2" id="det-h">One file instead of five attachments</h2>
      <p class="site-lead">Pages keep their size, text and quality. Bookmarks and form fields from the original files are not carried over.</p>
      <p class="site-muted">Need only some pages? Use <a class="site-link" href="#">Extract pages</a> first, or <a class="site-link" href="#">Reorder pages</a> after merging.</p>
    </div>
    <div class="site-merge-pic site-panel" aria-hidden="true">
      <div class="site-stack"><div class="site-filerow">{ic('file')}<span>shartnoma.pdf</span><small>4 p.</small></div><div class="site-filerow">{ic('file')}<span>ilova-1.pdf</span><small>2 p.</small></div><div class="site-filerow">{ic('file')}<span>ilova-2.pdf</span><small>3 p.</small></div></div>
      {ic('right')}
      <div class="site-filerow" style="border-color:var(--action)">{ic('file')}<span>shartnoma-toliq.pdf</span><small>9 p.</small></div>
    </div>
  </div>
</section>

<section class="site-section is-band" aria-labelledby="lim-h">
  <div class="site-container">
    {section_head('Limits', 'File limits come from the tool catalog; weekly limits from your plan.', 'Compare plans', hid='lim-h')}
    <dl class="site-kv">
      <div><dt>On the web</dt><dd>200 MB, 1000 pages<small>per task, all files together</small></dd></div>
      <div><dt>In the Telegram bot</dt><dd>20 MB per file<small>send larger files on the web</small></dd></div>
      <div><dt>Free plan</dt><dd>15 file tasks a week<small>Unlimited on Plus and Premium. The week starts Monday 00:00, Tashkent time.</small></dd></div>
    </dl>
  </div>
</section>

<section class="site-section is-tight" aria-label="Privacy">
  <div class="site-container">
    <div class="site-note">{ic('shield')}<p><strong>Your files are deleted after 24 hours.</strong> That covers both the PDFs you upload and the merged result. Only your account can open them. <a class="site-link" href="legal.html">Privacy policy</a></p></div>
  </div>
</section>

{faq([
    ('How many files can I merge?', 'As many as fit in one task: up to 200 MB and 1000 pages in total on the web. In the Telegram bot each file can be up to 20 MB.'),
    ('Can I change the page order after merging?', 'Yes. Open the merged file in Reorder pages, or set the file order before you merge.'),
    ('Is it free?', 'Yes. Merging counts as one file task. The Free plan has 15 a week; Plus and Premium have no weekly limit.'),
    ('Does it work on a phone?', 'Yes, in the mobile browser or in the DocMaster Telegram bot.'),
], 'Questions about merging', more=True)}

<section class="site-section" aria-labelledby="rel-h">
  <div class="site-container">
    {section_head('Related tools', '', 'All tools', hid='rel-h')}
    <div class="site-related">{related}</div>
  </div>
</section>'''
    return page('tool', 'Merge PDF online: DocMaster', body, active='tools')


# ======================================================================= PRICING
def pricing():
    banner = f'''<div class="site-banner" role="status">
  <div class="site-container">{ic('percent')}<p style="margin:0"><b>Plus discount:</b> <s><span class="site-visually-hidden">Regular price </span>20 000 so‘m</s> <b>15 000 so‘m</b> <span class="site-badge">−25%</span> until 30 November</p><a class="site-link-arrow" href="#plans">See plans{ic('right', 'is-sm')}</a></div>
</div>'''
    rows = [
        ('AI documents a week', '5', '20', 'Unlimited'),
        ('File tasks a week', '15', 'Unlimited', 'Unlimited'),
        ('AI edits per file', '3', '10', 'Unlimited'),
        ('Telegram channel', 'Join required', 'Join required', 'Not required'),
        ('File size on the web', '200 MB, 1000 pages', '200 MB, 1000 pages', '200 MB, 1000 pages'),
        ('File size in the bot', '20 MB', '20 MB', '20 MB'),
        ('Price for 30 days', '0 so‘m', '20 000 so‘m', '60 000 so‘m'),
    ]
    trs = ''.join(f'<tr><th scope="row">{r[0]}</th><td data-label="Free">{r[1]}</td><td data-label="Plus">{r[2]}</td><td data-label="Premium">{r[3]}</td></tr>' for r in rows)
    body = f'''
<section class="site-hero" style="padding-bottom:48px">
  <div class="site-container" style="display:grid;gap:20px;justify-items:start">
    <h1 class="site-h1" style="max-width:18ch">Plans and prices</h1>
    <p class="site-lead">Every plan has every tool, the editor and all three AI services. Plans differ only in weekly limits. Prices are in so‘m; paid plans last 30 days and don’t renew on their own.</p>
  </div>
</section>
<section class="site-section is-tight" id="plans" aria-label="Plans" style="padding-top:0">
  <div class="site-container">{plans(discount=True)}</div>
</section>

<section class="site-section" aria-labelledby="cmp-h">
  <div class="site-container">
    {section_head('Compare limits', 'Everything not listed here is the same on every plan.', hid='cmp-h')}
    <div class="site-table-wrap"><table class="site-table">
      <thead><tr><th scope="col">Limit</th><th scope="col">Free</th><th scope="col">Plus</th><th scope="col">Premium</th></tr></thead>
      <tbody>{trs}</tbody>
      <caption>The week starts on Monday at 00:00, Tashkent time. Unused limits don’t carry over.</caption>
    </table></div>
  </div>
</section>

<section class="site-section is-band" aria-labelledby="pay-h">
  <div class="site-container">
    {section_head('How to pay', 'Card transfer today. Automatic card payment will appear here when it launches.', hid='pay-h')}
    <ol class="site-steps" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
      <li><h3 class="site-h3">Choose a plan</h3><p>In the app, under Plans, or in the bot.</p></li>
      <li><h3 class="site-h3">Transfer by card</h3><p>From Uzcard, Humo, Visa or Mastercard to the card shown in the app.</p></li>
      <li><h3 class="site-h3">Upload the receipt</h3><p>A screenshot or PDF of the transfer.</p></li>
      <li><h3 class="site-h3">Plan starts</h3><p>As soon as we approve the receipt. The 30 days start from approval.</p></li>
    </ol>
    <div class="site-cards" style="margin-top:28px" aria-label="Accepted cards"><span>Uzcard</span><span>Humo</span><span>Visa</span><span>Mastercard</span></div>
  </div>
</section>

<section class="site-section" aria-label="Invite and refunds">
  <div class="site-container"><dl class="site-kv" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
    <div><dt>{ic('gift', 'is-sm')} Invite friends</dt><dd>5 friends, 1 month of Plus<small>Every 5 new people who join with your link earn Plus. <a class="site-link" href="#">How invites work</a></small></dd></div>
    <div><dt>{ic('calendar', 'is-sm')} No auto-renewal</dt><dd>Nothing to cancel<small>When 30 days pass, the account goes back to Free. Your files and history stay.</small></dd></div>
    <div><dt>{ic('receipt', 'is-sm')} Refunds</dt><dd>Back to the same card<small>When and how is in the <a class="site-link" href="#">refund policy</a> and the <a class="site-link" href="legal.html">public offer</a>.</small></dd></div>
  </dl></div>
</section>

{faq([
    ('Does a plan renew automatically?', 'No. A paid plan lasts 30 days and then ends. To continue, pay again.'),
    ('What happens when my plan ends?', 'Your account moves to Free with its weekly limits. Nothing is deleted from your history because of it.'),
    ('How long does approval take?', '<span class="site-placeholder">Owner to confirm the usual approval time and support hours.</span>'),
    ('Can I switch from Plus to Premium mid-period?', '<span class="site-placeholder">Owner to confirm.</span>'),
], 'Questions about paying')}'''
    return page('pricing', 'Plans and prices: DocMaster', body, active='pricing', banner=banner)


# ======================================================================= AI SERVICE (slides variant)
def ai_service():
    pal = [('#0f2f57', '#fff', 'Yashil energiya'), ('#efe6d8', '#2a2118', 'Bozor tahlili'), ('#1f7a5a', '#fff', 'Ekologiya'),
           ('#ffffff', '#0e1726', 'Moliyaviy hisobot'), ('#2b2140', '#f1e8ff', 'Startap pitch'), ('#f6d74a', '#1c1a10', 'Ta’lim loyihasi'),
           ('#d9e8f7', '#10304f', 'Tibbiyot'), ('#3b0d11', '#ffd9d2', 'Tarix darsi'), ('#e8efe6', '#20372c', 'Qishloq xo‘jaligi'),
           ('#101418', '#e9f0f7', 'IT xizmatlari'), ('#fbe3d6', '#5a2412', 'Turizm'), ('#5a6b7d', '#ffffff', 'Logistika')]
    designs = ''.join(f'<div class="site-design" style="background:{b};color:{c}"><b>{n}</b><i></i></div>' for b, c, n in pal)
    body = f'''
<nav class="site-crumbs site-container" aria-label="Breadcrumb"><ol><li><a href="home.html">Home</a></li><li><a href="#">AI</a></li><li><span aria-current="page">AI slides</span></li></ol></nav>
<section class="site-toolhero">
  <div class="site-container site-toolhero-grid">
    <div class="site-toolhero-copy">
      <h1 class="site-h1">AI presentation maker</h1>
      <p class="site-lead">Give a topic, pick a design and get a PowerPoint file you can edit, up to 60 slides. In Uzbek, Russian or English.</p>
      <div class="site-actions"><a class="site-btn is-primary is-lg" href="#">Create a presentation</a><a class="site-btn is-secondary is-lg" href="#">{ic('send')}In Telegram</a></div>
      <div class="site-hero-note"><span class="site-chip">{ic('slides')}Up to 60 slides</span><span class="site-chip">{ic('layers')}110 designs</span><span class="site-chip">{ic('edit')}Editable .pptx</span></div>
    </div>
    <div class="site-slides-stage" aria-hidden="true">
      <div class="site-slide is-under"><b>Bozor tahlili 2026</b><small>Kirish</small></div>
      <div class="site-slide"><b>Quyosh energiyasi O‘zbekistonda</b><div class="site-slide-bars"><i style="height:30%"></i><i style="height:45%"></i><i style="height:52%"></i><i style="height:70%"></i><i style="height:92%"></i></div></div>
      <span class="site-chip site-slide-count">Slide 4 of 18</span>
    </div>
  </div>
</section>

<section class="site-section is-band" aria-labelledby="how-h">
  <div class="site-container">
    {section_head('From a topic to a finished deck', hid='how-h')}
    {steps([('Describe the topic', 'Say what the presentation is about, who it is for, the language and how many slides.'),
            ('Pick a design', 'Choose one of 110 designs, or let DocMaster pick one that suits the topic.'),
            ('Edit and download', 'Change slides with AI edits or in the deck editor, then download the .pptx.')])}
  </div>
</section>

<section class="site-section" aria-labelledby="des-h">
  <div class="site-container">
    {section_head('110 designs to choose from', 'Each design is a palette and a layout system, not just a background. These tiles stand in for the real picker thumbnails.', hid='des-h')}
    <div class="site-designs" aria-label="Design examples">{designs}</div>
  </div>
</section>

<section class="site-section is-band" aria-labelledby="edit-h">
  <div class="site-container site-split">
    <div class="site-split-copy">
      <h2 class="site-h2" id="edit-h">A real PowerPoint file, not a picture</h2>
      <p class="site-lead">Every title, bullet and chart stays editable. Open it in PowerPoint, Keynote or Google Slides, or keep working in the DocMaster deck editor.</p>
    </div>
    <div style="display:grid;gap:12px;justify-items:start">
      <span class="site-file-pill"><span class="site-file-ext">PPTX</span><b>quyosh-energiyasi.pptx</b><span class="site-muted site-small">18 slides</span></span>
      <span class="site-file-pill">{ic('edit')}<span>Change text, swap images, reorder slides</span></span>
      <span class="site-file-pill">{ic('sparkle')}<span>“Make slide 6 shorter and add a chart”</span></span>
    </div>
  </div>
</section>

<section class="site-section" aria-labelledby="lim-h">
  <div class="site-container">
    {section_head('Limits', 'A presentation counts as one AI document.', 'Compare plans', hid='lim-h')}
    <dl class="site-kv">
      <div><dt>Free</dt><dd>5 AI documents a week<small>3 AI edits per file</small></dd></div>
      <div><dt>Plus, 20 000 so‘m</dt><dd>20 AI documents a week<small>10 AI edits per file</small></dd></div>
      <div><dt>Premium, 60 000 so‘m</dt><dd>Unlimited<small>Unlimited AI edits</small></dd></div>
    </dl>
  </div>
</section>

{faq([
    ('How many slides can it make?', 'Up to 60 in one presentation.'),
    ('Can I change the design later?', 'Yes. Pick another design in the deck editor; your text stays.'),
    ('Which languages can it write in?', 'Uzbek (Latin), Russian and English.'),
    ('Is my request stored?', 'AI requests and results are kept for 30 days for quality review. Files are deleted after 24 hours.'),
], 'Questions about AI slides')}

<section class="site-section" aria-labelledby="rel-h">
  <div class="site-container">
    {section_head('Also useful', hid='rel-h')}
    <div class="site-related">
      <a href="#"><span class="site-tool-ico">{ic('file')}</span>AI documents</a>
      <a href="#"><span class="site-tool-ico">{ic('user')}</span>AI CV</a>
      <a href="tool.html"><span class="site-tool-ico">{ic('slides')}</span>PowerPoint to PDF</a>
      <a href="#"><span class="site-tool-ico">{ic('note')}</span>Prompt guide</a>
    </div>
  </div>
</section>'''
    return page('ai-service', 'AI presentation maker: DocMaster', body, active='ai')


# ======================================================================= LEGAL (offer)
def legal():
    secs = [
        ('parties', 'Parties', '<p>This public offer is made by <strong>“ARCANIUM TECHNOLOGIES” MCHJ</strong> (STIR 313458514), Toshkent sh., Yunusobod t. (the Seller), to any person who uses DocMaster (the User).</p>'),
        ('subject', 'Subject', '<p>The Seller gives the User access to the DocMaster services: PDF file tools, the PDF editor and AI documents, slides and CVs, on the website docmaster.live and in the DocMaster Telegram bot.</p>'),
        ('acceptance', 'Acceptance', '<p>The User accepts this offer by signing in to DocMaster or by paying for a plan. From that moment the contract is concluded on the terms below.</p><p class="site-muted">Lawyer to cite the Civil Code articles on public offer and acceptance.</p>'),
        ('plans-prices', 'Plans and prices', '<p>Plans and prices are listed on the Pricing page in so‘m: Free (0 so‘m), Plus (20 000 so‘m for 30 days) and Premium (60 000 so‘m for 30 days). A temporary discount shows its end date.</p>'),
        ('payment', 'Payment and activation', '<p>The User pays by card transfer and uploads the receipt. The plan starts when the Seller approves the receipt and lasts 30 days. Plans don’t renew automatically.</p>'),
        ('limits-usage', 'Limits and acceptable use', '<p>Weekly limits depend on the plan. Files can be up to 200 MB and 1000 pages per task on the web and 20 MB per file in the bot.</p>'),
        ('ai-content', 'AI content', '<p>AI results can contain mistakes. The User checks them before use. AI requests and results are kept for 30 days for quality review.</p>'),
        ('refunds', 'Refunds', '<p>Refunds follow the Refund policy and go back to the card used for payment.</p>'),
        ('liability', 'Liability and disputes', '<p>The laws of the Republic of Uzbekistan apply. Disputes are settled by negotiation first, then in court.</p>'),
        ('language', 'Language', '<p>This offer is published in Uzbek, Russian and English. If the texts differ, the Uzbek text prevails.</p>'),
    ]
    toc = ''.join(f'<li><a href="#{i}"{" aria-current=\"true\"" if n == 0 else ""}>{n + 1}. {h}</a></li>' for n, (i, h, _) in enumerate(secs))
    toc += f'<li><a href="#requisites">{len(secs) + 1}. Seller details</a></li>'
    mtoc = ''.join(f'<li><a href="#{i}">{h}</a></li>' for i, h, _ in secs)
    prose = ''.join(f'<h2 id="{i}"><span>{n + 1}.</span>{h}</h2>{b}' for n, (i, h, b) in enumerate(secs))
    body = f'''
<nav class="site-crumbs site-container is-narrow" style="max-width:calc(var(--site-container) + 2*var(--site-gutter))" aria-label="Breadcrumb"><ol><li><a href="home.html">Home</a></li><li><a href="#">Legal</a></li><li><span aria-current="page">Public offer</span></li></ol></nav>
<div class="site-container">
  <header class="site-legal-head">
    <h1 class="site-h1">Public offer</h1>
    <div class="site-legal-meta"><span>Ommaviy oferta</span><span>Version 1.0</span><span>In force from <span class="site-placeholder">date</span></span></div>
    <div class="site-note" style="max-width:var(--site-measure)">{ic('languages')}<p>This English text is a translation. The <a class="site-link" href="#">Uzbek text</a> prevails.</p></div>
  </header>
  <div class="site-legal-grid">
    <nav class="site-toc" aria-label="Contents"><h2>Contents</h2><ol>{toc}</ol></nav>
    <article class="site-prose">
      <details class="site-legal-mobile-toc"><summary>Contents</summary><ol>{mtoc}</ol></details>
      {prose}
      <h2 id="requisites"><span>{len(secs) + 1}.</span>Seller details</h2>
      {requisites('Requisites')}
    </article>
  </div>
</div>'''
    return page('legal', 'Public offer: DocMaster', body)


if __name__ == '__main__':
    for name, fn in [('home', home), ('tool', tool), ('pricing', pricing), ('ai-service', ai_service), ('legal', legal)]:
        with open(f'{OUT}/{name}.html', 'w') as f:
            f.write(fn())
        print('wrote', name)
