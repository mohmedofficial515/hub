'use client';

/**
 * @file plan-live.tsx
 * @description The live layer of a plan's page (v5-live-plan, batch 2), on Hub's real data: the stream's state as a badge, Claude's run on a step
 * (the member's agent queue) with its five stages (the run's `report_stage` reports), the approval it waits on with Approve and Deny (the chat's own
 * approval route, the same one the panel answers), the activity feed, and a celebration when a phase completes while the page is open. The lab's
 * simulation bar is not ported. Motion follows the page's `MotionConfig reducedMotion="user"`, and the CSS loops stop under reduced motion.
 * Screen readers: Claude's card is a region, its note and the feed are polite live regions, the approval box is an alert, and the stages are a list
 * with each state in words.
 */
import type { ChatApprovalDto, ChatFullDto } from '@hub/contracts';
import { animate, AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Check,
  CircleCheck,
  CircleSlash,
  Flag,
  Hand,
  type LucideIcon,
  MessageCircleQuestion,
  Play,
  RefreshCw,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Bidi,
  Button,
  cn,
  fmt,
  focusRing,
  kitMessages,
  Ltr,
  nowMs,
  num,
  RelativeTime,
  showToast,
  Tooltip,
  useLiveStatus,
  useLocale,
  useT,
} from '@/components/kit';
import { revealChat, useMaybeWb } from '@/components/workbench/store';
import type { PlanCard } from '@/features/cards/types';
import { useAnswerApproval, useChat } from '@/features/chat/queries';
import type { JourneyStep, PhaseGroup } from '@/features/planning/journey';
import { toneOf } from '@/features/planning/journey';
import {
  activeRun,
  completePhases,
  type FeedItem,
  type FeedKind,
  fromPlanRun,
  planFeed,
  runsOfPlan,
  type Stage,
  STAGES,
  stagesOf,
  type StageView,
} from '@/features/planning/live-run';
import { usePlanRuns, useQueue } from '@/features/queue/queries';
import { isHubError } from '@/lib/api/errors';

import type { PlanningMessages } from './messages';

type LiveWords = PlanningMessages['detail']['liveRun'];
const EASE = [0.2, 0.7, 0.2, 1] as const;
/** A press within this time of the box appearing is not an answer: the same guard as the panel's approval card. */
const ARM_MS = 400;

export type Connection = 'live' | 'reconnecting' | 'unavailable';

/** The run Claude is on, as the page shows it. */
export interface LiveRun {
  id: string;
  stepId: string;
  chatId: string | null;
  startedAt: string | null;
  stages: Record<Stage, StageView>;
  /** Claude's last note on a stage, in its own words. */
  note: string | null;
  waiting: { id: string; kind: 'approval' | 'question'; command: string; category: string } | null;
  /** False when the device that runs it is offline, so an answer cannot reach it. Null while unknown. */
  deviceOnline: boolean | null;
  /** Another member's run: shown, never answered or opened from here. */
  readOnly: boolean;
  /** Who runs it, when it is another member's. */
  member: string | null;
}

/** The turn the run is on: the run's own message, or the chat's last reply. */
function turnOf(chat: ChatFullDto | undefined, messageId: string | null) {
  if (!chat) return null;
  return (
    chat.messages.find((m) => m.id === messageId) ??
    [...chat.messages].reverse().find((m) => m.role === 'assistant') ??
    null
  );
}

/** A phase that completes while the page is open, once. Phases complete at first paint never celebrate. */
function useNewlyComplete(groups: readonly PhaseGroup[]) {
  const key = completePhases(groups).join(' ');
  const before = useRef<Set<string> | null>(null);
  const [event, setEvent] = useState<{ phase: number; key: number } | null>(null);
  useEffect(() => {
    const now = new Set(key ? key.split(' ') : []);
    const was = before.current;
    before.current = now;
    if (!was) return;
    const fresh = [...now].find((x) => !was.has(x));
    if (fresh !== undefined) setEvent({ phase: Number(fresh), key: Date.now() });
  }, [key]);
  const clear = useCallback(() => setEvent(null), []);
  return [event, clear] as const;
}

