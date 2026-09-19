import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEMO_SEGMENTS,
  PITCH_NARRATION_HUMAN,
  PITCH_SEGMENTS,
  DEMO_NARRATION_HUMAN,
} from './narration.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'brand/ethglobal/audio');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr || r.stdout}`);
  }
  return r;
}

export function generateTts() {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(root, 'brand/ethglobal/demo-narration.txt'), DEMO_NARRATION_HUMAN);
  writeFileSync(path.join(root, 'brand/ethglobal/pitch-narration.txt'), PITCH_NARRATION_HUMAN);
  const sidecar = path.join(outDir, 'tts-input.json');
  writeFileSync(
    sidecar,
    JSON.stringify(
      {
        demo: DEMO_SEGMENTS,
        pitch: PITCH_SEGMENTS,
        demoFull: DEMO_NARRATION_HUMAN,
        pitchFull: PITCH_NARRATION_HUMAN,
      },
      null,
      2,
    ),
  );
  const py = path.join(path.dirname(fileURLToPath(import.meta.url)), 'neural_tts.py');
  run('python3', [py, sidecar]);
  const manifest = JSON.parse(readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
  console.log('demo audio', Number(manifest.demo.duration).toFixed(1), 's');
  console.log('pitch audio', Number(manifest.pitch.duration).toFixed(1), 's');
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateTts();
}

export { existsSync };
