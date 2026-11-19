'use client';

/**
 * @file detail.tsx
 * @description A plan's or an idea's own page on Planning, at `?plan=KEY`, in place of the side sheet. It reads the card live: what Claude saves while it works
 * shows here at once, a new step slides in and a changed text glows for a moment. From here the owner develops the plan with Claude, or runs it. Why it looks
 * this way: NOTES.md beside this file.
 */
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  Compass,
  FileText,
  Gauge,
  Lightbulb,
  Link2,
  ListOrdered,
  ListTree,
  MessageCircleQuestion,
  MoreHorizontal,
  PenLine,
  Play,
  Route as RouteIcon,
  Sparkles,
  StickyNote,
  Tags,
} from 'lucide-react';
import { DropdownMenu, Tabs } from 'radix-ui';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';

import { ActionBar, CommentsTab, Evidence, HistoryTab, LinksTab } from '@/components/cards/card-sheet';
import { EditButton } from '@/components/cards/sheet-sections/edit-bits';
import { Revisions } from '@/components/cards/sheet-sections/plan';
import {
  ActorChip,
  AppLink,
  Bidi,
  Button,
  type CardAction,
  CardChip,
  cn,
  ConfirmDialog,
  copyText,
  EmptyState,
  ErrorState,
  fill,
  fmt,
  focusRing,
  focusRingInset,
  getCard,
  headingsOf,
  type HubCard,
  IconButton,
  type IdeaCard,
  kitMessages,
  LoadingRegion,
  Ltr,
  MarkdownView,
  MineMark,
  num,
  openCard,
  PageContainer,
  type PlanCard,
  portalRoot,
  PriorityBadge,
  RelativeTime,
  RoleBadge,
  setArchived,
  setQuery,
  sheetSections,
  type SheetTab,
  showToast,
  Skeleton,
  SkeletonRows,
  tabTriggerClass,
  Tip,
  Tooltip,
  TypeBadge,
  typeClass,
  useCardComments,
  useCardEvents,
  useCardQuery,
  useLocale,
  usePageTitleFocus,
  usePerformAction,
  useSession,
  useT,
} from '@/components/kit';
import { CardRuns } from '@/components/queue/run-entry';
import { engineBlocks, fillComposer, useMaybeWb } from '@/components/workbench/store';
import type { ChatMessages } from '@/components/workbench/words';
import { studioChatOfIdea } from '@/features/planning/idea-studio';
import { guideOf, isMineHere, nextStepOf, planFacts, progressOf } from '@/features/planning/model';
import { studioChatOfPlan } from '@/features/planning/plan-studio';
import { sectionCount, splitPlanText } from '@/features/planning/plan-text';
import { linkedOfType } from '@/features/planning/queries';
import { isHubError } from '@/lib/api/errors';

import {
  DetailRow,
  LivePill,
  Outline,
  Panel,
  PathStrip,
  ProgressMeter,
  StagePill,
  StageTrack,
  StepsTimeline,
  type StepTask,
  useChangeGlow,
} from './detail-parts';
import { sendAndShow, useClaudeOn, workOn } from './live';
import type { PlanningMessages } from './messages';

type Shaped = IdeaCard | PlanCard;

const IDEA_STATUS_MENU: readonly CardAction[] = ['accept', 'park', 'reject'];

const isShaped = (card: HubCard | undefined): card is Shaped =>
  card?.type === 'plan' || card?.type === 'idea';

/** Back to the lists, keeping their filters. A real link, so it opens in a new tab too. */
function BackLink() {
  const d = useT<PlanningMessages>('planning').detail;
  const locale = useLocale();
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;
  return (
    <AppLink
      view="planning"
      query={{ plan: null, action: null, tab: null }}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-body-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground max-md:h-11',
        focusRing,
      )}
    >
      <Back aria-hidden className="size-4" strokeWidth={1.75} />
      {d.back}
    </AppLink>
  );
}

