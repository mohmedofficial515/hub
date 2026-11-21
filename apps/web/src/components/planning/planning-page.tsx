'use client';

/**
 * @file planning-page.tsx
 * @description Planning (docs/15 §4): "what are we thinking about, and what is planned next?". The lists, a plan's or an idea's own page, and the two
 * studios all live on this one route. A plan a chat proposes opens in the Plan Studio. The layout's reasons are in NOTES.md beside this file.
 */
import { CheckCheck, Hourglass, Lightbulb, Loader, Route, SearchX, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';

import {
  AppLink,
  Button,
  type CardAction,
  CopyButton,
  EmptyState,
  ErrorState,
  FilterBar,
  type IdeaCard,
  LoadingRegion,
  num,
  PageContainer,
  PageHeader,
  type PlanCard,
  plural,
  rememberMine,
  setQuery,
  type SheetTab,
  Skeleton,
  SkeletonRows,
  useFilter,
  useKeyboardList,
  useLocale,
  useRoute,
  useSession,
  useT,
} from '@/components/kit';
import { DeletedLink } from '@/components/tasks/deleted-view';
import {
  ACTIVE_IDEAS,
  ACTIVE_PLANS,
  CLOSED_IDEAS,
  CLOSED_PLANS,
  ideaIdOfPlan,
  isMineHere,
  pickFocal,
  planIdOfIdea,
  progressOf,
} from '@/features/planning/model';
import { useIdeasQuery, usePlansQuery } from '@/features/planning/queries';
import { isHubError } from '@/lib/api/errors';

import { PlanningDetail } from './detail';
import { useLiveDraft } from './live';
import type { PlanningMessages } from './messages';
import {
  DraftBanner,
  FocalCard,
  IdeaRow,
  Lane,
  type LaneGroup,
  linkButton,
  PlanRow,
  StatsStrip,
} from './parts';
import { IdeaStudio } from './studio/idea-studio';
import { PlanStudio } from './studio/plan-studio';

type Scope = 'active' | 'closed';

const TABS: readonly SheetTab[] = ['details', 'comments', 'history', 'links'];
/** A tab from the address, or the details when it names none this page has. */
const tabOf = (value: string | null): SheetTab =>
  value && (TABS as readonly string[]).includes(value) ? (value as SheetTab) : 'details';

const PRIO = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
const byWeight = (a: IdeaCard | PlanCard, b: IdeaCard | PlanCard) =>
  PRIO[a.priority] - PRIO[b.priority] || Date.parse(b.lastEventAt) - Date.parse(a.lastEventAt);

function groupBy<C extends IdeaCard | PlanCard>(rows: C[], statuses: readonly string[]): LaneGroup<C>[] {
  return statuses
    .map((status) => ({ status, rows: rows.filter((c) => c.status === status).sort(byWeight) }))
    .filter((group) => group.rows.length > 0);
}

/**
 * An old link to the live draft page (`?draft=1`), which the Plan Studio replaced: it lands on the studio, on the chat writing the plan when there is
 * one, else on the studio's start. Replaced in history, so Back does not bounce here again.
 */
function DraftRedirect() {
  const chatId = useLiveDraft()?.chatId ?? null;
  useEffect(() => {
    setQuery({ draft: null, studio: 'plan', chat: chatId });
  }, [chatId]);
  return null;
}

/**
 * Planning: the lists, a plan's or an idea's own page (`?plan=KEY`), or a studio (`?studio=idea|plan`). They share one route, so the lists keep their
 * filters in history while a page is open. A Plan-mode chat no longer moves the page by itself: the banner on the lists offers its studio.
 */
export function PlanningPage() {
  const { query } = useRoute();
  const plan = query.get('plan');
  const draft = query.get('draft');
  const studio = query.get('studio');
  if (plan) {
    return (
      <PlanningDetail
        key={plan}
        cardKey={plan}
        action={(query.get('action') || null) as CardAction | null}
        tab={tabOf(query.get('tab'))}
      />
    );
  }
  if (studio === 'idea') return <IdeaStudio />;
  if (studio === 'plan') return <PlanStudio />;
  if (draft) return <DraftRedirect />;
  return <PlanningLists />;
}

function PlanningLists() {
  const t = useT<PlanningMessages>('planning');
  const locale = useLocale();
  const { me, roles } = useSession();
  const ideasQuery = useIdeasQuery();
  const plansQuery = usePlansQuery();
  const heading = useRef<HTMLDivElement>(null);

  const scope = (useFilter('scope') as Scope | null) ?? 'active';
  const mine = useFilter('mine') === '1';
  const q = (useFilter('q') ?? '').trim().toLowerCase();

  const ideas = ideasQuery.data?.items ?? [];
  const plans = plansQuery.data?.items ?? [];
  const matches = (c: IdeaCard | PlanCard) =>
    (!mine || isMineHere(c, me.id, roles)) &&
    (!q || c.key.toLowerCase().includes(q) || c.title.toLowerCase().includes(q));

  const ideaStatuses: readonly string[] = scope === 'active' ? ACTIVE_IDEAS : CLOSED_IDEAS;
  const planStatuses: readonly string[] = scope === 'active' ? ACTIVE_PLANS : CLOSED_PLANS;
  const shownIdeas = ideas.filter((c) => ideaStatuses.includes(c.status) && matches(c));
  const shownPlans = plans.filter((c) => planStatuses.includes(c.status) && matches(c));

  // Only the active view has a next thing. It appears once: the focal card is not also a row.
  const focal = scope === 'active' ? pickFocal([...shownPlans, ...shownIdeas], roles, me.id) : null;
  const ideaGroups = groupBy(
    shownIdeas.filter((c) => c.key !== focal?.card.key),
    ideaStatuses,
  );
  const planGroups = groupBy(
    shownPlans.filter((c) => c.key !== focal?.card.key),
    planStatuses,
  );

  const ids = [
    ...(focal ? [focal.card.key] : []),
    ...ideaGroups.flatMap((g) => g.rows.map((c) => c.key)),
    ...planGroups.flatMap((g) => g.rows.map((c) => c.key)),
  ];
  const list = useKeyboardList({ ids, emptyFocusRef: heading });

  const activePlans = plans.filter((c) => (ACTIVE_PLANS as readonly string[]).includes(c.status));
  const openIdeas = ideas.filter((c) => (ACTIVE_IDEAS as readonly string[]).includes(c.status)).length;
  const movingPlans = activePlans.length;
  const closedCount = ideas.length + plans.length - openIdeas - movingPlans;
  const summary = `${plural(openIdeas, locale, t.summary.ideas)}${plural(movingPlans, locale, t.summary.plans)}`;
  const steps = activePlans.reduce(
    (sum, plan) => {
      const { done, total } = progressOf(plan);
      return { done: sum.done + done, total: sum.total + total };
    },
    { done: 0, total: 0 },
  );

  // Places, so they are links: each opens in a new tab too. Filled only on an empty page, where creating is the next thing.
  const newButtons = (fillFirst = false) => (
    <>
      <AppLink
        view="planning"
        query={{ studio: 'idea', chat: null }}
        className={linkButton(fillFirst ? 'primary' : 'outline')}
      >
        <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
        {t.newIdea}
      </AppLink>
      <AppLink view="planning" query={{ studio: 'plan', chat: null }} className={linkButton('outline')}>
        <Route aria-hidden className="size-4" strokeWidth={1.75} />
        {t.newPlan}
      </AppLink>
    </>
  );
  const plansById = new Map(plans.map((c) => [c.id, c]));
  const ideasById = new Map(ideas.map((c) => [c.id, c]));
  const planOf = (card: IdeaCard) => {
    const id = planIdOfIdea(card);
    return id ? plansById.get(id) : undefined;
  };
  const ideaOf = (card: PlanCard) => {
    const id = ideaIdOfPlan(card);
    return id ? ideasById.get(id) : undefined;
  };
  /** Where a number on the strip jumps: its group of plans, or the focal card when that plan is the one on top. */
  const jump = (status: string) =>
    planGroups.some((g) => g.status === status)
      ? `#lane-plans-${status}`
      : focal?.card.type === 'plan' && focal.card.status === status
        ? '#planning-focal'
        : '#lane-plans';

  const failed = ideasQuery.isError ? ideasQuery : plansQuery.isError ? plansQuery : null;
  if (failed) {
    return (
      <PageContainer>
        <PageHeader title={t.title} />
        <ErrorState
          thing={t.errorThing}
          code={isHubError(failed.error) ? failed.error.code : undefined}
          requestId={isHubError(failed.error) ? failed.error.requestId : undefined}
          onRetry={() => {
            void ideasQuery.refetch();
            void plansQuery.refetch();
          }}
        />
      </PageContainer>
    );
  }

  if (ideasQuery.isPending || plansQuery.isPending) {
    return (
      <PageContainer className="gap-5 md:gap-6">
        <PageHeader title={t.title} meta={<Skeleton className="mt-1.5 h-4 w-56 max-w-full" />} />
        <LoadingRegion label={t.loading}>
          <div className="grid grid-cols-2 gap-2 @page-md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-9 w-48 max-w-full" />
          <Skeleton className="h-52 w-full rounded-2xl" />
          <div className="grid gap-6 xl:@page-xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-40" />
              <SkeletonRows count={3} withAction={false} />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-40" />
              <SkeletonRows count={3} />
            </div>
          </div>
        </LoadingRegion>
      </PageContainer>
    );
  }

  if (ideas.length === 0 && plans.length === 0) {
    return (
      <PageContainer>
        <PageHeader title={t.title} />
        <DraftBanner />
        <EmptyState
          size="page"
          icon={Lightbulb}
          title={t.empty.firstTitle}
          action={<div className="flex flex-wrap justify-center gap-2">{newButtons(true)}</div>}
        >
          <span className="inline-flex flex-wrap items-center justify-center gap-2">
            {t.empty.firstBody}
            <CopyButton compact text="/hub:plan" />
          </span>
        </EmptyState>
        <div className="flex justify-center">
          <DeletedLink />
        </div>
      </PageContainer>
    );
  }

  const nothing = shownIdeas.length === 0 && shownPlans.length === 0;
  const filtered = mine || !!q;
  const waiting = plans.filter((c) => c.status === 'in_review').length;
  const inProgress = plans.filter((c) => c.status === 'in_progress').length;

  return (
    <PageContainer className="gap-5 md:gap-6">
      <PageHeader title={t.title} meta={summary} actions={newButtons()} />
      <StatsStrip
        label={t.stats.label}
        items={[
          {
            label: t.stats.waiting,
            value: num(waiting, locale),
            icon: Hourglass,
            href: jump('in_review'),
            empty: waiting === 0 || scope !== 'active',
          },
          {
            label: t.stats.moving,
            value: num(inProgress, locale),
            icon: Loader,
            href: jump('in_progress'),
            empty: inProgress === 0 || scope !== 'active',
          },
          {
            label: t.stats.ideas,
            value: num(openIdeas, locale),
            icon: Lightbulb,
            href: '#lane-ideas',
            empty: openIdeas === 0 || scope !== 'active',
          },
          {
            label: t.stats.steps,
            value: `${num(steps.done, locale)} / ${num(steps.total, locale)}`,
            icon: CheckCheck,
            href: '#lane-plans',
            empty: steps.total === 0 || scope !== 'active',
          },
        ]}
      />
      <DraftBanner />
      <div ref={heading} tabIndex={-1} className="outline-none">
        <FilterBar<Scope>
          status={{
            label: t.scope.label,
            value: scope,
            onChange: (next) => setQuery({ scope: next === 'active' ? null : next }),
            options: [
              { value: 'active', label: t.scope.active, count: openIdeas + movingPlans },
              { value: 'closed', label: t.scope.closed, count: closedCount },
            ],
          }}
          mine={{ page: 'planning', param: 'mine', value: '1' }}
          searchParam="q"
          searchPlaceholder={t.filters.search}
          extra={<DeletedLink />}
        />
      </div>

      {nothing && filtered ? (
        <EmptyState
          icon={SearchX}
          title={t.empty.noMatch}
          action={
            <Button
              size="sm"
              onClick={() => {
                rememberMine('planning', me.id, false);
                setQuery({ mine: null, q: null });
              }}
            >
              {t.empty.clear}
            </Button>
          }
        />
      ) : (
        <>
          {focal && <FocalCard focal={focal} rowProps={list.rowProps} />}
          <div className="grid items-start gap-x-6 gap-y-8 xl:@page-xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <Lane<IdeaCard>
              id="lane-ideas"
              icon={Lightbulb}
              type="idea"
              title={scope === 'active' ? t.lanes.ideas : t.lanes.closedIdeas}
              groups={ideaGroups}
              empty={
                <EmptyState icon={Lightbulb} title={t.empty.ideasTitle}>
                  {t.empty.ideasBody}
                </EmptyState>
              }
              renderRow={(card) => <IdeaRow card={card} rowProps={list.rowProps} plan={planOf(card)} />}
            />
            <Lane<PlanCard>
              id="lane-plans"
              icon={Route}
              type="plan"
              title={scope === 'active' ? t.lanes.plans : t.lanes.closedPlans}
              groups={planGroups}
              empty={
                <EmptyState icon={Route} title={t.empty.plansTitle}>
                  {t.empty.plansBody}
                </EmptyState>
              }
              renderRow={(card) => <PlanRow card={card} rowProps={list.rowProps} idea={ideaOf(card)} />}
            />
          </div>
        </>
      )}
    </PageContainer>
  );
}
