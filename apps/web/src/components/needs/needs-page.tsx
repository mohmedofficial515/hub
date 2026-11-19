'use client';

/**
 * @file needs-page.tsx
 * @description Ported from the approved design, pages/needs. Contract: apps/web/README.md.
 */
import { ROLES } from '@hub/contracts';
import { motion } from 'framer-motion';
import { CircleCheck, CirclePlay, Inbox, KeyRound, type LucideIcon, Plus, Signpost } from 'lucide-react';
import { useRef, useState } from 'react';

import {
  actionsFor,
  Button,
  cn,
  EmptyState,
  ErrorState,
  FilterBar,
  fmt,
  kitMessages,
  LoadingRegion,
  Ltr,
  type NeedCard,
  num,
  PageContainer,
  PageHeader,
  plural,
  rememberMine,
  roleIcon,
  setQuery,
  Skeleton,
  SkeletonRow,
  useAwaiting,
  useFilter,
  useKeyboardList,
  useLocale,
  useSession,
  useT,
} from '@/components/kit';
import type { NeedsMessages } from '@/features/needs/messages';
import { useNeedsQuery, useNeedStale } from '@/features/needs/queries';
import { isHubError } from '@/lib/api/errors';

import { AddressRule } from './parts/address-rule';
import { NeedRow } from './parts/need-row';
import { NewNeedDialog } from './parts/new-need';

const ease = [0.2, 0.8, 0.2, 1] as const;
const PRIO = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

type Stage = 'requested' | 'in_progress' | 'delivered' | 'verified';

/**
 * A column's head. The rail through the dots is the route a need travels, so the columns read as one line, and it runs
 * with the reading direction. `Verified` is where the line ends.
 */
