import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { useLocale, useT } from '@lab/i18n';
import { feedFor, feedScenarioFromHash, type FeedScenario } from '@lab/mocks/hub-app/feed';
import { members } from '@lab/mocks/hub-today';
import './tokens.css';
import { messages } from './i18n';
import { cn, fill, fillText, focusRing, Ltr } from './parts/atoms';
import { NeedsView, StreamView, type Common } from './parts/feed-list';
import { BriefPanel, PageHeader } from './parts/header';
import {
  cardOf,
  countsOf,
  isMention,
  isUnread,
  nextDeadline,
  VIEWS,
  type FeedAction,
  type FeedItem,
  type Overlay,
  type Overlays,
  type ReadMap,
  type ViewId,
} from './parts/model';
import { EmptyState, ErrorState, SkeletonRows } from './parts/states';
import { ToastRegion, type ToastData } from './parts/toast';
import { ViewsBar } from './parts/views-bar';

const PAGE = 50;

const hashParam = (name: string) => new URLSearchParams(location.hash.split('?')[1] ?? '').get(name);

export default function Page() {
  // The gallery toolbar changes `?scenario=` in the hash; a new scenario starts from fresh state.
  const scenario = feedScenarioFromHash();
  return <Timeline key={scenario} scenario={scenario} />;
}

