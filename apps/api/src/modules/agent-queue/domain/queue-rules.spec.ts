import { folderKey, holdFor, isDue, type QueueGate, reorderPositions, viewStateOf } from './queue-rules';

const NOW = new Date('2026-11-08T09:00:00Z'); // 12:00 in Istanbul
const run = (over: Partial<Parameters<typeof viewStateOf>[0]> = {}) => ({
  id: 'r1',
  deviceId: 'd1',
  folder: 'C:/work/repo',
  state: 'queued',
  runAt: null,
  pausedAt: null,
  position: 1,
  ...over,
});
const gate = (over: Partial<QueueGate> = {}): QueueGate => ({
  now: NOW,
  timezone: 'Europe/Istanbul',
  pausedReason: null,
  quietHours: null,
  usedToday: 0,
  perDay: 5,
  running: 0,
  maxConcurrent: 1,
  busyFolders: new Set(),
  online: () => true,
  signedOut: () => false,
  engineUnavailable: () => false,
  ...over,
});

describe('a run as the page sees it', () => {
  it('is waiting while its turn has an open approval, and running otherwise', () => {
    expect(viewStateOf(run({ state: 'running' }), NOW, true)).toBe('waiting');
    expect(viewStateOf(run({ state: 'running' }), NOW, false)).toBe('running');
  });

  it('is scheduled before its time, next after it, and paused when held', () => {
    expect(viewStateOf(run({ runAt: new Date(NOW.getTime() + 60_000) }), NOW, false)).toBe('scheduled');
    expect(viewStateOf(run({ runAt: new Date(NOW.getTime() - 60_000) }), NOW, false)).toBe('next');
    expect(viewStateOf(run({ pausedAt: NOW }), NOW, false)).toBe('paused');
    expect(viewStateOf(run({ state: 'interrupted' }), NOW, false)).toBe('interrupted');
  });

  it('is due only when queued, not paused, and its time has come', () => {
    expect(isDue(run(), NOW)).toBe(true);
    expect(isDue(run({ runAt: new Date(NOW.getTime() + 1) }), NOW)).toBe(false);
    expect(isDue(run({ pausedAt: NOW }), NOW)).toBe(false);
    expect(isDue(run({ state: 'running' }), NOW)).toBe(false);
  });
});

describe('why a due run waits', () => {
  it('starts when nothing holds it', () => {
    expect(holdFor(run(), gate())).toBeNull();
  });

  it('names the queue-wide reason first', () => {
    expect(holdFor(run(), gate({ pausedReason: 'owner', usedToday: 9 }))).toBe('paused_all');
    expect(holdFor(run(), gate({ pausedReason: 'usage_limit' }))).toBe('usage_limit');
    expect(holdFor(run(), gate({ quietHours: { from: '11:00', to: '13:00' } }))).toBe('quiet_hours');
    expect(holdFor(run(), gate({ usedToday: 5 }))).toBe('daily_limit');
    expect(holdFor(run(), gate({ running: 1 }))).toBe('concurrency');
  });

  it('keeps one turn per folder, whatever the spelling', () => {
    const busy = new Set([folderKey('d1', 'c:\\work\\repo\\')]);
    expect(holdFor(run(), gate({ busyFolders: busy }))).toBe('folder_busy');
    expect(holdFor(run({ deviceId: 'd2' }), gate({ busyFolders: busy }))).toBeNull();
  });

  it('waits for its device and its sign-in', () => {
    expect(holdFor(run(), gate({ online: () => false }))).toBe('device_offline');
    expect(holdFor(run(), gate({ signedOut: () => true }))).toBe('signed_out');
    expect(holdFor(run(), gate({ engineUnavailable: () => true }))).toBe('engine_unavailable');
  });
});

describe('the owner’s order', () => {
  it('reuses the listed runs’ own positions, so the others keep theirs', () => {
    const order = reorderPositions(
      ['c', 'a', 'b'],
      [
        { id: 'a', position: 10 },
        { id: 'b', position: 20 },
        { id: 'c', position: 30 },
      ],
    );
    expect([...order.entries()]).toEqual([
      ['c', 10],
      ['a', 20],
      ['b', 30],
    ]);
  });

  it('stays strict when two runs shared a position, and skips ids it does not know', () => {
    const order = reorderPositions(
      ['b', 'x', 'a'],
      [
        { id: 'a', position: 5 },
        { id: 'b', position: 5 },
      ],
    );
    expect(order.get('b')).toBe(5);
    expect(order.get('a')).toBeGreaterThan(5);
    expect(order.has('x')).toBe(false);
  });
});
