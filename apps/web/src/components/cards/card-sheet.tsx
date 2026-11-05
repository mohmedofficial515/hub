'use client';

/**
 * @file card-sheet.tsx
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/card-sheet.tsx. Contract: apps/web/README.md.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, ArchiveRestore, Eye, EyeOff, Link2, MoreHorizontal, X } from 'lucide-react';
import { Dialog, DropdownMenu, Tabs } from 'radix-ui';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { ActorChip, Avatar } from '@/components/cards/avatar';
import { PriorityBadge, RoleBadge, StatusBadge, TypeBadge } from '@/components/cards/badges';
import { CardChip } from '@/components/cards/card-key';
import { focusRing } from '@/components/cards/meta';
import { sheetSections } from '@/components/cards/sheet-sections';
import { CopyButton, copyText } from '@/components/common/copy-button';
import { RelativeTime } from '@/components/common/relative-time';
import { ErrorState, LoadingRegion, Skeleton, SkeletonRows } from '@/components/common/states';
import { Bidi, fill, fmt, Ltr } from '@/components/common/text';
import { showToast } from '@/components/common/toast';
import { closeCard, setQuery, type SheetTab, takeOpener, useRoute } from '@/components/shell/router';
import { Button, IconButton } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { detectSecret, Field, SecretFilterError, Select, Textarea, TextInput } from '@/components/ui/form';
import { tabTriggerClass } from '@/components/ui/tabs-class';
import { Tooltip } from '@/components/ui/tooltip';
import { actionsFor, type AvailableAction, usePerformAction } from '@/features/cards/actions';
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
import { useSession } from '@/features/session/session';
import { useMembers } from '@/features/session/session';
import { isHubError } from '@/lib/api/errors';
import { portalRoot } from '@/lib/hooks';
import { useLocale, useT } from '@/lib/i18n';
import { actionName, type CardAction, eventLabel, kitMessages } from '@/lib/i18n';
import { restoreFocus } from '@/lib/keyboard-list';
import { matchKey } from '@/lib/keys';
import { shortcutsEnabled } from '@/lib/preferences';
import { cn } from '@/lib/utils';

/**
 * Which edge the sheet opens from. End, per 08 §5.3: it keeps the action lane in view while acting on a row. It is one
 * constant so the owner can still flip it (see README, open questions).
 */
const SHEET_EDGE: 'start' | 'end' = 'end';

const EASE = [0.2, 0.8, 0.2, 1] as const;

const isCardAction = (v: string | null): v is CardAction => !!v;

const hasOwnText = (card: HubCard) => (card.type === 'task' ? !!card.task.acceptance : card.type !== 'need');

