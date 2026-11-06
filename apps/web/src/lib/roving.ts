'use client';

/**
 * @file roving.ts
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/roving.ts. Contract: apps/web/README.md.
 */
import { type FocusEvent, type KeyboardEvent, useRef, useState } from 'react';

import { matchKey } from '@/lib/keys';

/**
 * Roving tabindex: Tab enters the group on its selected item and leaves it with the next Tab. Arrow keys move in reading
 * direction, Home and End go to the ends, Space or Enter presses. `Segmented` and `ChipGroup` both use it (review M6).
 */
export function useRoving(activeIndex: number) {
  const [at, setAt] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const current = at ?? Math.max(0, activeIndex);
  const onKeyDown = (e: KeyboardEvent) => {
    const items = [...(root.current?.querySelectorAll<HTMLElement>('[data-roving]') ?? [])];
    const from = items.indexOf(document.activeElement as HTMLElement);
    if (from < 0) return;
    const rtl = getComputedStyle(root.current!).direction === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    const to = matchKey(e, forward)
      ? (from + 1) % items.length
      : matchKey(e, back)
        ? (from - 1 + items.length) % items.length
        : matchKey(e, 'Home')
          ? 0
          : matchKey(e, 'End')
            ? items.length - 1
            : null;
    if (to === null) return;
    e.preventDefault();
    setAt(to);
    items[to]?.focus();
  };
  return {
    root,
    groupProps: {
      onKeyDown,
      // Leaving the group forgets where the arrows were, so the next Tab comes back to the selected item.
      onBlur: (e: FocusEvent) => {
        if (!root.current?.contains(e.relatedTarget)) setAt(null);
      },
    },
    itemProps: (index: number) => ({
      'data-roving': true,
      tabIndex: index === current ? 0 : -1,
      onFocus: () => setAt(index),
    }),
  };
}
