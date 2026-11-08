'use client';

/**
 * @file run-bits.tsx
 * @description The agent queue's shared parts (docs/16 §9): a run's icon and words, its row, its actions, Run now, and the schedule dialog. The queue page, the panel's Runs, the strip and the card sheet all use these, so a run reads the same everywhere.
 * A run is one neutral card. Its state shows in a coloured icon and in words, never in a coloured edge (D31). Every time is in the queue's timezone, which the dialog names.
 */
import type { AgentRunDto, CreateRunInput, RunViewState, RunWhen, Weekday } from '@hub/contracts';
import { localDateOf, WEEKDAYS } from '@hub/contracts';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  CircleSlash,
  Clock,
  FolderOpen,
  Hand,
  Loader2,
  type LucideIcon,
  Pause,
  Play,
  Repeat,
  Square,
  X,
} from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

import {
  Bidi,
  Button,
  CardKey,
  cn,
  Field,
  fmt,
  Ltr,
  Modal,
  plural,
  RowMenu,
  type RowMenuItem,
  Select,
  showToast,
  Textarea,
  TextInput,
  useLocale,
  useT,
  when as whenText,
} from '@/components/kit';
import { revealApproval, revealChat, useMaybeWb } from '@/components/workbench/store';
import { quickWhen, type RunAction, useAddRun, useQueue, useRunAction } from '@/features/queue/queries';
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

/** Pause, resume, cancel, with their toasts. A refusal says the API's own words. */
export function useRunActions() {
  const t = useQueueWords();
  const act = useRunAction();
  return (run: AgentRunDto, action: RunAction) =>
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
        onError: (error) =>
          showToast({ tone: 'error', message: isHubError(error) ? error.message : String(error) }),
      },
    );
}

export function runMenuItems(
  run: AgentRunDto,
  t: QueueMessages,
  act: (run: AgentRunDto, action: RunAction) => void,
  move?: { up?: (() => void) | undefined; down?: (() => void) | undefined },
): RowMenuItem[] {
  const open = run.stored === 'queued' || run.stored === 'running';
  return [
    ...(move?.up ? [{ label: t.actions.moveUp, icon: ArrowUp, onSelect: move.up }] : []),
    ...(move?.down ? [{ label: t.actions.moveDown, icon: ArrowDown, onSelect: move.down }] : []),
    ...(open && !run.paused
      ? [{ label: t.actions.pause, icon: Pause, onSelect: () => act(run, 'pause') }]
      : []),
    ...(run.paused ? [{ label: t.actions.resume, icon: Play, onSelect: () => act(run, 'resume') }] : []),
    ...(open
      ? [{ label: t.actions.cancel, icon: X, destructive: true, onSelect: () => act(run, 'cancel') }]
      : []),
  ];
}

/**
 * One run. `primary` makes its main action the page's one filled button, which is the first run waiting on the owner. `handle` is the drag grip the queue page adds to runs not started.
 */
export function RunRow({
  run,
  primary = false,
  compact = false,
  handle,
  menu,
  onRunAgain,
}: {
  run: AgentRunDto;
  primary?: boolean | undefined;
  compact?: boolean | undefined;
  handle?: ReactNode | undefined;
  menu?: RowMenuItem[] | undefined;
  onRunAgain?: (() => void) | undefined;
}) {
  const t = useQueueWords();
  const locale = useLocale();
  const line = useRunLine()(run);
  const folderName = run.folder.replaceAll('\\', '/').split('/').filter(Boolean).pop() ?? run.folder;
  const ended = run.state === 'done' || run.state === 'failed' || run.state === 'stopped';
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      {handle}
      <span role="img" aria-label={t.states[run.state]} className="mt-0.5 inline-flex shrink-0">
        <RunIcon state={run.state} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="min-w-0 text-body font-medium text-foreground [overflow-wrap:anywhere]">
            <Bidi>{run.title}</Bidi>
          </span>
          {run.cardKey && <CardKey k={run.cardKey} link className="text-body-sm" />}
        </p>
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
            <span className="inline-flex min-w-0 items-center gap-1" title={run.folder}>
              <FolderOpen aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
              <Ltr mono className="text-body-sm">
                {folderName}
              </Ltr>
            </span>
            {run.deviceName && <span>{run.deviceName}</span>}
            {run.repeat && (
              <span className="inline-flex items-center gap-1">
                <Repeat aria-hidden className="size-3.5" strokeWidth={1.75} />
                {t.weekly}
              </span>
            )}
            {run.changedFiles.length > 0 && <span>{plural(run.changedFiles.length, locale, t.files)}</span>}
            {run.moved !== null && run.cardKey && <span>{run.moved ? t.moved : t.notMoved}</span>}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
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
          <Button size="sm" variant="ghost" data-queue-chat onClick={() => revealChat(run.chatId!)}>
            {t.actions.openChat}
          </Button>
        )}
        {run.state === 'interrupted' && onRunAgain && (
          <Button size="sm" onClick={onRunAgain}>
            {t.actions.runAgain}
          </Button>
        )}
        {menu && menu.length > 0 && <RowMenu label={t.actions.more} items={menu} />}
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

function inputOf(target: RunTarget, device: string, folder: string, when: RunWhen): CreateRunInput {
  if (target.source === 'task') return { source: 'task', cardKey: target.cardKey, device, folder, when };
  if (target.source === 'plan_step') {
    return { source: 'plan_step', cardKey: target.cardKey, planStep: target.planStep, device, folder, when };
  }
  return { source: 'prompt', prompt: target.prompt, device, folder, when };
}

