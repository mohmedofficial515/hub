/**
 * v2-control-center: the whole settings experience in one page with internal routing (overview → group page →
 * preferences, plus the payment gateways and WhatsApp pages and the new maintenance group). The overview is a live
 * status board; every number on it is computed from the session's saved values, so a save changes the board.
 *
 * Hash params (all optional): view=overview|group|prefs · g=<group key> · f=<field key> · panel=review|history ·
 * tab=appearance|tables|notifications · q=<search> · viewer=owner|admin|none · scenario=loading|error|empty ·
 * draft=demo (preloads a few edits for g, to open the review sheet from a link).
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AttentionPanel, Board, BoardHeader, RecentChanges } from './parts/overview';
import { GroupPage } from './parts/group-page';
import { PreferencesPanel } from './parts/preferences';
import { SearchBox } from './parts/search';
import { BoardSkeleton, DemoBar, LoadError, NoAccess, Toasts } from './parts/states';
import { StoreProvider, useStore } from './parts/store';
import { TipProvider } from './parts/ui';

export default function Page() {
  return (
    <StoreProvider>
      <TipProvider>
        <Shell />
      </TipProvider>
    </StoreProvider>
  );
}

function Shell() {
  const { route, scenario, viewer } = useStore();
  const reduce = useReducedMotion();
  const key = route.view === 'group' ? `group-${route.group}` : route.view;

  let body;
  if (route.view === 'prefs') {
    body = (
      <div className="grid gap-8">
        <BoardHeader />
        <PreferencesPanel />
      </div>
    );
  } else if (route.view === 'group') {
    body =
      scenario === 'loading' ? (
        <BoardSkeleton />
      ) : scenario === 'error' ? (
        <LoadError />
      ) : viewer === 'none' ? (
        <NoAccess />
      ) : (
        <div className="grid gap-6">
          <div className="ms-auto w-full sm:max-w-sm">
            <SearchBox size="md" />
          </div>
          <GroupPage groupKey={route.group ?? ''} />
        </div>
      );
  } else {
    body = (
      <div className="grid gap-8">
        <BoardHeader />
        {scenario === 'loading' ? (
          <BoardSkeleton />
        ) : scenario === 'error' ? (
          <LoadError />
        ) : viewer === 'none' ? (
          <NoAccess />
        ) : (
          <>
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
              <AttentionPanel />
              <RecentChanges />
            </div>
            <Board />
          </>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1320px] px-4 pb-8 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={key}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
          >
            {body}
          </motion.div>
        </AnimatePresence>
        <DemoBar />
      </div>
      <Toasts />
    </main>
  );
}
