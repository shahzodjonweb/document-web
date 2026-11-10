"""Build the DocMaster logo concepts and the asset set for the recommended one.

Run with the fonttools venv:  ../ftvenv/bin/python gen.py
Every glyph is outlined from the self-hosted OFL fonts, so the SVGs carry no
font dependency and no rasters.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from textpath import outline  # noqa: E402

WT = ('/private/tmp/claude-501/-Users-shakhzoduralov--claude-spares-spare-3xH9lN/'
      '3abbc986-6d98-4d1a-bb5b-f0ab8efba645/scratchpad/web-site')
FONTS = f'{WT}/public/fonts'
MANROPE = f'{FONTS}/manrope-variable.ttf'
DMSANS = f'{FONTS}/dm-sans-variable.ttf'
OUT = f'{WT}/docs/site/design/brand'
PUB = f'{WT}/public'

BLUE = '#0275FC'
BLUE_DARK = '#3D91FF'   # brand blue lifted for dark surfaces (6.0:1 on #0B111C)
RED = '#FA3331'
INK = '#0E1726'
PAPER_DARK = '#0B111C'
SNOW = '#EEF3FA'

# ---------------------------------------------------------------- marks
# Each mark is drawn on a 64-unit grid and returns SVG markup for one theme.
# 'bg' is the colour behind the mark (needed where a mark cuts a gap).


def mark_a(fg, flap, bg=None):
    """Dog-ear D: a D whose top-right corner is a folded page corner."""
    body = ('M16 8H38L52 22V36A20 20 0 0 1 32 56H16A2 2 0 0 1 14 54V10A2 2 0 0 1 16 8Z'
            'M24 18H32L42 28V36A10 10 0 0 1 32 46H24Z')
    return (f'<path fill="{fg}" fill-rule="evenodd" d="{body}"/>'
            f'<path fill="{flap}" d="M38 8V22H52Z"/>')


MARK_A_BOX = (14, 8, 52, 56)


def mark_b(back, front, bg):
    """Two sheets: the old two-page idea, redrawn as overlapping pages."""
    return (f'<rect x="24" y="6" width="30" height="38" rx="5" fill="{back}"/>'
            f'<rect x="10" y="20" width="30" height="38" rx="5" fill="{front}" '
            f'stroke="{bg}" stroke-width="4" paint-order="stroke"/>')


MARK_B_BOX = (8, 6, 54, 60)


def mark_c(disc, letters, dot):
    """Stamp: a round seal (muhr) with a lowercase dm monogram."""
    t = outline(DMSANS, 700, 27, -30, 'dm')
    # centre the pair in the disc: baseline so x-height sits slightly above middle
    x0 = 32 - t['width'] / 2
    y0 = 32 + (t['xh'] * 0.5) + 2.2
    t = outline(DMSANS, 700, 27, -30, 'dm', x0=x0, y0=y0)
    return (f'<circle cx="32" cy="32" r="27" fill="{disc}"/>'
            f'<circle cx="32" cy="32" r="23.6" fill="none" stroke="{letters}" stroke-width="1.3" opacity=".55"/>'
            f'<path fill="{letters}" d="{t["d"]}"/>'
            f'<circle cx="51.5" cy="12.5" r="4.5" fill="{dot}"/>')


MARK_C_BOX = (5, 5, 59, 59)

# ---------------------------------------------------------------- concepts

CONCEPTS = {
    'a': dict(
        name='Folded corner', font=MANROPE, weight=700, tracking=-22, text='DocMaster',
        mark=lambda dark, bg: mark_a(BLUE_DARK if dark else BLUE, RED, bg),
        box=MARK_A_BOX, mark_h=1.36,
        tile_bg=BLUE, tile=lambda: mark_a('#FFFFFF', RED, BLUE), tile_scale=0.72,
        tile_round=False,
    ),
    'b': dict(
        name='Two sheets', font=MANROPE, weight=600, tracking=-14, text='DocMaster',
        mark=lambda dark, bg: mark_b(BLUE_DARK if dark else BLUE, SNOW if dark else INK, bg),
        box=MARK_B_BOX, mark_h=1.40,
        tile_bg=INK, tile=lambda: mark_b(BLUE_DARK, '#FFFFFF', INK), tile_scale=0.62,
        tile_round=False,
    ),
    'c': dict(
        name='Seal', font=DMSANS, weight=600, tracking=-18, text='docmaster',
        mark=lambda dark, bg: mark_c(BLUE_DARK if dark else BLUE, '#FFFFFF', RED),
        box=MARK_C_BOX, mark_h=1.62,
        tile_bg=BLUE, tile=lambda: mark_c('#FFFFFF', BLUE, RED), tile_scale=0.70,
        tile_round=True,
    ),
}


def lockup(key, dark, size=100):
    """Return (inner markup, width, height) of mark + wordmark, origin top-left."""
    c = CONCEPTS[key]
    t = outline(c['font'], c['weight'], size, c['tracking'], c['text'])
    cap = t['cap'] if c['text'][0].isupper() else t['xh'] * 1.38
    x0, y0, x1, y1 = c['box']
    mh = cap * c['mark_h']
    s = mh / (y1 - y0)
    mw = (x1 - x0) * s
    gap = size * 0.24
    pad = 0
    top = 0
    # text baseline: centre of cap/x-height aligned with mark centre
    centre = mh / 2
    ref = t['cap'] if c['text'][0].isupper() else t['xh']
    baseline = centre + ref / 2
    tx = mw + gap
    t = outline(c['font'], c['weight'], size, c['tracking'], c['text'], x0=tx, y0=baseline)
    ink = SNOW if dark else INK
    bg = PAPER_DARK if dark else '#FFFFFF'
    # descenders are absent in both words, so the height is the mark height
    h = mh
    w = tx + t['width']
    inner = (f'<g transform="translate({-x0 * s:.3f} {-y0 * s:.3f}) scale({s:.4f})">'
             f'{c["mark"](dark, bg)}</g>'
             f'<path fill="{ink}" d="{t["d"]}"/>')
    return inner, w, h


def tile(key, size=64, maskable=False, shape='square'):
    """App icon: the mark on a brand tile. Returns markup on a 64 grid."""
    c = CONCEPTS[key]
    x0, y0, x1, y1 = c['box']
    sc = c['tile_scale'] * (0.82 if maskable else 1)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if c['tile_round'] and not maskable:
        # the seal is already round; the tile is the disc in white on blue
        bgshape = f'<rect width="64" height="64" rx="14" fill="{c["tile_bg"]}"/>'
    elif maskable:
        bgshape = f'<rect width="64" height="64" fill="{c["tile_bg"]}"/>'
    else:
        bgshape = f'<rect width="64" height="64" rx="14" fill="{c["tile_bg"]}"/>'
    return (bgshape +
            f'<g transform="translate(32 32) scale({sc}) translate({-cx} {-cy})">{c["tile"]()}</g>')


def bare_mark(key, dark=False):
    c = CONCEPTS[key]
    x0, y0, x1, y1 = c['box']
    bg = PAPER_DARK if dark else '#FFFFFF'
    return c['mark'](dark, bg), (x0, y0, x1 - x0, y1 - y0)


def svg(inner, w, h, title, vb=None, extra=''):
    vb = vb or f'0 0 {w:.2f} {h:.2f}'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w:.0f}" '
            f'height="{h:.0f}" role="img" aria-label="{title}"{extra}>'
            f'<title>{title}</title>{inner}</svg>\n')


def concept_sheet(key):
    """One SVG board per concept: light logo, dark logo, icon at three sizes."""
    c = CONCEPTS[key]
    W, H = 1200, 760
    parts = [f'<rect width="{W}" height="{H}" fill="#F5F7FA"/>']
    # light panel
    parts.append('<rect x="40" y="40" width="1120" height="300" rx="20" fill="#FFFFFF" stroke="#E3E8EF"/>')
    inner, w, h = lockup(key, False)
    s = min(640 / w, 150 / h)
    parts.append(f'<g transform="translate({600 - w * s / 2:.1f} {190 - h * s / 2:.1f}) scale({s:.4f})">{inner}</g>')
    # dark panel
    parts.append(f'<rect x="40" y="370" width="700" height="350" rx="20" fill="{PAPER_DARK}"/>')
    inner, w, h = lockup(key, True)
    s = min(520 / w, 120 / h)
    parts.append(f'<g transform="translate({390 - w * s / 2:.1f} {545 - h * s / 2:.1f}) scale({s:.4f})">{inner}</g>')
    # icon sizes
    parts.append('<rect x="770" y="370" width="390" height="350" rx="20" fill="#FFFFFF" stroke="#E3E8EF"/>')
    x = 810
    for px in (128, 64, 32):
        parts.append(f'<g transform="translate({x} {545 - px / 2}) scale({px / 64})">{tile(key)}</g>')
        x += px + 36
    parts.append(f'<text x="810" y="690" font-family="DM Sans, -apple-system, Segoe UI, sans-serif" '
                 f'font-size="15" fill="#5B6779">App icon at 128, 64 and 32 px</text>')
    parts.append(f'<text x="64" y="700" font-family="DM Sans, -apple-system, Segoe UI, sans-serif" '
                 f'font-size="15" fill="#93A2B7">Concept {key.upper()}: {c["name"]}, dark theme</text>')
    return svg(''.join(parts), W, H, f'DocMaster logo concept {key.upper()}: {c["name"]}')


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(text)


def main():
    for key in CONCEPTS:
        write(f'{OUT}/concept-{key}.svg', concept_sheet(key))
        # parts for concepts.html
        for dark in (False, True):
            inner, w, h = lockup(key, dark)
            write(f'{OUT}/parts/{key}-logo{"-dark" if dark else ""}.svg',
                  svg(inner, w, h, 'DocMaster'))
        write(f'{OUT}/parts/{key}-tile.svg', svg(tile(key), 64, 64, 'DocMaster icon', '0 0 64 64'))
        m, (x, y, w, h) = bare_mark(key)
        write(f'{OUT}/parts/{key}-mark.svg', svg(m, w * 4, h * 4, 'DocMaster icon', f'{x} {y} {w} {h}'))
        m, (x, y, w, h) = bare_mark(key, True)
        write(f'{OUT}/parts/{key}-mark-dark.svg', svg(m, w * 4, h * 4, 'DocMaster icon', f'{x} {y} {w} {h}'))

    rec = 'a'
    inner, w, h = lockup(rec, False)
    write(f'{PUB}/brand/docmaster-logo.svg', svg(inner, w, h, 'DocMaster'))
    inner, w, h = lockup(rec, True)
    write(f'{PUB}/brand/docmaster-logo-dark.svg', svg(inner, w, h, 'DocMaster'))
    m, (x, y, w, h) = bare_mark(rec)
    write(f'{PUB}/brand/docmaster-icon.svg', svg(m, 480 * w / h, 480, 'DocMaster', f'{x} {y} {w} {h}'))
    write(f'{PUB}/brand/docmaster-icon-tile.svg', svg(tile(rec), 512, 512, 'DocMaster', '0 0 64 64'))
    write(f'{PUB}/brand/docmaster-icon-maskable.svg',
          svg(tile(rec, maskable=True), 512, 512, 'DocMaster', '0 0 64 64'))
    write(f'{PUB}/favicon-docmaster.svg', svg(tile(rec), 64, 64, 'DocMaster', '0 0 64 64'))


if __name__ == '__main__':
    main()
