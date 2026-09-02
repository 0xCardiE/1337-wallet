import { describe, expect, it } from 'vitest';
import {
  findChecksumIssues,
  inspectAddressChecksum,
  shortChecksumRaw,
} from '../../src/lib/addressChecksum';

const GOOD = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const BAD_MIXED = '0xf39fD6e51aad88F6F4ce6aB8827279cffFb92266';
const ALL_LOWER = GOOD.toLowerCase();
const ALL_UPPER = `0x${GOOD.slice(2).toUpperCase()}`;

describe('inspectAddressChecksum', () => {
  it('accepts EIP-55, all-lower, and all-upper', () => {
    expect(inspectAddressChecksum(GOOD)).toBeNull();
    expect(inspectAddressChecksum(ALL_LOWER)).toBeNull();
    expect(inspectAddressChecksum(ALL_UPPER)).toBeNull();
  });

  it('flags mixed-case that fails EIP-55', () => {
    expect(inspectAddressChecksum(BAD_MIXED)).toEqual({
      raw: BAD_MIXED,
      reason: 'badChecksum',
    });
  });

  it('ignores non-addresses', () => {
    expect(inspectAddressChecksum('not-an-address')).toBeNull();
  });
});

describe('findChecksumIssues', () => {
  it('walks nested provider params', () => {
    const issues = findChecksumIssues([
      { to: BAD_MIXED, from: GOOD, nested: [ALL_LOWER, { spender: BAD_MIXED }] },
    ]);
    expect(issues).toEqual([{ raw: BAD_MIXED, reason: 'badChecksum' }]);
  });
});

describe('shortChecksumRaw', () => {
  it('shortens long hex', () => {
    expect(shortChecksumRaw(GOOD)).toBe('0xf39Fd6…b92266');
    expect(shortChecksumRaw('0xabc')).toBe('0xabc');
  });
});
