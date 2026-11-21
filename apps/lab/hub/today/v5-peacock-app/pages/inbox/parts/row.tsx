import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Archive, ArchiveRestore, AtSign, BellRing, Cpu, Eye, ListTodo, LockOpen, Mail, MailOpen, Sun, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import type { InboxItem, InboxKind } from '@lab/mocks/hub-app/inbox';
import { AppLink, Bidi, CardChip, cn, focusRing, getCard, IconButton, plural, RelativeTime, stretchedFocus, typeClass, typeIcon, useMedia } from '../../../kit';
import { messages } from '../i18n';

/** A notification kind answers "why did this reach me"; the card's type icon answers "about what". */
const kindIcon: Partial<Record<InboxKind, LucideIcon>> = {
  mention: AtSign,
  watch_update: Eye,
  deadline_reminder: BellRing,
  escalation: TriangleAlert,
  unblocked: LockOpen,
  task_ready: ListTodo,
  brief: Sun,
  system: Cpu,
};

export interface InboxGroup {
  /** The newest item of the group: the row shows it. */
  lead: InboxItem;
  ids: string[];
  /** Merged items beyond the lead (03 §9 `groupKey`, within 30 minutes). */
  more: number;
  unread: boolean;
}

const SWIPE_AT = 96;

/** Swipe to archive on touch (08 §5.5). The Archive button does the same for everyone else. */
function useSwipe(onArchive: () => void) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);
  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      moved.current = false;
    },
    onPointerMove: (e: PointerEvent) => {
      const from = start.current;
      if (!from || from.id !== e.pointerId) return;
      const x = e.clientX - from.x;
      if (!moved.current && Math.abs(e.clientY - from.y) > Math.abs(x)) {
        // A vertical drag is a scroll, and the page keeps it.
        start.current = null;
        return;
      }
      if (Math.abs(x) > 8) moved.current = true;
      if (moved.current) setDx(x);
    },
    onPointerUp: () => {
      if (Math.abs(dx) >= SWIPE_AT) onArchive();
      start.current = null;
      setDx(0);
    },
    onPointerCancel: () => {
      start.current = null;
      setDx(0);
    },
    // A swipe that started on the stretched link must not also open the card.
    onClickCapture: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (!moved.current) return;
      moved.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
  return { dx, handlers };
}

export function InboxRow({
  group,
  rowProps,
  action,
  archivedView,
  onOpen,
  onToggleRead,
  onArchive,
  onRestore,
}: {
  group: InboxGroup;
  rowProps: Record<string, unknown>;
  /** The quick action, already decided by the page. */
  action?: ReactNode;
  archivedView?: boolean;
  onOpen: () => void;
  onToggleRead: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const { lead, unread, more } = group;
  const card = lead.cardKey ? getCard(lead.cardKey) : undefined;
  const { dx, handlers } = useSwipe(onArchive);
  const wide = useMedia('(min-width: 640px)');
  const danger = lead.kind === 'escalation';
  const KindIcon = kindIcon[lead.kind] ?? (card ? typeIcon[card.type] : Cpu);
  const titleId = `inbox-${lead.id}`;

  const titleClass = cn('underline-offset-4 outline-none after:absolute after:inset-0 hover:underline', stretchedFocus);
  return (
    <motion.li layout="position" exit={{ opacity: 0, transition: { duration: 0.16 } }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} className="relative overflow-hidden border-b border-border last:border-b-0">
      {dx !== 0 && (
        <div aria-hidden className={cn('absolute inset-0 flex items-center bg-muted px-4 text-body-sm font-medium text-muted-foreground', dx > 0 ? 'ltr:justify-start rtl:justify-end' : 'ltr:justify-end rtl:justify-start')}>
          <Archive className="me-2 size-4" strokeWidth={1.75} />
          {t.row.swipe}
        </div>
      )}
      <article
        {...rowProps}
        {...handlers}
        aria-labelledby={titleId}
        // The offset follows the finger, so it is the one physical value here. It is not a layout direction.
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        className={cn(
          'relative grid touch-pan-y grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 bg-card px-3 py-3 outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-4',
        )}
      >
        <span aria-hidden className={cn('pt-0.5', danger ? 'text-destructive-soft-foreground' : card ? typeClass[card.type].fg : 'text-muted-foreground')}>
          <KindIcon className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p id={titleId} className={cn('flex items-baseline gap-2 text-body-lg text-foreground', unread ? 'font-semibold' : 'font-normal')}>
            {unread && (
              <>
                <span aria-hidden className="size-2 shrink-0 translate-y-[-0.1em] rounded-full bg-foreground" />
                <span className="sr-only">{t.row.unread}: </span>
              </>
            )}
            {card ? (
              <AppLink card={card.key} action={undefined} onClick={onOpen} className={cn('min-w-0', titleClass)}>
                <Bidi>{lead.title[locale]}</Bidi>
              </AppLink>
            ) : lead.link ? (
              <AppLink view={lead.link.view} query={lead.link.query} onClick={onOpen} className={cn('min-w-0', titleClass)}>
                <Bidi>{lead.title[locale]}</Bidi>
              </AppLink>
            ) : (
              <Bidi>{lead.title[locale]}</Bidi>
            )}
          </p>
          {lead.body && (
            <p className="mt-0.5 text-body-sm text-muted-foreground">
              <Bidi>{lead.body[locale]}</Bidi>
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm text-muted-foreground">
            {card && <CardChip k={card.key} className="relative z-10" />}
            {more > 0 && <span className="font-medium text-foreground">{plural(more, locale, t.row.more)}</span>}
            <RelativeTime iso={lead.createdAt} />
          </div>
          {!wide && action && !archivedView && <div className="relative z-10 mt-2 flex">{action}</div>}
        </div>
        <div className="relative z-10 flex items-start justify-end gap-1 sm:items-center">
          {archivedView ? (
            <IconButton label={t.row.restore} onClick={onRestore}>
              <ArchiveRestore aria-hidden className="size-4" strokeWidth={1.75} />
            </IconButton>
          ) : (
            <>
              {wide && action}
              <IconButton label={unread ? t.row.markRead : t.row.markUnread} aria-keyshortcuts="e" onClick={onToggleRead} className="hidden md:inline-flex">
                {unread ? <MailOpen aria-hidden className="size-4" strokeWidth={1.75} /> : <Mail aria-hidden className="size-4" strokeWidth={1.75} />}
              </IconButton>
              <IconButton label={t.row.archive} onClick={onArchive}>
                <Archive aria-hidden className="size-4" strokeWidth={1.75} />
              </IconButton>
            </>
          )}
        </div>
      </article>
    </motion.li>
  );
}

export const linkButtonClass = cn(
  'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-body-sm font-medium whitespace-nowrap text-foreground transition-colors duration-150 ease-out hover:bg-accent md:h-8',
  focusRing,
);
