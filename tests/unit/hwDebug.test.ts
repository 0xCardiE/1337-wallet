import { describe, expect, it, vi } from 'vitest';
import { isUnpackedExtension } from '../../src/lib/hwDebug';

describe('hardware debug console', () => {
  it('treats a missing update_url as unpacked', () => {
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => ({}) },
    });
    expect(isUnpackedExtension()).toBe(true);
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => ({ update_url: 'https://clients2.google.com/service/update2/crx' }) },
    });
    expect(isUnpackedExtension()).toBe(false);
    vi.unstubAllGlobals();
  });
});
