'use client';

/**
 * @file idea-studio.tsx
 * @description The Idea Studio, at Planning `?studio=idea`: an idea described in one prompt, researched by Claude through `/hub:idea` in a chat of its own,
 * and returned as one report the owner accepts into Hub. The page is the chat's own view: what the research has found while it runs, then the report, and
 * the conversation beside it to refine the report, so the side panel steps away while the studio is open. Nothing is created until Accept (D51), and a
 * session accepted then refined updates the same idea rather than making a second one.
 */
import type { ProposedIdea } from '@hub/contracts';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Brain,
  CheckCircle2,
  Circle,
  CircleDashed,
  Code2,
  FileText,
  Globe,
  Layers,
  Lightbulb,
  ListOrdered,
  Loader2,
  type LucideIcon,
  MessageCircleQuestion,
  MessagesSquare,
  Plus,
  Quote,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import {
  Bidi,
  Button,
  CardChip,
  cn,
  detectSecret,
  EmptyState,
  fmt,
  focusRing,
  kitMessages,
  num,
  PageContainer,
  plural,
  RelativeTime,
  SecretFilterError,
  setQuery,
  showToast,
  Skeleton,
  Tip,
  useLocale,
  useRoute,
  useT,
} from '@/components/kit';
import { ModelPicker, WherePicker } from '@/components/workbench/composer';
import {
  activeChatId,
  chatIsBusy,
  engineBlocks,
  openChat,
  type PanelChat,
  send,
  useMaybeWb,
  type Wb,
} from '@/components/workbench/store';
import { runningMessage } from '@/features/chat/live';
import {
  acceptIdea,
  IDEA_COMMAND,
  ideaPrompt,
  ideaWords,
  latestIdea,
  RESEARCH_STAGES,
  researchActs,
  researchProgress,
  type ResearchStage,
  type StageState,
  useAcceptedIdea,
} from '@/features/planning/idea-studio';
import { discoveryOf } from '@/features/planning/studio-acts';
import { isHubError } from '@/lib/api/errors';

import { LivePill } from '../detail-parts';
import type { PlanningMessages } from '../messages';
import { nowLine, ReportNote, signed, StudioConversation, type StudioKind } from './conversation';
import { IdeaReport, NoveltyRing, VerdictChip } from './report';
import {
  StudioBack,
  StudioFrame,
  StudioMark,
  type StudioTab,
  StudioTabs,
  useConversationWidth,
  useStudioSend,
} from './shared';

type Words = PlanningMessages['studio'];
const EASE = [0.2, 0.8, 0.2, 1] as const;

const leave = () => setQuery({ studio: null, chat: null }, { replace: false });
const offOf = (wb: Wb) => (engineBlocks(wb.engine) ? (wb.engine as 'offline') : null);

const VERDICT_BADGE: Record<ProposedIdea['verdict'], string> = {
  new: 'bg-success-soft text-success-soft-foreground',
  partial: 'bg-warning-soft text-warning-soft-foreground',
  exists: 'bg-info-soft text-info-soft-foreground',
};

