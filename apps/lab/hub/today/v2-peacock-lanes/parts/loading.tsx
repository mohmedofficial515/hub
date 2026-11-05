import { useEffect, useState } from 'react';
import { useT } from '@lab/i18n';
import { messages } from '../i18n';
import { Skeleton } from './atoms';

/** Skeletons shaped like the final blocks, same heights (docs/08 §5.6); "Still loading…" after 3 s. */
export function LoadingView() {
  const t = useT(messages);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 3000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div role="status" aria-label={t.loading.label} className="flex flex-col gap-6 md:gap-8">
      <div className="flex gap-px overflow-hidden rounded-xl border border-border bg-border md:grid md:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex w-40 shrink-0 flex-col gap-2 bg-card p-3.5 md:w-auto">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 md:gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-3 lg:col-span-7">
          <Skeleton className="h-5 w-40" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 rounded-lg border-s-[3px] border-border bg-card p-4">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-9 w-24" />
            </div>
          ))}
          <Skeleton className="mt-4 h-44 w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 lg:col-span-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-0.5 w-full" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-6 h-5 w-40" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="min-h-5 text-body-sm text-muted-foreground">{slow ? t.loading.still : ''}</p>
    </div>
  );
}
