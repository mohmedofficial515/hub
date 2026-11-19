// v3 "Search first": the whole settings area in one page with internal (hash) routing:
// overview command surface → group focus view → my preferences, plus the two special pages and `maintenance`.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MotionConfig } from 'framer-motion';
import { Direction, Tooltip } from 'radix-ui';
import { useLocale } from '@lab/i18n';
import { ErrorState, LoadingState, PreviewControls, Toasts, TopBar, Tray } from './parts/chrome';
import { GroupPage } from './parts/group-page';
import { Overview } from './parts/overview';
import { PreferencesPage } from './parts/preferences';
import { ReviewSheet } from './parts/review-sheet';
import { startParam, useRoute } from './parts/route';
import { StoreProvider, useStore, type Scenario } from './parts/store';

const SCENARIOS: Scenario[] = ['default', 'loading', 'empty', 'error'];

export default function Page() {
  const locale = useLocale();
  const scenario = startParam('scenario');
  return (
    <Direction.Provider dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Tooltip.Provider delayDuration={300}>
        <MotionConfig reducedMotion="user">
          <StoreProvider
            initialRole={startParam('as') === 'admin' ? 'admin' : 'owner'}
            initialScenario={SCENARIOS.includes(scenario as Scenario) ? (scenario as Scenario) : 'default'}
          >
            <Shell />
          </StoreProvider>
        </MotionConfig>
      </Tooltip.Provider>
    </Direction.Provider>
  );
}

function Shell() {
  const route = useRoute();
  const store = useStore();
  const [reviewAll, setReviewAll] = useState(false);
  const last = useRef(route.view);

  useEffect(() => {
    if (last.current !== route.view && !('field' in route && route.field)) window.scrollTo({ top: 0 });
    last.current = route.view;
  }, [route]);

  let body;
  if (store.scenario === 'loading') body = <LoadingState />;
  else if (store.scenario === 'error') body = <ErrorState onRetry={() => store.setScenario('default')} />;
  else if (route.view === 'group') body = <GroupPage route={route} />;
  else if (route.view === 'prefs') body = <PreferencesPage route={route} />;
  else body = <Overview />;

  const trayVisible = route.view !== 'group' && store.dirtyCount() > 0 && store.scenario !== 'loading' && store.scenario !== 'error';

  return (
    // --settings-sticky-top: height of the host shell's sticky top bar (0 in the lab). Sticky search, jump menu, facets and
    // scroll margins sit under it; --settings-sticky-bottom does the same for the save bar.
    <div
      className="min-h-dvh bg-background font-sans text-foreground antialiased"
      style={{ '--settings-sticky-top': '0px', '--settings-sticky-bottom': '0px' } as CSSProperties}
    >
      {route.view !== 'group' && store.scenario !== 'error' && <TopBar route={route} />}
      <main>{body}</main>
      <PreviewControls />
      {route.view !== 'group' && store.scenario !== 'loading' && store.scenario !== 'error' && <Tray onReview={() => setReviewAll(true)} />}
      <ReviewSheet open={reviewAll} onOpenChange={setReviewAll} groupKeys={store.dirtyGroups} />
      <Toasts raised={trayVisible || route.view === 'group'} />
    </div>
  );
}
