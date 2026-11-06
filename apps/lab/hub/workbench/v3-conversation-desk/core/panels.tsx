import { useId, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CalendarClock, Check, CircleSlash, Clock, Code2, FlaskConical, FolderOpen, Hand, Loader2, Pause, Play, Plug, Repeat, Search, Trash2, UserX, Gauge, X } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { Bidi, Button, CardKey, cn, CommandBlock, copyText, counted, Field, fmt, focusRing, IconButton, kitMessages, Ltr, Modal, openBlockers, openCard, portalRoot, RowMenu, Select, showToast, TextInput, TypeIcon, useCards } from './kit';
import { useAsk, useWorkContext } from './context';
import { deviceOf, deleteChat, firstWaitingChat, newChat, openChat, removeRun, runNow, schedule, send, setEngine, setRunState, useWb, type EngineState } from './store';
import { LIMITS, PROJECTS, type Chat, type L, type Run, type RunState } from './mock';
import { wbMessages } from './strings';
import { useChatState } from './thread';

// ── Engine states (docs/16 S1 Q8): each says what happened and the one thing to do ──────────────

const ENGINE_ICON = { offline: Plug, signed_out: UserX, limit: Gauge, unknown: AlertTriangle } as const;

export function EngineNotice({ className }: { className?: string }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  if (wb.engine === 'ok') return null;
  const e = t.engine[wb.engine];
  const Icon = ENGINE_ICON[wb.engine];
  return (
    <section role="status" data-wb-engine={wb.engine} className={cn('flex flex-col gap-2 rounded-lg border border-border bg-card p-3', className)}>
      <header className="flex items-start gap-2.5">
        <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-warning-strong" strokeWidth={1.75} />
        <div className="min-w-0">
          <h3 className="text-body-lg font-semibold text-foreground">{fmt(e.title, { device: deviceOf(wb.device).name[locale] })}</h3>
          <p className="text-body-sm text-muted-foreground">{e.body}</p>
        </div>
      </header>
      <p className="text-body-sm text-foreground">{e.action}</p>
      {e.command && <CommandBlock value={e.command} copyLabel={t.approval.copy} />}
      {wb.engine === 'unknown' && (
        <div>
          <Button size="sm" onClick={() => setEngine('ok')}>
            {t.engine.retry}
          </Button>
        </div>
      )}
    </section>
  );
}

// ── Context chips and "explain this" ────────────────────────────────────────────────────────────

/** Chips for project, page, card. The card chip is what makes "this" mean the card. */
export function ContextChips({ className, extra }: { className?: string; extra?: ReactNode }) {
  const t = useT(wbMessages);
  const ctx = useWorkContext();
  const chip = 'inline-flex h-7 min-w-0 max-w-full items-center gap-1 rounded-md bg-muted px-2 text-body-sm text-foreground';
  return (
    <ul aria-label={t.context.label} data-wb-chips className={cn('flex min-w-0 flex-wrap items-center gap-1', className)}>
      <li className={chip}>
        <span className="text-muted-foreground">{t.context.project}</span>
        <span className="font-medium">{ctx.project.name}</span>
      </li>
      <li className={chip}>
        <span className="text-muted-foreground">{t.context.page}</span>
        <span className="truncate font-medium">{ctx.pageName}</span>
      </li>
      {ctx.card && (
        <li className={chip} data-wb-chip-card>
          <TypeIcon type={ctx.card.type} size="sm" />
          <Ltr mono className="text-body-sm font-medium">
            {ctx.card.key}
          </Ltr>
        </li>
      )}
      {extra}
    </ul>
  );
}

