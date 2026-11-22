/**
 * The search card: a white plaque over the lower edge of the navy block (references.md 8.1 pattern 1), every field in
 * one bordered group with hairline dividers (pattern 3), and the page's one primary button (teal, white label).
 * The form is visible on a phone without a tap (audit L-10) and grows with its content (L-09). Flights is the only
 * product, so there are no product tabs here; the other products live in the services list as "soon".
 */
import { useRef, useState, type FormEvent } from 'react';
import { CalendarDays, Loader2, PlaneLanding, PlaneTakeoff, Plus, Search, Trash2, ArrowLeftRight, Wrench } from 'lucide-react';
import { useLocale } from '@lab/i18n';
import { cn } from '@lab/utils';
import { fill, type Messages } from '../i18n';
import { AirportField } from './airport-field';
import { DateField } from './date-field';
import { focusRing } from './field';
import { incomplete, resultsHref, type Criteria, type Incomplete, type Leg, type TripType } from './format';
import { TODAY, type Airport } from './mocks';
import { PartyField } from './party-field';

export const SEARCH_ID = 'flight-search';
const ERROR_ID = 'flight-search-error';
const MAX_LEGS = 5;

export function emptyCriteria(): Criteria {
  return {
    trip: 'roundTrip',
    legs: [{ id: 0, from: null, to: null, date: null }],
    returnDate: null,
    party: { adults: 1, childAges: [], infantAges: [], cabin: 'economy' },
  };
}

interface SearchCardProps {
  criteria: Criteria;
  onChange: (c: Criteria) => void;
  maintenance: boolean;
  t: Messages;
}

