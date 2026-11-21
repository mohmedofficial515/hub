// One control per field type: switch, stepper (number, money, duration), segmented or select (enum), chips
// (multi-enum), tag list (string-list, ordered with up/down), masked secret, url and formatted strings.
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Minus, Plus, X } from 'lucide-react';
import type { Field, FieldValue } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { formatNumber, unitWord } from './data';
import { useSettings } from './store';
import { Btn, IconBtn, Pill, Segmented, Toggle } from './ui';

export const inputCls =
  'h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-14 text-foreground shadow-xs outline-none transition-[box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30';

/** Controls that sit beside the label on wide screens; the rest take the full row. */
export function isCompact(field: Field): boolean {
  if (field.readOnly || field.structured) return false;
  switch (field.type) {
    case 'boolean':
    case 'integer':
    case 'number':
    case 'money':
    case 'duration':
      return true;
    case 'enum':
      return (field.options?.length ?? 0) <= 3 && (field.options ?? []).every((o) => o.label.en.length <= 14);
    case 'string':
      return !field.multiline && ['time', 'currency', 'country', 'iata', 'version', 'hex', 'cidr', 'phone'].includes(field.format ?? '');
    default:
      return false;
  }
}

export interface ControlProps {
  field: Field;
  value: FieldValue | undefined;
  onChange: (v: FieldValue) => void;
  id: string;
  labelId: string;
  describedBy?: string;
  disabled?: boolean;
}

export function FieldControl(props: ControlProps) {
  const { field } = props;
  if (field.readOnly) return <ReadOnlyValue {...props} />;
  switch (field.type) {
    case 'boolean':
      return <SwitchControl {...props} />;
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

function SwitchControl({ field, value, onChange, id, labelId, describedBy, disabled }: ControlProps) {
  const { t, lang } = useSettings();
  const on = value === true;
  return (
    <div className="flex items-center gap-2">
      <span className={cn('text-13 font-semibold', on ? 'text-foreground' : 'text-muted-foreground')} aria-hidden>
        {on ? t.control.on : t.control.off}
      </span>
      <Toggle id={id} checked={on} onChange={onChange} label={field.label[lang]} describedBy={describedBy ?? labelId} disabled={disabled} />
    </div>
  );
}

function NumberControl({ field, value, onChange, id, describedBy, disabled }: ControlProps) {
  const { t, lang } = useSettings();
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));
  useEffect(() => setText(value === null || value === undefined ? '' : String(value)), [value]);
  const step = field.step ?? (field.type === 'money' ? 1 : 1);
  const clamp = (n: number) => Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, n));
  const round = (n: number) => Math.round(n * 100) / 100;
  const commit = (raw: string) => {
    if (raw.trim() === '' && field.nullable) return onChange(null);
    const n = Number(raw.replace(',', '.'));
    if (Number.isNaN(n)) return setText(value === null || value === undefined ? '' : String(value));
    const next = clamp(field.type === 'integer' || field.type === 'duration' ? Math.round(n) : round(n));
    setText(String(next));
    onChange(next);
  };
  const bump = (dir: 1 | -1) => {
    const base = typeof value === 'number' ? value : (field.min ?? 0);
    commit(String(round(base + dir * step)));
  };
  const unit = field.type === 'money' ? 'USD' : unitWord(field.unit, lang);
  const isNull = value === null || value === undefined;

  if (isNull && field.nullable) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-13 text-muted-foreground">{t.control.notSet}</span>
        <Btn variant="outline" disabled={disabled} onClick={() => commit(String(field.default ?? field.min ?? 0))}>
          {t.control.setValue}
        </Btn>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-input bg-background shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
        <IconBtn label={t.control.decrease} disabled={disabled || (typeof value === 'number' && field.min !== undefined && value <= field.min)} onClick={() => bump(-1)} className="rounded-none">
          <Minus />
        </IconBtn>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          dir="ltr"
          disabled={disabled}
          value={text}
          aria-describedby={describedBy}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              bump(1);
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              bump(-1);
            }
          }}
          className="h-11 w-20 min-w-0 border-x border-input bg-transparent px-2 text-center text-15 font-semibold tabular-nums outline-none"
        />
        <IconBtn label={t.control.increase} disabled={disabled || (typeof value === 'number' && field.max !== undefined && value >= field.max)} onClick={() => bump(1)} className="rounded-none">
          <Plus />
        </IconBtn>
      </div>
      {unit ? <span className="text-13 font-medium text-muted-foreground">{unit}</span> : null}
      {field.nullable ? (
        <button type="button" onClick={() => onChange(null)} disabled={disabled} className="min-h-11 rounded-lg px-2 text-12 font-semibold text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {t.control.clearValue}
        </button>
      ) : null}
    </div>
  );
}

/** Range words for the help line ("1 to 50 minutes"). */
export function rangeText(field: Field, lang: 'ar' | 'en', words: (min: string, max: string) => string): string | null {
  if (field.min === undefined || field.max === undefined) return null;
  if (!['integer', 'number', 'money', 'duration'].includes(field.type)) return null;
  const unit = field.type === 'money' ? 'USD' : unitWord(field.unit, lang);
  return `${words(formatNumber(field.min, lang), formatNumber(field.max, lang))}${unit ? ` ${unit}` : ''}`;
}

