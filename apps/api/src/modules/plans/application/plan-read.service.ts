/**
 * @file A plan's revisions: each `plan_revised` event holds the text it replaced.
 */
import type { Actor, PlanRevision } from '@hub/contracts';
import { Injectable } from '@nestjs/common';

import { CardQueryService, CardReader } from '@/modules/cards';
import { AppException } from '@/shared/errors';

@Injectable()
export class PlanReadService {
  constructor(
    private readonly query: CardQueryService,
    private readonly reader: CardReader,
  ) {}

  /** Newest first, the current one on top. */
  async revisions(actor: Actor, key: string): Promise<PlanRevision[]> {
    const card = await this.query.readable(actor, { cardKey: key });
    if (card.type !== 'plan') throw new AppException('hub.cards.type_mismatch');
    const events = await this.reader.findPlanRevisions(actor.workspaceId, card.id);
    const users = await this.reader.findUsers(
      events.flatMap((event) => (event.actorId ? [event.actorId] : [])),
    );
    const current: PlanRevision = {
      revision: Number(card.detail?.['revision'] ?? 1),
      body: card.body,
      savedAt: events[0]?.createdAt.toISOString() ?? card.createdAt.toISOString(),
      actor: null,
      current: true,
    };
    return [
      current,
      ...events.map((event): PlanRevision => {
        const actorName = event.actorId ? (users.get(event.actorId)?.displayName ?? null) : null;
        const previous = events.find(
          (other) => Number(other.data['revision']) === Number(event.data['revision']) - 1,
        );
        return {
          revision: Number(event.data['revision']) - 1,
          body: (event.data['previousBody'] ?? null) as string | null,
          savedAt: previous?.createdAt.toISOString() ?? card.createdAt.toISOString(),
          actor: {
            kind: event.actorKind === 'agent' || event.actorKind === 'system' ? event.actorKind : 'user',
            userId: event.actorId,
            displayName: actorName,
            via: event.via,
          },
          current: false,
        };
      }),
    ];
  }
}
