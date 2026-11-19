'use client';

/**
 * @file plan-report.tsx
 * @description A proposed plan, whole, as `propose_plan` sent it: the goal and the approach, who does what, the ordered steps with their size and what
 * comes first, the flow, the checks, the risks and what is left out, the open questions and the sources. The Plan Studio shows it beside its conversation,
 * and the live draft page (`?draft=1`) shows the same plan the same way. Every section shows only when Claude sent it.
 */
import type { ProposedPlan } from '@hub/contracts';
import {
  AlertTriangle,
  Ban,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  Compass,
  ExternalLink,
  FileText,
  GitBranch,
  ListChecks,
  ListOrdered,
  Network,
  Target,
  Users,
} from 'lucide-react';

import { Bidi, cn, focusRing, num, plural, type Role, RoleBadge, useLocale, useT } from '@/components/kit';
import { rolesOf } from '@/features/planning/plan-studio';
import { hostOf } from '@/features/planning/studio-acts';

import type { PlanningMessages } from '../messages';
import { FlowDiagram } from './diagram';
import { Questions, ReportToc, Section } from './report';
import { STUDIO_ANCHOR } from './shared';

const ROLES = new Set<string>(['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa']);

/** A step's size is a neutral badge: its word tells small from large, and no colour reads as a warning. */
const SIZE_TONE = 'bg-muted text-foreground';

/** The roles' share of the steps, in neutral shades and the plan and idea colours only, so no share reads as danger, warning or success. */
const ROLE_BAR = [
  'bg-foreground',
  'bg-type-plan',
  'bg-foreground/60',
  'bg-type-idea',
  'bg-foreground/30',
  'bg-info',
];

export interface ProposedStep {
  title: string;
  why?: string | undefined;
  role?: string | undefined;
  size?: 'S' | 'M' | 'L' | undefined;
  after?: readonly number[] | undefined;
}

