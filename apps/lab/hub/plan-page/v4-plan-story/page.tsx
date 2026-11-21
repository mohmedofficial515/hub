import { useCallback, useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { FileText, ListOrdered, Map as MapIcon, Users } from 'lucide-react';
import { Direction, Tabs, Tooltip as RadixTooltip } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { plan472, plan472Midway, planPlain, type PlanPageCard } from '@lab/mocks/hub-plan-page';
import '../../today/v5-peacock-app/tokens.css';
import './story.css';
import { Button, ErrorState, fmt, focusRingInset, showToast, LoadingRegion, Ltr, num, PageContainer, Skeleton, SkeletonRows, tabTriggerClass } from '../../today/v5-peacock-app/kit';
import { ToastRegion } from '../../today/v5-peacock-app/kit/toast';
import { messages } from './i18n';
import { BackBar, PlanHeader } from './parts/header';
import { RolesChart } from './parts/charts';
import { JourneyMap } from './parts/journey-map';
import { phaseGroups, relatedPlans } from './parts/model';
import { PhaseFocus } from './parts/phase-focus';
import { PhaseGroup } from './parts/phase-group';
import { PlanText } from './parts/plan-text';
import { DecisionsBox, IdeasBox, Panel, PlansBox, SourcesBox } from './parts/side';


type Scenario = 'default' | 'frontend' | 'midway' | 'many' | 'empty' | 'loading' | 'error';

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
 * Demo only, not data: the midway plan with every phase cut into parts of at most three steps, so the rail carries 20 phases
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

const plan472Many = manyPhases(plan472Midway);

const cardFor = (s: Scenario): PlanPageCard =>
  s === 'midway' ? plan472Midway : s === 'many' ? plan472Many : s === 'empty' ? planPlain : plan472;

/** Lab entry. A plan's own page told as a story: where it stands, the journey, the current chapter, then the detail. See README.md. */
export default function Page() {
  const locale = useLocale();
  const scenario = useScenario();
  return (
    <MotionConfig reducedMotion="user">
      <Direction.Provider dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <RadixTooltip.Provider delayDuration={200} skipDelayDuration={100}>
          <div id="hub-root" className="peacock-app min-h-dvh bg-background text-foreground">
            <main id="main" tabIndex={-1} className="min-w-0 outline-none">
              {scenario === 'loading' ? <Loading /> : scenario === 'error' ? <Failed /> : <PlanPage key={scenario} card={cardFor(scenario)} />}
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

function PlanPage({ card }: { card: PlanPageCard }) {
  const t = useT(messages);
  const locale = useLocale();
  const groups = useMemo(() => phaseGroups(card), [card]);
  const phased = card.phases.length > 0;
  const nextId = groups.flatMap((g) => g.steps).find((s) => !s.done)?.id ?? null;
  const hereIndex = Math.max(
    0,
    groups.findIndex((g) => g.hasNext),
  );
  const [selected, setSelected] = useState(hereIndex);
  const [hover, setHover] = useState<number | null>(null);
  const [open, setOpen] = useState<Set<number>>(() => new Set(phased ? [] : groups.map((g) => g.index)));
  const allOpen = open.size === groups.length;
  const [tab, setTab] = useState('plan');
  const last = groups.length - 1;

  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  /** Pick a phase from the ring, the map or the next-step callout; the callout also brings the chapter into view. */
  const select = useCallback((index: number, scroll = false) => {
    setSelected(index);
    if (!scroll) return;
    requestAnimationFrame(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('ps-chapter')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      document.getElementById('ps-focus-title')?.focus({ preventScroll: true });
    });
  }, []);

  const toText = () => {
    setTab('plan');
    requestAnimationFrame(() => document.getElementById('plan-text')?.scrollIntoView({ block: 'start' }));
  };

  const plans = relatedPlans(card.links);
  const focus = groups[selected];
  const tabs = [
    ['plan', t.tabs.plan, null],
    ['comments', t.tabs.comments, card.commentCount],
    ['history', t.tabs.history, null],
    ['links', t.tabs.links, card.links.length],
  ] as const;

  return (
    <PageContainer className="max-w-300 gap-4 md:gap-5">
      <BackBar cardKey={card.key} />
      <PlanHeader card={card} groups={groups} selected={selected} hover={hover} onGo={select} onHover={setHover} />

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
          <JourneyMap groups={groups} selected={selected} hover={hover} onSelect={select} onHover={setHover} />
          <div id="ps-chapter" className="scroll-mt-4 border-t border-border pt-5">
            <PhaseFocus group={focus} last={last} nextId={nextId} onStep={(d) => setSelected((s) => Math.min(last, Math.max(0, s + d)))} />
          </div>
        </section>
      )}

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
                  <RolesChart groups={groups} hover={hover} onHover={setHover} />
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
    </PageContainer>
  );
}
