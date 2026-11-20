/**
 * @file The live layer's reading of Hub's data: which queue run is on which step, the stages from `report_stage`, and the feed from stored times.
 */
import type { AgentRunDto, ChatApprovalDto } from '@hub/contracts';
import { describe, expect, it } from 'vitest';

import { journeySteps, phaseGroups } from './journey';
import { activeRun, completePhases, planFeed, runsOfPlan, stagesOf } from './live-run';

const run = (over: Partial<AgentRunDto>): AgentRunDto => ({
  id: 'r1',
  source: 'plan_step',
  title: 'Step',
  cardKey: 'P-1',
  planStep: 0,
  prompt: '',
  deviceId: 'd',
  deviceName: 'PC',
  folder: 'F:/x',
  extraFolders: [],
  mode: 'approval',
  roles: [],
  decisions: [],
  state: 'running',
  stored: 'running',
  hold: null,
  worktree: null,
  dirtyFiles: null,
  allowDirty: false,
  runAt: null,
  repeat: null,
  paused: false,
  position: 0,
  chatId: 'c1',
  messageId: 'm1',
  waitingOn: null,
  failure: null,
  summary: null,
  changedFiles: [],
  moved: null,
  createdAt: '2026-11-20T10:00:00.000Z',
  startedAt: '2026-11-20T10:00:00.000Z',
  endedAt: null,
  ...over,
});

const steps = journeySteps([
  { id: 's1', title: 'One', done: true, doneAt: '2026-11-19T09:00:00.000Z', phaseId: 'p0' },
  { id: 's2', title: 'Two', done: true, doneAt: '2026-11-19T12:00:00.000Z', phaseId: 'p0' },
  { id: 's3', title: 'Three', done: false, taskKey: 'T-3', phaseId: 'p1' },
  { id: 's4', title: 'Four', done: false, phaseId: 'p1' },
]);
const groups = phaseGroups(
  [
    { id: 'p0', title: 'Setup' },
    { id: 'p1', title: 'Build' },
  ],
  steps,
);

describe('runs on a plan', () => {
  it('ties a plan step run by its place and a task run by the step’s task, and ignores other cards', () => {
    const tied = runsOfPlan(
      [
        run({ id: 'a', planStep: 3 }),
        run({ id: 'b', source: 'task', cardKey: 'T-3', planStep: null }),
        run({ id: 'c', cardKey: 'P-2' }),
        run({ id: 'd', source: 'task', cardKey: 'T-9', planStep: null }),
        run({ id: 'e', source: 'prompt', cardKey: null, planStep: null }),
        run({ id: 'f', planStep: 40 }),
      ],
      'P-1',
      steps,
    );
    expect(tied.map((r) => [r.run.id, r.stepId])).toEqual([
      ['a', 's4'],
      ['b', 's3'],
    ]);
  });

  it('the run on now is one that waits for the owner, else the last started; ended runs are not', () => {
    const tied = runsOfPlan(
      [
        run({ id: 'old', state: 'running', startedAt: '2026-11-20T09:00:00.000Z' }),
        run({ id: 'new', state: 'running', startedAt: '2026-11-20T11:00:00.000Z', planStep: 3 }),
        run({ id: 'done', state: 'done', startedAt: '2026-11-20T12:00:00.000Z' }),
      ],
      'P-1',
      steps,
    );
    expect(activeRun(tied)?.run.id).toBe('new');
    const waiting = runsOfPlan(
      [...tied.map((t) => t.run), run({ id: 'w', state: 'waiting', startedAt: '2026-11-20T08:00:00.000Z' })],
      'P-1',
      steps,
    );
    expect(activeRun(waiting)?.run.id).toBe('w');
    expect(activeRun(runsOfPlan([run({ state: 'failed' })], 'P-1', steps))).toBeNull();
  });
});

describe('stages', () => {
  it('keeps each work stage as its last report left it, and the last note', () => {
    const { stages, note } = stagesOf([
      { protocol: 'work', stage: 'understand', state: 'started', at: '1' },
      { protocol: 'work', stage: 'understand', state: 'done', at: '2', note: 'Read the plan' },
      { protocol: 'work', stage: 'execute', state: 'started', at: '3', note: 'Editing the form' },
      { protocol: 'doc', stage: 'search', state: 'started', at: '4', note: 'not this run' },
    ]);
    expect(stages).toEqual({
      understand: 'done',
      plan: 'todo',
      execute: 'started',
      verify: 'todo',
      report: 'todo',
    });
    expect(note).toBe('Editing the form');
  });
});

describe('the feed', () => {
  const approval = (over: Partial<ChatApprovalDto>): ChatApprovalDto => ({
    id: 'a1',
    messageId: 'm1',
    toolUseId: 't1',
    toolName: 'Bash',
    command: 'pnpm test',
    category: 'other',
    input: null,
    effect: '',
    draftId: null,
    status: 'pending',
    expiresAt: '',
    answeredAt: null,
    createdAt: '2026-11-20T10:05:00.000Z',
    ...over,
  });

  it('reads runs, approvals, steps and phases from their stored times, newest first', () => {
    const feed = planFeed({
      steps,
      groups,
      runs: runsOfPlan(
        [
          run({
            id: 'r0',
            state: 'done',
            startedAt: '2026-11-18T10:00:00.000Z',
            endedAt: '2026-11-18T11:00:00.000Z',
          }),
          run({ id: 'r1', planStep: 3, startedAt: '2026-11-20T10:00:00.000Z' }),
        ],
        'P-1',
        steps,
      ),
      approvals: [approval({ status: 'allowed', answeredAt: '2026-11-20T10:06:00.000Z' })],
      questions: [{ id: 'q1', createdAt: '2026-11-20T10:07:00.000Z' }],
    });
    expect(feed.map((f) => [f.kind, f.value ?? null])).toEqual([
      ['question', null],
      ['approved', 'pnpm test'],
      ['approval', 'pnpm test'],
      ['started', 4],
      ['phase_done', 'Setup'],
      ['done', 2],
      ['done', 1],
      ['ended', 1],
      ['started', 1],
    ]);
  });

  it('says a refused or failed thing as such, keeps its limit, and takes the page’s own lines', () => {
    const feed = planFeed({
      steps: [],
      groups: [],
      runs: [{ run: run({ state: 'failed', endedAt: '2026-11-20T10:09:00.000Z' }), stepId: 's1' }],
      approvals: [approval({ status: 'denied', answeredAt: '2026-11-20T10:08:00.000Z' })],
      extra: [{ id: 'x', kind: 'resync', at: '2026-11-20T10:10:00.000Z' }],
      limit: 3,
    });
    expect(feed.map((f) => f.kind)).toEqual(['resync', 'stopped', 'denied']);
  });

  it('a phase is complete when every step in it is done', () => {
    expect(completePhases(groups)).toEqual([0]);
  });
});
