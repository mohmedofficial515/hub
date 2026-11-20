/**
 * @file The agent queue (docs/16 §9, "Slice 5 as built"): runs, schedules, limits, and the calendar rules both the API and the web read.
 * @description A run is a normal panel chat turn in Execute (D51), started by Hub at its time and within the owner's limits. The database is the truth: a run is a row, and its schedule is `runAt` plus an optional weekly repeat.
 * Times are local to the queue's timezone: the owner's setting, or else the machine's. `once` and `weekly` carry local dates and times, so the browser's own zone never decides anything.
 */
import { z } from 'zod';

import { cardKeySchema } from './cards/card';
import {
  APPROVAL_CATEGORIES,
  changedFileSchema,
  CHAT_LIMITS,
  QUEUE_EXTRA_FOLDERS,
  TURN_FAILURES,
} from './chat';
import { absolutePath } from './projects';
import { roleSchema } from './roles';
import { QUEUE_ISOLATIONS } from './worktrees';

/** What a run starts from. A task runs `/hub:work`, so its stages and report land on the card. */
export const RUN_SOURCES = ['task', 'plan_step', 'prompt'] as const;
export type RunSource = (typeof RUN_SOURCES)[number];

/**
 * How a run treats the owner (D58). `approval`, the default, is the panel's D41: it pauses for the owner, and a queued run waits with no time limit. `automatic` never waits: whatever needs approval is refused at once and kept as a pending item, and a question takes its recommended option.
 */
export const RUN_MODES = ['approval', 'automatic'] as const;
export type RunMode = (typeof RUN_MODES)[number];

/** What is stored. `queued` covers both "next" and "scheduled": a future `runAt` is what makes it scheduled. */
export const RUN_STATES = [
  'queued',
  'running',
  'done',
  'failed',
  'stopped',
  'interrupted',
  'cancelled',
] as const;
export type RunState = (typeof RUN_STATES)[number];

/** What the page shows, derived from the stored state, the time, the pause and the run's chat. */
export const RUN_VIEW_STATES = [
  'waiting',
  'running',
  'next',
  'scheduled',
  'paused',
  'done',
  'failed',
  'stopped',
  'interrupted',
  'cancelled',
] as const;
export type RunViewState = (typeof RUN_VIEW_STATES)[number];

/** The page's four sections (§9). Scheduled and paused runs sit in Next, in their order. */
export const QUEUE_SECTIONS = ['running', 'waiting', 'next', 'recent'] as const;
export type QueueSection = (typeof QUEUE_SECTIONS)[number];

export function sectionOf(state: RunViewState): QueueSection {
  if (state === 'running') return 'running';
  if (state === 'waiting') return 'waiting';
  if (state === 'next' || state === 'scheduled' || state === 'paused') return 'next';
  return 'recent';
}

/** Why a due run has not started. One reason, the first that holds, so the page can say it plainly. */
export const HOLD_REASONS = [
  'paused_all',
  'usage_limit',
  'quiet_hours',
  'daily_limit',
  'concurrency',
  'folder_busy',
  /** Folder isolation only (docs/16 §9.2): its folder holds changes not committed, which the run would mix with its own. The owner's press starts it anyway. */
  'folder_dirty',
  'device_offline',
  'signed_out',
  'engine_unavailable',
  'folder_not_allowed',
] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];

export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const localDateSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);

export const QUEUE_LIMITS = {
  maxConcurrent: 5,
  perDay: 50,
  /** How many finished runs the page lists under Recent. */
  recent: 30,
  promptChars: CHAT_LIMITS.promptChars,
  summaryChars: 600,
  titleChars: 200,
} as const;

/** When a run starts. `now` joins the line at once, `once` is a local date and time, `weekly` repeats on a day at a local time. */
export const runWhenSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('now') }),
  z.object({ kind: z.literal('once'), date: localDateSchema, time: localTime }),
  z.object({ kind: z.literal('weekly'), day: z.enum(WEEKDAYS), time: localTime }),
]);
export type RunWhen = z.infer<typeof runWhenSchema>;