function EnumControl({ field, value, onChange, id, labelId, disabled }: ControlProps) {
  const { t, lang } = useSettings();
  const options = field.options ?? [];
  const proposed = field.proposedOptions ?? [];
  if (options.length <= 4 && options.every((o) => o.label.en.length <= 18)) {
    return (
      <Segmented
        label={field.label[lang]}
        value={String(value ?? '')}
        onChange={(v) => !disabled && onChange(v)}
        options={options.map((o) => ({
          value: o.value,
          label: o.label[lang],
          badge: proposed.includes(o.value) ? (
            <span className="rounded bg-accent-violet/12 px-1 text-[11px] font-bold text-accent-violet-on-soft">{t.badge.proposed}</span>
          ) : undefined,
        }))}
      />
    );
  }
  return (
    <select
      id={id}
      aria-labelledby={labelId}
      disabled={disabled}
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputCls, 'pe-8 sm:max-w-80')}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label[lang]}
          {proposed.includes(o.value) ? ` (${t.badge.proposed})` : ''}
        </option>
      ))}
    </select>
  );
}

function ChipsControl({ field, value, onChange, labelId, disabled }: ControlProps) {
  const { lang } = useSettings();
  const list = Array.isArray(value) ? value.map(String) : [];
  const toggle = (v: string) => onChange(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
      {(field.options ?? []).map((o) => {
        const on = list.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => toggle(o.value)}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-13 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              on ? 'border-primary bg-primary/10 text-foreground dark:bg-primary/15' : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            <span className={cn('grid size-4 place-items-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')} aria-hidden>
              {on ? <svg viewBox="0 0 12 12" className="size-3"><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
            </span>
            {o.label[lang]}
          </button>
        );
      })}
    </div>
  );
}

