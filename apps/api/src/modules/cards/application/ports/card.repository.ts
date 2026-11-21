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
  readonly slug: string;
  readonly defaultLocale: string;
}

export interface CommentRow {
  readonly id: string;
  readonly cardId: string;
  readonly authorKind: string;
  readonly authorId: string;
  readonly via: string;
  readonly body: string;
  readonly bodyRedactedAt: Date | null;
  readonly createdAt: Date;
  readonly editedAt: Date | null;
}

/** A row of `card_links`: `from` blocks `to`, and `from`'s parent is `to` (docs/03 §5). */
export interface LinkEdge {
  readonly fromCardId: string;
  readonly toCardId: string;
  readonly kind: string;
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

  abstract findCardsByKeys(workspaceId: string, keys: readonly string[]): Promise<CardView[]>;

  abstract findLastEvent(card: CardView): Promise<CardEventView>;

  /** Writes the detail row outside the plan's `detail`, from a `write` that needed what `prepare` created. */
  abstract updateDetail(card: CardView, detail: JsonObject): Promise<void>;

  /** Open, not deleted cards this card blocks. */
  abstract findDependants(card: CardView): Promise<CardView[]>;

  /** True when an open, not deleted card blocks this one. */
  abstract hasOpenBlockers(card: CardView): Promise<boolean>;

  abstract findWatcherIds(cardId: string): Promise<string[]>;

  abstract removeWatcher(cardId: string, userId: string): Promise<boolean>;

  abstract isWatching(cardId: string, userId: string): Promise<boolean>;

  /** Display names of these members, for rendered text. */
  abstract findUserNames(ids: readonly string[]): Promise<Map<string, string>>;

  /** A setting's stored value, or undefined when the project keeps the default. */
  abstract readSetting(workspaceId: string, key: string): Promise<unknown>;

  /** These settings for these projects, in one query: project id to key to stored value. */
  abstract readSettings(
    workspaceIds: readonly string[],
    keys: readonly string[],
  ): Promise<Map<string, Map<string, unknown>>>;

  abstract insertComment(input: {
    readonly actor: Actor;
    readonly card: CardView;
    readonly body: string;
    readonly now: Date;
  }): Promise<CommentRow>;

  abstract findComment(card: CardView, commentId: string): Promise<CommentRow | null>;

  abstract updateCommentBody(card: CardView, commentId: string, body: string, now: Date): Promise<void>;

  /** Empties the body, and drops the excerpt the comment's event kept, so the text is gone everywhere. */
  abstract redactComment(card: CardView, commentId: string, now: Date): Promise<void>;

  abstract findLink(card: CardView, edge: LinkEdge): Promise<boolean>;

  abstract insertLink(card: CardView, edge: LinkEdge, createdById: string | null): Promise<void>;

  abstract deleteLink(card: CardView, edge: LinkEdge): Promise<void>;

  /** Who `ids` point at, along one link kind. */
  abstract findLinkTargets(card: CardView, ids: readonly string[], kind: string): Promise<string[]>;

  /** The cards this one's `parent` rows point at. */
  abstract findParents(card: CardView): Promise<CardView[]>;

  /** The `plan_revised` event that replaced a revision, which holds that revision's text. */
  abstract findRevisionEvent(card: CardView, revision: number): Promise<CardEventView | null>;
}
