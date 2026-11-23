/**
 * The panel as board rows. Each row flips down into place from its top edge, line by line, like a board updating;
 * each carries a status cell (a flap that reads new / read, and the time). A row that is read flips its status flap.
 */
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  Bell,
  CheckCheck,
  ChevronRight,
  MessagesSquare,
  Plane,
  RotateCw,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useLocale } from '@lab/i18n';
import { timeAgo, type InboxEntry, type InboxKind, type InboxTrip } from '@lab/mocks/notifications-inbox';
import { cn } from '@lab/utils';
import type { Messages } from '../i18n';
import { FlapCounter, FlapLetters, FlapTile } from './flap';

const KIND_ICONS: Record<InboxKind, LucideIcon> = {
  bookings: Plane,
  flights: Plane,
  payments: Wallet,
  wallet: Wallet,
  security: ShieldCheck,
  loyalty: Award,
  support: MessagesSquare,
};

/** Soft tint per kind on a neutral row, as the real page (notification-links.ts KIND_TONES). */
const KIND_TONES: Record<InboxKind, string> = {
  bookings: 'bg-(--action-soft) text-(--action-text)',
  flights: 'bg-(--action-soft) text-(--action-text)',
  payments: 'bg-(--brand-soft) text-(--brand-ink)',
  wallet: 'bg-(--brand-soft) text-(--brand-ink)',
  security: 'bg-(--success-soft) text-(--success-ink)',
  loyalty: 'bg-(--warning-soft) text-(--warning-ink)',
  support: 'bg-(--info-soft) text-(--info-ink)',
};

/** Row flip: top edge is the hinge; rows follow each other at `ROW_STEP_S`. */
export const ROW_STEP_S = 0.07;
const rowMotion = (delay: number) => ({
  initial: { rotateX: -90, opacity: 0 },
  animate: { rotateX: 0, opacity: 1, transition: { delay, duration: 0.42, ease: [0.2, 0.9, 0.3, 1.15] as const } },
  exit: { rotateX: 90, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' as const } },
  style: { transformPerspective: 900, transformOrigin: '50% 0%' },
});

export function KindIcon({ kind, className }: { kind: InboxKind; className?: string }) {
  const Icon = KIND_ICONS[kind];
  return (
    <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', KIND_TONES[kind], className)}>
      <Icon className="size-[45%]" />
    </span>
  );
}

/** The status cell: a flap with new / read, and the relative time under it. */
function StatusCell({ entry, t }: { entry: InboxEntry; t: Messages }) {
  const locale = useLocale();
  const unread = !entry.readAt;
  const longer = t.status.new.length >= t.status.read.length ? t.status.new : t.status.read;
  return (
    <span className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:col-start-auto sm:flex-col sm:items-end sm:gap-1.5">
      <span className="flex items-center gap-1.5">
        {unread && <span aria-hidden className="block size-2.5 rounded-full bg-(--action)" />}
        <FlapTile
          value={unread ? t.status.new : t.status.read}
          sizer={longer}
          className={cn(
            'h-7 px-2 text-sm font-bold',
            locale === 'en' && 'tracking-wider',
            unread ? 'text-(--lamp)' : 'text-(--flap-ink-muted)',
          )}
        />
        <span className="sr-only">{unread ? t.status.new : t.status.read}</span>
      </span>
      <time dateTime={entry.createdAt} className="text-sm whitespace-nowrap text-(--ink-muted)">
        {timeAgo(entry.minutesAgo, locale)}
      </time>
    </span>
  );
}

export function EntryRow({
  entry,
  index,
  baseDelay,
  t,
  onOpen,
}: {
  entry: InboxEntry;
  index: number;
  baseDelay: number;
  t: Messages;
  onOpen: (entry: InboxEntry) => void;
}) {
  const unread = !entry.readAt;
  const content = (
    <>
      <KindIcon kind={entry.kind} />
      <span className="min-w-0">
        <span className={cn('block text-[15px] leading-snug text-(--brand-ink)', unread ? 'font-bold' : 'font-semibold')}>
          {entry.title}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-(--ink-muted)">{entry.body}</span>
      </span>
      <StatusCell entry={entry} t={t} />
    </>
  );
  const className =
    'grid w-full grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 px-4 py-4 text-start sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:gap-4 sm:px-5';
  return (
    <motion.li layout="position" {...rowMotion(baseDelay + index * ROW_STEP_S)}>
      {unread ? (
        <button
          type="button"
          data-entry={entry.id}
          onClick={() => onOpen(entry)}
          className={cn(
            className,
            'cursor-pointer transition-colors hover:bg-(--surface-2) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--action-text)',
          )}
        >
          {content}
        </button>
      ) : (
        <div className={className}>{content}</div>
      )}
    </motion.li>
  );
}

export function TripRow({
  trip,
  index,
  baseDelay,
  t,
  onOpen,
}: {
  trip: InboxTrip;
  index: number;
  baseDelay: number;
  t: Messages;
  onOpen: (trip: InboxTrip) => void;
}) {
  const locale = useLocale();
  return (
    <motion.li layout="position" {...rowMotion(baseDelay + index * ROW_STEP_S)}>
      <button
        type="button"
        onClick={() => onOpen(trip)}
        aria-label={[t.trips.open(trip.reference), `${trip.route.from} - ${trip.route.to}`, trip.unread ? t.trips.unread(trip.unread) : ''].filter(Boolean).join(locale === 'ar' ? '، ' : ', ')}
        className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-start transition-colors hover:bg-(--surface-2) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--action-text) sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-5 sm:px-5"
      >
        <RouteTiles trip={trip} delay={(baseDelay + index * ROW_STEP_S) * 1000 + 120} className="col-span-2 sm:col-span-1" />
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-(--brand-ink)">{t.trips.booking(trip.reference)}</span>
          <span className="mt-0.5 block text-sm text-(--ink)">
            {trip.route.from} - {trip.route.to} · {trip.departs}
          </span>
          <span className="mt-1 block truncate text-sm text-(--ink-muted)">{trip.latest.title}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="flex flex-col items-end gap-1">
            {trip.unread > 0 ? (
              <FlapCounter value={trip.unread} tileClassName="h-7 w-[0.95rem] text-sm font-bold text-(--lamp)" />
            ) : (
              <span aria-hidden className="h-7" />
            )}
            <span className="text-sm whitespace-nowrap text-(--ink-muted)">
              {trip.unread > 0 ? t.trips.unreadWord : t.trips.total(trip.total)}
            </span>
          </span>
          <ChevronRight aria-hidden className={cn('size-5 shrink-0 text-(--ink-muted)', locale === 'ar' && '-scale-x-100')} />
        </span>
      </button>
    </motion.li>
  );
}

