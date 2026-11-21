'use client';

/**
 * @file step-details.tsx
 * @description A plan step's details, the same on the plan's page and in its sheet (owner decision 9a, 2026-11-19): why as a muted line, size as a small
 * badge, after as "after step n", and acceptance as a checklist line.
 */
import { GitBranch, ListChecks } from 'lucide-react';
import { Fragment } from 'react';

import { focusRing } from '@/components/cards/meta';
import { Bidi, fmt } from '@/components/common/text';
import type { StepExtra } from '@/features/planning/plan-text';
import { num } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import type { PlanningMessages } from './messages';

/** Why the step is there: one muted line under its title. */
export function StepWhy({ why }: { why: string }) {
  const p = useT<PlanningMessages>('planning').plan;
  return (
    <p className="text-caption text-pretty text-muted-foreground">
      <span className="sr-only">{p.whyLabel}: </span>
      <Bidi>{why}</Bidi>
    </p>
  );
}

/** S, M or L, in the reader's words. */
export function StepSize({ size }: { size: NonNullable<StepExtra['size']> }) {
  const t = useT<PlanningMessages>('planning');
  const word = t.planStudio.sizes[size];
  return (
    <span
      title={fmt(t.plan.sizeLabel, { size: word })}
      className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-caption font-semibold text-foreground"
    >
      <span className="sr-only">{fmt(t.plan.sizeLabel, { size: word })}</span>
      <span aria-hidden>{word}</span>
    </span>
  );
}

/** "After step 2", or "After steps 1, 2". With an anchor, each number jumps to its step. */
export function StepAfter({ after, anchor }: { after: readonly number[]; anchor?: string | undefined }) {
  const t = useT<PlanningMessages>('planning');
  const locale = useLocale();
  const [head, tail] = (after.length === 1 ? t.plan.afterStep : t.plan.afterSteps).split('{n}');
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-muted px-2 text-caption text-muted-foreground">
      <GitBranch aria-hidden className="size-3" strokeWidth={1.75} />
      <span>
        {head}
        {after.map((n, j) => (
          <Fragment key={n}>
            {anchor ? (
              <a
                href={`#${anchor}-${n}`}
                className={cn('font-semibold text-foreground tabular-nums hover:underline', focusRing)}
              >
                {num(n, locale)}
              </a>
            ) : (
              <span className="font-semibold text-foreground tabular-nums">{num(n, locale)}</span>
            )}
            {j < after.length - 1 ? t.studio.listSep : ''}
          </Fragment>
        ))}
        {tail}
      </span>
    </span>
  );
}

/** When the step is done, as one line of a checklist. */
export function StepAcceptance({ acceptance }: { acceptance: string }) {
  const p = useT<PlanningMessages>('planning').plan;
  return (
    <p className="flex min-w-0 items-start gap-1.5 text-caption text-foreground">
      <ListChecks aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <span className="min-w-0">
        <span className="font-medium text-muted-foreground">{p.acceptance}: </span>
        <Bidi>{acceptance}</Bidi>
      </span>
    </p>
  );
}
