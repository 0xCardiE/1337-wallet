/** EIP-4361 Sign-In with Ethereum helpers. */

export type ParsedSiwe = {
  domain: string;
  address?: string;
  uri?: string;
  version?: string;
  chainId?: number;
  nonce?: string;
};

export type SiweOriginCheck = {
  domainMismatch: boolean;
  uriMismatch: boolean;
  chainMismatch: boolean;
};

const HEADER_RE =
  /^(\S+) wants you to sign in with your Ethereum account:\n(?:(0x[a-fA-F0-9]{40})\n)?/i;

function fieldValue(text: string, name: string): string | undefined {
  const re = new RegExp(`(?:^|\\n)${name}:\\s*([^\\n]+)`, 'i');
  const m = text.match(re);
  const v = m?.[1]?.trim();
  return v || undefined;
}

export function parseSiweMessage(raw: string): ParsedSiwe | null {
  const text = raw.replace(/\r\n/g, '\n').trim();
  const header = text.match(HEADER_RE);
  if (!header) return null;

  const domain = header[1].trim();
  if (!domain) return null;

  const chainRaw = fieldValue(text, 'Chain ID');
  let chainId: number | undefined;
  if (chainRaw) {
    const n = chainRaw.startsWith('0x') ? Number.parseInt(chainRaw, 16) : Number.parseInt(chainRaw, 10);
    if (Number.isFinite(n)) chainId = n;
  }

  return {
    domain,
    address: header[2] ? header[2] : undefined,
    uri: fieldValue(text, 'URI'),
    version: fieldValue(text, 'Version'),
    chainId,
    nonce: fieldValue(text, 'Nonce'),
  };
}

function parseOrigin(origin?: string): URL | null {
  if (!origin) return null;
  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

function hostEquals(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** True when the SIWE domain matches the page origin host (with or without port). */
export function siweDomainMatchesOrigin(domain: string, origin?: string): boolean {
  const url = parseOrigin(origin);
  if (!url) return true;
  return hostEquals(domain, url.host) || hostEquals(domain, url.hostname);
}

export function checkSiweAgainstOrigin(
  parsed: ParsedSiwe,
  origin: string | undefined,
  walletChainId: number,
): SiweOriginCheck {
  const url = parseOrigin(origin);
  const domainMismatch = url ? !siweDomainMatchesOrigin(parsed.domain, origin) : false;

  let uriMismatch = false;
  if (url && parsed.uri) {
    try {
      const uri = new URL(parsed.uri);
      uriMismatch = !(
        hostEquals(uri.host, url.host) ||
        hostEquals(uri.hostname, url.hostname) ||
        uri.origin === url.origin
      );
    } catch {
      uriMismatch = true;
    }
  }

  const chainMismatch =
    parsed.chainId != null && Number.isFinite(parsed.chainId) && parsed.chainId !== walletChainId;

  return { domainMismatch, uriMismatch, chainMismatch };
}
