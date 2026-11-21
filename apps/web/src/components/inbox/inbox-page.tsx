'use client';

/**
 * @file inbox-page.tsx
 * @description The job is to clear what is addressed to me, phone first (docs/09 §15). One narrow reading column that opens on what is unread, newest
 * first, with the quick action on each row and the one filled button on the newest row that asks something of me. The cards waiting on me are not
 * repeated: one line says how many, and links to Today.
 */
import type { InboxItem } from '@hub/contracts';
import { AnimatePresence } from 'framer-motion';
import { BellOff, CheckCheck, CircleCheck, Inbox } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  actionsFor,
  AppLink,
  Button,
  type CardAction,
  cn,
  dayKey,
  EmptyState,
  ErrorState,
  FilterBar,
  fmt,
  focusRing,
  kitMessages,
  LoadingRegion,
  matchKey,
  navigate,
  nowMs,
  openCard,
  PageContainer,
  PageHeader,
  plural,
  rememberMine,
  SectionHeader,
  setQuery,
  shortcutsEnabled,
  showToast,
  Skeleton,
  SkeletonRows,
  StatusBadge,
  useAwaiting,
  useFilter,
  useKeyboardList,
  useLocale,
  useSession,
  useT,
} from '@/components/kit';
import {
  FAMILIES,
  groupItems,
  type InboxGroup,
  type KindFamily,
  KINDS_OF,
  sectionsOf,
} from '@/features/inbox/group';
import {
  useArchivedCount,
  useHasAnyItem,
  useInboxActions,
  useInboxList,
  useMarkAllRead,
} from '@/features/inbox/use-inbox';
import { useInboxCount } from '@/features/session/session';
import { asCard, useRunAction } from '@/features/timeline/run-action';
import { isHubError } from '@/lib/api/errors';
import { messages } from '@/lib/i18n';

import { type InboxMessages, NS } from './messages';
import { InboxRow, type ItemLink, linkButtonClass, toItemLink } from './row';

