'use client';

/**
 * @file detail.tsx
 * @description A plan's or an idea's own page on Planning, at `?plan=KEY`, in place of the side sheet. It reads the card live: what Claude saves while it works
 * shows here at once, a new step slides in and a changed text glows for a moment. From here the owner develops the plan with Claude, or runs it. An idea's
 * page is here; a plan's is `plan-page.tsx` (the approved v5-live-plan). Why it looks this way: NOTES.md beside this file.
 */
import { Compass, FileText, Lightbulb, Route as RouteIcon, StickyNote } from 'lucide-react';
import { Tabs } from 'radix-ui';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';

import { ActionBar, CommentsTab, HistoryTab, LinksTab } from '@/components/cards/card-sheet';
import { EditButton } from '@/components/cards/sheet-sections/edit-bits';
import {
  ActorChip,
  Bidi,
  type CardAction,
  CardChip,
  cn,
  EmptyState,
  ErrorState,
  fill,
  fmt,
  focusRingInset,
  type HubCard,
  type IdeaCard,
  kitMessages,
  LoadingRegion,
  Ltr,
  MarkdownView,
  MineMark,
  num,
  openCard,
  PageContainer,
  PriorityBadge,
  RelativeTime,
  setQuery,
  sheetSections,
  type SheetTab,
  Skeleton,
  SkeletonRows,
  tabTriggerClass,
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
import { guideOf, isMineHere, progressOf } from '@/features/planning/model';
import { sectionCount } from '@/features/planning/plan-text';
import { linkedOfType } from '@/features/planning/queries';
import { isHubError } from '@/lib/api/errors';

import { LivePill, Panel, PathStrip, StagePill, StageTrack, useChangeGlow } from './detail-parts';
import { Aside, BackLink, ClaudeActions, MoreMenu, type Shaped } from './detail-shared';
import { useClaudeOn } from './live';
import type { PlanningMessages } from './messages';
import { PlanDetail } from './plan-page';

const IDEA_STATUS_MENU: readonly CardAction[] = ['accept', 'park', 'reject'];

const isShaped = (card: HubCard | undefined): card is Shaped =>
  card?.type === 'plan' || card?.type === 'idea';

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

  const commentCount = comments.data ? card.comments.length : card.commentCount;
  if (card.type === 'plan') {
    return (
      <PlanDetail
        card={card}
        action={action}
        tab={tab}
        commentCount={commentCount}
        historyCount={events.data ? card.events.length : null}
      />
    );
  }

  const Section = sheetSections[card.type];
  const tabs = [
    ['details', d.tabs.idea, null],
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
