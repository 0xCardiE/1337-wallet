#!/usr/bin/env node
/**
 * Production-build dist/ and ask Chrome to reload the unpacked 1337 extension.
 * Used by post-commit / pre-push hooks and `npm run ext:rebuild`.
 */
import { createHash } from 'node:crypto';
import { execFile as execFileCb, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const cacheDir = path.join(root, 'node_modules', '.cache');
const stampPath = path.join(cacheDir, '1337-ext-rebuild.json');
const lockDir = path.join(cacheDir, '1337-ext-rebuild.lock');

export function unpackedChromeExtensionId(absolutePath) {
  const digest = createHash('sha256').update(absolutePath, 'utf8').digest('hex').slice(0, 32);
  return digest.replace(/[0-9a-f]/g, ch =>
    String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(ch, 16)),
  );
}

function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function readStamp() {
  try {
    return JSON.parse(readFileSync(stampPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeStamp(head) {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(stampPath, `${JSON.stringify({ head, at: Date.now() })}\n`);
}

async function acquireLock() {
  mkdirSync(cacheDir, { recursive: true });
  const started = Date.now();
  while (true) {
    try {
      mkdirSync(lockDir);
      return;
    } catch {
      if (Date.now() - started > 180_000) {
        throw new Error('Timed out waiting for the extension rebuild lock.');
      }
      await new Promise(r => setTimeout(r, 400));
    }
  }
}

function releaseLock() {
  rmSync(lockDir, { recursive: true, force: true });
}

function findLoadedUnpacked() {
  const chromeRoot = path.join(homedir(), 'Library/Application Support/Google/Chrome');
  if (!existsSync(chromeRoot) || !existsSync(distDir)) return [];
  const dist = realpathSync(distDir);
  const hits = [];
  for (const entry of readdirSync(chromeRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const prefsPath = path.join(chromeRoot, entry.name, 'Secure Preferences');
    if (!existsSync(prefsPath)) continue;
    let settings;
    try {
      settings = JSON.parse(readFileSync(prefsPath, 'utf8')).extensions?.settings ?? {};
    } catch {
      continue;
    }
    for (const [id, ext] of Object.entries(settings)) {
      const extPath = typeof ext?.path === 'string' ? ext.path.replace(/\/$/, '') : '';
      if (extPath === dist) hits.push({ id, profile: entry.name });
    }
  }
  return hits;
}

async function reloadInChrome(url) {
  if (process.platform !== 'darwin') {
    const opened = spawnSync('open', ['-a', 'Google Chrome', url], { encoding: 'utf8' });
    return opened.status === 0;
  }
  try {
    await execFile('osascript', [
      '-e',
      `tell application "Google Chrome" to open location ${JSON.stringify(url)}`,
    ]);
    return true;
  } catch {
    const opened = spawnSync('open', ['-a', 'Google Chrome', url], { encoding: 'utf8' });
    return opened.status === 0;
  }
}

async function reloadExtension() {
  if (!existsSync(path.join(distDir, 'dev-reload.html'))) {
    console.log('1337: dist/dev-reload.html missing — reload Chrome on chrome://extensions.');
    return;
  }
  const computedId = unpackedChromeExtensionId(realpathSync(distDir));
  const loaded = findLoadedUnpacked();
  const id = loaded[0]?.id ?? computedId;
  const url = `chrome-extension://${id}/dev-reload.html`;
  if (loaded.length) {
    const profiles = loaded.map(h => h.profile).join(', ');
    console.log(`1337: reloading unpacked extension ${id} (${profiles})`);
  } else {
    console.log(`1337: reloading unpacked extension ${id}`);
  }
  const ok = await reloadInChrome(url);
  if (!ok) {
    console.log('1337: built. Reload 1337 on chrome://extensions.');
  }
}

function build() {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`npm run build exited ${result.status ?? 1}`);
  }
}

async function main() {
  if (process.env.CI) {
    console.log('1337: skip extension rebuild in CI.');
    return;
  }
  const head = gitHead();
  await acquireLock();
  try {
    const stamp = readStamp();
    if (head && stamp?.head === head && existsSync(path.join(distDir, 'manifest.json'))) {
      console.log(`1337: dist already built for ${head.slice(0, 7)}`);
      if (!stamp.at || Date.now() - stamp.at > 60_000) {
        await reloadExtension();
      } else {
        console.log('1337: skip reload (just rebuilt)');
      }
      return;
    }
    console.log('1337: building unpacked extension…');
    build();
    writeStamp(head);
    await reloadExtension();
  } finally {
    releaseLock();
  }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch(err => {
    console.error(`1337: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  });
}
