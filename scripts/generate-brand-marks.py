#!/usr/bin/env python3
"""Rebuild public/icons/1337-skull.png + 1337-wordmark.png from official 1337skulls sources."""
from __future__ import annotations

import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'brand/1337skulls-sources'
OUT = ROOT / 'public/icons'
GREEN = (0, 255, 0, 255)

SKULL_CANVAS = 16
SKULL_SCALE = 16
WORD_SCALE = 12


def official_skull_pixels() -> set[tuple[int, int]]:
    svg = (SRC / '1337Logo.svg').read_text()
    pixels: set[tuple[int, int]] = set()
    for m in re.finditer(r'<path d="m(-?\d+)\s+(-?\d+)h1v1h-1z" fill="#0f0"\s*/>', svg):
        pixels.add((int(m.group(1)), int(m.group(2))))
    for gm in re.finditer(r'<g fill="#0f0">(.*?)</g>', svg, re.S):
        for m in re.finditer(r'd="m(-?\d+)\s+(-?\d+)h1v1h-1z"', gm.group(1)):
            pixels.add((int(m.group(1)), int(m.group(2))))
    if not pixels:
        raise SystemExit('no green pixels in 1337Logo.svg')
    return pixels


def write_skull(pixels: set[tuple[int, int]]) -> tuple[int, int]:
    xs = [x for x, _ in pixels]
    ys = [y for _, y in pixels]
    w = max(xs) - min(xs) + 1
    h = max(ys) - min(ys) + 1
    ox = (SKULL_CANVAS - w) // 2 - min(xs)
    oy = (SKULL_CANVAS - h + 1) // 2 - min(ys)

    native = Image.new('RGBA', (SKULL_CANVAS, SKULL_CANVAS), (0, 0, 0, 0))
    px = native.load()
    for x, y in pixels:
        px[x + ox, y + oy] = GREEN

    scaled = native.resize(
        (SKULL_CANVAS * SKULL_SCALE, SKULL_CANVAS * SKULL_SCALE),
        Image.Resampling.NEAREST,
    )
    dest = OUT / '1337-skull.png'
    scaled.save(dest, 'PNG')
    print('wrote', dest, scaled.size)

    paths = ''.join(
        f'<path d="m{x + ox} {y + oy}h1v1h-1z"/>' for x, y in sorted(pixels, key=lambda p: (p[1], p[0]))
    )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SKULL_CANVAS} {SKULL_CANVAS}" '
        f'shape-rendering="crispEdges" role="img" aria-label="1337">'
        f'<g fill="#00ff00">{paths}</g></svg>\n'
    )
    svg_dest = OUT / '1337-skull.svg'
    svg_dest.write_text(svg)
    print('wrote', svg_dest)
    return SKULL_CANVAS, SKULL_CANVAS


def is_green(pixel: tuple[int, ...]) -> bool:
    r, g, b, a = pixel
    return a > 10 and g >= 200 and r < 40 and b < 40


def write_wordmark() -> tuple[int, int]:
    src = Image.open(SRC / '1337WebLogo.png').convert('RGBA')
    px = src.load()
    w, h = src.size
    greens = [(x, y) for y in range(h) for x in range(w) if is_green(px[x, y])]
    rows = {y for _, y in greens}
    gap_start = min(y for y in range(min(rows), max(rows)) if y not in rows)
    word = [(x, y) for x, y in greens if y >= gap_start]
    x0, y0 = min(x for x, _ in word), min(y for _, y in word)
    x1, y1 = max(x for x, _ in word), max(y for _, y in word)

    cell = 10
    cols = (x1 - x0 + 1 + cell - 1) // cell
    rws = (y1 - y0 + 1 + cell - 1) // cell
    native = Image.new('RGBA', (cols, rws), (0, 0, 0, 0))
    npx = native.load()
    for cy in range(rws):
        for cx in range(cols):
            on = 0
            tot = 0
            for yy in range(y0 + cy * cell, min(y1 + 1, y0 + (cy + 1) * cell)):
                for xx in range(x0 + cx * cell, min(x1 + 1, x0 + (cx + 1) * cell)):
                    tot += 1
                    if is_green(px[xx, yy]):
                        on += 1
            if tot and on * 2 >= tot:
                npx[cx, cy] = GREEN

    scaled = native.resize((cols * WORD_SCALE, rws * WORD_SCALE), Image.Resampling.NEAREST)
    dest = OUT / '1337-wordmark.png'
    scaled.save(dest, 'PNG')
    print('wrote', dest, scaled.size, f'(native {cols}x{rws})')
    return cols, rws


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    write_skull(official_skull_pixels())
    write_wordmark()


if __name__ == '__main__':
    main()
