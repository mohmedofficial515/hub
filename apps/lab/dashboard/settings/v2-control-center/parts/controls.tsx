/**
 * One control per field type: switch, stepper with unit, money, duration, segmented / select, chips, tag list
 * (ordered lists get up/down), masked secret with owner reveal, url, formatted strings, structured summary,
 * read-only value. Controlled: the row owns the value; text inputs keep a local string while typing.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Lock, Minus, Plus, SquarePen, X } from 'lucide-react';
import { cn } from '@lab/utils';
import type { Field, FieldValue } from '@lab/mocks/settings';
import { count, duration, fill, humanize, num, valueText } from './format';
import { fieldLabel } from './model';
import { useStore } from './store';
import { Btn, Pill, Segmented, Switch } from './ui';

const input =
  'min-h-11 w-full rounded-xl border border-input bg-background px-3 text-14 text-foreground outline-none transition-colors placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive sm:min-h-10';

export interface ControlProps {
  field: Field;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  id: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

const isNum = (f: Field) => f.type === 'integer' || f.type === 'number' || f.type === 'money' || f.type === 'duration';

/** Free text long enough to need several lines (messages, addresses): a textarea, never a clipped input. */
export function isLongText(field: Field): boolean {
  if (field.type !== 'string' || field.format) return false;
  return !!field.multiline || /message|address/i.test(field.key) || String(field.value ?? '').length > 40;
}

/** Wide controls take the full row width under the label instead of the end column. */
export function isWide(field: Field): boolean {
  if (field.structured || isLongText(field)) return true;
  if (field.type === 'string-list') return true;
  if (field.type === 'multi-enum') return (field.options?.length ?? 0) > 4;
  if (field.type === 'secret') return true;
  if (field.type === 'enum' && (field.options?.length ?? 0) <= 4) {
    const longest = Math.max(...(field.options ?? []).map((o) => Math.max(o.label.ar.length, o.label.en.length)));
    return longest > 18 || (field.options?.length ?? 0) * longest > 44;
  }
  return false;
}

/** A message when the value cannot be saved, else null. */
export function validate(field: Field, value: FieldValue, t: ReturnType<typeof useStore>['t'], locale: 'ar' | 'en'): string | null {
  if (field.readOnly || field.structured) return null;
  if (isNum(field)) {
    if (value === null || value === undefined || (value as unknown) === '') return field.nullable ? null : t.field.error;
    const n = Number(value);
    if (!Number.isFinite(n)) return t.field.error;
    if (field.type === 'integer' && !Number.isInteger(n)) return t.field.error;
    if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) {
      if (field.min !== undefined && field.max !== undefined) return fill(t.field.range, { min: num(locale, field.min), max: num(locale, field.max) });
      if (field.min !== undefined) return fill(t.field.min, { min: num(locale, field.min) });
      return fill(t.field.max, { max: num(locale, field.max!) });
    }
  }
  if (field.type === 'url' && typeof value === 'string' && value && !/^https:\/\/\S+$/.test(value)) return t.ctl.invalidUrl;
  if (field.format === 'email' && typeof value === 'string' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return t.ctl.invalidEmail;
  return null;
}

export function FieldControl(props: ControlProps) {
  const { field } = props;
  if (field.readOnly) return <ReadOnlyValue {...props} />;
  if (field.structured) return <StructuredSummary {...props} />;
  switch (field.type) {
    case 'boolean':
      return <BoolControl {...props} />;
    case 'integer':
    case 'number':
    case 'money':
    case 'duration':
      return <NumberControl {...props} />;
    case 'enum':
      return <EnumControl {...props} />;
    case 'multi-enum':
      return <ChipsControl {...props} />;
    case 'string-list':
      return <ListControl {...props} />;
    case 'secret':
      return <SecretControl {...props} />;
    default:
      return <TextControl {...props} />;
  }
}

// ─── Boolean ────────────────────────────────────────────────────────────────

function BoolControl({ field, value, onChange, id, disabled }: ControlProps) {
  const { t, locale } = useStore();
  const on = value === true;
  return (
    <label htmlFor={id} className="inline-flex min-h-11 cursor-pointer items-center gap-3 sm:min-h-9">
      <span className={cn('text-13 font-semibold', on ? 'text-foreground' : 'text-muted-foreground')}>{on ? t.ctl.on : t.ctl.off}</span>
      <Switch id={id} checked={on} onChange={(v) => onChange(v)} label={fieldLabel(field, locale, t)} disabled={disabled} />
    </label>
  );
}

