/**
 * The currency sign painted as a CSS mask in `currentColor` (plan 5.4): follows the text colour and dark mode, never mirrors,
 * costs ~50 bytes per element because the SVG lives once per currency in a <style> rule (`SignStyles`).
 *
 * Metrics (SAMA font guide + own Cairo measurement, research section 0.4): the SAR box is 0.725em tall, sits -0.055em below the baseline
 * and is 0.649em wide (aspect of the official SVG). Signs traced from Cairo keep their font metrics. `scale` is the owner question (e).
 */
import type { CSSProperties } from 'react';
import { cn } from '@lab/utils';
import { SIGN_SVGS } from './sign-data';

interface Metrics {
  /** Box height in em of the surrounding font size. */
  h: number;
  /** vertical-align in em (negative = below the baseline). */
  va: number;
}

const METRICS: Record<string, Metrics> = {
  SAR: { h: 0.725, va: -0.055 },
  AED: { h: 0.68, va: -0.01 },
  OMR: { h: 0.5, va: 0 },
  TRY: { h: 0.72, va: -0.04 },
  EUR: { h: 0.7, va: -0.015 },
  USD: { h: 0.902, va: -0.124 },
  GBP: { h: 0.67, va: 0 },
};

/** The default SAR box; the owner can pick 0.8em (question e). */
export const SIGN_BASE = 0.725;

export const hasSign = (code: string) => code in SIGN_SVGS;

/** One rule per currency, injected once: `.cur-sign[data-cur="SAR"] { --cur-sign: url(...) }`. */
export function SignStyles() {
  const rules = Object.entries(SIGN_SVGS)
    .map(([code, { svg }]) => `.cur-sign[data-cur="${code}"]{--cur-sign:url("data:image/svg+xml,${encodeURIComponent(svg)}")}`)
    .join('\n');
  return (
    <style>{`
.cur-sign{display:inline-block;flex:none;background-color:currentColor;-webkit-mask:var(--cur-sign) center/contain no-repeat;mask:var(--cur-sign) center/contain no-repeat;print-color-adjust:exact;-webkit-print-color-adjust:exact}
@media (forced-colors:active){.cur-sign{background-color:CanvasText}}
${rules}`}</style>
  );
}

export interface SignProps {
  code: string;
  /** 1 = the metrics above. 0.8 / 0.725 = the owner's question (e) applied to every sign. */
  scale?: number;
  /** Gap after the sign in em (default 0.25 = SAMA rule 2). */
  gap?: number;
  /** Only for the "wrong" examples of the sign lab. */
  mirror?: boolean;
  className?: string;
}

/** `aria-hidden`: the amount carries one aria-label. */
export function CurrencySign({ code, scale = 1, gap = 0.25, mirror = false, className }: SignProps) {
  const entry = SIGN_SVGS[code];
  if (!entry) return null;
  const m = METRICS[code] ?? METRICS.SAR;
  const h = m.h * scale;
  const w = (h * entry.vb[2]) / entry.vb[3];
  const style: CSSProperties = {
    width: `${w}em`,
    height: `${h}em`,
    verticalAlign: `${m.va * scale}em`,
    marginInlineEnd: `${gap}em`,
    transform: mirror ? 'scaleX(-1)' : undefined,
  };
  return <span aria-hidden data-cur={code} className={cn('cur-sign', className)} style={style} />;
}
