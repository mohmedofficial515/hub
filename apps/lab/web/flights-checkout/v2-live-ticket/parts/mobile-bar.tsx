import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronUp, X } from 'lucide-react';
import { cn } from '@lab/utils';
import type { T } from '../i18n';
import { Num, focusRing } from './ui';

/** Below lg: a fixed bar with the total, "Price details" and the screen's one primary button. */
export function MobileBar({
  t,
  total,
  open,
  onOpen,
  cta,
}: {
  t: T;
  total: string;
  open: boolean;
  onOpen: () => void;
  cta: ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-(--border) bg-(--card) lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn('-ms-1 flex min-h-11 min-w-0 flex-col items-start rounded-md px-1 text-start', focusRing)}
        >
          <span className="text-xl leading-7 font-bold text-(--brand-ink)">
            <Num>{total}</Num>
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-(--ink-muted)">
            {t.buttons.details}
            <ChevronUp aria-hidden className="size-4" />
          </span>
        </button>
        <div className="ms-auto min-w-0 shrink-0">{cta}</div>
      </div>
    </div>
  );
}

export function Sheet({ t, open, onClose, children }: { t: T; open: boolean; onClose: () => void; children: ReactNode }) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      trigger?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fc-v2-layer fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t.buttons.details}>
          <motion.div
            className="absolute inset-0 bg-[rgb(var(--scrim)/0.6)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-(--background) px-4 pt-3 pb-6"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span aria-hidden className="h-1 w-10 rounded-full bg-(--border-strong)" />
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className={cn('grid size-11 place-items-center rounded-full text-(--foreground) hover:bg-(--surface-2)', focusRing)}
              >
                <X aria-hidden className="size-5" />
                <span className="sr-only">{t.buttons.close}</span>
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
