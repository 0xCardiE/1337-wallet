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

describe('toolsRegistry', () => {
  it('defaults every catalog tool on', () => {
    expect(defaultEnabledToolIds()).toEqual([...TOOL_IDS]);
    expect(effectiveEnabledTools({})).toEqual([...TOOL_IDS]);
  });

  it('respects an explicit enabled list (including empty)', () => {
    expect(normalizeEnabledTools(['inspect', 'nope', 'swap'])).toEqual(['inspect', 'swap']);
    expect(effectiveEnabledTools({ enabledTools: ['inspect'] })).toEqual(['inspect']);
    expect(isToolEnabled({ enabledTools: ['inspect'] }, 'swap')).toBe(false);
    expect(isToolId('gas')).toBe(true);
  });

  it('hides LiFi/ENS tools on testnets', () => {
    expect(toolAvailableOnChain('swap', 'testnet')).toBe(false);
    expect(toolAvailableOnChain('ens', 'testnet')).toBe(false);
    expect(toolAvailableOnChain('gas', 'testnet')).toBe(false);
    expect(toolAvailableOnChain('inspect', 'testnet')).toBe(true);
    expect(toolAvailableOnChain('multisend', 'testnet')).toBe(true);
    expect(visibleToolsForChain({}, 'testnet')).toEqual(['inspect', 'approvals', 'multisend']);
    expect(visibleToolsForChain({}, 'mainnet')).toEqual([...TOOL_IDS]);
  });
});
