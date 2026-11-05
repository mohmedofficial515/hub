'use client';

/**
 * @file sources.tsx
 * @description Ported from the approved design, pages/settings/parts/sources.tsx, on real fields. The design's diagnosis and one-click fix
 * assumed data the API does not hold, so a problem shows the stored error and the last-run facts. The run strip appears only when a real run
 * exists in the last day, and a source that cannot run yet offers no Run now.
 */
import type { SourceKind } from '@hub/contracts';
import {
  ChevronDown,
  CircleCheck,
  CircleSlash,
  Clock,
  FileSearch,
  History,
  Pencil,
  Play,
  PlugZap,
  Plus,
  Power,
  TriangleAlert,
  Unplug,
} from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useMemo, useRef, useState } from 'react';

import {
  absolute,
  Bidi,
  Button,
  cn,
  ConfirmDialog,
  duration,
  EmptyState,
  ErrorState,
  fill,
  fmt,
  kitMessages,
  Ltr,
  Modal,
  nowMs,
  num,
  Pill,
  plural,
  portalRoot,
  rel,
  RowMenu,
  SectionHeader,
  showToast,
  SkeletonRows,
  useKeyboardList,
  useLocale,
  useT,
  when,
} from '@/components/kit';
import type { SettingsMessages } from '@/features/settings/messages';
import {
  type Source,
  useRunSource,
  useSettings,
  useSourceRuns,
  useSources,
  useTestSource,
  useUpdateSource,
} from '@/features/settings/queries';
import {
  hoursFromRuns,
  intervalSecOf,
  isProblem,
  type SourceState,
  sourceState,
} from '@/features/settings/source-state';
import { isHubError } from '@/lib/api/errors';

import { RunStrip } from './shared';
import { SourceDialog } from './source-dialog';

const KIND_ORDER: SourceKind[] = ['local_path', 'github_repo', 'openapi', 'lab', 'docs_folder'];

/** What the source points at, from its own config. */
export function targetOf(source: Pick<Source, 'kind' | 'config'>): string {
  const c = source.config as Record<string, string | undefined>;
  if (source.kind === 'github_repo') return `${c['owner']}/${c['repo']} · ${c['defaultBranch'] ?? 'main'}`;
  if (source.kind === 'lab') return c['root'] ?? '';
  return c['path'] ?? '';
}

function StatusPill({ state }: { state: SourceState }) {
  const t = useT<SettingsMessages>('settings');
  const kit = useT(kitMessages);
  if (state === 'disabled')
    return (
      <Pill tone="muted" icon={CircleSlash}>
        {kit.sourceStatus.disabled}
      </Pill>
    );
  if (state === 'failing')
    return (
      <Pill tone="danger" icon={TriangleAlert}>
        {kit.sourceStatus.failing}
      </Pill>
    );
  if (state === 'lagging')
    return (
      <Pill tone="warning" icon={Clock}>
        {kit.sourceStatus.lagging}
      </Pill>
    );
  if (state === 'not_connected')
    return (
      <Pill tone="muted" icon={Unplug}>
        {t.sources.state.notConnected}
      </Pill>
    );
  if (state === 'never_run') return <Pill tone="muted">{t.sources.state.neverRun}</Pill>;
  return (
    <Pill tone="success" icon={CircleCheck}>
      {kit.sourceStatus.ok}
    </Pill>
  );
}

function useRunHours(id: string) {
  const runs = useSourceRuns(id).data;
  return useMemo(() => ({ runs, hours: runs ? hoursFromRuns(runs, nowMs()) : null }), [runs]);
}

function LastRun({ source }: { source: Source }) {
  const t = useT<SettingsMessages>('settings');
  const locale = useLocale();
  return (
    <p className="mt-1 text-body-sm text-muted-foreground">
      {source.lastRunAt
        ? fmt(t.sources.lastRun, { when: rel(source.lastRunAt, locale) })
        : t.sources.neverRun}
    </p>
  );
}

