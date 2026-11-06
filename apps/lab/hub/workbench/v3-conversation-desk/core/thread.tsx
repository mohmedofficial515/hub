import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Ban, Check, ChevronDown, CircleStop, FolderOpen, Loader2, ShieldQuestion, Terminal } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { actionsFor, Bidi, Button, CardKey, CardRow, cn, CopyButton, counted, fill, fmt, focusRing, kitMessages, Ltr, MarkdownView, Pill, RowAction, StatusBadge, useCard, useSession } from './kit';
import { answerApproval, deviceOf, useWb } from './store';
import type { ApprovalRequest, Chat, Item, L, ToolCall } from './mock';
import { wbMessages } from './strings';

const said = (locale: 'ar' | 'en', text: string | L) => (typeof text === 'string' ? text : text[locale]);

/** Cut at a word so a streaming reply never shows half a word. */
function streamed(text: string, shown: number) {
  if (shown >= 1) return text;
  const end = Math.floor(text.length * shown);
  const cut = text.lastIndexOf(' ', end);
  return text.slice(0, cut > 0 ? cut : end);
}

/** The folded line. Folded by default, says what is happening now, and opens to the exact inputs. */
function ToolFold({ calls }: { calls: ToolCall[] }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const running = calls.find((c) => c.state === 'running');
  const stopped = calls.some((c) => c.state === 'stopped');
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        data-wb-tools
        onClick={() => setOpen((v) => !v)}
        title={t.tools.show}
        className={cn('-ms-1.5 inline-flex min-h-9 w-fit max-w-full items-center gap-1.5 rounded-md px-1.5 text-body-sm text-muted-foreground transition-colors duration-120 hover:bg-accent hover:text-foreground max-md:min-h-11', focusRing)}
      >
        {running ? <Loader2 aria-hidden className="size-3.5 shrink-0 motion-safe:animate-spin" strokeWidth={2} /> : <Terminal aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />}
        <span className="truncate">{running ? fill(t.tools.running, { name: <Ltr mono>{running.name}</Ltr> }) : counted(calls.length, locale, t.tools.summary)}</span>
        {stopped && <span>{t.tools.stopped}</span>}
        <ChevronDown aria-hidden className={cn('size-3.5 shrink-0 transition-transform duration-120', open && 'rotate-180')} strokeWidth={1.75} />
      </button>
      {open && (
        <ul className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2">
          {calls.map((c) => (
            <li key={c.id} className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-body-sm">
              <span aria-hidden className="translate-y-0.5 self-start">
                {c.state === 'running' ? <Loader2 className="size-3.5 text-muted-foreground motion-safe:animate-spin" /> : c.state === 'denied' ? <Ban className="size-3.5 text-destructive-soft-foreground" /> : c.state === 'stopped' ? <CircleStop className="size-3.5 text-muted-foreground" /> : <Check className="size-3.5 text-success-soft-foreground" />}
              </span>
              <code dir="ltr" translate="no" className="key min-w-0 font-medium [overflow-wrap:anywhere] text-foreground">
                {c.name}
              </code>
              <code dir="ltr" translate="no" className="key min-w-0 [overflow-wrap:anywhere] text-muted-foreground">
                {c.detail}
              </code>
              {c.result && (
                <span className="text-muted-foreground">
                  <Bidi>{c.result[locale]}</Bidi>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Inline approval: neutral surface, coloured icon only, the exact command, and neither answer pre-chosen. It never takes focus by itself. */
export function ApprovalPrompt({ chatId, request }: { chatId: string; request: ApprovalRequest }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const a = t.approval;
  const answered = request.state !== 'pending';
  const added = request.diff ? request.diff.after.filter((p) => !request.diff!.before.includes(p)) : [];
  return (
    <section aria-label={a.title} data-wb-approval className="@container flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:p-4">
      <header className="flex items-start gap-2.5">
        <ShieldQuestion aria-hidden className={cn('mt-0.5 size-5 shrink-0', answered ? 'text-muted-foreground' : 'text-warning-strong')} strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <h3 className="text-body-lg font-semibold text-foreground">{a.title}</h3>
          <p className="text-body-sm text-muted-foreground">{request.why[locale]}</p>
        </div>
      </header>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-body-sm text-muted-foreground">
          <span>{a.command}</span>
          <span className="inline-flex items-center gap-1">
            <FolderOpen aria-hidden className="size-3.5" strokeWidth={1.75} />
            <Ltr mono className="text-body-sm">
              {request.folder}
            </Ltr>
          </span>
        </div>
        <div className="flex items-start gap-1 rounded-md bg-muted p-2">
          <code dir="ltr" translate="no" className="key min-w-0 flex-1 text-start text-body font-medium [overflow-wrap:anywhere] text-foreground">
            {request.command}
          </code>
          {!answered && <CopyButton text={request.command} showText={false} label={a.copy} className="shrink-0" />}
        </div>
      </div>
      {request.diff && (
        <dl className="grid gap-2 text-body-sm @lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-muted-foreground">{a.before}</dt>
            {request.diff.before.map((p) => (
              <dd key={p} className="min-w-0 break-all">
                <Ltr mono className="text-body-sm text-foreground">
                  {p}
                </Ltr>
              </dd>
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-muted-foreground">{a.after}</dt>
            {request.diff.after.map((p) => (
              <dd key={p} className="flex min-w-0 flex-wrap items-center gap-1.5 break-all">
                <Ltr mono className={cn('text-body-sm', added.includes(p) ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                  {p}
                </Ltr>
                {added.includes(p) && <Pill tone="warning">{a.added}</Pill>}
              </dd>
            ))}
          </div>
        </dl>
      )}
      <p className="text-body-sm text-foreground">{request.effect[locale]}</p>
      {answered ? (
        <p role="status" className="inline-flex items-center gap-1.5 text-body-sm font-medium text-foreground">
          {request.state === 'allowed' ? <Check aria-hidden className="size-4 text-success-soft-foreground" /> : <Ban aria-hidden className="size-4 text-muted-foreground" />}
          {request.state === 'allowed' ? a.allowed : request.state === 'denied' ? a.denied : a.cancelled}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {/* Equal weight on purpose: the page does not lean towards either answer on a sensitive action. */}
            <Button data-wb-allow onClick={() => answerApproval(chatId, request, true)}>
              {a.allow}
            </Button>
            <Button data-wb-deny onClick={() => answerApproval(chatId, request, false)}>
              {a.deny}
            </Button>
          </div>
          <p className="text-body-sm text-muted-foreground">
            {fmt(a.expires, { time: request.expires })}. {a.devices}.
          </p>
        </>
      )}
    </section>
  );
}

/** A card Claude made is a real Hub card: it reads the store, so its status follows what happens to it on any page. */
function LiveCard({ cardKey }: { cardKey: string }) {
  const t = useT(wbMessages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const card = useCard(cardKey);
  const { roles, me } = useSession();
  if (!card) return null;
  const action = actionsFor(card, roles, me.id)[0];
  return (
    <div data-wb-created className="overflow-hidden rounded-lg border border-border">
      <CardRow
        cardKey={card.key}
        type={card.type}
        title={card.title[locale]}
        priority={card.priority}
        variant="flush"
        meta={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <StatusBadge status={card.status} />
            <span className="text-body-sm text-muted-foreground">{t.card.made}</span>
            {card.archivedAt && <span className="text-body-sm text-muted-foreground">{kit.sheet.archive}</span>}
          </span>
        }
        action={action && !card.archivedAt ? <RowAction card={card} action={action.action} size="sm" /> : undefined}
      />
    </div>
  );
}

function Notice({ item }: { item: Extract<Item, { kind: 'notice' }> }) {
  const locale = useLocale();
  const Icon = item.tone === 'stopped' ? CircleStop : item.tone === 'denied' ? Ban : AlertTriangle;
  return (
    <p role="status" className="flex items-start gap-2 text-body-sm text-muted-foreground">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <span>{item.text[locale]}</span>
    </p>
  );
}

function UserLine({ item }: { item: Extract<Item, { kind: 'user' }> }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2">
      <p className="text-body text-foreground">
        <Bidi>{said(locale, item.text)}</Bidi>
      </p>
      {item.context && (item.context.cardKey || item.context.view) && (
        <p className="flex flex-wrap items-center gap-1.5 text-body-sm text-muted-foreground">
          <span>{t.context.sent}</span>
          {item.context.more?.map((k) => <CardKey key={k} k={k} link className="text-body-sm" />)}
          {item.context.cardKey ? (
            <CardKey k={item.context.cardKey} link className="text-body-sm" />
          ) : (
            <span>{item.context.view}</span>
          )}
        </p>
      )}
    </div>
  );
}

/** Starting says why it takes a while: S1 measured 8 to 10 s before anything arrives on a new process. */
function StatusLine({ chat }: { chat: Chat }) {
  const t = useT(wbMessages);
  if (chat.status === 'idle' || chat.status === 'stopped' || chat.status === 'streaming' || chat.status === 'tool' || chat.status === 'waiting') return null;
  const label =
    chat.status === 'starting' ? (
      fill(t.status.starting, {
        folder: (
          <Ltr mono className="text-body-sm">
            {chat.folder}
          </Ltr>
        ),
      })
    ) : (
      t.status.thinking
    );
  return (
    <div role="status" className="flex flex-col gap-0.5">
      <p className="inline-flex items-center gap-1.5 text-body-sm font-medium text-muted-foreground">
        <Loader2 aria-hidden className="size-3.5 shrink-0 motion-safe:animate-spin" strokeWidth={2} />
        <span>{label}</span>
      </p>
      {chat.status === 'starting' && <p className="text-body-sm text-muted-foreground">{t.status.startingNote}</p>}
    </div>
  );
}

/** The transcript. It follows the bottom while the owner is at the bottom, and stops following when they scroll up. */
export function Thread({ chat, className, measure }: { chat: Chat; className?: string; measure?: string }) {
  const locale = useLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const shownTotal = useMemo(() => chat.items.reduce((n, it) => n + (it.kind === 'text' ? it.shown : it.kind === 'tools' ? it.calls.length : 1), 0), [chat.items]);

  useEffect(() => {
    pinned.current = true;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.id]);
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [shownTotal, chat.status]);
  // Late fonts and a resized pane change the height with no new message: stay at the bottom through those too.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={scroller}
      data-wb-scroller
      tabIndex={0}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', className)}
    >
      <div role="log" aria-label={chat.title[locale]} className={cn('mx-auto flex w-full flex-col gap-3 p-3 md:p-4', measure)}>
        {chat.items.map((item) => {
          switch (item.kind) {
            case 'user':
              return <UserLine key={item.id} item={item} />;
            case 'text':
              return (
                <div key={item.id} data-wb-reply className="wb-prose min-w-0 text-body text-foreground">
                  <MarkdownView source={streamed(item.text[locale], item.shown)} dir={dir} headingOffset={2} />
                </div>
              );
            case 'tools':
              return <ToolFold key={item.id} calls={item.calls} />;
            case 'approval':
              return <ApprovalPrompt key={item.id} chatId={chat.id} request={item.request} />;
            case 'card':
              return <LiveCard key={item.id} cardKey={item.cardKey} />;
            case 'notice':
              return <Notice key={item.id} item={item} />;
          }
        })}
        <StatusLine chat={chat} />
      </div>
    </div>
  );
}

/** Small words for a chat's state, used by whichever list shows the chat. */
export function useChatState(chat: Chat) {
  const t = useT(wbMessages);
  const pending = chat.items.some((it) => it.kind === 'approval' && it.request.state === 'pending');
  if (pending) return { label: t.status.waiting, tone: 'needs' as const };
  if (chat.status === 'stopped') return { label: t.status.stopped, tone: 'quiet' as const };
  if (chat.status === 'idle') return { label: '', tone: 'quiet' as const };
  return { label: t.status[chat.status], tone: 'busy' as const };
}

export const useDeviceName = () => {
  const wb = useWb();
  const locale = useLocale();
  return deviceOf(wb.device).name[locale];
};