/** The stream's state for the badge. "Back online" goes into the feed when the stream returns after a gap seen on this page. */
function useConnection(): [Connection, FeedItem[]] {
  const status = useLiveStatus();
  const connection: Connection =
    status === 'live' ? 'live' : status === 'unavailable' ? 'unavailable' : 'reconnecting';
  const wasDown = useRef(false);
  const everLive = useRef(false);
  const [extra, setExtra] = useState<FeedItem[]>([]);
  useEffect(() => {
    if (connection !== 'live') {
      if (everLive.current) wasDown.current = true;
      return;
    }
    everLive.current = true;
    if (!wasDown.current) return;
    wasDown.current = false;
    const at = new Date(nowMs()).toISOString();
    setExtra((items) => [{ id: `resync:${at}`, kind: 'resync' as const, at }, ...items].slice(0, 3));
  }, [connection]);
  return [connection, extra];
}

/**
 * Everything live on a plan's page. The queue is read only where runs can happen (a page with the workbench), as the page's runs list is; the stream
 * rereads it on `queue.changed` and `chat.changed`, and the run's chat on its own `chat.event`s.
 */
export function usePlanLive(card: PlanCard, steps: readonly JourneyStep[], groups: readonly PhaseGroup[]) {
  const wb = useMaybeWb();
  // The member's own runs, with their controls, from their queue (where runs can happen) ...
  const queue = useQueue({ enabled: !!wb && !card.archivedAt });
  // ... and every other member's runs on this plan, read only (owner, 2026-11-20).
  const shared = usePlanRuns(card.key, { enabled: !card.archivedAt });
  const ownRuns = useMemo(
    () => runsOfPlan(queue.data?.runs ?? [], card.key, steps),
    [queue.data?.runs, card.key, steps],
  );
  const otherRuns = useMemo(
    () => runsOfPlan((shared.data ?? []).filter((dto) => !dto.mine).map(fromPlanRun), card.key, steps),
    [shared.data, card.key, steps],
  );
  const stepRuns = useMemo(() => [...ownRuns, ...otherRuns], [ownRuns, otherRuns]);
  const own = activeRun(ownRuns);
  const current = own ?? activeRun(otherRuns);
  const ownRow = own ? (queue.data?.runs.find((row) => row.id === own.run.id) ?? null) : null;
  const chat = useChat(ownRow?.chatId ?? null);
  const turn = ownRow ? turnOf(chat.data, ownRow.messageId) : null;
  const [connection, extra] = useConnection();
  const [celebration, clearCelebration] = useNewlyComplete(groups);

  const run: LiveRun | null = useMemo(() => {
    if (!current) return null;
    if (!ownRow) {
      // Another member's run: its stages as reported, who runs it, and that it waits, never on what.
      const { stages, note } = stagesOf(current.run.stages ?? []);
      return {
        id: current.run.id,
        stepId: current.stepId,
        chatId: null,
        startedAt: current.run.startedAt,
        stages,
        note,
        waiting:
          current.run.state === 'waiting' ? { id: '', kind: 'approval', command: '', category: '' } : null,
        deviceOnline: null,
        readOnly: true,
        member: current.run.member?.displayName ?? '',
      };
    }
    const { stages, note } = stagesOf(turn?.stages ?? []);
    const waitingOn = ownRow.state === 'waiting' ? ownRow.waitingOn : null;
    return {
      id: ownRow.id,
      stepId: current.stepId,
      chatId: ownRow.chatId,
      startedAt: ownRow.startedAt,
      stages,
      note,
      waiting: waitingOn
        ? {
            id: waitingOn.id,
            kind: waitingOn.kind,
            command: waitingOn.command,
            category: waitingOn.category,
          }
        : null,
      deviceOnline: chat.data ? chat.data.deviceOnline : null,
      readOnly: false,
      member: null,
    };
  }, [current, ownRow, turn, chat.data]);

  const approvals: ChatApprovalDto[] | undefined = turn?.approvals;
  const questions = turn?.questions;
  const feed = useMemo(
    () => planFeed({ steps, groups, runs: stepRuns, approvals, questions, extra }),
    [steps, groups, stepRuns, approvals, questions, extra],
  );

  return { run, feed, connection, celebration, clearCelebration, watching: !!wb || otherRuns.length > 0 };
}

/** The stream's state: a dot that breathes while live, amber and turning while it reconnects. */
export function LiveBadge({ connection }: { connection: Connection }) {
  const l = useT<PlanningMessages>('planning').detail.liveRun;
  return (
    <Tooltip content={l.liveHint}>
      <span
        tabIndex={0}
        role="status"
        data-pj-live={connection}
        className={cn(
          'inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-caption font-semibold whitespace-nowrap',
          connection === 'live'
            ? 'border-success/40 text-success-soft-foreground'
            : connection === 'reconnecting'
              ? 'border-warning/50 text-warning-soft-foreground'
              : 'border-border text-muted-foreground',
          focusRing,
        )}
      >
        <span aria-hidden className="pj-live-dot" data-state={connection} />
        {connection === 'live' ? l.live : connection === 'reconnecting' ? l.reconnecting : l.unavailable}
      </span>
    </Tooltip>
  );
}

