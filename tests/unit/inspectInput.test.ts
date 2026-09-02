import { describe, expect, it } from 'vitest';
import { parseInspectInput } from '../../src/lib/inspectInput';

describe('parseInspectInput', () => {
  it('classifies a checksummed address', () => {
    expect(parseInspectInput('  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266  ')).toEqual({
      kind: 'address',
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    });
  });

  it('classifies a 32-byte hash as a tx', () => {
    const hash = `0x${'ab'.repeat(32)}`;
    expect(parseInspectInput(hash)).toEqual({ kind: 'tx', hash: hash.toLowerCase() });
  });

  it('treats .eth names and bare labels as ENS', () => {
    expect(parseInspectInput('vitalik.eth')).toEqual({ kind: 'ens', name: 'vitalik.eth' });
    expect(parseInspectInput('vitalik')).toEqual({ kind: 'ens', name: 'vitalik.eth' });
    expect(parseInspectInput('sub.vitalik.eth')).toEqual({ kind: 'ens', name: 'sub.vitalik.eth' });
  });

  it('returns unknown for empty or junk', () => {
    expect(parseInspectInput('')).toEqual({ kind: 'unknown', raw: '' });
    expect(parseInspectInput('???')).toEqual({ kind: 'unknown', raw: '???' });
  });
});
