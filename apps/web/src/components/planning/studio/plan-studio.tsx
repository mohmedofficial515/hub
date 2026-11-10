'use client';

/**
 * @file plan-studio.tsx
 * @description The Plan Studio, at Planning `?studio=plan`: a topic (or an idea) in one prompt, thought through by Claude with `/hub:plan` in a chat of its
 * own, and returned as a structured plan: the goal and the approach, ordered steps with who does them and how big they are, a flow, checks, risks, what is
 * left out, and the questions only the owner can answer. It runs in Plan, so nothing is written until Save; a saved plan refined later is brought up to date,
 * never saved twice. The conversation, the research board and the flow are the Idea Studio's own.
 */
import { planToPrompt, type ProposedPlan } from '@hub/contracts';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  Ban,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  Compass,
  ExternalLink,
  FileText,
  Gauge,
  GitBranch,
  Lightbulb,
  ListChecks,
  ListOrdered,
  Loader2,
  type LucideIcon,
  MessagesSquare,
  Network,
  PenLine,
  Play,
  Plus,
  Quote,
  RefreshCw,
  RotateCcw,
  Route,
  Save,
  Search,
  Sparkles,
  Target,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

import {
  Bidi,
  Button,
  cn,
  detectSecret,
  EmptyState,
  fmt,
  focusRing,
  type IdeaCard,
  kitMessages,
  num,
  PageContainer,
  plural,
  type Role,
  RoleBadge,
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
  engineBlocks,
  fillComposer,
  openChat,
  type PanelChat,
  send,
  useMaybeWb,
  type Wb,
} from '@/components/workbench/store';
import { ACTIVE_IDEAS } from '@/features/planning/model';
import {
  effortOf,
  latestPlan,
  PLAN_COMMAND,
  planIdeaKey,
  planPrompt,
  planWords,
  rolesOf,
  savePlanFromStudio,
  usePlanWords,
  useSavedPlan,
} from '@/features/planning/plan-studio';
import { useIdeasQuery } from '@/features/planning/queries';
import { hostOf } from '@/features/planning/studio-acts';
import { isHubError } from '@/lib/api/errors';

import { LivePill } from '../detail-parts';
import type { PlanningMessages } from '../messages';
import { NewPlanDialog } from '../new-cards';
import { ReportNote, signed, StudioConversation, type StudioKind } from './conversation';
import { FlowDiagram } from './diagram';
import { RecentSessions, RefiningLine, ResearchBoard, studioTurn } from './idea-studio';
import { Questions, ReportToc, Section } from './report';
import {
  StudioBack,
  StudioFrame,
  StudioMark,
  type StudioTab,
  StudioTabs,
  useConversationWidth,
  useStudioSend,
} from './shared';

const EASE = [0.2, 0.8, 0.2, 1] as const;
const ROLES = new Set<string>(['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa']);
const offOf = (wb: Wb) => (engineBlocks(wb.engine) ? (wb.engine as 'offline') : null);

/** How the plan's versions read in the conversation: each with what changed since the one before. */
function usePlanKind(): StudioKind {
  const t = useT<PlanningMessages>('planning');
  const p = t.planStudio;
  const c = t.studio.chat;
  const locale = useLocale();
  return {
    firstWords: planWords,
    firstLabel: p.yourTopic,
    firstIcon: Route,
    tone: 'plan',
    refine: p.refine,
    placeholder: p.composerPlaceholder,
    answersPrompt: p.answersPrompt,
    isReport: (item) => item.kind === 'plan' && !!item.structured,
    report: (item, { before, latest, onShow }) => {
      if (item.kind !== 'plan' || !item.structured) return null;
      const plan = item.structured;
      const prev = before?.kind === 'plan' ? before.structured : null;
      const changes: string[] = [];
      if (prev) {
        const diff = (a: number, b: number, word: string) => {
          if (a !== b) changes.push(fmt(word, { n: signed(a, b, locale) }));
        };
        diff(prev.steps.length, plan.steps.length, c.change.steps);
        diff(prev.risks?.length ?? 0, plan.risks?.length ?? 0, p.change.risks);
        diff(prev.checks?.length ?? 0, plan.checks?.length ?? 0, p.change.checks);
        diff(prev.questions?.length ?? 0, plan.questions?.length ?? 0, c.change.questions);
        if (prev.title !== plan.title) changes.push(c.change.title);
      }
      return (
        <ReportNote
          icon={Route}
          words={{ ready: p.noteReady, updated: p.noteUpdated }}
          updated={!!prev}
          badge={plural(plan.steps.length, locale, t.studio.chat.stepCount)}
          badgeTone="bg-type-plan-soft text-type-plan-fg"
          title={plan.title}
          changes={changes}
          latest={latest}
          onShow={onShow}
        />
      );
    },
  };
}

