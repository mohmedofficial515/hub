import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Popover } from 'radix-ui';
import { Keyboard, RefreshCw } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { NOW, workspace, type Member } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Button, fill, fmt, JumpLink, Kbd, Ltr, ring, Skeleton } from './atoms';
import { firstName, longDate, plural, time, when } from './format';

/** The masthead's mark: the page's bento in miniature, one square per solid tile plus the letter's gold. */
function Mark() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-5 shrink-0">
      <rect x="0" y="0" width="12" height="12" rx="2.5" fill="var(--fish-blue)" />
      <rect x="13.5" y="0" width="6.5" height="5.25" rx="1.5" fill="var(--fish-yellow)" />
      <rect x="13.5" y="6.75" width="6.5" height="5.25" rx="1.5" fill="var(--fish-orange)" />
      <rect x="0" y="13.5" width="20" height="6.5" rx="1.5" fill="var(--fish-green)" />
    </svg>
  );
}

/** Shortcuts help + the off switch. Radix Popover flips and shifts, so it stays inside the viewport. */
function KeysPopover({
  on,
  onChange,
  open,
  onOpenChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const t = useT(messages);
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t.keys.open}
          aria-keyshortcuts="?"
          className={cn(
            'hidden size-10 touch-manipulation items-center justify-center rounded-lg border-2 border-(--t-btn) text-(--t-fg) transition-colors duration-[120ms] hover:bg-(--t-hover) md:inline-flex',
            ring,
          )}
        >
          <Keyboard aria-hidden className="size-4.5" strokeWidth={1.75} />
        </button>
      </Popover.Trigger>
      {/* No portal: tokens are scoped to `.mandarin`, so the popover has to render inside it. */}
      <Popover.Content align="end" sideOffset={8} collisionPadding={16} className="tile-invert z-40 w-72 rounded-xl bg-(--t-bg) p-4 text-(--t-fg) shadow-md">
        <h2 className="text-title-sm font-extrabold">{t.keys.title}</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {t.keys.list.map((row) => (
            <li key={row.keys.join()} className="flex items-center justify-between gap-3 text-body-sm">
              <span>{row.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {row.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-t-(--t-line) pt-3">
          <span id="keys-toggle" className="text-body-sm font-semibold">
            {t.keys.toggle}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby="keys-toggle"
            onClick={() => onChange(!on)}
            className={cn('inline-flex h-8 touch-manipulation items-center gap-2 rounded-full border-2 border-(--t-btn) px-3 text-body-sm font-bold transition-colors duration-[120ms]', on ? 'bg-(--t-fg) text-(--t-bg)' : 'text-(--t-fg)', ring)}
          >
            {on ? t.keys.on : t.keys.off}
          </button>
        </div>
        {!on && <p className="mt-2 text-body-sm text-(--t-muted)">{t.keys.offHint}</p>}
      </Popover.Content>
    </Popover.Root>
  );
}

/** "3 tasks ready to claim, 27 updates since yesterday 11:30 and 1 source needs a look." Each clause jumps to its tile. */
function CoverLine({ ready, since, sinceWhen, sources }: { ready: number; since: number; sinceWhen: string; sources: number }) {
  const t = useT(messages);
  const locale = useLocale();
  const clauses: ReactNode[] = [];
  const link = 'font-semibold text-foreground underline decoration-border decoration-2 underline-offset-4 hover:decoration-foreground';
  if (ready > 0)
    clauses.push(
      <JumpLink key="ready" target="ready-title" className={link}>
        {plural(ready, locale, t.masthead.ready)}
      </JumpLink>,
    );
  if (since > 0)
    clauses.push(
      <JumpLink key="since" target="since-title" className={link}>
        {plural(since, locale, t.masthead.since).replace('{when}', when(sinceWhen, locale))}
      </JumpLink>,
    );
  if (sources > 0)
    clauses.push(
      <JumpLink key="sources" target="sources-title" className={link}>
        {plural(sources, locale, t.masthead.sources)}
      </JumpLink>,
    );

  if (clauses.length === 0) return <p className="text-body-lg text-pretty text-muted-foreground">{fmt(t.masthead.quiet, { when: when(sinceWhen, locale) })}</p>;

  return (
    <p className="text-body text-pretty text-muted-foreground md:text-body-lg">
      {clauses.map((c, i) => (
        <span key={i}>
          {i > 0 && (i === clauses.length - 1 ? t.masthead.and : locale === 'ar' ? '، ' : ', ')}
          {c}
        </span>
      ))}
      {locale === 'ar' ? '.' : '.'}
    </p>
  );
}

export function Masthead({
  me,
  ready,
  since,
  sinceWhen,
  sources,
  refreshing,
  loading,
  failed,
  onRefresh,
  keysOn,
  onKeysChange,
  helpOpen,
  onHelpChange,
}: {
  me: Member | undefined;
  ready: number;
  since: number;
  sinceWhen: string;
  sources: number;
  refreshing: boolean;
  loading: boolean;
  failed: boolean;
  onRefresh: () => void;
  keysOn: boolean;
  onKeysChange: (next: boolean) => void;
  helpOpen: boolean;
  onHelpChange: (next: boolean) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const name = me ? firstName(me.name[locale]) : '';

  // "Still loading…" only after 3 s (docs/08 §5.6). "Updated" never shows during a first load.
  const [slow, setSlow] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!loading) return;
    timer.current = window.setTimeout(() => setSlow(true), 3000);
    return () => window.clearTimeout(timer.current);
  }, [loading]);

  return (
    <header className="tile-paper relative pb-3 md:pb-5" aria-busy={refreshing || loading}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground">
            <Mark />
            <span className="font-bold text-foreground">{workspace.name[locale]}</span>
            <time dateTime={NOW.slice(0, 10)}>{longDate(NOW, locale)}</time>
          </p>
          <h1 className="mt-1 text-(length:--mandarin-title) leading-(--mandarin-title-lh) font-extrabold text-balance ltr:tracking-tight md:mt-2">{fill(t.masthead.greeting, { name })}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <span role="status" className="hidden text-body-sm text-muted-foreground md:inline">
            {failed ? (
              ''
            ) : refreshing ? (
              t.masthead.refreshing
            ) : loading ? (
              slow ? (
                t.loading.still
              ) : (
                ''
              )
            ) : (
              fill(t.masthead.updated, { when: <Ltr className="tabular-nums">{time(NOW, locale)}</Ltr> })
            )}
          </span>
          <KeysPopover on={keysOn} onChange={onKeysChange} open={helpOpen} onOpenChange={onHelpChange} />
          <Button onClick={onRefresh} disabled={refreshing || loading} aria-keyshortcuts="r" aria-label={t.masthead.refresh} className="size-11 px-0 md:size-auto md:h-10 md:px-3">
            <RefreshCw aria-hidden className={cn('size-4.5', refreshing && 'motion-safe:animate-spin')} strokeWidth={1.75} />
            <span className="hidden md:inline">{t.masthead.refresh}</span>
          </Button>
        </div>
      </div>

      <div className="mt-1.5 min-h-6">
        {failed ? null : loading ? <Skeleton className="h-5 w-80 max-w-full" /> : <CoverLine ready={ready} since={since} sinceWhen={sinceWhen} sources={sources} />}
      </div>

      {/* Refresh keeps every tile in place; only this line moves (v2 finding M7). It always reserves its height. */}
      <div aria-hidden className="refresh-line absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-full">
        {refreshing && <div className="h-full w-1/3 rounded-full bg-primary motion-safe:animate-(--animate-progress)" />}
      </div>
    </header>
  );
}
