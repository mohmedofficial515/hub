import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, SquareCheck } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { Bidi, fmt, IconButton, kitMessages, Ltr, num, RoleBadge, roleIcon } from '../../../today/v5-peacock-app/kit';
import { messages } from '../i18n';
import type { NumberedStep, PhaseGroup } from './model';
import { phaseState, toneOf } from './tone';

function StepRow({ step, isNext, hot, onHot, showRole }: { step: NumberedStep; isNext: boolean; hot: boolean; onHot: (id: string | null) => void; showRole: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <li
      aria-current={isNext ? 'step' : undefined}
      data-hot={hot || isNext}
      onMouseEnter={() => onHot(step.id)}
      onMouseLeave={() => onHot(null)}
      className={cn('ps-step flex min-w-0 items-start gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 md:px-3', isNext && 'ring-1 ring-foreground/15')}
    >
      <span
        aria-hidden
        className={cn(
          'mt-px flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-caption font-semibold tabular-nums',
          step.done ? 'ps-tone-bg ps-tone-border' : isNext ? 'ps-tone-border ps-tone-fg' : 'ps-tone-line-border text-muted-foreground',
        )}
      >
        {step.done ? <Check className="size-3.5" strokeWidth={3} /> : <Ltr>{num(step.n, locale)}</Ltr>}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:flex-row md:items-start md:gap-3">
        <p className={cn('min-w-0 flex-1 text-body text-pretty', step.done ? 'text-muted-foreground line-through decoration-muted-foreground/50' : 'text-foreground')}>
          <span className="sr-only">{fmt(t.stepNo, { n: num(step.n, locale) })}: </span>
          <bdi>
            <Bidi>{step.title}</Bidi>
          </bdi>
          {step.done && <span className="sr-only"> ({t.done})</span>}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {isNext && <span className="ps-tone-bg inline-flex h-5.5 items-center rounded-full px-2 text-caption font-semibold">{t.next}</span>}
          {step.taskKey && (
            <span className="inline-flex h-5.5 items-center gap-1 rounded-full border border-border bg-card px-2 text-caption text-muted-foreground">
              <SquareCheck aria-hidden className="size-3 text-type-task-fg" strokeWidth={2} />
              <Ltr mono>{step.taskKey}</Ltr>
            </span>
          )}
          {showRole && step.role && <RoleBadge role={step.role} />}
        </div>
      </div>
    </li>
  );
}

/**
 * The chapter under the map: the phase picked there, in its tone. A band names it (number, "Phase 1 of 8 · In progress", title,
 * note) with previous / next; under it a waffle of its steps (a square per step, filled when done, outlined for the next) beside
 * the step list. Pointing at a square lights its row and the other way round. Changing phase slides the chapter in (fade only
 * under reduced motion, through the page's MotionConfig).
 */
export function PhaseFocus({ group, last, nextId, onStep }: { group: PhaseGroup; last: number; nextId: string | null; onStep: (delta: 1 | -1) => void }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const [hot, setHot] = useState<string | null>(null);
  const state = phaseState(group);
  const percent = group.total ? Math.round((group.done / group.total) * 100) : 0;
  const title = group.phase?.title ?? t.unphased;
  const words = state === 'done' ? t.stateDone : state === 'now' ? t.stateNow : t.stateTodo;
  /** API text keeps its own direction but lines up with the page's start, as the eyebrow above it does. */
  const align = locale === 'ar' ? 'right' : 'left';
  const Prev = locale === 'ar' ? ChevronRight : ChevronLeft;
  const Next = locale === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <motion.section
      key={group.index}
      data-tone={toneOf(group.index)}
      aria-labelledby="ps-focus-title"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
      className="flex min-w-0 scroll-mt-4 flex-col gap-4"
    >
      <div className="ps-tone-soft flex min-w-0 items-start gap-3 rounded-xl p-3 md:gap-4 md:p-4">
        <span aria-hidden className="ps-tone-bg flex size-12 shrink-0 items-center justify-center rounded-xl text-title font-bold tabular-nums">
          {state === 'done' ? <Check className="size-6" strokeWidth={3} /> : <Ltr>{num(group.index, locale)}</Ltr>}
        </span>
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
              {group.steps.map((s) => (
                <span
                  key={s.id}
                  title={`${fmt(t.stepNo, { n: num(s.n, locale) })}: ${s.title}`}
                  data-state={s.done ? 'done' : s.id === nextId ? 'next' : 'todo'}
                  data-hot={hot === s.id}
                  onMouseEnter={() => setHot(s.id)}
                  onMouseLeave={() => setHot(null)}
                  className="ps-cell text-caption font-semibold tabular-nums"
                >
                  {s.done ? <Check className="size-3.5" strokeWidth={3} /> : <Ltr>{num(s.n, locale)}</Ltr>}
                </span>
              ))}
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
              <StepRow key={s.id} step={s} isNext={s.id === nextId} hot={hot === s.id} onHot={setHot} showRole={group.roles.length > 1} />
            ))}
          </ol>
          {state === 'done' && <p className="px-2 text-body-sm text-muted-foreground">{t.noNextHere}</p>}
        </div>
      </div>
    </motion.section>
  );
}
