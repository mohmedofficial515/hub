/**
 * One control per field type: on/off words, stepper with unit and range, segmented or list choice, chips, tag list (ordered lists
 * move up / down), masked secret with reveal for the owner, url, and the string formats (date-time, time, country, colour…).
 */
import { useId, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, ExternalLink, Minus, Plus, X } from 'lucide-react';
import type { Field, FieldValue } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { useBook } from './store';
import { fill, formatValue, isLtrValue, num } from './model';
import { Badge, IconButton, Segmented, btn } from './ui';

export const inputCls =
  'min-h-11 w-full rounded-xl border border-input bg-background px-3 text-14 text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:min-h-10';

const COUNTRIES = ['TR', 'SA', 'AE', 'EG', 'KW', 'QA', 'BH', 'OM', 'JO', 'GB', 'US', 'DE'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'TRY', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'EGP'];

export function FieldEditor({
  docKey,
  field,
  boolWords,
  labelledBy,
}: {
  docKey: string;
  field: Field;
  /** The two phrases a sentence uses for this boolean (shown as the choices). */
  boolWords?: [string, string];
  labelledBy?: string;
}) {
  const { get, setValue, t, locale, viewer } = useBook();
  const value = get(docKey, field.key);
  const set = (v: FieldValue) => setValue(docKey, field.key, v);
  const label = field.label[locale];

  if (field.readOnly) {
    return (
      <p className="rounded-xl bg-muted px-3 py-2.5 text-14 font-semibold" dir={isLtrValue(field) ? 'ltr' : undefined}>
        {formatValue(field, value, locale, t, { max: 50 })}
      </p>
    );
  }

  if (field.structured) {
    const items = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="grid gap-2">
        {items.length ? (
          <ol className="grid gap-1.5 text-13">
            {items.map((item) => (
              <li key={item} className="rounded-lg bg-muted px-3 py-2 leading-relaxed">
                <bdi>{item}</bdi>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-13 text-muted-foreground">{t.ui.emptyList}</p>
        )}
        <p className="text-12 text-muted-foreground">{t.ui.editorStub}</p>
        <button type="button" className={btn('outline', 'sm')} disabled aria-disabled>
          <ExternalLink className="size-4" aria-hidden />
          {t.ui.openEditor}
        </button>
      </div>
    );
  }

  switch (field.type) {
    case 'boolean': {
      const [yes, no] = boolWords ?? [t.words.on, t.words.off];
      return (
        <Segmented
          label={label}
          value={value ? 'on' : 'off'}
          onChange={(v) => set(v === 'on')}
          className="w-full"
          options={[
            { value: 'on', label: <span className="text-balance">{yes}</span> },
            { value: 'off', label: <span className="text-balance">{no}</span> },
          ]}
        />
      );
    }
    case 'integer':
    case 'number':
    case 'money':
    case 'duration':
      return <Stepper docKey={docKey} field={field} value={value} onChange={set} labelledBy={labelledBy} />;
    case 'enum':
      return <Choice field={field} value={String(value ?? '')} onChange={set} label={label} />;
    case 'multi-enum':
      return <Chips field={field} value={(value as string[]) ?? []} onChange={set} label={label} />;
    case 'string-list':
      if (field.options) return <OrderedOptions field={field} value={(value as string[]) ?? []} onChange={set} />;
      return <TagList field={field} value={(value as (string | number)[]) ?? []} onChange={set} labelledBy={labelledBy} />;
    case 'secret':
      return <SecretEditor field={field} value={value as string | null} onChange={set} owner={viewer === 'owner'} />;
    case 'url':
      return <UrlEditor field={field} value={value as string | null} onChange={set} labelledBy={labelledBy} />;
    default:
      return <StringEditor field={field} value={value as string | null} onChange={set} labelledBy={labelledBy} />;
  }
}

function Nullable({ field, value, onChange, children, fallback }: { field: Field; value: FieldValue; onChange: (v: FieldValue) => void; children: ReactNode; fallback: FieldValue }) {
  const { t } = useBook();
  if (!field.nullable) return <>{children}</>;
  const empty = value === null;
  return (
    <div className="grid gap-2.5">
      <Segmented
        label={field.label.ar}
        size="sm"
        value={empty ? 'empty' : 'set'}
        onChange={(v) => onChange(v === 'empty' ? null : (field.default ?? fallback))}
        options={[
          { value: 'set', label: t.ui.setValue },
          { value: 'empty', label: t.ui.leaveEmpty },
        ]}
      />
      {empty ? null : children}
    </div>
  );
}

function Stepper({ docKey, field, value, onChange, labelledBy }: { docKey: string; field: Field; value: FieldValue; onChange: (v: FieldValue) => void; labelledBy?: string }) {
  const { t, locale } = useBook();
  const n = typeof value === 'number' ? value : null;
  const step = field.step ?? (n !== null && !Number.isInteger(n) ? (Math.abs(n) < 1 ? 0.01 : 0.05) : field.unit === 'ratio' ? 0.05 : 1);
  const [text, setText] = useState<string | null>(null);
  const unit = field.unit ? t.units[field.unit] : '';
  const clamp = (x: number) => Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, x));
  const round = (x: number) => Math.round(x / step) * step;
  const commit = (x: number) => onChange(Number(clamp(round(x)).toFixed(4)));
  const out = text !== null && text.trim() !== '' && (Number(text) < (field.min ?? -Infinity) || Number(text) > (field.max ?? Infinity));
  const errId = useId();
  const range =
    field.min !== undefined && field.max !== undefined
      ? fill(t.ui.range, { min: num(field.min), max: num(field.max) })
      : field.min !== undefined
        ? fill(t.ui.rangeMin, { min: num(field.min) })
        : field.max !== undefined
          ? fill(t.ui.rangeMax, { max: num(field.max) })
          : '';
  const words = n !== null ? formatValue(field, n, locale, t, { docKey: undefined }) : '';
  return (
    <Nullable field={field} value={value} onChange={onChange} fallback={field.min ?? 0}>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <IconButton label={t.ui.decrease} className="border border-border bg-card" onClick={() => n !== null && commit(n - step)} disabled={n === null || n <= (field.min ?? -Infinity)}>
            <Minus className="size-4" aria-hidden />
          </IconButton>
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="decimal"
              dir="ltr"
              aria-labelledby={labelledBy}
              aria-invalid={out || undefined}
              aria-describedby={errId}
              className={cn(inputCls, 'text-center text-16 font-bold tabular-nums', unit && 'pe-14')}
              value={text ?? (n ?? '')}
              min={field.min}
              max={field.max}
              step={step}
              onChange={(e) => {
                setText(e.target.value);
                const x = Number(e.target.value);
                if (e.target.value.trim() !== '' && !Number.isNaN(x) && x >= (field.min ?? -Infinity) && x <= (field.max ?? Infinity)) onChange(x);
              }}
              onBlur={() => {
                if (text !== null && text.trim() !== '' && !Number.isNaN(Number(text))) commit(Number(text));
                setText(null);
              }}
            />
            {unit ? (
              <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-12 font-semibold text-muted-foreground">{unit}</span>
            ) : null}
          </div>
          <IconButton label={t.ui.increase} className="border border-border bg-card" onClick={() => n !== null && commit(n + step)} disabled={n === null || n >= (field.max ?? Infinity)}>
            <Plus className="size-4" aria-hidden />
          </IconButton>
        </div>
        <p id={errId} className={cn('flex flex-wrap items-center justify-between gap-x-3 text-12', out ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
          <span>{range}</span>
          {words && !out ? <span className="font-semibold text-foreground">{words}</span> : null}
        </p>
      </div>
    </Nullable>
  );
}

function Choice({ field, value, onChange, label }: { field: Field; value: string; onChange: (v: FieldValue) => void; label: string }) {
  const { t, locale } = useBook();
  const options = field.options ?? [];
  const short = options.length <= 3 && options.every((o) => o.label[locale].length <= 16);
  const badge = (v: string) =>
    field.proposedOptions?.includes(v) ? (
      <Badge tone="violet" className="text-12">
        {t.ui.proposed}
      </Badge>
    ) : null;
  if (short) {
    return (
      <Segmented
        label={label}
        value={value}
        onChange={onChange}
        className="w-full"
        options={options.map((o) => ({ value: o.value, label: o.label[locale], badge: badge(o.value) }))}
      />
    );
  }
  return (
    <ChoiceList
      label={label}
      value={value}
      onChange={onChange}
      options={options.map((o) => ({ value: o.value, label: o.label[locale], hint: o.hint, badge: badge(o.value) }))}
    />
  );
}

function ChoiceList({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; hint?: string; badge?: ReactNode }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid max-h-64 gap-1 overflow-y-auto pe-1">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (!options.some((x) => x.value === value) && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
              e.preventDefault();
              const next = options[(i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length];
              onChange(next.value);
              const sibling = (e.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined);
              sibling?.focus();
            }}
            className={cn(
              'flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-start text-14 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-10',
              on ? 'bg-primary/10 font-bold text-foreground dark:bg-primary/20' : 'hover:bg-muted',
            )}
          >
            <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-primary bg-primary' : 'border-muted-foreground/50')} aria-hidden>
              {on ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
            </span>
            {o.hint?.startsWith('#') || o.hint?.startsWith('oklch') ? (
              <span className="size-4 shrink-0 rounded-full ring-1 ring-border" style={{ background: o.hint }} aria-hidden />
            ) : null}
            <span className="min-w-0 flex-1">
              <bdi>{o.label}</bdi>
            </span>
            {o.hint && !o.hint.startsWith('#') && !o.hint.startsWith('oklch') ? <span className="text-12 text-muted-foreground" dir="ltr">{o.hint}</span> : null}
            {o.badge}
          </button>
        );
      })}
    </div>
  );
}

