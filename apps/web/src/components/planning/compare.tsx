'use client';

/**
 * @file compare.tsx
 * @description Before and after on one frame (v5-live-plan, batch 3). The after image covers the before one from the page's start edge up to the
 * handle. Drag anywhere on the frame, or focus the handle and use the arrows in reading direction (Shift for bigger steps, Home and End for the
 * ends). On first show the handle sweeps from the start to the middle, so the change is seen once without touching anything; under reduced
 * motion it sits at the middle.
 */
import { animate, useReducedMotion } from 'framer-motion';
import { ChevronsLeftRight } from 'lucide-react';
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react';

import { fmt, focusRing, useLocale, useT } from '@/components/kit';

import type { PlanningMessages } from './messages';

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** The handle's next place for a key, or null for a key it does not take. `more` is the key that shows more of the after image. */
export function compareKey(key: string, shift: boolean, at: number, rtl: boolean): number | null {
  const more = rtl ? 'ArrowLeft' : 'ArrowRight';
  const less = rtl ? 'ArrowRight' : 'ArrowLeft';
  const step = shift ? 10 : 2;
  if (key === more || key === 'ArrowUp') return clamp(at + step);
  if (key === less || key === 'ArrowDown') return clamp(at - step);
  if (key === 'Home') return 0;
  if (key === 'End') return 100;
  return null;
}

export function Compare({
  before,
  after,
  beforeAlt,
  afterAlt,
}: {
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
}) {
  const e = useT<PlanningMessages>('planning').detail.evidence;
  const locale = useLocale();
  const rtl = locale === 'ar';
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(reduce ? 50 : 0);
  const dragging = useRef(false);
  const touched = useRef(false);

  useEffect(() => {
    touched.current = false;
    if (reduce) {
      setP(50);
      return;
    }
    const controls = animate(0, 50, {
      duration: 1.1,
      delay: 0.35,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => !touched.current && setP(v),
    });
    return () => controls.stop();
  }, [reduce, before, after]);

  const fromPointer = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const raw = rtl ? (r.right - clientX) / r.width : (clientX - r.left) / r.width;
    touched.current = true;
    setP(clamp(raw * 100));
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    fromPointer(event.clientX);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) fromPointer(event.clientX);
  };
  const up = () => {
    dragging.current = false;
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = compareKey(event.key, event.shiftKey, p, rtl);
    if (next === null) return;
    event.preventDefault();
    touched.current = true;
    setP(next);
  };
  const clip = rtl ? `inset(0 0 0 ${100 - p}%)` : `inset(0 ${100 - p}% 0 0)`;
  const shown = Math.round(p);

  return (
    <figure className="flex min-w-0 flex-col gap-1.5">
      <div
        ref={box}
        data-pj-compare
        className="pj-compare"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <img src={before} alt={beforeAlt} draggable={false} />
        <div className="pj-compare-top" style={{ clipPath: clip }}>
          <img src={after} alt={afterAlt} draggable={false} />
        </div>
        <span aria-hidden className="pj-compare-tag" style={{ insetInlineStart: '0.5rem' }}>
          {e.after}
        </span>
        <span aria-hidden className="pj-compare-tag" style={{ insetInlineEnd: '0.5rem' }}>
          {e.before}
        </span>
        <div
          role="slider"
          tabIndex={0}
          aria-label={e.compareLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={shown}
          aria-valuetext={fmt(e.compareValue, { p: String(shown) })}
          aria-orientation="horizontal"
          onKeyDown={key}
          className={`pj-compare-handle ${focusRing}`}
          style={{ insetInlineStart: `${p}%` }}
        >
          <span className="pj-compare-knob" aria-hidden>
            <ChevronsLeftRight className="size-4" strokeWidth={2} />
          </span>
        </div>
      </div>
      <figcaption className="text-caption text-muted-foreground">{e.compareHint}</figcaption>
    </figure>
  );
}
