'use client';

/**
 * @file panels.tsx
 * @description The panel's other views and notices: honest states, Do next, what is running now, history, the empty chat, Send to VS Code, and the bar the card sheet gains. Ported from the approved design, `apps/lab/hub/workbench/v6-edge-strip-port/core/panels.tsx`.
 * Runs show only chats that are real today. The queue, Run now and Schedule are slice 5, so they are not here at all (docs/16 §9).
 */
import { doNext, type DoNextItem, vscodePrompt } from '@hub/contracts';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Code2,
  CreditCard,
  FileText,
  FolderX,
  Gauge,
  Hand,
  ListChecks,
  Loader2,
  type LucideIcon,
  Pin,
  PinOff,
  Plug,
  RefreshCw,
  Search,
  ServerCrash,
  Settings2,
  Trash2,
  UserX,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  AppLink,
  Bidi,
  Button,
  cn,
  CommandBlock,
  copyText,
  fmt,
  focusRing,
  kitMessages,
  Ltr,
  Modal,
  openCard,
  plural,
  type Role,
  RowMenu,
  showToast,
  TextInput,
  Tip,
  type TipFact,
  TypeIcon,
  useCard,
  useCards,
  useLocale,
  useMedia,
  useRoute,
  useT,
} from '@/components/kit';
import { useOpenInVsCode } from '@/features/chat/queries';
import { isHubError } from '@/lib/api/errors';

import { Suggestions } from './composer';
import {
  checkEngine,
  deleteChat,
  engineBlocks,
  type EngineState,
  openChat,
  retryTurn,
  revealApproval,
  startSkill,
  togglePin,
  useAsk,
  useMaybeWb,
  useWb,
} from './store';
import { clockOf } from './thread';
import type { ChatMessages } from './words';

const counted = (n: number, locale: 'ar' | 'en', forms: Parameters<typeof plural>[2]) =>
  fmt(plural(n, locale, forms), { n });
const offOf = (engine: EngineState) => (engineBlocks(engine) ? (engine as 'offline') : null);

// ── Engine states (docs/16 S1 Q8): each says what happened and the one thing to do ──────────────

const ENGINE_ICON: Record<Exclude<EngineState, 'ok'>, LucideIcon> = {
  no_device: Plug,
  no_folder: FolderX,
  revoked: UserX,
  limit_open: Gauge,
  offline: Plug,
  signed_out: UserX,
  limit: Gauge,
  unknown: AlertTriangle,
  version_new: AlertTriangle,
  version_old: AlertTriangle,
  claude_missing: FileText,
  billing: CreditCard,
  overloaded: ServerCrash,
  session_missing: AlertTriangle,
  folder_not_allowed: FolderX,
  folder_missing: FolderX,
  unreadable: AlertTriangle,
};
/** What each state offers. Offline and revoked have no re-check: only the device coming back clears them. */
const ENGINE_ACTIONS: Partial<
  Record<Exclude<EngineState, 'ok'>, 'check' | 'retry' | 'vscode' | 'dismiss' | 'old' | 'settings'>
> = {
  no_device: 'settings',
  no_folder: 'settings',
  revoked: 'settings',
  signed_out: 'check',
  limit: 'check',
  limit_open: 'dismiss',
  version_old: 'old',
  claude_missing: 'check',
  billing: 'retry',
  folder_not_allowed: 'retry',
  folder_missing: 'retry',
  unknown: 'retry',
  overloaded: 'retry',
  unreadable: 'vscode',
  version_new: 'dismiss',
  session_missing: 'dismiss',
};

/**
 * One line and its action, with the rest behind Details on a small screen, so a notice cannot take half a phone (review N4). The states come from `honestStateOf`. `Check again` asks the device past its cache. It cannot promise a sign-in, because only a turn reveals one, and it says so.
 */
