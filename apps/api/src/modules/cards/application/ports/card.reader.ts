/**
 * @file Read side of the card core: lists, the timeline and what `CardFull` joins. Nothing here takes a lock.
 */
import type { CardFlag, CardSort, CardType } from '@hub/contracts';

import type { Prisma } from '@/generated/prisma/client';

import type { CardView, JsonObject } from '../../domain/card-action';

export interface CardFilter {
  readonly types?: readonly CardType[];
  readonly statuses?: readonly string[];
  readonly roles?: readonly string[];
  readonly assigneeId?: string;
  readonly createdById?: string;
  readonly repos?: readonly string[];
  readonly modules?: readonly string[];
  readonly tags?: readonly string[];
  readonly q?: string;
  readonly dueBefore?: Date;
  readonly flags?: readonly CardFlag[];
  /** Default false: a deleted card appears on no list but the Deleted view (D28). */
  readonly deleted?: boolean;
  /** Type-specific conditions from the type's module. */
  readonly where?: Prisma.CardWhereInput;
  /** The moments `overdue` and `stale` compare with. */
  readonly now: Date;
  readonly staleHandoffBefore: Date;
  readonly staleNeedBefore: Date;
}

export interface CardPage {
  readonly cursor?: string | undefined;
  readonly limit: number;
  readonly sort: CardSort | 'createdAsc';
}

export interface UserCard {
  readonly id: string;
  readonly displayName: string;
  readonly avatarColor: string;
}

export interface LinkRow {
  readonly kind: 'blocks' | 'blocked_by' | 'relates' | 'parent' | 'child' | 'duplicates';
  readonly card: CardView;
}

export interface WatcherRow {
  readonly userId: string;
  readonly reason: string;
}

export interface AttachmentRow {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface EventRow {
  readonly id: string;
  readonly cardId: string;
  readonly seq: number;
  readonly kind: string;
  readonly actorKind: string;
  readonly actorId: string | null;
  readonly via: string;
  readonly data: JsonObject;
  readonly createdAt: Date;
}

export interface CommentView {
  readonly id: string;
  readonly authorKind: string;
  readonly authorId: string;
  readonly via: string;
  readonly body: string;
  readonly bodyRedactedAt: Date | null;
  readonly createdAt: Date;
  readonly editedAt: Date | null;
}

export interface TimelineFilter {
  readonly from?: Date;
  readonly to?: Date;
  readonly types?: readonly string[];
  readonly roles?: readonly string[];
  readonly repos?: readonly string[];
  readonly modules?: readonly string[];
  readonly actors?: readonly string[];
  readonly kinds?: readonly string[];
  readonly q?: string;
  /** Events on cards this member watches, owns or claimed. */
  readonly mineUserId?: string;
  /** Leaves out this member's own events: "since my last visit" (docs/09 §4). */
  readonly excludeActorId?: string;
}

export abstract class CardReader {
  /** One page more than `limit` when there is more. */
  abstract findCards(workspaceId: string, filter: CardFilter, page: CardPage): Promise<CardView[]>;

  /** Every matching card up to `max`, for rules only code can judge. */
  abstract findCandidates(
    workspaceId: string,
    filter: CardFilter,
    where: Prisma.CardWhereInput,
    max: number,
  ): Promise<CardView[]>;

  abstract findByIds(workspaceId: string, ids: readonly string[]): Promise<CardView[]>;

  /** Not deleted cards matching `where` in any of these projects, newest activity first. One query, for a list of projects. */
  abstract findCandidatesAcross(
    workspaceIds: readonly string[],
    where: Prisma.CardWhereInput,
  ): Promise<CardView[]>;

  abstract findByIdsAcross(workspaceIds: readonly string[], ids: readonly string[]): Promise<CardView[]>;

  abstract findBlockedAcross(workspaceIds: readonly string[], ids: readonly string[]): Promise<Set<string>>;

  abstract findUsers(ids: readonly string[]): Promise<Map<string, UserCard>>;

  /** Which of these cards an open, not deleted card blocks. */
  abstract findBlocked(workspaceId: string, ids: readonly string[]): Promise<Set<string>>;

  /** Both ends of every link, the other card not deleted. */
  abstract findLinks(workspaceId: string, cardId: string): Promise<LinkRow[]>;
  /** How many open cards each of these blocks. A card blocking nothing is absent. */
  abstract countBlocking(workspaceId: string, ids: readonly string[]): Promise<Map<string, number>>;

  /** The keys of the open cards blocking each of these: card id to keys. */
  abstract findBlockerKeys(workspaceId: string, ids: readonly string[]): Promise<Map<string, string[]>>;

  abstract findBlockedBy(
    workspaceId: string,
    blockerIds: readonly string[],
  ): Promise<Map<string, CardView[]>>;

  abstract findWatchers(cardId: string): Promise<WatcherRow[]>;

  abstract findAttachments(cardId: string): Promise<AttachmentRow[]>;

  abstract findEvents(
    workspaceId: string,
    cardId: string,
    cursor: { seq: number } | null,
    limit: number,
  ): Promise<EventRow[]>;

  abstract findComments(
    workspaceId: string,
    cardId: string,
    cursor: { createdAt: Date; id: string } | null,
    limit: number,
  ): Promise<CommentView[]>;

  abstract findComment(workspaceId: string, commentId: string): Promise<CommentView | null>;

  /** Newest first, watch events left out, deleted cards left out. */
  abstract findTimeline(
    workspaceId: string,
    filter: TimelineFilter,
    cursor: { createdAt: Date; id: string } | null,
    limit: number,
  ): Promise<EventRow[]>;

  /** How many events `findTimeline` would answer, before folding. One number for "since last visit". */
  abstract countTimeline(workspaceId: string, filter: TimelineFilter): Promise<number>;

  abstract countTimelineByDay(
    workspaceId: string,
    timezone: string,
    from: Date,
    to: Date,
  ): Promise<{ date: string; count: number }[]>;

  abstract findWorkspaceTimezone(workspaceId: string): Promise<string>;

  abstract findPlanRevisions(workspaceId: string, cardId: string): Promise<EventRow[]>;

  abstract readSettings(workspaceId: string, keys: readonly string[]): Promise<Map<string, unknown>>;
}
