import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Images, Lock, Sparkles, SquareCheck } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { Bidi, fmt, focusRing, IconButton, kitMessages, Ltr, num, RoleBadge, roleIcon, Tooltip } from '../../../today/v5-peacock-app/kit';
import { messages } from '../i18n';
import { sayText, type Run } from './live';
import { StageStepper, useLiveWords } from './live-ui';
import { blockersOf, type NumberedStep, type PhaseGroup } from './model';
import { phaseState, toneOf } from './tone';

const ease = [0.2, 0.7, 0.2, 1] as const;

interface RowProps {
  step: NumberedStep;
  all: NumberedStep[];
  isNext: boolean;
  hot: boolean;
  run: Run | null;
  justDone: boolean;
  showRole: boolean;
  onHot: (id: string | null) => void;
  onOpen: (id: string) => void;
}

function StepRow({ step, all, isNext, hot, run, justDone, showRole, onHot, onOpen }: RowProps) {
  const t = useT(messages);
  const words = useLiveWords();
  const locale = useLocale();
  const live = run?.stepId === step.id;
  const blockers = step.done ? [] : blockersOf(step, all);
  const evidence = step.evidence?.length ?? 0;
  return (
    <li
      aria-current={isNext ? 'step' : undefined}
      data-hot={hot || (isNext && !live)}
      data-live={live && !run?.waiting}
      data-wait={live && !!run?.waiting}
      onMouseEnter={() => onHot(step.id)}
      onMouseLeave={() => onHot(null)}
      className="ps-step relative flex min-w-0 items-start gap-3 overflow-hidden rounded-lg px-2 py-2.5 transition-colors duration-200 md:px-3"
    >
      {justDone && (
        <motion.span aria-hidden className="pointer-events-none absolute inset-0 bg-success-soft" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 1.6, ease }} />
      )}
      <span
        aria-hidden
        className={cn(
          'relative mt-px flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-caption font-semibold tabular-nums',
          step.done ? 'ps-tone-bg ps-tone-border' : live ? 'border-primary bg-primary text-primary-foreground' : blockers.length ? 'border-border text-muted-foreground' : isNext ? 'ps-tone-border ps-tone-fg' : 'ps-tone-line-border text-muted-foreground',
        )}
      >
        {step.done ? (
          <motion.span key="done" initial={justDone ? { scale: 0, rotate: -120 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 16 }}>
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
      <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 flex-col gap-1.5 md:flex-row md:items-start md:gap-3">
          <button
            type="button"
            onClick={() => onOpen(step.id)}
            className={cn(
              'min-w-0 flex-1 rounded-sm text-start text-body text-pretty underline-offset-4 hover:underline',
              step.done ? 'text-muted-foreground line-through decoration-muted-foreground/50' : 'text-foreground',
              focusRing,
            )}
          >
            <span className="sr-only">{fmt(t.stepNo, { n: num(step.n, locale) })}: </span>
            <bdi>
              <Bidi>{step.title}</Bidi>
            </bdi>
            {step.done && <span className="sr-only"> ({t.done})</span>}
          </button>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {isNext && !live && <span className="ps-tone-bg inline-flex h-5.5 items-center rounded-full px-2 text-caption font-semibold">{t.next}</span>}
            {blockers.length > 0 && (
              <span className="inline-flex h-5.5 items-center gap-1 rounded-full bg-warning-soft px-2 text-caption font-medium text-warning-soft-foreground">
                <Lock aria-hidden className="size-3" strokeWidth={2} />
                {fmt(t.blockedBy, { list: blockers.map((b) => fmt(t.stepRef, { n: num(b.n, locale) })).join('، ') })}
              </span>
            )}
            {evidence > 0 && (
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex h-5.5 items-center gap-1 rounded-full border border-border bg-card px-2 text-caption text-foreground"
              >
                <Images aria-hidden className="ps-tone-fg size-3" strokeWidth={2} />
                {fmt(t.evidenceCount, { n: num(evidence, locale) })}
              </motion.span>
            )}
            {step.size && (
              <Tooltip content={`${t.sizes[step.size]}. ${t.effortHint}`}>
                <span tabIndex={0} className={cn('inline-flex h-5.5 min-w-6 items-center justify-center rounded-md border border-border px-1.5 text-caption font-semibold text-muted-foreground', focusRing)}>
                  <Ltr>{step.size}</Ltr>
                  <span className="sr-only">: {t.sizes[step.size]}</span>
                </span>
              </Tooltip>
            )}
            {step.taskKey && (
              <span className="inline-flex h-5.5 items-center gap-1 rounded-full border border-border bg-card px-2 text-caption text-muted-foreground">
                <SquareCheck aria-hidden className="size-3 text-type-task-fg" strokeWidth={2} />
                <Ltr mono>{step.taskKey}</Ltr>
              </span>
            )}
            {showRole && step.role && <RoleBadge role={step.role} />}
          </div>
        </div>
        {live && run && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3, ease }} className="flex min-w-0 flex-col gap-1.5 overflow-hidden pt-0.5">
            <div className="max-w-md">
              <StageStepper stages={run.stages} compact />
            </div>
            <p className={cn('text-caption', run.waiting ? 'font-semibold text-warning-soft-foreground' : 'text-muted-foreground')}>
              <Bidi>{run.waiting ? t.waitingTitle : sayText(words, run.note)}</Bidi>
            </p>
          </motion.div>
        )}
      </div>
    </li>
  );
}

/**
 * The chapter under the map, in its phase's tone: the band, the waffle beside the step list, and now the live layer. The step Claude
 * runs carries its stages in place; a step that waits for another says which and shows a lock; a finished step pops its check and
 * flashes once; pointing at a square outlines the squares it depends on. Any step opens the drawer.
 */
