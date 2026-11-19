// One control per field type. `mode="inline"` is the compact form used inside search results (boolean, enum, numbers);
// `mode="full"` is the group page editor.

import { useEffect, useId, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Minus, PencilRuler, Plus, X } from 'lucide-react';
import type { Field, FieldValue } from '@lab/mocks/settings';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { fmtNumber, formatValue, unitSuffix } from './format';
import { Badge, Btn, NativeSelect, Segmented, Switch, focusRing } from './ui';

export interface ControlProps {
  field: Field;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  mode: 'full' | 'inline';
  label: string;
  id?: string;
  describedBy?: string;
  invalid?: boolean;
  canSeeSecrets?: boolean;
  onStructured?: () => void;
}

const inputBase =
  'h-11 w-full min-w-0 rounded-xl border border-muted-foreground/85 bg-card px-3 text-14 text-foreground placeholder:text-muted-foreground/80 disabled:opacity-55';

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
      return <Stepper {...props} />;
    case 'enum':
      return <EnumControl {...props} />;
    case 'multi-enum':
      return <ChipToggles {...props} />;
    case 'string-list':
      return <TagList {...props} />;
    case 'secret':
      return <SecretControl {...props} />;
    default:
      return <TextControl {...props} />;
  }
}

function ReadOnlyValue({ field, value }: ControlProps) {
  const locale = useLocale();
  const t = useT(messages);
  return (
    <span className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl bg-muted px-3 text-14 font-semibold text-foreground">
      <Lock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <bdi className="min-w-0 truncate">{formatValue(field, value, locale, t)}</bdi>
      <span className="sr-only">{t.badges.readOnly}</span>
    </span>
  );
}

function StructuredSummary({ field, value, mode, onStructured }: ControlProps) {
  const locale = useLocale();
  const t = useT(messages);
  const items = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', mode === 'full' ? 'items-stretch' : 'items-end')}>
      {mode === 'full' && (
        <ul className="flex flex-col gap-1.5">
          {items.length ? (
            items.slice(0, 4).map((item, i) => (
              <li key={i} className="truncate rounded-lg bg-muted px-3 py-2 text-13 font-medium">
                <bdi>{item}</bdi>
              </li>
            ))
          ) : (
            <li className="text-13 text-muted-foreground">{t.value.emptyList}</li>
          )}
          {items.length > 4 && <li className="text-12 text-muted-foreground">{t.value.more(items.length - 4)}</li>}
        </ul>
      )}
      {mode === 'inline' && <span className="truncate text-13 font-semibold">{formatValue(field, value, locale, t)}</span>}
      <Btn variant="secondary" size="sm" onClick={onStructured} className="self-start">
        <PencilRuler className="size-4" aria-hidden />
        {t.controls.dedicatedEditor}
      </Btn>
    </div>
  );
}

function BoolControl({ value, onChange, label, id, describedBy }: ControlProps) {
  const t = useT(messages);
  const on = !!value;
  return (
    <span className="inline-flex items-center gap-3">
      <span className={cn('min-w-12 text-end text-13 font-semibold', on ? 'text-foreground' : 'text-muted-foreground')} aria-hidden>
        {on ? t.value.on : t.value.off}
      </span>
      <Switch id={id} checked={on} onChange={(v) => onChange(v)} label={label} describedBy={describedBy} />
    </span>
  );
}

