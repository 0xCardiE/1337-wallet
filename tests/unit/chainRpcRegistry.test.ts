import { afterEach, describe, expect, it } from 'vitest';
import {
  rpcListForManage,
  rpcUrlsFor,
  setCustomRpcMap,
  setPreferredRpcMap,
  setRpcOrderMap,
} from '../../src/lib/chainRpcRegistry';

describe('chainRpcRegistry user order', () => {
  afterEach(() => {
    setPreferredRpcMap({});
    setCustomRpcMap({});
    setRpcOrderMap({});
  });

  it('puts preferred first when the user has not ranked RPCs', () => {
    const catalog = rpcUrlsFor(1);
    expect(catalog.length).toBeGreaterThan(2);
    setPreferredRpcMap({ 1: catalog[2]! });
    expect(rpcUrlsFor(1)[0]).toBe(catalog[2]);
    expect(rpcListForManage(1)[0]).toBe(catalog[2]);
  });

  it('honors a custom RPC ranking over catalog order', () => {
    const catalog = rpcUrlsFor(1);
    const ranked = [catalog[3]!, catalog[0]!, catalog[1]!];
    setRpcOrderMap({ 1: ranked });
    expect(rpcUrlsFor(1).slice(0, 3)).toEqual(ranked);
    expect(rpcListForManage(1).slice(0, 3)).toEqual(ranked);
  });

  it('appends newly seen RPCs after the user ranking', () => {
    const catalog = rpcUrlsFor(1);
    setCustomRpcMap({ 1: ['https://my.example/rpc'] });
    setRpcOrderMap({ 1: [catalog[0]!] });
    const urls = rpcUrlsFor(1);
    expect(urls[0]).toBe(catalog[0]);
    expect(urls).toContain('https://my.example/rpc');
    expect(urls.indexOf('https://my.example/rpc')).toBeGreaterThan(0);
  });
});