// ─── Numbers ────────────────────────────────────────────────────────────────

function unitLabel(field: Field, t: ReturnType<typeof useStore>['t']): string {
  if (field.type === 'money') return t.units.short.USD;
  return field.unit ? t.units.short[field.unit] : '';
}

function NumberControl({ field, value, onChange, id, invalid, describedBy, disabled }: ControlProps) {
  const { t, locale } = useStore();
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => {
    const parsed = text.trim() === '' ? null : Number(text);
    if (parsed !== value) setText(value === null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const step = field.step ?? (field.type === 'integer' || field.type === 'duration' ? 1 : field.unit === 'ratio' ? 0.05 : field.unit === 'percent' ? 0.5 : field.type === 'money' ? 1 : 0.1);
  const commit = (raw: string) => {
    setText(raw);
    if (raw.trim() === '') return onChange(field.nullable ? null : (raw as unknown as number));
    const n = Number(raw.replace(',', '.'));
    onChange(Number.isFinite(n) ? n : (raw as unknown as number));
  };
  const bump = (dir: 1 | -1) => {
    const base = typeof value === 'number' ? value : Number(field.default ?? field.min ?? 0);
    let next = Math.round((base + dir * step) * 1000) / 1000;
    if (field.min !== undefined) next = Math.max(field.min, next);
    if (field.max !== undefined) next = Math.min(field.max, next);
    onChange(next);
  };
  const unit = unitLabel(field, t);
  const human = field.type === 'duration' && field.unit && typeof value === 'number' ? humanize(value, field.unit as never) : null;
  const showHuman = human && human.unit !== field.unit;

  return (
    <div className="grid justify-items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Btn variant="outline" size="icon" aria-label={`${t.ctl.decrease}: ${fieldLabel(field, locale, t)}`} onClick={() => bump(-1)} disabled={disabled || (field.min !== undefined && Number(value) <= field.min)}>
          <Minus />
        </Btn>
        <div className="relative" dir="ltr">
          <input
            id={id}
            dir="ltr"
            inputMode={field.type === 'integer' || field.type === 'duration' ? 'numeric' : 'decimal'}
            className={cn(input, 'w-28 text-center font-semibold tabular-nums', unit && (unit.length > 3 ? 'w-36 pe-14 ps-3 text-start' : 'pe-9'))}
            value={text}
            placeholder={field.nullable ? t.ctl.notSet : undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            onChange={(e) => commit(e.target.value)}
          />
          {unit ? (
            <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-12 font-semibold text-muted-foreground" aria-hidden>
              {unit}
            </span>
          ) : null}
        </div>
        <Btn variant="outline" size="icon" aria-label={`${t.ctl.increase}: ${fieldLabel(field, locale, t)}`} onClick={() => bump(1)} disabled={disabled || (field.max !== undefined && Number(value) >= field.max)}>
          <Plus />
        </Btn>
      </div>
      {showHuman ? <span className="text-12 font-medium text-muted-foreground">= {duration(locale, t, value as number, field.unit as never)}</span> : null}
    </div>
  );
}

// ─── Enums ──────────────────────────────────────────────────────────────────

function EnumControl({ field, value, onChange, id, describedBy, disabled }: ControlProps) {
  const { t, locale } = useStore();
  const options = field.options ?? [];
  if (options.length <= 4) {
    return (
      <Segmented
        label={fieldLabel(field, locale, t)}
        value={String(value ?? '')}
        onChange={(v) => onChange(v)}
        disabled={disabled}
        options={options.map((o) => ({
          value: o.value,
          label: field.proposedOptions?.includes(o.value) ? `${o.label[locale]} (${t.field.proposed})` : o.label[locale],
        }))}
      />
    );
  }
  return (
    <select id={id} className={cn(input, 'w-full min-w-48 cursor-pointer sm:w-64')} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} disabled={disabled}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label[locale]}
        </option>
      ))}
    </select>
  );
}

