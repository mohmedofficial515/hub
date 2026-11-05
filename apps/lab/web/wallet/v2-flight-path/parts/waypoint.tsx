import {
  ArrowDownLeft,
  ArrowUpRight,
  BedDouble,
  ChevronLeft,
  ChevronRight,
  Package,
  Plane,
  Settings2,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { Amount } from './amount';
import { formatDay, formatTime } from './hooks';
import { toCents } from './money';
import type { Entry, SingleEntry, StoryEntry } from './ledger';

export const storyDomId = (paymentId: string) => `fp-story-${paymentId}`;

/** Visual kind of the node drawn on the rail for an entry. */
export type NodeKind = 'in' | 'out' | 'points' | 'hold' | 'released' | 'refunded' | 'pending' | 'failed' | 'ghost';

export function nodeKindOf(entry: Entry): NodeKind {
  if (entry.kind === 'story') {
    return entry.status === 'hold' ? 'hold' : entry.status === 'released' ? 'released' : entry.status === 'refunded' ? 'refunded' : 'out';
  }
  if (entry.tx.type === 'REDEMPTION') return 'points';
  return entry.tx.direction === 'CREDIT' ? 'in' : 'out';
}

export function NodeDot({ kind, className }: { kind: NodeKind; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block size-3.5 rounded-full ring-4 ring-background',
        kind === 'in' && 'bg-secondary',
        kind === 'out' && 'bg-primary dark:bg-ocean-light',
        kind === 'points' && 'bg-secondary-foreground',
        kind === 'hold' && 'border-2 border-dashed border-amber-500 bg-background',
        kind === 'released' && 'border-2 border-primary bg-background dark:border-ocean-light',
        kind === 'refunded' && 'border-[3px] border-secondary bg-primary dark:bg-ocean-light',
        kind === 'pending' && 'bg-secondary motion-safe:animate-pulse',
        kind === 'failed' && 'border-2 border-dashed border-rose-500 bg-background',
        kind === 'ghost' && 'border-2 border-dashed border-muted-foreground/50 bg-background',
        className,
      )}
    />
  );
}

const creditText = 'text-emerald-700 dark:text-emerald-400';

function Meta({ at }: { at: string }) {
  const locale = useLocale();
  return (
    <span className="text-xs text-muted-foreground">
      {formatDay(at, locale)} · {formatTime(at, locale)}
    </span>
  );
}

export function SingleWaypoint({ entry, shown, isNew }: { entry: SingleEntry; shown: boolean; isNew: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const { tx } = entry;
  const credit = tx.direction === 'CREDIT';
  const Icon =
    tx.type === 'REDEMPTION' ? Sparkles : tx.type === 'REFUND' ? Undo2 : tx.type === 'ADJUSTMENT' ? Settings2 : credit ? ArrowDownLeft : ArrowUpRight;
  const amount = toCents(tx.amount);

  return (
    <article className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 text-card-foreground sm:p-4">
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-xl',
          tx.type === 'REDEMPTION'
            ? 'bg-secondary-foreground/25 text-amber-800 dark:text-secondary-foreground'
            : credit
              ? 'bg-secondary/15 text-teal-700 dark:text-secondary'
              : 'bg-muted text-foreground',
        )}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="flex flex-wrap items-center gap-2 text-sm font-bold sm:text-base">
          {t.type[tx.type] ?? tx.type}
          {isNew && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-ocean-deep">{t.newBadge}</span>
          )}
        </h4>
        <Meta at={tx.createdAt} />
        {locale === 'en' && tx.description && tx.description !== t.type[tx.type] && (
          <p className="text-xs text-muted-foreground/90">{tx.description}</p>
        )}
      </div>
      <div className="shrink-0 text-end">
        <p className={cn('text-base font-extrabold sm:text-lg', credit && amount > 0n ? creditText : 'text-foreground')}>
          <Amount cents={credit ? amount : -amount} shown={shown} sign={credit} />
        </p>
        <p className="text-xs text-muted-foreground">
          {t.balanceAfter} <Amount cents={entry.balanceAfter} shown={shown} className="font-semibold text-foreground" />
        </p>
      </div>
    </article>
  );
}

