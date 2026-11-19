'use client';

/**
 * @file drafts.ts
 * @description What a member has typed in a Settings tab and not saved yet, kept outside the tab's component. The page mounts only the
 * open tab, so a draft in `useState` died with a tab switch or any move inside the app, with no question asked (docs/08 §5.7). Here it
 * lives for the whole visit, per project and tab, until it is saved or discarded. A reload still loses it, and `useUnsavedGuard` asks first.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { useRoute } from '@/components/shell/router';

const drafts = new Map<string, unknown>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Nothing typed: no value, or an object with no keys. */
const blank = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

const keyOf = (ws: string, tab: string) => `${ws}:${tab}`;

export function readDraft<T>(ws: string, tab: string): T | undefined {
  return drafts.get(keyOf(ws, tab)) as T | undefined;
}

export function writeDraft(ws: string, tab: string, value: unknown) {
  const key = keyOf(ws, tab);
  if (blank(value)) drafts.delete(key);
  else drafts.set(key, value);
  emit();
}

/** For tests: forget every draft. */
export function clearAllDrafts() {
  drafts.clear();
  emit();
}

/**
 * `[value, set, clear]` for one tab's draft. `initial` is what the tab shows with nothing typed, and a blank value
 * (`null`, `{}`) is no draft at all, so the dot on the tab and the notice on leaving appear only for real edits.
 */
export function useDraft<T>(
  tab: string,
  initial: T,
): [T, (next: T | ((current: T) => T)) => void, () => void] {
  const { ws } = useRoute();
  const stored = useSyncExternalStore(
    subscribe,
    () => drafts.get(keyOf(ws, tab)),
    () => undefined,
  );
  const value = (stored ?? initial) as T;
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const set = useCallback(
    (next: T | ((current: T) => T)) => {
      const current = (drafts.get(keyOf(ws, tab)) ?? initialRef.current) as T;
      writeDraft(ws, tab, typeof next === 'function' ? (next as (c: T) => T)(current) : next);
    },
    [ws, tab],
  );
  const clear = useCallback(() => writeDraft(ws, tab, null), [ws, tab]);
  return [value, set, clear];
}

/** Whether a tab holds unsaved edits, for its mark on the tab strip. */
export function useHasDraft(tab: string): boolean {
  const { ws } = useRoute();
  return useSyncExternalStore(
    subscribe,
    () => drafts.has(keyOf(ws, tab)),
    () => false,
  );
}

/** Calls `onLeave` when the tab unmounts with a draft still kept, such as a tab switch, so the member knows nothing was lost or sent. */
export function useLeaveWithDraft(tab: string, onLeave: () => void) {
  const { ws } = useRoute();
  const latest = useRef(onLeave);
  latest.current = onLeave;
  useEffect(
    () => () => {
      if (drafts.has(keyOf(ws, tab))) latest.current();
    },
    [ws, tab],
  );
}
