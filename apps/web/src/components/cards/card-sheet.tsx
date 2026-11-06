'use client';

/**
 * @file card-sheet.tsx
 * @description The card sheet: a plain region in the layout, not a dialog, because a non-modal dialog still loops focus and Tab could never reach an approval in the panel beside it (docs/16 D54, v6-edge-strip-port). It opens from the URL, on any page. Contract: apps/web/README.md.
 */
import type { WorkReport } from '@hub/contracts';
import { motion } from 'framer-motion';
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Link2,
  ListChecks,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { DropdownMenu, Tabs } from 'radix-ui';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ActorChip, Avatar } from '@/components/cards/avatar';
import { PriorityBadge, RoleBadge, StatusBadge, TypeBadge } from '@/components/cards/badges';
import { CardChip } from '@/components/cards/card-key';
import { focusRing, focusRingInset } from '@/components/cards/meta';
import { sheetSections } from '@/components/cards/sheet-sections';
import { CopyButton, copyText } from '@/components/common/copy-button';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { MarkdownView } from '@/components/common/markdown';
import { RelativeTime } from '@/components/common/relative-time';
import { ErrorState, LoadingRegion, Skeleton, SkeletonRows } from '@/components/common/states';
import { Bidi, fmt, Ltr } from '@/components/common/text';
import { showToast } from '@/components/common/toast';
import {
  closeCard,
  openCard,
  setQuery,
  type SheetTab,
  takeOpener,
  useRoute,
} from '@/components/shell/router';
import { Button, IconButton } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { detectSecret, Field, SecretFilterError, Select, Textarea, TextInput } from '@/components/ui/form';
import { Tip, usingKeyboard } from '@/components/ui/rich-tip';
import { tabTriggerClass } from '@/components/ui/tabs-class';
import { Tooltip } from '@/components/ui/tooltip';
import { SheetClaudeBar } from '@/components/workbench/panels';
import { checksLine, MarkInline, moveText, ReportBody } from '@/components/workbench/protocol';
import { panelOwes, useMaybeWb, wasFollowOpened } from '@/components/workbench/store';
import type { ChatMessages } from '@/components/workbench/words';
import { actionsFor, type AvailableAction, usePerformAction } from '@/features/cards/actions';
import { eventFacts } from '@/features/cards/history';
import {
  addComment,
  addLink,
  getCard,
  setArchived,
  toggleWatch,
  useCardComments,
  useCardEvents,
  useCardQuery,
} from '@/features/cards/store';
import type { CardLink, HubCard, LinkKind } from '@/features/cards/types';
import { useWorkReports } from '@/features/chat/queries';
import { useSession } from '@/features/session/session';
import { useMembers } from '@/features/session/session';
import { isHubError } from '@/lib/api/errors';
import { plural } from '@/lib/format';
import { portalRoot } from '@/lib/hooks';
import { useLocale, useT } from '@/lib/i18n';
import { actionName, type CardAction, eventLabel, kitMessages } from '@/lib/i18n';
import { listRowIds, restoreFocus } from '@/lib/keyboard-list';
import { matchKey } from '@/lib/keys';
import { shortcutsEnabled } from '@/lib/preferences';
import { cn } from '@/lib/utils';

const EASE = [0.2, 0.8, 0.2, 1] as const;

const isCardAction = (v: string | null): v is CardAction => !!v;

const hasOwnText = (card: HubCard) => (card.type === 'task' ? !!card.task.acceptance : card.type !== 'need');

