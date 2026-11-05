'use client';

/**
 * @file planning-page.tsx
 * @description Planning (docs/15 §4): "what are we thinking about, and what is planned next?". It has no v5 design. The layout's reasons are in NOTES.md beside this file.
 */
import { Lightbulb, Plus, Route, SearchX } from 'lucide-react';
import { useRef, useState } from 'react';

import {
  Button,
  cn,
  CopyButton,
  EmptyState,
  ErrorState,
  FilterBar,
  type IdeaCard,
  LoadingRegion,
  PageContainer,
  PageHeader,
  type PlanCard,
  plural,
  rememberMine,
  setQuery,
  Skeleton,
  SkeletonRows,
  useFilter,
  useKeyboardList,
  useLocale,
  useSession,
  useT,
} from '@/components/kit';
import { DeletedLink } from '@/components/tasks/deleted-view';
import {
  ACTIVE_IDEAS,
  ACTIVE_PLANS,
  CLOSED_IDEAS,
  CLOSED_PLANS,
  isMineHere,
  pickFocal,
} from '@/features/planning/model';
import { useIdeasQuery, usePlansQuery } from '@/features/planning/queries';
import { isHubError } from '@/lib/api/errors';

import type { PlanningMessages } from './messages';
import { NewIdeaDialog, NewPlanDialog } from './new-cards';
import { FocalCard, ideaIconClass, IdeaRow, Lane, type LaneGroup, planIconClass, PlanRow } from './parts';

type Scope = 'active' | 'closed';

const PRIO = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
const byWeight = (a: IdeaCard | PlanCard, b: IdeaCard | PlanCard) =>
  PRIO[a.priority] - PRIO[b.priority] || Date.parse(b.lastEventAt) - Date.parse(a.lastEventAt);

function groupBy<C extends IdeaCard | PlanCard>(rows: C[], statuses: readonly string[]): LaneGroup<C>[] {
  return statuses
    .map((status) => ({ status, rows: rows.filter((c) => c.status === status).sort(byWeight) }))
    .filter((group) => group.rows.length > 0);
}

export function PlanningPage() {
  const t = useT<PlanningMessages>('planning');
  const locale = useLocale();
  const { me, roles } = useSession();
  const ideasQuery = useIdeasQuery();
  const plansQuery = usePlansQuery();
  const [newIdea, setNewIdea] = useState(false);
  const [newPlan, setNewPlan] = useState(false);
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

  const openIdeas = ideas.filter((c) => (ACTIVE_IDEAS as readonly string[]).includes(c.status)).length;
  const movingPlans = plans.filter((c) => (ACTIVE_PLANS as readonly string[]).includes(c.status)).length;
  const closedCount = ideas.length + plans.length - openIdeas - movingPlans;
  const summary = `${plural(openIdeas, locale, t.summary.ideas)}${plural(movingPlans, locale, t.summary.plans)}`;

  const dialogs = (
    <>
      <NewIdeaDialog open={newIdea} onOpenChange={setNewIdea} />
      <NewPlanDialog open={newPlan} onOpenChange={setNewPlan} />
    </>
  );

  const newButtons = (fillFirst = false) => (
    <>
      <Button variant={fillFirst ? 'primary' : 'outline'} onClick={() => setNewIdea(true)}>
        <Plus aria-hidden className="size-4" strokeWidth={1.75} />
        {t.newIdea}
      </Button>
      <Button onClick={() => setNewPlan(true)}>
        <Plus aria-hidden className="size-4" strokeWidth={1.75} />
        {t.newPlan}
      </Button>
    </>
  );

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
      <PageContainer>
        <PageHeader title={t.title} meta={<Skeleton className="mt-1.5 h-4 w-56 max-w-full" />} />
        <LoadingRegion label={t.loading}>
          <Skeleton className="h-9 w-48 max-w-full" />
          <Skeleton className="h-56 w-full rounded-lg" />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
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
          <DeletedLink type="idea" />
        </div>
        {dialogs}
      </PageContainer>
    );
  }

  const nothing = shownIdeas.length === 0 && shownPlans.length === 0;
  const filtered = mine || !!q;

  return (
    <PageContainer>
      <PageHeader title={t.title} meta={summary} actions={newButtons()} />
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
          extra={<DeletedLink type="plan" />}
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
          <div className={cn('grid items-start gap-x-8 gap-y-8 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]')}>
            <Lane<IdeaCard>
              id="lane-ideas"
              icon={Lightbulb}
              iconClass={ideaIconClass}
              title={scope === 'active' ? t.lanes.ideas : t.lanes.closedIdeas}
              groups={ideaGroups}
              empty={
                <EmptyState icon={Lightbulb} title={t.empty.ideasTitle}>
                  {t.empty.ideasBody}
                </EmptyState>
              }
              renderRow={(card) => <IdeaRow card={card} rowProps={list.rowProps} />}
            />
            <Lane<PlanCard>
              id="lane-plans"
              icon={Route}
              iconClass={planIconClass}
              title={scope === 'active' ? t.lanes.plans : t.lanes.closedPlans}
              groups={planGroups}
              empty={
                <EmptyState icon={Route} title={t.empty.plansTitle}>
                  {t.empty.plansBody}
                </EmptyState>
              }
              renderRow={(card) => <PlanRow card={card} rowProps={list.rowProps} />}
            />
          </div>
        </>
      )}
      {dialogs}
    </PageContainer>
  );
}
