'use client';

/**
 * @file detail-shared.tsx
 * @description What a plan's page and an idea's page share on Planning (`?plan=KEY`): the way back, the More menu, the Claude buttons, the side column and
 * the studio chat a card came from. Why they look this way: NOTES.md beside this file.
 */
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  Gauge,
  Link2,
  ListTree,
  MessageCircleQuestion,
  MoreHorizontal,
  Play,
  Sparkles,
  Tags,
} from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useId, useMemo, useState } from 'react';

import {
  ActorChip,
  AppLink,
  Bidi,
  Button,
  cn,
  ConfirmDialog,
  copyText,
  fmt,
  focusRing,
  headingsOf,
  type HubCard,
  IconButton,
  type IdeaCard,
  kitMessages,
  Ltr,
  num,
  type PlanCard,
  portalRoot,
  PriorityBadge,
  RelativeTime,
  RoleBadge,
  setArchived,
  setQuery,
  showToast,
  Tip,
  Tooltip,
  useLocale,
  useSession,
  useT,
} from '@/components/kit';
import { engineBlocks, fillComposer, useMaybeWb } from '@/components/workbench/store';
import type { ChatMessages } from '@/components/workbench/words';
import { studioChatOfIdea } from '@/features/planning/idea-studio';
import { nextStepOf, planFacts, progressOf } from '@/features/planning/model';
import { studioChatOfPlan } from '@/features/planning/plan-studio';
import { splitPlanText } from '@/features/planning/plan-text';
import { isHubError } from '@/lib/api/errors';

import { DetailRow, Outline, Panel, ProgressMeter } from './detail-parts';
import { sendAndShow, workOn } from './live';
import type { PlanningMessages } from './messages';

export type Shaped = IdeaCard | PlanCard;

/** Back to the lists, keeping their filters. A real link, so it opens in a new tab too. */
export function BackLink() {
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

export function MoreMenu({ card }: { card: HubCard }) {
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
export function ClaudeActions({ card }: { card: Shaped }) {
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

/**
 * The studio chat this card came from, named on the card itself (owner decision 9c), and still in the member's chats: the way back to the full report, in
 * any of their browsers. A card saved before that is found from what this browser kept.
 */
export function useStudioChatOf(card: Shaped) {
  const wb = useMaybeWb();
  const id =
    card.type === 'idea'
      ? studioChatOfIdea(card.key, card.idea.sourceChatId)
      : studioChatOfPlan(card.key, card.plan.sourceChatId);
  if (!id || !wb?.chats.some((c) => c.id === id && !c.deletedAt)) return null;
  return id;
}

/**
 * The side column: progress, the text's outline, and the facts. It stays in view beside a long plan. A plan's own page carries its progress in its head
 * (v5-live-plan), so it leaves the progress out.
 */
export function Aside({
  card,
  onOutlineMissing,
  withProgress = true,
}: {
  card: Shaped;
  onOutlineMissing: () => void;
  withProgress?: boolean | undefined;
}) {
  const d = useT<PlanningMessages>('planning').detail;
  const locale = useLocale();
  const { me } = useSession();
  const body = card.body ?? '';
  const steps = card.type === 'plan' ? card.plan.steps : null;
  // The outline is of the text the page shows: a plan's without its steps' list, which the timeline holds.
  const outline = useMemo(() => headingsOf(steps ? splitPlanText(body, steps).rest : body), [body, steps]);
  const progress = card.type === 'plan' && withProgress ? progressOf(card) : null;
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
