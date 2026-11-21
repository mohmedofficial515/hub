/**
 * @file The backup rules: the due night, catch-up, retention, folder names and the Git check (docs/16 D61 to D63).
 */
import { join, resolve } from 'node:path';

import {
  backupFolderName,
  insideGitCheckout,
  isBackupFolderName,
  isUsableFolder,
  nextNightly,
  nightlySlot,
  retentionVictims,
  triggerFor,
} from './backup-rules';

const at = (iso: string) => new Date(iso);

describe('nightlySlot and nextNightly', () => {
  it('is today’s time once it has passed, else yesterday’s', () => {
    expect(nightlySlot(at('2026-11-08T09:00:00Z'), '03:00', 'UTC').toISOString()).toBe(
      '2026-11-08T03:00:00.000Z',
    );
    expect(nightlySlot(at('2026-11-08T02:59:00Z'), '03:00', 'UTC').toISOString()).toBe(
      '2026-11-07T03:00:00.000Z',
    );
  });

  it('reads the time in the machine’s timezone', () => {
    // 03:00 in Istanbul is 00:00 UTC.
    expect(nightlySlot(at('2026-11-08T01:00:00Z'), '03:00', 'Europe/Istanbul').toISOString()).toBe(
      '2026-11-08T00:00:00.000Z',
    );
  });

  it('names the next start', () => {
    expect(nextNightly(at('2026-11-08T02:00:00Z'), '03:00', 'UTC').toISOString()).toBe(
      '2026-11-08T03:00:00.000Z',
    );
    expect(nextNightly(at('2026-11-08T03:00:00Z'), '03:00', 'UTC').toISOString()).toBe(
      '2026-11-09T03:00:00.000Z',
    );
  });
});

describe('triggerFor', () => {
  it('is scheduled on time and a catch-up when late', () => {
    const slot = at('2026-11-08T03:00:00Z');
    expect(triggerFor(at('2026-11-08T03:01:00Z'), slot)).toBe('scheduled');
    expect(triggerFor(at('2026-11-08T09:00:00Z'), slot)).toBe('catch_up');
  });
});

describe('retentionVictims', () => {
  const row = (
    id: string,
    day: number,
    extra: Partial<{ pinned: boolean; status: string; deleted: boolean }> = {},
  ) => ({
    id,
    status: extra.status ?? 'done',
    pinned: extra.pinned ?? false,
    deletedAt: extra.deleted ? at('2026-11-01T00:00:00Z') : null,
    startedAt: at(`2026-11-${String(day).padStart(2, '0')}T03:00:00Z`),
  });

  it('keeps the newest unpinned ones and every pinned one', () => {
    const rows = [row('a', 1, { pinned: true }), row('b', 2), row('c', 3), row('d', 4), row('e', 5)];
    expect(retentionVictims(rows, 2).map((r) => r.id)).toEqual(['c', 'b']);
  });

  it('never counts a failed, running or already deleted backup', () => {
    const rows = [
      row('a', 1),
      row('b', 2, { status: 'failed' }),
      row('c', 3, { deleted: true }),
      row('d', 4, { status: 'running' }),
    ];
    expect(retentionVictims(rows, 1)).toEqual([]);
  });
});

describe('backup folder names', () => {
  it('sorts by time and carries part of the id', () => {
    const name = backupFolderName(at('2026-11-08T03:00:05.123Z'), '0193ab12-0000-7000-8000-00000000abcd');
    expect(name).toBe('hub-20261108-030005-0000abcd');
    expect(isBackupFolderName(name)).toBe(true);
    expect(isBackupFolderName(`${name}.partial`)).toBe(true);
    expect(isBackupFolderName('Documents')).toBe(false);
  });
});

describe('folders', () => {
  it('finds a .git in the folder or above it', () => {
    const repo = resolve('/work/repo');
    const exists = (path: string) => path === join(repo, '.git');
    expect(insideGitCheckout(join(repo, 'backups'), exists)).toBe(true);
    expect(insideGitCheckout(resolve('/work/HubBackups'), exists)).toBe(false);
  });

  it('wants an absolute folder that is not a drive root', () => {
    expect(isUsableFolder(resolve('/HubBackups'))).toBe(true);
    expect(isUsableFolder('HubBackups')).toBe(false);
    expect(isUsableFolder(resolve('/'))).toBe(false);
  });
});
