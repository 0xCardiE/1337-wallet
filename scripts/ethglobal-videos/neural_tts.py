"""Neural TTS via Microsoft Edge (Andrew Multilingual)."""
from __future__ import annotations

import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path

import edge_tts

VOICE = "en-US-AndrewMultilingualNeural"
RATE = "-2%"
PITCH = "-1Hz"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "brand/ethglobal/audio"


def spoken(text: str) -> str:
    body = text.strip()
    body = body.replace("1337wallet.io", "leet wallet dot I O")
    body = re.sub(r"\b1337\b", "leet", body)
    body = body.replace("eth_call", "eth call")
    body = re.sub(r"\[\[slnc \d+\]\]", "", body)
    body = re.sub(r" +", " ", body)
    return body


async def synth(text: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    mp3 = dest.with_suffix(".mp3")
    communicate = edge_tts.Communicate(spoken(text), VOICE, rate=RATE, pitch=PITCH)
    await communicate.save(str(mp3))
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(mp3),
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-c:a",
            "pcm_s16le",
            str(dest),
        ],
        check=True,
        capture_output=True,
    )


def duration(path: Path) -> float:
    r = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(r.stdout.strip())


async def main() -> None:
    payload = json.loads(Path(sys.argv[1]).read_text())
    OUT.mkdir(parents=True, exist_ok=True)

    demo_wav = OUT / "demo.wav"
    pitch_wav = OUT / "pitch.wav"
    await synth(payload["demoFull"], demo_wav)
    await synth(payload["pitchFull"], pitch_wav)

    def attach(segments: list[dict], total: float) -> list[dict]:
        if not segments:
            return []
        each = total / len(segments)
        out = []
        t = 0.0
        for seg in segments:
            out.append({**seg, "start": t, "duration": each})
            t += each
        return out

    demo_dur = duration(demo_wav)
    pitch_dur = duration(pitch_wav)
    manifest = {
        "demo": {
            "wav": str(demo_wav),
            "duration": demo_dur,
            "voice": VOICE,
            "segments": attach(payload["demo"], demo_dur),
        },
        "pitch": {
            "wav": str(pitch_wav),
            "duration": pitch_dur,
            "voice": VOICE,
            "segments": attach(payload["pitch"], pitch_dur),
        },
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"demo audio {demo_dur:.1f}s ({VOICE})")
    print(f"pitch audio {pitch_dur:.1f}s ({VOICE})")


if __name__ == "__main__":
    asyncio.run(main())
