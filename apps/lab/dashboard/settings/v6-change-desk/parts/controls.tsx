// One control per field type: switch, stepper (integer / number / money / duration), segmented or select, chips,
// tag input (ordered with up/down), masked secret, url / formatted text, time and datetime.
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Minus, Plus, X } from 'lucide-react';
import { Switch } from '@dash/components/ui/switch';
import { cn } from '@dash/lib/utils';
import type { Field, FieldValue } from '@lab/mocks/settings';
import { useDesk } from './store';
import { num, unitSuffix } from './format';
import { Btn, focusRing, Segmented } from './ui';

export interface ControlProps {
  field: Field;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  disabled?: boolean;
  id: string;
  labelledBy: string;
}

const inputCls = cn(
  'h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-14 text-foreground placeholder:text-muted-foreground sm:h-9 sm:text-13',
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60',
);

export function FieldControl(p: ControlProps) {
  const { field, value } = p;
  if (field.nullable && value === null && field.type !== 'boolean' && field.type !== 'secret') return <NullableOff {...p} />;
  switch (field.type) {
    case 'boolean':
      return <BoolControl {...p} />;
    case 'integer':
    case 'number':
    case 'money':
    case 'duration':
      return <Stepper {...p} />;
    case 'enum':
      return <EnumControl {...p} />;
    case 'multi-enum':
      return <Chips {...p} />;
    case 'string-list':
      return <TagList {...p} />;
    case 'secret':
      return <SecretControl {...p} />;
    default:
      return <TextControl {...p} />;
  }
}

function NullableOff({ field, onChange, disabled, labelledBy }: ControlProps) {
  const { t } = useDesk();
  const seed: FieldValue =
    field.default ?? (field.type === 'integer' || field.type === 'number' || field.type === 'money' || field.type === 'duration' ? (field.min ?? 0) : field.type === 'string-list' ? [] : '');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-13 text-muted-foreground">{t.field.notSet}</span>
      <Btn size="sm" variant="outline" disabled={disabled} aria-describedby={labelledBy} onClick={() => onChange(seed)}>
        <Plus aria-hidden />
        {t.field.setValue}
      </Btn>
    </div>
  );
}

function ClearNull({ field, onChange, disabled }: ControlProps) {
  const { t } = useDesk();
  if (!field.nullable || field.type === 'boolean') return null;
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(null)} className={cn('min-h-11 rounded-md px-2 text-12 font-semibold text-muted-foreground underline-offset-4 hover:underline sm:min-h-8', focusRing)}>
      {t.field.clearValue}
    </button>
  );
}

function BoolControl({ value, onChange, disabled, id, labelledBy }: ControlProps) {
  const { t } = useDesk();
  const on = value === true;
  return (
    <label htmlFor={id} className={cn('inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-lg ps-1 pe-2', disabled && 'cursor-not-allowed')}>
      <Switch id={id} checked={on} disabled={disabled} onCheckedChange={(c) => onChange(c)} aria-labelledby={labelledBy} />
      <span className={cn('min-w-12 text-13 font-semibold', on ? 'text-foreground' : 'text-muted-foreground')}>{on ? t.field.on : t.field.off}</span>
    </label>
  );
}

function Stepper(p: ControlProps) {
  const { field, value, onChange, disabled, id, labelledBy } = p;
  const { t, l } = useDesk();
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  const step = field.step ?? (field.type === 'integer' || field.type === 'duration' ? 1 : field.unit === 'ratio' ? 0.05 : field.unit === 'percent' ? 0.5 : field.type === 'money' ? 1 : 0.5);
  const [text, setText] = useState(String(n));
  useEffect(() => setText(String(n)), [n]);
  const clamp = (x: number) => {
    let v = x;
    if (field.min != null) v = Math.max(field.min, v);
    if (field.max != null) v = Math.min(field.max, v);
    const decimals = String(step).split('.')[1]?.length ?? 0;
    return Number(v.toFixed(Math.max(decimals, field.type === 'money' ? 2 : 0)));
  };
  const commit = () => {
    const parsed = Number(text.replace(/,/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
    if (Number.isFinite(parsed)) onChange(clamp(parsed));
    else setText(String(n));
  };
  const suffix = unitSuffix(field, t);
  const bytes = field.unit === 'bytes';
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1">
        <Btn size="icon" variant="outline" aria-label={t.field.decrease} disabled={disabled || (field.min != null && n <= field.min)} onClick={() => onChange(clamp(n - (bytes ? 1_000_000 : step)))}>
          <Minus aria-hidden />
        </Btn>
        <div className="relative" dir="ltr">
          <input
            id={id}
            aria-labelledby={labelledBy}
            inputMode="decimal"
            dir="ltr"
            disabled={disabled}
            value={bytes ? num(n / 1_000_000, l) : text}
            readOnly={bytes}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'ArrowUp') (e.preventDefault(), onChange(clamp(n + step)));
              if (e.key === 'ArrowDown') (e.preventDefault(), onChange(clamp(n - step)));
            }}
            className={cn(inputCls, 'w-32 text-center tabular-nums', suffix && 'ps-2 pe-14')}
          />
          {suffix && <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-12 font-semibold text-muted-foreground">{suffix}</span>}
        </div>
        <Btn size="icon" variant="outline" aria-label={t.field.increase} disabled={disabled || (field.max != null && n >= field.max)} onClick={() => onChange(clamp(n + (bytes ? 1_000_000 : step)))}>
          <Plus aria-hidden />
        </Btn>
        <ClearNull {...p} />
      </div>
    </div>
  );
}