function ChipsControl({ field, value, onChange, disabled }: ControlProps) {
  const { t, locale } = useStore();
  const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
  return (
    <div role="group" aria-label={fieldLabel(field, locale, t)} className="flex flex-wrap gap-1.5">
      {(field.options ?? []).map((o) => {
        const on = selected.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => {
              const next = (field.options ?? []).map((x) => x.value).filter((v) => (v === o.value ? !on : selected.has(v)));
              onChange(next);
            }}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-13 font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-9',
              on ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <span aria-hidden className={cn('grid size-4 place-items-center rounded-full border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50')}>
              {on ? <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.5 6.2 5 8.5l4.5-5" /></svg> : null}
            </span>
            {o.label[locale]}
          </button>
        );
      })}
    </div>
  );
}

// ─── Lists ──────────────────────────────────────────────────────────────────

function ListControl({ field, value, onChange, id, disabled }: ControlProps) {
  const { t, locale } = useStore();
  const items = Array.isArray(value) ? (value as Array<string | number>) : [];
  const [draft, setDraft] = useState('');
  const numeric = field.itemType === 'integer';
  const ltr = !!field.format || numeric || field.type === 'string-list';
  const label = (item: string | number) => {
    if (field.options) return field.options.find((o) => o.value === String(item))?.label[locale] ?? String(item);
    if (numeric && field.itemUnit) return duration(locale, t, Number(item), field.itemUnit);
    return String(item);
  };
  const add = () => {
    const raw = draft.trim();
    if (!raw) return;
    const parts = raw.split(/[,\n،]/).map((p) => p.trim()).filter(Boolean);
    const normal = parts.map((p) => (numeric ? Number(p) : field.format === 'country' || field.format === 'iata' || field.format === 'currency' ? p.toUpperCase() : p));
    const clean = normal.filter((p) => (numeric ? Number.isFinite(p as number) : true));
    onChange([...(items as never[]), ...(clean as never[])]);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !draft && items.length) {
      onChange(items.slice(0, -1) as never);
    }
  };
  const move = (from: number, to: number) => {
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next as never);
  };

  if (field.ordered) {
    return (
      <div className="grid gap-2">
        <ol className="grid gap-1.5" aria-label={fieldLabel(field, locale, t)}>
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background ps-3 pe-1">
              <span className="w-5 text-12 font-bold tabular-nums text-muted-foreground">{num(locale, i + 1)}</span>
              <span className="min-w-0 flex-1 truncate text-14 font-semibold">{label(item)}</span>
              <Btn variant="ghost" size="icon" disabled={disabled || i === 0} aria-label={fill(t.ctl.moveUp, { v: label(item) })} onClick={() => move(i, i - 1)}>
                <ArrowUp />
              </Btn>
              <Btn variant="ghost" size="icon" disabled={disabled || i === items.length - 1} aria-label={fill(t.ctl.moveDown, { v: label(item) })} onClick={() => move(i, i + 1)}>
                <ArrowDown />
              </Btn>
            </li>
          ))}
        </ol>
        <p className="text-12 text-muted-foreground">{t.ctl.ordered}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background p-1.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40',
        disabled && 'opacity-60',
      )}
    >
      {items.length === 0 ? <span className="px-1.5 text-13 text-muted-foreground">{t.ctl.empty}</span> : null}
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className="inline-flex h-11 max-w-full items-center gap-1 rounded-lg bg-muted ps-2.5 pe-0.5 text-13 font-semibold sm:h-8">
          <bdi dir={ltr && !field.options ? 'ltr' : undefined} className="truncate">
            {label(item)}
          </bdi>
          <button
            type="button"
            disabled={disabled}
            aria-label={fill(t.ctl.remove, { v: label(item) })}
            onClick={() => onChange(items.filter((_, j) => j !== i) as never)}
            className="grid size-11 place-items-center rounded-md text-muted-foreground outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:size-7"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        dir={ltr ? 'ltr' : undefined}
        className="h-11 min-w-36 flex-1 bg-transparent sm:h-8 px-1.5 text-14 outline-none placeholder:text-muted-foreground/80"
        placeholder={t.ctl.addPlaceholder}
        inputMode={numeric ? 'numeric' : undefined}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        aria-label={`${t.ctl.add}: ${fieldLabel(field, locale, t)}`}
      />
    </div>
  );
}

// ─── Secret ─────────────────────────────────────────────────────────────────