function Chips({ field, value, onChange, label }: { field: Field; value: string[]; onChange: (v: FieldValue) => void; label: string }) {
  const { locale } = useBook();
  const toggle = (v: string) => {
    const has = value.includes(v);
    const next = has ? value.filter((x) => x !== v) : [...value, v];
    // keep the option order
    onChange((field.options ?? []).map((o) => o.value).filter((o) => next.includes(o)));
  };
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {(field.options ?? []).map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-13 font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9',
              on ? 'border-primary bg-primary/10 text-foreground dark:bg-primary/20' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {on ? <Check className="size-3.5" aria-hidden /> : null}
            <bdi>{o.label[locale]}</bdi>
          </button>
        );
      })}
    </div>
  );
}

function OrderedOptions({ field, value, onChange }: { field: Field; value: string[]; onChange: (v: FieldValue) => void }) {
  const { t, locale } = useBook();
  const labelOf = (v: string) => field.options?.find((o) => o.value === v)?.label[locale] ?? v;
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <ol className="grid gap-1.5">
      {value.map((v, i) => (
        <li key={v} className="flex items-center gap-2 rounded-xl bg-muted ps-3 text-14">
          <span className="w-5 text-12 font-bold tabular-nums text-muted-foreground">{i + 1}</span>
          <span className="min-w-0 flex-1 font-semibold">{labelOf(v)}</span>
          <IconButton label={fill(t.ui.moveUp, { x: labelOf(v) })} onClick={() => move(i, -1)} disabled={i === 0}>
            <ArrowUp className="size-4" aria-hidden />
          </IconButton>
          <IconButton label={fill(t.ui.moveDown, { x: labelOf(v) })} onClick={() => move(i, 1)} disabled={i === value.length - 1}>
            <ArrowDown className="size-4" aria-hidden />
          </IconButton>
        </li>
      ))}
    </ol>
  );
}

