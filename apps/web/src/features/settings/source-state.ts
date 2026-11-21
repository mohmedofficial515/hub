/**
 * @file source-state.ts
 * @description What a source's real fields say about it, in one word (docs/15 §3). Reading GitHub is deferred in this release, so the
 * kinds that depend on it say "not connected" until they have a real success, rather than a state nobody measured.
 */
import type { SourceKind } from '@hub/contracts';

import type { SettingsMap } from './queries';

export type SourceState = 'disabled' | 'failing' | 'lagging' | 'not_connected' | 'never_run' | 'ok';

export interface SourceFacts {
  kind: SourceKind;
  enabled: boolean;
  config: Record<string, unknown>;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lagSec: number | null;
}

const GITHUB_KINDS: ReadonlySet<SourceKind> = new Set(['github_repo', 'openapi', 'docs_folder']);
export const needsGithub = (kind: SourceKind) => GITHUB_KINDS.has(kind);

const FALLBACK_SEC = { github: 120, lab: 60, docs: 300 };

const secondsOf = (settings: SettingsMap | undefined, key: string, fallback: number) => {
  const value = settings?.[key];
  return typeof value === 'number' ? value : fallback;
};

/** A source's period, from the project's `capture.*` settings. */
export function intervalSecOf(source: Pick<SourceFacts, 'kind' | 'config'>, settings?: SettingsMap): number {
  if (needsGithub(source.kind) && source.kind !== 'docs_folder') {
    return secondsOf(settings, 'capture.github.interval_sec', FALLBACK_SEC.github);
  }
  const lab = source.kind === 'lab' || source.config['purpose'] === 'lab';
  return lab
    ? secondsOf(settings, 'capture.lab.interval_sec', FALLBACK_SEC.lab)
    : secondsOf(settings, 'capture.docs.interval_sec', FALLBACK_SEC.docs);
}

export function sourceState(source: SourceFacts, settings?: SettingsMap): SourceState {
  if (!source.enabled) return 'disabled';
  if (source.lastError) return 'failing';
  if (needsGithub(source.kind) && !source.lastSuccessAt) return 'not_connected';
  if (!source.lastRunAt) return 'never_run';
  if (source.lagSec !== null && source.lagSec > 3 * intervalSecOf(source, settings)) return 'lagging';
  return 'ok';
}

export const isProblem = (state: SourceState) => state === 'failing' || state === 'lagging';

export type RunHour = 'ok' | 'partial' | 'failed' | 'idle';

const HOUR_MS = 3_600_000;

/**
 * The last 24 hours of real runs, one bucket per hour, oldest first. The worst run of an hour names it. Nothing to show means
 * `null`, so the page draws no strip rather than an empty one.
 */
export function hoursFromRuns(
  runs: readonly { startedAt: string; status: string }[],
  now: number,
): RunHour[] | null {
  const hours: RunHour[] = Array.from({ length: 24 }, () => 'idle');
  const rank: Record<RunHour, number> = { idle: 0, ok: 1, partial: 2, failed: 3 };
  let any = false;
  for (const run of runs) {
    const age = Math.floor((now - Date.parse(run.startedAt)) / HOUR_MS);
    const status = run.status;
    if (age < 0 || age >= 24 || (status !== 'ok' && status !== 'partial' && status !== 'failed')) continue;
    any = true;
    const index = 23 - age;
    if (rank[status] > rank[hours[index] ?? 'idle']) hours[index] = status;
  }
  return any ? hours : null;
}