function SecretControl({ field, value, onChange, id, disabled }: ControlProps) {
  const { t, locale, viewer } = useStore();
  const [replacing, setReplacing] = useState(false);
  const [show, setShow] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [next, setNext] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const owner = viewer === 'owner';
  const stored = typeof value === 'string' && value.startsWith('••••') ? value : null;
  useEffect(() => () => window.clearInterval(timer.current), []);

  const reveal = () => {
    setRevealed(10);
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => setRevealed((s) => (s <= 1 ? (window.clearInterval(timer.current), 0) : s - 1)), 1000);
  };
  const tail = stored ? stored.slice(4) : '';
  /** Demo only: the mock stores the last 4 characters; the "full" key is a visibly fake placeholder. */
  const demoFull = `demo_${field.key.split('.').pop()?.toLowerCase()}_${'x'.repeat(18)}${tail}`;

  if (!owner) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <code dir="ltr" className="rounded-lg bg-muted px-3 py-2 text-13 font-semibold tracking-wider">{stored ?? t.ctl.notSet}</code>
        <span className="inline-flex items-center gap-1.5 text-12 text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
          {t.ctl.secretOwnerOnly}
        </span>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <code dir="ltr" className="min-h-10 max-w-full truncate rounded-lg bg-muted px-3 py-2 text-13 font-semibold tracking-wider">
          {value && !stored ? '••••' + String(value).slice(-4) : revealed && stored ? demoFull : stored ?? t.ctl.notSet}
        </code>
        {stored ? (
          <Btn variant="ghost" size="sm" onClick={() => (revealed ? setRevealed(0) : reveal())} disabled={disabled}>
            {revealed ? <EyeOff /> : <Eye />}
            {revealed ? t.ctl.hide : t.ctl.reveal}
          </Btn>
        ) : null}
        <Btn variant="outline" size="sm" onClick={() => setReplacing((r) => !r)} disabled={disabled} aria-expanded={replacing}>
          <SquarePen />
          {replacing ? t.ctl.cancel : t.ctl.replace}
        </Btn>
      </div>
      {revealed ? <span className="text-12 text-muted-foreground">{fill(t.ctl.revealHint, { n: num(locale, revealed) })}</span> : <span className="text-12 text-muted-foreground">{t.ctl.secretStored}</span>}
      {replacing ? (
        <div className="flex items-center gap-2">
          <label htmlFor={id} className="sr-only">
            {t.ctl.secretNew}
          </label>
          <input
            id={id}
            dir="ltr"
            type={show ? 'text' : 'password'}
            autoComplete="off"
            className={cn(input, 'font-mono')}
            placeholder={t.ctl.secretNew}
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              onChange(e.target.value || field.value);
            }}
          />
          <Btn variant="ghost" size="icon" aria-label={show ? t.ctl.hide : t.ctl.reveal} onClick={() => setShow((s) => !s)}>
            {show ? <EyeOff /> : <Eye />}
          </Btn>
        </div>
      ) : null}
    </div>
  );
}

// ─── Text, url, formats ─────────────────────────────────────────────────────

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'TRY', 'KWD', 'QAR', 'BHD', 'OMR', 'EGP', 'JOD'];
const TIMEZONES = ['UTC', 'Europe/Istanbul', 'Asia/Riyadh', 'Asia/Dubai', 'Africa/Cairo', 'Europe/London'];

function toLocalInput(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : '';
}

