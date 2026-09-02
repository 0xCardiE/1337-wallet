declare module '@trezor/connect-webextension' {
  type Manifest = {
    email: string;
    appName: string;
    appUrl: string;
  };

  type ConnectSettings = {
    lazyLoad?: boolean;
    coreMode?: 'auto' | 'popup' | 'iframe' | 'suite-desktop' | 'suite-web';
    manifest: Manifest;
    connectSrc?: string;
    transports?: string[];
    _extendWebextensionLifetime?: boolean;
  };

  type Response<T> =
    | { success: true; payload: T }
    | { success: false; payload: { error: string; code?: string } };

  type EthereumTransaction = Record<string, unknown>;

  type TrezorConnectApi = {
    init(settings: ConnectSettings): Promise<void>;
    ethereumGetAddress(params: {
      path: string;
      showOnTrezor?: boolean;
    }): Promise<Response<{ address: string; path: number[] }>>;
    ethereumSignTransaction(params: {
      path: string;
      transaction: EthereumTransaction;
    }): Promise<Response<{ v: string | number; r: string; s: string }>>;
  };

  const TrezorConnect: TrezorConnectApi;
  export default TrezorConnect;
}