/** Route codes on letter flaps (they always read left to right, like on a real board). */
export function RouteTiles({ trip, delay, className }: { trip: InboxTrip; delay: number; className?: string }) {
  const tile = 'h-8 w-[1.15rem] text-[15px] font-bold text-(--flap-ink-active)';
  return (
    <span dir="ltr" aria-hidden className={cn('inline-flex items-center gap-1.5', className)}>
      <FlapLetters text={trip.route.fromCode} trigger={trip.bookingId} delay={delay} frames={4} tileClassName={tile} />
      <Plane className="size-4 text-(--ink-muted)" />
      <FlapLetters text={trip.route.toCode} trigger={trip.bookingId} delay={delay + 150} frames={4} tileClassName={tile} />
    </span>
  );
}

/** The board frame every list sits in. */
export function BoardList({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <ul
      aria-busy={busy || undefined}
      className="relative divide-y divide-(--line) overflow-hidden rounded-2xl border border-(--line) bg-(--card)"
    >
      {children}
    </ul>
  );
}

/** Loading: blank board rows waiting for their flaps. */
export function LoadingRows({ label }: { label: string }) {
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      <BoardList busy>
        {[0, 1, 2].map((i) => (
          <li key={i} aria-hidden className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
            <span className="size-10 rounded-xl bg-(--surface-3)" />
            <span className="flex flex-col gap-2">
              <span className="h-4 w-3/5 rounded bg-(--surface-3)" />
              <span className="h-3.5 w-4/5 rounded bg-(--surface-3)" />
            </span>
            <span className="h-7 w-14 rounded-[5px] bg-(--flap) opacity-80" />
          </li>
        ))}
      </BoardList>
    </div>
  );
}

const EMPTY_ICONS = { all: Bell, unread: CheckCheck, trips: Plane, thread: Plane } as const;

export function EmptyBoard({ kind, title, text }: { kind: keyof typeof EMPTY_ICONS; title: string; text: string }) {
  const Icon = EMPTY_ICONS[kind];
  return (
    <motion.div
      {...rowMotion(0)}
      className="flex flex-col items-center rounded-2xl border border-(--line) bg-(--card) px-6 py-12 text-center"
    >
      <span aria-hidden className="flex size-14 items-center justify-center rounded-xl bg-(--flap) text-(--lamp)">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 text-base font-bold text-(--brand-ink)">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-(--ink-muted)">{text}</p>
    </motion.div>
  );
}

export function ErrorBoard({ message, retry, onRetry }: { message: string; retry: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-(--line) bg-(--card) px-6 py-12 text-center">
      <span aria-hidden className="flex size-14 items-center justify-center rounded-xl bg-(--danger-soft) text-(--danger-ink)">
        <AlertTriangle className="size-6" />
      </span>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-(--ink)">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-(--action-soft) px-5 text-sm font-bold text-(--action-text) transition-colors hover:bg-(--action)/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--action-text)"
      >
        <RotateCw aria-hidden className="size-4" />
        {retry}
      </button>
    </div>
  );
}
