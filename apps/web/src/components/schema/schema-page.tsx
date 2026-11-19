'use client';

/**
 * @file schema-page.tsx
 * @description Schema Studio (docs/17): the project's database design as a full-window workspace, in the manner of a design tool. The map takes the whole window; over it float
 * two small bars (on the start side the layers, the title and the three views; on the end side search, Claude's names, refresh, the side panel and full screen) and, on the map,
 * a toolbar at the bottom. The layers and the side panel open only when asked for. Full screen covers Hub's sidebar and header and is the default; a press that reaches
 * Claude steps out of it, since Claude answers in the panel beside the page.
 * Keys: `/` or Ctrl+Shift+K searches the design (on this page `/` is the page's search, not the global palette, review M9), L the layers, I the side panel, Escape leaves a focus.
 */
import { changeCount, grantFor, type SchemaChangeSummary, type SchemaStudioDto } from '@hub/contracts';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpenText,
  Database,
  ListTree,
  Maximize2,
  Minimize2,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Search,
  Sparkles,
  Waypoints,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  cn,
  ErrorState,
  fmt,
  IconButton,
  LoadingRegion,
  matchKey,
  plural,
  shortcutsEnabled,
  showToast,
  Skeleton,
  Tooltip,
  useLocale,
  usePageTitleFocus,
  useSession,
} from '@/components/kit';
import { useRefreshSchema, useSchemaStudio } from '@/features/schema/queries';
import { isHubError } from '@/lib/api/errors';

import { Diagram } from './diagram';
import { DomainRail } from './domain-rail';
import { ChangeDialog } from './draft-dock';
import { SearchDialog } from './search-dialog';
import { SidePanel } from './side-panel';
import { SourceDialog, SourceSetup } from './source-setup';
import { StudioProvider, type StudioView, useChrome, useSchemaWords, useStudio } from './studio';
import { DictionaryView, EnumsView } from './views';

type Ready = SchemaStudioDto & { snapshot: NonNullable<SchemaStudioDto['snapshot']> };

function summaryOf(
  changes: SchemaChangeSummary | null,
  t: ReturnType<typeof useSchemaWords>,
  locale: 'ar' | 'en',
): string {
  if (!changes || changeCount(changes) === 0) return t.summary.none;
  const tables = changes.addedModels.length + changes.removedModels.length + changes.changedModels.length;
  const columns = changes.addedFields.length + changes.removedFields.length + changes.changedFields.length;
  const enums = changes.addedEnums.length + changes.removedEnums.length + changes.changedEnums.length;
  return [
    tables && plural(tables, locale, t.summary.tables),
    columns && plural(columns, locale, t.summary.columns),
    enums && plural(enums, locale, t.summary.enums),
  ]
    .filter(Boolean)
    .join(locale === 'ar' ? '، ' : ', ');
}

