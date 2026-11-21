/**
 * @file live-run.ts
 * @description The live layer of a plan's page (v5-live-plan, batch 2), read from Hub's real data only. Nothing here is a new event: Claude's run on a
 * step is the agent queue's run (a `plan_step` run on this plan, or a `task` run on a step's task), its five stages are the `report_stage` reports
 * on the run's chat turn, the approval it waits on is the run's `waitingOn`, and the feed is built from the times Hub already keeps (a run's start and
 * end, an approval's ask and answer, a step's `doneAt`). The queue and the chat are reread by the live stream, so all of it follows the run as it
 * moves, and a reload or a reconnect rebuilds the same picture. Pure.
 */
import type { AgentRunDto, ChatApprovalDto, ChatStage, PlanRunDto } from '@hub/contracts';
import { WORK_STAGES } from '@hub/contracts';

import type { JourneyStep, PhaseGroup } from './journey';

export type Stage = (typeof WORK_STAGES)[number];
export const STAGES: readonly Stage[] = WORK_STAGES;
export type StageView = 'todo' | 'started' | 'done' | 'failed';

/**
 * What the page reads of a run: the member's own queue row, or another member's run as every member sees it (`fromPlanRun`), which carries its
 * stage reports and who runs it, and no controls.
 */
export type RunLike = Pick<
  AgentRunDto,
  'id' | 'source' | 'cardKey' | 'planStep' | 'state' | 'startedAt' | 'endedAt'
> & {
  /** Set on another member's run: read only. */
  member?: { userId: string; displayName: string } | undefined;
  stages?: readonly ChatStage[] | undefined;
};

/** A run of this plan's steps. */
export interface StepRun {
  run: RunLike;
  stepId: string;
}

/** Another member's run, in the queue's own words: a run waiting on its owner is `waiting`, one not started is `next`. */
export function fromPlanRun(dto: PlanRunDto): RunLike {
  const state: AgentRunDto['state'] =
    dto.state === 'running'
      ? dto.waiting
        ? 'waiting'
        : 'running'
      : dto.state === 'queued'
        ? 'next'
        : dto.state;
  return {
    id: dto.id,
    source: dto.source,
    cardKey: dto.cardKey,
    planStep: dto.planStep,
    state,
    startedAt: dto.startedAt,
    endedAt: dto.endedAt,
    member: dto.member,
    stages: dto.stages,
  };
}

const ACTIVE = new Set<AgentRunDto['state']>(['running', 'waiting']);

/**
 * The runs on this plan's steps: a `plan_step` run names the plan and the step's place; a step that became a task runs as that task (the queue turns
 * it into a `task` run), so a run on a step's task is that step's.
 */
export function runsOfPlan(
  runs: readonly RunLike[],
  planKey: string,
  steps: readonly Pick<JourneyStep, 'id' | 'taskKey'>[],
): StepRun[] {
  const byTask = new Map(steps.flatMap((s) => (s.taskKey ? [[s.taskKey, s.id] as const] : [])));
  return runs.flatMap((run) => {
    if (run.source === 'plan_step' && run.cardKey === planKey && run.planStep !== null) {
      const step = steps[run.planStep];
      return step ? [{ run, stepId: step.id }] : [];
    }
    if (run.source === 'task' && run.cardKey) {
      const stepId = byTask.get(run.cardKey);
      return stepId ? [{ run, stepId }] : [];
    }
    return [];
  });
}

/** The run Claude is on now: one that waits for the owner first, then the one that started last. */
export function activeRun(runs: readonly StepRun[]): StepRun | null {
  const live = runs.filter((r) => ACTIVE.has(r.run.state));
  live.sort(
    (a, b) =>
      Number(b.run.state === 'waiting') - Number(a.run.state === 'waiting') ||
      (b.run.startedAt ?? '').localeCompare(a.run.startedAt ?? ''),
  );
  return live[0] ?? null;
}

/** Each of the five stages as its last report left it, and the last note Claude gave. Reports of another protocol are not this run's. */
export function stagesOf(reports: readonly ChatStage[]): {
  stages: Record<Stage, StageView>;
  note: string | null;
} {
  const stages = Object.fromEntries(STAGES.map((s) => [s, 'todo'])) as Record<Stage, StageView>;
  let note: string | null = null;
  for (const report of reports) {
    if (report.protocol !== 'work' || !(STAGES as readonly string[]).includes(report.stage)) continue;
    stages[report.stage as Stage] = report.state;
    if (report.note) note = report.note;
  }
  return { stages, note };
}