function TextControl({ field, value, onChange, id, invalid, describedBy, disabled }: ControlProps) {
  const { t, locale } = useStore();
  const text = value === null || value === undefined ? '' : String(value);
  const dir = field.key.endsWith('.ar') ? 'rtl' : field.key.endsWith('.en') || field.format || field.type === 'url' ? 'ltr' : undefined;
  const set = (v: string) => onChange(v === '' && field.nullable ? null : v);
  const common = { id, 'aria-invalid': invalid || undefined, 'aria-describedby': describedBy, disabled };

  if (field.format === 'currency' || field.format === 'timezone') {
    const list = field.format === 'currency' ? CURRENCIES : TIMEZONES;
    return (
      <select {...common} dir="ltr" className={cn(input, 'w-full cursor-pointer sm:w-56')} value={text} onChange={(e) => set(e.target.value)}>
        {[...new Set([text, ...list])].filter(Boolean).map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    );
  }
  // Text inputs with a fixed pattern, not the native pickers: those draw the browser locale's digits (٢٠/١١), we keep Latin digits.
  if (field.format === 'time') {
    return <input {...common} dir="ltr" inputMode="numeric" placeholder="22:00" className={cn(input, 'w-28 text-center tabular-nums')} value={text} onChange={(e) => set(e.target.value)} />;
  }
  if (field.format === 'datetime') {
    return (
      <div className="grid justify-items-end gap-1">
        <input
          {...common}
          dir="ltr"
          inputMode="numeric"
          placeholder="2026-11-20 23:00"
          className={cn(input, 'w-48 text-center tabular-nums')}
          value={toLocalInput(text) ? toLocalInput(text).replace('T', ' ') : text}
          onChange={(e) => set(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(e.target.value) ? `${e.target.value.replace(' ', 'T')}:00+03:00` : e.target.value)}
        />
        <span className="text-12 text-muted-foreground">{t.ctl.timeZoneNote}</span>
      </div>
    );
  }
  if (field.format === 'hex') {
    return (
      <div className="flex items-center gap-2">
        <input type="color" aria-label={fieldLabel(field, locale, t)} className="size-11 cursor-pointer rounded-xl border border-input bg-background p-1 sm:size-10" value={/^#[0-9a-f]{6}$/i.test(text) ? text : '#000000'} onChange={(e) => set(e.target.value)} disabled={disabled} />
        <input {...common} dir="ltr" className={cn(input, 'w-32 font-mono uppercase')} value={text} onChange={(e) => set(e.target.value)} />
      </div>
    );
  }
  if (isLongText(field)) {
    return <textarea {...common} dir={dir} rows={3} className={cn(input, 'min-h-24 resize-y py-2.5 leading-relaxed')} value={text} onChange={(e) => set(e.target.value)} />;
  }
  if (field.type === 'url') {
    const valid = /^https:\/\/\S+$/.test(text);
    return (
      <div className="flex w-full items-center gap-1.5 sm:w-80">
        <input {...common} type="url" dir="ltr" className={input} value={text} placeholder="https://" onChange={(e) => set(e.target.value)} />
        <Btn variant="ghost" size="icon" aria-label={t.ctl.openLink} disabled={!valid} onClick={() => window.open(text, '_blank', 'noopener')}>
          <ExternalLink />
        </Btn>
      </div>
    );
  }
  const narrow = field.format === 'country' || field.format === 'iata' || field.format === 'version';
  return (
    <input
      {...common}
      dir={dir}
      type={field.format === 'email' ? 'email' : field.format === 'phone' ? 'tel' : 'text'}
      className={cn(input, narrow ? 'w-32' : 'w-full sm:w-80', (field.format === 'country' || field.format === 'iata') && 'uppercase', field.format === 'cidr' && 'font-mono')}
      value={text}
      placeholder={field.nullable ? t.ctl.notSet : undefined}
      onChange={(e) => set(field.format === 'country' || field.format === 'iata' ? e.target.value.toUpperCase() : e.target.value)}
    />
  );
}

// ─── Read-only, structured ──────────────────────────────────────────────────

function ReadOnlyValue({ field, value }: ControlProps) {
  const { t, locale } = useStore();
  return (
    <span className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-xl bg-muted px-3 text-14 font-semibold">
      <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <bdi className="truncate" dir={field.format || field.type === 'url' ? 'ltr' : undefined}>
        {valueText(locale, t, field, value)}
      </bdi>
    </span>
  );
}

function StructuredSummary({ field, value }: ControlProps) {
  const { t, locale, toast } = useStore();
  const items = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div className="grid gap-2">
      {items.length ? (
        <ul className="grid gap-1 rounded-xl bg-muted/60 p-2">
          {items.map((item, i) => (
            <li key={i} className="rounded-lg px-2.5 py-1.5 text-13 font-medium leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-13 text-muted-foreground">{t.ctl.structuredEmpty}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Btn variant="outline" size="sm" onClick={() => toast(t.ctl.editorToast)}>
          <SquarePen />
          {t.ctl.editor}
        </Btn>
        <span className="text-12 text-muted-foreground">{items.length ? count(locale, items.length, t.units.rules) : null}</span>
      </div>
    </div>
  );
}

export function useFieldId(key: string): string {
  const base = useId();
  return `${base}-${key.replace(/[^a-z0-9]/gi, '-')}`;
}

export function Labelled({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
