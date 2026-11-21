'use client';

/**
 * @file phase-focus.tsx
 * @description The chapter under the journey map (v5-live-plan), in its phase's tone: the band with the phase's number, title and note, the waffle
 * of its steps beside the step list, and the roles in it. A step that waits for another says which and shows a lock; a step that finishes while the
 * page is open pops its check and flashes once; pointing at a square outlines the squares it depends on. Any step opens the drawer.
 */
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Images, Lock, Sparkles, SquareCheck } from 'lucide-react';
import { useState } from 'react';

import {
  Bidi,
  cn,
  fmt,
  focusRing,
  IconButton,
  kitMessages,
  Ltr,
  num,
  RoleBadge,
  roleIcon,
  Tooltip,
  useLocale,
  useT,
} from '@/components/kit';
import {
  blockersOf,
  type JourneyStep,
  type PhaseGroup,
  phaseState,
  toneOf,
} from '@/features/planning/journey';

import type { PlanningMessages } from './messages';
import { type LiveRun, StageStepper } from './plan-live';

const EASE = [0.2, 0.7, 0.2, 1] as const;

type Words = PlanningMessages['detail']['journey'];

/** "Waits for step 3, step 5", in the reader's numbers and list separator. */
export const waitsFor = (j: Words, blockers: readonly JourneyStep[], locale: 'ar' | 'en') =>
  fmt(j.blockedBy, { list: blockers.map((b) => fmt(j.stepRef, { n: num(b.n, locale) })).join(j.listSep) });

/** S, M or L as a small chip, its meaning in a tooltip and for a screen reader. */
export function SizeChip({ size }: { size: NonNullable<JourneyStep['size']> }) {
  const j = useT<PlanningMessages>('planning').detail.journey;
  return (
    <Tooltip content={`${j.sizes[size]}. ${j.effortHint}`}>
      <span
        tabIndex={0}
        className={cn(
          'inline-flex h-5.5 min-w-6 items-center justify-center rounded-md border border-border px-1.5 text-caption font-semibold text-muted-foreground',
          focusRing,
        )}
      >
        <Ltr>{size}</Ltr>
        <span className="sr-only">: {j.sizes[size]}</span>
      </span>
    </Tooltip>
  );
}

interface RowProps {
  step: JourneyStep;
  all: readonly JourneyStep[];
  /** Claude's run, when it is on this step: the row carries its stages in place. */
  run: LiveRun | null;
  isNext: boolean;
  hot: boolean;
  justDone: boolean;
  showRole: boolean;
  onHot: (id: string | null) => void;
  onOpen: (id: string) => void;
}