function TagList({ field, value, onChange, labelledBy }: { field: Field; value: (string | number)[]; onChange: (v: FieldValue) => void; labelledBy?: string }) {
  const { t } = useBook();
  const [draft, setDraft] = useState('');
  const numeric = field.itemType === 'integer';
  const upper = field.format === 'country' || field.format === 'currency' || field.format === 'iata';
  const add = () => {
    const raw = draft.trim();
    if (!raw) return;
    const item = numeric ? Number(raw) : upper ? raw.toUpperCase() : raw;
    if (numeric && Number.isNaN(item)) return;
    if (value.some((x) => String(x) === String(item))) {
      setDraft('');
      return;
    }
    if (field.max && value.length >= field.max) return;
    onChange([...value, item] as FieldValue);
    setDraft('');
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next as FieldValue);
  };
  const show = (x: string | number) => (field.format === 'country' ? `${t.countries[String(x)] ?? x} (${x})` : String(x));
  const ltr = numeric || isLtrValue(field) || upper;
  return (
    <div className="grid gap-2">
      {value.length ? (
        <ul className={cn('flex flex-wrap gap-1.5', field.ordered && 'grid')}>
          {value.map((x, i) => (
            <li key={`${x}-${i}`} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-muted ps-3 pe-1 text-13 font-semibold">
              <bdi dir={ltr ? 'ltr' : undefined}>{show(x)}</bdi>
              {field.ordered ? (
                <>
                  <IconButton label={fill(t.ui.moveUp, { x: show(x) })} className="size-8 sm:size-8" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="size-3.5" aria-hidden />
                  </IconButton>
                  <IconButton label={fill(t.ui.moveDown, { x: show(x) })} className="size-8 sm:size-8" onClick={() => move(i, 1)} disabled={i === value.length - 1}>
                    <ArrowDown className="size-3.5" aria-hidden />
                  </IconButton>
                </>
              ) : null}
              <IconButton label={fill(t.ui.remove, { x: show(x) })} className="size-8 sm:size-8" onClick={() => onChange(value.filter((_, j) => j !== i) as FieldValue)}>
                <X className="size-3.5" aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-13 text-muted-foreground">{t.ui.emptyList}</p>
      )}
      <div className="flex gap-2">
        <input
          className={inputCls}
          dir={ltr ? 'ltr' : undefined}
          inputMode={numeric ? 'numeric' : undefined}
          aria-labelledby={labelledBy}
          placeholder={t.ui.addPlaceholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className={btn('outline', 'sm')} onClick={add}>
          <Plus className="size-4" aria-hidden />
          {t.ui.add}
        </button>
      </div>
    </div>
  );
}

function SecretEditor({ field, value, onChange, owner }: { field: Field; value: string | null; onChange: (v: FieldValue) => void; owner: boolean }) {
  const { t } = useBook();
  const [draft, setDraft] = useState('');
  const [shown, setShown] = useState(false);
  const id = useId();
  return (
    <div className="grid gap-2.5">
      <p className="rounded-xl bg-muted px-3 py-2.5 text-14 font-bold tracking-wider" dir="ltr">
        {value ?? t.words.notSaved}
      </p>
      <p className="text-12 leading-relaxed text-muted-foreground">{t.ui.secretSaved}</p>
      <label htmlFor={id} className="text-13 font-semibold">
        {t.ui.secretReplace}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type={shown && owner ? 'text' : 'password'}
          dir="ltr"
          autoComplete="off"
          className={inputCls}
          placeholder={t.ui.secretReplacePh}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value ? `••••${e.target.value.slice(-4)}` : field.value);
          }}
        />
        <IconButton
          label={owner ? (shown ? t.ui.hide : t.ui.reveal) : t.ui.revealOwnerOnly}
          className="border border-border bg-card"
          disabled={!owner}
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </IconButton>
      </div>
      {!owner ? <p className="text-12 text-muted-foreground">{t.ui.revealOwnerOnly}</p> : null}
    </div>
  );
}

