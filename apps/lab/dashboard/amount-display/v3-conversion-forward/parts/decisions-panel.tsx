import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Switch } from '@dash/components/ui/switch';
import { messages } from '../i18n';
import { Amount } from './amount';
import { DEFAULT_DECISIONS, EnvContext, useEnv, type Decisions } from './env';

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg border bg-muted/60 p-0.5">
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={v === value}
          onClick={() => onChange(v)}
          className={cn(
            'min-h-11 rounded-md px-2.5 text-11 font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:min-h-8',
            v === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span dir="auto">{text}</span>
        </button>
      ))}
    </div>
  );
}

/** Floating, collapsible, state-driven: it changes the whole page live and persists nothing. */
export function DecisionsPanel({ value, onChange }: { value: Decisions; onChange: (d: Decisions) => void }) {
  const t = useT(messages);
  const lang = useLocale();
  const env = useEnv();
  const [open, setOpen] = useState(false);
  const set = <K extends keyof Decisions>(k: K, v: Decisions[K]) => onChange({ ...value, [k]: v });
  const changed = (Object.keys(DEFAULT_DECISIONS) as Array<keyof Decisions>).filter((k) => DEFAULT_DECISIONS[k] !== value[k]).length;
  // The previews use the panel's own pending values, whatever the page shows.
  const preview = { ...env, dec: value };

  const q = (n: string, title: string, children: React.ReactNode, sample?: React.ReactNode) => (
    <div className="space-y-1.5 border-b py-3 last:border-b-0">
      <p className="text-12 font-bold">
        <span className="me-1.5 inline-flex size-4.5 items-center justify-center rounded bg-muted text-10">{n}</span>
        {title}
      </p>
      {children}
      {sample && <div className="text-13 text-muted-foreground">{sample}</div>}
    </div>
  );

  return (
    <div className="fixed bottom-3 end-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2" data-testid="decisions-panel">
      {open && (
        <div
          id="decisions-body"
          className="max-h-[70dvh] w-[22rem] max-w-full overflow-y-auto rounded-2xl border bg-popover p-4 text-popover-foreground shadow-2xl"
          role="region"
          aria-label={t.decTitle}
        >
          <p className="text-13 font-bold">{t.decTitle}</p>
          <p className="mb-1 text-11 text-muted-foreground">{t.decLead}</p>
          <EnvContext.Provider value={preview}>
            {q('a', t.decA, <Seg label={t.decA} value={value.arNegative} onChange={(v) => set('arNegative', v)} options={[['leading', t.decALeading], ['trailing', t.decATrailing]]} />, <Amount value="-1250" currency="SAR" context="detail" plain noTrigger />)}
            {q('b', t.decB, <Seg label={t.decB} value={value.axis} onChange={(v) => set('axis', v)} options={[['ltr', t.decBLtr], ['rtl', t.decBRtl]]} />, <span className="text-11">{lang === 'ar' ? t.decBOnlyAr : ''}</span>)}
            {q('c', t.decC, <Seg label={t.decC} value={value.multiSign} onChange={(v) => set('multiSign', v)} options={[['auto', t.decCAuto], ['sign', t.decCSign], ['code', t.decCCode]]} />, <span className="inline-flex gap-4"><Amount value="1250" currency="USD" context="table" multi noTrigger /><Amount value="480" currency="TRY" context="table" multi noTrigger /></span>)}
            {q(
              'd',
              t.decD,
              <label className="flex min-h-11 items-center gap-2 text-12 sm:min-h-8">
                <Switch checked={value.approx} onCheckedChange={(v) => set('approx', v)} aria-label={t.decD} />
                <span>{value.approx ? t.decDOn : t.decDOff}</span>
              </label>,
              <span dir="ltr" className="inline-flex items-baseline gap-1">{value.approx && <span aria-hidden>≈</span>}<Amount value="4687.5" currency="SAR" context="detail" plain noTrigger /></span>,
            )}
            {q('e', t.decE, <Seg label={t.decE} value={value.box} onChange={(v) => set('box', v)} options={[[0.725, '0.725em'], [0.8, '0.8em']]} />, <span className="text-lg font-black"><Amount value="1250" currency="SAR" context="inline" plain noTrigger /></span>)}
          </EnvContext.Provider>
          <button type="button" onClick={() => onChange(DEFAULT_DECISIONS)} className="mt-2 min-h-11 text-12 font-bold text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:min-h-8">
            {t.decReset}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="decisions-body"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-primary px-4 text-13 font-bold text-primary-foreground shadow-lg outline-none transition-transform focus-visible:ring-[3px] focus-visible:ring-ring/60 motion-safe:hover:-translate-y-0.5"
      >
        <SlidersHorizontal className="size-4" />
        {t.decTitle}
        {changed > 0 && <span className="rounded-full bg-primary-foreground px-1.5 text-11 text-primary">{changed}</span>}
        <ChevronDown className={cn('size-4 transition-transform', open ? '' : 'rotate-180')} />
      </button>
    </div>
  );
}
