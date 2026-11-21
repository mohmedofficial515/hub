import { RefreshCw, Sun } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { messages } from '../i18n';
import { Chip, DueChip } from './chips';
import { cn, fill, fillText, focusRing, formatTime, Ltr, plural } from './atoms';
import type { Counts, FeedItem } from './model';

const firstSentence = (s: string) => (s.split(/[.،]/)[0] ?? s).replace(/\*\*|`/g, '');

/**
 * The one-line header that replaces Today: the greeting, the ONE counter, the brief clamped to a line, the next
 * deadline and the live state. On a phone the same pieces wrap to three short lines, none is dropped.
 */
export function PageHeader({
  name,
  counts,
  briefText,
  briefOpen,
  onBrief,
  next,
  refreshing,
  onRefresh,
  live = true,
}: {
  name: string;
  counts: Counts | null;
  briefText: string | null;
  briefOpen: boolean;
  onBrief: () => void;
  next: FeedItem | null;
  refreshing: boolean;
  onRefresh: () => void;
  live?: boolean;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const counter = counts ? plural(locale, counts.attention, t.counter) : '';

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
      <h1 className="hub-page-title order-1 text-title text-foreground md:text-headline">{fillText(t.greeting, { name })}</h1>

      {counts && (
      <p
        title={t.counterHint}
        className={cn(
          'order-3 inline-flex min-h-8 items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-body-sm text-foreground md:order-2',
          counts.attention === 0 && 'text-muted-foreground',
        )}
      >
        <span className="font-semibold tabular-nums">{counter}</span>
        {counts.overdue > 0 && (
          <span className="inline-flex items-center gap-1.5 font-medium text-destructive-soft-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
            {fillText(t.overdue, { n: counts.overdue })}
          </span>
        )}
        <span className="sr-only">. {t.counterHint}</span>
      </p>
      )}

      {/* brief: a line on desktop, two on a phone; opens in place */}
      {briefText && (
        <button
          type="button"
          onClick={onBrief}
          aria-expanded={briefOpen}
          aria-controls="tl-brief"
          className={cn(
            'order-5 -my-1 flex min-h-11 basis-full items-start gap-2 rounded-lg py-1.5 text-start text-body-sm text-muted-foreground hover:text-foreground md:order-3 md:basis-0 md:min-w-0 md:flex-1 md:items-center',
            focusRing,
          )}
        >
          <Sun aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-strong md:mt-0" strokeWidth={1.75} />
          <span className="min-w-0 line-clamp-2 text-pretty md:line-clamp-1">
            <span className="font-semibold text-foreground">{t.brief}: </span>
            {firstSentence(briefText)}
          </span>
        </button>
      )}

      {next?.card && (
        <p className="order-4 inline-flex min-h-8 items-center gap-2 text-body-sm text-muted-foreground">
          <span className="sr-only">{t.nextDeadline}: </span>
          <Ltr mono className="font-medium text-foreground">{next.card.key}</Ltr>
          <DueChip dueAt={next.card.dueAt!} />
        </p>
      )}

      <div className="order-2 ms-auto flex items-center gap-1 md:order-6 md:ms-0">
        {live && (
          <Chip tone="success" className="gap-1.5" >
            <span aria-hidden className="size-1.5 rounded-full bg-success motion-safe:animate-[peacock-breathe_4s_ease-in-out_infinite]" />
            <span>{t.live.on}</span>
            <span className="sr-only"> {t.live.label}</span>
          </Chip>
        )}
        <button
          type="button"
          onClick={onRefresh}
          aria-label={t.refresh}
          title={t.refresh}
          className={cn('grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:size-10', focusRing)}
        >
          <RefreshCw aria-hidden className={cn('size-4.5', refreshing && 'motion-safe:animate-spin')} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}

export function BriefPanel({ text, at, onClose }: { text: string; at: string; onClose: () => void }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <section id="tl-brief" aria-label={t.brief} className="rounded-xl border border-border bg-card p-4 md:p-5">
      <p className="hub-letter max-w-[68ch] text-pretty text-foreground">
        {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) =>
          part.startsWith('**') ? <strong key={i} className="font-bold">{part.slice(2, -2)}</strong> : part.startsWith('`') ? <Ltr key={i} mono>{part.slice(1, -1)}</Ltr> : <span key={i}>{part}</span>,
        )}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3 text-caption text-muted-foreground">
        <span>{fill(t.briefBy, { time: <Ltr mono>{formatTime(at, locale)}</Ltr> })}</span>
        <button type="button" onClick={onClose} className={cn('min-h-11 rounded-lg px-3 font-medium text-primary-text hover:underline', focusRing)}>
          {t.briefHide}
        </button>
      </div>
    </section>
  );
}