export type FeedKind =
  | 'started'
  | 'approval'
  | 'approved'
  | 'denied'
  | 'question'
  | 'ended'
  | 'stopped'
  | 'done'
  | 'phase_done'
  | 'resync';

/** One line of the feed. Its words are read at display time from `kind` and its value, so a change of language rewords it. */
export interface FeedItem {
  id: string;
  kind: FeedKind;
  at: string;
  /** A step number, a phase title or a command. */
  value?: string | number | undefined;
}

const ENDED_WELL = new Set<AgentRunDto['state']>(['done']);
const ENDED_BADLY = new Set<AgentRunDto['state']>(['failed', 'stopped', 'interrupted']);
const ALLOWED = new Set<ChatApprovalDto['status']>(['allowed', 'auto_allowed']);
const REFUSED = new Set<ChatApprovalDto['status']>(['denied', 'timed_out', 'stopped', 'skipped']);

/**
 * What happened on this plan, newest first: runs started and ended, the approvals of the run Claude is on, steps done and phases completed. Each
 * comes from a time Hub stored, so the feed is the same after a reload. `extra` adds what only this page saw (back online after a gap).
 */
export function planFeed(input: {
  steps: readonly JourneyStep[];
  groups: readonly PhaseGroup[];
  runs: readonly StepRun[];
  /** The approvals of the active run's turn. */
  approvals?: readonly ChatApprovalDto[] | undefined;
  /** The questions Claude asked on that turn. */
  questions?: readonly { id: string; createdAt: string }[] | undefined;
  extra?: readonly FeedItem[] | undefined;
  limit?: number | undefined;
}): FeedItem[] {
  const n = new Map(input.steps.map((s) => [s.id, s.n]));
  const items: FeedItem[] = [];
  for (const { run, stepId } of input.runs) {
    const value = n.get(stepId);
    if (run.startedAt) items.push({ id: `${run.id}:start`, kind: 'started', at: run.startedAt, value });
    if (run.endedAt && ENDED_WELL.has(run.state))
      items.push({ id: `${run.id}:end`, kind: 'ended', at: run.endedAt, value });
    if (run.endedAt && ENDED_BADLY.has(run.state))
      items.push({ id: `${run.id}:end`, kind: 'stopped', at: run.endedAt, value });
  }
  for (const approval of input.approvals ?? []) {
    items.push({
      id: `${approval.id}:ask`,
      kind: 'approval',
      at: approval.createdAt,
      value: approval.command,
    });
    if (approval.answeredAt && ALLOWED.has(approval.status))
      items.push({
        id: `${approval.id}:yes`,
        kind: 'approved',
        at: approval.answeredAt,
        value: approval.command,
      });
    if (approval.answeredAt && REFUSED.has(approval.status))
      items.push({
        id: `${approval.id}:no`,
        kind: 'denied',
        at: approval.answeredAt,
        value: approval.command,
      });
  }
  for (const question of input.questions ?? []) {
    items.push({ id: `${question.id}:ask`, kind: 'question', at: question.createdAt });
  }
  for (const step of input.steps) {
    if (step.done && step.doneAt)
      items.push({ id: `${step.id}:done`, kind: 'done', at: step.doneAt, value: step.n });
  }
  for (const group of input.groups) {
    if (!group.phase || group.total === 0 || group.done < group.total) continue;
    const times = group.steps.map((s) => s.doneAt);
    if (times.some((t) => !t)) continue;
    const at = (times as string[]).reduce((a, b) => (a > b ? a : b));
    items.push({ id: `${group.phase.id}:phase`, kind: 'phase_done', at, value: group.phase.title });
  }
  items.push(...(input.extra ?? []));
  // Newest first; at one instant, a phase completing reads above the step that completed it.
  const rank: Partial<Record<FeedKind, number>> = { phase_done: 1 };
  items.sort((a, b) => b.at.localeCompare(a.at) || (rank[b.kind] ?? 0) - (rank[a.kind] ?? 0));
  return items.slice(0, input.limit ?? 12);
}

/** The phases that are complete: each has steps and every one is done. */
export const completePhases = (groups: readonly PhaseGroup[]): number[] =>
  groups.filter((g) => g.phase && g.total > 0 && g.done === g.total).map((g) => g.index);