export function InboxPage() {
  const t = useT<InboxMessages>(NS);
  const kit = useT(kitMessages);
  // A link out names where it goes: Settings, the Agent queue, Members, or Today for the brief (flow-04).
  const nav = useT(messages).nav;
  const locale = useLocale();
  const { roles, me } = useSession();
  const run = useRunAction();
  const stack = useAwaiting();
  const heading = useRef<HTMLHeadingElement>(null);
  const [said, setSaid] = useState('');

  // The wireframe's default: what is unread, newest first. All is one press away (review M9).
  const showAll = useFilter('show') === 'all';
  const awaitingOnly = useFilter('awaiting') === 'me';
  const kind = useFilter('kind') as KindFamily | null;
  const archivedView = useFilter('archived') === '1';

  const list = useInboxList({
    ...(archivedView ? { archived: true } : showAll ? {} : { unread: true }),
    ...(kind && KINDS_OF[kind] ? { kinds: KINDS_OF[kind] } : {}),
  });
  const hasAny = useHasAnyItem();
  const archivedCount = useArchivedCount();
  const unreadTotal = useInboxCount().data?.unread ?? 0;
  const actions = useInboxActions(kit.actionFailed);
  const markAllRead = useMarkAllRead(kit.actionFailed);
  const stackKeys = useMemo(() => new Set(stack.map((c) => c.key)), [stack]);

  // A write predicts in the cache, so the view's own rule runs here as well: a row read in the Unread view leaves at once.
  const items = useMemo(
    () =>
      list.items.filter(
        (i) =>
          (archivedView ? !!i.archivedAt : !i.archivedAt) &&
          (archivedView || showAll || !i.readAt) &&
          (archivedView || !awaitingOnly || (!!i.card && stackKeys.has(i.card.key))),
      ),
    [list.items, archivedView, showAll, awaitingOnly, stackKeys],
  );
  const groups = useMemo(() => groupItems(items), [items]);
  const todayKey = dayKey(nowMs());
  const yesterdayKey = dayKey(nowMs() - 86_400_000);
  const sections = useMemo(
    () => sectionsOf(groups, dayKey, todayKey, yesterdayKey),
    [groups, todayKey, yesterdayKey],
  );
  const ordered = sections.flatMap((s) => s.groups);
  const byId = new Map<string, InboxGroup>(groups.map((g) => [g.lead.id, g] as const));

  /** The action this card still offers me. A notification's button follows the card, and goes away once nothing is left to do. */
  const availableAction = (item: InboxItem) => {
    if (!item.card) return null;
    const card = asCard(item.card);
    const offers = actionsFor(card, roles, me.id);
    const verb = item.card.awaiting ?? item.data.action;
    return offers.find((a) => a.action === verb && a.enabled) ?? null;
  };

  const linkOf = (item: InboxItem): ItemLink | undefined => {
    if (item.card) return undefined;
    if (item.data.link) return toItemLink(item.data.link);
    if (item.kind === 'brief') return { view: 'today' };
    return undefined;
  };

  // The one filled button: the newest row that asks something of me.
  const filledId = archivedView
    ? undefined
    : ordered.find((g) => {
        const action = availableAction(g.lead);
        return action && !action.selfVerify;
      })?.lead.id;

  const markRead = (group: InboxGroup) => {
    if (group.unread) actions.markRead(group.ids);
  };

  /** 09 §15: opening an item marks it read and opens the sheet on the quick action. */
  const openGroup = (group: InboxGroup) => {
    markRead(group);
    const { lead } = group;
    const key = lead.card?.key ?? lead.data.cardKey;
    const link = linkOf(lead);
    if (key) openCard(key, { action: availableAction(lead)?.action ?? null });
    else if (link) navigate(link.view, { query: link.query });
  };

  /** `e` flips the lead item only, so pressing it twice is always back where it started. */
  const toggleRead = (group: InboxGroup) => {
    const { lead } = group;
    if (!lead.readAt) {
      const undo = actions.markRead([lead.id]);
      setSaid(t.row.readNow);
      // In the Unread view the row leaves at once, so the way back has to be on screen.
      if (!showAll && !archivedView) showToast({ message: t.row.readNow, onUndo: undo });
    } else {
      actions.markUnread([lead.id]);
      setSaid(t.row.unreadNow);
    }
  };

  const archive = (group: InboxGroup) => {
    const undo = actions.archive(group.ids, group.unread ? group.ids.length : 0);
    showToast({ message: t.row.archived, onUndo: undo });
  };
  const restore = (group: InboxGroup) => {
    const undo = actions.restore(group.ids, group.unread ? group.ids.length : 0);
    showToast({ message: t.row.restored, onUndo: undo });
  };

  const markAll = () => {
    if (unreadTotal === 0) return;
    const known = list.items.filter((i) => !i.readAt && !i.archivedAt).map((i) => i.id);
    markAllRead();
    // Undo can only bring back what the page knows, so it is offered only when that is everything.
    const undo = known.length === unreadTotal ? () => actions.markUnread(known) : undefined;
    showToast({ message: plural(unreadTotal, locale, t.markedAll), ...(undo ? { onUndo: undo } : {}) });
  };

  const quick = (action: CardAction) => (id: string) => {
    const group = byId.get(id);
    if (!group?.lead.card || availableAction(group.lead)?.action !== action) return;
    markRead(group);
    run(asCard(group.lead.card), action);
  };

  const rows = useKeyboardList({
    ids: ordered.map((g) => g.lead.id),
    emptyFocusRef: heading,
    onOpen: (id) => {
      const group = byId.get(id);
      if (group) openGroup(group);
    },
    actions: {
      e: (id) => {
        const group = byId.get(id);
        if (group) toggleRead(group);
      },
      d: quick('decide'),
      a: quick('acknowledge'),
      c: quick('claim'),
    },
  });

  // `Shift+E` marks everything read wherever focus is, unless the member is typing (09 §15).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!matchKey(e, 'E') || e.ctrlKey || e.metaKey || e.altKey || !shortcutsEnabled()) return;
      if (
        (e.target as HTMLElement).closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]',
        )
      )
        return;
      e.preventDefault();
      markAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const loading = list.isPending || hasAny.isPending;
  const failed = list.isError && !list.data;
  const none = !loading && !failed && hasAny.data === false && !archivedCount;

  const header = (
    <PageHeader
      title={t.title}
      // An empty inbox has one sentence, in its empty state (review M8).
      meta={
        loading ? (
          <Skeleton className="mt-1.5 h-4 w-44" />
        ) : failed || none ? undefined : (
          plural(unreadTotal, locale, t.summary.unread)
        )
      }
      actions={
        !loading && !failed && hasAny.data ? (
          <Button onClick={markAll} disabled={unreadTotal === 0} aria-keyshortcuts="Shift+E">
            <CheckCheck aria-hidden className="size-4" strokeWidth={1.75} />
            {unreadTotal === 0 ? t.allRead : t.markAll}
          </Button>
        ) : undefined
      }
    />
  );

  if (failed) {
    const { error } = list;
    return (
      <PageContainer className="max-w-200">
        {header}
        <ErrorState
          thing={t.errorThing}
          code={isHubError(error) ? error.code : undefined}
          requestId={isHubError(error) ? error.requestId : undefined}
          onRetry={() => void list.refetch()}
        />
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer className="max-w-200">
        {header}
        <LoadingRegion label={t.title}>
          <div className="flex gap-1.5">
            <Skeleton className="h-11 w-32 rounded-md md:h-8" />
            <Skeleton className="h-11 w-20 rounded-full md:h-8" />
            <Skeleton className="h-11 w-24 rounded-md md:h-8" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-24" />
            <SkeletonRows count={7} withAction={false} />
          </div>
        </LoadingRegion>
      </PageContainer>
    );
  }

  if (none) {
    return (
      <PageContainer className="max-w-200">
        {header}
        <EmptyState size="page" icon={Inbox} title={t.empty.allTitle}>
          {t.empty.allBody}
        </EmptyState>
      </PageContainer>
    );
  }

  const nothing = sections.length === 0;
  const clearFilters = () => {
    rememberMine('inbox', me.id, false);
    setQuery({ kind: null, awaiting: null });
  };

  return (
    <PageContainer className="max-w-200">
      {header}
      <p role="status" className="sr-only">
        {said}
      </p>

      {!archivedView && (
        <FilterBar
          status={{
            label: t.filters.show,
            value: showAll ? 'all' : 'unread',
            options: [
              { value: 'unread', label: t.filters.unread, count: unreadTotal },
              { value: 'all', label: t.filters.all },
            ],
            onChange: (next) => setQuery({ show: next === 'all' ? 'all' : null }),
          }}
          mine={{ page: 'inbox' }}
          selects={[
            {
              param: 'kind',
              label: t.filters.kind,
              any: t.filters.anyKind,
              options: FAMILIES.map((f) => ({ value: f, label: t.filters.kinds[f] })),
            },
          ]}
        />
      )}

      {/* The cards that wait have their page. This only says how many, and goes there (review M9). */}
      {!archivedView && stack.length > 0 && (
        <p className="text-body text-muted-foreground">
          <AppLink
            view="today"
            className={cn(
              'hit-44 rounded-sm font-medium text-primary underline-offset-4 hover:underline',
              focusRing,
            )}
          >
            {plural(stack.length, locale, t.waitingLine)}
          </AppLink>
        </p>
      )}

      <section aria-labelledby="inbox-rest" className="flex flex-col gap-3">
        <SectionHeader
          ref={heading}
          id="inbox-rest"
          title={archivedView ? t.archive.title : showAll ? t.rest.all : t.rest.unread}
          count={groups.reduce((sum, g) => sum + g.ids.length, 0)}
        />

        {nothing &&
          (kind || awaitingOnly ? (
            <EmptyState
              icon={BellOff}
              title={kind ? t.empty.kindTitle : t.empty.needsTitle}
              action={<Button onClick={clearFilters}>{t.filters.clear}</Button>}
            >
              {kind ? t.empty.kindBody : t.empty.needsBody}
            </EmptyState>
          ) : archivedView ? (
            <EmptyState icon={BellOff} title={t.archive.empty} />
          ) : (
            <EmptyState
              icon={CircleCheck}
              title={t.empty.unreadTitle}
              action={
                showAll ? undefined : (
                  <Button onClick={() => setQuery({ show: 'all' })}>{t.filters.showAll}</Button>
                )
              }
            >
              {t.empty.unreadBody}
            </EmptyState>
          ))}

        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <section
              key={section.id}
              aria-labelledby={`inbox-day-${section.id}`}
              className="flex flex-col gap-1.5"
            >
              <h3 id={`inbox-day-${section.id}`} className="text-body-sm font-medium text-muted-foreground">
                {t.rest[section.id]}
              </h3>
              <ul data-hub-list className="overflow-hidden rounded-lg border border-border bg-card">
                <AnimatePresence initial={false}>
                  {section.groups.map((group) => {
                    const { lead } = group;
                    const available = availableAction(lead);
                    const action = available?.action;
                    const link = linkOf(lead);
                    return (
                      <InboxRow
                        key={lead.id}
                        group={group}
                        rowProps={rows.rowProps(lead.id)}
                        archivedView={archivedView}
                        link={link}
                        onOpen={() => markRead(group)}
                        onToggleRead={() => toggleRead(group)}
                        onArchive={() => archive(group)}
                        onRestore={() => restore(group)}
                        action={
                          action && lead.card ? (
                            <Button
                              size="sm"
                              variant={lead.id === filledId ? 'primary' : 'outline'}
                              aria-describedby={`inbox-${lead.id}`}
                              aria-keyshortcuts={
                                action === 'claim'
                                  ? 'c'
                                  : action === 'decide'
                                    ? 'd'
                                    : action === 'acknowledge'
                                      ? 'a'
                                      : undefined
                              }
                              onClick={() => {
                                markRead(group);
                                if (lead.card) run(asCard(lead.card), action);
                              }}
                            >
                              {kit.actions[action]}
                            </Button>
                          ) : link ? (
                            <AppLink
                              view={link.view}
                              query={link.query}
                              onClick={() => markRead(group)}
                              className={linkButtonClass}
                            >
                              {fmt(t.row.openView, { view: nav[link.view] ?? '' })}
                            </AppLink>
                          ) : lead.data.action && lead.card ? (
                            <StatusBadge status={lead.card.status} />
                          ) : undefined
                        }
                      />
                    );
                  })}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
        {list.hasNextPage && (
          <Button
            className="self-center"
            busy={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            {t.older}
          </Button>
        )}
      </section>

      {(!!archivedCount || archivedView) && (
        <button
          type="button"
          onClick={() => setQuery({ archived: archivedView ? null : '1' })}
          className={cn(
            'hit-44 self-start rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline',
            focusRing,
          )}
        >
          {archivedView ? t.archive.hide : fmt(t.archive.show, { n: archivedCount ?? 0 })}
        </button>
      )}
    </PageContainer>
  );
}
