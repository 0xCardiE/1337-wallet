/**
 * Injected EIP-1193 + EIP-6963 provider — runs in the page MAIN world at document_start.
 */
import {
  PROVIDER_CHANNEL,
  type ProviderInjectConfig,
  type ProviderRequest,
  type ProviderResponse,
  type WindowProviderEvent,
} from '../provider/types';
import { PROVIDER_INFO_1337 } from '../lib/constants';

const INJECTED_FLAG_1337 = '__1337Injected';

type Listener = (...args: unknown[]) => void;

class ProviderRpcError extends Error {
  code: number;
  data?: unknown;
  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ProviderRpcError';
    this.code = code;
    this.data = data;
  }
}

class Provider1337 {
  is1337 = true;
  isMetaMask = true;
  readonly _metamask = {
    isUnlocked: async () => true,
    requestBatch: async () => [],
  };

  private listeners = new Map<string, Set<Listener>>();
  private pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  selectedAddress: string | null = null;
  chainId = '0x1';
  networkVersion = '1';

  constructor() {
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.channel !== PROVIDER_CHANNEL || data.target !== 'inpage') return;
      if (data.type === 'response') {
        this.dispatchPending(data.response as ProviderResponse);
      } else if (data.type === 'event') {
        this.handleEvent(data.event as WindowProviderEvent);
      }
    });
    void this.syncState();
  }

  private dispatchPending(res: ProviderResponse): void {
    const p = this.pending.get(res.id);
    if (!p) return;
    this.pending.delete(res.id);
    if (res.ok) p.resolve(res.result);
    else p.reject(new ProviderRpcError(res.error.code, res.error.message));
  }

  private handleEvent(ev: WindowProviderEvent): void {
    if (ev.type === 'chainChanged') {
      this.chainId = ev.chainId;
      this.networkVersion = String(Number.parseInt(ev.chainId, 16) || 1);
      this.emit('chainChanged', ev.chainId);
    } else if (ev.type === 'accountsChanged') {
      this.selectedAddress = ev.accounts[0] ?? null;
      this.emit('accountsChanged', ev.accounts);
      if (ev.accounts.length > 0) {
        this.emit('connect', { chainId: this.chainId });
      } else {
        this.emit('disconnect', new ProviderRpcError(4900, 'Disconnected'));
      }
    } else if (ev.type === 'connect') {
      this.chainId = ev.chainId;
      this.networkVersion = String(Number.parseInt(ev.chainId, 16) || 1);
      this.emit('connect', { chainId: ev.chainId });
    } else if (ev.type === 'disconnect') {
      this.selectedAddress = null;
      this.emit('disconnect', new ProviderRpcError(4900, 'Disconnected'));
      this.emit('accountsChanged', []);
    }
  }

  isConnected(): boolean {
    return this.selectedAddress != null;
  }

  on(event: string, listener: Listener): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  }

  addListener(event: string, listener: Listener): this {
    return this.on(event, listener);
  }

  once(event: string, listener: Listener): this {
    const wrap: Listener = (...args) => {
      this.removeListener(event, wrap);
      listener(...args);
    };
    return this.on(event, wrap);
  }

  removeListener(event: string, listener: Listener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  off(event: string, listener: Listener): this {
    return this.removeListener(event, listener);
  }

  removeAllListeners(event?: string): this {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
    return this;
  }

  private emit(event: string, ...args: unknown[]): void {
    for (const fn of [...(this.listeners.get(event) ?? [])]) {
      try {
        fn(...args);
      } catch {
        /* ignore listener errors */
      }
    }
  }

  async request(args: { method: string; params?: unknown[] }): Promise<unknown> {
    if (!args || typeof args.method !== 'string') {
      throw new ProviderRpcError(4000, 'Invalid request');
    }
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `1337-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const req: ProviderRequest = { id, method: args.method, params: args.params };
    const result = await new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      window.postMessage(
        { channel: PROVIDER_CHANNEL, target: 'content', type: 'request', request: req },
        '*',
      );
      window.setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new ProviderRpcError(4900, '1337 provider request timed out'));
        }
      }, 120_000);
    });

    if (args.method === 'eth_requestAccounts' && Array.isArray(result)) {
      const accounts = result as string[];
      this.selectedAddress = accounts[0] ?? null;
      this.emit('connect', { chainId: this.chainId });
      this.emit('accountsChanged', accounts);
    } else if (args.method === 'eth_accounts' && Array.isArray(result)) {
      this.selectedAddress = (result as string[])[0] ?? null;
    } else if (args.method === 'eth_chainId' && typeof result === 'string') {
      this.chainId = result;
      this.networkVersion = String(Number.parseInt(result, 16) || 1);
    } else if (args.method === 'wallet_switchEthereumChain') {
      const p = args.params?.[0] as { chainId?: string } | undefined;
      if (typeof p?.chainId === 'string') {
        this.chainId = p.chainId;
        this.networkVersion = String(Number.parseInt(p.chainId, 16) || 1);
        this.emit('chainChanged', p.chainId);
      } else {
        void this.syncState();
      }
    } else if (args.method === 'wallet_addEthereumChain') {
      const p = args.params?.[0] as { chainId?: string } | undefined;
      if (typeof p?.chainId === 'string') {
        this.chainId = p.chainId;
        this.networkVersion = String(Number.parseInt(p.chainId, 16) || 1);
        this.emit('chainChanged', p.chainId);
      } else {
        void this.syncState();
      }
    } else if (args.method === 'wallet_revokePermissions') {
      this.selectedAddress = null;
      this.emit('disconnect', new ProviderRpcError(4900, 'Disconnected'));
      this.emit('accountsChanged', []);
    }

    return result;
  }

  /** Legacy Web3.js / older dapps */
  send(methodOrPayload: string | { method: string; params?: unknown[] }, paramsOrCb?: unknown): unknown {
    if (typeof methodOrPayload === 'string') {
      return this.request({
        method: methodOrPayload,
        params: Array.isArray(paramsOrCb) ? paramsOrCb : undefined,
      });
    }
    const payload = methodOrPayload;
    const cb = paramsOrCb as
      | ((err: Error | null, res?: { id?: unknown; jsonrpc: string; result?: unknown; error?: unknown }) => void)
      | undefined;
    if (typeof cb === 'function') {
      void this.request(payload)
        .then(result => cb(null, { id: undefined, jsonrpc: '2.0', result }))
        .catch(err => cb(err instanceof Error ? err : new Error(String(err))));
      return;
    }
    return this.request(payload);
  }

  sendAsync(
    payload: { method: string; params?: unknown[]; id?: unknown },
    callback: (err: Error | null, res?: { id?: unknown; jsonrpc: string; result?: unknown; error?: unknown }) => void,
  ): void {
    void this.request({ method: payload.method, params: payload.params })
      .then(result => callback(null, { id: payload.id, jsonrpc: '2.0', result }))
      .catch(err => {
        const e = err instanceof ProviderRpcError ? err : new ProviderRpcError(4001, String(err));
        callback(e, {
          id: payload.id,
          jsonrpc: '2.0',
          error: { code: e.code, message: e.message },
        });
      });
  }

  async enable(): Promise<string[]> {
    return (await this.request({ method: 'eth_requestAccounts' })) as string[];
  }

  async syncState(): Promise<void> {
    try {
      const [accounts, chainId] = await Promise.all([
        this.request({ method: 'eth_accounts' }),
        this.request({ method: 'eth_chainId' }),
      ]);
      if (Array.isArray(accounts)) {
        this.selectedAddress = (accounts as string[])[0] ?? null;
      }
      if (typeof chainId === 'string') {
        this.chainId = chainId;
        this.networkVersion = String(Number.parseInt(chainId, 16) || 1);
      }
    } catch {
      /* wallet may be locked */
    }
  }
}

function defaultInjectConfig(): ProviderInjectConfig {
  return {
    replaceMetaMask: true,
    is1337: true,
    isMetaMask: true,
    announceAs1337: true,
    announceAsMetaMask: true,
  };
}

let lastAnnounce: (() => void) | null = null;
let eip6963Listening = false;

function announceEip6963(provider: Provider1337, config: ProviderInjectConfig): void {
  const announceDetail = (info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  }) => {
    const detail = Object.freeze({
      info: Object.freeze(info),
      provider,
    });
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
  };

  const announce = () => {
    if (config.announceAs1337) {
      announceDetail({
        uuid: PROVIDER_INFO_1337.uuid,
        name: PROVIDER_INFO_1337.name,
        icon: PROVIDER_INFO_1337.icon,
        rdns: PROVIDER_INFO_1337.rdns,
      });
    }
    if (config.announceAsMetaMask) {
      announceDetail({
        uuid: '1337-metamask-dropin-2026',
        name: 'MetaMask',
        icon: PROVIDER_INFO_1337.icon,
        rdns: 'io.metamask',
      });
    }
  };

  lastAnnounce = announce;
  announce();
  if (!eip6963Listening) {
    eip6963Listening = true;
    window.addEventListener('eip6963:requestProvider', () => lastAnnounce?.());
    for (const ms of [0, 50, 200, 500, 1000, 2000]) {
      window.setTimeout(() => lastAnnounce?.(), ms);
    }
  }
}

function applyInjectConfig(provider: Provider1337, config: ProviderInjectConfig): void {
  provider.is1337 = config.is1337;
  provider.isMetaMask = config.isMetaMask;
}

function installEthereumShim(
  w: Window & { ethereum?: Provider1337 & { providers?: unknown[] } },
  provider: Provider1337,
): void {
  const legacy = w.ethereum;
  const legacyList: unknown[] =
    legacy && legacy !== provider
      ? Array.isArray(legacy.providers)
        ? [...legacy.providers]
        : [legacy]
      : [];

  const apply = () => {
    try {
      Object.defineProperty(w, 'ethereum', {
        configurable: true,
        enumerable: true,
        get() {
          return provider;
        },
        set(next) {
          if (next && (next as Provider1337).is1337) return;
          if (next && !legacyList.includes(next)) legacyList.push(next);
        },
      });
      Object.defineProperty(provider, 'providers', {
        value: [provider, ...legacyList.filter(p => p !== provider)],
        configurable: true,
        enumerable: false,
      });
    } catch {
      try {
        w.ethereum = provider;
      } catch {
        /* ignore */
      }
    }
  };

  apply();
  for (let i = 1; i <= 80; i += 1) {
    window.setTimeout(apply, i * 50);
  }
  window.dispatchEvent(new Event('ethereum#initialized'));
}

function installProvider(config: ProviderInjectConfig): Provider1337 {
  const w = window as Window & {
    ethereum?: Provider1337 & { providers?: unknown[] };
    wallet1337?: Provider1337;
    [INJECTED_FLAG_1337]?: boolean;
  };

  if (w[INJECTED_FLAG_1337] && w.wallet1337) {
    applyInjectConfig(w.wallet1337, config);
    announceEip6963(w.wallet1337, config);
    if (config.replaceMetaMask) installEthereumShim(w, w.wallet1337);
    return w.wallet1337;
  }

  w[INJECTED_FLAG_1337] = true;
  const provider = new Provider1337();
  applyInjectConfig(provider, config);
  w.wallet1337 = provider;

  if (config.replaceMetaMask) {
    installEthereumShim(w, provider);
  } else if (!w.ethereum) {
    w.ethereum = provider;
  }

  announceEip6963(provider, config);
  return provider;
}

installProvider(defaultInjectConfig());

void (async () => {
  try {
    const res = await new Promise<ProviderInjectConfig>(resolve => {
      window.postMessage(
        { channel: PROVIDER_CHANNEL, target: 'content', type: 'init' },
        '*',
      );
      const handler = (event: MessageEvent) => {
        if (event.source !== window) return;
        const data = event.data;
        if (data?.channel === PROVIDER_CHANNEL && data?.type === 'init-config') {
          window.removeEventListener('message', handler);
          const c = data.config as Partial<ProviderInjectConfig> | undefined;
          resolve({
            replaceMetaMask: c?.replaceMetaMask !== false,
            is1337: c?.is1337 !== false,
            isMetaMask: c?.isMetaMask !== false,
            announceAs1337: c?.announceAs1337 !== false,
            announceAsMetaMask:
              typeof c?.announceAsMetaMask === 'boolean'
                ? c.announceAsMetaMask
                : c?.replaceMetaMask !== false,
          });
        }
      };
      window.addEventListener('message', handler);
      window.setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(defaultInjectConfig());
      }, 400);
    });
    installProvider(res);
  } catch {
    installProvider(defaultInjectConfig());
  }
})();