export const createRunSchema = z
  .object({
    source: z.enum(RUN_SOURCES),
    /** The task, or the plan whose step this is. */
    cardKey: cardKeySchema.optional(),
    /** The step's place in the plan, from 0. */
    planStep: z.number().int().min(0).max(199).optional(),
    /** A chat prompt's words. */
    prompt: z.string().trim().min(1).max(QUEUE_LIMITS.promptChars).optional(),
    device: z.uuid(),
    /** The main folder: the run's working directory. */
    folder: absolutePath,
    when: runWhenSchema,
    /** D58. Absent is `approval`. */
    mode: z.enum(RUN_MODES).optional(),
    /** D59: more folders registered on the same project, passed to Claude Code with `--add-dir`. All of them are held while the run works. */
    extraFolders: z.array(absolutePath).max(QUEUE_EXTRA_FOLDERS).optional(),
    /** D60: the roles the run works as. Each one's line, specialties and reading path go into its context. */
    roles: z.array(roleSchema).max(7).optional(),
  })
  .superRefine((value, ctx) => {
    const key = (path: string) => path.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
    const folders = [value.folder, ...(value.extraFolders ?? [])].map(key);
    if (new Set(folders).size !== folders.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['extraFolders'],
        message: 'Each folder once, and not the main one',
      });
    }
    if (value.roles && new Set(value.roles).size !== value.roles.length) {
      ctx.addIssue({ code: 'custom', path: ['roles'], message: 'Each role once' });
    }
    if (value.source === 'prompt' && !value.prompt) {
      ctx.addIssue({ code: 'custom', path: ['prompt'], message: 'A prompt run needs its words' });
    }
    if (value.source !== 'prompt' && !value.cardKey) {
      ctx.addIssue({ code: 'custom', path: ['cardKey'], message: 'A task or plan step run needs its card' });
    }
    if (value.source === 'plan_step' && value.planStep === undefined) {
      ctx.addIssue({ code: 'custom', path: ['planStep'], message: 'A plan step run needs the step' });
    }
  });
export type CreateRunInput = z.infer<typeof createRunSchema>;

/** The full order of the runs that have not started, first to start first. Ids not listed keep their place after these. */
export const reorderRunsSchema = z.object({ ids: z.array(z.uuid()).min(1).max(500) });
export type ReorderRunsInput = z.infer<typeof reorderRunsSchema>;

/** The mode of a run that has not started (D58). Only the owner's press changes it; no agent tool does. */
export const setRunModeSchema = z.object({ mode: z.enum(RUN_MODES) });
export type SetRunModeInput = z.infer<typeof setRunModeSchema>;

export const queueRunsQuerySchema = z.object({ card: cardKeySchema.optional() });

export const quietHoursSchema = z.object({ from: localTime, to: localTime });
export type QuietHours = z.infer<typeof quietHoursSchema>;

export const queueSettingsInputSchema = z.object({
  maxConcurrent: z.number().int().min(1).max(QUEUE_LIMITS.maxConcurrent).optional(),
  perDay: z.number().int().min(1).max(QUEUE_LIMITS.perDay).optional(),
  quietHours: quietHoursSchema.nullable().optional(),
  /** An IANA name. Null goes back to the machine's. */
  timezone: z.string().trim().min(1).max(64).nullable().optional(),
  /** docs/16 §9.2: each run in its own copy of the repository, or in the registered folder. */
  isolation: z.enum(QUEUE_ISOLATIONS).optional(),
});
export type QueueSettingsInput = z.infer<typeof queueSettingsInputSchema>;

export const queuePauseSchema = z.object({ paused: z.boolean() });

export const QUEUE_DEFAULTS = {
  maxConcurrent: 1,
  perDay: 5,
  quietHours: null,
  isolation: 'worktree',
} as const;

// ── Answers ────────────────────────────────────────────────────────────────────────────────────────

/**
 * What an automatic run decided on the owner's behalf (D58). `skipped` is a pending item: the exact command, the folder, and why, never run. Run it later starts a chat on that folder, where D41 asks the owner as usual.
 */
