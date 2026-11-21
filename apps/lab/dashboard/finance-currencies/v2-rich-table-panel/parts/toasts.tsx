import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Button } from '@dash/components/ui/button';
import type { CurrencyMessages } from '../i18n';
import type { Toast } from './store';

export function Toasts({
  toasts,
  onDismiss,
  t,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
  t: CurrencyMessages;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t.sr.live}
      className="pointer-events-none fixed inset-x-3 top-3 z-[60] flex flex-col items-center gap-2 md:top-5"
    >
      <AnimatePresence initial={false}>
        {toasts.map((x) => (
          <motion.div
            key={x.id}
            layout={!reduce}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-foreground py-2 ps-4 pe-2 text-14 text-background shadow-xl"
          >
            <Check className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 text-start">{x.message}</span>
            {x.undo && (
              <button
                type="button"
                onClick={() => {
                  x.undo?.();
                  onDismiss(x.id);
                }}
                className="inline-flex min-h-11 items-center rounded-lg px-3 font-bold underline underline-offset-4 outline-none hover:bg-background/10 focus-visible:ring-[3px] focus-visible:ring-background/50"
              >
                {t.toast.undo}
              </button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.toast.dismiss}
              onClick={() => onDismiss(x.id)}
              className="size-11 text-background hover:bg-background/10 hover:text-background dark:!text-background"
            >
              <X />
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