function StepRow({ step, all, run, isNext, hot, justDone, showRole, onHot, onOpen }: RowProps) {
  const t = useT<PlanningMessages>('planning').detail;
  const j = t.journey;
  const locale = useLocale();
  const blockers = step.done ? [] : blockersOf(step, all);
  const live = run !== null && !step.done;
  return (
    <li
      aria-current={isNext ? 'step' : undefined}
      data-hot={hot || (isNext && !live)}
      data-live={live && !run?.waiting}
      data-wait={live && !!run?.waiting}
      onMouseEnter={() => onHot(step.id)}
      onMouseLeave={() => onHot(null)}
      className="pj-step relative flex min-w-0 items-start gap-3 overflow-hidden rounded-lg px-2 py-2.5 transition-colors duration-200 md:px-3"
    >
      {justDone && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-success-soft"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: EASE }}
        />
      )}
      <span
        aria-hidden
        className={cn(
          'relative mt-px flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-caption font-semibold tabular-nums',
          step.done
            ? 'pj-tone-bg pj-tone-border'
            : live
              ? 'border-primary bg-primary text-primary-foreground'
              : blockers.length
                ? 'border-border text-muted-foreground'
                : isNext
                  ? 'pj-tone-border pj-tone-fg'
                  : 'pj-tone-line-border text-muted-foreground',
        )}
      >
        {step.done ? (
          <motion.span
            initial={justDone ? { scale: 0, rotate: -120 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 16 }}
          >
            <Check className="size-3.5" strokeWidth={3} />
          </motion.span>
        ) : live ? (
          <Sparkles className="size-3.5" strokeWidth={2.5} />
        ) : blockers.length ? (
          <Lock className="size-3" strokeWidth={2.5} />
        ) : (
          <Ltr>{num(step.n, locale)}</Ltr>
        )}
      </span>
      <div className="relative flex min-w-0 flex-1 flex-col gap-1.5 md:flex-row md:items-start md:gap-3">
        <button
          type="button"
          onClick={() => onOpen(step.id)}
          className={cn(
            'min-w-0 flex-1 rounded-sm text-start text-body text-pretty underline-offset-4 hover:underline',
            step.done
              ? 'text-muted-foreground line-through decoration-muted-foreground/50'
              : 'text-foreground',
            focusRing,
          )}
        >
          <span className="sr-only">{fmt(j.stepNo, { n: num(step.n, locale) })}: </span>
          <Bidi>{step.title}</Bidi>
          {step.done && <span className="sr-only"> ({j.done})</span>}
        </button>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {isNext && !live && (
            <span className="pj-tone-bg inline-flex h-5.5 items-center rounded-full px-2 text-caption font-semibold">
              {j.next}
            </span>
          )}
          {blockers.length > 0 && (
            <span className="inline-flex h-5.5 items-center gap-1 rounded-full bg-warning-soft px-2 text-caption font-medium text-warning-soft-foreground">
              <Lock aria-hidden className="size-3" strokeWidth={2} />
              {waitsFor(j, blockers, locale)}
            </span>
          )}
          {step.size && <SizeChip size={step.size} />}
          {step.evidence?.length ? (
            <span
              data-pj-evidence-count
              className="inline-flex h-5.5 items-center gap-1 rounded-full border border-border bg-card px-2 text-caption text-muted-foreground"
            >
              <Images aria-hidden className="pj-tone-fg size-3" strokeWidth={2} />
              {fmt(t.evidence.countLabel, { n: num(step.evidence.length, locale) })}
            </span>
          ) : null}
          {step.taskKey && (
            <span className="inline-flex h-5.5 items-center gap-1 rounded-full border border-border bg-card px-2 text-caption text-muted-foreground">
              <SquareCheck aria-hidden className="size-3 text-type-task-fg" strokeWidth={2} />
              <Ltr mono>{step.taskKey}</Ltr>
            </span>
          )}
          {showRole && step.role && <RoleBadge role={step.role} />}
        </div>
        {live && run && (
          <div className="flex min-w-0 flex-col gap-1.5 md:w-56 md:shrink-0" data-pj-live-row>
            <StageStepper stages={run.stages} compact />
            <p
              dir="auto"
              className={cn(
                'text-caption',
                run.waiting ? 'font-semibold text-warning-soft-foreground' : 'text-muted-foreground',
              )}
            >
              <Bidi>
                {run.waiting
                  ? run.readOnly
                    ? fmt(t.liveRun.waitingOther, { name: run.member ?? '' })
                    : run.waiting.kind === 'question'
                      ? t.liveRun.questionTitle
                      : t.liveRun.waitingTitle
                  : (run.note ?? fmt(t.liveRun.claudeWorking, { n: num(step.n, locale) }))}
              </Bidi>
            </p>
          </div>
        )}
      </div>
    </li>
  );
}

