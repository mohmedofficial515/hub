import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { Direction } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { messages } from '../../../today/v5-peacock-app/i18n';
import { resetCardStore } from '../../../today/v5-peacock-app/kit/card-store';
import { requestTitleFocus } from '../../../today/v5-peacock-app/kit/layout';
import { ToastRegion } from '../../../today/v5-peacock-app/kit/toast';
import { CommandPalette } from '../../../today/v5-peacock-app/shell/command-palette';
import { NewCardDialog, type NewCardType } from '../../../today/v5-peacock-app/shell/new-card-dialog';
import { SidebarDrawer, useSidebarCollapsed } from '../../../today/v5-peacock-app/shell/sidebar';
import { viewById, views } from '../../../today/v5-peacock-app/shell/views';
import { ShortcutsDialog } from './shortcuts';
import { wbMessages } from './strings';
import { TipProvider } from './tips';
import { cn, ErrorState, focusRing, matchKey, navigate, PageContainer, setPreference, shortcutsEnabled, Skeleton, SkeletonRows, usePreference, useRoute, useSession } from './kit';

/** The approved shell's plumbing (v5 `shell/shell.tsx`), with its modal sheet taken out so a direction can place the sheet itself. */
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

const DocsPage = lazy(() => import('../parts/docs-page'));

/** The real page of the current view. Docs is this version's own copy, because the document protocol lives on it. */
export function ViewOutlet() {
  const t = useT(messages);
  const { view } = useRoute();
  const Page = view === 'docs' ? DocsPage : viewById(view).Page;
  const first = useRef(true);
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

/** `Ctrl+/` (`Cmd+/`): closes and reopens from anywhere, even while typing. It is the same key on an Arabic layout, through `e.code`. */
export function useToggleKey(toggle: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && matchKey(e, '/')) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);
}

/** While `active`, the sidebar folds to icons so the work keeps a readable column. It goes back to the owner's choice afterwards. */
export function useFoldSidebar(active: boolean) {
  const pref = usePreference('sidebarCollapsed');
  const folded = useRef(false);
  const before = useRef(pref);
  useEffect(() => {
    if (active && !folded.current) {
      folded.current = true;
      before.current = pref;
      setPreference('sidebarCollapsed', true);
    } else if (!active && folded.current) {
      folded.current = false;
      setPreference('sidebarCollapsed', before.current);
    }
  }, [active, pref]);
  return pref;
}

export interface ShellControls {
  openNav: () => void;
  openPalette: () => void;
  openNew: () => void;
  openHelp: () => void;
}

/** Providers, skip link, overlays and global keys of the approved shell. A direction draws the layout through `children`. */
export function WorkbenchRoot({ children }: { children: (controls: ShellControls, rootReady: boolean) => ReactNode }) {
  const t = useT(messages);
  const w = useT(wbMessages);
  const locale = useLocale();
  const { scenario } = useSession();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [rootReady, setRootReady] = useState(false);
  useLayoutEffect(() => setRootReady(true), []);
  const [newCard, setNewCard] = useState<{ open: boolean; type: NewCardType }>({ open: false, type: 'task' });

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
        <TipProvider>
          <div id="hub-root" className="peacock-app min-h-dvh bg-background text-foreground">
            <a
              href="#main"
              onClick={(e) => {
                e.preventDefault();
                // With the page stepped aside, the content is the card.
                const main = document.getElementById('main');
                if (main?.offsetParent) main.focus();
                else (document.querySelector<HTMLElement>('[data-sheet-title]') ?? main)?.focus();
              }}
              className={cn('sr-only rounded-md bg-primary px-3 py-2 text-body font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:start-3 focus:top-2 focus:z-[90]', focusRing)}
            >
              {t.skip}
            </a>
            <a
              href="#wb-panel"
              data-wb-skip-panel
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new Event('wb:focus-panel'));
              }}
              className={cn('sr-only rounded-md bg-primary px-3 py-2 text-body font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:start-3 focus:top-2 focus:z-[90]', focusRing)}
            >
              {w.pro.skipPanel}
            </a>
            {children({ openNav: () => setNavOpen(true), openPalette, openNew: () => openNew(), openHelp }, rootReady)}
            {rootReady && (
              <>
                <SidebarDrawer open={navOpen} onOpenChange={setNavOpen} onShortcuts={openHelp} />
                <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onNewCard={openNew} onShortcuts={openHelp} />
                <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
                <NewCardDialog open={newCard.open} initialType={newCard.type} onOpenChange={(open) => setNewCard((c) => ({ ...c, open }))} />
              </>
            )}
            <ToastRegion />
          </div>
        </TipProvider>
      </Direction.Provider>
    </MotionConfig>
  );
}
