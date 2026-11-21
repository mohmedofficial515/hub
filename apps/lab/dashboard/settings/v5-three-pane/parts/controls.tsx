import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Minus, PencilRuler, Plus, X } from 'lucide-react';
import { Switch } from '@dash/components/ui/switch';
import type { Locale } from '@lab/i18n';
import type { Field, FieldValue } from '@lab/mocks/settings';
import { cn } from './cn';
import type { Messages } from '../i18n';
import { num, readable, unitText } from './lib';
import type { Role } from './store';

export interface ControlProps {
  field: Field;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  id: string;
  labelId: string;
  t: Messages;
  locale: Locale;
  role: Role;
  /** Whether a proposed option is offered (preferences theme "system"). */
  proposedTag?: string;
}

const INPUT =
  'h-11 rounded-lg border border-input bg-background px-3 text-14 outline-none transition-colors placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 lg:h-9 md:text-13';

const LTR_FORMATS = new Set(['email', 'phone', 'cidr', 'iata', 'version', 'hex', 'currency', 'country', 'timezone', 'time', 'datetime']);

export function Control(props: ControlProps) {
  const { field } = props;
  if (field.readOnly) return <ReadOnlyValue {...props} />;
  if (field.structured) return <StructuredValue {...props} />;
  switch (field.type) {
    case 'boolean':
      return <BooleanControl {...props} />;
    case 'integer':
    case 'number':
    case 'money':
    case 'duration':
      return <NumberControl {...props} />;
    case 'enum':
      return <EnumControl {...props} />;
    case 'multi-enum':
      return <MultiControl {...props} />;
    case 'string-list':
      return <ListControl {...props} />;
    case 'secret':
      return <SecretControl {...props} />;
    default:
      return <TextControl {...props} />;
  }
}

function ReadOnlyValue({ field, value, t, locale }: ControlProps) {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-muted/60 px-3 text-13 font-semibold lg:min-h-9">
      <Lock className="size-3.5 text-muted-foreground" aria-hidden />
      <bdi>{readable(field, value, t, locale)}</bdi>
      <span className="sr-only">({t.field.readOnly})</span>
    </span>
  );
}