function ActionBar({ card, action }: { card: HubCard; action: CardAction | null }) {
  const t = useT(kitMessages);
  // Its filled button steps down while the panel beside it owes the owner an answer, so one thing on screen is asking at a time (review M11).
  const owes = panelOwes(useMaybeWb());
  const { roles, me } = useSession();
  const perform = usePerformAction();
  const available = actionsFor(card, roles, me.id);
  const [confirm, setConfirm] = useState<AvailableAction | null>(null);

  const run = (a: AvailableAction) => {
    if (a.mode === 'form') setQuery({ action: action === a.action ? null : a.action });
    else if (a.mode === 'confirm') setConfirm(a);
    else perform(card.key, a.action);
  };

  const { watching } = card;
  return (
    <div role="group" aria-label={t.sheet.actionsLabel} className="flex flex-wrap items-center gap-2">
      {available.map((a, i) => {
        const button = (
          <Button
            key={a.action}
            // One filled button: while a form is open it is the form's save. A self-verify is never filled (owner decision 2026-11-04).
            variant={
              i === 0 && a.enabled && !action && !a.selfVerify && !owes
                ? 'primary'
                : a.destructive
                  ? 'destructive'
                  : 'outline'
            }
            disabled={!a.enabled}
            aria-pressed={a.mode === 'form' ? action === a.action : undefined}
            data-sheet-primary={i === 0 && a.enabled ? true : undefined}
            onClick={() => run(a)}
          >
            {actionName(t, card.type, a.action)}
          </Button>
        );
        if (a.enabled || !a.needsRole) return button;
        // A disabled button cannot take focus, so the tooltip wraps a focusable span naming the role (08 §5.6).
        return (
          <Tooltip key={a.action} content={fmt(t.error.forbiddenRole, { role: t.roles[a.needsRole] })}>
            <span tabIndex={0} className={cn('rounded-md', focusRing)}>
              {button}
            </span>
          </Tooltip>
        );
      })}
      <IconButton
        label={watching ? t.sheet.unwatch : t.sheet.watch}
        aria-pressed={watching}
        variant="outline"
        aria-keyshortcuts="w"
        onClick={() => void toggleWatch(card, me.id)}
      >
        {watching ? (
          <EyeOff aria-hidden className="size-4" strokeWidth={1.75} />
        ) : (
          <Eye aria-hidden className="size-4" strokeWidth={1.75} />
        )}
      </IconButton>
      <CopyButton text={card.key} showText={false} label={t.sheet.copyKey} />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm ? `${actionName(t, card.type, confirm.action)} ${card.key}` : ''}
        confirmLabel={confirm ? actionName(t, card.type, confirm.action) : ''}
        reason={!!confirm?.reason}
        onConfirm={(reason) => confirm && perform(card.key, confirm.action, { reason })}
      />
    </div>
  );
}

