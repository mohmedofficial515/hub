'use client';

/**
 * @file run-bits.tsx
 * @description The agent queue's shared parts (docs/16 §9): a run's icon and words, its row, its actions, Run now, and the schedule dialog. The queue page, the panel's Runs, the strip and the card sheet all use these, so a run reads the same everywhere.
 * A run is one neutral card. Its state shows in a coloured icon and in words, never in a coloured edge (D31). Every time is in the queue's timezone, which the dialog names.
 * A run carries a mode (D58), a main folder and extra folders (D59), and roles (D60). An automatic run shows what it decided for the owner, and each pending item can be run later, where D41 still asks.
 */
import type {
  AgentRunDto,
  CreateRunInput,
  Role,
  RunDecision,
  RunMode,
  RunViewState,
  RunWhen,
  Weekday,
} from '@hub/contracts';
import { localDateOf, localInstant, ROLE_LABELS, ROLES, WEEKDAYS } from '@hub/contracts';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  CalendarClock,
  Check,
  CircleSlash,
  Clock,
  FolderOpen,
  Hand,
  ListChecks,
  Loader2,
  type LucideIcon,
  Pause,
  Play,
  Repeat,
  ShieldCheck,
  Square,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useId, useState, useSyncExternalStore } from 'react';

import {
  Bidi,
  Button,
  CardKey,
  cn,
  ConfirmDialog,
  detectSecret,
  Field,
  fmt,
  Ltr,
  Modal,
  plural,
  RowMenu,
  type RowMenuItem,
  SecretFilterError,
  Select,
  showToast,
  Textarea,
  TextInput,
  useLocale,
  useT,
  when as whenText,
} from '@/components/kit';
import { revealApproval, revealChat, useMaybeWb } from '@/components/workbench/store';
import {
  quickWhen,
  type RunAction,
  useAddRun,
  useQueue,
  useRunAction,
  useRunPending,
  useSetRunMode,
} from '@/features/queue/queries';
import { isHubError } from '@/lib/api/errors';

import type { QueueMessages } from './words';

const ICON: Record<RunViewState, LucideIcon> = {
  waiting: Hand,
  running: Loader2,
  next: Clock,
  scheduled: CalendarClock,
  paused: Pause,
  done: Check,
  failed: AlertTriangle,
  stopped: Square,
  interrupted: AlertTriangle,
  cancelled: CircleSlash,
};
const TONE: Record<RunViewState, string> = {
  waiting: 'text-warning-strong',
  running: 'text-foreground motion-safe:animate-spin',
  next: 'text-muted-foreground',
  scheduled: 'text-muted-foreground',
  paused: 'text-muted-foreground',
  done: 'text-success-soft-foreground',
  failed: 'text-destructive-soft-foreground',
  stopped: 'text-muted-foreground',
  interrupted: 'text-destructive-soft-foreground',
  cancelled: 'text-muted-foreground',
};

export function RunIcon({ state, className }: { state: RunViewState; className?: string | undefined }) {
  const Icon = ICON[state];
  return <Icon aria-hidden className={cn('size-4 shrink-0', TONE[state], className)} strokeWidth={2} />;
}

export const useQueueWords = () => useT<QueueMessages>('queue');

const folderNameOf = (path: string): string =>
  path.replaceAll('\\', '/').split('/').filter(Boolean).pop() ?? path;

/** The second line of a run: what it waits on, why it is held, when it runs, or how it ended. */
export function useRunLine() {
  const t = useQueueWords();
  const locale = useLocale();
  return (run: AgentRunDto): { text: string; command?: string | undefined } => {
    if (run.state === 'waiting' && run.waitingOn) return { text: t.pausedOn, command: run.waitingOn.command };
    if (run.hold) return { text: fmt(t.holds[run.hold], { device: run.deviceName }) };
    if (run.state === 'scheduled' && run.repeat) return { text: weeklyText(t, run.repeat) };
    if (run.state === 'scheduled' && run.runAt)
      return { text: fmt(t.when.at, { when: whenText(run.runAt, locale) }) };
    if (run.state === 'running' && run.startedAt)
      return { text: fmt(t.when.started, { when: whenText(run.startedAt, locale) }) };
    if (run.state === 'interrupted')
      return { text: t.failures[run.failure === 'device_offline' ? 'device_offline' : 'cut_off'] };
    if (run.state === 'failed') {
      const known = run.failure === 'rate_limited' || run.failure === 'folder_not_allowed';
      const key = known ? (run.failure as 'rate_limited' | 'folder_not_allowed') : 'other';
      return { text: run.summary && !known ? run.summary : t.failures[key] };
    }
    if (run.state === 'cancelled' || run.state === 'stopped') return { text: t.states[run.state] };
    if (run.summary) return { text: run.summary };
    if (run.endedAt) return { text: fmt(t.when.ended, { when: whenText(run.endedAt, locale) }) };
    return { text: t.states[run.state] };
  };
}

