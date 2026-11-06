import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useLocale } from '@lab/i18n';
import { cn, focusRing } from './kit';
import { Tip, type TipFact } from './tips';

interface ResizerProps {
  axis: 'x' | 'y';
  value: number;
  min: number;
  max: number;
  /** Double-click and Enter go back here. */
  fallback: number;
  onChange: (value: number) => void;
  onDragging?: (dragging: boolean) => void;
  label: string;
  /** Real values for the tooltip. */
  facts?: TipFact[];
  className?: string;
}

const STEP = 24;

/**
 * The one drag handle. It grows the pane at its inline end (x) or below it (y), so dragging follows the pointer in RTL and LTR alike.
 * It is a focusable separator: arrows resize, Home and End go to the limits, Enter resets. Neutral at rest: a grip, never a coloured edge.
 */
export function Resizer({ axis, value, min, max, fallback, onChange, onDragging, label, facts, className }: ResizerProps) {
  const rtl = useLocale() === 'ar';
  const start = useRef<{ at: number; size: number } | null>(null);
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { at: axis === 'x' ? e.clientX : e.clientY, size: value };
    onDragging?.(true);
    document.documentElement.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const delta = (axis === 'x' ? e.clientX : e.clientY) - start.current.at;
    const grow = axis === 'x' ? (rtl ? delta : -delta) : -delta;
    onChange(clamp(start.current.size + grow));
  };
  const up = () => {
    if (!start.current) return;
    start.current = null;
    onDragging?.(false);
    document.documentElement.style.cursor = '';
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const grow = axis === 'x' ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp';
    const shrink = axis === 'x' ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown';
    const next = e.key === grow ? value + STEP : e.key === shrink ? value - STEP : e.key === 'Home' ? min : e.key === 'End' ? max : e.key === 'Enter' ? fallback : null;
    if (next === null) return;
    e.preventDefault();
    onChange(clamp(next));
  };

  return (
    <Tip k="resize" side={rtl ? 'right' : 'left'} facts={facts} keys={['←', '→', 'Home', 'End', 'Enter']}>
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      data-wb-resizer
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDoubleClick={() => onChange(clamp(fallback))}
      onKeyDown={key}
      className={cn('group relative z-20 flex shrink-0 touch-none items-center justify-center outline-none select-none', axis === 'x' ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize', focusRing, className)}
    >
      <span aria-hidden className={cn('rounded-full bg-border transition-colors duration-120 group-hover:bg-muted-foreground group-focus-visible:bg-foreground', axis === 'x' ? 'h-10 w-1' : 'h-1 w-10')} />
    </div>
    </Tip>
  );
}
