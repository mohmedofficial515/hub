import { Keyboard, RefreshCw } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { NOW, type Member } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Button, fill, fmt, Ltr } from './atoms';
import { firstName, longDate, nowMs, plural, time, when } from './format';
import { dueState, type NeedCard } from './model';

const greetingFor = (hour: number) => (hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening');

/**
 * The summary sentence says what the numbers below cannot: the time picture. It never repeats a count
 * the hero already shows (critic: "Awaiting is counted three times").
 */
function Summary({ needs }: { needs: NeedCard[] }) {
  const t = useT(messages);
  const locale = useLocale();
  if (needs.length === 0) return <>{t.summary.clear}</>;
  const overdue = needs.filter((c) => dueState(c) === 'overdue');
  const next = needs
    .filter((c) => c.dueAt && dueState(c) !== 'overdue')
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!))[0];
  const overdueWords = overdue.length > 0 ? plural(overdue.length, locale, t.summary.overdue) : '';
  const nextWhen = next?.dueAt ? <span className="tabular-nums">{when(next.dueAt, locale)}</span> : null;
  if (overdue.length > 0 && nextWhen) return <>{fill(t.summary.overdueNext, { overdue: overdueWords, when: nextWhen })}</>;
  if (overdue.length > 0) return <>{fill(t.summary.overdueOnly, { overdue: overdueWords })}</>;
  if (nextWhen) return <>{fill(t.summary.nextOnly, { when: nextWhen })}</>;
  return <>{t.summary.calm}</>;
}

export function Masthead({
  me,
  needs,
  loading,
  refreshing,
  onRefresh,
  onShortcuts,
}: {
  me?: Member;
  needs: NeedCard[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onShortcuts: () => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const hour = new Date(nowMs() + 3 * 3_600_000).getUTCHours();
  const name = me ? firstName(me.name[locale]) : '';
  return (
    <header className="relative pb-5 md:pb-7">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 text-body-sm text-muted-foreground">
          <span className="font-bold text-foreground">{t.page.name}</span>
          <time dateTime={NOW.slice(0, 10)}>{longDate(NOW, locale)}</time>
        </p>
        <div className="-me-2 flex shrink-0 items-center gap-0.5 md:gap-1">
          {!loading && (
            <span role="status" className="me-1 hidden text-body-sm text-muted-foreground md:inline">
              {refreshing ? t.page.updating : fill(t.page.updated, { when: <Ltr className="tabular-nums">{time(NOW, locale)}</Ltr> })}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            aria-keyshortcuts="r"
            aria-label={t.page.refresh}
            className="w-11 px-0 md:w-auto md:px-3"
          >
            <RefreshCw
              aria-hidden
              className={cn('size-4', refreshing && 'motion-safe:animate-spin')}
              strokeWidth={1.75}
            />
            <span className="hidden md:inline">{t.page.refresh}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onShortcuts} aria-keyshortcuts="?" aria-label={t.page.shortcuts} title={t.page.shortcuts} className="hidden w-9 px-0 md:inline-flex">
            <Keyboard aria-hidden className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>
      <h1 className="reef-title mt-1 text-foreground md:mt-2">
        {fmt(t.greeting[greetingFor(hour)], { name })}
      </h1>
      <p className="reef-lede mt-1 max-w-2xl text-pretty text-foreground md:mt-2">
        {loading ? <span aria-hidden className="inline-block h-5 w-2/3 rounded-md bg-muted align-middle motion-safe:animate-pulse" /> : <Summary needs={needs} />}
      </p>
      {/* Refresh keeps the page where it is: this line is the only thing that moves, and its space is always reserved. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-full">
        <div className={cn('h-full w-2/5 rounded-full bg-muted-foreground', refreshing ? 'reef-sweep motion-reduce:w-full motion-reduce:opacity-40' : 'opacity-0')} />
      </div>
    </header>
  );
}