export function SearchCard({ criteria: c, onChange, maintenance, t }: SearchCardProps) {
  const locale = useLocale();
  const f = t.form;
  const [openField, setOpenField] = useState<string | null>(null);
  const [error, setError] = useState<{ reason: Incomplete; field: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [href, setHref] = useState<string | null>(null);
  const nextFocus = useRef<string | null>(null);
  const nextLegId = useRef(1);

  const update = (next: Criteria) => {
    setError(null);
    onChange(next);
  };
  const setLeg = (id: number, patch: Partial<Leg>) =>
    update({ ...c, legs: c.legs.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  const toggle = (id: string) => (open: boolean) => setOpenField(open ? id : null);
  const takeNextFocus = () => {
    const id = nextFocus.current;
    nextFocus.current = null;
    return id;
  };

  /** After a pick: close, then move focus to the next field that still needs a value (L-55). */
  const advance = (afterId: string, legs: Leg[], returnDate: string | null) => {
    const order: Array<[string, boolean]> = [];
    const shownLegs = c.trip === 'multiCity' ? legs : legs.slice(0, 1);
    for (const l of shownLegs) {
      order.push([`from-${l.id}`, !!l.from], [`to-${l.id}`, !!l.to], [`date-${l.id}`, !!l.date]);
    }
    if (c.trip === 'roundTrip') order.push(['return', !!returnDate]);
    order.push(['party', true]);
    const start = order.findIndex(([id]) => id === afterId);
    const next = order.slice(start + 1).find(([, filled]) => !filled)?.[0] ?? order[start + 1]?.[0] ?? null;
    nextFocus.current = next;
    setOpenField(null);
  };

  const pickAirport = (leg: Leg, side: 'from' | 'to', a: Airport) => {
    const legs = c.legs.map((l) => (l.id === leg.id ? { ...l, [side]: a } : l));
    // Multi-city: the next flight leaves from where this one lands.
    if (c.trip === 'multiCity' && side === 'to') {
      const i = legs.findIndex((l) => l.id === leg.id);
      if (legs[i + 1] && !legs[i + 1].from) legs[i + 1] = { ...legs[i + 1], from: a };
    }
    update({ ...c, legs });
    advance(`${side}-${leg.id}`, legs, c.returnDate);
  };

  const pickDate = (leg: Leg, iso: string) => {
    const legs = c.legs.map((l) => (l.id === leg.id ? { ...l, date: iso } : l));
    const returnDate = c.returnDate && c.returnDate < iso ? null : c.returnDate;
    update({ ...c, legs, returnDate });
    if (c.trip === 'roundTrip' && !returnDate) {
      // The return calendar follows the departure one, as on the real site; it takes focus itself.
      nextFocus.current = '';
      setOpenField('return');
    } else {
      advance(`date-${leg.id}`, legs, returnDate);
    }
  };

  const swap = () => {
    const l = c.legs[0];
    setLeg(l.id, { from: l.to, to: l.from });
  };

  const setTrip = (trip: TripType) => {
    let legs = c.legs;
    if (trip === 'multiCity' && legs.length < 2) {
      const first = legs[0];
      legs = [first, { id: nextLegId.current++, from: first.to, to: null, date: null }];
    }
    update({ ...c, trip, legs });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = incomplete(c);
    if (problem) {
      setError(problem);
      document.getElementById(problem.field)?.focus();
      return;
    }
    const link = resultsHref(c, locale);
    setHref(link);
    setBusy(true);
    // In the real page: router.push(link). The lab stays here and shows the link it would open.
    window.setTimeout(() => setBusy(false), 1400);
  };

  if (maintenance) {
    return (
      <section
        aria-labelledby="maintenance-title"
        className="rounded-2xl border border-(--line) bg-(--card) p-5 shadow-(--elev-float) sm:p-6"
      >
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-(--warning-soft) text-(--warning-ink)">
            <Wrench className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="maintenance-title" className="text-lg font-bold text-(--brand-ink)">
              {f.maintenanceTitle}
            </h2>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-(--ink)">{f.maintenanceBody}</p>
            <a
              href="#manage-booking"
              className={cn('mt-3 inline-flex min-h-11 items-center rounded-md border border-(--border-strong) px-4 text-sm font-bold text-(--brand-ink) hover:bg-(--surface-2)', focusRing)}
            >
              {t.support.manage}
            </a>
          </div>
        </div>
      </section>
    );
  }

  const legsShown = c.trip === 'multiCity' ? c.legs : c.legs.slice(0, 1);
  const err = (field: string) => error?.field === field;
  const minFor = (i: number) => (i > 0 && legsShown[i - 1].date ? legsShown[i - 1].date! : TODAY);
  const tripTypes: Array<[TripType, string]> = [
    ['oneWay', f.tripTypeOneWay],
    ['roundTrip', f.tripTypeRoundTrip],
    ['multiCity', f.tripTypeMultiCity],
  ];

  const routePair = (leg: Leg, index: number) => (
    <div className="relative grid grid-cols-1 gap-px md:grid-cols-2">
      <AirportField
        id={`from-${leg.id}`}
        label={f.fromLabel}
        icon={PlaneTakeoff}
        airport={leg.from}
        onSelect={(a) => pickAirport(leg, 'from', a)}
        open={openField === `from-${leg.id}`}
        onOpenChange={toggle(`from-${leg.id}`)}
        focusAfterClose={takeNextFocus}
        invalid={err(`from-${leg.id}`)}
        errorId={ERROR_ID}
        className="bg-(--card) md:pe-8"
        t={f}
      />
      <AirportField
        id={`to-${leg.id}`}
        label={f.toLabel}
        icon={PlaneLanding}
        airport={leg.to}
        onSelect={(a) => pickAirport(leg, 'to', a)}
        open={openField === `to-${leg.id}`}
        onOpenChange={toggle(`to-${leg.id}`)}
        focusAfterClose={takeNextFocus}
        invalid={err(`to-${leg.id}`)}
        errorId={ERROR_ID}
        className="bg-(--card) md:ps-8"
        t={f}
      />
      {index === 0 && c.trip !== 'multiCity' && (
        <button
          type="button"
          onClick={swap}
          aria-label={f.swap}
          disabled={!leg.from && !leg.to}
          className={cn(
            'absolute z-[2] flex size-11 items-center justify-center rounded-full border border-(--border-strong) bg-(--card) text-(--brand-ink) transition-colors duration-150 hover:bg-(--surface-2) disabled:text-(--ink-subtle)',
            // phone: on the divider, at the end side; md+: centred between From and To
            'end-4 top-1/2 -translate-y-1/2 md:end-auto md:start-1/2 md:-translate-x-1/2 md:rtl:translate-x-1/2',
            focusRing,
          )}
        >
          <ArrowLeftRight className="size-4 rotate-90 md:rotate-0" aria-hidden />
        </button>
      )}
    </div>
  );

  const departField = (leg: Leg, i: number, extra?: string) => (
    <DateField
      id={`date-${leg.id}`}
      label={f.departureLabel}
      icon={CalendarDays}
      value={leg.date}
      onSelect={(iso) => pickDate(leg, iso)}
      min={minFor(i)}
      open={openField === `date-${leg.id}`}
      onOpenChange={toggle(`date-${leg.id}`)}
      focusAfterClose={takeNextFocus}
      invalid={err(`date-${leg.id}`)}
      errorId={ERROR_ID}
      className={cn('bg-(--card)', extra)}
      t={f}
    />
  );

  const partyField = (extra?: string) => (
    <PartyField
      id="party"
      party={c.party}
      onChange={(party) => update({ ...c, party })}
      open={openField === 'party'}
      onOpenChange={toggle('party')}
      invalid={err('party')}
      errorId={ERROR_ID}
      className={cn('bg-(--card)', extra)}
      t={f}
      travellers={t.travellers}
    />
  );

  const searchButton = (extra?: string) => (
    <button
      type="submit"
      aria-disabled={busy || undefined}
      className={cn(
        'inline-flex min-h-13 items-center justify-center gap-2 rounded-md bg-(--action) px-7 text-base font-bold text-(--action-foreground) transition-colors duration-150 hover:bg-(--action-hover)',
        'outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)',
        busy && 'cursor-progress',
        extra,
      )}
    >
      {busy ? <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden /> : <Search className="size-5" aria-hidden />}
      <span>{busy ? f.searching : f.search}</span>
    </button>
  );

  const group = 'grid gap-px overflow-hidden rounded-xl border border-(--border-strong) bg-(--line)';

  return (
    <form
      id={SEARCH_ID}
      onSubmit={submit}
      noValidate
      aria-labelledby="search-title"
      data-href={href ?? undefined}
      className="rounded-2xl border border-(--line) bg-(--card) p-3 shadow-(--elev-float) sm:p-4 lg:p-5"
    >
      <h2 id="search-title" className="sr-only">
        {f.title}
      </h2>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div role="radiogroup" aria-label={f.tripType} className="flex w-full rounded-lg bg-(--surface-3) p-1 sm:w-auto">
          {tripTypes.map(([value, label]) => (
            <label
              key={value}
              className={cn(
                'relative flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 sm:flex-none sm:px-4',
                'has-focus-visible:outline-solid has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-(--ring)',
                c.trip === value ? 'bg-(--brand) text-(--brand-foreground)' : 'text-(--ink) hover:text-(--brand-ink)',
              )}
            >
              <input
                type="radio"
                name="trip"
                value={value}
                checked={c.trip === value}
                onChange={() => setTrip(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="hidden text-sm text-(--ink-muted) sm:block">{f.priceNote}</p>
      </div>

      {c.trip !== 'multiCity' ? (
        <div className="mt-3 flex flex-col gap-3 lg:mt-4 lg:flex-row lg:items-stretch">
          <div
            className={cn(
              group,
              'min-w-0 flex-1 grid-cols-2',
              c.trip === 'roundTrip'
                ? 'lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)]'
                : 'lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1.2fr)_minmax(0,1.35fr)]',
            )}
          >
            <div className="col-span-2 lg:col-span-1">{routePair(c.legs[0], 0)}</div>
            {departField(c.legs[0], 0, c.trip === 'oneWay' ? 'col-span-2 lg:col-span-1' : undefined)}
            {c.trip === 'roundTrip' && (
              <DateField
                id="return"
                label={f.returnLabel}
                icon={CalendarDays}
                value={c.returnDate}
                onSelect={(iso) => {
                  update({ ...c, returnDate: iso });
                  advance('return', c.legs, iso);
                }}
                min={c.legs[0].date ?? TODAY}
                rangeStart={c.legs[0].date}
                hint={c.legs[0].date && !c.returnDate ? f.pickReturn : null}
                open={openField === 'return'}
                onOpenChange={toggle('return')}
                focusAfterClose={takeNextFocus}
                invalid={err('return')}
                errorId={ERROR_ID}
                className="bg-(--card)"
                t={f}
              />
            )}
            {partyField('col-span-2 lg:col-span-1')}
          </div>
          {searchButton('w-full lg:w-auto lg:min-h-0')}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3 lg:mt-4">
          <ol className="flex flex-col gap-3">
            {c.legs.map((leg, i) => (
              <li key={leg.id}>
                <div className="mb-1.5 flex min-h-11 items-center justify-between">
                  <p className="text-sm font-semibold text-(--brand-ink)">{fill(f.flight, { n: i + 1 })}</p>
                  {c.legs.length > 2 && (
                    <button
                      type="button"
                      onClick={() => update({ ...c, legs: c.legs.filter((l) => l.id !== leg.id) })}
                      className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-(--danger-ink) hover:bg-(--danger-soft)', focusRing)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      {fill(f.removeFlight, { n: i + 1 })}
                    </button>
                  )}
                </div>
                <div className={cn(group, 'grid-cols-1 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]')}>
                  {routePair(leg, i)}
                  {departField(leg, i)}
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            {c.legs.length < MAX_LEGS && (
              <button
                type="button"
                onClick={() => {
                  const last = c.legs[c.legs.length - 1];
                  update({ ...c, legs: [...c.legs, { id: nextLegId.current++, from: last.to, to: null, date: null }] });
                }}
                className={cn(
                  'inline-flex min-h-13 items-center justify-center gap-2 rounded-md border border-(--border-strong) px-5 text-sm font-bold text-(--brand-ink) hover:bg-(--surface-2)',
                  focusRing,
                )}
              >
                <Plus className="size-4" aria-hidden />
                {f.addFlight}
              </button>
            )}
            <div className={cn(group, 'flex-1 grid-cols-1')}>{partyField()}</div>
            {searchButton('w-full lg:w-auto')}
          </div>
        </div>
      )}

      <div aria-live="assertive" className="min-h-0">
        {error && (
          <p id={ERROR_ID} role="alert" className="mt-3 flex items-center gap-2 text-sm font-semibold text-(--danger-ink)">
            <span aria-hidden className="inline-flex size-5 items-center justify-center rounded-full bg-(--danger) text-xs font-bold text-(--danger-foreground)">
              !
            </span>
            {t.incomplete[error.reason]}
          </p>
        )}
      </div>
      {href && (
        <p className="mt-2 text-xs text-(--ink-muted)" dir="ltr" translate="no">
          lab: {href}
        </p>
      )}
      <p className="mt-2 text-xs text-(--ink-muted) sm:hidden">{f.priceNote}</p>
    </form>
  );
}
