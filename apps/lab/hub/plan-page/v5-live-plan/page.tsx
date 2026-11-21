import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { Activity, CalendarClock, FileText, Gauge, ListOrdered, Map as MapIcon, Users } from 'lucide-react';
import { Direction, Tabs, Tooltip as RadixTooltip } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { plan472, plan472Midway, planPlain, type PlanPageCard } from '@lab/mocks/hub-plan-page';
import '../../today/v5-peacock-app/tokens.css';
import './story.css';
import './live.css';
import { Button, ErrorState, fmt, focusRing, focusRingInset, longDate, LoadingRegion, Ltr, num, PageContainer, showToast, Skeleton, SkeletonRows, tabTriggerClass, Tooltip } from '../../today/v5-peacock-app/kit';
import { ToastRegion } from '../../today/v5-peacock-app/kit/toast';
import { messages } from './i18n';
import { RolesChart } from './parts/charts';
import { withDemo } from './parts/demo';
import { BackBar, PlanHeader } from './parts/header';
import { JourneyMap } from './parts/journey-map';
import { useLiveSim, type LiveState } from './parts/live';
import { ActivityFeed, AnimatedNumber, Celebration, ClaudeNow, LiveBadge, SimBar, useLiveWords } from './parts/live-ui';
import { effortOf, finishEstimate, phaseGroups, relatedPlans } from './parts/model';
import { PhaseFocus } from './parts/phase-focus';
import { PhaseGroup } from './parts/phase-group';
import { PlanText } from './parts/plan-text';
import { PlanVideo } from './parts/plan-video';
import { DecisionsBox, IdeasBox, Panel, PlansBox, SourcesBox } from './parts/side';
import { StepDrawer } from './parts/step-drawer';

/** `live` plays Claude's run on the next step; `legacy` (alias `empty`) is a plan saved before phases existed. */
type Scenario = 'default' | 'midway' | 'live' | 'many' | 'empty' | 'legacy' | 'loading' | 'error';

const readScenario = (): Scenario => (new URLSearchParams(location.hash.split('?')[1] ?? '').get('scenario') as Scenario | null) ?? 'default';

