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
  Play,
  Route as RouteIcon,
  Sparkles,
  StickyNote,
  Tags,
} from 'lucide-react';
import { DropdownMenu, Tabs } from 'radix-ui';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  fmt,
  focusRing,
  focusRingInset,
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
  StatusBadge,
  tabTriggerClass,
  Tip,
  TypeBadge,
  typeClass,
  useCardComments,
  useCardEvents,
  useCardQuery,
  useLocale,
  usePerformAction,
  useSession,
  useT,
} from '@/components/kit';
import { CardRuns } from '@/components/queue/run-entry';
import { engineBlocks, fillComposer, useMaybeWb } from '@/components/workbench/store';
import type { ChatMessages } from '@/components/workbench/words';
import { isMineHere, nextStepOf, progressOf } from '@/features/planning/model';
import { linkedOfType } from '@/features/planning/queries';
import { isHubError } from '@/lib/api/errors';

import {
  DetailRow,
  LivePill,
  Outline,
  Panel,
  ProgressMeter,
  StageTrack,
  StepsTimeline,
  useChangeGlow,
} from './detail-parts';
import { sendAndShow, useClaudeOn, workOn } from './live';
import type { PlanningMessages } from './messages';

type Shaped = IdeaCard | PlanCard;

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
    <div role="group" aria-label={d.claude.label} className="flex flex-wrap items-center gap-1.5">
      <span className="me-0.5 inline-flex items-center gap-1 text-caption font-medium text-muted-foreground">
        <Sparkles aria-hidden className="size-3.5 text-primary" strokeWidth={1.75} />
        {d.claude.label}
      </span>
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
  const Icon = card.type === 'plan' ? RouteIcon : Lightbulb;
  const nextWords = (d.next[card.type] as Record<string, string>)[card.status];
  const titleRef = useRef<HTMLHeadingElement>(null);

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
            <StatusBadge status={card.status} className="whitespace-nowrap" />
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

      {nextWords && (
        <p className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-body-sm text-foreground">
          <Compass aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          {nextWords}
        </p>
      )}

      {card.archivedAt && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-body-sm text-warning-soft-foreground">
          {fmt(kit.sheet.archived, { when: '' })} <RelativeTime iso={card.archivedAt} />
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4 @page-md:flex-row @page-md:flex-wrap @page-md:items-center @page-md:justify-between">
        <ActionBar card={card} action={action} />
        <ClaudeActions card={card} />
      </div>
    </header>
  );
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
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Panel
        id={`steps-${card.key}`}
        title={d.steps}
        icon={ListOrdered}
        aside={
          total > 0 && (
            <span className="text-caption text-muted-foreground tabular-nums">
              {fmt(d.progressLine, { done: num(done, locale), total: num(total, locale) })}
            </span>
          )
        }
      >
        {steps.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">{d.stepsEmpty}</p>
        ) : (
          <StepsTimeline
            steps={steps}
            nextIndex={next?.index ?? null}
            run={card.archivedAt || !wb ? undefined : { cardKey: card.key }}
          />
        )}
      </Panel>

      <Panel id={`approach-${card.key}`} title={d.approach} icon={FileText} aside={canEdit && <EditButton />}>
        <div
          className={cn('-m-2 rounded-lg p-2 transition-[box-shadow,background-color] duration-500', glow)}
        >
          {card.body ? (
            <MarkdownView source={card.body} dir="auto" headingOffset={2} />
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
  return (
    <div className={cn('flex min-w-0 flex-col gap-5 rounded-xl transition-shadow duration-500', glow)}>
      <Panel id={`problem-${card.key}`} title={d.problem} icon={Lightbulb} aside={canEdit && <EditButton />}>
        {card.idea.problem ? (
          <MarkdownView source={card.idea.problem} dir="auto" headingOffset={2} />
        ) : (
          <p className="text-body-sm text-muted-foreground">{d.noProblem}</p>
        )}
      </Panel>
      <Panel id={`notes-${card.key}`} title={d.notes} icon={StickyNote}>
        {card.idea.notes ? (
          <MarkdownView source={card.idea.notes} dir="auto" headingOffset={2} />
        ) : (
          <p className="text-body-sm text-muted-foreground">{d.noNotes}</p>
        )}
      </Panel>
      {card.body && (
        <Panel id={`body-${card.key}`} title={t.idea.body} icon={FileText}>
          <MarkdownView source={card.body} dir="auto" headingOffset={2} />
        </Panel>
      )}
    </div>
  );
}

/** The side column: progress, the plan's outline, and its facts. It stays in view beside a long plan. */
function Aside({ card }: { card: Shaped }) {
  const d = useT<PlanningMessages>('planning').detail;
  const locale = useLocale();
  const { me } = useSession();
  const outline = useMemo(() => (card.type === 'plan' ? headingsOf(card.body ?? '') : []), [card]);
  const progress = card.type === 'plan' ? progressOf(card) : null;
  const idea = card.type === 'plan' ? linkedOfType(card, 'idea') : null;
  const plan = card.type === 'idea' ? linkedOfType(card, 'plan') : null;
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
        <Panel title={d.outline} icon={ListTree} id={`outline-${card.key}`} bodyClassName="p-2">
          <Outline headings={outline} label={d.outline} />
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
          {idea && (
            <DetailRow label={d.fromIdea}>
              <CardChip k={idea.key} type="idea" />
            </DetailRow>
          )}
          {plan && (
            <DetailRow label={d.becamePlan}>
              <CardChip k={plan.key} type="plan" />
            </DetailRow>
          )}
        </dl>
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

        <Aside card={card} />
      </div>
    </PageContainer>
  );
}
