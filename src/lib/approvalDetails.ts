import {
  decodeFunctionData,
  formatEther,
  formatGwei,
  getAddress,
  isAddress,
  isHex,
  type Hex,
} from 'viem';
import { chainById } from './chainCatalog';
import { bytesToHexMessage, parseTypedDataParam } from './backgroundSign';
import type { ProviderRequest } from '../provider/types';
import { classifyRequest, parseDomainChainId, type TxRiskReport } from './txRisk';
import { siweCheckFailed } from './siwe';
import type { TxAction } from './txAction';

export type ApprovalDetailField = {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  warn?: boolean;
};

export type ApprovalDetailSection = {
  id: string;
  title: string;
  fields: ApprovalDetailField[];
  defaultOpen?: boolean;
};

export type TxGasPreview = {
  estimatedGas?: string;
  pendingNonce?: string;
  suggestedGasPrice?: string;
  isContract?: boolean;
  error?: string;
};

const KNOWN_SELECTORS: Record<string, string> = {
  '0xa9059cbb': 'transfer(address,uint256)',
  '0x095ea7b3': 'approve(address,uint256)',
  '0x39509351': 'increaseAllowance(address,uint256)',
  '0xa22cb465': 'setApprovalForAll(address,bool)',
  '0x23b872dd': 'transferFrom(address,address,uint256)',
  '0x42842e0e': 'safeTransferFrom(address,address,uint256)',
  '0xb88d4fde': 'safeTransferFrom(address,address,uint256,bytes)',
  '0x3593564c': 'execute(bytes,bytes[],uint256)',
  '0x5ae401dc': 'multicall(uint256,bytes[])',
  '0xac9650d8': 'multicall(bytes[])',
  '0x1f0464d1': 'multicall(bytes32,bytes[])',
  '0x82ad56cb': 'aggregate3((address,bool,bytes)[])',
  '0xe63d38ed': 'disperseEther(address[],uint256[])',
  '0xc73a2d60': 'disperseToken(address,address[],uint256[])',
  '0x51ba162c': 'disperseTokenSimple(address,address[],uint256[])',
  '0x26307668': 'deployCreate2(bytes32,bytes)',
};

const DECODE_ABIS = [
  {
    name: 'ERC20',
    abi: [
      {
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        name: 'transfer',
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        name: 'approve',
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'addedValue', type: 'uint256' },
        ],
        name: 'increaseAllowance',
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        name: 'transferFrom',
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ] as const,
  },
  {
    name: 'Disperse',
    abi: [
      {
        inputs: [
          { name: 'recipients', type: 'address[]' },
          { name: 'values', type: 'uint256[]' },
        ],
        name: 'disperseEther',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'token', type: 'address' },
          { name: 'recipients', type: 'address[]' },
          { name: 'values', type: 'uint256[]' },
        ],
        name: 'disperseToken',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ] as const,
  },
] as const;

function field(
  label: string,
  value: string,
  opts?: { mono?: boolean; copyable?: boolean; warn?: boolean },
): ApprovalDetailField {
  return { label, value, ...opts };
}

function hexBigInt(v: unknown): bigint | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.floor(v));
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s) return undefined;
  try {
    return BigInt(s.startsWith('0x') ? s : s);
  } catch {
    return undefined;
  }
}

function formatNative(value: bigint | undefined, chainId: number): string {
  const sym = chainById(chainId)?.nativeCurrency.symbol ?? 'ETH';
  if (value == null) return `0 ${sym}`;
  try {
    return `${formatEther(value)} ${sym}`;
  } catch {
    return `${value.toString()} wei`;
  }
}

function formatGasHex(v: unknown): string | undefined {
  const n = hexBigInt(v);
  if (n == null) return undefined;
  return n.toString();
}

function formatGweiHex(v: unknown): string | undefined {
  const n = hexBigInt(v);
  if (n == null) return undefined;
  return `${formatGwei(n)} gwei`;
}

export function selectorFromData(data: unknown): string | undefined {
  if (typeof data !== 'string' || !isHex(data) || data.length < 10) return undefined;
  return data.slice(0, 10).toLowerCase();
}

export function needsFunctionSignatureLookup(request: ProviderRequest): boolean {
  if (request.method !== 'eth_sendTransaction') return false;
  const tx = (request.params?.[0] ?? {}) as Record<string, unknown>;
  const data = typeof tx.data === 'string' ? tx.data : undefined;
  if (!data || data.length <= 10) return false;
  const selector = selectorFromData(data);
  if (!selector) return false;
  if (decodeCalldata(data)) return false;
  if (KNOWN_SELECTORS[selector]) return false;
  return true;
}

