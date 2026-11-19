import { useState, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { messages } from '../i18n';
import { cn, dayKey, dayLabel, fillText, focusRing, formatTime } from './atoms';
import { FeedRow } from './feed-row';
import {
  bandOf,
  cardOf,
  isUnread,
  needsShown,
  rankNeeds,
  type Band,
  type FeedAction,
  type FeedItem,
  type Overlays,
  type ReadMap,
  type ViewId,
} from './model';

export interface ListHandlers {
  onAct: (item: FeedItem, action: FeedAction) => void;
  onOpen: (item: FeedItem) => void;
  onToggleRead: (item: FeedItem) => void;
}

export interface Common extends ListHandlers {
  overlays: Overlays;
  read: ReadMap;
  lazy: boolean;
}

function Section({ id, title, count, children }: { id: string; title: ReactNode; count?: number; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="flex items-center gap-2 px-1 text-body-sm font-semibold text-muted-foreground">
        {title}
        {count !== undefined && <span className="font-medium tabular-nums">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function Surface({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </ul>
    </div>
  );
}

function Tide({ time }: { time: string }) {
  const t = useT(messages);
  return (
    <li role="separator" aria-label={fillText(t.tide, { time })} className="flex items-center gap-3 bg-background px-5 py-2 text-caption font-medium text-primary-text">
      <span aria-hidden className="h-px flex-1 bg-primary/50" />
      <span>{fillText(t.tide, { time })}</span>
      <span aria-hidden className="h-px flex-1 bg-primary/50" />
    </li>
  );
}

function Row({ item, c }: { item: FeedItem; c: Common }) {
  return (
    <FeedRow
      item={item}
      overlay={item.card ? c.overlays[item.card.key] : undefined}
      unread={isUnread(item, c.read)}
      onAct={c.onAct}
      onOpen={c.onOpen}
      onToggleRead={c.onToggleRead}
      lazy={c.lazy}
    />
  );
}

/** A collapsed group under "Needs me": tasks I can claim and sessions waiting for a summary. Nothing is lost from Today. */
function AlsoGroup({ id, title, items, c }: { id: string; title: string; items: FeedItem[]; c: Common }) {
  const t = useT(messages);
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          onClick={() => setOpen((v) => !v)}
          className={cn('flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 text-start text-body font-medium text-foreground hover:bg-accent', focusRing)}
        >
          <span className="flex-1">{title}</span>
          <span className="tabular-nums text-muted-foreground">{items.length}</span>
          <span className="text-caption text-muted-foreground">{open ? t.bands.collapse : t.bands.expand}</span>
          <ChevronDown aria-hidden className={cn('size-4 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
      </h3>
      {open && (
        <div id={`${id}-list`}>
          <Surface>
            {items.map((i) => (
              <Row key={i.id} item={i} c={c} />
            ))}
          </Surface>
        </div>
      )}
    </section>
  );
}

export function NeedsView({ items, ready, sessions, c }: { items: FeedItem[]; ready: FeedItem[]; sessions: FeedItem[]; c: Common }) {
  const t = useT(messages);
  const ranked = rankNeeds(needsShown(items, c.overlays), c.overlays);
  const groups: Record<Band, FeedItem[]> = { urgent: [], soon: [], later: [] };
  for (const i of ranked) groups[bandOf(cardOf(i, c.overlays)!)].push(i);
  const alive = (list: FeedItem[]) => list.filter((i) => !c.overlays[i.card!.key]?.settled);
  const readyNow = alive(ready);
  const sessionsNow = alive(sessions);

  return (
    <div className="flex flex-col gap-6">
      {(['urgent', 'soon', 'later'] as Band[]).map((b) =>
        groups[b].length ? (
          <Section key={b} id={`band-${b}`} title={t.bands[b]} count={groups[b].length}>
            <Surface>
              {groups[b].map((i) => (
                <Row key={i.id} item={i} c={c} />
              ))}
            </Surface>
          </Section>
        ) : null,
      )}
      {(readyNow.length > 0 || sessionsNow.length > 0) && (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-body-sm font-semibold text-muted-foreground">{t.bands.also}</p>
          <AlsoGroup id="also-ready" title={t.bands.ready} items={readyNow} c={c} />
          <AlsoGroup id="also-sessions" title={t.bands.sessions} items={sessionsNow} c={c} />
        </div>
      )}
    </div>
  );
}

/** New, Mentions & reminders and All: one chronological stream, grouped by day. All carries the tide line. */
export function StreamView({
  view,
  items,
  lastSeenAt,
  c,
  total,
  onMore,
}: {
  view: Exclude<ViewId, 'needs'>;
  items: FeedItem[];
  lastSeenAt: string;
  c: Common;
  total: number;
  onMore: () => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const days: { key: string; rows: FeedItem[] }[] = [];
  for (const i of items) {
    const k = dayKey(i.at);
    const last = days[days.length - 1];
    if (last && last.key === k) last.rows.push(i);
    else days.push({ key: k, rows: [i] });
  }
  const tideAt = new Date(lastSeenAt).getTime();
  const tideTime = formatTime(lastSeenAt, locale);
  let tideDone = view !== 'all';

  return (
    <div className="flex flex-col gap-6">
      {days.map((d) => (
        <Section key={d.key} id={`day-${d.key}`} title={dayLabel(d.key, locale, t.days)}>
          <Surface>
            {d.rows.flatMap((i) => {
              const out: ReactNode[] = [];
              if (!tideDone && new Date(i.at).getTime() <= tideAt) {
                tideDone = true;
                out.push(<Tide key="tide" time={tideTime} />);
              }
              out.push(<Row key={i.id} item={i} c={c} />);
              return out;
            })}
          </Surface>
        </Section>
      ))}
      {view === 'new' && items.length > 0 && (
        <p className="flex items-center gap-3 px-1 text-caption font-medium text-muted-foreground">
          <span aria-hidden className="h-px flex-1 bg-border" />
          {t.tideEnd}
          <span aria-hidden className="h-px flex-1 bg-border" />
        </p>
      )}
      {items.length < total && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-caption text-muted-foreground">{fillText(t.more.shown, { shown: items.length, total })}</p>
          <button type="button" onClick={onMore} className={cn('inline-flex h-11 items-center rounded-lg border border-input bg-card px-5 text-body font-medium text-foreground hover:bg-accent', focusRing)}>
            {t.more.older}
          </button>
        </div>
      )}
    </div>
  );
}
