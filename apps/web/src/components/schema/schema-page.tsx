'use client';

/**
 * @file schema-page.tsx
 * @description Schema Studio (docs/17): the project's database design as a workspace. A header with the design's numbers and its two presses (Refresh design, Suggest Arabic names), the domains on one
 * side, the diagram or the dictionary, enums and history in the middle, the details of what is selected on the other side, and the open draft docked below. `/` or Ctrl+Shift+K
 * searches the design: on this page `/` is the page's search, not the global palette (review M9). Below 68rem the domains are a drawer that takes focus and closes on Escape.
 */
import { changeCount, type SchemaChangeSummary, type SchemaStudioDto } from '@hub/contracts';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Database, FolderCog, PanelLeft, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  Button,
  cn,
  ErrorState,
  fill,
  fmt,
  IconButton,
  LoadingRegion,
  Ltr,
  matchKey,
  num,
  plural,
  type PluralForms,
  RelativeTime,
  Segmented,
  shortcutsEnabled,
  showToast,
  Skeleton,
  Tooltip,
  useLocale,
  useSession,
} from '@/components/kit';
import { useRefreshSchema, useSchemaStudio } from '@/features/schema/queries';
import { isHubError } from '@/lib/api/errors';

import { Diagram } from './diagram';
import { DomainRail } from './domain-rail';
import { ChangeDialog, DraftDock } from './draft-dock';
import { Inspector } from './inspector';
import { coverageOf, unsyncedCount } from './model';
import { SearchDialog } from './search-dialog';
import { SourceDialog, SourceSetup } from './source-setup';
import { StudioProvider, type StudioView, useSchemaWords, useStudio } from './studio';
import { DictionaryView, EnumsView, HistoryView } from './views';

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
    .join('، ');
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string | null;
  label: string;
  tone?: 'info' | 'warning' | undefined;
}) {
  return (
    <span className="schema-stat" data-tone={tone}>
      {value && <span className="schema-stat-value">{value}</span>}
      <span className="schema-stat-label">{label}</span>
    </span>
  );
}

/** A count with its plural noun, the number in bold: "119 جدولًا", "جدولان" (Arabic's dual takes no numeral), "1 table" (review M13). */
function CountStat({
  n,
  forms,
  tone,
}: {
  n: number;
  forms: PluralForms;
  tone?: 'info' | 'warning' | undefined;
}) {
  const locale = useLocale();
  const text = plural(n, locale, forms);
  const shown = num(n, locale);
  const at = text.indexOf(shown);
  return at < 0 ? (
    <Stat value={null} label={text} tone={tone} />
  ) : (
    <Stat value={shown} label={(text.slice(0, at) + text.slice(at + shown.length)).trim()} tone={tone} />
  );
}

