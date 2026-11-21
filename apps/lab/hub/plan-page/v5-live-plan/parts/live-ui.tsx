import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Check,
  CircleCheck,
  FastForward,
  GitCommitHorizontal,
  Hand,
  Images,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  Unplug,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { Bidi, Button, fmt, focusRing, Ltr, num, Tooltip } from '../../../today/v5-peacock-app/kit';
import { messages } from '../i18n';
import { sayText, STAGES, type FeedItem, type FeedKind, type LiveControls, type LiveState, type LiveWords, type Run } from './live';
import type { NumberedStep } from './model';
import { toneOf } from './tone';

const ease = [0.2, 0.7, 0.2, 1] as const;

/** The live phrases in the page's language; notes and feed entries are stored as keys and rendered with these. */
export function useLiveWords(): LiveWords {
  const t = useT(messages);
  const locale = useLocale();
  return useMemo(
    () => ({
      started: (n) => fmt(t.words.started, { n: num(n, locale) }),
      understand: t.words.understand,
      plan: t.words.plan,
      execute: (file) => fmt(t.words.execute, { file }),
      commit: t.words.commit,
      approval: (cmd) => fmt(t.words.approval, { cmd }),
      approved: t.words.approved,
      denied: t.words.denied,
      verify: t.words.verify,
      verified: t.words.verified,
      evidence: t.words.evidence,
      done: (n) => fmt(t.words.done, { n: num(n, locale) }),
      phaseDone: (title) => fmt(t.words.phaseDone, { title }),
      resync: t.words.resync,
    }),
    [t, locale],
  );
}

/** A number that counts to its new value (a spring-like ease), and jumps straight there under reduced motion. */
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
    const controls = animate(from.current, value, { duration: 0.9, ease, onUpdate: (v) => setShown(Math.round(v)) });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <Ltr className={cn('tabular-nums', className)}>{num(shown, locale)}</Ltr>;
}

export function LiveBadge({ connection }: { connection: LiveState['connection'] }) {
  const t = useT(messages);
  return (
    <Tooltip content={t.liveHint}>
      <span
        tabIndex={0}
        role="status"
        className={cn(
          'inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-caption font-semibold',
          connection === 'live' ? 'border-success/40 text-success-soft-foreground' : 'border-warning/50 text-warning-soft-foreground',
          focusRing,
        )}
      >
        <span aria-hidden className="ps-live-dot" data-state={connection} />
        {connection === 'live' ? t.live : t.reconnecting}
      </span>
    </Tooltip>
  );
}