export function EngineNotice({
  className,
  onVsCode,
}: {
  className?: string | undefined;
  onVsCode?: (() => void) | undefined;
}) {
  const t = useT<ChatMessages>('chat').panel;
  const tipWords = useT<ChatMessages>('chat').tips;
  const locale = useLocale();
  const wb = useWb();
  const roomy = useMedia('(min-width: 768px)');
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  if (wb.engine === 'ok' && wb.checked?.signIn) {
    return (
      <p
        role="status"
        data-wb-engine-checked
        className="flex items-start gap-1.5 text-body-sm text-foreground"
      >
        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-soft-foreground" strokeWidth={2} />
        <span>{t.engine.checkedSignIn}</span>
      </p>
    );
  }
  if (wb.engine === 'ok' || gone === wb.engine) return null;
  const e = t.engine[wb.engine];
  const Icon = ENGINE_ICON[wb.engine];
  const open = userOpen ?? roomy;
  const action = ENGINE_ACTIONS[wb.engine];
  const warning = wb.engine === 'version_new';
  const status = wb.engineStatus;
  const vars = {
    device: wb.deviceName,
    time: clockOf(wb.resetsAt ? new Date(wb.resetsAt).toISOString() : null, locale),
    version: status?.version ?? '',
    tested: status?.warning?.testedMax ?? status?.testedRange.max ?? '',
    min: status?.testedRange.min ?? '',
  };
  const chat = wb.chat;
  const failure = wb.engine === 'unknown' ? chat?.raw.messages.at(-1)?.failureMessage : null;
  return (
    <section
      role="status"
      data-wb-engine={wb.engine}
      data-wb-engine-blocks={engineBlocks(wb.engine)}
      className={cn('flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5', className)}
    >
      <header className="flex min-w-0 items-start gap-2">
        <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-strong" strokeWidth={1.75} />
        <h3 className="min-w-0 flex-1 text-body font-semibold text-foreground">{fmt(e.title, vars)}</h3>
        <button
          type="button"
          data-wb-engine-details
          aria-expanded={open}
          onClick={() => setUserOpen(!open)}
          className={cn(
            'inline-flex shrink-0 items-center gap-0.5 rounded-sm text-body-sm text-muted-foreground hover:text-foreground max-md:min-h-11',
            focusRing,
          )}
        >
          {open ? t.engine.hide : t.engine.details}
          <ChevronDown
            aria-hidden
            className={cn('size-3.5 shrink-0', open && 'rotate-180')}
            strokeWidth={1.75}
          />
        </button>
      </header>
      {open && (
        <div data-wb-engine-body className="flex min-w-0 flex-col gap-1.5">
          <p className="text-body-sm text-muted-foreground">{fmt(e.body, vars)}</p>
          <p className="text-body-sm text-foreground">{fmt(e.action, vars)}</p>
          {failure && (
            <p className="text-body-sm [overflow-wrap:anywhere] text-foreground">
              <Bidi>{failure}</Bidi>
            </p>
          )}
          {'command' in e && e.command && (
            <Tip k="tools:copy">
              <div>
                <CommandBlock value={e.command} copyLabel={t.approval.copy} />
              </div>
            </Tip>
          )}
        </div>
      )}
      {/* No folder is the notice, but the plug on the strip is orange too: say it here, so the two do not disagree (review m6). */}
      {wb.engine === 'no_folder' && wb.device && !wb.device.online && (
        <p data-wb-engine-also-offline className="text-body-sm text-foreground">
          {fmt(t.engine.alsoOffline, vars)}
        </p>
      )}
      {wb.checked?.same && !wb.checked.signIn && (
        <p role="status" data-wb-engine-still className="text-body-sm text-foreground">
          {fmt(t.engine.still, { time: clockOf(wb.checked.at, locale) })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {(action === 'check' || action === 'old') && (
          <Tip content={{ what: t.engine.check, then: fmt(e.action, vars) }}>
            <Button size="sm" data-wb-engine-check busy={wb.checking} onClick={() => checkEngine(wb.engine)}>
              {!wb.checking && <RefreshCw aria-hidden className="size-3.5" strokeWidth={1.75} />}
              {wb.checking ? t.engine.checking : t.engine.check}
            </Button>
          </Tip>
        )}
        {action === 'settings' && (
          <AppLink
            view="settings"
            query={{ tab: 'devices' }}
            data-wb-engine-settings
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-body-sm font-medium text-foreground hover:bg-accent max-md:h-11',
              focusRing,
            )}
          >
            <Settings2 aria-hidden className="size-3.5" strokeWidth={1.75} />
            {t.engine.openSettings}
          </AppLink>
        )}
        {action === 'retry' && chat && (
          <Tip content={{ what: t.pro.turn.retryNote }}>
            <Button size="sm" data-wb-engine-retry onClick={() => retryTurn(chat.id)}>
              {t.engine.retry}
            </Button>
          </Tip>
        )}
        {(action === 'old' || action === 'vscode' || warning) && (
          <Tip k="sheet:vscode">
            <Button
              size="sm"
              variant={action === 'vscode' ? 'outline' : 'ghost'}
              data-wb-engine-vscode
              onClick={onVsCode}
            >
              <Code2 aria-hidden className="size-3.5" strokeWidth={1.75} />
              {t.engine.openVs}
            </Button>
          </Tip>
        )}
        {action === 'vscode' && chat && (
          <Tip content={{ what: t.pro.turn.retryNote }}>
            <Button size="sm" variant="ghost" data-wb-engine-retry onClick={() => retryTurn(chat.id)}>
              {t.engine.retry}
            </Button>
          </Tip>
        )}
        {action === 'dismiss' && !warning && (
          <Button size="sm" variant="ghost" data-wb-engine-ok onClick={() => setGone(wb.engine)}>
            {tipWords.labels.helpHintClose}
          </Button>
        )}
      </div>
    </section>
  );
}

// ── Do next (docs/16 §11): ranked from real state, with no model involved ───────────────────────

export function DoNext({
  limit = 3,
  className,
}: {
  limit?: number | undefined;
  className?: string | undefined;
}) {
  const t = useT<ChatMessages>('chat').panel;
  const tipWords = useT<ChatMessages>('chat').tips;
  const locale = useLocale();
  const ask = useAsk();
  const wb = useWb();
  const cards = useCards();
  const off = offOf(wb.engine);
  const items = useMemo(
    () =>
      doNext(
        cards.map((c) => ({
          key: c.key,
          type: c.type,
          title: c.title,
          status: c.status,
          priority: c.priority,
          ownerRole: c.ownerRole,
          blocksCount: c.blocksCount ?? 0,
          awaiting: c.awaiting ?? null,
          archivedAt: c.archivedAt ?? null,
          closedAt: c.closedAt ?? null,
          dueAt: c.dueAt ?? null,
          flags: { blocked: !!c.flags?.blocked, overdue: !!c.flags?.overdue },
        })),
        { role: (wb.persona as Role | null) ?? null, limit, nowMs: Date.now() },
      ),
    [cards, wb.persona, limit],
  );
  const why = (item: DoNextItem) =>
    item.reasons
      .map((reason) => {
        if (reason === 'overdue') return t.next.why.overdue;
        if (reason === 'blocks') return counted(item.blocks, locale, t.next.why.blocks);
        return reason === 'decision' ? t.next.why.decision : t.next.why.ready;
      })
      .join(t.listSeparator);
  return (
    <section aria-labelledby="wb-next" data-wb-next className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Tip k="next:title" align="start">
          <h3
            id="wb-next"
            tabIndex={0}
            className={cn('rounded-sm text-body font-semibold text-foreground', focusRing)}
          >
            {t.next.title}
          </h3>
        </Tip>
        <p className="text-body-sm text-muted-foreground">{t.next.how}</p>
      </div>
      {items.length === 0 ? (
        <p data-wb-next-empty className="text-body-sm text-muted-foreground">
          {t.next.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.key}
              data-wb-next-item={item.key}
              className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex min-w-0 items-start gap-2">
                <TypeIcon type={item.type} size="sm" className="mt-1" />
                <div className="min-w-0 flex-1">
                  <Tip k="next:open" align="start">
                    <button
                      type="button"
                      onClick={() => openCard(item.key)}
                      className={cn(
                        'rounded-sm text-start text-body font-medium text-foreground hover:underline max-md:min-h-11',
                        focusRing,
                      )}
                    >
                      <Bidi>{item.title}</Bidi>
                    </button>
                  </Tip>
                  <p className="flex flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground">
                    <Ltr mono className="text-body-sm">
                      {item.key}
                    </Ltr>
                    <span data-wb-next-why>{why(item)}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Tip k="next:explain" off={off} vars={{ device: wb.deviceName }} label={t.next.explain}>
                  <Button size="sm" disabled={!!off} onClick={() => ask('explain', item.key)}>
                    {t.next.explain}
                  </Button>
                </Tip>
              </div>
            </li>
          ))}
        </ul>
      )}
      <span className="sr-only">{tipWords.items['next:title'].what}</span>
    </section>
  );
}

