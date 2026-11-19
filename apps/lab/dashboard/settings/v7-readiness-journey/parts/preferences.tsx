// "Personalise your dashboard": three short steps (appearance, tables, notifications), instant apply, kept in this
// browser only. A live preview shows the result; there is no save bar because nothing here is explicit.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check as CheckIcon, ChevronLeft, ChevronRight, Monitor, Moon, RotateCcw, Sun } from 'lucide-react';
import { PREFERENCES, type Field, type FieldValue } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { L, sameValue } from './data';
import { useNav } from './nav';
import { useSettings } from './store';
import { Btn, Card, Icon, Pill, Segmented, Toggle } from './ui';

export function Preferences() {
  const { state, dispatch, t, lang } = useSettings();
  const nav = useNav();
  const [step, setStep] = useState(0);
  const [applied, setApplied] = useState(0);
  const tab = PREFERENCES[step];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;
  useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);

  const set = (key: string, value: FieldValue) => {
    dispatch({ type: 'pref', key, value });
    setApplied((n) => n + 1);
  };
  const changed = tab.fields.filter((f) => !sameValue(state.prefs[f.key], f.default));

  return (
    <div>
      <nav aria-label={t.group.crumbRoot}>
        <button
          type="button"
          onClick={nav.overview}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg pe-2 text-13 font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Back className="size-4" aria-hidden />
          {t.group.crumbRoot}
        </button>
      </nav>
      <header className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-26 font-extrabold tracking-tight outline-none">
            {t.prefs.title}
          </h1>
          <p className="mt-1 max-w-[60ch] text-14 text-muted-foreground">{t.prefs.subtitle}</p>
        </div>
        <Pill tone="success" icon={<CheckIcon />} className="self-start sm:self-auto">
          {t.prefs.instant}
        </Pill>
      </header>

      <ol className="mt-6 grid grid-cols-3 gap-2" aria-label={t.prefs.title}>
        {PREFERENCES.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              aria-current={i === step ? 'step' : undefined}
              onClick={() => setStep(i)}
              className={cn(
                'flex min-h-14 w-full items-center gap-2 rounded-xl border px-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                i === step ? 'border-primary bg-card shadow-sm' : 'border-border bg-transparent hover:bg-muted',
              )}
            >
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full text-12 font-bold',
                  i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-success/15 text-success-soft-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {i < step ? <CheckIcon className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-13 font-bold">{L(p.title, lang)}</span>
                <span className="hidden truncate text-12 text-muted-foreground sm:block">{L(p.description, lang)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 text-18 font-bold [&_svg]:size-5 [&_svg]:text-muted-foreground">
              <Icon name={tab.icon} />
              {L(tab.title, lang)}
              <span className="text-13 font-medium text-muted-foreground">({t.prefs.stepCount(step + 1, PREFERENCES.length)})</span>
            </h2>
            <p role="status" aria-live="polite" className={cn('flex items-center gap-1 text-12 font-semibold text-success-soft-foreground transition-opacity', applied ? 'opacity-100' : 'opacity-0')}>
              <CheckIcon className="size-3.5" aria-hidden />
              <span key={applied}>{applied ? t.prefs.applied : ''}</span>
            </p>
          </div>
          <div className="divide-y divide-border px-5">
            {tab.fields.map((f) => (
              <PrefField key={f.key} field={f} value={state.prefs[f.key]} onChange={(v) => set(f.key, v)} prefs={state.prefs} />
            ))}
          </div>
          {tab.id === 'notifications' ? <p className="mx-5 mb-4 rounded-lg bg-accent-violet/10 px-3 py-2 text-12 leading-relaxed">{t.prefs.notEnforced}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-4">
            {changed.length ? (
              <Btn
                variant="ghost"
                onClick={() => {
                  changed.forEach((f) => dispatch({ type: 'pref', key: f.key, value: f.default }));
                  setApplied((n) => n + 1);
                }}
              >
                <RotateCcw aria-hidden />
                {t.prefs.reset}
              </Btn>
            ) : (
              <span />
            )}
            {step < PREFERENCES.length - 1 ? (
              <Btn onClick={() => setStep(step + 1)}>{t.prefs.next}</Btn>
            ) : (
              <Btn onClick={nav.overview}>{t.prefs.done}</Btn>
            )}
          </div>
        </Card>
        <PreviewPanel />
      </div>
    </div>
  );
}

function PrefField({ field, value, onChange, prefs }: { field: Field; value: FieldValue | undefined; onChange: (v: FieldValue) => void; prefs: Record<string, FieldValue> }) {
  const { t, lang } = useSettings();
  if (field.key === 'customColor' && prefs.colorTheme !== 'custom') return null;
  if (field.key === 'sidebarBgColor' && prefs.sidebarCustomBg !== true) return null;
  const id = `pref-${field.key.replace(/\W/g, '_')}`;
  const wide = field.type === 'enum' && ((field.options?.length ?? 0) > 3 || field.key === 'theme');
  let control: ReactNode;

  if (field.key === 'theme') {
    const icons: Record<string, ReactNode> = { light: <Sun />, dark: <Moon />, system: <Monitor /> };
    control = (
      <Segmented
        label={L(field.label, lang)}
        value={String(value)}
        onChange={onChange}
        size="lg"
        options={(field.options ?? []).map((o) => ({
          value: o.value,
          label: o.label[lang],
          icon: icons[o.value],
          badge: field.proposedOptions?.includes(o.value) ? <span className="rounded bg-accent-violet/12 px-1 text-[11px] font-bold text-accent-violet-on-soft">{t.badge.proposed}</span> : undefined,
        }))}
      />
    );
  } else if (field.key === 'colorTheme') {
    control = (
      <Segmented
        label={L(field.label, lang)}
        value={String(value)}
        onChange={onChange}
        className="bg-transparent p-0"
        options={(field.options ?? []).map((o) => ({
          value: o.value,
          label: o.label[lang],
          icon: (
            <span
              className="size-4 rounded-full border border-black/10"
              style={{ background: o.hint ?? 'conic-gradient(#e11d48,#f59e0b,#10b981,#3b82f6,#8b5cf6,#e11d48)' }}
              aria-hidden
            />
          ),
        }))}
      />
    );
  } else if (field.key === 'fontFamily') {
    control = (
      <Segmented
        label={L(field.label, lang)}
        value={String(value)}
        onChange={onChange}
        options={(field.options ?? []).map((o) => ({ value: o.value, label: <span style={{ fontFamily: o.value }}>{o.label[lang]}</span> }))}
      />
    );
  } else if (field.type === 'enum') {
    control = <Segmented label={L(field.label, lang)} value={String(value)} onChange={onChange} options={(field.options ?? []).map((o) => ({ value: o.value, label: o.hint && field.key === 'fontSize' ? `${o.label[lang]} (${o.hint})` : o.label[lang] }))} />;
  } else if (field.type === 'boolean') {
    control = <Toggle checked={value === true} onChange={onChange} label={L(field.label, lang)} />;
  } else if (field.type === 'multi-enum') {
    const list = Array.isArray(value) ? value.map(String) : [];
    control = (
      <div role="group" aria-label={L(field.label, lang)} className="flex flex-wrap gap-2">
        {(field.options ?? []).map((o) => {
          const on = list.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? list.filter((x) => x !== o.value) : [...list, o.value])}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-13 font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                on ? 'border-primary bg-primary/10 dark:bg-primary/15' : 'border-border text-muted-foreground',
              )}
            >
              {on ? <CheckIcon className="size-4" aria-hidden /> : null}
              {o.label[lang]}
            </button>
          );
        })}
      </div>
    );
  } else {
    control = (
      <input
        id={id}
        type="color"
        value={String(value || '#2e7a82')}
        onChange={(e) => onChange(e.target.value)}
        aria-label={L(field.label, lang)}
        className="h-11 w-20 cursor-pointer rounded-lg border border-input bg-background p-1"
      />
    );
  }

  return (
    <div className={cn('grid gap-3 py-4', !wide && 'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6')}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-14 font-semibold">
          {L(field.label, lang)}
          {field.proposalId ? <Pill tone="violet">{`${t.badge.proposed} ${field.proposalId}`}</Pill> : null}
        </p>
        <p className="mt-0.5 text-13 text-muted-foreground">{L(field.help, lang)}</p>
        {field.note ? <p className="mt-0.5 text-12 text-muted-foreground">{L(field.note, lang)}</p> : null}
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  );
}