function MoreMenu({ card }: { card: HubCard }) {
  const t = useT(kitMessages);
  const locale = useLocale();
  const [confirm, setConfirm] = useState(false);
  const canArchive = card.allowedActions.includes(card.archivedAt ? 'card.restore' : 'card.delete');
  const refused = (error: unknown) =>
    showToast({ tone: 'error', message: isHubError(error) ? error.message : t.actionFailed });
  const item =
    'flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent md:min-h-9';
  return (
    <>
      <DropdownMenu.Root dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <DropdownMenu.Trigger asChild>
          <IconButton label={t.sheet.more}>
            <MoreHorizontal aria-hidden className="size-4" strokeWidth={1.75} />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal container={portalRoot()}>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            collisionPadding={12}
            className="z-75 min-w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
          >
            <DropdownMenu.Item
              onSelect={() => void copyText(location.href).then(() => showToast({ message: t.copy.copied }))}
              className={item}
            >
              <Link2 aria-hidden className="size-4" strokeWidth={1.75} />
              {t.sheet.copyLink}
            </DropdownMenu.Item>
            {canArchive && (
              <DropdownMenu.Item
                onSelect={() =>
                  card.archivedAt ? void setArchived(card.key, false).catch(refused) : setConfirm(true)
                }
                className={item}
              >
                {card.archivedAt ? (
                  <ArchiveRestore aria-hidden className="size-4" strokeWidth={1.75} />
                ) : (
                  <Archive aria-hidden className="size-4" strokeWidth={1.75} />
                )}
                {card.archivedAt ? t.sheet.restore : t.sheet.archive}
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={fmt(t.sheet.archiveTitle, { key: card.key })}
        description={t.sheet.archiveBody}
        confirmLabel={t.sheet.archive}
        onConfirm={() => {
          setQuery({ plan: null, action: null, tab: null }, { replace: false });
          setArchived(card.key, true)
            .then(() =>
              showToast({
                message: fmt(t.sheet.deleted, { key: card.key }),
                onUndo: () => void setArchived(card.key, false).catch(refused),
              }),
            )
            .catch(refused);
        }}
      />
    </>
  );
}

/** What Claude can do from this page. Develop fills the chat and waits for the owner's words (D51); Explain and Run start at once, as the sheet's do. */
function ClaudeActions({ card }: { card: Shaped }) {
  const d = useT<PlanningMessages>('planning').detail;
  const chat = useT<ChatMessages>('chat').panel;
  const wb = useMaybeWb();
  const locale = useLocale();
  const labelId = useId();
  if (!wb) return null;
  const off = engineBlocks(wb.engine) ? (wb.engine as 'offline') : null;
  const device = wb.deviceName;
  const closed = !!card.archivedAt;
  const explain = () =>
    void sendAndShow(fmt(chat.context.prompt.explain, { target: card.key }), 'ask', { card: card.key });

  const next = card.type === 'plan' ? nextStepOf(card) : null;
  const nextTask = next?.step.taskKey;
  const runWhy =
    card.type !== 'plan' ? null : !next ? d.claude.allDone : !nextTask ? d.claude.runNextNoTask : null;

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-1.5">
      {/* The group is named by its mark, so the row stays short and a screen reader still hears "With Claude". */}
      <Tooltip content={d.claude.label}>
        <span
          id={labelId}
          role="img"
          aria-label={d.claude.label}
          className="me-0.5 inline-flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary"
        >
          <Sparkles aria-hidden className="size-3.5" strokeWidth={1.75} />
        </span>
      </Tooltip>
      {card.type === 'plan' ? (
        <Tip content={{ what: d.claude.developTip }} off={off} vars={{ device }}>
          <Button
            size="sm"
            variant="outline"
            disabled={!!off || closed}
            data-plan-develop
            onClick={() =>
              fillComposer(fmt(d.claude.developPrompt, { key: card.key }), 'execute', { show: true })
            }
          >
            <Sparkles aria-hidden className="size-3.5" strokeWidth={1.75} />
            {d.claude.develop}
          </Button>
        </Tip>
      ) : (
        <Tip content={{ what: d.claude.draftTip }} off={off} vars={{ device }}>
          <Button
            size="sm"
            variant="outline"
            disabled={!!off || closed || card.status === 'accepted'}
            data-idea-draft
            onClick={() =>
              setQuery({ studio: 'plan', chat: null, plan: null, idea: card.key }, { replace: false })
            }
          >
            <Sparkles aria-hidden className="size-3.5" strokeWidth={1.75} />
            {d.claude.draft}
          </Button>
        </Tip>
      )}
      {card.type === 'plan' && (
        <Tip
          content={{
            what:
              runWhy ??
              fmt(d.claude.runNextTip, { task: nextTask ?? '', n: num((next?.index ?? 0) + 1, locale) }),
          }}
          off={off}
          vars={{ device }}
        >
          <Button
            size="sm"
            variant="ghost"
            disabled={!!off || closed || !!runWhy}
            data-plan-run-next
            onClick={() => nextTask && void workOn(nextTask)}
          >
            <Play aria-hidden className="size-3.5" strokeWidth={2} />
            {d.claude.runNext}
          </Button>
        </Tip>
      )}
      <Tip content={{ what: d.claude.explain }} off={off} vars={{ device }}>
        <Button size="sm" variant="ghost" disabled={!!off} onClick={explain}>
          <MessageCircleQuestion aria-hidden className="size-3.5" strokeWidth={1.75} />
          {d.claude.explain}
        </Button>
      </Tip>
    </div>
  );
}

/** The top of the page: what it is, where it stands, what comes next, and the buttons that move it. */
function Hero({ card, action }: { card: Shaped; action: CardAction | null }) {
  const d = useT<PlanningMessages>('planning').detail;
  const kit = useT(kitMessages);
  const { me, roles } = useSession();
  const live = useClaudeOn(card.key);
  const glow = useChangeGlow(card.title);
  const locale = useLocale();
  const Icon = card.type === 'plan' ? RouteIcon : Lightbulb;
  const guide = guideOf(card, roles, me.id);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Takes the focus a view change asked for, so no heading drawn later steals it.
  usePageTitleFocus(titleRef);
  const g = d.guide;
  const nextWords: ReactNode = (() => {
    switch (guide.kind) {
      case 'status':
        return (d.next[card.type] as Record<string, string | undefined>)[card.status] ?? null;
      case 'createTasks':
        return fmt(g.createTasks, { n: num(guide.n, locale) });
      case 'step':
        return (
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0">
              {fill(g.step, {
                n: num(guide.index + 1, locale),
                total: num(guide.total, locale),
                title: <Bidi>{guide.title}</Bidi>,
              })}
            </span>
            <CardChip
              k={guide.taskKey}
              type="task"
              showStatus
              card={card.links.find((l) => l.key === guide.taskKey)?.card}
            />
          </span>
        );
      default:
        return g[guide.kind];
    }
  })();
  const idea = card.type === 'plan' ? linkedOfType(card, 'idea') : undefined;
  const plan = card.type === 'idea' ? linkedOfType(card, 'plan') : undefined;
  const progress = card.type === 'plan' ? progressOf(card) : undefined;

  // A page reached by the owner takes focus on its title, so a screen reader starts here. A typing owner, or Follow the chat, keeps theirs.
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    if (active?.closest('[data-wb-panel], [data-wb-input], [role="dialog"]')) return;
    titleRef.current?.focus({ preventScroll: true });
  }, [card.key]);

  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:gap-5 md:p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            typeClass[card.type].soft,
            typeClass[card.type].fg,
          )}
        >
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={card.type} />
            <Ltr mono className="text-caption whitespace-nowrap text-muted-foreground">
              {card.key}
            </Ltr>
            <StagePill card={card} className="whitespace-nowrap" />
            <PriorityBadge priority={card.priority} className="whitespace-nowrap" />
            {isMineHere(card, me.id, roles) && <MineMark className="text-caption" />}
            {live && (
              <span className="ms-auto">
                <LivePill label={d.live} hint={d.liveHint} />
              </span>
            )}
          </div>
          <h1
            ref={titleRef}
            tabIndex={-1}
            className={cn(
              'rounded-md text-title font-semibold text-pretty text-foreground outline-none transition-[box-shadow,background-color] duration-500',
              glow,
            )}
          >
            <Bidi>{card.title}</Bidi>
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              {d.created}
              <ActorChip kind={card.createdByKind} memberId={card.createdById} />
            </span>
            <span aria-hidden>·</span>
            <RelativeTime iso={card.createdAt} />
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              {d.updated} <RelativeTime iso={card.lastEventAt} />
            </span>
          </p>
        </div>
      </div>

      <StageTrack card={card} />
      <PathStrip card={card} idea={idea} plan={plan} tasks={progress} />

      {nextWords && (
        <div className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-body-sm text-foreground">
          <Compass aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">{nextWords}</div>
        </div>
      )}

      {card.archivedAt && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-body-sm text-warning-soft-foreground">
          {fmt(kit.sheet.archived, { when: '' })} <RelativeTime iso={card.archivedAt} />
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4 @page-md:flex-row @page-md:flex-wrap @page-md:items-center @page-md:justify-between">
        {/* An idea's one filled button is its next step; Accept, Park and Reject only say where it stands, so they share one menu. */}
        <ActionBar
          card={card}
          action={action}
          statusMenu={card.type === 'idea' ? IDEA_STATUS_MENU : undefined}
        />
        <ClaudeActions card={card} />
      </div>
    </header>
  );
}

