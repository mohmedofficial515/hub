import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Kanban, List, Plus, SearchX, SquareCheck } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import type { Priority } from '@lab/mocks/hub-app';
import {
  actionsFor,
  Button,
  cn,
  DAY,
  EmptyState,
  ErrorState,
  FilterBar,
  fill,
  focusRing,
  kitMessages,
  LoadingRegion,
  Ltr,
  matchKey,
  nowMs,
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
  useCards,
  useFilter,
  useFilterList,
  useKeyboardList,
  useMedia,
  usePerformAction,
  useReadyTasks,
  useRoute,
  useSession,
  type CardAction,
  type TaskCard,
} from '../../kit';
import { NewCardDialog } from '../../shell/new-card-dialog';
import { messages, type Column } from './i18n';
import { COLUMNS, TaskBoard } from './parts/board';
import { TaskList, type SortKey } from './parts/list';

const PRIO: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const ORDER: string[] = [...COLUMNS, 'cancelled'];
const SPECIALTIES = ['backend', 'frontend', 'design', 'qa', 'ops', 'docs'] as const;
const viewKey = (id: string) => `hub-v5:tasks-view:${id}`;

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

export default function Page() {
  const { scenario } = useSession();
  return <TasksPage key={scenario} />;
}

function TasksPage() {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const route = useRoute();
  const { scenario, me, roles, isManager, loading, error } = useSession();
  const all = useCards();
  const perform = usePerformAction();
  const [newOpen, setNewOpen] = useState(false);
  const heading = useRef<HTMLDivElement>(null);
  const moved = useRef<{ key: string; index: number } | null>(null);

  // Under 768 px a board shows half a column at a time, so a phone opens on the list. An explicit choice is remembered (review M12).
  const wideEnough = useMedia('(min-width: 768px)');
  const viewParam = useFilter('view');
  const [rememberedView] = useState(() => readView(me.id));
  const view: 'board' | 'list' = viewParam === 'list' || viewParam === 'board' ? viewParam : rememberedView === 'list' || rememberedView === 'board' ? rememberedView : wideEnough ? 'board' : 'list';
  const viewToggleRef = useRef<HTMLDivElement>(null);
  const mine = useFilter('mine') === '1';
  const reviewOnly = useFilter('review') === '1';
  const specialties = useFilterList('specialty');
  const priority = useFilter('priority');
  const moduleFilter = useFilter('module');
  const q = (useFilter('q') ?? '').trim().toLowerCase();
  const status = useFilter('status');
  const sort = (useFilter('sort') as SortKey | null) ?? 'priority';
  const desc = useFilter('order') === 'desc';

  // A link to a folded column, such as Today's "see the backlog", opens it.
  const [railsOpen, setRailsOpen] = useState<Set<Column>>(() => new Set(status === 'backlog' || status === 'done' ? [status] : []));

  const accountantOnly = roles.length === 1 && roles[0] === 'accountant';
  const canMove = !accountantOnly;
  const empty = scenario === 'empty';

  const tasks = useMemo(() => (empty ? [] : all.filter((c): c is TaskCard => c.type === 'task')), [all, empty]);
  const myRoleTask = (c: TaskCard) => (c.ownerRole ? roles.includes(c.ownerRole) : false);

  const matches = (c: TaskCard) => {
    if (specialties.length && !specialties.includes(c.task.specialty)) return false;
    if (priority && c.priority !== priority) return false;
    if (moduleFilter && c.module !== moduleFilter) return false;
    if (q && !c.key.toLowerCase().includes(q) && !c.title[locale].toLowerCase().includes(q) && !c.title.en.toLowerCase().includes(q)) return false;
    if (reviewOnly && c.status !== 'in_review') return false;
    // The page exists to find work, so Mine keeps what I could pick up next (see NOTES.md).
    if (mine && c.assigneeId !== me.id && !(c.status === 'ready' && myRoleTask(c))) return false;
    return true;
  };
  const visible = tasks.filter(matches);

  // The Mine rule: nothing is hidden by default, and what is mine comes first in its column.
  const isMine = (c: TaskCard) => c.assigneeId === me.id || (c.status === 'ready' && myRoleTask(c));
  const byPriority = (a: TaskCard, b: TaskCard) => Number(isMine(b)) - Number(isMine(a)) || PRIO[a.priority] - PRIO[b.priority] || (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity) || a.key.localeCompare(b.key);
  const doneSince = nowMs() - 14 * DAY;
  const byColumn = Object.fromEntries(
    COLUMNS.map((column) => [
      column,
      visible
        .filter((c) => c.status === column && (column !== 'done' || Date.parse(c.task.doneAt ?? c.lastEventAt) >= doneSince))
        .sort(column === 'done' ? (a, b) => Date.parse(b.task.doneAt ?? b.lastEventAt) - Date.parse(a.task.doneAt ?? a.lastEventAt) : byPriority),
    ]),
  ) as Record<Column, TaskCard[]>;

  const listRows = useMemo(() => {
    // Cancelled tasks leave the board; the list shows them when asked (09 §6).
    const rows = visible.filter((c) => (status ? c.status === status : c.status !== 'cancelled'));
    const dir = desc ? -1 : 1;
    const compare: Record<SortKey, (a: TaskCard, b: TaskCard) => number> = {
      key: (a, b) => a.key.localeCompare(b.key),
      priority: byPriority,
      status: (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || byPriority(a, b),
      due: (a, b) => (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity),
      updated: (a, b) => Date.parse(b.lastEventAt) - Date.parse(a.lastEventAt),
    };
    return [...rows].sort((a, b) => dir * (compare[sort] ?? compare.priority)(a, b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, status, sort, desc, mine, reviewOnly, specialties.join(), priority, moduleFilter, q]);

  const boardIds = COLUMNS.flatMap((c) => (c === 'backlog' || c === 'done' ? (railsOpen.has(c) ? byColumn[c] : []) : byColumn[c])).map((c) => c.key);
  const ids = view === 'list' ? listRows.map((c) => c.key) : boardIds;

  const onMove = (card: TaskCard, action: CardAction, mode: string) => {
    if (mode !== 'now') return openCard(card.key, { action });
    moved.current = { key: card.key, index: ids.indexOf(card.key) };
    perform(card.key, action);
  };

  const claim = (id: string) => {
    const card = tasks.find((c) => c.key === id);
    if (!card || card.status !== 'ready') return;
    const blocker = openBlockers(card)[0];
    if (blocker) return showToast({ tone: 'error', message: fill(t.card.blockedToast, { key: <Ltr mono>{card.key}</Ltr>, blocker: <Ltr mono>{blocker}</Ltr> }) });
    if (!myRoleTask(card) && !roles.includes('pm')) return showToast({ tone: 'error', message: t.card.noRole.replace('{role}', card.ownerRole ? kit.roles[card.ownerRole] : '') });
    onMove(card, 'claim', 'now');
  };

  const list = useKeyboardList({ ids, emptyFocusRef: heading, actions: { c: claim } });

  // A card that moved is a new element in another column, so focus follows it there.
  useLayoutEffect(() => {
    if (!moved.current) return;
    const { key, index } = moved.current;
    moved.current = null;
    if (ids.includes(key)) list.focusRow(key);
    else if (ids.length) list.focusRow(ids[Math.min(index, ids.length - 1)]);
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
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      e.preventDefault();
      afterToggle.current = { key: (e.target as HTMLElement).closest<HTMLElement>('[data-row]')?.dataset.row ?? null };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // The filled button is the next thing this page wants from me: the first Ready task I can claim (kit README, filled-button rule).
  const canClaim = (c: TaskCard) => myRoleTask(c) && openBlockers(c).length === 0 && !!actionsFor(c, roles, me.id).find((a) => a.action === 'claim' && a.enabled);
  const primaryKey = byColumn.ready.find(canClaim)?.key;

  const readyForMe = useReadyTasks().length;
  const inHands = tasks.filter((c) => c.assigneeId === me.id && (c.status === 'claimed' || c.status === 'in_progress')).length;
  const awaitingReview = tasks.filter((c) => c.status === 'in_review' && (roles.includes('qa') || roles.includes('pm') || roles.includes('owner'))).length;

  const modules = [...new Set(tasks.map((c) => c.module).filter((m): m is string => !!m))].sort();
  const activeFilters = ['specialty', 'priority', 'module', 'q', 'review', 'status'].some((p) => route.query.get(p)) || mine;
  const clear = () => {
    rememberMine('tasks', me.id, false);
    setQuery({ specialty: null, priority: null, module: null, q: null, review: null, status: null, mine: null });
  };

  const viewToggle = (
    <div ref={viewToggleRef} role="group" aria-label={t.view.label} className="inline-flex rounded-md border border-border bg-card p-0.5">
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
            view === value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
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
      meta={loading ? <Skeleton className="mt-1.5 h-4 w-52 max-w-full" /> : error || empty ? undefined : plural(readyForMe, locale, t.summary.ready) + (inHands ? plural(inHands, locale, t.summary.mine) : '') + (awaitingReview ? plural(awaitingReview, locale, t.summary.review) : '')}
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
        <ErrorState thing={t.errorThing} code="hub.tasks.unavailable" requestId="req_5c1e88a" onRetry={() => setQuery({ scenario: null })} />
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
              <div key={i} className="flex w-72 shrink-0 flex-col gap-2 md:w-60 lg:w-auto lg:min-w-52 lg:flex-1 lg:basis-0">
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
        {dialog}
      </PageContainer>
    );
  }

  const nothing = view === 'list' ? listRows.length === 0 : visible.length === 0;

  return (
    <PageContainer className="max-w-none">
      {header}
      {accountantOnly && <p className="rounded-md bg-muted px-3 py-2 text-body-sm text-muted-foreground">{t.board.readOnly}</p>}
      <div ref={heading} tabIndex={-1} className="outline-none">
        <FilterBar
          collapse="always"
          mine={{ page: 'tasks', param: 'mine', value: '1' }}
          groups={[
            { param: 'review', label: t.filters.reviewGroup, multi: true, options: [{ value: '1', label: t.filters.review }] },
            { param: 'specialty', label: t.filters.specialty, multi: true, options: SPECIALTIES.map((s) => ({ value: s, label: kit.sheet.task.specialties[s] })) },
          ]}
          selects={[
            { param: 'priority', label: t.filters.priority, any: t.filters.anyPriority, options: (['P0', 'P1', 'P2', 'P3'] as const).map((p) => ({ value: p, label: p })) },
            { param: 'module', label: t.filters.module, any: t.filters.anyModule, options: modules.map((m) => ({ value: m, label: m })) },
            ...(view === 'list' ? [{ param: 'status', label: t.filters.status, any: t.filters.anyStatus, options: ORDER.map((s) => ({ value: s, label: kit.status[s] })) }] : []),
          ]}
          searchParam="q"
          searchPlaceholder={t.filters.search}
        />
      </div>

      {nothing ? (
        <EmptyState icon={SearchX} title={t.empty.noMatch} action={activeFilters ? <Button onClick={clear}>{t.filters.clear}</Button> : undefined}>
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
        <TaskList tasks={listRows} sort={sort} desc={desc} rowProps={list.rowProps} onMove={onMove} canMove={canMove} primaryKey={primaryKey} />
      )}
      {dialog}
    </PageContainer>
  );
}
