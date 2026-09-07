import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectStoreZipEntries,
  isStoreZipEntry,
  storeZipBasename,
  writeStoreZipFromDir,
} from '../../scripts/package-store-zip.mjs';
import { unpackedChromeExtensionId } from '../../scripts/rebuild-extension.mjs';

const root = join(__dirname, '../..');
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readJson(rel: string) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8')) as Record<string, unknown>;
}

describe('extension packaging', () => {
  it('keeps package, Chrome manifest, and brand versions in sync', () => {
    const pkg = readJson('package.json');
    const manifest = readJson('public/manifest.json');
    const brand = readJson('brand/product.manifest.json');
    expect(manifest.version).toBe(pkg.version);
    expect(brand.version).toBe(pkg.version);
    expect(manifest.name).toBe(brand.name);
    expect(manifest.permissions).toEqual(['storage', 'sidePanel', 'scripting']);
    expect(manifest.host_permissions).toEqual(['<all_urls>']);
    expect(manifest.permissions).not.toContain('hid');
    expect(manifest.permissions).not.toContain('tabs');
    expect(manifest.permissions).not.toContain('windows');
  });

  it('ships PNG icons for every size declared in the manifest', () => {
    const manifest = readJson('public/manifest.json') as {
      icons: Record<string, string>;
    };
    expect(Object.keys(manifest.icons).sort()).toEqual(['128', '16', '32', '48']);
    for (const rel of Object.values(manifest.icons)) {
      const buf = readFileSync(join(root, 'public', rel));
      expect(buf.subarray(0, 8).equals(PNG_SIG), `${rel} is not a PNG`).toBe(true);
      expect(buf.length).toBeGreaterThan(64);
    }
  });

  it('ships an unpacked-only Chrome reload page (no inline script)', () => {
    expect(existsSync(join(root, 'public/dev-reload.html'))).toBe(true);
    expect(existsSync(join(root, 'public/dev-reload.js'))).toBe(true);
    const html = readFileSync(join(root, 'public/dev-reload.html'), 'utf8');
    expect(html).toContain('src="dev-reload.js"');
    expect(html).not.toMatch(/<script>(?!<\/script>)/);
    expect(readFileSync(join(root, 'public/dev-reload.js'), 'utf8')).toContain(
      'chrome.runtime.reload',
    );
  });

  it('encodes unpacked Chrome extension ids the way Chromium does', () => {
    expect(unpackedChromeExtensionId('/Users/marko/Documents/Experiments/1337/dist')).toBe(
      'llcedjlonmkgibpfodlmfkflkkmdojao',
    );
  });

  it('names the store zip from the package version', () => {
    expect(storeZipBasename('2.1.1')).toBe('1337-wallet-2.1.1.zip');
  });

  it('omits sourcemaps, Finder junk, and unpacked-only reload files from the store zip', () => {
    expect(isStoreZipEntry('manifest.json')).toBe(true);
    expect(isStoreZipEntry('background.js')).toBe(true);
    expect(isStoreZipEntry('assets/popup.js')).toBe(true);
    expect(isStoreZipEntry('dev-reload.html')).toBe(false);
    expect(isStoreZipEntry('dev-reload.js')).toBe(false);
    expect(isStoreZipEntry('background.js.map')).toBe(false);
    expect(isStoreZipEntry('assets/popup.js.map')).toBe(false);
    expect(isStoreZipEntry('.DS_Store')).toBe(false);
    expect(isStoreZipEntry('icons/.DS_Store')).toBe(false);
    expect(isStoreZipEntry('1337-wallet-2.1.1.zip')).toBe(false);
  });

  it('zips dist files with manifest.json at the archive root', () => {
    const dir = mkdtempSync(join(tmpdir(), '1337-store-zip-'));
    mkdirSync(join(dir, 'icons'));
    writeFileSync(join(dir, 'manifest.json'), '{"name":"1337 Wallet","version":"2.1.1"}\n');
    writeFileSync(join(dir, 'background.js'), 'ok');
    writeFileSync(join(dir, 'icons/icon-16.png'), 'png');
    writeFileSync(join(dir, 'dev-reload.js'), 'no');
    writeFileSync(join(dir, 'background.js.map'), 'no');
    writeFileSync(join(dir, '.DS_Store'), 'no');
    const zipPath = join(dir, 'out.zip');
    const { files } = writeStoreZipFromDir(dir, zipPath);
    expect(files).toEqual(['background.js', 'icons/icon-16.png', 'manifest.json']);
    expect(collectStoreZipEntries(dir).map(e => e.rel)).toEqual(files);
    expect(existsSync(zipPath)).toBe(true);
    expect(zipCentralNames(readFileSync(zipPath))).toEqual(files);
    rmSync(dir, { recursive: true, force: true });
  });
});

function zipCentralNames(buf: Buffer) {
  const names: string[] = [];
  let i = 0;
  while (i + 46 <= buf.length) {
    if (buf.readUInt32LE(i) !== 0x02014b50) {
      i += 1;
      continue;
    }
    const nameLen = buf.readUInt16LE(i + 28);
    const extraLen = buf.readUInt16LE(i + 30);
    const commentLen = buf.readUInt16LE(i + 32);
    names.push(buf.subarray(i + 46, i + 46 + nameLen).toString('utf8'));
    i += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}