function StructuredValue({ value, t }: ControlProps) {
  const items = Array.isArray(value) ? (value as (string | number)[]).map(String) : [];
  const [note, setNote] = useState(false);
  return (
    <div className="grid w-full gap-2">
      {items.length ? (
        <ul className="grid gap-1 rounded-lg border bg-background p-2 text-13">
          {items.map((item, i) => (
            <li key={i} className="truncate rounded-md px-2 py-1 odd:bg-muted/50">
              <bdi>{item}</bdi>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-13 text-muted-foreground">{t.field.structured(0)}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setNote(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-3 text-13 font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9"
        >
          <PencilRuler className="size-4 text-primary" aria-hidden />
          {t.field.editDedicated}
        </button>
        <span className="text-12 text-muted-foreground">{t.field.structured(items.length)}</span>
      </div>
      {note ? (
        <p role="status" className="text-12 text-muted-foreground">
          {t.field.dedicatedStub}
        </p>
      ) : null}
    </div>
  );
}

function BooleanControl({ value, onChange, id, labelId, t }: ControlProps) {
  const on = value === true;
  return (
    <div className="flex min-h-11 items-center gap-3 lg:min-h-9">
      <Switch id={id} checked={on} onCheckedChange={(v) => onChange(v)} aria-labelledby={labelId} className="relative after:absolute after:-inset-x-2 after:-inset-y-[13px] after:content-['']" />
      <label htmlFor={id} className={cn('min-w-12 cursor-pointer text-13 font-semibold', on ? 'text-foreground' : 'text-muted-foreground')}>
        {on ? t.field.on : t.field.off}
      </label>
    </div>
  );
}

function NumberControl({ field, value, onChange, id, labelId, t }: ControlProps) {
  const [raw, setRaw] = useState(value === null || value === undefined ? '' : String(value));
  useEffect(() => {
    setRaw(value === null || value === undefined ? '' : String(value));
  }, [value]);
  const step = field.step ?? (field.unit === 'ratio' ? 0.05 : field.type === 'money' ? 1 : 1);
  const n = typeof value === 'number' ? value : null;
  const clamp = (x: number) => Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, x));
  const set = (x: number) => onChange(Number(clamp(x).toFixed(4)));
  const out = n !== null && ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max));
  const unit = field.unit === 'bytes' ? t.units.bytes : unitText(t, field.unit);

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5">
        <StepBtn label={t.field.decrease} onClick={() => set((n ?? field.min ?? 0) - step)} disabled={n !== null && field.min !== undefined && n <= field.min}>
          <Minus className="size-4" aria-hidden />
        </StepBtn>
        <div className="relative">
          <input
            id={id}
            aria-labelledby={labelId}
            inputMode="decimal"
            dir="ltr"
            value={raw}
            placeholder={field.nullable ? '—' : undefined}
            aria-invalid={out || undefined}
            onChange={(e) => {
              setRaw(e.target.value);
              const v = e.target.value.trim();
              if (v === '' && field.nullable) onChange(null);
              else if (v !== '' && !Number.isNaN(Number(v))) onChange(Number(v));
            }}
            className={cn(INPUT, 'w-28 text-center tabular-nums md:w-24', field.type === 'money' && 'w-32 md:w-28', out && 'border-destructive')}
          />
        </div>
        <StepBtn label={t.field.increase} onClick={() => set((n ?? field.min ?? 0) + step)} disabled={n !== null && field.max !== undefined && n >= field.max}>
          <Plus className="size-4" aria-hidden />
        </StepBtn>
        {unit ? <span className="ms-1 text-13 font-medium text-muted-foreground">{unit}</span> : null}
      </div>
      {field.min !== undefined && field.max !== undefined ? (
        <span className={cn('text-11 tabular-nums', out ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
          {t.field.range(num(field.min), num(field.max))}
        </span>
      ) : field.nullable ? (
        <span className="text-11 text-muted-foreground">{t.field.notSetHint}</span>
      ) : null}
    </div>
  );
}

function StepBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-11 items-center justify-center rounded-lg border bg-card text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 lg:size-9"
    >
      {children}
    </button>
  );
}

function EnumControl({ field, value, onChange, id, labelId, locale, t, proposedTag }: ControlProps) {
  const options = field.options ?? [];
  const totalLen = options.reduce((s, o) => s + o.label[locale].length, 0);
  const swatch = options.some((o) => o.hint && /^(#|oklch)/.test(o.hint));
  const segmented = swatch || (options.length <= 4 && totalLen <= 44);
  const isProposed = (v: string) => field.proposedOptions?.includes(v);

  if (!segmented) {
    return (
      <select
        id={id}
        aria-labelledby={labelId}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT, 'w-full max-w-72 cursor-pointer pe-8')}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label[locale]}
            {isProposed(o.value) ? ` (${proposedTag ?? t.field.proposed})` : ''}
          </option>
        ))}
      </select>
    );
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = document.documentElement.dir === 'rtl';
    const fwd = e.key === 'ArrowDown' || e.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
    const back = e.key === 'ArrowUp' || e.key === (rtl ? 'ArrowRight' : 'ArrowLeft');
    if (!fwd && !back) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + (fwd ? 1 : -1) + options.length) % options.length];
    onChange(next.value);
    requestAnimationFrame(() => (e.currentTarget.querySelector<HTMLElement>(`[data-v="${next.value}"]`) ?? null)?.focus());
  };

  return (
    <div id={id} role="radiogroup" aria-labelledby={labelId} onKeyDown={onKey} className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            data-v={o.value}
            aria-checked={on}
            tabIndex={on || (value === null && o === options[0]) ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-3 text-13 font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring lg:min-h-8',
              on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.hint ? <span className="size-3 rounded-full border" style={{ background: o.hint.startsWith('#') || o.hint.startsWith('oklch') ? o.hint : undefined }} aria-hidden /> : null}
            {o.label[locale]}
            {isProposed(o.value) ? <span className="rounded-full bg-info/12 px-1.5 text-10 font-bold text-info-soft-foreground dark:text-[color-mix(in_oklab,var(--info)_70%,white)]">{proposedTag ?? t.field.proposed}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function MultiControl({ field, value, onChange, labelId, locale }: ControlProps) {
  const list = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
      {(field.options ?? []).map((o) => {
        const on = list.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? list.filter((v) => v !== o.value) : [...list, o.value])}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-12 font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring lg:min-h-8',
              on ? 'border-primary/40 bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            <span className={cn('size-1.5 rounded-full', on ? 'bg-primary' : 'bg-muted-foreground/40')} aria-hidden />
            {o.label[locale]}
          </button>
        );
      })}
    </div>
  );
}

