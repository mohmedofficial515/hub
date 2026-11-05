'use client';

/**
 * @file idea.tsx
 * @description Sheet section for an Idea (docs/15 §4): problem and notes. The Planning page's author adds "Turn into a plan" and editing here.
 */
import { CardChip } from '@/components/cards/card-key';
import { MarkdownView } from '@/components/common/markdown';
import { kitMessages, useT } from '@/lib/i18n';

import { type SectionProps, SubHeading } from './shared';

export function IdeaSection({ card }: SectionProps<'idea'>) {
  const s = useT(kitMessages).sections.idea;
  const d = card.idea;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <SubHeading>{s.problem}</SubHeading>
        {d.problem ? (
          <MarkdownView source={d.problem} />
        ) : (
          <p className="text-body text-muted-foreground">{s.noProblem}</p>
        )}
      </div>
      {d.notes && (
        <div className="flex flex-col gap-1.5">
          <SubHeading>{s.notes}</SubHeading>
          <MarkdownView source={d.notes} />
        </div>
      )}
      {d.planKey && (
        <div className="flex flex-col gap-1.5">
          <SubHeading>{s.planLink}</SubHeading>
          <CardChip k={d.planKey} showTitle showStatus className="self-start" />
        </div>
      )}
    </div>
  );
}
