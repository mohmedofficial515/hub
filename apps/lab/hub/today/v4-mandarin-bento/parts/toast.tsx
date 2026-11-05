import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, Undo2, X } from 'lucide-react';
import { useT } from '@lab/i18n';
import { messages } from '../i18n';
import { Button, CopyButton, Kbd, ring } from './atoms';
import { cn } from '@lab/ui/hub-cn';

export interface ToastData {
  id: number;
  message: ReactNode;
  cmd?: string;
  onUndo?: () => void;
  plain?: boolean;
}

const MIN_MS = 10_000;
const TICK = 250;

/**
 * One toast at a time, at the inline end (docs/08 §4 rule 7). It lasts at least 10 s, and the clock only
 * runs while nothing is holding it: hover, focus in the toast, or keyboard focus in the list the action
 * came from. A keyboard user working through rows therefore never loses their Undo (v2 finding B1).
 */
export function ToastRegion({ toast, onClose, keysOn }: { toast: ToastData | null; onClose: () => void; keysOn: boolean }) {
  const t = useT(messages);
  const hovered = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!toast) return;
    let left = toast.cmd ? MIN_MS + 4000 : MIN_MS;
    const id = window.setInterval(() => {
      const active = document.activeElement;
      const inToast = !!box.current && !!active && box.current.contains(active);
      const inList = !!active?.closest('[data-row]') && active.matches(':focus-visible');
      if (hovered.current || inToast || inList) return;
      left -= TICK;
      if (left <= 0) closeRef.current();
    }, TICK);
    return () => window.clearInterval(id);
  }, [toast]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end sm:inset-x-auto sm:end-6 sm:bottom-6">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            ref={box}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } }}
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
            onMouseEnter={() => (hovered.current = true)}
            onMouseLeave={() => (hovered.current = false)}
            className="tile-invert pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl bg-(--t-bg) p-3.5 text-(--t-fg) shadow-md sm:w-auto sm:min-w-80"
          >
            {!toast.plain && <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />}
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium">{toast.message}</p>
              {(toast.cmd || toast.onUndo) && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {toast.cmd && <CopyButton text={toast.cmd} />}
                  {toast.onUndo && (
                    <Button onClick={toast.onUndo} aria-keyshortcuts="u" className="h-11 gap-2 px-3 text-body-sm md:h-8">
                      <Undo2 aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
                      {t.undo}
                      {keysOn && <Kbd>u</Kbd>}
                    </Button>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.dismiss}
              className={cn('-me-1 -mt-1 inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-(--t-muted) hover:bg-(--t-hover) hover:text-(--t-fg) md:size-8', ring)}
            >
              <X aria-hidden className="size-4" strokeWidth={1.75} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