/** A plan's text with its steps' list taken out when the list is the plan's own steps: the page shows them once, on the timeline. */
function usePlanText(card: PlanCard) {
  const body = card.body ?? '';
  return useMemo(() => splitPlanText(body, card.plan.steps), [body, card.plan.steps]);
}

/** Each step's task as the page knows it, without asking the API: the cache's card, or the summary on the plan's own link. */
function useStepTasks(card: PlanCard): Map<string, StepTask> {
  const map = new Map<string, StepTask>();
  for (const step of card.plan.steps) {
    if (!step.taskKey) continue;
    const known = getCard(step.taskKey) ?? card.links.find((l) => l.key === step.taskKey)?.card;
    if (known) map.set(step.taskKey, known);
  }
  return map;
}

function PlanBody({ card }: { card: PlanCard }) {
  const d = useT<PlanningMessages>('planning').detail;
  const wb = useMaybeWb();
  const locale = useLocale();
  const glow = useChangeGlow(card.body);
  const { steps } = card.plan;
  const next = nextStepOf(card);
  const { done, total } = progressOf(card);
  const canEdit = !card.archivedAt && card.allowedActions.includes('plan.update');
  const canRestore = !card.archivedAt && card.allowedActions.includes('plan.restore_revision');
  const { rest, extras } = usePlanText(card);
  const tasks = useStepTasks(card);
  const off = wb && engineBlocks(wb.engine);
  const develop = () =>
    fillComposer(fmt(d.claude.developPrompt, { key: card.key }), 'execute', { show: true });
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Panel
        id={`steps-${card.key}`}
        title={d.steps}
        icon={ListOrdered}
        aside={
          <span className="flex items-center gap-2">
            {total > 0 && (
              <span className="text-caption text-muted-foreground tabular-nums">
                {fmt(d.progressLine, { done: num(done, locale), total: num(total, locale) })}
              </span>
            )}
            {canEdit && <EditButton />}
          </span>
        }
      >
        {steps.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-body-sm text-muted-foreground">{d.stepsEmpty}</p>
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => setQuery({ action: 'edit' })}>
                  <PenLine aria-hidden className="size-3.5" strokeWidth={1.75} />
                  {d.addSteps}
                </Button>
              )}
              {wb && !card.archivedAt && (
                <Button size="sm" variant="ghost" disabled={!!off} onClick={develop}>
                  <Sparkles aria-hidden className="size-3.5" strokeWidth={1.75} />
                  {d.claude.develop}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* The progress, here too: on a phone the side panel is far below. */}
            <ProgressMeter done={done} total={total} />
            <StepsTimeline
              steps={steps}
              nextIndex={next?.index ?? null}
              run={card.archivedAt || !wb ? undefined : { cardKey: card.key }}
              tasks={tasks}
              extras={extras}
              anchor={`step-${card.key}`}
            />
          </div>
        )}
      </Panel>

      <Panel
        id={`approach-${card.key}`}
        title={sectionCount(rest) >= 2 ? d.planText : d.approach}
        icon={FileText}
        aside={canEdit && <EditButton />}
      >
        <div
          className={cn('-m-2 rounded-lg p-2 transition-[box-shadow,background-color] duration-500', glow)}
        >
          {rest ? (
            <MarkdownView source={rest} dir="auto" headingOffset={2} />
          ) : (
            <p className="text-body-sm text-muted-foreground">{d.approachEmpty}</p>
          )}
        </div>
      </Panel>

      <Evidence cardKey={card.key} />
      {wb && <CardRuns cardKey={card.key} />}
      <Revisions card={card} canRestore={canRestore} />
    </div>
  );
}

