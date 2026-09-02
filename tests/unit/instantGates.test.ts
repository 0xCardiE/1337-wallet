import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HIGH_VALUE_NATIVE,
  INSTANT_GATE_IDS,
  effectiveActiveInstantGates,
  effectiveHighValueNative,
  isInstantGateId,
  normalizeHighValueNative,
  normalizeInstantUngatedGates,
} from '../../src/lib/instantGates';

describe('instantGates', () => {
  it('recognizes only catalogued gate ids', () => {
    expect(isInstantGateId('highValue')).toBe(true);
    expect(isInstantGateId('notAGate')).toBe(false);
  });

  it('defaults every gate to active', () => {
    const active = effectiveActiveInstantGates({});
    expect([...active]).toEqual([...INSTANT_GATE_IDS]);
  });

  it('drops ungated ids from the active set', () => {
    const active = effectiveActiveInstantGates({
      instantUngatedGates: ['permit', 'highValue'],
    });
    expect(active.has('permit')).toBe(false);
    expect(active.has('highValue')).toBe(false);
    expect(active.has('unlimitedApproval')).toBe(true);
  });

  it('returns an empty set when fully ungated', () => {
    expect(effectiveActiveInstantGates({ instantFullyUngated: true }).size).toBe(0);
  });

  it('normalizes ungated lists and drops junk', () => {
    expect(normalizeInstantUngatedGates(['permit', 'permit', 'nope', 1])).toEqual(['permit']);
    expect(normalizeInstantUngatedGates('permit')).toBeUndefined();
    expect(normalizeInstantUngatedGates([])).toBeUndefined();
  });

  it('clamps high-value threshold', () => {
    expect(normalizeHighValueNative(-4)).toBe(DEFAULT_HIGH_VALUE_NATIVE);
    expect(normalizeHighValueNative('2.5')).toBe(2.5);
    expect(normalizeHighValueNative(9e9)).toBe(1_000_000);
    expect(effectiveHighValueNative({})).toBe(DEFAULT_HIGH_VALUE_NATIVE);
    expect(effectiveHighValueNative({ instantHighValueNative: 5 })).toBe(5);
  });
});
