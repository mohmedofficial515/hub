/**
 * @file The rule behind `report_work` (docs/16 §7.2, D52).
 */
import type { ReportedCheck, ReportWorkInput } from '@hub/contracts';

import { countsOf, droppedFrom, judgeChecks, moveEligibility, type StepFact } from './work-report';

const AT = new Date('2026-11-06T10:00:00Z');
const step = (toolUseId: string, command: string | null, status = 'done', output = 'ok'): StepFact => ({
  toolUseId,
  command,
  status,
  output,
  startedAt: AT,
  endedAt: AT,
});
const check = (
  extra: Partial<ReportWorkInput['checks'][number]> = {},
): ReportWorkInput['checks'][number] => ({
  name: 'Tests',
  command: 'pnpm test',
  outcome: 'passed',
  ...extra,
});
const one = (input: ReportWorkInput['checks'][number], steps: StepFact[] | null) =>
  judgeChecks([input], steps).checks[0] as ReportedCheck;

describe('a check against real steps', () => {
  it('is verified only by a real run of the same command that succeeded', () => {
    const judged = one(check(), [step('a', 'pnpm test')]);
    expect(judged).toMatchObject({ verified: true, basis: 'matched', stepId: 'a' });
    expect(judged.runs).toEqual([expect.objectContaining({ stepId: 'a', status: 'passed', excerpt: 'ok' })]);
  });

  it('spacing does not matter, and any other word does', () => {
    expect(one(check({ command: ' pnpm   test ' }), [step('a', 'pnpm test')]).verified).toBe(true);
    expect(one(check({ command: 'pnpm test --all' }), [step('a', 'pnpm test')])).toMatchObject({
      verified: false,
      basis: 'no_matching_step',
    });
  });

  it('a step named by id must hold that command', () => {
    expect(one(check({ stepId: 'a' }), [step('a', 'pnpm lint')])).toMatchObject({
      verified: false,
      basis: 'step_mismatch',
      stepId: 'a',
    });
    expect(one(check({ stepId: 'missing' }), [step('a', 'pnpm test')]).basis).toBe('no_matching_step');
  });

  it('a step id alone is enough, and takes its command from the step', () => {
    const { command: _gone, ...rest } = check({ stepId: 'a' });
    expect(one(rest, [step('a', 'pnpm test')])).toMatchObject({ verified: true, command: 'pnpm test' });
  });

  it('with no command and no step, it is only claimed', () => {
    const { command: _gone, ...rest } = check();
    expect(one(rest, [step('a', 'pnpm test')])).toMatchObject({ verified: false, basis: 'no_command' });
  });

  it('outside a panel chat nothing can be verified', () => {
    expect(one(check(), null)).toMatchObject({ verified: false, basis: 'outside_panel', runs: [] });
  });

  it('a real step that failed, reported as passed, is a contradiction', () => {
    const { contradictions } = judgeChecks([check()], [step('a', 'pnpm test', 'error')]);
    expect(contradictions).toEqual([{ name: 'Tests', stepId: 'a' }]);
  });

  it('naming an earlier good run does not hide a later failure', () => {
    const { contradictions } = judgeChecks(
      [check({ stepId: 'a' })],
      [step('a', 'pnpm test'), step('b', 'pnpm test', 'error')],
    );
    expect(contradictions).toEqual([{ name: 'Tests', stepId: 'b' }]);
  });

  it('a fix keeps the failure: every run stays, and the last one decides', () => {
    const judged = one(check(), [step('a', 'pnpm test', 'error', 'FAIL 2'), step('b', 'pnpm test')]);
    expect(judged).toMatchObject({ verified: true, stepId: 'b' });
    expect(judged.runs.map((run) => run.status)).toEqual(['failed', 'passed']);
    expect(judged.runs[0]?.excerpt).toBe('FAIL 2');
  });

  it('a failed check reported as failed agrees with the step, and is not verified', () => {
    expect(one(check({ outcome: 'failed' }), [step('a', 'pnpm test', 'error')])).toMatchObject({
      verified: false,
      basis: 'matched',
    });
  });

  it('reported failed or skipped while the run passed is called out', () => {
    for (const outcome of ['failed', 'skipped'] as const) {
      expect(one(check({ outcome }), [step('a', 'pnpm test')]).basis).toBe('outcome_differs');
    }
  });

  it('a run with no result is not a pass', () => {
    expect(one(check(), [step('a', 'pnpm test', 'running')]).basis).toBe('not_finished');
    expect(one(check(), [step('a', 'pnpm test', 'cut_off')]).basis).toBe('not_finished');
  });
});

describe('the move (D52)', () => {
  const judged = (extra: Partial<ReportedCheck>): ReportedCheck => ({
    name: 'Tests',
    command: 'x',
    stepId: 'a',
    outcome: 'passed',
    note: null,
    verified: true,
    basis: 'matched',
    runs: [],
    ...extra,
  });

  it('needs at least one check, each passed and verified, in a panel chat, with none dropped', () => {
    expect(moveEligibility('panel', [judged({})], [])).toBe('all_verified');
    expect(moveEligibility('panel', [], [])).toBe('no_checks');
    expect(moveEligibility('panel', [judged({}), judged({ outcome: 'skipped' })], [])).toBe(
      'check_not_passed',
    );
    expect(moveEligibility('panel', [judged({ outcome: 'failed' })], [])).toBe('check_not_passed');
    expect(moveEligibility('panel', [judged({ verified: false })], [])).toBe('check_not_verified');
    expect(moveEligibility('panel', [judged({})], ['Lint'])).toBe('check_dropped');
    expect(moveEligibility('outside_panel', [judged({})], [])).toBe('outside_panel');
  });

  it('a check an earlier report named and this one drops is noticed', () => {
    const earlier = [
      { cardKey: 'T-1', checks: [judged({ name: 'Tests' }), judged({ name: 'Lint' })] },
      { cardKey: 'T-2', checks: [judged({ name: 'Other card' })] },
    ];
    expect(droppedFrom(earlier, 'T-1', [{ name: 'Tests' }])).toEqual(['Lint']);
    expect(droppedFrom(earlier, 'T-1', [{ name: 'Tests' }, { name: 'Lint' }])).toEqual([]);
  });

  it('counts real failed runs, including the ones a later run fixed', () => {
    const counts = countsOf([
      judged({
        runs: [
          { stepId: 'a', status: 'failed', startedAt: 'x', endedAt: 'x' },
          { stepId: 'b', status: 'passed', startedAt: 'x', endedAt: 'x' },
        ],
      }),
      judged({ outcome: 'skipped', verified: false }),
    ]);
    expect(counts).toEqual({ total: 2, passed: 1, failed: 0, skipped: 1, verified: 1, failedRuns: 1 });
  });
});
