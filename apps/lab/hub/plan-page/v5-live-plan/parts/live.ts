/**
 * The live layer. In Hub it is fed by the project's SSE stream (`/workspaces/{ws}/events/stream`): `plan_steps_changed` when a
 * step's task finishes, `work_reported`, `commit`, `pr_opened`, plus the NEW `run_stage` event (a run on a plan step, carrying
 * the `report_stage` protocol stages). In the lab a scripted run replays those events on a clock, so every moment can be tried:
 * play, pause, speed, approve, deny, drop the connection, finish the phase, reset.
 */
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { DEMO_EVIDENCE } from './demo';
import type { Evidence, NumberedStep, PhaseGroup } from './model';

export const STAGES = ['understand', 'plan', 'execute', 'verify', 'report'] as const;
export type Stage = (typeof STAGES)[number];
export type StageState = 'todo' | 'started' | 'done' | 'failed';

export interface Run {
  stepId: string;
  stages: Record<Stage, StageState>;
  /** What Claude is doing now, kept as a phrase key so it reads in the page's language even if it changes mid-run. */
  note: Say;
  /** Sim clock (seconds) when the run started; the UI shows elapsed time from it. */
  startedAt: number;
  waiting: { command: string } | null;
  failed: boolean;
}

export type FeedKind = 'started' | 'stage' | 'commit' | 'approval' | 'approved' | 'denied' | 'evidence' | 'done' | 'phase_done' | 'resync';

export interface FeedItem {
  id: number;
  kind: FeedKind;
  say: Say;
  /** Sim clock when it happened. */
  at: number;
}

export interface LiveState {
  connection: 'live' | 'reconnecting';
  playing: boolean;
  speed: 1 | 2 | 4;
  clock: number;
  cursor: number;
  run: Run | null;
  doneIds: string[];
  evidence: Record<string, Evidence[]>;
  feed: FeedItem[];
  /** The step that just finished, for its moment of completion. */
  justDone: { id: string; key: number } | null;
  celebrate: { phase: number; key: number } | null;
  seq: number;
}

/** One scripted beat: `at` is seconds on the sim clock after the run starts. `wait` stops the clock until approve or deny. */
type Beat = { at: number; apply: (s: LiveState, ctx: Ctx) => LiveState; wait?: boolean };

interface Ctx {
  step: NumberedStep | null;
  phase: PhaseGroup | null;
  words: LiveWords;
}

/** The words the script writes into the feed, from the page's i18n so the feed reads in the page's language. */
export interface LiveWords {
  started: (n: number) => string;
  understand: string;
  plan: string;
  execute: (file: string) => string;
  commit: string;
  approval: (cmd: string) => string;
  approved: string;
  denied: string;
  verify: string;
  verified: string;
  evidence: string;
  done: (n: number) => string;
  phaseDone: (title: string) => string;
  resync: string;
}

export type SayKey = keyof LiveWords;
/** A phrase by key with its one value (a step number, a file, a command): rendered with the page's words at display time. */
export interface Say {
  k: SayKey;
  a?: string | number;
}
const say = (k: SayKey, a?: string | number): Say => ({ k, a });

export function sayText(words: LiveWords, s: Say | string): string {
  if (typeof s === 'string') return s;
  const w = words[s.k] as string | ((value: string | number) => string) | undefined;
  if (w === undefined) return '';
  if (typeof w === 'function') return w(s.a ?? '');
  return s.a === undefined ? w : `${w} ${s.a}`;
}

const FILE = 'src/components/search/search-form.tsx';
const COMMAND = 'pnpm --filter web test search';
const COMMIT = 'a1b2c3d fix(search): keep the query when the language changes';

const stagesWith = (patch: Partial<Record<Stage, StageState>>, base?: Record<Stage, StageState>) => ({
  ...(base ?? { understand: 'todo', plan: 'todo', execute: 'todo', verify: 'todo', report: 'todo' }),
  ...patch,
});

const push = (s: LiveState, kind: FeedKind, text: Say): LiveState => ({
  ...s,
  seq: s.seq + 1,
  feed: [{ id: s.seq + 1, kind, say: text, at: s.clock }, ...s.feed].slice(0, 12),
});

