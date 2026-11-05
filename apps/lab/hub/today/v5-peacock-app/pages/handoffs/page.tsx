import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import type { Role } from '@lab/mocks/hub-app';
import {
  Button,
  EmptyState,
  ErrorState,
  FilterBar,
  fmt,
  kitMessages,
  LoadingRegion,
  MineMark,
  openCard,
  PageContainer,
  PageHeader,
  plural,
  rememberMine,
  roleIcon,
  SectionHeader,
  setQuery,
  Skeleton,
  SkeletonRows,
  useAwaiting,
  useCards,
  useFilter,
  useKeyboardList,
  useMedia,
  useSession,
  actionsFor,
  type HandoffCard,
} from '../../kit';
import { handoffAgeMs, isHandoffStale } from '../../kit/sheet-sections/handoff';
import { messages } from './i18n';
import { HandoffRow } from './parts/handoff-row';
import { NewHandoffDialog } from './parts/new-handoff';
import { Relay, type RelayStage } from './parts/relay';

const ease = [0.2, 0.8, 0.2, 1] as const;
const TO_ROLES: Role[] = ['frontend', 'backend', 'designer', 'qa', 'pm'];
const SEVERITY = { breaking: 0, notable: 1, info: 2 } as const;

export default function Page() {
  const { scenario } = useSession();
  return <Handoffs key={scenario} />;
}