export const runDecisionSchema = z.object({
  id: z.string(),
  kind: z.enum(['skipped', 'answered']),
  command: z.string(),
  category: z.enum(APPROVAL_CATEGORIES),
  folder: z.string(),
  /** The model's own reason when it gave one (a shell call's description), else null. */
  why: z.string().nullable(),
  /** `answered`: each question and the option taken. */
  answers: z.array(z.object({ question: z.string(), answer: z.string() })),
  at: z.string(),
  /** The chat Run it later started, once pressed. */
  followChatId: z.string().nullable(),
});
export type RunDecision = z.infer<typeof runDecisionSchema>;

export const agentRunSchema = z.object({
  id: z.string(),
  source: z.enum(RUN_SOURCES),
  title: z.string(),
  cardKey: z.string().nullable(),
  planStep: z.number().int().nullable(),
  /** What the engine is told. Prompts are the owner's words; a task's is `/hub:work KEY`. */
  prompt: z.string(),
  deviceId: z.string(),
  deviceName: z.string(),
  folder: z.string(),
  extraFolders: z.array(z.string()),
  mode: z.enum(RUN_MODES),
  roles: z.array(roleSchema),
  /** Every choice an automatic run took for the owner, and its pending items, oldest first. */
  decisions: z.array(runDecisionSchema),
  state: z.enum(RUN_VIEW_STATES),
  stored: z.enum(RUN_STATES),
  /** Set when a due run waits: why. */
  hold: z.enum(HOLD_REASONS).nullable(),
  /**
   * docs/16 §9.2: the run's own copy of its repository, once made. `removed` once the owner removed it; its branch stays.
   */
  worktree: z
    .object({ folder: z.string(), branch: z.string(), base: z.string(), removed: z.boolean() })
    .nullable(),
  /** Folder isolation: how many changed files held it at its last look, until it starts or the owner lets it. */
  dirtyFiles: z.number().int().nullable(),
  /** The owner let it start in a folder with changes not committed. */
  allowDirty: z.boolean(),
  runAt: z.string().nullable(),
  repeat: z.object({ day: z.enum(WEEKDAYS), time: z.string() }).nullable(),
  paused: z.boolean(),
  /** Its order among the runs that have not started. */
  position: z.number(),
  chatId: z.string().nullable(),
  messageId: z.string().nullable(),
  /** The approval or question it waits on, while it waits. */
  waitingOn: z
    .object({
      id: z.string(),
      kind: z.enum(['approval', 'question']),
      command: z.string(),
      category: z.string(),
    })
    .nullable(),
  failure: z.enum(TURN_FAILURES).nullable(),
  summary: z.string().nullable(),
  changedFiles: z.array(changedFileSchema),
  /** Set for a task run whose report moved it, or did not. Only what the server decided (D52). */
  moved: z.boolean().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
});
export type AgentRunDto = z.infer<typeof agentRunSchema>;

export const queueStateSchema = z.object({
  paused: z.boolean(),
  pausedReason: z.enum(['owner', 'usage_limit']).nullable(),
  /** When a usage limit says it resets. The queue continues then, once; with no time it waits for the owner. */
  resumesAt: z.string().nullable(),
  maxConcurrent: z.number().int(),
  perDay: z.number().int(),
  usedToday: z.number().int(),
  running: z.number().int(),
  quietHours: quietHoursSchema.nullable(),
  inQuietHours: z.boolean(),
  timezone: z.string(),
  timezoneSource: z.enum(['setting', 'machine']),
  isolation: z.enum(QUEUE_ISOLATIONS),
  /** The machine's own zone, for the settings' default line. */
  machineTimezone: z.string(),
});
export type QueueStateDto = z.infer<typeof queueStateSchema>;

export const queueSchema = z.object({ state: queueStateSchema, runs: z.array(agentRunSchema) });
export type QueueDto = z.infer<typeof queueSchema>;

/** A durable nudge on the stream, with no text: the page rereads the queue. */
export interface QueueChanged {
  readonly runId: string | null;
}

// ── What the engine is told ────────────────────────────────────────────────────────────────────────

