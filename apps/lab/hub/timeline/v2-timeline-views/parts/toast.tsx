import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useT } from '@lab/i18n';
import { messages } from '../i18n';
import { cn, focusRing } from './atoms';

export interface ToastData {
  id: number;
  message: React.ReactNode;
  cmd?: string;
  onUndo?: () => void;
}

/** One status line at the foot of the page: what happened, Undo while it can be undone. Polite live region. */
export function ToastRegion({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  const t = useT(messages);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(onClose, 7000);
    return () => window.clearTimeout(id);
  }, [toast, onClose]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4" role="status" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
            transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
            className="pointer-events-auto flex max-w-full items-center gap-3 rounded-xl border border-border bg-popover py-1.5 ps-4 pe-1.5 text-body text-popover-foreground shadow-lg"
          >
            <span className="min-w-0 py-2 text-pretty">{toast.message}</span>
            {toast.cmd && <bdi dir="ltr" className="rounded-md bg-muted px-2 py-1 font-mono text-caption">{toast.cmd}</bdi>}
            {toast.onUndo && (
              <button type="button" onClick={toast.onUndo} className={cn('inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-primary-text hover:bg-accent', focusRing)}>
                {t.undo}
              </button>
            )}
            <button type="button" onClick={onClose} aria-label={t.close} className={cn('grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-accent', focusRing)}>
              <X aria-hidden className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
