/**
 * @file What a message on the stream does to the caches: rows, the open sheet, counts (docs/15 §7).
 */
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { qk } from '@/features/cards/keys';
import type { CardListItem, HubCard } from '@/features/cards/types';

import { applyCardEvent, applyLiveMessage, asCardEvent } from './apply-event';

const WS = 'goteav';
const row = (key: string, status: string) =>
  ({ key, status, type: 'task', title: key }) as unknown as CardListItem;

describe('applyCardEvent', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
    client.setQueryData(qk.cardList(WS, {}), {
      items: [row('GTV-1', 'ready'), row('GTV-2', 'ready')],
      nextCursor: null,
    });
    client.setQueryData(qk.card(WS, 'GTV-1'), { ...row('GTV-1', 'ready'), events: [] });
  });

  it('moves the row and the open sheet to the new status at once', () => {
    applyCardEvent(client, WS, {
      cardKey: 'GTV-1',
      kind: 'claimed',
      status: 'claimed',
      at: '2026-11-05T10:00:00Z',
    });
    const list = client.getQueryData<{ items: CardListItem[] }>(qk.cardList(WS, {}));
    expect(list?.items[0]?.status).toBe('claimed');
    expect(list?.items[1]?.status).toBe('ready');
    expect(client.getQueryData<HubCard>(qk.card(WS, 'GTV-1'))?.status).toBe('claimed');
  });

  it('removes a deleted card from every list', () => {
    applyCardEvent(client, WS, {
      cardKey: 'GTV-2',
      kind: 'archived',
      status: 'ready',
      at: '2026-11-05T10:00:00Z',
    });
    expect(
      client.getQueryData<{ items: CardListItem[] }>(qk.cardList(WS, {}))?.items.map((r) => r.key),
    ).toEqual(['GTV-1']);
  });

  it('marks lists, counts, timeline and inbox stale so they read again', () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    applyCardEvent(client, WS, {
      cardKey: 'GTV-9',
      kind: 'created',
      status: 'ready',
      at: '2026-11-05T10:00:00Z',
    });
    const keys = spy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    for (const key of [qk.cards(WS), qk.counters(WS), qk.timeline(WS), qk.inbox(WS), qk.card(WS, 'GTV-9')]) {
      expect(keys).toContain(JSON.stringify(key));
    }
  });

  it('rereads comments only when one changed', () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    applyCardEvent(client, WS, { cardKey: 'GTV-1', kind: 'claimed', status: 'claimed', at: 'x' });
    expect(spy.mock.calls.map(([f]) => JSON.stringify(f?.queryKey))).not.toContain(
      JSON.stringify(qk.comments(WS, 'GTV-1')),
    );
    spy.mockClear();
    applyCardEvent(client, WS, { cardKey: 'GTV-1', kind: 'commented', status: 'claimed', at: 'x' });
    expect(spy.mock.calls.map(([f]) => JSON.stringify(f?.queryKey))).toContain(
      JSON.stringify(qk.comments(WS, 'GTV-1')),
    );
  });
});

describe('asCardEvent', () => {
  it('reads the contract message', () => {
    expect(asCardEvent({ cardKey: 'GTV-1', kind: 'decided', status: 'decided', at: 't' })).toMatchObject({
      cardKey: 'GTV-1',
      kind: 'decided',
    });
  });

  it('reads the docs/04 §4 shape', () => {
    expect(asCardEvent({ key: 'GTV-1', event: { kind: 'decided' } })?.kind).toBe('decided');
  });

  it('is null for anything without a card', () => {
    expect(asCardEvent({ unread: 3 })).toBeNull();
    expect(asCardEvent(null)).toBeNull();
  });
});

describe('applyLiveMessage', () => {
  it('takes pushed counters as they are', () => {
    const client = new QueryClient();
    applyLiveMessage(client, WS, { event: 'counters', data: { inboxUnread: 3 } });
    expect(client.getQueryData(qk.counters(WS))).toEqual({ inboxUnread: 3 });
  });

  it('says false for what it does not know, without failing', () => {
    expect(applyLiveMessage(new QueryClient(), WS, { event: 'brief.ready', data: { kind: 'morning' } })).toBe(
      false,
    );
  });
});
