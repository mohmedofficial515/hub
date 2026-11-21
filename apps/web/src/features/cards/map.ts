/**
 * @file map.ts
 * @description API shapes (docs/04 §1.8) to the card the kit reads. The one place that knows the two differ. Detail DTOs expand
 * `*ById` to `{ id, displayName }`, and the kit wants plain ids, so details are flattened generically.
 */
import { AVATAR_COLORS, type Priority, type Role } from '@hub/contracts';

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
  blocksCount?: number;
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
    blocksCount: dto.blocksCount ?? 0,
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
  plan: { body: '', steps: [], phases: [] },
};

/** The words of a version's concept: the lab's title, which also ends the version card's title (docs/10 §4). */
function conceptOf(title: string, detail: Record<string, unknown>) {
  const front = detail['frontMatter'] as { title?: unknown } | undefined;
  if (typeof detail['concept'] === 'string') return detail['concept'];
  if (typeof front?.title === 'string') return front.title;
  return title.split(' — ').pop() ?? title;
}

/** Where docs/04's detail differs from what the kit reads. Both names are accepted, so a detail can settle without breaking a page. */
function shapeDetail(dto: CardFullDto, detail: Record<string, unknown>): Record<string, unknown> {
  if (dto.type === 'redesign') {
    const port = detail['portTask'] as { key?: string } | undefined;
    return {
      ...detail,
      concept: conceptOf(dto.title, detail),
      ...(port?.key ? { portTaskKey: port.key } : {}),
    };
  }
  if (dto.type === 'doc') {
    const source = detail['source'] as { name?: string } | undefined;
    const referenced = (detail['referencedBy'] ?? []) as (string | { key: string })[];
    return {
      ...detail,
      sourceName: detail['sourceName'] ?? source?.name ?? '',
      lang: detail['lang'] ?? (String(detail['path']).endsWith('.ar.md') ? 'ar' : 'en'),
      webUrl: detail['webUrl'] ?? detail['url'],
      referencedBy: referenced.map((r) => (typeof r === 'string' ? r : r.key)),
    };
  }
  if (dto.type === 'release') {
    const notes = (detail['notes'] ?? {}) as Record<string, string | null | undefined>;
    const included = detail['included'] as CardSummaryDto[] | undefined;
    return {
      ...detail,
      ...(included ? { included: included.map(toListItem), includedKeys: included.map((c) => c.key) } : {}),
      notes: {
        team: notes['team'] ?? '',
        owner: notes['owner'] ?? '',
        accountant: notes['accountant'] ?? '',
      },
    };
  }
  return detail;
}

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
  const detail = shapeDetail(dto, { ...DETAIL_DEFAULTS[dto.type], ...flattenDetail(dto.detail) });
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

/** A member's hue, 1 to 12: the place of the API's colour name in AVATAR_COLORS, or a stable one from the id. */
export function avatarHue(color: string | number | null | undefined, id: string) {
  const at = (AVATAR_COLORS as readonly unknown[]).indexOf(color);
  if (at >= 0) return (at % 12) + 1;
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (hash % 12) + 1;
}
