'use client';

/**
 * @file tasks-page.tsx
 * @description Ported from v5 `pages/tasks/page.tsx`. The board or the list, and the Deleted view at `?view=deleted`. Reasons: `F:/Goteav/redesign/hub/today/v5-peacock-app/pages/tasks/NOTES.md`.
 */
import { Kanban, List, Plus, SearchX, SquareCheck } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  actionsFor,
  Button,
  cn,
  EmptyState,
  ErrorState,
  fill,
  FilterBar,
  focusRing,
  kitMessages,
  LoadingRegion,
  Ltr,
  matchKey,
  openBlockers,
  openCard,
  PageContainer,
  PageHeader,
  plural,
  rememberMine,
  setQuery,
  shortcutsEnabled,
  showToast,
  Skeleton,
  SkeletonRows,
  type TaskCard,
  useFilter,
  useFilterList,
  useKeyboardList,
  useLocale,
  useMedia,
  usePerformAction,
  useReadyTasks,
  useRoute,
  useSession,
  useT,
} from '@/components/kit';
import { NewCardDialog } from '@/components/shell/new-card-dialog';
import {
  type Column,
  columnsOf,
  inMyRole,
  matchesFilters,
  PRIORITIES,
  type SortKey,
  sortList,
  SPECIALTIES,
  STATUS_ORDER,
} from '@/features/tasks/model';
import { useTasksQuery } from '@/features/tasks/queries';
import { isHubError } from '@/lib/api/errors';

import { TaskBoard } from './board';
import { DeletedLink, DeletedView } from './deleted-view';
import { TaskList } from './list';
import type { TaskMessages } from './messages';
import type { OnMove } from './task-bits';

const viewKey = (id: string) => `hub:tasks-view:${id}`;

function readView(id: string) {
  try {
    return localStorage.getItem(viewKey(id));
  } catch {
    return null;
  }
}
function writeView(id: string, view: 'board' | 'list') {
  try {
    localStorage.setItem(viewKey(id), view);
  } catch {
    /* A blocked store only loses the remembered view. */
  }
}

export function TasksPage() {
  const view = useFilter('view');
  return view === 'deleted' ? <DeletedView /> : <TasksBoardOrList />;
}