const weeklyText = (t: QueueMessages, repeat: { day: Weekday; time: string }) =>
  fmt(t.when.weekly, { day: t.days[repeat.day], time: repeat.time });

// ── Cancel, confirmed when it stops a live turn or ends a weekly repeat (review M5) ─────────────

let cancelAsk: { run: AgentRunDto; confirm: () => void } | null = null;
const cancelListeners = new Set<() => void>();
const setCancelAsk = (next: typeof cancelAsk) => {
  cancelAsk = next;
  cancelListeners.forEach((listener) => listener());
};

/** Rendered once by the shell, beside the toasts: the one confirm for a Cancel that stops or ends something. */
export function RunCancelHost() {
  const t = useQueueWords();
  const ask = useSyncExternalStore(
    (listener) => {
      cancelListeners.add(listener);
      return () => cancelListeners.delete(listener);
    },
    () => cancelAsk,
    () => null,
  );
  const run = ask?.run;
  return (
    <ConfirmDialog
      open={!!ask}
      onOpenChange={(open) => !open && setCancelAsk(null)}
      title={run ? fmt(t.cancel.title, { title: run.title }) : ''}
      description={
        run
          ? [run.stored === 'running' ? t.cancel.running : null, run.repeat ? t.cancel.weekly : null]
              .filter(Boolean)
              .join(' ')
          : undefined
      }
      confirmLabel={t.cancel.confirm}
      onConfirm={() => {
        ask?.confirm();
        setCancelAsk(null);
      }}
    />
  );
}

export type RowAction = RunAction | 'toAutomatic' | 'toApproval';

/** Pause, resume, cancel and the mode, with their toasts. A refusal says the API's own words. */
export function useRunActions() {
  const t = useQueueWords();
  const act = useRunAction();
  const setMode = useSetRunMode();
  const fail = (error: unknown) =>
    showToast({ tone: 'error', message: isHubError(error) ? error.message : String(error) });
  return (run: AgentRunDto, action: RowAction) => {
    if (action === 'toAutomatic' || action === 'toApproval') {
      const mode: RunMode = action === 'toAutomatic' ? 'automatic' : 'approval';
      setMode.mutate(
        { id: run.id, mode },
        {
          onSuccess: () =>
            showToast({ message: mode === 'automatic' ? t.toasts.modeAutomatic : t.toasts.modeApproval }),
          onError: fail,
        },
      );
      return;
    }
    const go = () =>
      act.mutate(
        { id: run.id, action },
        {
          onSuccess: () =>
            showToast({
              message:
                action === 'pause'
                  ? t.toasts.paused
                  : action === 'resume'
                    ? t.toasts.resumed
                    : t.toasts.cancelled,
            }),
          onError: fail,
        },
      );
    if (action === 'cancel' && (run.stored === 'running' || run.repeat)) {
      setCancelAsk({ run, confirm: go });
      return;
    }
    go();
  };
}

export function runMenuItems(
  run: AgentRunDto,
  t: QueueMessages,
  act: (run: AgentRunDto, action: RowAction) => void,
  move?: { up?: (() => void) | undefined; down?: (() => void) | undefined },
): RowMenuItem[] {
  const open = run.stored === 'queued' || run.stored === 'running';
  return [
    ...(move?.up ? [{ label: t.actions.moveUp, icon: ArrowUp, onSelect: move.up }] : []),
    ...(move?.down ? [{ label: t.actions.moveDown, icon: ArrowDown, onSelect: move.down }] : []),
    ...(run.stored === 'queued'
      ? [
          run.mode === 'automatic'
            ? { label: t.actions.toApproval, icon: ShieldCheck, onSelect: () => act(run, 'toApproval') }
            : { label: t.actions.toAutomatic, icon: Bot, onSelect: () => act(run, 'toAutomatic') },
        ]
      : []),
    ...(open && !run.paused
      ? [{ label: t.actions.pause, icon: Pause, onSelect: () => act(run, 'pause') }]
      : []),
    ...(run.paused ? [{ label: t.actions.resume, icon: Play, onSelect: () => act(run, 'resume') }] : []),
    ...(open
      ? [{ label: t.actions.cancel, icon: X, destructive: true, onSelect: () => act(run, 'cancel') }]
      : []),
  ];
}

