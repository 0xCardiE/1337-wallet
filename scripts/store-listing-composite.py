#!/usr/bin/env python3
"""Flatten / resize Chrome Web Store listing images to exact pixel sizes (no alpha)."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

BG = (5, 8, 6)
ACCENT = (34, 197, 94)
MUTED = (156, 163, 175)


def load_on_bg(path: Path) -> Image.Image:
    im = Image.open(path).convert('RGBA')
    bg = Image.new('RGB', im.size, BG)
    bg.paste(im, mask=im.split()[-1])
    return bg


def fit(im: Image.Image, box: tuple[int, int]) -> Image.Image:
    out = im.copy()
    out.thumbnail(box, Image.Resampling.LANCZOS)
    return out


def save_png(im: Image.Image, dest: Path) -> None:
    im.convert('RGB').save(dest, 'PNG', optimize=True)


def save_jpg(im: Image.Image, dest: Path) -> None:
    im.convert('RGB').save(dest, 'JPEG', quality=92, optimize=True, subsampling=1)


def store_icon(src: Path, dest: Path) -> None:
    im = load_on_bg(src).resize((128, 128), Image.Resampling.LANCZOS)
    save_png(im, dest)


def promo_small(skull: Path, word: Path, dest: Path) -> None:
    canvas = Image.new('RGB', (440, 280), BG)
    s = fit(load_on_bg(skull), (150, 150))
    w = fit(load_on_bg(word), (220, 72))
    canvas.paste(s, (28, (280 - s.height) // 2))
    canvas.paste(w, (200, 88))
    draw = ImageDraw.Draw(canvas)
    draw.text((200, 172), 'WALLET  ·  EVM SIGNER', fill=MUTED)
    save_jpg(canvas, dest)


def promo_marquee(skull: Path, word: Path, dest: Path) -> None:
    canvas = Image.new('RGB', (1400, 560), BG)
    s = fit(load_on_bg(skull), (380, 380))
    w = fit(load_on_bg(word), (620, 180))
    canvas.paste(s, (80, (560 - s.height) // 2))
    canvas.paste(w, (520, 160))
    draw = ImageDraw.Draw(canvas)
    draw.text((524, 360), 'Self-custody signer  ·  no analytics  ·  no 1337 server', fill=MUTED)
    draw.rectangle((0, 0, 8, 560), fill=ACCENT)
    save_jpg(canvas, dest)


def frame_screenshot(src: Path, dest: Path) -> None:
    canvas = Image.new('RGB', (1280, 800), BG)
    shot = load_on_bg(src)
    pad = 48
    fitted = fit(shot, (1280 - pad * 2, 800 - pad * 2))
    x = (1280 - fitted.width) // 2
    y = (800 - fitted.height) // 2
    border = Image.new('RGB', (fitted.width + 2, fitted.height + 2), ACCENT)
    canvas.paste(border, (x - 1, y - 1))
    canvas.paste(fitted, (x, y))
    save_jpg(canvas, dest)


def main() -> None:
    cmd = sys.argv[1]
    if cmd == 'icon':
        store_icon(Path(sys.argv[2]), Path(sys.argv[3]))
    elif cmd == 'promo-small':
        promo_small(Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]))
    elif cmd == 'promo-marquee':
        promo_marquee(Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]))
    elif cmd == 'screenshot':
        frame_screenshot(Path(sys.argv[2]), Path(sys.argv[3]))
    else:
        raise SystemExit(f'unknown command {cmd}')


if __name__ == '__main__':
    main()
