/**
 * @file The rule behind `report_work` (docs/16 §7.2, D52): what a report's checks rest on. Pure, so each rule has its own test.
 * @description Models are unreliable narrators, so this never takes a check's word for it. A check is verified only when a real step of this chat ran the same command and the last such run succeeded. Saying a failed run passed is a contradiction, and the report is refused. Every earlier run stays in `runs`, so a fix never erases its failure (review M3).
 */
import type {
  CheckOutcome,
  CheckRun,
  ReportedCheck,
  ReportMoveReason,
  ReportWorkInput,
  WorkReport,
} from '@hub/contracts';

const EXCERPT_CHARS = 300;
const RUNS_PER_CHECK = 20;

export interface StepFact {
  readonly toolUseId: string;
  readonly command: string | null;
  readonly status: string;
  readonly output: string | null;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
}

export interface Contradiction {
  readonly name: string;
  readonly stepId: string;
}

const sameCommand = (left: string, right: string): boolean =>
  left.trim().replace(/\s+/g, ' ') === right.trim().replace(/\s+/g, ' ');

const RUN_STATUS: Readonly<Record<string, CheckRun['status']>> = {
  done: 'passed',
  error: 'failed',
  cut_off: 'cut_off',
};

function runOf(step: StepFact): CheckRun {
  return {
    stepId: step.toolUseId,
    status: RUN_STATUS[step.status] ?? 'running',
    startedAt: step.startedAt.toISOString(),
    endedAt: step.endedAt?.toISOString() ?? null,
    ...(step.output ? { excerpt: step.output.slice(-EXCERPT_CHARS) } : {}),
  };
}

function verdict(
  outcome: CheckOutcome,
  last: CheckRun,
): { verified: boolean; basis: ReportedCheck['basis']; contradicted: boolean } {
  if (last.status === 'running' || last.status === 'cut_off') {
    return { verified: false, basis: 'not_finished', contradicted: false };
  }
  if (outcome === 'passed') {
    if (last.status === 'failed') return { verified: false, basis: 'matched', contradicted: true };
    return { verified: true, basis: 'matched', contradicted: false };
  }
  if (last.status === 'passed') return { verified: false, basis: 'outcome_differs', contradicted: false };
  return { verified: false, basis: 'matched', contradicted: false };
}

/** Each check, judged against this chat's real steps. `steps` is null outside a panel chat, where nothing can be verified. */
export function judgeChecks(
  checks: ReportWorkInput['checks'],
  steps: readonly StepFact[] | null,
): { checks: ReportedCheck[]; contradictions: Contradiction[] } {
  const contradictions: Contradiction[] = [];
  const judged = checks.map((check): ReportedCheck => {
    const claimed = {
      name: check.name,
      command: check.command ?? null,
      outcome: check.outcome,
      note: check.note ?? null,
    };
    const unverified = (basis: ReportedCheck['basis'], stepId: string | null = null): ReportedCheck => ({
      ...claimed,
      stepId,
      verified: false,
      basis,
      runs: [],
    });
    if (!steps) return unverified('outside_panel');
    const named = check.stepId ? steps.find((step) => step.toolUseId === check.stepId) : undefined;
    if (check.stepId && !named) return unverified('no_matching_step');
    if (named && check.command && (!named.command || !sameCommand(named.command, check.command))) {
      return unverified('step_mismatch', named.toolUseId);
    }
    const command = check.command ?? named?.command ?? null;
    if (!command) return unverified('no_command');
    const runs = steps
      .filter((step) => step.command !== null && sameCommand(step.command, command))
      .map(runOf)
      .slice(-RUNS_PER_CHECK);
    const last = runs.at(-1);
    if (!last) return unverified('no_matching_step');
    const { verified, basis, contradicted } = verdict(check.outcome, last);
    if (contradicted) contradictions.push({ name: check.name, stepId: last.stepId });
    return { ...claimed, command, stepId: last.stepId, verified, basis, runs };
  });
  return { checks: judged, contradictions };
}

/** Whether the checks allow a move (D52). The card's own state is judged later, under its lock, by the card action. */
export function moveEligibility(
  origin: WorkReport['origin'],
  checks: readonly ReportedCheck[],
  droppedChecks: readonly string[],
): ReportMoveReason {
  if (origin === 'outside_panel') return 'outside_panel';
  if (checks.length === 0) return 'no_checks';
  if (droppedChecks.length > 0) return 'check_dropped';
  if (checks.some((check) => check.outcome !== 'passed')) return 'check_not_passed';
  if (checks.some((check) => !check.verified)) return 'check_not_verified';
  return 'all_verified';
}

export function countsOf(checks: readonly ReportedCheck[]): WorkReport['counts'] {
  const of = (outcome: CheckOutcome) => checks.filter((check) => check.outcome === outcome).length;
  return {
    total: checks.length,
    passed: of('passed'),
    failed: of('failed'),
    skipped: of('skipped'),
    verified: checks.filter((check) => check.verified).length,
    failedRuns: checks.flatMap((check) => check.runs).filter((run) => run.status === 'failed').length,
  };
}

/** Names an earlier report in this chat held that this one left out. Leaving a failed check out is not how it gets fixed. */
export function droppedFrom(
  earlier: readonly Pick<WorkReport, 'cardKey' | 'checks'>[],
  cardKey: string,
  checks: readonly { readonly name: string }[],
): string[] {
  const named = new Set(checks.map((check) => check.name));
  const before = earlier
    .filter((report) => report.cardKey === cardKey)
    .flatMap((report) => report.checks.map((check) => check.name));
  return [...new Set(before)].filter((name) => !named.has(name));
}
