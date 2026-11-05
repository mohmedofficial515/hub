import { CloudOff } from 'lucide-react';
import { useT } from '@lab/i18n';
import { messages } from '../i18n';
import { Button, Skeleton, Tile } from './atoms';

/** Rows shaped like the real ones, so nothing jumps when the data lands (docs/08 §5.6). */
function Rows({ n, tall = false }: { n: number; tall?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
          <Skeleton className={tall ? 'h-11 w-24' : 'h-10 w-20'} />
        </div>
      ))}
    </div>
  );
}

/**
 * First load only: refresh keeps the real content (v2 finding M7). The skeleton has the final bento, in
 * the final order, with every tile present: colour arrives first, so only the text fades in.
 */
export function LoadingBento() {
  const t = useT(messages);
  return (
    <div role="status" aria-label={t.loading.label} className="grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5 lg:grid-cols-12 lg:gap-6">
      <Tile tone="ink" className="md:col-span-6 lg:col-span-7">
        <div className="flex items-end gap-3">
          <Skeleton className="h-(--mandarin-hero) w-20" />
          <Skeleton className="mb-2 h-6 w-40" />
        </div>
        <div className="tile-paper mt-5 rounded-xl bg-(--t-bg) p-4 md:p-5">
          <Rows n={1} tall />
        </div>
        <div className="mt-4 px-2">
          <Rows n={4} />
        </div>
      </Tile>
      <div className="flex min-w-0 flex-col gap-4 md:col-span-6 md:grid md:grid-cols-2 md:gap-5 lg:col-span-5 lg:flex lg:gap-6">
        <Tile rule="yellow">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="mt-4 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-5/6" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </Tile>
        <Tile tone="orange">
          <Skeleton className="mb-4 h-6 w-32" />
          <Rows n={3} />
        </Tile>
        <Tile rule="orange" className="md:col-span-2 lg:col-span-1">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </Tile>
      </div>
      <Tile rule="cyan" className="md:col-span-6 lg:col-span-12">
        <Skeleton className="h-6 w-44" />
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          <Rows n={3} />
          <Rows n={3} />
        </div>
      </Tile>
      <Tile tone="green" className="md:col-span-6 lg:col-span-8">
        <Skeleton className="h-6 w-40" />
        <div className="mt-4 grid grid-cols-3 gap-4 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="mt-5 h-64" />
      </Tile>
      <Tile rule="green" className="md:col-span-6 lg:col-span-4">
        <Skeleton className="h-6 w-44" />
        <div className="mt-4">
          <Rows n={4} />
        </div>
      </Tile>
      <Tile rule="cyan" className="md:col-span-6 lg:col-span-12">
        <Skeleton className="h-6 w-40" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </Tile>
    </div>
  );
}

/** docs/08 §5.6: title, what to do, the code in mono, and Retry. */
export function ErrorTile({ onRetry }: { onRetry: () => void }) {
  const t = useT(messages);
  return (
    <div role="alert">
      <Tile rule="blue" className="flex flex-col items-start gap-3">
        <div className="flex items-start gap-3">
          <CloudOff aria-hidden className="mt-1 size-6 shrink-0 text-(--alarm-fg)" strokeWidth={1.75} />
          <div className="min-w-0">
            <h2 className="text-title font-extrabold md:text-headline">{t.error.title}</h2>
            <p className="mt-1 text-body text-(--t-muted)">{t.error.body}</p>
            <code dir="ltr" translate="no" className="key mt-2 block text-start text-body-sm text-(--t-muted)">
              {t.error.code}
            </code>
          </div>
        </div>
        <Button variant="primary" onClick={onRetry}>
          {t.error.retry}
        </Button>
      </Tile>
    </div>
  );
}
