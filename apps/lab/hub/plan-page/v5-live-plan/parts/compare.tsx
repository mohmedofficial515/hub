import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { ChevronsLeftRight } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { messages } from '../i18n';

/**
 * Before and after on one frame. The after image covers the before one from the page's start edge up to the handle; drag anywhere
 * on the frame or the handle, or focus the handle and use the arrows (Home and End go to the ends). On first show the handle
 * sweeps from the start to the middle, so the change is seen once without touching anything (a fixed middle under reduced motion).
 */
export function Compare({ before, after, beforeAlt, afterAlt }: { before: string; after: string; beforeAlt: string; afterAlt: string }) {
  const t = useT(messages);
  const locale = useLocale();
  const rtl = locale === 'ar';
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(reduce ? 50 : 0);
  const dragging = useRef(false);

  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, 50, { duration: 1.1, delay: 0.35, ease: [0.2, 0.7, 0.2, 1], onUpdate: setP });
    return () => controls.stop();
  }, [reduce, before, after]);

  const fromPointer = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    const raw = rtl ? (r.right - clientX) / r.width : (clientX - r.left) / r.width;
    setP(Math.min(100, Math.max(0, raw * 100)));
  };
  const down = (e: PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    fromPointer(e.clientX);
  };
  const move = (e: PointerEvent) => dragging.current && fromPointer(e.clientX);
  const up = () => {
    dragging.current = false;
  };
  const key = (e: KeyboardEvent) => {
    const more = rtl ? 'ArrowLeft' : 'ArrowRight';
    const less = rtl ? 'ArrowRight' : 'ArrowLeft';
    const step = e.shiftKey ? 10 : 2;
    let next: number | null = null;
    if (e.key === more || e.key === 'ArrowUp') next = p + step;
    else if (e.key === less || e.key === 'ArrowDown') next = p - step;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 100;
    if (next === null) return;
    e.preventDefault();
    setP(Math.min(100, Math.max(0, next)));
  };
  const clip = rtl ? `inset(0 0 0 ${100 - p}%)` : `inset(0 ${100 - p}% 0 0)`;

  return (
    <figure className="flex min-w-0 flex-col gap-1.5">
      <div ref={box} className="ps-compare" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img src={before} alt={beforeAlt} draggable={false} />
        <div className="ps-compare-top" style={{ clipPath: clip }}>
          <img src={after} alt={afterAlt} draggable={false} />
        </div>
        <span className="ps-compare-tag" style={{ insetInlineStart: '0.5rem' }}>
          {t.after}
        </span>
        <span className="ps-compare-tag" style={{ insetInlineEnd: '0.5rem' }}>
          {t.before}
        </span>
        <div
          role="slider"
          tabIndex={0}
          aria-label={t.compareLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(p)}
          aria-valuetext={`${t.after} ${Math.round(p)}%`}
          onKeyDown={key}
          className="ps-compare-handle"
          style={{ insetInlineStart: `${p}%` }}
        >
          <span className="ps-compare-knob" aria-hidden>
            <ChevronsLeftRight className="size-4" strokeWidth={2} />
          </span>
        </div>
      </div>
      <figcaption className="text-caption text-muted-foreground">{t.compareHint}</figcaption>
    </figure>
  );
}
