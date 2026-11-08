'use client';

/**
 * @file schema-page.tsx
 * @description Schema Studio (docs/17): the project's database design as a workspace. A header with the design's numbers and its two presses (Refresh design, Suggest Arabic names), the domains on one
 * side, the diagram or the dictionary, enums and history in the middle, the details of what is selected on the other side, and the open draft docked below. `/` or Ctrl+K searches.
 */
import { changeCount, type SchemaChangeSummary, type SchemaStudioDto } from '@hub/contracts';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Database, FolderCog, PanelLeft, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  Button,
  cn,
  ErrorState,
  fmt,
  IconButton,
  LoadingRegion,
  num,
  RelativeTime,
  Segmented,
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
    tables && fmt(t.summary.tables, { n: num(tables, locale) }),
    columns && fmt(t.summary.columns, { n: num(columns, locale) }),
    enums && fmt(t.summary.enums, { n: num(enums, locale) }),
  ]
    .filter(Boolean)
    .join('، ');
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: 'info' | 'warning' | undefined;
}) {
  return (
    <span className="schema-stat" data-tone={tone}>
      <span className="schema-stat-value">{value}</span>
      <span className="schema-stat-label">{label}</span>
    </span>
  );
}

function Header({
  onSearch,
  onSource,
  onRail,
}: {
  onSearch: () => void;
  onSource: () => void;
  onRail: () => void;
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
        <IconButton label={t.domains.title} className="schema-rail-toggle" onClick={onRail}>
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
              className="schema-link font-mono"
              dir="ltr"
              onClick={onSource}
              disabled={!studio.can.manage}
              title={t.setup.change}
            >
              {data.source?.path}/{data.source?.schemaDir}
            </button>
            <span>·</span>
            <span>
              {fmt(t.stats.readAt, { when: '' })}
              <RelativeTime iso={data.snapshot!.createdAt} />
            </span>
            <span className="hidden font-mono sm:inline" dir="ltr">
              {fmt(t.stats.hash, { hash: data.snapshot!.hash.slice(0, 8) })}
            </span>
          </p>
        </div>
      </div>

      <div className="schema-stats" aria-label={t.title}>
        <Stat value={num(doc.stats.models, locale)} label={t.stats.models} />
        <Stat value={num(doc.stats.fields, locale)} label={t.stats.fields} />
        <Stat
          value={`${num(doc.stats.relations, locale)}+${num(doc.stats.impliedRelations, locale)}`}
          label={`${t.stats.relations} · ${t.stats.implied}`}
        />
        <Stat value={num(doc.stats.enums, locale)} label={t.stats.enums} />
        <Tooltip
          content={fmt(t.stats.coverageTip, {
            named: num(coverage.named, locale),
            total: num(coverage.total, locale),
          })}
        >
          <span className="schema-stat schema-stat-meter" tabIndex={0} data-tone="info">
            <span className="schema-stat-value">{num(coverage.pct, locale)}٪</span>
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
        {unsynced > 0 && <Stat value={num(unsynced, locale)} label={t.stats.unsynced} tone="warning" />}
        {doc.warnings.length > 0 && (
          <Tooltip content={t.states.warningsTip}>
            <span className="schema-stat" data-tone="warning" tabIndex={0}>
              <AlertTriangle aria-hidden className="size-4" strokeWidth={1.75} />
              <span className="schema-stat-label">
                {fmt(t.states.warnings, { n: num(doc.warnings.length, locale) })}
              </span>
            </span>
          </Tooltip>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onSearch}>
          <Search aria-hidden className="size-4" strokeWidth={1.75} />
          <span className="hidden md:inline">{t.actions.search}</span>
          <kbd className="schema-kbd hidden md:inline">/</kbd>
        </Button>
        {studio.can.annotate && (
          <Tooltip content={t.actions.suggestNamesTip}>
            <Button size="sm" variant="outline" onClick={() => void studio.suggestNames({})}>
              <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">{t.actions.suggestNames}</span>
            </Button>
          </Tooltip>
        )}
        {studio.can.draft && unsynced > 0 && !studio.draft && (
          <Tooltip content={t.actions.syncNamesTip}>
            <Button size="sm" variant="outline" onClick={() => void studio.syncNames()}>
              <FolderCog aria-hidden className="size-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">{t.actions.syncNames}</span>
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
              <span className="hidden sm:inline">
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

  // `/` and Ctrl+K search the design while this page is open, unless typing somewhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (
        (event.key === '/' && !typing) ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && event.shiftKey)
      ) {
        event.preventDefault();
        setSearching(true);
      }
      if (event.key === 'Escape' && !typing && studio.focus) studio.setFocus(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studio]);

  const views: { value: StudioView; label: string }[] = [
    { value: 'diagram', label: t.views.diagram },
    { value: 'dictionary', label: t.views.dictionary },
    { value: 'enums', label: t.views.enums },
    { value: 'history', label: t.views.history },
  ];

  return (
    <div className="schema-studio">
      <Header
        onSearch={() => setSearching(true)}
        onSource={() => setSourceOpen(true)}
        onRail={() => setRailOpen((value) => !value)}
      />
      <div className="schema-viewbar">
        <Segmented label={t.views.label} value={studio.view} onChange={studio.setView} options={views} />
      </div>
      <div className="schema-body">
        <div className={cn('schema-rail-slot', railOpen && 'is-open')}>
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

  if (query.isPending) return <Loading />;
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
