/**
 * v6-mail-slot: the inbox as a mailbox. The three views are envelopes hanging under a mail slot; the chosen one's
 * flap opens and its entries rise out of it as letter cards. Reading an entry seals its dot into a check, the airmail
 * stamp on "Unread" ticks down and a tiny letter flies into it.
 *
 * Sample data from `@lab/mocks/notifications-inbox`; read state lives here so the counts, the unread view and the
 * trips stay in step. Add `&state=loading` or `&state=error` to the frame address to see those states.
 */
import './tokens.css';
import './utilities.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { inboxEntries, inboxTrips, type InboxEntry, type InboxView } from '@lab/mocks/notifications-inbox';
import { messages } from './i18n';
import { EnvelopeTabs, panelId, tabId } from './parts/envelope-tabs';
import {
  EmptyEnvelope,
  EntryLetter,
  FlyingLetters,
  LettersError,
  LettersSkeleton,
  letterVariants,
  ThreadHeader,
  TripLetter,
  type Flight,
} from './parts/letters';

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-home min-h-dvh overflow-x-clip">
        <MailSlotInbox />
      </div>
    </MotionConfig>
  );
}

type LoadState = 'ready' | 'loading' | 'error';

function initialState(): LoadState {
  const match = /[?&]state=(loading|error)/.exec(window.location.hash);
  return (match?.[1] as LoadState | undefined) ?? 'ready';
}

/** How long a just-read row stays in the unread view, so its seal is seen before it goes back in the envelope. */
const LINGER_MS = 700;

