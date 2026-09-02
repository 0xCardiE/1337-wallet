import { vi } from 'vitest';

/** Chrome APIs are unused by unit tests; stub so accidental imports do not throw. */
vi.stubGlobal('chrome', {
  runtime: {
    lastError: undefined,
    sendMessage: (_msg: unknown, cb?: (r: unknown) => void) => {
      cb?.(undefined);
      return Promise.resolve();
    },
    getURL: (p: string) => `chrome-extension://test/${p}`,
  },
  storage: {
    local: {
      get: (_keys: unknown, cb: (r: Record<string, unknown>) => void) => cb({}),
      set: (_items: unknown, cb?: () => void) => cb?.(),
    },
    session: {
      get: async () => ({}),
      set: async () => undefined,
      remove: async () => undefined,
    },
    onChanged: { addListener() {}, removeListener() {} },
  },
  tabs: { query: async () => [], sendMessage: async () => undefined },
  windows: { create: async () => undefined, getLastFocused: async () => undefined },
  sidePanel: {},
  scripting: { executeScript: async () => undefined },
  action: { setPopup: async () => undefined, openPopup: async () => undefined },
});
