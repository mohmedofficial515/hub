'use client';

/**
 * @file queue-page.tsx
 * @description The agent queue (docs/16 §9), in Hub's own style (owner's decision, 2026-11-08): one reading column like the Inbox, sections like Tasks, neutral cards with coloured icons only. Running, waiting for approval, next, recent.
 * Next keeps the owner's order: drag a row by its grip, or use Move up and Move down in its menu, or Alt with an arrow on a focused row; a live region says where it went. The one filled button is Answer on the first run waiting on the owner.
 * Nothing here runs by itself: a run is added by the owner, and starts within the limits shown in the header.
 */
import { type AgentRunDto, type QueueSection, sectionOf } from '@hub/contracts';
import { GripVertical, ListOrdered, Moon, Pause, Play, Plus, Settings2 } from 'lucide-react';
import { type DragEvent, type KeyboardEvent, useMemo, useRef, useState } from 'react';

import {
  AppLink,
  Button,
  cn,
  EmptyState,
  ErrorState,
  fmt,
  focusRing,
  LoadingRegion,
  matchKey,
  PageContainer,
  PageHeader,
  SectionHeader,
  showToast,
  Skeleton,
  SkeletonRows,
  useLocale,
  when as whenText,
} from '@/components/kit';
import { usePauseQueue, useQueue, useReorderRuns } from '@/features/queue/queries';
import { isHubError } from '@/lib/api/errors';

import {
  runMenuItems,
  RunRow,
  type RunTarget,
  ScheduleDialog,
  useQueueWords,
  useRunActions,
  useRunNow,
} from './run-bits';

const ORDER: readonly QueueSection[] = ['running', 'waiting', 'next', 'recent'];

