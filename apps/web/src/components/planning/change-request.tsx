'use client';

/**
 * @file change-request.tsx
 * @description A draft plan sent back from review says why, at the top of its sheet and its page (owner decision 9b, 2026-11-19): the reason, who asked,
 * and when. It goes once the plan is sent to review again.
 */
import { MessageSquareWarning } from 'lucide-react';

import { ActorChip } from '@/components/cards/avatar';
import { RelativeTime } from '@/components/common/relative-time';
import { Bidi } from '@/components/common/text';
import { useCardEvents } from '@/features/cards/store';
import type { PlanCard } from '@/features/cards/types';
import { changeRequestOf } from '@/features/planning/model';
import { useT } from '@/lib/i18n';

import type { PlanningMessages } from './messages';

export function ChangeRequestNote({ card }: { card: PlanCard }) {
  const p = useT<PlanningMessages>('planning').plan;
  const events = useCardEvents(card.status === 'draft' ? card.key : null);
  const request = changeRequestOf(card.status, events.data ?? []);
  if (!request) return null;
  return (
    <section
      aria-label={p.changesRequested}
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/60 p-3"
    >
      <p className="flex items-center gap-1.5 text-body-sm font-semibold text-foreground">
        <MessageSquareWarning
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
          strokeWidth={1.75}
        />
        {p.changesRequested}
      </p>
      <p className="text-body text-pretty text-foreground">
        <Bidi>{request.reason}</Bidi>
      </p>
      <p className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
        {p.changesRequestedBy}
        <ActorChip kind={request.actorKind} memberId={request.actorId} className="text-caption" />
        <RelativeTime iso={request.at} />
      </p>
    </section>
  );
}
