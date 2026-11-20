/**
 * @file explainer.ts
 * @description A plan's explainer video (v5-live-plan, batch 4): what the page shows, read from the plan's `explainer` and the member's agent queue
 * (an `explainer` run on this plan, its five film stages from `report_stage`), and asking for one. Pure, except `requestExplainer`.
 */
import type { AgentRunDto, ChatStage, ExplainerRequest, PlanExplainer } from '@hub/contracts';
import { FILM_STAGES } from '@hub/contracts';

import { currentRoute } from '@/components/shell/router';
import { post } from '@/lib/api/client';

import { getQueryClient } from '../../lib/query-client';
import { qk } from '../cards/keys';

export const EXPLAINER_DEFAULT: ExplainerRequest = {
  style: 'whiteboard',
  voice: 'google',
  googleVoice: 'Charon',
  dialect: 'egyptian',
  aspect: 'landscape',
  length: 'chapters',
  captions: true,
};

export type FilmStage = (typeof FILM_STAGES)[number];
export const FILM_STAGE_LIST: readonly FilmStage[] = FILM_STAGES;

/**
 * - `none`: never asked for.
 * - `queued`: asked for, its run has not started (or is not in this member's queue).
 * - `making`: its run works now; `stages` say where.
 * - `failed`: its last run ended without attaching the film.
 * - `ready`: the film is there. `outdated` when the plan moved past the revision it explains.
 */
export type ExplainerView =
  | { state: 'none' }
  | { state: 'queued'; explainer: PlanExplainer }
  | { state: 'making'; explainer: PlanExplainer; run: AgentRunDto; done: number; current: FilmStage | null }
  | { state: 'failed'; explainer: PlanExplainer; run: AgentRunDto }
  | { state: 'ready'; explainer: PlanExplainer; outdated: boolean };

const ENDED_BADLY = new Set<AgentRunDto['state']>(['failed', 'stopped', 'interrupted', 'cancelled']);

/** The explainer runs on this plan, newest first. */
export const explainerRuns = (runs: readonly AgentRunDto[], planKey: string) =>
  runs
    .filter((run) => run.source === 'explainer' && run.cardKey === planKey)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** How far the film is: stages done, and the one under way. */
export function filmProgress(reports: readonly ChatStage[]): { done: number; current: FilmStage | null } {
  const last = new Map<string, string>();
  for (const report of reports) if (report.protocol === 'film') last.set(report.stage, report.state);
  const done = FILM_STAGE_LIST.filter((stage) => last.get(stage) === 'done').length;
  const current = FILM_STAGE_LIST.find((stage) => last.get(stage) === 'started') ?? null;
  return { done, current };
}

export function explainerView(input: {
  explainer: PlanExplainer | null | undefined;
  planRevision: number;
  runs: readonly AgentRunDto[];
  stages?: readonly ChatStage[] | undefined;
}): ExplainerView {
  const { explainer } = input;
  if (!explainer) return { state: 'none' };
  if (explainer.status === 'ready') {
    return { state: 'ready', explainer, outdated: input.planRevision > explainer.revision };
  }
  const asked = Date.parse(explainer.requestedAt);
  const run = input.runs.find((item) => Date.parse(item.createdAt) >= asked - 1000) ?? null;
  if (run && (run.state === 'running' || run.state === 'waiting')) {
    return { state: 'making', explainer, run, ...filmProgress(input.stages ?? []) };
  }
  if (run && (ENDED_BADLY.has(run.state) || run.state === 'done')) return { state: 'failed', explainer, run };
  return { state: 'queued', explainer };
}

/** The phase a chapter lights on the map, by its index among the plan's phases; null for the intro and the close. */
export function chapterPhase(phaseId: string | null, phases: readonly { id: string }[]): number | null {
  if (phaseId === null) return null;
  const index = phases.findIndex((phase) => phase.id === phaseId);
  return index < 0 ? null : index;
}

/** The chapter playing at a time: the last that started by then. */
export function chapterAt(chapters: readonly { start: number }[], time: number): number {
  let at = 0;
  chapters.forEach((chapter, index) => {
    if (chapter.start <= time + 0.01) at = index;
  });
  return at;
}

/** `m:ss`. */
export const clockOf = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The folder of the member's machine where Hams lives, if the project has one registered: its name says hams. */
export const hamsFolderOf = (folders: readonly string[]) =>
  folders.find((folder) => /(^|[\\/])hams[\\/]?$/i.test(folder)) ?? null;

export async function requestExplainer(key: string, request: ExplainerRequest) {
  const { ws } = currentRoute();
  try {
    return await post<unknown>(`workspaces/${ws}/plans/${encodeURIComponent(key)}/explainer`, request);
  } finally {
    void getQueryClient().invalidateQueries({ queryKey: qk.card(ws, key) });
  }
}
