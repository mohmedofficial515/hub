/**
 * @file What other modules do inside a card mutation, without the card core knowing them.
 * @description `modules/notifications` registers here, so the dependency points one way and `apply` stays the single
 * mutation path: a hook runs in the mutation's transaction, once per event, and what it returns is published after
 * commit. A hook that throws undoes the mutation, so a card and its inbox rows cannot disagree.
 */
import type { Actor, PermissionAction, RealtimeEnvelope } from '@hub/contracts';
import { Injectable } from '@nestjs/common';

import type { CardEventView, CardView, NotificationIntent } from '../domain/card-action';

export interface CardEventContext {
  readonly actor: Actor;
  readonly action: PermissionAction;
  readonly card: CardView;
  /** The card before this mutation. Null when it was just created. */
  readonly previous: CardView | null;
  readonly event: CardEventView;
  /** What the action's plan asked for, on top of the routing table. */
  readonly intents: readonly NotificationIntent[];
}

export interface CardEventHook {
  onEvent(context: CardEventContext): Promise<readonly RealtimeEnvelope[]>;
}

@Injectable()
export class CardEventHooks {
  private readonly hooks: CardEventHook[] = [];

  register(hook: CardEventHook): void {
    this.hooks.push(hook);
  }

  async run(context: CardEventContext): Promise<RealtimeEnvelope[]> {
    const envelopes: RealtimeEnvelope[] = [];
    for (const hook of this.hooks) envelopes.push(...(await hook.onEvent(context)));
    return envelopes;
  }
}
