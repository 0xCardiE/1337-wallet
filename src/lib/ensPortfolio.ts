import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  namehash,
  type Address,
  type Hex,
} from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';
import { getEnsResolver } from 'viem/actions';
import { healthyRpcUrlsFor } from './chainRpcRegistry';
import { DEFAULT_CHAIN_ID } from './constants';
import {
  classifyRpcFailure,
  recordRpcFailure,
  recordRpcSuccess,
  RpcExhaustedError,
} from './rpcHealth';
import {
  ENS_PUBLIC_RESOLVER,
  ENS_REGISTRY,
  ENS_REGISTRY_ABI,
  ENS_RESOLVER_ABI,
  ETH_REGISTRAR_CONTROLLER,
  ETH_REGISTRAR_CONTROLLER_ABI,
  ONE_YEAR_SECONDS,
} from './ensContracts';
import { decodeContentHash, type DecodedContentHash } from './ensContentHash';
import {
  fetchEnsDomainsFromSubgraph,
  fetchManagedSubdomains,
  type SubgraphDomainRow,
} from './ensSubgraph';
import { sendTransactionRequest } from './ethereum';

/** Skip slow eth_estimateGas for known ENS controller/resolver calls. */
const ENS_GAS = {
  commit: 120_000,
  register: 450_000,
  renew: 250_000,
  setContenthash: 120_000,
  setText: 100_000,
} as const;

const RPC_TIMEOUT_MS = 10_000;
const MAX_RPC_ATTEMPTS = 5;

export interface EnsDomainRecord {
  name: string;
  normalizedName: string;
  expiryDate: number | null;
  /** Set when subdomain expiry is inherited from the parent .eth registration. */
  expiryInheritedFrom?: string;
  resolver: Address | null;
  contentHash: DecodedContentHash;
  urlText: string | null;
  isSubdomain: boolean;
  /** `.eth` second-level names can be renewed via registrar controller. */
  canRenew: boolean;
}

let mainnetClient: ReturnType<typeof createPublicClient> | null = null;
let mainnetClientRpc = '';

function getMainnetClient() {
  const rpc = healthyRpcUrlsFor(DEFAULT_CHAIN_ID)[0];
  if (!rpc) throw new Error('No Ethereum mainnet RPC configured.');
  if (mainnetClient && mainnetClientRpc === rpc) return mainnetClient;
  mainnetClientRpc = rpc;
  mainnetClient = createPublicClient({
    chain: mainnet,
    transport: http(rpc, { timeout: RPC_TIMEOUT_MS }),
  });
  return mainnetClient;
}

async function withMainnetFallback<T>(
  fn: (rpc: string) => Promise<T>,
  method = 'ENS read',
): Promise<T> {
  const tried: string[] = [];
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < MAX_RPC_ATTEMPTS; attempt++) {
    const rpc = healthyRpcUrlsFor(DEFAULT_CHAIN_ID).find(u => !tried.includes(u));
    if (!rpc) break;
    tried.push(rpc);

    const t0 = performance.now();
    try {
      const result = await fn(rpc);
      recordRpcSuccess(DEFAULT_CHAIN_ID, rpc, Math.round(performance.now() - t0));
      return result;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const cls = classifyRpcFailure(e);
      if (cls.demote) {
        recordRpcFailure(DEFAULT_CHAIN_ID, rpc, msg, {
          hard: cls.hard,
          latencyMs: Math.round(performance.now() - t0),
        });
      }
      if (!cls.retryOtherRpc) throw e;
    }
  }

  const lastMsg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'Mainnet RPC failed');
  throw new RpcExhaustedError(DEFAULT_CHAIN_ID, tried, lastMsg, method);
}

async function readResolverAddress(name: string): Promise<Address | null> {
  const normalized = normalize(name);
  const node = namehash(normalized);
  return withMainnetFallback(async rpc => {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpc, { timeout: RPC_TIMEOUT_MS }),
    });
    const resolver = await client.readContract({
      address: ENS_REGISTRY,
      abi: ENS_REGISTRY_ABI,
      functionName: 'resolver',
      args: [node],
    });
    if (!resolver || resolver === '0x0000000000000000000000000000000000000000') return null;
    return getAddress(resolver);
  });
}

function subgraphRowToRecord(row: SubgraphDomainRow): EnsDomainRecord {
  const normalizedName = normalize(row.name);
  const isSubdomain = normalizedName.split('.').length > 2;
  const canRenew = normalizedName.endsWith('.eth') && !isSubdomain;

  let resolver: Address | null = null;
  const resolverAddr = row.resolver?.address?.trim();
  if (resolverAddr) {
    try {
      resolver = getAddress(resolverAddr);
    } catch {
      resolver = null;
    }
  }

  const expiryDate = row.expiryDate ? Number(row.expiryDate) : null;

  return {
    name: row.name,
    normalizedName,
    expiryDate: Number.isFinite(expiryDate) ? expiryDate : null,
    resolver,
    contentHash: { kind: 'empty', uri: null, raw: null },
    urlText: null,
    isSubdomain,
    canRenew,
  };
}