const withRun = (s: LiveState, patch: Partial<Run>): LiveState => (s.run ? { ...s, run: { ...s.run, ...patch } } : s);

function script(): Beat[] {
  return [
    {
      at: 0.6,
      apply: (s, { step }) =>
        step
          ? push({ ...s, run: { stepId: step.id, stages: stagesWith({ understand: 'started' }), note: say('understand'), startedAt: s.clock, waiting: null, failed: false } }, 'started', say('started', step.n))
          : s,
    },
    { at: 3, apply: (s) => withRun(s, { stages: stagesWith({ understand: 'done', plan: 'started' }, s.run?.stages), note: say('plan') }) },
    { at: 5.5, apply: (s) => withRun(s, { stages: stagesWith({ plan: 'done', execute: 'started' }, s.run?.stages), note: say('execute', FILE) }) },
    { at: 8.5, apply: (s) => push(s, 'commit', say('commit', COMMIT)) },
    {
      at: 10.5,
      wait: true,
      apply: (s) => push(withRun(s, { waiting: { command: COMMAND }, note: say('approval', COMMAND) }), 'approval', say('approval', COMMAND)),
    },
    { at: 12, apply: (s) => withRun(s, { stages: stagesWith({ execute: 'done', verify: 'started' }, s.run?.stages), note: say('verify') }) },
    { at: 15, apply: (s) => withRun(s, { stages: stagesWith({ verify: 'done', report: 'started' }, s.run?.stages), note: say('verified') }) },
    {
      at: 17,
      apply: (s, { step }) => (step ? push({ ...s, evidence: { ...s.evidence, [step.id]: DEMO_EVIDENCE.filter((e) => e.kind !== 'video') } }, 'evidence', say('evidence')) : s),
    },
    {
      at: 19,
      apply: (s, { step, phase }) => {
        if (!step) return s;
        let next = push({ ...s, run: null, doneIds: [...s.doneIds, step.id], justDone: { id: step.id, key: s.seq + 1 } }, 'done', say('done', step.n));
        const left = phase?.steps.filter((x) => !x.done && x.id !== step.id).length ?? 1;
        if (phase && left === 0) next = push({ ...next, celebrate: { phase: phase.index, key: next.seq + 1 } }, 'phase_done', say('phaseDone', phase.phase?.title ?? ''));
        return { ...next, playing: false };
      },
    },
  ];
}

type Action =
  | { type: 'tick'; dt: number; ctx: Ctx }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'speed'; speed: 1 | 2 | 4 }
  | { type: 'approve'; ctx: Ctx }
  | { type: 'deny'; ctx: Ctx }
  | { type: 'drop' }
  | { type: 'reconnected'; ctx: Ctx }
  | { type: 'finishOne'; id: string; ctx: Ctx }
  | { type: 'celebrate'; phase: number; title: string; ctx: Ctx }
  | { type: 'reset'; playing: boolean };

const initial = (playing: boolean): LiveState => ({
  connection: 'live',
  playing,
  speed: 1,
  clock: 0,
  cursor: 0,
  run: null,
  doneIds: [],
  evidence: {},
  feed: [],
  justDone: null,
  celebrate: null,
  seq: 0,
});

const BEATS = script();

