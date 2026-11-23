/**
 * v4-plane-windows: the account inbox's three views as aircraft windows in a strip of cabin wall. The chosen window
 * raises its shade to show a flat sky; the others keep theirs down. The panel comes out from under the windows like a
 * tray table folding down. On first paint the cabin wakes up: each shade lifts in turn and drops again, except the
 * chosen one, while the list loads.
 */
import './tokens.css';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { Bell, CheckCheck, Plane } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { inboxEntries, inboxTrips, type InboxView } from '@lab/mocks/notifications-inbox';
import { messages } from './i18n';
import { CabinTabs, panelId, tabId, WAKE_MS } from './parts/cabin-tabs';
import { EmptyState, EntryList, ListSkeleton, ThreadHeader, TripsList } from './parts/panels';

const READ_AT = '2026-11-22T12:00:00.000Z';
const LOAD_MS = 1000;

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-home min-h-dvh overflow-x-clip">
        <NotificationsWindows />
      </div>
    </MotionConfig>
  );
}

function NotificationsWindows() {
  const t = useT(messages);
  const locale = useLocale();
  const rtl = locale === 'ar';
  const reduce = useReducedMotion() ?? false;

  const [view, setView] = useState<InboxView>('all');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [waking, setWaking] = useState(!reduce);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const a = setTimeout(() => setWaking(false), WAKE_MS);
    const b = setTimeout(() => setLoading(false), LOAD_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  const entries = useMemo(
    () => inboxEntries(locale).map((e) => (readIds.has(e.id) && !e.readAt ? { ...e, readAt: READ_AT } : e)),
    [locale, readIds],
  );
  const trips = useMemo(() => inboxTrips(locale, entries), [locale, entries]);
  const unreadCount = entries.filter((e) => !e.readAt).length;

  const markRead = (id: string) => setReadIds((s) => new Set(s).add(id));
  const markAll = () => setReadIds(new Set(entries.map((e) => e.id)));

  const choose = (v: InboxView) => {
    setWaking(false); // a choice during the wake-up ends it, so the shades answer at once
    setView(v);
    setBookingId(null);
  };

  const trip = bookingId ? trips.find((x) => x.bookingId === bookingId) : undefined;
  const trayKey = loading ? 'loading' : `${view}:${bookingId ?? ''}`;

  let body;
  if (loading) body = <ListSkeleton label={t.loading} />;
  else if (view === 'trips' && trip) {
    const thread = entries.filter((e) => e.bookingId === trip.bookingId);
    body = (
      <>
        <ThreadHeader t={t} trip={trip} onBack={() => setBookingId(null)} />
        {thread.length ? (
          <EntryList t={t} locale={locale} entries={thread} onOpen={markRead} />
        ) : (
          <EmptyState icon={Plane} title={t.empty.threadTitle} text={t.empty.threadText} />
        )}
      </>
    );
  } else if (view === 'trips') {
    body = trips.length ? (
      <TripsList t={t} locale={locale} trips={trips} onOpen={setBookingId} />
    ) : (
      <EmptyState icon={Plane} title={t.empty.tripsTitle} text={t.empty.tripsText} />
    );
  } else {
    const list = view === 'unread' ? entries.filter((e) => !e.readAt) : entries;
    body = list.length ? (
      <EntryList t={t} locale={locale} entries={list} onOpen={markRead} />
    ) : view === 'unread' ? (
      <EmptyState icon={CheckCheck} title={t.empty.unreadTitle} text={t.empty.unreadText} />
    ) : (
      <EmptyState icon={Bell} title={t.empty.allTitle} text={t.empty.allText} />
    );
  }

  // The tray: folds down from under the window strip (hinge at its top edge) and folds back up on the way out.
  const tray = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        initial: { opacity: 0.4, y: -28, rotateX: -16, clipPath: 'inset(0% 0% 100% 0%)' },
        animate: {
          opacity: 1,
          y: 0,
          rotateX: 0,
          clipPath: 'inset(0% 0% 0% 0%)',
          transition: { type: 'spring' as const, stiffness: 170, damping: 22, clipPath: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
          transitionEnd: { clipPath: 'none' },
        },
        exit: {
          opacity: 0,
          y: -18,
          clipPath: 'inset(0% 0% 100% 0%)',
          transition: { duration: 0.22, ease: [0.4, 0, 1, 1] as const },
        },
      };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 md:py-12">
      <header>
        <h1 className="text-2xl font-bold text-(--brand-ink) md:text-3xl">{t.title}</h1>
        <p className="mt-1 text-base text-(--ink)">{t.subtitle}</p>
      </header>

      <section
        aria-labelledby="v4-card-title"
        className="mt-6 v4-round border border-(--line) bg-(--card) p-3 sm:p-5"
      >
        <div className="mb-4 flex flex-wrap items-center gap-3 px-1 pt-1 sm:px-0 sm:pt-0">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-ink)">
            <Bell aria-hidden className="size-5" />
          </span>
          <div className="v4-head-text">
            <h2 id="v4-card-title" className="text-lg font-bold text-(--brand-ink)">
              {t.cardTitle}
            </h2>
            <p className="tnum text-sm text-(--ink)" aria-live="polite">
              {t.summary(unreadCount)}
            </p>
          </div>
          <button
            type="button"
            onClick={markAll}
            disabled={unreadCount === 0}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-(--action-soft) px-3.5 text-sm font-bold whitespace-nowrap text-(--action-text) transition-colors',
              'cursor-pointer hover:bg-(--action) hover:text-(--action-foreground) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)',
              'disabled:cursor-default disabled:bg-(--surface-3) disabled:text-(--ink-muted)',
            )}
          >
            <CheckCheck aria-hidden className="size-4" />
            {t.markAll}
          </button>
        </div>

        <CabinTabs t={t} view={view} unread={unreadCount} waking={waking} rtl={rtl} onChange={choose} />

        <div
          role="tabpanel"
          id={panelId(view)}
          aria-labelledby={tabId(view)}
          tabIndex={0}
          className="relative mt-4 rounded-2xl v4-hinge focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={trayKey} style={{ transformOrigin: '50% 0%' }} {...tray}>
              {body}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}
