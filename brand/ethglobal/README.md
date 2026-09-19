# ETHGlobal videos

Upload these two files (YouTube, Loom, or Vimeo), then paste the URLs into the form.

| File | Length | Form field |
| --- | --- | --- |
| `1337-demo.mp4` | 1:16 | Demo video (live product, not a deck) |
| `1337-pitch.mp4` | 1:08 | Pitch video |

Live product link on the form: `https://1337wallet.io/`

Check **Show demo video on the public project page** if you want.

## Narration

English scripts (also baked into the MP4s as a `say` voiceover):

- `demo-narration.txt`
- `pitch-narration.txt`

The spoken track is Microsoft **Andrew Multilingual** (neural), not macOS `say`. OpenAI TTS is wired up if a valid `OPENAI_API_KEY` is in the environment.

## Rebuild

```bash
node scripts/ethglobal-videos/run.mjs          # tts + record + compose
node scripts/ethglobal-videos/run.mjs compose  # mux only
```