// ── What runs today: real chats ─────────────────────────────────────────────────────────────────

/** The queue is the next slice, so this is only what is true now: chats that wait on the owner and chats with a turn running. */
export function RunsList({
  onOpenChat,
  className,
}: {
  onOpenChat: (id: string) => void;
  className?: string | undefined;
}) {
  const t = useT<ChatMessages>('chat').panel;
  const r = t.runsPanel;
  const wb = useWb();
  const waitingIds = new Set(wb.waiting.map((w) => w.id));
  const running = wb.chats.filter((c) => c.running && !waitingIds.has(c.id));
  return (
    <div data-wb-runs className={cn('flex flex-col gap-3', className)}>
      {wb.waiting.length > 0 && (
        <section aria-labelledby="wb-runs-needs">
          <h3
            id="wb-runs-needs"
            className="flex items-center gap-1.5 text-body-sm font-semibold text-muted-foreground"
          >
            {r.groups.needs}
            <Ltr className="text-body-sm tabular-nums">{wb.waiting.length}</Ltr>
          </h3>
          <ul className="flex flex-col divide-y divide-border">
            {wb.waiting.map((w) => (
              <li key={w.id} data-wb-run="waiting" className="flex min-w-0 items-center gap-2.5 py-2">
                <Hand aria-hidden className="size-4 shrink-0 text-warning-strong" strokeWidth={2} />
                <span className="min-w-0 flex-1 text-body font-medium text-foreground">
                  <Bidi>{w.title}</Bidi>
                </span>
                <Tip k="runs:answer">
                  <Button size="sm" data-wb-run-answer onClick={() => revealApproval(w.id)}>
                    {r.answer}
                  </Button>
                </Tip>
              </li>
            ))}
          </ul>
        </section>
      )}
      {running.length > 0 && (
        <section aria-labelledby="wb-runs-running">
          <h3
            id="wb-runs-running"
            className="flex items-center gap-1.5 text-body-sm font-semibold text-muted-foreground"
          >
            {r.groups.running}
            <Ltr className="text-body-sm tabular-nums">{running.length}</Ltr>
          </h3>
          <ul className="flex flex-col divide-y divide-border">
            {running.map((c) => (
              <li key={c.id} data-wb-run="running" className="flex min-w-0 items-center gap-2.5 py-2">
                <Loader2
                  aria-hidden
                  className="size-4 shrink-0 text-foreground motion-safe:animate-spin"
                  strokeWidth={2}
                />
                <span className="min-w-0 flex-1 text-body font-medium text-foreground">
                  <Bidi>{c.title}</Bidi>
                </span>
                <Tip k="runs:open">
                  <Button size="sm" variant="ghost" onClick={() => onOpenChat(c.id)}>
                    {r.openChat}
                  </Button>
                </Tip>
              </li>
            ))}
          </ul>
        </section>
      )}
      {wb.waiting.length === 0 && running.length === 0 && (
        <p data-wb-runs-empty className="text-body-sm text-muted-foreground">
          {r.empty}
        </p>
      )}
    </div>
  );
}