/** A proposed plan's numbered steps: each with its reason, role, size and the steps it waits for. One list for the Plan Studio and the Idea Studio. */
export function ProposedSteps({
  steps,
  tone = 'neutral',
  idPrefix,
}: {
  steps: readonly ProposedStep[];
  /** `plan` marks the numbers in the plan's colour, for a plan; `neutral` for a draft inside another report. */
  tone?: 'plan' | 'neutral';
  /** With a prefix, each step is an anchor (`<prefix>-<n>`) that "after" links can jump to. */
  idPrefix?: string | undefined;
}) {
  const t = useT<PlanningMessages>('planning');
  const p = t.planStudio;
  const locale = useLocale();
  const total = steps.length;
  return (
    <ol className="flex min-w-0 flex-col">
      {steps.map((s, i) => (
        <li
          key={`${i}-${s.title}`}
          id={idPrefix ? `${idPrefix}-${i + 1}` : undefined}
          className={cn('relative flex min-w-0 gap-3 pb-4 last:pb-0', idPrefix && STUDIO_ANCHOR)}
        >
          {i < total - 1 && <span aria-hidden className="absolute start-3.5 top-8 bottom-1 w-px bg-border" />}
          <span
            aria-hidden
            className={cn(
              'relative flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-semibold tabular-nums',
              tone === 'plan'
                ? 'border-type-plan/40 bg-type-plan-soft text-type-plan-fg'
                : 'border-border bg-card text-muted-foreground',
            )}
          >
            {num(i + 1, locale)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-1 pt-0.5">
            <span className="text-body-sm font-medium text-pretty text-foreground">
              <Bidi>{s.title}</Bidi>
            </span>
            {s.why && (
              <span className="text-caption text-pretty text-muted-foreground">
                <Bidi>{s.why}</Bidi>
              </span>
            )}
            {(s.role && ROLES.has(s.role)) || s.size || s.after?.length ? (
              <span className="flex flex-wrap items-center gap-1.5">
                {s.role && ROLES.has(s.role) && (
                  <RoleBadge role={s.role as Role} outline={false} className="text-caption" />
                )}
                {s.size && (
                  <span
                    title={p.sizeHint}
                    className={cn(
                      'inline-flex h-5 items-center rounded-full px-2 text-caption font-semibold',
                      SIZE_TONE,
                    )}
                  >
                    {p.sizes[s.size]}
                  </span>
                )}
                {s.after?.length ? <AfterChip after={s.after} idPrefix={idPrefix} /> : null}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** "After 1, 2": the steps that come first, each a link to its step when the steps are anchors. */
export function AfterChip({ after, idPrefix }: { after: readonly number[]; idPrefix?: string | undefined }) {
  const t = useT<PlanningMessages>('planning');
  const locale = useLocale();
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-muted px-2 text-caption text-muted-foreground">
      <GitBranch aria-hidden className="size-3" strokeWidth={1.75} />
      {t.planStudio.after}{' '}
      {after.map((n, j) => (
        <span key={n} className="tabular-nums">
          {idPrefix ? (
            <a
              href={`#${idPrefix}-${n}`}
              className={cn('font-semibold text-foreground hover:underline', focusRing)}
            >
              {num(n, locale)}
            </a>
          ) : (
            <span className="font-semibold text-foreground">{num(n, locale)}</span>
          )}
          {j < after.length - 1 ? t.studio.listSep : ''}
        </span>
      ))}
    </span>
  );
}

export function PlanReport({
  plan,
  onAsk,
  busy,
  blocked = false,
}: {
  plan: ProposedPlan;
  /** Sends a request about the plan (answers to its questions). Without it the questions are a list to read. */
  onAsk?: ((text: string) => boolean | Promise<boolean>) | undefined;
  busy: boolean;
  /** A request already waits for Claude: the answers hold back. */
  blocked?: boolean | undefined;
}) {
  const t = useT<PlanningMessages>('planning');
  const p = t.planStudio;
  const locale = useLocale();
  const roles = rolesOf(plan);
  const total = plan.steps.length;
  const sections = [
    { id: 'plan-goal', label: p.sections.approach, show: !!(plan.goal || plan.approach) },
    { id: 'plan-roles', label: p.sections.roles, show: roles.some((r) => r.role) },
    { id: 'plan-steps', label: p.sections.steps, show: true },
    { id: 'plan-diagram', label: p.sections.diagram, show: !!plan.diagram },
    { id: 'plan-checks', label: p.sections.checks, show: !!plan.checks?.length },
    { id: 'plan-risks', label: p.sections.risks, show: !!(plan.risks?.length || plan.outOfScope?.length) },
    { id: 'plan-questions', label: p.sections.questions, show: !!plan.questions?.length },
    { id: 'plan-sources', label: p.sections.sources, show: !!plan.sources?.length },
  ].filter((s) => s.show);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ReportToc sections={sections} label={t.studio.toc} />

      {(plan.goal || plan.approach) && (
        <div id="plan-goal" className={cn('grid gap-4 @page-lg:grid-cols-2', STUDIO_ANCHOR)}>
          {plan.goal && (
            <Section id="plan-goal-g" title={p.sections.goal} icon={Target}>
              <p className="text-body text-pretty text-foreground">
                <Bidi>{plan.goal}</Bidi>
              </p>
            </Section>
          )}
          {plan.approach && (
            <Section id="plan-approach" title={p.sections.approach} icon={Compass}>
              <p className="text-body text-pretty text-foreground">
                <Bidi>{plan.approach}</Bidi>
              </p>
            </Section>
          )}
        </div>
      )}

      {roles.some((r) => r.role) && (
        <Section id="plan-roles" title={p.sections.roles} icon={Users}>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            {roles.map((r, i) => (
              <span
                key={r.role ?? 'none'}
                className={cn('h-full', r.role ? ROLE_BAR[i % ROLE_BAR.length] : 'bg-muted-foreground/30')}
                style={{ width: `${(r.steps / total) * 100}%` }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {roles.map((r, i) => (
              <li
                key={r.role ?? 'none'}
                className="flex items-center gap-1.5 text-caption text-muted-foreground"
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2.5 rounded-full',
                    r.role ? ROLE_BAR[i % ROLE_BAR.length] : 'bg-muted-foreground/30',
                  )}
                />
                {r.role ? (
                  <RoleBadge role={r.role as Role} outline={false} className="text-caption" />
                ) : (
                  p.noRole
                )}
                <span className="tabular-nums">{plural(r.steps, locale, t.studio.chat.stepCount)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        id="plan-steps"
        title={p.sections.steps}
        icon={ListOrdered}
        aside={
          <span className="text-caption text-muted-foreground">
            {plural(total, locale, t.studio.chat.stepCount)}
          </span>
        }
      >
        <ProposedSteps steps={plan.steps} tone="plan" idPrefix="plan-step" />
      </Section>

      {plan.diagram && (
        <Section id="plan-diagram" title={plan.diagram.title || p.sections.diagram} icon={Network}>
          <FlowDiagram
            diagram={plan.diagram}
            words={{
              shapes: t.studio.shapes,
              listLabel: t.studio.diagramList,
              to: t.studio.to,
              sep: t.studio.listSep,
            }}
          />
        </Section>
      )}

      {!!plan.checks?.length && (
        <Section id="plan-checks" title={p.sections.checks} icon={ListChecks}>
          <ul className="flex min-w-0 flex-col gap-2">
            {plan.checks.map((c) => (
              <li key={c} className="flex min-w-0 items-start gap-2 text-body-sm text-foreground">
                <CheckCircle2
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-success"
                  strokeWidth={1.75}
                />
                <span className="min-w-0">
                  <Bidi>{c}</Bidi>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!!(plan.risks?.length || plan.outOfScope?.length) && (
        <div id="plan-risks" className={cn('grid gap-4 @page-lg:grid-cols-2', STUDIO_ANCHOR)}>
          {!!plan.risks?.length && (
            <Section id="plan-risks-r" title={p.sections.risks} icon={AlertTriangle}>
              <ul className="flex min-w-0 list-disc flex-col gap-1.5 ps-4 text-body-sm text-foreground marker:text-warning-strong">
                {plan.risks.map((r) => (
                  <li key={r}>
                    <Bidi>{r}</Bidi>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {!!plan.outOfScope?.length && (
            <Section id="plan-out" title={p.sections.outOfScope} icon={Ban}>
              <ul className="flex min-w-0 list-disc flex-col gap-1.5 ps-4 text-body-sm text-foreground marker:text-muted-foreground">
                {plan.outOfScope.map((r) => (
                  <li key={r}>
                    <Bidi>{r}</Bidi>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {!!plan.questions?.length && (
        <Section id="plan-questions" title={p.sections.questions} icon={CircleHelp}>
          <Questions
            questions={plan.questions}
            onAsk={onAsk}
            busy={busy}
            blocked={blocked}
            prompt={p.answersPrompt}
            label={p.sections.questions}
          />
        </Section>
      )}

      {!!plan.sources?.length && (
        <Section id="plan-sources" title={p.sections.sources} icon={BookOpen}>
          <ol className="flex min-w-0 flex-col gap-2">
            {plan.sources.map((s, i) => (
              <li key={`${s.url}-${i}`} className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-bold text-muted-foreground tabular-nums">
                  {num(i + 1, locale)}
                </span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('group flex min-w-0 flex-col rounded-md', focusRing)}
                >
                  <span className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground group-hover:text-primary group-hover:underline">
                    <Bidi>{s.title}</Bidi>
                    <ExternalLink aria-hidden className="size-3 shrink-0" />
                  </span>
                  <span dir="ltr" className="truncate text-start text-caption text-muted-foreground">
                    {hostOf(s.url)}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <FileText aria-hidden className="size-3.5" strokeWidth={1.75} />
        {p.draftNote}
      </p>
    </div>
  );
}
