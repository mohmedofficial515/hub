/**
 * @file The queue's rules, pure (docs/16 §9): what a run shows as, why a due run waits, and which runs start now.
 * @description The dispatcher and the page read the same `holdFor`, so the page never says something the dispatcher does not do. One run per folder holds across chats too: a panel turn in the same checkout also keeps a run waiting, because both would edit the same files.
 * With worktree isolation (§9.2) a run's folder is its own copy of the repository, so runs on one repository wait only for each other's copy, not for each other.
 */
import {
  type HoldReason,
  inQuietHours,
  type QueueIsolation,
  type QuietHours,
  type RunState,
  type RunViewState,
  worktreeFolderFor,
  worktreeKeyOf,
} from '@hub/contracts';

export interface RunFacts {
  readonly id: string;
  readonly deviceId: string;
  readonly folder: string;
  readonly cardKey: string | null;
  /** §9.2: its own copy, once made. */
  readonly worktreeFolder?: string | null | undefined;
  /** §9.2, folder isolation: changed files at the last look, and the owner's leave to start anyway. */
  readonly dirtyFiles?: number | null | undefined;
  readonly allowDirty?: boolean | undefined;
  /** D59: every folder of a run is held, the main one and these. */
  readonly extraFolders?: readonly string[] | undefined;
  readonly state: string;
  readonly runAt: Date | null;
  readonly pausedAt: Date | null;
  readonly position: number;
}

export function viewStateOf(run: RunFacts, now: Date, waiting: boolean): RunViewState {
  if (run.state === 'running') return waiting ? 'waiting' : 'running';
  if (run.state === 'queued') {
    if (run.pausedAt) return 'paused';
    return run.runAt && run.runAt.getTime() > now.getTime() ? 'scheduled' : 'next';
  }
  return run.state as Exclude<RunState, 'queued' | 'running'>;
}

/** Due: queued, not paused, and its time has come. */
export const isDue = (run: RunFacts, now: Date): boolean =>
  run.state === 'queued' && !run.pausedAt && (!run.runAt || run.runAt.getTime() <= now.getTime());

/** One checkout, whatever the spelling: slashes and case do not make two folders. */
export const folderKey = (deviceId: string, folder: string): string =>
  `${deviceId}|${folder.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase()}`;

/** Every folder a run holds: its main folder, its own copy instead once it has one (§9.2), and its extra ones (D59). */
export const runFolders = (run: {
  folder: string;
  worktreeFolder?: string | null | undefined;
  extraFolders?: readonly string[] | undefined;
}): string[] => [run.worktreeFolder ?? run.folder, ...(run.extraFolders ?? [])];

/**
 * Where a run works (§9.2): its copy once made; else, with worktree isolation on a device and folder that can have one, the copy it will get; else its folder.
 * Holds are counted on this, so two runs on one repository each wait only for their own copy.
 */
export function workFolderOf(
  run: Pick<RunFacts, 'id' | 'deviceId' | 'folder' | 'cardKey' | 'worktreeFolder'>,
  gate: Pick<QueueGate, 'isolation' | 'canIsolate'>,
): string {
  if (run.worktreeFolder) return run.worktreeFolder;
  if (gate.isolation !== 'worktree' || !gate.canIsolate(run.deviceId, run.folder)) return run.folder;
  return worktreeFolderFor(run.folder, worktreeKeyOf(run)) ?? run.folder;
}

export interface QueueGate {
  readonly now: Date;
  readonly timezone: string;
  readonly pausedReason: 'owner' | 'usage_limit' | null;
  readonly quietHours: QuietHours | null;
  readonly usedToday: number;
  readonly perDay: number;
  readonly running: number;
  readonly maxConcurrent: number;
  /** Folders with a turn running in them, run or panel chat, by `folderKey`. */
  readonly busyFolders: ReadonlySet<string>;
  /** §9.2: the owner's choice, and whether this device's bridge can make a copy of this folder (it offers the action, and the folder was not found to be no repository). */
  readonly isolation: QueueIsolation;
  readonly canIsolate: (deviceId: string, folder: string) => boolean;
  readonly online: (deviceId: string) => boolean;
  readonly signedOut: (deviceId: string) => boolean;
  readonly engineUnavailable: (deviceId: string) => boolean;
}

/** Why this due run would not start now. Limits first, then its folder, then its device: the first that holds is the one said. */
export function holdFor(run: RunFacts, gate: QueueGate): HoldReason | null {
  if (gate.pausedReason === 'owner') return 'paused_all';
  if (gate.pausedReason === 'usage_limit') return 'usage_limit';
  if (inQuietHours(gate.now, gate.quietHours, gate.timezone)) return 'quiet_hours';
  if (gate.usedToday >= gate.perDay) return 'daily_limit';
  if (gate.running >= gate.maxConcurrent) return 'concurrency';
  const folders = [workFolderOf(run, gate), ...(run.extraFolders ?? [])];
  if (folders.some((folder) => gate.busyFolders.has(folderKey(run.deviceId, folder)))) {
    return 'folder_busy';
  }
  if (run.dirtyFiles && !run.allowDirty && workFolderOf(run, gate) === run.folder) return 'folder_dirty';
  if (!gate.online(run.deviceId)) return 'device_offline';
  if (gate.signedOut(run.deviceId)) return 'signed_out';
  if (gate.engineUnavailable(run.deviceId)) return 'engine_unavailable';
  return null;
}

/** The order the owner chose, kept in the positions these runs already had, so runs left out keep theirs. */
export function reorderPositions(
  wanted: readonly string[],
  current: readonly { id: string; position: number }[],
): Map<string, number> {
  const known = new Map(current.map((run) => [run.id, run.position]));
  const ids = wanted.filter((id) => known.has(id));
  const slots = ids.map((id) => known.get(id)!).sort((a, b) => a - b);
  // Two runs made in the same millisecond share a slot; the new order must still be strict.
  for (let index = 1; index < slots.length; index += 1) {
    if (slots[index]! <= slots[index - 1]!) slots[index] = slots[index - 1]! + 0.001;
  }
  return new Map(ids.map((id, index) => [id, slots[index]!]));
}
