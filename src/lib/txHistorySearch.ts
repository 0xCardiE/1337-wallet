import type { TxHistoryRow } from './explorerTxHistory';
import { humanizeHistoryRow } from './txHumanize';

/**
 * Extra stems so everyday words hit the human titles.
 * “approvals” → Approved token spending; “sent tokens” → transfer rows.
 */
const KEYWORD_ALIASES: Record<string, readonly string[]> = {
  approval: ['approve', 'approved', 'allowance', 'setapprovalforall'],
  approvals: ['approve', 'approved', 'allowance', 'setapprovalforall'],
  allowance: ['approve', 'approved', 'increaseallowance'],
  nft: ['nft', 'setapprovalforall', 'operator'],
  send: ['sent', 'transfer'],
  sent: ['sent', 'transfer'],
  receive: ['received'],
  received: ['received'],
  swap: ['swap', 'swapped', 'exactinput', 'exactoutput'],
  swapped: ['swap'],
  claim: ['claim', 'claimed'],
  claimed: ['claim'],
  fail: ['failed'],
  failed: ['failed'],
  error: ['failed'],
  revert: ['failed'],
  batch: ['batched', 'multicall'],
  batched: ['multicall'],
  multicall: ['batched', 'multicall'],
  bridge: ['bridged', 'bridge'],
  deposit: ['deposited', 'deposit'],
  withdraw: ['withdrew', 'withdraw'],
  disperse: ['disperse'],
};

function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean);
}

function historyRowSearchHaystack(row: TxHistoryRow, chainId: number): string {
  const { title, subtitle } = humanizeHistoryRow(row, chainId);
  return [
    title,
    subtitle,
    row.functionName,
    row.methodId,
    row.hash,
    row.from,
    row.to,
    row.success ? '' : 'failed fail error revert',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function tokenMatches(haystack: string, token: string): boolean {
  if (haystack.includes(token)) return true;
  const aliases = KEYWORD_ALIASES[token];
  return aliases ? aliases.some(alias => haystack.includes(alias)) : false;
}

export function filterHistoryRows(
  rows: TxHistoryRow[],
  query: string,
  chainId: number,
): TxHistoryRow[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return rows;
  return rows.filter(row => {
    const haystack = historyRowSearchHaystack(row, chainId);
    return tokens.every(token => tokenMatches(haystack, token));
  });
}
