import { Check } from 'lucide-react';
import { cn } from '@lab/utils';
import type { T } from '../i18n';

/** A 1px line with 24px discs: done = teal disc + ink check, current = navy disc + numeral, upcoming = outline. */
export function Stepper({ t, current }: { t: T; current: 0 | 3 }) {
  return (
    <nav aria-label={t.steps.label}>
      <p className="mb-2 text-sm font-semibold text-(--ink-muted) md:hidden">
        {t.steps.of(current + 1)} · <span className="text-(--brand-ink)">{t.steps.items[current]}</span>
      </p>
      <ol className="flex items-center">
        {t.steps.items.map((label, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li key={label} className={cn('flex min-w-0 items-center', i < 3 && 'flex-1')} aria-current={now ? 'step' : undefined}>
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold',
                    done && 'bg-(--action) text-(--highlight-foreground)',
                    now && 'bg-(--brand) text-(--brand-foreground)',
                    !done && !now && 'border border-(--border-strong) text-(--ink-muted)',
                  )}
                >
                  {done ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : i + 1}
                  <span className="sr-only">{done ? ` ${t.steps.done}` : now ? ` ${t.steps.current}` : ''}</span>
                </span>
                <span
                  className={cn(
                    'hidden truncate text-sm md:inline',
                    now ? 'font-bold text-(--brand-ink)' : done ? 'font-semibold text-(--foreground)' : 'text-(--ink-muted)',
                  )}
                >
                  {label}
                </span>
                <span className="sr-only md:hidden">{label}</span>
              </span>
              {i < 3 && <span aria-hidden className={cn('mx-3 h-px min-w-4 flex-1', done ? 'bg-(--action)' : 'bg-(--border-strong)')} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
