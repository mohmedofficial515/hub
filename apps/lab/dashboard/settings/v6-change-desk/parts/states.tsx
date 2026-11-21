// Loading skeleton, load error and the toast stack.
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CloudOff, X } from 'lucide-react';
import { Skeleton } from '@dash/components/ui/skeleton';
import { useDesk } from './store';
import { Btn, Card } from './ui';

export function LoadingState() {
  const { t } = useDesk();
  return (
    <div className="grid gap-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t.states.loading}</span>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card className="flex gap-6 p-6">
          <div className="grid w-40 gap-3">
            <Skeleton className="size-12 rounded-xl" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="grid flex-1 content-start gap-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <div className="mt-2 grid grid-cols-3 gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        </Card>
        <Card className="grid content-start gap-3 p-5">
          <Skeleton className="h-4 w-40" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="grid gap-3 p-5">
            <div className="flex gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-12 w-full rounded-xl" />
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useDesk();
  return (
    <Card className="mx-auto grid max-w-xl justify-items-center gap-3 p-10 text-center" aria-live="assertive">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-muted">
        <CloudOff aria-hidden className="size-6 text-destructive-soft-foreground" />
      </span>
      <h2 className="text-18 font-extrabold">{t.states.errorTitle}</h2>
      <p className="text-14 leading-relaxed text-muted-foreground">{t.states.errorBody}</p>
      <Btn variant="primary" onClick={onRetry}>
        {t.states.retry}
      </Btn>
    </Card>
  );
}

export function Toasts() {
  const { toasts, dismiss, t } = useDesk();
  const reduce = useReducedMotion();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto grid w-full max-w-md justify-items-center gap-2 px-4">
      <AnimatePresence initial={false}>
        {toasts.map((x) => (
          <motion.div
            key={x.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex w-full items-center gap-2 rounded-xl bg-foreground py-1.5 ps-4 pe-1.5 text-13 text-background shadow-lg"
            role="status"
          >
            <span className="min-w-0 flex-1 py-1.5">{x.text}</span>
            {x.action && (
              <button
                type="button"
                onClick={() => {
                  x.action!.run();
                  dismiss(x.id);
                }}
                className="min-h-11 rounded-lg px-3 text-13 font-bold underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-background sm:min-h-8"
              >
                {x.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label={t.toast.close}
              onClick={() => dismiss(x.id)}
              className="inline-flex size-11 items-center justify-center rounded-lg opacity-80 outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-background sm:size-8"
            >
              <X aria-hidden className="size-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
