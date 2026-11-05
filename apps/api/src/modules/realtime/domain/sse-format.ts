/**
 * @file SSE framing, the stream id order, and who a message is for (docs/04 §4).
 * @description One card event becomes `card.created` or `card.updated`, then `card.event`, plus `comment.created` for
 * a comment. They carry what a page needs to refetch, never body text: reads go back through the API, where the
 * member's permissions apply.
 */
import type { RealtimeCardEvent, RealtimeEnvelope, RealtimeMessage, Role } from '@hub/contracts';

export function frame(id: string | null, event: string, data: unknown): string {
  return `${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Redis stream ids are `ms-seq`. */
export function compareStreamIds(a: string, b: string): number {
  const [aMs = 0, aSeq = 0] = a.split('-').map(Number);
  const [bMs = 0, bSeq = 0] = b.split('-').map(Number);
  return aMs - bMs || aSeq - bSeq;
}

export function isValidStreamId(id: string): boolean {
  return /^\d+-\d+$/.test(id);
}

function isCardEvent(message: RealtimeCardEvent | RealtimeEnvelope): message is RealtimeCardEvent {
  return 'eventId' in message;
}

export function isForMember(
  message: RealtimeCardEvent | RealtimeEnvelope,
  member: { readonly userId: string; readonly roles: readonly Role[] },
): boolean {
  if (isCardEvent(message) || message.audience === 'all') return true;
  if ('userIds' in message.audience) return message.audience.userIds.includes(member.userId);
  return message.audience.roles.some((role) => member.roles.includes(role as Role));
}

export function toFrames(message: RealtimeMessage): string {
  const { streamId } = message;
  if (!isCardEvent(message)) return frame(streamId, message.event, message.data);
  const header = {
    key: message.cardKey,
    type: message.cardType,
    status: message.status,
    kind: message.kind,
    lastEventAt: message.at,
    actor: { kind: message.actorKind, userId: message.actorId, via: message.via },
  };
  const event = {
    key: message.cardKey,
    event: {
      id: message.eventId,
      seq: message.seq,
      kind: message.kind,
      actor: { kind: message.actorKind, userId: message.actorId, via: message.via },
      via: message.via,
      createdAt: message.at,
    },
  };
  return [
    frame(streamId, message.kind === 'created' ? 'card.created' : 'card.updated', header),
    frame(streamId, 'card.event', event),
    ...(message.kind === 'commented'
      ? [frame(streamId, 'comment.created', { key: message.cardKey, eventId: message.eventId })]
      : []),
  ].join('');
}
