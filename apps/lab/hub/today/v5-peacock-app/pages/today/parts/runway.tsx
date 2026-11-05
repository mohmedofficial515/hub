import { ArrowRight, CalendarClock, Clock } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { NOW, type CardRow as MockRow } from '@lab/mocks/hub-today';
import {
  AppLink,
  Bidi,
  cn,
  DAY,
  duration,
  EmptyState,
  fmt,
  focusRing,
  focusRowWhenReady,
  hoursFromNow,
  kitMessages,
  Ltr,
  nowMs,
  plural,
  rel,
  SectionHeader,
  time,
  Tooltip,
  TypeIcon,
  typeClass,
  useMedia,
  weekday,
  when,
} from '../../../kit';
import { messages } from '../i18n';

const SPAN_H = 72;
const LATE = 16; // % of the strip given to the overdue zone, before "now"
const xOf = (h: number) => LATE + (Math.min(h, SPAN_H) / SPAN_H) * (100 - LATE);

/**
 * Time runs in the reading direction on every axis of this page (start = earlier, end = later), so in Arabic the
 * runway flows right to left: overdue at the inline start, then "now", then +72 h at the inline end.
 */
function dayTicks() {
  const now = nowMs();
  // Next midnight in the workspace timezone (UTC+3, no DST in Turkey).
  const local = new Date(now + 3 * 3_600_000);
  local.setUTCHours(24, 0, 0, 0);
  const first = local.getTime() - 3 * 3_600_000;
  const ticks: { h: number; iso: string }[] = [];
  for (let t = first; (t - now) / 3_600_000 < SPAN_H; t += DAY) {
    ticks.push({ h: (t - now) / 3_600_000, iso: new Date(t + 12 * 3_600_000).toISOString() });
  }
  return ticks;
}

function whenWords(card: MockRow, locale: 'ar' | 'en', overdueWord: string) {
  const h = hoursFromNow(card.dueAt!);
  return h < 0 ? fmt(overdueWord, { d: duration(Date.parse(card.dueAt!) - nowMs(), locale) }) : rel(card.dueAt!, locale);
}

function TooltipBody({ card }: { card: MockRow }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  return (
    <>
      <span className="flex items-center gap-1.5">
        <TypeIcon type={card.type} labelled />
        <Ltr mono className="text-caption text-muted-foreground">
          {card.key}
        </Ltr>
      </span>
      <span className="mt-1 block font-medium">
        <Bidi>{card.title[locale]}</Bidi>
      </span>
      <span className="mt-1 block text-caption text-muted-foreground">
        {whenWords(card, locale, t.stack.overdueBy)}
        {' · '}
        {when(card.dueAt!, locale)}
        {card.flags?.escalated ? ` · ${kit.status.escalated}` : ''}
      </span>
    </>
  );
}

/** A deadline already in Awaiting me: a mark on the line. Its job is "when", and activating it goes to the row. */
function StackMark({ card }: { card: MockRow }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const h = hoursFromNow(card.dueAt!);
  const x = h < 0 ? LATE / 2 : xOf(h);
  return (
    <li className="absolute bottom-8 flex w-0 justify-center" style={{ insetInlineStart: `${x}%` }}>
      <Tooltip content={<TooltipBody card={card} />} side="top">
        <button
          type="button"
          aria-label={fmt(t.runway.pinInStack, { key: card.key, type: kit.types[card.type], title: card.title[locale], when: when(card.dueAt!, locale) })}
          onClick={() => focusRowWhenReady(card.key)}
          className={cn('group relative flex size-6 shrink-0 translate-y-3 items-center justify-center rounded-full', focusRing)}
        >
          <span
            aria-hidden
            className={cn(
              'size-3 rounded-full ring-2 ring-card transition-transform duration-120 group-hover:scale-125',
              typeClass[card.type].dot,
              card.flags?.escalated && 'outline-2 outline-offset-1 outline-destructive',
            )}
          />
        </button>
      </Tooltip>
    </li>
  );
}

/** A deadline not in Awaiting me: the card the runway exists for, so it carries its name (review M6). */
function OutsidePin({ card, wide }: { card: MockRow; wide: boolean }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const h = hoursFromNow(card.dueAt!);
  const x = h < 0 ? LATE / 2 : xOf(h);
  const anchorEnd = x > 72;
  const label = fmt(t.runway.pin, { key: card.key, type: kit.types[card.type], title: card.title[locale], when: when(card.dueAt!, locale) });
  return (
    <li className={cn('absolute top-0 bottom-8 flex w-0 flex-col', anchorEnd ? 'items-end' : 'items-center')} style={{ insetInlineStart: `${x}%` }}>
      <Tooltip content={<TooltipBody card={card} />} side="top">
        <AppLink
          card={card.key}
          aria-label={label}
          className={cn('mt-5 flex h-8 max-w-56 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-body-sm whitespace-nowrap transition-colors duration-120 hover:bg-accent', focusRing)}
        >
          <TypeIcon type={card.type} />
          <Ltr mono className="text-caption font-medium text-foreground">
            {card.key}
          </Ltr>
          <Ltr className="text-caption text-muted-foreground tabular-nums">{time(card.dueAt!, locale)}</Ltr>
          {wide && <span className="min-w-0 truncate text-foreground">{card.title[locale]}</span>}
        </AppLink>
      </Tooltip>
      <span aria-hidden className={cn('w-px flex-1', anchorEnd && 'me-4', typeClass[card.type].dot)} />
    </li>
  );
}