function ActionBar({ card, action }: { card: HubCard; action: CardAction | null }) {
  const t = useT(kitMessages);
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
              i === 0 && a.enabled && !action && !a.selfVerify
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

/** "field: from → to" rows (09 §14); the arrow mirrors because it follows the reading direction. */
function EventData({ data }: { data: Record<string, string | number | boolean | null> }) {
  const t = useT(kitMessages);
  const h = t.sheet.history;
  // Internal fields stay out of a sentence a member reads: the title repeats the sheet's, and the flag is already in the verb.
  const { from, to, field, title: _title, selfVerified: _self, ...rest } = data;
  const shown = Object.entries(rest).filter(([, v]) => v !== null && v !== '');
  if (from === undefined && !shown.length) return null;
  const word = (value: unknown) => {
    const text = String(value);
    return t.status[text] ?? h.values[text] ?? text;
  };
  const Value = ({ value }: { value: unknown }) => {
    const text = String(value);
    return t.status[text] || h.values[text] ? <span>{word(value)}</span> : <Ltr>{text}</Ltr>;
  };
  return (
    <dl className="mt-1 flex flex-col gap-0.5 text-body-sm text-muted-foreground">
      {from !== undefined && to !== undefined && (
        <div className="flex flex-wrap items-center gap-1.5">
          {field && <dt className="font-medium">{h.fieldNames[String(field)] ?? String(field)}:</dt>}
          <dd className="flex flex-wrap items-center gap-1.5">
            <Value value={from} />
            <span aria-hidden className="rtl:-scale-x-100">
              →
            </span>
            <span className="text-foreground">
              <Value value={to} />
            </span>
          </dd>
        </div>
      )}
      {shown.map(([k, v]) => (
        <div key={k} className="flex flex-wrap gap-1.5">
          <dt className="font-medium">{h.fieldNames[k] ?? k}:</dt>
          <dd className="min-w-0 break-words">
            <Value value={v} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function HistoryTab({ card }: { card: HubCard }) {
  const t = useT(kitMessages);
  const events = [...card.events].reverse();
  if (!events.length) return <p className="text-body text-muted-foreground">{t.sheet.history.empty}</p>;
  return (
    <ol className="flex flex-col gap-4">
      {events.map((e) => (
        <li key={e.id} className="text-body">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ActorChip kind={e.actorKind} memberId={e.actorId} adapter={e.adapter} />
            <span className="text-foreground">{eventLabel(t, e)}</span>
            <RelativeTime iso={e.at} className="text-body-sm text-muted-foreground" />
            <span className="text-body-sm text-muted-foreground">
              {fill(t.sheet.history.via, { via: <Ltr mono>{e.via}</Ltr> })}
            </span>
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

function SheetBody({ cardKey, action, tab }: { cardKey: string; action: CardAction | null; tab: SheetTab }) {
  const t = useT(kitMessages);
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
          <Dialog.Close asChild>
            <IconButton label={t.close} data-sheet-close>
              <X aria-hidden className="size-4" strokeWidth={1.75} />
            </IconButton>
          </Dialog.Close>
        </div>
        <Dialog.Title className="sr-only">{fmt(t.sheet.label, { key: cardKey })}</Dialog.Title>
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
          <Dialog.Close asChild>
            <IconButton label={t.close} data-sheet-close>
              <X aria-hidden className="size-4" strokeWidth={1.75} />
            </IconButton>
          </Dialog.Close>
        </div>
        <Dialog.Title className="sr-only">{fmt(t.sheet.label, { key: cardKey })}</Dialog.Title>
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
          <Dialog.Close asChild>
            <IconButton label={t.close} data-sheet-close>
              <X aria-hidden className="size-4" strokeWidth={1.75} />
            </IconButton>
          </Dialog.Close>
        </div>
        <Dialog.Title className="sr-only">{fmt(t.sheet.label, { key: cardKey })}</Dialog.Title>
        <ErrorState title={fmt(t.sheet.notFound, { key: cardKey })} code="404" />
        <p className="px-6 text-center text-body text-muted-foreground">{t.sheet.notFoundBody}</p>
      </>
    );
  }

  const Section = sheetSections[card.type];
  const isManager = me.roles.includes('owner') || me.roles.includes('pm');
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
                {isManager && (
                  <DropdownMenu.Item
                    onSelect={() => (card.archivedAt ? void setArchived(card.key, false) : setArchive(true))}
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
          <Dialog.Close asChild>
            <IconButton label={t.close} data-sheet-close>
              <X aria-hidden className="size-4" strokeWidth={1.75} />
            </IconButton>
          </Dialog.Close>
        </div>
        <Dialog.Title className="text-title font-semibold text-pretty text-foreground">
          <Bidi>{card.title}</Bidi>
        </Dialog.Title>
        <Dialog.Description className="sr-only">{t.types[card.type]}</Dialog.Description>
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
        {card.archivedAt && (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-body-sm text-warning-soft-foreground">
            {fmt(t.sheet.archived, { when: '' })}
            <RelativeTime iso={card.archivedAt} />
          </p>
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
          <Tabs.Content value="details" className="flex flex-col gap-5 p-4 outline-none md:p-6">
            {card.body ? (
              <p className="text-body-lg text-foreground">
                <Bidi>{card.body}</Bidi>
              </p>
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
          <Tabs.Content value="comments" className="p-4 outline-none md:p-6">
            <CommentsTab card={card} />
          </Tabs.Content>
          <Tabs.Content value="history" className="p-4 outline-none md:p-6">
            <HistoryTab card={card} />
          </Tabs.Content>
          <Tabs.Content value="links" className="p-4 outline-none md:p-6">
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
          void setArchived(card.key, true);
          showToast({
            message: fmt(t.sheet.deleted, { key: card.key }),
            onUndo: () => void setArchived(card.key, false),
          });
          closeCard();
        }}
      />
    </>
  );
}

const menuItemClass =
  'flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent md:min-h-9';

/**
 * The card drawer (08 §5.3–5.4). Render once in the shell. It opens from the URL: `openCard(key)` anywhere, or
 * `openCard(key, { action: 'decide' })` to open on that action. 560 px on desktop, full screen under 768 px.
 * Focus is trapped while open and returns to what opened it, or to the row that replaced it.
 */
export function CardSheet() {
  const route = useRoute();
  const key = route.cardKey;
  const actionParam = route.query.get('action');
  const action = isCardAction(actionParam) ? actionParam : null;
  const tab = (route.query.get('tab') as SheetTab | null) ?? 'details';
  const locale = useLocale();
  const startOffset = locale === 'ar' ? 48 : -48;
  const offset = SHEET_EDGE === 'start' ? startOffset : -startOffset;

  return (
    <Dialog.Root open={!!key} onOpenChange={(open) => !open && closeCard()}>
      <AnimatePresence>
        {key && (
          <Dialog.Portal forceMount container={portalRoot()}>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-(--scrim)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.2 } }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              onOpenAutoFocus={(e) => {
                // Land on what the member came to do: the first enabled action, else Close. An action form focuses itself.
                e.preventDefault();
                const root = e.currentTarget as HTMLElement;
                (
                  root.querySelector<HTMLElement>('[data-sheet-primary]') ??
                  root.querySelector<HTMLElement>('[data-sheet-close]')
                )?.focus();
              }}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                restoreFocus(takeOpener());
              }}
              onInteractOutside={(e) => {
                // The toast sits beside the sheet: using Copy or Undo there must not close it.
                if ((e.target as HTMLElement).closest?.('[data-toast]')) e.preventDefault();
              }}
            >
              <motion.div
                data-card-sheet
                className={cn(
                  'fixed inset-y-0 z-50 flex w-full flex-col bg-background text-foreground shadow-md outline-none md:w-140 md:border-border',
                  SHEET_EDGE === 'start' ? 'start-0 md:border-e' : 'end-0 md:border-s',
                )}
                initial={{ opacity: 0, x: offset }}
                animate={{ opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE } }}
                exit={{ opacity: 0, x: offset / 2, transition: { duration: 0.14, ease: 'easeOut' } }}
              >
                <SheetBody key={key} cardKey={key} action={action} tab={tab} />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
