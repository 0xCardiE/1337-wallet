import { describe, expect, it } from 'vitest';
import {
  TOOL_IDS,
  defaultEnabledToolIds,
  effectiveEnabledTools,
  isToolEnabled,
  isToolId,
  normalizeEnabledTools,
  toolAvailableOnChain,
  visibleToolsForChain,
} from '../../src/lib/toolsRegistry';

const DEFAULT_ON = ['signings', 'approvals', 'swap', 'ens', 'multisend', 'gas'] as const;

describe('toolsRegistry', () => {
  it('defaults Signings on and Inspect off', () => {
    expect(defaultEnabledToolIds()).toEqual([...DEFAULT_ON]);
    expect(effectiveEnabledTools({})).toEqual([...DEFAULT_ON]);
    expect(TOOL_IDS).toContain('inspect');
    expect(isToolEnabled({}, 'inspect')).toBe(false);
    expect(isToolEnabled({}, 'signings')).toBe(true);
  });

  it('treats the pre-Signings all-on list as the new defaults', () => {
    expect(
      effectiveEnabledTools({
        enabledTools: ['inspect', 'approvals', 'swap', 'ens', 'multisend', 'gas'],
      }),
    ).toEqual([...DEFAULT_ON]);
  });

  it('respects an explicit enabled list (including empty)', () => {
    expect(normalizeEnabledTools(['inspect', 'nope', 'swap'])).toEqual(['inspect', 'swap']);
    expect(effectiveEnabledTools({ enabledTools: ['inspect'] })).toEqual(['inspect']);
    expect(isToolEnabled({ enabledTools: ['inspect'] }, 'swap')).toBe(false);
    expect(isToolId('gas')).toBe(true);
    expect(isToolId('signings')).toBe(true);
  });

  it('hides LiFi/ENS tools on testnets', () => {
    expect(toolAvailableOnChain('swap', 'testnet')).toBe(false);
    expect(toolAvailableOnChain('ens', 'testnet')).toBe(false);
    expect(toolAvailableOnChain('gas', 'testnet')).toBe(false);
    expect(toolAvailableOnChain('signings', 'testnet')).toBe(true);
    expect(toolAvailableOnChain('inspect', 'testnet')).toBe(true);
    expect(toolAvailableOnChain('multisend', 'testnet')).toBe(true);
    expect(visibleToolsForChain({}, 'testnet')).toEqual(['signings', 'approvals', 'multisend']);
    expect(visibleToolsForChain({}, 'mainnet')).toEqual([...DEFAULT_ON]);
  });
});
