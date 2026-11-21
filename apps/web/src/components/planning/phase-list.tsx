'use client';

/**
 * @file phase-list.tsx
 * @description Every phase of a plan as a folding group (v5-live-plan): a heading that is a disclosure button (number, title, note, progress, role mix),
 * and its steps as the page's step timeline, each keeping its number in the whole plan. Folding animates the row height with CSS only, and not at all
 * under reduced motion; a folded group is `inert`. A plan with no phases is one plain timeline, with no disclosure and no repeated heading.
 */
import { Check, ChevronDown } from 'lucide-react';

import { cn, fmt, focusRingInset, kitMessages, Ltr, num, roleIcon, useLocale, useT } from '@/components/kit';
import type { JourneyStep, PhaseGroup } from '@/features/planning/journey';
import type { StepExtra } from '@/features/planning/plan-text';

import { ProgressMeter, StepsTimeline, type StepTask } from './detail-parts';
import type { PlanningMessages } from './messages';

/** Each step's details as the timeline draws them: `after` by the plan numbers of those steps. */
function extrasOf(steps: readonly JourneyStep[], all: readonly JourneyStep[]): StepExtra[] {
  const position = new Map(all.map((s) => [s.id, s.n]));
  return steps.map((s) => {
    const after = (s.after ?? []).flatMap((id) => {
      const n = position.get(id);
      return n === undefined ? [] : [n];
    });
    return {
      ...(s.why ? { why: s.why } : {}),
      ...(s.size ? { size: s.size } : {}),
      ...(after.length ? { after } : {}),
      ...(s.acceptance ? { acceptance: s.acceptance } : {}),
    };
  });
}

function RoleMix({ roles }: { roles: PhaseGroup['roles'] }) {
  const j = useT<PlanningMessages>('planning').detail.journey;
  const kit = useT(kitMessages);
  const locale = useLocale();
  if (roles.length === 0) return null;
  return (
    <span role="list" aria-label={j.roleMix} className="flex items-center gap-2.5">
      {roles.map(({ role, n }) => {
        const Icon = roleIcon[role];
        return (
          <span
            role="listitem"
            key={role}
            title={kit.roles[role]}
            className="inline-flex items-center gap-1 text-caption text-muted-foreground"
          >
            <Icon aria-hidden className="size-3.5" strokeWidth={1.75} />
            <span className="sr-only">{fmt(j.roleCount, { role: kit.roles[role], n: num(n, locale) })}</span>
            <span aria-hidden>
              <Ltr className="tabular-nums">{num(n, locale)}</Ltr>
            </span>
          </span>
        );
      })}
    </span>
  );
}

interface TimelineProps {
  all: readonly JourneyStep[];
  nextId: string | null;
  run?: { cardKey: string } | undefined;
  tasks: ReadonlyMap<string, StepTask>;
  anchor: string;
  onOpen: (id: string) => void;
}

function GroupTimeline({ steps, all, nextId, ...rest }: TimelineProps & { steps: readonly JourneyStep[] }) {
  const next = steps.findIndex((s) => s.id === nextId);
  return (
    <StepsTimeline steps={steps} nextIndex={next < 0 ? null : next} extras={extrasOf(steps, all)} {...rest} />
  );
}

export function PhaseList({
  groups,
  open,
  onToggle,
  ...timeline
}: TimelineProps & {
  groups: PhaseGroup[];
  open: ReadonlySet<number>;
  onToggle: (index: number) => void;
}) {
  const j = useT<PlanningMessages>('planning').detail.journey;
  const locale = useLocale();
  const phased = groups.some((g) => g.phase);

  if (!phased) {
    return <GroupTimeline steps={groups[0]?.steps ?? []} {...timeline} />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {groups.map((group) => {
        const complete = group.total > 0 && group.done === group.total;
        const shown = open.has(group.index);
        const panelId = `pj-phase-${group.index}-steps`;
        const title = group.phase?.title ?? j.noPhase;
        return (
          <section
            key={group.phase?.id ?? 'loose'}
            id={`pj-phase-${group.index}`}
            aria-labelledby={`pj-phase-${group.index}-title`}
            className="min-w-0 scroll-mt-4 rounded-xl border border-border bg-card"
          >
            <h3 id={`pj-phase-${group.index}-title`} className="m-0">
              <button
                type="button"
                aria-expanded={shown}
                aria-controls={panelId}
                onClick={() => onToggle(group.index)}
                className={cn(
                  'flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors duration-150 hover:bg-accent/60 md:px-4',
                  focusRingInset,
                )}
              >
                {group.phase && (
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg text-body-lg font-bold tabular-nums',
                      group.hasNext ? 'bg-foreground text-background' : 'bg-muted text-foreground',
                    )}
                  >
                    <Ltr>{num(group.index, locale)}</Ltr>
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    {group.phase && (
                      <span className="sr-only">{fmt(j.phase, { n: num(group.index, locale) })}: </span>
                    )}
                    <span dir="auto" className="text-body-lg font-semibold text-foreground">
                      {title}
                    </span>
                    {group.phase?.note && (
                      <span dir="auto" className="text-body-sm text-muted-foreground">
                        {group.phase.note}
                      </span>
                    )}
                    {group.hasNext && (
                      <span className="inline-flex h-5.5 items-center rounded-full border border-foreground/40 px-2 text-caption font-semibold text-foreground">
                        {j.here}
                      </span>
                    )}
                    {complete && (
                      <span className="inline-flex h-5.5 items-center gap-1 rounded-full bg-success-soft px-2 text-caption font-medium text-success-soft-foreground">
                        <Check aria-hidden className="size-3" strokeWidth={2.5} />
                        {j.phaseDone}
                      </span>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center gap-2">
                      <span className="text-body-sm text-muted-foreground tabular-nums">
                        {fmt(j.progress, { done: num(group.done, locale), total: num(group.total, locale) })}
                      </span>
                      <ProgressMeter done={group.done} total={group.total} className="w-16 md:w-24" />
                    </span>
                    <RoleMix roles={group.roles} />
                  </span>
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'size-5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
                    shown && 'rotate-180',
                  )}
                  strokeWidth={1.75}
                />
              </button>
            </h3>
            <div
              id={panelId}
              className={cn(
                'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
                shown ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
              inert={!shown}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="border-t border-border p-3 md:p-4">
                  {group.steps.length > 0 ? (
                    <GroupTimeline steps={group.steps} {...timeline} />
                  ) : (
                    <p className="text-body-sm text-muted-foreground">{j.noNextHere}</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
