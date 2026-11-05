import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, X } from 'lucide-react';
import { useT } from '@lab/i18n';
import { messages } from '../i18n';
import { Button, CopyButton } from './atoms';
import { focusRing } from './type-meta';

export interface ToastData {
  id: number;
  message: ReactNode;
  cmd?: string;
  onUndo?: () => void;
}

/** One toast at a time, at the inline end (docs/08 §4 rule 7). Pauses while hovered or focused. */
export function ToastRegion({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  const t = useT(messages);
  const [paused, setPaused] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!toast || paused) return;
    const id = window.setTimeout(() => closeRef.current(), toast.cmd ? 9000 : 6000);
    return () => window.clearTimeout(id);
  }, [toast, paused]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end sm:inset-x-auto sm:end-6 sm:bottom-6"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } }}
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-border bg-popover p-3.5 text-popover-foreground shadow-md sm:w-auto"
          >
            <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="text-body text-popover-foreground">{toast.message}</p>
              {(toast.cmd || toast.onUndo) && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {toast.cmd && <CopyButton text={toast.cmd} />}
                  {toast.onUndo && (
                    <Button size="sm" variant="ghost" onClick={toast.onUndo} className="text-primary hover:text-primary">
                      {t.undo}
                    </Button>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.dismiss}
              className={`-me-1 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:size-8 ${focusRing}`}
            >
              <X aria-hidden className="size-4" strokeWidth={1.75} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
