/**
 * @file Persistence port of the card core. Every method joins the active transaction.
 */
import type { Actor, CardType, EventKind } from '@hub/contracts';

import type {
  CardCreateFields,
  CardEventView,
  CardPatch,
  CardTarget,
  CardView,
  JsonObject,
} from '../../domain/card-action';

export interface WorkspaceHeader {
  readonly id: string;
  readonly status: string;
}

export interface Recipient {
  readonly userId: string;
  readonly locale: string;
}

export abstract class CardRepository {
  abstract findWorkspace(workspaceId: string): Promise<WorkspaceHeader | null>;

  /** Loads the card and holds its row lock until the transaction ends. */
  abstract lockCard(workspaceId: string, target: CardTarget): Promise<CardView | null>;

  abstract insertCard(input: {
    readonly actor: Actor;
    readonly type: CardType;
    readonly status: string;
    readonly closedAt: Date | null;
    readonly fields: CardCreateFields;
    readonly detail: JsonObject;
    readonly now: Date;
  }): Promise<CardView>;

  abstract updateCard(input: {
    readonly card: CardView;
    readonly status: string;
    readonly closedAt: Date | null;
    readonly patch: CardPatch;
    readonly detail: JsonObject | undefined;
    readonly now: Date;
  }): Promise<CardView>;

  abstract insertEvent(input: {
    readonly actor: Actor;
    readonly card: CardView;
    readonly kind: EventKind;
    readonly data: JsonObject;
    readonly now: Date;
  }): Promise<CardEventView>;

  abstract addWatchers(
    cardId: string,
    watchers: readonly { readonly userId: string; readonly reason: string }[],
    now: Date,
  ): Promise<void>;

  /** Active members holding one of the roles, or named. */
  abstract findRecipients(
    workspaceId: string,
    roles: readonly string[],
    userIds: readonly string[],
  ): Promise<Recipient[]>;

  /** Reads a card outside any lock. */
  abstract findCard(workspaceId: string, target: CardTarget): Promise<CardView | null>;
}