function reducer(s: LiveState, a: Action): LiveState {
  switch (a.type) {
    case 'tick': {
      if (!s.playing || s.run?.waiting || s.connection !== 'live') return s;
      let next = { ...s, clock: s.clock + a.dt * s.speed };
      while (next.cursor < BEATS.length && next.clock >= BEATS[next.cursor]!.at) {
        const beat = BEATS[next.cursor]!;
        next = { ...beat.apply(next, a.ctx), cursor: next.cursor + 1 };
        if (beat.wait) break;
      }
      return next;
    }
    case 'play':
      return s.cursor >= BEATS.length ? { ...initial(true), doneIds: s.doneIds, evidence: s.evidence, feed: s.feed, seq: s.seq } : { ...s, playing: true };
    case 'pause':
      return { ...s, playing: false };
    case 'speed':
      return { ...s, speed: a.speed };
    case 'approve':
      return s.run?.waiting ? push(withRun(s, { waiting: null }), 'approved', say('approved')) : s;
    case 'deny':
      return s.run?.waiting
        ? { ...push(withRun(s, { waiting: null, failed: true, stages: stagesWith({ execute: 'failed' }, s.run.stages), note: say('denied') }), 'denied', say('denied')), playing: false, cursor: BEATS.length }
        : s;
    case 'drop':
      return { ...s, connection: 'reconnecting' };
    case 'reconnected':
      return push({ ...s, connection: 'live' }, 'resync', say('resync'));
    case 'finishOne':
      return s.doneIds.includes(a.id) ? s : push({ ...s, doneIds: [...s.doneIds, a.id], justDone: { id: a.id, key: s.seq + 1 } }, 'done', say('done', Number(a.id.slice(1))));
    case 'celebrate':
      return push({ ...s, celebrate: { phase: a.phase, key: s.seq + 1 } }, 'phase_done', say('phaseDone', a.title));
    case 'reset':
      return initial(a.playing);
  }
}

/**
 * Runs the lab's scripted run against the plan as shown. `groupsOf` turns the live state into the page's phases (the card with the
 * run's done steps and evidence applied), so the next step and its phase are read from the page's truth after each beat.
 */
export function useLiveSim({ enabled, groupsOf, words }: { enabled: boolean; groupsOf: (state: LiveState) => PhaseGroup[]; words: LiveWords }) {
  const [state, dispatch] = useReducer(reducer, enabled, initial);
  // The plan as shown: the card with the run's results applied. Recomputed only when a result changes, not on every tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => groupsOf(state), [groupsOf, state.doneIds, state.evidence]);
  const ctx = useMemo<Ctx>(() => {
    const steps = groups.flatMap((g) => g.steps);
    const runId = state.run?.stepId;
    const step = (runId ? steps.find((s) => s.id === runId) : steps.find((s) => !s.done)) ?? null;
    const phase = step ? (groups.find((g) => g.steps.some((s) => s.id === step.id)) ?? null) : null;
    return { step, phase, words };
  }, [groups, state.run?.stepId, words]);

  useEffect(() => {
    if (!enabled || !state.playing) return;
    const id = window.setInterval(() => dispatch({ type: 'tick', dt: 0.1, ctx }), 100);
    return () => window.clearInterval(id);
  }, [enabled, state.playing, ctx]);

  useEffect(() => {
    if (state.connection !== 'reconnecting') return;
    const id = window.setTimeout(() => dispatch({ type: 'reconnected', ctx }), 2600);
    return () => window.clearTimeout(id);
  }, [state.connection, ctx]);

  /** Finish what is left of the run's phase, a step every 0.7 s, then celebrate the phase. */
  const finishPhase = useCallback(() => {
    const phase = ctx.phase ?? groups.find((g) => g.hasNext) ?? null;
    if (!phase) return;
    const left = phase.steps.filter((s) => !s.done && s.id !== state.run?.stepId);
    dispatch({ type: 'pause' });
    left.forEach((s, i) => window.setTimeout(() => dispatch({ type: 'finishOne', id: s.id, ctx }), 400 + i * 700));
    window.setTimeout(() => dispatch({ type: 'celebrate', phase: phase.index, title: phase.phase?.title ?? '', ctx }), 600 + left.length * 700);
  }, [ctx, groups, state.run?.stepId]);

  const controls = useMemo(
    () => ({
      play: () => dispatch({ type: 'play' }),
      pause: () => dispatch({ type: 'pause' }),
      setSpeed: (speed: 1 | 2 | 4) => dispatch({ type: 'speed', speed }),
      approve: () => dispatch({ type: 'approve', ctx }),
      deny: () => dispatch({ type: 'deny', ctx }),
      drop: () => dispatch({ type: 'drop' }),
      reset: () => dispatch({ type: 'reset', playing: false }),
      finishPhase,
    }),
    [ctx, finishPhase],
  );

  return { state, controls, groups };
}

export type LiveControls = ReturnType<typeof useLiveSim>['controls'];
