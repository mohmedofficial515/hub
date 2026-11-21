/**
 * @file `PATCH /cards/{key}`: edit the header of any card (docs/04 §3.8).
 * @description One `field_changed` event listing every field, or none when nothing changed. Content and routing
 * fields are different permission rows. A routed role is mirrored into the detail's copy. A plan's body keeps
 * its revision history wherever the edit came from.
 */
import { createHash } from 'node:crypto';

import { CARD_LIMITS, type PermissionAction, type UpdateCardInput, updateCardSchema } from '@hub/contracts';
import { Injectable } from '@nestjs/common';

import { AppException } from '@/shared/errors';

import type {
  CardActionContext,
  CardActionDefinition,
  CardActionPlan,
  CardPatch,
  CardView,
  JsonObject,
} from '../../domain/card-action';
import { CardActionHandler } from '../card-action.registry';
import { CardRepository } from '../ports/card.repository';

const ROUTING_FIELDS: readonly (keyof UpdateCardInput)[] = ['priority', 'ownerRole', 'dueAt', 'assignee'];

/** The field of a type's detail that repeats `cards.owner_role` (docs/03 §6). */
const ROUTED_DETAIL_FIELD: Partial<Record<CardView['type'], string>> = {
  decision: 'deciderRole',
  need: 'responsibleRole',
  handoff: 'toRole',
};

function hashOf(body: string | null): string | null {
  return body === null ? null : createHash('sha256').update(body).digest('hex').slice(0, 16);
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

@Injectable()
@CardActionHandler()
export class CardEditAction implements CardActionDefinition<UpdateCardInput> {
  readonly action = 'card.edit_content';
  readonly payload = updateCardSchema;

  constructor(private readonly cards: CardRepository) {}

  permissions(payload: UpdateCardInput): readonly PermissionAction[] {
    const keys = Object.keys(payload) as (keyof UpdateCardInput)[];
    const routing = keys.some((key) => ROUTING_FIELDS.includes(key));
    const content = keys.some((key) => !ROUTING_FIELDS.includes(key));
    return [
      ...(content ? ['card.edit_content' as const] : []),
      ...(routing ? ['card.edit_routing' as const] : []),
    ];
  }

  async plan({ actor, card, payload }: CardActionContext<UpdateCardInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('card.edit_content needs a card');
    const isPlan = card.type === 'plan';
    if (!isPlan && (payload.body?.length ?? 0) > CARD_LIMITS.body) {
      throw new AppException('hub.common.validation', { details: { issues: [{ path: 'body' }] } });
    }
    if (payload.assignee) {
      const [member] = await this.cards.findRecipients(actor.workspaceId, [], [payload.assignee]);
      if (!member)
        throw new AppException('hub.common.not_found', { details: { assignee: payload.assignee } });
    }

    const wanted: Partial<Record<keyof CardPatch, unknown>> = {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.body !== undefined ? { body: payload.body } : {}),
      ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
      ...(payload.ownerRole !== undefined ? { ownerRole: payload.ownerRole } : {}),
      ...(payload.dueAt !== undefined
        ? { dueAt: payload.dueAt === null ? null : new Date(payload.dueAt) }
        : {}),
      ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
      ...(payload.module !== undefined ? { module: payload.module } : {}),
      ...(payload.assignee !== undefined ? { assigneeId: payload.assignee } : {}),
      ...(payload.repo !== undefined ? { repo: payload.repo } : {}),
      ...(payload.branch !== undefined ? { branch: payload.branch } : {}),
    };
    const current = card as unknown as Record<string, unknown>;
    const changed = Object.entries(wanted).filter(([field, value]) => !same(current[field], value));
    if (changed.length === 0) return { noop: true };

    const changes = changed.map(([field, value]) =>
      field === 'body'
        ? { field, from: hashOf(card.body), to: hashOf(value as string | null) }
        : { field, from: current[field] ?? null, to: value ?? null },
    );
    const patch = Object.fromEntries(changed) as CardPatch;
    const bodyChanged = changed.some(([field]) => field === 'body');
    const routed = ROUTED_DETAIL_FIELD[card.type];
    const detail: JsonObject = {
      ...(routed && payload.ownerRole ? { [routed]: payload.ownerRole } : {}),
      ...(isPlan && bodyChanged ? { revision: Number(card.detail?.['revision'] ?? 1) + 1 } : {}),
    };
    const newAssignee = changed.some(([field]) => field === 'assigneeId') ? payload.assignee : null;
    return {
      patch,
      ...(Object.keys(detail).length > 0 ? { detail } : {}),
      event:
        isPlan && bodyChanged
          ? {
              kind: 'plan_revised',
              data: { revision: detail['revision'], previousBody: card.body, changes },
            }
          : { kind: 'field_changed', data: { changes } },
      ...(newAssignee ? { watchers: [{ userId: newAssignee, reason: 'assignee' }] } : {}),
    };
  }
}
