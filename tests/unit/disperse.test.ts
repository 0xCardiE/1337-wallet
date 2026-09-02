import { getAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  CREATEX_ADDRESS,
  DISPERSE_ADDRESS,
  DISPERSE_CREATE2_ADDRESS,
  DISPERSE_CREATE2_SALT,
  DISPERSE_CREATEX_CALLDATA,
} from '../../src/lib/disperse';

describe('Disperse / CreateX pins', () => {
  it('keeps the legacy Disperse.app address', () => {
    expect(getAddress(DISPERSE_ADDRESS)).toBe('0xD152f549545093347A162Dce210e7293f1452150');
  });

  it('keeps CreateX + the permissionless salt', () => {
    expect(getAddress(CREATEX_ADDRESS)).toBe('0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed');
    expect(DISPERSE_CREATE2_SALT.startsWith('0xfd73487f4e6544007a3ce4')).toBe(true);
    expect(DISPERSE_CREATEX_CALLDATA.startsWith('0x26307668')).toBe(true);
  });

  it('derives the pinned CREATE2 Disperse address from calldata', () => {
    expect(getAddress(DISPERSE_CREATE2_ADDRESS)).toBe(
      '0x0A7AA7F49F5d39A48614774f278a630Df4A8F6A6',
    );
  });
});
