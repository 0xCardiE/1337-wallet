import { isHex } from 'viem';

export type ContentHashKind = 'ipfs' | 'swarm' | 'unknown' | 'empty';

export interface DecodedContentHash {
  kind: ContentHashKind;
  /** Human-readable URI when known (ipfs://, bzz://, https gateway). */
  uri: string | null;
  /** Raw bytes from resolver.contenthash. */
  raw: `0x${string}` | null;
}

/** Decode ENSIP-5/7 contenthash bytes to a display URI. */
export function decodeContentHash(raw: `0x${string}` | string | null | undefined): DecodedContentHash {
  if (!raw || raw === '0x' || raw === '0x0') {
    return { kind: 'empty', uri: null, raw: null };
  }

  const hex = (raw.startsWith('0x') ? raw.slice(2) : raw).toLowerCase();
  if (!hex) return { kind: 'empty', uri: null, raw: null };

  const bytes = hex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? [];
  if (bytes.length === 0) return { kind: 'empty', uri: null, raw: `0x${hex}` as `0x${string}` };

  const proto = bytes[0];
  // IPFS: 0xe3, CIDv1 dag-pb sha2-256
  if (proto === 0xe3 && bytes.length > 4) {
    const cidHex = hex.slice(2 * (1 + (bytes[1] === 0x01 ? 4 : 1)));
    const cid = multibaseFromIpfsBytes(bytes);
    if (cid) {
      return {
        kind: 'ipfs',
        uri: `ipfs://${cid}`,
        raw: `0x${hex}` as `0x${string}`,
      };
    }
    if (cidHex.length >= 32) {
      return {
        kind: 'ipfs',
        uri: `ipfs://${cidHex}`,
        raw: `0x${hex}` as `0x${string}`,
      };
    }
  }

  // Swarm: 0xe4 per ENSIP-7 (e40101fa011b20 + 32-byte hash)
  if (proto === 0xe4 && hex.startsWith('e40101fa011b20') && hex.length >= 14 + 64) {
    const hash = hex.slice(14, 14 + 64);
    return {
      kind: 'swarm',
      uri: `bzz://${hash}`,
      raw: `0x${hex}` as `0x${string}`,
    };
  }

  return { kind: 'unknown', uri: `0x${hex}`, raw: `0x${hex}` as `0x${string}` };
}

function multibaseFromIpfsBytes(bytes: number[]): string | null {
  // e3 01 70 12 20 <32 bytes> — CIDv1 dag-pb sha2-256
  if (bytes[0] !== 0xe3) return null;
  let offset = 1;
  if (bytes[offset] === 0x01) {
    offset += 1;
    if (bytes[offset] === 0x70) offset += 1; // codec
    if (bytes[offset] === 0x12) offset += 1; // sha2-256
    if (bytes[offset] === 0x20) offset += 1; // 32 bytes
  }
  const hashBytes = bytes.slice(offset, offset + 32);
  if (hashBytes.length !== 32) return null;
  const cidHex = hashBytes.map(b => b.toString(16).padStart(2, '0')).join('');
  return `f${cidHex}`; // rough fallback; gateways accept hex refs too
}

/** Parse user input into a contenthash byte string. */
export function encodeContentHashInput(input: string): `0x${string}` {
  const raw = input.trim();
  if (!raw) throw new Error('Enter an IPFS or Swarm content URI.');

  if (raw.startsWith('ipfs://')) {
    return encodeIpfsUri(raw.slice('ipfs://'.length));
  }
  if (raw.startsWith('bzz://') || raw.startsWith('swarm://')) {
    return encodeSwarmHash(raw.replace(/^(bzz|swarm):\/\//, ''));
  }
  if (isHex(raw) && raw.length >= 66) {
    return raw as `0x${string}`;
  }
  if (/^[a-fA-F0-9]{64}$/.test(raw)) {
    return encodeSwarmHash(raw);
  }
  if (raw.startsWith('Qm') || raw.startsWith('bafy')) {
    return encodeIpfsUri(raw);
  }

  throw new Error('Use ipfs://…, bzz://…, or a 64-char Swarm hash.');
}

/** Swarm contenthash per ENSIP-7. */
export function encodeSwarmHash(reference: string): `0x${string}` {
  const clean = reference.replace(/^0x/, '');
  if (!/^[a-fA-F0-9]{64}$/.test(clean)) {
    throw new Error('Swarm hash must be 64 hex characters (32 bytes).');
  }
  return `0xe40101fa011b20${clean.toLowerCase()}` as `0x${string}`;
}

/** Minimal IPFS contenthash (CIDv1 dag-pb sha2-256) from hex multihash or CID string. */
export function encodeIpfsUri(cidOrHash: string): `0x${string}` {
  const v = cidOrHash.trim().replace(/^ipfs:\/\//, '');
  if (/^[a-fA-F0-9]{64}$/.test(v)) {
    const hash = v.toLowerCase();
    return `0xe30101701220${hash}` as `0x${string}`;
  }
  throw new Error(
    'For IPFS, paste a 64-char hex CID hash or use ipfs:// with a hash-backed CID.',
  );
}

export function contentHashGatewayUrl(decoded: DecodedContentHash): string | null {
  if (!decoded.uri) return null;
  if (decoded.kind === 'ipfs') {
    const cid = decoded.uri.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${cid}`;
  }
  if (decoded.kind === 'swarm') {
    const hash = decoded.uri.replace('bzz://', '');
    return `https://gateway.ethswarm.org/bzz/${hash}/`;
  }
  return null;
}