function IdeaBody({ card }: { card: IdeaCard }) {
  const t = useT<PlanningMessages>('planning');
  const d = t.detail;
  const glow = useChangeGlow(`${card.idea.problem}${card.idea.notes}`);
  const canEdit = !card.archivedAt && card.allowedActions.includes('idea.update');
  const notes = card.idea.notes?.trim();
  // An idea accepted from the studio holds its value as notes and again inside its report: it shows once, in the report.
  const notesInBody = !!notes && !!card.body?.includes(notes);
  return (
    <div className={cn('flex min-w-0 flex-col gap-5 rounded-xl transition-shadow duration-500', glow)}>
      <Panel id={`problem-${card.key}`} title={d.problem} icon={Lightbulb} aside={canEdit && <EditButton />}>
        {card.idea.problem ? (
          <MarkdownView source={card.idea.problem} dir="auto" headingOffset={2} />
        ) : (
          <p className="text-body-sm text-muted-foreground">{d.noProblem}</p>
        )}
      </Panel>
      {!notesInBody && (
        <Panel id={`notes-${card.key}`} title={d.notes} icon={StickyNote}>
          {card.idea.notes ? (
            <MarkdownView source={card.idea.notes} dir="auto" headingOffset={2} />
          ) : (
            <p className="text-body-sm text-muted-foreground">{d.noNotes}</p>
          )}
        </Panel>
      )}
      {card.body && (
        <Panel
          id={`body-${card.key}`}
          title={sectionCount(card.body) >= 2 ? d.report : t.idea.body}
          icon={FileText}
        >
          <MarkdownView source={card.body} dir="auto" headingOffset={2} />
        </Panel>
      )}
    </div>
  );
}

