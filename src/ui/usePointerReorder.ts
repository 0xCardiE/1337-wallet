import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { moveIndex } from '../lib/listOrder';

/**
 * Pointer-driven list reorder (mouse + touch). Bind start to a grip;
 * move/end can live on the same grip via pointer capture.
 */
export function usePointerReorder<T extends string | number>(
  items: readonly T[],
  onCommit: (next: T[]) => void,
) {
  const [draft, setDraft] = useState<T[] | null>(null);
  const draftRef = useRef<T[] | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const dragItemRef = useRef<T | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const shown = draft ?? (items as T[]);

  const autoScroll = (clientY: number) => {
    const scroller = listRef.current?.closest('.screen-body, .w1337-body');
    if (!(scroller instanceof HTMLElement)) return;
    const r = scroller.getBoundingClientRect();
    const edge = 36;
    if (clientY < r.top + edge) scroller.scrollTop -= 14;
    else if (clientY > r.bottom - edge) scroller.scrollTop += 14;
  };

  const start = useCallback(
    (index: number, e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      pointerIdRef.current = e.pointerId;
      draggingRef.current = false;
      dragItemRef.current = items[index] ?? null;
      const next = [...items];
      draftRef.current = next;
      setDraft(next);
    },
    [items],
  );

  const move = useCallback((e: ReactPointerEvent) => {
    if (pointerIdRef.current !== e.pointerId || dragItemRef.current == null) return;
    autoScroll(e.clientY);
    const ul = listRef.current;
    if (!ul) return;
    const rows = ul.querySelectorAll<HTMLElement>('[data-reorder-row]');
    let target = rows.length - 1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        target = i;
        break;
      }
    }
    const curr = draftRef.current;
    if (!curr) return;
    const from = curr.indexOf(dragItemRef.current);
    if (from < 0 || from === target) return;
    draggingRef.current = true;
    const next = moveIndex(curr, from, target);
    draftRef.current = next;
    setDraft(next);
  }, []);

  const end = useCallback(
    (e: ReactPointerEvent) => {
      if (pointerIdRef.current !== e.pointerId) return;
      pointerIdRef.current = null;
      dragItemRef.current = null;
      const didDrag = draggingRef.current;
      draggingRef.current = false;
      const curr = draftRef.current;
      draftRef.current = null;
      setDraft(null);
      if (didDrag && curr) {
        const same = curr.length === items.length && curr.every((v, i) => v === items[i]);
        if (!same) onCommit(curr);
      }
    },
    [items, onCommit],
  );

  const moveByKeyboard = useCallback(
    (index: number, delta: number) => {
      const to = index + delta;
      if (to < 0 || to >= items.length) return;
      onCommit(moveIndex(items, index, to));
    },
    [items, onCommit],
  );

  return { shown, dragging: draft != null, listRef, start, move, end, moveByKeyboard };
}
