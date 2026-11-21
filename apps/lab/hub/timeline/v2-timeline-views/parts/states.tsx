import { CheckCheck, CloudOff, Inbox, Mail, Sparkles, type LucideIcon } from 'lucide-react';
import { useT } from '@lab/i18n';
import { messages } from '../i18n';
import { cn, focusRing, Ltr } from './atoms';
import type { ViewId } from './model';

const icons: Record<ViewId, LucideIcon> = { needs: CheckCheck, new: Sparkles, mentions: Mail, all: Inbox };

/** An empty view says why it is empty and what fills it, and offers the next place to look. */
export function EmptyState({ view, onShowAll }: { view: ViewId; onShowAll: () => void }) {
  const t = useT(messages);
  const copy = t.empty[view];
  const Icon = icons[view];
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-6" strokeWidth={1.5} />
      </span>
      <h2 className="text-title-sm font-semibold text-foreground">{copy.title}</h2>
      <p className="max-w-[44ch] text-body text-muted-foreground text-pretty">{copy.body}</p>
      {copy.cta && (
        <button
          type="button"
          onClick={onShowAll}
          className={cn('mt-1 inline-flex h-11 items-center rounded-lg border border-input bg-card px-5 text-body font-medium text-foreground hover:bg-accent', focusRing)}
        >
          {copy.cta}
        </button>
      )}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useT(messages);
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/50 bg-card px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-destructive-soft text-destructive-soft-foreground">
        <CloudOff aria-hidden className="size-6" strokeWidth={1.5} />
      </span>
      <h2 className="text-title-sm font-semibold text-foreground">{t.error.title}</h2>
      <p className="max-w-[44ch] text-body text-muted-foreground text-pretty">{t.error.body}</p>
      <dl className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <div className="flex gap-1.5">
          <dt>{t.error.code}</dt>
          <dd><Ltr mono>timeline_unavailable</Ltr></dd>
        </div>
        <div className="flex gap-1.5">
          <dt>{t.error.requestId}</dt>
          <dd><Ltr mono>req_7c1f9a02</Ltr></dd>
        </div>
      </dl>
      <button type="button" onClick={onRetry} className={cn('mt-1 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-body font-semibold text-primary-foreground hover:bg-primary-hover', focusRing)}>
        {t.error.retry}
      </button>
    </div>
  );
}

/** Same silhouette as a FeedRow, so the page does not jump when the data arrives. */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  const t = useT(messages);
  return (
    <div role="status" aria-busy="true" aria-label={t.loading} className="@container overflow-hidden rounded-2xl border border-border bg-card">
      <span className="sr-only">{t.loading}</span>
      <ul className="divide-y divide-border">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="tl-skel px-5 py-4">
            <div className="tl-skel-lead">
              <span className="size-8 rounded-lg bg-muted motion-safe:animate-pulse" />
              <span className="h-3.5 w-16 rounded bg-muted motion-safe:animate-pulse" />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <span className={cn('h-4 rounded bg-muted motion-safe:animate-pulse', i % 2 ? 'w-3/4' : 'w-5/6')} />
              <span className="h-3 w-1/2 rounded bg-muted motion-safe:animate-pulse" />
            </div>
            <span className="h-6 w-24 rounded-full bg-muted motion-safe:animate-pulse" />
          </li>
        ))}
      </ul>
    </div>
  );
}
