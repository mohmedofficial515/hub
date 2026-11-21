import { useEffect, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { useT } from '@lab/i18n';
import { messages } from '../i18n';
import { Button, Ltr, Skeleton } from './atoms';

/**
 * First load only (a refresh keeps the page in place). Skeletons sit in the final order and at the final
 * heights, team and sources included, so nothing jumps when data arrives. "Still loading…" after 3 s.
 */
export function LoadingView() {
  const t = useT(messages);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 3000);
    return () => window.clearTimeout(id);
  }, []);
  const row = (key: number) => (
    <div key={key} className="flex items-center gap-3 px-3 py-3 md:gap-4 md:px-4">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-10 w-18 shrink-0 rounded-lg" />
    </div>
  );
  return (
    <div role="status" aria-label={t.loading.label} className="xl:grid xl:grid-cols-[minmax(0,47.5rem)_20rem] xl:justify-between">
      <div className="flex min-w-0 flex-col gap-10 md:gap-14">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-5 md:gap-x-10">
          <Skeleton className="size-36 rounded-full md:row-span-2 md:size-56 xl:size-60" />
          <div className="flex flex-wrap gap-2 md:self-end">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6 w-24" />
            ))}
          </div>
          <div className="col-span-2 grid grid-cols-3 gap-3 md:col-span-1 md:col-start-2 md:self-start">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 md:gap-4">
          <Skeleton className="h-7 w-32" />
          <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">{[0, 1, 2, 3, 4, 5, 6].map(row)}</div>
        </div>
        <Skeleton className="h-64 w-full rounded-md" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-44" />
          <div className="flex flex-col divide-y divide-border">{[0, 1, 2].map(row)}</div>
        </div>
      </div>
      <div className="mt-12 flex flex-col gap-4 xl:mt-0">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-64 w-full" />
        <p className="min-h-5 text-body-sm text-muted-foreground">{slow ? t.loading.still : ''}</p>
      </div>
    </div>
  );
}

/** docs/08 §5.6: says what failed, gives the code and one way forward. */
export function ErrorView({ onRetry }: { onRetry: () => void }) {
  const t = useT(messages);
  return (
    <div role="alert" className="flex max-w-xl items-start gap-3 py-8">
      <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive-soft text-destructive-soft-foreground">
        <CircleAlert className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <h2 className="reef-h2 text-foreground">{t.error.title}</h2>
        <p className="mt-1 text-body text-muted-foreground">{t.error.body}</p>
        <p className="mt-2 text-body-sm text-muted-foreground">
          <Ltr mono>{t.error.code}</Ltr>
        </p>
        <Button variant="primary" onClick={onRetry} className="mt-4">
          {t.error.retry}
        </Button>
      </div>
    </div>
  );
}
