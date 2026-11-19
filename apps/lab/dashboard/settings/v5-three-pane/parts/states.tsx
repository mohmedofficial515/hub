import { CloudOff, RotateCcw } from 'lucide-react';
import { Skeleton } from '@dash/components/ui/skeleton';
import { useStore } from './store';
import { Btn } from './ui';

export function ListSkeleton() {
  const { t } = useStore();
  return (
    <div className="grid gap-1 px-3 py-4" aria-busy="true" aria-label={t.states.loading}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl px-2 py-2.5">
          <Skeleton className="size-8 rounded-lg" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EditorSkeleton() {
  const { t } = useStore();
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-6 md:px-6" aria-busy="true">
      <p className="sr-only" role="status">
        {t.states.loading}
      </p>
      <div className="flex items-start gap-4">
        <Skeleton className="size-12 rounded-2xl" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-8 grid gap-1 rounded-2xl border bg-card p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-6 px-2 py-3">
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoadError() {
  const s = useStore();
  const { t } = s;
  return (
    <div className="grid h-full place-items-center px-6 py-16 text-center" role="alert">
      <div className="max-w-sm">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-muted text-destructive">
          <CloudOff className="size-6" aria-hidden />
        </span>
        <h2 className="mt-3 text-17 font-bold">{t.states.errorTitle}</h2>
        <p className="mt-1 text-13 text-muted-foreground">{t.states.errorBody}</p>
        <Btn variant="primary" className="mt-4" onClick={() => s.setScenario('default')}>
          <RotateCcw className="size-4" aria-hidden />
          {t.states.retry}
        </Btn>
      </div>
    </div>
  );
}
