import TrezorConnect from '@trezor/connect-webextension';
import { prepareTrezorTypedData, type Eip712Payload } from './eip712Hashes';

const TREZOR_CONNECT_SRC = 'https://connect.trezor.io/9/';

let initPromise: Promise<void> | undefined;

export function initTrezorConnect(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await TrezorConnect.init({
          lazyLoad: true,
          // Default `auto` probes Trezor Suite at ws://127.0.0.1:21335/connect-ws
          // and logs ERR_CONNECTION_REFUSED whenever Suite is not running.
          coreMode: 'popup',
          manifest: {
            email: '1337-wallet@proton.me',
            appName: '1337 Wallet',
            appUrl: 'https://github.com/0xCardiE/1337-wallet',
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
    type === 'TREZOR_ETHEREUM_SIGN_TYPED_DATA' ||
    type === 'TREZOR_RESET'
  );
}

export async function handleTrezorMessage(message: {
  type: string;
  path?: string;
  paths?: string[];
  showOnTrezor?: boolean;
  transaction?: Record<string, unknown>;
  data?: Record<string, unknown>;
  metamask_v4_compat?: boolean;
  message?: string;
  hex?: boolean;
}): Promise<{ success: boolean; payload?: unknown; error?: string }> {
  try {
    if (message.type === 'TREZOR_RESET') {
      try {
        TrezorConnect.dispose();
      } catch {
        /* not initialized */
      }
      initPromise = undefined;
      return { success: true, payload: { ok: true } };
    }
    await initTrezorConnect();
    if (message.type === 'TREZOR_INIT') {
      return { success: true, payload: { ok: true } };
    }
    if (message.type === 'TREZOR_ETHEREUM_GET_ADDRESS') {
      const paths = Array.isArray(message.paths)
        ? message.paths.map(p => String(p).trim()).filter(Boolean)
        : message.path?.trim()
          ? [message.path.trim()]
          : [];
      if (paths.length === 0) return { success: false, error: 'Missing derivation path.' };
      const showOnTrezor = message.showOnTrezor === true;
      const result =
        paths.length === 1
          ? await TrezorConnect.ethereumGetAddress({
              path: paths[0],
              showOnTrezor,
            })
          : await TrezorConnect.ethereumGetAddress({
              bundle: paths.map(path => ({ path, showOnTrezor: false })),
            });
      if (!result.success) {
        return {
          success: false,
          error: result.payload?.error || 'Trezor get address failed.',
          payload: result.payload,
        };
      }
      const items = Array.isArray(result.payload) ? result.payload : [result.payload];
      return {
        success: true,
        payload: {
          address: items[0]?.address,
          addresses: items.map((item, i) => ({
            address: item.address,
            path: paths[i],
          })),
        },
      };
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
      const prepared = prepareTrezorTypedData(data as Eip712Payload);
      const result = await TrezorConnect.ethereumSignTypedData({
        path,
        data: prepared.data as never,
        metamask_v4_compat: message.metamask_v4_compat ?? true,
        domain_separator_hash: prepared.domain_separator_hash,
        message_hash: prepared.message_hash,
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
