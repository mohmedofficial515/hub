/**
 * @file The backup rules, pure (docs/16 D61 to D63): which night is due, whether a start is late, which backups the retention rule removes,
 * how a backup folder is named, and whether a folder sits inside a Git checkout.
 */
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { localDateOf, localInstant } from '@hub/contracts';

/** A run that starts more than this after its nightly time is a catch-up: Hub was off, or busy, at that time. */
export const CATCH_UP_AFTER_MS = 15 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** The latest nightly time at or before `now`, in `timezone`. */
export function nightlySlot(now: Date, time: string, timezone: string): Date {
  const today = localInstant(localDateOf(now, timezone), time, timezone);
  if (today.getTime() <= now.getTime()) return today;
  return localInstant(localDateOf(new Date(now.getTime() - DAY_MS), timezone), time, timezone);
}

/** The first nightly time after `now`. */
export function nextNightly(now: Date, time: string, timezone: string): Date {
  const today = localInstant(localDateOf(now, timezone), time, timezone);
  if (today.getTime() > now.getTime()) return today;
  return localInstant(localDateOf(new Date(now.getTime() + DAY_MS), timezone), time, timezone);
}

export function triggerFor(now: Date, slot: Date): 'scheduled' | 'catch_up' {
  return now.getTime() - slot.getTime() > CATCH_UP_AFTER_MS ? 'catch_up' : 'scheduled';
}

export interface RetentionRow {
  readonly id: string;
  readonly status: string;
  readonly pinned: boolean;
  readonly deletedAt: Date | null;
  readonly startedAt: Date;
}

/** The finished, unpinned backups past the newest `keep`. Pinned ones are kept forever and do not count. */
export function retentionVictims<T extends RetentionRow>(rows: readonly T[], keep: number): T[] {
  return rows
    .filter((row) => row.status === 'done' && !row.pinned && !row.deletedAt)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(Math.max(0, keep));
}

/** `hub-20261108-030000-0193ab12`: sorts by time, and two backups in one second never share a folder. */
export function backupFolderName(at: Date, id: string): string {
  const stamp = at
    .toISOString()
    .replace(/\.\d+Z$/, '')
    .replace(/[-:]/g, '')
    .replace('T', '-');
  return `hub-${stamp}-${id.replace(/-/g, '').slice(-8)}`;
}

/** Only a folder this rule names is ever removed by Hub, so a changed path in the database cannot reach anything else. */
export function isBackupFolderName(name: string): boolean {
  return /^hub-\d{8}-\d{6}-[0-9a-f]{8}(\.partial)?$/.test(name);
}

/** True when the folder, or any folder above it, holds a `.git`: a backup there could end up in a commit. */
export function insideGitCheckout(folder: string, exists: (path: string) => boolean): boolean {
  let current = resolve(folder);
  for (;;) {
    if (exists(join(current, '.git'))) return true;
    const parent = dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

/** An absolute folder on this machine, not a drive root alone. */
export function isUsableFolder(folder: string): boolean {
  if (!isAbsolute(folder) || folder.includes('\0')) return false;
  const full = resolve(folder);
  return dirname(full) !== full;
}