function useScenario() {
  const [scenario, setScenario] = useState(readScenario);
  useEffect(() => {
    const on = () => setScenario(readScenario());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return scenario;
}

/**
 * Demo only, not data: the midway plan with every phase cut into parts of at most three steps, so the map carries 20 phases
 * (the most `plan.phases` is meant to hold). Titles keep the phase name and add the part.
 */
function manyPhases(card: PlanPageCard): PlanPageCard {
  const phases: PlanPageCard['phases'] = [];
  const phaseOf = new Map<string, string>();
  for (const p of card.phases) {
    const steps = card.steps.filter((s) => s.phaseId === p.id);
    const parts = Math.max(1, Math.ceil(steps.length / 3));
    for (let k = 0; k < parts; k++) {
      const id = `${p.id}-${k + 1}`;
      phases.push({ ...p, id, title: parts > 1 ? `${p.title} · جزء ${k + 1}` : p.title });
      for (const s of steps.slice(k * 3, k * 3 + 3)) phaseOf.set(s.id, id);
    }
  }
  return { ...card, phases, steps: card.steps.map((s) => ({ ...s, phaseId: phaseOf.get(s.id) ?? s.phaseId })) };
}

const cardFor = (s: Scenario): PlanPageCard =>
  s === 'midway' || s === 'live' ? plan472Midway : s === 'many' ? manyPhases(plan472Midway) : s === 'empty' || s === 'legacy' ? planPlain : plan472;

/** The card as the page shows it: the run's finished steps and its evidence applied. */
function applyLive(card: PlanPageCard, live: LiveState): PlanPageCard {
  if (!live.doneIds.length && !Object.keys(live.evidence).length) return card;
  const now = new Date().toISOString();
  return {
    ...card,
    steps: card.steps.map((s) => {
      const extra = live.evidence[s.id];
      const done = live.doneIds.includes(s.id);
      if (!extra && !done) return s;
      return { ...s, ...(done ? { done: true, doneAt: now } : {}), ...(extra ? { evidence: [...((s as { evidence?: [] }).evidence ?? []), ...extra] } : {}) };
    }),
  };
}

/** Lab entry. A plan's own page told as a story, live with Claude: where it stands, the journey, the chapter, the video, the detail. */
export default function Page() {
  const locale = useLocale();
  const scenario = useScenario();
  return (
    <MotionConfig reducedMotion="user">
      <Direction.Provider dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <RadixTooltip.Provider delayDuration={200} skipDelayDuration={100}>
          <div id="hub-root" className="peacock-app min-h-dvh bg-background text-foreground">
            <main id="main" tabIndex={-1} className="min-w-0 outline-none">
              {scenario === 'loading' ? <Loading /> : scenario === 'error' ? <Failed /> : <PlanPage key={scenario} scenario={scenario} />}
            </main>
            <ToastRegion />
          </div>
        </RadixTooltip.Provider>
      </Direction.Provider>
    </MotionConfig>
  );
}

function Loading() {
  const t = useT(messages);
  return (
    <PageContainer className="max-w-300 gap-5 md:gap-6">
      <Skeleton className="h-9 w-40" />
      <LoadingRegion label={t.loading}>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <SkeletonRows count={6} withAction={false} />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        </div>
      </LoadingRegion>
    </PageContainer>
  );
}

function Failed() {
  const t = useT(messages);
  return (
    <PageContainer className="max-w-300">
      <BackBar cardKey="GTV-472" />
      <ErrorState thing={t.errorThing} code="hub.cards.load_failed" onRetry={() => location.reload()} />
    </PageContainer>
  );
}

/** Shapes, not colours, carry the state: the hue only tells phases apart. */
function Legend() {
  const t = useT(messages);
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="ps-swatch bg-foreground" style={{ borderRadius: 9999 }} />
        {t.legendDone}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="ps-swatch border-2 border-foreground" style={{ borderRadius: 9999 }} />
        {t.legendNow}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="ps-swatch ps-swatch-line" style={{ borderRadius: 9999 }} />
        {t.legendTodo}
      </li>
    </ul>
  );
}

function PlanPage({ scenario }: { scenario: Scenario }) {
  const t = useT(messages);
  const locale = useLocale();
  const base = useMemo(() => withDemo(cardFor(scenario)), [scenario]);
  const isLive = scenario === 'live';

  const words = useLiveWords();
  const groupsOf = useCallback((s: LiveState) => phaseGroups(applyLive(base, s)), [base]);
  const { state: live, controls, groups } = useLiveSim({ enabled: isLive, groupsOf, words });
  const [celebration, setCelebration] = useState<LiveState['celebrate']>(null);

  // Start the recorded run shortly after the page opens, so the live layer is seen without a click.
  useEffect(() => {
    if (!isLive) return;
    const id = window.setTimeout(controls.play, 1200);
    return () => window.clearTimeout(id);
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);
  useEffect(() => setCelebration(live.celebrate), [live.celebrate]);

  const card = useMemo(() => applyLive(base, live), [base, live]);
  const all = useMemo(() => groups.flatMap((g) => g.steps), [groups]);
  const phased = card.phases.length > 0;
  const nextId = all.find((s) => !s.done)?.id ?? null;
  const hereIndex = Math.max(
    0,
    groups.findIndex((g) => g.hasNext),
  );
  const run = live.run;
  const runStep = run ? (all.find((s) => s.id === run.stepId) ?? null) : null;
  const activePhase = runStep ? (groups.find((g) => g.steps.some((s) => s.id === runStep.id))?.index ?? null) : null;

  const [selected, setSelected] = useState(hereIndex);
  const [dir, setDir] = useState<1 | -1>(1);
  const [hover, setHover] = useState<number | null>(null);
  const [videoSpot, setVideoSpot] = useState<number | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<number>>(() => new Set(phased ? [] : groups.map((g) => g.index)));
  const allOpen = open.size === groups.length;
  const [tab, setTab] = useState('plan');
  const last = groups.length - 1;

  // When Claude starts on a step in another phase, the chapter follows it.
  const followed = useRef<string | null>(null);
  useEffect(() => {
    if (!run || followed.current === run.stepId || activePhase === null) return;
    followed.current = run.stepId;
    setDir(activePhase >= selected ? 1 : -1);
    setSelected(activePhase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.stepId, activePhase]);

  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  /** Pick a phase from the ring, the map or the next-step callout; the callout also brings the chapter into view. */
  const select = useCallback(
    (index: number, scroll = false) => {
      setDir(index >= selected ? 1 : -1);
      setSelected(index);
      if (!scroll) return;
      requestAnimationFrame(() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.getElementById('ps-chapter')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        document.getElementById('ps-focus-title')?.focus({ preventScroll: true });
      });
    },
    [selected],
  );

  const toText = () => {
    setTab('plan');
    requestAnimationFrame(() => document.getElementById('plan-text')?.scrollIntoView({ block: 'start' }));
  };

  const plans = relatedPlans(card.links);
  const focus = groups[selected];
  const effort = effortOf(all);
  const estimate = finishEstimate(all, new Date());
  const spot = hover ?? videoSpot;
  const tabs = [
    ['plan', t.tabs.plan, null],
    ['comments', t.tabs.comments, card.commentCount],
    ['history', t.tabs.history, null],
    ['links', t.tabs.links, card.links.length],
  ] as const;

  const stats = phased && (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
      <Tooltip content={t.effortHint}>
        <span tabIndex={0} className={cn('inline-flex items-center gap-1.5 rounded-sm', focusRing)}>
          <Gauge aria-hidden className="size-4" strokeWidth={1.75} />
          {fmt(t.effortLabel, { done: num(effort.done, locale), total: num(effort.total, locale) })}
        </span>
      </Tooltip>
      <Tooltip content={estimate ? fmt(t.etaHint, { pace: num(Math.round(estimate.pace * 10) / 10, locale), left: num(estimate.left, locale) }) : t.noEta}>
        <span tabIndex={0} className={cn('inline-flex items-center gap-1.5 rounded-sm', focusRing)}>
          <CalendarClock aria-hidden className="size-4" strokeWidth={1.75} />
          {estimate ? fmt(t.eta, { date: longDate(estimate.date.toISOString(), locale) }) : t.noEta}
        </span>
      </Tooltip>
    </p>
  );

  return (
    <PageContainer className={cn('max-w-300 gap-4 md:gap-5', isLive && 'ps-page-bottom')}>
      <BackBar cardKey={card.key} />
      <PlanHeader
        card={card}
        groups={groups}
        selected={selected}
        hover={spot}
        onGo={select}
        onHover={setHover}
        badge={isLive && <LiveBadge connection={live.connection} />}
        stats={stats}
        doneCount={<AnimatedNumber value={all.filter((s) => s.done).length} />}
        live={run && <ClaudeNow run={run} step={runStep} clock={live.clock} onApprove={controls.approve} onDeny={controls.deny} onOpen={() => runStep && setOpenId(runStep.id)} />}
      />

      {phased && focus && (
        <section id="ps-journey" aria-labelledby="ps-journey-title" className="flex min-w-0 scroll-mt-4 flex-col gap-5 rounded-2xl border border-border bg-card p-4 md:p-6">
          <header className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 id="ps-journey-title" className="flex items-center gap-2 text-title-sm font-semibold text-foreground">
                <MapIcon aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
                {t.journey}
              </h2>
              <p className="text-body-sm text-muted-foreground">{t.journeyHint}</p>
            </div>
            <Legend />
          </header>
          <JourneyMap groups={groups} selected={selected} hover={spot} active={activePhase} onSelect={select} onHover={setHover} />
          <div id="ps-chapter" className="min-w-0 scroll-mt-4 overflow-hidden border-t border-border pt-5">
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div
                key={selected}
                custom={dir}
                initial={{ opacity: 0, x: (locale === 'ar' ? -1 : 1) * dir * 48 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: (locale === 'ar' ? 1 : -1) * dir * 48 }}
                transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
              >
                <PhaseFocus
                  group={focus}
                  all={all}
                  last={last}
                  nextId={nextId}
                  run={run}
                  justDone={live.justDone?.id ?? null}
                  onStep={(d) => select(Math.min(last, Math.max(0, selected + d)))}
                  onOpen={setOpenId}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      )}

      {phased && <PlanVideo groups={groups} revision={card.revision} initial={scenario === 'many' ? 'none' : 'ready'} onSpot={setVideoSpot} />}

      <Tabs.Root value={tab} onValueChange={setTab} dir={locale === 'ar' ? 'rtl' : 'ltr'} className="flex min-w-0 flex-col gap-5">
        <Tabs.List aria-label={card.key} className="flex shrink-0 gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]">
          {tabs.map(([value, label, count]) => (
            <Tabs.Trigger key={value} value={value} className={tabTriggerClass}>
              {label}
              {count ? <Ltr className="rounded-full bg-muted px-1.5 text-caption tabular-nums">{num(count, locale)}</Ltr> : null}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="plan" className={cn('min-w-0 outline-none', focusRingInset)}>
          <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8">
            <div className="flex min-w-0 flex-col gap-6">
              {phased && (
                <Panel id="ps-roles" icon={Users} iconClass="text-muted-foreground" title={t.rolesTitle}>
                  <RolesChart groups={groups} hover={spot} onHover={setHover} />
                </Panel>
              )}

              <section aria-labelledby="plan-steps" className="flex min-w-0 flex-col gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <ListOrdered aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <h2 id="plan-steps" className="min-w-0 flex-1 text-title-sm font-semibold text-foreground">
                    {phased ? t.allPhases : t.stepsTitle}
                  </h2>
                  {groups.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.index)))}>
                      {allOpen ? t.collapseAll : t.expandAll}
                    </Button>
                  )}
                </div>
                {!phased && card.steps.length > 0 && <p className="text-body-sm text-muted-foreground">{t.unphasedHint}</p>}
                {card.steps.length === 0 ? (
                  <p className="rounded-xl border border-border bg-card p-4 text-body-sm text-muted-foreground">{t.noSteps}</p>
                ) : (
                  <div className="flex min-w-0 flex-col gap-2">
                    {groups.map((g) => (
                      <PhaseGroup key={g.index} group={g} open={open.has(g.index)} onToggle={() => toggle(g.index)} nextId={nextId} onlyGroup={!phased} />
                    ))}
                  </div>
                )}
              </section>

              {card.body && (
                <Panel id="plan-text" icon={FileText} iconClass="text-muted-foreground" title={t.textTitle} className="scroll-mt-4" aside={<Button size="sm" variant="ghost" onClick={() => showToast({ message: fmt(t.labOnly, { action: t.edit }) })}>{t.edit}</Button>}>
                  <PlanText body={card.body} attachments={card.attachments} />
                </Panel>
              )}
            </div>

            <aside className="flex min-w-0 flex-col gap-4">
              {(isLive || live.feed.length > 0) && (
                <Panel id="ps-feed" icon={Activity} iconClass="text-primary" title={t.feedTitle} aside={<LiveBadge connection={live.connection} />}>
                  <ActivityFeed feed={live.feed} clock={live.clock} />
                </Panel>
              )}
              <DecisionsBox decisions={card.decisions} />
              <IdeasBox links={card.links} />
              <PlansBox links={plans} />
              <SourcesBox sources={card.sources} attachments={card.attachments} onShots={toText} />
            </aside>
          </div>
        </Tabs.Content>

        {(['comments', 'history', 'links'] as const).map((value) => (
          <Tabs.Content key={value} value={value} className={cn('outline-none', focusRingInset)}>
            <p className="rounded-xl border border-border bg-card p-4 text-body-sm text-muted-foreground">{t.tabUnchanged}</p>
          </Tabs.Content>
        ))}
      </Tabs.Root>

      <StepDrawer step={openId ? (all.find((s) => s.id === openId) ?? null) : null} groups={groups} nextId={nextId} run={run} onOpenStep={setOpenId} onClose={() => setOpenId(null)} />
      <Celebration event={celebration} title={celebration ? (groups[celebration.phase]?.phase?.title ?? '') : ''} onDone={() => setCelebration(null)} />
      {isLive && <SimBar state={live} controls={controls} />}
    </PageContainer>
  );
}