/** The studio chat this card came from, when this browser made it and the chat is still there: the way back to the full report. */
function useStudioChatOf(card: Shaped) {
  const wb = useMaybeWb();
  const id = card.type === 'idea' ? studioChatOfIdea(card.key) : studioChatOfPlan(card.key);
  if (!id || !wb?.chats.some((c) => c.id === id && !c.deletedAt)) return null;
  return id;
}

/** The side column: progress, the text's outline, and the facts. It stays in view beside a long plan. */
function Aside({ card, onOutlineMissing }: { card: Shaped; onOutlineMissing: () => void }) {
  const d = useT<PlanningMessages>('planning').detail;
  const locale = useLocale();
  const { me } = useSession();
  const body = card.body ?? '';
  const steps = card.type === 'plan' ? card.plan.steps : null;
  // The outline is of the text the page shows: a plan's without its steps' list, which the timeline holds.
  const outline = useMemo(() => headingsOf(steps ? splitPlanText(body, steps).rest : body), [body, steps]);
  const progress = card.type === 'plan' ? progressOf(card) : null;
  const facts = card.type === 'plan' ? planFacts(card) : {};
  const studioChat = useStudioChatOf(card);
  return (
    <aside className="flex min-w-0 flex-col gap-4 @page-xl:sticky @page-xl:top-4">
      {progress && progress.total > 0 && (
        <Panel title={d.progress} icon={Gauge} id={`progress-${card.key}`}>
          <div className="flex flex-col gap-2.5">
            <p className="flex items-baseline gap-1.5 text-foreground">
              <span className="text-headline font-semibold tabular-nums">{num(progress.done, locale)}</span>
              <span className="text-body-sm text-muted-foreground tabular-nums">
                / {num(progress.total, locale)}
              </span>
            </p>
            <ProgressMeter done={progress.done} total={progress.total} />
            <p className="text-caption text-muted-foreground">
              {fmt(d.progressLine, { done: num(progress.done, locale), total: num(progress.total, locale) })}
              {' · '}
              {progress.withoutTask > 0
                ? fmt(d.noTask, { n: num(progress.withoutTask, locale) })
                : d.allTasks}
            </p>
          </div>
        </Panel>
      )}

      {outline.length > 1 && (
        // On a narrow page this column falls below the text, where an outline of it helps nobody.
        <Panel
          title={card.type === 'plan' ? d.outline : d.outlineIdea}
          icon={ListTree}
          id={`outline-${card.key}`}
          bodyClassName="p-2"
          className="@max-page-xl:hidden"
        >
          <Outline
            headings={outline}
            label={card.type === 'plan' ? d.outline : d.outlineIdea}
            onMissing={onOutlineMissing}
          />
        </Panel>
      )}

      <Panel title={d.facts} icon={Tags} id={`facts-${card.key}`}>
        <dl className="flex flex-col divide-y divide-border">
          <DetailRow label={d.priority}>
            <PriorityBadge priority={card.priority} />
          </DetailRow>
          <DetailRow label={d.role}>
            {card.ownerRole ? (
              <RoleBadge role={card.ownerRole} routed={me.roles.includes(card.ownerRole)} />
            ) : (
              <span className="text-muted-foreground">{d.none}</span>
            )}
          </DetailRow>
          <DetailRow label={d.tags}>
            {card.tags.length ? (
              card.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-caption text-muted-foreground"
                >
                  <Bidi>{tag}</Bidi>
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">{d.none}</span>
            )}
          </DetailRow>
          {facts.approvedById && (
            <DetailRow label={d.approvedBy}>
              <ActorChip kind="user" memberId={facts.approvedById} />
              {facts.approvedAt && <RelativeTime iso={facts.approvedAt} className="text-muted-foreground" />}
            </DetailRow>
          )}
          {facts.revision && (
            <DetailRow label={d.revisionLabel}>
              <Ltr className="tabular-nums">{num(facts.revision, locale)}</Ltr>
            </DetailRow>
          )}
        </dl>
        {studioChat && (
          <AppLink
            view="planning"
            query={{ studio: card.type, chat: studioChat, plan: null, action: null, tab: null }}
            className={cn(
              'hit-44 mt-3 inline-flex items-center gap-1.5 rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline',
              focusRing,
            )}
          >
            <Sparkles aria-hidden className="size-3.5" strokeWidth={1.75} />
            {d.openStudio}
          </AppLink>
        )}
      </Panel>
    </aside>
  );
}