function EnumControl({ field, value, onChange, disabled, id, labelledBy }: ControlProps) {
  const { l, t } = useDesk();
  const options = field.options ?? [];
  const label = field.label[l];
  if (options.length <= 4) {
    return (
      <Segmented
        label={label}
        value={String(value)}
        disabled={disabled}
        onChange={(v) => onChange(v)}
        options={options.map((o) => ({
          value: o.value,
          label: (
            <>
              {o.label[l]}
              {field.proposedOptions?.includes(o.value) && <span className="text-12 font-semibold text-info-soft-foreground">· {t.field.proposed}</span>}
            </>
          ),
        }))}
      />
    );
  }
  return (
    <select id={id} aria-labelledby={labelledBy} disabled={disabled} value={String(value)} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, 'w-full sm:w-60')}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label[l]}
        </option>
      ))}
    </select>
  );
}

function Chips({ field, value, onChange, disabled, labelledBy }: ControlProps) {
  const { l } = useDesk();
  const selected = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
      {(field.options ?? []).map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? selected.filter((x) => x !== o.value) : (field.options ?? []).map((x) => x.value).filter((x) => x === o.value || selected.includes(x)))}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-12 font-semibold transition-colors sm:min-h-8',
              focusRing,
              on ? 'border-transparent bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            {o.label[l]}
          </button>
        );
      })}
    </div>
  );
}