function ListControl({ field, value, onChange, id, labelId, t }: ControlProps) {
  const items = Array.isArray(value) ? (value as (string | number)[]) : [];
  const [text, setText] = useState('');
  const upper = field.format === 'country' || field.format === 'iata' || field.format === 'currency';
  const add = () => {
    const v = text.trim();
    if (!v) return;
    const item = field.itemType === 'integer' ? Number(v) : upper ? v.toUpperCase() : v;
    if (field.itemType === 'integer' && Number.isNaN(item)) return;
    if (items.map(String).includes(String(item))) return setText('');
    onChange([...(items as never[]), item as never]);
    setText('');
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next as FieldValue);
  };
  const unit = field.itemUnit ? unitText(t, field.itemUnit) : '';
  const ltr = field.itemType === 'integer' || (field.format && LTR_FORMATS.has(field.format));

  return (
    <div className="grid w-full gap-2">
      {field.ordered ? (
        <ol className="grid gap-1" aria-labelledby={labelId}>
          {items.map((item, i) => (
            <li key={String(item)} className="flex items-center gap-2 rounded-lg border bg-background ps-3 pe-1 text-13">
              <span className="w-5 text-11 font-bold tabular-nums text-muted-foreground">{i + 1}</span>
              <bdi className="flex-1 font-semibold">{String(item)}</bdi>
              <button type="button" aria-label={`${t.field.moveUp}: ${item}`} disabled={i === 0} onClick={() => move(i, -1)} className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 lg:size-8">
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button type="button" aria-label={`${t.field.moveDown}: ${item}`} disabled={i === items.length - 1} onClick={() => move(i, 1)} className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 lg:size-8">
                <ArrowDown className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring/40" aria-labelledby={labelId} role="group">
          {items.map((item, i) => (
            <span key={`${item}-${i}`} className="inline-flex h-8 items-center gap-1 rounded-md bg-muted ps-2 text-12 font-semibold">
              <bdi dir={ltr ? 'ltr' : undefined}>
                {String(item)}
                {unit ? ` ${unit}` : ''}
              </bdi>
              <button type="button" aria-label={t.field.remove(String(item))} onClick={() => onChange(items.filter((_, j) => j !== i) as FieldValue)} className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none after:absolute after:-inset-1.5 after:content-[''] hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
          <input
            id={id}
            aria-labelledby={labelId}
            value={text}
            dir={ltr ? 'ltr' : undefined}
            inputMode={field.itemType === 'integer' ? 'numeric' : undefined}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                add();
              } else if (e.key === 'Backspace' && !text && items.length) onChange(items.slice(0, -1) as FieldValue);
            }}
            onBlur={add}
            placeholder={t.field.addPlaceholder}
            className="h-11 min-w-28 flex-1 bg-transparent lg:h-9 px-1.5 text-13 outline-none placeholder:text-muted-foreground/80"
          />
        </div>
      )}
    </div>
  );
}

function SecretControl({ value, onChange, id, labelId, t, role }: ControlProps) {
  const [editing, setEditing] = useState(false);
  const [show, setShow] = useState(false);
  const [text, setText] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const saved = typeof value === 'string' && value.startsWith('••••') ? value : null;
  const typed = typeof value === 'string' && !value.startsWith('••••') ? value : null;
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (!editing && !typed) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-muted/60 px-3 font-mono text-13 tracking-wider lg:h-9" dir="ltr" title={t.field.secretSaved}>
          <Lock className="size-3.5 text-muted-foreground" aria-hidden />
          {saved ?? '—'}
        </span>
        <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center rounded-lg border bg-card px-3 text-13 font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9">
          {t.field.replace}
        </button>
        <span className="sr-only">{t.field.secretSaved}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={ref}
        id={id}
        aria-labelledby={labelId}
        type={show ? 'text' : 'password'}
        dir="ltr"
        autoComplete="off"
        placeholder={t.field.newSecret}
        value={typed ?? text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value || saved);
        }}
        className={cn(INPUT, 'w-56 font-mono')}
      />
      <button
        type="button"
        aria-pressed={show}
        disabled={role !== 'owner'}
        title={role !== 'owner' ? t.field.revealOwner : undefined}
        onClick={() => setShow((s) => !s)}
        className="inline-flex size-11 items-center justify-center rounded-lg border bg-card text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 lg:size-9"
        aria-label={show ? t.field.hide : t.field.reveal}
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setText('');
          setShow(false);
          onChange(saved);
        }}
        className="inline-flex min-h-11 items-center rounded-lg px-3 text-13 font-semibold text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9"
      >
        {t.field.cancel}
      </button>
    </div>
  );
}