/** Failing or late source: what happened on the start side, what to do on the end side. */
function ProblemPanel({
  source,
  state,
  period,
  onEdit,
  onRuns,
}: {
  source: Source;
  state: SourceState;
  period: number;
  onEdit: () => void;
  onRuns: () => void;
}) {
  const t = useT<SettingsMessages>('settings');
  const locale = useLocale();
  const { runs, hours } = useRunHours(source.id);
  const failing = state === 'failing';
  return (
    <article
      aria-labelledby={`problem-${source.id}`}
      className={cn(
        'rounded-lg border bg-card p-4 md:p-5',
        failing ? 'border-destructive/70' : 'border-border',
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id={`problem-${source.id}`} className="text-title-sm font-semibold text-foreground">
          <Ltr mono>{source.name}</Ltr>
        </h3>
        <span className="text-body-sm text-muted-foreground">{t.sources.kinds[source.kind]}</span>
        <StatusPill state={state} />
      </header>
      <p className="mt-1 text-body-sm text-muted-foreground">
        {source.lastSuccessAt
          ? fmt(t.sources.lastSuccess, { when: when(source.lastSuccessAt, locale) })
          : t.sources.noSuccess}
      </p>

      {hours && <RunStrip hours={hours} showLegend className="mt-4 max-w-sm" />}

      <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:gap-8">
        <div className="min-w-0">
          <h4 className="text-body font-semibold text-foreground">{t.sources.why}</h4>
          {source.lastError ? (
            <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-body-sm text-foreground">
              <Bidi>{source.lastError}</Bidi>
            </p>
          ) : (
            <p className="mt-1 text-body text-foreground">
              {fmt(t.sources.laggingWhy, {
                d: duration((source.lagSec ?? 0) * 1000, locale),
                period: duration(period * 1000, locale),
              })}
            </p>
          )}
        </div>
        <div className="min-w-0">
          <h4 className="text-body font-semibold text-foreground">{t.sources.toDo}</h4>
          <p className="mt-1 text-body text-foreground">
            {failing ? t.sources.toDoFailing : t.sources.toDoLagging}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={onEdit}>
              <Pencil aria-hidden className="size-4" strokeWidth={1.75} />
              {t.sources.edit}
            </Button>
            {runs && runs.length > 0 && (
              <Button variant="ghost" onClick={onRuns}>
                <History aria-hidden className="size-4" strokeWidth={1.75} />
                {t.sources.viewRuns}
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function SourceListRow({
  source,
  state,
  rowProps,
  busy,
  onRun,
  onTest,
  onEdit,
  onRuns,
  onToggle,
}: {
  source: Source;
  state: SourceState;
  rowProps: object;
  busy: boolean;
  onRun: () => void;
  onTest: () => void;
  onEdit: () => void;
  onRuns: () => void;
  onToggle: () => void;
}) {
  const t = useT<SettingsMessages>('settings');
  const { runs, hours } = useRunHours(source.id);
  const target = targetOf(source);
  return (
    <li
      {...rowProps}
      className="grid gap-x-5 gap-y-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center"
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Ltr mono className="text-body font-medium text-foreground">
            {source.name}
          </Ltr>
          <span className="text-body-sm text-muted-foreground">{t.sources.kinds[source.kind]}</span>
        </p>
        <p
          dir="ltr"
          translate="no"
          title={target}
          className="key mt-1 truncate text-start text-caption text-muted-foreground rtl:text-end"
        >
          {target}
        </p>
        {state === 'not_connected' && (
          <p className="mt-1 text-body-sm text-muted-foreground">
            {source.kind === 'github_repo' ? t.sources.notConnectedBody : t.sources.notConnectedDeps}
            {source.kind === 'github_repo' && !source.hasSecret && ` ${t.sources.noToken}`}
          </p>
        )}
      </div>
      <div className="min-w-0">
        {hours && <RunStrip hours={hours} />}
        <LastRun source={source} />
      </div>
      <div className="flex items-center gap-2">
        <StatusPill state={state} />
        <span className="ms-auto flex items-center gap-1 md:ms-3">
          {state !== 'not_connected' && (
            <Button size="sm" busy={busy} disabled={!source.enabled} onClick={onRun}>
              <Play aria-hidden className="size-3.5" strokeWidth={1.75} />
              {t.sources.runNow}
            </Button>
          )}
          <RowMenu
            label={fmt(t.sources.menu, { name: source.name })}
            items={[
              { label: t.sources.test, icon: PlugZap, onSelect: onTest, disabled: !source.enabled },
              { label: t.sources.edit, icon: Pencil, onSelect: onEdit },
              ...(runs?.length ? [{ label: t.sources.viewRuns, icon: History, onSelect: onRuns }] : []),
              source.enabled
                ? {
                    label: t.sources.disable,
                    icon: Unplug,
                    onSelect: onToggle,
                    separated: true,
                    destructive: true,
                  }
                : { label: t.sources.enable, icon: Power, onSelect: onToggle, separated: true },
            ]}
          />
        </span>
      </div>
    </li>
  );
}

function RunsDialog({ source, onClose }: { source: Source | null; onClose: () => void }) {
  const t = useT<SettingsMessages>('settings');
  const locale = useLocale();
  const runs = useSourceRuns(source?.id).data ?? [];
  return (
    <Modal
      open={!!source}
      onOpenChange={(open) => !open && onClose()}
      className="md:max-w-2xl"
      title={source ? fill(t.sources.runsTitle, { name: <Ltr mono>{source.name}</Ltr> }) : ''}
      description={
        source?.lastSuccessAt
          ? fmt(t.sources.lastSuccess, { when: when(source.lastSuccessAt, locale) })
          : t.sources.noSuccess
      }
    >
      {runs.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">{t.sources.runsEmpty}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {runs.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <Ltr className="w-32 shrink-0 text-body-sm text-foreground tabular-nums">
                {absolute(run.startedAt, locale)}
              </Ltr>
              {run.status === 'failed' ? (
                <Pill tone="danger" icon={TriangleAlert}>
                  {t.sources.runStatus.failed}
                </Pill>
              ) : (
                <Pill tone="success" icon={CircleCheck}>
                  {t.sources.runStatus.ok}
                </Pill>
              )}
              {run.status !== 'failed' && (
                <span className="text-body-sm text-muted-foreground">
                  {fmt(t.sources.runCounts, {
                    created: num(run.created, locale),
                    updated: num(run.updated, locale),
                  })}
                </span>
              )}
              {run.error && (
                <p className="w-full text-body-sm text-muted-foreground">
                  <Bidi>{run.error}</Bidi>
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

function AddSourceMenu({ primary, onPick }: { primary: boolean; onPick: (kind: SourceKind) => void }) {
  const t = useT<SettingsMessages>('settings');
  const locale = useLocale();
  return (
    <DropdownMenu.Root dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <DropdownMenu.Trigger asChild>
        <Button variant={primary ? 'primary' : 'outline'}>
          <Plus aria-hidden className="size-4" strokeWidth={1.75} />
          {t.sources.add}
          <ChevronDown aria-hidden className="size-4" strokeWidth={1.75} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalRoot()}>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={12}
          className="z-[75] min-w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {KIND_ORDER.map((kind) => (
            <DropdownMenu.Item
              key={kind}
              onSelect={() => onPick(kind)}
              className="flex min-h-11 cursor-pointer items-center rounded-md px-2.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent lg:min-h-9"
            >
              {t.sources.kinds[kind]}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function SourcesTab() {
  const t = useT<SettingsMessages>('settings');
  const locale = useLocale();
  const query = useSources();
  const settings = useSettings().data;
  const sources = query.data ?? [];
  const update = useUpdateSource();
  const testSource = useTestSource();
  const runSource = useRunSource();
  const [dialog, setDialog] = useState<
    { mode: 'add'; kind: SourceKind } | { mode: 'edit'; id: string } | null
  >(null);
  const [runsId, setRunsId] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);

  const withState = sources.map((source) => ({ source, state: sourceState(source, settings) }));
  const order = { failing: 0, lagging: 1 } as Record<SourceState, number>;
  const problems = withState
    .filter(({ state }) => isProblem(state))
    .sort((a, b) => order[a.state] - order[b.state]);
  const rest = withState.filter(({ state }) => !isProblem(state));
  const allOk =
    withState.length > 0 && withState.every(({ state }) => state === 'ok' || state === 'disabled');
  const list = useKeyboardList({
    ids: rest.map(({ source }) => source.id),
    onOpen: (id) => document.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"] button`)?.focus(),
    emptyFocusRef: listHeading,
  });

  const refused = (cause: unknown) =>
    showToast({ tone: 'error', message: isHubError(cause) ? cause.message : t.errorThing });

  const runNow = (source: Source) => {
    setRunning(source.id);
    runSource.mutate(source.id, {
      onSuccess: () =>
        showToast({ message: fill(t.sources.runQueued, { name: <Ltr mono>{source.name}</Ltr> }) }),
      onError: refused,
      onSettled: () => setRunning(null),
    });
  };

  const test = (source: Source) =>
    testSource.mutate(source.id, {
      onSuccess: ({ details }) =>
        showToast({
          message:
            details.filesFound === undefined
              ? t.sources.testOkNoCount
              : fmt(t.sources.testOk, { n: num(details.filesFound, locale) }),
        }),
      onError: (cause) => {
        const reason = isHubError(cause) ? cause.details['reason'] : undefined;
        if (reason === 'not_available_in_this_release') {
          showToast({ tone: 'error', message: t.sources.testUnavailable });
        } else if (reason === 'folder_unreadable') {
          showToast({ tone: 'error', message: t.sources.testUnreadable });
        } else refused(cause);
      },
    });

  const setEnabled = (source: Source, enabled: boolean) =>
    update.mutate(
      { id: source.id, enabled },
      {
        onSuccess: () =>
          showToast({
            message: fill(enabled ? t.sources.enabled : t.sources.disabled, {
              name: <Ltr mono>{source.name}</Ltr>,
            }),
            onUndo: () => update.mutate({ id: source.id, enabled: !enabled }, { onError: refused }),
          }),
        onError: refused,
      },
    );

  const toggled = sources.find((s) => s.id === toggling);
  const editing = dialog?.mode === 'edit' ? sources.find((s) => s.id === dialog.id) : undefined;
  const openAdd = (kind: SourceKind) => setDialog({ mode: 'add', kind });

  if (query.isPending) return <SkeletonRows count={4} withAction />;
  if (query.isError) {
    const { error } = query;
    return (
      <ErrorState
        thing={t.errorThing}
        code={isHubError(error) ? error.code : undefined}
        requestId={isHubError(error) ? error.requestId : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <>
      {sources.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title={t.sources.emptyTitle}
          action={<AddSourceMenu primary onPick={openAdd} />}
        >
          {t.sources.emptyBody}
        </EmptyState>
      ) : (
        <>
          {problems.length > 0 && (
            <section aria-labelledby="problems-title" className="flex flex-col gap-3">
              <SectionHeader
                id="problems-title"
                icon={TriangleAlert}
                title={plural(problems.length, locale, t.sources.needAttention)}
                aside={<AddSourceMenu primary={false} onPick={openAdd} />}
              />
              <div className="flex flex-col gap-3">
                {problems.map(({ source, state }) => (
                  <ProblemPanel
                    key={source.id}
                    source={source}
                    state={state}
                    period={intervalSecOf(source, settings)}
                    onEdit={() => setDialog({ mode: 'edit', id: source.id })}
                    onRuns={() => setRunsId(source.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section aria-labelledby="sources-title" className="flex flex-col gap-3">
              <SectionHeader
                ref={listHeading}
                id="sources-title"
                icon={FileSearch}
                title={
                  problems.length
                    ? t.sources.others
                    : allOk
                      ? fmt(t.sources.allHealthy, {
                          n: num(rest.filter(({ source }) => source.enabled).length, locale),
                        })
                      : t.sources.list
                }
                count={problems.length ? rest.length : undefined}
                aside={problems.length === 0 ? <AddSourceMenu primary={false} onPick={openAdd} /> : undefined}
              />
              <ul
                data-hub-list
                className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card"
              >
                {rest.map(({ source, state }) => (
                  <SourceListRow
                    key={source.id}
                    source={source}
                    state={state}
                    rowProps={list.rowProps(source.id)}
                    busy={running === source.id}
                    onRun={() => runNow(source)}
                    onTest={() => test(source)}
                    onEdit={() => setDialog({ mode: 'edit', id: source.id })}
                    onRuns={() => setRunsId(source.id)}
                    onToggle={() => (source.enabled ? setToggling(source.id) : setEnabled(source, true))}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <RunsDialog source={sources.find((s) => s.id === runsId) ?? null} onClose={() => setRunsId(null)} />
      {dialog && (
        <SourceDialog
          key={dialog.mode === 'edit' ? dialog.id : dialog.kind}
          open
          onClose={() => setDialog(null)}
          kind={dialog.mode === 'add' ? dialog.kind : (editing?.kind ?? 'local_path')}
          {...(editing ? { source: editing } : {})}
          sources={sources}
        />
      )}
      <ConfirmDialog
        open={!!toggled}
        onOpenChange={(open) => !open && setToggling(null)}
        title={toggled ? fill(t.sources.disableTitle, { name: <Ltr mono>{toggled.name}</Ltr> }) : ''}
        description={t.sources.disableBody}
        confirmLabel={t.sources.disable}
        onConfirm={() => toggled && setEnabled(toggled, false)}
      />
    </>
  );
}
