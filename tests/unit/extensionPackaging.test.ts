import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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
    expect(manifest.permissions).toEqual(expect.arrayContaining(['hid']));
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
});
