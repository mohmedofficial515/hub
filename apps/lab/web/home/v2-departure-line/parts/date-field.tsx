/**
 * A date cell with a one-month grid. Roving focus: arrows move a day / a week (mirrored in RTL), PageUp/PageDown
 * a month, Home/End the week, Enter or Space picks. Days before `min` are disabled. With `rangeStart` set (the
 * return of a round trip) the trip span is tinted so the traveller sees both dates in the calendar they are in.
 * The real field also shows the day prices of the fare calendar; the lab leaves prices out (no invented fares).
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { useLocale } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Field } from './field';
import { addDays, fieldDate, longDate, monthTitle, parseIso, toIso, weekdayNames, weekStart } from './format';

interface DateFieldProps {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string | null;
  onSelect: (iso: string) => void;
  min: string;
  rangeStart?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusAfterClose: () => string | null;
  invalid?: boolean;
  errorId?: string;
  hint?: string | null;
  className?: string;
  t: { selectDates: string; prevMonth: string; nextMonth: string; calendar: string };
}

export function DateField(props: DateFieldProps) {
  const { id, label, icon, value, open, onOpenChange, focusAfterClose, invalid, errorId, className, t } = props;
  const locale = useLocale();
  const shown = value ? fieldDate(value, locale) : null;
  return (
    <Field
      id={id}
      label={label}
      icon={icon}
      open={open}
      onOpenChange={onOpenChange}
      focusAfterClose={focusAfterClose}
      invalid={invalid}
      errorId={errorId}
      className={className}
      contentClassName="w-[min(92vw,21rem)] p-3"
      value={
        shown ? (
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="tnum text-xl leading-tight font-bold text-(--brand-ink)">{shown.day}</span>
            <span className="truncate text-sm font-medium text-(--ink)">{shown.rest}</span>
          </span>
        ) : null
      }
      placeholder={t.selectDates}
    >
      <Calendar {...props} />
    </Field>
  );
}

function Calendar({ value, onSelect, min, rangeStart, hint, t }: DateFieldProps) {
  const locale = useLocale();
  const rtl = locale === 'ar';
  const initial = value ?? (rangeStart && rangeStart > min ? addDays(rangeStart, 7) : min);
  const [focus, setFocus] = useState(initial);
  const [view, setView] = useState(() => ({ y: parseIso(initial).getUTCFullYear(), m: parseIso(initial).getUTCMonth() }));
  const grid = useRef<HTMLDivElement>(null);
  const focusOnRender = useRef(true);

  useEffect(() => {
    if (!focusOnRender.current) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)?.focus();
  }, [focus, view]);

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const lead = (first.getUTCDay() - weekStart(locale) + 7) % 7;
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toIso(new Date(Date.UTC(view.y, view.m, i + 1)))),
  ];

  const minMonth = { y: parseIso(min).getUTCFullYear(), m: parseIso(min).getUTCMonth() };
  const canPrev = view.y > minMonth.y || (view.y === minMonth.y && view.m > minMonth.m);

  const move = (iso: string) => {
    const clamped = iso < min ? min : iso;
    const d = parseIso(clamped);
    focusOnRender.current = true;
    setFocus(clamped);
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };

  const shiftMonth = (delta: number, keepFocus: boolean) => {
    const d = new Date(Date.UTC(view.y, view.m + delta, 1));
    focusOnRender.current = keepFocus;
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
    if (!keepFocus) {
      // Keep one tabbable day in the month on screen, without taking focus from the arrow button.
      const firstDay = toIso(d);
      setFocus(firstDay < min ? min : firstDay);
    } else {
      const day = Math.min(parseIso(focus).getUTCDate(), new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate());
      move(toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day))));
    }
  };

  const onKey = (e: KeyboardEvent) => {
    const dir = rtl ? -1 : 1;
    const map: Record<string, () => void> = {
      ArrowRight: () => move(addDays(focus, dir)),
      ArrowLeft: () => move(addDays(focus, -dir)),
      ArrowDown: () => move(addDays(focus, 7)),
      ArrowUp: () => move(addDays(focus, -7)),
      PageDown: () => shiftMonth(1, true),
      PageUp: () => shiftMonth(-1, true),
      Home: () => move(addDays(focus, -((parseIso(focus).getUTCDay() - weekStart(locale) + 7) % 7))),
      End: () => move(addDays(focus, 6 - ((parseIso(focus).getUTCDay() - weekStart(locale) + 7) % 7))),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;
  const navBtn =
    'flex size-11 items-center justify-center rounded-md text-(--brand-ink) hover:bg-(--surface-2) disabled:opacity-30 outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--ring)';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className={navBtn} aria-label={t.prevMonth} disabled={!canPrev} onClick={() => shiftMonth(-1, false)}>
          <Prev className="size-5" aria-hidden />
        </button>
        <p aria-live="polite" className="tnum text-base font-semibold text-(--brand-ink)">
          {monthTitle(view.y, view.m, locale)}
        </p>
        <button type="button" className={navBtn} aria-label={t.nextMonth} onClick={() => shiftMonth(1, false)}>
          <Next className="size-5" aria-hidden />
        </button>
      </div>
      {hint && <p className="mb-2 text-center text-sm text-(--ink-muted)">{hint}</p>}
      <div role="grid" aria-label={t.calendar} ref={grid} onKeyDown={onKey}>
        <div role="row" className="grid grid-cols-7">
          {weekdayNames(locale).map((w, i) => (
            <span role="columnheader" key={i} className="py-1 text-center text-xs font-semibold text-(--ink-muted)">
              {w}
            </span>
          ))}
        </div>
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, r) => (
          <div role="row" key={r} className="grid grid-cols-7">
            {cells.slice(r * 7, r * 7 + 7).map((iso, c) => {
              if (!iso) return <span role="gridcell" key={c} />;
              const disabled = iso < min;
              const selected = iso === value;
              const isStart = iso === rangeStart;
              const inRange = !!rangeStart && !!value && iso > rangeStart && iso < value;
              return (
                <span role="gridcell" key={iso} aria-selected={selected || isStart || undefined}>
                  <button
                    type="button"
                    data-day={iso}
                    tabIndex={iso === focus ? 0 : -1}
                    disabled={disabled}
                    aria-label={longDate(iso, locale)}
                    aria-pressed={selected}
                    onClick={() => onSelect(iso)}
                    className={cn(
                      'tnum flex h-11 w-full items-center justify-center rounded-md text-sm font-medium text-(--ink) transition-colors duration-150',
                      'outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)',
                      !disabled && !selected && 'hover:bg-(--surface-2)',
                      disabled && 'cursor-not-allowed text-(--ink-subtle)',
                      inRange && 'rounded-none bg-(--brand-soft)',
                      (selected || isStart) && 'bg-(--brand) font-bold text-(--brand-foreground)',
                    )}
                  >
                    {parseIso(iso).getUTCDate()}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
