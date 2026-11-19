'use client';

/**
 * @file detail-parts.tsx
 * @description The pieces of a plan's or an idea's own page: the stage track, the live mark, the steps as a timeline, the progress panel, the outline and a
 * plain panel. Status is never colour alone: every stage, step and number carries its words. Why they look this way: NOTES.md beside this file.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { Evidence } from '@/components/cards/card-sheet';
import {
  ActorChip,
  AppLink,
  Bidi,
  CardChip,
  type CardListItem,
  cn,
  fmt,
  focusRing,
  type IdeaCard,
  Ltr,
  type MarkdownHeading,
  num,
  Pill,
  type PlanCard,
  RoleBadge,
  StatusBadge,
  statusIcon,
  statusTone,
  useLocale,
  useT,
} from '@/components/kit';
import { StepRunMenu } from '@/components/queue/run-entry';
import type { PlanStep } from '@/features/cards/types';
import { useWorkReports } from '@/features/chat/queries';
import { roadOf } from '@/features/planning/model';
import type { StepExtra } from '@/features/planning/plan-text';

import type { PlanningMessages } from './messages';
import { AfterChip } from './studio/plan-report';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** A titled surface. One neutral border and a soft shadow, never a coloured edge (D31). */
export function Panel({
  title,
  icon: Icon,
  aside,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  icon?: LucideIcon | undefined;
  aside?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
  bodyClassName?: string | undefined;
  id?: string | undefined;
}) {
  return (
    <section
      aria-labelledby={title && id ? id : undefined}
      className={cn('min-w-0 rounded-xl border border-border bg-card shadow-xs', className)}
    >
      {title && (
        <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          {Icon && <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
          <h2 id={id} className="min-w-0 flex-1 text-body-sm font-semibold text-foreground">
            {title}
          </h2>
          {aside}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** "Claude is working on this now": a calm, breathing dot and words. It only shows while a turn really is. */
export function LivePill({ label, hint }: { label: string; hint?: string | undefined }) {
  return (
    <span
      role="status"
      title={hint}
      className="inline-flex h-6 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 text-caption font-medium text-primary"
    >
      <span aria-hidden className="relative flex size-2">
        <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      {label}
    </span>
  );
}

/** A soft glow on a block for a moment after its text changes while the page is open, so a live edit is seen. */
export function useChangeGlow(value: unknown) {
  const first = useRef(true);
  const [glow, setGlow] = useState(false);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setGlow(true);
    const timer = window.setTimeout(() => setGlow(false), 1600);
    return () => window.clearTimeout(timer);
  }, [value]);
  return glow ? 'ring-2 ring-primary/25 bg-primary/[0.03]' : 'ring-0 ring-transparent';
}

/** A stage's word, from Planning's own words, so the track, the badge and the lists all say the same thing. */
export function useStageWord() {
  const stage = useT<PlanningMessages>('planning').detail.stage;
  return (type: 'idea' | 'plan', status: string) =>
    (stage[type] as Record<string, string | undefined>)[status] ?? status;
}

/** A card's status as a pill, in Planning's words: icon and word, never colour alone. */
export function StagePill({ card, className }: { card: IdeaCard | PlanCard; className?: string }) {
  const word = useStageWord();
  return (
    <Pill tone={statusTone(card.status)} icon={statusIcon(card.status)} className={className}>
      {word(card.type, card.status)}
    </Pill>
  );
}

/**
 * The road the card travels, with where it stands. A status off the road says so in words beside it. Where five words cannot fit, only the bars show,
 * with one line under them naming the stage.
 */
export function StageTrack({ card }: { card: IdeaCard | PlanCard }) {
  const d = useT<PlanningMessages>('planning').detail;
  const locale = useLocale();
  const word = useStageWord();
  const { road, at, off } = roadOf(card);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="sr-only">{d.road}</p>
      <ol
        className="grid min-w-0 gap-1"
        style={{ gridTemplateColumns: `repeat(${road.length}, minmax(0, 1fr))` }}
      >
        {road.map((status, i) => {
          const passed = !off && i < at;
          const here = !off && i === at;
          return (
            <li
              key={status}
              aria-current={here ? 'step' : undefined}
              className="flex min-w-0 flex-col gap-1.5"
            >
              <span
                aria-hidden
                className={cn(
                  'h-1.5 rounded-full transition-colors duration-300',
                  passed ? 'bg-foreground/40' : here ? 'bg-foreground' : 'bg-muted',
                )}
              />
              <span
                className={cn(
                  'flex min-w-0 items-center gap-1 truncate text-caption @max-page-sm:sr-only',
                  here ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                {passed && <Check aria-hidden className="size-3 shrink-0" strokeWidth={2.25} />}
                <span className="truncate">{word(card.type, status)}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {!off && (
        <p aria-hidden className="text-caption font-semibold text-foreground @page-sm:hidden">
          {fmt(d.stageOf, {
            n: num(at + 1, locale),
            total: num(road.length, locale),
            label: word(card.type, card.status),
          })}
        </p>
      )}
      {off && <p className="text-caption text-muted-foreground">{word(card.type, card.status)}</p>}
    </div>
  );
}

/**
 * Where the card sits on the way from an idea to work: the idea, the plan it became, and the plan's tasks done. Only the parts that exist show, each a link
 * but the card the page is about.
 */
export function PathStrip({
  card,
  idea,
  plan,
  tasks,
}: {
  card: IdeaCard | PlanCard;
  idea?: { key: string; card?: CardListItem | undefined } | undefined;
  plan?: { key: string; card?: CardListItem | undefined } | undefined;
  tasks?: { done: number; total: number } | undefined;
}) {
  const d = useT<PlanningMessages>('planning').detail;
  const locale = useLocale();
  const word = useStageWord();
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  const self = { key: card.key, title: card.title, status: card.status, type: card.type };
  const ideaPart =
    card.type === 'idea'
      ? self
      : idea && { key: idea.key, title: idea.card?.title, status: idea.card?.status, type: 'idea' as const };
  const planPart =
    card.type === 'plan'
      ? self
      : plan && { key: plan.key, title: plan.card?.title, status: plan.card?.status, type: 'plan' as const };
  const parts: ReactNode[] = [];
  const item = (part: {
    key: string;
    title?: string | undefined;
    status?: string | undefined;
    type: 'idea' | 'plan';
  }) => {
    const here = part.key === card.key;
    const inner = (
      <>
        <span className="font-semibold text-foreground">
          {part.type === 'idea' ? d.tabs.idea : d.tabs.plan}
        </span>
        <Ltr mono>{part.key}</Ltr>
        {part.status && <span className="text-muted-foreground">· {word(part.type, part.status)}</span>}
        {!here && part.title && (
          <span className="min-w-0 truncate text-foreground">
            <Bidi>{part.title}</Bidi>
          </span>
        )}
      </>
    );
    const shape =
      'inline-flex min-h-8 max-w-full min-w-0 items-center gap-1.5 rounded-full border border-border px-2.5 text-caption max-md:min-h-11';
    return here ? (
      <span aria-current="page" className={cn(shape, 'bg-muted')}>
        {inner}
      </span>
    ) : (
      <AppLink
        view="planning"
        query={{ plan: part.key, action: null, tab: null }}
        className={cn(shape, 'bg-card hover:bg-accent', focusRing)}
      >
        {inner}
      </AppLink>
    );
  };
  if (ideaPart) parts.push(item(ideaPart));
  if (planPart) parts.push(item(planPart));
  if (tasks && tasks.total > 0)
    parts.push(
      <a
        href={`#steps-${card.key}`}
        className={cn(
          'inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-caption text-foreground hover:bg-accent max-md:min-h-11',
          focusRing,
        )}
      >
        {fmt(d.pathTasks, { done: num(tasks.done, locale), total: num(tasks.total, locale) })}
      </a>,
    );
  if (parts.length < 2) return null;
  return (
    <nav aria-label={d.path} className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-1.5">
        {parts.map((part, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <li aria-hidden className="flex items-center">
                <Arrow className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
              </li>
            )}
            <li className="flex min-w-0 max-w-full">{part}</li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

/** Words first, and a thin meter under them. The meter is hidden from a screen reader, because the words say it. */
export function ProgressMeter({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <span aria-hidden className={cn('block h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <span
        className="block h-full rounded-full bg-foreground transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </span>
  );
}

/** A step's task as the page knows it: the cache's card, or the summary the plan's own link carries. */
export type StepTask = Pick<
  CardListItem,
  'key' | 'title' | 'status' | 'type' | 'flags' | 'closedAt' | 'assigneeId'
>;

const blockedOf = (task: StepTask | undefined) => !!task?.flags?.blocked && !task.closedAt;

/** A step's evidence: its task's work reports, read only once the owner opens it. */
function StepEvidence({ taskKey }: { taskKey: string }) {
  const d = useT<PlanningMessages>('planning').detail;
  const reports = useWorkReports(taskKey);
  if (reports.isPending)
    return (
      <span className="block h-3 w-1/2 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
    );
  if (!reports.data?.length) return <p className="text-caption text-muted-foreground">{d.stepNoEvidence}</p>;
  return <Evidence cardKey={taskKey} />;
}

/**
 * The steps as a timeline: a numbered node each, joined by a neutral line. A step with a task says where the task stands and who has it, and opens on its
 * evidence. A step that arrives while the page is open slides in.
 */
export function StepsTimeline({
  steps,
  nextIndex,
  run,
  tasks,
  extras,
  anchor,
}: {
  steps: PlanStep[];
  nextIndex: number | null;
  /** Each open step can be queued to run, when the panel is there. */
  run?: { cardKey: string } | undefined;
  /** Each step's task, by key, where the page knows it. */
  tasks?: ReadonlyMap<string, StepTask> | undefined;
  /** Each step's reason, size and the steps before it, read from the plan's own text. */
  extras?: readonly StepExtra[] | null | undefined;
  /** With an anchor, each step is `<anchor>-<n>`, so "after 1, 2" can link to it. */
  anchor?: string | undefined;
}) {
  const d = useT<PlanningMessages>('planning').detail;
  const sizes = useT<PlanningMessages>('planning').planStudio.sizes;
  const locale = useLocale();
  const reduce = useReducedMotion();
  const uid = useId();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Steps on screen at first paint do not animate. Only a step saved while the page is open does.
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) seen.current = new Set(steps.map((s) => s.id));
  useEffect(() => {
    for (const s of steps) seen.current?.add(s.id);
  }, [steps]);

  return (
    <ol className="flex min-w-0 flex-col">
      {steps.map((step, i) => {
        const isNext = i === nextIndex;
        const fresh = !seen.current?.has(step.id);
        const n = num(i + 1, locale);
        const task = step.taskKey ? tasks?.get(step.taskKey) : undefined;
        const extra = extras?.[i];
        const shown = open.has(step.id);
        const blocked = blockedOf(task);
        return (
          <motion.li
            key={step.id}
            id={anchor ? `${anchor}-${i + 1}` : undefined}
            initial={fresh && !reduce ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } }}
            className="group relative flex min-w-0 scroll-mt-20 gap-3 pb-4 last:pb-0"
          >
            {i < steps.length - 1 && (
              <span aria-hidden className="absolute start-3.5 top-8 bottom-1 w-px bg-border" />
            )}
            <span
              aria-hidden
              className={cn(
                'relative flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-semibold tabular-nums transition-colors duration-200',
                step.done
                  ? 'border-transparent bg-foreground text-background'
                  : isNext
                    ? 'border-foreground bg-card text-foreground'
                    : 'border-border bg-card text-muted-foreground',
              )}
            >
              {step.done ? <Check className="size-3.5" strokeWidth={2.5} /> : n}
            </span>
            <div
              className={cn(
                'flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg px-3 py-2 transition-colors duration-150',
                isNext ? 'bg-muted/60 ring-1 ring-border' : 'group-hover:bg-accent/60',
              )}
            >
              <div className="flex min-w-0 items-start gap-x-2">
                <span className="sr-only">{fmt(d.step, { n })}</span>
                <span
                  className={cn(
                    'min-w-0 flex-1 pt-0.5 text-body-sm font-medium text-pretty',
                    step.done
                      ? 'text-muted-foreground line-through decoration-muted-foreground/40'
                      : 'text-foreground',
                  )}
                >
                  <Bidi>{step.title}</Bidi>
                </span>
                {isNext && (
                  <span className="mt-0.5 shrink-0 rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-foreground">
                    {d.stepNext}
                  </span>
                )}
                {/* The step's own menu sits on its title's line, never alone on a line of its own. */}
                {run && !step.done && (
                  <span className="-my-1 shrink-0">
                    <StepRunMenu cardKey={run.cardKey} index={i} title={step.title} />
                  </span>
                )}
              </div>
              {extra?.why && (
                <p className="text-caption text-pretty text-muted-foreground">
                  <Bidi>{extra.why}</Bidi>
                </p>
              )}
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {step.role && <RoleBadge role={step.role} outline={false} className="text-caption" />}
                {extra?.size && (
                  <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-caption font-semibold text-foreground">
                    {sizes[extra.size]}
                  </span>
                )}
                {extra?.after?.length ? <AfterChip after={extra.after} idPrefix={anchor} /> : null}
                {step.taskKey ? (
                  <>
                    <CardChip
                      k={step.taskKey}
                      type="task"
                      card={task}
                      title={task?.title}
                      showTitle={!!task?.title}
                      className="max-w-full"
                    />
                    {task && <StatusBadge status={blocked ? 'blocked' : task.status} />}
                    {task &&
                      (task.assigneeId ? (
                        <ActorChip kind="user" memberId={task.assigneeId} className="text-caption" />
                      ) : (
                        <span className="text-caption text-muted-foreground">{d.stepUnassigned}</span>
                      ))}
                  </>
                ) : (
                  <span className="inline-flex h-5 items-center rounded-full border border-dashed border-border px-2 text-caption text-muted-foreground">
                    {d.stepNoTask}
                  </span>
                )}
              </div>
              {isNext && blocked && (
                <p className="flex items-center gap-1.5 text-caption font-medium text-destructive-soft-foreground">
                  <AlertTriangle aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
                  {d.stepBlocked}
                </p>
              )}
              {step.taskKey && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    aria-expanded={shown}
                    aria-controls={`${uid}-${step.id}`}
                    onClick={() => toggle(step.id)}
                    className={cn(
                      'hit-44 inline-flex items-center gap-1 self-start rounded-sm text-caption font-medium text-muted-foreground hover:text-foreground',
                      focusRing,
                    )}
                  >
                    {d.stepEvidence}
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        'size-3.5 transition-transform duration-150 motion-reduce:transition-none',
                        shown && 'rotate-180',
                      )}
                      strokeWidth={1.75}
                    />
                  </button>
                  {shown && (
                    <div id={`${uid}-${step.id}`} className="min-w-0">
                      <StepEvidence taskKey={step.taskKey} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** The plan's own headings, to jump to. Only when it has more than one. A heading not on the page (another tab is open) brings the text back first. */
export function Outline({
  headings,
  label,
  onMissing,
}: {
  headings: MarkdownHeading[];
  label: string;
  /** Shows the text the headings belong to, when it is not on the page. */
  onMissing?: (() => void) | undefined;
}) {
  const reduce = useReducedMotion();
  if (headings.length < 2) return null;
  const go = (target: HTMLElement) =>
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  return (
    <nav aria-label={label} className="flex min-w-0 flex-col gap-0.5">
      {headings.map((h) => (
        <a
          key={h.anchor}
          href={`#${h.anchor}`}
          onClick={(e) => {
            e.preventDefault();
            const target = document.getElementById(h.anchor);
            if (target) return go(target);
            onMissing?.();
            // The text comes back on the next renders: wait for its heading, a few frames at most.
            let tries = 0;
            const look = () => {
              const found = document.getElementById(h.anchor);
              if (found) go(found);
              else if ((tries += 1) < 20) window.requestAnimationFrame(look);
            };
            window.requestAnimationFrame(look);
          }}
          className={cn(
            'block truncate rounded-md px-2 py-1 text-body-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground',
            h.level === 3 && 'ps-5 text-caption',
            focusRing,
          )}
        >
          <Bidi>{h.text}</Bidi>
        </a>
      ))}
    </nav>
  );
}

/** A label and its value, in the details panel. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-caption text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center justify-end gap-1 text-body-sm text-foreground">
        {children}
      </dd>
    </div>
  );
}
