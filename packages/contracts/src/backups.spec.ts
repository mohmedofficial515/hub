/**
 * @file What kind of failure a backup text is, and the low-space rule (docs/16 D62, review M3).
 */
import { describe, expect, it } from 'vitest';

import { backupFailureKind, isLowDisk } from './backups';

describe('backupFailureKind', () => {
  it('reads the API’s own failure texts', () => {
    expect(
      backupFailureKind('No running Postgres container publishes the database port. Is Docker running?'),
    ).toBe('docker');
    expect(backupFailureKind('docker was not found')).toBe('docker');
    expect(backupFailureKind('Refused container goteav-db: it belongs to another project')).toBe(
      'foreign_container',
    );
    expect(backupFailureKind('pg_dump failed: pg_dump: error: connection refused')).toBe('dump');
    expect(backupFailureKind('Cut off by a restart of Hub')).toBe('cut_off');
    expect(backupFailureKind('hub.backups.folder_invalid')).toBe('folder');
    expect(backupFailureKind('hub.backups.folder_in_repo')).toBe('folder');
    expect(backupFailureKind("EACCES: permission denied, mkdir 'D:\\HubBackups\\hub-1.partial'")).toBe(
      'folder',
    );
  });

  it('puts a full drive first, even inside a pg_dump failure', () => {
    expect(backupFailureKind('ENOSPC: no space left on device, write')).toBe('disk_full');
    expect(backupFailureKind('pg_dump failed: could not write to output file: No space left on device')).toBe(
      'disk_full',
    );
  });

  it('calls anything else other', () => {
    expect(backupFailureKind('something new')).toBe('other');
    expect(backupFailureKind(null)).toBe('other');
  });
});

describe('isLowDisk', () => {
  it('warns under 5 GB or under a tenth of the drive', () => {
    expect(isLowDisk(4 * 1024 ** 3, 1000 * 1024 ** 3)).toBe(true);
    expect(isLowDisk(16 * 1024 ** 3, 117 * 1024 ** 3)).toBe(false);
    expect(isLowDisk(9 * 1024 ** 3, 100 * 1024 ** 3)).toBe(true);
  });
});
