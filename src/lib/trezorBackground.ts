import TrezorConnect from '@trezor/connect-webextension';

const TREZOR_CONNECT_SRC = 'https://connect.trezor.io/9/';

let initPromise: Promise<void> | undefined;

export function initTrezorConnect(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await TrezorConnect.init({
          lazyLoad: true,
          manifest: {
            email: '1337-wallet@proton.me',
            appName: '1337 Wallet',
            appUrl: 'https://github.com/0xCardiE/BurningFox',
          },
          connectSrc: TREZOR_CONNECT_SRC,
          _extendWebextensionLifetime: true,
        });
      } catch (err) {
        initPromise = undefined;
        throw err;
      }
    })();
  }
  return initPromise;
}

export function isTrezorMessage(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false;
  const type = (message as { type?: string }).type;
  return (
    type === 'TREZOR_INIT' ||
    type === 'TREZOR_ETHEREUM_GET_ADDRESS' ||
    type === 'TREZOR_ETHEREUM_SIGN_TRANSACTION' ||
    type === 'TREZOR_ETHEREUM_SIGN_MESSAGE' ||
    type === 'TREZOR_ETHEREUM_SIGN_TYPED_DATA'
  );
}

export async function handleTrezorMessage(message: {
  type: string;
  path?: string;
  transaction?: Record<string, unknown>;
  data?: Record<string, unknown>;
  metamask_v4_compat?: boolean;
  message?: string;
  hex?: boolean;
}): Promise<{ success: boolean; payload?: unknown; error?: string }> {
  try {
    await initTrezorConnect();
    if (message.type === 'TREZOR_INIT') {
      return { success: true, payload: { ok: true } };
    }
    if (message.type === 'TREZOR_ETHEREUM_GET_ADDRESS') {
      const path = message.path?.trim();
      if (!path) return { success: false, error: 'Missing derivation path.' };
      const result = await TrezorConnect.ethereumGetAddress({
        path,
        showOnTrezor: true,
      });
      if (!result.success) {
        return {
          success: false,
          error: result.payload?.error || 'Trezor get address failed.',
          payload: result.payload,
        };
      }
      return { success: true, payload: result.payload };
    }
    if (message.type === 'TREZOR_ETHEREUM_SIGN_TRANSACTION') {
      const path = message.path?.trim();
      const transaction = message.transaction;
      if (!path || !transaction) {
        return { success: false, error: 'Missing path or transaction.' };
      }
      const result = await TrezorConnect.ethereumSignTransaction({
        path,
        transaction: transaction as never,
      });
      if (!result.success) {
        return {
          success: false,
          error: result.payload?.error || 'Trezor sign failed.',
          payload: result.payload,
        };
      }
      return { success: true, payload: result.payload };
    }
    if (message.type === 'TREZOR_ETHEREUM_SIGN_MESSAGE') {
      const path = message.path?.trim();
      const msg = message.message;
      if (!path || typeof msg !== 'string') {
        return { success: false, error: 'Missing path or message.' };
      }
      const result = await TrezorConnect.ethereumSignMessage({
        path,
        message: msg,
        hex: Boolean(message.hex),
      });
      if (!result.success) {
        return {
          success: false,
          error: result.payload?.error || 'Trezor sign message failed.',
          payload: result.payload,
        };
      }
      return { success: true, payload: result.payload };
    }
    if (message.type === 'TREZOR_ETHEREUM_SIGN_TYPED_DATA') {
      const path = message.path?.trim();
      const data = message.data;
      if (!path || !data || typeof data !== 'object') {
        return { success: false, error: 'Missing path or typed data.' };
      }
      const result = await TrezorConnect.ethereumSignTypedData({
        path,
        data: data as never,
        metamask_v4_compat: message.metamask_v4_compat ?? true,
      });
      if (!result.success) {
        return {
          success: false,
          error: result.payload?.error || 'Trezor sign typed data failed.',
          payload: result.payload,
        };
      }
      return { success: true, payload: result.payload };
    }
    return { success: false, error: 'Unknown Trezor message.' };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