export function PhaseFocus({
  group,
  all,
  last,
  nextId,
  run,
  justDone,
  onStep,
  onOpen,
}: {
  group: PhaseGroup;
  all: NumberedStep[];
  last: number;
  nextId: string | null;
  run: Run | null;
  justDone: string | null;
  onStep: (delta: 1 | -1) => void;
  onOpen: (id: string) => void;
}) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const [hot, setHot] = useState<string | null>(null);
  const state = phaseState(group);
  const percent = group.total ? Math.round((group.done / group.total) * 100) : 0;
  const title = group.phase?.title ?? t.unphased;
  const words = state === 'done' ? t.stateDone : state === 'now' ? t.stateNow : t.stateTodo;
  const align = locale === 'ar' ? 'right' : 'left';
  const Prev = locale === 'ar' ? ChevronRight : ChevronLeft;
  const Next = locale === 'ar' ? ChevronLeft : ChevronRight;
  const hotStep = hot ? all.find((s) => s.id === hot) : undefined;
  const deps = new Set(hotStep?.after ?? []);

  return (
    <section data-tone={toneOf(group.index)} aria-labelledby="ps-focus-title" className="flex min-w-0 flex-col gap-4">
      <div className="ps-tone-soft flex min-w-0 items-start gap-3 rounded-xl p-3 md:gap-4 md:p-4">
        <motion.span
          aria-hidden
          layout
          className="ps-tone-bg flex size-12 shrink-0 items-center justify-center rounded-xl text-title font-bold tabular-nums"
          initial={{ scale: 0.6, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 20 }}
        >
          {state === 'done' ? <Check className="size-6" strokeWidth={3} /> : <Ltr>{num(group.index, locale)}</Ltr>}
        </motion.span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="ps-tone-fg text-caption font-semibold">
            {t.chapter} · {fmt(t.phaseOfN, { n: num(group.index, locale), last: num(last, locale) })} · {words}
          </p>
          <h3 id="ps-focus-title" tabIndex={-1} dir="auto" style={{ textAlign: align }} className="text-title font-bold text-balance text-foreground outline-none">
            {title}
          </h3>
          {group.phase?.note && (
            <p dir="auto" style={{ textAlign: align }} className="text-body-sm text-muted-foreground">
              {group.phase.note}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label={t.prevPhase} disabled={group.index === 0} onClick={() => onStep(-1)}>
            <Prev className="size-5" strokeWidth={1.75} />
          </IconButton>
          <IconButton label={t.nextPhase} disabled={group.index === last} onClick={() => onStep(1)}>
            <Next className="size-5" strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>

      <div className="ps-chapter-grid min-w-0">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-body-sm font-semibold text-foreground">{t.stepsGrid}</h4>
              <span className="ps-tone-fg text-body-sm font-semibold tabular-nums">{fmt(t.percentDone, { p: num(percent, locale) })}</span>
            </div>
            <div aria-hidden className="ps-waffle">
              {group.steps.map((s, i) => {
                const live = run?.stepId === s.id;
                const blocked = !s.done && blockersOf(s, all).length > 0;
                const pop = justDone === s.id;
                return (
                  <motion.span
                    key={s.id}
                    title={`${fmt(t.stepNo, { n: num(s.n, locale) })}: ${s.title}`}
                    data-state={s.done ? 'done' : s.id === nextId ? 'next' : 'todo'}
                    data-hot={hot === s.id}
                    data-live={live}
                    data-blocked={blocked}
                    data-dep={deps.has(s.id)}
                    onMouseEnter={() => setHot(s.id)}
                    onMouseLeave={() => setHot(null)}
                    onClick={() => onOpen(s.id)}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={pop ? { opacity: 1, scale: [1, 1.4, 0.92, 1] } : { opacity: 1, scale: 1 }}
                    transition={pop ? { duration: 0.6, ease } : { duration: 0.25, delay: i * 0.025 }}
                    className="ps-cell text-caption font-semibold tabular-nums"
                  >
                    {s.done ? <Check className="size-3.5" strokeWidth={3} /> : live ? <Sparkles className="size-3.5 text-primary" strokeWidth={2.5} /> : blocked ? <Lock className="size-3" strokeWidth={2.5} /> : <Ltr>{num(s.n, locale)}</Ltr>}
                  </motion.span>
                );
              })}
            </div>
            <p className="text-caption text-muted-foreground">{t.stepsGridHint}</p>
          </div>
          {group.roles.length > 0 && (
            <div className="flex min-w-0 flex-col gap-2">
              <h4 className="text-body-sm font-semibold text-foreground">{t.phaseRoles}</h4>
              <ul className="flex flex-wrap gap-1.5">
                {group.roles.map(({ role, n }) => {
                  const Icon = roleIcon[role];
                  return (
                    <li key={role} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-caption text-foreground">
                      <Icon aria-hidden className="ps-tone-fg size-3.5" strokeWidth={1.75} />
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
          <ol aria-label={fmt(t.progressLabel, { done: num(group.done, locale), total: num(group.total, locale) })} className="flex min-w-0 flex-col gap-0.5">
            {group.steps.map((s) => (
              <StepRow
                key={s.id}
                step={s}
                all={all}
                isNext={s.id === nextId}
                hot={hot === s.id}
                run={run}
                justDone={justDone === s.id}
                showRole={group.roles.length > 1}
                onHot={setHot}
                onOpen={onOpen}
              />
            ))}
          </ol>
          {state === 'done' && <p className="px-2 text-body-sm text-muted-foreground">{t.noNextHere}</p>}
        </div>
      </div>
    </section>
  );
}