const TIMEZONES = ['UTC', 'Asia/Riyadh', 'Europe/Istanbul', 'Asia/Dubai', 'Africa/Cairo', 'Europe/London'];
const CURRENCIES = ['USD', 'SAR', 'TRY', 'EUR', 'AED', 'KWD', 'EGP', 'GBP'];

function TextControl({ field, value, onChange, id, labelId, t }: ControlProps) {
  const v = value === null || value === undefined ? '' : String(value);
  const set = (x: string) => onChange(x === '' && field.nullable ? null : x);
  if (field.format === 'timezone' || field.format === 'currency') {
    const list = field.format === 'timezone' ? TIMEZONES : CURRENCIES;
    const opts = list.includes(v) ? list : [v, ...list];
    return (
      <select id={id} aria-labelledby={labelId} value={v} dir="ltr" onChange={(e) => set(e.target.value)} className={cn(INPUT, 'w-56 cursor-pointer')}>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (field.format === 'time') {
    return <input id={id} aria-labelledby={labelId} type="time" dir="ltr" value={v} onChange={(e) => set(e.target.value)} className={cn(INPUT, 'w-36')} />;
  }
  if (field.format === 'datetime') {
    const local = v ? v.slice(0, 16) : '';
    return (
      <div className="grid gap-1">
        <input
          id={id}
          aria-labelledby={labelId}
          type="datetime-local"
          dir="ltr"
          value={local}
          onChange={(e) => set(e.target.value ? `${e.target.value}:00+03:00` : '')}
          className={cn(INPUT, 'w-60')}
        />
        <span className="text-11 text-muted-foreground">{t.field.riyadh}</span>
      </div>
    );
  }
  const ltr = field.type === 'url' || (field.format && LTR_FORMATS.has(field.format)) || /[A-Za-z]{3,}/.test(v);
  const type = field.type === 'url' ? 'url' : field.format === 'email' ? 'email' : field.format === 'phone' ? 'tel' : 'text';
  const wide = field.type === 'url' || field.multiline;
  return (
    <input
      id={id}
      aria-labelledby={labelId}
      type={type}
      dir={ltr ? 'ltr' : 'auto'}
      value={v}
      placeholder={field.nullable ? t.field.notSet : /colou?r/i.test(field.key) ? '#2e7a82' : undefined}
      maxLength={field.max}
      onChange={(e) => set(field.format === 'country' ? e.target.value.toUpperCase() : e.target.value)}
      className={cn(INPUT, wide ? 'w-full max-w-md' : 'w-full max-w-72', field.format === 'country' && 'w-24 uppercase')}
    />
  );
}
