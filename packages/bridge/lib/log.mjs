/**
 * @file The bridge's own log, and it stays small. An unbounded log once filled the owner's disk with 46 GB, so this one has hard limits.
 * @description At `limitBytes` the file moves to `<file>.1`, replacing the last one, so the log never takes more than twice the limit. A line is cut at `MAX_LINE_CHARS`. A failure to log never stops the bridge. Frames are never logged, as they can hold anything a chat holds.
 */
import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

export const LOG_LIMIT_BYTES = 1_048_576;
export const MAX_LINE_CHARS = 2_000;

export function createLog(file, { limitBytes = LOG_LIMIT_BYTES, now = () => new Date() } = {}) {
  return (line) => {
    try {
      mkdirSync(dirname(file), { recursive: true });
      if ((statSync(file, { throwIfNoEntry: false })?.size ?? 0) > limitBytes) {
        rmSync(`${file}.1`, { force: true });
        renameSync(file, `${file}.1`);
      }
      appendFileSync(file, `${now().toISOString()} ${String(line).slice(0, MAX_LINE_CHARS)}\n`);
    } catch {
      /* A log must not stop the bridge. */
    }
  };
}
