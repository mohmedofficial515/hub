import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { Direction, Tooltip as RadixTooltip } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { CardSheet, cn, ErrorState, focusRing, matchKey, navigate, PageContainer, setPreference, shortcutsEnabled, Skeleton, SkeletonRows, useRoute, useSession } from '../kit';
import { resetCardStore } from '../kit/card-store';
import { requestTitleFocus } from '../kit/layout';
import { ToastRegion } from '../kit/toast';
import { messages } from '../i18n';
import { CommandPalette } from './command-palette';
import { Header } from './header';
import { NewCardDialog, type NewCardType } from './new-card-dialog';
import { ShortcutsDialog } from './shortcuts-dialog';
import { DesktopSidebar, SidebarDrawer, useSidebarCollapsed } from './sidebar';
import { viewById, views } from './views';

/** A view that fails to load must not take the shell down with it. */
class ViewBoundary extends Component<{ children: ReactNode; label: string; resetKey: string }, { failed: boolean; key: string }> {
  state = { failed: false, key: this.props.resetKey };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  static getDerivedStateFromProps(props: { resetKey: string }, state: { key: string }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <ErrorState thing={this.props.label} code="view.load_failed" onRetry={() => this.setState({ failed: false })} />;
  }
}

function ViewFallback() {
  return (
    <PageContainer>
      <Skeleton className="h-8 w-56" />
      <SkeletonRows count={6} />
    </PageContainer>
  );
}

function ViewOutlet() {
  const t = useT(messages);
  const { view } = useRoute();
  const { Page } = viewById(view);
  const first = useRef(true);

  // Moving between views: announce it and put focus on the new page's title, or on main until it has loaded.
  useLayoutEffect(() => {
    document.title = `${t.nav[view]} · Hub`;
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    document.getElementById('main')?.focus({ preventScroll: true });
    requestTitleFocus();
  }, [view, t.nav]);

  return (
    <ViewBoundary label={t.viewError} resetKey={view}>
      <Suspense fallback={<ViewFallback />}>
        <Page key={view} />
      </Suspense>
    </ViewBoundary>
  );
}

/** Global keys (08 §12). Ctrl/Cmd+K and Esc are always on; the rest respects the shortcuts preference. */
function useGlobalKeys(actions: { palette: () => void; help: () => void; newCard: (type: NewCardType) => void }) {
  const collapsed = useSidebarCollapsed();
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;

  useEffect(() => {
    let sequence: 'g' | 'n' | null = null;
    let timer: number | undefined;
    const startSequence = (key: 'g' | 'n') => {
      sequence = key;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (sequence = null), 1200);
    };
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if ((e.ctrlKey || e.metaKey) && matchKey(e, 'k')) {
        e.preventDefault();
        actions.palette();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      if (!shortcutsEnabled()) return;

      if (sequence === 'g') {
        sequence = null;
        const view = views.find((v) => v.goKey && matchKey(e, v.goKey));
        if (view) {
          e.preventDefault();
          navigate(view.id);
        }
        return;
      }
      if (sequence === 'n') {
        sequence = null;
        const type = (['t', 'd', 'n', 'h'] as const).flatMap((k) => (matchKey(e, k) ? [({ t: 'task', d: 'decision', n: 'need', h: 'handoff' } as const)[k]] : []))[0];
        if (type) {
          e.preventDefault();
          actions.newCard(type);
        }
        return;
      }
      if (matchKey(e, '?')) {
        e.preventDefault();
        actions.help();
      } else if (matchKey(e, '/')) {
        e.preventDefault();
        actions.palette();
      } else if (matchKey(e, 'g')) {
        startSequence('g');
      } else if (matchKey(e, 'n')) {
        startSequence('n');
      } else if (matchKey(e, '[') || matchKey(e, ']')) {
        e.preventDefault();
        setPreference('sidebarCollapsed', matchKey(e, '['));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [actions]);
}

export function Shell() {
  const t = useT(messages);
  const locale = useLocale();
  const { scenario } = useSession();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [rootReady, setRootReady] = useState(false);
  useLayoutEffect(() => setRootReady(true), []);
  const [newCard, setNewCard] = useState<{ open: boolean; type: NewCardType }>({ open: false, type: 'task' });

  // A new scenario starts from fresh data, as a page load would.
  const lastScenario = useRef(scenario);
  useEffect(() => {
    if (lastScenario.current !== scenario) {
      lastScenario.current = scenario;
      resetCardStore();
    }
  }, [scenario]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const openNew = useCallback((type: NewCardType = 'task') => setNewCard({ open: true, type }), []);
  const keys = useRef({ palette: openPalette, help: openHelp, newCard: openNew });
  useGlobalKeys(keys.current);

  return (
    <MotionConfig reducedMotion="user">
      <Direction.Provider dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <RadixTooltip.Provider delayDuration={200} skipDelayDuration={100}>
          <div id="hub-root" className="peacock-app min-h-dvh bg-background text-foreground">
            <a
              href="#main"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('main')?.focus();
              }}
              className={cn('sr-only rounded-md bg-primary px-3 py-2 text-body font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:start-3 focus:top-2 focus:z-[90]', focusRing)}
            >
              {t.skip}
            </a>
            <div className="flex min-h-dvh">
              <DesktopSidebar onShortcuts={openHelp} />
              <div className="flex min-w-0 flex-1 flex-col">
                <Header onOpenNav={() => setNavOpen(true)} onOpenPalette={openPalette} onNewCard={() => openNew()} onShortcuts={openHelp} />
                <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
                  <ViewOutlet />
                </main>
              </div>
            </div>
            {/* Overlays portal into #hub-root to keep its tokens, so a deep-linked sheet waits for the root to exist. */}
            {rootReady && (
              <>
                <SidebarDrawer open={navOpen} onOpenChange={setNavOpen} onShortcuts={openHelp} />
                <CardSheet />
                <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onNewCard={openNew} onShortcuts={openHelp} />
                <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
                <NewCardDialog open={newCard.open} initialType={newCard.type} onOpenChange={(open) => setNewCard((c) => ({ ...c, open }))} />
              </>
            )}
            <ToastRegion />
          </div>
        </RadixTooltip.Provider>
      </Direction.Provider>
    </MotionConfig>
  );
}
