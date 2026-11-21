// Small builders for the domain mocks (decisions.ts, needs.ts, handoffs.ts). Type-only imports from the index, so the
// index can spread these lists into the catalogue without an import cycle at runtime.

import type { ActorKind, CardEvent, HubCard, L, Via } from './index';

export const l = (ar: string, en: string): L => ({ ar, en });

/** `T('11-04', '08:45')` → the mock's Istanbul time on that day of 2026. */
export const T = (day: string, hm: string) => `2026-${day}T${hm}:00+03:00`;

type Actor = { kind: ActorKind; id?: string; adapter?: string; via: Via };

export const person = (id: string): Actor => ({ kind: 'user', id, via: 'web' });
export const agentOf = (id: string): Actor => ({ kind: 'agent', id, via: 'mcp' });
export const adapter = (name: string): Actor => ({ kind: 'system', adapter: name, via: name === 'scheduler' ? 'scheduler' : 'adapter' });

export const evt = (id: string, seq: number, kind: string, at: string, actor: Actor, data: CardEvent['data'] = {}): CardEvent => ({
  id,
  seq,
  kind,
  at,
  actorKind: actor.kind,
  actorId: actor.id,
  adapter: actor.adapter,
  via: actor.via,
  data,
});

type Core = Pick<HubCard, 'key' | 'title' | 'status' | 'priority' | 'ownerRole' | 'createdAt'> & Partial<Omit<HubCard, 'type'>>;

/** The fields every card shares, with the catalogue's defaults. */
export const base = (card: Core) => ({
  lastEventAt: card.createdAt,
  createdByKind: 'user' as ActorKind,
  createdVia: 'web' as Via,
  tags: [] as string[],
  watchers: [] as string[],
  links: [] as HubCard['links'],
  events: [] as CardEvent[],
  comments: [] as HubCard['comments'],
  attachments: [] as HubCard['attachments'],
  ...card,
});