function ListControl({ field, value, onChange, id, labelId, describedBy, disabled }: ControlProps) {
  const { t, lang } = useSettings();
  const list = Array.isArray(value) ? value.map((v) => String(v)) : [];
  const [draft, setDraft] = useState('');
  const numeric = field.itemType === 'integer';
  const ltr = numeric || ['cidr', 'email', 'phone', 'iata', 'country', 'currency'].includes(field.format ?? '');
  const label = (v: string) => field.options?.find((o) => o.value === v)?.label[lang] ?? v;
  const emit = (next: string[]) => onChange(numeric ? next.map(Number) : next);
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (numeric && Number.isNaN(Number(v))) return;
    const item = field.format === 'country' || field.format === 'iata' || field.format === 'currency' ? v.toUpperCase() : v;
    if (!list.includes(item)) emit([...list, item]);
    setDraft('');
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    emit(next);
  };
  const ordered = field.ordered || numeric;

  return (
    <div className="space-y-2">
      {ordered ? (
        <ol aria-labelledby={labelId} className="divide-y divide-border rounded-lg border border-border">
          {list.map((v, i) => (
            <li key={`${v}-${i}`} className="flex items-center gap-2 ps-3">
              <span className="w-5 text-12 font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
              <bdi className="min-w-0 flex-1 truncate text-14 font-medium" dir={ltr ? 'ltr' : undefined}>
                {numeric ? `${formatNumber(Number(v), lang)} ${field.itemUnit ? unitWord(field.itemUnit, lang) : ''}` : label(v)}
              </bdi>
              <IconBtn label={t.control.moveUp(label(v))} disabled={disabled || i === 0} onClick={() => move(i, -1)}>
                <ArrowUp />
              </IconBtn>
              <IconBtn label={t.control.moveDown(label(v))} disabled={disabled || i === list.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown />
              </IconBtn>
              {!field.options ? (
                <IconBtn label={t.control.remove(label(v))} disabled={disabled} onClick={() => emit(list.filter((_, k) => k !== i))}>
                  <X />
                </IconBtn>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <ul aria-labelledby={labelId} className="flex flex-wrap gap-2">
          {list.map((v, i) => (
            <li key={`${v}-${i}`} className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-lg border border-border bg-muted/60 ps-3">
              <bdi className="truncate text-13 font-medium" dir={ltr ? 'ltr' : undefined}>
                {label(v)}
              </bdi>
              <IconBtn label={t.control.remove(label(v))} disabled={disabled} onClick={() => emit(list.filter((_, k) => k !== i))} className="size-11">
                <X />
              </IconBtn>
            </li>
          ))}
        </ul>
      )}
      {!field.options ? (
        <div className="flex gap-2">
          <input
            id={id}
            value={draft}
            disabled={disabled}
            dir={ltr ? 'ltr' : undefined}
            inputMode={numeric ? 'numeric' : undefined}
            placeholder={t.control.addPlaceholder}
            aria-describedby={describedBy}
            aria-labelledby={labelId}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            className={cn(inputCls, 'sm:max-w-80')}
          />
          <Btn variant="outline" disabled={disabled || !draft.trim()} onClick={add}>
            <Plus aria-hidden />
            {t.control.add}
          </Btn>
        </div>
      ) : null}
    </div>
  );
}

function SecretControl({ field, value, onChange, id, describedBy, disabled }: ControlProps) {
  const { t, state } = useSettings();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [show, setShow] = useState(false);
  const owner = state.role === 'owner';
  const saved = typeof value === 'string' && value.startsWith('••••') ? value.slice(4) : null;
  const hintId = useId();
  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-11 min-w-0 items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 text-13" dir="ltr">
          <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate font-mono tracking-wider">{typeof value === 'string' && value ? value : '—'}</span>
        </span>
        <span className="sr-only">{saved ? t.control.savedSecret(saved) : t.control.notSet}</span>
        <Btn variant="outline" disabled={disabled} onClick={() => setEditing(true)} aria-describedby={hintId}>
          {saved ? t.control.replace : t.control.setValue}
        </Btn>
        <p id={hintId} className="w-full text-12 text-muted-foreground">
          {t.control.secretNever}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          dir="ltr"
          autoComplete="off"
          value={text}
          aria-label={`${t.control.newSecret}: ${field.label.en}`}
          aria-describedby={describedBy}
          onChange={(e) => setText(e.target.value)}
          className={cn(inputCls, 'font-mono sm:max-w-80')}
        />
        <IconBtn label={show ? t.control.hide : t.control.reveal} disabled={!owner} onClick={() => setShow((v) => !v)} className="border border-input">
          {show ? <EyeOff /> : <Eye />}
        </IconBtn>
      </div>
      {!owner ? <p className="text-12 text-muted-foreground">{t.control.ownerReveal}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Btn
          variant="outline"
          disabled={!text.trim()}
          onClick={() => {
            onChange(`••••${text.trim().slice(-4)}`);
            setEditing(false);
            setText('');
            setShow(false);
          }}
        >
          {t.control.replace}
        </Btn>
        <Btn variant="ghost" onClick={() => setEditing(false)}>
          {t.control.cancel}
        </Btn>
      </div>
    </div>
  );
}

function TextControl({ field, value, onChange, id, describedBy, disabled }: ControlProps) {
  const { t } = useSettings();
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));
  useEffect(() => setText(value === null || value === undefined ? '' : String(value)), [value]);
  const commit = (raw: string) => {
    const v = field.format === 'country' || field.format === 'iata' || field.format === 'currency' ? raw.trim().toUpperCase() : raw;
    onChange(v === '' && field.nullable ? null : v);
  };
  const ltr = field.type === 'url' || ['email', 'phone', 'cidr', 'iata', 'version', 'hex', 'currency', 'timezone', 'country', 'time', 'datetime'].includes(field.format ?? '');
  const common = {
    id,
    disabled,
    'aria-describedby': describedBy,
    dir: ltr ? ('ltr' as const) : undefined,
  };
  if (field.multiline) {
    return (
      <textarea
        {...common}
        value={text}
        rows={3}
        maxLength={field.max}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        className={cn(inputCls, 'h-auto min-h-24 py-2 leading-relaxed')}
      />
    );
  }
  const type =
    field.type === 'url'
      ? 'url'
      : field.format === 'email'
        ? 'email'
        : field.format === 'phone'
          ? 'tel'
          : field.format === 'time'
            ? 'time'
            : field.format === 'datetime'
              ? 'datetime-local'
              : field.format === 'hex'
                ? 'color'
                : 'text';
  const shown = type === 'datetime-local' && text ? text.slice(0, 16) : text;
  return (
    <div className="flex flex-col gap-1">
      <input
        {...common}
        type={type}
        value={shown}
        maxLength={field.format === 'country' ? 2 : field.format === 'currency' ? 3 : field.max}
        placeholder={field.nullable ? t.control.notSet : undefined}
        onChange={(e) => {
          setText(e.target.value);
          if (type === 'color' || type === 'time') commit(e.target.value);
        }}
        onBlur={(e) => commit(type === 'datetime-local' && e.target.value ? `${e.target.value}:00+03:00` : e.target.value)}
        className={cn(
          inputCls,
          type === 'color' && 'h-11 w-20 cursor-pointer p-1',
          field.format === 'country' || field.format === 'currency' || field.format === 'iata' ? 'w-24 uppercase' : field.format === 'time' ? 'w-36' : 'sm:max-w-96',
        )}
      />
      {type === 'datetime-local' ? <span className="text-12 text-muted-foreground">{t.control.localTime}</span> : null}
    </div>
  );
}

function ReadOnlyValue({ field, value }: ControlProps) {
  const { t, lang } = useSettings();
  const option = field.options?.find((o) => o.value === value);
  const text =
    value === null || value === undefined || value === ''
      ? t.control.notSet
      : option
        ? option.label[lang]
        : Array.isArray(value)
          ? value.join(lang === 'ar' ? '، ' : ', ')
          : String(value);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg bg-muted px-3 text-14 font-semibold">
        <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <bdi className="min-w-0 break-all">{text}</bdi>
      </span>
      <Pill>{t.badge.readOnly}</Pill>
    </div>
  );
}
