// v6-change-desk: the whole settings experience as a change desk. Every edit stages into one draft ticket (dock at the
// bottom); review & apply turns it into one new version per group; a timeline and an as-of view read the version history.
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarClock, History, LayoutGrid, SlidersHorizontal, Ticket } from 'lucide-react';
import { relativeTime } from './parts/format';
import { TooltipProvider } from '@dash/components/ui/tooltip';
import { cn } from '@dash/lib/utils';
import { AsOf } from './parts/asof';
import { GroupPage } from './parts/group-page';
import { Overview } from './parts/overview';
import { Preferences } from './parts/preferences';
import { Review } from './parts/review';
import { SearchBox } from './parts/search';
import { ErrorState, LoadingState, Toasts } from './parts/states';
import { DeskProvider, useDesk, type View } from './parts/store';
import { Timeline } from './parts/timeline';
import { Tray } from './parts/tray';
import { Btn, focusRing, Segmented } from './parts/ui';

export default function Page() {
  return (
    <TooltipProvider delayDuration={250}>
      <DeskProvider>
        <Shell />
      </DeskProvider>
    </TooltipProvider>
  );
}

const TABS: { v: View; icon: typeof LayoutGrid; key: 'overview' | 'timeline' | 'asof' | 'prefs' }[] = [
  { v: 'overview', icon: LayoutGrid, key: 'overview' },
  { v: 'timeline', icon: History, key: 'timeline' },
  { v: 'asof', icon: CalendarClock, key: 'asof' },
  { v: 'prefs', icon: SlidersHorizontal, key: 'prefs' },
];

function Shell() {
  const { t, l, route, go, scenario, role, setRole, restored, dismissRestored, draft } = useDesk();
  const dock = Object.keys(draft).length > 0 && !['review', 'prefs', 'asof'].includes(route.v);
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>(scenario === 'loading' ? 'loading' : scenario === 'error' ? 'error' : 'ready');

  useEffect(() => {
    if (!route.f) window.scrollTo({ top: 0 });
  }, [route.v, route.g, route.f]);

  const current: View = route.v === 'group' || route.v === 'review' ? 'overview' : route.v;

  let content;
  if (phase === 'loading') content = <LoadingState />;
  else if (phase === 'error') content = <ErrorState onRetry={() => setPhase('ready')} />;
  else if (route.v === 'group' && route.g) content = <GroupPage groupKey={route.g} />;
  else if (route.v === 'review') content = <Review />;
  else if (route.v === 'timeline') content = <Timeline />;
  else if (route.v === 'asof') content = <AsOf />;
  else if (route.v === 'prefs') content = <Preferences />;
  else content = <Overview />;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Toasts />
      <div className={cn('mx-auto w-full max-w-[1320px] px-4 pt-5 sm:px-6 sm:pt-7 lg:px-8', dock ? 'pb-32' : 'pb-12')}>
        <header className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid min-w-0 gap-1">
              <h1 className="text-26 font-extrabold leading-tight sm:text-32">{t.title}</h1>
              <p className="max-w-[60ch] text-14 leading-relaxed text-muted-foreground">{t.subtitle}</p>
            </div>
            <SearchBox />
          </div>
          <div className="grid min-w-0 gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <nav aria-label={t.nav.label} className="-mx-4 min-w-0 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <ul className="flex w-max gap-1 rounded-xl bg-muted p-1">
                {TABS.map(({ v, icon: I, key }) => {
                  const on = current === v;
                  return (
                    <li key={v}>
                      <button
                        type="button"
                        aria-current={on ? 'page' : undefined}
                        onClick={() => go({ v })}
                        className={cn(
                          'inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-13 font-bold transition-colors sm:min-h-10',
                          focusRing,
                          on ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <I aria-hidden className="size-4" />
                        {t.nav[key]}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="flex items-center gap-2" title={t.role.staffHint}>
              <span className="text-12 font-semibold text-muted-foreground">{t.role.label}</span>
              <span className="rounded-md border border-dashed px-1.5 text-12 text-muted-foreground">{t.role.labOnly}</span>
              <Segmented
                size="sm"
                label={t.role.label}
                value={role}
                onChange={setRole}
                options={[
                  { value: 'owner', label: t.role.owner },
                  { value: 'staff', label: t.role.staff, hint: t.role.staffHint },
                ]}
              />
            </div>
          </div>
        </header>
        {restored && phase === 'ready' && (
          <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-14">
            <span className="flex min-w-0 items-start gap-2">
              <Ticket aria-hidden className="mt-0.5 size-4 shrink-0 text-[color:var(--primary)]" />
              {t.ticket.restored(restored.count, relativeTime(restored.savedAt, l))}
            </span>
            <Btn variant="outline" onClick={dismissRestored}>
              {t.ticket.restoredOk}
            </Btn>
          </div>
        )}
        <motion.main
          key={`${route.v}-${route.g ?? ''}-${phase}`}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {content}
        </motion.main>
      </div>
      {phase === 'ready' && <Tray />}
    </div>
  );
}
