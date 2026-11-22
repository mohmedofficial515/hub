import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookUser, Check, CircleAlert, CircleHelp, Plane, X } from 'lucide-react';
import { cn } from '@lab/utils';
import { useLocale } from '@lab/i18n';
import type { T } from '../i18n';
import { COUNTRIES, type PassengerSlot } from './data';
import {
  cleanName,
  cleanPassport,
  derivedTitle,
  expiryState,
  missingCount,
  ticketName,
  titleOptions,
  type PaxValues,
} from './form';
import { PassportGuide } from './passport-guide';
import { Checkbox, Field, Notice, Segmented, SelectInput, TextInput, focusRing } from './ui';

const THIS_YEAR = 2026;
const range = (from: number, to: number) => {
  const out: number[] = [];
  for (let i = from; from <= to ? i <= to : i >= to; from <= to ? i++ : i--) out.push(i);
  return out;
};

function DateParts({
  legend,
  t,
  day,
  month,
  year,
  years,
  onChange,
  idBase,
  error,
}: {
  legend: string;
  t: T;
  day: string;
  month: string;
  year: string;
  years: number[];
  onChange: (patch: { day?: string; month?: string; year?: string }) => void;
  idBase: string;
  /** Message under the group; empty parts are marked invalid while it shows. */
  error?: string;
}) {
  const msgId = `${idBase}-msg`;
  const mark = (v: string) =>
    error && !v ? { invalid: true, 'aria-describedby': msgId, 'aria-required': true as const } : { 'aria-required': true as const };
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-semibold text-(--foreground)">{legend}</legend>
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
        <SelectInput id={`${idBase}-d`} {...mark(day)} aria-label={t.pax.day} value={day} onChange={(e) => onChange({ day: e.target.value })}>
          <option value="">{t.pax.day}</option>
          {range(1, 31).map((d) => (
            <option key={d} value={String(d)}>
              {d}
            </option>
          ))}
        </SelectInput>
        <SelectInput id={`${idBase}-m`} {...mark(month)} aria-label={t.pax.month} value={month} onChange={(e) => onChange({ month: e.target.value })}>
          <option value="">{t.pax.month}</option>
          {t.pax.months.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </SelectInput>
        <SelectInput id={`${idBase}-y`} {...mark(year)} aria-label={t.pax.year} value={year} onChange={(e) => onChange({ year: e.target.value })}>
          <option value="">{t.pax.year}</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </SelectInput>
      </div>
      {error && (
        <p id={msgId} className="mt-1.5 flex items-start gap-1.5 text-sm leading-6 text-(--danger-ink)">
          <CircleAlert aria-hidden className="mt-1 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}

export function PassengerCard({
  t,
  slot,
  index,
  values,
  onChange,
  onClear,
  guest,
  showRequired,
}: {
  t: T;
  slot: PassengerSlot;
  index: number;
  values: PaxValues;
  onChange: (patch: Partial<PaxValues>) => void;
  onClear: () => void;
  guest: boolean;
  /** After a failed Continue: mark every empty required field. */
  showRequired: boolean;
}) {
  const lang = useLocale();
  const id = useId();
  const p = t.pax;
  const [nameErr, setNameErr] = useState<{ given?: boolean; family?: boolean }>({});
  const [guide, setGuide] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);

  const missing = missingCount(values);
  const name = ticketName(values, slot);
  const title = derivedTitle(values, slot);
  const expiry = expiryState(values);
  const typeLabel = p.type[slot.type];
  const req = (empty: boolean) => (showRequired && empty ? p.required : undefined);
  const errGiven = nameErr.given ? p.latinOnly : req(!values.givenName.trim());
  const errFamily = nameErr.family ? p.latinOnly : req(!values.familyName.trim());
  const errDob = req(!values.birthDay || !values.birthMonth || !values.birthYear);
  const errGender = req(!values.gender);
  const errPassport = req(!values.passportNumber && !values.savedMasked);
  const errIssuer = req(!values.passportCountry);
  const errExpiry = expiry === 'unset' ? req(true) : undefined;

  const setName = (key: 'givenName' | 'familyName', raw: string) => {
    const { value, stripped } = cleanName(raw);
    setNameErr((e) => ({ ...e, [key === 'givenName' ? 'given' : 'family']: stripped }));
    onChange({ [key]: value, savedId: values.savedId && value !== values[key] ? null : values.savedId });
  };

  return (
    <article
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-2xl border border-(--border) bg-(--card)"
      id={`pax-${slot.slotId}`}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-(--border) px-4 py-3.5 sm:px-6">
        <span
          aria-hidden
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors duration-200',
            missing === 0 ? 'bg-(--success-soft) text-(--success-ink)' : 'bg-(--brand-soft) text-(--brand-ink)',
          )}
        >
          {missing === 0 ? <Check className="size-4" strokeWidth={3} /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${id}-title`} className="text-base font-bold text-(--brand-ink)">
            {p.title(index + 1, typeLabel)}
          </h3>
          {slot.age !== null && <p className="text-xs text-(--ink-muted)">{p.childAge(slot.age)}</p>}
        </div>
        <p className={cn('text-sm font-semibold', missing === 0 ? 'text-(--success-ink)' : 'text-(--ink-muted)')} aria-live="polite">
          {missing === 0 ? p.complete : p.left(missing)}
        </p>
      </header>

      <div className="space-y-5 px-4 py-5 sm:px-6">
        {values.savedId && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-(--ink-muted)">
            <BookUser aria-hidden className="size-4 text-(--brand-ink)" />
            <span>{p.fromSaved}</span>
            <button type="button" onClick={onClear} className={cn('inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-semibold text-(--brand-ink) hover:bg-(--surface-2)', focusRing)}>
              <X aria-hidden className="size-4" />
              {p.clear}
            </button>
          </div>
        )}

        {/* The live ticket line: how the airline will print this name. */}
        <div className="rounded-lg bg-(--surface-2) px-3 py-2.5">
          <p className="text-xs font-semibold text-(--ink-muted)">{p.onTicket}</p>
          <div className="mt-1 flex min-h-7 items-center gap-2">
            <Plane aria-hidden className="size-4 shrink-0 text-(--brand-ink) rtl:-scale-x-100" />
            <AnimatePresence mode="wait" initial={false}>
              {name ? (
                <motion.bdi
                  key="name"
                  dir="ltr"
                  translate="no"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="min-w-0 truncate text-base font-bold tracking-wide text-(--foreground)"
                >
                  {name}
                </motion.bdi>
              ) : (
                <motion.span key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-(--ink-muted)">
                  {p.onTicketEmpty}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={p.givenName}
            htmlFor={`${id}-given`}
            help={p.nameHelp}
            error={errGiven}
            msgId={`${id}-given-msg`}
          >
            <TextInput
              id={`${id}-given`}
              name={`given-${slot.slotId}`}
              dir="ltr"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={values.givenName}
              invalid={!!errGiven}
              aria-required
              aria-describedby={`${id}-given-msg`}
              onChange={(e) => setName('givenName', e.target.value)}
              className="font-bold uppercase tracking-wide"
            />
          </Field>
          <Field
            label={p.familyName}
            htmlFor={`${id}-family`}
            help={p.nameHelp}
            error={errFamily}
            msgId={`${id}-family-msg`}
          >
            <TextInput
              id={`${id}-family`}
              name={`family-${slot.slotId}`}
              dir="ltr"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={values.familyName}
              invalid={!!errFamily}
              aria-required
              aria-describedby={`${id}-family-msg`}
              onChange={(e) => setName('familyName', e.target.value)}
              className="font-bold uppercase tracking-wide"
            />
          </Field>
        </div>

        <div>
          <button
            type="button"
            aria-expanded={guide}
            aria-controls={`${id}-guide`}
            onClick={() => setGuide((g) => !g)}
            className={cn('-ms-2 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold text-(--brand-ink) hover:bg-(--surface-2)', focusRing)}
          >
            <CircleHelp aria-hidden className="size-4" />
            {guide ? p.guideClose : p.guideOpen}
          </button>
          <AnimatePresence initial={false}>
            {guide && (
              <motion.div
                id={`${id}-guide`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-2">
                  <PassportGuide t={t} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <DateParts
            legend={p.dob}
            t={t}
            idBase={`${id}-dob`}
            error={errDob}
            day={values.birthDay}
            month={values.birthMonth}
            year={values.birthYear}
            years={range(THIS_YEAR, 1900)}
            onChange={(d) =>
              onChange({
                ...(d.day !== undefined && { birthDay: d.day }),
                ...(d.month !== undefined && { birthMonth: d.month }),
                ...(d.year !== undefined && { birthYear: d.year }),
              })
            }
          />
          <Segmented
            label={p.gender}
            name={`gender-${slot.slotId}`}
            value={values.gender}
            options={[
              { value: 'M', label: p.male },
              { value: 'F', label: p.female },
            ]}
            onChange={(g) => onChange({ gender: g, title: '' })}
            error={errGender}
            msgId={`${id}-gender-msg`}
          />
        </div>

        {title && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-(--ink-muted)">
            <span>
              {p.titleLine('')}
              <bdi dir="ltr" className="font-bold tracking-wide text-(--foreground)">
                {title}
              </bdi>
            </span>
            {!titleOpen ? (
              <button
                type="button"
                onClick={() => setTitleOpen(true)}
                className={cn('inline-flex min-h-11 items-center rounded-md px-2 font-semibold text-(--brand-ink) hover:bg-(--surface-2)', focusRing)}
              >
                {p.titleChange}
              </button>
            ) : (
              <div className="w-36">
                <SelectInput
                  aria-label={p.titleLabel}
                  value={title}
                  onChange={(e) => onChange({ title: e.target.value as PaxValues['title'] })}
                >
                  {titleOptions(slot).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </SelectInput>
              </div>
            )}
          </div>
        )}

        <Field label={p.nationality} htmlFor={`${id}-nat`}>
          <SelectInput id={`${id}-nat`} value={values.nationality} onChange={(e) => onChange({ nationality: e.target.value })}>
            <option value="">{p.choose}</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c[lang]}
              </option>
            ))}
          </SelectInput>
        </Field>

        <div className="space-y-4 border-t border-(--border) pt-5">
          <div>
            <h4 className="text-base font-bold text-(--brand-ink)">{p.passport}</h4>
            <p className="mt-1 text-sm leading-6 text-(--ink-muted)">{p.passportRequired}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={p.passportNumber}
              htmlFor={`${id}-pp`}
              help={values.savedMasked ? p.passportSavedHint(values.savedMasked) : undefined}
              error={errPassport}
              msgId={`${id}-pp-msg`}
            >
              <TextInput
                id={`${id}-pp`}
                name={`passport-${slot.slotId}`}
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                value={values.passportNumber}
                invalid={!!errPassport}
                aria-required={!values.savedMasked}
                aria-describedby={`${id}-pp-msg`}
                placeholder={values.savedMasked ? `${p.passportSaved} ${values.savedMasked}` : undefined}
                onChange={(e) => onChange({ passportNumber: cleanPassport(e.target.value) })}
                className="font-bold tracking-wide placeholder:font-normal placeholder:tracking-normal"
              />
            </Field>
            <Field label={p.issuingCountry} htmlFor={`${id}-ppc`} error={errIssuer} msgId={`${id}-ppc-msg`}>
              <SelectInput
                id={`${id}-ppc`}
                invalid={!!errIssuer}
                aria-required
                aria-describedby={errIssuer ? `${id}-ppc-msg` : undefined}
                value={values.passportCountry} onChange={(e) => onChange({ passportCountry: e.target.value })}>
                <option value="">{p.choose}</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c[lang]}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div>
            <DateParts
              legend={p.expiry}
              t={t}
              idBase={`${id}-exp`}
              error={errExpiry}
              day={values.expDay}
              month={values.expMonth}
              year={values.expYear}
              years={range(THIS_YEAR, THIS_YEAR + 20)}
              onChange={(d) =>
                onChange({
                  ...(d.day !== undefined && { expDay: d.day }),
                  ...(d.month !== undefined && { expMonth: d.month }),
                  ...(d.year !== undefined && { expYear: d.year }),
                })
              }
            />
            {expiry === 'expired' && (
              <p role="alert" className="mt-2 text-sm leading-6 text-(--danger-ink)">
                {p.expired}
              </p>
            )}
            {expiry === 'six-months' && (
              <Notice tone="warning" className="mt-3">
                {p.sixMonths}
              </Notice>
            )}
          </div>
        </div>

        {!guest && !values.savedId && (
          <Checkbox checked={values.saveTraveller} onChange={(v) => onChange({ saveTraveller: v })}>
            {p.saveTraveller}
          </Checkbox>
        )}
      </div>
    </article>
  );
}
