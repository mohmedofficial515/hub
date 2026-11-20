'use client';

/**
 * @file plan-page.tsx
 * @description A plan's own page on Planning (`?plan=KEY`), told as a journey: the approved lab version apps/lab/hub/plan-page/v5-live-plan (2026-11-19),
 * batch 1 of its port. From the top: the head (what it is, the ring of phases weighted by effort, the numbers, the next step in its phase's tone, the
 * buttons), the journey map with the chosen phase's chapter under it, then the tabs: the plan (who carries it, every phase with its steps, the text,
 * evidence, runs and revisions beside the outline and the facts), comments, history and links. Any step opens a drawer with why it exists, its
 * acceptance checks and what it waits for. A plan saved before phases shows the head and one plain list, with no ring and no map.
 * Batch 2 adds the live layer (plan-live.tsx): Claude's run on a step with its stages and the approval it waits on, the halo on its phase, the
 * activity feed and a phase's celebration. Batch 3 adds each step's evidence in its drawer (step-evidence.tsx) and its count on the step's row.
 * Batch 4 adds the plan on video, made by Hams on request (plan-video.tsx), whose chapters light their phases on the map. Why it looks this way:
 * the version's README.
 */
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Compass,
  FileText,
  Gauge,
  ListOrdered,
  Map as MapIcon,
  PenLine,
  Sparkles,
  Users,
} from 'lucide-react';
import { Tabs } from 'radix-ui';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ActionBar, CommentsTab, Evidence, HistoryTab, LinksTab } from '@/components/cards/card-sheet';
import { EditButton } from '@/components/cards/sheet-sections/edit-bits';
import { Revisions } from '@/components/cards/sheet-sections/plan';
import {
  ActorChip,
  Bidi,
  Button,
  type CardAction,
  CardChip,
  cn,
  fill,
  fmt,
  focusRing,
  focusRingInset,
  getCard,
  kitMessages,
  longDate,
  Ltr,
  MarkdownView,
  MineMark,
  num,
  PageContainer,
  type PlanCard,
  plural,
  PriorityBadge,
  RelativeTime,
  RoleBadge,
  setQuery,
  sheetSections,
  type SheetTab,
  tabTriggerClass,
  Tooltip,
  TypeBadge,
  useLocale,
  usePageTitleFocus,
  usePerformAction,
  useSession,
  useT,
} from '@/components/kit';
import { CardRuns } from '@/components/queue/run-entry';
import { engineBlocks, fillComposer, useMaybeWb } from '@/components/workbench/store';
import {
  effortOf,
  finishEstimate,
  type JourneyStep,
  journeySteps,
  type PhaseGroup,
  phaseGroups,
  toneOf,
} from '@/features/planning/journey';
import { guideOf, isMineHere, planFacts, progressOf } from '@/features/planning/model';
import { readPlanText, sectionCount } from '@/features/planning/plan-text';
import { linkedOfType } from '@/features/planning/queries';
import { nowMs } from '@/lib/format';

import { ChangeRequestNote } from './change-request';
import {
  LivePill,
  Panel,
  PathStrip,
  ProgressMeter,
  StagePill,
  type StepTask,
  useChangeGlow,
} from './detail-parts';
import { Aside, BackLink, ClaudeActions, MoreMenu } from './detail-shared';
import { JourneyMap } from './journey-map';
import { useClaudeOn } from './live';
import type { PlanningMessages } from './messages';
import { PhaseFocus } from './phase-focus';
import { PhaseList } from './phase-list';
import { PlanRing, RolesChart } from './plan-charts';
import {
  ActivityFeed,
  AnimatedNumber,
  Celebration,
  ClaudeNow,
  type Connection,
  LiveBadge,
  type LiveRun,
  usePlanLive,
} from './plan-live';
import { PlanVideo } from './plan-video';
import { StepDrawer } from './step-drawer';

