// My preferences: this browser only, applied instantly, never staged into the ticket.
import { useEffect, useRef } from 'react';
import { Check, MonitorSmartphone, Palette, RotateCcw } from 'lucide-react';
import { cn } from '@dash/lib/utils';
import { PREFERENCES, type Field, type FieldValue, type PreferenceTab } from '@lab/mocks/settings';
import { FieldControl } from './controls';
import { FieldMarkers } from './field-row';
import { formatValue } from './format';
import { useDesk } from './store';
import { Badge, Btn, Card, focusRing, Icon } from './ui';
import type { FlatField } from '@lab/mocks/settings';

export function Preferences() {
  const { t, resetPrefs } = useDesk();
  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-22 font-extrabold sm:text-26">{t.prefs.title}</h1>
          <p className="text-14 text-muted-foreground">{t.prefs.lead}</p>
        </div>
        <Btn variant="outline" onClick={resetPrefs}>
          <RotateCcw aria-hidden />
          {t.prefs.reset}
        </Btn>
      </header>
      <p className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-14 leading-relaxed">
        <MonitorSmartphone aria-hidden className="mt-0.5 size-5 shrink-0 text-[color:var(--primary)]" />
        <span>
          <strong className="font-bold">{t.prefs.instant}</strong>
        </span>
      </p>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
        <PrefCard tab={PREFERENCES[0]} preview />
        <div className="grid gap-5">
          {PREFERENCES.slice(1).map((tab) => (
            <PrefCard key={tab.id} tab={tab} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PrefCard({ tab, preview }: { tab: PreferenceTab; preview?: boolean }) {
  const { t, l, prefs } = useDesk();
  const size = { sm: 'text-14', base: 'text-16', lg: 'text-18', xl: 'text-20' }[String(prefs.fontSize)] ?? 'text-16';
  return (
    <Card className="overflow-hidden" aria-labelledby={`pref-${tab.id}`}>
      <div className="flex items-start gap-3 border-b px-5 py-4">
        <Icon name={tab.icon} className="mt-0.5 size-5 shrink-0 text-[color:var(--primary)]" />
        <div className="grid min-w-0 gap-0.5">
          <h2 id={`pref-${tab.id}`} className="text-16 font-extrabold">
            {tab.title[l]}
          </h2>
          <p className="text-13 leading-relaxed text-muted-foreground">{tab.description[l]}</p>
        </div>
      </div>
      {preview && (
        <div className="border-b bg-muted/40 px-5 py-3">
          <span className="text-12 font-bold text-muted-foreground">{t.prefs.preview}</span>
          <p className={cn('font-semibold', size)} style={{ fontFamily: `"${String(prefs.fontFamily)}", sans-serif` }}>
            {t.prefs.sample}
          </p>
        </div>
      )}
      <div className="grid divide-y px-1 sm:px-2">
        {tab.fields.map((f) => (
          <PrefRow key={f.key} field={f} />
        ))}
      </div>
    </Card>
  );
}

function PrefRow({ field }: { field: Field }) {
  const { t, l, prefs, setPref, route } = useDesk();
  const value = prefs[field.key] ?? field.value;
  const ref = useRef<HTMLDivElement>(null);
  const focused = route.v === 'prefs' && route.f === field.key;
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'center' });
  }, [focused]);
  const onChange = (v: FieldValue) => {
    const label = `${field.label[l]}: ${formatValue(field, v, l, t)}`;
    setPref(field.key, v, label);
  };
  const lbl = `plbl-${field.key}`;
  const wide = field.type === 'multi-enum' || (field.options?.length ?? 0) > 4;
  return (
    <div ref={ref} id={`pref-field-${field.key}`} className={cn('grid gap-3 rounded-xl px-3 py-4 sm:px-4', !wide && 'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6', focused && 'ring-2 ring-primary/60')}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 id={lbl} className="text-14 font-bold">
            {field.label[l]}
          </h3>
          <FieldMarkers field={field as FlatField} />
          {field.proposedOptions && field.proposalId && <Badge tone="info">{`${field.proposalId} · ${field.priority}`}</Badge>}
        </div>
        <p className="mt-1 text-13 leading-relaxed text-muted-foreground">{field.help[l]}</p>
        {field.note && <p className="mt-1 text-12 text-muted-foreground">{field.note[l]}</p>}
      </div>
      <div className="min-w-0">
        {field.key === 'colorTheme' ? (
          <Swatches field={field} value={value} onChange={onChange} labelledBy={lbl} />
        ) : field.format === 'hex' || /color/i.test(field.key) ? (
          <input
            type="color"
            aria-labelledby={lbl}
            value={typeof value === 'string' && value ? value : '#2e7a82'}
            onChange={(e) => onChange(e.target.value)}
            className={cn('h-11 w-16 cursor-pointer rounded-lg border bg-background p-1 sm:h-9', focusRing)}
          />
        ) : (
          <FieldControl field={field} value={value} onChange={onChange} id={`pctl-${field.key}`} labelledBy={lbl} />
        )}
      </div>
    </div>
  );
}

function Swatches({ field, value, onChange, labelledBy }: { field: Field; value: FieldValue; onChange: (v: FieldValue) => void; labelledBy: string }) {
  const { l } = useDesk();
  const options = field.options ?? [];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-2"
      onKeyDown={(e) => {
        const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
        const d = e.key === (rtl ? 'ArrowLeft' : 'ArrowRight') ? 1 : e.key === (rtl ? 'ArrowRight' : 'ArrowLeft') ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const n = (idx + d + options.length) % options.length;
        onChange(options[n].value);
        refs.current[n]?.focus();
      }}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label[l]}
            title={o.label[l]}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn('inline-flex size-11 items-center justify-center rounded-full border-2 transition-transform sm:size-9', focusRing, on ? 'border-foreground' : 'border-transparent hover:scale-105')}
          >
            {o.hint ? (
              <span className="inline-flex size-7 items-center justify-center rounded-full text-white sm:size-6" style={{ background: o.hint }}>
                {on && <Check aria-hidden className="size-4" />}
              </span>
            ) : (
              <Palette aria-hidden className="size-5 text-muted-foreground" />
            )}
          </button>
        );
      })}
    </div>
  );
}