function CommentsTab({ card }: { card: HubCard }) {
  const t = useT(kitMessages);
  const id = useId();
  const [text, setText] = useState('');
  const secret = detectSecret(text);
  const send = () => {
    const body = text.trim();
    if (!body || secret) return;
    addComment(card.key, body)
      .then(() => setText(''))
      .catch((error: unknown) =>
        showToast({ message: isHubError(error) ? error.message : t.actionFailed, tone: 'error' }),
      );
  };
  return (
    <div className="flex flex-col gap-4">
      {card.comments.length === 0 ? (
        <p className="text-body text-muted-foreground">{t.sheet.comments.empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {card.comments.map((c) => (
            <li key={c.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 text-body-sm">
                <ActorChip kind={c.authorKind} memberId={c.authorId} />
                <RelativeTime iso={c.at} className="text-muted-foreground" />
              </div>
              <p className="text-body text-foreground">
                {c.redacted ? (
                  <em className="text-muted-foreground">{t.sheet.comments.redacted}</em>
                ) : (
                  <Bidi>{c.body}</Bidi>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-2 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Field id={id} label={t.sheet.comments.label} hint={t.sheet.comments.hint}>
          <Textarea
            id={id}
            dir="auto"
            rows={3}
            value={text}
            placeholder={t.sheet.comments.placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (matchKey(e, 'Enter') && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                send();
              }
            }}
          />
        </Field>
        {secret && <SecretFilterError pattern={secret} />}
        <Button type="submit" className="self-start" disabled={!text.trim() || !!secret}>
          {t.sheet.comments.send}
        </Button>
      </form>
    </div>
  );
}

/** "field: from → to" rows (09 §14), of the fields a member can read; the arrow mirrors because it follows the reading direction. */
function EventData({ data }: { data: Record<string, unknown> }) {
  const t = useT(kitMessages);
  const h = t.sheet.history;
  const members = useMembers().data ?? [];
  const { change, rows } = eventFacts(data, h.fieldNames, (id) => members.find((m) => m.id === id)?.name);
  if (!change && !rows.length) return null;
  const Value = ({ value }: { value: string | null }) => {
    if (value === null) return <span>{h.values['none']}</span>;
    const known = t.status[value] ?? h.values[value];
    return known ? <span>{known}</span> : <Bidi>{value}</Bidi>;
  };
  return (
    <dl className="mt-1 flex flex-col gap-0.5 text-body-sm text-muted-foreground">
      {change && (
        <div className="flex flex-wrap items-center gap-1.5">
          {change.label && <dt className="font-medium">{change.label}:</dt>}
          <dd className="flex flex-wrap items-center gap-1.5">
            <Value value={change.from} />
            <span aria-hidden className="rtl:-scale-x-100">
              →
            </span>
            <span className="text-foreground">
              <Value value={change.to} />
            </span>
          </dd>
        </div>
      )}
      {rows.map((row) => (
        <div key={row.key} className="flex flex-wrap gap-1.5">
          <dt className="font-medium">{row.label}:</dt>
          <dd className="min-w-0 break-words">
            <Value value={row.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function HistoryTab({ card }: { card: HubCard }) {
  const t = useT(kitMessages);
  const events = [...card.events].reverse();
  const viaName = (via: string) => t.sheet.history.viaNames[via];
  if (!events.length) return <p className="text-body text-muted-foreground">{t.sheet.history.empty}</p>;
  return (
    <ol className="flex flex-col gap-4">
      {events.map((e) => (
        <li key={e.id} className="text-body">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ActorChip kind={e.actorKind} memberId={e.actorId} adapter={e.adapter} />
            <span className="text-foreground">{eventLabel(t, e)}</span>
            <RelativeTime iso={e.at} className="text-body-sm text-muted-foreground" />
            {viaName(e.via) && (
              <span className="text-body-sm text-muted-foreground">
                {fmt(t.sheet.history.via, { via: viaName(e.via) ?? '' })}
              </span>
            )}
          </div>
          <EventData data={e.data} />
        </li>
      ))}
    </ol>
  );
}

function LinksTab({ card }: { card: HubCard }) {
  const t = useT(kitMessages);
  const id = useId();
  const [other, setOther] = useState('');
  const [kind, setKind] = useState<LinkKind>('relates');
  const [error, setError] = useState<string | null>(null);
  const kinds: LinkKind[] = ['blocks', 'blocked_by', 'relates', 'parent', 'duplicates'];
  const groups = kinds
    .map((k) => [k, card.links.filter((l: CardLink) => l.kind === k)] as const)
    .filter(([, list]) => list.length);

  const add = () => {
    const key = other.trim().toUpperCase();
    if (key === card.key) return setError(t.sheet.links.self);
    if (!getCard(key)) return setError(t.sheet.links.invalid);
    void addLink(card.key, kind, key);
    setOther('');
    setError(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {groups.length === 0 ? (
        <p className="text-body text-muted-foreground">{t.sheet.links.empty}</p>
      ) : (
        groups.map(([k, list]) => (
          <div key={k} className="flex flex-col gap-1.5">
            <h3 className="text-body font-semibold text-foreground">{t.sheet.links.kinds[k]}</h3>
            <ul className="flex flex-col gap-2">
              {list.map((l) => (
                <li key={`${l.kind}-${l.key}`}>
                  <CardChip k={l.key} showTitle showStatus className="h-auto min-h-8 py-1" />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <form
        className="grid gap-2 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Field id={`${id}-key`} label={t.sheet.links.key} error={error}>
          <TextInput
            id={`${id}-key`}
            dir="ltr"
            className="key text-start"
            placeholder="GTV-123"
            value={other}
            onChange={(e) => setOther(e.target.value)}
          />
        </Field>
        <Field id={`${id}-kind`} label={t.sheet.links.kind}>
          <Select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value as LinkKind)}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {t.sheet.links.kinds[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" className="sm:mt-6.5" disabled={!other.trim()}>
          {t.sheet.links.add}
        </Button>
      </form>
    </div>
  );
}

/** The list the page gave, with `j` and `k` as on the lists. Only while the page has stepped aside (D54). */
function SheetNav({ cardKey }: { cardKey: string }) {
  const w = useT<ChatMessages>('chat').panel;
  const locale = useLocale();
  const list = listRowIds();
  const at = list.indexOf(cardKey);
  const prev = at > 0 ? list[at - 1] : undefined;
  const next = at >= 0 ? list[at + 1] : undefined;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || !shortcutsEnabled()) return;
      if (el.closest('input, textarea, select, [role="menu"], [role="dialog"]')) return;
      if (matchKey(e, 'j') && next) openCard(next);
      if (matchKey(e, 'k') && prev) openCard(prev);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);
  const Prev = locale === 'ar' ? ChevronRight : ChevronLeft;
  const Next = locale === 'ar' ? ChevronLeft : ChevronRight;
  const s = w.pro.sheetNav;
  return (
    <div role="group" aria-label={s.label} data-wb-sheet-nav className="flex shrink-0 items-center">
      <Tip content={{ what: prev ? fmt(s.prevTip, { key: prev }) : s.none }} keys={['k']} side="bottom">
        <IconButton
          label={s.prev}
          title={undefined}
          data-wb-sheet-prev
          disabled={!prev}
          onClick={() => prev && openCard(prev)}
        >
          <Prev aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
      </Tip>
      <Tip content={{ what: next ? fmt(s.nextTip, { key: next }) : s.none }} keys={['j']} side="bottom">
        <IconButton
          label={s.next}
          title={undefined}
          data-wb-sheet-next
          disabled={!next}
          onClick={() => next && openCard(next)}
        >
          <Next aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
      </Tip>
    </div>
  );
}

/**
 * Reports from `report_work`, folded to one line each that says what stands: verified or claimed, and how many files. The summary stays in the panel's report when the same card is open beside it, so the two do not repeat each other. The move, or the reason for none, is the card's own state above, and the line says why.
 */
function Evidence({ cardKey }: { cardKey: string }) {
  const w = useT<ChatMessages>('chat').panel;
  const locale = useLocale();
  const reports = useWorkReports(cardKey).data ?? [];
  const [open, setOpen] = useState<string | null>(null);
  if (reports.length === 0) return null;
  const r = w.pro.report;
  const line = (report: WorkReport) =>
    fmt(r.line, {
      checks: checksLine(report, w),
      files: fmt(plural(report.changedFiles.length, locale, r.filesCount), { n: report.changedFiles.length }),
    });
  return (
    <section aria-label={r.evidence} data-wb-evidence className="flex min-w-0 flex-col gap-1">
      <h3 className="flex items-center gap-2 text-body-sm font-medium text-muted-foreground">
        <ListChecks aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        {r.evidence}
      </h3>
      {reports.map((report) => (
        <div key={report.id} data-wb-evidence-row className="flex min-w-0 flex-col gap-2">
          <Tip k="evidence:check" align="start">
            <button
              type="button"
              data-wb-evidence-toggle
              aria-expanded={open === report.id}
              onClick={() => setOpen(open === report.id ? null : report.id)}
              className={cn(
                'flex min-h-11 w-full min-w-0 items-start gap-2 rounded-sm text-start text-body-sm text-foreground hover:bg-accent md:min-h-7',
                focusRing,
              )}
            >
              <span className="min-w-0 flex-1">{line(report)}</span>
              <ChevronDown
                aria-hidden
                className={cn(
                  'mt-0.5 size-3.5 shrink-0 text-muted-foreground',
                  open === report.id && 'rotate-180',
                )}
                strokeWidth={1.75}
              />
            </button>
          </Tip>
          {open === report.id && <ReportBody report={report} />}
          {open === report.id && !report.move.moved && (
            <p className="text-body-sm text-muted-foreground">
              <MarkInline text={moveText(report, w)} />
            </p>
          )}
        </div>
      ))}
    </section>
  );
}

function SheetBody({
  cardKey,
  action,
  tab,
  onAsk,
  stepAside,
}: {
  cardKey: string;
  action: CardAction | null;
  tab: SheetTab;
  onAsk?: (() => void) | undefined;
  stepAside?: string | undefined;
}) {
  const t = useT(kitMessages);
  const w = useT<ChatMessages>('chat').panel;
  const wb = useMaybeWb();
  const locale = useLocale();
  const query = useCardQuery(cardKey);
  const events = useCardEvents(cardKey);
  const comments = useCardComments(cardKey);
  // History and Comments are their own queries, so a new comment does not reload the card, and the tabs read them like its fields.
  const card = useMemo(
    () =>
      query.data ? { ...query.data, events: events.data ?? [], comments: comments.data ?? [] } : undefined,
    [query.data, events.data, comments.data],
  );
  const perform = usePerformAction();
  const { me } = useSession();
  const members = useMembers().data ?? [];
  const [archive, setArchive] = useState(false);
  const cardRef = useRef(card);
  cardRef.current = card;

  // A deep link focuses the title and not an action, so Enter claims nothing. What took focus meanwhile, such as an action's form, keeps it.
  const settled = !query.isPending;
  const landed = useRef(false);
  useEffect(() => {
    if (!settled || landed.current) return;
    landed.current = true;
    const active = document.activeElement;
    const root = document.querySelector<HTMLElement>('[data-card-sheet]');
    if (
      !root ||
      (active &&
        active !== document.body &&
        root.contains(active) &&
        !active.hasAttribute('data-sheet-title'))
    )
      return;
    if (active && active !== document.body && !root.contains(active)) return;
    focusSheetTitle();
  }, [settled]);

  // `w` toggles watch, Ctrl/Cmd+Shift+C copies the key (08 §12).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if ((e.ctrlKey || e.metaKey) && matchKey(e, 'C')) {
        e.preventDefault();
        void copyText(cardKey);
        showToast({ message: t.copy.copied });
        return;
      }
      if (
        matchKey(e, 'w') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        shortcutsEnabled() &&
        !el.closest('input, textarea, select')
      ) {
        e.preventDefault();
        if (cardRef.current) void toggleWatch(cardRef.current, me.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cardKey, me.id, t.copy.copied]);
  if (!card && query.isPending) {
    return (
      <>
        <div className="flex items-center justify-end p-3">
          <IconButton label={t.close} data-sheet-close onClick={() => closeCard()}>
            <X aria-hidden className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>
        <h2 tabIndex={-1} data-sheet-title className="sr-only">
          {fmt(t.sheet.label, { key: cardKey })}
        </h2>
        <LoadingRegion label={fmt(t.sheet.label, { key: cardKey })}>
          <div className="flex flex-col gap-4 p-4 md:p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-full" />
            <SkeletonRows count={3} />
          </div>
        </LoadingRegion>
      </>
    );
  }
  if (!card && query.isError && !isHubError(query.error, 'hub.cards.not_found')) {
    return (
      <>
        <div className="flex items-center justify-end p-3">
          <IconButton label={t.close} data-sheet-close onClick={() => closeCard()}>
            <X aria-hidden className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>
        <h2 tabIndex={-1} data-sheet-title className="sr-only">
          {fmt(t.sheet.label, { key: cardKey })}
        </h2>
        <ErrorState
          title={t.sheet.notLoaded}
          code={isHubError(query.error) ? query.error.code : undefined}
          onRetry={() => void query.refetch()}
        />
      </>
    );
  }

  if (!card) {
    return (
      <>
        <div className="flex items-center justify-end p-3">
          <IconButton label={t.close} data-sheet-close onClick={() => closeCard()}>
            <X aria-hidden className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>
        <h2 tabIndex={-1} data-sheet-title className="sr-only">
          {fmt(t.sheet.label, { key: cardKey })}
        </h2>
        <ErrorState title={fmt(t.sheet.notFound, { key: cardKey })} code="404" />
        <p className="px-6 text-center text-body text-muted-foreground">{t.sheet.notFoundBody}</p>
      </>
    );
  }

  const Section = sheetSections[card.type];
  // The API's answer for this member: owner, pm and the card's creator (D28).
  const canArchive = card.allowedActions.includes(card.archivedAt ? 'card.restore' : 'card.delete');
  const restoreCard = () =>
    void setArchived(card.key, false).catch((error: unknown) =>
      showToast({ tone: 'error', message: isHubError(error) ? error.message : t.actionFailed }),
    );
  const copyLink = () => void copyText(location.href).then(() => showToast({ message: t.copy.copied }));

  return (
    <>
      <header className="flex shrink-0 flex-col gap-2.5 border-b border-border p-4 md:px-6 md:pt-5">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <TypeBadge type={card.type} />
            <Ltr mono className="text-body-sm text-muted-foreground">
              {card.key}
            </Ltr>
            <StatusBadge status={card.status} />
            {card.flags?.overdue && (
              <StatusBadge
                status="overdue"
                className="bg-destructive-soft text-destructive-soft-foreground"
              />
            )}
            {card.flags?.escalated && <StatusBadge status="escalated" />}
            <PriorityBadge priority={card.priority} />
          </div>
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
                className="z-[75] min-w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
              >
                <DropdownMenu.Item onSelect={copyLink} className={menuItemClass}>
                  <Link2 aria-hidden className="size-4" strokeWidth={1.75} />
                  {t.sheet.copyLink}
                </DropdownMenu.Item>
                {canArchive && (
                  <DropdownMenu.Item
                    onSelect={() => (card.archivedAt ? restoreCard() : setArchive(true))}
                    className={menuItemClass}
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
          {stepAside && <SheetNav cardKey={card.key} />}
          {stepAside ? (
            <Button size="sm" variant="ghost" data-sheet-close data-wb-step-back onClick={() => closeCard()}>
              <ArrowRight aria-hidden className="size-4 ltr:-scale-x-100" strokeWidth={1.75} />
              {fmt(w.pro.stepAside, { page: stepAside })}
            </Button>
          ) : (
            <IconButton label={t.close} data-sheet-close onClick={() => closeCard()}>
              <X aria-hidden className="size-4" strokeWidth={1.75} />
            </IconButton>
          )}
        </div>
        <h2
          tabIndex={-1}
          data-sheet-title
          className="rounded-sm text-title font-semibold text-pretty text-foreground outline-none"
        >
          <Bidi>{card.title}</Bidi>
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
          {card.ownerRole && <RoleBadge role={card.ownerRole} routed={me.roles.includes(card.ownerRole)} />}
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span>{t.sheet.created}</span>
            <ActorChip
              kind={card.createdByKind}
              memberId={card.createdById}
              adapter={card.events[0]?.adapter}
            />
            <RelativeTime iso={card.createdAt} />
          </span>
          {card.repo && !card.branch && (
            <code dir="ltr" translate="no" className="key">
              {card.repo}
            </code>
          )}
          {card.watchers.length > 0 && (
            <span
              className="inline-flex items-center -space-x-1 rtl:space-x-reverse"
              title={t.sheet.watching}
            >
              {card.watchers.slice(0, 3).map((id) => (
                <Avatar
                  key={id}
                  member={members.find((m) => m.id === id)}
                  size="xs"
                  className="rounded-full ring-2 ring-background"
                />
              ))}
            </span>
          )}
        </div>
        <ActionBar card={card} action={action} />
        {wb && <SheetClaudeBar cardKey={card.key} onAsk={onAsk} />}
        {card.archivedAt && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-warning-soft px-3 py-2 text-body-sm text-warning-soft-foreground">
            <p>
              {fmt(t.sheet.archived, { when: '' })} <RelativeTime iso={card.archivedAt} />
            </p>
            {canArchive && (
              <Button size="sm" className="ms-auto" onClick={restoreCard}>
                {t.sheet.restore}
              </Button>
            )}
          </div>
        )}
      </header>

      <Tabs.Root
        value={tab}
        onValueChange={(next) => setQuery({ tab: next === 'details' ? null : next })}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs.List
          aria-label={t.sheet.label.replace('{key}', card.key)}
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 [scrollbar-width:none] md:px-4"
        >
          {(
            [
              ['details', t.sheet.tabs.details, null],
              ['comments', t.sheet.tabs.comments, comments.data ? card.comments.length : card.commentCount],
              ['history', t.sheet.tabs.history, events.data ? card.events.length : null],
              ['links', t.sheet.tabs.links, card.links.length],
            ] as const
          ).map(([value, label, count]) => (
            <Tabs.Trigger key={value} value={value} className={tabTriggerClass}>
              {label}
              {count !== null && <Ltr className="text-caption tabular-nums">{count}</Ltr>}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Tabs.Content
            value="details"
            className={cn('wb-sheet-measure flex flex-col gap-5 p-4 md:p-6', focusRingInset)}
          >
            <Evidence cardKey={card.key} />
            {/* A plan's body is its Markdown, in its section. In a form the field holds the text. */}
            {card.body && card.type !== 'plan' && action !== ('edit' as CardAction) ? (
              // The sheet's title is an h2, so a body's `##` is an h3.
              <MarkdownView
                source={card.body}
                dir="auto"
                headingOffset={1}
                copyCodeLabel={t.sheet.copyCode}
              />
            ) : (
              // Most sections open on text of their own, and then "no description" above it is simply wrong (review M15).
              !hasOwnText(card) && <p className="text-body text-muted-foreground">{t.sheet.noBody}</p>
            )}
            <Section
              card={card}
              action={action}
              cancelAction={() => setQuery({ action: null })}
              perform={(a, payload) => perform(card.key, a, payload)}
            />
          </Tabs.Content>
          <Tabs.Content value="comments" className={cn('p-4 md:p-6', focusRingInset)}>
            <CommentsTab card={card} />
          </Tabs.Content>
          <Tabs.Content value="history" className={cn('p-4 md:p-6', focusRingInset)}>
            <HistoryTab card={card} />
          </Tabs.Content>
          <Tabs.Content value="links" className={cn('p-4 md:p-6', focusRingInset)}>
            <LinksTab card={card} />
          </Tabs.Content>
        </div>
      </Tabs.Root>

      <ConfirmDialog
        open={archive}
        onOpenChange={setArchive}
        title={fmt(t.sheet.archiveTitle, { key: card.key })}
        description={t.sheet.archiveBody}
        confirmLabel={t.sheet.archive}
        onConfirm={() => {
          // The toast waits for the API: a refused delete must not say it happened.
          const refused = (error: unknown) =>
            showToast({ tone: 'error', message: isHubError(error) ? error.message : t.actionFailed });
          closeCard();
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

/** A card this sheet cannot draw stays in the sheet: the page behind it is fine, and Close still works. */
function SheetCrash({ cardKey, onRetry }: { cardKey: string; onRetry: () => void }) {
  const t = useT(kitMessages);
  return (
    <>
      <div className="flex items-center justify-end p-3">
        <IconButton label={t.close} data-sheet-close onClick={() => closeCard()}>
          <X aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
      </div>
      <h2 tabIndex={-1} data-sheet-title className="sr-only">
        {fmt(t.sheet.label, { key: cardKey })}
      </h2>
      <ErrorState title={t.sheet.notLoaded} onRetry={onRetry} />
    </>
  );
}

const menuItemClass =
  'flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent md:min-h-9';

/** Focus lands on the title, never on an action. The ring shows only for someone moving by keyboard, and a pointer or a page load does not paint one. */
export function focusSheetTitle() {
  const title = document.querySelector<HTMLElement>('[data-sheet-title]');
  if (!title) return;
  title.focus({ preventScroll: true });
  if (usingKeyboard()) {
    title.setAttribute('data-wb-revealed', 'true');
    title.addEventListener('blur', () => title.removeAttribute('data-wb-revealed'), { once: true });
  }
}

/**
 * The card sheet. Render it once, where the layout wants it. It opens from the URL: `openCard(key)` anywhere, or `openCard(key, { action: 'decide' })` to open on that action.
 * Tab runs straight through it, Esc closes it only while focus is inside, and it takes focus when opened by the owner, on the title. A card brought by Follow the chat, or a pane that remounts while the owner types, takes nothing. Focus returns to what opened it, or to the row that replaced it.
 */
export function CardSheet({
  className,
  topBar,
  onAsk,
  stepAside,
}: {
  className?: string | undefined;
  topBar?: ReactNode | undefined;
  onAsk?: (() => void) | undefined;
  stepAside?: string | undefined;
}) {
  const route = useRoute();
  const key = route.cardKey;
  const actionParam = route.query.get('action');
  const action = isCardAction(actionParam) ? actionParam : null;
  const tab = (route.query.get('tab') as SheetTab | null) ?? 'details';
  const locale = useLocale();
  const t = useT(kitMessages);
  const offset = locale === 'ar' ? -32 : 32;
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!key) return;
    opener.current = takeOpener() ?? null;
    if ((document.activeElement as HTMLElement | null)?.hasAttribute('data-wb-input')) return;
    if (wasFollowOpened()) return;
    // An action's form has focused itself by now: child effects run first.
    if (document.activeElement?.closest('[data-card-sheet]')) return;
    focusSheetTitle();
  }, [key]);
  const openerRef = opener;
  useEffect(
    () => () => {
      if (!key) return;
      // The opener may be gone by now, and restoreFocus knows where to go then.
      if (!document.activeElement || document.activeElement === document.body)
        restoreFocus(openerRef.current);
    },
    [key, openerRef],
  );
  if (!key) return null;
  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    // A menu or dialog inside the sheet handles its own Esc first, and marks it.
    if (matchKey(e, 'Escape') && !e.defaultPrevented) {
      e.preventDefault();
      closeCard();
    }
  };
  return (
    <motion.section
      aria-label={fmt(t.sheet.label, { key })}
      data-card-sheet
      onKeyDown={onKeyDown}
      className={cn('flex flex-col bg-background text-foreground outline-none', className)}
      initial={{ opacity: 0, x: offset }}
      animate={{ opacity: 1, x: 0, transition: { duration: 0.2, ease: EASE } }}
    >
      {topBar}
      <ErrorBoundary key={key} fallback={(reset) => <SheetCrash cardKey={key} onRetry={reset} />}>
        <SheetBody key={key} cardKey={key} action={action} tab={tab} onAsk={onAsk} stepAside={stepAside} />
      </ErrorBoundary>
    </motion.section>
  );
}