/** What an automatic run decided for the owner, and the commands it kept for them (D58). Each pending item runs later in a chat, where it still asks. */
export function RunDecisions({ run }: { run: AgentRunDto }) {
  const t = useQueueWords();
  const pending = useRunPending();
  if (run.decisions.length === 0) return null;
  const answered = run.decisions.filter((decision) => decision.kind === 'answered');
  const skipped = run.decisions.filter((decision) => decision.kind === 'skipped');
  const ended = run.stored !== 'queued' && run.stored !== 'running';
  const runIt = (decision: RunDecision) =>
    pending.mutate(
      { id: run.id, decisionId: decision.id },
      {
        onSuccess: (started) => {
          showToast({ message: fmt(t.toasts.pendingStarted, { folder: folderNameOf(decision.folder) }) });
          revealChat(started.chatId);
        },
        onError: (error) =>
          showToast({ tone: 'error', message: isHubError(error) ? error.message : String(error) }),
      },
    );
  return (
    <details data-run-decisions open={skipped.length > 0 && ended} className="mt-1.5 text-body-sm">
      <summary className="cursor-pointer text-muted-foreground select-none">
        <ListChecks aria-hidden className="me-1 inline size-3.5 align-[-2px]" strokeWidth={1.75} />
        {t.decisions.title}:{' '}
        {fmt(t.decisions.summary, { answered: answered.length, pending: skipped.length })}
      </summary>
      <ul className="mt-1.5 flex flex-col gap-2">
        {answered.map((decision) => (
          <li key={decision.id} data-run-decision="answered" className="flex flex-col gap-0.5">
            {decision.answers.map((item) => (
              <p key={item.question} className="text-foreground">
                <Bidi>{item.question}</Bidi>
                <span className="text-muted-foreground">
                  {' '}
                  · {fmt(t.decisions.took, { answer: item.answer })}
                </span>
              </p>
            ))}
          </li>
        ))}
        {skipped.length > 0 && (
          <li className="text-body-sm font-medium text-muted-foreground">{t.decisions.pending}</li>
        )}
        {skipped.map((decision) => (
          <li key={decision.id} data-run-decision="skipped" className="flex flex-col gap-1">
            <code
              dir="ltr"
              translate="no"
              className="key block rounded-md bg-muted p-1.5 text-start [overflow-wrap:anywhere] text-foreground"
            >
              {decision.command}
            </code>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground">
              <span>{t.decisions.skipped}</span>
              <span className="inline-flex min-w-0 items-center gap-1" title={decision.folder}>
                <FolderOpen aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
                <Ltr mono className="text-body-sm">
                  {folderNameOf(decision.folder)}
                </Ltr>
              </span>
              {decision.why && <Bidi>{fmt(t.decisions.why, { why: decision.why })}</Bidi>}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {decision.followChatId ? (
                <Button size="sm" variant="ghost" onClick={() => revealChat(decision.followChatId!)}>
                  {t.decisions.opened}
                </Button>
              ) : (
                ended && (
                  <Button
                    size="sm"
                    data-run-pending
                    title={t.decisions.runItHint}
                    busy={pending.isPending && pending.variables?.decisionId === decision.id}
                    onClick={() => runIt(decision)}
                  >
                    <Play aria-hidden className="size-3.5" strokeWidth={1.75} />
                    {t.decisions.runIt}
                  </Button>
                )
              )}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * One run. `primary` makes its main action the page's one filled button, which is the first run waiting on the owner. `handle` is the drag grip the queue page adds to runs not started.
 * Below `sm` the actions take their own row under the text, so a phone keeps the title readable (review M4). `inCard` leaves out what the card's own sheet already shows (review minor 19).
 */
export function RunRow({
  run,
  primary = false,
  compact = false,
  inCard = false,
  handle,
  menu,
  onRunAgain,
}: {
  run: AgentRunDto;
  primary?: boolean | undefined;
  compact?: boolean | undefined;
  inCard?: boolean | undefined;
  handle?: ReactNode | undefined;
  menu?: RowMenuItem[] | undefined;
  onRunAgain?: (() => void) | undefined;
}) {
  const t = useQueueWords();
  const locale = useLocale();
  const line = useRunLine()(run);
  const folderName = folderNameOf(run.folder);
  const ended = run.state === 'done' || run.state === 'failed' || run.state === 'stopped';
  return (
    <div className="flex min-w-0 items-start gap-2.5 max-sm:flex-wrap">
      {handle}
      <span role="img" aria-label={t.states[run.state]} className="mt-0.5 inline-flex shrink-0">
        <RunIcon state={run.state} />
      </span>
      <div className="min-w-0 flex-1">
        {!inCard && (
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="min-w-0 text-body font-medium text-foreground [overflow-wrap:anywhere]">
              <Bidi>{run.title}</Bidi>
            </span>
            {run.cardKey && <CardKey k={run.cardKey} link className="text-body-sm" />}
          </p>
        )}
        <p className={cn('text-body-sm text-muted-foreground', ended && !compact && 'line-clamp-2')}>
          <span className="sr-only">{t.states[run.state]}: </span>
          {line.command ? (
            <>
              {line.text}{' '}
              <code dir="ltr" translate="no" className="key [overflow-wrap:anywhere] text-foreground">
                {line.command}
              </code>
            </>
          ) : (
            <Bidi>{line.text}</Bidi>
          )}
        </p>
        {!compact && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-body-sm text-muted-foreground">
            <span
              className="inline-flex min-w-0 items-center gap-1"
              title={[run.folder, ...run.extraFolders].join('\n')}
            >
              <FolderOpen aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
              <Ltr mono className="text-body-sm">
                {folderName}
              </Ltr>
              {run.extraFolders.length > 0 && (
                <span data-run-extra>{fmt(t.meta.extra, { n: run.extraFolders.length })}</span>
              )}
            </span>
            {run.deviceName && <span>{run.deviceName}</span>}
            {run.mode === 'automatic' && (
              <span data-run-mode="automatic" className="inline-flex items-center gap-1">
                <Bot aria-hidden className="size-3.5" strokeWidth={1.75} />
                {t.meta.automatic}
              </span>
            )}
            {run.roles.length > 0 && (
              <span data-run-roles>{run.roles.map((role) => ROLE_LABELS[role][locale]).join('، ')}</span>
            )}
            {run.repeat && run.state !== 'scheduled' && (
              <span className="inline-flex items-center gap-1">
                <Repeat aria-hidden className="size-3.5" strokeWidth={1.75} />
                {t.weekly}
              </span>
            )}
            {run.changedFiles.length > 0 && <span>{plural(run.changedFiles.length, locale, t.files)}</span>}
            {run.moved !== null && run.cardKey && <span>{run.moved ? t.moved : t.notMoved}</span>}
          </p>
        )}
        {!compact && <RunDecisions run={run} />}
      </div>
      <div className="flex shrink-0 items-center gap-1 max-sm:w-full max-sm:justify-end">
        {run.state === 'waiting' && run.chatId && (
          <Button
            size="sm"
            variant={primary ? 'primary' : 'outline'}
            data-queue-answer
            onClick={() => revealApproval(run.chatId!)}
          >
            {t.actions.answer}
          </Button>
        )}
        {run.state !== 'waiting' && run.chatId && (
          <Button
            size="sm"
            variant="ghost"
            data-queue-chat
            aria-label={fmt(t.actions.openChatFor, { title: run.title })}
            onClick={() => revealChat(run.chatId!)}
          >
            {t.actions.openChat}
          </Button>
        )}
        {run.state === 'interrupted' && onRunAgain && (
          <Button size="sm" onClick={onRunAgain}>
            {t.actions.runAgain}
          </Button>
        )}
        {menu && menu.length > 0 && (
          <RowMenu label={fmt(t.actions.more, { title: run.title })} items={menu} />
        )}
      </div>
    </div>
  );
}

// ── Starting a run ──────────────────────────────────────────────────────────────────────────────

/** What a run starts from. Its folder and device come from the panel's choice unless the dialog says otherwise. */
export type RunTarget =
  | { source: 'task'; cardKey: string; title: string }
  | { source: 'plan_step'; cardKey: string; planStep: number; title: string }
  | { source: 'prompt'; prompt: string; title: string };

/** How a run treats the owner, where else it works, and as whom (D58 to D60). Absent: With my approval, one folder, the card's own role. */
export interface RunOptions {
  mode?: RunMode | undefined;
  extraFolders?: readonly string[] | undefined;
  roles?: readonly Role[] | undefined;
}

function inputOf(
  target: RunTarget,
  device: string,
  folder: string,
  when: RunWhen,
  options: RunOptions = {},
): CreateRunInput {
  const extras = {
    ...(options.mode ? { mode: options.mode } : {}),
    ...(options.extraFolders?.length ? { extraFolders: [...options.extraFolders] } : {}),
    ...(options.roles?.length ? { roles: [...options.roles] } : {}),
  };
  if (target.source === 'task') {
    return { source: 'task', cardKey: target.cardKey, device, folder, when, ...extras };
  }
  if (target.source === 'plan_step') {
    return {
      source: 'plan_step',
      cardKey: target.cardKey,
      planStep: target.planStep,
      device,
      folder,
      when,
      ...extras,
    };
  }
  return { source: 'prompt', prompt: target.prompt, device, folder, when, ...extras };
}

/**
 * Where a run goes: the device and folder the panel resolves, with the same fallbacks (the chosen device, else the first online, else the first; the chosen folder, else the project's first). Review B1: reading the raw choices left Run now off on any browser that never picked one.
 */
export function useRunPlace(): {
  device: string | null;
  deviceName: string;
  online: boolean;
  folder: string | null;
  folders: readonly string[];
} {
  const wb = useMaybeWb();
  const device = wb?.place.device ?? null;
  return {
    device: device?.id ?? null,
    deviceName: device?.name ?? '',
    online: !!device?.online,
    folder: wb?.place.folder ?? null,
    folders: wb?.folders ?? [],
  };
}

/** Why a run cannot be added here, or null. A device that is offline does not stop it: the run waits, and says so. */
export function useRunOff(): 'noDevice' | 'noFolder' | null {
  const place = useRunPlace();
  if (!place.device) return 'noDevice';
  if (!place.folder) return 'noFolder';
  return null;
}

/** Run now: joins the line at once, and the toast says whether it started or why it waits, with Open chat when it started (review M6). */
export function useRunNow() {
  const t = useQueueWords();
  const add = useAddRun();
  const place = useRunPlace();
  return (target: RunTarget, options: RunOptions = {}) => {
    if (!place.device || !place.folder) return;
    add.mutate(inputOf(target, place.device, place.folder, { kind: 'now' }, options), {
      onSuccess: (run) => startedToast(t, run),
      onError: (error) =>
        showToast({ tone: 'error', message: isHubError(error) ? error.message : String(error) }),
    });
  };
}

function startedToast(t: QueueMessages, run: AgentRunDto) {
  if (run.state === 'running' || run.state === 'waiting') {
    showToast({
      message: fmt(t.toasts.started, { folder: run.folder }),
      ...(run.chatId
        ? { action: { label: t.actions.openChat, onSelect: () => revealChat(run.chatId!) } }
        : {}),
    });
    return;
  }
  showToast({
    message: fmt(t.toasts.queued, {
      why: run.hold ? fmt(t.holds[run.hold], { device: run.deviceName }) : t.states[run.state],
    }),
  });
}

/** The same run again, with the mode, folders and roles it had. */
export function runAgainTarget(run: AgentRunDto): { target: RunTarget; options: RunOptions } {
  const target: RunTarget =
    run.source === 'task' && run.cardKey
      ? { source: 'task', cardKey: run.cardKey, title: run.title }
      : run.source === 'plan_step' && run.cardKey && run.planStep !== null
        ? { source: 'plan_step', cardKey: run.cardKey, planStep: run.planStep, title: run.title }
        : { source: 'prompt', prompt: run.prompt, title: run.title };
  return { target, options: { mode: run.mode, extraFolders: run.extraFolders, roles: run.roles } };
}

type WhenChoice = 'now' | 'tonight' | 'morning' | 'weekly' | 'custom';

/** A checkbox row, as the dialog's repeat and the settings use them: 44 px on touch. */
function CheckRow({
  checked,
  onChange,
  children,
  ...rest
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  [data: `data-${string}`]: string | boolean | undefined;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-body text-foreground md:min-h-0" {...rest}>
      <input
        type="checkbox"
        className="size-4 accent-(--primary)"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}

/**
 * Schedule a task, a plan step or a prompt (docs/16 §9). The quick choices are v6's, "Now" joins them, and "Choose a time" adds a date, a time and a weekly repeat. With `target.source === 'prompt'` and no words yet, it asks for them, which is the queue page's New run.
 * It also sets how the run treats the owner (D58), its main and extra folders (D59) and its roles (D60). Every open starts from the defaults, and a passed time says so before it would start at once (review M1, minor 3).
 */
export function ScheduleDialog({
  target,
  onClose,
  allowNow = true,
}: {
  target: RunTarget | null;
  onClose: () => void;
  allowNow?: boolean | undefined;
}) {
  const t = useQueueWords();
  const id = useId();
  const locale = useLocale();
  const place = useRunPlace();
  const queue = useQueue();
  const add = useAddRun();
  const zone = queue.data?.state.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [choice, setChoice] = useState<WhenChoice>('tonight');
  const [folder, setFolder] = useState<string | null>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [mode, setMode] = useState<RunMode>('approval');
  const [prompt, setPrompt] = useState('');
  const [date, setDate] = useState(() => localDateOf(new Date(), zone));
  const [time, setTime] = useState('22:00');
  const [repeat, setRepeat] = useState(false);
  const open = !!target;
  useEffect(() => {
    if (!open) return;
    setChoice(target?.source === 'prompt' && !target.prompt ? 'now' : 'tonight');
    setFolder(null);
    setExtra([]);
    setRoles([]);
    setMode('approval');
    setPrompt('');
    setDate(localDateOf(new Date(), zone));
    setTime('22:00');
    setRepeat(false);
  }, [open]);
  const asksWords = target?.source === 'prompt' && !target.prompt;
  const chosenFolder = folder ?? place.folder ?? place.folders[0] ?? null;
  const others = place.folders.filter((path) => path !== chosenFolder);
  const extras = extra.filter((path) => others.includes(path));
  const words = asksWords ? prompt.trim() : '';
  const secret = asksWords ? detectSecret(prompt) : null;
  const tonightPassed = localInstant(localDateOf(new Date(), zone), '22:00', zone).getTime() <= Date.now();

  const whenOf = (): RunWhen => {
    if (choice === 'now') return { kind: 'now' };
    if (choice !== 'custom') return quickWhen(choice, zone);
    if (repeat) {
      const day = WEEKDAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7] as Weekday;
      return { kind: 'weekly', day, time };
    }
    return { kind: 'once', date, time };
  };
  const when = whenOf();
  // A half-typed date or time is not a time yet: it is neither past nor ready.
  const whole = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time);
  const past =
    when.kind === 'once' && whole && localInstant(when.date, when.time, zone).getTime() <= Date.now();
  const ready =
    !!target &&
    !!place.device &&
    !!chosenFolder &&
    (!asksWords || words.length > 0) &&
    !secret &&
    (choice !== 'custom' || whole);
  const label = (value: RunWhen): string =>
    value.kind === 'now'
      ? t.dialog.now
      : value.kind === 'weekly'
        ? fmt(t.when.weekly, { day: t.days[value.day], time: value.time })
        : whenText(localInstant(value.date, value.time, zone).toISOString(), locale);

  const save = () => {
    if (!ready || !target || !place.device || !chosenFolder) return;
    const finalTarget: RunTarget = asksWords ? { source: 'prompt', prompt: words, title: words } : target;
    add.mutate(
      inputOf(finalTarget, place.device, chosenFolder, when, { mode, extraFolders: extras, roles }),
      {
        onSuccess: (run) => {
          if (when.kind === 'now' || past) startedToast(t, run);
          else showToast({ message: fmt(t.toasts.scheduled, { when: label(when) }) });
          onClose();
        },
        onError: (error) =>
          showToast({ tone: 'error', message: isHubError(error) ? error.message : String(error) }),
      },
    );
  };

  const options: { value: WhenChoice; label: string }[] = [
    ...(allowNow ? [{ value: 'now' as const, label: t.dialog.now }] : []),
    { value: 'tonight', label: tonightPassed ? t.dialog.tonightTomorrow : t.dialog.tonight },
    { value: 'morning', label: t.dialog.morning },
    { value: 'weekly', label: t.dialog.weekly },
    { value: 'custom', label: t.dialog.custom },
  ];

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={asksWords || !target ? t.dialog.newTitle : fmt(t.dialog.title, { title: target.title })}
      footer={
        <>
          <Button onClick={onClose}>{t.dialog.cancel}</Button>
          <Button variant="primary" data-queue-save disabled={!ready} busy={add.isPending} onClick={save}>
            {choice === 'now' ? t.dialog.add : past ? t.dialog.addNow : t.dialog.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-queue-dialog>
        {asksWords && (
          <Field id={`${id}-prompt`} label={t.dialog.prompt} hint={t.dialog.promptHint}>
            <Textarea
              id={`${id}-prompt`}
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              aria-invalid={secret ? true : undefined}
              aria-describedby={secret ? `${id}-secret` : undefined}
              data-autofocus
            />
            {secret && <SecretFilterError id={`${id}-secret`} pattern={secret} />}
          </Field>
        )}
        <Field id={`${id}-when`} label={t.dialog.when}>
          <Select
            id={`${id}-when`}
            value={choice}
            onChange={(e) => setChoice(e.target.value as WhenChoice)}
            {...(asksWords ? {} : { 'data-autofocus': true })}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        {choice === 'custom' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field id={`${id}-date`} label={t.dialog.date}>
                <TextInput
                  id={`${id}-date`}
                  type="date"
                  dir="ltr"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field id={`${id}-time`} label={t.dialog.time}>
                <TextInput
                  id={`${id}-time`}
                  type="time"
                  dir="ltr"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </Field>
            </div>
            <CheckRow checked={repeat} onChange={setRepeat}>
              {t.dialog.repeat}
            </CheckRow>
          </div>
        )}
        {past && (
          <p role="status" data-queue-past className="text-body-sm text-foreground">
            {t.dialog.pastTime}
          </p>
        )}
        <Field
          id={`${id}-mode`}
          label={t.dialog.mode}
          hint={mode === 'automatic' ? t.dialog.modeAutomaticHint : t.dialog.modeApprovalHint}
        >
          <Select
            id={`${id}-mode`}
            data-queue-mode
            value={mode}
            onChange={(e) => setMode(e.target.value as RunMode)}
          >
            <option value="approval">{t.dialog.modeApproval}</option>
            <option value="automatic">{t.dialog.modeAutomatic}</option>
          </Select>
        </Field>
        <Field
          id={`${id}-folder`}
          label={t.dialog.folder}
          hint={place.deviceName ? fmt(t.dialog.device, { device: place.deviceName }) : undefined}
        >
          {place.folders.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">{t.dialog.noFolder}</p>
          ) : (
            <Select
              id={`${id}-folder`}
              dir="ltr"
              className="key text-start"
              value={chosenFolder ?? ''}
              onChange={(e) => setFolder(e.target.value)}
            >
              {place.folders.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {others.length > 0 && (
          <fieldset className="flex flex-col gap-0.5" data-queue-extra>
            <legend className="text-body-sm font-medium text-foreground">{t.dialog.extraFolders}</legend>
            {others.map((path) => (
              <CheckRow
                key={path}
                data-queue-extra-folder={path}
                checked={extras.includes(path)}
                onChange={(on) =>
                  setExtra((list) => (on ? [...list, path] : list.filter((each) => each !== path)))
                }
              >
                <Ltr mono className="text-body-sm [overflow-wrap:anywhere]">
                  {path}
                </Ltr>
              </CheckRow>
            ))}
            <p className="text-body-sm text-muted-foreground">{t.dialog.extraHint}</p>
          </fieldset>
        )}
        <fieldset className="flex flex-col gap-0.5" data-queue-roles>
          <legend className="text-body-sm font-medium text-foreground">{t.dialog.roles}</legend>
          <div className="grid grid-cols-2 gap-x-3">
            {ROLES.map((role) => (
              <CheckRow
                key={role}
                data-queue-role={role}
                checked={roles.includes(role)}
                onChange={(on) =>
                  setRoles((list) => (on ? [...list, role] : list.filter((each) => each !== role)))
                }
              >
                {ROLE_LABELS[role][locale]}
              </CheckRow>
            ))}
          </div>
          <p className="text-body-sm text-muted-foreground">{t.dialog.rolesHint}</p>
        </fieldset>
        {!place.online && place.device && (
          <p className="text-body-sm text-muted-foreground">{t.dialog.noDevice}</p>
        )}
        <p className="text-body-sm text-muted-foreground">{t.dialog.missed}</p>
        <p className="text-body-sm text-muted-foreground">{fmt(t.dialog.timezone, { zone })}</p>
      </div>
    </Modal>
  );
}
