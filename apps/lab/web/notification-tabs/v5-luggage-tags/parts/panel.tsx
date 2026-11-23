/**
 * The tab panel as a baggage belt: rows roll in from the inline start one after another and leave toward the
 * inline end. Holds the entry list, the trips list, a trip's thread, and the loading, empty and error states.
 */
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
  ArrowLeft,
  Award,
  CheckCheck,
  ChevronRight,
  Inbox,
  MessagesSquare,
  MoveRight,
  Plane,
  RotateCw,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Locale } from '@lab/i18n';
import { timeAgo, type InboxEntry, type InboxKind, type InboxTrip } from '@lab/mocks/notifications-inbox';
import { cn } from '@lab/utils';
import type { Messages } from '../i18n';

/** `dir` is +1 when the inline end is to the right (LTR), -1 in RTL. */
export function beltVariants(dir: number) {
  const list: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
    exit: { opacity: 0, x: dir * 56, transition: { duration: 0.2, ease: 'easeIn' } },
  };
  const item: Variants = {
    hidden: { opacity: 0, x: -dir * 88 },
    show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    exit: { opacity: 0, x: dir * 88, transition: { duration: 0.22, ease: 'easeIn' } },
  };
  return { list, item };
}

type Belt = ReturnType<typeof beltVariants>;

