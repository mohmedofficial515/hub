/**
 * @file What a message on the stream does to the caches: rows, the open sheet, counts (docs/15 §7).
 */
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { qk } from '@/features/cards/keys';
import type { CardListItem, HubCard } from '@/features/cards/types';

import {
  applyCardEvent,
  applyLiveMessage,
  asCardEvent,
  createRefetchBatcher,
  listMayHold,
} from './apply-event';

const WS = 'goteav';
const row = (key: string, status: string) =>
  ({ key, status, type: 'task', title: key }) as unknown as CardListItem;

describe('project.updated', () => {
  it('rereads members, settings, sources and my own roles', () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    expect(applyLiveMessage(client, WS, { event: 'project.updated', data: { scope: 'members' } })).toBe(true);
    const keys = spy.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(qk.admin(WS));
    expect(keys).toContainEqual(qk.members(WS));
    expect(keys).toContainEqual(qk.me);
  });
});

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

describe('createRefetchBatcher', () => {
  const key = (name: string) => ['x', name] as const;
  const flushed = () => new Promise((done) => setTimeout(done, 0));

  it('starts at once when calm, holds what arrives during a round, and loses nothing', async () => {
    const client = new QueryClient();
    const finish: (() => void)[] = [];
    const spy = vi
      .spyOn(client, 'invalidateQueries')
      .mockImplementation(() => new Promise<void>((done) => finish.push(done)));
    const batch = createRefetchBatcher(client, WS);
    batch.add({ keys: [key('a')], cardTypes: [] });
    await flushed();
    expect(spy).toHaveBeenCalledTimes(1);
    batch.add({ keys: [key('b')], cardTypes: [] });
    batch.add({ keys: [key('c')], cardTypes: [] });
    await flushed();
    expect(spy).toHaveBeenCalledTimes(1);
    finish.forEach((done) => done());
    await vi.waitFor(() => expect(spy.mock.calls.length).toBe(3));
    expect(spy.mock.calls.map(([f]) => f?.queryKey)).toEqual([key('a'), key('b'), key('c')]);
    batch.stop();
  });

  it('reads again only the lists that may hold the types of the batch', async () => {
    const client = new QueryClient();
    const seen: string[] = [];
    client.setQueryData(qk.cardList(WS, { view: 'tasks' }), { items: [] });
    client.setQueryData(qk.cardList(WS, { view: 'needs' }), { items: [] });
    client.setQueryData(qk.cardList(WS, { awaiting: 'me' }), { items: [] });
    vi.spyOn(client, 'invalidateQueries').mockImplementation(async (filters) => {
      for (const query of client.getQueryCache().findAll(filters)) {
        seen.push(JSON.stringify(query.queryKey[2]));
      }
    });
    const batch = createRefetchBatcher(client, WS);
    batch.add({ keys: [], cardTypes: ['task'] });
    await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen).toContain('{"view":"tasks"}');
    expect(seen).toContain('{"awaiting":"me"}');
    expect(seen).not.toContain('{"view":"needs"}');
    batch.stop();
  });

  it('slows down in a burst, and never loses the last change', async () => {
    vi.useFakeTimers();
    try {
      const client = new QueryClient();
      const moments = new Set<number>();
      const spy = vi.spyOn(client, 'invalidateQueries').mockImplementation(async () => {
        moments.add(Date.now());
      });
      const batch = createRefetchBatcher(client, WS);
      for (let i = 0; i < 100; i += 1) {
        batch.add({ keys: [['x', i]], cardTypes: [] });
        await vi.advanceTimersByTimeAsync(100);
      }
      // Ten seconds with a change every 100 ms: 100 rounds without a batch, and here 8 calm ones, then one each 2 s.
      expect(moments.size).toBeLessThanOrEqual(12);
      await vi.advanceTimersByTimeAsync(3000);
      expect(spy.mock.calls.map(([f]) => JSON.stringify(f?.queryKey))).toContain('["x",99]');
      batch.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('listMayHold', () => {
  const task = new Set(['task' as const]);
  it('narrows only what names its type', () => {
    expect(listMayHold({ view: 'tasks' }, task)).toBe(true);
    expect(listMayHold({ view: 'decisions' }, task)).toBe(false);
    expect(listMayHold({ type: ['need'] }, task)).toBe(false);
    expect(listMayHold({ type: ['need', 'task'] }, task)).toBe(true);
    expect(listMayHold({ ready: true }, new Set(['need' as const]))).toBe(false);
    expect(listMayHold({ awaiting: 'me' }, task)).toBe(true);
    expect(listMayHold({ view: 'ask', q: 'x' }, task)).toBe(true);
    expect(listMayHold(undefined, task)).toBe(true);
  });
});
