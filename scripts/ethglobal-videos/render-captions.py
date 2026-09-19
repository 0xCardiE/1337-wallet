#!/usr/bin/env python3
"""Render transparent 1280x720 caption PNGs for ffmpeg overlay."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 720
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.truetype(FONT_REG, size)


def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_w: int) -> str:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return "\n".join(lines)


def render_kicker(out: Path, kicker: str) -> None:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = load_font(FONT_BOLD, 15)
    draw.text((56, 44), kicker, font=font, fill=(74, 222, 128, 255))
    img.save(out)


def render_caption(out: Path, caption: str, sub: str) -> None:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cap_font = load_font(FONT_BOLD, 34)
    sub_font = load_font(FONT_REG, 18)
    cap = wrap(draw, caption, cap_font, 720)
    draw.multiline_text((56, 78), cap, font=cap_font, fill=(244, 244, 245, 255), spacing=8)
    if sub:
        bbox = draw.multiline_textbbox((56, 78), cap, font=cap_font, spacing=8)
        draw.text((56, bbox[3] + 16), wrap(draw, sub, sub_font, 700), font=sub_font, fill=(156, 163, 175, 255))
    img.save(out)


def main() -> None:
    manifest = json.loads(Path(sys.argv[1]).read_text())
    kind = sys.argv[2]  # demo | pitch
    out_dir = Path(sys.argv[3])
    kicker = sys.argv[4]
    out_dir.mkdir(parents=True, exist_ok=True)
    render_kicker(out_dir / "kicker.png", kicker)
    for seg in manifest[kind]["segments"]:
        render_caption(out_dir / f"{seg['id']}.png", seg["caption"], seg.get("sub") or "")
    print(f"wrote {len(manifest[kind]['segments'])} captions to {out_dir}")


if __name__ == "__main__":
    main()