/** A bar's button with its name in a tooltip, and the key that does the same. */
function BarButton({
  label,
  tip,
  pressed,
  onPress,
  children,
  ...rest
}: {
  label: string;
  tip?: string | undefined;
  pressed?: boolean | undefined;
  onPress: () => void;
  children: React.ReactNode;
  [data: `data-${string}`]: unknown;
}) {
  return (
    <Tooltip content={tip ?? label}>
      <IconButton
        label={label}
        aria-pressed={pressed}
        data-pressed={pressed || undefined}
        className="schema-tool"
        onClick={onPress}
        {...rest}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}

function StartBar({ onLayers }: { onLayers: () => void }) {
  const studio = useStudio();
  const chrome = useChrome();
  const t = useSchemaWords();
  const locale = useLocale();
  const Layers = locale === 'ar' ? PanelRight : PanelLeft;
  // The page draws its own title, so it takes the focus a view change asks for, as a `PageHeader` would.
  const title = useRef<HTMLHeadingElement>(null);
  usePageTitleFocus(title);
  const views: { value: StudioView; label: string; icon: typeof Waypoints }[] = [
    { value: 'diagram', label: t.views.diagram, icon: Waypoints },
    { value: 'dictionary', label: t.views.dictionary, icon: BookOpenText },
    { value: 'enums', label: t.views.enums, icon: ListTree },
  ];
  return (
    <div className="schema-topbar" data-side="start">
      <BarButton
        label={t.domains.title}
        tip={t.chrome.keys.layers}
        pressed={chrome.layers}
        onPress={onLayers}
        aria-expanded={chrome.layers}
        data-schema-rail-toggle
      >
        <Layers aria-hidden className="size-4" strokeWidth={1.75} />
      </BarButton>
      <div className="schema-title">
        <span className="schema-title-icon" aria-hidden>
          <Database className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h1
            ref={title}
            tabIndex={-1}
            className="truncate text-body font-semibold text-foreground outline-none"
          >
            {t.title}
          </h1>
          <p className="schema-title-meta truncate text-caption text-muted-foreground">
            <bdi dir="ltr">{studio.data.source?.name}</bdi> ·{' '}
            {plural(studio.doc.stats.models, locale, t.stats.models)}
          </p>
        </div>
      </div>
      <span className="schema-toolbar-gap" aria-hidden />
      <div role="group" aria-label={t.views.label} className="schema-toolbar-group" data-view-switch>
        {views.map(({ value, label, icon: Icon }) => (
          <BarButton
            key={value}
            label={label}
            pressed={studio.view === value}
            onPress={() => studio.setView(value)}
          >
            <Icon aria-hidden className="size-4" strokeWidth={1.75} />
          </BarButton>
        ))}
      </div>
    </div>
  );
}

function EndBar({ onSearch }: { onSearch: () => void }) {
  const studio = useStudio();
  const chrome = useChrome();
  const t = useSchemaWords();
  const locale = useLocale();
  const refresh = useRefreshSchema();
  const Panel = locale === 'ar' ? PanelLeft : PanelRight;

  const runRefresh = () =>
    refresh.mutate(
      {},
      {
        onSuccess: (result) =>
          showToast({
            message: result.created
              ? fmt(t.toasts.refreshed, { summary: summaryOf(result.changes, t, locale) })
              : t.toasts.unchanged,
            tone: 'success',
          }),
        onError: (error) =>
          showToast({ message: isHubError(error) ? error.message : t.states.error, tone: 'error' }),
      },
    );

  return (
    <div className="schema-topbar" data-side="end">
      <Tooltip content={t.chrome.keys.search}>
        <button
          type="button"
          className="schema-search-button"
          onClick={onSearch}
          aria-label={t.actions.search}
        >
          <Search aria-hidden className="size-4" strokeWidth={1.75} />
          <span className="schema-search-text" aria-hidden>
            {t.chrome.searchShort}
          </span>
          <kbd className="schema-kbd" aria-hidden>
            /
          </kbd>
        </button>
      </Tooltip>
      {studio.can.annotate && (
        <BarButton
          label={t.actions.suggestNames}
          tip={t.actions.suggestNamesTip}
          onPress={() => void studio.suggestNames({})}
        >
          <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
        </BarButton>
      )}
      {studio.can.manage && (
        <BarButton
          label={refresh.isPending ? t.actions.refreshing : t.actions.refresh}
          tip={t.actions.refreshTip}
          onPress={runRefresh}
        >
          <RefreshCw
            aria-hidden
            className={cn('size-4', refresh.isPending && 'motion-safe:animate-spin')}
            strokeWidth={1.75}
          />
        </BarButton>
      )}
      <span className="schema-toolbar-gap" aria-hidden />
      <BarButton
        label={t.chrome.panel}
        tip={t.chrome.keys.panel}
        pressed={chrome.panel !== null}
        onPress={chrome.togglePanel}
        data-schema-panel-toggle
      >
        <Panel aria-hidden className="size-4" strokeWidth={1.75} />
      </BarButton>
      <BarButton
        label={chrome.immersive ? t.chrome.exitFullscreen : t.chrome.fullscreen}
        pressed={chrome.immersive}
        onPress={() => chrome.setImmersive(!chrome.immersive, { browser: true })}
      >
        {chrome.immersive ? (
          <Minimize2 aria-hidden className="size-4" strokeWidth={1.75} />
        ) : (
          <Maximize2 aria-hidden className="size-4" strokeWidth={1.75} />
        )}
      </BarButton>
    </div>
  );
}

/** The layers float over the map's start side. Not a modal: the map stays usable. Focus moves in when it opens, and Escape gives it back to the toggle (review B2). */
function LayersPanel({ onClose }: { onClose: () => void }) {
  const t = useSchemaWords();
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true });
  }, []);
  return (
    <motion.div
      ref={box}
      initial={{ opacity: 0, x: locale === 'ar' ? 16 : -16, scale: 0.985 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: locale === 'ar' ? 16 : -16, scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className="schema-layers"
      role="dialog"
      aria-modal={false}
      aria-label={t.domains.title}
      onKeyDown={(event) => {
        if (matchKey(event, 'Escape')) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <IconButton label={t.actions.close} className="schema-layers-close schema-tool" onClick={onClose}>
        <X aria-hidden className="size-4" strokeWidth={1.75} />
      </IconButton>
      <DomainRail />
    </motion.div>
  );
}

function Workspace() {
  const studio = useStudio();
  const chrome = useChrome();
  const [searching, setSearching] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const studioBox = useRef<HTMLDivElement>(null);

  const closeLayers = () => {
    chrome.setLayers(false);
    window.setTimeout(
      () =>
        studioBox.current
          ?.querySelector<HTMLElement>('[data-schema-rail-toggle]')
          ?.focus({ preventScroll: true }),
      0,
    );
  };

  // `/` and Ctrl+Shift+K search the design while this page is open, unless typing or in a dialog. It listens before the shell does and keeps `/`
  // from reaching it, so the page's search wins over the global palette here (review M9). Ctrl+K stays the palette.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const busy = target?.closest(
        'input, textarea, select, [contenteditable="true"], [role="dialog"][aria-modal="true"], [role="menu"]',
      );
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
      const slash = matchKey(event, '/') && !event.ctrlKey && !event.metaKey && !event.altKey;
      const chord = (event.ctrlKey || event.metaKey) && matchKey(event, 'K');
      if ((slash && !busy && shortcutsEnabled()) || chord) {
        event.preventDefault();
        event.stopPropagation();
        setSearching(true);
        return;
      }
      if (busy || typing || event.ctrlKey || event.metaKey || event.altKey || !shortcutsEnabled()) return;
      if (matchKey(event, 'l')) {
        event.preventDefault();
        chrome.setLayers(!chrome.layers);
      } else if (matchKey(event, 'i')) {
        event.preventDefault();
        chrome.togglePanel();
      } else if (matchKey(event, 'Escape') && studio.focus) {
        studio.setFocus(null);
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [studio, chrome]);

  return (
    <div
      ref={studioBox}
      className="schema-studio"
      data-immersive={chrome.immersive || undefined}
      data-panel={chrome.panel ?? undefined}
      data-layers={chrome.layers || undefined}
    >
      {/* The bars come first in Tab order, then the map's toolbar and its tables (review B2). */}
      <StartBar onLayers={() => (chrome.layers ? closeLayers() : chrome.setLayers(true))} />
      <EndBar onSearch={() => setSearching(true)} />
      <div className="schema-stage">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={studio.view}
            className="schema-view"
            data-view={studio.view}
            initial={{ opacity: 0, scale: 0.995 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.995 }}
            transition={{ duration: 0.18 }}
          >
            {studio.view === 'diagram' && <Diagram />}
            {studio.view === 'dictionary' && <DictionaryView />}
            {studio.view === 'enums' && <EnumsView />}
          </motion.div>
        </AnimatePresence>
      </div>
      <AnimatePresence>{chrome.layers && <LayersPanel onClose={closeLayers} />}</AnimatePresence>
      <SidePanel onSource={() => setSourceOpen(true)} />
      <SearchDialog open={searching} onOpenChange={setSearching} />
      <SourceDialog open={sourceOpen} onOpenChange={setSourceOpen} current={studio.data.source} />
      <ChangeDialog />
    </div>
  );
}

function Loading() {
  const t = useSchemaWords();
  return (
    <LoadingRegion label={t.states.loading} className="schema-studio p-4 md:p-6">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="min-h-96 flex-1" />
    </LoadingRegion>
  );
}

export function SchemaPage() {
  const t = useSchemaWords();
  const session = useSession();
  const query = useSchemaStudio();
  // The rule is the contract's (`schema.manage`), the same table the API enforces.
  const canManage = session.roles.some((role) => grantFor('schema.manage', role) !== 'N');

  if (query.isPending || session.loading) return <Loading />;
  if (query.isError) {
    return (
      <ErrorState
        title={t.states.error}
        detail={isHubError(query.error) ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const data = query.data;
  if (!data.source) return <SourceSetup canManage={canManage} />;
  if (!data.snapshot) {
    return (
      <div className="p-6">
        <ErrorState title={t.states.notRead} onRetry={() => void query.refetch()} />
      </div>
    );
  }
  return (
    <StudioProvider data={data as Ready}>
      <Workspace />
    </StudioProvider>
  );
}
