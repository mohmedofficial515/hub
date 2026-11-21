import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BellOff, CheckCheck, CircleCheck, Inbox } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import type { InboxItem, InboxKind } from '@lab/mocks/hub-app/inbox';
import {
  actedOn,
  actionsFor,
  AppLink,
  archiveInbox,
  awaitedAction,
  Button,
  cn,
  dayKey,
  EmptyState,
  ErrorState,
  FilterBar,
  fmt,
  focusRing,
  getCard,
  kitMessages,
  LoadingRegion,
  markInboxRead,
  markInboxUnread,
  matchKey,
  navigate,
  nowMs,
  openCard,
  PageContainer,
  PageHeader,
  plural,
  rememberMine,
  restoreInbox,
  SectionHeader,
  setQuery,
  shortcutsEnabled,
  showToast,
  Skeleton,
  SkeletonRows,
  StatusBadge,
  useAwaiting,
  useCardStoreVersion,
  useFilter,
  useInbox,
  useKeyboardList,
  usePerformAction,
  useSession,
  type CardAction,
} from '../../kit';
import { messages, type KindFamily } from './i18n';
import { InboxRow, linkButtonClass, type InboxGroup } from './parts/row';

const FAMILY: Record<InboxKind, KindFamily> = {
  routed_decision: 'routed',
  routed_need: 'routed',
  routed_handoff: 'routed',
  escalation: 'routed',
  task_ready: 'routed',
  mention: 'mention',
  watch_update: 'watch',
  unblocked: 'watch',
  deadline_reminder: 'reminder',
  brief: 'brief',
  system: 'system',
};
const FAMILIES: KindFamily[] = ['routed', 'mention', 'watch', 'reminder', 'brief', 'system'];
const GROUP_MS = 30 * 60_000;

/** 04 §3.17: the API sends flat items, the client merges a `groupKey` within 30 minutes. A read item never hides behind an unread one. */
function groupItems(items: InboxItem[]): InboxGroup[] {
  const out: InboxGroup[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && item.groupKey && last.lead.groupKey === item.groupKey && !last.lead.readAt === !item.readAt && Date.parse(last.lead.createdAt) - Date.parse(item.createdAt) <= GROUP_MS) {
      last.ids.push(item.id);
      last.more += 1;
      last.unread ||= !item.readAt;
    } else {
      out.push({ lead: item, ids: [item.id], more: 0, unread: !item.readAt });
    }
  }
  return out;
}

export default function Page() {
  const { scenario } = useSession();
  return <InboxPage key={scenario} />;
}

