import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, CircleCheck, Clock, Plus, Scale, TriangleAlert } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import type { Role } from '@lab/mocks/hub-app';
import {
  actedOn,
  actionsFor,
  AppLink,
  Button,
  cn,
  EmptyState,
  ErrorState,
  FilterBar,
  fmt,
  focusRing,
  kitMessages,
  LoadingRegion,
  openCard,
  PageContainer,
  PageHeader,
  plural,
  rememberMine,
  setQuery,
  shortDate,
  showToast,
  Skeleton,
  SkeletonRows,
  useCards,
  useFilter,
  useKeyboardList,
  useSession,
  type DecisionCard,
} from '../../kit';
import { messages } from './i18n';
import { BANDS, bandOf, byDeadline, byOutcome, closedAt, routedToMe, type Band } from './model';
import { BandHeading, DocketLine, OpenDocketLine, OpenRow, RecordedRow } from './parts/docket';
import { NewDecisionDialog } from './parts/new-decision';
import { OnTheTable } from './parts/on-the-table';

const ease = [0.2, 0.8, 0.2, 1] as const;
const FILTER_ROLES: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer'];
type Status = 'open' | 'decided' | 'all';

export default function Page() {
  const { scenario } = useSession();
  return <Decisions key={scenario} />;
}

function Decisions() {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { scenario, roles, me, loading, error } = useSession();
  const [creating, setCreating] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const status = (useFilter('status') as Status | null) ?? 'open';
  const decider = useFilter('decider');
  const kind = useFilter('kind');
  const mine = useFilter('awaiting') === 'me';

  const stored = useCards().filter((c): c is DecisionCard => c.type === 'decision');
  // The `empty` scenario is a workspace with nothing in it, apart from what the member makes in this session.
  const all = scenario === 'empty' ? stored.filter((c) => c.events[0]?.id.startsWith('new-')) : stored;
  const matches = (c: DecisionCard) => (!decider || c.decision.deciderRole === decider) && (!kind || c.decision.kind === kind) && (!mine || routedToMe(c, roles));

  const openAll = all.filter((c) => c.status === 'open');
  // The Mine rule: nothing is hidden by default. Mine are marked, and come first inside their band.
  const shownOpen = status === 'decided' ? [] : openAll.filter(matches).sort(byDeadline);
  const closedAll = all.filter((c) => c.status !== 'open');
  const shownClosed = status === 'open' ? [] : closedAll.filter(matches).sort(byOutcome);
  // A decision made just now stays out of this short list, so its row leaves the page and focus moves to the next question.
  const recent = status === 'open' ? closedAll.filter((c) => c.status === 'decided' && !actedOn(c.key)).sort(byOutcome).slice(0, 2) : [];

  const canDecide = (c: DecisionCard) => actionsFor(c, roles, me.id).some((a) => a.action === 'decide' && a.enabled);
  const groups = BANDS.map((band) => [band, shownOpen.filter((c) => bandOf(c) === band).sort((a, b) => Number(routedToMe(b, roles)) - Number(routedToMe(a, roles)))] as const).filter(([, rows]) => rows.length);
  const inOrder = groups.flatMap(([, rows]) => rows);
  const lead = inOrder.find((c) => routedToMe(c, roles) && canDecide(c)) ?? inOrder.find(canDecide);

  const ids = [...groups.flatMap(([, rows]) => rows), ...shownClosed, ...recent].map((c) => c.key);
  const list = useKeyboardList({
    ids,
    emptyFocusRef: heading,
    actions: {
      d: (id) => {
        const card = openAll.find((c) => c.key === id);
        if (!card) return;
        if (canDecide(card)) openCard(id, { action: 'decide' });
        // `d` answers on a row I cannot act on, as `c` does on a blocked task (review M19).
        else showToast({ tone: 'error', message: fmt(t.row.denied, { role: kit.roles[card.decision.deciderRole] }) });
      },
    },
  });

  const myOpen = openAll.filter((c) => routedToMe(c, roles));
  const myOverdue = myOpen.filter((c) => bandOf(c) === 'overdue').length;
  const openWord = plural(openAll.length, locale, t.summary.open);
  const summary = myOpen.length ? `${plural(myOpen.length, locale, t.summary.mine)}${myOverdue ? plural(myOverdue, locale, t.summary.overdue) : ''}. ${openWord}` : openAll.length ? `${openWord} ${t.summary.noneMine}` : openWord;

  const newButton = (primary = false) => (
    <Button variant={primary ? 'primary' : 'outline'} onClick={() => setCreating(true)}>
      <Plus aria-hidden className="size-4" strokeWidth={1.75} />
      {t.new.button}
    </Button>
  );

  const bandMeta: Record<Band, { tone: 'danger' | 'warning' | 'muted'; icon: typeof Clock; title: string }> = {
    overdue: { tone: 'danger', icon: TriangleAlert, title: t.bands.overdue },
    soon: { tone: 'warning', icon: Clock, title: t.bands.soon },
    later: { tone: 'muted', icon: CalendarClock, title: t.bands.later },
  };

  if (error) {
    return (
      <PageContainer>
        <PageHeader title={t.title} />
        <ErrorState thing={t.errorThing} code="hub.decisions.unavailable" requestId="req_4c91d07" onRetry={() => setQuery({ scenario: null })} />
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title={t.title} meta={<Skeleton className="mt-1.5 h-4 w-64 max-w-full" />} />
        <LoadingRegion label={t.loading}>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-72 w-full rounded-lg md:h-80" />
          </div>
          <SkeletonRows count={3} />
        </LoadingRegion>
      </PageContainer>
    );
  }

  const nothingAtAll = all.length === 0;
  const filtered = !!decider || !!kind || mine;
  const shownCount = shownOpen.length + shownClosed.length;

  return (
    <PageContainer>
      <PageHeader title={t.title} meta={nothingAtAll ? undefined : summary} actions={nothingAtAll ? undefined : newButton()} />

      {nothingAtAll ? (
        <EmptyState size="page" icon={Scale} title={t.empty.openTitle} action={newButton(true)}>
          {t.empty.openBody}
        </EmptyState>
      ) : (
        <>
          <FilterBar
            status={{
              label: t.status.label,
              value: status,
              onChange: (next) => setQuery({ status: next === 'open' ? null : next }),
              options: [
                { value: 'open', label: t.status.open, count: openAll.length },
                { value: 'decided', label: t.status.decided, count: closedAll.length },
                { value: 'all', label: t.status.all },
              ],
            }}
            mine={{ page: 'decisions' }}
            groups={[{ param: 'decider', label: t.decider, options: FILTER_ROLES.map((r) => ({ value: r, label: kit.roles[r] })) }]}
            selects={[{ param: 'kind', label: t.kind, any: t.allKinds, options: (Object.keys(t.kinds) as (keyof typeof t.kinds)[]).map((k) => ({ value: k, label: t.kinds[k] })) }]}
          />

          {shownCount === 0 && (
            <EmptyState
              icon={status === 'decided' ? CircleCheck : Scale}
              title={mine && openAll.length && status !== 'decided' ? t.empty.mineTitle : filtered ? t.empty.filteredTitle : status === 'decided' ? t.empty.decidedTitle : t.empty.openTitle}
              action={
                filtered ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      rememberMine('decisions', me.id, false);
                      setQuery({ decider: null, kind: null, awaiting: null });
                    }}
                  >
                    {t.empty.clear}
                  </Button>
                ) : undefined
              }
            >
              {mine && openAll.length && status !== 'decided' ? t.empty.mineBody : status === 'decided' ? t.empty.decidedBody : t.empty.openBody}
            </EmptyState>
          )}

          {groups.map(([band, rows], groupIndex) => {
            const meta = bandMeta[band];
            return (
              <section key={band} aria-labelledby={`band-${band}`} className="flex flex-col gap-2.5">
                <BandHeading id={`band-${band}`} tone={meta.tone} icon={meta.icon} title={meta.title} count={rows.length} headingRef={groupIndex === 0 ? heading : undefined} />
                <ul data-hub-list className="flex flex-col gap-2">
                  {rows.map((card, i) => (
                    <motion.li key={card.key} layout="position" transition={{ duration: 0.24, ease }}>
                      <OpenDocketLine card={card} last={i === rows.length - 1}>
                        {card.key === lead?.key ? <OnTheTable card={card} rowProps={list.rowProps} /> : <OpenRow card={card} rowProps={list.rowProps} />}
                      </OpenDocketLine>
                    </motion.li>
                  ))}
                </ul>
              </section>
            );
          })}

          {shownClosed.length > 0 && (
            <section aria-labelledby="band-recorded" className="flex flex-col gap-2.5">
              <BandHeading id="band-recorded" icon={CircleCheck} title={t.bands.recorded} count={shownClosed.length} headingRef={groups.length === 0 ? heading : undefined} />
              <ul data-hub-list className="flex flex-col gap-2">
                {shownClosed.map((card, i) => (
                  <li key={card.key}>
                    <DocketLine time={shortDate(closedAt(card), locale)} dot={card.status === 'decided' ? 'bg-success' : 'bg-border'} last={i === shownClosed.length - 1}>
                      <RecordedRow card={card} rowProps={list.rowProps} />
                    </DocketLine>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recent.length > 0 && (
            <section aria-labelledby="band-recent" className={cn('flex flex-col gap-2.5', shownCount > 0 && 'border-t border-border pt-6')}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 id="band-recent" className="text-body font-semibold text-foreground">
                  {t.bands.recent}
                </h2>
                <AppLink view="decisions" query={{ status: 'decided' }} className={cn('hit-44 ms-auto rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline', focusRing)}>
                  {t.seeAllDecided}
                </AppLink>
              </div>
              <ul data-hub-list className="flex flex-col gap-2">
                {recent.map((card, i) => (
                  <li key={card.key}>
                    <DocketLine time={shortDate(closedAt(card), locale)} dot="bg-success" last={i === recent.length - 1}>
                      <RecordedRow card={card} rowProps={list.rowProps} />
                    </DocketLine>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <NewDecisionDialog open={creating} onOpenChange={setCreating} />
    </PageContainer>
  );
}
