'use client';

/**
 * @file toast.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/toast.tsx. Contract: apps/web/README.md.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useSyncExternalStore } from 'react';

import { focusRing } from '@/components/cards/meta';
import { CopyButton } from '@/components/common/copy-button';
import { Button, Kbd } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import { matchKey } from '@/lib/keys';
import { shortcutsEnabled } from '@/lib/preferences';

export interface ToastOptions {
  message: ReactNode;
  /** A command to copy, rendered with CopyButton (the claim toast's `/hub:next GTV-258`). */
  cmd?: string | undefined;
  /** Shows Undo and enables the `u` shortcut. Runs once; the toast closes first. */
  onUndo?: (() => void) | undefined;
  /** One follow-up action, such as Open chat after Run now. Runs once; the toast closes first. */
  action?: { label: string; onSelect: () => void } | undefined;
  tone?: 'success' | 'error' | undefined;
  /**
   * Stays until dismissed or replaced, never on a timer. For an action one stray key can take, such as Claim, which is the first Tab stop after a
   * sheet's title (owner's choice on review m9). A toast with `tone: 'error'` is always sticky (docs/08 §5.5): a refusal is a sentence with the next
   * step, and it waits to be read.
   */
  sticky?: boolean | undefined;
}

interface ToastData extends ToastOptions {
  id: number;
}

/**
 * Two slots. `lasting` carries Undo or a command, and only another such toast replaces it. `notice` is a plain line, stacked above
 * it, so answering a blocked `c` never costs the member the Undo of what they did before (review minor).
 */
let slots: { lasting: ToastData | null; notice: ToastData | null } = { lasting: null, notice: null };
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Callable from anywhere, including outside React. */
export function showToast(options: ToastOptions) {
  const toast = { ...options, id: nextId++ };
  slots =
    options.onUndo || options.cmd || options.action
      ? { lasting: toast, notice: null }
      : { ...slots, notice: toast };
  emit();
}

/** Closes one toast by id, or both. */
export function dismissToast(id?: number) {
  slots = {
    lasting: id === undefined || slots.lasting?.id === id ? null : slots.lasting,
    notice: id === undefined || slots.notice?.id === id ? null : slots.notice,
  };
  emit();
}

const useSlots = () =>
  useSyncExternalStore(
    (n) => {
      listeners.add(n);
      return () => listeners.delete(n);
    },
    () => slots,
    () => slots,
  );

function runUndo() {
  const toast = slots.lasting;
  if (!toast?.onUndo) return false;
  dismissToast(toast.id);
  toast.onUndo();
  return true;
}

/** While a toast holds Undo it stays at least this long, and longer while focus is working a list (review B1). */
const UNDO_MS = 10_000;
const PLAIN_MS = 5_000;
const TICK = 250;

const focusInList = () => !!document.activeElement?.closest('[data-row], [data-hub-list]');

function ToastCard({ toast }: { toast: ToastData }) {
  const t = useT(kitMessages);
  const hovered = useRef(false);
  const focused = useRef(false);

  useEffect(() => {
    if (toast.sticky || toast.tone === 'error') return;
    let left = toast.onUndo || toast.cmd || toast.action ? UNDO_MS : PLAIN_MS;
    const id = window.setInterval(() => {
      if (hovered.current || focused.current) return;
      if (toast.onUndo && focusInList()) return;
      left -= TICK;
      if (left <= 0) dismissToast(toast.id);
    }, TICK);
    return () => window.clearInterval(id);
  }, [toast]);

  const Icon = toast.tone === 'error' ? TriangleAlert : CircleCheck;
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } }}
      exit={{ opacity: 0, transition: { duration: 0.14 } }}
      onMouseEnter={() => (hovered.current = true)}
      onMouseLeave={() => (hovered.current = false)}
      onFocus={() => (focused.current = true)}
      onBlur={() => (focused.current = false)}
      // A refusal interrupts a screen reader; everything else waits its turn in the polite region.
      {...(toast.tone === 'error' ? { role: 'alert' } : {})}
      className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-border bg-popover p-3.5 text-popover-foreground shadow-md sm:w-auto"
    >
      <Icon
        aria-hidden
        className={
          toast.tone === 'error'
            ? 'mt-0.5 size-5 shrink-0 text-destructive-soft-foreground'
            : 'mt-0.5 size-5 shrink-0 text-success-soft-foreground'
        }
        strokeWidth={1.75}
      />
      <div className="min-w-0 flex-1">
        <p className="text-body text-popover-foreground">{toast.message}</p>
        {(toast.cmd || toast.onUndo || toast.action) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {toast.cmd && <CopyButton text={toast.cmd} />}
            {toast.action && (
              <Button
                size="sm"
                data-toast-action
                onClick={() => {
                  dismissToast(toast.id);
                  toast.action?.onSelect();
                }}
              >
                {toast.action.label}
              </Button>
            )}
            {toast.onUndo && (
              <Button size="sm" onClick={runUndo} aria-keyshortcuts="u">
                {t.undo}
                {shortcutsEnabled() && <Kbd className="max-md:hidden">u</Kbd>}
              </Button>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label={t.dismiss}
        className={`-me-1 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:size-8 ${focusRing}`}
      >
        <X aria-hidden className="size-4" strokeWidth={1.75} />
      </button>
    </motion.div>
  );
}

/** Rendered once by the shell. Pages call `showToast`. */
export function ToastRegion() {
  const { lasting, notice } = useSlots();

  // `u` undoes while the toast is open; Ctrl/Cmd+Z too. Neither fires while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const combo = (e.ctrlKey || e.metaKey) && matchKey(e, 'z');
      const single = matchKey(e, 'u') && !e.ctrlKey && !e.metaKey && !e.altKey && shortcutsEnabled();
      if ((combo || single) && runUndo()) {
        e.preventDefault();
        return;
      }
      // Esc closes a sticky error, unless it belongs to a field or a dialog. It is not consumed, so the sheet still closes on the same press.
      if (matchKey(e, 'Escape') && slots.notice?.tone === 'error' && !el?.closest('[role="dialog"]')) {
        dismissToast(slots.notice.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // An error card is its own `role="alert"`, so it sits outside the polite region: one announcement per toast.
  const shown = [notice, lasting].filter((x): x is ToastData => x !== null);
  const isError = (x: ToastData) => x.tone === 'error';
  return (
    <div
      data-toast
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:end-6 sm:bottom-6"
    >
      <AnimatePresence>
        {shown.filter(isError).map((x) => (
          <ToastCard key={x.id} toast={x} />
        ))}
      </AnimatePresence>
      <div role="status" aria-live="polite" className="flex w-full flex-col items-end gap-2 sm:w-auto">
        <AnimatePresence>
          {shown
            .filter((x) => !isError(x))
            .map((x) => (
              <ToastCard key={x.id} toast={x} />
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
