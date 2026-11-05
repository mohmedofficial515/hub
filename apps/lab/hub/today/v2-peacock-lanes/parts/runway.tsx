import { CalendarClock, Clock } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { NOW, type CardRow } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { EmptyState, fmt, HubLink, Ltr, SectionHead, TypeDot } from './atoms';
import { duration, hoursFromNow, nowMs, rel, time, weekday, when } from './format';
import { focusRing, typeClass } from './type-meta';

const SPAN_H = 72;
const LATE = 18; // % of the strip given to the overdue zone, before "now"
const xOf = (h: number) => LATE + (Math.min(h, SPAN_H) / SPAN_H) * (100 - LATE);

/**
 * Time runs in the reading direction on every axis of this page (start = earlier, end = later),
 * so in Arabic the runway flows right → left: overdue at the inline start, then "now", then +72 h at
 * the inline end. Same rule as the counters' sparklines and the team heatmap.
 */
function dayTicks() {
  const now = nowMs();
  // Next midnight in the workspace timezone (UTC+3, no DST in Turkey).
  const local = new Date(now + 3 * 3_600_000);
  local.setUTCHours(24, 0, 0, 0);
  const first = local.getTime() - 3 * 3_600_000;
  const ticks: { h: number; iso: string }[] = [];
  for (let t = first; (t - now) / 3_600_000 < SPAN_H; t += 24 * 3_600_000) {
    ticks.push({ h: (t - now) / 3_600_000, iso: new Date(t + 12 * 3_600_000).toISOString() });
  }
  return ticks;
}

interface Pin {
  card: CardRow;
  h: number;
  x: number;
  row: number;
  anchor: 'center' | 'end';
}

/** Rough label widths in % of the strip (≈ 760 px at lg): overdue chips show the key only. */
const W_LATE = 14;
const W_AHEAD = 21;

/** Two label rows; a label drops to the second row when it would overlap one in the first. */
function layoutPins(cards: CardRow[]): Pin[] {
  const late = cards.filter((c) => hoursFromNow(c.dueAt!) < 0);
  const ahead = cards.filter((c) => hoursFromNow(c.dueAt!) >= 0).sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
  const rowEnd = [-Infinity, -Infinity];
  const pins: Pin[] = [];
  late.forEach((card, i) => {
    const row = i % 2;
    rowEnd[row] = LATE / 2 + W_LATE / 2;
    pins.push({ card, h: hoursFromNow(card.dueAt!), x: LATE / 2, row, anchor: 'center' });
  });
  for (const card of ahead) {
    const h = hoursFromNow(card.dueAt!);
    const x = xOf(h);
    const anchor = x + W_AHEAD / 2 > 99 ? 'end' : 'center';
    const from = anchor === 'end' ? x - W_AHEAD : x - W_AHEAD / 2;
    const row = from >= rowEnd[0] ? 0 : from >= rowEnd[1] ? 1 : rowEnd[0] <= rowEnd[1] ? 0 : 1;
    rowEnd[row] = anchor === 'end' ? x : x + W_AHEAD / 2;
    pins.push({ card, h, x, row, anchor });
  }
  return pins;
}

function PinLabel({ pin }: { pin: Pin }) {
  const t = useT(messages);
  const locale = useLocale();
  const { card } = pin;
  const late = pin.h < 0;
  const label = fmt(t.runway.pin, { key: card.key, type: t.types[card.type], title: card.title[locale], when: when(card.dueAt!, locale) });
  return (
    <li
      className="absolute top-0 bottom-9 flex w-0 flex-col items-center"
      style={{ insetInlineStart: `${pin.x}%` }}
    >
      <div
        className={cn(
          'group relative flex flex-col',
          pin.anchor === 'end' ? 'items-end self-end' : 'items-center',
          pin.row === 1 ? 'mt-11' : 'mt-1',
        )}
      >
        <HubLink
          to={`/cards/${card.key}`}
          aria-label={card.flags?.escalated ? `${label}${locale === 'ar' ? '، ' : ', '}${t.runway.escalated}` : label}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-full border bg-card px-2.5 text-caption whitespace-nowrap shadow-sm hover:bg-accent',
            late ? 'border-destructive/60' : 'border-border',
            focusRing,
          )}
        >
          <TypeDot type={card.type} />
          <Ltr mono className="font-medium text-foreground">
            {card.key}
          </Ltr>
          {!late && <Ltr className="text-muted-foreground tabular-nums">{time(card.dueAt!, locale)}</Ltr>}
        </HubLink>
        {/* Title on hover or keyboard focus: the strip stays a picture, the label stays readable. */}
        <div
          role="presentation"
          className="pointer-events-none invisible absolute top-full z-20 mt-1.5 w-60 rounded-lg border border-border bg-popover p-2.5 text-start opacity-0 shadow-md transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
        >
          <p className="text-body-sm font-medium text-popover-foreground">{card.title[locale]}</p>
          <p className="mt-1 text-caption text-muted-foreground">
            {late ? fmt(t.stack.overdueBy, { d: duration(Date.parse(card.dueAt!) - nowMs(), locale) }) : rel(card.dueAt!, locale)}
            {' · '}
            {when(card.dueAt!, locale)}
          </p>
        </div>
      </div>
      <span aria-hidden className={cn('w-px flex-1', late ? 'bg-destructive/70' : typeClass[card.type].dot)} />
      <span
        aria-hidden
        className={cn(
          'size-3 shrink-0 translate-y-1.5 rounded-full ring-2 ring-card',
          typeClass[card.type].dot,
          card.flags?.escalated && 'outline-2 outline-offset-2 outline-destructive',
        )}
      />
    </li>
  );
}