/** Each step's task as the page knows it, without asking the API: the cache's card, or the summary on the plan's own link. */
function useStepTasks(card: PlanCard): Map<string, StepTask> {
  const map = new Map<string, StepTask>();
  for (const step of card.plan.steps) {
    if (!step.taskKey) continue;
    const known = getCard(step.taskKey) ?? card.links.find((l) => l.key === step.taskKey)?.card;
    if (known) map.set(step.taskKey, known);
  }
  return map;
}

/** A step that became done while the page is open, for a moment, so its check pops once. Steps done at first paint never pop. */
function useJustDone(steps: readonly JourneyStep[]) {
  const doneKey = steps
    .filter((s) => s.done)
    .map((s) => s.id)
    .join(' ');
  const before = useRef<Set<string> | null>(null);
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const now = new Set(doneKey ? doneKey.split(' ') : []);
    const was = before.current;
    before.current = now;
    if (!was) return;
    const fresh = [...now].find((x) => !was.has(x));
    if (!fresh) return;
    setId(fresh);
    const timer = window.setTimeout(() => setId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [doneKey]);
  return id;
}

/** Shapes, not colours, carry each state: the hue only tells phases apart. */
function Legend() {
  const j = useT<PlanningMessages>('planning').detail.journey;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="pj-swatch bg-foreground" />
        {j.legendDone}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="pj-swatch border-2 border-foreground" />
        {j.legendNow}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="pj-swatch pj-swatch-line" />
        {j.legendTodo}
      </li>
    </ul>
  );
}

/** Effort in points and, from three dated steps on, when the plan may finish. Each explains itself in a tooltip. */
function Stats({ steps }: { steps: readonly JourneyStep[] }) {
  const j = useT<PlanningMessages>('planning').detail.journey;
  const locale = useLocale();
  const effort = effortOf(steps);
  const estimate = finishEstimate(steps, new Date(nowMs()));
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
      <Tooltip content={j.effortHint}>
        <span tabIndex={0} className={cn('inline-flex items-center gap-1.5 rounded-sm', focusRing)}>
          <Gauge aria-hidden className="size-4" strokeWidth={1.75} />
          {fmt(j.effortLabel, { done: num(effort.done, locale), total: num(effort.total, locale) })}
        </span>
      </Tooltip>
      {estimate && (
        <Tooltip
          content={fmt(j.etaHint, {
            pace: num(Math.round(estimate.pace * 10) / 10, locale),
            left: num(estimate.left, locale),
          })}
        >
          <span tabIndex={0} className={cn('inline-flex items-center gap-1.5 rounded-sm', focusRing)}>
            <CalendarClock aria-hidden className="size-4" strokeWidth={1.75} />
            {fmt(j.eta, { date: longDate(estimate.date.toISOString(), locale) })}
          </span>
        </Tooltip>
      )}
    </p>
  );
}