function Timeline({ scenario }: { scenario: FeedScenario }) {
  const t = useT(messages);
  const locale = useLocale();
  const feed = useMemo(() => feedFor(scenario), [scenario]);
  const me = members.find((m) => m.id === feed.me);
  const firstName = (me?.name[locale] ?? '').split(' ')[0] ?? '';

  const [items, setItems] = useState<FeedItem[]>(feed.items);
  const [pending, setPending] = useState<FeedItem[]>([]);
  const [overlays, setOverlays] = useState<Overlays>({});
  const [read, setRead] = useState<ReadMap>({});
  const [toast, setToast] = useState<ToastData | null>(null);
  const [announce, setAnnounce] = useState('');
  const [briefOpen, setBriefOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(scenario === 'error');
  const [visible, setVisible] = useState(PAGE);
  const [fired, setFired] = useState(0);
  const toastId = useRef(0);
  const firedSteps = useRef(new Set<number>());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;

  const loading = scenario === 'loading' || refreshing;
  const counts = useMemo(() => (failed ? countsOf([], {}, {}) : countsOf(items, overlays, read)), [failed, items, overlays, read]);
  const next = useMemo(() => (failed ? null : nextDeadline(items, overlays)), [failed, items, overlays]);

  // Default view: Needs me if anything waits, else New, else All. `?view=` (hash) overrides, for links and screenshots.
  const [view, setView] = useState<ViewId>(() => {
    const asked = hashParam('view') as ViewId | null;
    if (asked && VIEWS.includes(asked)) return asked;
    const c = countsOf(feed.items, {}, {});
    return c.needs > 0 ? 'needs' : c.new > 0 ? 'new' : 'all';
  });

  const show = useCallback((next: Omit<ToastData, 'id'>) => setToast({ ...next, id: ++toastId.current }), []);

  // ── Live: what SSE `card.event` would push. The row changes in place and keeps its position. ──
  const fire = useCallback(
    (index: number) => {
      if (firedSteps.current.has(index)) return;
      const step = feed.live[index];
      if (!step) return;
      firedSteps.current.add(index);
      setFired((n) => n + 1);
      if (step.type === 'status') {
        const item = itemsRef.current.find((i) => i.card?.key === step.key);
        if (!item?.card) return;
        const from = cardOf(item, overlaysRef.current)!.status;
        setItems((list) => list.map((i) => (i.card?.key === step.key ? { ...i, what: step.what, at: step.at, actorId: step.actorId, viaAgent: false } : i)));
        setOverlays((o) => ({ ...o, [step.key]: { status: step.to, action: step.action, from, at: Date.now(), mine: false } }));
        setAnnounce(fillText(t.liveAnnounce, { key: step.key, status: t.status[step.to] ?? step.to }));
      } else {
        const key = step.item.card!.key;
        setOverlays((o) => ({ ...o, [key]: { status: step.item.card!.status, action: null, from: '', at: Date.now(), mine: false } }));
        setAnnounce(fillText(t.arrivedAnnounce, { key }));
        if (window.scrollY > 160) setPending((p) => [...p, step.item]);
        else setItems((list) => [step.item, ...list]);
      }
    },
    [feed.live, t],
  );

  useEffect(() => {
    if (scenario === 'loading' || scenario === 'error' || hashParam('live') === 'off') return;
    const ids = feed.live.map((step, i) => window.setTimeout(() => fire(i), step.afterMs));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [feed.live, fire, scenario]);

  const showPending = () => {
    setItems((list) => [...pending, ...list]);
    setPending([]);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  // ── My own actions: optimistic status, a quiet "settled" state, Undo ──
  const onAct = (item: FeedItem, action: FeedAction) => {
    const key = item.card!.key;
    const current = cardOf(item, overlaysRef.current)!;
    const to = t.afterStatus[action]!;
    const overlay: Overlay = { status: to, action: null, from: current.status, at: Date.now(), mine: true, prev: { status: current.status, action: current.awaiting ?? null } };
    setOverlays((o) => ({ ...o, [key]: overlay }));
    setAnnounce(fillText(t.liveAnnounce, { key, status: t.status[to] ?? to }));
    show({
      message: fill(t.done[action], { key: <Ltr mono>{key}</Ltr> }),
      cmd: action === 'summarize' ? t.sheetCommand : undefined,
      onUndo: () => {
        setOverlays((o) => ({ ...o, [key]: { status: overlay.prev!.status, action: overlay.prev!.action, from: to, at: Date.now(), mine: false } }));
        setToast(null);
      },
    });
    window.setTimeout(() => {
      setOverlays((o) => (o[key]?.mine && o[key]!.at === overlay.at ? { ...o, [key]: { ...o[key]!, settled: true } } : o));
    }, 3200);
  };

  const onOpen = (item: FeedItem) => {
    setRead((r) => ({ ...r, [item.id]: true }));
    show({ message: fill(t.openedToast, { key: <Ltr mono>{item.card?.key ?? item.id}</Ltr> }) });
  };
  const onToggleRead = (item: FeedItem) => setRead((r) => ({ ...r, [item.id]: isUnread(item, r) }));

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 900);
  };

  // j / k move between rows, r refreshes. (Enter on a focused title opens it: it is a button.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'r') {
        e.preventDefault();
        refresh();
      } else if (e.key === 'j' || e.key === 'k') {
        const rows = [...document.querySelectorAll<HTMLElement>('[data-row]')].filter((r) => r.offsetParent !== null);
        const i = rows.indexOf(el.closest<HTMLElement>('[data-row]')!);
        const to = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'j' ? 1 : -1)))];
        if (to) {
          e.preventDefault();
          to.focus();
          to.scrollIntoView({ block: 'nearest' });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const common: Common = { overlays, read, onAct, onOpen, onToggleRead, lazy: items.length > 40 };

  // The stream for the three chronological views.
  const stream = useMemo(() => {
    if (view === 'new') return items.filter((i) => isUnread(i, read));
    if (view === 'mentions') return items.filter((i) => isMention(i));
    return items;
  }, [items, read, view]);
  const sliced = stream.slice(0, visible);

  const needsCount = counts.needs;
  const empty = view === 'needs' ? needsCount === 0 && !feed.ready.length && !feed.sessions.length : stream.length === 0;
  const pendingBrief = feed.brief.text[locale];

  return (
    <MotionConfig reducedMotion="user">
      <div className="peacock-app min-h-dvh bg-background text-foreground">
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-5 pb-28 md:px-6 md:pt-8">
          {loading ? (
            <div role="status" aria-busy="true" aria-label={t.loading} className="flex flex-col gap-3">
              <span className="h-7 w-56 rounded bg-muted motion-safe:animate-pulse" />
              <span className="h-5 w-full max-w-xl rounded bg-muted motion-safe:animate-pulse" />
            </div>
          ) : (
            <PageHeader
              name={firstName}
              counts={failed ? null : counts}
              briefText={failed || scenario === 'empty' ? null : pendingBrief}
              briefOpen={briefOpen}
              onBrief={() => setBriefOpen((v) => !v)}
              next={next}
              refreshing={refreshing}
              onRefresh={refresh}
              live={!failed}
            />
          )}

          {briefOpen && !loading && <BriefPanel text={pendingBrief} at={feed.brief.at} onClose={() => setBriefOpen(false)} />}

          {/* The views: sticky so they stay one tap away while the list scrolls. */}
          <div className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
            <ViewsBar view={view} counts={counts} onChange={(v) => { setView(v); setVisible(PAGE); }} disabled={loading || failed} />
          </div>

          <div id="tl-panel" role="tabpanel" aria-labelledby={`tl-tab-${view}`} tabIndex={-1} className={cn('flex flex-col gap-6', focusRing)}>
            {failed ? (
              <ErrorState onRetry={() => setFailed(false)} />
            ) : loading ? (
              <SkeletonRows count={6} />
            ) : empty ? (
              <EmptyState view={view} onShowAll={() => setView('all')} />
            ) : view === 'needs' ? (
              <NeedsView items={items} ready={feed.ready} sessions={feed.sessions} c={common} />
            ) : (
              <StreamView view={view} items={sliced} lastSeenAt={feed.lastSeenAt} c={common} total={stream.length} onMore={() => setVisible((v) => v + PAGE)} />
            )}
          </div>

          {feed.live.length > 0 && !failed && !loading && (
            <aside aria-label={t.demo.label} className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-body-sm text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-foreground">{t.demo.label}</span>
              <span className="min-w-0 flex-1 basis-56 text-pretty">{t.demo.explain}</span>
              <button
                type="button"
                disabled={fired >= feed.live.length}
                onClick={() => fire(feed.live.findIndex((_, i) => !firedSteps.current.has(i)))}
                className={cn('inline-flex h-11 items-center rounded-lg border border-input bg-card px-4 text-body font-medium text-foreground hover:bg-accent disabled:opacity-50', focusRing)}
              >
                {fired >= feed.live.length ? t.demo.spent : t.demo.fire}
              </button>
            </aside>
          )}
          <p className="hidden text-caption text-muted-foreground md:block">
            {fill(t.shortcuts, { j: <kbd className="rounded border border-border bg-card px-1.5 font-mono">j</kbd>, k: <kbd className="rounded border border-border bg-card px-1.5 font-mono">k</kbd> })}
          </p>
        </main>

        {pending.length > 0 && (
          <div className="fixed inset-x-0 top-16 z-30 flex justify-center px-4">
            <button
              type="button"
              onClick={showPending}
              className={cn('inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-body font-semibold text-background shadow-lg', focusRing)}
            >
              <span className="tabular-nums">{pending.length}</span>
              {t.pill}
            </button>
          </div>
        )}

        <div aria-live="polite" role="status" className="sr-only">
          {announce}
        </div>
        <ToastRegion toast={toast} onClose={() => setToast(null)} />
      </div>
    </MotionConfig>
  );
}