// ── The page ────────────────────────────────────────────────────────────────────────────────────────

export function PlanStudio() {
  const { query } = useRoute();
  const chatId = query.get('chat');
  const wb = useMaybeWb();
  const p = useT<PlanningMessages>('planning').planStudio;

  useEffect(() => {
    if (wb && chatId && wb.activeId !== chatId) openChat(chatId);
  }, [wb?.activeId, chatId]);

  if (!wb) {
    return (
      <PageContainer>
        <StudioBack label={p.back} />
        <EmptyState icon={Route} title={p.noPanel} />
      </PageContainer>
    );
  }
  if (!chatId) return <PlanStart wb={wb} ideaKey={query.get('idea')} />;
  const chat = wb.chat?.id === chatId ? wb.chat : null;
  if (!chat) {
    return (
      <PageContainer className="gap-4">
        <StudioBack label={p.back} />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </PageContainer>
    );
  }
  return <PlanSession wb={wb} chat={chat} />;
}

// ── Start: one prompt, or an idea to start from ────────────────────────────────────────────────────

function PlanStart({ wb, ideaKey }: { wb: Wb; ideaKey: string | null }) {
  const p = useT<PlanningMessages>('planning').planStudio;
  const locale = useLocale();
  const reduce = useReducedMotion();
  const ideas = (useIdeasQuery().data?.items ?? [])
    .filter((c) => (ACTIVE_IDEAS as readonly string[]).includes(c.status))
    .slice(0, 6);
  const [idea, setIdea] = useState<string | null>(ideaKey);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const off = offOf(wb);
  const secret = detectSecret(text);
  const ready = wb.ready && !off;
  const chosen = idea ? (ideas.find((c) => c.key === idea) ?? null) : null;
  const canStart = (!!text.trim() || !!idea) && !secret && ready && !busy;
  const recent = wb.chats
    .filter((c) => !c.deletedAt && c.title.trimStart().startsWith(PLAN_COMMAND))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  useEffect(() => box.current?.focus(), []);

  const start = async () => {
    if (!canStart) return;
    setBusy(true);
    const words = text.trim() || chosen?.title || '';
    const sent = await send({
      text: planPrompt(words, idea),
      mode: 'plan',
      fresh: true,
      ...(idea ? { context: { card: idea } } : {}),
    });
    setBusy(false);
    const id = activeChatId();
    if (sent && id) setQuery({ chat: id, idea: null }, { replace: false });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void start();
    }
  };

  const how: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: Quote, ...p.how.describe },
    { icon: Search, ...p.how.read },
    { icon: ListOrdered, ...p.how.draft },
    { icon: CheckCircle2, ...p.how.decide },
  ];

  return (
    <PageContainer className="gap-6 md:gap-8">
      <StudioBack label={p.back} />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } }}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6"
      >
        <header className="flex flex-col items-center gap-3 text-center">
          <StudioMark icon={Route} tone="plan" size="lg" />
          <h1 className="text-display font-bold tracking-tight text-foreground">{p.title}</h1>
          <p className="max-w-xl text-body-lg text-pretty text-muted-foreground">{p.subtitle}</p>
        </header>

        <div className="flex flex-col rounded-3xl border border-border bg-card shadow-md transition-shadow focus-within:border-primary/50 focus-within:shadow-lg focus-within:ring-4 focus-within:ring-primary/10">
          {idea && (
            <div className="flex min-w-0 items-center gap-2 px-5 pt-4">
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-type-idea-soft px-2.5 py-1 text-caption font-medium text-type-idea-fg">
                <Lightbulb aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
                <span className="shrink-0 font-mono">{idea}</span>
                {chosen && (
                  <span className="min-w-0 truncate">
                    <Bidi>{chosen.title}</Bidi>
                  </span>
                )}
                <button
                  type="button"
                  aria-label={p.clearIdea}
                  onClick={() => setIdea(null)}
                  className={cn('-me-1 rounded-full p-0.5 hover:bg-type-idea/20', focusRing)}
                >
                  <X aria-hidden className="size-3" strokeWidth={2} />
                </button>
              </span>
            </div>
          )}
          <label htmlFor="plan-studio-text" className="sr-only">
            {p.label}
          </label>
          <textarea
            id="plan-studio-text"
            ref={box}
            dir="auto"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            placeholder={idea ? p.ideaPlaceholder : p.placeholder}
            className="min-h-32 w-full resize-none bg-transparent px-5 pt-4 pb-2 text-body-lg text-foreground outline-none placeholder:text-muted-foreground/70 md:min-h-36"
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-3 py-2.5">
            <WherePicker side="bottom" />
            <ModelPicker side="bottom" />
            <span className="ms-auto hidden text-caption text-muted-foreground md:inline">{p.startHint}</span>
            <Tip content={{ what: p.startTip }} off={off} vars={{ device: wb.deviceName }}>
              <Button
                variant="primary"
                disabled={!canStart}
                onClick={() => void start()}
                className="max-md:ms-auto"
              >
                {busy ? (
                  <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" strokeWidth={1.75} />
                ) : (
                  <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
                )}
                {p.start}
              </Button>
            </Tip>
          </div>
        </div>
        {secret && <SecretFilterError pattern={secret} />}
        {!wb.ready && <p className="text-center text-caption text-muted-foreground">{p.noDevice}</p>}

        {ideas.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <span className="text-caption font-medium text-muted-foreground">{p.fromIdea}</span>
            <div className="flex flex-wrap gap-2">
              {ideas.map((c: IdeaCard) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={idea === c.key}
                  onClick={() => {
                    setIdea(idea === c.key ? null : c.key);
                    box.current?.focus();
                  }}
                  className={cn(
                    'inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-start text-body-sm transition-colors',
                    idea === c.key
                      ? 'border-type-idea bg-type-idea-soft text-type-idea-fg'
                      : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5',
                    focusRing,
                  )}
                >
                  <Lightbulb aria-hidden className="size-3.5 shrink-0 text-type-idea-fg" strokeWidth={1.75} />
                  <span className="shrink-0 font-mono text-caption text-muted-foreground">{c.key}</span>
                  <span className="min-w-0 truncate">
                    <Bidi>{c.title}</Bidi>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <span className="text-caption font-medium text-muted-foreground">{p.examplesLabel}</span>
          <div className="flex flex-wrap gap-2">
            {p.examples.map((ex) => (
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
                <Route aria-hidden className="size-3.5 shrink-0 text-type-plan-fg" strokeWidth={1.75} />
                {ex}
              </button>
            ))}
          </div>
        </div>

        <section aria-labelledby="plan-studio-how" className="flex flex-col gap-3">
          <h2 id="plan-studio-how" className="text-title-sm font-semibold text-foreground">
            {p.how.title}
          </h2>
          <ol className="grid gap-3 @page-md:grid-cols-2 @page-xl:grid-cols-4">
            {how.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
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

        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-center">
          <span className="text-body-sm text-muted-foreground">{p.manualHint}</span>
          <Button variant="ghost" size="sm" onClick={() => setManual(true)}>
            <PenLine aria-hidden className="size-4" strokeWidth={1.75} />
            {p.manual}
          </Button>
        </div>

        {recent.length > 0 && (
          <RecentSessions
            chats={recent}
            title={p.recent}
            untitled={p.untitled}
            words={planWords}
            icon={Route}
          />
        )}
      </motion.div>
      <NewPlanDialog open={manual} onOpenChange={setManual} />
    </PageContainer>
  );
}

// ── A session: the research, the plan, the conversation ─────────────────────────────────────────────

function PlanSession({ wb, chat }: { wb: Wb; chat: PanelChat }) {
  const t = useT<PlanningMessages>('planning');
  const p = t.planStudio;
  const reduce = useReducedMotion();
  const kind = usePlanKind();
  const { busy, running, lastAssistant, reportedNow, refines } = studioTurn(chat, (m) => m.structuredPlan);
  const found = latestPlan(chat.raw);
  const first = chat.raw.messages.find((m) => m.role === 'user')?.content ?? '';
  const asked = planWords(first);
  const ideaKey = planIdeaKey(first);
  const composer = useRef<HTMLTextAreaElement>(null);
  const [width, setWidth] = useConversationWidth();
  const [tab, setTab] = useState<StudioTab>('report');
  const { queued, sending, onSend, cancelQueued } = useStudioSend(chat, busy);
  const researching = busy && !found;
  const refining = busy && !!found && !reportedNow;
  // A turn that ended with words but no structured plan: shown as a stop, with the way to carry on.
  const ended = !busy && !found;

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
          reported={!!(running ?? lastAssistant)?.structuredPlan}
          icon={Route}
          tone="plan"
          title={p.researching}
          reportStage={p.reportStage}
          onAnswer={answer}
          words={t.studio}
        />
      )}
      {ended && (
        <div
          role="status"
          className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5"
        >
          <span className="flex items-center gap-2 text-body font-semibold text-foreground">
            <XCircle aria-hidden className="size-5 text-warning-strong" strokeWidth={1.75} />
            {p.stopped}
          </span>
          <p className="text-body-sm text-muted-foreground">{p.stoppedHint}</p>
          <Button variant="primary" disabled={!!offOf(wb)} onClick={() => void onSend(p.continuePrompt)}>
            <RotateCcw aria-hidden className="size-4" strokeWidth={1.75} />
            {p.continue}
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
          {refining && (
            <RefiningLine chat={chat} words={{ ...t.studio, updating: p.updating }} onAnswer={answer} />
          )}
          <PlanHead
            wb={wb}
            plan={found.plan}
            messageId={found.messageId}
            chatId={chat.id}
            asked={asked}
            ideaKey={ideaKey}
            busy={busy}
            onDevelop={develop}
          />
          <PlanReport plan={found.plan} onAsk={ask} busy={busy} />
        </motion.div>
      )}
    </>
  );

  return (
    <PageContainer className="gap-4 md:gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <StudioBack label={p.back} />
        <span className="ms-auto flex items-center gap-2">
          {busy && <LivePill label={refines ? p.updating : p.researching} />}
          <Button variant="outline" onClick={() => setQuery({ chat: null }, { replace: false })}>
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />
            {p.newPlan}
          </Button>
        </span>
      </div>
      <StudioTabs tab={tab} onTab={setTab} busy={busy} label={p.title} words={t.studio.chat} />
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
            sending={sending}
            onSend={onSend}
            onCancelQueued={cancelQueued}
            className={className}
          />
        )}
      />
    </PageContainer>
  );
}