/** How the idea's reports read in the conversation: each one with what changed since the one before. */
function useIdeaKind(): StudioKind {
  const w = useT<PlanningMessages>('planning').studio;
  const locale = useLocale();
  return {
    firstWords: ideaWords,
    firstLabel: w.yourIdea,
    firstIcon: Lightbulb,
    tone: 'idea',
    refine: w.refine,
    placeholder: w.composerPlaceholder,
    answersPrompt: w.answersPrompt,
    applyPrompt: w.applyPrompt,
    isReport: (item) => item.kind === 'idea',
    report: (item, { before, latest, onShow }) => {
      if (item.kind !== 'idea') return null;
      const idea = item.idea;
      const prev = before?.kind === 'idea' ? before.idea : null;
      const c = w.chat;
      const changes: string[] = [];
      if (prev) {
        if (prev.overlap !== idea.overlap)
          changes.push(
            fmt(c.change.overlap, { from: num(prev.overlap, locale), to: num(idea.overlap, locale) }),
          );
        const diff = (a: number, b: number, word: string) => {
          if (a !== b) changes.push(fmt(word, { n: signed(a, b, locale) }));
        };
        diff(prev.matches.length, idea.matches.length, c.change.matches);
        diff(prev.suggestions.length, idea.suggestions.length, c.change.suggestions);
        diff(prev.steps.length, idea.steps.length, c.change.steps);
        diff(prev.sources.length, idea.sources.length, c.change.sources);
        diff(prev.questions.length, idea.questions.length, c.change.questions);
        if (prev.title !== idea.title) changes.push(c.change.title);
      }
      return (
        <ReportNote
          updated={!!prev}
          badge={`${w.verdict[idea.verdict]} · ${num(100 - idea.overlap, locale)}% ${w.novelty}`}
          badgeTone={VERDICT_BADGE[idea.verdict]}
          title={idea.title}
          changes={changes}
          latest={latest}
          onShow={onShow}
        />
      );
    },
  };
}

// ── The page ────────────────────────────────────────────────────────────────────────────────────────

export function IdeaStudio() {
  const { query } = useRoute();
  const chatId = query.get('chat');
  const wb = useMaybeWb();
  const w = useT<PlanningMessages>('planning').studio;

  useEffect(() => {
    if (wb && chatId && wb.activeId !== chatId) openChat(chatId);
  }, [wb?.activeId, chatId]);

  if (!wb) {
    return (
      <PageContainer>
        <StudioBack label={w.back} />
        <EmptyState icon={Lightbulb} title={w.noPanel} />
      </PageContainer>
    );
  }
  if (!chatId) return <StudioStart wb={wb} />;
  const chat = wb.chat?.id === chatId ? wb.chat : null;
  if (!chat) {
    return (
      <PageContainer className="gap-4">
        <StudioBack label={w.back} />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </PageContainer>
    );
  }
  return <StudioSession wb={wb} chat={chat} />;
}

// ── Start: one prompt ───────────────────────────────────────────────────────────────────────────────

