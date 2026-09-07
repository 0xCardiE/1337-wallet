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
  addressMismatch: boolean;
};

const HEADER_RE =
  /^(\S+) wants you to sign in with your Ethereum account:\n(?:(0x[a-fA-F0-9]{40})\n)?/i;

const FIELD_LINE_RE = /^([A-Za-z][A-Za-z0-9 ]*):[ \t]*(.*)$/;

function fieldValueFromBlock(block: Record<string, string>, name: string): string | undefined {
  const v = block[name]?.trim();
  return v || undefined;
}

/**
 * Collect `Key: value` lines starting at `from`, stopping at the first
 * non-field line (except the EIP-4361 `Resources:` list).
 */
function parseFieldBlock(lines: string[], from: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = from; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(FIELD_LINE_RE);
    if (!m) {
      if (out.Resources !== undefined && /^- /.test(line)) continue;
      break;
    }
    const key = m[1];
    /* First occurrence in this block wins — later duplicates cannot spoof. */
    if (key in out) continue;
    out[key] = m[2].trim();
  }
  return out;
}

function blockScore(block: Record<string, string>): number {
  let n = 0;
  if (block.URI) n += 1;
  if (block.Version) n += 1;
  if (block['Chain ID']) n += 1;
  if (block.Nonce) n += 1;
  if (block['Issued At']) n += 1;
  return n;
}

/**
 * EIP-4361 fields live in a suffix starting at `URI:`, not anywhere in the
 * statement. Taking the last *most complete* URI-prefixed block stops
 * statement injection (first-match) and trailing partial spoofs.
 */
function pickSiweFieldBlock(text: string): Record<string, string> {
  const lines = text.split('\n');
  const blocks: Record<string, string>[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^URI:/i.test(lines[i])) blocks.push(parseFieldBlock(lines, i));
  }
  if (blocks.length === 0) return {};
  let best = blocks[0];
  let bestScore = blockScore(best);
  for (const block of blocks) {
    const score = blockScore(block);
    if (score >= bestScore) {
      best = block;
      bestScore = score;
    }
  }
  return best;
}

function parseSiweChainId(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = raw.startsWith('0x') ? Number.parseInt(raw, 16) : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function parseSiweMessage(raw: string): ParsedSiwe | null {
  const text = raw.replace(/\r\n/g, '\n').trim();
  const header = text.match(HEADER_RE);
  if (!header) return null;

  const domain = header[1].trim();
  if (!domain) return null;

  const fields = pickSiweFieldBlock(text);

  return {
    domain,
    address: header[2] ? header[2] : undefined,
    uri: fieldValueFromBlock(fields, 'URI'),
    version: fieldValueFromBlock(fields, 'Version'),
    chainId: parseSiweChainId(fieldValueFromBlock(fields, 'Chain ID')),
    nonce: fieldValueFromBlock(fields, 'Nonce'),
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

function addressesEqual(a?: string, b?: string): boolean {
  if (!a || !b) return true;
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
  signingAddress?: string,
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

  const addressMismatch = !addressesEqual(parsed.address, signingAddress);

  return { domainMismatch, uriMismatch, chainMismatch, addressMismatch };
}

export function siweCheckFailed(check: SiweOriginCheck): boolean {
  return check.domainMismatch || check.uriMismatch || check.chainMismatch || check.addressMismatch;
}
