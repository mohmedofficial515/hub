/**
 * @file What the scanner does to a version it already knows (docs/06 §5). System only.
 * @description The file is the truth, so `status` bypasses the machine, and a status from the file does not set
 * `approvedBy`: only the API's action does.
 */
import { REDESIGN_STATUSES } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
  defined,
} from '@/modules/cards';

const syncSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(20_000).optional(),
  status: z.enum(REDESIGN_STATUSES).optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
  presence: z.enum(['present', 'missing']),
  changed: z.boolean().optional(),
});
type SyncInput = z.infer<typeof syncSchema>;

const MISSING = 'missing-in-lab';

@Injectable()
@CardActionHandler()
export class RedesignSyncAction implements CardActionDefinition<SyncInput> {
  readonly action = 'redesign.sync';
  readonly payload = syncSchema;

  plan({ card, payload }: CardActionContext<SyncInput>): CardActionPlan {
    if (!card) throw new Error('redesign.sync needs a card');
    const tagged = card.tags.includes(MISSING);
    if (payload.presence === 'missing') {
      return {
        patch: { tags: [...card.tags, MISSING] },
        event: { kind: 'field_changed', data: { field: 'presence', to: 'missing' } },
      };
    }
    const moved = payload.status !== undefined && payload.status !== card.status;
    return {
      patch: defined({
        title: payload.title,
        body: payload.body,
        ...(tagged ? { tags: card.tags.filter((tag) => tag !== MISSING) } : {}),
      }),
      ...(payload.detail ? { detail: payload.detail } : {}),
      ...(moved ? { status: payload.status as string } : {}),
      event: moved
        ? { kind: 'status_changed', data: { reason: 'lab_file' } }
        : { kind: 'field_changed', data: { field: payload.changed === false ? 'review' : 'readme' } },
      summary: moved
        ? `Lab file moved ${card.key} to ${String(payload.status)}`
        : `Lab file changed ${card.key}`,
    };
  }
}
