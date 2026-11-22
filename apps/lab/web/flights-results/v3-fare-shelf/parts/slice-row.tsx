import { Plane } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { messages } from '../i18n';
import type { SliceSummary } from '../mock';
import { clockOf, dateOf, dayOffsetOf, durationOf } from './model';

/**
 * One flight of the trip as a single line in the page's direction: departure, a hairline with stop dots, arrival.
 * Origin sits at the reading start in both languages, so the line runs the way the eye does (L-62).
 */
export function SliceRow({ slice, direction }: { slice: SliceSummary; direction: 'outbound' | 'inbound' }) {
  const t = useT(messages);
  const locale = useLocale();
  const offset = dayOffsetOf(slice.departingAt, slice.arrivingAt);
  const stops =
    slice.stopsCount === 0
      ? t.card.direct
      : `${t.card.stops(slice.stopsCount)}: ${slice.layoverIatas
          .map((code, i) => t.card.layover(code, durationOf(slice.layoverMinutes[i] ?? 0, locale)))
          .join(locale === 'ar' ? '، ' : ', ')}`;

  return (
    <div>
      <p className="mb-1 text-xs text-ink-muted">
        <span className="font-semibold text-ink">{direction === 'outbound' ? t.card.outbound : t.card.inbound}</span>
        <span aria-hidden> · </span>
        {dateOf(slice.departingAt, locale)}
      </p>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-4">
        <Endpoint time={clockOf(slice.departingAt)} code={slice.originIata} />

        <div className="min-w-0 text-center">
          <p className="truncate text-xs font-medium text-ink-muted tnum">{durationOf(slice.durationMinutes, locale)}</p>
          <div className="relative my-1.5 flex h-3 items-center" aria-hidden>
            <span className="h-px w-full bg-border-strong" />
            {slice.layoverIatas.map((code, i) => (
              <span
                key={code + i}
                className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-brand-ink bg-card"
                style={{ insetInlineStart: `calc(${((i + 1) / (slice.layoverIatas.length + 1)) * 100}% - 5px)` }}
              />
            ))}
            <Plane className="absolute -end-0.5 size-3.5 text-brand-ink rtl:-scale-x-100" />
          </div>
          <p className={slice.stopsCount ? 'text-xs text-ink' : 'text-xs text-ink-muted'}>{stops}</p>
        </div>

        <Endpoint
          time={clockOf(slice.arrivingAt)}
          code={slice.destinationIata}
          offset={offset}
          offsetLabel={offset > 0 ? t.card.nextDayLong(offset) : undefined}
          plus={t.card.nextDay(offset)}
        />
      </div>
    </div>
  );
}

function Endpoint({
  time,
  code,
  offset = 0,
  offsetLabel,
  plus,
}: {
  time: string;
  code: string;
  offset?: number;
  offsetLabel?: string;
  plus?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xl leading-tight font-semibold text-brand-ink tnum sm:text-2xl" dir="ltr">
        {time}
        {offset > 0 && (
          <sup className="ms-0.5 text-xs font-semibold text-ink-muted" title={offsetLabel}>
            {plus}
            <span className="sr-only"> {offsetLabel}</span>
          </sup>
        )}
      </p>
      <p className="mt-0.5 font-mono text-sm font-medium text-ink">{code}</p>
    </div>
  );
}