function TasksBoardOrList() {
  const t = useT<TaskMessages>('tasks');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const route = useRoute();
  const { me, roles, isManager } = useSession();
  const query = useTasksQuery();
  const perform = usePerformAction();
  const [newOpen, setNewOpen] = useState(false);
  const heading = useRef<HTMLDivElement>(null);
  const moved = useRef<{ key: string; index: number } | null>(null);

  // Under 768 px a board shows half a column at a time, so a phone opens on the list. An explicit choice is remembered (review M12).
  const wideEnough = useMedia('(min-width: 768px)');
  const viewParam = useFilter('view');
  const [rememberedView] = useState(() => readView(me.id));
  const view: 'board' | 'list' =
    viewParam === 'list' || viewParam === 'board'
      ? viewParam
      : rememberedView === 'list' || rememberedView === 'board'
        ? rememberedView
        : wideEnough
          ? 'board'
          : 'list';
  const viewToggleRef = useRef<HTMLDivElement>(null);
  const mine = useFilter('mine') === '1';
  const review = useFilter('review') === '1';
  const specialties = useFilterList('specialty');
  const priority = useFilter('priority');
  const moduleFilter = useFilter('module');
  const q = (useFilter('q') ?? '').trim().toLowerCase();
  const status = useFilter('status');
  const sort = useFilter('sort') as SortKey | null;
  const desc = useFilter('order') === 'desc';

  // A link to a folded column, such as Today's "see the backlog", opens it.
  const [railsOpen, setRailsOpen] = useState<Set<Column>>(
    () => new Set(status === 'backlog' || status === 'done' ? [status] : []),
  );

  const accountantOnly = roles.length === 1 && roles[0] === 'accountant';
  const canMove = !accountantOnly;

  const tasks = useMemo(() => query.data?.items ?? [], [query.data]);
  const filters = { specialties, priority, module: moduleFilter, q, review, mine };
  const visible = tasks.filter((c) => matchesFilters(c, filters, me.id, roles));
  const byColumn = columnsOf(visible, me.id, roles);
  const listRows = sortList(visible, { status, sort, desc }, me.id, roles);

  const boardIds = (Object.keys(byColumn) as Column[])
    .flatMap((c) => (c === 'backlog' || c === 'done' ? (railsOpen.has(c) ? byColumn[c] : []) : byColumn[c]))
    .map((c) => c.key);
  const ids = view === 'list' ? listRows.map((c) => c.key) : boardIds;

  const onMove: OnMove = (card, action, mode) => {
    if (mode !== 'now') {
      openCard(card.key, { action });
      return;
    }
    moved.current = { key: card.key, index: ids.indexOf(card.key) };
    perform(card.key, action);
  };

  const claim = (id: string) => {
    const card = tasks.find((c) => c.key === id);
    if (card?.status !== 'ready') return;
    const blocker = openBlockers(card)[0];
    if (blocker) {
      showToast({
        tone: 'error',
        message: fill(t.card.blockedToast, {
          key: <Ltr mono>{card.key}</Ltr>,
          blocker: <Ltr mono>{blocker}</Ltr>,
        }),
      });
      return;
    }
    const available = actionsFor(card, roles, me.id).find((a) => a.action === 'claim');
    if (!available?.enabled) {
      showToast({
        tone: 'error',
        message: t.card.noRole.replace('{role}', available?.needsRole ? kit.roles[available.needsRole] : ''),
      });
      return;
    }
    onMove(card, 'claim', 'now');
  };

  const list = useKeyboardList({ ids, emptyFocusRef: heading, actions: { c: claim } });

  // A card that moved is a new element in another column, so focus follows it there.
  useLayoutEffect(() => {
    if (!moved.current) return;
    const { key, index } = moved.current;
    moved.current = null;
    const next = ids[Math.min(index, ids.length - 1)];
    if (ids.includes(key)) list.focusRow(key);
    else if (next) list.focusRow(next);
    else heading.current?.focus();
  });

  const setView = (next: 'board' | 'list') => {
    writeView(me.id, next);
    setQuery({ view: next });
  };

  // `v` replaces every row, so focus follows the same card into the new view, or stays on the toggle when that card is folded away.
  const afterToggle = useRef<{ key: string | null } | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!matchKey(e, 'v') || e.metaKey || e.ctrlKey || e.altKey || !shortcutsEnabled()) return;
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [data-card-sheet]',
        )
      )
        return;
      e.preventDefault();
      afterToggle.current = { key: target.closest<HTMLElement>('[data-row]')?.dataset.row ?? null };
      setView(view === 'board' ? 'list' : 'board');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useLayoutEffect(() => {
    if (!afterToggle.current) return;
    const { key } = afterToggle.current;
    afterToggle.current = null;
    if (key && ids.includes(key)) list.focusRow(key);
    else viewToggleRef.current?.querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus();
    // Runs when the view changed, after the new rows exist.
  }, [view]);

  // The filled button is the next thing this page wants from me: the first Ready task I can claim (kit README, filled-button rule).
  const canClaim = (c: TaskCard) =>
    inMyRole(c, roles) &&
    openBlockers(c).length === 0 &&
    actionsFor(c, roles, me.id).some((a) => a.action === 'claim' && a.enabled);
  const primaryKey = byColumn.ready.find(canClaim)?.key;

  const readyForMe = useReadyTasks().data?.length ?? 0;
  const inHands = tasks.filter(
    (c) => c.assigneeId === me.id && (c.status === 'claimed' || c.status === 'in_progress'),
  ).length;
  const awaitingReview = tasks.filter(
    (c) => c.status === 'in_review' && (roles.includes('qa') || isManager),
  ).length;

  const modules = [...new Set(tasks.map((c) => c.module).filter((m): m is string => !!m))].sort();
  const activeFilters =
    ['specialty', 'priority', 'module', 'q', 'review', 'status'].some((p) => route.query.get(p)) || mine;
  const clear = () => {
    rememberMine('tasks', me.id, false);
    setQuery({
      specialty: null,
      priority: null,
      module: null,
      q: null,
      review: null,
      status: null,
      mine: null,
    });
  };

  const loading = query.isPending;
  const error = query.isError;
  const empty = !loading && !error && tasks.length === 0;

  const viewToggle = (
    <div
      ref={viewToggleRef}
      role="group"
      aria-label={t.view.label}
      className="inline-flex rounded-md border border-border bg-card p-0.5"
    >
      {(
        [
          ['board', t.view.board, Kanban],
          ['list', t.view.list, List],
        ] as const
      ).map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          aria-keyshortcuts="v"
          onClick={() => setView(value)}
          className={cn(
            'inline-flex h-11 items-center gap-1.5 rounded-sm px-3 text-body-sm font-medium transition-colors duration-120 md:h-8',
            view === value
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            focusRing,
          )}
        >
          <Icon aria-hidden className="size-4" strokeWidth={1.75} />
          {label}
        </button>
      ))}
    </div>
  );

  const header = (
    <PageHeader
      title={t.title}
      meta={
        loading ? (
          <Skeleton className="mt-1.5 h-4 w-52 max-w-full" />
        ) : error || empty ? undefined : (
          plural(readyForMe, locale, t.summary.ready) +
          (inHands ? plural(inHands, locale, t.summary.mine) : '') +
          (awaitingReview ? plural(awaitingReview, locale, t.summary.review) : '')
        )
      }
      actions={
        loading || error || empty ? undefined : (
          <>
            {viewToggle}
            {canMove && (
              <Button onClick={() => setNewOpen(true)}>
                <Plus aria-hidden className="size-4" strokeWidth={2} />
                {t.newTask}
              </Button>
            )}
          </>
        )
      }
    />
  );

  const dialog = <NewCardDialog open={newOpen} onOpenChange={setNewOpen} initialType="task" />;

  if (error) {
    return (
      <PageContainer>
        {header}
        <ErrorState
          thing={t.errorThing}
          code={isHubError(query.error) ? query.error.code : undefined}
          requestId={isHubError(query.error) ? query.error.requestId : undefined}
          onRetry={() => void query.refetch()}
        />
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer className="max-w-none">
        {header}
        <LoadingRegion label={t.title}>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 w-20 rounded-full md:h-8" />
            ))}
          </div>
          <div className="flex gap-2 overflow-hidden">
            <Skeleton className="h-40 w-19 shrink-0 rounded-lg" />
            {[4, 2, 3, 2].map((count, i) => (
              <div
                key={i}
                className="flex w-72 shrink-0 flex-col gap-2 md:w-60 lg:w-auto lg:min-w-52 lg:flex-1 lg:basis-0"
              >
                <Skeleton className="h-7 w-28" />
                <SkeletonRows count={count} withAction={false} />
              </div>
            ))}
            <Skeleton className="h-40 w-19 shrink-0 rounded-lg" />
          </div>
        </LoadingRegion>
      </PageContainer>
    );
  }

  if (empty) {
    return (
      <PageContainer>
        {header}
        <EmptyState
          size="page"
          icon={SquareCheck}
          title={t.empty.firstTitle}
          action={
            canMove ? (
              <Button variant="primary" onClick={() => setNewOpen(true)}>
                <Plus aria-hidden className="size-4" strokeWidth={2} />
                {t.newTask}
              </Button>
            ) : undefined
          }
        >
          {isManager ? t.empty.firstBody : t.empty.firstBodyMember}
        </EmptyState>
        <div className="flex justify-center">
          <DeletedLink />
        </div>
        {dialog}
      </PageContainer>
    );
  }

  const nothing = view === 'list' ? listRows.length === 0 : visible.length === 0;

  return (
    <PageContainer className="max-w-none">
      {header}
      {accountantOnly && (
        <p className="rounded-md bg-muted px-3 py-2 text-body-sm text-muted-foreground">{t.board.readOnly}</p>
      )}
      <div ref={heading} tabIndex={-1} className="outline-none">
        <FilterBar
          collapse="always"
          mine={{ page: 'tasks', param: 'mine', value: '1' }}
          groups={[
            {
              param: 'review',
              label: t.filters.reviewGroup,
              multi: true,
              options: [{ value: '1', label: t.filters.review }],
            },
            {
              param: 'specialty',
              label: t.filters.specialty,
              multi: true,
              options: SPECIALTIES.map((s) => ({ value: s, label: kit.sheet.task.specialties[s] ?? s })),
            },
          ]}
          selects={[
            {
              param: 'priority',
              label: t.filters.priority,
              any: t.filters.anyPriority,
              options: PRIORITIES.map((p) => ({ value: p, label: p })),
            },
            {
              param: 'module',
              label: t.filters.module,
              any: t.filters.anyModule,
              options: modules.map((m) => ({ value: m, label: m })),
            },
            ...(view === 'list'
              ? [
                  {
                    param: 'status',
                    label: t.filters.status,
                    any: t.filters.anyStatus,
                    options: STATUS_ORDER.map((s) => ({ value: s, label: kit.status[s] ?? s })),
                  },
                ]
              : []),
          ]}
          searchParam="q"
          searchPlaceholder={t.filters.search}
          extra={<DeletedLink type="task" />}
        />
      </div>

      {nothing ? (
        <EmptyState
          icon={SearchX}
          title={t.empty.noMatch}
          action={activeFilters ? <Button onClick={clear}>{t.filters.clear}</Button> : undefined}
        >
          {t.empty.noMatchBody}
        </EmptyState>
      ) : view === 'board' ? (
        <TaskBoard
          byColumn={byColumn}
          rowProps={list.rowProps}
          openRails={railsOpen}
          onToggleRail={(column) =>
            setRailsOpen((set) => {
              const next = new Set(set);
              if (next.has(column)) next.delete(column);
              else next.add(column);
              return next;
            })
          }
          onMove={onMove}
          canMove={canMove}
          specialtyFiltered={specialties.length > 0}
          primaryKey={primaryKey}
        />
      ) : (
        <TaskList
          tasks={listRows}
          sort={sort}
          desc={desc}
          rowProps={list.rowProps}
          onMove={onMove}
          canMove={canMove}
          primaryKey={primaryKey}
        />
      )}
      {dialog}
    </PageContainer>
  );
}