// ── History ─────────────────────────────────────────────────────────────────────────────────────

export function HistoryList({
  onOpen,
  className,
}: {
  onOpen?: ((id: string) => void) | undefined;
  className?: string | undefined;
}) {
  const t = useT<ChatMessages>('chat').panel;
  const tipWords = useT<ChatMessages>('chat').tips;
  const locale = useLocale();
  const wb = useWb();
  const [q, setQ] = useState('');
  const f = tipWords.facts;
  const when = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const needle = q.trim().toLowerCase();
  const chats = wb.chats.filter((c) => !needle || c.title.toLowerCase().includes(needle));
  const waiting = new Set(wb.waiting.map((w) => w.id));
  const open = (id: string) => {
    openChat(id);
    onOpen?.(id);
  };
  const sorted = [...chats.filter((c) => c.pinned), ...chats.filter((c) => !c.pinned)];
  return (
    <div data-wb-history className={cn('flex flex-col gap-3', className)}>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <Tip k="history:search" align="start">
          <TextInput
            dir="auto"
            data-wb-history-search
            aria-label={t.historyPanel.search}
            placeholder={t.historyPanel.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="ps-8"
          />
        </Tip>
      </div>
      {sorted.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {sorted.map((chat) => {
            const active = chat.id === wb.activeId;
            const needs = waiting.has(chat.id);
            const facts: TipFact[] = [
              [f.device, chat.deviceName],
              [f.folder, chat.folder, true],
              [f.mode, t.pro.modes[chat.mode]],
              [f.started, when.format(new Date(chat.createdAt))],
            ];
            return (
              <li key={chat.id} className="group relative flex min-w-0 items-center gap-1">
                <Tip k="history:row" align="start" facts={facts}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    data-wb-chat={chat.id}
                    onClick={() => open(chat.id)}
                    className={cn(
                      'flex min-h-11 min-w-0 flex-1 flex-col rounded-md px-2 py-1.5 text-start transition-colors duration-120 hover:bg-accent',
                      active && 'bg-accent',
                      focusRing,
                    )}
                  >
                    <span
                      className={cn(
                        'flex min-w-0 max-w-full items-center gap-1 text-body text-foreground',
                        active && 'font-semibold',
                      )}
                    >
                      {chat.pinned && (
                        <>
                          <Pin
                            aria-hidden
                            className="size-3 shrink-0 text-muted-foreground"
                            strokeWidth={2}
                          />
                          <span className="sr-only">{tipWords.items['history:pinned'].what}</span>
                        </>
                      )}
                      <span className="truncate">
                        <Bidi>{chat.title}</Bidi>
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground">
                      {needs && <Hand aria-hidden className="size-3.5 text-warning-strong" strokeWidth={2} />}
                      {chat.running && !needs && (
                        <Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" strokeWidth={2} />
                      )}
                      {needs && <span className="font-medium text-foreground">{t.status.waitingAnswer}</span>}
                      <span>{when.format(new Date(chat.updatedAt))}</span>
                      <span>
                        <bdi>{chat.deviceName}</bdi>
                      </span>
                    </span>
                  </button>
                </Tip>
                <Tip k="history:more">
                  <span className="inline-flex">
                    <RowMenu
                      label={t.more}
                      items={[
                        {
                          label: chat.pinned ? t.pro.menu.unpin : t.pro.menu.pin,
                          icon: chat.pinned ? PinOff : Pin,
                          onSelect: () => togglePin(chat),
                        },
                        {
                          label: t.historyPanel.delete,
                          icon: Trash2,
                          destructive: true,
                          onSelect: () => deleteChat(chat.id, t.historyPanel.deleted),
                        },
                      ]}
                    />
                  </span>
                </Tip>
              </li>
            );
          })}
        </ul>
      )}
      {sorted.length === 0 && (
        <p data-wb-history-empty className="px-2 text-body-sm text-muted-foreground">
          {needle ? t.historyPanel.empty : t.historyPanel.none}
        </p>
      )}
    </div>
  );
}