/**
 * A task runs the work protocol, so its stages and `report_work` land on the card. A step names its plan, and Claude reads the rest through Hub; it
 * reports the same five stages, which the plan's page shows on the running step (v5-live-plan, batch 2).
 */
export function runPrompt(input: {
  source: RunSource;
  cardKey?: string | null;
  planStep?: number | null;
  stepTitle?: string | null;
  prompt?: string | null;
}): string {
  if (input.source === 'task') return `/hub:work ${input.cardKey ?? ''}`.trim();
  if (input.source === 'plan_step') {
    const step = (input.planStep ?? 0) + 1;
    return `Carry out step ${step} of plan ${input.cardKey ?? ''}: ${input.stepTitle ?? ''}\nRead the plan with hub get_card first, do only this step, run its checks, and say what you changed and what you did not check.
As /hub:work does, call hub report_stage with protocol work as each of its stages (understand, plan, execute, verify, report) starts and ends, so the plan's page shows where you are.`;
  }
  return input.prompt ?? '';
}

// ── Calendar, in the queue's timezone ──────────────────────────────────────────────────────────────

const parts = (at: Date, timezone: string): Record<string, string> =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );

/** Whether a name is a timezone this runtime knows. */
export function isTimezone(name: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

export function localDateOf(at: Date, timezone: string): string {
  const p = parts(at, timezone);
  return `${p['year']}-${p['month']}-${p['day']}`;
}

export function localTimeOf(at: Date, timezone: string): string {
  const p = parts(at, timezone);
  return `${p['hour']}:${p['minute']}`;
}

const minutesOf = (time: string): number => {
  const [hour = '0', minute = '0'] = time.split(':');
  return Number(hour) * 60 + Number(minute);
};

/** The instant a local date and time happen. Asks the zone twice, so a DST change that day is right. */
export function localInstant(date: string, time: string, timezone: string): Date {
  const wanted = Date.parse(`${date}T${time}:00Z`);
  const offsetAt = (instant: number): number => {
    const p = parts(new Date(instant), timezone);
    const shown = Date.UTC(
      Number(p['year']),
      Number(p['month']) - 1,
      Number(p['day']),
      Number(p['hour']),
      Number(p['minute']),
      Number(p['second']),
    );
    return shown - instant;
  };
  const first = wanted - offsetAt(wanted);
  return new Date(wanted - offsetAt(first));
}

/** Midnight of the local day holding `at`: where "runs per day" starts counting. */
export const startOfLocalDay = (at: Date, timezone: string): Date =>
  localInstant(localDateOf(at, timezone), '00:00', timezone);

const addDays = (date: string, days: number): string => {
  const utc = new Date(`${date}T00:00:00Z`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
};

/** The first time after `after` that is `day` at `time`, local. */
export function nextWeekly(day: Weekday, time: string, timezone: string, after: Date): Date {
  const today = localDateOf(after, timezone);
  const todayIndex = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const wanted = WEEKDAYS.indexOf(day);
  for (let ahead = 0; ahead <= 7; ahead += 1) {
    if ((todayIndex + ahead) % 7 !== wanted) continue;
    const at = localInstant(addDays(today, ahead), time, timezone);
    if (at.getTime() > after.getTime()) return at;
  }
  return localInstant(addDays(today, 7), time, timezone);
}

/** Quiet hours may wrap past midnight: 22:00 to 07:00 holds both 23:00 and 06:00. Equal ends mean none. */
export function inQuietHours(at: Date, quiet: QuietHours | null, timezone: string): boolean {
  if (!quiet || quiet.from === quiet.to) return false;
  const now = minutesOf(localTimeOf(at, timezone));
  const from = minutesOf(quiet.from);
  const to = minutesOf(quiet.to);
  return from < to ? now >= from && now < to : now >= from || now < to;
}

/** When a `once` or `weekly` choice first happens. A `once` in the past is due at once, as a missed run is. */
export function firstRunAt(when: RunWhen, timezone: string, now: Date): Date | null {
  if (when.kind === 'now') return null;
  if (when.kind === 'once') return localInstant(when.date, when.time, timezone);
  return nextWeekly(when.day, when.time, timezone, now);
}
