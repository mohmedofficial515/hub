import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocale, useT } from '@lab/i18n';
import type { RunHour } from '@lab/mocks/hub-app/settings';
import { cn, focusRing, Ltr, num, plural } from '../../../kit';
import { messages } from '../i18n';

/** Calm settings layout: what this group is about on the start side, its fields on the end side. A phone stacks them. */
export function FormSection({ title, description, children, className }: { title: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('grid gap-x-10 gap-y-3 border-t border-border pt-6 lg:grid-cols-[15rem_minmax(0,1fr)]', className)}>
      <div className="min-w-0">
        <h3 id={id} className="text-body-lg font-semibold text-foreground">
          {title}
        </h3>
        {description && <p className="mt-1 text-body-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex max-w-2xl min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/** A small set of exclusive choices. Real radios underneath; the checked one is `foreground`, never the primary. */
export function Segmented<T extends string>({ legend, value, options, onChange, disabled = false, className }: { legend: string; value: T; options: { value: T; label: string }[]; onChange: (next: T) => void; disabled?: boolean; className?: string }) {
  const name = useId();
  return (
    <fieldset disabled={disabled} className={cn('min-w-0', className)}>
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex max-w-full rounded-md border border-border bg-muted p-0.5">
        {options.map((option) => (
          <label key={option.value} className="relative cursor-pointer has-disabled:cursor-not-allowed">
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="peer absolute inset-0 size-full cursor-[inherit] opacity-0" />
            <span
              className={cn(
                'flex h-11 items-center rounded-[calc(var(--radius-md)-2px)] px-3 text-body-sm font-medium whitespace-nowrap transition-colors duration-120 peer-focus-visible:ring-2 peer-focus-visible:ring-ring md:h-7.5',
                value === option.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const TICK: Record<RunHour, string> = {
  ok: 'h-2.5 bg-success',
  partial: 'h-4 bg-warning',
  failed: 'h-6 bg-destructive',
  idle: 'h-1 bg-border',
};

/**
 * The last 24 hours of a source, one tick per hour, earlier at the start and now at the end. A failed hour is taller as
 * well as red, so the shape reads without colour, and the name says the same in words.
 */
export function RunStrip({ hours, showLegend = false, className }: { hours: RunHour[]; showLegend?: boolean; className?: string }) {
  const t = useT(messages);
  const locale = useLocale();
  const count = (s: RunHour) => hours.filter((h) => h === s).length;
  const parts = [
    count('ok') && plural(count('ok'), locale, t.strip.ok),
    count('partial') && plural(count('partial'), locale, t.strip.partial),
    count('failed') && plural(count('failed'), locale, t.strip.failed),
    count('idle') && plural(count('idle'), locale, t.strip.idle),
  ].filter(Boolean);
  return (
    <div className={cn('min-w-0', className)}>
      <div role="img" aria-label={`${t.strip.label}: ${parts.join(locale === 'ar' ? '، ' : ', ')}`} className="flex h-6 items-end gap-px">
        {hours.map((h, i) => (
          <span key={i} aria-hidden className={cn('min-w-0 flex-1 rounded-[1px]', TICK[h])} />
        ))}
      </div>
      {showLegend && (
        <div aria-hidden className="mt-1 flex justify-between text-caption text-muted-foreground">
          <span>{t.strip.start}</span>
          <span>{t.strip.now}</span>
        </div>
      )}
    </div>
  );
}

const SIZES = ['B', 'KB', 'MB', 'GB', 'TB'];
/** "18.4 GB" as an LTR isolate. Units stay Latin in both languages, as on the rest of the team's tools. */
export function Bytes({ value, className }: { value: number; className?: string }) {
  const locale = useLocale();
  const power = Math.min(SIZES.length - 1, Math.floor(Math.log10(Math.max(1, value)) / 3));
  const scaled = value / 10 ** (power * 3);
  return <Ltr className={className}>{`${num(Math.round(scaled * 10) / 10, locale)} ${SIZES[power]}`}</Ltr>;
}

/** Stands in for a request: busy for a moment, then the result. Cleans up if the page goes away. */
export function useFakeRequest(ms = 900) {
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const run = (id: string, done: () => void) => {
    setBusy(id);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setBusy(null);
      done();
    }, ms);
  };
  return { busy, run };
}

/** j/k focus for rows that are not cards. Plain `<tr>`s take an outline where a box-shadow ring would be clipped. */
export const rowFocus = 'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring';

/** A plain link that looks like the other small actions, for "see more" inside a form. */
export const inlineLink = cn('hit-44 rounded-sm text-primary-text underline-offset-4 hover:underline', focusRing);
