import { describe, expect, it } from 'vitest';
import { DEFAULT_CHAIN_ID, DEFAULT_SLIPPAGE_PERCENT } from '../../src/lib/constants';
import {
  effectiveActiveChainId,
  effectiveAutoLockMinutes,
  effectiveReplaceMetaMask,
  effectiveSlippagePercent,
  effectiveSlippageRatio,
  effectiveToolbarOpenMode,
  effectiveTxConfirmMode,
  parseSlippageInput,
} from '../../src/lib/storageState';

describe('storageState effective settings', () => {
  it('defaults confirm mode to normal and toolbar to side panel', () => {
    expect(effectiveTxConfirmMode({})).toBe('normal');
    expect(effectiveTxConfirmMode({ txConfirmMode: 'speed' })).toBe('speed');
    expect(effectiveToolbarOpenMode({})).toBe('side_panel');
    expect(effectiveToolbarOpenMode({ toolbarOpenMode: 'popup' })).toBe('popup');
  });

  it('defaults chain, MetaMask replace, and auto-lock off', () => {
    expect(effectiveActiveChainId({})).toBe(DEFAULT_CHAIN_ID);
    expect(effectiveActiveChainId({ activeChainId: 8453 })).toBe(8453);
    expect(effectiveReplaceMetaMask({})).toBe(true);
    expect(effectiveReplaceMetaMask({ replaceMetaMask: false })).toBe(false);
    expect(effectiveAutoLockMinutes({})).toBe(0);
    expect(effectiveAutoLockMinutes({ autoLockMinutes: 15 })).toBe(15);
    expect(effectiveAutoLockMinutes({ autoLockMinutes: 7 })).toBe(0);
  });

  it('clamps slippage', () => {
    expect(effectiveSlippagePercent({})).toBe(DEFAULT_SLIPPAGE_PERCENT);
    expect(effectiveSlippageRatio({ slippagePercent: 5 })).toBe(0.05);
    expect(parseSlippageInput('1,5')).toBe(1.5);
    expect(parseSlippageInput('nope')).toBeNull();
    expect(parseSlippageInput('99')).toBe(50);
  });
});