function DetailSkeleton({ cardKey }: { cardKey: string }) {
  const d = useT<PlanningMessages>('planning').detail;
  return (
    <PageContainer className="gap-5 md:gap-6">
      <BackLink />
      <LoadingRegion label={fmt(d.loading, { key: cardKey })}>
        <Skeleton className="h-56 w-full rounded-2xl" />
        <div className="grid gap-5 @page-xl:grid-cols-[minmax(0,1fr)_16.5rem]">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-72 max-w-full" />
            <SkeletonRows count={4} withAction={false} />
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </LoadingRegion>
    </PageContainer>
  );
}

/** A plan's or an idea's page. Any other card has no page of its own, so it goes back to the sheet. */
export function PlanningDetail({
  cardKey,
  action,
  tab,
}: {
  cardKey: string;
  action: CardAction | null;
  tab: SheetTab;
}) {
  const d = useT<PlanningMessages>('planning').detail;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const perform = usePerformAction();
  const query = useCardQuery(cardKey);
  const events = useCardEvents(cardKey);
  const comments = useCardComments(cardKey);
  const card = useMemo(
    () =>
      query.data ? { ...query.data, events: events.data ?? [], comments: comments.data ?? [] } : undefined,
    [query.data, events.data, comments.data],
  );

  useEffect(() => {
    document.getElementById('main')?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [cardKey]);

  const other = !!card && !isShaped(card);
  useEffect(() => {
    if (!other) return;
    setQuery({ plan: null, action: null, tab: null });
    openCard(cardKey);
  }, [other, cardKey]);

  if (!card && query.isPending) return <DetailSkeleton cardKey={cardKey} />;
  if (!card && query.isError && !isHubError(query.error, 'hub.cards.not_found')) {
    return (
      <PageContainer className="gap-5">
        <BackLink />
        <ErrorState
          title={kit.sheet.notLoaded}
          code={isHubError(query.error) ? query.error.code : undefined}
          onRetry={() => void query.refetch()}
        />
      </PageContainer>
    );
  }
  if (!card) {
    return (
      <PageContainer className="gap-5">
        <BackLink />
        <EmptyState icon={RouteIcon} title={fmt(d.notFound, { key: cardKey })}>
          {d.notFoundBody}
        </EmptyState>
      </PageContainer>
    );
  }
  if (!isShaped(card)) return <DetailSkeleton cardKey={cardKey} />;

  const Section = sheetSections[card.type];
  const commentCount = comments.data ? card.comments.length : card.commentCount;
  const tabs = [
    ['details', card.type === 'plan' ? d.tabs.plan : d.tabs.idea, null],
    ['comments', d.tabs.comments, commentCount],
    ['history', d.tabs.history, events.data ? card.events.length : null],
    ['links', d.tabs.links, card.links.length],
  ] as const;

  return (
    <PageContainer className="gap-4 md:gap-5">
      <div className="flex items-center gap-1">
        <BackLink />
        <span aria-hidden className="text-muted-foreground/60">
          /
        </span>
        <Ltr mono className="px-1 text-caption text-muted-foreground">
          {card.key}
        </Ltr>
        <span className="ms-auto">
          <MoreMenu card={card} />
        </span>
      </div>

      <Hero card={card} action={action} />

      <div className="grid items-start gap-5 @page-xl:grid-cols-[minmax(0,1fr)_16.5rem]">
        <Tabs.Root
          value={tab}
          onValueChange={(next) => setQuery({ tab: next === 'details' ? null : next })}
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          className="flex min-w-0 flex-col gap-4"
        >
          <Tabs.List
            aria-label={fmt(kit.sheet.label, { key: card.key })}
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-border scrollbar-none"
          >
            {tabs.map(([value, label, count]) => (
              <Tabs.Trigger key={value} value={value} className={tabTriggerClass}>
                {label}
                {count !== null && count > 0 && (
                  <Ltr className="rounded-full bg-muted px-1.5 text-caption tabular-nums">
                    {num(count, locale)}
                  </Ltr>
                )}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content value="details" className={cn('min-w-0 outline-none', focusRingInset)}>
            {action ? (
              // An action's form (edit, turn into a plan, a reason) is the sheet's own, so it saves one way everywhere.
              <Panel>
                <Section
                  card={card}
                  action={action}
                  cancelAction={() => setQuery({ action: null })}
                  perform={(a, payload) => perform(card.key, a, payload)}
                />
              </Panel>
            ) : card.type === 'plan' ? (
              <PlanBody card={card} />
            ) : (
              <IdeaBody card={card} />
            )}
          </Tabs.Content>
          <Tabs.Content value="comments" className={cn('outline-none', focusRingInset)}>
            <Panel>
              <CommentsTab card={card} />
            </Panel>
          </Tabs.Content>
          <Tabs.Content value="history" className={cn('outline-none', focusRingInset)}>
            <Panel>
              <HistoryTab card={card} />
            </Panel>
          </Tabs.Content>
          <Tabs.Content value="links" className={cn('outline-none', focusRingInset)}>
            <Panel>
              <LinksTab card={card} />
            </Panel>
          </Tabs.Content>
        </Tabs.Root>

        <Aside card={card} onOutlineMissing={() => setQuery({ tab: null, action: null })} />
      </div>
    </PageContainer>
  );
}
