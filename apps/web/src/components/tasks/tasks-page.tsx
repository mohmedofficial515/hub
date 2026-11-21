'use client';

/**
 * @file tasks-page.tsx
 * @description Ported from v5 `pages/tasks/page.tsx`. The board or the list, and the Deleted view at `?view=deleted`. Reasons: `apps/lab/hub/today/v5-peacock-app/pages/tasks/NOTES.md`.
 */
import { seesAllReadyWork } from '@hub/contracts';
import { Focus, Kanban, List, Plus, SearchX, SquareCheck } from 'lucide-react';
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
  useMembers,
  usePageWide,
  usePerformAction,
  useReadyTasks,
  useRoute,
  useSession,
  useT,
} from '@/components/kit';
import { NewCardDialog } from '@/components/shell/new-card-dialog';
import { usePageRoom } from '@/components/workbench/page-room';
import { useDoNext } from '@/features/next/queries';
import {
  type Column,
  COLUMNS,
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
import { FocusDesk, focusDeskIds, focusDeskOf } from './focus-desk';
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
type View = 'focus' | 'board' | 'list';
const VIEWS: View[] = ['focus', 'board', 'list'];
const isView = (v: string | null): v is View => VIEWS.includes(v as View);

function writeView(id: string, view: View) {
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
  // Do next's ranking (docs/16 §11), the one Today and the panel show, orders the Focus desk. Its largest page, so a whole Ready column is ranked.
  const nextQuery = useDoNext({ limit: 20 });
  const perform = usePerformAction();
  const [newOpen, setNewOpen] = useState(false);
  const heading = useRef<HTMLDivElement>(null);
  const moved = useRef<{ key: string; index: number } | null>(null);

  // Under 768 px a board shows half a column at a time, so a phone opens on the list. An explicit choice is remembered (review M12).
  const wideEnough = usePageWide(768);
  const viewParam = useFilter('view');
  const [rememberedView] = useState(() => readView(me.id));
  // Beside the panel, with no room for a Board's lanes, its List shows in its place and the chosen view stays the owner's (D54).
  const { boardTight } = usePageRoom();
  // A wide page opens on the Focus desk; the full board is one press of `v` away (owner pick, 2026-11-09).
  const chosenView: View = isView(viewParam)
    ? viewParam
    : isView(rememberedView)
      ? rememberedView
      : wideEnough
        ? 'focus'
        : 'list';
  const view: View = boardTight && chosenView === 'board' ? 'list' : chosenView;
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

  // The folded columns opened, in the URL so a reload or a shared link keeps them. A link to a folded column, such as Today's "see the backlog", opens it.
  const railsParam = useFilterList('rails');
  const isRail = (c: string | null): c is 'backlog' | 'done' => c === 'backlog' || c === 'done';
  const railsOpen = new Set<Column>([...railsParam.filter(isRail), ...(isRail(status) ? [status] : [])]);
  const assignee = useFilter('assignee');

  const accountantOnly = roles.length === 1 && roles[0] === 'accountant';
  const canMove = !accountantOnly;

  const tasks = useMemo(() => query.data?.items ?? [], [query.data]);
  const filters = { specialties, priority, module: moduleFilter, q, review, mine, assignee };
  const visible = tasks.filter((c) => matchesFilters(c, filters, me.id, roles));
  const byColumn = columnsOf(visible, me.id, roles);
  const listRows = sortList(visible, { status, sort, desc }, me.id, roles);

  // The Focus desk's stage, in the URL so Back and a shared link keep it: a link to a column opens on it, else Ready, where the next piece of work waits.
  const stageParam = useFilter('stage');
  const stage: Column = COLUMNS.includes(stageParam as Column)
    ? (stageParam as Column)
    : COLUMNS.includes(status as Column)
      ? (status as Column)
      : 'ready';
  const setStage = (next: Column) => setQuery({ stage: next === 'ready' ? null : next });

  const boardIds = (Object.keys(byColumn) as Column[])
    .flatMap((c) => (c === 'backlog' || c === 'done' ? (railsOpen.has(c) ? byColumn[c] : []) : byColumn[c]))
    .map((c) => c.key);
  // The filled button is the next thing this page wants from me: the first Ready task I can claim (kit README, filled-button rule).
  const seesAll = seesAllReadyWork(roles);
  const canClaim = (c: TaskCard) =>
    (seesAll || inMyRole(c, roles)) &&
    openBlockers(c).length === 0 &&
    actionsFor(c, roles, me.id).some((a) => a.action === 'claim' && a.enabled);
  const primaryKey = byColumn.ready.find(canClaim)?.key;
  const seesReview = roles.includes('qa') || isManager;
  // The desk's next task is the first one Do next ranks that I can claim; with no answer yet, or none of its tasks here, it is the board's first.
  const nextItems = useMemo(
    () => (nextQuery.data?.items ?? []).filter((i) => i.type === 'task' && !i.step),
    [nextQuery.data],
  );
  const ranked = nextItems.map((i) => i.key);
  const reasons = useMemo(() => new Map(nextItems.map((i) => [i.key, i])), [nextItems]);
  const readyByKey = new Map(byColumn.ready.map((c) => [c.key, c]));
  const deskPrimary =
    ranked.find((key) => {
      const card = readyByKey.get(key);
      return !!card && canClaim(card);
    }) ?? primaryKey;
  const desk = focusDeskOf(byColumn, stage, { meId: me.id, primaryKey: deskPrimary, seesReview, ranked });

  const ids = view === 'list' ? listRows.map((c) => c.key) : view === 'focus' ? focusDeskIds(desk) : boardIds;

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

  const setView = (next: View) => {
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
      setView(VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length] ?? 'focus');
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

  const readyForMe = useReadyTasks().data?.length ?? 0;
  const inHands = tasks.filter(
    (c) => c.assigneeId === me.id && (c.status === 'claimed' || c.status === 'in_progress'),
  ).length;
  const awaitingReview = tasks.filter((c) => c.status === 'in_review' && seesReview).length;

  const modules = [...new Set(tasks.map((c) => c.module).filter((m): m is string => !!m))].sort();
  // Who holds work: the members holding at least one task, by name.
  const members = useMembers().data ?? [];
  const holders = members
    .filter((m) => tasks.some((c) => c.assigneeId === m.id))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const activeFilters =
    ['specialty', 'priority', 'module', 'q', 'review', 'status', 'assignee'].some((p) =>
      route.query.get(p),
    ) || mine;
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
      assignee: null,
      sort: null,
      order: null,
      stage: null,
      rails: null,
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
          ['focus', t.view.focus, Focus],
          ['board', t.view.board, Kanban],
          ['list', t.view.list, List],
        ] as const
      ).map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          // The member's choice stays pressed while a tight page shows the List in the Board's place; the note below says why.
          aria-pressed={chosenView === value}
          aria-keyshortcuts="v"
          onClick={() => setView(value)}
          className={cn(
            'inline-flex h-11 items-center gap-1.5 rounded-sm px-3 text-body-sm font-medium transition-colors duration-120 md:h-8',
            chosenView === value
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
          plural(readyForMe, locale, seesAll ? t.summary.readyProject : t.summary.ready) +
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
        {view === 'focus' ? (
          <LoadingRegion label={t.title}>
            <Skeleton className="h-11 w-60 max-w-full rounded-lg md:h-9" />
            <Skeleton className="h-36 w-full rounded-xl @page-sm:h-20" />
            <div className="grid items-start gap-4 lg:@page-lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-24 w-full rounded-xl" />
                <SkeletonRows count={4} />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12 w-full rounded-xl" />
                <SkeletonRows count={2} />
              </div>
            </div>
          </LoadingRegion>
        ) : (
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
                  className="flex w-72 shrink-0 flex-col gap-2 md:w-60 lg:@page-lg:w-auto lg:min-w-52 lg:flex-1 lg:@page-lg:basis-0"
                >
                  <Skeleton className="h-7 w-28" />
                  <SkeletonRows count={count} withAction={false} />
                </div>
              ))}
              <Skeleton className="h-40 w-19 shrink-0 rounded-lg" />
            </div>
          </LoadingRegion>
        )}
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
      {boardTight && chosenView === 'board' && (
        <p data-board-tight className="rounded-md bg-muted px-3 py-2 text-body-sm text-muted-foreground">
          {t.view.boardTight}
        </p>
      )}
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
            // A project with no modules has nothing to choose here.
            ...(modules.length
              ? [
                  {
                    param: 'module',
                    label: t.filters.module,
                    any: t.filters.anyModule,
                    options: modules.map((m) => ({ value: m, label: m })),
                  },
                ]
              : []),
            {
              param: 'assignee',
              label: t.filters.assignee,
              any: t.filters.anyAssignee,
              options: [
                { value: 'none', label: t.filters.unassigned },
                ...holders.map((m) => ({ value: m.id, label: m.name })),
              ],
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
      ) : view === 'focus' ? (
        <FocusDesk
          rows={desk}
          byColumn={byColumn}
          stage={stage}
          onStage={setStage}
          rowProps={list.rowProps}
          onMove={onMove}
          canMove={canMove}
          primaryKey={deskPrimary}
          specialtyFiltered={specialties.length > 0}
          seesReview={seesReview}
          reasons={reasons}
        />
      ) : view === 'board' ? (
        <TaskBoard
          byColumn={byColumn}
          rowProps={list.rowProps}
          openRails={railsOpen}
          onToggleRail={(column) => {
            const next = new Set(railsOpen);
            if (next.has(column)) next.delete(column);
            else next.add(column);
            // Closing the rail a status link opened also drops that status, or it would open again at once.
            setQuery({
              rails: [...next].join(',') || null,
              ...(status === column && !next.has(column) ? { status: null } : {}),
            });
          }}
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
