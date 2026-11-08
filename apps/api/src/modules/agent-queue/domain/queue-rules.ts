/**
 * @file The queue's rules, pure (docs/16 §9): what a run shows as, why a due run waits, and which runs start now.
 * @description The dispatcher and the page read the same `holdFor`, so the page never says something the dispatcher does not do. One run per folder holds across chats too: a panel turn in the same checkout also keeps a run waiting, because both would edit the same files.
 */
import {
  type HoldReason,
  inQuietHours,
  type QuietHours,
  type RunState,
  type RunViewState,
} from '@hub/contracts';

export interface RunFacts {
  readonly id: string;
  readonly deviceId: string;
  readonly folder: string;
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
  if (gate.busyFolders.has(folderKey(run.deviceId, run.folder))) return 'folder_busy';
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
