'use client';

/**
 * @file detail-parts.tsx
 * @description The pieces of a plan's or an idea's own page: the stage track, the live mark, the steps as a timeline, the progress panel, the outline and a
 * plain panel. Status is never colour alone: every stage, step and number carries its words. Why they look this way: NOTES.md beside this file.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { Check, type LucideIcon } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import {
  Bidi,
  CardChip,
  cn,
  fmt,
  focusRing,
  type IdeaCard,
  kitMessages,
  type MarkdownHeading,
  num,
  type PlanCard,
  RoleBadge,
  useLocale,
  useT,
} from '@/components/kit';
import { StepRunMenu } from '@/components/queue/run-entry';
import type { PlanStep } from '@/features/cards/types';
import { roadOf } from '@/features/planning/model';

import type { PlanningMessages } from './messages';

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

/** The road the card travels, with where it stands. A status off the road says so in words beside it. */
export function StageTrack({ card }: { card: IdeaCard | PlanCard }) {
  const kit = useT(kitMessages);
  const d = useT<PlanningMessages>('planning').detail;
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
                  passed ? 'bg-foreground/70' : here ? 'bg-primary' : 'bg-muted',
                )}
              />
              <span
                className={cn(
                  'flex min-w-0 items-center gap-1 truncate text-caption',
                  here
                    ? 'font-semibold text-foreground'
                    : passed
                      ? 'text-foreground/80'
                      : 'text-muted-foreground',
                )}
              >
                {passed && <Check aria-hidden className="size-3 shrink-0" strokeWidth={2.25} />}
                <span className="truncate">{kit.status[status] ?? status}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {off && <p className="text-caption text-muted-foreground">{kit.status[card.status] ?? card.status}</p>}
    </div>
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

/** The steps as a timeline: a numbered node each, joined by a neutral line. A step that arrives while the page is open slides in. */
export function StepsTimeline({
  steps,
  nextIndex,
  run,
}: {
  steps: PlanStep[];
  nextIndex: number | null;
  /** Each open step can be queued to run, when the panel is there. */
  run?: { cardKey: string } | undefined;
}) {
  const d = useT<PlanningMessages>('planning').detail;
  const locale = useLocale();
  const reduce = useReducedMotion();
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
        return (
          <motion.li
            key={step.id}
            initial={fresh && !reduce ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } }}
            className="group relative flex min-w-0 gap-3 pb-4 last:pb-0"
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
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground',
              )}
            >
              {step.done ? <Check className="size-3.5" strokeWidth={2.5} /> : n}
            </span>
            <div
              className={cn(
                'flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg px-3 py-2 transition-colors duration-150',
                isNext ? 'bg-primary/[0.04] ring-1 ring-primary/20' : 'group-hover:bg-accent/60',
              )}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="sr-only">{fmt(d.step, { n })}</span>
                <span
                  className={cn(
                    'min-w-0 flex-1 text-body-sm font-medium text-pretty',
                    step.done
                      ? 'text-muted-foreground line-through decoration-muted-foreground/40'
                      : 'text-foreground',
                  )}
                >
                  <Bidi>{step.title}</Bidi>
                </span>
                {isNext && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary">
                    {d.stepNext}
                  </span>
                )}
              </div>
              {(step.role || step.taskKey || (run && !step.done)) && (
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {step.role && <RoleBadge role={step.role} outline={false} className="text-caption" />}
                  {step.taskKey && <CardChip k={step.taskKey} type="task" showStatus />}
                  {run && !step.done && (
                    <span className="ms-auto">
                      <StepRunMenu cardKey={run.cardKey} index={i} title={step.title} />
                    </span>
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

/** The plan's own headings, to jump to. Only when it has more than one. */
export function Outline({ headings, label }: { headings: MarkdownHeading[]; label: string }) {
  if (headings.length < 2) return null;
  return (
    <nav aria-label={label} className="flex min-w-0 flex-col gap-0.5">
      {headings.map((h) => (
        <a
          key={h.anchor}
          href={`#${h.anchor}`}
          onClick={(e) => {
            const target = document.getElementById(h.anchor);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
