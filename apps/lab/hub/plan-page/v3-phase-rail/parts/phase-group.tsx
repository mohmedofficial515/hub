import { Check, ChevronDown, SquareCheck } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { Bidi, fmt, focusRingInset, kitMessages, Ltr, num, RoleBadge, roleIcon } from '../../../today/v5-peacock-app/kit';
import { messages } from '../i18n';
import type { NumberedStep, PhaseGroup as Group } from './model';

/** Words first, a thin neutral meter beside them, hidden from screen readers because the words say it. */
export function Meter({ done, total, className }: { done: number; total: number; className?: string }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <span aria-hidden className={cn('block h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <span className="block h-full rounded-full bg-foreground transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
    </span>
  );
}

function RoleMix({ roles }: { roles: Group['roles'] }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  return (
    <ul aria-label={t.roleMix} className="flex items-center gap-2.5">
      {roles.map(({ role, n }) => {
        const Icon = roleIcon[role];
        return (
          <li key={role} title={kit.roles[role]} className="inline-flex items-center gap-1 text-caption text-muted-foreground">
            <Icon aria-hidden className="size-3.5" strokeWidth={1.75} />
            <span className="sr-only">{fmt(t.roleCount, { role: kit.roles[role], n: num(n, locale) })}</span>
            <Ltr className="tabular-nums" >
              <span aria-hidden>{num(n, locale)}</span>
            </Ltr>
          </li>
        );
      })}
    </ul>
  );
}

function StepRow({ step, isNext }: { step: NumberedStep; isNext: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <li
      aria-current={isNext ? 'step' : undefined}
      className={cn(
        'flex min-w-0 items-start gap-3 rounded-lg px-2 py-2.5 md:px-3',
        isNext && 'bg-accent ring-1 ring-foreground/20',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-px flex size-6 shrink-0 items-center justify-center rounded-full border text-caption font-semibold tabular-nums',
          step.done ? 'border-transparent bg-foreground text-background' : isNext ? 'border-foreground text-foreground' : 'border-border text-muted-foreground',
        )}
      >
        {step.done ? <Check className="size-3.5" strokeWidth={2.5} /> : <Ltr>{num(step.n, locale)}</Ltr>}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:flex-row md:items-start md:gap-3">
        <p className={cn('min-w-0 flex-1 text-body text-pretty', step.done ? 'text-muted-foreground line-through decoration-muted-foreground/50' : 'text-foreground')}>
          <span className="sr-only">{fmt(t.nextStep, { n: num(step.n, locale) })}: </span>
          <bdi>
            <Bidi>{step.title}</Bidi>
          </bdi>
          {step.done && <span className="sr-only"> ({t.done})</span>}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {isNext && (
            <span className="inline-flex h-5.5 items-center rounded-full border border-foreground/40 px-2 text-caption font-semibold text-foreground">{t.next}</span>
          )}
          {step.taskKey && (
            <span className="inline-flex h-5.5 items-center gap-1 rounded-full border border-border bg-card px-2 text-caption text-muted-foreground">
              <SquareCheck aria-hidden className="size-3 text-type-task-fg" strokeWidth={2} />
              <Ltr mono>{step.taskKey}</Ltr>
            </span>
          )}
          {step.role && <RoleBadge role={step.role} />}
        </div>
      </div>
    </li>
  );
}

/**
 * One phase: a heading that is a disclosure button (number, title, note, role mix, progress), and its steps. The phase holding the
 * next step opens by default. Folding animates the row height with CSS only, and not at all under reduced motion.
 */
export function PhaseGroup({ group, open, onToggle, nextId, onlyGroup }: { group: Group; open: boolean; onToggle: () => void; nextId: string | null; onlyGroup: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const complete = group.total > 0 && group.done === group.total;
  const panelId = `phase-${group.index}-steps`;
  const title = group.phase?.title ?? t.unphased;

  if (onlyGroup) {
    // A plan with no phases: one plain list, no disclosure and no repeated "Steps" heading.
    return (
      <ol id={`phase-${group.index}`} aria-label={t.stepsTitle} className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border bg-card px-1.5 py-2 md:px-2">
        {group.steps.map((s) => (
          <StepRow key={s.id} step={s} isNext={s.id === nextId} />
        ))}
      </ol>
    );
  }

  return (
    <section id={`phase-${group.index}`} aria-labelledby={`phase-${group.index}-title`} className="min-w-0 scroll-mt-4 rounded-xl border border-border bg-card">
      <h3 id={`phase-${group.index}-title`} className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className={cn('flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors duration-150 hover:bg-accent/60 md:px-4', focusRingInset)}
        >
          {group.phase ? (
            <span
              aria-hidden
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg text-body-lg font-bold tabular-nums',
                group.hasNext ? 'bg-foreground text-background' : 'bg-muted text-foreground',
              )}
            >
              <Ltr>{num(group.index, locale)}</Ltr>
            </span>
          ) : null}
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {group.phase && <span className="sr-only">{fmt(t.phase, { n: num(group.index, locale) })}: </span>}
              <span dir="auto" className="text-body-lg font-semibold text-foreground">{title}</span>
              {group.phase?.note && <span dir="auto" className="text-body-sm text-muted-foreground">{group.phase.note}</span>}
              {group.hasNext && !onlyGroup && <span className="inline-flex h-5.5 items-center rounded-full border border-foreground/40 px-2 text-caption font-semibold text-foreground">{t.here}</span>}
              {complete && (
                <span className="inline-flex h-5.5 items-center gap-1 rounded-full bg-success-soft px-2 text-caption font-medium text-success-soft-foreground">
                  <Check aria-hidden className="size-3" strokeWidth={2.5} />
                  {t.phaseDone}
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-2">
                <span className="text-body-sm text-muted-foreground tabular-nums">{fmt(t.progress, { done: num(group.done, locale), total: num(group.total, locale) })}</span>
                <Meter done={group.done} total={group.total} className="w-16 md:w-24" />
              </span>
              <RoleMix roles={group.roles} />
            </span>
          </span>
          <ChevronDown aria-hidden className={cn('size-5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')} strokeWidth={1.75} />
        </button>
      </h3>
      <div
        id={panelId}
        className={cn('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <ol className="flex flex-col gap-0.5 border-t border-border px-1.5 py-2 md:px-2">
            {group.steps.map((s) => (
              <StepRow key={s.id} step={s} isNext={s.id === nextId} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
