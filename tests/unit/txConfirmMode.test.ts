import { encodeFunctionData, maxUint256 } from 'viem';
import { describe, expect, it } from 'vitest';
import type { WalletAccount } from '../../src/lib/accounts';
import {
  accountInstantEnabled,
  shouldConfirmInWalletSend,
  shouldQueueDappApproval,
} from '../../src/lib/txConfirmMode';

const ADDR = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' as const;

function account(kind: WalletAccount['kind'], instant?: boolean): WalletAccount {
  return {
    id: `${kind}:${ADDR}`,
    address: ADDR,
    label: 't',
    kind,
    createdAt: 1,
    ...(instant !== undefined ? { instant } : {}),
  };
}

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const unlimitedApprove = {
  id: '1',
  method: 'eth_sendTransaction',
  params: [
    {
      to: TOKEN,
      data: encodeFunctionData({
        abi: [
          {
            name: 'approve',
            type: 'function',
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ type: 'bool' }],
          },
        ],
        functionName: 'approve',
        args: ['0x1111111111111111111111111111111111111111', maxUint256],
      }),
    },
  ],
};

const transfer = {
  id: '2',
  method: 'eth_sendTransaction',
  params: [{ to: TOKEN, data: '0xa9059cbb', value: '0x0' }],
};

describe('accountInstantEnabled', () => {
  it('never enables Burner Mode on hardware', () => {
    expect(accountInstantEnabled(account('ledger', true), { txConfirmMode: 'speed' })).toBe(
      false,
    );
  });

  it('follows per-account instant, then the global toggle', () => {
    expect(accountInstantEnabled(account('local', true), { txConfirmMode: 'normal' })).toBe(
      true,
    );
    expect(accountInstantEnabled(account('local', false), { txConfirmMode: 'speed' })).toBe(
      false,
    );
    expect(accountInstantEnabled(account('imported'), { txConfirmMode: 'speed' })).toBe(true);
    expect(accountInstantEnabled(account('imported'), { txConfirmMode: 'normal' })).toBe(
      false,
    );
  });
});

describe('shouldQueueDappApproval', () => {
  it('always queues hardware and locked software wallets', () => {
    expect(
      shouldQueueDappApproval({}, { hardware: true, hasLocalKey: true, instantOn: true }),
    ).toBe(true);
    expect(
      shouldQueueDappApproval({}, { hardware: false, hasLocalKey: false, instantOn: true }),
    ).toBe(true);
    expect(
      shouldQueueDappApproval({}, { hardware: false, hasLocalKey: true, instantOn: false }),
    ).toBe(true);
  });

  it('auto-signs ordinary transfers in gated Burner Mode', () => {
    expect(
      shouldQueueDappApproval(
        {},
        {
          hardware: false,
          hasLocalKey: true,
          instantOn: true,
          request: transfer,
          chainId: 1,
        },
      ),
    ).toBe(false);
  });

  it('still queues unlimited approvals unless that gate is off', () => {
    expect(
      shouldQueueDappApproval(
        {},
        {
          hardware: false,
          hasLocalKey: true,
          instantOn: true,
          request: unlimitedApprove,
          chainId: 1,
        },
      ),
    ).toBe(true);
    expect(
      shouldQueueDappApproval(
        { instantUngatedGates: ['unlimitedApproval'] },
        {
          hardware: false,
          hasLocalKey: true,
          instantOn: true,
          request: unlimitedApprove,
          chainId: 1,
        },
      ),
    ).toBe(false);
  });

  it('never queues when fully ungated', () => {
    expect(
      shouldQueueDappApproval(
        { instantFullyUngated: true },
        {
          hardware: false,
          hasLocalKey: true,
          instantOn: true,
          request: unlimitedApprove,
          chainId: 1,
        },
      ),
    ).toBe(false);
  });
});

describe('shouldConfirmInWalletSend', () => {
  it('skips the extra confirm only for Burner software wallets', () => {
    expect(shouldConfirmInWalletSend({ txConfirmMode: 'speed' }, account('local'))).toBe(
      false,
    );
    expect(shouldConfirmInWalletSend({ txConfirmMode: 'normal' }, account('local'))).toBe(
      true,
    );
    expect(shouldConfirmInWalletSend({ txConfirmMode: 'speed' }, account('ledger'))).toBe(
      true,
    );
  });
});
