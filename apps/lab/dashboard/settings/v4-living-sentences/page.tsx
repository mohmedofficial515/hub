/**
 * v4 "Living sentences": the settings area as a policy book. The overview is a table of contents of 8 chapters with every group
 * summarised in one sentence built from its live values; a group page reads as paragraphs whose values are editable tokens; review,
 * history and preferences are written the same way. Internal state routing only (no next/*), data from @lab/mocks/settings.
 */
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { SectionId } from '@lab/mocks/settings';
import { BookProvider, useBook } from './parts/store';
import { TipProvider } from './parts/ui';
import { Overview, Toc } from './parts/overview';
import { GroupPage } from './parts/group-page';
import { PrefEffects, PrefsPage } from './parts/prefs';
import { SearchResults } from './parts/search';
import { HistorySheet, ReviewSheet } from './parts/sheets';
import { SaveBar, ToastView, TopBar } from './parts/chrome';
import { BookSkeleton, EmptyState, ErrorState } from './parts/states';

export default function Page() {
  return (
    <BookProvider>
      <TipProvider>
        <Shell />
      </TipProvider>
    </BookProvider>
  );
}

function Shell() {
  const book = useBook();
  const { t, phase, route, query, filter } = book;
  const reduce = useReducedMotion();
  const [booted, setBooted] = useState(false);
  const [active, setActive] = useState<SectionId | null>('platform');
  const onActive = useCallback((id: SectionId) => setActive(id), []);

  useEffect(() => {
    const id = window.setTimeout(() => setBooted(true), 450);
    return () => window.clearTimeout(id);
  }, []);

  const searching = !!query.trim() || filter !== 'all';
  const viewKey = !booted || phase !== 'ready' ? `state-${phase}-${booted}` : searching ? 'search' : route.view === 'group' ? `g-${route.key}` : route.view;

  let content;
  if (!booted || phase === 'loading') content = <BookSkeleton />;
  else if (phase === 'error') content = <ErrorState />;
  else if (phase === 'empty') content = <EmptyState />;
  else if (searching) content = <SearchResults />;
  else if (route.view === 'group') content = <GroupPage docKey={route.key} />;
  else if (route.view === 'prefs') content = <PrefsPage />;
  else content = <Overview onActive={onActive} />;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t.ui.skip}
      </a>
      <TopBar active={active} />
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:gap-10 lg:px-8 xl:gap-16">
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pb-10 pt-8">
            <Toc active={route.view === 'overview' && !searching ? active : null} />
          </div>
        </aside>
        <main id="main" tabIndex={-1} className="min-w-0 pb-48 pt-8 outline-none sm:pt-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={viewKey}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <SaveBar />
      <ReviewSheet />
      <HistorySheet />
      <ToastView />
      <PrefEffects />
    </div>
  );
}