function Stepper({ field, value, onChange, mode, label, id, describedBy, invalid }: ControlProps) {
  const t = useT(messages);
  const locale = useLocale();
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));
  useEffect(() => {
    setText(value === null || value === undefined ? '' : String(value));
  }, [value]);
  const step = field.step ?? 1;
  const num = typeof value === 'number' ? value : null;
  const clamp = (n: number) => Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, n));
  const bump = (dir: 1 | -1) => {
    const base = num ?? (typeof field.default === 'number' ? field.default : field.min ?? 0);
    const next = clamp(Math.round((base + dir * step) * 1e6) / 1e6);
    onChange(next);
  };
  const suffix = unitSuffix(field, t);
  if (num === null && field.nullable && text === '') {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-13 text-muted-foreground">{t.value.notSet}</span>
        <Btn size="sm" onClick={() => onChange(typeof field.default === 'number' ? field.default : field.min ?? 0)}>
          <Plus className="size-4" aria-hidden />
          {t.controls.setValue}
        </Btn>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        dir="ltr"
        data-stepper=""
        className={cn(
          'inline-flex items-stretch overflow-hidden rounded-xl border bg-card',
          invalid ? 'border-destructive' : 'border-muted-foreground/85',
        )}
      >
        <button
          type="button"
          aria-label={t.controls.decrease(label)}
          onClick={() => bump(-1)}
          disabled={num !== null && field.min !== undefined && num <= field.min}
          className={cn('grid h-11 w-11 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40', focusRing, 'focus-visible:ring-offset-0 focus-visible:ring-inset')}
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <input
          id={id}
          inputMode={field.type === 'integer' || field.type === 'duration' ? 'numeric' : 'decimal'}
          aria-label={label}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          value={text}
          onChange={(e) => {
            const raw = e.target.value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
            setText(raw);
            if (raw.trim() === '') {
              if (field.nullable) onChange(null);
              return;
            }
            const n = Number(raw);
            if (!Number.isNaN(n)) onChange(n);
          }}
          onBlur={() => setText(value === null || value === undefined ? '' : String(value))}
          className={cn(
            'h-11 w-16 border-x border-border bg-transparent text-center text-15 font-semibold tabular-nums text-foreground outline-none focus-visible:bg-muted/60',
            mode === 'full' && 'w-20',
          )}
        />
        <button
          type="button"
          aria-label={t.controls.increase(label)}
          onClick={() => bump(1)}
          disabled={num !== null && field.max !== undefined && num >= field.max}
          className={cn('grid h-11 w-11 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40', focusRing, 'focus-visible:ring-offset-0 focus-visible:ring-inset')}
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </span>
      {suffix && <span className="text-13 font-medium text-muted-foreground">{suffix}</span>}
      {mode === 'full' && (field.min !== undefined || field.max !== undefined) && (
        <span className="w-full text-12 text-muted-foreground">
          {t.controls.range(
            field.min !== undefined ? fmtNumber(field.min, locale) : '—',
            field.max !== undefined ? fmtNumber(field.max, locale) : '∞',
          )}
        </span>
      )}
    </span>
  );
}

function EnumControl({ field, value, onChange, mode, label, id, describedBy }: ControlProps) {
  const locale = useLocale();
  const t = useT(messages);
  const options = field.options ?? [];
  const labels = options.map((o) => o.label[locale]);
  const total = labels.join('').length;
  const segmented = mode === 'full' ? options.length <= 4 && total <= 44 : options.length <= 3 && total <= 22;
  const proposed = new Set(field.proposedOptions ?? []);
  if (segmented) {
    return (
      <Segmented
        label={label}
        value={String(value ?? '')}
        onChange={onChange}
        describedBy={describedBy}
        size={mode === 'inline' ? 'sm' : 'md'}
        options={options.map((o) => ({
          value: o.value,
          label: o.label[locale],
          swatch: o.hint && o.hint.match(/^(#|oklch)/) ? o.hint : undefined,
          badge: proposed.has(o.value) ? (
            <Badge tone="violet" className="h-5 bg-card px-1.5 text-11 ring-1 ring-accent-violet/50 dark:bg-card">
              {t.badges.proposed}
            </Badge>
          ) : undefined,
        }))}
      />
    );
  }
  return (
    <NativeSelect
      id={id}
      label={label}
      describedBy={describedBy}
      value={String(value ?? '')}
      onChange={onChange}
      className={mode === 'inline' ? 'w-52' : 'sm:max-w-80'}
      options={options.map((o) => ({
        value: o.value,
        label: proposed.has(o.value) ? `${o.label[locale]} (${t.badges.proposed})` : o.label[locale],
      }))}
    />
  );
}

function ChipToggles({ field, value, onChange, label }: ControlProps) {
  const locale = useLocale();
  const list = Array.isArray(value) ? value.map(String) : [];
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {(field.options ?? []).map((o) => {
        const on = list.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? list.filter((v) => v !== o.value) : [...list, o.value])}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-13 font-semibold transition-colors',
              focusRing,
              on ? 'border-primary bg-primary/10 text-foreground dark:bg-primary/20' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <span aria-hidden className={cn('size-2 rounded-full', on ? 'bg-primary' : 'bg-muted-foreground/50')} />
            {o.label[locale]}
          </button>
        );
      })}
    </div>
  );
}

