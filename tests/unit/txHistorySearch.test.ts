import { describe, expect, it } from 'vitest';
import type { TxHistoryRow } from '../../src/lib/explorerTxHistory';
import { filterHistoryRows } from '../../src/lib/txHistorySearch';

const WALLET = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`;
const SPENDER = '0xFA1cD2e3a4B5c678901234567890123456789F49' as `0x${string}`;
const TOKEN = '0x5265123456789012345678901234567890128143' as `0x${string}`;

function hash(nibble: string): `0x${string}` {
  return `0x${nibble.repeat(64).slice(0, 64)}`;
}

function row(partial: Partial<TxHistoryRow> & Pick<TxHistoryRow, 'hash'>): TxHistoryRow {
  return {
    from: WALLET,
    to: TOKEN,
    value: 0n,
    timestamp: 0,
    success: true,
    direction: 'out',
    ...partial,
  };
}

const approve = row({
  hash: hash('1'),
  to: TOKEN,
  functionName: 'approve(address spender,uint256 amount)',
  methodId: '0x095ea7b3',
});

const nftApprove = row({
  hash: hash('2'),
  functionName: 'setApprovalForAll(address operator,bool approved)',
  methodId: '0xa22cb465',
});

const sentTokens = row({
  hash: hash('3'),
  to: SPENDER,
  functionName: 'transfer(address to,uint256 amount)',
  methodId: '0xa9059cbb',
});

const sentEth = row({
  hash: hash('4'),
  to: SPENDER,
  value: 10n ** 18n,
});

const claimed = row({
  hash: hash('5'),
  functionName: 'claim(uint256 index,address account,uint256 amount,bytes32[] merkleProof)',
  methodId: '0x2e7ba6ef',
});

const cooldown = row({
  hash: hash('6'),
  to: '0x9999414141414141414141414141414141414144' as `0x${string}`,
  functionName: 'cooldown()',
});

const failedApprove = row({
  hash: hash('7'),
  functionName: 'approve(address spender,uint256 amount)',
  methodId: '0x095ea7b3',
  success: false,
});

const multicall = row({
  hash: hash('8'),
  to: '0x8888f946f946f946f946f946f946f946f946f946' as `0x${string}`,
  functionName: 'multicall(bytes[] data)',
  methodId: '0x5ae401dc',
});

const ALL = [
  approve,
  nftApprove,
  sentTokens,
  sentEth,
  claimed,
  cooldown,
  failedApprove,
  multicall,
];

function titles(query: string): string[] {
  return filterHistoryRows(ALL, query, 1).map(r => r.hash);
}

describe('filterHistoryRows', () => {
  it('returns every row when the query is empty or whitespace', () => {
    expect(filterHistoryRows(ALL, '', 1)).toEqual(ALL);
    expect(filterHistoryRows(ALL, '   ', 1)).toEqual(ALL);
  });

  it('finds approvals by everyday words without matching sends', () => {
    expect(titles('approvals')).toEqual([approve.hash, nftApprove.hash, failedApprove.hash]);
    expect(titles('approve')).toEqual([approve.hash, nftApprove.hash, failedApprove.hash]);
    expect(titles('nft')).toEqual([nftApprove.hash]);
  });

  it('finds sent tokens without native ETH sends or approvals', () => {
    expect(titles('sent tokens')).toEqual([sentTokens.hash]);
    expect(titles('transfer')).toEqual([sentTokens.hash]);
  });

  it('finds native sends with sent / ETH', () => {
    expect(titles('sent ETH')).toEqual([sentEth.hash]);
  });

  it('finds claims, cooldowns, batches, and failed rows', () => {
    expect(titles('claim')).toEqual([claimed.hash]);
    expect(titles('cooldown')).toEqual([cooldown.hash]);
    expect(titles('batch')).toEqual([multicall.hash]);
    expect(titles('failed')).toEqual([failedApprove.hash]);
  });

  it('requires every word (failed approvals, not all approvals)', () => {
    expect(titles('failed approve')).toEqual([failedApprove.hash]);
  });

  it('matches hash and address fragments', () => {
    expect(titles(SPENDER.slice(0, 8))).toEqual([sentTokens.hash, sentEth.hash]);
    expect(titles(hash('3').slice(0, 10))).toEqual([sentTokens.hash]);
  });

  it('is case-insensitive', () => {
    expect(titles('APPROVALS')).toEqual(titles('approvals'));
    expect(titles('Sent Tokens')).toEqual(titles('sent tokens'));
  });
});
