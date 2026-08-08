/**
 * ENS domain discovery via The Graph.
 *
 * Strategy (in order):
 * 1. Legacy hosted subgraph — no API key, rate-limited but fine for personal wallets
 * 2. Decentralized gateway — when `theGraphApiKey` is set in settings
 *
 * On-chain reads (contenthash, resolver, renew/register) always use mainnet RPC separately.
 */

export const ENS_SUBGRAPH_ID = '5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH';

export const ENS_SUBGRAPH_LEGACY_URL =
  'https://api.thegraph.com/subgraphs/name/ensdomains/ens' as const;

export function ensSubgraphGatewayUrl(apiKey: string): string {
  return `https://gateway-arbitrum.network.thegraph.com/api/${apiKey.trim()}/subgraphs/id/${ENS_SUBGRAPH_ID}`;
}

export interface SubgraphDomainRow {
  name: string;
  expiryDate?: string | null;
  /** Use `address`, not `id` — subgraph ids are composite "0xResolver-0xNode". */
  resolver?: { address?: string | null } | null;
}

interface SubgraphResponse {
  data?: Record<string, unknown>;
  errors?: { message: string }[];
}

const PORTFOLIO_QUERY = `
query ensPortfolio($address: String!) {
  account(id: $address) {
    registrations(first: 500, orderBy: expiryDate, orderDirection: desc) {
      expiryDate
      domain { name resolver { address } }
    }
    wrappedDomains(first: 500, orderBy: expiryDate, orderDirection: desc) {
      expiryDate
      domain { name resolver { address } }
    }
  }
  ownerDomains: domains(where: { owner: $address }, first: 500) {
    name
    expiryDate
    resolver { address }
  }
  registrantDomains: domains(where: { registrant: $address }, first: 500) {
    name
    expiryDate
    resolver { address }
  }
  wrappedOwnerDomains: domains(where: { wrappedOwner: $address }, first: 500) {
    name
    expiryDate
    resolver { address }
  }
}
`;

function isValidEnsName(name: string): boolean {
  if (!name || !name.includes('.')) return false;
  if (name.includes('.addr.reverse')) return false;
  if (/^\[[\da-f]+\]\./i.test(name)) return false;
  return true;
}

function rowsFromAccount(data: Record<string, unknown> | undefined): SubgraphDomainRow[] {
  const account = data?.account as
    | {
        registrations?: { expiryDate?: string; domain?: SubgraphDomainRow }[];
        wrappedDomains?: { expiryDate?: string; domain?: SubgraphDomainRow }[];
      }
    | undefined;
  const out: SubgraphDomainRow[] = [];
  for (const row of account?.registrations ?? []) {
    if (row.domain?.name) {
      out.push({ ...row.domain, expiryDate: row.expiryDate ?? row.domain.expiryDate });
    }
  }
  for (const row of account?.wrappedDomains ?? []) {
    if (row.domain?.name) {
      out.push({ ...row.domain, expiryDate: row.expiryDate ?? row.domain.expiryDate });
    }
  }
  return out;
}

function rowsFromDomainList(list: unknown): SubgraphDomainRow[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (row): row is SubgraphDomainRow =>
      !!row &&
      typeof row === 'object' &&
      typeof (row as SubgraphDomainRow).name === 'string' &&
      isValidEnsName((row as SubgraphDomainRow).name),
  );
}

function mergeSubgraphRows(rows: SubgraphDomainRow[]): SubgraphDomainRow[] {
  const byName = new Map<string, SubgraphDomainRow>();
  for (const row of rows) {
    if (!isValidEnsName(row.name)) continue;
    const key = row.name.toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, row);
      continue;
    }
    const prevExp = prev.expiryDate ? Number(prev.expiryDate) : 0;
    const nextExp = row.expiryDate ? Number(row.expiryDate) : 0;
    if (nextExp >= prevExp) byName.set(key, row);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function postSubgraph(
  url: string,
  address: string,
  apiKey?: string,
): Promise<SubgraphDomainRow[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: PORTFOLIO_QUERY,
      variables: { address: address.toLowerCase() },
    }),
  });

  if (!res.ok) {
    throw new Error(`ENS subgraph HTTP ${res.status}`);
  }

  const json = (await res.json()) as SubgraphResponse;
  if (json.errors?.length) {
    throw new Error(json.errors.map(e => e.message).join('; '));
  }

  const data = json.data ?? {};
  const merged = [
    ...rowsFromAccount(data),
    ...rowsFromDomainList(data.ownerDomains),
    ...rowsFromDomainList(data.registrantDomains),
    ...rowsFromDomainList(data.wrappedOwnerDomains),
  ];
  return mergeSubgraphRows(merged);
}

/** Fetch `.eth` names and subdomains the address owns or manages. */
export async function fetchEnsDomainsFromSubgraph(
  address: string,
  opts?: { theGraphApiKey?: string },
): Promise<SubgraphDomainRow[]> {
  const key = opts?.theGraphApiKey?.trim();
  const endpoints = key
    ? [ensSubgraphGatewayUrl(key), ENS_SUBGRAPH_LEGACY_URL]
    : [ENS_SUBGRAPH_LEGACY_URL, ...(key ? [] : [])];

  let lastErr: unknown = null;
  for (const url of endpoints) {
    try {
      return await postSubgraph(url, address, key && url.includes('gateway') ? key : undefined);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error('Could not load ENS names from subgraph');
}

/** Subdomains under names the user owns (fixes beeport missing owner fields on nested query). */
export async function fetchManagedSubdomains(
  parentNames: string[],
  ownerAddress: string,
  opts?: { theGraphApiKey?: string },
): Promise<SubgraphDomainRow[]> {
  if (parentNames.length === 0) return [];

  const query = `
    query subdomains($parentNames: [String!]!, $owner: String!) {
      domains(where: { name_in: $parentNames }) {
        name
        subdomains(first: 100, where: { owner: $owner }) {
          name
          expiryDate
          resolver { address }
        }
      }
    }
  `;

  const key = opts?.theGraphApiKey?.trim();
  const url = key ? ensSubgraphGatewayUrl(key) : ENS_SUBGRAPH_LEGACY_URL;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key && url.includes('gateway')) headers.Authorization = `Bearer ${key}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      variables: {
        parentNames: parentNames.filter(n => n.endsWith('.eth')),
        owner: ownerAddress.toLowerCase(),
      },
    }),
  });

  if (!res.ok) return [];

  const json = (await res.json()) as SubgraphResponse;
  const domains = json.data?.domains as
    | { subdomains?: SubgraphDomainRow[] }[]
    | undefined;

  const out: SubgraphDomainRow[] = [];
  for (const parent of domains ?? []) {
    for (const sub of parent.subdomains ?? []) {
      if (isValidEnsName(sub.name)) out.push(sub);
    }
  }
  return mergeSubgraphRows(out);
}