function Header({
  onSearch,
  onSource,
  onRail,
  railOpen,
}: {
  onSearch: () => void;
  onSource: () => void;
  onRail: () => void;
  railOpen: boolean;
}) {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const refresh = useRefreshSchema();
  const { doc, data } = studio;
  const coverage = coverageOf(doc.models, studio.annotations);
  const unsynced = unsyncedCount(data.annotations);

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
    <header className="schema-header">
      <div className="flex min-w-0 items-center gap-3">
        <IconButton
          label={t.domains.title}
          className="schema-rail-toggle"
          onClick={onRail}
          aria-expanded={railOpen}
          data-schema-rail-toggle
        >
          <PanelLeft aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
        <span className="schema-header-icon" aria-hidden>
          <Database className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-title-sm font-semibold text-foreground">{t.title}</h1>
          <p className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
            <button
              type="button"
              className="schema-link block max-w-full truncate font-mono"
              dir="ltr"
              onClick={onSource}
              disabled={!studio.can.manage}
              title={t.setup.change}
            >
              {data.source?.path}/{data.source?.schemaDir}
            </button>
            <span aria-hidden>·</span>
            <span>{fill(t.stats.readAt, { when: <RelativeTime iso={data.snapshot!.createdAt} /> })}</span>
            <span aria-hidden className="hidden sm:inline">
              ·
            </span>
            <span className="hidden sm:inline">
              {fill(t.stats.hash, { hash: <Ltr mono>{data.snapshot!.hash.slice(0, 8)}</Ltr> })}
            </span>
          </p>
        </div>
      </div>

      <div className="schema-stats" aria-label={t.title}>
        <CountStat n={doc.stats.models} forms={t.stats.models} />
        <CountStat n={doc.stats.fields} forms={t.stats.fields} />
        <Stat
          value={null}
          label={fmt(t.stats.relationsPair, {
            declared: num(doc.stats.relations, locale),
            implied: num(doc.stats.impliedRelations, locale),
          })}
        />
        <CountStat n={doc.stats.enums} forms={t.stats.enums} />
        <Tooltip
          content={fmt(t.stats.coverageTip, {
            named: num(coverage.named, locale),
            total: num(coverage.total, locale),
          })}
        >
          <span className="schema-stat schema-stat-meter" tabIndex={0} data-tone="info">
            <span className="schema-stat-value">{fmt(t.stats.pct, { pct: num(coverage.pct, locale) })}</span>
            <span className="schema-stat-label">{t.stats.named}</span>
            <span className="schema-meter" aria-hidden>
              <motion.span
                initial={{ inlineSize: 0 }}
                animate={{ inlineSize: `${coverage.pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </span>
          </span>
        </Tooltip>
        {unsynced > 0 && <CountStat n={unsynced} forms={t.stats.unsynced} tone="warning" />}
        {doc.warnings.length > 0 && (
          <Tooltip content={t.states.warningsTip}>
            <span className="schema-stat" data-tone="warning" tabIndex={0}>
              <AlertTriangle aria-hidden className="size-4" strokeWidth={1.75} />
              <span className="schema-stat-label">
                {plural(doc.warnings.length, locale, t.states.warnings)}
              </span>
            </span>
          </Tooltip>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onSearch}>
          <Search aria-hidden className="size-4" strokeWidth={1.75} />
          <span className="sr-only md:not-sr-only">{t.actions.search}</span>
          <kbd className="schema-kbd hidden md:inline" aria-hidden>
            /
          </kbd>
        </Button>
        {studio.can.annotate && (
          <Tooltip content={t.actions.suggestNamesTip}>
            <Button size="sm" variant="outline" onClick={() => void studio.suggestNames({})}>
              <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
              <span className="sr-only sm:not-sr-only">{t.actions.suggestNames}</span>
            </Button>
          </Tooltip>
        )}
        {studio.can.draft && unsynced > 0 && !studio.draft && (
          <Tooltip content={t.actions.syncNamesTip}>
            <Button size="sm" variant="outline" onClick={() => void studio.syncNames()}>
              <FolderCog aria-hidden className="size-4" strokeWidth={1.75} />
              <span className="sr-only sm:not-sr-only">{t.actions.syncNames}</span>
            </Button>
          </Tooltip>
        )}
        {studio.can.manage && (
          <Tooltip content={t.actions.refreshTip}>
            <Button size="sm" variant="outline" onClick={runRefresh} disabled={refresh.isPending}>
              <RefreshCw
                aria-hidden
                className={cn('size-4', refresh.isPending && 'motion-safe:animate-spin')}
                strokeWidth={1.75}
              />
              <span className="sr-only sm:not-sr-only">
                {refresh.isPending ? t.actions.refreshing : t.actions.refresh}
              </span>
            </Button>
          </Tooltip>
        )}
      </div>
    </header>
  );
}

function Workspace() {
  const studio = useStudio();
  const t = useSchemaWords();
  const [searching, setSearching] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const studioBox = useRef<HTMLDivElement>(null);
  const railSlot = useRef<HTMLDivElement>(null);
  const narrow = useNarrow(studioBox);

  // `/` and Ctrl+Shift+K search the design while this page is open, unless typing or in a dialog. It listens before the shell does and keeps `/`
  // from reaching it, so the page's search wins over the global palette here (review M9). Ctrl+K stays the palette.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const busy = target?.closest(
        'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]',
      );
      const slash = matchKey(event, '/') && !event.ctrlKey && !event.metaKey && !event.altKey;
      const chord = (event.ctrlKey || event.metaKey) && matchKey(event, 'K');
      if ((slash && !busy && shortcutsEnabled()) || chord) {
        event.preventDefault();
        event.stopPropagation();
        setSearching(true);
        return;
      }
      if (matchKey(event, 'Escape') && !busy && studio.focus) studio.setFocus(null);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [studio]);

  // The drawer takes focus when it opens, and gives it back to its toggle when it closes (review B2).
  const drawer = narrow && railOpen;
  const wasDrawer = useRef(false);
  useEffect(() => {
    if (drawer) railSlot.current?.querySelector<HTMLElement>('button, input')?.focus();
    else if (wasDrawer.current)
      studioBox.current?.querySelector<HTMLElement>('[data-schema-rail-toggle]')?.focus();
    wasDrawer.current = drawer;
  }, [drawer]);

  const views: { value: StudioView; label: string }[] = [
    { value: 'diagram', label: t.views.diagram },
    { value: 'dictionary', label: t.views.dictionary },
    { value: 'enums', label: t.views.enums },
    { value: 'history', label: t.views.history },
  ];

  return (
    <div ref={studioBox} className="schema-studio" data-inspecting={studio.selection ? '' : undefined}>
      <Header
        onSearch={() => setSearching(true)}
        onSource={() => setSourceOpen(true)}
        onRail={() => setRailOpen((value) => !value)}
        railOpen={railOpen}
      />
      <div className="schema-viewbar">
        <Segmented label={t.views.label} value={studio.view} onChange={studio.setView} options={views} />
      </div>
      <div className="schema-body">
        <div
          ref={railSlot}
          className={cn('schema-rail-slot', railOpen && 'is-open')}
          // Below 68rem the rail is a drawer: a dialog while open, out of the Tab order while closed.
          role={drawer ? 'dialog' : undefined}
          aria-modal={drawer || undefined}
          aria-label={drawer ? t.domains.title : undefined}
          inert={narrow && !railOpen ? true : undefined}
          onKeyDown={(event) => {
            if (drawer && matchKey(event, 'Escape')) {
              event.preventDefault();
              event.stopPropagation();
              setRailOpen(false);
            }
          }}
        >
          <DomainRail />
        </div>
        {railOpen && (
          <button
            type="button"
            aria-label={t.actions.close}
            className="schema-rail-scrim"
            onClick={() => setRailOpen(false)}
          />
        )}
        <div className="schema-main">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={studio.view}
              className="schema-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {studio.view === 'diagram' && <Diagram />}
              {studio.view === 'dictionary' && <DictionaryView />}
              {studio.view === 'enums' && <EnumsView />}
              {studio.view === 'history' && <HistoryView />}
            </motion.div>
          </AnimatePresence>
          <DraftDock />
        </div>
        <AnimatePresence>
          <Inspector />
        </AnimatePresence>
      </div>
      <SearchDialog open={searching} onOpenChange={setSearching} />
      <SourceDialog open={sourceOpen} onOpenChange={setSourceOpen} current={studio.data.source} />
      <ChangeDialog />
    </div>
  );
}

/** True while the studio is under 68rem, where schema.css turns the rail into a drawer. */
function useNarrow(box: React.RefObject<HTMLDivElement | null>): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const update = () => setNarrow(element.getBoundingClientRect().width <= 68 * rem());
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [box]);
  return narrow;
}

function Loading() {
  const t = useSchemaWords();
  return (
    <LoadingRegion label={t.states.loading} className="schema-studio p-4 md:p-6">
      <Skeleton className="h-14 w-full" />
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
        <Skeleton className="hidden h-96 lg:block" />
        <Skeleton className="h-96" />
      </div>
    </LoadingRegion>
  );
}

export function SchemaPage() {
  const t = useSchemaWords();
  const session = useSession();
  const query = useSchemaStudio();
  const canManage = session.roles.some((role) => role === 'owner' || role === 'pm' || role === 'backend');

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