function MailSlotInbox() {
  const t = useT(messages);
  const locale = useLocale();
  const rtl = locale === 'ar';
  const reduce = useReducedMotion() ?? false;

  const [view, setView] = useState<InboxView>('all');
  const [tripId, setTripId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [lingering, setLingering] = useState<Set<string>>(() => new Set());
  const [load, setLoad] = useState<LoadState>(initialState);
  const [ready, setReady] = useState(reduce);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [thump, setThump] = useState(0);

  const stampRef = useRef<HTMLSpanElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const flightId = useRef(0);
  const focusAfter = useRef<string | null>(null);

  const entries = useMemo(
    () =>
      inboxEntries(locale).map((e) =>
        !e.readAt && readIds.has(e.id) ? { ...e, readAt: '2026-11-22T12:00:00.000Z' } : e,
      ),
    [locale, readIds],
  );
  const trips = useMemo(() => inboxTrips(locale, entries), [locale, entries]);
  const unread = entries.filter((e) => !e.readAt).length;
  const trip = trips.find((x) => x.bookingId === tripId) ?? null;

  const list: InboxEntry[] =
    view === 'unread'
      ? entries.filter((e) => !e.readAt || lingering.has(e.id))
      : trip
        ? entries.filter((e) => e.bookingId === trip.bookingId)
        : entries;

  // Safety net: the intro never holds the content back longer than this.
  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => setReady(true), 1800);
    return () => clearTimeout(id);
  }, [ready]);

  // A slow fake load for the loading state.
  useEffect(() => {
    if (load !== 'loading') return;
    const id = setTimeout(() => setLoad('ready'), 2400);
    return () => clearTimeout(id);
  }, [load]);

  // Focus follows the thread: into it on open, back to its trip on close.
  useEffect(() => {
    if (trip) backRef.current?.focus();
  }, [trip]);

  const fly = useCallback(
    (sources: Element[]) => {
      if (reduce || !sources.length) return;
      const target = (stampRef.current ?? document.getElementById(tabId('unread')))?.getBoundingClientRect();
      if (!target) return;
      const to = { x: target.left + target.width / 2, y: target.top + target.height / 2 };
      const next = sources.slice(0, 4).map((el, i) => {
        const r = el.getBoundingClientRect();
        flightId.current += 1;
        return { id: flightId.current, from: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, to, delay: i * 0.09 };
      });
      setFlights((f) => [...f, ...next]);
    },
    [reduce],
  );

  const markRead = (ids: string[]) => {
    setReadIds((prev) => new Set([...prev, ...ids]));
    if (view === 'unread') {
      setLingering((prev) => new Set([...prev, ...ids]));
      setTimeout(() => {
        setLingering((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        const nextId = focusAfter.current;
        focusAfter.current = null;
        if (nextId) requestAnimationFrame(() => document.getElementById(nextId)?.focus());
      }, LINGER_MS);
    }
  };

  const openEntry = (entry: InboxEntry, el: HTMLButtonElement) => {
    if (entry.readAt) return;
    if (view === 'unread') {
      // The row goes back into the envelope: keep focus on its neighbour, or on the tab once the list is empty.
      const remaining = list.filter((e) => !e.readAt && e.id !== entry.id);
      const index = list.findIndex((e) => e.id === entry.id);
      const neighbour = remaining.find((e) => list.indexOf(e) > index) ?? remaining[remaining.length - 1];
      focusAfter.current = neighbour ? `letter-${neighbour.id}` : tabId('unread');
    }
    const dot = el.querySelector('[data-dot]');
    fly(dot ? [dot] : [el]);
    markRead([entry.id]);
  };

  const markAll = () => {
    const ids = entries.filter((e) => !e.readAt).map((e) => e.id);
    if (!ids.length) return;
    if (view === 'unread') focusAfter.current = tabId('unread');
    fly(Array.from(document.querySelectorAll(`#${panelId(view)} [data-dot]`)));
    markRead(ids);
  };

  const choose = (next: InboxView) => {
    if (next === view && !tripId) return;
    setView(next);
    setTripId(null);
  };

  const closeTrip = () => {
    const id = tripId;
    setTripId(null);
    if (id) requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`trip-${id}`)?.focus()));
  };

  const contentKey = load !== 'ready' ? load : `${view}:${tripId ?? ''}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 md:py-14">
      <section
        aria-labelledby="mail-slot-title"
        className="rounded-2xl border border-(--line) bg-(--card) p-4 sm:p-6"
      >
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-(--brand-soft) text-(--brand-ink)">
              <Bell aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 id="mail-slot-title" className="text-xl font-bold text-(--brand-ink) sm:text-2xl">
                {t.title}
              </h1>
              <p className="text-sm text-(--ink-muted)" aria-live="polite">
                {t.summary(unread)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={markAll}
            disabled={unread === 0 || load !== 'ready'}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-(--action-soft) px-4 text-sm font-bold whitespace-nowrap text-(--action-text) transition-colors outline-none hover:bg-(--action)/20 focus-visible:ring-2 focus-visible:ring-(--ring) disabled:cursor-default disabled:opacity-50"
          >
            <CheckCheck aria-hidden className="size-4" />
            {t.markAll}
          </button>
        </header>

        <EnvelopeTabs
          ref={stampRef}
          t={t}
          view={view}
          rtl={rtl}
          unread={unread}
          ready={ready}
          onReady={() => setReady(true)}
          onChange={choose}
          thump={thump}
        />

        <div role="tabpanel" id={panelId(view)} aria-labelledby={tabId(view)} className="mt-6 min-h-64">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={contentKey}
              initial="hidden"
              animate={ready ? 'shown' : 'hidden'}
              exit="gone"
            >
              {load === 'loading' ? (
                <LettersSkeleton label={t.loading} />
              ) : load === 'error' ? (
                <LettersError t={t} onRetry={() => setLoad('loading')} />
              ) : view === 'trips' && !trip ? (
                trips.length === 0 ? (
                  <EmptyEnvelope title={t.empty.tripsTitle} text={t.empty.tripsText} />
                ) : (
                  <ul className="space-y-3">
                    {trips.map((x, i) => (
                      <motion.li key={x.bookingId} custom={i} variants={letterVariants}>
                        <TripLetter trip={x} t={t} onOpen={() => setTripId(x.bookingId)} />
                      </motion.li>
                    ))}
                  </ul>
                )
              ) : (
                <>
                  {trip && <ThreadHeader ref={backRef} trip={trip} t={t} onBack={closeTrip} />}
                  {list.length === 0 ? (
                    <motion.div custom={0} variants={letterVariants}>
                      <EmptyEnvelope
                        title={view === 'unread' ? t.empty.unreadTitle : trip ? t.empty.threadTitle : t.empty.allTitle}
                        text={view === 'unread' ? t.empty.unreadText : trip ? t.empty.threadText : t.empty.allText}
                      />
                    </motion.div>
                  ) : (
                    <ul className="space-y-3">
                      <AnimatePresence>
                        {list.map((entry, i) => (
                          <motion.li
                            key={entry.id}
                            layout="position"
                            custom={i}
                            variants={letterVariants}
                            exit={{ opacity: 0, y: 28, scale: 0.96, transition: { duration: 0.22, ease: 'easeIn' } }}
                          >
                            <EntryLetter entry={entry} locale={locale} t={t} onOpen={openEntry} />
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
          {unread > 0 && load === 'ready' && view !== 'trips' && (
            <p className="mt-4 text-center text-sm text-(--ink-muted)">{t.openHint}</p>
          )}
        </div>
      </section>

      <FlyingLetters
        flights={flights}
        onLand={(id) => {
          setFlights((f) => f.filter((x) => x.id !== id));
          setThump((n) => n + 1);
        }}
      />
    </main>
  );
}
