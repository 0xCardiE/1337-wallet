#!/usr/bin/env python3
"""16:9 ETHGlobal title cards from the current EVM hoodie mark + site copy."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
MARK = ROOT / 'public/icons/1337-skull.png'
WORD = ROOT / 'public/icons/1337-wordmark.png'
OUT = ROOT / 'brand/ethglobal/cards'
BG = (5, 8, 6)
ACCENT = (0, 255, 0)
INK = (244, 244, 245)
MUTED = (156, 163, 175)
FONT_BOLD = Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
FONT_REG = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
W, H = 1280, 720


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def punch(path: Path) -> Image.Image:
    im = Image.open(path).convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16 or g < 24:
                px[x, y] = (0, 0, 0, 0)
    box = im.getbbox()
    return im.crop(box) if box else im


def pixel_fit(im: Image.Image, box: tuple[int, int]) -> Image.Image:
    w, h = im.size
    scale = min(box[0] / w, box[1] / h)
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    return im.resize((nw, nh), Image.Resampling.NEAREST)


def canvas() -> Image.Image:
    img = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(img)
    step = 48
    grid = (10, 28, 16)
    for x in range(0, W, step):
        draw.line((x, 0, x, H), fill=grid)
    for y in range(0, H, step):
        draw.line((0, y, W, y), fill=grid)
    return img


def paste_hood(img: Image.Image, box: tuple[int, int], xy: tuple[int, int]) -> None:
    hood = pixel_fit(punch(MARK), box)
    img.paste(hood, xy, hood)


def save(img: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / name
    img.save(dest, 'PNG', optimize=True)
    print('wrote', dest)


def pitch() -> None:
    img = canvas()
    draw = ImageDraw.Draw(img)
    kicker = font(FONT_BOLD, 18)
    title = font(FONT_BOLD, 96)
    sub = font(FONT_REG, 28)
    draw.text((64, 214), 'PRIVACY  ·  POWER  ·  OPEN SOURCE', font=kicker, fill=ACCENT)
    draw.text((64, 258), '1337', font=title, fill=INK)
    draw.text((64, 390), 'An EVM wallet for hackers.', font=sub, fill=MUTED)
    paste_hood(img, (520, 560), (720, 80))
    save(img, 'pitch-title.png')


def demo() -> None:
    img = canvas()
    draw = ImageDraw.Draw(img)
    title = font(FONT_BOLD, 96)
    sub = font(FONT_BOLD, 28)
    draw.text((64, 248), '1337', font=title, fill=INK)
    draw.text((64, 372), 'LIVE DEMO', font=sub, fill=MUTED)
    draw.rectangle((64, 424, 220, 428), fill=ACCENT)
    paste_hood(img, (520, 560), (720, 80))
    save(img, 'demo-title.png')


def end() -> None:
    img = canvas()
    hood = pixel_fit(punch(MARK), (640, 700))
    faded = hood.copy()
    faded.putalpha(faded.getchannel('A').point(lambda a: int(a * 0.22)))
    img.paste(faded, ((W - faded.width) // 2, (H - faded.height) // 2 - 10), faded)
    draw = ImageDraw.Draw(img)
    kicker = font(FONT_BOLD, 18)
    title = font(FONT_BOLD, 64)
    sub = font(FONT_REG, 22)
    k = 'INSTALL'
    t = '1337wallet.io'
    s = 'Chrome Web Store  ·  Open source'
    def cx(text, fnt):
        return (W - draw.textlength(text, font=fnt)) / 2
    draw.text((cx(k, kicker), 268), k, font=kicker, fill=ACCENT)
    draw.text((cx(t, title), 302), t, font=title, fill=INK)
    draw.text((cx(s, sub), 392), s, font=sub, fill=MUTED)
    save(img, 'end-card.png')


if __name__ == '__main__':
    pitch()
    demo()
    end()