function StageHead({
  id,
  icon: Icon,
  title,
  count,
  last,
  headingRef,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  count: number;
  last?: boolean;
  headingRef?: React.Ref<HTMLHeadingElement> | undefined;
}) {
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden className="relative hidden h-2 items-center lg:@page-lg:flex">
        <span className={cn('absolute start-0 h-px bg-input', last ? 'w-2' : '-end-3')} />
        <span className="relative size-2 rounded-full bg-muted-foreground" />
      </div>
      <h2
        ref={headingRef}
        id={id}
        tabIndex={-1}
        className="flex items-center gap-2 text-title-sm font-semibold text-foreground outline-none"
      >
        <Icon aria-hidden className="size-4.5 text-muted-foreground" strokeWidth={1.75} />
        {title}
        <span className="rounded-full bg-muted px-2 text-caption font-medium text-muted-foreground tabular-nums">
          <Ltr>{num(count, locale)}</Ltr>
        </span>
      </h2>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid gap-6 lg:@page-lg:grid-cols-3 lg:gap-3">
      {[2, 1, 2].map((n, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-32" />
          {Array.from({ length: n }, (_, j) => (
            <SkeletonRow key={j} withAction={false} className="min-h-32" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function NeedsPage() {
  const t = useT<NeedsMessages>('needs');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { roles, me } = useSession();
  const query = useNeedsQuery();
  const isStale = useNeedStale();
  const [creating, setCreating] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const lane = useFilter('lane') === 'role' ? 'role' : 'status';
  const responsible = useFilter('responsible');
  const kind = useFilter('kind');
  const mine = useFilter('awaiting') === 'me';
  const showVerified = useFilter('verified') === '1';

  const all = query.data?.items ?? [];
  // Mine means what the sidebar and Today count: the card waits on me now (review B2).
  const stackKeys = new Set(useAwaiting().map((c) => c.key));
  const isMine = (c: NeedCard) => stackKeys.has(c.key);
  const matches = (c: NeedCard) =>
    (!responsible || c.need.responsibleRole === responsible) &&
    (!kind || c.need.kind === kind) &&
    (!mine || isMine(c));
  // P3: mine first, then what has waited too long, then priority and age (04 §3.12).
  const order = (a: NeedCard, b: NeedCard) =>
    Number(isMine(b)) - Number(isMine(a)) ||
    Number(isStale(b)) - Number(isStale(a)) ||
    (PRIO[a.priority ?? 'P3'] ?? 3) - (PRIO[b.priority ?? 'P3'] ?? 3) ||
    Date.parse(a.createdAt) - Date.parse(b.createdAt);
  const visible = all.filter(matches).sort(order);

  const stages: { stage: Stage; icon: LucideIcon; title: string; empty: string }[] = [
    { stage: 'requested', icon: Inbox, title: t.stages.requested, empty: t.stages.emptyRequested },
    { stage: 'in_progress', icon: CirclePlay, title: t.stages.in_progress, empty: t.stages.emptyProgress },
    { stage: 'delivered', icon: Signpost, title: t.stages.delivered, empty: t.stages.emptyDelivered },
    ...(showVerified
      ? [
          {
            stage: 'verified' as const,
            icon: CircleCheck,
            title: t.stages.verified,
            empty: t.stages.emptyVerified,
          },
        ]
      : []),
  ];
  const inStage = (stage: Stage) => visible.filter((c) => c.status === stage);
  const cancelled = showVerified ? visible.filter((c) => c.status === 'cancelled') : [];
  const shown = stages.flatMap(({ stage }) => inStage(stage)).concat(cancelled);

  // Lanes for the roles that hold a need here, in the contract's order with mine first: a role this page did not list never drops a need (flow-06).
  const present = new Set(shown.map((c) => c.need.responsibleRole));
  const roleLanes = ROLES.filter((role) => present.has(role))
    .map((role) => [role, shown.filter((c) => c.need.responsibleRole === role)] as const)
    .sort(([a], [b]) => Number(roles.includes(b)) - Number(roles.includes(a)));
  const anyFilter = !!responsible || !!kind || mine;

  const ids =
    lane === 'status' ? shown.map((c) => c.key) : roleLanes.flatMap(([, rows]) => rows).map((c) => c.key);
  const list = useKeyboardList({ ids, emptyFocusRef: heading });

  // The one filled button: the first thing I can do, in reading order.
  // Verifying my own delivery is allowed, and never the page's filled button (owner decision 2026-11-04).
  const canAct = (c: NeedCard) =>
    actionsFor(c, roles, me.id).some(
      (a) => (a.action === 'deliver' || a.action === 'verify') && a.enabled && !a.selfVerify,
    );
  const leadKey = shown.find((c) => isMine(c) && canAct(c))?.key;

  const openCount = all.filter((c) => c.status === 'requested' || c.status === 'in_progress').length;
  const deliveredCount = all.filter((c) => c.status === 'delivered').length;
  const mineCount = all.filter(isMine).length;
  const verifiedCount = all.filter((c) => c.status === 'verified' || c.status === 'cancelled').length;
  const summary =
    `${plural(openCount, locale, t.summary.open)}${plural(deliveredCount, locale, t.summary.delivered)} ${plural(mineCount, locale, t.summary.mine)}`.trim();

  const newButton = (primary = false) => (
    <Button variant={primary ? 'primary' : 'outline'} onClick={() => setCreating(true)}>
      <Plus aria-hidden className="size-4" strokeWidth={1.75} />
      {t.new.button}
    </Button>
  );

  if (query.isError) {
    const { error } = query;
    return (
      <PageContainer>
        <PageHeader title={t.title} />
        <ErrorState
          thing={t.errorThing}
          code={isHubError(error) ? error.code : undefined}
          requestId={isHubError(error) ? error.requestId : undefined}
          onRetry={() => void query.refetch()}
        />
      </PageContainer>
    );
  }

  if (query.isPending) {
    return (
      <PageContainer>
        <PageHeader title={t.title} meta={<Skeleton className="mt-1.5 h-4 w-64 max-w-full" />} />
        <LoadingRegion label={t.loading}>
          <Skeleton className="h-5 w-full max-w-xl" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <BoardSkeleton />
        </LoadingRegion>
      </PageContainer>
    );
  }

  const row = (card: NeedCard, showStatus = false) => (
    <motion.li key={card.key} layout="position" transition={{ duration: 0.24, ease }} className="min-w-0">
      <NeedRow
        card={card}
        rowProps={list.rowProps}
        showStatus={showStatus}
        primary={card.key === leadKey}
        stale={isStale(card)}
        mine={isMine(card)}
      />
    </motion.li>
  );

  return (
    <PageContainer>
      <PageHeader
        title={t.title}
        meta={all.length ? summary : undefined}
        actions={all.length ? newButton() : undefined}
      />
      <AddressRule />

      {all.length === 0 ? (
        <EmptyState size="page" icon={KeyRound} title={t.empty.title} action={newButton(true)}>
          {t.empty.body}
        </EmptyState>
      ) : (
        <>
          <FilterBar
            status={{
              label: t.filters.lanes,
              value: lane,
              onChange: (next) => setQuery({ lane: next === 'status' ? null : next }),
              options: [
                { value: 'status', label: t.filters.byStatus },
                { value: 'role', label: t.filters.byRole },
              ],
            }}
            mine={{ page: 'needs' }}
            groups={[
              {
                param: 'responsible',
                label: t.filters.responsible,
                options: ROLES.map((r) => ({ value: r, label: kit.roles[r] })),
              },
              {
                param: 'verified',
                label: t.filters.verifiedGroup,
                multi: true,
                options: [
                  { value: '1', label: fmt(t.filters.showVerifiedCount, { n: num(verifiedCount, locale) }) },
                ],
              },
            ]}
            selects={[
              {
                param: 'kind',
                label: t.filters.kind,
                any: t.filters.allKinds,
                options: Object.entries(kit.sheet.need.kinds).map(([k, label]) => ({ value: k, label })),
              },
            ]}
          />

          {shown.length === 0 && !anyFilter && !showVerified ? (
            // Nothing open and no filter: the work is done, not a search that missed.
            <EmptyState
              icon={CircleCheck}
              title={t.empty.allDoneTitle}
              action={
                verifiedCount > 0 ? (
                  <Button size="sm" onClick={() => setQuery({ verified: '1' })}>
                    {fmt(t.filters.showVerifiedCount, { n: num(verifiedCount, locale) })}
                  </Button>
                ) : undefined
              }
            >
              {t.empty.allDoneBody}
            </EmptyState>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title={t.empty.filteredTitle}
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    rememberMine('needs', me.id, false);
                    setQuery({ responsible: null, kind: null, awaiting: null });
                  }}
                >
                  {t.empty.clear}
                </Button>
              }
            />
          ) : lane === 'status' ? (
            <div className="grid gap-8 lg:@page-lg:grid-cols-3 lg:gap-x-3">
              {stages.map(({ stage, icon, title, empty }, i) => {
                const rows = inStage(stage);
                return (
                  <section
                    key={stage}
                    aria-labelledby={`stage-${stage}`}
                    className={cn(
                      'flex min-w-0 flex-col gap-3',
                      stage === 'verified' && 'lg:@page-lg:col-span-3',
                    )}
                  >
                    <StageHead
                      id={`stage-${stage}`}
                      icon={icon}
                      title={title}
                      count={rows.length}
                      last={i >= 2}
                      headingRef={i === 0 ? heading : undefined}
                    />
                    {rows.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-body-sm text-muted-foreground">
                        {empty}
                      </p>
                    ) : (
                      <ul
                        data-hub-list
                        className={cn(
                          'flex flex-col gap-2',
                          stage === 'verified' && 'lg:@page-lg:grid lg:@page-lg:grid-cols-3 lg:gap-x-3',
                        )}
                      >
                        {rows.map((card) => row(card))}
                        {stage === 'verified' && cancelled.map((card) => row(card, true))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {roleLanes.map(([role, rows], i) => {
                const Icon = roleIcon[role];
                return (
                  <section
                    key={role}
                    aria-labelledby={`lane-${role}`}
                    className="flex min-w-0 flex-col gap-3"
                  >
                    <h2
                      ref={i === 0 ? heading : undefined}
                      id={`lane-${role}`}
                      tabIndex={-1}
                      className="flex items-center gap-2 text-title-sm font-semibold text-foreground outline-none"
                    >
                      <Icon aria-hidden className="size-4.5 text-muted-foreground" strokeWidth={1.75} />
                      {kit.roles[role]}
                      <span className="rounded-full bg-muted px-2 text-caption font-medium text-muted-foreground tabular-nums">
                        <Ltr>{num(rows.length, locale)}</Ltr>
                      </span>
                    </h2>
                    <ul data-hub-list className="grid gap-2 md:@page-md:grid-cols-2">
                      {rows.map((card) => row(card, true))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
      <NewNeedDialog open={creating} onOpenChange={setCreating} />
    </PageContainer>
  );
}