/** The next step in the tone of its phase, with its task, and the way to its chapter. */
function NextStep({
  card,
  step,
  group,
  phased,
  onGo,
}: {
  card: PlanCard;
  step: JourneyStep;
  group: PhaseGroup | undefined;
  phased: boolean;
  onGo: (index: number, scroll?: boolean) => void;
}) {
  const j = useT<PlanningMessages>('planning').detail.journey;
  const locale = useLocale();
  const Forward = locale === 'ar' ? ArrowLeft : ArrowRight;
  return (
    <div
      data-pj-tone={group ? toneOf(group.index) : '0'}
      className="pj-tone-soft flex min-w-0 flex-col gap-2 rounded-xl p-3.5 md:p-4"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm">
        <span className="pj-tone-bg inline-flex h-5.5 items-center rounded-full px-2 text-caption font-semibold">
          {j.next}
        </span>
        <span className="pj-tone-fg font-medium">{fmt(j.nextStep, { n: num(step.n, locale) })}</span>
        {phased && group?.phase && (
          <span className="text-muted-foreground">
            {fill(j.nextIn, {
              phase: <bdi>{`${fmt(j.phase, { n: num(group.index, locale) })}: ${group.phase.title}`}</bdi>,
            })}
          </span>
        )}
      </p>
      <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <span dir="auto" className="text-body-lg font-semibold text-pretty text-foreground">
          <Bidi>{step.title}</Bidi>
        </span>
        {step.role && <RoleBadge role={step.role} />}
        {step.taskKey && (
          <CardChip
            k={step.taskKey}
            type="task"
            showStatus
            card={card.links.find((l) => l.key === step.taskKey)?.card}
          />
        )}
      </p>
      {phased && group && (
        <button
          type="button"
          onClick={() => onGo(group.index, true)}
          className={cn(
            'pj-tone-fg hit-44 inline-flex items-center gap-1 self-start rounded-sm text-body-sm font-semibold underline-offset-4 hover:underline',
            focusRing,
          )}
        >
          {j.openPhase}
          <Forward aria-hidden className="size-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

/**
 * The head, in the order the owner asks: what it is, where it stands (the ring of phases and the numbers), the next step in its phase's tone, then the
 * buttons. The first status action is the page's only filled button.
 */
function PlanHero({
  card,
  action,
  groups,
  steps,
  selected,
  hover,
  onGo,
  onHover,
  run,
  connection,
  onOpenStep,
}: {
  card: PlanCard;
  action: CardAction | null;
  groups: PhaseGroup[];
  steps: readonly JourneyStep[];
  selected: number;
  hover: number | null;
  onGo: (index: number, scroll?: boolean) => void;
  onHover: (index: number | null) => void;
  /** Claude's run on a step of this plan, when there is one: it takes the next step's place. */
  run: LiveRun | null;
  connection: Connection;
  onOpenStep: (id: string) => void;
}) {
  const t = useT<PlanningMessages>('planning');
  const d = t.detail;
  const j = d.journey;
  const kit = useT(kitMessages);
  const { me, roles } = useSession();
  const live = useClaudeOn(card.key);
  const glow = useChangeGlow(card.title);
  const locale = useLocale();
  const titleRef = useRef<HTMLHeadingElement>(null);
  usePageTitleFocus(titleRef);
  const phased = card.plan.phases.length > 0;
  const { done, total, withoutTask } = progressOf(card);
  const next = steps.find((s) => !s.done);
  const nextGroup = groups.find((g) => g.hasNext);
  const guide = guideOf(card, roles, me.id);
  const idea = linkedOfType(card, 'idea');
  const { revision } = planFacts(card);

  // The next step itself is the callout above; the guide adds what to do when that is not "work on the next step".
  const guideWords: ReactNode = (() => {
    switch (guide.kind) {
      case 'step':
        return null;
      case 'status':
        return (d.next.plan as Record<string, string | undefined>)[card.status] ?? null;
      case 'createTasks':
        return fmt(d.guide.createTasks, { n: num(guide.n, locale) });
      default:
        return d.guide[guide.kind];
    }
  })();

  // A page reached by the owner takes focus on its title, so a screen reader starts here. A typing owner, or Follow the chat, keeps theirs.
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    if (active?.closest('[data-wb-panel], [data-wb-input], [role="dialog"]')) return;
    titleRef.current?.focus({ preventScroll: true });
  }, [card.key]);

  return (
    <header className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-card p-4 shadow-sm md:gap-6 md:p-6">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <TypeBadge type="plan" />
          <Ltr mono className="text-caption whitespace-nowrap text-muted-foreground">
            {card.key}
          </Ltr>
          <StagePill card={card} className="whitespace-nowrap" />
          <PriorityBadge priority={card.priority} className="whitespace-nowrap" />
          {isMineHere(card, me.id, roles) && <MineMark className="text-caption" />}
          {run ? (
            <span className="ms-auto">
              <LiveBadge connection={connection} />
            </span>
          ) : (
            live && (
              <span className="ms-auto">
                <LivePill label={d.live} hint={d.liveHint} />
              </span>
            )
          )}
        </div>
        <h1
          ref={titleRef}
          tabIndex={-1}
          dir="auto"
          className={cn(
            'rounded-md text-headline font-semibold text-balance text-foreground outline-none transition-[box-shadow,background-color] duration-500',
            glow,
          )}
        >
          <Bidi>{card.title}</Bidi>
        </h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {d.created}
            <ActorChip kind={card.createdByKind} memberId={card.createdById} />
          </span>
          <span aria-hidden>·</span>
          <RelativeTime iso={card.createdAt} />
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            {d.updated} <RelativeTime iso={card.lastEventAt} />
          </span>
          {revision ? (
            <>
              <span aria-hidden>·</span>
              <span>
                {d.revisionLabel} <Ltr className="tabular-nums">{num(revision, locale)}</Ltr>
              </span>
            </>
          ) : null}
        </p>
      </div>

      {idea && <PathStrip card={card} idea={idea} tasks={progressOf(card)} />}

      {/* Where it stands: the ring of phases beside the numbers in words and the next step, in the tone of its phase. */}
      <div className="flex min-w-0 flex-col items-center gap-5 @page-sm:flex-row @page-sm:gap-8">
        {phased && total > 0 && (
          <PlanRing groups={groups} selected={selected} hover={hover} onSelect={onGo} onHover={onHover} />
        )}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-5 gap-y-1">
            <p className="text-body text-muted-foreground">
              {fill(j.progress, {
                done: <AnimatedNumber value={done} className="text-headline font-bold text-foreground" />,
                total: (
                  <span className="font-semibold text-foreground">{plural(total, locale, j.stepsWord)}</span>
                ),
              })}
            </p>
            {!phased && total > 0 && <ProgressMeter done={done} total={total} className="w-40" />}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
              {phased && <span>{plural(card.plan.phases.length, locale, j.phasesWord)}</span>}
              {total > 0 && (
                <span>{withoutTask > 0 ? fmt(d.noTask, { n: num(withoutTask, locale) }) : d.allTasks}</span>
              )}
            </p>
            {phased && total > 0 && <Stats steps={steps} />}
          </div>

          <AnimatePresence mode="popLayout" initial={false}>
            {run ? (
              <ClaudeNow
                key="claude"
                run={run}
                step={steps.find((s) => s.id === run.stepId) ?? null}
                onOpen={() => onOpenStep(run.stepId)}
              />
            ) : (
              next && (
                <motion.div
                  key="next"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <NextStep card={card} step={next} group={nextGroup} phased={phased} onGo={onGo} />
                </motion.div>
              )
            )}
          </AnimatePresence>
          {(guideWords || (!next && total > 0)) && (
            <div className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-body-sm text-foreground">
              <Compass
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <div className="min-w-0 flex-1">{guideWords ?? j.allDone}</div>
            </div>
          )}
        </div>
      </div>

      {card.archivedAt && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-body-sm text-warning-soft-foreground">
          {fmt(kit.sheet.archived, { when: '' })} <RelativeTime iso={card.archivedAt} />
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4 @page-md:flex-row @page-md:flex-wrap @page-md:items-center @page-md:justify-between">
        <ActionBar card={card} action={action} />
        <ClaudeActions card={card} />
      </div>
    </header>
  );
}

/** Every phase with its steps (or the plain list of a plan without phases), and the ways to add steps when there are none. */
function StepsSection({
  card,
  groups,
  steps,
  onOpen,
  tasks,
}: {
  card: PlanCard;
  groups: PhaseGroup[];
  steps: readonly JourneyStep[];
  onOpen: (id: string) => void;
  tasks: ReadonlyMap<string, StepTask>;
}) {
  const d = useT<PlanningMessages>('planning').detail;
  const j = d.journey;
  const wb = useMaybeWb();
  const phased = card.plan.phases.length > 0;
  // Only the current phase starts open (owner, 2026-11-20): the rest fold, so the list reads as chapters.
  const [open, setOpen] = useState<Set<number>>(() => {
    const current = groups.find((g) => g.hasNext);
    return new Set(current ? [current.index] : []);
  });
  const allOpen = groups.length > 0 && groups.every((g) => open.has(g.index));
  const canEdit = !card.archivedAt && card.allowedActions.includes('plan.update');
  const off = wb && engineBlocks(wb.engine);
  const develop = () =>
    fillComposer(fmt(d.claude.developPrompt, { key: card.key }), 'execute', { show: true });
  const toggle = (index: number) =>
    setOpen((was) => {
      const next = new Set(was);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <section aria-labelledby={`steps-${card.key}`} className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ListOrdered aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <h2 id={`steps-${card.key}`} className="min-w-0 flex-1 text-title-sm font-semibold text-foreground">
          {phased ? j.allPhases : d.steps}
        </h2>
        {phased && groups.length > 1 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.index)))}
          >
            {allOpen ? j.collapseAll : j.expandAll}
          </Button>
        )}
        {canEdit && <EditButton />}
      </div>
      {steps.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4">
          <p className="text-body-sm text-muted-foreground">{d.stepsEmpty}</p>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setQuery({ action: 'edit' })}>
                <PenLine aria-hidden className="size-3.5" strokeWidth={1.75} />
                {d.addSteps}
              </Button>
            )}
            {wb && !card.archivedAt && (
              <Button size="sm" variant="ghost" disabled={!!off} onClick={develop}>
                <Sparkles aria-hidden className="size-3.5" strokeWidth={1.75} />
                {d.claude.develop}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {!phased && <p className="text-body-sm text-muted-foreground">{j.unphasedHint}</p>}
          <div className={cn(!phased && 'rounded-xl border border-border bg-card p-4')}>
            <PhaseList
              groups={groups}
              open={open}
              onToggle={toggle}
              all={steps}
              nextId={steps.find((s) => !s.done)?.id ?? null}
              run={card.archivedAt || !wb ? undefined : { cardKey: card.key }}
              tasks={tasks}
              anchor={`step-${card.key}`}
              onOpen={onOpen}
            />
          </div>
        </>
      )}
    </section>
  );
}