// ── Empty chat ──────────────────────────────────────────────────────────────────────────────────

export function EmptyChat({
  className,
  measure,
}: {
  className?: string | undefined;
  measure?: string | undefined;
}) {
  const t = useT<ChatMessages>('chat').panel;
  const blocked = engineBlocks(useWb().engine);
  return (
    <div data-wb-empty className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', className)}>
      <div className={cn('mx-auto flex w-full flex-col gap-4 p-3 md:p-4', measure)}>
        <div className="flex flex-col gap-1">
          <h2 className="text-title font-semibold text-foreground">{t.empty.title}</h2>
          <p className="text-body text-muted-foreground">{t.empty.body}</p>
        </div>
        {!blocked && <Suggestions />}
      </div>
    </div>
  );
}

// ── Send to VS Code (docs/16 §8, S1 Q10): honest that the owner presses Enter ───────────────────

/** What this press would send. The bridge is told the same words by the server. */
function usePromptFor(cardKey: string | null) {
  const wb = useMaybeWb();
  const folder = wb?.folderNow ?? '';
  const chat = wb?.chat;
  const title = chat?.title;
  return {
    folder,
    prompt: vscodePrompt({ folder, ...(cardKey ? { cardKey } : {}), ...(title ? { chatTitle: title } : {}) }),
  };
}