function Ribbon({ inStack, outside }: { inStack: MockRow[]; outside: MockRow[] }) {
  const t = useT(messages);
  const locale = useLocale();
  const wide = useMedia('(min-width: 1280px)');
  const ticks = dayTicks();
  const soonEnd = xOf(24);
  return (
    <div className={cn('relative hidden md:block', outside.length ? 'h-30' : 'h-19')}>
      {/* zones */}
      <div aria-hidden className="absolute inset-y-0 start-0 rounded-s-lg bg-destructive-soft" style={{ width: `${LATE}%` }} />
      <div aria-hidden className="absolute inset-y-0 border-e border-dashed border-warning bg-warning-soft/50" style={{ insetInlineStart: `${LATE}%`, width: `${soonEnd - LATE}%` }} />
      <span className="absolute start-2 bottom-1 inline-flex items-center gap-1 text-caption font-medium text-destructive-soft-foreground">
        <Clock aria-hidden className="size-3" strokeWidth={2} />
        {t.runway.overdue}
      </span>
      {/* track */}
      <div aria-hidden className="absolute end-0 bottom-8 h-px bg-border" style={{ insetInlineStart: `${LATE}%` }} />
      {/* day boundaries */}
      {ticks.map((tick) => (
        <div key={tick.iso} aria-hidden className="absolute top-1/3 bottom-0 border-s border-dashed border-border" style={{ insetInlineStart: `${xOf(tick.h)}%` }}>
          <span className="absolute start-1.5 bottom-1 text-caption whitespace-nowrap text-muted-foreground">{weekday(tick.iso, locale, 'long')}</span>
        </div>
      ))}
      <span aria-hidden className="absolute top-1 text-caption whitespace-nowrap text-warning-strong" style={{ insetInlineEnd: `${100 - soonEnd + 1}%` }}>
        {t.runway.day24}
      </span>
      {/* now: neutral, because cyan is for actions and links */}
      <div aria-hidden className="absolute inset-y-0 w-0.5 bg-foreground" style={{ insetInlineStart: `${LATE}%` }}>
        <span className="absolute start-1.5 bottom-1 rounded-sm bg-card px-1 text-caption font-semibold whitespace-nowrap text-foreground">
          {t.runway.now} <Ltr className="tabular-nums">{time(NOW, locale)}</Ltr>
        </span>
      </div>
      {/* direction of time, stated once (review, RTL time axis) */}
      <span aria-hidden className="absolute end-2 top-1 inline-flex items-center gap-1 text-caption text-muted-foreground">
        {t.runway.later}
        <ArrowRight className="size-3 rtl:-scale-x-100" strokeWidth={2} />
      </span>
      <ol aria-label={t.runway.title} className="absolute inset-0">
        {outside.map((card) => (
          <OutsidePin key={card.key} card={card} wide={wide} />
        ))}
        {inStack.map((card) => (
          <StackMark key={card.key} card={card} />
        ))}
      </ol>
    </div>
  );
}

/** Phone: only what the stack does not already show, with "in 3 h" words. */
function PhoneList({ outside, inStackCount }: { outside: MockRow[]; inStackCount: number }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-1.5 md:hidden">
      {outside.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {outside.map((card) => {
            const late = hoursFromNow(card.dueAt!) < 0;
            return (
              <li key={card.key}>
                <AppLink card={card.key} className={cn('flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-120 hover:bg-accent', late && 'bg-destructive-soft', focusRing)}>
                  <TypeIcon type={card.type} size="md" />
                  <span className="min-w-0 flex-1">
                    <Ltr mono className="block text-caption text-muted-foreground">
                      {card.key}
                    </Ltr>
                    <span className="line-clamp-2 text-body text-foreground">
                      <Bidi>{card.title[locale]}</Bidi>
                    </span>
                  </span>
                  <span className="shrink-0 text-end text-body-sm">
                    <span className={cn('block font-medium', late ? 'text-destructive-soft-foreground' : 'text-foreground')}>{whenWords(card, locale, t.stack.overdueBy)}</span>
                    <span className={late ? 'text-destructive-soft-foreground' : 'text-muted-foreground'}>{when(card.dueAt!, locale)}</span>
                  </span>
                </AppLink>
              </li>
            );
          })}
        </ol>
      )}
      {inStackCount > 0 && <p className="px-2 pb-1 text-body-sm text-muted-foreground">{plural(inStackCount, locale, t.runway.inStackNote)}</p>}
    </div>
  );
}

/**
 * Decision (review M6, owner's brief): a deadline in Awaiting me is not repeated. Its row already says "in 3 h", so
 * here it is only a mark on the time line, which is the one thing the row cannot show: how the deadlines sit against
 * each other. Activating a mark moves to its row. Only cards outside the stack get a labelled pin. The strip collapses
 * to a slim ribbon when every deadline is in the stack, and phones list only the outside ones.
 */
export function DeadlineRunway({ cards, stackKeys }: { cards: MockRow[]; stackKeys: Set<string> }) {
  const t = useT(messages);
  const within = cards.filter((c) => c.dueAt && hoursFromNow(c.dueAt) <= SPAN_H);
  const outside = within.filter((c) => !stackKeys.has(c.key));
  const inStack = within.filter((c) => stackKeys.has(c.key));
  return (
    <section aria-labelledby="runway-title" className="flex flex-col gap-3">
      <SectionHeader id="runway-title" icon={CalendarClock} title={t.runway.title} count={within.length} />
      {within.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t.runway.empty} />
      ) : (
        <div className="rounded-lg border border-border bg-card p-1.5">
          <Ribbon inStack={inStack} outside={outside} />
          <PhoneList outside={outside} inStackCount={inStack.length} />
        </div>
      )}
    </section>
  );
}