function decodeCalldata(data: string): string | undefined {
  for (const { name, abi } of DECODE_ABIS) {
    try {
      const decoded = decodeFunctionData({ abi, data: data as Hex });
      const args = decoded.args
        ?.map(a => (typeof a === 'bigint' ? a.toString() : String(a)))
        .join(', ');
      return `${name}.${decoded.functionName}(${args ?? ''})`;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

function messageFields(method: string, params: unknown[]): ApprovalDetailField[] {
  const msgParam = method === 'personal_sign' ? params[0] : params[1];
  const addrParam = method === 'personal_sign' ? params[1] : params[0];
  const fields: ApprovalDetailField[] = [];

  if (typeof addrParam === 'string' && isAddress(addrParam)) {
    fields.push(field('Signing address', getAddress(addrParam), { mono: true, copyable: true }));
  }

  if (typeof msgParam === 'string') {
    if (msgParam.startsWith('0x')) {
      fields.push(field('Raw hex', msgParam, { mono: true, copyable: true }));
      fields.push(field('Byte length', String((msgParam.length - 2) / 2)));
      try {
        const decoded = bytesToHexMessage(msgParam);
        if (typeof decoded === 'string') {
          fields.push(field('Decoded text', decoded));
        } else {
          fields.push(field('Decoded text', new TextDecoder().decode(decoded)));
        }
      } catch {
        fields.push(field('Decoded text', '(not valid UTF-8)'));
      }
    } else {
      fields.push(field('Message', msgParam));
    }
  } else {
    fields.push(field('Message', JSON.stringify(msgParam)));
  }

  return fields;
}

function typedDataSections(
  params: unknown[],
  method: string,
  walletChainId?: number,
): ApprovalDetailSection[] {
  let typedRaw = params[1] ?? params[0];
  if (method === 'eth_signTypedData_v3' || method === 'eth_signTypedData_v4') {
    typedRaw = params[1];
  }

  try {
    const typed = parseTypedDataParam(typedRaw);
    const domainFields: ApprovalDetailField[] = [];
    for (const [k, v] of Object.entries(typed.domain)) {
      if (v == null || v === '') continue;
      const isChain = k === 'chainId';
      const domainChain = isChain ? parseDomainChainId(v) : null;
      const chainMismatch =
        isChain && domainChain != null && walletChainId != null && domainChain !== walletChainId;
      domainFields.push(
        field(k, String(v), {
          mono: typeof v === 'string' && k.includes('Contract'),
          warn: chainMismatch,
        }),
      );
    }

    const messageFieldsList: ApprovalDetailField[] = [];
    for (const [k, v] of Object.entries(typed.message)) {
      messageFieldsList.push(field(k, typeof v === 'object' ? JSON.stringify(v) : String(v), { mono: true }));
    }

    const typeFields: ApprovalDetailField[] = Object.entries(typed.types)
      .filter(([name]) => name !== 'EIP712Domain')
      .flatMap(([name, defs]) =>
        defs.map(d => field(name, `${d.name}: ${d.type}`, { mono: true })),
      );

    const domainChainId = parseDomainChainId(typed.domain.chainId);
    const domainHasChainId = typed.domain.chainId !== undefined && typed.domain.chainId !== '';
    const missingChain = !domainHasChainId || domainChainId == null;
    const chainMismatch =
      !missingChain && domainChainId != null && walletChainId != null && domainChainId !== walletChainId;
    const walletChainName = walletChainId != null ? chainById(walletChainId)?.name : undefined;
    const typedChainName = domainChainId != null ? chainById(domainChainId)?.name : undefined;

    return [
      ...(missingChain
        ? [
            {
              id: 'typed-chain-warn',
              title: 'Missing chain ID',
              defaultOpen: true,
              fields: [
                field(
                  'Replay risk',
                  'domain.chainId is omitted, so this signature can be reused on any network.',
                  { warn: true },
                ),
                ...(walletChainId != null
                  ? [
                      field(
                        'Wallet chain',
                        walletChainName
                          ? `${walletChainName} (${walletChainId})`
                          : String(walletChainId),
                        { warn: true },
                      ),
                    ]
                  : []),
              ],
            },
          ]
        : []),
      ...(chainMismatch
        ? [
            {
              id: 'typed-chain-warn',
              title: 'Chain ID mismatch',
              defaultOpen: true,
              fields: [
                field(
                  'Typed data chain',
                  typedChainName
                    ? `${typedChainName} (${domainChainId})`
                    : String(domainChainId),
                  { warn: true },
                ),
                field(
                  'Wallet chain',
                  walletChainName
                    ? `${walletChainName} (${walletChainId})`
                    : String(walletChainId),
                  { warn: true },
                ),
              ],
            },
          ]
        : []),
      {
        id: 'typed-overview',
        title: 'Typed data',
        defaultOpen: true,
        fields: [
          field('Method', method, { mono: true }),
          field('Primary type', typed.primaryType, { mono: true }),
        ],
      },
      ...(domainFields.length
        ? [{ id: 'typed-domain', title: 'Domain', defaultOpen: true, fields: domainFields }]
        : []),
      ...(messageFieldsList.length
        ? [{ id: 'typed-message', title: 'Message fields', defaultOpen: true, fields: messageFieldsList }]
        : []),
      ...(typeFields.length
        ? [{ id: 'typed-types', title: 'Type definitions', fields: typeFields }]
        : []),
      {
        id: 'typed-raw',
        title: 'Raw JSON',
        fields: [
          field(
            'Payload',
            JSON.stringify(typedRaw, null, 2),
            { mono: true, copyable: true },
          ),
        ],
      },
    ];
  } catch {
    return [
      {
        id: 'typed-raw',
        title: 'Typed data',
        defaultOpen: true,
        fields: [field('Payload', String(typedRaw), { mono: true, copyable: true })],
      },
    ];
  }
}

function transactionSections(
  request: ProviderRequest,
  chainId: number,
  walletAddress?: string,
): ApprovalDetailSection[] {
  const tx = (request.params?.[0] ?? {}) as Record<string, unknown>;
  const value = hexBigInt(tx.value) ?? 0n;
  const data = typeof tx.data === 'string' ? tx.data : undefined;
  const selector = data ? selectorFromData(data) : undefined;
  const decoded = data && data.length > 10 ? decodeCalldata(data) : undefined;
  const knownFn = selector ? KNOWN_SELECTORS[selector] : undefined;

  const overview: ApprovalDetailField[] = [
    field('RPC method', request.method, { mono: true }),
    field('Chain ID', String(chainId)),
  ];

  const from =
    typeof tx.from === 'string' && isAddress(tx.from)
      ? getAddress(tx.from)
      : walletAddress
        ? getAddress(walletAddress)
        : undefined;
  if (from) overview.push(field('From', from, { mono: true, copyable: true }));

  if (typeof tx.to === 'string' && isAddress(tx.to)) {
    overview.push(field('To', getAddress(tx.to), { mono: true, copyable: true }));
  } else if (tx.to == null || tx.to === '') {
    overview.push(field('To', '(contract creation)', { warn: true }));
  } else {
    overview.push(field('To', String(tx.to ?? '—'), { mono: true }));
  }

  overview.push(field('Value', formatNative(value, chainId)));
  if (value === 0n) {
    overview.push(field('Native transfer', 'No — contract call or empty value'));
  }

  if (selector) {
    overview.push(
      field('Selector', selector, { mono: true, copyable: true }),
      field('Likely function', decoded ?? knownFn ?? 'Unknown — inspect calldata', {
        mono: !!decoded,
        warn: !decoded && !knownFn,
      }),
    );
  } else if (data && data !== '0x') {
    overview.push(field('Calldata', 'Non-standard or empty selector'));
  } else {
    overview.push(field('Calldata', 'None (plain native transfer)'));
  }

  const gasFields: ApprovalDetailField[] = [];
  const gasLimit = formatGasHex(tx.gas ?? tx.gasLimit);
  const maxFee = formatGweiHex(tx.maxFeePerGas);
  const maxPrio = formatGweiHex(tx.maxPriorityFeePerGas);
  const gasPrice = formatGweiHex(tx.gasPrice);

  if (gasLimit) gasFields.push(field('Gas limit (requested)', gasLimit));
  if (maxFee) gasFields.push(field('Max fee per gas', maxFee, { mono: true }));
  if (maxPrio) gasFields.push(field('Max priority fee', maxPrio, { mono: true }));
  if (gasPrice) gasFields.push(field('Gas price (legacy)', gasPrice, { mono: true }));

  if (maxFee) {
    gasFields.push(field('Tx type', 'EIP-1559 (type 2)'));
  } else if (gasPrice) {
    gasFields.push(field('Tx type', 'Legacy (type 0)'));
  } else {
    gasFields.push(field('Tx type', 'Auto — signer will use EIP-1559 defaults'));
  }

  const nonce = formatGasHex(tx.nonce);
  if (nonce) gasFields.push(field('Nonce (requested)', nonce));

  if (typeof tx.chainId !== 'undefined') {
    gasFields.push(field('Tx chainId field', String(tx.chainId), { mono: true }));
  }

  const calldataFields: ApprovalDetailField[] = [];
  if (data && data.length > 2) {
    calldataFields.push(
      field('Length', `${(data.length - 2) / 2} bytes`),
      field('Full calldata', data, { mono: true, copyable: true }),
    );
    if (decoded) {
      calldataFields.push(field('Decoded call', decoded, { mono: true }));
    }
  } else {
    calldataFields.push(field('Calldata', '0x'));
  }

  const rawFields: ApprovalDetailField[] = [
    field('Request params', JSON.stringify(request.params, null, 2), {
      mono: true,
      copyable: true,
    }),
  ];

  return [
    { id: 'tx-overview', title: 'Overview', defaultOpen: true, fields: overview },
    { id: 'tx-gas', title: 'Gas & nonce', defaultOpen: true, fields: gasFields },
    { id: 'tx-calldata', title: 'Calldata', defaultOpen: false, fields: calldataFields },
    { id: 'tx-raw', title: 'Raw request', defaultOpen: false, fields: rawFields },
  ];
}

export function buildApprovalDetailSections(
  request: ProviderRequest,
  chainId: number,
  walletAddress?: string,
  origin?: string,
): ApprovalDetailSection[] {
  const { method, params = [] } = request;

  if (method === 'eth_sendTransaction') {
    return transactionSections(request, chainId, walletAddress);
  }

  if (method === 'personal_sign') {
    const risk = classifyRequest(request, { chainId, origin });
    const siwe = risk.siwe;
    const sections: ApprovalDetailSection[] = [];
    if (siwe) {
      const mismatch = siweCheckFailed(siwe);
      sections.push({
        id: 'siwe',
        title: mismatch ? 'Sign-In with Ethereum — mismatch' : 'Sign-In with Ethereum',
        defaultOpen: true,
        fields: [
          field('Claimed domain', siwe.domain, { mono: true, warn: siwe.domainMismatch }),
          ...(origin
            ? [field('Page origin', origin, { mono: true, warn: siwe.domainMismatch })]
            : []),
          ...(siwe.uri
            ? [field('URI', siwe.uri, { mono: true, warn: siwe.uriMismatch })]
            : []),
          ...(siwe.chainId != null
            ? [
                field(
                  'SIWE chain ID',
                  `${siwe.chainId}${siwe.chainMismatch ? ` (wallet is ${chainId})` : ''}`,
                  { warn: siwe.chainMismatch },
                ),
              ]
            : []),
          ...(siwe.address
            ? [
                field('Account', siwe.address, {
                  mono: true,
                  copyable: true,
                  warn: siwe.addressMismatch,
                }),
              ]
            : []),
        ],
      });
    }
    sections.push(
      {
        id: 'msg',
        title: 'Message',
        defaultOpen: !siwe,
        fields: [
          field('Method', method, { mono: true }),
          ...messageFields(method, params),
        ],
      },
      {
        id: 'msg-raw',
        title: 'Raw request',
        fields: [
          field('Params', JSON.stringify(params, null, 2), { mono: true, copyable: true }),
        ],
      },
    );
    return sections;
  }

  return typedDataSections(params, method, chainId);
}

export type FunctionSignatureLookup =
  | { status: 'loading' }
  | { status: 'done'; signatures: string[] };

export function resolveLikelyFunctionSignature(
  request: ProviderRequest,
  sigLookup: FunctionSignatureLookup | null,
): string | undefined {
  if (request.method !== 'eth_sendTransaction') return undefined;
  const tx = (request.params?.[0] ?? {}) as Record<string, unknown>;
  const data = typeof tx.data === 'string' ? tx.data : undefined;
  if (!data || data.length <= 10) return undefined;

  const decoded = decodeCalldata(data);
  const selector = selectorFromData(data);
  if (selector && KNOWN_SELECTORS[selector]) return KNOWN_SELECTORS[selector];

  if (sigLookup?.status === 'done' && sigLookup.signatures[0]) {
    return sigLookup.signatures[0];
  }

  return decoded;
}

export function txContractAddress(request: ProviderRequest): `0x${string}` | undefined {
  if (request.method !== 'eth_sendTransaction') return undefined;
  const tx = (request.params?.[0] ?? {}) as Record<string, unknown>;
  if (typeof tx.to !== 'string' || !isAddress(tx.to)) return undefined;
  return getAddress(tx.to);
}

export function mergeFunctionSignatureLookup(
  sections: ApprovalDetailSection[],
  lookup: FunctionSignatureLookup | null,
): ApprovalDetailSection[] {
  if (!lookup) return sections;

  const overview = sections.find(s => s.id === 'tx-overview');
  if (!overview) return sections;

  const likelyIdx = overview.fields.findIndex(f => f.label === 'Likely function');
  if (likelyIdx === -1) return sections;

  const current = overview.fields[likelyIdx];
  if (current.mono) return sections;

  if (lookup.status === 'loading') {
    const fields = [...overview.fields];
    fields[likelyIdx] = { ...current, value: 'Looking up 4byte.directory…', warn: false };
    return sections.map(s => (s.id === 'tx-overview' ? { ...s, fields } : s));
  }

  if (lookup.signatures.length === 0) return sections;

  const fields = [...overview.fields];
  fields[likelyIdx] = {
    ...current,
    value: lookup.signatures[0],
    mono: true,
    warn: false,
  };

  if (lookup.signatures.length > 1) {
    fields.splice(
      likelyIdx + 1,
      0,
      field('Other signatures (4byte.directory)', lookup.signatures.slice(1).join(', '), {
        mono: true,
      }),
    );
  }

  return sections.map(s => (s.id === 'tx-overview' ? { ...s, fields } : s));
}

export function mergeGasPreview(
  sections: ApprovalDetailSection[],
  preview: TxGasPreview,
  chainId: number,
): ApprovalDetailSection[] {
  const sym = chainById(chainId)?.nativeCurrency.symbol ?? 'ETH';
  const gasSection = sections.find(s => s.id === 'tx-gas');
  if (!gasSection) return sections;

  const extra: ApprovalDetailField[] = [];
  if (preview.error) {
    extra.push(field('RPC preview error', preview.error, { warn: true }));
  }
  if (preview.pendingNonce != null) {
    extra.push(field('Pending nonce (RPC)', preview.pendingNonce));
  }
  if (preview.estimatedGas != null) {
    extra.push(field('Estimated gas (RPC)', preview.estimatedGas));
    const est = BigInt(preview.estimatedGas);
    const buffered = (est * 125n) / 100n;
    extra.push(field('Gas limit (signer +25%)', buffered.toString()));
  }
  if (preview.suggestedGasPrice != null) {
    extra.push(field('Current gas price (RPC)', `${formatGwei(BigInt(preview.suggestedGasPrice))} gwei`));
    if (preview.estimatedGas != null) {
      const fee = BigInt(preview.estimatedGas) * BigInt(preview.suggestedGasPrice);
      try {
        extra.push(
          field('Rough max fee (est.)', `~${formatEther(fee)} ${sym}`, { warn: true }),
        );
      } catch {
        /* ignore */
      }
    }
  }
  if (preview.isContract != null) {
    extra.push(
      field(
        'To address type',
        preview.isContract ? 'Contract (has bytecode)' : 'EOA (no bytecode)',
      ),
    );
  }

  gasSection.fields = [...gasSection.fields, ...extra];
  return sections;
}

export function approvalTitle(
  request: ProviderRequest,
  risk?: TxRiskReport,
  action?: TxAction,
): string {
  if (risk?.tokenApproval?.kind === 'setApprovalForAll') {
    return risk.tokenApproval.approved ? 'Approve operator for all NFTs' : 'Revoke NFT operator';
  }
  if (risk?.tokenApproval) {
    return risk.tokenApproval.unlimited ? 'Grant unlimited token access' : 'Grant token access';
  }
  if (risk?.permit) return 'Sign token permit';
  if (risk?.siwe) {
    const bad = siweCheckFailed(risk.siwe);
    return bad ? 'Sign-in request — check domain' : 'Sign in with Ethereum';
  }
  if (action?.kind === 'send') return action.token ? 'Send tokens' : 'Send';
  if (action?.kind === 'swap') return 'Swap';
  if (action?.kind === 'unknown') return action.creating ? 'Deploy contract' : 'Unknown contract call';
  switch (request.method) {
    case 'eth_sendTransaction':
      return 'Confirm transaction';
    case 'personal_sign':
      return 'Sign message';
    default:
      return 'Sign typed data';
  }
}