function TagList(p: ControlProps) {
  const { field, value, onChange, disabled, id, labelledBy } = p;
  const { t, l } = useDesk();
  const items = Array.isArray(value) ? (value as (string | number)[]) : [];
  const [text, setText] = useState('');
  const numeric = field.itemType === 'integer' || !!field.itemUnit;
  const add = () => {
    const raw = text.trim();
    if (!raw) return;
    const v = numeric ? Number(raw) : raw;
    if (numeric && !Number.isFinite(v as number)) return;
    if (items.some((x) => String(x) === String(v))) return setText('');
    onChange((numeric ? [...items, v].sort((a, b) => Number(a) - Number(b)) : [...items, v]) as FieldValue);
    setText('');
  };
  const moveItem = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next as FieldValue);
  };
  const unit = field.itemUnit ? t.units.short[field.itemUnit] : '';
  const ltr = field.format === 'cidr' || field.format === 'iata' || field.format === 'country' || field.format === 'currency' || field.format === 'email' || field.format === 'phone';

  if (field.ordered) {
    return (
      <ol aria-labelledby={labelledBy} className="grid w-full gap-1.5 sm:w-72">
        {items.map((it, i) => (
          <li key={String(it)} className="flex min-h-11 items-center gap-2 rounded-lg border bg-background ps-3 pe-1 sm:min-h-9">
            <span className="w-5 text-12 font-bold tabular-nums text-muted-foreground">{num(i + 1, l)}</span>
            <span className="flex-1 truncate text-13 font-semibold">{field.options?.find((o) => o.value === it)?.label[l] ?? String(it)}</span>
            <Btn size="icon" variant="ghost" aria-label={`${t.field.moveUp}: ${String(it)}`} disabled={disabled || i === 0} onClick={() => moveItem(i, -1)}>
              <ArrowUp aria-hidden />
            </Btn>
            <Btn size="icon" variant="ghost" aria-label={`${t.field.moveDown}: ${String(it)}`} disabled={disabled || i === items.length - 1} onClick={() => moveItem(i, 1)}>
              <ArrowDown aria-hidden />
            </Btn>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="grid w-full gap-2 sm:w-80">
      <ul aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
        {items.length === 0 && <li className="text-13 text-muted-foreground">{t.values.empty}</li>}
        {items.map((it) => (
          <li key={String(it)} className="inline-flex min-h-8 items-center gap-1 rounded-full border bg-background ps-3 pe-1 text-12 font-semibold">
            <bdi dir={ltr ? 'ltr' : undefined}>
              {numeric ? num(Number(it), l) : String(it)}
              {unit && ` ${unit}`}
            </bdi>
            <button
              type="button"
              disabled={disabled}
              aria-label={t.field.removeItem(String(it))}
              onClick={() => onChange(items.filter((x) => x !== it) as FieldValue)}
              className={cn('relative inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground after:absolute after:-inset-3 after:content-[""]', focusRing)}
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5">
        <input
          id={id}
          aria-labelledby={labelledBy}
          disabled={disabled}
          value={text}
          dir={ltr || numeric ? 'ltr' : undefined}
          inputMode={numeric ? 'numeric' : undefined}
          placeholder={t.field.addPlaceholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.preventDefault(), add());
          }}
          className={cn(inputCls, ltr || numeric ? 'text-start' : '')}
        />
        <Btn size="md" variant="outline" disabled={disabled || !text.trim()} onClick={add}>
          {t.field.add}
        </Btn>
      </div>
    </div>
  );
}

function SecretControl({ value, id, labelledBy }: ControlProps) {
  const { t, role } = useDesk();
  const [shown, setShown] = useState(false);
  const masked = typeof value === 'string' ? value : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code id={id} aria-labelledby={labelledBy} dir="ltr" className="inline-flex h-11 min-w-36 items-center rounded-lg border bg-muted px-3 text-13 tabular-nums sm:h-9">
        {masked ? (shown ? masked.replace('••••', 'sk_live_51N••••••••') : '••••••••••') : t.field.notSet}
      </code>
      {masked && role === 'owner' && (
        <Btn size="sm" variant="ghost" aria-pressed={shown} onClick={() => setShown((s) => !s)} title={t.field.revealOwner}>
          {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          {shown ? t.field.hide : t.field.reveal}
        </Btn>
      )}
    </div>
  );
}

function TextControl(p: ControlProps) {
  const { field, value, onChange, disabled, id, labelledBy } = p;
  const s = value == null ? '' : String(value);
  const [text, setText] = useState(s);
  useEffect(() => setText(s), [s]);
  const ltr = field.type === 'url' || !!field.format || /^[\x00-\x7F]*$/.test(s);
  const long = !!field.multiline || s.length > 48 || s.includes('\n');
  if (field.format === 'time') {
    return (
      <div className="flex items-center gap-2">
        <input id={id} type="time" dir="ltr" aria-labelledby={labelledBy} disabled={disabled} value={s} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, 'w-32')} />
        <ClearNull {...p} />
      </div>
    );
  }
  if (field.format === 'datetime') {
    const local = s.slice(0, 16);
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="datetime-local"
          dir="ltr"
          aria-labelledby={labelledBy}
          disabled={disabled}
          value={local}
          onChange={(e) => onChange(e.target.value ? `${e.target.value}:00+03:00` : null)}
          className={cn(inputCls, 'w-56')}
        />
        <ClearNull {...p} />
      </div>
    );
  }
  const commit = () => {
    if (text !== s) onChange(text === '' && field.nullable ? null : text);
  };
  return (
    <div className="flex w-full items-start gap-2 sm:w-80">
      {long ? (
        <textarea
          id={id}
          aria-labelledby={labelledBy}
          disabled={disabled}
          rows={3}
          dir={ltr ? 'ltr' : undefined}
          value={text}
          maxLength={field.max}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          className={cn(inputCls, 'h-auto min-h-20 py-2 leading-relaxed sm:h-auto')}
        />
      ) : (
        <input
          id={id}
          aria-labelledby={labelledBy}
          disabled={disabled}
          dir={ltr ? 'ltr' : undefined}
          type={field.type === 'url' ? 'url' : field.format === 'email' ? 'email' : field.format === 'phone' ? 'tel' : 'text'}
          value={text}
          maxLength={field.max}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
          className={cn(inputCls, ltr && 'text-start')}
        />
      )}
      <ClearNull {...p} />
    </div>
  );
}