export function AskButtons({ cardKey, className, labels = 'long' }: { cardKey?: string | null; className?: string; labels?: 'long' | 'short' }) {
  const t = useT(wbMessages);
  const ask = useAsk();
  const wb = useWb();
  const disabled = wb.engine !== 'ok';
  const word = labels === 'long' ? t.context : t.claudeBar;
  return (
    <div role="group" aria-label={t.context.onPage} className={cn('flex flex-wrap gap-1', className)}>
      <Button size="sm" data-wb-explain disabled={disabled} onClick={() => ask('explain', cardKey)}>
        {word.explain}
      </Button>
      <Button size="sm" data-wb-plan disabled={disabled} onClick={() => ask('plan', cardKey)}>
        {word.plan}
      </Button>
      <Button size="sm" data-wb-redesign disabled={disabled} onClick={() => ask('redesign', cardKey)}>
        {word.redesign}
      </Button>
    </div>
  );
}

// ── Do next (docs/16 §11): ranked from real state, with no model involved ───────────────────────

interface Suggestion {
  key: string;
  title: L;
  why: string;
  runnable: boolean;
  folder: string;
  type: ReturnType<typeof useCards>[number]['type'];
}

const REPO_FOLDER: Record<string, string> = { backend: 'F:/Goteav/backend', web: 'F:/Goteav/web', dashboard: 'F:/Goteav/Goteav-Dashboard' };

export function useDoNext(limit = 3): Suggestion[] {
  const t = useT(wbMessages);
  const locale = useLocale();
  const cards = useCards();
  const wb = useWb();
  return useMemo(() => {
    const rows = cards
      .filter((c) => c.type === 'task' || c.type === 'decision')
      .filter((c) => c.status === 'ready' || c.status === 'open')
      .filter((c) => wb.persona === 'owner' || c.ownerRole === wb.persona || c.ownerRole === null)
      .filter((c) => openBlockers(c).length === 0)
      .map((c) => {
        const blocks = c.links.filter((l) => l.kind === 'blocks').length;
        const overdue = !!c.flags?.overdue;
        const small = c.type === 'task' && c.task.effort === 'S';
        const score = (overdue ? 100 : 0) + blocks * 30 + (c.priority === 'P0' ? 25 : c.priority === 'P1' ? 12 : 0) + (small ? 10 : 0);
        const reasons: string[] = [];
        if (overdue) reasons.push(t.next.why.overdue);
        if (blocks) reasons.push(counted(blocks, locale, t.next.why.blocks));
        if (small) reasons.push(t.next.why.small);
        if (!reasons.length) reasons.push(c.type === 'decision' ? t.next.why.inline : t.next.why.ready);
        return { key: c.key, title: c.title, why: reasons.join(locale === 'ar' ? '، ' : ', '), runnable: c.type === 'task', folder: REPO_FOLDER[c.repo ?? ''] ?? 'F:/Goteav/backend', type: c.type, score };
      })
      .sort((a, b) => b.score - a.score);
    return rows.slice(0, limit);
  }, [cards, wb.persona, t, locale, limit]);
}

function startRun(s: { title: L; cardKey?: string; folder: string }, t: typeof wbMessages.ar) {
  const state = runNow(s);
  if (state === 'running') showToast({ message: fmt(t.runsPanel.startedToast, { folder: s.folder }) });
  else showToast({ message: fmt(t.runsPanel.queuedToast, { why: t.runsPanel.states.next }) });
}