const fmtElapsed = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Five stages joined by a track. `compact` drops the words for the step row; each stage keeps its name for screen readers. */
export function StageStepper({ stages, compact = false }: { stages: Run['stages']; compact?: boolean }) {
  const t = useT(messages);
  return (
    <ol aria-label={t.stagesLabel} className="ps-stages w-full">
      {STAGES.map((stage, i) => {
        const state = stages[stage];
        return (
          <li key={stage} className="contents">
            {i > 0 && (
              <span aria-hidden className="ps-stage-line">
                <motion.span initial={false} animate={{ width: stages[STAGES[i - 1]!] === 'done' ? '100%' : '0%' }} transition={{ duration: 0.5, ease }} />
              </span>
            )}
            <span className="ps-stage" data-state={state}>
              <motion.span
                aria-hidden
                className="ps-stage-dot"
                initial={false}
                animate={state === 'started' ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={state === 'started' ? { duration: 1.4, repeat: Infinity } : { duration: 0.2 }}
              >
                {state === 'done' ? <Check className="size-3" strokeWidth={3} /> : state === 'failed' ? <X className="size-3" strokeWidth={3} /> : null}
              </motion.span>
              <span className={cn(compact ? 'sr-only' : 'ps-stage-word text-caption font-medium', state === 'started' ? 'text-foreground' : 'text-muted-foreground')}>
                {t.stageNames[stage]}
                <span className="sr-only">: {t.stageState[state]}</span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Claude at work, in the hero where the next step was: which step, the five stages, what it is doing now (the line changes with a
 * short slide), and for how long. When Claude waits for a command, the card turns amber with Approve and Deny in place.
 */
export function ClaudeNow({ run, step, clock, onApprove, onDeny, onOpen }: { run: Run; step: NumberedStep | null; clock: number; onApprove: () => void; onDeny: () => void; onOpen: () => void }) {
  const t = useT(messages);
  const locale = useLocale();
  const words = useLiveWords();
  const note = sayText(words, run.note);
  const n = step?.n ?? 0;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.35, ease }}
      className={cn('ps-claude flex min-w-0 flex-col gap-3 rounded-xl p-3.5 md:p-4', !run.waiting && !run.failed && 'ps-shimmer')}
      role="region"
      aria-label={fmt(run.failed ? t.claudeStopped : t.claudeWorking, { n: num(n, locale) })}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span aria-hidden className="relative grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="size-4" strokeWidth={2} />
          {!run.failed && (
            <motion.span className="absolute inset-0 rounded-full border-2 border-primary" animate={{ scale: [1, 1.5], opacity: [0.6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }} />
          )}
        </span>
        <p className="min-w-0 flex-1 text-body-sm font-semibold text-foreground">{fmt(run.failed ? t.claudeStopped : t.claudeWorking, { n: num(n, locale) })}</p>
        <span className="text-caption text-muted-foreground tabular-nums">{fmt(t.elapsed, { t: fmtElapsed(clock - run.startedAt) })}</span>
      </div>
      {step && (
        <button type="button" onClick={onOpen} dir="auto" className={cn('self-start rounded-sm text-start text-body-lg font-semibold text-pretty text-foreground underline-offset-4 hover:underline', focusRing)}>
          <Bidi>{step.title}</Bidi>
        </button>
      )}
      <StageStepper stages={run.stages} />
      <div aria-live="polite" className="min-h-6 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={note}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease }}
            className={cn('text-body-sm', run.failed ? 'text-destructive-soft-foreground' : 'text-muted-foreground')}
          >
            {run.failed ? t.runFailed : <Bidi>{note}</Bidi>}
          </motion.p>
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {run.waiting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden"
          >
            <div role="alert" className="ps-wait flex min-w-0 flex-col gap-2 rounded-lg p-3">
              <p className="flex items-center gap-1.5 text-body-sm font-semibold">
                <Hand aria-hidden className="size-4" strokeWidth={2} />
                {t.waitingTitle}
              </p>
              <p className="text-body-sm">{t.waitingBody}</p>
              <code dir="ltr" className="self-start rounded-md bg-card px-2 py-1 font-mono text-caption text-foreground">
                {run.waiting.command}
              </code>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="primary" onClick={onApprove}>
                  <Check aria-hidden className="size-4" strokeWidth={2.5} />
                  {t.approve}
                </Button>
                <Button size="sm" variant="outline" onClick={onDeny}>
                  <X aria-hidden className="size-4" strokeWidth={2.5} />
                  {t.deny}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const FEED_ICON: Record<FeedKind, LucideIcon> = {
  started: Play,
  stage: Sparkles,
  commit: GitCommitHorizontal,
  approval: Hand,
  approved: Check,
  denied: X,
  evidence: Images,
  done: CircleCheck,
  phase_done: Trophy,
  resync: RefreshCw,
};

const FEED_CLASS: Partial<Record<FeedKind, string>> = {
  approval: 'bg-warning-soft text-warning-soft-foreground',
  denied: 'bg-destructive-soft text-destructive-soft-foreground',
  done: 'bg-success-soft text-success-soft-foreground',
  phase_done: 'bg-success-soft text-success-soft-foreground',
};

/** What happened on this plan, newest first; each new entry slides in and pushes the list down (layout animation). */
export function ActivityFeed({ feed, clock }: { feed: FeedItem[]; clock: number }) {
  const t = useT(messages);
  const locale = useLocale();
  const words = useLiveWords();
  if (feed.length === 0) return <p className="text-body-sm text-muted-foreground">{t.feedEmpty}</p>;
  return (
    <ol aria-live="polite" className="flex min-w-0 flex-col gap-1">
      <AnimatePresence initial={false}>
        {feed.map((item) => {
          const Icon = FEED_ICON[item.kind];
          const ago = clock - item.at;
          return (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, x: locale === 'ar' ? 24 : -24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease }}
              className="flex min-w-0 items-start gap-2.5 rounded-lg px-1.5 py-1.5"
            >
              <span aria-hidden className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground', FEED_CLASS[item.kind])}>
                <Icon className="size-3.5" strokeWidth={2} />
              </span>
              <p className="min-w-0 flex-1 text-body-sm text-foreground">
                <Bidi>{sayText(words, item.say)}</Bidi>
              </p>
              <span className="shrink-0 text-caption text-muted-foreground tabular-nums">{ago < 5 ? t.justNow : fmt(t.secondsAgo, { n: num(Math.floor(ago), locale) })}</span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}

/**
 * A phase completed: a burst of confetti in the phases' tones from the top of the page, and a banner that springs in and leaves by
 * itself. Under reduced motion only the banner shows, with a fade.
 */
export function Celebration({ event, title, onDone }: { event: { phase: number; key: number } | null; title: string; onDone: () => void }) {
  const t = useT(messages);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <motion.div key={event.key} className="ps-burst" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          {!reduce &&
            pieces.map((p, i) => (
              <motion.span
                key={i}
                data-tone={p.tone}
                className="ps-confetti"
                style={{ left: '50%', top: 96 }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                animate={{ x: p.x, y: p.y, rotate: p.r, opacity: 0 }}
                transition={{ duration: p.d, delay: p.delay, ease: [0.15, 0.6, 0.3, 1] }}
              />
            ))}
          <div className="absolute inset-x-0 top-6 flex justify-center px-4">
            <motion.div
              role="status"
              data-tone={toneOf(event.phase)}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -40, scale: 0.85 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 380, damping: 22 }}
              className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-popover p-3.5 pe-5 shadow-lg"
            >
              <span aria-hidden className="ps-tone-bg grid size-11 shrink-0 place-items-center rounded-xl">
                <Trophy className="size-5.5" strokeWidth={2} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-body font-bold text-foreground">{fmt(t.phaseComplete, { n: num(event.phase, locale) })}</span>
                <span dir="auto" className="text-body-sm text-muted-foreground">
                  {fmt(t.phaseCompleteBody, { title })}
                </span>
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Lab only: drives the recorded run. Dashed border and its own title so it never reads as part of the product. */
export function SimBar({ state, controls }: { state: LiveState; controls: LiveControls }) {
  const t = useT(messages);
  const speeds = [1, 2, 4] as const;
  return (
    <div role="toolbar" aria-label={t.simTitle} className="ps-sim">
      <span className="px-1 text-caption font-semibold text-muted-foreground" title={t.simHint}>
        {t.simTitle}
      </span>
      {state.playing ? (
        <Button size="sm" variant="outline" onClick={controls.pause}>
          <Pause aria-hidden className="size-4" strokeWidth={2} />
          {t.simPause}
        </Button>
      ) : (
        <Button size="sm" variant="primary" onClick={controls.play}>
          <Play aria-hidden className="size-4" strokeWidth={2} />
          {t.simPlay}
        </Button>
      )}
      <div role="group" aria-label={t.simSpeed} className="flex items-center rounded-lg border border-border p-0.5">
        {speeds.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={state.speed === s}
            onClick={() => controls.setSpeed(s)}
            className={cn('h-8 min-w-9 rounded-md px-1.5 text-caption font-semibold tabular-nums', state.speed === s ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent', focusRing)}
          >
            {s}×
          </button>
        ))}
      </div>
      <Button size="sm" variant="ghost" onClick={controls.finishPhase}>
        <FastForward aria-hidden className="size-4" strokeWidth={2} />
        {t.simFinishPhase}
      </Button>
      <Button size="sm" variant="ghost" onClick={controls.drop} disabled={state.connection !== 'live'}>
        <Unplug aria-hidden className="size-4" strokeWidth={2} />
        {t.simDrop}
      </Button>
      <Button size="sm" variant="ghost" onClick={controls.reset}>
        <RotateCcw aria-hidden className="size-4" strokeWidth={2} />
        {t.simReset}
      </Button>
    </div>
  );
}