function InboxPage() {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { scenario, roles, me, loading, error } = useSession();
  useCardStoreVersion();
  const perform = usePerformAction();
  const stack = useAwaiting();
  const items = useInbox(scenario);
  const heading = useRef<HTMLHeadingElement>(null);
  const [said, setSaid] = useState('');

  // The wireframe's default: what is unread, newest first. All is one press away (review M9).
  const showAll = useFilter('show') === 'all';
  const awaitingOnly = useFilter('awaiting') === 'me';
  const kind = useFilter('kind') as KindFamily | null;
  const archivedView = useFilter('archived') === '1';

  const live = items.filter((i) => !i.archivedAt);
  const unreadTotal = live.filter((i) => !i.readAt).length;
  const archivedItems = items.filter((i) => i.archivedAt);
  const stackKeys = useMemo(() => new Set(stack.map((c) => c.key)), [stack]);

  const groups = useMemo(() => {
    const source = archivedView ? archivedItems : live.filter((i) => (!kind || FAMILY[i.kind] === kind) && (showAll || !i.readAt) && (!awaitingOnly || (!!i.cardKey && stackKeys.has(i.cardKey))));
    return groupItems(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, stackKeys, awaitingOnly, archivedView, showAll, kind]);

  const nowKey = dayKey(nowMs());
  const yesterdayKey = dayKey(nowMs() - 86_400_000);
  const sections = useMemo(() => {
    const buckets: { id: string; title: string; groups: InboxGroup[] }[] = [
      { id: 'today', title: t.rest.today, groups: [] },
      { id: 'yesterday', title: t.rest.yesterday, groups: [] },
      { id: 'earlier', title: t.rest.earlier, groups: [] },
    ];
    for (const g of groups) {
      const k = dayKey(g.lead.createdAt);
      buckets[k === nowKey ? 0 : k === yesterdayKey ? 1 : 2].groups.push(g);
    }
    return buckets.filter((b) => b.groups.length);
  }, [groups, nowKey, yesterdayKey, t.rest]);

  const ordered = sections.flatMap((s) => s.groups);
  const rowIds = ordered.map((g) => g.lead.id);
  const byId = new Map<string, InboxGroup>(groups.map((g) => [g.lead.id, g] as const));

  /** The action this card still offers me. A notification's button follows the card, and goes away once nothing is left to do. */
  const availableAction = (cardKey: string | null, wanted?: string) => {
    if (!cardKey || !wanted) return null;
    const card = getCard(cardKey);
    return card ? (awaitedAction(card, roles, me.id) ?? null) : null;
  };

  // The one filled button: the newest row that asks something of me.
  const filledId = archivedView
    ? undefined
    : ordered.find((g) => {
        const action = availableAction(g.lead.cardKey, g.lead.action);
        return action && !action.selfVerify;
      })?.lead.id;

  const runAction = (cardKey: string, action: CardAction) => {
    const card = getCard(cardKey);
    if (!card) return;
    const mode = actionsFor(card, roles, me.id).find((a) => a.action === action)?.mode;
    if (mode === 'now') perform(cardKey, action);
    else openCard(cardKey, { action });
  };

  const markRead = (ids: string[]) => {
    const unread = ids.filter((id) => !items.find((i) => i.id === id)?.readAt);
    return unread.length ? markInboxRead(unread) : () => {};
  };

  /** 09 §15: opening an item marks it read and opens the sheet on the quick action. */
  const openGroup = (group: InboxGroup) => {
    markRead(group.ids);
    const { lead } = group;
    if (lead.cardKey) openCard(lead.cardKey, { action: availableAction(lead.cardKey, lead.action)?.action });
    else if (lead.link) navigate(lead.link.view, { query: lead.link.query });
  };

  /** `e` flips the lead item only, so pressing it twice is always back where it started. */
  const toggleRead = (group: InboxGroup) => {
    const { lead } = group;
    if (!lead.readAt) {
      const undo = markInboxRead([lead.id]);
      setSaid(t.row.readNow);
      // In the Unread view the row leaves at once, so the way back has to be on screen.
      if (!showAll && !archivedView) showToast({ message: t.row.readNow, onUndo: undo });
    } else {
      markInboxUnread([lead.id]);
      setSaid(t.row.unreadNow);
    }
  };

  const archive = (group: InboxGroup) => {
    const undo = archiveInbox(group.ids);
    showToast({ message: t.row.archived, onUndo: undo });
  };
  const restore = (group: InboxGroup) => {
    const undo = restoreInbox(group.ids);
    showToast({ message: t.row.restored, onUndo: undo });
  };

  const markAll = () => {
    const ids = live.filter((i) => !i.readAt).map((i) => i.id);
    if (!ids.length) return;
    const undo = markInboxRead(ids);
    showToast({ message: plural(ids.length, locale, t.markedAll), onUndo: undo });
  };

  const quick = (action: CardAction) => (id: string) => {
    const group = byId.get(id);
    if (group?.lead.cardKey && availableAction(group.lead.cardKey, group.lead.action)?.action === action) {
      markRead(group.ids);
      runAction(group.lead.cardKey, action);
    }
  };

  const list = useKeyboardList({
    ids: rowIds,
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
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      e.preventDefault();
      markAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const header = (
    <PageHeader
      title={t.title}
      // An empty inbox has one sentence, in its empty state (review M8).
      meta={loading ? <Skeleton className="mt-1.5 h-4 w-44" /> : error || items.length === 0 ? undefined : plural(unreadTotal, locale, t.summary.unread)}
      actions={
        !loading && !error && live.length > 0 ? (
          <Button onClick={markAll} disabled={unreadTotal === 0} aria-keyshortcuts="Shift+E">
            <CheckCheck aria-hidden className="size-4" strokeWidth={1.75} />
            {unreadTotal === 0 ? t.allRead : t.markAll}
          </Button>
        ) : undefined
      }
    />
  );

  if (error) {
    return (
      <PageContainer className="max-w-200">
        {header}
        <ErrorState thing={t.errorThing} code="hub.inbox.unavailable" requestId="req_31bc07e" onRetry={() => setQuery({ scenario: null })} />
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

  if (items.length === 0) {
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
          selects={[{ param: 'kind', label: t.filters.kind, any: t.filters.anyKind, options: FAMILIES.map((f) => ({ value: f, label: t.filters.kinds[f] })) }]}
        />
      )}

      {/* The cards that wait have their page. This only says how many, and goes there (review M9). */}
      {!archivedView && stack.length > 0 && (
        <p className="text-body text-muted-foreground">
          <AppLink view="today" className={cn('hit-44 rounded-sm font-medium text-primary underline-offset-4 hover:underline', focusRing)}>
            {plural(stack.length, locale, t.waitingLine)}
          </AppLink>
        </p>
      )}

      <section aria-labelledby="inbox-rest" className="flex flex-col gap-3">
        <SectionHeader ref={heading} id="inbox-rest" title={archivedView ? t.archive.title : showAll ? t.rest.all : t.rest.unread} count={groups.reduce((sum, g) => sum + g.ids.length, 0)} />

        {nothing &&
          (kind || awaitingOnly ? (
            <EmptyState icon={BellOff} title={kind ? t.empty.kindTitle : t.empty.needsTitle} action={<Button onClick={clearFilters}>{t.filters.clear}</Button>}>
              {kind ? t.empty.kindBody : t.empty.needsBody}
            </EmptyState>
          ) : archivedView ? (
            <EmptyState icon={BellOff} title={t.archive.empty} />
          ) : (
            <EmptyState icon={CircleCheck} title={t.empty.unreadTitle} action={showAll ? undefined : <Button onClick={() => setQuery({ show: 'all' })}>{t.filters.showAll}</Button>}>
              {t.empty.unreadBody}
            </EmptyState>
          ))}

        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={`inbox-day-${section.id}`} className="flex flex-col gap-1.5">
              <h3 id={`inbox-day-${section.id}`} className="text-body-sm font-medium text-muted-foreground">
                {section.title}
              </h3>
              <ul data-hub-list className="overflow-hidden rounded-lg border border-border bg-card">
                <AnimatePresence initial={false}>
                  {section.groups.map((group) => {
                    const { lead } = group;
                    const available = availableAction(lead.cardKey, lead.action);
                    const action = available?.action;
                    const card = lead.cardKey ? getCard(lead.cardKey) : undefined;
                    return (
                      <InboxRow
                        key={lead.id}
                        group={group}
                        rowProps={list.rowProps(lead.id)}
                        archivedView={archivedView}
                        onOpen={() => markRead(group.ids)}
                        onToggleRead={() => toggleRead(group)}
                        onArchive={() => archive(group)}
                        onRestore={() => restore(group)}
                        action={
                          action && lead.cardKey ? (
                            <Button
                              size="sm"
                              variant={lead.id === filledId ? 'primary' : 'outline'}
                              aria-describedby={`inbox-${lead.id}`}
                              aria-keyshortcuts={action === 'claim' ? 'c' : action === 'decide' ? 'd' : action === 'acknowledge' ? 'a' : undefined}
                              onClick={() => {
                                markRead(group.ids);
                                runAction(lead.cardKey!, action);
                              }}
                            >
                              {kit.actions[action]}
                            </Button>
                          ) : lead.link ? (
                            <AppLink view={lead.link.view} query={lead.link.query} onClick={() => markRead(group.ids)} className={linkButtonClass}>
                              {lead.link.view === 'today' ? t.row.openToday : t.row.openSettings}
                            </AppLink>
                          ) : lead.action && card && actedOn(card.key) ? (
                            <StatusBadge status={card.status} />
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
      </section>

      {(archivedItems.length > 0 || archivedView) && (
        <button type="button" onClick={() => setQuery({ archived: archivedView ? null : '1' })} className={cn('hit-44 self-start rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline', focusRing)}>
          {archivedView ? t.archive.hide : fmt(t.archive.show, { n: archivedItems.length })}
        </button>
      )}
    </PageContainer>
  );
}