/** Load resolver / content hash / url text from mainnet (lazy, per domain). */
export async function enrichEnsDomainOnChain(record: EnsDomainRecord): Promise<EnsDomainRecord> {
  const normalizedName = record.normalizedName;
  let resolver = record.resolver;

  if (!resolver) {
    try {
      resolver = await readResolverAddress(normalizedName);
    } catch {
      resolver = null;
    }
  }

  let contentHash = record.contentHash;
  let urlText = record.urlText;

  if (resolver) {
    const node = namehash(normalizedName);
    const [rawHash, url] = await withMainnetFallback(async rpc => {
      const client = createPublicClient({
        chain: mainnet,
        transport: http(rpc, { timeout: RPC_TIMEOUT_MS }),
      });
      return Promise.all([
        client.readContract({
          address: resolver!,
          abi: ENS_RESOLVER_ABI,
          functionName: 'contenthash',
          args: [node],
        }) as Promise<Hex>,
        client
          .readContract({
            address: resolver!,
            abi: ENS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, 'url'],
          })
          .catch(() => '') as Promise<string>,
      ]);
    }, `ENS records for ${record.name}`);
    contentHash = decodeContentHash(rawHash);
    urlText = url?.trim() || null;
  }

  return { ...record, resolver, contentHash, urlText };
}

/** Second-level `.eth` name a subdomain depends on (e.g. beesnap.swarmtools.eth → swarmtools.eth). */
function registrableEthParent(normalizedName: string): string | null {
  const labels = normalizedName.split('.');
  const ethIdx = labels.indexOf('eth');
  if (ethIdx < 2) return null;
  return `${labels[ethIdx - 1]}.eth`;
}

function applyParentExpiry(records: EnsDomainRecord[]): EnsDomainRecord[] {
  const expiryByEthName = new Map<string, number>();
  for (const row of records) {
    if (!row.expiryDate) continue;
    if (row.normalizedName.endsWith('.eth') && !row.isSubdomain) {
      expiryByEthName.set(row.normalizedName.toLowerCase(), row.expiryDate);
    }
  }

  return records.map(row => {
    if (row.expiryDate || !row.isSubdomain) return row;
    const parent = registrableEthParent(row.normalizedName);
    if (!parent) return row;
    const parentExpiry = expiryByEthName.get(parent.toLowerCase());
    if (!parentExpiry) return row;
    return {
      ...row,
      expiryDate: parentExpiry,
      expiryInheritedFrom: parent,
    };
  });
}

/** List ENS names for `ownerAddress` (subgraph discovery; on-chain records load lazily). */
export async function fetchEnsPortfolio(
  ownerAddress: string,
  opts?: { theGraphApiKey?: string },
): Promise<EnsDomainRecord[]> {
  const address = getAddress(ownerAddress.trim());
  const baseRows = await fetchEnsDomainsFromSubgraph(address, opts);

  const ethParents = baseRows.filter(r => r.name.endsWith('.eth')).map(r => r.name);
  let subdomainRows: SubgraphDomainRow[] = [];
  try {
    subdomainRows = await fetchManagedSubdomains(ethParents, address, opts);
  } catch {
    // optional enrichment
  }

  const merged = new Map<string, SubgraphDomainRow>();
  for (const row of [...baseRows, ...subdomainRows]) {
    merged.set(row.name.toLowerCase(), row);
  }

  const records: EnsDomainRecord[] = [];
  for (const row of merged.values()) {
    try {
      records.push(subgraphRowToRecord(row));
    } catch {
      // Skip names that fail normalization
    }
  }
  const withExpiry = applyParentExpiry(records);
  return withExpiry.sort((a, b) => {
    const aExp = a.expiryDate ?? 0;
    const bExp = b.expiryDate ?? 0;
    if (aExp !== bExp) return bExp - aExp;
    return a.name.localeCompare(b.name);
  });
}

export async function checkEthNameAvailable(label: string): Promise<boolean> {
  const name = label.replace(/\.eth$/i, '').trim().toLowerCase();
  if (!name || !/^[a-z0-9-]+$/.test(name)) return false;
  return withMainnetFallback(async rpc => {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpc, { timeout: RPC_TIMEOUT_MS }),
    });
    return client.readContract({
      address: ETH_REGISTRAR_CONTROLLER,
      abi: ETH_REGISTRAR_CONTROLLER_ABI,
      functionName: 'available',
      args: [name],
    });
  });
}

export async function fetchRegistrationPriceEth(
  label: string,
  durationSeconds = ONE_YEAR_SECONDS,
): Promise<{ wei: bigint; eth: string }> {
  const name = label.replace(/\.eth$/i, '').trim().toLowerCase();
  const wei = await withMainnetFallback(async rpc => {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpc, { timeout: RPC_TIMEOUT_MS }),
    });
    return client.readContract({
      address: ETH_REGISTRAR_CONTROLLER,
      abi: ETH_REGISTRAR_CONTROLLER_ABI,
      functionName: 'rentPrice',
      args: [name, durationSeconds],
    });
  });
  const eth = (Number(wei) / 1e18).toFixed(4);
  return { wei, eth };
}

