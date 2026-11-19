import {
  folderKey,
  holdFor,
  isDue,
  type QueueGate,
  reorderPositions,
  viewStateOf,
  workFolderOf,
} from './queue-rules';

const NOW = new Date('2026-11-08T09:00:00Z'); // 12:00 in Istanbul
const run = (over: Partial<Parameters<typeof viewStateOf>[0]> = {}) => ({
  id: 'r1',
  deviceId: 'd1',
  folder: 'C:/work/repo',
  cardKey: null as string | null,
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
  isolation: 'folder',
  canIsolate: () => false,
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

describe('isolation (docs/16 §9.2)', () => {
  const isolated = (over: Partial<QueueGate> = {}) =>
    gate({ isolation: 'worktree', canIsolate: () => true, ...over });

  it('works in its own copy, so a chat in the registered folder does not hold it', () => {
    const task = run({ cardKey: 'GTV-7' });
    expect(workFolderOf(task, isolated())).toBe('C:/work/wt-GTV-7/repo');
    expect(holdFor(task, isolated({ busyFolders: new Set([folderKey('d1', 'C:/work/repo')]) }))).toBeNull();
    expect(
      holdFor(task, isolated({ busyFolders: new Set([folderKey('d1', 'c:\\work\\wt-gtv-7\\repo\\')]) })),
    ).toBe('folder_busy');
  });

  it("lets runs of two cards on one repository go together, and keeps a plan's steps one after another", () => {
    const busy = new Set([folderKey('d1', 'C:/work/wt-GTV-8/repo')]);
    expect(holdFor(run({ cardKey: 'GTV-7' }), isolated({ busyFolders: busy }))).toBeNull();
    expect(holdFor(run({ id: 'r2', cardKey: 'GTV-8' }), isolated({ busyFolders: busy }))).toBe('folder_busy');
  });

  it('works in the folder itself when the device or the folder cannot have a copy, or the owner chose so', () => {
    const busy = new Set([folderKey('d1', 'C:/work/repo')]);
    expect(holdFor(run({ cardKey: 'GTV-7' }), isolated({ canIsolate: () => false, busyFolders: busy }))).toBe(
      'folder_busy',
    );
    expect(holdFor(run({ cardKey: 'GTV-7' }), gate({ busyFolders: busy }))).toBe('folder_busy');
  });

  it('keeps to the copy it has, once made', () => {
    expect(workFolderOf(run({ worktreeFolder: 'C:/work/wt-run-0a1b2c3d/repo' }), gate())).toBe(
      'C:/work/wt-run-0a1b2c3d/repo',
    );
  });

  it('waits on changes not committed in its folder, until the owner lets it, and never in its own copy', () => {
    expect(holdFor(run({ dirtyFiles: 3 }), gate())).toBe('folder_dirty');
    expect(holdFor(run({ dirtyFiles: 3, allowDirty: true }), gate())).toBeNull();
    expect(holdFor(run({ dirtyFiles: 0 }), gate())).toBeNull();
    expect(holdFor(run({ cardKey: 'GTV-7', dirtyFiles: 3 }), isolated())).toBeNull();
  });
});