function StudioStart({ wb }: { wb: Wb }) {
  const w = useT<PlanningMessages>('planning').studio;
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const off = offOf(wb);
  const secret = detectSecret(text);
  const ready = wb.ready && !off;
  const recent = wb.chats
    .filter((c) => !c.deletedAt && c.title.trimStart().startsWith(IDEA_COMMAND))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  useEffect(() => box.current?.focus(), []);

  const start = async () => {
    const words = text.trim();
    if (!words || busy || secret || !ready) return;
    setBusy(true);
    const sent = await send({ text: ideaPrompt(words), mode: 'plan', fresh: true });
    setBusy(false);
    const id = activeChatId();
    if (sent && id) setQuery({ chat: id }, { replace: false });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void start();
    }
  };

  const how: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: Quote, ...w.how.describe },
    { icon: Search, ...w.how.check },
    { icon: Globe, ...w.how.research },
    { icon: CheckCircle2, ...w.how.accept },
  ];

  return (
    <PageContainer className="gap-6 md:gap-8">
      <StudioBack label={w.back} />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } }}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6"
      >
        <header className="flex flex-col items-center gap-3 text-center">
          <StudioMark icon={Lightbulb} tone="idea" size="lg" />
          <h1 className="text-display font-bold tracking-tight text-foreground">{w.title}</h1>
          <p className="max-w-xl text-body-lg text-pretty text-muted-foreground">{w.subtitle}</p>
        </header>

        <div className="flex flex-col rounded-3xl border border-border bg-card shadow-md transition-shadow focus-within:border-primary/50 focus-within:shadow-lg focus-within:ring-4 focus-within:ring-primary/10">
          <label htmlFor="idea-studio-text" className="sr-only">
            {w.label}
          </label>
          <textarea
            id="idea-studio-text"
            ref={box}
            dir="auto"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            placeholder={w.placeholder}
            className="min-h-36 w-full resize-none bg-transparent px-5 pt-5 pb-2 text-body-lg text-foreground outline-none placeholder:text-muted-foreground/70 md:min-h-40"
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-3 py-2.5">
            <WherePicker side="bottom" />
            <ModelPicker side="bottom" />
            <span className="ms-auto hidden text-caption text-muted-foreground md:inline">{w.startHint}</span>
            <Tip content={{ what: w.startTip }} off={off} vars={{ device: wb.deviceName }}>
              <Button
                variant="primary"
                disabled={!text.trim() || !!secret || !ready || busy}
                onClick={() => void start()}
                className="max-md:ms-auto"
              >
                {busy ? (
                  <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" strokeWidth={1.75} />
                ) : (
                  <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
                )}
                {w.start}
              </Button>
            </Tip>
          </div>
        </div>
        {secret && <SecretFilterError pattern={secret} />}
        {!wb.ready && <p className="text-center text-caption text-muted-foreground">{w.noDevice}</p>}

        <div className="flex flex-col gap-2.5">
          <span className="text-caption font-medium text-muted-foreground">{w.examplesLabel}</span>
          <div className="flex flex-wrap gap-2">
            {w.examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setText(ex);
                  box.current?.focus();
                }}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-start text-body-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5',
                  focusRing,
                )}
              >
                <Lightbulb aria-hidden className="size-3.5 shrink-0 text-type-idea-fg" strokeWidth={1.75} />
                {ex}
              </button>
            ))}
          </div>
        </div>

        <section aria-labelledby="studio-how" className="flex flex-col gap-3">
          <h2 id="studio-how" className="text-title-sm font-semibold text-foreground">
            {w.how.title}
          </h2>
          <ol className="grid gap-3 @page-md:grid-cols-2 @page-xl:grid-cols-4">
            {how.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className="relative flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  >
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="text-caption font-semibold text-muted-foreground tabular-nums">
                    {num(i + 1, locale)}
                  </span>
                </span>
                <span className="text-body-sm font-semibold text-foreground">{title}</span>
                <span className="text-caption text-pretty text-muted-foreground">{body}</span>
              </li>
            ))}
          </ol>
        </section>

        {recent.length > 0 && (
          <RecentSessions chats={recent} title={w.recent} untitled={w.untitled} words={ideaWords} />
        )}
      </motion.div>
    </PageContainer>
  );
}

