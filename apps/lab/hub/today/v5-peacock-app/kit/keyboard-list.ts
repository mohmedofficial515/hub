import { useEffect, useId, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { openCard } from '../shell/router';
import { matchKey } from './keys';
import { shortcutsEnabled } from './preferences';

/**
 * Keyboard lists (08 §12, review B1 and M8). One list = one `useKeyboardList` call. `j` / `k` walk every visible
 * row on the page in DOM order, so several lists on one page read as one sequence.
 *
 * - `Enter` or `o` on a focused row opens it (default: `openCard(id)`).
 * - `actions` adds single-key actions on the focused row, e.g. `{ c: claim }`.
 * - When a focused row leaves the list, focus moves to the row now at its index (or the last row). An empty list
 *   sends focus to `emptyFocusRef`, usually the section heading.
 * - Single keys respect the member's shortcuts preference (WCAG 2.1.4).
 */
export interface KeyboardListOptions {
  /** Row ids in display order, usually card keys. */
  ids: string[];
  onOpen?: (id: string) => void;
  actions?: Record<string, (id: string) => void>;
  emptyFocusRef?: RefObject<HTMLElement | null>;
}

interface ListEntry {
  id: string;
  ids: string[];
  prevIds: string[];
  options: KeyboardListOptions;
  /** Where each removed row sat, so focus lands on the row that took its place. */
  removedAt: Map<string, number>;
  focusRow: (rowId: string) => void;
}

const lists = new Map<string, ListEntry>();
let pending: string | null = null;
let listenerCount = 0;

const selectRow = (listId: string, rowId: string) =>
  document.querySelector<HTMLElement>(`[data-row-list="${CSS.escape(listId)}"][data-row="${CSS.escape(rowId)}"]`);

const visibleRows = () =>
  [...document.querySelectorAll<HTMLElement>('[data-row]')].filter((row) => row.offsetParent !== null && !row.closest('[data-row-exit]'));

function focusEl(el: HTMLElement | null | undefined) {
  if (!el) return false;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest' });
  return true;
}

function focusNeighbor(list: ListEntry, removedId: string) {
  const index = list.removedAt.get(removedId) ?? 0;
  const target = list.ids[Math.min(index, list.ids.length - 1)];
  if (target !== undefined && focusEl(selectRow(list.id, target))) return;
  focusEl(list.options.emptyFocusRef?.current);
}

/**
 * Called by the card sheet on close. The opener's row may have left its list because of the action just taken;
 * then focus goes to the row that replaced it, not to `<body>`.
 */
export function restoreFocus(opener: HTMLElement | null) {
  const row = opener?.closest<HTMLElement>('[data-row]');
  if (row) {
    const list = lists.get(row.dataset.rowList ?? '');
    const id = row.dataset.row ?? '';
    if (list && !list.ids.includes(id)) {
      focusNeighbor(list, id);
      return;
    }
    // The row survived but moved (a need going to another column), so the button that opened the sheet is gone. Its row is the place.
    if (list && !opener?.isConnected && focusEl(selectRow(list.id, id))) return;
  }
  if (opener?.isConnected && opener !== document.body && opener.id !== 'main') {
    opener.focus();
    return;
  }
  // The opener is gone and was not a row: the palette, for one, which hands focus to main as it closes. The page's title is the nearest place.
  const title = document.querySelector<HTMLElement>('#main h1');
  if (title) title.focus({ preventScroll: true });
  else document.getElementById('main')?.focus({ preventScroll: true });
}

/** Ask for focus on a row, now or when it next appears (Undo brings a row back on the next render). */
export function focusRowWhenReady(rowId: string) {
  for (const list of lists.values()) {
    if (list.ids.includes(rowId) && focusEl(selectRow(list.id, rowId))) return;
  }
  pending = rowId;
}

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
  const el = e.target as HTMLElement;
  if (el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [role="grid"]')) return;
  if (!shortcutsEnabled() && !matchKey(e, 'Enter')) return;

  if (matchKey(e, 'j') || matchKey(e, 'k')) {
    const rows = visibleRows();
    if (!rows.length) return;
    const at = rows.indexOf(el.closest<HTMLElement>('[data-row]')!);
    const next = rows[at < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, at + (matchKey(e, 'j') ? 1 : -1)))];
    e.preventDefault();
    focusEl(next);
    return;
  }

  const row = el.closest<HTMLElement>('[data-row]');
  if (!row) return;
  const list = lists.get(row.dataset.rowList ?? '');
  const id = row.dataset.row;
  if (!list || !id) return;

  // Enter on a button or link inside the row keeps its own meaning. `o` always opens the row.
  if ((matchKey(e, 'Enter') && el === row) || matchKey(e, 'o')) {
    e.preventDefault();
    (list.options.onOpen ?? openCard)(id);
    return;
  }
  const key = Object.keys(list.options.actions ?? {}).find((k) => matchKey(e, k));
  if (key) {
    e.preventDefault();
    list.options.actions![key](id);
  }
}

export function useKeyboardList(options: KeyboardListOptions) {
  const listId = useId();
  const entryRef = useRef<ListEntry | null>(null);

  if (!entryRef.current) {
    entryRef.current = {
      id: listId,
      ids: options.ids,
      prevIds: options.ids,
      options,
      removedAt: new Map(),
      focusRow: (rowId) => {
        focusEl(selectRow(listId, rowId));
      },
    };
  }
  const entry = entryRef.current;
  entry.options = options;

  useEffect(() => {
    lists.set(listId, entry);
    if (listenerCount++ === 0) window.addEventListener('keydown', onKey);
    return () => {
      lists.delete(listId);
      if (--listenerCount === 0) window.removeEventListener('keydown', onKey);
    };
  }, [listId, entry]);

  const key = options.ids.join('|');
  useLayoutEffect(() => {
    const prev = entry.prevIds;
    const ids = options.ids;
    prev.forEach((rowId, index) => {
      if (!ids.includes(rowId)) entry.removedAt.set(rowId, index);
    });
    entry.prevIds = ids;
    entry.ids = ids;

    if (pending && ids.includes(pending)) {
      const target = pending;
      pending = null;
      entry.removedAt.delete(target);
      focusEl(selectRow(listId, target));
      return;
    }

    // A row that held focus is on its way out. The sheet handles its own return in `restoreFocus`.
    const active = document.activeElement as HTMLElement | null;
    if (active?.closest('[role="dialog"]')) return;
    const row = active?.closest<HTMLElement>('[data-row]');
    if (row?.dataset.rowList === listId && row.dataset.row && !ids.includes(row.dataset.row)) {
      focusNeighbor(entry, row.dataset.row);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useMemo(
    () => ({
      /** Spread on the row element. Rows are not in the Tab order; their inner link and buttons are. */
      rowProps: (id: string) => ({
        'data-row': id,
        'data-row-list': listId,
        tabIndex: -1,
      }),
      focusRow: entry.focusRow,
    }),
    [entry, listId],
  );
}
