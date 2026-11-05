/**
 * @file map.ts
 * @description API shapes (docs/04 §1.8) to the card the kit reads. The one place that knows the two differ. Detail DTOs expand
 * `*ById` to `{ id, displayName }`, and the kit wants plain ids, so details are flattened generically.
 */
import type { Priority, Role } from '@hub/contracts';

import type {
  ActorRef,
  CardAttachment,
  CardComment,
  CardEvent,
  CardFlags,
  CardLink,
  CardListItem,
  CardType,
  HubCard,
  LinkKind,
  Via,
} from './types';

export interface CardSummaryDto {
  id: string;
  key: string;
  type: CardType;
  title: string;
  status: string;
  priority: Priority;
  ownerRole: Role | null;
  assignee?: { id: string; displayName: string; avatarColor?: string | number } | null;
  assigneeId?: string | null;
  module?: string | null;
  repo?: string | null;
  branch?: string | null;
  tags?: string[];
  dueAt?: string | null;
  closedAt?: string | null;
  archivedAt?: string | null;
  commentCount?: number;
  lastEventAt: string;
  createdAt: string;
  createdBy?: ActorRef | null;
  flags?: CardFlags;
  awaiting?: string | null;
}

export interface CardFullDto extends CardSummaryDto {
  body?: string | null;
  detail?: Record<string, unknown> | null;
  links?: { kind: LinkKind; card: CardSummaryDto }[];
  watchers?: { userId: string; displayName?: string; reason?: string }[];
  attachments?: { id?: string; kind: string; name: string; url: string }[];
  watching?: boolean;
  allowedActions?: string[];
  actions?: unknown[];
}

export interface EventDto {
  id: string;
  seq: number;
  kind: string;
  actor: ActorRef;
  via?: string;
  data?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface CommentDto {
  id: string;
  author: ActorRef;
  via?: string;
  body: string | null;
  redacted?: boolean;
  createdAt: string;
  editedAt?: string | null;
}

const orUndefined = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

export function toListItem(dto: CardSummaryDto): CardListItem {
  return {
    id: dto.id,
    key: dto.key,
    type: dto.type,
    status: dto.status,
    title: dto.title,
    priority: dto.priority,
    ownerRole: dto.ownerRole ?? null,
    dueAt: orUndefined(dto.dueAt),
    closedAt: orUndefined(dto.closedAt),
    flags: dto.flags,
    createdAt: dto.createdAt,
    lastEventAt: dto.lastEventAt,
    createdByKind: dto.createdBy?.kind ?? 'system',
    createdById: orUndefined(dto.createdBy?.userId),
    createdByName: orUndefined(dto.createdBy?.displayName),
    createdVia: dto.createdBy?.via ?? 'web',
    assigneeId: orUndefined(dto.assignee?.id ?? dto.assigneeId),
    assigneeName: orUndefined(dto.assignee?.displayName),
    module: orUndefined(dto.module),
    repo: orUndefined(dto.repo),
    branch: orUndefined(dto.branch),
    tags: dto.tags ?? [],
    commentCount: dto.commentCount ?? 0,
    archivedAt: orUndefined(dto.archivedAt),
    awaiting: dto.awaiting,
  };
}

/** `decidedBy: { id, displayName }` becomes `decidedById: id`, and nulls become absent, which is how the kit reads optionals. */
export function flattenDetail(detail: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(detail ?? {})) {
    if (value === null) continue;
    if (name.endsWith('By') && typeof value === 'object' && 'id' in value) {
      out[`${name}Id`] = (value as { id: string }).id;
      continue;
    }
    out[name] = value;
  }
  return out;
}

const DETAIL_DEFAULTS: Partial<Record<CardType, Record<string, unknown>>> = {
  decision: { options: [], remindersSent: [], adrStatus: 'none' },
  handoff: { payload: {} },
  redesign: { touchesComponents: [] },
  change: { commits: [] },
  doc: { headings: [], referencedBy: [] },
  release: { includedKeys: [], notes: { team: '', owner: '', accountant: '' } },
  plan: { body: '', steps: [] },
};

export function toHubCard(
  dto: CardFullDto,
  seed?: { events?: CardEvent[]; comments?: CardComment[] },
): HubCard {
  const links: CardLink[] = (dto.links ?? []).map((l) => ({
    kind: l.kind,
    key: l.card.key,
    card: toListItem(l.card),
  }));
  const attachments: CardAttachment[] = (dto.attachments ?? []).map((a) => ({
    kind: a.kind as CardAttachment['kind'],
    name: a.name,
    url: a.url,
  }));
  const detail = { ...DETAIL_DEFAULTS[dto.type], ...flattenDetail(dto.detail) };
  return {
    ...toListItem(dto),
    body: orUndefined(dto.body),
    links,
    attachments,
    watchers: (dto.watchers ?? []).map((w) => w.userId),
    watching: dto.watching ?? false,
    allowedActions: dto.allowedActions ?? [],
    serverActions: dto.actions,
    serverActionsStatus: dto.status,
    events: seed?.events ?? [],
    comments: seed?.comments ?? [],
    [dto.type]: detail,
  } as HubCard;
}

export function toEvent(dto: EventDto): CardEvent {
  return {
    id: dto.id,
    seq: dto.seq,
    kind: dto.kind,
    actorKind: dto.actor.kind,
    actorId: orUndefined(dto.actor.userId),
    actorName: orUndefined(dto.actor.displayName),
    via: (dto.via ?? dto.actor.via) as Via,
    at: dto.createdAt,
    data: dto.data ?? {},
  };
}

export function toComment(dto: CommentDto): CardComment {
  return {
    id: dto.id,
    authorKind: dto.author.kind === 'agent' ? 'agent' : 'user',
    authorId: dto.author.userId ?? '',
    authorName: orUndefined(dto.author.displayName),
    via: (dto.via ?? dto.author.via) as Via,
    body: dto.body ?? '',
    at: dto.createdAt,
    editedAt: orUndefined(dto.editedAt),
    redacted: dto.redacted,
  };
}

/** A member's hue: the API's number, or a stable one from the id. */
export function avatarHue(color: string | number | null | undefined, id: string) {
  const parsed = Number(color);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 12) return parsed;
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (hash % 12) + 1;
}