export function RecentSessions({
  chats,
  title,
  untitled,
  words,
  icon: Icon = Lightbulb,
}: {
  chats: Wb['chats'];
  title: string;
  untitled: string;
  words: (title: string) => string;
  icon?: LucideIcon;
}) {
  return (
    <section aria-labelledby="studio-recent" className="flex flex-col gap-3">
      <h2 id="studio-recent" className="text-title-sm font-semibold text-foreground">
        {title}
      </h2>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {chats.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setQuery({ chat: c.id }, { replace: false })}
              className={cn(
                'flex w-full min-w-0 items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-accent max-md:min-h-12',
                focusRing,
              )}
            >
              <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate text-body-sm text-foreground">
                <Bidi>{words(c.title) || untitled}</Bidi>
              </span>
              {c.running && (
                <Loader2 aria-hidden className="size-3.5 text-primary motion-safe:animate-spin" />
              )}
              <RelativeTime iso={c.updatedAt} className="shrink-0 text-caption text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── A session: research, report, conversation ──────────────────────────────────────────────────────

/** Where the session stands: the turn that runs now, and whether it has already sent its report. */
export function studioTurn<T>(
  chat: PanelChat,
  pick: (m: PanelChat['raw']['messages'][number]) => T | null | undefined,
) {
  const raw = chat.raw;
  const lastAssistant = [...raw.messages].reverse().find((m) => m.role === 'assistant') ?? null;
  // Right after the send the turn has not begun yet: that is the start of the work, not a stop.
  const busy = chatIsBusy(chat.status) || !lastAssistant;
  const running = chatIsBusy(chat.status) ? runningMessage(raw) : null;
  const reportedNow = !!(running && pick(running));
  // A report from an earlier turn: this turn refines it rather than writing the first one.
  const refines = raw.messages.some((m) => m.id !== running?.id && !!pick(m));
  return { busy, running, lastAssistant, reportedNow, refines };
}

function StudioSession({ wb, chat }: { wb: Wb; chat: PanelChat }) {
  const w = useT<PlanningMessages>('planning').studio;
  const reduce = useReducedMotion();
  const kind = useIdeaKind();
  const { busy, running, lastAssistant, reportedNow, refines } = studioTurn(chat, (m) => m.idea);
  const found = latestIdea(chat.raw);
  const asked = ideaWords(chat.raw.messages.find((m) => m.role === 'user')?.content ?? '');
  const composer = useRef<HTMLTextAreaElement>(null);
  const ended = !busy && !found;
  const [width, setWidth] = useConversationWidth();
  const [tab, setTab] = useState<StudioTab>('report');
  const { queued, onSend, cancelQueued } = useStudioSend(chat, busy);
  // The research board shows until there is a report to read; a refinement after that runs above the report as one quiet line.
  const researching = busy && !found;
  const refining = busy && !!found && !reportedNow;

  const develop = () => {
    setTab('chat');
    window.setTimeout(() => composer.current?.focus(), 0);
  };
  const showReport = () => {
    setTab('report');
    window.setTimeout(
      () =>
        document
          .getElementById('studio-report-head')
          ?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }),
      0,
    );
  };
  /** To the question Claude waits on: the conversation, scrolled into view. */
  const answer = () => {
    setTab('chat');
    window.setTimeout(
      () =>
        document
          .querySelector('aside[aria-labelledby="studio-conversation"]')
          ?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }),
      0,
    );
  };
  /** A request from the report itself: a suggestion to apply, answers to its questions. It goes now, or waits in line. */
  const ask = (text: string) => {
    void onSend(text);
    setTab('chat');
  };

  const report = (
    <>
      {researching && (
        <ResearchBoard
          chat={chat}
          message={running ?? lastAssistant}
          asked={asked}
          reported={!!(running ?? lastAssistant)?.idea}
          title={w.researching}
          onAnswer={answer}
          words={w}
        />
      )}

      {ended && (
        <div
          role="status"
          className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5"
        >
          <span className="flex items-center gap-2 text-body font-semibold text-foreground">
            <XCircle aria-hidden className="size-5 text-warning-strong" strokeWidth={1.75} />
            {w.stopped}
          </span>
          <p className="text-body-sm text-muted-foreground">{w.stoppedHint}</p>
          <Button variant="primary" disabled={!!offOf(wb)} onClick={() => void onSend(w.continuePrompt)}>
            <RotateCcw aria-hidden className="size-4" strokeWidth={1.75} />
            {w.continue}
          </Button>
        </div>
      )}

      {found && (
        <motion.div
          key={found.messageId}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } }}
          className="flex min-w-0 flex-col gap-4"
        >
          {refining && <RefiningLine chat={chat} words={w} onAnswer={answer} />}
          <ReportHead found={found} chatId={chat.id} asked={asked} busy={busy} onDevelop={develop} />
          <IdeaReport idea={found.idea} onAsk={ask} busy={busy} />
        </motion.div>
      )}
    </>
  );

  return (
    <PageContainer className="gap-4 md:gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <StudioBack label={w.back} />
        <span className="ms-auto flex items-center gap-2">
          {busy && <LivePill label={refines ? w.updating : w.researching} />}
          <Button variant="outline" onClick={() => setQuery({ chat: null }, { replace: false })}>
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />
            {w.newIdea}
          </Button>
        </span>
      </div>

      <StudioTabs tab={tab} onTab={setTab} busy={busy} label={w.title} words={w.chat} />

      <StudioFrame
        tab={tab}
        width={width}
        report={report}
        conversation={(className) => (
          <StudioConversation
            wb={wb}
            chat={chat}
            kind={kind}
            inputRef={composer}
            width={width}
            onWidth={setWidth}
            onShowReport={showReport}
            queued={queued}
            onSend={onSend}
            onCancelQueued={cancelQueued}
            className={className}
          />
        )}
      />
    </PageContainer>
  );
}