const statusStyle = {
  hold: 'border border-dashed border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  paid: 'bg-primary text-primary-foreground dark:bg-ocean-light dark:text-ocean-deep',
  released: 'bg-muted text-foreground',
  refunded: 'bg-secondary/20 text-teal-800 dark:text-secondary',
} as const;

export function StoryWaypoint({ entry, shown }: { entry: StoryEntry; shown: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;
  const kind = entry.label?.kind ?? 'flight';
  const KindIcon = kind === 'hotel' ? BedDouble : kind === 'package' ? Package : Plane;
  const isHold = entry.status === 'hold';
  const explain = entry.status === 'hold' ? t.holdExplain : entry.status === 'released' ? t.releasedExplain : null;

  return (
    <article
      id={storyDomId(entry.paymentId)}
      tabIndex={-1}
      aria-labelledby={`${storyDomId(entry.paymentId)}-title`}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground outline-none focus:ring-[3px] focus:ring-amber-400 md:flex-row',
        isHold ? 'border-amber-400/70 dark:border-amber-400/40' : 'border-border',
      )}
    >
      <div className="min-w-0 flex-1 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="grid size-7 place-items-center rounded-lg bg-muted text-foreground" aria-hidden>
              <KindIcon className={cn('size-4', kind === 'flight' && 'rtl:-scale-x-100')} />
            </span>
            {t.bookingKind[kind]}
            {entry.label && (
              <bdi dir="ltr" className="font-mono tracking-wide">
                {entry.label.bookingRef}
              </bdi>
            )}
          </span>
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', statusStyle[entry.status])}>
            {t.status[entry.status]}
          </span>
        </div>
        <h4 id={`${storyDomId(entry.paymentId)}-title`} className="mt-2 text-base font-bold sm:text-lg">
          {entry.label?.title[locale] ?? t.unknownBooking}
        </h4>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p
            className={cn(
              'text-xl font-extrabold',
              isHold && 'text-amber-700 dark:text-amber-300',
              entry.status === 'released' && 'text-muted-foreground line-through decoration-2',
            )}
          >
            <Amount cents={isHold || entry.status === 'released' ? entry.amount : -entry.amount} shown={shown} />
          </p>
          {entry.refunded > 0n && (
            <p className={cn('text-sm font-bold', creditText)}>
              <Amount cents={entry.refunded} shown={shown} sign /> {t.status.refunded}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t.balanceAfter} <Amount cents={entry.balanceAfter} shown={shown} className="font-semibold text-foreground" />
          </p>
        </div>
        {(explain || entry.partial) && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{entry.partial ? t.partialSteps : explain}</p>
        )}
        <a
          href={`#booking-${entry.label?.bookingRef ?? entry.paymentId}`}
          onClick={(e) => e.preventDefault()}
          className="-ms-2 mt-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-bold text-teal-700 hover:underline focus-visible:ring-[3px] focus-visible:ring-secondary/60 focus-visible:outline-none dark:text-secondary"
        >
          {t.viewBooking}
          <Chevron className="size-4" aria-hidden />
        </a>
      </div>

      {/* Tear-off stub: the booking's money story in order. */}
      <div className="relative border-t-2 border-dashed border-border bg-muted/40 p-3.5 sm:p-4 md:w-60 md:shrink-0 md:border-t-0 md:border-s-2">
        <span aria-hidden className="absolute -top-2.5 -start-2.5 size-5 rounded-full border border-border bg-background" />
        <span
          aria-hidden
          className="absolute -top-2.5 -end-2.5 size-5 rounded-full border border-border bg-background md:top-auto md:-bottom-2.5 md:end-auto md:-start-2.5"
        />
        <ol className="flex flex-col gap-2.5">
          {entry.steps.map((step) => {
            return (
              <li key={step.tx.id} className="flex items-center gap-2.5 text-sm">
                <NodeDot
                  kind={step.kind === 'held' ? 'hold' : step.kind === 'paid' ? 'out' : step.kind === 'refunded' ? 'in' : 'released'}
                  className="size-2.5 ring-2 ring-muted"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.step[step.kind]}</span>
                  <span className="block text-xs text-muted-foreground">{formatTime(step.tx.createdAt, locale)}</span>
                </span>
                <span className={cn('text-xs font-bold', step.kind === 'refunded' && creditText)}>
                  <Amount cents={toCents(step.tx.amount)} shown={shown} sign={step.kind === 'refunded'} />
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </article>
  );
}
