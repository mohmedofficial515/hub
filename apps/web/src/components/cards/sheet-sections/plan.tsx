'use client';

/**
 * @file plan.tsx
 * @description Sheet section for a Plan (docs/15 §4): its written approach and its steps with progress. The Planning page's author adds editing
 * of the Markdown and "Create tasks from steps" here.
 */
import { Check, Circle } from 'lucide-react';

import { CardChip } from '@/components/cards/card-key';
import { MarkdownView } from '@/components/common/markdown';
import { fmt } from '@/components/common/text';
import { num } from '@/lib/format';
import { kitMessages, useLocale, useT } from '@/lib/i18n';

import { type SectionProps, SubHeading } from './shared';

export function PlanSection({ card }: SectionProps<'plan'>) {
  const s = useT(kitMessages).sections.plan;
  const locale = useLocale();
  const { body, steps } = card.plan;
  const done = steps.filter((step) => step.done).length;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <SubHeading>{s.steps}</SubHeading>
        {steps.length === 0 ? (
          <p className="text-body text-muted-foreground">{s.noSteps}</p>
        ) : (
          <>
            <p className="text-body-sm text-muted-foreground">
              {fmt(s.progress, { done: num(done, locale), total: num(steps.length, locale) })}
            </p>
            <ul className="flex flex-col gap-2">
              {steps.map((step) => (
                <li key={step.id} className="flex items-start gap-2 text-body text-foreground">
                  {step.done ? (
                    <Check
                      aria-hidden
                      className="mt-1 size-4 shrink-0 text-success-soft-foreground"
                      strokeWidth={1.75}
                    />
                  ) : (
                    <Circle
                      aria-hidden
                      className="mt-1 size-4 shrink-0 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                  )}
                  <span className="min-w-0 flex-1">{step.title}</span>
                  {step.taskKey && <CardChip k={step.taskKey} showStatus />}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <SubHeading>{s.body}</SubHeading>
        {body ? (
          <MarkdownView source={body} />
        ) : (
          <p className="text-body text-muted-foreground">{s.noBody}</p>
        )}
      </div>
    </div>
  );
}
