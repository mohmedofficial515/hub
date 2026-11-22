/**
 * Travellers and cabin. Limits as `travellerLimits` / `withAdults` (`apiEndpoint/flights`): at most 9 travellers,
 * at least 1 adult, no more lap infants than adults (lowering adults lowers infants). Each child needs an age (2-17),
 * each infant 0 or 1. Steppers are 44px and named ("Add adults"), which the real 32px ones are not (audit L-43, L-53).
 */
import { Minus, Plus, Users } from 'lucide-react';
import { cn } from '@lab/utils';
import { fill, type Messages } from '../i18n';
import { Field, focusRing } from './field';
import type { CabinParam, Party } from './format';

const MAX = 9;

interface PartyFieldProps {
  id: string;
  party: Party;
  onChange: (party: Party) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invalid?: boolean;
  errorId?: string;
  className?: string;
  t: Messages['form'];
  travellers: (n: number) => string;
}

export const CABINS: CabinParam[] = ['economy', 'premium_economy', 'business', 'first'];

export function cabinLabel(c: CabinParam, t: Messages['form']) {
  return { economy: t.classEconomy, premium_economy: t.classPremium, business: t.classBusiness, first: t.classFirst }[c];
}

export function PartyField({ id, party, onChange, open, onOpenChange, invalid, errorId, className, t, travellers }: PartyFieldProps) {
  const adults = party.adults;
  const children = party.childAges.length;
  const infants = party.infantAges.length;
  const total = adults + children + infants;
  const room = MAX - total;

  const setAdults = (n: number) =>
    onChange({ ...party, adults: n, infantAges: party.infantAges.slice(0, n) });
  const setChildren = (n: number) =>
    onChange({
      ...party,
      childAges: n > children ? [...party.childAges, ...Array<null>(n - children).fill(null)] : party.childAges.slice(0, n),
    });
  const setInfants = (n: number) =>
    onChange({
      ...party,
      infantAges: n > infants ? [...party.infantAges, ...Array<number>(n - infants).fill(0)] : party.infantAges.slice(0, n),
    });

  const rows = [
    { key: 'adults', label: t.adults, sub: t.adultsSub, value: adults, min: 1, max: adults + room, set: setAdults },
    { key: 'children', label: t.children, sub: t.childrenSub, value: children, min: 0, max: children + room, set: setChildren },
    { key: 'infants', label: t.infants, sub: t.infantsSub, value: infants, min: 0, max: Math.min(adults, infants + room), set: setInfants },
  ];

  return (
    <Field
      id={id}
      label={t.travelersClass}
      icon={Users}
      open={open}
      onOpenChange={onOpenChange}
      invalid={invalid}
      errorId={errorId}
      className={className}
      align="end"
      contentClassName="w-[min(92vw,22rem)] p-4"
      value={
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-base leading-tight font-bold whitespace-nowrap text-(--brand-ink)">{travellers(total)}</span>
          <span className="truncate text-sm font-medium text-(--ink)">{cabinLabel(party.cabin, t)}</span>
        </span>
      }
      placeholder=""
    >
      <ul className="divide-y divide-(--line)">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 py-3 first:pt-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-(--brand-ink)">{r.label}</p>
              <p className="text-xs text-(--ink-muted)">{r.sub}</p>
            </div>
            <div className="flex items-center gap-1" role="group" aria-label={r.label}>
              <Stepper icon="minus" label={fill(t.remove, { label: r.label })} disabled={r.value <= r.min} onClick={() => r.set(r.value - 1)} />
              <output aria-live="polite" className="tnum w-8 text-center text-base font-bold text-(--brand-ink)">
                {r.value}
              </output>
              <Stepper icon="plus" label={fill(t.add, { label: r.label })} disabled={r.value >= r.max} onClick={() => r.set(r.value + 1)} />
            </div>
          </li>
        ))}
      </ul>

      {(children > 0 || infants > 0) && (
        <div className="mt-1 grid grid-cols-2 gap-2 border-t border-(--line) pt-3">
          {party.childAges.map((age, i) => (
            <AgeSelect
              key={`c${i}`}
              label={fill(t.childAge, { n: i + 1 })}
              value={age}
              invalid={age === null && invalid}
              options={Array.from({ length: 16 }, (_, k) => ({ value: k + 2, text: fill(t.ageYears, { n: k + 2 }) }))}
              placeholder={t.chooseAge}
              onChange={(v) => onChange({ ...party, childAges: party.childAges.map((a, j) => (j === i ? v : a)) })}
            />
          ))}
          {party.infantAges.map((age, i) => (
            <AgeSelect
              key={`i${i}`}
              label={fill(t.infantAge, { n: i + 1 })}
              value={age}
              options={[
                { value: 0, text: t.underOne },
                { value: 1, text: t.oneYear },
              ]}
              onChange={(v) => onChange({ ...party, infantAges: party.infantAges.map((a, j) => (j === i ? (v ?? 0) : a)) })}
            />
          ))}
        </div>
      )}

      <fieldset className="mt-3 border-t border-(--line) pt-3">
        <legend className="sr-only">{t.cabinClass}</legend>
        <p aria-hidden className="mb-2 text-sm font-semibold text-(--brand-ink)">
          {t.cabinClass}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CABINS.map((c) => (
            <label
              key={c}
              className={cn(
                'flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-2 text-center text-sm font-semibold transition-colors duration-150',
                'has-focus-visible:outline-solid has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--ring)',
                party.cabin === c
                  ? 'border-(--brand) bg-(--brand) text-(--brand-foreground)'
                  : 'border-(--border-strong) text-(--ink) hover:bg-(--surface-2)',
              )}
            >
              <input
                type="radio"
                name={`${id}-cabin`}
                value={c}
                checked={party.cabin === c}
                onChange={() => onChange({ ...party, cabin: c })}
                className="sr-only"
              />
              {cabinLabel(c, t)}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className={cn(
          'mt-4 h-11 w-full rounded-md border border-(--border-strong) text-sm font-bold text-(--brand-ink) hover:bg-(--surface-2)',
          focusRing,
        )}
      >
        {t.done}
      </button>
    </Field>
  );
}

function Stepper({ icon, label, disabled, onClick }: { icon: 'plus' | 'minus'; label: string; disabled: boolean; onClick: () => void }) {
  const Icon = icon === 'plus' ? Plus : Minus;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-11 items-center justify-center rounded-full border border-(--border-strong) text-(--brand-ink) transition-colors duration-150',
        'hover:bg-(--surface-2) disabled:cursor-not-allowed disabled:opacity-35',
        focusRing,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

function AgeSelect({
  label,
  value,
  options,
  placeholder,
  invalid,
  onChange,
}: {
  label: string;
  value: number | null;
  options: { value: number; text: string }[];
  placeholder?: string;
  invalid?: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-(--ink-muted)">
      {label}
      <select
        value={value ?? ''}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={cn(
          'h-11 rounded-md border bg-(--background) px-2 text-sm font-medium text-(--ink)',
          invalid ? 'border-(--danger)' : 'border-(--input)',
          focusRing,
        )}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.text}
          </option>
        ))}
      </select>
    </label>
  );
}
