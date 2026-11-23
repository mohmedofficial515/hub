/**
 * v2-flight-path: the inbox's three views (All / Unread / Trips) as three airports on a dashed route arc. On open
 * the route draws itself, the airports appear one after another and a small plane comes in to the chosen one.
 * Choosing another view flies the plane along the arc to it with a solid gold contrail behind; the panel under it
 * then "lands" (rows come down into place one by one). The arc is decoration; the airports are WAI-ARIA tabs.
 *
 * Sample data from `@lab/mocks/notifications-inbox`. Opening an unread row marks it read; "mark all as read" clears
 * every dot and the badge; Trips lists bookings and opens a booking's thread with a back control.
 * Lab-only: `&state=loading|error|empty` in the address shows those states.
 */
import './tokens.css';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Bell, CheckCheck, Plane } from 'lucide-react';
import {
  inboxEntries,
  inboxTrips,
  type InboxEntry,
  type InboxView,
} from '@lab/mocks/notifications-inbox';
import { useLocale, useT } from '@lab/i18n';
import { messages } from './i18n';
import { panelId, RouteTabs, tabId } from './parts/route-tabs';
import {
  EmptyState,
  EntryRow,
  listVariants,
  ListSkeleton,
  LoadError,
  rowVariants,
  TripRow,
} from './parts/rows';

type Demo = 'loading' | 'error' | 'empty' | null;

function demoState(): Demo {
  if (typeof window === 'undefined') return null;
  const query = window.location.hash.split('?')[1] ?? window.location.search.slice(1);
  const value = new URLSearchParams(query).get('state');
  return value === 'loading' || value === 'error' || value === 'empty' ? value : null;
}

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-home min-h-dvh overflow-x-clip bg-(--surface-2)">
        <FlightPathInbox />
      </div>
    </MotionConfig>
  );
}