function Handoffs() {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { scenario, roles, me, loading, error } = useSession();
  const [creating, setCreating] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const wide = useMedia('(min-width: 768px)');

  const statusParam = useFilter('status');
  const to = useFilter('to');
  const severity = useFilter('severity');
  const kind = useFilter('kind');
  const mine = useFilter('awaiting') === 'me';

  const stored = useCards().filter((c): c is HandoffCard => c.type === 'handoff');
  const all = scenario === 'empty' ? stored.filter((c) => c.events[0]?.id.startsWith('new-')) : stored;
  const moving = (c: HandoffCard) => c.status === 'pending' || c.status === 'acknowledged';
  // Mine: routed to one of my roles, or an overdue one that sits in my stack (owner decision 2026-11-04, see NOTES.md).
  const stack = useAwaiting().filter((c) => c.type === 'handoff');
  const isMine = (c: HandoffCard) => roles.includes(c.handoff.toRole) || stack.some((s) => s.key === c.key);
  const matches = (c: HandoffCard) => (!to || c.handoff.toRole === to) && (!severity || c.handoff.severity === severity) && (!kind || c.handoff.kind === kind) && (!mine || isMine(c));
  const filtered = all.filter(matches);

  const stage = statusParam === 'pending' || statusParam === 'acknowledged' || statusParam === 'applied' ? statusParam : null;
  const showAll = statusParam === 'all';
  const inView = (c: HandoffCard) => (showAll ? true : stage ? c.status === stage : moving(c));

  // 09 §9 and 04 §3.13: stale first, then breaking first, then the oldest. Closed ones follow, newest first.
  const order = (a: HandoffCard, b: HandoffCard) =>
    Number(moving(b)) - Number(moving(a)) ||
    Number(isHandoffStale(b)) - Number(isHandoffStale(a)) ||
    SEVERITY[a.handoff.severity] - SEVERITY[b.handoff.severity] ||
    (moving(a) ? handoffAgeMs(b) - handoffAgeMs(a) : Date.parse(b.lastEventAt) - Date.parse(a.lastEventAt));
  const shown = filtered.filter(inView).sort(order);

  // Desks: who receives. Mine come first (P3), then the desk with the most urgent handoff.
  const deskRoles = [...new Set(shown.map((c) => c.handoff.toRole))].sort((a, b) => Number(roles.includes(b)) - Number(roles.includes(a)));
  const desks = deskRoles.map((role) => [role, shown.filter((c) => c.handoff.toRole === role)] as const);
  const ordered = desks.flatMap(([, rows]) => rows);

  const canAct = (c: HandoffCard) => actionsFor(c, roles, me.id).some((a) => (a.action === 'acknowledge' || a.action === 'apply') && a.enabled);
  const lead = ordered.find((c) => moving(c) && canAct(c) && roles.includes(c.handoff.toRole)) ?? ordered.find((c) => moving(c) && canAct(c));

  const list = useKeyboardList({
    ids: ordered.map((c) => c.key),
    emptyFocusRef: heading,
    actions: {
      a: (id) => {
        const card = ordered.find((c) => c.key === id);
        if (card?.status === 'pending' && canAct(card)) openCard(id, { action: 'acknowledge' });
      },
    },
  });

  // The diff opens in place. The lead row starts open from tablet up, so the first thing to receive can be read right here.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !lead || !wide) return;
    seeded.current = true;
    setExpanded(new Set([lead.key]));
  }, [lead, wide]);
  const toggle = (key: string) =>
    setExpanded((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const pending = all.filter((c) => c.status === 'pending').length;
  const mineMoving = stack.length;
  const summary = pending === 0 && mineMoving === 0 ? plural(0, locale, t.summary.pending) : `${pending ? plural(pending, locale, t.summary.pending) : ''}${plural(mineMoving, locale, t.summary.mine)}`.replace(/^، |^, /, '');

  const newButton = (primary = false) => (
    <Button variant={primary ? 'primary' : 'outline'} onClick={() => setCreating(true)}>
      <Plus aria-hidden className="size-4" strokeWidth={1.75} />
      {t.new.button}
    </Button>
  );

  if (error) {
    return (
      <PageContainer>
        <PageHeader title={t.title} />
        <ErrorState thing={t.errorThing} code="hub.handoffs.unavailable" requestId="req_b73e155" onRetry={() => setQuery({ scenario: null })} />
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title={t.title} meta={<Skeleton className="mt-1.5 h-4 w-64 max-w-full" />} />
        <LoadingRegion label={t.loading}>
          <Skeleton className="h-24 w-full rounded-lg md:h-26" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <SkeletonRows count={4} />
        </LoadingRegion>
      </PageContainer>
    );
  }

  const anyFilter = !!to || !!severity || !!kind || mine;

  return (
    <PageContainer>
      <PageHeader title={t.title} meta={all.length ? summary : undefined} actions={all.length ? newButton() : undefined} />

      {all.length === 0 ? (
        <EmptyState size="page" icon={ArrowLeftRight} title={t.empty.title} action={newButton(true)}>
          {t.empty.body}
        </EmptyState>
      ) : (
        <>
          <Relay cards={filtered} stage={showAll ? 'all' : stage} onChange={(next) => setQuery({ status: next })} />
          <FilterBar
            mine={{ page: 'handoffs' }}
            groups={[
              { param: 'to', label: t.filters.to, options: TO_ROLES.map((r) => ({ value: r, label: kit.roles[r] })) },
              { param: 'severity', label: t.filters.severity, options: (['breaking', 'notable', 'info'] as const).map((sv) => ({ value: sv, label: kit.sheet.handoff.severities[sv] })) },
            ]}
            selects={[{ param: 'kind', label: t.filters.kind, any: t.filters.allKinds, options: Object.entries(kit.sheet.handoff.kinds).map(([k, label]) => ({ value: k, label })) }]}
          />

          {shown.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title={anyFilter ? t.empty.filteredTitle : t.empty.stageTitle}
              action={
                anyFilter ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      rememberMine('handoffs', me.id, false);
                      setQuery({ to: null, severity: null, kind: null, awaiting: null });
                    }}
                  >
                    {t.empty.clear}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            desks.map(([role, rows], i) => (
              <section key={role} aria-labelledby={`desk-${role}`} className="flex flex-col gap-2.5">
                <SectionHeader
                  ref={i === 0 ? heading : undefined}
                  id={`desk-${role}`}
                  icon={roleIcon[role]}
                  title={fmt(t.desk.to, { role: kit.roles[role] })}
                  count={rows.length}
                  aside={roles.includes(role) ? <MineMark /> : undefined}
                />
                <ul data-hub-list className="flex flex-col gap-2">
                  {rows.map((card) => (
                    <motion.li key={card.key} layout="position" transition={{ duration: 0.24, ease }}>
                      <HandoffRow card={card} rowProps={list.rowProps} primary={card.key === lead?.key} open={expanded.has(card.key)} onToggle={() => toggle(card.key)} />
                    </motion.li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
      <NewHandoffDialog open={creating} onOpenChange={setCreating} />
    </PageContainer>
  );
}