/** Claude has stopped to ask the owner something: said where the work is, with the way to the question. */
export function WaitingForYou({ words: w, onAnswer }: { words: Words; onAnswer: () => void }) {
  return (
    <div
      role="status"
      className="flex min-w-0 flex-wrap items-center gap-2.5 rounded-xl border border-warning/50 bg-warning-soft px-3.5 py-2.5 text-body-sm text-warning-soft-foreground"
    >
      <MessageCircleQuestion aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 font-medium">{w.chat.waitingYou}</span>
      <Button variant="outline" size="sm" onClick={onAnswer}>
        {w.chat.goAnswer}
      </Button>
    </div>
  );
}

/** A refinement at work, above the report it will replace: what Claude is doing, in the conversation's own words. */
export function RefiningLine({
  chat,
  words: w,
  onAnswer,
}: {
  chat: PanelChat;
  words: Words;
  onAnswer?: () => void;
}) {
  const now = nowLine(chat, w.chat);
  if (chat.status === 'waiting' && onAnswer) return <WaitingForYou words={w} onAnswer={onAnswer} />;
  return (
    <div
      role="status"
      className="studio-shimmer flex min-w-0 items-center gap-2.5 overflow-hidden rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-body-sm"
    >
      <Loader2 aria-hidden className="size-4 shrink-0 text-primary motion-safe:animate-spin" />
      <span className="shrink-0 font-semibold text-primary">{w.updating}</span>
      <span className="min-w-0 truncate text-muted-foreground">
        {now.text}
        {now.subject && (
          <>
            {' '}
            <span dir="auto" className="font-mono text-foreground/80">
              {now.subject}
            </span>
          </>
        )}
      </span>
    </div>
  );
}

// ── Research, as it happens: where it stands, and what it has found ─────────────────────────────────

const STAGE_ICON: Record<ResearchStage, LucideIcon> = {
  understand: Brain,
  hub: Layers,
  code: Code2,
  web: Globe,
  report: ListOrdered,
};

function StageMark({ state }: { state: StageState }) {
  if (state === 'done') return <CheckCircle2 aria-hidden className="size-4 text-success" strokeWidth={2} />;
  if (state === 'active')
    return <Loader2 aria-hidden className="size-4 text-primary motion-safe:animate-spin" strokeWidth={2} />;
  if (state === 'skipped')
    return <CircleDashed aria-hidden className="size-4 text-muted-foreground/60" strokeWidth={1.75} />;
  return <Circle aria-hidden className="size-4 text-muted-foreground/50" strokeWidth={1.75} />;
}

