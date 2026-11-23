/**
 * v3-split-flap: the account inbox's view tabs as a strip of an airport departures board. The labels sit on split-flap
 * tiles that run through other faces and settle when the page opens; choosing a tab flips its tiles once and lights a
 * gold "boarding" lamp; the unread count is a flap counter that steps digit by digit. The panel's rows flip down into
 * place line by line like board rows updating, each with a status flap (new / read) and the time.
 *
 * Lab-only states from the address: `&state=loading` (stays loading), `&state=error`, `&state=empty`.
 */
import './tokens.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { inboxEntries, inboxTrips, type InboxEntry, type InboxView } from '@lab/mocks/notifications-inbox';
import { cn } from '@lab/utils';
import { messages, type Messages } from './i18n';
import { BoardTabs, panelId, tabId } from './parts/board-tabs';
import { BoardList, EmptyBoard, EntryRow, ErrorBoard, LoadingRows, RouteTiles, TripRow } from './parts/rows';

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-home min-h-dvh overflow-x-clip bg-(--surface-2)">
        <SplitFlapInbox />
      </div>
    </MotionConfig>
  );
}

type Phase = 'loading' | 'ready' | 'error';
type LabState = 'loading' | 'error' | 'empty' | null;

function labState(): LabState {
  if (typeof window === 'undefined') return null;
  const query = window.location.hash.split('?')[1] ?? window.location.search.slice(1);
  const value = new URLSearchParams(query).get('state');
  return value === 'loading' || value === 'error' || value === 'empty' ? value : null;
}

/** Rows wait for the tab strip's opening run before they flip in. */
const OPENING_ROWS_S = 0.55;

