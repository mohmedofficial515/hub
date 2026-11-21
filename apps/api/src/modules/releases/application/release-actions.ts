/**
 * @file Release actions (docs/04 §3.20). `includedKeys` become ids; an unknown key answers not found.
 */
import {
  type CreateReleaseInput,
  createReleaseSchema,
  type EditReleaseInput,
  editReleaseSchema,
  type GeneratedNotesInput,
  generatedNotesSchema,
  type ReleaseInput,
  releaseSchema,
  ROLES,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';

import {
  baseCreateFields,
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
  CardRepository,
  defined,
  type JsonObject,
  linkFollowUps,
} from '@/modules/cards';
import { AppException } from '@/shared/errors';

async function includedIds(
  cards: CardRepository,
  workspaceId: string,
  keys: readonly string[],
): Promise<string[]> {
  const found = await cards.findCardsByKeys(workspaceId, keys);
  if (found.length !== new Set(keys).size) throw new AppException('hub.cards.not_found');
  return found.map((card) => card.id);
}

@Injectable()
@CardActionHandler()
export class ReleaseCreateAction implements CardActionDefinition<CreateReleaseInput> {
  readonly action = 'release.create';
  readonly payload = createReleaseSchema;

  constructor(private readonly cards: CardRepository) {}

  async plan({ actor, payload }: CardActionContext<CreateReleaseInput>): Promise<CardActionPlan> {
    const { detail } = payload;
    const followUps = linkFollowUps(payload.links);
    return {
      create: baseCreateFields(payload),
      detail: {
        version: detail.version,
        repo: detail.repo ?? null,
        tag: detail.tag ?? null,
        includedIds: await includedIds(this.cards, actor.workspaceId, detail.includedKeys ?? []),
      },
      ...(followUps ? { followUps } : {}),
    };
  }
}

@Injectable()
@CardActionHandler()
export class ReleaseEditAction implements CardActionDefinition<EditReleaseInput> {
  readonly action = 'release.edit';
  readonly payload = editReleaseSchema;

  constructor(private readonly cards: CardRepository) {}

  async plan({ actor, card, payload }: CardActionContext<EditReleaseInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('release.edit needs a card');
    const { includedKeys, notes, ...fields } = payload;
    const detail: JsonObject = {
      ...defined(fields),
      ...(includedKeys
        ? { includedIds: await includedIds(this.cards, actor.workspaceId, includedKeys) }
        : {}),
      ...(notes ? { notes: { ...(card.detail?.['notes'] as JsonObject), ...defined(notes) } } : {}),
    };
    const names = Object.keys(detail);
    if (names.length === 0) return { noop: true };
    return {
      detail,
      event: { kind: 'field_changed', data: { changes: names.map((field) => ({ field })) } },
    };
  }
}

/** The template's skeleton, told apart from a person's edit in History: `generated` on the event (docs/07 §6.3). */
@Injectable()
@CardActionHandler()
export class ReleaseGenerateNotesAction implements CardActionDefinition<GeneratedNotesInput> {
  readonly action = 'release.generate_notes';
  readonly payload = generatedNotesSchema;

  plan({ card, payload }: CardActionContext<GeneratedNotesInput>): CardActionPlan {
    if (!card) throw new Error('release.generate_notes needs a card');
    if (Object.keys(payload.notes).length === 0) return { noop: true };
    return {
      detail: { notes: { ...(card.detail?.['notes'] as JsonObject), ...defined(payload.notes) } },
      event: { kind: 'field_changed', data: { changes: [{ field: 'notes' }], generated: true } },
    };
  }
}

@Injectable()
@CardActionHandler()
export class ReleaseReleaseAction implements CardActionDefinition<ReleaseInput> {
  readonly action = 'release.release';
  readonly payload = releaseSchema;

  plan({ payload, now }: CardActionContext<ReleaseInput>): CardActionPlan {
    return {
      detail: { releasedAt: payload.releasedAt ? new Date(payload.releasedAt) : now },
      notify: [{ kind: 'system', i18nKey: 'release_released', roles: [...ROLES] }],
    };
  }
}
