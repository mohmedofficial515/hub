import { PlaneTakeoff, SearchX, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';

const bone = 'rounded-md bg-surface-3 motion-safe:animate-pulse';

/** Searching: the strip and two cards keep their final shape, so nothing jumps when prices arrive. */
export function LoadingState() {
  const t = useT(messages);
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <PlaneTakeoff className="size-5 text-brand-ink" aria-hidden />
        {t.states.searching}
      </p>
      <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-card" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn('space-y-2 px-3 py-3 sm:px-5', i > 0 && 'border-s border-border')}>
            <div className={cn(bone, 'h-4 w-16')} />
            <div className={cn(bone, 'h-6 w-24')} />
            <div className={cn(bone, 'h-3 w-12')} />
          </div>
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} aria-hidden className="grid gap-4 rounded-2xl border border-border bg-card p-4 md:grid-cols-[1fr_16rem] md:p-6">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className={cn(bone, 'size-10 rounded-full')} />
              <div className={cn(bone, 'h-4 w-40')} />
            </div>
            {[0, 1].map((j) => (
              <div key={j} className="flex items-center gap-4">
                <div className={cn(bone, 'h-7 w-14')} />
                <div className={cn(bone, 'h-px flex-1')} />
                <div className={cn(bone, 'h-7 w-14')} />
              </div>
            ))}
          </div>
          <div className="space-y-3 md:border-s md:border-border md:ps-6">
            <div className={cn(bone, 'h-3 w-24')} />
            <div className={cn(bone, 'h-8 w-36')} />
            <div className={cn(bone, 'h-11 w-full')} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Message({ icon: Icon, title, text, tone, action }: { icon: LucideIcon; title: string; text: string; tone?: 'danger'; action: { label: string; onClick: () => void; primary?: boolean } }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2">
        <Icon className={cn('size-6', tone === 'danger' ? 'text-danger-ink' : 'text-brand-ink')} aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-semibold text-brand-ink">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{text}</p>
      <button
        type="button"
        onClick={action.onClick}
        className={cn(
          'mt-6 inline-flex min-h-11 cursor-pointer items-center rounded-md px-5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
          action.primary ? 'bg-action text-action-foreground hover:bg-action-hover' : 'border border-border-strong bg-card text-brand-ink hover:bg-surface-2',
        )}
      >
        {action.label}
      </button>
    </div>
  );
}

/** No card matches: the way out is the only action. */
export function EmptyState({ onClear }: { onClear: () => void }) {
  const t = useT(messages);
  return <Message icon={SearchX} title={t.states.emptyTitle} text={t.states.emptyText} action={{ label: t.states.clear, onClick: onClear }} />;
}

/** The search failed: "search again" is the screen's one primary action, so it is teal here. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useT(messages);
  return (
    <Message icon={TriangleAlert} tone="danger" title={t.states.errorTitle} text={t.states.errorText} action={{ label: t.states.retry, onClick: onRetry, primary: true }} />
  );
}
