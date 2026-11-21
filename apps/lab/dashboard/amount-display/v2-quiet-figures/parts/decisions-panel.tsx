/**
 * Floating, collapsible panel with the five open design questions (plan 15.0). Every toggle changes the whole page live.
 * State lives in `LabProvider`; nothing is persisted.
 */
import { useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@lab/utils';
import { AmountView, Equivalent } from './amount';
import { useLab, type Decisions } from './env';

function Question<K extends keyof Decisions>({
  k,
  options,
  preview,
}: {
  k: K;
  options: { value: Decisions[K]; label: string; recommended?: boolean }[];
  preview: ReactNode;
}) {
  const { t, decisions, setDecision } = useLab();
  const q = t.decisions.q[k as 'negative'];
  return (
    <fieldset className="grid gap-2 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
      <legend className="float-start mb-2 w-full text-13 font-bold">{q.title}</legend>
      <div role="radiogroup" aria-label={q.title} className="grid w-full grid-cols-2 gap-1.5 rounded-lg bg-muted p-1">
        {options.map((o) => {
          const on = decisions[k] === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setDecision(k, o.value)}
              className={cn(
                'min-h-11 rounded-md px-2 text-start text-12 font-semibold leading-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-10',
                on ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <bdi dir="ltr" className="block text-14 font-bold">
                {o.label}
              </bdi>
              {o.recommended && <span className="text-10 font-medium opacity-80">{t.decisions.recommended}</span>}
            </button>
          );
        })}
      </div>
      <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-3 py-1.5 text-15 font-semibold">{preview}</div>
      <p className="text-11 leading-relaxed text-muted-foreground">{q.note}</p>
    </fieldset>
  );
}

export function DecisionsPanel() {
  const lab = useLab();
  const { t, resetDecisions } = lab;
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-none fixed bottom-3 end-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2">
      {open && (
        <motion.section
          aria-label={t.decisions.title}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-auto grid max-h-[min(78dvh,720px)] w-[min(24rem,calc(100vw-1.5rem))] gap-3 overflow-y-auto rounded-2xl border bg-popover p-4 text-popover-foreground shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-14 font-extrabold">{t.decisions.title}</h2>
            <div className="flex items-center gap-1">
              <button type="button" onClick={resetDecisions} aria-label={t.decisions.reset} title={t.decisions.reset} className="flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:size-9">
                <RotateCcw className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label={t.decisions.close} className="flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:size-9">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          <p className="text-12 text-muted-foreground">{t.decisions.lead}</p>

          <Question
            k="negative"
            options={[
              { value: 'sign-first', label: '⃁ -1,250.00', recommended: true },
              { value: 'sama-ar', label: '⃁ 1,250.00-' },
            ]}
            preview={<AmountView value="-1250.00" currency="SAR" context="detail" />}
          />
          <Question
            k="axis"
            options={[
              { value: 'ltr', label: 'LTR →', recommended: true },
              { value: 'rtl', label: '← RTL' },
            ]}
            preview={<span className="text-12 font-medium text-muted-foreground">{t.decisions.axisPreview}</span>}
          />
          <Question
            k="dollar"
            options={[
              { value: 'sign', label: '$', recommended: true },
              { value: 'code', label: 'USD' },
            ]}
            preview={
              <>
                <AmountView value="12450.75" currency="USD" context="table" mixed />
                <AmountView value="4687.50" currency="AED" context="table" mixed />
              </>
            }
          />
          <Question
            k="approx"
            options={[
              { value: true, label: '≈ on', recommended: true },
              { value: false, label: '≈ off' },
            ]}
            preview={<Equivalent value="4687.50" currency="SAR" />}
          />
          <Question
            k="signBox"
            options={[
              { value: 0.725, label: '0.725em', recommended: true },
              { value: 0.8, label: '0.8em' },
            ]}
            preview={
              <span className="text-26 font-black">
                <AmountView value="1250.00" currency="SAR" context="detail" />
              </span>
            }
          />
        </motion.section>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-13 font-bold text-primary-foreground shadow-lg outline-none transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {t.decisions.button}
      </button>
    </div>
  );
}
