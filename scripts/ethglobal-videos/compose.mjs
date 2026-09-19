import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'brand/ethglobal');
const rawDir = path.join(outDir, 'raw');
const audioDir = path.join(outDir, 'audio');
const selfDir = path.dirname(fileURLToPath(import.meta.url));

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`${cmd} failed\n${r.stderr || r.stdout}`);
  }
}

function probeDuration(file) {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error(`ffprobe ${file}: ${r.stderr}`);
  return Number.parseFloat(r.stdout.trim());
}

function loadManifest() {
  return JSON.parse(readFileSync(path.join(audioDir, 'manifest.json'), 'utf8'));
}

function renderCaptionPngs(kind, kicker) {
  const dest = path.join(rawDir, `caps-${kind}`);
  mkdirSync(dest, { recursive: true });
  run('python3', [
    path.join(selfDir, 'render-captions.py'),
    path.join(audioDir, 'manifest.json'),
    kind,
    dest,
    kicker,
  ]);
  return dest;
}

function stageAndMux({
  live,
  audio,
  title,
  end,
  dest,
  segments,
  capDir,
  liveOnRight,
  titleUntil,
  endLen,
  captions = true,
}) {
  const audioDur = probeDuration(audio);
  const liveDur = probeDuration(live);
  const bodyDur = Number(Math.max(audioDur, liveDur, 8).toFixed(3));
  const endAt = Number((bodyDur - endLen).toFixed(3));
  const livePad = Math.max(0, bodyDur - liveDur).toFixed(3);

  const capFiles = captions
    ? [
        path.join(capDir, 'kicker.png'),
        ...segments.map(s => path.join(capDir, `${s.id}.png`)),
      ]
    : [];

  const inputs = ['-y', '-i', live, '-loop', '1', '-i', title, '-loop', '1', '-i', end, '-i', audio];
  for (const file of capFiles) {
    inputs.push('-loop', '1', '-i', file);
  }

  // 0 live, 1 title, 2 end, 3 audio, 4 kicker, 5+ captions
  const livePrep = liveOnRight
    ? `[0:v]scale=400:720:force_original_aspect_ratio=decrease,pad=400:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=${livePad}[w];color=c=0x050806:s=1280x720:d=${bodyDur}:r=30,format=yuv420p[bg];[bg][w]overlay=x=840:y=0[base]`
    : `[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=${livePad}[base]`;

  const parts = [livePrep];
  let last = 'base';
  if (captions) {
    parts.push(`[base][4:v]overlay=0:0[k]`);
    last = 'k';
    segments.forEach((seg, i) => {
      const idx = 5 + i;
      const start = (seg.start ?? 0).toFixed(2);
      const endT = ((seg.start ?? 0) + (seg.duration ?? 4) + 0.3).toFixed(2);
      const next = i === segments.length - 1 ? 'capped' : `c${i}`;
      parts.push(
        `[${last}][${idx}:v]overlay=0:0:enable='between(t\\,${start}\\,${endT})'[${next}]`,
      );
      last = next;
    });
  } else {
    parts.push(`[base]null[capped]`);
    last = 'capped';
  }
  parts.push(`[1:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[title]`);
  parts.push(`[2:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[endv]`);
  parts.push(`[capped][title]overlay=0:0:enable='lt(t\\,${titleUntil})'[mid]`);
  parts.push(`[mid][endv]overlay=0:0:enable='gte(t\\,${endAt})'[vout]`);
  parts.push(`[3:a]apad,atrim=0:${bodyDur},asetpts=PTS-STARTPTS[aout]`);

  run('ffmpeg', [
    ...inputs,
    '-filter_complex',
    parts.join(';'),
    '-map',
    '[vout]',
    '-map',
    '[aout]',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-t',
    String(bodyDur),
    '-movflags',
    '+faststart',
    dest,
  ]);
  console.log('wrote', dest, `${probeDuration(dest).toFixed(1)}s`);
  return dest;
}

export function composeDemo() {
  const man = loadManifest();
  const markersPath = path.join(rawDir, 'demo-markers.json');
  let segments = man.demo.segments;
  if (existsSync(markersPath)) {
    const { markers } = JSON.parse(readFileSync(markersPath, 'utf8'));
    segments = man.demo.segments.map(seg => {
      const i = markers.findIndex(m => m.id === seg.id);
      const start = i >= 0 ? markers[i].t : seg.start;
      const duration =
        i >= 0 && markers[i + 1] ? markers[i + 1].t - start : seg.duration ?? 5;
      return { ...seg, start, duration };
    });
  }
  const capDir = renderCaptionPngs('demo', '1337 WALLET  ·  LIVE DEMO');
  return stageAndMux({
    live: path.join(rawDir, 'demo-wallet.webm'),
    audio: path.join(audioDir, 'demo.wav'),
    title: path.join(outDir, 'cards/demo-title.png'),
    end: path.join(outDir, 'cards/end-card.png'),
    dest: path.join(outDir, '1337-demo.mp4'),
    segments,
    capDir,
    liveOnRight: true,
    titleUntil: 3.2,
    endLen: 3.8,
  });
}

export function composePitch() {
  const man = loadManifest();
  const site = path.join(rawDir, 'site.webm');
  const audio = path.join(audioDir, 'pitch.wav');
  const looped = path.join(rawDir, 'site-looped.mp4');
  const audioDur = probeDuration(audio);
  const siteDur = probeDuration(site);
  const loops = Math.max(1, Math.ceil((audioDur + 1) / Math.max(1, siteDur)));
  run('ffmpeg', [
    '-y',
    '-stream_loop',
    String(loops),
    '-i',
    site,
    '-t',
    String(audioDur + 1),
    '-an',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'ultrafast',
    looped,
  ]);
  const capDir = renderCaptionPngs('pitch', 'PITCH  ·  MARKO');
  return stageAndMux({
    live: looped,
    audio,
    title: path.join(outDir, 'cards/pitch-title.png'),
    end: path.join(outDir, 'cards/end-card.png'),
    dest: path.join(outDir, '1337-pitch.mp4'),
    segments: man.pitch.segments,
    capDir,
    liveOnRight: false,
    titleUntil: 4.4,
    endLen: 3.8,
    captions: false,
  });
}

export function composeAll() {
  if (!existsSync(path.join(rawDir, 'demo-wallet.webm'))) throw new Error('missing demo-wallet.webm');
  if (!existsSync(path.join(rawDir, 'site.webm'))) throw new Error('missing site.webm');
  mkdirSync(rawDir, { recursive: true });
  const demo = composeDemo();
  const pitch = composePitch();
  return { demo, pitch };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  try {
    if (arg === 'demo') composeDemo();
    else if (arg === 'pitch') composePitch();
    else composeAll();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
