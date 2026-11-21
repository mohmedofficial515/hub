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
import { LabLink } from './lab-link';
import { toCents } from './money';
import { bookingHref } from './search-href';
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

function Meta({ at, className }: { at: string; className?: string }) {
  const locale = useLocale();
  return (
    <span className={cn('text-xs text-muted-foreground', className)}>
      {formatDay(at, locale)} · {formatTime(at, locale)}
    </span>
  );
}

function AvailableAfter({ cents, shown }: { cents: bigint; shown: boolean }) {
  const t = useT(messages);
  return (
    <span className="text-xs text-muted-foreground">
      {t.availableAfter} <Amount cents={cents} shown={shown} className="font-semibold text-foreground" />
    </span>
  );
}

/** Compact one-line movement: icon · label + time · amount, with "available after" under the amount. */
export function SingleWaypoint({ entry, shown, isNew }: { entry: SingleEntry; shown: boolean; isNew: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const { tx } = entry;
  const credit = tx.direction === 'CREDIT';
  const Icon =
    tx.type === 'REDEMPTION' ? Sparkles : tx.type === 'REFUND' ? Undo2 : tx.type === 'ADJUSTMENT' ? Settings2 : credit ? ArrowDownLeft : ArrowUpRight;
  const amount = toCents(tx.amount);

  return (
    <article className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-card-foreground sm:px-4">
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-xl',
          tx.type === 'REDEMPTION'
            ? 'bg-secondary-foreground/25 text-amber-800 dark:text-secondary-foreground'
            : credit
              ? 'bg-secondary/15 text-teal-700 dark:text-secondary'
              : 'bg-muted text-foreground',
        )}
        aria-hidden
      >
        <Icon className="size-[1.15rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="flex flex-wrap items-center gap-x-2 text-sm font-bold">
          {t.type[tx.type] ?? tx.type}
          {isNew && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-ocean-deep">{t.newBadge}</span>}
        </h4>
        <p className="truncate text-xs text-muted-foreground">
          <Meta at={tx.createdAt} />
          {locale === 'en' && tx.description && tx.description !== t.type[tx.type] && <> · {tx.description}</>}
        </p>
      </div>
      <div className="shrink-0 text-end leading-tight">
        <p className={cn('text-base font-extrabold', credit && amount > 0n ? creditText : 'text-foreground')}>
          <Amount cents={credit ? amount : -amount} shown={shown} sign={credit} />
        </p>
        <AvailableAfter cents={entry.availableAfter} shown={shown} />
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

/**
 * A booking's money story as one compact boarding pass. The perforated step strip appears only when the story
 * has more than one step; a single hold gets a one-line explanation instead of an empty stub.
 */
export function StoryWaypoint({ entry, shown }: { entry: StoryEntry; shown: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;
  const kind = entry.label?.kind ?? 'flight';
  const KindIcon = kind === 'hotel' ? BedDouble : kind === 'package' ? Package : Plane;
  const isHold = entry.status === 'hold';
  const explain = entry.partial ? t.partialSteps : isHold ? t.holdExplain : entry.status === 'released' ? t.releasedExplain : null;
  const multi = entry.steps.length > 1;
  const id = storyDomId(entry.paymentId);

  return (
    <article
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      className={cn(
        'rounded-2xl border bg-card px-3 pt-2.5 text-card-foreground outline-none focus:ring-[3px] focus:ring-amber-400 sm:px-4',
        isHold ? 'border-amber-400/70 dark:border-amber-400/40' : 'border-border',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground" aria-hidden>
          <KindIcon className={cn('size-[1.15rem]', kind === 'flight' && 'rtl:-scale-x-100')} />
        </span>
        <div className="min-w-0 flex-1">
          <h4 id={`${id}-title`} className="line-clamp-2 text-sm font-bold sm:text-base">
            {entry.label?.title[locale] ?? t.unknownBooking}
          </h4>
          <p className="flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">
              {t.bookingKind[kind]}
              {entry.label && (
                <>
                  {' · '}
                  <bdi dir="ltr" className="font-mono tracking-wide">
                    {entry.label.bookingRef}
                  </bdi>
                </>
              )}
            </span>
            <span aria-hidden>·</span>
            <Meta at={entry.at} className="whitespace-nowrap" />
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 leading-tight">
          <p
            className={cn(
              'text-base font-extrabold',
              isHold && 'text-amber-700 dark:text-amber-300',
              entry.status === 'released' && 'text-muted-foreground line-through decoration-2',
            )}
          >
            <Amount cents={isHold || entry.status === 'released' ? entry.amount : -entry.amount} shown={shown} />
          </p>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', statusStyle[entry.status])}>{t.status[entry.status]}</span>
        </div>
      </div>

      {multi && (
        // Perforated strip: the booking's steps in order, inline.
        <ol className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed border-border pt-2 text-xs">
          {entry.steps.map((step, i) => (
            <li key={step.tx.id} className="flex items-center gap-1.5">
              {i > 0 && (
                <Chevron className="size-3 text-muted-foreground" aria-hidden />
              )}
              <NodeDot
                kind={step.kind === 'held' ? 'hold' : step.kind === 'paid' ? 'out' : step.kind === 'refunded' ? 'in' : 'released'}
                className="size-2.5 ring-0"
              />
              <span className="font-semibold">{t.step[step.kind]}</span>
              <span className="text-muted-foreground">{formatTime(step.tx.createdAt, locale)}</span>
              <span className={cn('font-bold', step.kind === 'refunded' && creditText)}>
                <Amount cents={toCents(step.tx.amount)} shown={shown} sign={step.kind === 'refunded'} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {explain && (
        <p className={cn('mt-1.5 text-xs leading-relaxed', isHold ? 'text-amber-800 dark:text-amber-200' : 'text-muted-foreground')}>
          {explain}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <AvailableAfter cents={entry.availableAfter} shown={shown} />
        <LabLink
          href={bookingHref(locale, entry.label?.bookingRef ?? entry.paymentId)}
          className="-me-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-bold text-teal-700 hover:underline focus-visible:ring-[3px] focus-visible:ring-secondary/60 focus-visible:outline-none dark:text-secondary"
        >
          {t.viewBooking}
          <Chevron className="size-4" aria-hidden />
        </LabLink>
      </div>
    </article>
  );
}