export function DoNext({ limit = 3, onRan, className }: { limit?: number; onRan?: () => void; className?: string }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const ask = useAsk();
  const items = useDoNext(limit);
  const [scheduling, setScheduling] = useState<Suggestion | null>(null);
  return (
    <section aria-labelledby="wb-next" data-wb-next className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 id="wb-next" className="text-body font-semibold text-foreground">
          {t.next.title}
        </h3>
        <p className="text-body-sm text-muted-foreground">{t.next.how}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">{t.next.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((s) => (
            <li key={s.key} className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3">
              <div className="flex min-w-0 items-start gap-2">
                <TypeIcon type={s.type} size="sm" className="mt-1" />
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => openCard(s.key)} className={cn('rounded-sm text-start text-body font-medium text-foreground hover:underline', focusRing)}>
                    <Bidi>{s.title[locale]}</Bidi>
                  </button>
                  <p className="flex flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground">
                    <Ltr mono className="text-body-sm">
                      {s.key}
                    </Ltr>
                    <span>{s.why}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.runnable ? (
                  <>
                    <Button
                      size="sm"
                      data-wb-run-now
                      onClick={() => {
                        startRun({ title: s.title, cardKey: s.key, folder: s.folder }, t);
                        onRan?.();
                      }}
                    >
                      <Play aria-hidden className="size-3.5" strokeWidth={2} />
                      {t.next.run}
                    </Button>
                    <Button size="sm" variant="ghost" data-wb-schedule onClick={() => setScheduling(s)}>
                      <CalendarClock aria-hidden className="size-3.5" strokeWidth={1.75} />
                      {t.next.schedule}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => ask('explain', s.key)}>
                    {t.next.explain}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ScheduleDialog target={scheduling} onClose={() => setScheduling(null)} />
    </section>
  );
}

// ── Scheduling ──────────────────────────────────────────────────────────────────────────────────