function FlightPathInbox() {
  const t = useT(messages);
  const locale = useLocale();
  const rtl = locale === 'ar';
  const reduce = useReducedMotion() ?? false;

  const [demo] = useState<Demo>(demoState);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(demo === 'error');
  const [view, setView] = useState<InboxView>('all');
  const [tripId, setTripId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  // A short first load, so the skeleton is part of the experience; the rows land as the plane does.
  useEffect(() => {
    if (demo === 'loading') return;
    const id = setTimeout(() => setLoading(false), reduce ? 300 : 900);
    return () => clearTimeout(id);
  }, [demo, reduce]);

  const entries = useMemo<InboxEntry[]>(() => {
    if (demo === 'empty') return [];
    return inboxEntries(locale).map((e) => (readIds.has(e.id) && !e.readAt ? { ...e, readAt: e.createdAt } : e));
  }, [locale, readIds, demo]);
  const trips = useMemo(() => inboxTrips(locale, entries), [locale, entries]);
  const unread = entries.filter((e) => !e.readAt).length;

  const markRead = (id: string) => setReadIds((prev) => new Set(prev).add(id));
  const markAll = () => setReadIds(new Set(entries.map((e) => e.id)));
  const choose = (next: InboxView) => {
    setView(next);
    setTripId(null);
  };

  const panelKey = loading ? 'loading' : failed ? 'error' : view === 'trips' && tripId ? `trip:${tripId}` : view;

  let content: React.ReactNode;
  if (loading) content = <ListSkeleton label={t.loading} />;
  else if (failed)
    content = <LoadError message={t.loadError} retry={t.retry} onRetry={() => setFailed(false)} />;
  else if (view === 'trips' && tripId) {
    const trip = trips.find((x) => x.bookingId === tripId);
    const thread = entries.filter((e) => e.bookingId === tripId);
    content = (
      <div>
        <button
          type="button"
          onClick={() => setTripId(null)}
          className="-ms-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-bold text-(--action-text) hover:underline focus-visible:outline-2 focus-visible:outline-(--brand)"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t.trips.back}
        </button>
        {trip && (
          <div className="mt-2 mb-4">
            <h2 className="text-lg font-bold text-(--brand-ink)">
              {t.trips.booking(trip.reference)}{' '}
              <span className="tnum font-semibold text-(--ink-muted)">
                · {trip.route.fromCode} – {trip.route.toCode}
              </span>
            </h2>
            <p className="mt-0.5 text-sm text-(--ink-muted)">{t.trips.threadSubtitle}</p>
          </div>
        )}
        <EntryList entries={thread} empty={{ icon: Plane, title: t.empty.threadTitle, text: t.empty.threadText }} onOpen={markRead} />
      </div>
    );
  } else if (view === 'trips') {
    content = trips.length ? (
      <motion.ul variants={listVariants} initial="hidden" animate="shown" className="space-y-3">
        {trips.map((trip) => (
          <motion.li key={trip.bookingId} variants={rowVariants}>
            <TripRow trip={trip} locale={locale} t={t.trips} onOpen={setTripId} />
          </motion.li>
        ))}
      </motion.ul>
    ) : (
      <EmptyState icon={Plane} title={t.empty.tripsTitle} text={t.empty.tripsText} />
    );
  } else {
    const list = view === 'unread' ? entries.filter((e) => !e.readAt) : entries;
    content =
      view === 'unread' ? (
        <EntryList entries={list} empty={{ icon: CheckCheck, title: t.empty.unreadTitle, text: t.empty.unreadText }} onOpen={markRead} />
      ) : (
        <EntryList entries={list} empty={{ icon: Bell, title: t.empty.allTitle, text: t.empty.allText }} onOpen={markRead} />
      );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="rounded-2xl border border-(--line) bg-(--card) p-4 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-ink)">
              <Bell className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl leading-tight font-bold text-(--brand-ink) sm:text-2xl">{t.title}</h1>
              <p className="mt-0.5 text-sm text-(--ink-muted)" aria-live="polite">
                {t.summary(unread)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={markAll}
            disabled={unread === 0}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-(--action-soft) px-4 text-sm font-bold whitespace-nowrap text-(--action-text) transition-colors hover:bg-(--action) hover:text-(--action-foreground) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand) disabled:cursor-default disabled:opacity-50 disabled:hover:bg-(--action-soft) disabled:hover:text-(--action-text)"
          >
            <CheckCheck className="size-4" aria-hidden />
            {t.markAll}
          </button>
        </header>

        <div className="mt-6 border-t border-(--line) pt-5">
          <RouteTabs
            view={view}
            onChange={choose}
            unread={unread}
            rtl={rtl}
            labels={t.views}
            unreadLabel={t.unreadBadge}
          />
        </div>

        <div role="tabpanel" id={panelId(view)} aria-labelledby={tabId(view)} className="mt-4 min-h-64">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={panelKey}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.28, delay: reduce ? 0 : 0.12, ease: 'easeOut' } }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, transition: { duration: 0.14, ease: 'easeIn' } }}
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </main>
  );

}


function EntryList({
  entries: list,
  empty,
  onOpen,
}: {
  entries: InboxEntry[];
  empty: { icon: typeof Bell; title: string; text: string };
  onOpen: (id: string) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const reduce = useReducedMotion() ?? false;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {list.length === 0 ? (
        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <EmptyState icon={empty.icon} title={empty.title} text={empty.text} />
        </motion.div>
      ) : (
        <motion.ul key="list" variants={listVariants} initial="hidden" animate="shown" exit={{ opacity: 0 }} className="space-y-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {list.map((entry) => (
              <motion.li
                key={entry.id}
                layout={!reduce}
                variants={rowVariants}
                exit={{ opacity: 0, y: -16, transition: { duration: 0.22 } }}
              >
                <EntryRow entry={entry} locale={locale} unreadLabel={t.unread} onOpen={onOpen} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </AnimatePresence>
  );
}