/** Where a run goes: the panel's device and folder. Null when there is none, with the reason. */
export function useRunPlace(): {
  device: string | null;
  deviceName: string;
  online: boolean;
  folder: string | null;
  folders: readonly string[];
} {
  const wb = useMaybeWb();
  return {
    device: wb?.deviceId ?? null,
    deviceName: wb?.deviceName ?? '',
    online: !!wb?.device?.online,
    folder: wb?.folder ?? null,
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

/** Run now: joins the line at once, and the toast says whether it started or why it waits. */
export function useRunNow() {
  const t = useQueueWords();
  const add = useAddRun();
  const place = useRunPlace();
  return (target: RunTarget) => {
    if (!place.device || !place.folder) return;
    add.mutate(inputOf(target, place.device, place.folder, { kind: 'now' }), {
      onSuccess: (run) =>
        showToast({
          message:
            run.state === 'running' || run.state === 'waiting'
              ? fmt(t.toasts.started, { folder: run.folder })
              : fmt(t.toasts.queued, {
                  why: run.hold ? fmt(t.holds[run.hold], { device: run.deviceName }) : t.states[run.state],
                }),
        }),
      onError: (error) =>
        showToast({ tone: 'error', message: isHubError(error) ? error.message : String(error) }),
    });
  };
}

type WhenChoice = 'now' | 'tonight' | 'morning' | 'weekly' | 'custom';

/**
 * Schedule a task, a plan step or a prompt (docs/16 §9). The quick choices are v6's; "Choose a time" adds a date, a time and a weekly repeat. With `target.source === 'prompt'` and no words yet, it asks for them, which is the queue page's New run.
 */
export function ScheduleDialog({
  target,
  onClose,
  allowNow = false,
}: {
  target: RunTarget | null;
  onClose: () => void;
  allowNow?: boolean | undefined;
}) {
  const t = useQueueWords();
  const id = useId();
  const place = useRunPlace();
  const queue = useQueue();
  const add = useAddRun();
  const zone = queue.data?.state.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [choice, setChoice] = useState<WhenChoice>(allowNow ? 'now' : 'tonight');
  const [folder, setFolder] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [date, setDate] = useState(() => localDateOf(new Date(), zone));
  const [time, setTime] = useState('22:00');
  const [repeat, setRepeat] = useState(false);
  const asksWords = target?.source === 'prompt' && !target.prompt;
  const chosenFolder = folder ?? place.folder ?? place.folders[0] ?? null;
  const words = asksWords ? prompt.trim() : '';
  const ready = !!target && !!place.device && !!chosenFolder && (!asksWords || words.length > 0);

  const whenOf = (): RunWhen => {
    if (choice === 'now') return { kind: 'now' };
    if (choice !== 'custom') return quickWhen(choice, zone);
    if (repeat) {
      const day = WEEKDAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7] as Weekday;
      return { kind: 'weekly', day, time };
    }
    return { kind: 'once', date, time };
  };
  const label = (when: RunWhen): string =>
    when.kind === 'now'
      ? t.dialog.now
      : when.kind === 'weekly'
        ? fmt(t.when.weekly, { day: t.days[when.day], time: when.time })
        : `${when.date} ${when.time}`;

  const save = () => {
    if (!ready || !target || !place.device || !chosenFolder) return;
    const when = whenOf();
    const finalTarget: RunTarget = asksWords ? { source: 'prompt', prompt: words, title: words } : target;
    add.mutate(inputOf(finalTarget, place.device, chosenFolder, when), {
      onSuccess: (run) => {
        showToast({
          message:
            when.kind === 'now'
              ? run.state === 'running'
                ? fmt(t.toasts.started, { folder: run.folder })
                : fmt(t.toasts.queued, {
                    why: run.hold ? fmt(t.holds[run.hold], { device: run.deviceName }) : t.states[run.state],
                  })
              : fmt(t.toasts.scheduled, { when: label(when) }),
        });
        setPrompt('');
        onClose();
      },
      onError: (error) =>
        showToast({ tone: 'error', message: isHubError(error) ? error.message : String(error) }),
    });
  };

  const options: { value: WhenChoice; label: string }[] = [
    ...(allowNow ? [{ value: 'now' as const, label: t.dialog.now }] : []),
    { value: 'tonight', label: t.dialog.tonight },
    { value: 'morning', label: t.dialog.morning },
    { value: 'weekly', label: t.dialog.weekly },
    { value: 'custom', label: t.dialog.custom },
  ];

  return (
    <Modal
      open={!!target}
      onOpenChange={(open) => !open && onClose()}
      title={asksWords || !target ? t.dialog.newTitle : fmt(t.dialog.title, { title: target.title })}
      footer={
        <>
          <Button onClick={onClose}>{t.dialog.cancel}</Button>
          <Button variant="primary" data-queue-save disabled={!ready} busy={add.isPending} onClick={save}>
            {choice === 'now' ? t.dialog.add : t.dialog.save}
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
              data-autofocus
            />
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
            <label className="flex min-h-11 items-center gap-2 text-body text-foreground md:min-h-0">
              <input
                type="checkbox"
                className="size-4 accent-(--primary)"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
              />
              {t.dialog.repeat}
            </label>
          </div>
        )}
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
        {!place.online && place.device && (
          <p className="text-body-sm text-muted-foreground">{t.dialog.noDevice}</p>
        )}
        <p className="text-body-sm text-muted-foreground">{t.dialog.missed}</p>
        <p className="text-body-sm text-muted-foreground">{t.dialog.approval}</p>
        <p className="text-body-sm text-muted-foreground">{fmt(t.dialog.timezone, { zone })}</p>
      </div>
    </Modal>
  );
}