export function PhaseFocus({
  group,
  all,
  last,
  nextId,
  run = null,
  justDone,
  onStep,
  onOpen,
}: {
  group: PhaseGroup;
  all: readonly JourneyStep[];
  last: number;
  nextId: string | null;
  /** Claude's run on a step of this plan, if any (v5-live-plan, batch 2). */
  run?: LiveRun | null;
  /** A step that became done while the page is open: it pops its check once. */
  justDone: string | null;
  onStep: (delta: 1 | -1) => void;
  onOpen: (id: string) => void;
}) {
  const j = useT<PlanningMessages>('planning').detail.journey;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const [hot, setHot] = useState<string | null>(null);
  const state = phaseState(group);
  const percent = group.total ? Math.round((group.done / group.total) * 100) : 0;
  const title = group.phase?.title ?? j.noPhase;
  const words = state === 'done' ? j.stateDone : state === 'now' ? j.stateNow : j.stateTodo;
  // A title in another script keeps the page's alignment, so the band reads as one block.
  const align = locale === 'ar' ? 'right' : 'left';
  const Prev = locale === 'ar' ? ChevronRight : ChevronLeft;
  const Next = locale === 'ar' ? ChevronLeft : ChevronRight;
  const hotStep = hot ? all.find((s) => s.id === hot) : undefined;
  const deps = new Set(hotStep?.after ?? []);

  return (
    <section
      data-pj-tone={toneOf(group.index)}
      aria-labelledby="pj-focus-title"
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="pj-tone-soft flex min-w-0 items-start gap-3 rounded-xl p-3 md:gap-4 md:p-4">
        <motion.span
          aria-hidden
          className="pj-tone-bg flex size-12 shrink-0 items-center justify-center rounded-xl text-title font-bold tabular-nums"
          initial={{ scale: 0.6, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 20 }}
        >
          {state === 'done' ? (
            <Check className="size-6" strokeWidth={3} />
          ) : (
            <Ltr>{num(group.index, locale)}</Ltr>
          )}
        </motion.span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="pj-tone-fg text-caption font-semibold">
            {j.chapter} · {fmt(j.phaseOfN, { n: num(group.index, locale), last: num(last, locale) })} ·{' '}
            {words}
          </p>
          <h3
            id="pj-focus-title"
            tabIndex={-1}
            dir="auto"
            style={{ textAlign: align }}
            className="text-title font-bold text-balance text-foreground outline-none"
          >
            {title}
          </h3>
          {group.phase?.note && (
            <p dir="auto" style={{ textAlign: align }} className="text-body-sm text-muted-foreground">
              {group.phase.note}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label={j.prevPhase} disabled={group.index === 0} onClick={() => onStep(-1)}>
            <Prev aria-hidden className="size-5" strokeWidth={1.75} />
          </IconButton>
          <IconButton label={j.nextPhase} disabled={group.index === last} onClick={() => onStep(1)}>
            <Next aria-hidden className="size-5" strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>

      <div className="grid min-w-0 items-start gap-5 @page-md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] @page-md:gap-7">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-body-sm font-semibold text-foreground">{j.stepsGrid}</h4>
              <span className="pj-tone-fg text-body-sm font-semibold tabular-nums">
                {fmt(j.percentDone, { p: num(percent, locale) })}
                {group.review > 0 && (
                  <span className="font-medium text-foreground">
                    {' · '}
                    {fmt(j.inReview, { n: num(group.review, locale) })}
                  </span>
                )}
              </span>
            </div>
            {/* A pointer shortcut to the steps beside it, which say all of this in words. */}
            <div aria-hidden className="pj-waffle">
              {group.steps.map((s, i) => {
                const blocked = !s.done && blockersOf(s, all).length > 0;
                const pop = justDone === s.id;
                const liveCell = !s.done && run?.stepId === s.id;
                return (
                  <motion.span
                    key={s.id}
                    title={`${fmt(j.stepNo, { n: num(s.n, locale) })}: ${s.title}${s.review ? ` · ${j.legendReview}` : ''}`}
                    data-state={s.done ? 'done' : s.review ? 'review' : s.id === nextId ? 'next' : 'todo'}
                    data-hot={hot === s.id}
                    data-blocked={blocked}
                    data-live={liveCell}
                    data-dep={deps.has(s.id)}
                    onMouseEnter={() => setHot(s.id)}
                    onMouseLeave={() => setHot(null)}
                    onClick={() => onOpen(s.id)}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={pop ? { opacity: 1, scale: [1, 1.4, 0.92, 1] } : { opacity: 1, scale: 1 }}
                    transition={pop ? { duration: 0.6, ease: EASE } : { duration: 0.25, delay: i * 0.025 }}
                    className="pj-cell text-caption font-semibold tabular-nums"
                  >
                    {s.done ? (
                      <Check className="size-3.5" strokeWidth={3} />
                    ) : liveCell ? (
                      <Sparkles className="size-3.5 text-primary-text" strokeWidth={2.5} />
                    ) : blocked ? (
                      <Lock className="size-3" strokeWidth={2.5} />
                    ) : (
                      <Ltr>{num(s.n, locale)}</Ltr>
                    )}
                  </motion.span>
                );
              })}
            </div>
            <p className="text-caption text-muted-foreground">{j.stepsGridHint}</p>
          </div>
          {group.roles.length > 0 && (
            <div className="flex min-w-0 flex-col gap-2">
              <h4 className="text-body-sm font-semibold text-foreground">{j.phaseRoles}</h4>
              <ul className="flex flex-wrap gap-1.5">
                {group.roles.map(({ role, n }) => {
                  const Icon = roleIcon[role];
                  return (
                    <li
                      key={role}
                      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-caption text-foreground"
                    >
                      <Icon aria-hidden className="pj-tone-fg size-3.5" strokeWidth={1.75} />
                      {kit.roles[role]}
                      <Ltr className="font-semibold tabular-nums">{num(n, locale)}</Ltr>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <ol
            aria-label={fmt(j.progressLabel, {
              done: num(group.done, locale),
              total: num(group.total, locale),
            })}
            className="flex min-w-0 flex-col gap-0.5"
          >
            {group.steps.map((s) => (
              <StepRow
                key={s.id}
                step={s}
                all={all}
                run={run?.stepId === s.id ? run : null}
                isNext={s.id === nextId}
                hot={hot === s.id}
                justDone={justDone === s.id}
                showRole={group.roles.length > 1}
                onHot={setHot}
                onOpen={onOpen}
              />
            ))}
          </ol>
          {state === 'done' && <p className="px-2 text-body-sm text-muted-foreground">{j.noNextHere}</p>}
        </div>
      </div>
    </section>
  );
}
