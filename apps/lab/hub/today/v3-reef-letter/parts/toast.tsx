import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleAlert, CircleCheck, Undo2, X } from 'lucide-react';
import { useT } from '@lab/i18n';
import { messages } from '../i18n';
import { Button, CopyButton, Kbd } from './atoms';
import { focusRing } from './type-meta';

export interface ToastData {
  id: number;
  message: ReactNode;
  cmd?: string;
  onUndo?: () => void;
  tone?: 'done' | 'info';
}

const LIFETIME = 10_000;
const TICK = 250;

/**
 * One toast at a time, at the inline end (docs/08 §4 rule 7). It lives 10 s, and the clock only runs
 * when the pointer is off it and keyboard focus is not in a list or in the toast itself: a keyboard user
 * working down the list keeps their Undo for as long as they stay there (critic B1).
 */
export function ToastRegion({ toast, onClose, showKeyHint }: { toast: ToastData | null; onClose: () => void; showKeyHint: boolean }) {
  const t = useT(messages);
  const [hovered, setHovered] = useState(false);
  const hoveredRef = useRef(false);
  hoveredRef.current = hovered;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!toast) return;
    let left = LIFETIME;
    const id = window.setInterval(() => {
      const a = document.activeElement;
      const held = hoveredRef.current || !!(a && a.matches(':focus-visible') && a.closest('[data-keep-toast]'));
      if (held) return;
      left -= TICK;
      if (left <= 0) closeRef.current();
    }, TICK);
    return () => window.clearInterval(id);
  }, [toast]);

  const Icon = toast?.tone === 'info' ? CircleAlert : CircleCheck;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end sm:inset-x-auto sm:end-6 sm:bottom-6">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            data-keep-toast
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } }}
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-border bg-popover p-3.5 text-popover-foreground shadow-md sm:w-auto"
          >
            <Icon aria-hidden className={`mt-0.5 size-5 shrink-0 ${toast.tone === 'info' ? 'text-muted-foreground' : 'text-success-soft-foreground'}`} strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="text-body text-popover-foreground">{toast.message}</p>
              {(toast.cmd || toast.onUndo) && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {toast.cmd && <CopyButton text={toast.cmd} />}
                  {toast.onUndo && (
                    <>
                      <Button size="sm" onClick={toast.onUndo} aria-keyshortcuts="u">
                        <Undo2 aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
                        {t.undo}
                      </Button>
                      {showKeyHint && (
                        <span className="hidden items-center gap-1.5 text-body-sm text-muted-foreground md:inline-flex">
                          <Kbd>u</Kbd>
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.dismiss}
              className={`-me-1 -mt-1 inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:size-8 ${focusRing}`}
            >
              <X aria-hidden className="size-4" strokeWidth={1.75} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
