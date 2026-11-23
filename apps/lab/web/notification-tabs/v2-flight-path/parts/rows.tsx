/**
 * Panel content of v2-flight-path: entry rows, trip rows, and the empty / loading / error states. Rows are neutral
 * cards with a hairline (no coloured edges); colour lives only in the kind's icon tile and the unread dot.
 */
import { motion, type Variants } from 'framer-motion';
import {
  Award,
  ChevronRight,
  MessagesSquare,
  Plane,
  RotateCcw,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { timeAgo, type InboxEntry, type InboxKind, type InboxTrip } from '@lab/mocks/notifications-inbox';
import type { Locale } from '@lab/i18n';
import { cn } from '@lab/utils';

const KIND: Record<InboxKind, { icon: LucideIcon; tone: string }> = {
  bookings: { icon: Plane, tone: 'bg-(--action-soft) text-(--action-text)' },
  flights: { icon: Plane, tone: 'bg-(--action-soft) text-(--action-text)' },
  payments: { icon: Wallet, tone: 'bg-(--brand-soft) text-(--brand-ink)' },
  wallet: { icon: Wallet, tone: 'bg-(--brand-soft) text-(--brand-ink)' },
  security: { icon: ShieldCheck, tone: 'bg-(--success-soft) text-(--success-ink)' },
  loyalty: { icon: Award, tone: 'bg-(--warning-soft) text-(--warning-ink)' },
  support: { icon: MessagesSquare, tone: 'bg-(--info-soft) text-(--info-ink)' },
};

/** "Landing": each row comes down a few pixels into place, one after another, after the plane touches down. */
export const listVariants: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.055, delayChildren: 0.08 } },
};
export const rowVariants: Variants = {
  hidden: { opacity: 0, y: -14 },
  shown: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 30 } },
};

const card =
  'flex w-full items-start gap-3 rounded-2xl border border-(--line) bg-(--card) p-4 text-start transition-colors';
const interactive =
  'cursor-pointer hover:border-(--border-strong) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand)';

export function KindTile({ kind, className }: { kind: InboxKind; className?: string }) {
  const { icon: Icon, tone } = KIND[kind];
  return (
    <span aria-hidden className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', tone, className)}>
      <Icon className="size-5" />
    </span>
  );
}

export function EntryRow({
  entry,
  locale,
  unreadLabel,
  onOpen,
}: {
  entry: InboxEntry;
  locale: Locale;
  unreadLabel: string;
  onOpen: (id: string) => void;
}) {
  const unread = !entry.readAt;
  const time = (
    <time dateTime={entry.createdAt} className="tnum shrink-0 text-sm text-(--ink-muted)">
      {timeAgo(entry.minutesAgo, locale)}
    </time>
  );
  const content = (
    <>
      <KindTile kind={entry.kind} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-3">
          <span
            className={cn(
              'min-w-0 flex-1 text-[15px] leading-snug text-(--brand-ink)',
              unread ? 'font-bold' : 'font-semibold',
            )}
          >
            {entry.title}
          </span>
          <span className="hidden sm:block">{time}</span>
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-(--ink-muted)">{entry.body}</span>
        <span className="mt-1.5 block sm:hidden">{time}</span>
      </span>
      {unread && (
        <span className="mt-1.5 block size-2.5 shrink-0 rounded-full bg-(--action-text)">
          <span className="sr-only">{unreadLabel}</span>
        </span>
      )}
    </>
  );
  return unread ? (
    <button type="button" onClick={() => onOpen(entry.id)} className={cn(card, interactive)}>
      {content}
    </button>
  ) : (
    <div className={card}>{content}</div>
  );
}

/** A small dashed arc between the two airport codes, the same line as the tabs. */
function MiniRoute({ from, to, label }: { from: string; to: string; label: string }) {
  return (
    <span className="flex items-center gap-2" aria-label={label} role="img">
      <span className="tnum text-base font-bold tracking-wide text-(--brand-ink)">{from}</span>
      <svg aria-hidden viewBox="0 0 56 16" className="h-4 w-14 shrink-0 rtl:-scale-x-100">
        <path d="M2 14 Q28 -6 54 14" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" strokeDasharray="2 4" strokeLinecap="round" />
        <circle cx="2" cy="14" r="2" fill="var(--brand)" />
        <circle cx="54" cy="14" r="2" fill="var(--highlight)" />
      </svg>
      <span className="tnum text-base font-bold tracking-wide text-(--brand-ink)">{to}</span>
    </span>
  );
}

export function TripRow({
  trip,
  locale,
  t,
  onOpen,
}: {
  trip: InboxTrip;
  locale: Locale;
  t: {
    booking: (r: string) => string;
    unread: (n: number) => string;
    total: (n: number) => string;
    departs: string;
    routeAria: (a: string, b: string) => string;
  };
  onOpen: (bookingId: string) => void;
}) {
  return (
    <button type="button" onClick={() => onOpen(trip.bookingId)} className={cn(card, interactive, 'items-center')}>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <MiniRoute
            from={trip.route.fromCode}
            to={trip.route.toCode}
            label={t.routeAria(trip.route.from, trip.route.to)}
          />
          <time dateTime={trip.latest.createdAt} className="tnum text-sm text-(--ink-muted)">
            {timeAgo(trip.latest.minutesAgo, locale)}
          </time>
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-(--ink)">
          {trip.route.from} · {trip.route.to}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="tnum text-(--ink-muted)">{t.booking(trip.reference)}</span>
          <span aria-hidden className="hidden text-(--ink-subtle) sm:inline">·</span>
          <span className="text-(--ink-muted)">
            {t.departs} <span className="tnum font-semibold text-(--ink)">{trip.departs}</span>
          </span>
        </span>
        <span className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
          {trip.unread > 0 && (
            <span className="rounded-full bg-(--action-soft) px-2.5 py-0.5 font-bold text-(--action-text)">
              {t.unread(trip.unread)}
            </span>
          )}
          <span className="text-(--ink-muted)">{t.total(trip.total)}</span>
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-(--ink-muted) rtl:-scale-x-100" aria-hidden />
    </button>
  );
}

/** Empty state: a parked plane on a short dashed runway, the concept's own picture. */
export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="relative flex size-16 items-center justify-center rounded-full border border-(--line) bg-(--surface-2) text-(--brand-ink)">
        <Icon className="size-7" aria-hidden />
      </span>
      <svg aria-hidden viewBox="0 0 120 8" className="mt-3 h-2 w-28">
        <path d="M2 4 H118" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
      </svg>
      <p className="mt-3 text-base font-bold text-(--brand-ink)">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-(--ink-muted)">{text}</p>
    </div>
  );
}

export function LoadError({ message, retry, onRetry }: { message: string; retry: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-2xl border border-(--line) px-4 py-8 text-center">
      <p className="text-sm text-(--danger-ink)">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-(--surface-3) px-5 text-sm font-bold text-(--ink) hover:bg-(--line) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand)"
      >
        <RotateCcw className="size-4" aria-hidden />
        {retry}
      </button>
    </div>
  );
}

export function ListSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="space-y-3">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((key) => (
        <div key={key} className="flex gap-3 rounded-2xl border border-(--line) p-4">
          <span className="size-11 shrink-0 animate-pulse rounded-2xl bg-(--surface-3)" />
          <span className="flex-1 space-y-2 pt-1">
            <span className="block h-3.5 w-2/3 animate-pulse rounded bg-(--surface-3)" />
            <span className="block h-3 w-full animate-pulse rounded bg-(--surface-3)" />
          </span>
        </div>
      ))}
    </div>
  );
}

