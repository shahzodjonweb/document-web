"""Outline a string from a variable font at a fixed weight into SVG path data.

outline(font, weight, size, tracking, text, pairs) -> dict(d, width, cap, xh)
Coordinates are y-down with the baseline at y=0. tracking and pair values are
in em/1000.
"""
from functools import lru_cache

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer


@lru_cache(None)
def _font(path, weight):
    font = TTFont(path)
    if 'fvar' in font:
        loc = {}
        for axis in font['fvar'].axes:
            loc[axis.axisTag] = weight if axis.axisTag == 'wght' else (
                axis.maxValue if axis.axisTag == 'opsz' else axis.defaultValue)
        font = instancer.instantiateVariableFont(font, loc)
    return font


def outline(path, weight, size, tracking, text, pairs=None, x0=0.0, y0=0.0):
    pairs = pairs or {}
    font = _font(path, weight)
    scale = size / font['head'].unitsPerEm
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font['hmtx']
    pen = SVGPathPen(gs, ntos=lambda v: f'{v:.2f}'.rstrip('0').rstrip('.'))
    x = x0
    for i, ch in enumerate(text):
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (scale, 0, 0, -scale, x, y0)))
        x += hmtx[g][0] * scale + tracking / 1000 * size
        if i + 1 < len(text):
            x += pairs.get(text[i:i + 2], 0) / 1000 * size
    x -= tracking / 1000 * size
    os2 = font['OS/2']
    return {'d': pen.getCommands(), 'width': x - x0,
            'cap': os2.sCapHeight * scale, 'xh': os2.sxHeight * scale}
