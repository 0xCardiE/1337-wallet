import { describe, expect, it } from 'vitest';
import {
  isDisabledEthSign,
  isUserRejectedProviderError,
  shouldReportProviderError,
  userNoticeForProviderFailure,
  userNoticeForSignSuccess,
} from '../../src/lib/devErrorFormat';

describe('provider error UX', () => {
  it('does not dump user or device rejects as DEV errors', () => {
    expect(shouldReportProviderError(4001, 'User rejected the request')).toBe(false);
    expect(
      shouldReportProviderError(4001, 'Ledger request was rejected on the device.'),
    ).toBe(false);
    expect(shouldReportProviderError(4001, 'Trezor request failed or was cancelled.')).toBe(
      false,
    );
    expect(isUserRejectedProviderError(4001, 'anything')).toBe(true);
  });

  it('does not dump disabled eth_sign as a DEV error', () => {
    expect(
      shouldReportProviderError(
        4200,
        'eth_sign is disabled. Use personal_sign or eth_signTypedData_v4.',
        'eth_sign',
      ),
    ).toBe(false);
    expect(
      isDisabledEthSign(
        'eth_sign',
        4200,
        'eth_sign is disabled. Use personal_sign or eth_signTypedData_v4.',
      ),
    ).toBe(true);
  });

  it('still reports unexpected RPC failures', () => {
    expect(shouldReportProviderError(4200, 'Unsupported method: wallet_sendCalls', 'wallet_sendCalls')).toBe(
      true,
    );
    expect(shouldReportProviderError(-32000, 'execution reverted', 'eth_call')).toBe(true);
  });

  it('turns expected failures into short notices', () => {
    expect(
      userNoticeForProviderFailure(
        'eth_sign',
        4200,
        'eth_sign is disabled. Use personal_sign or eth_signTypedData_v4.',
      ),
    ).toEqual({
      kind: 'warn',
      title: 'This sign method is off',
      message: 'eth_sign is disabled. Use personal_sign or typed data.',
    });
    expect(
      userNoticeForProviderFailure(
        'personal_sign',
        4001,
        'Ledger request was rejected on the device.',
      ),
    ).toEqual({
      kind: 'info',
      title: 'Rejected',
      message: 'Ledger request was rejected on the device.',
    });
  });

  it('confirms a signed message without a DEV dump', () => {
    expect(userNoticeForSignSuccess('personal_sign')).toEqual({
      kind: 'ok',
      title: 'Signed',
      message: 'Message signed. The site has the signature.',
    });
    expect(userNoticeForSignSuccess('eth_signTypedData_v4')?.title).toBe('Signed');
    expect(userNoticeForSignSuccess('eth_sendTransaction')).toBeNull();
  });
});
