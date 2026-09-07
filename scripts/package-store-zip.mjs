#!/usr/bin/env node
/**
 * Production-build dist/ and zip it for the Chrome Web Store.
 * Output: release/1337-wallet-<version>.zip (gitignored). manifest.json at zip root.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RELEASE_DIR = 'release';

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function dosDateTime(date = new Date()) {
  const dosTime = (date.getSeconds() >> 1) | (date.getMinutes() << 5) | (date.getHours() << 11);
  const dosDate = date.getDate() | ((date.getMonth() + 1) << 5) | ((date.getFullYear() - 1980) << 9);
  return { dosTime, dosDate };
}

/** Relative POSIX path inside dist/; false means omit from the store zip. */
export function isStoreZipEntry(relPosix) {
  const base = relPosix.split('/').pop() ?? relPosix;
  if (!base || base === '.' || base === '..') return false;
  if (base === '.DS_Store' || base.endsWith('.map') || base.endsWith('.zip')) return false;
  if (base === 'dev-reload.html' || base === 'dev-reload.js') return false;
  return true;
}

export function storeZipBasename(version) {
  return `1337-wallet-${version}.zip`;
}

export function collectStoreZipEntries(srcDir) {
  const files = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const abs = path.join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!st.isFile()) continue;
      const rel = path.relative(srcDir, abs).split(path.sep).join('/');
      if (!isStoreZipEntry(rel)) continue;
      files.push({ rel, abs });
    }
  }
  walk(srcDir);
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  return files;
}

export function writeStoreZipFromDir(srcDir, destFile) {
  const entries = collectStoreZipEntries(srcDir);
  if (!entries.some(e => e.rel === 'manifest.json')) {
    throw new Error(`No manifest.json in ${srcDir} — run a production build first.`);
  }
  const { dosTime, dosDate } = dosDateTime();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { rel, abs } of entries) {
    const data = readFileSync(abs);
    const crc = crc32(data);
    const deflated = deflateRawSync(data, { level: 9 });
    const useStore = deflated.length >= data.length;
    const payload = useStore ? data : deflated;
    const method = useStore ? 0 : 8;
    const nameBuf = Buffer.from(rel, 'utf8');

    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(method),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(payload.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
      payload,
    ]);
    const central = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(method),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(payload.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBuf,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  mkdirSync(path.dirname(destFile), { recursive: true });
  writeFileSync(destFile, Buffer.concat([...locals, centralDir, eocd]));
  return { destFile, files: entries.map(e => e.rel) };
}

function isDirectRun() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  return fileURLToPath(import.meta.url) === path.resolve(invoked);
}

function main() {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const distDir = path.join(root, 'dist');
  const outFile = path.join(root, RELEASE_DIR, storeZipBasename(pkg.version));

  if (!process.argv.includes('--no-build')) {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const built = spawnSync(npm, ['run', 'build'], { cwd: root, stdio: 'inherit' });
    if (built.status !== 0) process.exit(built.status ?? 1);
  }

  const manifest = JSON.parse(readFileSync(path.join(distDir, 'manifest.json'), 'utf8'));
  if (manifest.version !== pkg.version) {
    throw new Error(
      `dist/manifest.json version ${manifest.version} does not match package.json ${pkg.version}`,
    );
  }

  const { files } = writeStoreZipFromDir(distDir, outFile);
  console.log(`wrote ${outFile} (${files.length} files)`);
}

if (isDirectRun()) main();