function Strip({ cards }: { cards: CardRow[] }) {
  const t = useT(messages);
  const locale = useLocale();
  const pins = layoutPins(cards);
  const ticks = dayTicks();
  const soonEnd = xOf(24);
  return (
    <div className="relative hidden h-44 md:block">
      {/* zones */}
      <div aria-hidden className="absolute inset-y-0 start-0 rounded-s-lg bg-destructive-soft" style={{ width: `${LATE}%` }} />
      <div
        aria-hidden
        className="absolute inset-y-0 bg-warning-soft/45"
        style={{ insetInlineStart: `${LATE}%`, width: `${soonEnd - LATE}%` }}
      />
      <span className="absolute start-2 bottom-1 inline-flex items-center gap-1 text-caption font-medium text-destructive-soft-foreground">
        <Clock aria-hidden className="size-3" strokeWidth={2} />
        {t.runway.overdue}
      </span>
      {/* track */}
      <div aria-hidden className="absolute end-0 bottom-9 h-px bg-border" style={{ insetInlineStart: `${LATE}%` }} />
      {/* day boundaries */}
      {ticks.map((tick) => (
        <div
          key={tick.iso}
          aria-hidden
          className="absolute top-8 bottom-0 border-s border-dashed border-border"
          style={{ insetInlineStart: `${xOf(tick.h)}%` }}
        >
          <span className="absolute bottom-1 start-1.5 text-caption whitespace-nowrap text-muted-foreground">
            {weekday(tick.iso, locale, 'long')}
          </span>
        </div>
      ))}
      <div aria-hidden className="absolute top-8 bottom-0 border-s border-dashed border-warning/70" style={{ insetInlineStart: `${soonEnd}%` }}>
        <span className="absolute top-0 start-1 text-caption whitespace-nowrap text-warning-strong">
          {t.runway.day24}
        </span>
      </div>
      {/* now */}
      <div aria-hidden className="absolute top-0 bottom-0 w-0.5 bg-primary" style={{ insetInlineStart: `${LATE}%` }}>
        <span className="absolute bottom-1 start-1.5 rounded-sm bg-card px-1 text-caption font-semibold whitespace-nowrap text-primary">
          {t.runway.now} <Ltr className="tabular-nums">{time(NOW, locale)}</Ltr>
        </span>
      </div>
      <ol aria-label={t.runway.title} className="absolute inset-0">
        {pins.map((pin) => (
          <PinLabel key={pin.card.key} pin={pin} />
        ))}
      </ol>
    </div>
  );
}

/** Phone fallback (and the readable twin of the strip): a sorted list with "in 3 h" words. */
function List({ cards, className }: { cards: CardRow[]; className?: string }) {
  const t = useT(messages);
  const locale = useLocale();
  const sorted = [...cards].sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
  return (
    <ol className={cn('flex flex-col gap-1.5', className)}>
      {sorted.map((card) => {
        const late = hoursFromNow(card.dueAt!) < 0;
        return (
          <li key={card.key}>
            <HubLink
              to={`/cards/${card.key}`}
              className={cn(
                'flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent',
                late ? 'bg-destructive-soft' : 'bg-card',
              )}
            >
              <TypeDot type={card.type} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <Ltr mono className="text-caption text-muted-foreground">
                    {card.key}
                  </Ltr>
                </span>
                <span className="line-clamp-2 text-body text-foreground">{card.title[locale]}</span>
              </span>
              <span className="shrink-0 text-end text-caption">
                <span className={cn('block font-medium', late ? 'text-destructive-soft-foreground' : 'text-foreground')}>
                  {late ? fmt(t.stack.overdueBy, { d: duration(Date.parse(card.dueAt!) - nowMs(), locale) }) : rel(card.dueAt!, locale)}
                </span>
                <span className={late ? 'text-destructive-soft-foreground' : 'text-muted-foreground'}>{when(card.dueAt!, locale)}</span>
              </span>
            </HubLink>
          </li>
        );
      })}
    </ol>
  );
}

export function DeadlineRunway({ cards }: { cards: CardRow[] }) {
  const t = useT(messages);
  const within = cards.filter((c) => c.dueAt && hoursFromNow(c.dueAt) <= SPAN_H);
  return (
    <section aria-labelledby="runway-title" className="flex flex-col gap-4">
      <SectionHead id="runway-title" icon={CalendarClock} title={t.runway.title} count={within.length} />
      {within.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t.runway.empty} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-1.5 md:p-2">
          <Strip cards={within} />
          <List cards={within} className="md:hidden" />
        </div>
      )}
    </section>
  );
}