/** The belt itself under the tags: a dashed line between two rollers; it runs when the panel changes. */
export function BeltLine({ travel, dir }: { travel: number; dir: number }) {
  return (
    <div aria-hidden className="relative h-3">
      <span className="absolute start-0 top-0 size-3 rounded-full border border-(--border-strong) bg-(--card)" />
      <span className="absolute end-0 top-0 size-3 rounded-full border border-(--border-strong) bg-(--card)" />
      <svg className="absolute inset-x-3.5 top-0 h-3 w-[calc(100%-1.75rem)] overflow-visible">
        <motion.line
          x1="0"
          x2="100%"
          y1="6"
          y2="6"
          stroke="var(--border-strong)"
          strokeWidth={1.5}
          strokeDasharray="10 7"
          strokeLinecap="round"
          initial={false}
          animate={{ strokeDashoffset: -dir * travel * 68 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    </div>
  );
}

const KIND: Record<InboxKind, { icon: LucideIcon; tone: string }> = {
  bookings: { icon: Plane, tone: 'bg-(--action-soft) text-(--action-text)' },
  flights: { icon: Plane, tone: 'bg-(--action-soft) text-(--action-text)' },
  support: { icon: MessagesSquare, tone: 'bg-(--info-soft) text-(--info-ink)' },
  loyalty: { icon: Award, tone: 'bg-(--warning-soft) text-(--warning-ink)' },
  security: { icon: ShieldCheck, tone: 'bg-(--success-soft) text-(--success-ink)' },
  payments: { icon: Wallet, tone: 'bg-(--brand-soft) text-(--brand-ink)' },
  wallet: { icon: Wallet, tone: 'bg-(--brand-soft) text-(--brand-ink)' },
};

function KindTile({ kind, className }: { kind: InboxKind; className?: string }) {
  const { icon: Icon, tone } = KIND[kind];
  return (
    <span aria-hidden className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', tone, className)}>
      <Icon className="size-5" />
    </span>
  );
}

const rowFrame =
  'flex w-full items-start gap-3 rounded-2xl border border-(--line) bg-(--card) p-4 text-start transition-colors';
const rowAction =
  'cursor-pointer hover:border-(--border-strong) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)';

export function EntryList({
  entries,
  belt,
  locale,
  t,
  onOpen,
}: {
  entries: InboxEntry[];
  belt: Belt;
  locale: Locale;
  t: Messages;
  onOpen: (id: string) => void;
}) {
  return (
    <motion.ul variants={belt.list} initial="hidden" animate="show" exit="exit" className="space-y-3">
      <AnimatePresence initial={false}>
        {entries.map((entry) => (
          <motion.li key={entry.id} layout="position" variants={belt.item} initial="hidden" animate="show" exit="exit">
            <EntryRow entry={entry} locale={locale} t={t} onOpen={onOpen} />
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}

function EntryRow({
  entry,
  locale,
  t,
  onOpen,
}: {
  entry: InboxEntry;
  locale: Locale;
  t: Messages;
  onOpen: (id: string) => void;
}) {
  const unread = !entry.readAt;
  const time = (
    <time dateTime={entry.createdAt} className="shrink-0 text-sm text-(--ink-muted)">
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
          <span className="mt-0.5 hidden sm:block">{time}</span>
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-(--ink-muted)">{entry.body}</span>
        <span className="mt-1.5 block sm:hidden">{time}</span>
      </span>
      <AnimatePresence initial={false}>
        {unread && (
          <motion.span
            key="dot"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="mt-2 block size-2.5 shrink-0 rounded-full bg-(--action)"
          >
            <span className="sr-only">{t.unread}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </>
  );
  return unread ? (
    <button type="button" onClick={() => onOpen(entry.id)} className={cn(rowFrame, rowAction)}>
      {content}
    </button>
  ) : (
    <div className={rowFrame}>{content}</div>
  );
}

function Route({ trip, big }: { trip: InboxTrip; big?: boolean }) {
  return (
    <span dir="ltr" className={cn('inline-flex items-center gap-2 font-bold text-(--brand-ink) tnum', big ? 'text-2xl' : 'text-lg')}>
      <span>{trip.route.fromCode}</span>
      <MoveRight aria-hidden className={cn('text-(--ink-muted)', big ? 'size-5' : 'size-4')} />
      <span>{trip.route.toCode}</span>
    </span>
  );
}

export function TripsList({
  trips,
  belt,
  t,
  onOpen,
}: {
  trips: InboxTrip[];
  belt: Belt;
  t: Messages;
  onOpen: (bookingId: string) => void;
}) {
  return (
    <motion.ul variants={belt.list} initial="hidden" animate="show" exit="exit" className="space-y-3">
      {trips.map((trip) => (
        <motion.li key={trip.bookingId} variants={belt.item}>
          <button type="button" onClick={() => onOpen(trip.bookingId)} className={cn(rowFrame, rowAction, 'items-center')}>
            <KindTile kind="bookings" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Route trip={trip} />
                <span className="sr-only">{t.trips.route(trip.route.from, trip.route.to)}</span>
                <span className="text-sm font-semibold text-(--ink)">{t.trips.booking(trip.reference)}</span>
              </span>
              <span className="mt-1 block truncate text-sm text-(--ink-muted)">
                {trip.departs} · {trip.latest.title}
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {trip.unread > 0 && (
                  <span className="rounded-full bg-(--action-soft) px-2.5 py-0.5 font-bold text-(--action-text)">
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
    </motion.ul>
  );
}

export function TripThread({
  trip,
  entries,
  belt,
  locale,
  t,
  onBack,
  onOpen,
}: {
  trip: InboxTrip;
  entries: InboxEntry[];
  belt: Belt;
  locale: Locale;
  t: Messages;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <motion.div variants={belt.list} initial="hidden" animate="show" exit="exit">
      <motion.div variants={belt.item} className="mb-4">
        <button
          type="button"
          onClick={onBack}
          className="-ms-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-(--action-text) hover:underline focus-visible:outline-2 focus-visible:outline-(--ring)"
        >
          <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" /> {t.trips.back}
        </button>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div>
            <h2 className="text-lg font-bold text-(--brand-ink)">{t.trips.booking(trip.reference)}</h2>
            <p className="text-sm text-(--ink-muted)">{t.trips.threadSubtitle}</p>
          </div>
          <div className="text-end">
            <Route trip={trip} big />
            <p className="text-sm text-(--ink-muted)">{trip.departs}</p>
          </div>
        </div>
      </motion.div>
      {entries.length ? (
        <EntryList entries={entries} belt={belt} locale={locale} t={t} onOpen={onOpen} />
      ) : (
        <EmptyState icon={Plane} title={t.empty.threadTitle} text={t.empty.threadText} belt={belt} />
      )}
    </motion.div>
  );
}

export const EMPTY_ICONS = { all: Inbox, unread: CheckCheck, trips: Plane } as const;

export function EmptyState({ icon: Icon, title, text, belt }: { icon: LucideIcon; title: string; text: string; belt: Belt }) {
  return (
    <motion.div
      variants={belt.item}
      initial="hidden"
      animate="show"
      exit="exit"
      className="flex flex-col items-center px-4 py-10 text-center"
    >
      <span className="flex size-16 items-center justify-center rounded-full border border-dashed border-(--border-strong) text-(--brand-ink)">
        <Icon aria-hidden className="size-7" />
      </span>
      <p className="mt-4 text-base font-bold text-(--brand-ink)">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-(--ink-muted)">{text}</p>
    </motion.div>
  );
}

export function LoadingRows({ t }: { t: Messages }) {
  return (
    <div aria-busy="true" className="space-y-3">
      <span className="sr-only">{t.loading}</span>
      {[0, 1, 2].map((k) => (
        <div key={k} className="flex items-start gap-3 rounded-2xl border border-(--line) p-4">
          <span className="size-11 shrink-0 rounded-xl bg-(--surface-3) motion-safe:animate-pulse" />
          <span className="flex-1 space-y-2 pt-1">
            <span className="block h-3.5 w-2/3 rounded bg-(--surface-3) motion-safe:animate-pulse" />
            <span className="block h-3 w-full rounded bg-(--surface-3) motion-safe:animate-pulse" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function LoadError({ t, onRetry, belt }: { t: Messages; onRetry: () => void; belt: Belt }) {
  return (
    <motion.div
      role="alert"
      variants={belt.item}
      initial="hidden"
      animate="show"
      exit="exit"
      className="flex flex-col items-center gap-4 rounded-2xl border border-(--line) px-4 py-8 text-center"
    >
      <p className="text-sm text-(--danger-ink)">{t.loadError}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-(--border-strong) px-4 text-sm font-bold text-(--brand-ink) hover:bg-(--surface-2) focus-visible:outline-2 focus-visible:outline-(--ring)"
      >
        <RotateCw aria-hidden className="size-4" /> {t.retry}
      </button>
    </motion.div>
  );
}