export function ResearchBoard({
  chat,
  message,
  asked,
  reported,
  icon = Lightbulb,
  tone = 'idea',
  title,
  reportStage,
  onAnswer,
  words: w,
}: {
  chat: PanelChat;
  message: PanelChat['raw']['messages'][number] | null;
  asked: string;
  reported: boolean;
  icon?: LucideIcon;
  tone?: 'idea' | 'plan';
  title: string;
  /** The last stage's name: the report, or the plan. */
  reportStage?: string;
  /** Takes the owner to the question Claude is waiting on. */
  onAnswer?: () => void;
  words: Words;
}) {
  const locale = useLocale();
  const acts = useMemo(() => researchActs(message), [message]);
  const progress = researchProgress(acts, { running: true, reported });
  const found = useMemo(() => discoveryOf(message?.steps ?? []), [message]);
  const now = nowLine(chat, w.chat);
  const b = w.board;

  return (
    <section
      aria-labelledby="studio-research"
      aria-busy
      className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-card p-4 shadow-xs md:p-5"
    >
      <div className="flex items-start gap-3">
        <StudioMark icon={icon} tone={tone} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="studio-research" className="text-title-sm font-semibold text-foreground">
            {title}
          </h2>
          <p className="line-clamp-2 text-body-sm text-pretty text-muted-foreground">
            <Bidi>{asked}</Bidi>
          </p>
        </div>
      </div>

      <ol className="grid grid-cols-5 gap-1.5 max-md:grid-cols-1">
        {RESEARCH_STAGES.map((stage) => {
          const Icon = STAGE_ICON[stage];
          const state = progress[stage];
          const count = stage === 'hub' || stage === 'code' || stage === 'web' ? found.counts[stage] : 0;
          return (
            <li
              key={stage}
              aria-current={state === 'active' ? 'step' : undefined}
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors md:flex-col md:items-start',
                state === 'active' && 'border-primary/40 bg-primary/5',
                state === 'done' && 'border-border bg-background',
                (state === 'waiting' || state === 'skipped') && 'border-dashed border-border bg-transparent',
              )}
            >
              <span className="flex items-center gap-1.5">
                <StageMark state={state} />
                <Icon
                  aria-hidden
                  className="size-3.5 text-muted-foreground max-md:hidden"
                  strokeWidth={1.75}
                />
              </span>
              <span className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    'text-caption font-semibold',
                    state === 'active'
                      ? 'text-primary'
                      : state === 'done'
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                  )}
                >
                  {stage === 'report' && reportStage ? reportStage : w.stages[stage]}
                </span>
                <span className="text-caption text-muted-foreground">
                  {count > 0 ? plural(count, locale, w.chat.stepCount) : w.stageState[state]}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {chat.status === 'waiting' && onAnswer ? (
        <WaitingForYou words={w} onAnswer={onAnswer} />
      ) : (
        <p
          className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-body-sm"
          role="status"
        >
          <Loader2 aria-hidden className="size-4 shrink-0 text-primary motion-safe:animate-spin" />
          <span className="shrink-0 font-medium text-foreground">{now.text}</span>
          {now.subject && (
            <span dir="auto" className="min-w-0 truncate font-mono text-caption text-muted-foreground">
              {now.subject}
            </span>
          )}
        </p>
      )}

      <div className="grid gap-3 @page-lg:grid-cols-3">
        <FoundColumn icon={Layers} title={b.hub} empty={b.nothingYet}>
          {found.cards.map((k) => (
            <CardChip key={k} k={k} />
          ))}
        </FoundColumn>
        <FoundColumn icon={Code2} title={b.code} empty={b.nothingYet}>
          {found.files.slice(-8).map((f) => (
            <span
              key={f}
              dir="ltr"
              title={f}
              className="inline-flex max-w-full items-center gap-1 truncate rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-caption text-foreground"
            >
              <FileText aria-hidden className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{f.split('/').slice(-2).join('/')}</span>
            </span>
          ))}
          {found.files.length === 0 &&
            found.searches.slice(-4).map((s) => (
              <span
                key={s}
                dir="ltr"
                className="truncate rounded-md bg-muted px-1.5 py-0.5 font-mono text-caption text-muted-foreground"
              >
                {s}
              </span>
            ))}
        </FoundColumn>
        <FoundColumn icon={Globe} title={b.web} empty={b.nothingYet}>
          {found.webSearches.slice(-3).map((s) => (
            <span key={s} dir="auto" className="line-clamp-2 text-caption text-muted-foreground">
              «{s}»
            </span>
          ))}
          {found.pages.map((p) => (
            <a
              key={p.href}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className={cn('truncate text-caption text-primary hover:underline', focusRing)}
            >
              {p.host}
            </a>
          ))}
        </FoundColumn>
      </div>
      <p className="text-caption text-muted-foreground">{w.researchingHint}</p>
    </section>
  );
}

function FoundColumn({
  icon: Icon,
  title,
  empty,
  children,
}: {
  icon: LucideIcon;
  title: string;
  empty: string;
  children: ReactNode;
}) {
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-background p-3">
      <span className="flex items-center gap-1.5 text-caption font-semibold text-foreground">
        <Icon aria-hidden className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
        {title}
      </span>
      {items.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-1.5">{children}</div>
      ) : (
        <span className="flex flex-col gap-1.5" aria-label={empty}>
          <span className="h-2.5 w-3/4 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          <span className="h-2.5 w-1/2 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
        </span>
      )}
    </div>
  );
}

