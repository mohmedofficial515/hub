/**
 * @file What card actions share: create fields from a payload, links on create, and the plain status moves.
 * @description A status move with no extra rule is one small subclass here, named for its permission row.
 */
import {
  type LinkInput,
  type OptionalReasonInput,
  optionalReasonSchema,
  type PermissionAction,
  type ReasonInput,
  reasonSchema,
} from '@hub/contracts';
import { z } from 'zod';

import type {
  CardActionContext,
  CardActionDefinition,
  CardActionPlan,
  CardCreateFields,
  FollowUp,
  JsonObject,
} from '../domain/card-action';

interface BaseCreatePayload {
  readonly title: string;
  readonly body?: string | undefined;
  readonly priority?: CardCreateFields['priority'] | undefined;
  readonly dueAt?: string | undefined;
  readonly tags?: readonly string[] | undefined;
  readonly module?: string | undefined;
  readonly repo?: string | undefined;
}

/** The header fields every create payload shares. */
export function baseCreateFields(payload: BaseCreatePayload): CardCreateFields {
  return {
    title: payload.title,
    body: payload.body ?? null,
    ...(payload.priority ? { priority: payload.priority } : {}),
    dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
    tags: payload.tags ?? [],
    module: payload.module ?? null,
    repo: payload.repo ?? null,
  };
}

/** `links` on a create payload: each is a `card.link` in the same transaction, so a bad one undoes the card. */
export function linkFollowUps(links: readonly LinkInput[] | undefined): CardActionPlan['followUps'] {
  if (!links || links.length === 0) return undefined;
  return (card): readonly FollowUp[] =>
    links.map((link) => ({
      action: 'card.link',
      target: { cardId: card.id },
      payload: { op: 'add', kind: link.kind, key: link.key },
    }));
}

/** Drops undefined keys, for a patch built from optional fields under `exactOptionalPropertyTypes`. */
export function defined<T extends object>(value: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

/** A text field of the card's detail, or the fallback when it is empty. */
export function detailText(
  card: { readonly detail: JsonObject | null },
  field: string,
  fallback = '',
): string {
  const value = card.detail?.[field];
  return typeof value === 'string' ? value : fallback;
}

/** A status move with no payload and no rule of its own. */
export abstract class PlainTransition implements CardActionDefinition<Record<string, never>> {
  abstract readonly action: PermissionAction;
  readonly payload = z.object({}) as unknown as z.ZodType<Record<string, never>>;

  plan(_context: CardActionContext<Record<string, never>>): CardActionPlan {
    return {};
  }
}

/** A status move with an optional reason, kept on its event. */
export abstract class OptionalReasonTransition implements CardActionDefinition<OptionalReasonInput> {
  abstract readonly action: PermissionAction;
  readonly payload: z.ZodType<OptionalReasonInput> = optionalReasonSchema;

  plan({ payload }: CardActionContext<OptionalReasonInput>): CardActionPlan {
    return payload.reason ? { event: { kind: 'status_changed', data: { reason: payload.reason } } } : {};
  }
}

/** A status move that must say why: cancel, withdraw, dismiss, abandon. */
export abstract class ReasonTransition implements CardActionDefinition<ReasonInput> {
  abstract readonly action: PermissionAction;
  readonly payload: z.ZodType<ReasonInput> = reasonSchema;

  plan({ payload }: CardActionContext<ReasonInput>): CardActionPlan {
    return { event: { kind: 'status_changed', data: { reason: payload.reason } } };
  }
}
