/**
 * From / To: the value is the IATA code, large, with the city under it (Singapore Airlines shows "SIN" as the
 * value, references.md #5). The popover is a combobox: type a code, city, airport or country; arrows move;
 * Enter picks. After a pick the parent moves focus to the next empty field (audit L-55).
 */
import { useId, useMemo, useState } from 'react';
import { Building2, MapPin, type LucideIcon } from 'lucide-react';
import { useLocale } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Field } from './field';
import { searchAirports, type Airport } from './mocks';

interface AirportFieldProps {
  id: string;
  label: string;
  icon: LucideIcon;
  airport: Airport | null;
  onSelect: (airport: Airport) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusAfterClose: () => string | null;
  invalid?: boolean;
  errorId?: string;
  className?: string;
  t: { cityOrAirport: string; searchAirport: string; popularAirports: string; noAirport: string };
}

export function AirportField({
  id,
  label,
  icon,
  airport,
  onSelect,
  open,
  onOpenChange,
  focusAfterClose,
  invalid,
  errorId,
  className,
  t,
}: AirportFieldProps) {
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchAirports(query, locale), [query, locale]);
  const listId = useId();

  const pick = (a: Airport) => {
    onSelect(a);
    setQuery('');
    setActive(0);
  };

  return (
    <Field
      id={id}
      label={label}
      icon={icon}
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery('');
      }}
      focusAfterClose={focusAfterClose}
      invalid={invalid}
      errorId={errorId}
      className={className}
      contentClassName="w-[min(92vw,24rem)] p-2"
      value={
        airport ? (
          <span className="flex min-w-0 items-baseline gap-2">
            <span translate="no" className="tnum text-xl leading-tight font-bold text-(--brand-ink)">
              {airport.code}
            </span>
            <span className="truncate text-sm font-medium text-(--ink)">{airport.city}</span>
          </span>
        ) : null
      }
      placeholder={t.cityOrAirport}
    >
      <input
        autoFocus
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={results[active] ? `${listId}-${results[active].code}` : undefined}
        aria-label={t.searchAirport}
        placeholder={t.searchAirport}
        name={`${id}-airport`}
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && results[active]) {
            e.preventDefault();
            pick(results[active]);
          }
        }}
        className="h-11 w-full rounded-md border border-(--input) bg-(--background) px-3 text-base text-(--ink) placeholder:text-(--ink-muted) outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)"
      />
      {!query && <p className="px-2 pt-3 pb-1 text-xs font-semibold text-(--ink-muted)">{t.popularAirports}</p>}
      <ul id={listId} role="listbox" aria-label={label} className="mt-1 max-h-72 overflow-y-auto">
        {results.map((a, i) => {
          const Icon = a.kind === 'city' ? Building2 : MapPin;
          return (
            <li
              key={a.code}
              id={`${listId}-${a.code}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(a)}
              className={cn(
                'flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 py-2',
                i === active && 'bg-(--surface-2)',
              )}
            >
              <Icon className="size-5 shrink-0 text-(--ink-muted)" aria-hidden strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-(--brand-ink)">
                  {a.city}{' '}
                  <span translate="no" className="tnum text-(--ink-muted)">
                    ({a.code})
                  </span>
                </span>
                <span className="block truncate text-xs text-(--ink-muted)">
                  {a.name} · {a.country}
                </span>
              </span>
            </li>
          );
        })}
        {results.length === 0 && <li className="px-2 py-4 text-sm text-(--ink-muted)">{t.noAirport}</li>}
      </ul>
    </Field>
  );
}