// ── The report's head: verdict, how new, and Accept ─────────────────────────────────────────────────

function ReportHead({
  found,
  chatId,
  asked,
  busy,
  onDevelop,
}: {
  found: NonNullable<ReturnType<typeof latestIdea>>;
  chatId: string;
  asked: string;
  busy: boolean;
  onDevelop: () => void;
}) {
  const w = useT<PlanningMessages>('planning').studio;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { idea, messageId } = found;
  const accepted = useAcceptedIdea(chatId, messageId);
  const [saving, setSaving] = useState(false);
  const saved = accepted.key && accepted.current ? accepted.key : null;
  const stale = accepted.key && !accepted.current ? accepted.key : null;

  const accept = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const { key, updated } = await acceptIdea(idea, messageId, chatId);
      showToast({ tone: 'success', message: fmt(updated ? w.updatedToast : w.acceptedToast, { key }) });
    } catch (error) {
      showToast({ tone: 'error', message: isHubError(error) ? error.message : kit.actionFailed });
    } finally {
      setSaving(false);
    }
  };
  const open = (key: string, toPlan = false) =>
    setQuery({ plan: key, studio: null, chat: null, action: toPlan ? 'to_plan' : null }, { replace: false });

  return (
    <header
      id="studio-report-head"
      className="flex scroll-mt-20 flex-col gap-5 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6"
    >
      <p className="flex min-w-0 items-start gap-2 text-caption text-muted-foreground">
        <Quote aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
        <span className="line-clamp-2">
          <span className="font-medium text-foreground">{w.yourIdea}: </span>
          <Bidi>{asked}</Bidi>
        </span>
      </p>
      <div className="flex flex-col gap-5 @page-md:flex-row @page-md:items-center">
        <NoveltyRing idea={idea} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <VerdictChip verdict={idea.verdict} />
            <span className="text-caption text-muted-foreground tabular-nums">
              {fmt(w.overlapLine, { n: num(idea.overlap, locale) })}
            </span>
          </div>
          <h1 className="text-headline font-bold text-pretty text-foreground">
            <Bidi>{idea.title}</Bidi>
          </h1>
          <p className="text-body text-pretty text-muted-foreground">
            <Bidi>{idea.summary}</Bidi>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {saved ? (
          <>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success-soft px-3 text-body-sm font-medium text-success-soft-foreground">
              <CheckCircle2 aria-hidden className="size-4" strokeWidth={1.75} />
              {fmt(w.accepted, { key: saved })}
            </span>
            <Button variant="primary" onClick={() => open(saved, true)}>
              <ListOrdered aria-hidden className="size-4" strokeWidth={1.75} />
              {w.toPlan}
            </Button>
            <Button variant="outline" onClick={() => open(saved)}>
              {w.openIdea}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            disabled={saving || busy}
            onClick={() => void accept()}
            data-studio-accept
          >
            {saving ? (
              <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" strokeWidth={1.75} />
            ) : stale ? (
              <RefreshCw aria-hidden className="size-4" strokeWidth={1.75} />
            ) : (
              <CheckCircle2 aria-hidden className="size-4" strokeWidth={1.75} />
            )}
            {stale ? fmt(w.updateIdea, { key: stale }) : w.accept}
          </Button>
        )}
        <Button variant="outline" onClick={onDevelop}>
          <MessagesSquare aria-hidden className="size-4" strokeWidth={1.75} />
          {w.develop}
        </Button>
        {!saved && !stale && (
          <Button variant="ghost" onClick={leave} className="ms-auto">
            {w.discard}
          </Button>
        )}
      </div>
      {!saved && (
        <p className="-mt-2 text-caption text-muted-foreground">{stale ? w.staleHint : w.acceptHint}</p>
      )}
    </header>
  );
}
