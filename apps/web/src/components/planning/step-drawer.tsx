'use client';

/**
 * @file step-drawer.tsx
 * @description A step opened from the chapter, the waffle or the list (v5-live-plan): a drawer from the page's end edge. It holds why the step
 * exists, its acceptance checks, what it waits for and what it opens the way to (each a link to that step), and its task. Radix traps focus, Esc
 * closes, and focus returns to the opener. Its evidence (batch 3) is `step-evidence.tsx`: before and after, pictures, clips, and adding one.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleDashed, Lock, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';

import {
  Bidi,
  CardChip,
  cn,
  fmt,
  focusRing,
  IconButton,
  longDate,
  Ltr,
  num,
  portalRoot,
  RoleBadge,
  StatusBadge,
  Tooltip,
  useLocale,
  useT,
} from '@/components/kit';
import { blockersOf, type JourneyStep, type PhaseGroup, toneOf } from '@/features/planning/journey';

import type { StepTask } from './detail-parts';
import type { PlanningMessages } from './messages';
import { waitsFor } from './phase-focus';
import { StepEvidenceSection } from './step-evidence';

const EASE = [0.2, 0.7, 0.2, 1] as const;

function StepLink({ step, onOpen }: { step: JourneyStep; onOpen: (id: string) => void }) {
  const j = useT<PlanningMessages>('planning').detail.journey;
  const locale = useLocale();
  return (
    <button
      type="button"
      onClick={() => onOpen(step.id)}
      className={cn(
        'flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-start hover:bg-accent',
        focusRing,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full border-2',
          step.done
            ? 'border-success bg-success text-success-foreground'
            : 'border-border text-muted-foreground',
        )}
      >
        {step.done ? (
          <Check className="size-3" strokeWidth={3} />
        ) : (
          <CircleDashed className="size-3" strokeWidth={2} />
        )}
      </span>
      <span className="shrink-0 text-caption font-semibold text-muted-foreground tabular-nums">
        <span className="sr-only">{fmt(j.stepNo, { n: num(step.n, locale) })}: </span>
        <span aria-hidden>
          <Ltr>{num(step.n, locale)}</Ltr>
        </span>
      </span>
      <span dir="auto" className="pj-clamp-2 min-w-0 flex-1 text-body-sm text-foreground">
        {step.title}
      </span>
      <span className="sr-only">{step.done ? j.stateDone : j.stateTodo}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="text-body-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function StepDrawer({
  step,
  groups,
  nextId,
  tasks,
  evidence,
  onOpenStep,
  onClose,
}: {
  step: JourneyStep | null;
  /** The plan the step is in, and what the member may do with its evidence. Absent: the section is not shown. */
  evidence?: { cardKey: string; canAdd: boolean; canRemove: boolean } | undefined;
  groups: PhaseGroup[];
  nextId: string | null;
  /** Each step's task, by key, where the page knows it. */
  tasks: ReadonlyMap<string, StepTask>;
  onOpenStep: (id: string) => void;
  onClose: () => void;
}) {
  const d = useT<PlanningMessages>('planning').detail;
  const j = d.journey;
  const locale = useLocale();
  const all = groups.flatMap((g) => g.steps);
  const group = step ? groups.find((g) => g.steps.some((s) => s.id === step.id)) : undefined;
  const blockers = step && !step.done ? blockersOf(step, all) : [];
  const deps = step
    ? (step.after ?? []).flatMap((id) => {
        const found = all.find((s) => s.id === id);
        return found ? [found] : [];
      })
    : [];
  const unlocks = step ? all.filter((s) => s.after?.includes(step.id)) : [];
  const checks = (step?.acceptance ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const task = step?.taskKey ? tasks.get(step.taskKey) : undefined;
  const phaseWords = group?.phase
    ? ` · ${fmt(j.phase, { n: num(group.index, locale) })}: ${group.phase.title}`
    : '';

  return (
    <Dialog.Root open={!!step} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence>
        {step && (
          <Dialog.Portal forceMount container={portalRoot()}>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="pj-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                data-pj-tone={group ? toneOf(group.index) : '0'}
                data-step-drawer
                className="pj-drawer"
                initial={{ x: locale === 'ar' ? '-100%' : '100%' }}
                animate={{ x: 0 }}
                exit={{ x: locale === 'ar' ? '-100%' : '100%' }}
                transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              >
                <div className="pj-tone-soft flex min-w-0 items-start gap-3 border-b border-border p-4">
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-xl text-body-lg font-bold',
                      step.done ? 'pj-tone-bg' : 'pj-tone-border pj-tone-fg border-2 bg-card',
                    )}
                  >
                    {step.done ? (
                      <Check className="size-5" strokeWidth={3} />
                    ) : (
                      <Ltr>{num(step.n, locale)}</Ltr>
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="pj-tone-fg text-caption font-semibold">
                      {fmt(j.stepNo, { n: num(step.n, locale) })}
                      <bdi>{phaseWords}</bdi>
                    </p>
                    <Dialog.Title dir="auto" className="text-title-sm font-bold text-pretty text-foreground">
                      <Bidi>{step.title}</Bidi>
                    </Dialog.Title>
                  </div>
                  <Dialog.Close asChild>
                    <IconButton label={j.closeDrawer}>
                      <X aria-hidden className="size-5" strokeWidth={1.75} />
                    </IconButton>
                  </Dialog.Close>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
                  <motion.div
                    key={step.id}
                    className="flex min-w-0 flex-col gap-5"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE, delay: 0.08 }}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {step.done ? (
                        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-success-soft px-2 text-caption font-semibold text-success-soft-foreground">
                          <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                          {step.doneAt ? fmt(j.doneOn, { date: longDate(step.doneAt, locale) }) : j.stateDone}
                        </span>
                      ) : step.id === nextId ? (
                        <span className="pj-tone-bg inline-flex h-6 items-center rounded-full px-2 text-caption font-semibold">
                          {j.next}
                        </span>
                      ) : null}
                      {blockers.length > 0 && (
                        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-warning-soft px-2 text-caption font-semibold text-warning-soft-foreground">
                          <Lock aria-hidden className="size-3.5" strokeWidth={2} />
                          {waitsFor(j, blockers, locale)}
                        </span>
                      )}
                      {step.size && (
                        <Tooltip content={j.effortHint}>
                          <span
                            tabIndex={0}
                            className={cn(
                              'inline-flex h-6 items-center gap-1 rounded-full border border-border px-2 text-caption text-foreground',
                              focusRing,
                            )}
                          >
                            {j.sizeLabel}: <Ltr>{step.size}</Ltr> · {j.sizes[step.size]}
                          </span>
                        </Tooltip>
                      )}
                      {step.role && <RoleBadge role={step.role} />}
                    </div>

                    {step.taskKey && (
                      <Section title={j.taskLabel}>
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <CardChip
                            k={step.taskKey}
                            type="task"
                            card={task}
                            title={task?.title}
                            showTitle={!!task?.title}
                            className="max-w-full"
                          />
                          {task && (
                            <StatusBadge
                              status={task.flags?.blocked && !task.closedAt ? 'blocked' : task.status}
                            />
                          )}
                        </div>
                      </Section>
                    )}

                    {evidence && (
                      <Section title={d.evidence.title}>
                        <StepEvidenceSection
                          cardKey={evidence.cardKey}
                          step={step}
                          canAdd={evidence.canAdd}
                          canRemove={evidence.canRemove}
                        />
                      </Section>
                    )}

                    <Section title={j.why}>
                      <p
                        dir="auto"
                        className={cn(
                          'text-body text-pretty',
                          step.why ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {step.why ?? j.noWhy}
                      </p>
                    </Section>

                    <Section title={j.acceptance}>
                      {checks.length === 0 ? (
                        <p className="text-body-sm text-muted-foreground">{j.noAcceptance}</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {checks.map((check, i) => (
                            <motion.li
                              key={`${i}-${check}`}
                              initial={{ opacity: 0, x: locale === 'ar' ? 12 : -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.25, delay: 0.12 + i * 0.06 }}
                              className="flex items-start gap-2 text-body-sm text-foreground"
                            >
                              <span
                                aria-hidden
                                className={cn(
                                  'mt-0.5 grid size-4.5 shrink-0 place-items-center rounded border-2',
                                  step.done ? 'pj-tone-bg pj-tone-border' : 'border-border',
                                )}
                              >
                                {step.done && <Check className="size-3" strokeWidth={3} />}
                              </span>
                              <span dir="auto">{check}</span>
                            </motion.li>
                          ))}
                        </ul>
                      )}
                    </Section>

                    {deps.length === 0 && unlocks.length === 0 ? (
                      <p className="text-body-sm text-muted-foreground">{j.noDeps}</p>
                    ) : (
                      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                        {deps.length > 0 && (
                          <Section title={j.dependsOn}>
                            <div className="flex flex-col gap-1.5">
                              {deps.map((d) => (
                                <StepLink key={d.id} step={d} onOpen={onOpenStep} />
                              ))}
                            </div>
                          </Section>
                        )}
                        {unlocks.length > 0 && (
                          <Section title={j.unlocks}>
                            <div className="flex flex-col gap-1.5">
                              {unlocks.map((d) => (
                                <StepLink key={d.id} step={d} onOpen={onOpenStep} />
                              ))}
                            </div>
                          </Section>
                        )}
                      </div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