// ── The plan's head: what it is for, how big it is, and Save ────────────────────────────────────────

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2">
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <span className="flex min-w-0 flex-col">
        <span className="text-body font-semibold text-foreground tabular-nums">{value}</span>
        <span className="truncate text-caption text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function PlanHead({
  wb,
  plan,
  messageId,
  chatId,
  asked,
  ideaKey,
  busy,
  onDevelop,
}: {
  wb: Wb;
  plan: ProposedPlan;
  messageId: string;
  chatId: string;
  asked: string;
  ideaKey: string | null;
  busy: boolean;
  onDevelop: () => void;
}) {
  const p = useT<PlanningMessages>('planning').planStudio;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const savedState = useSavedPlan(chatId, messageId);
  const planText = usePlanWords();
  const [saving, setSaving] = useState(false);
  const saved = savedState.key && savedState.current ? savedState.key : null;
  const stale = savedState.key && !savedState.current ? savedState.key : null;
  const roles = rolesOf(plan).filter((r) => r.role);
  const effort = effortOf(plan);
  const off = offOf(wb);

  const save = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const { key, updated } = await savePlanFromStudio(plan, messageId, chatId, ideaKey, planText);
      showToast({ tone: 'success', message: fmt(updated ? p.updatedToast : p.savedToast, { key }) });
    } catch (error) {
      showToast({ tone: 'error', message: isHubError(error) ? error.message : kit.actionFailed });
    } finally {
      setSaving(false);
    }
  };
  const open = (key: string) => setQuery({ plan: key, studio: null, chat: null }, { replace: false });

  return (
    <header
      id="studio-report-head"
      className="flex scroll-mt-20 flex-col gap-5 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6"
    >
      <p className="flex min-w-0 items-start gap-2 text-caption text-muted-foreground">
        <Quote aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
        <span className="line-clamp-2">
          <span className="font-medium text-foreground">{p.yourTopic}: </span>
          {ideaKey && <span className="me-1 font-mono">{ideaKey}</span>}
          <Bidi>{asked}</Bidi>
        </span>
      </p>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="inline-flex h-6 items-center gap-1.5 self-start rounded-full bg-type-plan-soft px-2.5 text-caption font-semibold text-type-plan-fg">
          <Route aria-hidden className="size-3.5" strokeWidth={1.75} />
          {p.draftLabel}
        </span>
        <h1 className="text-headline font-bold text-pretty text-foreground">
          <Bidi>{plan.title}</Bidi>
        </h1>
        {plan.goal && (
          <p className="text-body text-pretty text-muted-foreground">
            <Bidi>{plan.goal}</Bidi>
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 @page-lg:grid-cols-4">
        <Stat icon={ListOrdered} value={num(plan.steps.length, locale)} label={p.stats.steps} />
        <Stat icon={Users} value={num(roles.length, locale)} label={p.stats.roles} />
        <Stat
          icon={Gauge}
          value={effort.sized ? num(effort.points, locale) : '—'}
          label={effort.sized ? p.stats.effort : p.stats.noEffort}
        />
        <Stat icon={AlertTriangle} value={num(plan.risks?.length ?? 0, locale)} label={p.stats.risks} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {saved ? (
          <>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success-soft px-3 text-body-sm font-medium text-success-soft-foreground">
              <CheckCircle2 aria-hidden className="size-4" strokeWidth={1.75} />
              {fmt(p.saved, { key: saved })}
            </span>
            <Button variant="primary" onClick={() => open(saved)}>
              {p.openPlan}
            </Button>
          </>
        ) : (
          <Button variant="primary" disabled={saving || busy} onClick={() => void save()} data-studio-save>
            {saving ? (
              <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" strokeWidth={1.75} />
            ) : stale ? (
              <RefreshCw aria-hidden className="size-4" strokeWidth={1.75} />
            ) : (
              <Save aria-hidden className="size-4" strokeWidth={1.75} />
            )}
            {stale
              ? fmt(p.updatePlan, { key: stale })
              : ideaKey
                ? fmt(p.saveFromIdea, { key: ideaKey })
                : p.save}
          </Button>
        )}
        <Button variant="outline" onClick={onDevelop}>
          <MessagesSquare aria-hidden className="size-4" strokeWidth={1.75} />
          {p.develop}
        </Button>
        <Tip content={{ what: p.runTip }} off={off} vars={{ device: wb.deviceName }}>
          <Button
            variant="ghost"
            disabled={!!off}
            onClick={() => fillComposer(planToPrompt(plan), 'execute', { show: true })}
          >
            <Play aria-hidden className="size-4" strokeWidth={2} />
            {p.run}
          </Button>
        </Tip>
      </div>
      {!saved && (
        <p className="-mt-2 text-caption text-muted-foreground">
          {stale ? p.staleHint : ideaKey ? fmt(p.saveFromIdeaHint, { key: ideaKey }) : p.saveHint}
        </p>
      )}
    </header>
  );
}

// ── The plan ────────────────────────────────────────────────────────────────────────────────────────

const SIZE_TONE = {
  S: 'bg-success-soft text-success-soft-foreground',
  M: 'bg-info-soft text-info-soft-foreground',
  L: 'bg-warning-soft text-warning-soft-foreground',
} as const;

function PlanReport({
  plan,
  onAsk,
  busy,
}: {
  plan: ProposedPlan;
  onAsk: (text: string) => void;
  busy: boolean;
}) {
  const t = useT<PlanningMessages>('planning');
  const p = t.planStudio;
  const locale = useLocale();
  const roles = rolesOf(plan);
  const total = plan.steps.length;
  const sections = [
    { id: 'plan-goal', label: p.sections.approach, show: !!(plan.goal || plan.approach) },
    { id: 'plan-roles', label: p.sections.roles, show: roles.some((r) => r.role) },
    { id: 'plan-steps', label: p.sections.steps, show: true },
    { id: 'plan-diagram', label: p.sections.diagram, show: !!plan.diagram },
    { id: 'plan-checks', label: p.sections.checks, show: !!plan.checks?.length },
    { id: 'plan-risks', label: p.sections.risks, show: !!(plan.risks?.length || plan.outOfScope?.length) },
    { id: 'plan-questions', label: p.sections.questions, show: !!plan.questions?.length },
    { id: 'plan-sources', label: p.sections.sources, show: !!plan.sources?.length },
  ].filter((s) => s.show);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ReportToc sections={sections} label={t.studio.toc} />

      {(plan.goal || plan.approach) && (
        <div id="plan-goal" className="grid scroll-mt-36 gap-4 @page-lg:grid-cols-2">
          {plan.goal && (
            <Section id="plan-goal-g" title={p.sections.goal} icon={Target}>
              <p className="text-body text-pretty text-foreground">
                <Bidi>{plan.goal}</Bidi>
              </p>
            </Section>
          )}
          {plan.approach && (
            <Section id="plan-approach" title={p.sections.approach} icon={Compass}>
              <p className="text-body text-pretty text-foreground">
                <Bidi>{plan.approach}</Bidi>
              </p>
            </Section>
          )}
        </div>
      )}

      {roles.some((r) => r.role) && (
        <Section id="plan-roles" title={p.sections.roles} icon={Users}>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            {roles.map((r, i) => (
              <span
                key={r.role ?? 'none'}
                className={cn('h-full', r.role ? ROLE_BAR[i % ROLE_BAR.length] : 'bg-muted-foreground/30')}
                style={{ width: `${(r.steps / total) * 100}%` }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {roles.map((r, i) => (
              <li
                key={r.role ?? 'none'}
                className="flex items-center gap-1.5 text-caption text-muted-foreground"
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2.5 rounded-full',
                    r.role ? ROLE_BAR[i % ROLE_BAR.length] : 'bg-muted-foreground/30',
                  )}
                />
                {r.role ? (
                  <RoleBadge role={r.role as Role} outline={false} className="text-caption" />
                ) : (
                  p.noRole
                )}
                <span className="tabular-nums">{plural(r.steps, locale, t.studio.chat.stepCount)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        id="plan-steps"
        title={p.sections.steps}
        icon={ListOrdered}
        aside={
          <span className="text-caption text-muted-foreground">
            {plural(total, locale, t.studio.chat.stepCount)}
          </span>
        }
      >
        <ol className="flex min-w-0 flex-col">
          {plan.steps.map((s, i) => (
            <li
              key={`${i}-${s.title}`}
              id={`plan-step-${i + 1}`}
              className="relative flex min-w-0 scroll-mt-36 gap-3 pb-4 last:pb-0"
            >
              {i < total - 1 && (
                <span aria-hidden className="absolute start-3.5 top-8 bottom-1 w-px bg-border" />
              )}
              <span
                aria-hidden
                className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-type-plan/40 bg-type-plan-soft text-caption font-semibold text-type-plan-fg tabular-nums"
              >
                {num(i + 1, locale)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-1 pt-0.5">
                <span className="text-body-sm font-medium text-pretty text-foreground">
                  <Bidi>{s.title}</Bidi>
                </span>
                {s.why && (
                  <span className="text-caption text-pretty text-muted-foreground">
                    <Bidi>{s.why}</Bidi>
                  </span>
                )}
                <span className="flex flex-wrap items-center gap-1.5">
                  {s.role && ROLES.has(s.role) && (
                    <RoleBadge role={s.role as Role} outline={false} className="text-caption" />
                  )}
                  {s.size && (
                    <span
                      title={p.sizeHint}
                      className={cn(
                        'inline-flex h-5 items-center rounded-full px-2 text-caption font-semibold',
                        SIZE_TONE[s.size],
                      )}
                    >
                      {p.sizes[s.size]}
                    </span>
                  )}
                  {s.after?.length ? (
                    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-muted px-2 text-caption text-muted-foreground">
                      <GitBranch aria-hidden className="size-3" strokeWidth={1.75} />
                      {p.after}{' '}
                      {s.after.map((n, j) => (
                        <a
                          key={n}
                          href={`#plan-step-${n}`}
                          className={cn(
                            'font-semibold text-foreground tabular-nums hover:underline',
                            focusRing,
                          )}
                        >
                          {num(n, locale)}
                          {j < s.after!.length - 1 ? '،' : ''}
                        </a>
                      ))}
                    </span>
                  ) : null}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {plan.diagram && (
        <Section id="plan-diagram" title={plan.diagram.title || p.sections.diagram} icon={Network}>
          <FlowDiagram
            diagram={plan.diagram}
            words={{ shapes: t.studio.shapes, listLabel: t.studio.diagramList, to: t.studio.to }}
          />
        </Section>
      )}

      {!!plan.checks?.length && (
        <Section id="plan-checks" title={p.sections.checks} icon={ListChecks}>
          <ul className="flex min-w-0 flex-col gap-2">
            {plan.checks.map((c) => (
              <li key={c} className="flex min-w-0 items-start gap-2 text-body-sm text-foreground">
                <CheckCircle2
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-success"
                  strokeWidth={1.75}
                />
                <span className="min-w-0">
                  <Bidi>{c}</Bidi>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!!(plan.risks?.length || plan.outOfScope?.length) && (
        <div id="plan-risks" className="grid scroll-mt-36 gap-4 @page-lg:grid-cols-2">
          {!!plan.risks?.length && (
            <Section id="plan-risks-r" title={p.sections.risks} icon={AlertTriangle}>
              <ul className="flex min-w-0 list-disc flex-col gap-1.5 ps-4 text-body-sm text-foreground marker:text-warning-strong">
                {plan.risks.map((r) => (
                  <li key={r}>
                    <Bidi>{r}</Bidi>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {!!plan.outOfScope?.length && (
            <Section id="plan-out" title={p.sections.outOfScope} icon={Ban}>
              <ul className="flex min-w-0 list-disc flex-col gap-1.5 ps-4 text-body-sm text-foreground marker:text-muted-foreground">
                {plan.outOfScope.map((r) => (
                  <li key={r}>
                    <Bidi>{r}</Bidi>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {!!plan.questions?.length && (
        <Section id="plan-questions" title={p.sections.questions} icon={CircleHelp}>
          <Questions questions={plan.questions} onAsk={onAsk} busy={busy} prompt={p.answersPrompt} />
        </Section>
      )}

      {!!plan.sources?.length && (
        <Section id="plan-sources" title={p.sections.sources} icon={BookOpen}>
          <ol className="flex min-w-0 flex-col gap-2">
            {plan.sources.map((s, i) => (
              <li key={`${s.url}-${i}`} className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-bold text-muted-foreground tabular-nums">
                  {num(i + 1, locale)}
                </span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('group flex min-w-0 flex-col rounded-md', focusRing)}
                >
                  <span className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground group-hover:text-primary group-hover:underline">
                    <Bidi>{s.title}</Bidi>
                    <ExternalLink aria-hidden className="size-3 shrink-0" />
                  </span>
                  <span dir="ltr" className="truncate text-start text-caption text-muted-foreground">
                    {hostOf(s.url)}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <FileText aria-hidden className="size-3.5" strokeWidth={1.75} />
        {p.draftNote}
      </p>
    </div>
  );
}

/** The roles' share of the steps, each in its own token colour so the bar reads in both themes. */
const ROLE_BAR = [
  'bg-type-plan',
  'bg-info',
  'bg-success',
  'bg-warning-strong',
  'bg-type-idea',
  'bg-primary',
  'bg-destructive',
];
