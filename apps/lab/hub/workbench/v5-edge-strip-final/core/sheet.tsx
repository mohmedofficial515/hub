import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Archive, ArchiveRestore, ArrowRight, ChevronDown, Eye, EyeOff, Link2, ListChecks, MoreHorizontal, X } from 'lucide-react';
import { DropdownMenu, Tabs } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { closeCard, setQuery, takeOpener, useRoute, type SheetTab } from '../../../today/v5-peacock-app/shell/router';
import { ActorChip, Avatar } from '../../../today/v5-peacock-app/kit/avatar';
import { PriorityBadge, RoleBadge, StatusBadge, TypeBadge } from '../../../today/v5-peacock-app/kit/badges';
import { Button, IconButton } from '../../../today/v5-peacock-app/kit/button';
import { actionsFor, usePerformAction, type AvailableAction } from '../../../today/v5-peacock-app/kit/card-actions';
import { CardChip } from '../../../today/v5-peacock-app/kit/card-key';
import { addComment, addLink, getCard, setArchived, toggleWatch, useCard } from '../../../today/v5-peacock-app/kit/card-store';
import { CopyButton, copyText } from '../../../today/v5-peacock-app/kit/copy-button';
import { ConfirmDialog } from '../../../today/v5-peacock-app/kit/dialog';
import { Field, Select, SecretFilterError, TextInput, Textarea, detectSecret } from '../../../today/v5-peacock-app/kit/form';
import { matchKey } from '../../../today/v5-peacock-app/kit/keys';
import { portalRoot } from '../../../today/v5-peacock-app/kit/hooks';
import { actionName, eventLabel, kitMessages, type CardAction } from '../../../today/v5-peacock-app/kit/i18n';
import { restoreFocus } from '../../../today/v5-peacock-app/kit/keyboard-list';
import { focusRing } from '../../../today/v5-peacock-app/kit/meta';
import { shortcutsEnabled } from '../../../today/v5-peacock-app/kit/preferences';
import { RelativeTime } from '../../../today/v5-peacock-app/kit/relative-time';
import { useSession } from '../../../today/v5-peacock-app/kit/session';
import { sheetSections } from '../../../today/v5-peacock-app/kit/sheet-sections';
import { ErrorState } from '../../../today/v5-peacock-app/kit/states';
import { tabTriggerClass } from '../../../today/v5-peacock-app/kit/tabs-class';
import { Bidi, counted, fill, fmt, Ltr } from './kit';
import { showToast } from '../../../today/v5-peacock-app/kit/toast';
import { Tooltip } from '../../../today/v5-peacock-app/kit/tooltip';
import { SheetClaudeBar } from './panels';
import { MarkInline, moveText, ReportBody } from './protocol';
import { panelOwes, useWb, wasFollowOpened } from './store';
import { wbMessages } from './strings';
import { Tip, usingKeyboard } from './tips';
import { members, type CardLink, type HubCard, type LinkKind } from '@lab/mocks/hub-app';

const EASE = [0.2, 0.8, 0.2, 1] as const;

const isCardAction = (v: string | null): v is CardAction => !!v;

const hasOwnText = (card: HubCard) => (card.type === 'task' ? !!card.task.acceptance : card.type !== 'need');

