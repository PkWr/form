"""Writes glyphs.js: the outlines of the characters the downloads use, so type in the SVG files can be drawn as shapes
and the reader needs no fonts installed. Fonts (all SIL Open Font Licence): Libre Baskerville Italic and Libre Franklin.
Run once after changing the fonts: python3 tools/make-glyphs.py <folder holding the two .woff files>"""
import sys, json, pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
src = pathlib.Path(sys.argv[1])
FONTS = {'serif': 'libre-baskerville-latin-400-italic.woff', 'sans': 'libre-franklin-latin-400-normal.woff'}
CHARS = ''.join(chr(c) for c in range(32, 127)) + '©·–—‘’“”…×'
out = {}
for key, name in FONTS.items():
    f = TTFont(src / name); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm; hm = f['hmtx']; g = {}
    for ch in CHARS:
        gn = cmap.get(ord(ch))
        if not gn: continue
        pen = SVGPathPen(gs, ntos=lambda v: str(int(round(v)))); gs[gn].draw(pen)
        g[ch] = [int(round(hm[gn][0])), pen.getCommands()]
    out[key] = {'upm': upm, 'g': g}
js = '// Outlines of the characters used in the downloads (made by tools/make-glyphs.py): Libre Baskerville Italic and Libre Franklin, SIL Open Font Licence.\nconst GLYPHS = ' + json.dumps(out, separators=(',', ':'), ensure_ascii=False) + ';\n'
pathlib.Path(__file__).resolve().parent.parent.joinpath('glyphs.js').write_text(js, encoding='utf-8'); print(len(js) // 1024, 'KB', {k: len(v['g']) for k, v in out.items()})
