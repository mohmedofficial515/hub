/**
 * @file Optimistic writes: the prediction shows at once, and a refusal puts back exactly what was there.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getQueryClient } from '@/lib/query-client';

import { qk } from './keys';
import { writeCard } from './store';
import type { CardListItem, HubCard } from './types';

const WS = 'goteav';
const row = { key: 'GTV-1', status: 'ready', type: 'task', title: 'x' } as unknown as CardListItem;

describe('writeCard', () => {
  const client = getQueryClient();

  beforeEach(() => {
    client.clear();
    client.setQueryData(qk.cardList(WS, {}), { items: [row] });
    client.setQueryData(qk.card(WS, 'GTV-1'), { ...row, watching: false });
  });

  const readRow = () => client.getQueryData<{ items: CardListItem[] }>(qk.cardList(WS, {}))?.items[0];
  const readCard = () => client.getQueryData<HubCard>(qk.card(WS, 'GTV-1'));

  it('shows the predicted status before the request answers', async () => {
    let answer: (value: string) => void = () => undefined;
    const pending = writeCard(
      { key: 'GTV-1', fields: { status: 'claimed' } },
      () => new Promise<string>((r) => (answer = r)),
      WS,
    );
    await vi.waitFor(() => expect(readRow()?.status).toBe('claimed'));
    expect(readCard()?.status).toBe('claimed');
    answer('ok');
    await expect(pending).resolves.toBe('ok');
  });

  it('rolls back the row and the card when the API refuses', async () => {
    await expect(
      writeCard(
        { key: 'GTV-1', fields: { status: 'claimed' } },
        () => Promise.reject(new Error('refused')),
        WS,
      ),
    ).rejects.toThrow('refused');
    expect(readRow()?.status).toBe('ready');
    expect(readCard()?.status).toBe('ready');
  });

  it('removes a deleted card from lists, and brings it back on refusal', async () => {
    let fail: (e: Error) => void = () => undefined;
    const pending = writeCard(
      { key: 'GTV-1', removeFromLists: true },
      () => new Promise((_, reject) => (fail = reject)),
      WS,
    );
    await vi.waitFor(() => expect(readRow()).toBeUndefined());
    fail(new Error('no'));
    await expect(pending).rejects.toThrow();
    expect(readRow()?.key).toBe('GTV-1');
  });

  it('marks the affected queries stale after either answer', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    await writeCard({ key: 'GTV-1' }, () => Promise.resolve(1), WS);
    const keys = spy.mock.calls.map(([f]) => JSON.stringify(f?.queryKey));
    expect(keys).toContain(JSON.stringify(qk.cards(WS)));
    expect(keys).toContain(JSON.stringify(qk.counters(WS)));
    spy.mockRestore();
  });
});
