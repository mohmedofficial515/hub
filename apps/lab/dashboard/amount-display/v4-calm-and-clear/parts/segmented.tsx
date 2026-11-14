/**
 * A radio group that behaves like one (APG): roving tabindex (only the selected item is a tab stop), arrow keys move AND select,
 * Home / End jump, the arrows follow the reading direction (ArrowLeft is "next" in RTL). Used by every segmented control of the page.
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface SegmentedOption<T> {
  value: T;
  content: ReactNode;
  /** Optional accessible name when the visible content is not enough. */
  label?: string;
}

export function Segmented<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange,
  className,
  itemClassName,
}: {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  className?: string;
  itemClassName: (selected: boolean) => string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(0, options.findIndex((o) => o.value === value));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    let next = -1;
    const cur = refs.current.findIndex((el) => el === document.activeElement);
    const from = cur === -1 ? selected : cur;
    if (e.key === 'ArrowRight') next = from + (rtl ? -1 : 1);
    else if (e.key === 'ArrowLeft') next = from + (rtl ? 1 : -1);
    else if (e.key === 'ArrowDown') next = from + 1;
    else if (e.key === 'ArrowUp') next = from - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    else return;
    e.preventDefault();
    next = (next + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].value);
  };

  return (
    <div role="radiogroup" aria-label={label} className={className} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === selected}
          aria-label={o.label}
          tabIndex={i === selected ? 0 : -1}
          onClick={() => onChange(o.value)}
          className={itemClassName(i === selected)}
        >
          {o.content}
        </button>
      ))}
    </div>
  );
}