/** Five stages joined by a track. `compact` drops the words for a step row; each stage keeps its name and state for screen readers. */
export function StageStepper({
  stages,
  compact = false,
}: {
  stages: Record<Stage, StageView>;
  compact?: boolean;
}) {
  const l = useT<PlanningMessages>('planning').detail.liveRun;
  return (
    <ol aria-label={l.stagesLabel} className="pj-stages w-full">
      {STAGES.map((stage, i) => {
        const state = stages[stage];
        const before = i > 0 ? stages[STAGES[i - 1]!] : null;
        return (
          <li key={stage} className="contents">
            {i > 0 && (
              <span aria-hidden className="pj-stage-line">
                <motion.span
                  initial={false}
                  animate={{ width: before === 'done' ? '100%' : '0%' }}
                  transition={{ duration: 0.5, ease: EASE }}
                />
              </span>
            )}
            <span className="pj-stage" data-state={state}>
              <motion.span
                aria-hidden
                className="pj-stage-dot"
                initial={false}
                animate={state === 'started' ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={state === 'started' ? { duration: 1.4, repeat: Infinity } : { duration: 0.2 }}
              >
                {state === 'done' ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : state === 'failed' ? (
                  <X className="size-3" strokeWidth={3} />
                ) : null}
              </motion.span>
              <span
                className={cn(
                  compact ? 'sr-only' : 'pj-stage-word text-caption font-medium',
                  state === 'started' ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {l.stageNames[stage]}
                <span className="sr-only">: {l.stageState[state]}</span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const elapsedOf = (since: string | null, now: number) => {
  const s = since ? Math.max(0, Math.floor((now - Date.parse(since)) / 1000)) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

function useTicking(on: boolean) {
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setNow(nowMs()), 1000);
    return () => window.clearInterval(id);
  }, [on]);
  return now;
}

/** Approve or Deny on the run's own chat, as the panel answers it. The first answer wins across devices; the chat and queue reread either way. */
function ApprovalBox({ run }: { run: LiveRun & { waiting: NonNullable<LiveRun['waiting']> } }) {
  const l = useT<PlanningMessages>('planning').detail.liveRun;
  const kit = useT(kitMessages);
  const answer = useAnswerApproval(run.chatId ?? '');
  const shownAt = useRef(Date.now());
  const [sent, setSent] = useState(false);
  useEffect(() => {
    shownAt.current = Date.now();
    setSent(false);
  }, [run.waiting.id]);
  const offline = run.deviceOnline === false;
  const decide = (decision: 'allow' | 'deny') => {
    if (Date.now() - shownAt.current < ARM_MS || !run.chatId) return;
    setSent(true);
    answer.mutate(
      { approval: run.waiting.id, decision },
      {
        onError: (error: unknown) => {
          setSent(false);
          showToast({ tone: 'error', message: isHubError(error) ? error.message : kit.actionFailed });
        },
      },
    );
  };

  if (run.waiting.kind === 'question') {
    return (
      <div
        role="alert"
        data-pj-waiting="question"
        className="pj-wait flex min-w-0 flex-col gap-2 rounded-lg p-3"
      >
        <p className="flex items-center gap-1.5 text-body-sm font-semibold">
          <MessageCircleQuestion aria-hidden className="size-4" strokeWidth={2} />
          {l.questionTitle}
        </p>
        <p className="text-body-sm">{l.questionBody}</p>
        {run.chatId && (
          <Button size="sm" variant="outline" className="self-start" onClick={() => revealChat(run.chatId!)}>
            {l.openChat}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      data-pj-waiting="approval"
      className="pj-wait flex min-w-0 flex-col gap-2 rounded-lg p-3"
    >
      <p className="flex items-center gap-1.5 text-body-sm font-semibold">
        <Hand aria-hidden className="size-4" strokeWidth={2} />
        {l.waitingTitle}
      </p>
      <p className="text-body-sm">{l.waitingBody}</p>
      <code
        dir="ltr"
        className="max-w-full self-start overflow-x-auto rounded-md bg-card px-2 py-1 font-mono text-caption whitespace-pre-wrap break-all text-foreground"
      >
        {run.waiting.command}
      </code>
      {sent ? (
        <p role="status" className="text-body-sm font-medium">
          {l.answered}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 pt-1">
          {/* Equal weight on purpose, as in the panel: the page does not lean towards either answer. */}
          <Button size="sm" variant="outline" disabled={offline} onClick={() => decide('allow')}>
            <Check aria-hidden className="size-4" strokeWidth={2.5} />
            {l.approve}
          </Button>
          <Button size="sm" variant="outline" disabled={offline} onClick={() => decide('deny')}>
            <X aria-hidden className="size-4" strokeWidth={2.5} />
            {l.deny}
          </Button>
        </div>
      )}
      {offline && <p className="text-body-sm">{l.deviceOffline}</p>}
    </div>
  );
}

/**
 * Claude at work, in the head where the next step was: which step, the five stages, its last note, and for how long. When the run waits for the
 * owner, the approval box opens in place.
 */
export function ClaudeNow({
  run,
  step,
  onOpen,
}: {
  run: LiveRun;
  step: JourneyStep | null;
  onOpen: () => void;
}) {
  const l = useT<PlanningMessages>('planning').detail.liveRun;
  const locale = useLocale();
  const now = useTicking(true);
  const n = num(step?.n ?? 0, locale);
  const anyStage = STAGES.some((s) => run.stages[s] !== 'todo');
  const heading = run.waiting
    ? run.readOnly
      ? fmt(l.claudeWaitingFor, { n, name: run.member ?? '' })
      : fmt(l.claudeWaiting, { n })
    : fmt(l.claudeWorking, { n });
  const note = run.note ?? (anyStage ? null : l.noStage);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.35, ease: EASE }}
      role="region"
      aria-label={fmt(l.claudeRegion, { n })}
      data-pj-claude={run.waiting ? 'waiting' : 'running'}
      className={cn(
        'pj-claude flex min-w-0 flex-col gap-3 rounded-xl p-3.5 md:p-4',
        !run.waiting && 'pj-shimmer',
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span
          aria-hidden
          className="relative grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          <Sparkles className="size-4" strokeWidth={2} />
          {!run.waiting && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-primary"
              animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </span>
        <p className="min-w-0 flex-1 text-body-sm font-semibold text-foreground">{heading}</p>
        {run.startedAt && (
          <span className="text-caption text-muted-foreground tabular-nums">
            {fmt(l.elapsed, { t: elapsedOf(run.startedAt, now) })}
          </span>
        )}
      </div>
      {run.readOnly && run.member && (
        <p data-pj-run-by className="text-caption text-muted-foreground">
          {fmt(l.runBy, { name: run.member })}
        </p>
      )}
      {step && (
        <button
          type="button"
          onClick={onOpen}
          dir="auto"
          className={cn(
            'self-start rounded-sm text-start text-body-lg font-semibold text-pretty text-foreground underline-offset-4 hover:underline',
            focusRing,
          )}
        >
          <Bidi>{step.title}</Bidi>
        </button>
      )}
      <StageStepper stages={run.stages} />
      <div aria-live="polite" className="min-h-6 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          {note && (
            <motion.p
              key={note}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: EASE }}
              dir="auto"
              className="text-body-sm text-muted-foreground"
            >
              <Bidi>{note}</Bidi>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {run.waiting && (
          <motion.div
            key={run.waiting.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            {run.readOnly ? (
              <p
                role="status"
                data-pj-waiting="other"
                className="pj-wait flex items-center gap-1.5 rounded-lg p-3 text-body-sm font-medium"
              >
                <Hand aria-hidden className="size-4" strokeWidth={2} />
                {fmt(l.waitingOther, { name: run.member ?? '' })}
              </p>
            ) : (
              <ApprovalBox run={{ ...run, waiting: run.waiting }} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const FEED_ICON: Record<FeedKind, LucideIcon> = {
  started: Play,
  approval: Hand,
  approved: Check,
  denied: CircleSlash,
  question: MessageCircleQuestion,
  ended: Flag,
  stopped: X,
  done: CircleCheck,
  phase_done: Trophy,
  resync: RefreshCw,
};

const FEED_CLASS: Partial<Record<FeedKind, string>> = {
  approval: 'bg-warning-soft text-warning-soft-foreground',
  question: 'bg-warning-soft text-warning-soft-foreground',
  denied: 'bg-destructive-soft text-destructive-soft-foreground',
  stopped: 'bg-destructive-soft text-destructive-soft-foreground',
  done: 'bg-success-soft text-success-soft-foreground',
  phase_done: 'bg-success-soft text-success-soft-foreground',
};

/** A feed line in the page's words, read when shown. */
export function feedText(words: LiveWords['words'], item: FeedItem, locale: 'ar' | 'en'): string {
  const n = typeof item.value === 'number' ? num(item.value, locale) : '';
  const text = typeof item.value === 'string' ? item.value : '';
  switch (item.kind) {
    case 'started':
    case 'ended':
    case 'stopped':
    case 'done':
      return fmt(words[item.kind], { n });
    case 'approval':
    case 'approved':
    case 'denied':
      return fmt(words[item.kind], { cmd: text });
    case 'phase_done':
      return fmt(words.phaseDone, { title: text });
    case 'question':
      return words.question;
    case 'resync':
      return words.resync;
  }
}

/** What happened on this plan, newest first; a new line slides in from the reading side and pushes the list down. */
export function ActivityFeed({ feed }: { feed: readonly FeedItem[] }) {
  const l = useT<PlanningMessages>('planning').detail.liveRun;
  const locale = useLocale();
  if (feed.length === 0) return <p className="text-body-sm text-muted-foreground">{l.feedEmpty}</p>;
  return (
    <ol aria-live="polite" data-pj-feed className="flex min-w-0 flex-col gap-1">
      <AnimatePresence initial={false}>
        {feed.map((item) => {
          const Icon = FEED_ICON[item.kind];
          return (
            <motion.li
              key={item.id}
              layout
              data-pj-feed-kind={item.kind}
              initial={{ opacity: 0, x: locale === 'ar' ? 24 : -24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="flex min-w-0 items-start gap-2.5 rounded-lg px-1.5 py-1.5"
            >
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground',
                  FEED_CLASS[item.kind],
                )}
              >
                <Icon className="size-3.5" strokeWidth={2} />
              </span>
              <p dir="auto" className="min-w-0 flex-1 text-body-sm break-words text-foreground">
                <Bidi>{feedText(l.words, item, locale)}</Bidi>
              </p>
              <RelativeTime iso={item.at} className="shrink-0 text-caption text-muted-foreground" />
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}

/** A count that runs to its new value, and jumps there under reduced motion. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (v) => setShown(Math.round(v)),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <Ltr className={cn('tabular-nums', className)}>{num(shown, locale)}</Ltr>;
}

/**
 * A phase completed while the page is open: confetti in the phases' tones from the top, and a banner that springs in and leaves by itself. Under
 * reduced motion only the banner shows, with a fade.
 */
export function Celebration({
  event,
  title,
  onDone,
}: {
  event: { phase: number; key: number } | null;
  title: string;
  onDone: () => void;
}) {
  const l = useT<PlanningMessages>('planning').detail.liveRun;
  const locale = useLocale();
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        tone: toneOf(i),
        x: (Math.random() - 0.5) * 900,
        y: 260 + Math.random() * 420,
        r: (Math.random() - 0.5) * 720,
        d: 1.4 + Math.random() * 0.9,
        delay: Math.random() * 0.15,
      })),
    // New pieces for each celebration.
    [event?.key],
  );
  useEffect(() => {
    if (!event) return;
    const id = window.setTimeout(onDone, 3800);
    return () => window.clearTimeout(id);
  }, [event, onDone]);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.key}
          className="pj-burst"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {!reduce &&
            pieces.map((p, i) => (
              <motion.span
                key={i}
                data-pj-tone={p.tone}
                className="pj-confetti"
                style={{ left: '50%', top: 96 }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                animate={{ x: p.x, y: p.y, rotate: p.r, opacity: 0 }}
                transition={{ duration: p.d, delay: p.delay, ease: [0.15, 0.6, 0.3, 1] }}
              />
            ))}
          <div className="absolute inset-x-0 top-6 flex justify-center px-4">
            <motion.div
              role="status"
              data-pj-tone={toneOf(event.phase)}
              data-pj-celebration
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -40, scale: 0.85 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 380, damping: 22 }}
              className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-popover p-3.5 pe-5 shadow-lg"
            >
              <span aria-hidden className="pj-tone-bg grid size-11 shrink-0 place-items-center rounded-xl">
                <Trophy className="size-5.5" strokeWidth={2} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-body font-bold text-foreground">
                  {fmt(l.phaseComplete, { n: num(event.phase, locale) })}
                </span>
                <span dir="auto" className="text-body-sm text-muted-foreground">
                  {fmt(l.phaseCompleteBody, { title })}
                </span>
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
