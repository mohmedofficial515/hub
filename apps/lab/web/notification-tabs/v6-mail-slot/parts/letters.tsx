/**
 * What comes out of the open envelope: entries and trips as letter cards (a thin outline and a small folded corner,
 * no coloured edges), the empty envelope, the loading and error states, and the small letter that flies into the
 * stamp when an entry is read.
 */
import { forwardRef } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
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
import type { Messages } from '../i18n';

const KIND: Record<InboxKind, { icon: LucideIcon; tone: string }> = {
  bookings: { icon: Plane, tone: 'bg-(--action-soft) text-(--action-text)' },
  flights: { icon: Plane, tone: 'bg-(--action-soft) text-(--action-text)' },
  payments: { icon: Wallet, tone: 'bg-(--brand-soft) text-(--brand-ink)' },
  wallet: { icon: Wallet, tone: 'bg-(--brand-soft) text-(--brand-ink)' },
  security: { icon: ShieldCheck, tone: 'bg-(--success-soft) text-(--success-ink)' },
  loyalty: { icon: Award, tone: 'bg-(--warning-soft) text-(--warning-ink)' },
  support: { icon: MessagesSquare, tone: 'bg-(--info-soft) text-(--info-ink)' },
};

/** A letter pulled out of the envelope: it rises from below, tilted a little, and settles. */
export const letterVariants: Variants = {
  hidden: { opacity: 0, y: 36, rotate: -1.2, scale: 0.97 },
  shown: (i: number) => ({
    opacity: 1,
    y: 0,
    rotate: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 26, delay: 0.18 + Math.min(i, 8) * 0.055 },
  }),
  gone: { opacity: 0, y: 22, scale: 0.98, transition: { duration: 0.16, ease: 'easeIn' } },
};

const cardClass =
  'group relative flex w-full cursor-pointer items-start gap-3 rounded-xl border bg-(--card) p-4 text-start transition-colors outline-none hover:border-(--brand)/45 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--background)';

/** The folded top corner that makes a card read as a letter. */
function DogEar() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -top-px -end-px size-3.5 rounded-es-[4px] border-s border-b border-(--line) bg-(--surface-3)"
      style={{ clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }}
    />
  );
}

export function KindTile({ kind }: { kind: InboxKind }) {
  const { icon: Icon, tone } = KIND[kind];
  return (
    <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tone)}>
      <Icon className="size-[18px]" />
    </span>
  );
}

