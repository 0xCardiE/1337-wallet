import {
  hashDomain,
  hashStruct,
  type Hex,
  type TypedData,
  type TypedDataDomain,
} from 'viem';

export type Eip712Field = { name: string; type: string };

export type Eip712Payload = {
  domain: Record<string, unknown>;
  types: Record<string, Eip712Field[]>;
  primaryType: string;
  message: Record<string, unknown>;
};

function inferEip712DomainFields(domain: Record<string, unknown>): Eip712Field[] {
  const fields: Eip712Field[] = [];
  if (domain.name !== undefined) fields.push({ name: 'name', type: 'string' });
  if (domain.version !== undefined) fields.push({ name: 'version', type: 'string' });
  if (domain.chainId !== undefined) fields.push({ name: 'chainId', type: 'uint256' });
  if (domain.verifyingContract !== undefined) {
    fields.push({ name: 'verifyingContract', type: 'address' });
  }
  if (domain.salt !== undefined) fields.push({ name: 'salt', type: 'bytes32' });
  return fields;
}

/** Dapps (Uniswap Permit2) often omit `EIP712Domain`. Trezor Connect requires it. */
export function ensureEip712DomainType(typed: Eip712Payload): Eip712Payload {
  const domain = { ...typed.domain };
  if (typeof domain.chainId === 'string') {
    domain.chainId = domain.chainId.startsWith('0x')
      ? Number.parseInt(domain.chainId, 16)
      : Number(domain.chainId);
  }
  const types = { ...typed.types };
  if (!types.EIP712Domain?.length) {
    types.EIP712Domain = inferEip712DomainFields(domain);
  }
  return {
    domain,
    types,
    primaryType: typed.primaryType,
    message: typed.message,
  };
}

/**
 * Trezor One (T1B1) can only blind-sign EIP-712 hashes. Connect's T1 schema
 * requires `domain_separator_hash` (+ `message_hash` unless primaryType is
 * EIP712Domain). Passing them is also valid for T / Safe models, which still
 * display the full structured data.
 */
export function prepareTrezorTypedData(typed: Eip712Payload): {
  data: Eip712Payload;
  domain_separator_hash: Hex;
  message_hash?: Hex;
} {
  const data = ensureEip712DomainType(typed);
  const types = data.types as TypedData;
  try {
    const domain_separator_hash = hashDomain({
      domain: data.domain as TypedDataDomain,
      types,
    });
    if (data.primaryType === 'EIP712Domain') {
      return { data, domain_separator_hash };
    }
    return {
      data,
      domain_separator_hash,
      message_hash: hashStruct({
        data: data.message,
        primaryType: data.primaryType as keyof typeof types,
        types,
      }),
    };
  } catch (err) {
    throw new Error(
      `Could not hash typed data for Trezor: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
