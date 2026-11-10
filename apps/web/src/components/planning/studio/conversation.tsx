'use client';

/**
 * @file conversation.tsx
 * @description A studio's own conversation, for the Idea Studio and the Plan Studio alike. It reads the same chat items as the panel's thread, and shows them
 * for a studio: the owner's first words as a card, Claude's steps in plain words grouped by where it looked (Hub, the code, the web), each new report with
 * what changed since the last one, and a head that always says what Claude is doing right now and for how long. A request written while Claude works waits
 * in line and goes when the turn ends. Approvals and questions are the panel's own components, so they behave the same.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  Clock3,
  Code2,
  FileSearch,
  FileText,
  Globe,
  Layers,
  Lightbulb,
  ListOrdered,
  Loader2,
  type LucideIcon,
  Maximize2,
  MessageSquareReply,
  Minimize2,
  Route,
  Search,
  Sparkles,
  Square,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import {
  Bidi,
  CardChip,
  cn,
  detectSecret,
  fmt,
  focusRing,
  IconButton,
  MarkdownView,
  num,
  plural,
  SecretFilterError,
  useLocale,
  useT,
} from '@/components/kit';
import { ModelPicker } from '@/components/workbench/composer';
import { Blocked, QuestionCard, QuestionDock } from '@/components/workbench/protocol';
import {
  chatIsBusy,
  engineBlocks,
  type Item,
  type PanelChat,
  stopTurn,
  type Wb,
} from '@/components/workbench/store';
import { ApprovalPrompt } from '@/components/workbench/thread';
import type { ChatMessages } from '@/components/workbench/words';
import { runningMessage } from '@/features/chat/live';
import type { ToolCall } from '@/features/chat/thread-items';
import { type Act, actOf, isPlumbing, type Where } from '@/features/planning/studio-acts';

import type { PlanningMessages } from '../messages';

type Words = PlanningMessages['studio'];
type ChatWords = Words['chat'];

const WHERE_ICON: Record<Where, LucideIcon> = {
  hub: Layers,
  code: Code2,
  web: Globe,
  report: ListOrdered,
  other: Wrench,
};

const callAct = (call: ToolCall): Act => actOf(call.name, call.input);

/** A step's seconds: one decimal under ten, whole seconds after. */
const seconds = (ms: number, locale: 'ar' | 'en') =>
  ms >= 10_000 ? num(Math.round(ms / 1000), locale) : num(Math.max(0.1, Math.round(ms / 100) / 10), locale);

