import { describe, expect, it } from 'vitest';
import { applyOrder, mergeKindOrder, moveIndex, moveToFront } from '../../src/lib/listOrder';

describe('listOrder', () => {
  it('keeps catalog order when the user has not ranked yet', () => {
    expect(applyOrder([1, 2, 3], undefined)).toEqual([1, 2, 3]);
    expect(applyOrder([1, 2, 3], [])).toEqual([1, 2, 3]);
  });

  it('applies a partial ranking and appends new ids', () => {
    expect(applyOrder([1, 2, 3, 4], [3, 1])).toEqual([3, 1, 2, 4]);
  });

  it('drops unknown ids from the ranking', () => {
    expect(applyOrder([1, 2], [9, 2, 1, 9])).toEqual([2, 1]);
  });

  it('moves an index and is a no-op out of range', () => {
    expect(moveIndex(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveIndex(['a', 'b'], 0, 0)).toEqual(['a', 'b']);
    expect(moveIndex(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('rebuilds mixed kind order with mainnets first', () => {
    expect(mergeKindOrder([1, 11155111, 8453], [8453, 1], [11155111], true)).toEqual([
      8453, 1, 11155111,
    ]);
    expect(mergeKindOrder([1, 8453, 11155111], [11155111], [1, 8453], false)).toEqual([
      1, 8453, 11155111,
    ]);
  });

  it('pins an item to the front', () => {
    expect(moveToFront(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(moveToFront(['a', 'b'], 'z')).toEqual(['z', 'a', 'b']);
  });
});