export function QueuePage() {
  const t = useQueueWords();
  const locale = useLocale();
  const query = useQueue();
  const pause = usePauseQueue();
  const reorder = useReorderRuns();
  const act = useRunActions();
  const runNow = useRunNow();
  const [adding, setAdding] = useState<RunTarget | null>(null);
  const [said, setSaid] = useState('');
  const dragged = useRef<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const runs = query.data?.runs;
  const state = query.data?.state;
  const sections = useMemo(() => {
    const by = new Map<QueueSection, AgentRunDto[]>(ORDER.map((section) => [section, []]));
    for (const run of runs ?? []) by.get(sectionOf(run.state))!.push(run);
    return by;
  }, [runs]);
  const next = sections.get('next') ?? [];
  const firstWaiting = sections.get('waiting')?.[0]?.id ?? null;

  const moveTo = (id: string, index: number) => {
    const ids = next.map((run) => run.id).filter((each) => each !== id);
    const place = Math.max(0, Math.min(index, ids.length));
    ids.splice(place, 0, id);
    if (ids.join() === next.map((run) => run.id).join()) return;
    reorder.mutate(ids, {
      onSuccess: () => setSaid(fmt(t.toasts.moved, { n: place + 1, total: ids.length })),
      onError: (error) =>
        showToast({ tone: 'error', message: isHubError(error) ? error.message : String(error) }),
    });
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-queue-run="${id}"]`)?.focus(), 0);
  };

  const onKey = (event: KeyboardEvent<HTMLLIElement>, id: string, index: number) => {
    if (!event.altKey || event.target !== event.currentTarget) return;
    if (matchKey(event, 'ArrowUp')) {
      event.preventDefault();
      moveTo(id, index - 1);
    } else if (matchKey(event, 'ArrowDown')) {
      event.preventDefault();
      moveTo(id, index + 1);
    }
  };
  const drop = (event: DragEvent, index: number) => {
    event.preventDefault();
    const id = dragged.current;
    dragged.current = null;
    setOver(null);
    if (id) moveTo(id, index);
  };

  const togglePause = () => {
    const paused = !state?.paused;
    pause.mutate(paused, {
      onSuccess: () => showToast({ message: paused ? t.toasts.pausedAll : t.toasts.resumedAll }),
      onError: (error) =>
        showToast({ tone: 'error', message: isHubError(error) ? error.message : String(error) }),
    });
  };

  const summary = state && (
    <span className="flex flex-wrap gap-x-3">
      <span>
        {fmt(t.summary, { concurrent: state.maxConcurrent, used: state.usedToday, perDay: state.perDay })}
      </span>
      {state.quietHours && <span>{fmt(t.quiet, state.quietHours)}</span>}
      <span>{fmt(t.timezone, { zone: state.timezone })}</span>
    </span>
  );
  const header = (
    <PageHeader
      title={t.title}
      meta={query.isPending ? <Skeleton className="mt-1.5 h-4 w-56" /> : summary}
      actions={
        state ? (
          <>
            <Button onClick={togglePause} busy={pause.isPending} data-queue-pause-all>
              {state.paused ? (
                <Play aria-hidden className="size-4" strokeWidth={1.75} />
              ) : (
                <Pause aria-hidden className="size-4" strokeWidth={1.75} />
              )}
              {state.paused ? t.resumeAll : t.pauseAll}
            </Button>
            <Button
              variant={runs && runs.length === 0 ? 'primary' : 'outline'}
              data-queue-new
              onClick={() => setAdding({ source: 'prompt', prompt: '', title: '' })}
            >
              <Plus aria-hidden className="size-4" strokeWidth={1.75} />
              {t.newRun}
            </Button>
            <AppLink
              view="settings"
              query={{ tab: 'queue' }}
              className={cn(
                'inline-flex h-11 items-center gap-1.5 rounded-md px-3 text-body text-foreground hover:bg-accent md:h-9',
                focusRing,
              )}
            >
              <Settings2 aria-hidden className="size-4" strokeWidth={1.75} />
              {t.settings}
            </AppLink>
          </>
        ) : undefined
      }
    />
  );

  if (query.isError && !query.data) {
    const { error } = query;
    return (
      <PageContainer className="max-w-200">
        {header}
        <ErrorState
          thing={t.errorThing}
          code={isHubError(error) ? error.code : undefined}
          requestId={isHubError(error) ? error.requestId : undefined}
          onRetry={() => void query.refetch()}
        />
      </PageContainer>
    );
  }
  if (query.isPending || !state || !runs) {
    return (
      <PageContainer className="max-w-200">
        {header}
        <LoadingRegion label={t.title}>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-24" />
            <SkeletonRows count={5} withAction={false} />
          </div>
        </LoadingRegion>
      </PageContainer>
    );
  }

  const banner =
    state.pausedReason === 'owner'
      ? { icon: Pause, text: t.banner.owner }
      : state.pausedReason === 'usage_limit'
        ? {
            icon: Pause,
            text: state.resumesAt
              ? fmt(t.banner.limit, { at: whenText(state.resumesAt, locale) })
              : t.banner.limitNoTime,
          }
        : state.inQuietHours && state.quietHours
          ? { icon: Moon, text: fmt(t.banner.quiet, { to: state.quietHours.to }) }
          : null;

  return (
    <PageContainer className="max-w-200">
      {header}
      <p role="status" className="sr-only">
        {said}
      </p>
      {banner && (
        <div
          role="status"
          data-queue-banner={state.pausedReason ?? 'quiet'}
          className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-body text-foreground"
        >
          <banner.icon aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-strong" strokeWidth={2} />
          <span>{banner.text}</span>
        </div>
      )}
      {runs.length === 0 ? (
        <EmptyState size="page" icon={ListOrdered} title={t.empty.title}>
          {t.empty.body}
        </EmptyState>
      ) : (
        ORDER.map((section) => {
          const list = sections.get(section) ?? [];
          if (list.length === 0 && section !== 'next') return null;
          const hint = section === 'next' || section === 'recent' ? t.sectionHints[section] : null;
          return (
            <section
              key={section}
              aria-labelledby={`queue-${section}`}
              data-queue-section={section}
              className="flex flex-col gap-2"
            >
              <SectionHeader id={`queue-${section}`} title={t.sections[section]} count={list.length} />
              {hint && list.length > 1 && <p className="text-body-sm text-muted-foreground">{hint}</p>}
              {list.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">{t.sectionEmpty[section]}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {list.map((run, index) => {
                    const movable = section === 'next';
                    const menu = runMenuItems(
                      run,
                      t,
                      act,
                      movable
                        ? {
                            up: index > 0 ? () => moveTo(run.id, index - 1) : undefined,
                            down: index < list.length - 1 ? () => moveTo(run.id, index + 1) : undefined,
                          }
                        : undefined,
                    );
                    return (
                      <li
                        key={run.id}
                        data-queue-run={run.id}
                        data-queue-state={run.state}
                        tabIndex={movable ? 0 : undefined}
                        aria-keyshortcuts={movable ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}
                        onKeyDown={movable ? (event) => onKey(event, run.id, index) : undefined}
                        onDragOver={
                          movable
                            ? (event) => {
                                if (!dragged.current) return;
                                event.preventDefault();
                                setOver(run.id);
                              }
                            : undefined
                        }
                        onDragLeave={
                          movable
                            ? () => setOver((current) => (current === run.id ? null : current))
                            : undefined
                        }
                        onDrop={movable ? (event) => drop(event, index) : undefined}
                        className={cn(
                          'rounded-lg border border-border bg-card p-3',
                          movable && focusRing,
                          over === run.id && 'bg-accent',
                        )}
                      >
                        <RunRow
                          run={run}
                          primary={run.id === firstWaiting}
                          menu={menu}
                          onRunAgain={
                            run.state === 'interrupted'
                              ? () =>
                                  runNow(
                                    run.source === 'task' && run.cardKey
                                      ? { source: 'task', cardKey: run.cardKey, title: run.title }
                                      : { source: 'prompt', prompt: run.prompt, title: run.title },
                                  )
                              : undefined
                          }
                          handle={
                            movable ? (
                              <span
                                draggable
                                aria-hidden
                                title={t.actions.drag}
                                data-queue-grip
                                onDragStart={(event) => {
                                  dragged.current = run.id;
                                  event.dataTransfer.effectAllowed = 'move';
                                  event.dataTransfer.setData('text/plain', run.id);
                                }}
                                onDragEnd={() => {
                                  dragged.current = null;
                                  setOver(null);
                                }}
                                className="-ms-1 mt-0.5 inline-flex cursor-grab touch-none rounded-sm text-muted-foreground active:cursor-grabbing"
                              >
                                <GripVertical className="size-4" strokeWidth={1.75} />
                              </span>
                            ) : undefined
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      )}
      <ScheduleDialog target={adding} allowNow onClose={() => setAdding(null)} />
    </PageContainer>
  );
}