function UrlEditor({ field, value, onChange, labelledBy }: { field: Field; value: string | null; onChange: (v: FieldValue) => void; labelledBy?: string }) {
  const { t } = useBook();
  const [text, setText] = useState(value ?? '');
  const invalid = text.trim() !== '' && !/^https:\/\/[^\s]+\.[^\s]+/.test(text.trim());
  const errId = useId();
  return (
    <Nullable field={field} value={value} onChange={(v) => { setText(String(v ?? '')); onChange(v === null ? null : 'https://'); }} fallback="https://">
      <div className="grid gap-1.5">
        <div className="flex gap-2">
          <input
            type="url"
            dir="ltr"
            aria-labelledby={labelledBy}
            aria-invalid={invalid || undefined}
            aria-describedby={errId}
            className={inputCls}
            value={text}
            placeholder="https://"
            onChange={(e) => {
              setText(e.target.value);
              onChange(e.target.value.trim() || (field.nullable ? null : ''));
            }}
          />
          {value && !invalid ? (
            <a href={value} target="_blank" rel="noreferrer" className={cn(btn('outline', 'sm'), 'px-3')} aria-label={t.ui.openUrl} title={t.ui.openUrl}>
              <ExternalLink className="size-4" aria-hidden />
            </a>
          ) : null}
        </div>
        {invalid ? (
          <p id={errId} className="text-12 font-semibold text-destructive">
            {t.ui.urlInvalid}
          </p>
        ) : (
          <span id={errId} hidden />
        )}
      </div>
    </Nullable>
  );
}

