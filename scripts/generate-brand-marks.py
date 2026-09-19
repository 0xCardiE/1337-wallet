#!/usr/bin/env python3
"""Rebuild hoodie mark + pixel 1337 wordmark (public/icons)."""
from __future__ import annotations

import base64
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'brand/hoodie-sources/hoodie-evm.png'
OUT = ROOT / 'public/icons'
GREEN = (0, 255, 0, 255)
WORD_SCALE = 12
# Knock out the near-black plate without eating the baked glow.
BG_MAX = 12
GLOW_FADE = 36
# Crop to the hood, not the faint halo, so small lockups still read.
CROP_GREEN = 80
MARK_PAD = 4

# Chunky arcade 1337 wordmark (#00ff00).
ONE = [
    ' ####',
    '#####',
    '#####',
    '# ###',
    '  ###',
    '  ###',
    '  ###',
    '  ###',
    '  ###',
    '  ###',
    '  ###',
]
THREE = [
    '####### ',
    '########',
    '########',
    '      ##',
    '      ##',
    ' #######',
    '####### ',
    '      ##',
    '      ##',
    '########',
    '####### ',
]
SEVEN = [
    '########',
    '########',
    '########',
    '     ###',
    '     ###',
    '    ### ',
    '   ###  ',
    '  ###   ',
    '  ##    ',
    '  ##    ',
    '  ##    ',
]
GAP = 2


def write_mark() -> None:
    src = Image.open(SRC).convert('RGBA')
    px = src.load()
    w, h = src.size
    punched = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out_px = punched.load()
    span = max(1, GLOW_FADE - BG_MAX)

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if g <= BG_MAX and r < 40 and b < 40:
                continue
            if g < GLOW_FADE and r < 80 and b < 80:
                alpha = int(255 * (g - BG_MAX) / span)
                if alpha < 8:
                    continue
                out_px[x, y] = (r, g, b, alpha)
            else:
                out_px[x, y] = (r, g, b, a)

    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = out_px[x, y]
            if a >= 8 and g >= CROP_GREEN:
                xs.append(x)
                ys.append(y)
    if not xs:
        raise SystemExit(f'hoodie knockout produced an empty mark from {SRC}')
    x0 = max(0, min(xs) - MARK_PAD)
    y0 = max(0, min(ys) - MARK_PAD)
    x1 = min(w, max(xs) + 1 + MARK_PAD)
    y1 = min(h, max(ys) + 1 + MARK_PAD)
    cropped = punched.crop((x0, y0, x1, y1))
    side = max(cropped.size)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(
        cropped,
        ((side - cropped.size[0]) // 2, (side - cropped.size[1]) // 2),
        cropped,
    )

    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / '1337-skull.png'
    canvas.save(dest, 'PNG')
    print('wrote', dest, canvas.size, '(original, transparent)')

    png_b64 = base64.b64encode(dest.read_bytes()).decode('ascii')
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side} {side}" '
        f'role="img" aria-label="1337">'
        f'<image href="data:image/png;base64,{png_b64}" width="{side}" height="{side}"/>'
        f'</svg>\n'
    )
    svg_dest = OUT / '1337-skull.svg'
    svg_dest.write_text(svg)
    print('wrote', svg_dest)


def glyph_pixels(rows: list[str], ox: int) -> set[tuple[int, int]]:
    pixels: set[tuple[int, int]] = set()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '#':
                pixels.add((ox + x, y))
    return pixels


def write_wordmark() -> None:
    x = 0
    pixels: set[tuple[int, int]] = set()
    for glyph in (ONE, THREE, THREE, SEVEN):
        pixels |= glyph_pixels(glyph, x)
        x += len(glyph[0]) + GAP

    w = max(px for px, _ in pixels) + 1
    h = max(py for _, py in pixels) + 1
    native = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    npx = native.load()
    for gx, gy in pixels:
        npx[gx, gy] = GREEN

    scaled = native.resize((w * WORD_SCALE, h * WORD_SCALE), Image.Resampling.NEAREST)
    dest = OUT / '1337-wordmark.png'
    scaled.save(dest, 'PNG')
    print('wrote', dest, scaled.size, f'(native {w}x{h})')

    paths = ''.join(
        f'<path d="m{gx} {gy}h1v1h-1z"/>' for gx, gy in sorted(pixels, key=lambda p: (p[1], p[0]))
    )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'shape-rendering="crispEdges" role="img" aria-label="1337">'
        f'<g fill="#00ff00">{paths}</g></svg>\n'
    )
    svg_dest = OUT / '1337-wordmark.svg'
    svg_dest.write_text(svg)
    print('wrote', svg_dest)


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f'missing hoodie source {SRC}')
    write_mark()
    write_wordmark()


if __name__ == '__main__':
    main()
