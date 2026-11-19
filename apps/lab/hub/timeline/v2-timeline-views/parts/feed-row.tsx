import { useEffect, useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Bot, Cog, Mail, MailOpen, Sun, TriangleAlert, User, Clock, Siren, Ban, Link2 } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { messages } from '../i18n';
import { Chip, DueChip, StatusChip, WhyChip } from './chips';
import {
  ageText,
  cn,
  fill,
  fillText,
  focusInset,
  formatTime,
  Ltr,
  typeIcon,
  typeTile,
} from './atoms';
import { cardOf, type FeedAction, type FeedItem, type Overlay } from './model';

export interface FeedRowProps {
  item: FeedItem;
  overlay?: Overlay;
  unread: boolean;
  onAct: (item: FeedItem, action: FeedAction) => void;
  onOpen: (item: FeedItem) => void;
  onToggleRead: (item: FeedItem) => void;
  /** Skip layout and paint far below the fold. Used past ~40 rows. */
  lazy?: boolean;
}

/** Bold runs of the brief (`**x**`) without a markdown dependency. */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) =>
        part.startsWith('**') ? (
          <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
        ) : part.startsWith('`') ? (
          <Ltr key={i} mono>{part.slice(1, -1)}</Ltr>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

const systemTone = {
  brief: 'bg-muted text-foreground',
  source: 'bg-destructive-soft text-destructive-soft-foreground',
  reminder: 'bg-warning-soft text-warning-soft-foreground',
  escalation: 'bg-destructive-soft text-destructive-soft-foreground',
} as const;
const systemIcon = { brief: Sun, source: TriangleAlert, reminder: Clock, escalation: Siren } as const;

/**
 * The one row. Event rows, reminders, escalations and system rows (brief, source problem) all render here, on phone and on
 * desktop, with the same four facts: type + key, an always-visible status chip, a title clamped to two lines with a "why"
 * chip and the age, and one filled action while the card still offers it. The layout is a container query on the list, not
 * a viewport query, because the chat panel and the card sheet narrow the page.
 */
export function FeedRow({ item, overlay, unread, onAct, onOpen, onToggleRead, lazy }: FeedRowProps) {
  const t = useT(messages);
  const locale = useLocale();
  const reasonId = useId();
  const bodyId = useId();
  const [openEarlier, setOpenEarlier] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [hot, setHot] = useState(false);
  const reduce = useReducedMotion();

  // A short highlight whenever the card changes under the reader (mine or someone else's).
  useEffect(() => {
    if (!overlay) return;
    setHot(true);
    const id = window.setTimeout(() => setHot(false), 1600);
    return () => window.clearTimeout(id);
  }, [overlay?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = cardOf(item, overlay ? { [item.card?.key ?? '']: overlay } : {});
  const sys = item.system;
  const age = ageText(item.at, locale);
  const action = card?.awaiting;
  const blockedClaim = action === 'claim' && Boolean(card?.blockedBy);
  const title = card ? card.title[locale] : item.what[locale];
  const escalation = sys === 'escalation';
  const cardless = !card;
  const SysIcon = sys ? systemIcon[sys] : null;
  const TypeIcon = card ? typeIcon[card.type] : null;
  const ActorIcon = item.viaAgent ? Bot : item.actorId === 'system' ? Cog : User;
  const actorWord = item.viaAgent ? t.actor.agent : item.actorId === 'system' ? t.actor.system : t.actor.human;

  const filled = Boolean(action) && !overlay?.settled;
  const primaryLabel = action ? t.actions[action] : '';

  return (
    <motion.li
      layout={lazy || reduce ? false : 'position'}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.14 } }}
      data-row
      data-key={card?.key ?? item.id}
      tabIndex={-1}
      className={cn(
        'group/row @container relative bg-card ps-5 pe-3 py-3 transition-colors hover:bg-accent/60',
        escalation && 'ring-1 ring-inset ring-destructive/60',
        lazy && 'tl-lazy',
        hot && 'tl-hot',
        focusInset,
      )}
    >
      {unread && (
        <span aria-hidden className="absolute start-2 top-[1.15rem] size-2 rounded-full bg-primary" />
      )}

      <div className="tl-grid">
        {/* line 1 · type + key */}
        <div className="tl-lead flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-lg',
              sys ? systemTone[sys] : card ? typeTile[card.type] : 'bg-muted text-foreground',
            )}
          >
            {SysIcon ? <SysIcon aria-hidden className="size-4.5" strokeWidth={1.75} /> : TypeIcon ? <TypeIcon aria-hidden className="size-4.5" strokeWidth={1.75} /> : null}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            {card ? (
              <>
                <Ltr mono className="text-body-sm font-medium text-foreground">{card.key}</Ltr>
                <span className="text-caption text-muted-foreground">
                  {sys ? t.system[sys] : t.types[card.type]}
                  {card.priority === 'P0' || card.priority === 'P1' ? (
                    <>
                      {' '}
                      <Ltr mono className={card.priority === 'P0' ? 'font-medium text-prio-p0' : 'text-prio-p1'}>{card.priority}</Ltr>
                    </>
                  ) : null}
                </span>
              </>
            ) : (
              <span className="text-body-sm font-medium text-foreground">{t.system[sys!]}</span>
            )}
          </span>
        </div>

        {/* line 1 · status (always visible) and due */}
        <div className="tl-status">
          {card ? (
            <>
              <StatusChip status={card.status} from={overlay?.from} changedAt={overlay?.at} />
              {card.dueAt && !overlay?.settled && !['decided', 'delivered', 'verified', 'approved', 'applied', 'claimed'].includes(card.status) ? (
                <DueChip dueAt={card.dueAt} escalated={card.escalated} />
              ) : null}
            </>
          ) : (
            <Chip tone={sys === 'source' ? 'danger' : 'muted'} icon={sys === 'source' ? TriangleAlert : undefined}>
              {sys === 'source' ? t.system.problem : t.system[sys!]}
            </Chip>
          )}
        </div>

        {/* line 2 · title, two lines at most */}
        <div className="tl-title min-w-0">
          <button
            type="button"
            onClick={() => (sys === 'brief' ? setBriefOpen((v) => !v) : onOpen(item))}
            aria-expanded={sys === 'brief' ? briefOpen : undefined}
            aria-controls={sys === 'brief' ? bodyId : undefined}
            aria-label={card ? fillText(t.row.openCard, { key: card.key }) + ': ' + title : undefined}
            className={cn(
              'block w-full min-w-0 text-start text-body-lg font-semibold text-pretty text-foreground line-clamp-2 after:absolute after:inset-0 after:content-[""]',
              'focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring',
            )}
          >
            {title}
          </button>
        </div>

        {/* line 3 · why + what happened + age */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-muted-foreground tl-meta">
          {item.why && <WhyChip why={item.why} />}
          {cardless && item.body ? (
            <span id={bodyId} className={cn('min-w-0 text-pretty', sys === 'brief' && !briefOpen ? 'line-clamp-2' : '')}>
              <Prose text={item.body[locale]} />
              {sys === 'brief' && briefOpen && (
                <span className="mt-1 block text-caption">{fillText(t.briefBy, { time: formatTime(item.at, locale) })}</span>
              )}
            </span>
          ) : (
            <span className="flex min-w-0 items-start gap-1.5">
              <ActorIcon aria-hidden className="mt-1 size-3.5 shrink-0" strokeWidth={1.75} />
              <span className="sr-only">{actorWord}: </span>
              <span className="min-w-0 text-pretty line-clamp-2">{item.what[locale]}</span>
            </span>
          )}
          {item.ref && (
            <Ltr mono className="rounded-md bg-muted px-1.5 py-0.5 text-caption text-muted-foreground">{item.ref}</Ltr>
          )}
          {card?.blockedBy && (
            <Chip tone="warning" icon={Ban}>
              {fill(t.row.blockedBy, { key: <Ltr mono>{card.blockedBy}</Ltr> })}
            </Chip>
          )}
          {card?.blocks ? (
            <Chip icon={Link2}>{fillText(t.row.blocks, { n: card.blocks })}</Chip>
          ) : null}
          <time dateTime={item.at} title={formatTime(item.at, locale)} className="whitespace-nowrap text-caption">
            {age ? fillText(t.age.ago, { d: age }) : t.age.now}
          </time>
          {item.earlier?.length ? (
            <button
              type="button"
              aria-expanded={openEarlier}
              onClick={() => setOpenEarlier((v) => !v)}
              className="hit-44 relative z-10 -mx-1 rounded-md px-1.5 py-0.5 text-caption font-medium text-primary-text underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {openEarlier ? t.row.earlierHide : fillText(t.row.earlier, { n: item.earlier.length })}
            </button>
          ) : null}
        </div>

        {/* line 4 · the one action */}
        <div className="tl-act relative z-10">
          {filled && action ? (
            <button
              type="button"
              aria-disabled={blockedClaim || undefined}
              aria-describedby={blockedClaim ? reasonId : undefined}
              onClick={() => !blockedClaim && onAct(item, action)}
              className={cn(
                'tl-btn inline-flex min-w-28 items-center justify-center rounded-lg bg-primary px-4 text-body font-semibold text-primary-foreground',
                'hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                blockedClaim && 'cursor-not-allowed opacity-50 hover:bg-primary',
              )}
            >
              {primaryLabel}
            </button>
          ) : sys === 'brief' ? (
            <button
              type="button"
              aria-expanded={briefOpen}
              aria-controls={bodyId}
              onClick={() => setBriefOpen((v) => !v)}
              className="tl-btn inline-flex min-w-28 items-center justify-center rounded-lg border border-input bg-card px-4 text-body font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {briefOpen ? t.briefActionHide : t.briefAction}
            </button>
          ) : sys === 'source' ? (
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="tl-btn inline-flex min-w-28 items-center justify-center rounded-lg border border-input bg-card px-4 text-body font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.sourceAction}
            </button>
          ) : null}
          {blockedClaim && (
            <span id={reasonId} className="sr-only">
              {fillText(t.row.blockedClaim, { key: card!.blockedBy! })}
            </span>
          )}
          <button
            type="button"
            onClick={() => onToggleRead(item)}
            aria-label={fillText(unread ? t.row.markRead : t.row.markUnread, { key: card?.key ?? title })}
            className="tl-icon-btn grid place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {unread ? <MailOpen aria-hidden className="size-4.5" strokeWidth={1.75} /> : <Mail aria-hidden className="size-4.5" strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {openEarlier && item.earlier && (
        <ul className="relative z-10 tl-earlier mt-2 flex flex-col gap-1.5 border-s border-border ps-3 text-body-sm text-muted-foreground">
          {item.earlier.map((e) => (
            <li key={e.at} className="flex gap-2">
              <Ltr mono className="shrink-0 text-caption leading-6">{formatTime(e.at, locale)}</Ltr>
              <span className="text-pretty">{e.what[locale]}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.li>
  );
}
