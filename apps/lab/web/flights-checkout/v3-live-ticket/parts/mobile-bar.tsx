import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronUp, Clock, X } from 'lucide-react';
import { cn } from '@lab/utils';
import type { T } from '../i18n';
import { mmss } from './money';
import { Num, focusRing } from './ui';

/**
 * Below lg: a fixed bar with the price-hold timer, the total, "Price details" and the screen's one primary button.
 * The timer row is there on both steps, amber under two minutes, so the hold never runs out unseen on a phone.
 */
export function MobileBar({
  t,
  total,
  open,
  onOpen,
  cta,
  lockSeconds,
  inert,
}: {
  t: T;
  total: string;
  open: boolean;
  onOpen: () => void;
  cta: ReactNode;
  lockSeconds: number;
  inert?: boolean;
}) {
  const low = lockSeconds > 0 && lockSeconds < 120;
  return (
    <div inert={inert} className="fixed inset-x-0 bottom-0 z-20 border-t border-(--border) bg-(--card) lg:hidden">
      <div className="mx-auto max-w-3xl px-4 pt-2 pb-3">
        <p
          className={cn(
            'flex items-center gap-1.5 text-sm font-semibold',
            lockSeconds === 0 || low ? 'text-(--warning-ink)' : 'text-(--ink-muted)',
          )}
          title={t.ticket.lockHint}
        >
          <Clock aria-hidden className="size-4" />
          {lockSeconds > 0 ? (
            <span>
              {t.ticket.lockShort} <Num>{mmss(lockSeconds)}</Num>
            </span>
          ) : (
            <span>{t.ticket.lockEnded}</span>
          )}
        </p>
        <div className="mt-1 flex items-center gap-3">
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
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * A real modal: focus starts on Close and stays inside (Tab / Shift+Tab wrap), Escape closes, page scroll is locked
 * (the page behind is made inert by the caller), and focus goes back to the opener on close.
 */
export function Sheet({ t, open, onClose, children }: { t: T; open: boolean; onClose: () => void; children: ReactNode }) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // The page re-renders every second (price-hold timer); keep the effect bound to `open` only.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = panelRef.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      root.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fc-v3-layer fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t.buttons.details}>
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[rgb(var(--scrim)/0.6)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-(--background) px-4 pt-3 pb-6"
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