/** Unread: a teal dot. Read: the dot is sealed into a small check. */
function Seal({ unread, t }: { unread: boolean; t: Messages }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center">
      <AnimatePresence initial={false} mode="popLayout">
        {unread ? (
          <motion.span
            key="dot"
            data-dot
            className="block size-2.5 rounded-full bg-(--action)"
            exit={{ scale: 0, opacity: 0, transition: { duration: 0.18 } }}
          >
            <span className="sr-only">{t.unread}</span>
          </motion.span>
        ) : (
          <motion.svg
            key="check"
            viewBox="0 0 20 20"
            className="size-5 text-(--ink-muted)"
            initial={reduce ? false : { scale: 0.4, rotate: -40, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.1 }}
          >
            <title>{t.read}</title>
            <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.25" opacity="0.55" />
            <motion.path
              d="M6.4 10.3l2.4 2.4 4.8-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.32, delay: 0.2 }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </span>
  );
}

export const EntryLetter = forwardRef<
  HTMLButtonElement,
  { entry: InboxEntry; locale: Locale; t: Messages; onOpen: (entry: InboxEntry, el: HTMLButtonElement) => void }
>(function EntryLetter({ entry, locale, t, onOpen }, ref) {
  const unread = !entry.readAt;
  return (
    <button
      ref={ref}
      id={`letter-${entry.id}`}
      type="button"
      onClick={(event) => onOpen(entry, event.currentTarget)}
      className={cn(cardClass, unread ? 'border-(--border-strong)' : 'border-(--line)')}
    >
      <DogEar />
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
          <time dateTime={entry.createdAt} className="tnum shrink-0 pt-px text-sm text-(--ink-muted)">
            {timeAgo(entry.minutesAgo, locale)}
          </time>
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-(--ink)">{entry.body}</span>
      </span>
      <span className="self-center">
        <Seal unread={unread} t={t} />
      </span>
    </button>
  );
});

function Route({ trip }: { trip: InboxTrip }) {
  return (
    <span className="tnum flex items-center gap-1.5 text-base font-bold tracking-wide text-(--brand-ink)">
      <span>{trip.route.fromCode}</span>
      <ArrowRight aria-hidden className="size-4 text-(--ink-muted) rtl:-scale-x-100" />
      <span>{trip.route.toCode}</span>
    </span>
  );
}

export function TripLetter({ trip, t, onOpen }: { trip: InboxTrip; t: Messages; onOpen: () => void }) {
  return (
    <button
      type="button"
      id={`trip-${trip.bookingId}`}
      onClick={onOpen}
      className={cn(cardClass, 'items-center', trip.unread ? 'border-(--border-strong)' : 'border-(--line)')}
    >
      <DogEar />
      <KindTile kind="bookings" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Route trip={trip} />
          <span className="text-sm font-semibold text-(--ink)">{t.trips.booking(trip.reference)}</span>
        </span>
        <span className="mt-1 block truncate text-sm text-(--ink)">{trip.latest.title}</span>
        <span className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {trip.unread > 0 && (
            <span className="rounded-full bg-(--action-soft) px-2.5 py-0.5 font-bold text-(--action-text)">
              {t.trips.unread(trip.unread)}
            </span>
          )}
          <span className="text-(--ink-muted)">
            {t.trips.departs}: {trip.departs}
          </span>
          <span aria-hidden className="text-(--ink-subtle)">
            ·
          </span>
          <span className="text-(--ink-muted)">{t.trips.total(trip.total)}</span>
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-(--ink-muted) rtl:-scale-x-100" />
    </button>
  );
}

export const ThreadHeader = forwardRef<HTMLButtonElement, { trip: InboxTrip; t: Messages; onBack: () => void }>(
  function ThreadHeader({ trip, t, onBack }, ref) {
    return (
      <div className="mb-4 flex flex-col items-start gap-2">
        <button
          ref={ref}
          type="button"
          onClick={onBack}
          className="-ms-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-bold text-(--action-text) outline-none hover:bg-(--action-soft) focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
          {t.trips.back}
        </button>
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <Route trip={trip} />
          </p>
          <h3 className="text-sm font-bold text-(--ink)">{t.trips.booking(trip.reference)}</h3>
          <p className="text-sm text-(--ink-muted)">{t.trips.threadSubtitle}</p>
        </div>
      </div>
    );
  },
);

/** An empty envelope with its flap open: nothing left inside. */
export function EmptyEnvelope({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <svg aria-hidden viewBox="0 0 120 96" className="h-24 w-[120px] overflow-visible">
        <motion.g
          style={{ transformOrigin: '60px 40px', transformBox: 'view-box' }}
          initial={{ rotateX: 0 }}
          animate={{ rotateX: 180 }}
          transition={{ type: 'spring', stiffness: 140, damping: 16, delay: 0.2 }}
        >
          <polygon points="8,40 112,40 60,80" fill="var(--surface-3)" stroke="var(--border-strong)" strokeLinejoin="round" />
        </motion.g>
        <rect x="8" y="40" width="104" height="54" rx="6" fill="var(--surface-2)" stroke="var(--border-strong)" />
        <polyline points="8,94 60,64 112,94" fill="none" stroke="var(--line)" />
        <circle cx="60" cy="40" r="3" fill="var(--highlight)" />
      </svg>
      <h3 className="mt-4 text-base font-bold text-(--brand-ink)">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-(--ink-muted)">{text}</p>
    </div>
  );
}

export function LettersSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="space-y-3">
      {[0, 1, 2].map((key) => (
        <div key={key} className="flex items-start gap-3 rounded-xl border border-(--line) bg-(--card) p-4">
          <span className="size-10 shrink-0 animate-pulse rounded-xl bg-(--surface-3)" />
          <span className="flex-1 space-y-2 pt-1">
            <span className="block h-3.5 w-1/2 animate-pulse rounded bg-(--surface-3)" />
            <span className="block h-3 w-4/5 animate-pulse rounded bg-(--surface-3)" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function LettersError({ t, onRetry }: { t: Messages; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-(--line) px-4 py-8 text-center">
      <p className="text-sm text-(--danger-ink)">{t.loadError}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-(--surface-3) px-5 text-sm font-bold text-(--ink) outline-none hover:bg-(--border) focus-visible:ring-2 focus-visible:ring-(--ring)"
      >
        <RotateCcw aria-hidden className="size-4" />
        {t.retry}
      </button>
    </div>
  );
}

export type Flight = { id: number; from: { x: number; y: number }; to: { x: number; y: number }; delay: number };

/** A tiny letter flying on an arc from a sealed row into the stamp. Fixed to the viewport, above everything. */
export function FlyingLetters({ flights, onLand }: { flights: Flight[]; onLand: (id: number) => void }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50">
      {flights.map((f) => {
        const midX = (f.from.x + f.to.x) / 2;
        const midY = Math.min(f.from.y, f.to.y) - 60;
        return (
          <motion.span
            key={f.id}
            className="absolute top-0 left-0 block h-4 w-6 -translate-x-1/2 -translate-y-1/2 rounded-[3px] border border-(--brand) bg-(--card)"
            initial={{ x: f.from.x, y: f.from.y, scale: 0.6, opacity: 0 }}
            animate={{
              x: [f.from.x, midX, f.to.x],
              y: [f.from.y, midY, f.to.y],
              scale: [0.9, 1.05, 0.4],
              rotate: [0, -14, 6],
              opacity: [1, 1, 0.9],
            }}
            transition={{ duration: 0.75, ease: [0.45, 0, 0.3, 1], delay: f.delay }}
            onAnimationComplete={() => onLand(f.id)}
          >
            <svg viewBox="0 0 24 16" className="absolute inset-0 size-full">
              <polyline points="1,1 12,9 23,1" fill="none" stroke="var(--brand)" strokeWidth="1.2" />
            </svg>
          </motion.span>
        );
      })}
    </div>
  );
}