export function VsCodeDialog({
  open,
  onOpenChange,
  cardKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardKey?: string | null | undefined;
}) {
  const t = useT<ChatMessages>('chat').panel;
  const kit = useT(kitMessages);
  const wb = useWb();
  const route = useRoute();
  const key = cardKey ?? route.cardKey ?? null;
  const { folder, prompt } = usePromptFor(key);
  const send = useOpenInVsCode();
  const chat = wb.chat;
  const device = wb.device;
  const noBridge = !device || !device.online || !folder;
  const go = () => {
    if (!device || !folder) return;
    send.mutate(
      {
        device: device.id,
        folder,
        ...(key ? { cardKey: key } : {}),
        ...(chat && !key ? { chatId: chat.id } : {}),
      },
      {
        onSuccess: () => {
          showToast({ message: t.vscode.sent });
          onOpenChange(false);
        },
        onError: (error) =>
          showToast({
            tone: 'error',
            message: fmt(t.vscode.failed, { why: isHubError(error) ? error.message : '' }),
          }),
      },
    );
  };
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t.vscode.title}
      description={t.vscode.lead}
      footer={
        <>
          <Button
            data-wb-vscode-copy
            onClick={() => {
              void copyText(prompt);
              showToast({ message: kit.copy.copied });
            }}
          >
            {t.vscode.copy}
          </Button>
          {!noBridge && (
            <Button variant="primary" data-wb-vscode-send busy={send.isPending} onClick={go}>
              {t.vscode.send}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-body-sm font-medium text-muted-foreground">{t.vscode.prompt}</p>
          <p dir="auto" data-wb-vscode-prompt className="rounded-md bg-muted p-2 text-body text-foreground">
            <Bidi>{prompt}</Bidi>
          </p>
        </div>
        {folder && (
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground">
            <span>{t.vscode.folder}</span>
            <Ltr mono className="min-w-0 text-body-sm [overflow-wrap:anywhere]">
              {folder}
            </Ltr>
          </p>
        )}
        {noBridge ? (
          <p data-wb-vscode-nobridge className="text-body-sm text-foreground">
            {folder ? t.vscode.noBridge : t.vscode.noFolder}
          </p>
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

// ── The one bar the card sheet gains ────────────────────────────────────────────────────────────

/** Hub's way to work on this card with Claude. Quiet, ghost buttons: the card's own action stays the one filled button on the sheet. */
export function SheetClaudeBar({ cardKey, onAsk }: { cardKey: string; onAsk?: (() => void) | undefined }) {
  const t = useT<ChatMessages>('chat').panel;
  const tipWords = useT<ChatMessages>('chat').tips;
  const ask = useAsk();
  const wb = useWb();
  const card = useCard(cardKey);
  const [vscode, setVscode] = useState(false);
  const device = wb.deviceName;
  const engineOff = offOf(wb.engine);
  const go = (a: 'explain' | 'plan' | 'redesign') => {
    ask(a, cardKey);
    onAsk?.();
  };
  const isTask = card?.type === 'task';
  const isDoc = card?.type === 'doc';
  const closed = isTask && (card.status === 'done' || card.status === 'cancelled');
  const doOff = engineOff ?? (closed ? 'taskClosed' : card?.status === 'in_review' ? 'taskInReview' : null);
  // One rule: while the panel's empty chat offers these same acts, the sheet does not offer them twice. Blocked, the empty chat shows no suggestions,
  // so the sheet keeps its buttons, disabled with the reason (review M3).
  const panelOffers = wb.activeId === null && !engineOff && !!document.querySelector('[data-wb-panel]');
  const noBridge = !wb.device?.online;
  const skill = (text: string) => {
    void startSkill(text, { card: cardKey });
    onAsk?.();
  };
  return (
    <div
      role="group"
      aria-label={t.claudeBar.label}
      data-wb-sheetbar
      className="flex flex-wrap items-center gap-1"
    >
      <span className="me-1 text-body-sm text-muted-foreground">{t.claudeBar.label}</span>
      {isTask && !panelOffers && (
        <Tip k="sheet:do" off={doOff} vars={{ device }} label={t.pro.sheet.do}>
          <Button
            size="sm"
            variant="ghost"
            data-wb-do
            disabled={!!doOff}
            onClick={() => skill(`/hub:work ${cardKey}`)}
          >
            <ListChecks aria-hidden className="size-3.5" strokeWidth={1.75} />
            {t.pro.sheet.do}
          </Button>
        </Tip>
      )}
      {(isTask || isDoc) && !panelOffers && (
        <Tip
          k="doc:document"
          off={engineOff}
          vars={{ device }}
          label={isDoc ? t.pro.docBar.improve : t.pro.sheet.document}
        >
          <Button
            size="sm"
            variant="ghost"
            data-wb-doc-skill
            disabled={!!engineOff}
            onClick={() => skill(isDoc ? `/hub:doc improve ${cardKey}` : `/hub:doc document ${cardKey}`)}
          >
            <FileText aria-hidden className="size-3.5" strokeWidth={1.75} />
            {isDoc ? t.pro.docBar.improve : t.pro.sheet.document}
          </Button>
        </Tip>
      )}
      {!panelOffers && (
        <Tip k="sheet:explain" off={engineOff} vars={{ device }} label={t.claudeBar.explain}>
          <Button
            size="sm"
            variant="ghost"
            data-wb-explain
            disabled={!!engineOff}
            onClick={() => go('explain')}
          >
            {t.claudeBar.explain}
          </Button>
        </Tip>
      )}
      {!panelOffers && (
        <Tip k="sheet:plan" off={engineOff} vars={{ device }} label={t.claudeBar.plan}>
          <Button
            size="sm"
            variant="ghost"
            data-wb-plan-card
            disabled={!!engineOff}
            onClick={() => go('plan')}
          >
            {t.claudeBar.plan}
          </Button>
        </Tip>
      )}
      {card?.type === 'redesign' && (
        <Tip k="sheet:redesign" off={engineOff} vars={{ device }} label={t.claudeBar.redesign}>
          <Button
            size="sm"
            variant="ghost"
            data-wb-redesign
            disabled={!!engineOff}
            onClick={() => go('redesign')}
          >
            {t.claudeBar.redesign}
          </Button>
        </Tip>
      )}
      <Tip k="sheet:vscode" facts={noBridge ? [[tipWords.facts.device, device]] : undefined}>
        <Button size="sm" variant="ghost" data-wb-vscode onClick={() => setVscode(true)}>
          <Code2 aria-hidden className="size-3.5" strokeWidth={1.75} />
          <span className="max-md:sr-only">{t.vscode.short}</span>
        </Button>
      </Tip>
      <VsCodeDialog open={vscode} onOpenChange={setVscode} cardKey={cardKey} />
    </div>
  );
}
