import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';

/**
 * Own overlay (dialog / side sheet): the project Sheet and Dialog read the project i18n, which does not run in
 * the lab (same reason as finance-currencies v2). The port uses the real Sheet and Dialog.
 * Focus goes in, Tab stays inside, Esc closes, focus returns to the opener.
 */
export function Overlay({
  open,
  onClose,
  title,
  description,
  placement = 'end',
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  placement?: 'end' | 'start' | 'center';
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const rtl = useLocale() === 'ar';
  const t = useT(messages);
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key !== 'Tab' || !node) return;
      const focusable = [...node.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(
        (el) => !el.hasAttribute('disabled'),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      opener.current?.focus?.();
    };
  }, [open, onClose]);

  const d = reduce ? 0 : 0.22;
  // "end" slides in from the end edge: right in LTR, left in RTL.
  const fromX = placement === 'center' ? 0 : (placement === 'end' ? 1 : -1) * (rtl ? -1 : 1) * 48;
  const pos =
    placement === 'center'
      ? 'inset-0 m-auto h-fit max-h-[92dvh] w-[min(30rem,calc(100vw-2rem))] rounded-2xl'
      : cn('inset-y-0 w-[min(26rem,100vw)] rounded-none', placement === 'end' ? 'end-0 border-s' : 'start-0 border-e');

  // Portal: the header sits in a blurred sticky wrapper, and backdrop-filter would trap a fixed overlay inside it.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: d }}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ opacity: 0, x: fromX, y: placement === 'center' ? 12 : 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: fromX, y: placement === 'center' ? 12 : 0 }}
            transition={{ duration: d, ease: 'easeOut' }}
            className={cn('absolute flex flex-col overflow-hidden border bg-popover text-popover-foreground shadow-2xl outline-none', pos, className)}
          >
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-15 font-bold">{title}</h2>
                {description && <p className="mt-0.5 text-12 text-muted-foreground">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.close}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:size-9"
              >
                <X className="size-4.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
