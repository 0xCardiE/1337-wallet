import { getAddress, isAddress } from 'viem';
import { addressExplorerLink } from './tokenApprovals';
import { etherscanV2Get } from './etherscanV2';

type SourceRecord = {
  SourceCode: string;
  ContractName: string;
  Proxy: string;
  Implementation: string;
};

type ApiResponse = {
  status?: string;
  message?: string;
  result?: SourceRecord[] | string;
};

const sourceCache = new Map<string, SourceRecord>();

function cacheKey(chainId: number, address: string): string {
  return `${chainId}:${getAddress(address)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function functionNameFromSignature(signature: string): string | undefined {
  const trimmed = signature.trim();
  const idx = trimmed.indexOf('(');
  const name = (idx === -1 ? trimmed : trimmed.slice(0, idx)).trim();
  return name || undefined;
}

/** Flatten Etherscan single- or multi-file verified source payloads. */
export function flattenEtherscanSourceCode(raw: string): string {
  if (!raw?.trim()) return '';
  let s = raw.trim();
  if (s.startsWith('{{') && s.endsWith('}}')) {
    s = s.slice(1, -1);
  }
  if (s.startsWith('{')) {
    try {
      const parsed = JSON.parse(s) as {
        sources?: Record<string, { content?: string } | string>;
      };
      if (parsed.sources && typeof parsed.sources === 'object') {
        return Object.entries(parsed.sources)
          .map(([path, entry]) => {
            const content =
              typeof entry === 'string'
                ? entry
                : typeof entry?.content === 'string'
                  ? entry.content
                  : '';
            return `// File: ${path}\n${content}`;
          })
          .join('\n\n');
      }
    } catch {
      /* fall through to raw string */
    }
  }
  return raw;
}

/** Extract a Solidity function declaration + body by name. */
export function extractSolidityFunction(source: string, functionName: string): string | undefined {
  if (!source.trim() || !functionName.trim()) return undefined;
  const re = new RegExp(`\\bfunction\\s+${escapeRegExp(functionName)}\\s*[(<]`, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const start = match.index;
    const braceStart = source.indexOf('{', match.index + match[0].length);
    const semiEnd = source.indexOf(';', match.index + match[0].length);
    if (braceStart === -1 || (semiEnd !== -1 && semiEnd < braceStart)) continue;

    let depth = 0;
    let end = braceStart;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (depth === 0) return source.slice(start, end).trim();
  }
  return undefined;
}

function findFunctionFileHint(source: string, functionName: string): string | undefined {
  if (!source.includes('// File:')) return undefined;
  const parts = source.split(/\n(?=\/\/ File:)/);
  for (const part of parts) {
    if (part.includes(`function ${functionName}`)) {
      return part.split('\n')[0]?.trim();
    }
  }
  return undefined;
}

export async function fetchSourceRecord(
  chainId: number,
  address: string,
  explorerApiKey?: string,
): Promise<SourceRecord | null> {
  const normalized = getAddress(address);
  const key = cacheKey(chainId, normalized);
  const cached = sourceCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    chainid: String(chainId),
    module: 'contract',
    action: 'getsourcecode',
    address: normalized,
  });
  if (explorerApiKey?.trim()) params.set('apikey', explorerApiKey.trim());

  const json = (await etherscanV2Get(params)) as ApiResponse;
  if (json.status !== '1' || !Array.isArray(json.result) || !json.result[0]) {
    const msg = typeof json.result === 'string' ? json.result : json.message ?? 'No verified source';
    throw new Error(msg);
  }

  const record = json.result[0];
  sourceCache.set(key, record);
  return record;
}

export type FunctionSourceResult = {
  functionSource?: string;
  contractName?: string;
  contractAddress: string;
  explorerUrl?: string;
  sourceFileHint?: string;
  error?: string;
};

export async function fetchFunctionSourceFromExplorer(params: {
  chainId: number;
  contractAddress: string;
  functionSignature: string;
  explorerApiKey?: string;
}): Promise<FunctionSourceResult> {
  const contractAddress = getAddress(params.contractAddress);
  const functionName = functionNameFromSignature(params.functionSignature);
  const explorerUrl = addressExplorerLink(params.chainId, contractAddress);

  if (!functionName) {
    return { contractAddress, explorerUrl, error: 'Could not parse function name.' };
  }

  if (!params.explorerApiKey?.trim()) {
    return {
      contractAddress,
      explorerUrl,
      error: 'Add an Etherscan API key in Settings to load verified source.',
    };
  }

  try {
    let record = await fetchSourceRecord(
      params.chainId,
      contractAddress,
      params.explorerApiKey,
    );
    if (!record) {
      return { contractAddress, explorerUrl, error: 'Contract source not available.' };
    }

    if (
      record.Proxy === '1' &&
      isAddress(record.Implementation) &&
      record.Implementation !== '0x0000000000000000000000000000000000000000'
    ) {
      record = (await fetchSourceRecord(
        params.chainId,
        record.Implementation,
        params.explorerApiKey,
      )) ?? record;
    }

    const flat = flattenEtherscanSourceCode(record.SourceCode);
    if (!flat.trim()) {
      return {
        contractAddress,
        explorerUrl,
        contractName: record.ContractName,
        error: 'Contract is not verified on the block explorer.',
      };
    }

    const functionSource = extractSolidityFunction(flat, functionName);
    if (!functionSource) {
      return {
        contractAddress,
        explorerUrl,
        contractName: record.ContractName,
        error: `Verified source found, but function ${functionName} was not located.`,
      };
    }

    const fileHint = findFunctionFileHint(flat, functionName);

    return {
      contractAddress,
      explorerUrl,
      contractName: record.ContractName,
      functionSource,
      sourceFileHint: fileHint,
    };
  } catch (e) {
    return {
      contractAddress,
      explorerUrl,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
