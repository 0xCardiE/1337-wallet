/** Stable reorder helpers for chain / RPC lists. */

export function applyOrder<T extends string | number>(
  items: readonly T[],
  order: readonly T[] | undefined,
): T[] {
  if (!order?.length) return [...items];
  const pool = new Set(items);
  const out: T[] = [];
  const used = new Set<T>();
  for (const id of order) {
    if (!pool.has(id) || used.has(id)) continue;
    out.push(id);
    used.add(id);
  }
  for (const id of items) {
    if (!used.has(id)) out.push(id);
  }
  return out;
}

export function moveIndex<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to) return [...items];
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/**
 * Rebuild a mixed mainnet/testnet id list after the user reorders one kind.
 * Mainnets stay first; testnets stay after.
 */
export function mergeKindOrder(
  prev: readonly number[] | undefined,
  kindIds: readonly number[],
  otherIds: readonly number[],
  kindFirst: boolean,
): number[] {
  const others = applyOrder(otherIds, prev);
  return kindFirst ? [...kindIds, ...others] : [...others, ...kindIds];
}

export function moveToFront<T extends string | number>(list: readonly T[], id: T): T[] {
  return [id, ...list.filter(x => x !== id)];
}
