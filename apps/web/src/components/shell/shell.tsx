'use client';

/**
 * @file shell.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/shell/shell.tsx. Contract: apps/web/README.md.
 */
import { MotionConfig } from 'framer-motion';
import { Direction, Tooltip as RadixTooltip } from 'radix-ui';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { requestTitleFocus } from '@/components/common/layout';
import { ToastRegion } from '@/components/common/toast';
import {
  CardSheet,
  cn,
  focusRing,
  matchKey,
  navigate,
  setPreference,
  shortcutsEnabled,
  useRoute,
} from '@/components/kit';
import { CommandPalette } from '@/components/shell/command-palette';
import { Header } from '@/components/shell/header';
import { NewCardDialog, type NewCardType } from '@/components/shell/new-card-dialog';
import { RouterBridge } from '@/components/shell/router';
import { ShortcutsDialog } from '@/components/shell/shortcuts-dialog';
import { DesktopSidebar, SidebarDrawer, useSidebarCollapsed } from '@/components/shell/sidebar';
import { views } from '@/components/shell/views';
import { useSession } from '@/features/session/session';
import { onSignedOut } from '@/lib/api/client';
import { useDocumentTitle } from '@/lib/hooks';
import { useLocale, useT } from '@/lib/i18n';
import { messages } from '@/lib/i18n';

/** Moving between views: announce it and put focus on the new page's title, or on main until it has loaded. */
function useViewFocus() {
  const t = useT(messages);
  const { view, known } = useRoute();
  // An unknown address parses as Today. It is not, and its 404 page names itself.
  const project = useSession().workspace?.name;
  useDocumentTitle(known ? t.nav[view] : undefined, known ? project : undefined);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    document.getElementById('main')?.focus({ preventScroll: true });
    requestTitleFocus();
  }, [view, t.nav]);
}

/** Global keys (08 §12). Ctrl/Cmd+K and Esc are always on; the rest respects the shortcuts preference. */
function useGlobalKeys(actions: {
  palette: () => void;
  help: () => void;
  newCard: (type: NewCardType) => void;
}) {
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
      if (el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]'))
        return;
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
        const type = (['t', 'd', 'n', 'h'] as const).flatMap((k) =>
          matchKey(e, k) ? [({ t: 'task', d: 'decision', n: 'need', h: 'handoff' } as const)[k]] : [],
        )[0];
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

export function Shell({ children }: { children: ReactNode }) {
  const t = useT(messages);
  const locale = useLocale();
  const { view } = useRoute();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [rootReady, setRootReady] = useState(false);
  useLayoutEffect(() => setRootReady(true), []);
  const [newCard, setNewCard] = useState<{ open: boolean; type: NewCardType }>({ open: false, type: 'task' });

  useViewFocus();

  // A session that cannot be refreshed is over. The next request would only fail again, so every query that got a 401 shares one navigation.
  const leaving = useRef(false);
  useEffect(
    () =>
      onSignedOut(() => {
        if (leaving.current) return;
        leaving.current = true;
        const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
        window.location.assign(`/${locale}/sign-in?next=${next}`);
      }),
    [locale],
  );

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const openNew = useCallback((type: NewCardType = 'task') => setNewCard({ open: true, type }), []);
  const keys = useRef({ palette: openPalette, help: openHelp, newCard: openNew });
  useGlobalKeys(keys.current);

  return (
    <MotionConfig reducedMotion="user">
      <Direction.Provider dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <RadixTooltip.Provider delayDuration={200} skipDelayDuration={100}>
          <RouterBridge />
          <div id="hub-root" className="min-h-dvh bg-background text-foreground">
            <a
              href="#main"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('main')?.focus();
              }}
              className={cn(
                'sr-only rounded-md bg-primary px-3 py-2 text-body font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:start-3 focus:top-2 focus:z-[90]',
                focusRing,
              )}
            >
              {t.skip}
            </a>
            {view === 'gallery' ? (
              // The lab has the whole window. Everything below still serves it: the sheet, the palette, the keys, the toasts.
              <main id="main" tabIndex={-1} className="outline-none">
                {children}
              </main>
            ) : (
              <div className="flex min-h-dvh">
                <DesktopSidebar onShortcuts={openHelp} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Header
                    onOpenNav={() => setNavOpen(true)}
                    onOpenPalette={openPalette}
                    onNewCard={() => openNew()}
                    onShortcuts={openHelp}
                  />
                  <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
                    {children}
                  </main>
                </div>
              </div>
            )}
            {/* Overlays portal into #hub-root to keep its tokens, so a deep-linked sheet waits for the root to exist. */}
            {rootReady && (
              <>
                <SidebarDrawer open={navOpen} onOpenChange={setNavOpen} onShortcuts={openHelp} />
                <CardSheet />
                <CommandPalette
                  open={paletteOpen}
                  onOpenChange={setPaletteOpen}
                  onNewCard={openNew}
                  onShortcuts={openHelp}
                />
                <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
                <NewCardDialog
                  open={newCard.open}
                  initialType={newCard.type}
                  onOpenChange={(open) => setNewCard((c) => ({ ...c, open }))}
                />
              </>
            )}
            <ToastRegion />
          </div>
        </RadixTooltip.Provider>
      </Direction.Provider>
    </MotionConfig>
  );
}
