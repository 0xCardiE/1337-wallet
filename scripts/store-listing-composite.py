#!/usr/bin/env python3
"""Flatten / resize Chrome Web Store listing images to exact pixel sizes (no alpha)."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BG = (5, 8, 6)
ACCENT = (0, 255, 0)
MUTED = (140, 148, 140)
INK = (244, 244, 245)
FONT_BOLD = Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
FONT_REG = Path('/System/Library/Fonts/Supplemental/Arial.ttf')


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


def punch_mark(path: Path) -> Image.Image:
    """Keep only the green pixels. No baked black or dark-green box."""
    im = Image.open(path).convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16 or g < 80 or r > 80 or b > 80:
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (0, 255, 0, 255)
    box = im.getbbox()
    return im.crop(box) if box else im


def pixel_fit(im: Image.Image, box: tuple[int, int]) -> Image.Image:
    w, h = im.size
    scale = min(box[0] / w, box[1] / h)
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    return im.resize((nw, nh), Image.Resampling.NEAREST)


def paste_mark(canvas: Image.Image, mark: Image.Image, xy: tuple[int, int]) -> None:
    canvas.paste(mark, xy, mark)


def font(path: Path, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype(str(path), size)
    except OSError:
        return ImageFont.load_default()


def promo_small(skull: Path, word: Path, dest: Path) -> None:
    canvas = Image.new('RGB', (440, 280), BG)
    s = pixel_fit(punch_mark(skull), (118, 130))
    w = pixel_fit(punch_mark(word), (196, 48))
    gap = 22
    lock_w = s.width + gap + w.width
    lock_h = max(s.height, w.height + 28)
    x0 = (440 - lock_w) // 2
    y0 = (280 - lock_h) // 2
    paste_mark(canvas, s, (x0, y0 + (lock_h - s.height) // 2))
    wx = x0 + s.width + gap
    wy = y0 + (lock_h - w.height - 28) // 2
    paste_mark(canvas, w, (wx, wy))
    draw = ImageDraw.Draw(canvas)
    draw.text((wx, wy + w.height + 10), 'WALLET', font=font(FONT_BOLD, 16), fill=MUTED)
    save_jpg(canvas, dest)


def promo_marquee(skull: Path, word: Path, dest: Path) -> None:
    canvas = Image.new('RGB', (1400, 560), BG)
    s = pixel_fit(punch_mark(skull), (280, 300))
    w = pixel_fit(punch_mark(word), (520, 120))
    gap = 56
    lock_w = s.width + gap + max(w.width, 640)
    x0 = (1400 - lock_w) // 2
    paste_mark(canvas, s, (x0, (560 - s.height) // 2))
    wx = x0 + s.width + gap
    block_h = w.height + 28 + 36 + 28
    wy = (560 - block_h) // 2
    paste_mark(canvas, w, (wx, wy))
    draw = ImageDraw.Draw(canvas)
    draw.text((wx, wy + w.height + 28), 'An EVM wallet for hackers', font=font(FONT_BOLD, 28), fill=INK)
    draw.text(
        (wx, wy + w.height + 68),
        'No analytics. No tracking server.',
        font=font(FONT_REG, 22),
        fill=MUTED,
    )
    save_jpg(canvas, dest)


def _is_near_bg(pixel: tuple[int, int, int], bg: tuple[int, int, int] = BG, limit: int = 18) -> bool:
    return abs(pixel[0] - bg[0]) + abs(pixel[1] - bg[1]) + abs(pixel[2] - bg[2]) <= limit


def extract_ui(src: Path, dest: Path) -> None:
    """Pull the popup out of a 1280×800 black frame, or pass a raw portrait through."""
    shot = load_on_bg(src)
    w, h = shot.size
    if w <= 520 and h >= 600:
        shot.save(dest, 'PNG', optimize=True)
        return

    px = shot.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            if not _is_near_bg(px[x, y]):
                found = True
                if x < minx:
                    minx = x
                if y < miny:
                    miny = y
                if x > maxx:
                    maxx = x
                if y > maxy:
                    maxy = y
    if not found:
        shot.save(dest, 'PNG', optimize=True)
        return

    # Drop the old 1px accent ring from the previous compositor.
    inset = 2
    box = (
        max(0, minx + inset),
        max(0, miny + inset),
        min(w, maxx + 1 - inset),
        min(h, maxy + 1 - inset),
    )
    shot.crop(box).save(dest, 'PNG', optimize=True)


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


def frame_ui(src: Path, dest: Path) -> None:
    """Website UI crop → 1280×800 JPEG, no alpha, no billboard."""
    canvas = Image.new('RGB', (1280, 800), BG)
    shot = Image.open(src).convert('RGBA')
    flat = Image.new('RGB', shot.size, BG)
    flat.paste(shot, mask=shot.split()[-1])
    pad = 72
    fitted = fit(flat, (1280 - pad * 2, 800 - pad * 2))
    x = (1280 - fitted.width) // 2
    y = (800 - fitted.height) // 2
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
    elif cmd == 'extract-ui':
        extract_ui(Path(sys.argv[2]), Path(sys.argv[3]))
    elif cmd == 'frame-ui':
        frame_ui(Path(sys.argv[2]), Path(sys.argv[3]))
    elif cmd == 'resize-jpg':
        src, dest, width, height = Path(sys.argv[2]), Path(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
        im = Image.open(src).convert('RGB')
        if im.size != (width, height):
            im = im.resize((width, height), Image.Resampling.LANCZOS)
        save_jpg(im, dest)
    else:
        raise SystemExit(f'unknown command {cmd}')


if __name__ == '__main__':
    main()
