/**
 * @file The contract between `CardService.apply` and every card action. Read apps/api/README.md first.
 * @description An action declares what should change; `apply` does permission, status machine, secret
 * filter, event, audit, outbox and publish. So a new action cannot forget any of them.
 */
import type {
  Actor,
  CardSource,
  CardType,
  ErrorCode,
  EventKind,
  NotificationKind,
  PermissionAction,
  Priority,
} from '@hub/contracts';
import type { z } from 'zod';

export type JsonObject = Record<string, unknown>;

export interface CardView {
  readonly id: string;
  readonly workspaceId: string;
  readonly seq: number;
  readonly key: string;
  readonly type: CardType;
  readonly title: string;
  readonly body: string | null;
  readonly status: string;
  readonly priority: string;
  readonly ownerRole: string | null;
  readonly assigneeId: string | null;
  readonly createdByKind: string;
  readonly createdById: string | null;
  readonly createdVia: string;
  readonly source: string;
  readonly externalKey: string | null;
  readonly module: string | null;
  readonly repo: string | null;
  readonly branch: string | null;
  readonly commitSha: string | null;
  readonly dueAt: Date | null;
  readonly closedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly tags: readonly string[];
  readonly commentCount: number;
  readonly eventSeq: number;
  readonly lastEventAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** The row of the type's detail table. */
  readonly detail: JsonObject | null;
}

export interface CardEventView {
  readonly id: string;
  readonly cardId: string;
  readonly seq: number;
  readonly kind: EventKind;
  readonly data: JsonObject;
  readonly createdAt: Date;
}

/** Which existing card. Null target means the action creates one. */
export type CardTarget = { readonly cardId: string } | { readonly cardKey: string };

/** Fields of the card header an action may set when creating. */
export interface CardCreateFields {
  readonly title: string;
  readonly body?: string | null;
  /** Must be a status of the type's machine. Defaults to the machine's initial status. */
  readonly status?: string;
  readonly priority?: Priority;
  readonly ownerRole?: string | null;
  readonly assigneeId?: string | null;
  readonly module?: string | null;
  readonly repo?: string | null;
  readonly branch?: string | null;
  readonly commitSha?: string | null;
  readonly dueAt?: Date | null;
  readonly tags?: readonly string[];
  readonly source?: CardSource;
  /** Idempotency key of adapters and importers (docs/03 §5.1). */
  readonly externalKey?: string | null;
}

/** Fields of the card header an action may change. Status is not here: the machine owns it. */
export type CardPatch = Partial<Omit<CardCreateFields, 'status' | 'source' | 'externalKey'>> & {
  readonly archivedAt?: Date | null;
};

export interface NotificationIntent {
  readonly kind: Exclude<NotificationKind, 'brief'>;
  /** A key in src/i18n/{en,ar}/notifications.json. `cardKey` and `title` are always available to it. */
  readonly i18nKey: string;
  readonly params?: Readonly<Record<string, string | number>>;
  /** Everyone holding one of these roles. The acting member is never notified of their own action. */
  readonly roles?: readonly string[];
  readonly userIds?: readonly string[];
  readonly data?: JsonObject;
}

/** Another action to run in the same transaction, with its own event and audit row. */
export interface FollowUp {
  readonly action: PermissionAction;
  readonly target: CardTarget | null;
  readonly payload: unknown;
  /**
   * The outer action was permitted, and this is its consequence: the matrix is not asked again. The actor is
   * still recorded. Required for a `system` row, such as `card.unblock`.
   */
  readonly trusted?: boolean;
}

export interface CardActionPlan {
  /** Required when the action has no target. */
  readonly create?: CardCreateFields;
  readonly patch?: CardPatch;
  /** Written to the type's detail table: created with the card, or merged into the row. */
  readonly detail?: JsonObject;
  /**
   * The one event of this mutation. Defaults: `created` when creating, `status_changed` when the machine
   * moves the status. `from` and `to` are added to `data` for you. An action that neither creates nor moves
   * the status must name its event.
   */
  readonly event?: { readonly kind: EventKind; readonly data?: JsonObject };
  /** The audit line. Defaults to `<action> <key>`. */
  readonly summary?: string;
  readonly notify?: readonly NotificationIntent[];
  /** Added on top of the automatic creator watcher. */
  readonly watchers?: readonly { readonly userId: string; readonly reason: string }[];
  /**
   * Extra writes in the same transaction, such as a comment or link row, through your own repository (it
   * joins through TransactionHost). What it returns is merged into the event's data. `prepared` holds the
   * results of `prepare`.
   */
  readonly write?: (card: CardView, prepared: readonly ApplyResult[]) => Promise<JsonObject | void>;
  /**
   * Actions to run before `write` and before this mutation's event, for when the event or a write needs what
   * they create: "create tasks from steps" records the new keys.
   */
  readonly prepare?: (card: CardView) => readonly FollowUp[];
  /** Runs after this mutation, in the same transaction, given the written card. */
  readonly followUps?: (card: CardView) => readonly FollowUp[];
  /**
   * Moves the status past the machine. Only for an adapter whose source of truth is elsewhere: the lab's file
   * (docs/06 §5). Must be a status of the type's machine.
   */
  readonly status?: string;
  /** No realtime message per card, for an adapter touching hundreds at once. It announces the run itself. */
  readonly quiet?: boolean;
  /** Nothing to change: no event, no audit row, no publish. The result carries the card's last event. */
  readonly noop?: boolean;
  /** Treat the card as closed for its dependants, as deleting does. Reaching a terminal status already counts. */
  readonly releasesDependants?: boolean;
}

export interface CardActionContext<P> {
  readonly actor: Actor;
  /** Null when creating. Locked for the transaction, so reading then acting is safe. */
  readonly card: CardView | null;
  readonly payload: P;
  readonly now: Date;
}

export interface CardActionDefinition<P = unknown> {
  /** `<type>.<verb>` for a type's action, `card.<verb>` for one that works on any type. */
  readonly action: PermissionAction;
  readonly payload: z.ZodType<P>;
  /**
   * Permission rows to require instead of `action`, for an action whose rows depend on the input, such as
   * an update that touches routing fields.
   */
  permissions?(payload: P, card: CardView | null): readonly PermissionAction[];
  /** The code to answer when the permission check fails. Default `hub.common.forbidden`. */
  readonly forbiddenCode?: ErrorCode;
  /** True for the action that restores a deleted card. Every other action refuses a deleted one. */
  readonly allowOnDeleted?: boolean;
  /** Rules the matrix and the machine cannot express; throw `AppException`. Must not write. */
  plan(context: CardActionContext<P>): CardActionPlan | Promise<CardActionPlan>;
}

export interface ApplyResult {
  readonly card: CardView;
  readonly event: CardEventView;
  readonly followUps: readonly ApplyResult[];
}

/** Metadata key behind `@CardActionHandler()`. */
export const CARD_ACTION_HANDLER = 'hub:card-action-handler';