function PreviewPanel() {
  const { state, t } = useSettings();
  const p = state.prefs;
  const color = p.colorTheme === 'custom' ? String(p.customColor || '#2e7a82') : (PREFERENCES[0].fields.find((f) => f.key === 'colorTheme')?.options?.find((o) => o.value === p.colorTheme)?.hint ?? '#2e7a82');
  const size = { sm: 13, base: 15, lg: 17, xl: 19 }[String(p.fontSize) as 'sm'] ?? 15;
  const row = { comfortable: 'py-3', standard: 'py-2', compact: 'py-1' }[String(p['tableSettings.density']) as 'standard'] ?? 'py-2';
  const dark = p.theme === 'dark';
  const sidebar = p.sidebarCustomBg ? String(p.sidebarBgColor) : dark ? '#0f1b33' : '#e8ecf2';
  return (
    <Card className="overflow-hidden lg:sticky lg:top-6" aria-label={t.prefs.preview}>
      <p className="border-b border-border px-4 py-2.5 text-12 font-bold text-muted-foreground">{t.prefs.preview}</p>
      <div className={cn('flex h-64', dark ? 'bg-[#1f2937] text-white' : 'bg-white text-slate-900')} style={{ fontFamily: String(p.fontFamily), fontSize: size }} aria-hidden>
        {p.layout !== 'no-sidebar' ? (
          <div className={cn('flex flex-col gap-2 p-3', p.layout === 'compact' ? 'w-10' : 'w-20')} style={{ background: sidebar }}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="h-2 rounded-full" style={{ background: i === 1 ? color : 'rgba(127,127,127,.35)' }} />
            ))}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 p-3">
          <p className="font-bold" style={{ fontSize: size + 1 }}>
            {t.prefs.previewTitle}
          </p>
          <div className="mt-2 overflow-hidden rounded-md border border-current/10">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className={cn('flex items-center justify-between gap-2 px-2', row, p['tableSettings.striped'] && i % 2 ? (dark ? 'bg-white/5' : 'bg-slate-100') : '')}
                style={{ fontSize: size - 2 }}
              >
                <span className="truncate">{t.prefs.previewRow}</span>
                <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
              </div>
            ))}
          </div>
          <span className="mt-3 inline-block rounded-md px-3 py-1 text-white" style={{ background: color, fontSize: size - 2 }}>
            {t.prefs.sampleText}
          </span>
        </div>
      </div>
    </Card>
  );
}
