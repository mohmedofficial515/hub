/**
 * v5-luggage-tags: the inbox views (all, unread, trips) as luggage tags hanging from a riveted rail. The tags drop
 * onto the rail when the page opens and swing to rest; the chosen one hangs lower, straight and navy. The panel under
 * them is a baggage belt: rows roll in from the inline start and leave toward the inline end.
 *
 * Lab-only: `?state=loading|error|empty` in the frame address shows those states.
 */
import './tokens.css';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { INBOX_VIEWS, inboxEntries, inboxTrips, type InboxView } from '@lab/mocks/notifications-inbox';
import { messages } from './i18n';
import { LuggageTags, panelId, tabId } from './parts/tags';
import {
  BeltLine,
  EMPTY_ICONS,
  EmptyState,
  EntryList,
  LoadError,
  LoadingRows,
  TripThread,
  TripsList,
  beltVariants,
} from './parts/panel';

type LabState = 'ready' | 'loading' | 'error' | 'empty';

function readLabState(): LabState {
  if (typeof window === 'undefined') return 'ready';
  const s = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('state');
  return s === 'loading' || s === 'error' || s === 'empty' ? s : 'ready';
}

export default function Page() {
  const locale = useLocale();
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-home min-h-dvh overflow-x-clip">
        <LuggageInbox key={locale} />
      </div>
    </MotionConfig>
  );
}

function LuggageInbox() {
  const locale = useLocale();
  const t = useT(messages);
  const rtl = locale === 'ar';
  const dir = rtl ? -1 : 1;
  const belt = useMemo(() => beltVariants(dir), [dir]);

  const [lab] = useState(readLabState);
  const [entries, setEntries] = useState(() => (lab === 'empty' ? [] : inboxEntries(locale)));
  const [view, setView] = useState<InboxView>('all');
  const [tripId, setTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(lab !== 'error');
  const [failed, setFailed] = useState(lab === 'error');

  // A short first load, so the rows roll in after the tags have dropped.
  useEffect(() => {
    if (!loading || lab === 'loading') return;
    const id = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(id);
  }, [loading, lab]);

  const unreadEntries = entries.filter((e) => !e.readAt);
  const trips = useMemo(() => inboxTrips(locale, entries), [locale, entries]);
  const trip = tripId ? trips.find((x) => x.bookingId === tripId) : undefined;
  const counts: Record<InboxView, number> = { all: entries.length, unread: unreadEntries.length, trips: trips.length };

  const ready = !loading && !failed;

  const markRead = (id: string) =>
    setEntries((list) => list.map((e) => (e.id === id && !e.readAt ? { ...e, readAt: new Date().toISOString() } : e)));
  const markAll = () =>
    setEntries((list) => list.map((e) => (e.readAt ? e : { ...e, readAt: new Date().toISOString() })));
  const choose = (v: InboxView) => {
    setView(v);
    setTripId(null);
  };
  const retry = () => {
    setFailed(false);
    setLoading(true);
  };

  // What the panel shows; a new key sends the old content off the belt and rolls the new one in.
  const content = loading
    ? 'loading'
    : failed
      ? 'error'
      : view === 'trips'
        ? trip
          ? `thread-${trip.bookingId}`
          : trips.length
            ? 'trips'
            : 'trips-empty'
        : (view === 'unread' ? unreadEntries : entries).length
          ? view
          : `${view}-empty`;

  // The belt line runs one step each time the panel changes.
  const [travel, setTravel] = useState(0);
  useEffect(() => setTravel((n) => n + 1), [content]);

  const panel = () => {
    if (content === 'loading') return <LoadingRows key="loading" t={t} />;
    if (content === 'error') return <LoadError key="error" t={t} belt={belt} onRetry={retry} />;
    if (view === 'trips') {
      if (trip)
        return (
          <TripThread
            key={content}
            trip={trip}
            entries={entries.filter((e) => e.bookingId === trip.bookingId)}
            belt={belt}
            locale={locale}
            t={t}
            onBack={() => setTripId(null)}
            onOpen={markRead}
          />
        );
      if (!trips.length)
        return <EmptyState key={content} icon={EMPTY_ICONS.trips} title={t.empty.tripsTitle} text={t.empty.tripsText} belt={belt} />;
      return <TripsList key={content} trips={trips} belt={belt} t={t} onOpen={setTripId} />;
    }
    const list = view === 'unread' ? unreadEntries : entries;
    if (!list.length)
      return (
        <EmptyState
          key={content}
          icon={EMPTY_ICONS[view]}
          title={view === 'unread' ? t.empty.unreadTitle : t.empty.allTitle}
          text={view === 'unread' ? t.empty.unreadText : t.empty.allText}
          belt={belt}
        />
      );
    return <EntryList key={content} entries={list} belt={belt} locale={locale} t={t} onOpen={markRead} />;
  };

  return (
    <main className="min-h-dvh bg-(--surface-2) px-4 py-8 sm:px-6 md:py-14">
      <section
        aria-labelledby="lt-title"
        className="mx-auto w-full max-w-3xl rounded-3xl border border-(--line) bg-(--card) p-4 sm:p-6 md:p-8"
      >
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-ink)">
            <Bell aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 id="lt-title" className="text-xl leading-tight font-bold text-(--brand-ink) md:text-2xl">
              {t.title}
            </h1>
            <p aria-live="polite" className="mt-0.5 text-sm text-(--ink-muted)">
              {ready ? t.summary(counts.unread) : ' '}
            </p>
          </div>
          <button
            type="button"
            onClick={markAll}
            disabled={counts.unread === 0 || !ready}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-(--action-soft) max-sm:basis-full px-4 text-sm font-bold whitespace-nowrap text-(--action-text) transition-colors hover:bg-(--mark-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring) disabled:cursor-default disabled:opacity-50"
          >
            <CheckCheck aria-hidden className="size-4" /> {t.markAll}
          </button>
        </header>

        <div className="mt-7 md:mt-9">
          <LuggageTags views={INBOX_VIEWS} view={view} counts={ready ? counts : null} rtl={rtl} t={t} onSelect={choose} />
          <BeltLine travel={travel} dir={dir} />
        </div>

        <div role="tabpanel" id={panelId(view)} aria-labelledby={tabId(view)} className="relative mt-5 min-h-60">
          <AnimatePresence mode="wait" initial={false}>
            {panel()}
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}