export async function fetchRenewPriceEth(
  label: string,
  durationSeconds = ONE_YEAR_SECONDS,
): Promise<{ wei: bigint; eth: string }> {
  return fetchRegistrationPriceEth(label, durationSeconds);
}

function randomSecret(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${[...bytes].map(b => b.toString(16).padStart(2, '0')).join('')}` as Hex;
}

export async function commitEthNameRegistration(params: {
  label: string;
  owner: Address;
  durationSeconds?: bigint;
}): Promise<{ txHash: string; secret: Hex; commitment: Hex }> {
  const name = params.label.replace(/\.eth$/i, '').trim().toLowerCase();
  const duration = params.durationSeconds ?? ONE_YEAR_SECONDS;
  const secret = randomSecret();
  const owner = getAddress(params.owner);

  const commitment = await withMainnetFallback(async rpc => {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpc, { timeout: RPC_TIMEOUT_MS }),
    });
    return client.readContract({
      address: ETH_REGISTRAR_CONTROLLER,
      abi: ETH_REGISTRAR_CONTROLLER_ABI,
      functionName: 'makeCommitment',
      args: [name, owner, duration, secret, ENS_PUBLIC_RESOLVER, [], false, 0],
    });
  });

  const data = encodeFunctionData({
    abi: ETH_REGISTRAR_CONTROLLER_ABI,
    functionName: 'commit',
    args: [commitment],
  });

  const txHash = await sendTransactionRequest(DEFAULT_CHAIN_ID, {
    to: ETH_REGISTRAR_CONTROLLER,
    data,
    value: '0x0',
    gasLimit: String(ENS_GAS.commit),
  });

  return { txHash, secret, commitment };
}

export async function registerEthName(params: {
  label: string;
  owner: Address;
  secret: Hex;
  durationSeconds?: bigint;
  rentWei: bigint;
}): Promise<string> {
  const name = params.label.replace(/\.eth$/i, '').trim().toLowerCase();
  const duration = params.durationSeconds ?? ONE_YEAR_SECONDS;
  const owner = getAddress(params.owner);

  const data = encodeFunctionData({
    abi: ETH_REGISTRAR_CONTROLLER_ABI,
    functionName: 'register',
    args: [name, owner, duration, params.secret, ENS_PUBLIC_RESOLVER, [], false, 0],
  });

  return sendTransactionRequest(DEFAULT_CHAIN_ID, {
    to: ETH_REGISTRAR_CONTROLLER,
    data,
    value: `0x${params.rentWei.toString(16)}`,
    gasLimit: String(ENS_GAS.register),
  });
}

export async function renewEthName(params: {
  label: string;
  durationSeconds?: bigint;
  rentWei: bigint;
}): Promise<string> {
  const name = params.label.replace(/\.eth$/i, '').trim().toLowerCase();
  const duration = params.durationSeconds ?? ONE_YEAR_SECONDS;

  const data = encodeFunctionData({
    abi: ETH_REGISTRAR_CONTROLLER_ABI,
    functionName: 'renew',
    args: [name, duration],
  });

  return sendTransactionRequest(DEFAULT_CHAIN_ID, {
    to: ETH_REGISTRAR_CONTROLLER,
    data,
    value: `0x${params.rentWei.toString(16)}`,
    gasLimit: String(ENS_GAS.renew),
  });
}

export async function setDomainContentHash(params: {
  name: string;
  contentHash: Hex;
}): Promise<string> {
  const normalized = normalize(params.name);
  const node = namehash(normalized);

  let resolver = await readResolverAddress(normalized);
  if (!resolver) {
    const client = getMainnetClient();
    resolver = await getEnsResolver(client, { name: normalized });
  }
  if (!resolver) throw new Error('No resolver set for this name.');

  const data = encodeFunctionData({
    abi: ENS_RESOLVER_ABI,
    functionName: 'setContenthash',
    args: [node, params.contentHash],
  });

  return sendTransactionRequest(DEFAULT_CHAIN_ID, {
    to: resolver,
    data,
    value: '0x0',
    gasLimit: String(ENS_GAS.setContenthash),
  });
}

export async function setDomainUrlText(params: {
  name: string;
  url: string;
}): Promise<string> {
  const normalized = normalize(params.name);
  const node = namehash(normalized);
  const resolver = await readResolverAddress(normalized);
  if (!resolver) throw new Error('No resolver set for this name.');

  const data = encodeFunctionData({
    abi: ENS_RESOLVER_ABI,
    functionName: 'setText',
    args: [node, 'url', params.url.trim()],
  });

  return sendTransactionRequest(DEFAULT_CHAIN_ID, {
    to: resolver,
    data,
    value: '0x0',
    gasLimit: String(ENS_GAS.setText),
  });
}

export function formatEnsExpiry(expiryDate: number | null): string {
  if (!expiryDate) return '—';
  const ms = expiryDate * 1000;
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ensNameExpiresSoon(expiryDate: number | null, withinDays = 90): boolean {
  if (!expiryDate) return false;
  const ms = expiryDate * 1000;
  return ms - Date.now() < withinDays * 24 * 60 * 60 * 1000;
}