function TagList({ field, value, onChange, label, id, describedBy }: ControlProps) {
  const t = useT(messages);
  const locale = useLocale();
  const [draft, setDraft] = useState('');
  const items = (Array.isArray(value) ? value : []) as Array<string | number>;
  const numeric = field.itemType === 'integer';
  const ltr = numeric || ['iata', 'cidr', 'country', 'email', 'phone', 'currency', 'version'].includes(field.format ?? '');
  const add = () => {
    const raw = draft.trim();
    if (!raw) return;
    const next = numeric ? Number(raw) : field.format === 'iata' || field.format === 'country' || field.format === 'currency' ? raw.toUpperCase() : raw;
    if (numeric && Number.isNaN(next)) return;
    onChange([...items, next] as FieldValue);
    setDraft('');
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + dir, 0, x);
    onChange(next as FieldValue);
  };
  const remove = (i: number) => onChange(items.filter((_, k) => k !== i) as FieldValue);
  const unit = field.itemUnit ? t.unitShort[field.itemUnit] : '';
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {field.ordered ? (
        <ol aria-label={label} className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="flex items-center gap-2 rounded-xl bg-muted ps-3">
              <span className="w-5 text-12 font-bold tabular-nums text-muted-foreground">{fmtNumber(i + 1, locale)}</span>
              <span className="min-w-0 flex-1 truncate text-14 font-semibold">
                {field.options?.find((o) => o.value === item)?.label[locale] ?? String(item)}
              </span>
              <Btn variant="quiet" size="icon" aria-label={t.controls.moveUp(String(item))} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="size-4" aria-hidden />
              </Btn>
              <Btn variant="quiet" size="icon" aria-label={t.controls.moveDown(String(item))} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="size-4" aria-hidden />
              </Btn>
            </li>
          ))}
        </ol>
      ) : (
        <ul aria-label={label} className="flex flex-wrap items-center gap-1.5">
          {items.length === 0 && <li className="text-13 text-muted-foreground">{t.value.emptyList}</li>}
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="inline-flex h-11 items-center gap-0.5 rounded-lg bg-muted ps-3 text-13 font-semibold">
              <span>
                <bdi dir={ltr ? 'ltr' : undefined}>{numeric ? fmtNumber(Number(item), locale) : String(item)}</bdi>
                {numeric && unit ? ` ${unit}` : ''}
              </span>
              <button
                type="button"
                aria-label={t.controls.remove(String(item))}
                onClick={() => remove(i)}
                className={cn('grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground', focusRing, 'focus-visible:ring-inset focus-visible:ring-offset-0')}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!field.ordered && (
        <div className="flex gap-2">
          <input
            id={id}
            dir={ltr ? 'ltr' : undefined}
            inputMode={numeric ? 'numeric' : undefined}
            value={draft}
            aria-label={t.controls.addTo(label)}
            aria-describedby={describedBy}
            placeholder={t.controls.addPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            className={cn(inputBase, 'flex-1', focusRing, ltr && 'text-start')}
          />
          <Btn size="md" onClick={add} aria-label={t.controls.addTo(label)}>
            <Plus className="size-4" aria-hidden />
            <span className="max-sm:sr-only">{t.controls.add}</span>
          </Btn>
        </div>
      )}
    </div>
  );
}