function toLocalInput(iso: string | null) {
  if (!iso) return '';
  return iso.slice(0, 16);
}

function StringEditor({ field, value, onChange, labelledBy }: { field: Field; value: string | null; onChange: (v: FieldValue) => void; labelledBy?: string }) {
  const { t } = useBook();
  const s = value ?? '';
  const ltr = isLtrValue(field);
  const empty = field.nullable ? null : '';
  let control: ReactNode;
  switch (field.format) {
    case 'datetime':
      control = (
        <input
          type="datetime-local"
          dir="ltr"
          aria-labelledby={labelledBy}
          className={inputCls}
          value={toLocalInput(value)}
          onChange={(e) => onChange(e.target.value ? `${e.target.value}:00+03:00` : empty)}
        />
      );
      break;
    case 'time':
      control = <input type="time" dir="ltr" aria-labelledby={labelledBy} className={inputCls} value={s} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'country':
      control = (
        <select aria-labelledby={labelledBy} className={inputCls} value={s} onChange={(e) => onChange(e.target.value || empty)}>
          {field.nullable ? <option value="">{t.words.notSet}</option> : null}
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {t.countries[c]} ({c})
            </option>
          ))}
        </select>
      );
      break;
    case 'currency':
      control = (
        <select aria-labelledby={labelledBy} className={inputCls} dir="ltr" value={s} onChange={(e) => onChange(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      );
      break;
    case 'hex':
      control = (
        <div className="flex items-center gap-2">
          <input type="color" aria-labelledby={labelledBy} className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-input bg-background p-1 sm:h-10" value={s || '#2e7a82'} onChange={(e) => onChange(e.target.value)} />
          <input dir="ltr" aria-labelledby={labelledBy} className={inputCls} value={s} placeholder="#2e7a82" onChange={(e) => onChange(e.target.value)} />
        </div>
      );
      break;
    default:
      control =
        field.multiline || s.includes('\n') ? (
          <textarea
            dir={ltr ? 'ltr' : 'auto'}
            aria-labelledby={labelledBy}
            rows={3}
            maxLength={field.max}
            className={cn(inputCls, 'py-2.5 leading-relaxed')}
            value={s}
            onChange={(e) => onChange(e.target.value === '' ? empty : e.target.value)}
          />
        ) : (
          <input
            type={field.format === 'email' ? 'email' : field.format === 'phone' ? 'tel' : 'text'}
            dir={ltr || field.format === 'version' ? 'ltr' : 'auto'}
            aria-labelledby={labelledBy}
            maxLength={field.max}
            className={inputCls}
            value={s}
            placeholder={field.format === 'phone' ? '+90…' : undefined}
            onChange={(e) => onChange(e.target.value === '' ? empty : e.target.value)}
          />
        );
  }
  const count = field.max && !field.format && field.type === 'string' ? `${s.length} / ${field.max}` : null;
  return (
    <div className="grid gap-1.5">
      {control}
      {count ? (
        <p className="text-end text-12 tabular-nums text-muted-foreground" dir="ltr">
          {count}
        </p>
      ) : null}
    </div>
  );
}
