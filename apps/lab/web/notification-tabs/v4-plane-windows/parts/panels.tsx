/**
 * What the tray holds: the entry list (all / unread / a trip's thread), the trips list, the empty state and the
 * loading rows. Rows are neutral (hairline border, no coloured edges); only the kind's icon tile carries a tint.
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Award,

  CheckCheck,
  ChevronRight,
  CreditCard,
  MessagesSquare,
  Plane,
  ShieldCheck,
  Ticket,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { timeAgo, type InboxEntry, type InboxKind, type InboxTrip } from '@lab/mocks/notifications-inbox';
import type { Locale } from '@lab/i18n';
import { cn } from '@lab/utils';
import type { Messages } from '../i18n';

const KIND: Record<InboxKind, { icon: LucideIcon; tone: string }> = {
  flights: { icon: Plane, tone: 'bg-(--action-soft) text-(--action-text)' },
  bookings: { icon: Ticket, tone: 'bg-(--action-soft) text-(--action-text)' },
  payments: { icon: CreditCard, tone: 'bg-(--brand-soft) text-(--brand-ink)' },
  wallet: { icon: Wallet, tone: 'bg-(--brand-soft) text-(--brand-ink)' },
  security: { icon: ShieldCheck, tone: 'bg-(--success-soft) text-(--success-ink)' },
  loyalty: { icon: Award, tone: 'bg-(--warning-soft) text-(--warning-ink)' },
  support: { icon: MessagesSquare, tone: 'bg-(--info-soft) text-(--info-ink)' },
};

const rowBase =
  'flex w-full items-start gap-3 rounded-2xl border border-(--line) bg-(--card) p-4 text-start transition-colors';
const rowAction =
  'cursor-pointer hover:border-(--border-strong) hover:bg-(--surface-2) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)';

function KindTile({ kind, className }: { kind: InboxKind; className?: string }) {
  const { icon: Icon, tone } = KIND[kind];
  return (
    <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', tone, className)}>
      <Icon className="v4-icon" />
    </span>
  );
}

const rowMotion = (i: number) => ({
  layout: true as const,
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0, transition: { delay: 0.12 + i * 0.045, duration: 0.3, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.25 } },
});

export function EntryList({
  t,
  locale,
  entries,
  onOpen,
}: {
  t: Messages;
  locale: Locale;
  entries: InboxEntry[];
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="space-y-3">
      <AnimatePresence initial={true}>
        {entries.map((e, i) => {
          const unread = !e.readAt;
          const content = (
            <>
              <KindTile kind={e.kind} />
              <span className="min-w-0 flex-1">
                <span className="flex items-start gap-3">
                  <span
                    className={cn(
                      'min-w-0 flex-1 text-sm leading-snug text-(--brand-ink)',
                      unread ? 'font-bold' : 'font-semibold',
                    )}
                  >
                    {e.title}
                  </span>
                  <time dateTime={e.createdAt} className="mt-0.5 hidden shrink-0 text-xs text-(--ink-muted) sm:block">
                    {timeAgo(e.minutesAgo, locale)}
                  </time>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-(--ink)">{e.body}</span>
                <time dateTime={e.createdAt} className="mt-1.5 block text-xs text-(--ink-muted) sm:hidden">
                  {timeAgo(e.minutesAgo, locale)}
                </time>
              </span>
              {unread && (
                <span className="mt-1.5 block size-2.5 shrink-0 rounded-full bg-(--action-text)">
                  <span className="sr-only">{t.unread}</span>
                </span>
              )}
            </>
          );
          return (
            <motion.li key={e.id} {...rowMotion(i)}>
              {unread ? (
                <button type="button" onClick={() => onOpen(e.id)} className={cn(rowBase, rowAction)}>
                  {content}
                </button>
              ) : (
                <div className={rowBase}>{content}</div>
              )}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

function Route({ trip }: { trip: InboxTrip }) {
  return (
    <span className="flex items-center gap-2">
      <span className="tnum text-base font-bold text-(--brand-ink)">{trip.route.fromCode}</span>
      <ArrowRight aria-hidden className="size-4 text-(--ink-muted) rtl:-scale-x-100" />
      <span className="tnum text-base font-bold text-(--brand-ink)">{trip.route.toCode}</span>
      <span className="hidden truncate text-sm text-(--ink-muted) sm:inline">
        {trip.route.from} · {trip.route.to}
      </span>
    </span>
  );
}

export function TripsList({
  t,
  locale,
  trips,
  onOpen,
}: {
  t: Messages;
  locale: Locale;
  trips: InboxTrip[];
  onOpen: (bookingId: string) => void;
}) {
  return (
    <ul className="space-y-3">
      {trips.map((trip, i) => (
        <motion.li key={trip.bookingId} {...rowMotion(i)}>
          <button type="button" onClick={() => onOpen(trip.bookingId)} className={cn(rowBase, rowAction, 'items-center')}>
            <KindTile kind="flights" />
            <span className="min-w-0 flex-1">
              <span className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <Route trip={trip} />
                </span>
                <time dateTime={trip.latest.createdAt} className="mt-1 shrink-0 text-xs text-(--ink-muted)">
                  {timeAgo(trip.latest.minutesAgo, locale)}
                </time>
              </span>
              <span className="mt-1 block truncate text-sm text-(--ink)">{trip.latest.title}</span>
              <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                <span className="tnum font-semibold text-(--ink)">{t.trips.booking(trip.reference)}</span>
                <span className="text-(--ink-muted)">
                  {t.trips.departs}: {trip.departs}
                </span>
                {trip.unread > 0 && (
                  <span className="rounded-full bg-(--action-soft) px-2 py-0.5 font-bold text-(--action-text)">
                    {t.trips.unread(trip.unread)}
                  </span>
                )}
                <span className="text-(--ink-muted)">{t.trips.total(trip.total)}</span>
              </span>
            </span>
            <ChevronRight aria-hidden className="size-5 shrink-0 text-(--ink-muted) rtl:-scale-x-100" />
          </button>
        </motion.li>
      ))}
    </ul>
  );
}

export function ThreadHeader({ t, trip, onBack }: { t: Messages; trip: InboxTrip; onBack: () => void }) {
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={onBack}
        className="-ms-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-(--action-text) hover:bg-(--action-soft) focus-visible:outline-2 focus-visible:outline-(--ring)"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
        {t.trips.back}
      </button>
      <div className="mt-2 flex items-center gap-3 rounded-2xl bg-(--surface-2) p-4">
        <KindTile kind="flights" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-(--brand-ink)">{t.trips.booking(trip.reference)}</h3>
          <Route trip={trip} />
          <p className="mt-1 text-sm text-(--ink)">{t.trips.threadSubtitle}</p>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  text,
  icon: Icon = CheckCheck,
}: {
  title: string;
  text: string;
  icon?: LucideIcon;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1, duration: 0.3 }}
      className="flex flex-col items-center px-4 py-12 text-center"
    >
      <span className="flex size-16 items-center justify-center rounded-full border border-(--line) bg-(--surface-2) text-(--brand-ink)">
        <Icon aria-hidden className="size-7" />
      </span>
      <h3 className="mt-4 text-base font-bold text-(--brand-ink)">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-(--ink)">{text}</p>
    </motion.div>
  );
}


export function ListSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3" aria-busy="true">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((k) => (
        <div key={k} className="flex items-start gap-3 rounded-2xl border border-(--line) p-4">
          <span className="size-10 shrink-0 animate-pulse rounded-2xl bg-(--surface-3)" />
          <span className="flex-1 space-y-2 pt-1">
            <span className="block h-3.5 w-2/3 animate-pulse rounded bg-(--surface-3)" />
            <span className="block h-3 w-full animate-pulse rounded bg-(--surface-3)" />
          </span>
        </div>
      ))}
    </div>
  );
}
