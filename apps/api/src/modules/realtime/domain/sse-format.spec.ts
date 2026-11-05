/**
 * @file SSE framing and audience rules.
 */
import type { RealtimeMessage } from '@hub/contracts';

import { compareStreamIds, frame, isForMember, isValidStreamId, toFrames } from './sse-format';

const cardEvent: RealtimeMessage = {
  streamId: '100-1',
  eventId: 'e1',
  workspaceId: 'w',
  cardId: 'c',
  cardKey: 'GTV-1',
  cardType: 'task',
  seq: 2,
  kind: 'commented',
  status: 'ready',
  actorKind: 'user',
  actorId: 'u',
  via: 'web',
  at: '2026-11-05T00:00:00.000Z',
};

describe('frame', () => {
  it('writes id, event and data', () => {
    expect(frame('1-0', 'x', { a: 1 })).toBe('id: 1-0\nevent: x\ndata: {"a":1}\n\n');
    expect(frame(null, 'x', 1)).toBe('event: x\ndata: 1\n\n');
  });
});

describe('compareStreamIds', () => {
  it('compares by time, then sequence', () => {
    expect(compareStreamIds('2-0', '10-0')).toBeLessThan(0);
    expect(compareStreamIds('5-2', '5-1')).toBeGreaterThan(0);
    expect(compareStreamIds('5-1', '5-1')).toBe(0);
  });

  it('accepts only real ids', () => {
    expect(isValidStreamId('12-3')).toBe(true);
    expect(isValidStreamId('12; DROP')).toBe(false);
  });
});

describe('isForMember', () => {
  const me = { userId: 'me', roles: ['qa'] as const };

  it('a card event is for every member', () => {
    expect(isForMember(cardEvent, me)).toBe(true);
  });

  it('an envelope follows its audience', () => {
    const base = { streamId: '1-0', event: 'inbox.new', data: {} };
    expect(isForMember({ ...base, audience: 'all' }, me)).toBe(true);
    expect(isForMember({ ...base, audience: { userIds: ['me'] } }, me)).toBe(true);
    expect(isForMember({ ...base, audience: { userIds: ['other'] } }, me)).toBe(false);
    expect(isForMember({ ...base, audience: { roles: ['qa'] } }, me)).toBe(true);
    expect(isForMember({ ...base, audience: { roles: ['pm'] } }, me)).toBe(false);
  });
});

describe('toFrames', () => {
  it('a comment becomes updated, event and comment.created, all with the stream id', () => {
    const text = toFrames(cardEvent);
    expect(text.match(/^event: .*$/gm)).toEqual([
      'event: card.updated',
      'event: card.event',
      'event: comment.created',
    ]);
    expect(text.match(/^id: 100-1$/gm)).toHaveLength(3);
  });

  it('a created card says so', () => {
    expect(toFrames({ ...cardEvent, kind: 'created' })).toContain('event: card.created');
  });
});