/** A plan's page. `PlanningDetail` (detail.tsx) reads the card and handles its loading, failure and absence. */
export function PlanDetail({
  card,
  action,
  tab,
  commentCount,
  historyCount,
}: {
  card: PlanCard;
  action: CardAction | null;
  tab: SheetTab;
  commentCount: number;
  historyCount: number | null;
}) {
  const d = useT<PlanningMessages>('planning').detail;
  const j = d.journey;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const perform = usePerformAction();
  const body = card.body ?? '';
  const { rest, extras } = useMemo(() => readPlanText(body, card.plan.steps), [body, card.plan.steps]);
  const tasks = useStepTasks(card);
  // The tasks map is rebuilt each render; what the steps read from it is each task's close time.
  const closed = [...tasks.values()].map((task) => `${task.key}:${task.closedAt ?? ''}`).join();
  const steps = useMemo(
    () => journeySteps(card.plan.steps, extras, (key) => tasks.get(key)?.closedAt),
    [card.plan.steps, extras, closed],
  );
  const groups = useMemo(() => phaseGroups(card.plan.phases, steps), [card.plan.phases, steps]);
  const phased = card.plan.phases.length > 0;
  const nextId = steps.find((s) => !s.done)?.id ?? null;
  const hereIndex = Math.max(
    0,
    groups.findIndex((g) => g.hasNext),
  );
  const [selected, setSelected] = useState(hereIndex);
  const [dir, setDir] = useState<1 | -1>(1);
  const [hover, setHover] = useState<number | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const justDone = useJustDone(steps);
  const live = usePlanLive(card, steps, groups);
  const run = live.run;
  const activePhase = run
    ? (groups.find((g) => g.steps.some((s) => s.id === run.stepId))?.index ?? null)
    : null;
  const glow = useChangeGlow(card.body);
  const last = groups.length - 1;
  const focus = groups[Math.min(selected, last)];
  const canEdit = !card.archivedAt && card.allowedActions.includes('plan.update');
  const canRestore = !card.archivedAt && card.allowedActions.includes('plan.restore_revision');
  const wb = useMaybeWb();

  /** Picks a phase from the ring, the map or the next-step callout; the callout also brings the chapter into view. */
  const select = useCallback(
    (index: number, scroll = false) => {
      setDir(index >= selected ? 1 : -1);
      setSelected(index);
      if (!scroll) return;
      requestAnimationFrame(() => {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        document
          .getElementById('pj-chapter')
          ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        document.getElementById('pj-focus-title')?.focus({ preventScroll: true });
      });
    },
    [selected],
  );

  // The chapter follows Claude (owner, 2026-11-20): whenever the running step or its phase changes, a new run included, the shown chapter moves to
  // that phase. Between those moments the owner may look elsewhere. The page itself never scrolls; the slide respects reduced motion.
  const following = run && activePhase !== null ? `${run.id}:${run.stepId}:${activePhase}` : null;
  const followed = useRef<string | null>(null);
  useEffect(() => {
    if (following === null || activePhase === null || followed.current === following) return;
    followed.current = following;
    setDir(activePhase >= selected ? 1 : -1);
    setSelected(activePhase);
    // Only when what Claude works on moves, not when the owner picks another chapter.
  }, [following]);

  const Section = sheetSections.plan;
  const tabs = [
    ['details', d.tabs.plan, null],
    ['comments', d.tabs.comments, commentCount],
    ['history', d.tabs.history, historyCount],
    ['links', d.tabs.links, card.links.length],
  ] as const;

  return (
    <MotionConfig reducedMotion="user">
      <PageContainer className="max-w-300 gap-4 md:gap-5">
        <div className="flex items-center gap-1">
          <BackLink />
          <span aria-hidden className="text-muted-foreground/60">
            /
          </span>
          <Ltr mono className="px-1 text-caption text-muted-foreground">
            {card.key}
          </Ltr>
          <span className="ms-auto">
            <MoreMenu card={card} />
          </span>
        </div>

        <PlanHero
          card={card}
          action={action}
          groups={groups}
          steps={steps}
          selected={selected}
          hover={hover}
          onGo={select}
          onHover={setHover}
          run={run}
          connection={live.connection}
          onOpenStep={setOpenId}
        />

        {phased && focus && (
          <section
            id="pj-journey"
            aria-labelledby="pj-journey-title"
            className="flex min-w-0 scroll-mt-4 flex-col gap-5 rounded-2xl border border-border bg-card p-4 shadow-xs md:p-6"
          >
            <header className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h2
                  id="pj-journey-title"
                  className="flex items-center gap-2 text-title-sm font-semibold text-foreground"
                >
                  <MapIcon aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
                  {j.title}
                </h2>
                <p className="text-body-sm text-muted-foreground">{j.hint}</p>
              </div>
              <Legend />
            </header>
            <JourneyMap
              groups={groups}
              selected={selected}
              hover={hover}
              active={activePhase}
              onSelect={select}
              onHover={setHover}
            />
            <div id="pj-chapter" className="min-w-0 scroll-mt-4 overflow-hidden border-t border-border pt-5">
              <AnimatePresence mode="wait" initial={false} custom={dir}>
                <motion.div
                  key={focus.index}
                  initial={{ opacity: 0, x: (locale === 'ar' ? -1 : 1) * dir * 48 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: (locale === 'ar' ? 1 : -1) * dir * 48 }}
                  transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
                >
                  <PhaseFocus
                    group={focus}
                    all={steps}
                    last={last}
                    nextId={nextId}
                    run={run}
                    justDone={justDone}
                    onStep={(delta) => select(Math.min(last, Math.max(0, focus.index + delta)))}
                    onOpen={setOpenId}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </section>
        )}

        {phased && <PlanVideo card={card} onSpot={setHover} />}

        <Tabs.Root
          value={tab}
          onValueChange={(next) => setQuery({ tab: next === 'details' ? null : next })}
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          className="flex min-w-0 flex-col gap-4"
        >
          <Tabs.List
            aria-label={fmt(kit.sheet.label, { key: card.key })}
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-border scrollbar-none"
          >
            {tabs.map(([value, label, count]) => (
              <Tabs.Trigger key={value} value={value} className={tabTriggerClass}>
                {label}
                {count !== null && count > 0 && (
                  <Ltr className="rounded-full bg-muted px-1.5 text-caption tabular-nums">
                    {num(count, locale)}
                  </Ltr>
                )}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content value="details" className={cn('min-w-0 outline-none', focusRingInset)}>
            {action ? (
              // An action's form (edit, a reason) is the sheet's own, so it saves one way everywhere.
              <Panel>
                <Section
                  card={card}
                  action={action}
                  cancelAction={() => setQuery({ action: null })}
                  perform={(a, payload) => perform(card.key, a, payload)}
                />
              </Panel>
            ) : (
              <div className="grid min-w-0 items-start gap-6 @page-xl:grid-cols-[minmax(0,1fr)_18rem] @page-xl:gap-8">
                <div className="flex min-w-0 flex-col gap-6">
                  <ChangeRequestNote card={card} />
                  {phased && (
                    <Panel id={`roles-${card.key}`} icon={Users} title={j.rolesTitle}>
                      <RolesChart groups={groups} hover={hover} onHover={setHover} />
                    </Panel>
                  )}
                  <StepsSection card={card} groups={groups} steps={steps} onOpen={setOpenId} tasks={tasks} />
                  <Panel
                    id={`approach-${card.key}`}
                    title={sectionCount(rest) >= 2 ? d.planText : d.approach}
                    icon={FileText}
                    aside={canEdit && <EditButton />}
                  >
                    <div
                      className={cn(
                        '-m-2 rounded-lg p-2 transition-[box-shadow,background-color] duration-500',
                        glow,
                      )}
                    >
                      {rest ? (
                        <MarkdownView source={rest} dir="auto" headingOffset={2} />
                      ) : (
                        <p className="text-body-sm text-muted-foreground">{d.approachEmpty}</p>
                      )}
                    </div>
                  </Panel>
                  <Evidence cardKey={card.key} />
                  {wb && <CardRuns cardKey={card.key} />}
                  <Revisions card={card} canRestore={canRestore} />
                </div>
                <div className="flex min-w-0 flex-col gap-4">
                  {(live.watching || live.feed.length > 0) && (
                    <Panel
                      id={`feed-${card.key}`}
                      icon={Activity}
                      title={d.liveRun.feedTitle}
                      aside={<LiveBadge connection={live.connection} />}
                    >
                      <ActivityFeed feed={live.feed} />
                    </Panel>
                  )}
                  <Aside
                    card={card}
                    withProgress={false}
                    onOutlineMissing={() => setQuery({ tab: null, action: null })}
                  />
                </div>
              </div>
            )}
          </Tabs.Content>
          <Tabs.Content value="comments" className={cn('outline-none', focusRingInset)}>
            <Panel>
              <CommentsTab card={card} />
            </Panel>
          </Tabs.Content>
          <Tabs.Content value="history" className={cn('outline-none', focusRingInset)}>
            <Panel>
              <HistoryTab card={card} />
            </Panel>
          </Tabs.Content>
          <Tabs.Content value="links" className={cn('outline-none', focusRingInset)}>
            <Panel>
              <LinksTab card={card} />
            </Panel>
          </Tabs.Content>
        </Tabs.Root>

        <StepDrawer
          step={openId ? (steps.find((s) => s.id === openId) ?? null) : null}
          groups={groups}
          nextId={nextId}
          tasks={tasks}
          evidence={{
            cardKey: card.key,
            canAdd: !card.archivedAt && card.allowedActions.includes('plan.add_evidence'),
            canRemove: !card.archivedAt && card.allowedActions.includes('plan.remove_evidence'),
          }}
          onOpenStep={setOpenId}
          onClose={() => setOpenId(null)}
        />
        <Celebration
          event={live.celebration}
          title={live.celebration ? (groups[live.celebration.phase]?.phase?.title ?? '') : ''}
          onDone={live.clearCelebration}
        />
      </PageContainer>
    </MotionConfig>
  );
}