export function ScheduleDialog({ target, onClose }: { target: { key?: string; title: L; folder: string } | null; onClose: () => void }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const id = useId();
  const [when, setWhen] = useState('tonight');
  const [folder, setFolder] = useState<string | null>(null);
  const folders = PROJECTS.flatMap((p) => p.folders as readonly string[]);
  const save = () => {
    if (!target) return;
    const option = t.schedule.options.find((o) => o.id === when)!;
    schedule({ title: target.title, cardKey: target.key, folder: folder ?? target.folder, when: { ar: option.ar, en: option.en }, repeat: option.repeat });
    showToast({ message: fmt(t.runsPanel.scheduledToast, { when: option[locale] }) });
    onClose();
  };
  return (
    <Modal
      open={!!target}
      onOpenChange={(open) => !open && onClose()}
      title={target ? fmt(t.schedule.title, { title: target.title[locale] }) : ''}
      footer={
        <>
          <Button onClick={onClose}>{t.schedule.cancel}</Button>
          <Button variant="primary" data-wb-schedule-save onClick={save}>
            {t.schedule.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field id={`${id}-when`} label={t.schedule.when}>
          <Select id={`${id}-when`} value={when} onChange={(e) => setWhen(e.target.value)} data-autofocus>
            {t.schedule.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o[locale]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-folder`} label={t.schedule.folder}>
          <Select id={`${id}-folder`} dir="ltr" className="key text-start" value={folder ?? target?.folder ?? ''} onChange={(e) => setFolder(e.target.value)}>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-body-sm text-muted-foreground">{t.schedule.missed}</p>
        <p className="text-body-sm text-muted-foreground">{t.schedule.approval}</p>
      </div>
    </Modal>
  );
}

// ── Runs ────────────────────────────────────────────────────────────────────────────────────────

const RUN_ICON: Record<RunState, typeof Play> = { waiting: Hand, running: Loader2, next: Clock, paused: Pause, scheduled: CalendarClock, done: Check, denied: CircleSlash, interrupted: AlertTriangle };
const RUN_TONE: Record<RunState, string> = {
  waiting: 'text-warning-strong',
  running: 'text-foreground motion-safe:animate-spin',
  next: 'text-muted-foreground',
  paused: 'text-muted-foreground',
  scheduled: 'text-muted-foreground',
  done: 'text-success-soft-foreground',
  denied: 'text-muted-foreground',
  interrupted: 'text-destructive-soft-foreground',
};

export function RunIcon({ state, className }: { state: RunState; className?: string }) {
  const Icon = RUN_ICON[state];
  return <Icon aria-hidden className={cn('size-4 shrink-0', RUN_TONE[state], className)} strokeWidth={2} />;
}

export function RunRow({ run, onOpenChat, compact }: { run: Run; onOpenChat?: (chatId: string) => void; compact?: boolean }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const r = t.runsPanel;
  const line = run.step?.[locale] ?? run.summary?.[locale] ?? run.when?.[locale];
  const items = [
    ...(run.state === 'running' ? [{ label: r.pause, icon: Pause, onSelect: () => setRunState(run.id, 'paused') }] : []),
    ...(run.state === 'paused' ? [{ label: r.resume, icon: Play, onSelect: () => setRunState(run.id, 'running') }] : []),
    ...(run.state === 'next' || run.state === 'scheduled' || run.state === 'paused' || run.state === 'running'
      ? [
          {
            label: r.cancel,
            icon: X,
            destructive: true,
            onSelect: () => {
              const undo = removeRun(run.id);
              showToast({ message: r.canceled, onUndo: undo });
            },
          },
        ]
      : []),
  ];
  return (
    <li data-wb-run={run.state} className="flex min-w-0 items-start gap-2.5 py-2">
      <RunIcon state={run.state} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="min-w-0 text-body font-medium text-foreground">
            <Bidi>{run.title[locale]}</Bidi>
          </span>
          {run.cardKey && <CardKey k={run.cardKey} link className="text-body-sm" />}
        </p>
        <p className="text-body-sm text-muted-foreground">
          <span className="sr-only">{r.states[run.state]}: </span>
          {run.command ? (
            <>
              {r.needsCommand}{' '}
              <code dir="ltr" translate="no" className="key [overflow-wrap:anywhere] text-foreground">
                {run.command}
              </code>
            </>
          ) : (
            <Bidi>{line ?? r.states[run.state]}</Bidi>
          )}
        </p>
        {!compact && (
          <p className="flex flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <FolderOpen aria-hidden className="size-3" strokeWidth={1.75} />
              <Ltr mono className="text-body-sm">
                {run.folder.split('/').pop()}
              </Ltr>
            </span>
            {run.repeat && (
              <span className="inline-flex items-center gap-1">
                <Repeat aria-hidden className="size-3" strokeWidth={1.75} />
                {r.weekly}
              </span>
            )}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {run.state === 'waiting' && run.chatId && (
          <Button size="sm" data-wb-run-answer onClick={() => onOpenChat?.(run.chatId!)}>
            {r.answer}
          </Button>
        )}
        {run.state !== 'waiting' && run.chatId && (
          <Button size="sm" variant="ghost" onClick={() => onOpenChat?.(run.chatId!)}>
            {r.openChat}
          </Button>
        )}
        {run.state === 'interrupted' && (
          <Button size="sm" onClick={() => startRun({ title: run.title, cardKey: run.cardKey, folder: run.folder }, t)}>
            {r.rerun}
          </Button>
        )}
        {items.length > 0 && <RowMenu label={t.more} items={items} />}
      </div>
    </li>
  );
}

export function useRunGroups() {
  const wb = useWb();
  return useMemo(() => {
    const by = (states: RunState[]) => wb.runs.filter((r) => states.includes(r.state));
    return [
      ['needs', by(['waiting'])],
      ['running', by(['running', 'paused'])],
      ['next', by(['next'])],
      ['scheduled', by(['scheduled'])],
      ['recent', by(['done', 'denied', 'interrupted'])],
    ] as const;
  }, [wb.runs]);
}

export function RunsList({ onOpenChat, compact, className, only }: { onOpenChat?: (chatId: string) => void; compact?: boolean; className?: string; only?: readonly ('needs' | 'running' | 'next' | 'scheduled' | 'recent')[] }) {
  const t = useT(wbMessages);
  const wb = useWb();
  const groups = useRunGroups().filter(([g, list]) => list.length && (!only || only.includes(g)));
  return (
    <div data-wb-runs className={cn('flex flex-col gap-3', className)}>
      {wb.engine === 'limit' && <p className="text-body-sm font-medium text-warning-strong">{t.runsPanel.limitPaused}</p>}
      {groups.map(([group, list]) => (
        <section key={group} aria-labelledby={`wb-runs-${group}`}>
          <h3 id={`wb-runs-${group}`} className="flex items-center gap-1.5 text-body-sm font-semibold text-muted-foreground">
            {t.runsPanel.groups[group]}
            <Ltr className="text-body-sm tabular-nums">{list.length}</Ltr>
          </h3>
          <ul className="flex flex-col divide-y divide-border">
            {list.map((run) => (
              <RunRow key={run.id} run={run} onOpenChat={onOpenChat} compact={compact} />
            ))}
          </ul>
        </section>
      ))}
      {groups.length === 0 && <p className="text-body-sm text-muted-foreground">{t.runsPanel.empty}</p>}
    </div>
  );
}

export function RunsFootnote({ className }: { className?: string }) {
  const t = useT(wbMessages);
  return (
    <div className={cn('flex flex-col gap-1 text-body-sm text-muted-foreground', className)}>
      <p>{fmt(t.runsPanel.limits, { used: LIMITS.usedToday, perDay: LIMITS.perDay, quiet: LIMITS.quiet })}</p>
      <p>{t.runsPanel.later}</p>
    </div>
  );
}

// ── History ─────────────────────────────────────────────────────────────────────────────────────

function ChatRow({ chat, active, onOpen }: { chat: Chat; active: boolean; onOpen: (id: string) => void }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const state = useChatState(chat);
  return (
    <li className="group relative flex min-w-0 items-center gap-1">
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        data-wb-chat={chat.id}
        onClick={() => onOpen(chat.id)}
        className={cn('flex min-h-11 min-w-0 flex-1 flex-col rounded-md px-2 py-1.5 text-start transition-colors duration-120 hover:bg-accent', active && 'bg-accent', focusRing)}
      >
        <span className={cn('truncate text-body text-foreground', active && 'font-semibold')}>
          <Bidi>{chat.title[locale]}</Bidi>
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground">
          {state.tone === 'needs' && <Hand aria-hidden className="size-3.5 text-warning-strong" strokeWidth={2} />}
          {state.tone === 'busy' && <Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" strokeWidth={2} />}
          {state.label && <span className="font-medium text-foreground">{state.label}</span>}
          <span>{chat.at[locale]}</span>
          <span>{deviceOf(chat.device).name[locale]}</span>
        </span>
      </button>
      <RowMenu label={t.more} items={[{ label: t.historyPanel.delete, icon: Trash2, destructive: true, onSelect: () => deleteChat(chat.id, { ar: wbMessages.ar.historyPanel.deleted, en: wbMessages.en.historyPanel.deleted }, locale) }]} />
    </li>
  );
}

export function HistoryList({ onOpen, className }: { onOpen?: (id: string) => void; className?: string }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const [q, setQ] = useState('');
  const chats = wb.chats.filter((c) => !c.deleted && (!q || c.title[locale].toLowerCase().includes(q.toLowerCase())));
  const open = (id: string) => {
    openChat(id);
    onOpen?.(id);
  };
  return (
    <div data-wb-history className={cn('flex flex-col gap-3', className)}>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
        <TextInput dir="auto" aria-label={t.historyPanel.search} placeholder={t.historyPanel.search} value={q} onChange={(e) => setQ(e.target.value)} className="ps-8" />
      </div>
      {PROJECTS.map((p) => {
        const list = chats.filter((c) => c.project === p.id);
        if (!list.length) return null;
        return (
          <section key={p.id} aria-labelledby={`wb-h-${p.id}`} className="flex flex-col gap-0.5">
            <h3 id={`wb-h-${p.id}`} className="px-2 text-body-sm font-semibold text-muted-foreground">
              {p.name}
            </h3>
            <ul className="flex flex-col gap-0.5">
              {list.map((c) => (
                <ChatRow key={c.id} chat={c} active={c.id === wb.activeId} onOpen={open} />
              ))}
            </ul>
          </section>
        );
      })}
      {chats.length === 0 && <p className="px-2 text-body-sm text-muted-foreground">{t.historyPanel.empty}</p>}
    </div>
  );
}

// ── Empty chat ──────────────────────────────────────────────────────────────────────────────────

export function EmptyChat({ className, measure, onRan }: { className?: string; measure?: string; onRan?: () => void }) {
  const t = useT(wbMessages);
  const ctx = useWorkContext();
  const wb = useWb();
  return (
    <div data-wb-empty className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', className)}>
      <div className={cn('mx-auto flex w-full flex-col gap-4 p-3 md:p-4', measure)}>
        <div className="flex flex-col gap-1">
          <h2 className="text-title font-semibold text-foreground">{t.empty.title}</h2>
          <p className="text-body text-muted-foreground">{t.empty.body}</p>
        </div>
        {wb.engine === 'ok' && (
          <div className="flex flex-col gap-1.5">
            <p className="text-body-sm text-muted-foreground">{ctx.cardKey ? fmt(t.context.onCard, { key: ctx.cardKey }) : t.context.onPage}</p>
            <AskButtons />
          </div>
        )}
        <DoNext onRan={onRan} />
        <p className="text-body-sm text-muted-foreground">{t.next.ai}</p>
      </div>
    </div>
  );
}

// ── Send to VS Code (docs/16 §8, S1 Q10): honest that the owner presses Enter ───────────────────

export function VsCodeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const ctx = useWorkContext();
  const chat = wb.chats.find((c) => c.id === wb.activeId);
  const folder = chat?.folder ?? wb.folder;
  const noBridge = deviceOf(wb.device).state !== 'ready';
  const key = ctx.cardKey ?? chat?.items.flatMap((it) => (it.kind === 'user' && it.context?.cardKey ? [it.context.cardKey] : []))[0];
  const prompt = key ? fmt(t.vscode.template, { key, folder }) : fmt(t.vscode.templateNoCard, { folder, title: chat?.title[locale] ?? ctx.pageName });
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t.vscode.title}
      description={t.vscode.lead}
      footer={
        <>
          <Button
            onClick={() => {
              void copyText(prompt);
              showToast({ message: kitCopied(locale) });
            }}
          >
            {t.vscode.copy}
          </Button>
          {!noBridge && (
            <Button
              variant="primary"
              data-wb-vscode-send
              onClick={() => {
                showToast({ message: t.vscode.sent });
                onOpenChange(false);
              }}
            >
              {t.vscode.send}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-body-sm font-medium text-muted-foreground">{t.vscode.prompt}</p>
          <p dir="auto" className="rounded-md bg-muted p-2 text-body text-foreground">
            <Bidi>{prompt}</Bidi>
          </p>
        </div>
        {noBridge ? (
          <p className="text-body-sm text-foreground">{t.vscode.noBridge}</p>
        ) : (
          <ol className="flex list-inside list-decimal flex-col gap-1 text-body-sm text-foreground">
            {t.vscode.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        )}
        {chat && <p className="text-body-sm text-muted-foreground">{t.vscode.newChat}</p>}
      </div>
    </Modal>
  );
}
const kitCopied = (locale: 'ar' | 'en') => kitMessages[locale].copy.copied;

export function VsCodeButton({ short, onClick, className }: { short?: boolean; onClick: () => void; className?: string }) {
  const t = useT(wbMessages);
  return (
    <Button size="sm" variant="ghost" data-wb-vscode title={t.vscode.lead} onClick={onClick} className={className}>
      <Code2 aria-hidden className="size-3.5" strokeWidth={1.75} />
      <span className="max-md:sr-only">{short ? t.vscode.short : t.vscode.button}</span>
    </Button>
  );
}

// ── The one bar the card sheet gains ────────────────────────────────────────────────────────────

export function SheetClaudeBar({ cardKey, onAsk }: { cardKey: string; onAsk?: () => void }) {
  const t = useT(wbMessages);
  const ask = useAsk();
  const wb = useWb();
  const [vscode, setVscode] = useState(false);
  const off = wb.engine !== 'ok';
  const go = (a: 'explain' | 'plan' | 'redesign') => {
    ask(a, cardKey);
    onAsk?.();
  };
  return (
    <div role="group" aria-label={t.claudeBar.label} data-wb-sheetbar className="flex flex-wrap items-center gap-1">
      <span className="me-1 text-body-sm text-muted-foreground">{t.claudeBar.label}</span>
      <Button size="sm" variant="ghost" disabled={off} onClick={() => go('explain')}>
        {t.claudeBar.explain}
      </Button>
      <Button size="sm" variant="ghost" disabled={off} onClick={() => go('plan')}>
        {t.claudeBar.plan}
      </Button>
      <Button size="sm" variant="ghost" disabled={off} onClick={() => go('redesign')}>
        {t.claudeBar.redesign}
      </Button>
      <VsCodeButton short onClick={() => setVscode(true)} />
      <VsCodeDialog open={vscode} onOpenChange={setVscode} />
    </div>
  );
}

// ── Prototype-only controls, clearly marked ─────────────────────────────────────────────────────

export function DemoMenu({ onAct, side }: { onAct?: () => void; side?: 'top' | 'bottom' }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const d = t.demo;
  const item = 'flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent md:min-h-9';
  const states: (Exclude<EngineState, 'ok'> | 'normal')[] = ['normal', 'offline', 'signed_out', 'limit', 'unknown'];
  const say = (text: string, script: 'push' | 'folders' | 'create' | 'long') => {
    if (wb.engine !== 'ok') setEngine('ok');
    send({ text, script, fresh: true });
    onAct?.();
  };
  return (
    <DropdownMenu.Root dir={locale === 'ar' ? 'rtl' : 'ltr'} modal={false}>
      <DropdownMenu.Trigger asChild>
        <IconButton label={d.label} data-wb-demo>
          <FlaskConical aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalRoot()}>
        <DropdownMenu.Content side={side} align="end" sideOffset={4} collisionPadding={12} className="z-[75] w-64 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md">
          <DropdownMenu.Label className="px-2.5 py-1.5 text-body-sm font-semibold text-foreground">{d.label}</DropdownMenu.Label>
          <DropdownMenu.Label className="px-2.5 pt-1 text-body-sm font-medium text-muted-foreground">{d.states}</DropdownMenu.Label>
          {states.map((s) => (
            <DropdownMenu.Item key={s} data-wb-state={s} className={item} onSelect={() => setEngine(s === 'normal' ? 'ok' : s)}>
              <span className="flex-1">{s === 'normal' ? d.normal : d[s]}</span>
              {(s === 'normal' ? wb.engine === 'ok' : wb.engine === s) && <Check aria-hidden className="size-4" />}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Item
            data-wb-state="empty"
            className={item}
            onSelect={() => {
              newChat();
              onAct?.();
            }}
          >
            {d.empty}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Label className="px-2.5 pt-1 text-body-sm font-medium text-muted-foreground">{d.try}</DropdownMenu.Label>
          <DropdownMenu.Item data-wb-try="push" className={item} onSelect={() => say(d.pushPrompt, 'push')}>
            {d.push}
          </DropdownMenu.Item>
          <DropdownMenu.Item data-wb-try="folders" className={item} onSelect={() => say(d.foldersPrompt, 'folders')}>
            {d.folders}
          </DropdownMenu.Item>
          <DropdownMenu.Item data-wb-try="create" className={item} onSelect={() => say(d.createPrompt, 'create')}>
            {d.create}
          </DropdownMenu.Item>
          <DropdownMenu.Item data-wb-try="long" className={item} onSelect={() => say(d.longPrompt, 'long')}>
            {d.long}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** The next approval waiting anywhere, so a direction can jump to it from wherever it shows the count. */
export function useFirstWaiting() {
  const wb = useWb();
  return firstWaitingChat(wb);
}

