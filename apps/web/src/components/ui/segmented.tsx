'use client';

/**
 * @file segmented.tsx
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/segmented.tsx. Contract: apps/web/README.md.
 */
import { focusRingInset } from '@/components/cards/meta';
import { Ltr } from '@/components/common/text';
import { num } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { useRoving } from '@/lib/roving';
import { cn } from '@/lib/utils';

/**
 * One choice out of a few views of the same list (Open / Decided / All, By status / By role). Selected is neutral
 * `foreground` (kit colour rule), and `count` is a number after the word. 44 px on phones. One Tab stop: the arrow keys move
 * inside it, in reading direction.
 */
export function Segmented<V extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  /** Accessible name of the group. */
  label: string;
  value: V;
  options: { value: V; label: string; count?: number | undefined }[];
  onChange: (value: V) => void;
  className?: string | undefined;
}) {
  const locale = useLocale();
  const { root, groupProps, itemProps } = useRoving(options.findIndex((o) => o.value === value));
  return (
    <div
      ref={root}
      role="toolbar"
      aria-label={label}
      {...groupProps}
      className={cn(
        'inline-flex max-w-full shrink-0 overflow-x-auto rounded-md border border-border bg-card [scrollbar-width:none] md:p-0.5',
        className,
      )}
    >
      {options.map((option, i) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            {...itemProps(i)}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-sm px-3 text-body-sm md:min-w-0 font-medium whitespace-nowrap transition-colors duration-120 md:h-7.5',
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              focusRingInset,
            )}
          >
            {option.label}
            {option.count !== undefined && <Ltr className="tabular-nums">{num(option.count, locale)}</Ltr>}
          </button>
        );
      })}
    </div>
  );
}