export function clock(totalSec: number, locale: 'ar' | 'en') {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${num(m, locale)}:${num(s, locale).padStart(2, num(0, locale))}`;
}

/** Seconds since `from`, ticking while `running`. */
function useElapsed(from: string | null | undefined, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  if (!from) return 0;
  return Math.max(0, Math.floor((now - Date.parse(from)) / 1000));
}

// ── The conversation ──────────────────────────────────────────────────────────────────────────────

export type ConversationWidth = 'normal' | 'wide';

/** What differs between the studios: how a report shows in the thread, how the owner's first words are named, and the quick prompts. */
export interface StudioKind {
  /** The owner's first message, without the skill's command. */
  firstWords: (text: string) => string;
  firstLabel: string;
  firstIcon: LucideIcon;
  /** The card type's colour the first words wear. */
  tone: 'idea' | 'plan';
  refine: readonly { label: string; prompt: string }[];
  /** A report item, or null when the item is not this studio's report. */
  report: (item: Item, ctx: { before: Item | null; latest: boolean; onShow: () => void }) => ReactNode | null;
  isReport: (item: Item) => boolean;
  placeholder: string;
  /** The words the report's questions send before the answers, to show them back as answers. */
  answersPrompt?: string;
  /** The template an Apply button sends, with `{title}`, to show it back as the suggestion's name. */
  applyPrompt?: string;
}

export function StudioConversation({
  wb,
  chat,
  kind,
  inputRef,
  width,
  onWidth,
  onShowReport,
  queued,
  onSend,
  onCancelQueued,
  className,
}: {
  wb: Wb;
  chat: PanelChat;
  kind: StudioKind;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  width?: ConversationWidth | undefined;
  onWidth?: ((w: ConversationWidth) => void) | undefined;
  onShowReport: () => void;
  /** A request waiting for the running turn to end. */
  queued: string | null;
  /** Sends now, or waits in line while Claude works. */
  onSend: (text: string) => Promise<boolean>;
  onCancelQueued: () => void;
  className?: string | undefined;
}) {
  const w = useT<PlanningMessages>('planning').studio;
  const c = w.chat;
  const busy = chatIsBusy(chat.status);

  return (
    <aside
      aria-labelledby="studio-conversation"
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm',
        className,
      )}
    >
      <Head chat={chat} busy={busy} width={width} onWidth={onWidth} words={c} />
      <Transcript chat={chat} busy={busy} kind={kind} words={w} onShowReport={onShowReport} />
      <QuestionDock chat={chat} />
      <Composer
        wb={wb}
        chat={chat}
        busy={busy}
        kind={kind}
        inputRef={inputRef}
        words={w}
        queued={queued}
        onSend={onSend}
        onCancelQueued={onCancelQueued}
      />
    </aside>
  );
}

// ── Head: what Claude is doing now ────────────────────────────────────────────────────────────────

function runningCalls(chat: PanelChat): ToolCall[] {
  const lastTools = [...chat.items].reverse().find((i) => i.kind === 'tools');
  return lastTools?.kind === 'tools'
    ? lastTools.calls.filter((call) => call.state === 'running' && !isPlumbing(call.name))
    : [];
}

export function nowLine(chat: PanelChat, c: ChatWords): { text: string; subject?: string; more: number } {
  const running = runningCalls(chat);
  const first = running[0];
  if (first) {
    const act = callAct(first);
    return {
      text: c.acts[act.key][0] ?? '',
      ...(act.subject ? { subject: act.subject } : {}),
      more: running.length - 1,
    };
  }
  const status =
    chat.status === 'starting'
      ? c.status.starting
      : chat.status === 'retrying'
        ? c.status.retrying
        : chat.status === 'waiting'
          ? c.status.waiting
          : chat.status === 'streaming'
            ? c.status.writing
            : c.status.thinking;
  return { text: status, more: 0 };
}

/** The steps a turn took that are research, not plumbing. The head, the groups and the turn's last line all count the same steps. */
export const researchSteps = (steps: readonly { name: string }[]) =>
  steps.filter((s) => !isPlumbing(s.name)).length;

function Head({
  chat,
  busy,
  width,
  onWidth,
  words: c,
}: {
  chat: PanelChat;
  busy: boolean;
  width?: ConversationWidth | undefined;
  onWidth?: ((w: ConversationWidth) => void) | undefined;
  words: ChatWords;
}) {
  const locale = useLocale();
  const running = busy ? runningMessage(chat.raw) : null;
  const elapsed = useElapsed(running?.createdAt, busy);
  const steps = researchSteps(running?.steps ?? []);
  const lastTurn = [...chat.items].reverse().find((i) => i.kind === 'turn');
  const lastMessage =
    lastTurn?.kind === 'turn' ? chat.raw.messages.find((m) => m.id === lastTurn.messageId) : null;
  const now = busy ? nowLine(chat, c) : null;

  return (
    <div className="relative flex flex-col gap-2 border-b border-border px-3.5 py-3">
      {busy && (
        <span
          aria-hidden
          className="studio-progress pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-primary/10"
        />
      )}
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'relative flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary',
            busy && 'studio-glow',
          )}
        >
          <Sparkles className="size-4" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id="studio-conversation" className="text-body-sm font-semibold text-foreground">
            {c.title}
          </h2>
          <p className="flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
            {busy ? (
              <>
                <span aria-hidden className="relative flex size-1.5 shrink-0">
                  <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                </span>
                <span className="shrink-0 font-medium text-primary">{now?.text}</span>
                {now?.subject && (
                  <span
                    dir="auto"
                    className="min-w-0 truncate font-mono text-foreground/80"
                    title={now.subject}
                  >
                    {now.subject}
                  </span>
                )}
                {!!now?.more && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 font-medium text-primary tabular-nums">
                    {fmt(c.more, { n: num(now.more, locale) })}
                  </span>
                )}
              </>
            ) : lastTurn?.kind === 'turn' ? (
              <span className="truncate">
                {fmt(c.idleLine, {
                  time: clock(Math.round((lastTurn.meta.ms ?? 0) / 1000), locale),
                  steps: plural(researchSteps(lastMessage?.steps ?? []), locale, c.stepCount),
                })}
              </span>
            ) : (
              <span>{c.ready}</span>
            )}
          </p>
          {/* One calm announcement per change of act: the line above changes its subject too often to be read aloud. */}
          <span role="status" className="sr-only">
            {busy ? now?.text : c.ready}
          </span>
        </div>
        {busy && (
          <span className="flex shrink-0 flex-col items-end gap-0.5 text-caption tabular-nums">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Clock3 aria-hidden className="size-3 text-muted-foreground" strokeWidth={2} />
              {clock(elapsed, locale)}
            </span>
            <span className="text-muted-foreground">{plural(steps, locale, c.stepCount)}</span>
          </span>
        )}
        {onWidth && (
          <IconButton
            label={width === 'wide' ? c.narrow : c.widen}
            onClick={() => onWidth(width === 'wide' ? 'normal' : 'wide')}
            className="max-xl:hidden md:size-8"
          >
            {width === 'wide' ? (
              <Minimize2 aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
            ) : (
              <Maximize2 aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
            )}
          </IconButton>
        )}
      </div>
    </div>
  );
}

// ── The transcript ───────────────────────────────────────────────────────────────────────────────

function Transcript({
  chat,
  busy,
  kind,
  words: w,
  onShowReport,
}: {
  chat: PanelChat;
  busy: boolean;
  kind: StudioKind;
  words: Words;
  onShowReport: () => void;
}) {
  const c = w.chat;
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [away, setAway] = useState(false);
  const reduce = useReducedMotion();
  const size = useMemo(
    () =>
      chat.items.reduce(
        (n, it) => n + (it.kind === 'text' ? it.text.length : it.kind === 'tools' ? it.calls.length : 1),
        0,
      ),
    [chat.items],
  );

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (pinned.current) el.scrollTop = el.scrollHeight;
    else setAway(true);
  }, [size, chat.status]);
  useEffect(() => {
    pinned.current = true;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.id]);

  // A tab that was hidden, a wider pane or a late font changes the height with no new message: stay at the bottom through those too.
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

  const toBottom = () => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
    pinned.current = true;
    setAway(false);
  };

  // Each report is compared with the one before it, so the card can say what changed.
  const reports = chat.items.filter(kind.isReport);
  let firstUser = true;
  const lastIndex = chat.items.length - 1;
  const quick = new Map(kind.refine.map((r) => [r.prompt.trim(), r.label]));

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (pinned.current) setAway(false);
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <div role="log" aria-label={c.title} className="flex flex-col gap-3 p-3.5">
          {chat.items.map((item, index) => {
            if (kind.isReport(item)) {
              const at = reports.indexOf(item);
              return (
                <ReportSlot key={item.id}>
                  {kind.report(item, {
                    before: at > 0 ? reports[at - 1]! : null,
                    latest: at === reports.length - 1,
                    onShow: onShowReport,
                  })}
                </ReportSlot>
              );
            }
            switch (item.kind) {
              case 'user': {
                const first = firstUser;
                firstUser = false;
                if (first) {
                  return (
                    <FirstBubble
                      key={item.id}
                      text={kind.firstWords(item.text)}
                      label={kind.firstLabel}
                      icon={kind.firstIcon}
                      tone={kind.tone}
                    />
                  );
                }
                const label = quick.get(item.text.trim());
                if (label) return <OwnerBubble key={item.id} text={label} quick />;
                const answers = answersOf(item.text, kind.answersPrompt);
                if (answers) return <AnswersBubble key={item.id} answers={answers} label={c.answersSent} />;
                const applied = appliedOf(item.text, kind.applyPrompt);
                if (applied)
                  return <OwnerBubble key={item.id} text={fmt(c.applied, { title: applied })} quick />;
                return <OwnerBubble key={item.id} text={item.text} quick={false} />;
              }
              case 'text':
                return (
                  <Reply key={item.id}>
                    <MarkdownView source={item.text} dir="auto" headingOffset={3} />
                  </Reply>
                );
              case 'plan':
                // A plan Claude wrote as words, in a studio that expected a report: shown, never lost.
                return (
                  <Reply key={item.id}>
                    <MarkdownView source={item.text} dir="auto" headingOffset={3} />
                  </Reply>
                );
              case 'tools':
                return (
                  <Activity key={item.id} calls={item.calls} live={busy && index === lastIndex} words={c} />
                );
              case 'approval':
                return (
                  <ApprovalPrompt
                    key={item.id}
                    chatId={chat.id}
                    request={item.request}
                    stoppedBy={item.stoppedBy}
                    folder={chat.folder}
                  />
                );
              case 'question':
                return item.question.status === 'pending' ? null : (
                  <QuestionCard key={item.id} chatId={chat.id} item={item} />
                );
              case 'blocked':
                return <Blocked key={item.id} chatId={chat.id} item={item} />;
              case 'card':
                return (
                  <div key={item.id} className="ms-8">
                    <CardChip k={item.cardKey} />
                  </div>
                );
              case 'turn': {
                const message = chat.raw.messages.find((m) => m.id === item.messageId);
                return (
                  <TurnRule
                    key={item.id}
                    meta={item.meta}
                    steps={researchSteps(message?.steps ?? [])}
                    words={c}
                  />
                );
              }
              default:
                return null;
            }
          })}
          {busy && chat.items.at(-1)?.kind !== 'tools' && <Thinking label={nowLine(chat, c).text} />}
        </div>
      </div>
      <AnimatePresence>
        {away && (
          <motion.button
            type="button"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            onClick={toBottom}
            className={cn(
              'absolute inset-x-0 bottom-2 mx-auto inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-border bg-card px-3 text-caption font-medium text-foreground shadow-md hover:bg-accent',
              focusRing,
            )}
          >
            <ArrowDown aria-hidden className="size-3.5" strokeWidth={2} />
            {busy ? c.latestLive : c.latest}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReportSlot({ children }: { children: ReactNode }) {
  return <div className="animate-rise ms-8 min-w-0">{children}</div>;
}

function FirstBubble({
  text,
  label,
  icon: Icon,
  tone,
}: {
  text: string;
  label: string;
  icon: LucideIcon;
  tone: 'idea' | 'plan';
}) {
  return (
    <div
      className={cn(
        'animate-rise flex flex-col gap-1.5 rounded-2xl border p-3',
        tone === 'idea'
          ? 'border-type-idea/30 bg-type-idea-soft/50'
          : 'border-type-plan/30 bg-type-plan-soft/50',
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1.5 text-caption font-semibold',
          tone === 'idea' ? 'text-type-idea-fg' : 'text-type-plan-fg',
        )}
      >
        <Icon aria-hidden className="size-3.5" strokeWidth={1.75} />
        {label}
      </span>
      <p className="text-body-sm whitespace-pre-wrap text-foreground">
        <Bidi>{text}</Bidi>
      </p>
    </div>
  );
}

/** The answers the report's questions sent, read back from the message: each question with its answer. */
export function answersOf(text: string, prompt?: string): { q: string; a: string }[] | null {
  if (!prompt || !text.startsWith(prompt)) return null;
  const out: { q: string; a: string }[] = [];
  for (const block of text.slice(prompt.length).split(/\n- /)) {
    const [q, a] = block.replace(/^\s*-\s*/, '').split(/\n\s*→\s*/);
    if (q?.trim() && a?.trim()) out.push({ q: q.trim(), a: a.trim() });
  }
  return out.length ? out : null;
}

/** The suggestion an Apply button sent, read back from the message by its template. */
export function appliedOf(text: string, template?: string): string | null {
  if (!template || !template.includes('{title}')) return null;
  const [before = '', after = ''] = template.split('{title}');
  if (!text.startsWith(before) || !text.endsWith(after)) return null;
  const title = text.slice(before.length, text.length - after.length);
  return title.trim() || null;
}

function AnswersBubble({ answers, label }: { answers: { q: string; a: string }[]; label: string }) {
  return (
    <div className="animate-rise ms-auto flex max-w-[92%] flex-col gap-2 rounded-2xl rounded-se-md bg-primary px-3 py-2.5 text-body-sm text-primary-foreground shadow-sm">
      <span className="flex items-center gap-1.5 text-caption font-semibold opacity-90">
        <MessageSquareReply aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
        {label}
      </span>
      <dl className="flex flex-col gap-1.5">
        {answers.map(({ q, a }) => (
          <div key={q} className="flex flex-col gap-0.5 rounded-lg bg-primary-foreground/10 px-2 py-1.5">
            <dt className="text-caption opacity-80">
              <Bidi>{q}</Bidi>
            </dt>
            <dd className="font-medium">
              <Bidi>{a}</Bidi>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The owner's words. A quick prompt shows as the button's own name, not the instruction it carries to Claude. */
function OwnerBubble({ text, quick }: { text: string; quick: boolean }) {
  return (
    <div className="animate-rise ms-auto inline-flex max-w-[88%] items-start gap-1.5 rounded-2xl rounded-se-md bg-primary px-3 py-2 text-body-sm whitespace-pre-wrap text-primary-foreground shadow-sm">
      {quick && <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0 opacity-80" strokeWidth={1.75} />}
      <span className="min-w-0">
        <Bidi>{text}</Bidi>
      </span>
    </div>
  );
}

function Reply({ children }: { children: ReactNode }) {
  return (
    <div className="animate-rise flex min-w-0 gap-2">
      <span
        aria-hidden
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <Sparkles className="size-3.5" strokeWidth={1.75} />
      </span>
      <div className="wb-prose min-w-0 flex-1 text-body-sm leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

function Thinking({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 ps-8 text-caption text-muted-foreground">
      <span aria-hidden className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-primary/60 motion-safe:animate-bounce"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}

// ── Steps, grouped by where Claude looked ────────────────────────────────────────────────────────

function StateMark({ state }: { state: ToolCall['state'] }) {
  if (state === 'running')
    return <Loader2 aria-hidden className="size-3.5 shrink-0 text-primary motion-safe:animate-spin" />;
  if (state === 'ok')
    return <CheckCircle2 aria-hidden className="size-3.5 shrink-0 text-success" strokeWidth={2} />;
  if (state === 'denied' || state === 'stopped')
    return <CircleSlash aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />;
  return <XCircle aria-hidden className="size-3.5 shrink-0 text-destructive" strokeWidth={2} />;
}

/** While a group runs it shows its latest steps, so a long search does not push the conversation away; the rest is one click. */
const LIVE_TAIL = 6;

function Activity({ calls, live, words: c }: { calls: ToolCall[]; live: boolean; words: ChatWords }) {
  const locale = useLocale();
  const shown = calls.filter((call) => !isPlumbing(call.name));
  const [open, setOpen] = useState(live);
  const [all, setAll] = useState(false);
  // Open while Claude works in it, folded once it is done: the steps are there for whoever wants them.
  useEffect(() => setOpen(live), [live]);
  if (shown.length === 0) return null;
  const acts = shown.map((call) => ({ call, act: callAct(call) }));
  const count = (where: Where) => acts.filter((a) => a.act.where === where).length;
  const failed = shown.filter((call) => call.state === 'failed').length;
  const totalMs = shown.reduce((sum, call) => sum + (call.ms ?? 0), 0);
  const hidden = live && !all ? Math.max(0, acts.length - LIVE_TAIL) : 0;
  const rows = hidden ? acts.slice(-LIVE_TAIL) : acts;

  return (
    <div
      className={cn(
        'animate-rise ms-8 flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background transition-colors',
        live ? 'border-primary/30' : 'border-border',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn('flex min-w-0 items-center gap-2 px-3 py-2 text-start hover:bg-accent/60', focusRing)}
      >
        {live ? (
          <Loader2 aria-hidden className="size-3.5 shrink-0 text-primary motion-safe:animate-spin" />
        ) : (
          <Search aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        )}
        <span className="shrink-0 text-caption font-semibold text-foreground">
          {live
            ? fmt(c.workingOn, { steps: plural(shown.length, locale, c.stepCount) })
            : plural(shown.length, locale, c.stepCount)}
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {(['hub', 'code', 'web'] as const)
            .filter((where) => count(where) > 0)
            .map((where) => {
              const Icon = WHERE_ICON[where];
              return (
                <span
                  key={where}
                  className="inline-flex h-5 items-center gap-1 rounded-full bg-muted px-1.5 text-caption text-muted-foreground tabular-nums"
                >
                  <Icon aria-hidden className="size-3" strokeWidth={1.75} />
                  {c.where[where]} {num(count(where), locale)}
                </span>
              );
            })}
          {failed > 0 && (
            <span className="inline-flex h-5 items-center rounded-full bg-destructive-soft px-1.5 text-caption text-destructive-soft-foreground tabular-nums">
              {fmt(c.failed, { n: num(failed, locale) })}
            </span>
          )}
        </span>
        {!live && totalMs > 0 && (
          <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
            {fmt(c.seconds, { n: seconds(totalMs, locale) })}
          </span>
        )}
        <ChevronDown
          aria-hidden
          className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <ol className="flex flex-col border-t border-border/70 py-1">
          {hidden > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setAll(true)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-start text-caption font-medium text-primary hover:bg-accent/60',
                  focusRing,
                )}
              >
                <ChevronDown aria-hidden className="size-3.5 rotate-180" />
                {fmt(c.earlier, { n: num(hidden, locale) })}
              </button>
            </li>
          )}
          {rows.map(({ call, act }) => (
            <ActRow key={call.id} call={call} act={act} words={c} />
          ))}
        </ol>
      )}
    </div>
  );
}

function ActRow({ call, act, words: c }: { call: ToolCall; act: Act; words: ChatWords }) {
  const locale = useLocale();
  const Icon =
    act.key === 'read'
      ? FileText
      : act.key === 'doc' || act.key === 'docs'
        ? BookOpen
        : act.key === 'grep'
          ? FileSearch
          : WHERE_ICON[act.where];
  const running = call.state === 'running';
  const verb = c.acts[act.key][running ? 0 : 1] ?? '';
  const subject = act.subject;
  const mono = act.where === 'code' || act.key === 'card' || act.key === 'doc';
  return (
    <li
      className={cn(
        'relative flex min-w-0 items-center gap-2 px-3 py-1.5 text-caption',
        running && 'studio-shimmer bg-primary/5',
      )}
      title={call.error ?? undefined}
    >
      <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <span className={cn('shrink-0', running ? 'font-medium text-primary' : 'text-muted-foreground')}>
        {verb}
      </span>
      {subject &&
        (act.href ? (
          <a
            href={act.href}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className={cn('min-w-0 truncate font-mono text-primary hover:underline', focusRing)}
          >
            {subject}
          </a>
        ) : (
          <span
            dir="auto"
            className={cn(
              'min-w-0 flex-1 truncate rounded px-1 text-foreground',
              mono ? 'bg-muted/60 font-mono' : '',
            )}
            title={subject}
          >
            {act.key === 'search' ? `«${subject}»` : subject}
          </span>
        ))}
      <span className="ms-auto flex shrink-0 items-center gap-1.5">
        {call.ms !== undefined && !running && (
          <span className="text-muted-foreground/80 tabular-nums">
            {fmt(c.seconds, { n: seconds(call.ms, locale) })}
          </span>
        )}
        <StateMark state={call.state} />
      </span>
    </li>
  );
}

// ── A report in the thread, and what changed since the last ──────────────────────────────────────

/** One report in the thread: its verdict line, its title, what changed, and the way to it. Each studio fills it with its own report's facts. */
export function ReportNote({
  icon: Icon = ListOrdered,
  updated,
  badge,
  badgeTone,
  title,
  changes,
  latest,
  onShow,
  words,
}: {
  icon?: LucideIcon;
  /** How this studio names a first report and a new version of it. */
  words?: { ready: string; updated: string };
  updated: boolean;
  badge: string;
  badgeTone: string;
  title: string;
  changes: string[];
  latest: boolean;
  onShow: () => void;
}) {
  const c = useT<PlanningMessages>('planning').studio.chat;
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-xl border p-3',
        latest ? 'border-primary/30 bg-primary/5' : 'border-border bg-background opacity-80',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon aria-hidden className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
        <span className="text-caption font-semibold text-foreground">
          {updated ? (words?.updated ?? c.updated) : (words?.ready ?? c.ready2)}
        </span>
        <span
          className={cn(
            'ms-auto inline-flex h-5 shrink-0 items-center rounded-full px-2 text-caption font-semibold',
            badgeTone,
          )}
        >
          {badge}
        </span>
      </div>
      <p className="text-body-sm font-medium text-pretty text-foreground">
        <Bidi>{title}</Bidi>
      </p>
      {changes.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {changes.map((ch) => (
            <li
              key={ch}
              className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-caption text-muted-foreground tabular-nums"
            >
              {ch}
            </li>
          ))}
        </ul>
      )}
      {latest && (
        <button
          type="button"
          onClick={onShow}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 self-start rounded-lg border border-border bg-card px-2.5 text-caption font-medium text-foreground hover:bg-accent max-md:h-10',
            focusRing,
          )}
        >
          <ArrowUp aria-hidden className="size-3.5" strokeWidth={2} />
          {c.showReport}
        </button>
      )}
    </div>
  );
}

/** A signed count of what changed between two reports, isolated so its sign reads right in either direction. */
export function signed(a: number, b: number, locale: 'ar' | 'en') {
  return `⁦${b > a ? '+' : '−'}${num(Math.abs(b - a), locale)}⁩`;
}

export const STUDIO_ICONS = { idea: Lightbulb, plan: Route } as const;

function TurnRule({
  meta,
  steps,
  words: c,
}: {
  meta: Extract<Item, { kind: 'turn' }>['meta'];
  steps: number;
  words: ChatWords;
}) {
  const locale = useLocale();
  const engine = useT<ChatMessages>('chat').panel.engine;
  const ok = meta.state === 'done';
  const failed = meta.state === 'failed';
  const reason = meta.failure ? engine.turnFailures[meta.failure] : null;
  const line = fmt(c.turnEnd[ok ? 'done' : failed ? 'failed' : 'stopped'], {
    time: clock(Math.round((meta.ms ?? 0) / 1000), locale),
    steps: plural(steps, locale, c.stepCount),
  });
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div className="flex items-center gap-2 text-caption text-muted-foreground" role="separator">
        <span className="h-px flex-1 bg-border" />
        {ok ? (
          <CheckCircle2 aria-hidden className="size-3.5 text-success" strokeWidth={2} />
        ) : (
          <XCircle
            aria-hidden
            className={cn('size-3.5', failed ? 'text-destructive' : 'text-warning-strong')}
            strokeWidth={2}
          />
        )}
        <span className="tabular-nums">{line}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      {!ok && (reason || meta.failureMessage) && (
        <p className="mx-auto max-w-[90%] rounded-lg bg-destructive-soft/60 px-2.5 py-1.5 text-center text-caption text-destructive-soft-foreground">
          {reason && <span className="font-semibold">{reason}</span>}
          {reason && meta.failureMessage && ' · '}
          {meta.failureMessage && <Bidi>{meta.failureMessage}</Bidi>}
        </p>
      )}
    </div>
  );
}

// ── The box to refine the report ─────────────────────────────────────────────────────────────────

function Composer({
  wb,
  chat,
  busy,
  kind,
  inputRef,
  words: w,
  queued,
  onSend,
  onCancelQueued,
}: {
  wb: Wb;
  chat: PanelChat;
  busy: boolean;
  kind: StudioKind;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  words: Words;
  queued: string | null;
  onSend: (text: string) => Promise<boolean>;
  onCancelQueued: () => void;
}) {
  const c = w.chat;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const off = engineBlocks(wb.engine);
  const secret = detectSecret(text);
  const quickLabel = queued ? kind.refine.find((r) => r.prompt === queued)?.label : undefined;

  const grow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  };
  useEffect(() => grow(inputRef.current), [text, inputRef]);

  const submit = async (words = text) => {
    const clean = words.trim();
    if (!clean || sending || secret || off || (busy && queued)) return;
    setSending(true);
    const sent = await onSend(clean);
    setSending(false);
    if (sent && words === text) setText('');
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-card/80 p-3 backdrop-blur">
      <AnimatePresence initial={false}>
        {queued && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1.5 text-caption">
              <Clock3 aria-hidden className="size-3.5 shrink-0 text-primary" strokeWidth={2} />
              <span className="shrink-0 font-medium text-primary">{c.queued}</span>
              <span dir="auto" className="min-w-0 flex-1 truncate text-foreground" title={queued}>
                {quickLabel ?? queued}
              </span>
              <IconButton label={c.cancelQueued} onClick={onCancelQueued} className="size-7 md:size-7">
                <X aria-hidden className="size-3.5" strokeWidth={2} />
              </IconButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="studio-fade-x -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]">
        {kind.refine.map((r) => (
          <button
            key={r.label}
            type="button"
            disabled={!!off || (busy && !!queued)}
            onClick={() => void submit(r.prompt)}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 text-caption text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:opacity-50 max-md:h-9',
              focusRing,
            )}
          >
            <Sparkles aria-hidden className="size-3 text-primary/70" strokeWidth={1.75} />
            {r.label}
          </button>
        ))}
      </div>
      <div
        className={cn(
          'flex flex-col rounded-xl border bg-background transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15',
          busy ? 'border-primary/25' : 'border-input',
        )}
      >
        <label htmlFor="studio-reply" className="sr-only">
          {kind.placeholder}
        </label>
        <textarea
          id="studio-reply"
          ref={inputRef}
          dir="auto"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
            if (e.key === 'Escape' && busy) {
              e.preventDefault();
              stopTurn(chat.id);
            }
          }}
          placeholder={busy ? c.typeWhileBusy : kind.placeholder}
          className="max-h-42 min-h-10 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-body-sm text-foreground outline-none placeholder:text-muted-foreground/70"
        />
        <div className="flex items-center gap-1.5 px-1.5 pb-1.5">
          <ModelPicker side="top" />
          <span className="ms-auto hidden text-caption text-muted-foreground/80 md:inline">
            {busy ? c.escHint : c.enterHint}
          </span>
          {busy && (
            <IconButton
              variant="outline"
              label={w.stop}
              onClick={() => stopTurn(chat.id)}
              className="md:size-8"
            >
              <Square aria-hidden className="size-3 fill-current" />
            </IconButton>
          )}
          {(!busy || text.trim()) && (
            <IconButton
              variant="primary"
              label={busy ? c.queue : w.send}
              disabled={!text.trim() || !!secret || !!off || sending || (busy && !!queued)}
              onClick={() => void submit()}
              className="md:size-8"
            >
              {sending ? (
                <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
              ) : busy ? (
                <Clock3 aria-hidden className="size-4" strokeWidth={2} />
              ) : (
                <ArrowUp aria-hidden className="size-4" strokeWidth={2} />
              )}
            </IconButton>
          )}
        </div>
      </div>
      {secret && <SecretFilterError pattern={secret} />}
    </div>
  );
}