function SplitFlapInbox() {
  const t = useT(messages);
  const locale = useLocale();
  const [forced] = useState(labState);
  const [phase, setPhase] = useState<Phase>('loading');
  const [view, setView] = useState<InboxView>('all');
  const [tripId, setTripId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(inboxEntries('en').filter((e) => e.readAt).map((e) => e.id)),
  );
  const opened = useRef(false);
  const retried = useRef(false);

  // Sample load: a short wait (the opening run plays meanwhile), or the state the address asks for.
  useEffect(() => {
    if (phase !== 'loading' || forced === 'loading') return;
    const id = setTimeout(() => setPhase(forced === 'error' && !retried.current ? 'error' : 'ready'), 650);
    return () => clearTimeout(id);
  }, [phase, forced]);

  const entries = useMemo<InboxEntry[]>(() => {
    if (forced === 'empty') return [];
    return inboxEntries(locale).map((e) =>
      readIds.has(e.id) ? { ...e, readAt: e.readAt ?? new Date(Date.parse(e.createdAt) + 60_000).toISOString() } : { ...e, readAt: null },
    );
  }, [locale, readIds, forced]);
  const trips = useMemo(() => inboxTrips(locale, entries), [locale, entries]);
  const unread = entries.filter((e) => !e.readAt).length;

  const markRead = (ids: string[]) => setReadIds((prev) => new Set([...prev, ...ids]));

  const openEntry = (entry: InboxEntry, list: InboxEntry[]) => {
    if (entry.readAt) return;
    markRead([entry.id]);
    // In the unread view the row leaves; keep keyboard focus on the board.
    if (view === 'unread') {
      const at = list.findIndex((e) => e.id === entry.id);
      const next = list[at + 1] ?? list[at - 1];
      requestAnimationFrame(() => {
        const target = next && document.querySelector<HTMLElement>(`[data-entry="${next.id}"]`);
        (target ?? document.getElementById(panelId(view)))?.focus();
      });
    }
  };

  const changeView = (next: InboxView) => {
    setView(next);
    setTripId(null);
  };

  // Rows of the first panel wait for the strip; every later panel starts at once.
  const baseDelay = opened.current ? 0 : OPENING_ROWS_S;
  useEffect(() => {
    if (phase === 'ready') {
      const id = setTimeout(() => (opened.current = true), 50);
      return () => clearTimeout(id);
    }
  }, [phase]);

  const panelKey = phase !== 'ready' ? phase : `${view}-${tripId ?? ''}`;

  return (
    <main className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-6 md:py-14">
      <section
        aria-labelledby="inbox-title"
        className="rounded-2xl border border-(--line) bg-(--card) p-3.5 sm:p-6"
      >
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-(--brand-soft) text-(--brand-ink)">
              <Bell className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 id="inbox-title" className="text-xl leading-tight font-bold text-(--brand-ink) sm:text-2xl">
                {t.title}
              </h1>
              <p aria-live="polite" className="mt-0.5 text-sm text-(--ink-muted)">
                {phase === 'ready' ? t.summary(unread) : t.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => markRead(entries.map((e) => e.id))}
            disabled={unread === 0 || phase !== 'ready'}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-(--action-soft) px-4 text-sm font-bold whitespace-nowrap text-(--action-text) transition-colors hover:bg-(--action)/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--action-text) disabled:cursor-default disabled:opacity-50"
          >
            <CheckCheck aria-hidden className="size-4" />
            {t.markAll}
          </button>
        </header>

        <div className="mt-5">
          <BoardTabs view={view} unread={phase === 'ready' ? unread : 0} t={t} onChange={changeView} />
        </div>

        <div role="tabpanel" id={panelId(view)} aria-labelledby={tabId(view)} tabIndex={-1} className="mt-5 outline-none">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={panelKey}
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
            >
              {phase === 'loading' && <LoadingRows label={t.loading} />}
              {phase === 'error' && <ErrorBoard message={t.loadError} retry={t.retry} onRetry={() => {
                retried.current = true;
                setPhase('loading');
              }} />}
              {phase === 'ready' && (
                <Panel
                  t={t}
                  view={view}
                  tripId={tripId}
                  entries={entries}
                  trips={trips}
                  baseDelay={baseDelay}
                  onOpenEntry={openEntry}
                  onOpenTrip={setTripId}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}

function Panel({
  t,
  view,
  tripId,
  entries,
  trips,
  baseDelay,
  onOpenEntry,
  onOpenTrip,
}: {
  t: Messages;
  view: InboxView;
  tripId: string | null;
  entries: InboxEntry[];
  trips: ReturnType<typeof inboxTrips>;
  baseDelay: number;
  onOpenEntry: (entry: InboxEntry, list: InboxEntry[]) => void;
  onOpenTrip: (bookingId: string | null) => void;
}) {
  const locale = useLocale();

  if (view === 'trips' && tripId) {
    const trip = trips.find((x) => x.bookingId === tripId);
    const thread = entries.filter((e) => e.bookingId === tripId);
    return (
      <div>
        <button
          type="button"
          onClick={() => onOpenTrip(null)}
          className="-ms-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-(--action-text) hover:underline focus-visible:outline-2 focus-visible:outline-(--action-text)"
        >
          <ArrowLeft aria-hidden className={cn('size-4', locale === 'ar' && '-scale-x-100')} />
          {t.trips.back}
        </button>
        {trip && (
          <div className="mt-2 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <RouteTiles trip={trip} delay={60} />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-(--brand-ink)">{t.trips.booking(trip.reference)}</h2>
              <p className="text-sm text-(--ink-muted)">
                {trip.route.from} - {trip.route.to} · {t.trips.departs} {trip.departs}
              </p>
            </div>
          </div>
        )}
        <EntryList t={t} list={thread} baseDelay={0.1} empty="thread" onOpenEntry={onOpenEntry} />
      </div>
    );
  }

  if (view === 'trips') {
    if (!trips.length) return <EmptyBoard kind="trips" title={t.empty.tripsTitle} text={t.empty.tripsText} />;
    return (
      <BoardList>
        {trips.map((trip, i) => (
          <TripRow key={trip.bookingId} trip={trip} index={i} baseDelay={baseDelay} t={t} onOpen={(x) => onOpenTrip(x.bookingId)} />
        ))}
      </BoardList>
    );
  }

  const list = view === 'unread' ? entries.filter((e) => !e.readAt) : entries;
  return <EntryList t={t} list={list} baseDelay={baseDelay} empty={view} onOpenEntry={onOpenEntry} />;
}

function EntryList({
  t,
  list,
  baseDelay,
  empty,
  onOpenEntry,
}: {
  t: Messages;
  list: InboxEntry[];
  baseDelay: number;
  empty: 'all' | 'unread' | 'thread';
  onOpenEntry: (entry: InboxEntry, list: InboxEntry[]) => void;
}) {
  const copy = {
    all: [t.empty.allTitle, t.empty.allText],
    unread: [t.empty.unreadTitle, t.empty.unreadText],
    thread: [t.empty.threadTitle, t.empty.threadText],
  }[empty];
  return (
    <AnimatePresence mode="wait" initial={false}>
      {list.length === 0 ? (
        <EmptyBoard key="empty" kind={empty} title={copy[0]} text={copy[1]} />
      ) : (
        <motion.div key="list" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
          <BoardList>
            <AnimatePresence initial>
              {list.map((entry, i) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  index={i}
                  baseDelay={baseDelay}
                  t={t}
                  onOpen={(e) => onOpenEntry(e, list)}
                />
              ))}
            </AnimatePresence>
          </BoardList>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
