import { RefreshCw } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { NOW, workspace, type Member } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Button, fmt, Ltr, Skeleton } from './atoms';
import { firstName, longDate, plural, time } from './format';

/**
 * The page's one brand moment: a peacock ocellus drawn as four concentric rings in the type hues
 * (bronze → tail teal → eye cyan → neck blue). Hues only, no texture, used once on the page.
 */
export function Ocellus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-7 shrink-0', className)}>
      <ellipse cx="16" cy="16" rx="14" ry="15" className="fill-type-decision stroke-background" strokeWidth="1" />
      <ellipse cx="16" cy="17.4" rx="10.4" ry="11.2" className="fill-type-doc stroke-background" strokeWidth="1" />
      <ellipse cx="16" cy="18.6" rx="7.2" ry="7.8" className="fill-type-handoff stroke-background" strokeWidth="1" />
      <ellipse cx="16" cy="19.6" rx="4.2" ry="4.6" className="fill-type-task" />
    </svg>
  );
}

export function PageHeader({
  me,
  waiting,
  overdue,
  refreshing,
  loading,
  onRefresh,
}: {
  me: Member | undefined;
  waiting: number;
  overdue: number;
  refreshing: boolean;
  loading: boolean;
  onRefresh: () => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const name = me ? firstName(me.name[locale]) : '';
  const summary =
    waiting === 0
      ? plural(0, locale, t.greeting.summary)
      : plural(waiting, locale, t.greeting.summary) + plural(overdue, locale, t.greeting.overdue);

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm text-muted-foreground">
          <Ocellus />
          <span className="font-semibold text-foreground">{workspace.name[locale]}</span>
          <span aria-hidden className="h-3.5 w-px bg-border" />
          <time dateTime={NOW.slice(0, 10)}>{longDate(NOW, locale)}</time>
        </p>
        <h1 className="mt-3 text-headline font-semibold text-balance text-foreground">{fmt(t.greeting.morning, { name })}</h1>
        {loading ? (
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        ) : (
          <p className="mt-1 text-body-lg text-muted-foreground">{summary}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-caption text-muted-foreground">
          {fmt(t.updated, { when: '' })}
          <Ltr>{time(NOW, locale)}</Ltr>
        </span>
        <Button onClick={onRefresh} disabled={refreshing || loading} aria-keyshortcuts="r">
          <RefreshCw
            aria-hidden
            className={cn('size-4', refreshing && 'motion-safe:animate-spin')}
            strokeWidth={1.75}
          />
          {t.refresh}
          <kbd className="key hidden rounded-sm bg-muted px-1 text-caption text-muted-foreground md:inline">r</kbd>
        </Button>
      </div>
    </header>
  );
}