function SecretControl({ value, onChange, label, canSeeSecrets, id, describedBy }: ControlProps) {
  const t = useT(messages);
  const [editing, setEditing] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [text, setText] = useState('');
  const stored = typeof value === 'string' && value.startsWith('••••') ? value : null;
  if (!canSeeSecrets) {
    return (
      <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-muted px-3 text-13 font-semibold text-muted-foreground">
        <Lock className="size-4" aria-hidden />
        {t.controls.ownerOnly}
      </span>
    );
  }
  if (!editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span dir="ltr" className="inline-flex h-11 items-center rounded-xl bg-muted px-3 text-14 font-semibold tracking-wider">
          {stored ?? (value ? `••••${String(value).slice(-4)}` : t.value.noKey)}
        </span>
        <Btn size="sm" onClick={() => setEditing(true)}>
          {value ? t.controls.replaceKey : t.controls.addKey}
        </Btn>
      </span>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex gap-2">
        <span className="relative flex-1">
          <input
            id={id}
            dir="ltr"
            type={reveal ? 'text' : 'password'}
            autoComplete="new-password"
            aria-label={label}
            aria-describedby={describedBy}
            value={text}
            placeholder={t.controls.pasteKey}
            onChange={(e) => {
              setText(e.target.value);
              onChange(e.target.value ? e.target.value : stored);
            }}
            className={cn(inputBase, 'pe-12 text-start', focusRing)}
          />
          <button
            type="button"
            aria-label={reveal ? t.controls.hideKey : t.controls.showKey}
            aria-pressed={reveal}
            onClick={() => setReveal(!reveal)}
            className={cn('absolute end-0 top-0 grid size-11 place-items-center rounded-xl text-muted-foreground hover:text-foreground', focusRing)}
          >
            {reveal ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </span>
        <Btn
          variant="quiet"
          size="md"
          onClick={() => {
            setEditing(false);
            setText('');
            onChange(stored);
          }}
        >
          {t.controls.keepKey}
        </Btn>
      </div>
      <p className="text-12 text-muted-foreground">{t.controls.secretNote}</p>
    </div>
  );
}

const TIMEZONES = ['UTC', 'Europe/Istanbul', 'Asia/Riyadh', 'Asia/Dubai', 'Africa/Cairo'];
const CURRENCIES = ['USD', 'SAR', 'TRY', 'AED', 'EUR', 'EGP', 'KWD'];

function TextControl({ field, value, onChange, label, id, describedBy, invalid }: ControlProps) {
  const t = useT(messages);
  const str = value === null || value === undefined ? '' : String(value);
  const commit = (s: string) => onChange(s === '' && field.nullable ? null : s);
  if (field.format === 'timezone' || field.format === 'currency') {
    const list = field.format === 'timezone' ? TIMEZONES : CURRENCIES;
    const options = (list.includes(str) ? list : [str, ...list]).map((v) => ({ value: v, label: v }));
    return <NativeSelect id={id} label={label} describedBy={describedBy} value={str} onChange={commit} options={options} className="sm:max-w-64" />;
  }
  if (field.multiline) {
    return (
      <textarea
        id={id}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        value={str}
        rows={3}
        onChange={(e) => commit(e.target.value)}
        className={cn(inputBase, 'h-auto py-2 leading-relaxed', focusRing)}
      />
    );
  }
  const ltr = field.type === 'url' || !!field.format;
  const type =
    field.format === 'time' ? 'time' : field.format === 'datetime' ? 'datetime-local' : field.type === 'url' ? 'url' : field.format === 'email' ? 'email' : field.format === 'phone' ? 'tel' : 'text';
  const shown = field.format === 'datetime' && str ? str.slice(0, 16) : str;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {field.format === 'hex' && <span aria-hidden className="size-8 shrink-0 rounded-lg ring-1 ring-border" style={{ background: str || 'transparent' }} />}
      <input
        id={id}
        type={type}
        dir={ltr ? 'ltr' : undefined}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        value={shown}
        placeholder={field.nullable ? t.value.notSet : undefined}
        onChange={(e) => commit(e.target.value)}
        className={cn(inputBase, focusRing, ltr && 'text-start', invalid && 'border-destructive')}
      />
    </span>
  );
}

/** A labelled wrapper used by the inline row: the control plus an accessible description id. */
export function useFieldIds(prefix: string) {
  const id = useId();
  return { control: `${prefix}-${id}-c`, help: `${prefix}-${id}-h`, error: `${prefix}-${id}-e` };
}

export function NullableNote({ children }: { children: ReactNode }) {
  return <span className="text-12 text-muted-foreground">{children}</span>;
}