/** v5's action bar. Its filled button steps down while the panel beside it owes the owner an answer, so one thing on screen is asking at a time (review M11). */
function ActionBar({ card, action }: { card: HubCard; action: CardAction | null }) {
  const t = useT(kitMessages);
  const owes = panelOwes(useWb());
  const { roles, me } = useSession();
  const perform = usePerformAction();
  const available = actionsFor(card, roles, me.id);
  const [confirm, setConfirm] = useState<AvailableAction | null>(null);

  const run = (a: AvailableAction) => {
    if (a.mode === 'form') setQuery({ action: action === a.action ? null : a.action });
    else if (a.mode === 'confirm') setConfirm(a);
    else perform(card.key, a.action);
  };

  const watching = card.watchers.includes(me.id);
  return (
    <div role="group" aria-label={t.sheet.actionsLabel} className="flex flex-wrap items-center gap-2">
      {available.map((a, i) => {
        const button = (
          <Button
            key={a.action}
            // One filled button: while a form is open it is the form's save. A self-verify is never filled (owner decision 2026-11-04).
            variant={i === 0 && a.enabled && !action && !a.selfVerify && !owes ? 'primary' : a.destructive ? 'destructive' : 'outline'}
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
        onClick={() => toggleWatch(card.key, me.id)}
      >
        {watching ? <EyeOff aria-hidden className="size-4" strokeWidth={1.75} /> : <Eye aria-hidden className="size-4" strokeWidth={1.75} />}
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

/**
 * Reports from `report_work`, folded to one line each that says what stands: verified or claimed, and how many files. The summary stays in the panel's report when the same card is open beside it, so the two
 * do not repeat each other. The move, or the reason for none, is the card's own state above, and the line says why.
 */
function Evidence({ cardKey }: { cardKey: string }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const reports = wb.evidence[cardKey] ?? [];
  const [open, setOpen] = useState<number | null>(null);
  if (!reports.length) return null;
  const r = t.pro.report;
  const line = (report: (typeof reports)[number]) => {
    const { total, verified, failed, passed } = report.counts;
    const claimed = passed - verified;
    const checks = failed ? fmt(r.summary.failed, { failed, total }) : verified === total && total > 0 ? fmt(r.summary.verifiedAll, { n: verified, total }) : fmt(r.summary.some, { verified, total, claimed });
    return fmt(r.line, { checks, files: counted(report.changedFiles.length, locale, r.filesCount) });
  };
  return (
    <section aria-label={r.evidence} data-wb-evidence className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <h3 className="flex items-center gap-2 text-body font-semibold text-foreground">
        <ListChecks aria-hidden className="size-4 shrink-0 text-success-soft-foreground" strokeWidth={1.75} />
        {r.evidence}
      </h3>
      {reports.map((report, i) => (
        <div key={report.id} data-wb-evidence-row className="flex min-w-0 flex-col gap-2">
          <Tip k="evidence.check" align="start">
            <button type="button" data-wb-evidence-toggle aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className={cn('flex min-h-11 w-full min-w-0 items-start gap-2 rounded-sm text-start text-body-sm text-foreground hover:bg-accent md:min-h-7', focusRing)}>
              <span className="min-w-0 flex-1">{line(report)}</span>
              <ChevronDown aria-hidden className={cn('mt-0.5 size-3.5 shrink-0 text-muted-foreground', open === i && 'rotate-180')} strokeWidth={1.75} />
            </button>
          </Tip>
          {open === i && <ReportBody report={report} />}
          {open === i && !report.move.moved && (
            <p className="text-body-sm text-muted-foreground">
              <MarkInline text={moveText(report, t)} />
            </p>
          )}
        </div>
      ))}
    </section>
  );
}

function CommentsTab({ card }: { card: HubCard }) {
  const t = useT(kitMessages);
  const locale = useLocale();
  const { me } = useSession();
  const id = useId();
  const [text, setText] = useState('');
  const secret = detectSecret(text);
  const send = () => {
    const body = text.trim();
    if (!body || secret) return;
    addComment(card.key, me.id, body);
    setText('');
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
              <p className="text-body text-foreground">{c.redacted ? <em className="text-muted-foreground">{t.sheet.comments.redacted}</em> : <Bidi>{c.body[locale]}</Bidi>}</p>
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
  const { me } = useSession();
  const id = useId();
  const [other, setOther] = useState('');
  const [kind, setKind] = useState<LinkKind>('relates');
  const [error, setError] = useState<string | null>(null);
  const kinds: LinkKind[] = ['blocks', 'blocked_by', 'relates', 'parent', 'duplicates'];
  const groups = kinds.map((k) => [k, card.links.filter((l: CardLink) => l.kind === k)] as const).filter(([, list]) => list.length);

  const add = () => {
    const key = other.trim().toUpperCase();
    if (key === card.key) return setError(t.sheet.links.self);
    if (!getCard(key)) return setError(t.sheet.links.invalid);
    addLink(card.key, me.id, kind, key);
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
          <TextInput id={`${id}-key`} dir="ltr" className="key text-start" placeholder="GTV-123" value={other} onChange={(e) => setOther(e.target.value)} />
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

function SheetBody({ cardKey, action, tab, onAsk, stepAside }: { cardKey: string; action: CardAction | null; tab: SheetTab; onAsk?: () => void; stepAside?: string }) {
  const t = useT(kitMessages);
  const w = useT(wbMessages);
  const locale = useLocale();
  const card = useCard(cardKey);
  const perform = usePerformAction();
  const { me } = useSession();
  const [archive, setArchive] = useState(false);

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
      if (matchKey(e, 'w') && !e.ctrlKey && !e.metaKey && !e.altKey && shortcutsEnabled() && !el.closest('input, textarea, select')) {
        e.preventDefault();
        toggleWatch(cardKey, me.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cardKey, me.id, t.copy.copied]);

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
            {card.flags?.overdue && <StatusBadge status="overdue" className="bg-destructive-soft text-destructive-soft-foreground" />}
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
              <DropdownMenu.Content align="end" sideOffset={4} collisionPadding={12} className="z-[75] min-w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md">
                <DropdownMenu.Item onSelect={copyLink} className={menuItemClass}>
                  <Link2 aria-hidden className="size-4" strokeWidth={1.75} />
                  {t.sheet.copyLink}
                </DropdownMenu.Item>
                {isManager && (
                  <DropdownMenu.Item onSelect={() => (card.archivedAt ? setArchived(card.key, me.id, false) : setArchive(true))} className={menuItemClass}>
                    {card.archivedAt ? <ArchiveRestore aria-hidden className="size-4" strokeWidth={1.75} /> : <Archive aria-hidden className="size-4" strokeWidth={1.75} />}
                    {card.archivedAt ? t.sheet.restore : t.sheet.archive}
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
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
        <h2 tabIndex={-1} data-sheet-title className="rounded-sm text-title font-semibold text-pretty text-foreground outline-none">
          <Bidi>{card.title[locale]}</Bidi>
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
          {card.ownerRole && <RoleBadge role={card.ownerRole} routed={me.roles.includes(card.ownerRole)} />}
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span>{t.sheet.created}</span>
            <ActorChip kind={card.createdByKind} memberId={card.createdById} adapter={card.events[0]?.adapter} />
            <RelativeTime iso={card.createdAt} />
          </span>
          {card.repo && !card.branch && (
            <code dir="ltr" translate="no" className="key">
              {card.repo}
            </code>
          )}
          {card.watchers.length > 0 && (
            <span className="inline-flex items-center -space-x-1 rtl:space-x-reverse" title={t.sheet.watching}>
              {card.watchers.slice(0, 3).map((id) => (
                <Avatar key={id} member={members.find((m) => m.id === id)} size="xs" className="rounded-full ring-2 ring-background" />
              ))}
            </span>
          )}
        </div>
        <ActionBar card={card} action={action} />
        <SheetClaudeBar cardKey={card.key} onAsk={onAsk} />
        {card.archivedAt && (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-body-sm text-warning-soft-foreground">
            {fmt(t.sheet.archived, { when: '' })}
            <RelativeTime iso={card.archivedAt} />
          </p>
        )}
      </header>

      <Tabs.Root value={tab} onValueChange={(next) => setQuery({ tab: next === 'details' ? null : next })} dir={locale === 'ar' ? 'rtl' : 'ltr'} className="flex min-h-0 flex-1 flex-col">
        <Tabs.List aria-label={t.sheet.label.replace('{key}', card.key)} className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 [scrollbar-width:none] md:px-4">
          {(
            [
              ['details', t.sheet.tabs.details, null],
              ['comments', t.sheet.tabs.comments, card.comments.length],
              ['history', t.sheet.tabs.history, card.events.length],
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
          <Tabs.Content value="details" className="wb-sheet-measure flex flex-col gap-5 p-4 outline-none md:p-6">
            <Evidence cardKey={card.key} />
            {card.body ? (
              <p className="text-body-lg text-foreground">
                <Bidi>{card.body[locale]}</Bidi>
              </p>
            ) : (
              // Most sections open on text of their own, and then "no description" above it is simply wrong (review M15).
              !hasOwnText(card) && <p className="text-body text-muted-foreground">{t.sheet.noBody}</p>
            )}
            <Section card={card} action={action} cancelAction={() => setQuery({ action: null })} perform={(a, payload) => perform(card.key, a, payload)} />
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
          setArchived(card.key, me.id, true);
          closeCard();
        }}
      />
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
 * The approved card sheet, docked. Same body and same URL as v5's, with one change that matters: it is a plain region in the layout, not a dialog. A non-modal Radix dialog still loops focus, so Tab could never
 * leave it to reach an approval (review B1). As a `<section>`, Tab runs straight through. Esc closes it only while focus is inside it, and `F6` moves between page, sheet, panel and strip.
 * It takes focus when opened by the owner, on the title and never on an action, so a deep link cannot claim a card with Enter. A card brought by "Follow the chat", or a pane that remounts while the owner types, takes nothing.
 */
export function DockedSheet({ className, topBar, onAsk, stepAside }: { className?: string; topBar?: ReactNode; onAsk?: () => void; stepAside?: string }) {
  const route = useRoute();
  const key = route.cardKey;
  const actionParam = route.query.get('action');
  const action = isCardAction(actionParam) ? actionParam : null;
  const tab = (route.query.get('tab') as SheetTab | null) ?? 'details';
  const locale = useLocale();
  const t = useT(kitMessages);
  const offset = locale === 'ar' ? -32 : 32;
  const root = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!key) return;
    opener.current = takeOpener() ?? null;
    if ((document.activeElement as HTMLElement | null)?.hasAttribute('data-wb-input')) return;
    if (wasFollowOpened()) return;
    focusSheetTitle();
  }, [key]);
  useEffect(
    () => () => {
      if (!key) return;
      // The opener may be gone by now, and restoreFocus knows where to go then.
      if (!document.activeElement || document.activeElement === document.body) restoreFocus(opener.current);
    },
    [key],
  );
  if (!key) return null;
  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    // A menu or dialog inside the sheet handles its own Esc first, and marks it.
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault();
      closeCard();
    }
  };
  return (
    <motion.section
      ref={root}
      aria-label={fmt(t.sheet.label, { key })}
      data-card-sheet
      onKeyDown={onKeyDown}
      className={cn('flex flex-col bg-background text-foreground outline-none', className)}
      initial={{ opacity: 0, x: offset }}
      animate={{ opacity: 1, x: 0, transition: { duration: 0.2, ease: EASE } }}
    >
      {topBar}
      <SheetBody key={key} cardKey={key} action={action} tab={tab} onAsk={onAsk} stepAside={stepAside} />
    </motion.section>
  );
}
