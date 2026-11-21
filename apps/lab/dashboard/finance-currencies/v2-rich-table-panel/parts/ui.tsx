import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Pin } from 'lucide-react';
import { parseDec } from '@lab/mocks/currencies';
import { cn } from '@lab/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@dash/components/ui/tooltip';
import { fmtPct } from './derive';

/** Numbers, codes and rates stay LTR and isolated inside RTL text. */
export function Ltr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={cn('tabular-nums [unicode-bidi:isolate]', className)}>
      {children}
    </bdi>
  );
}

export function Tip({ label, children, side }: { label: ReactNode; children: ReactNode; side?: 'top' | 'bottom' }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side ?? 'top'} sideOffset={6} className="max-w-64 text-start">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'primary' | 'outline';

const TONE: Record<Tone, string> = {
  success: 'bg-success/12 text-success-soft-foreground',
  warning: 'bg-warning/20 text-warning-soft-foreground',
  danger: 'bg-destructive/12 text-destructive-soft-foreground',
  info: 'bg-info/12 text-info-soft-foreground',
  muted: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary-text',
  outline: 'border border-border text-foreground',
};

export function Pill({
  tone = 'muted',
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-12 font-semibold [&_svg]:size-3.5',
        TONE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Signed, LTR-isolated percent with an arrow so direction never relies on colour alone. */
export function Change({ pct, className }: { pct: number; className?: string }) {
  const dir = pct > 0.0049 ? 'up' : pct < -0.0049 ? 'down' : 'flat';
  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-13 font-bold',
        dir === 'up' && 'text-success-soft-foreground',
        dir === 'down' && 'text-destructive-soft-foreground',
        dir === 'flat' && 'text-muted-foreground',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <Ltr>{fmtPct(dir === 'flat' ? 0 : pct)}</Ltr>
    </span>
  );
}

/** Time flows left to right even in RTL, so the sparkline never mirrors. */
export function Sparkline({
  values,
  width = 64,
  height = 24,
  dir,
  label,
  className,
}: {
  values: string[];
  width?: number;
  height?: number;
  dir: 'up' | 'down' | 'flat';
  label?: string;
  className?: string;
}) {
  const nums = values.map((v) => Number(parseDec(v)) / 1e8);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const pad = 3;
  const pts = nums.map((n, i) => {
    const x = pad + (i / Math.max(1, nums.length - 1)) * (width - pad * 2);
    const y = max === min ? height / 2 : pad + (1 - (n - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const color = dir === 'up' ? 'var(--success)' : dir === 'down' ? 'var(--destructive)' : 'var(--muted-foreground)';
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('shrink-0 overflow-visible', className)}
      direction="ltr"
    >
      <path d={d} fill="none" stroke={color} strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" />
      {last && <circle cx={last[0]} cy={last[1]} r="2.400" fill={color} />}
    </svg>
  );
}

/**
 * Spread bar: the track spans ±5% around the raw rate (centre tick). The dot is the effective rate, a pin
 * replaces it when a manual override holds the rate, and it turns red when it leaves the track.
 */
export function SpreadBar({
  spreadPct,
  pinned,
  className,
}: {
  spreadPct: number;
  pinned?: boolean;
  className?: string;
}) {
  const range = 5;
  const out = Math.abs(spreadPct) > range;
  const x = 50 + Math.max(-1, Math.min(1, spreadPct / range)) * 50;
  return (
    <span dir="ltr" aria-hidden className={cn('relative block h-3 w-24', className)}>
      <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
      <span className="absolute inset-y-0 start-1/2 w-px -translate-x-1/2 bg-muted-foreground/60" />
      {spreadPct !== 0 && (
        <span
          className={cn('absolute top-1/2 h-1 -translate-y-1/2 rounded-full', out ? 'bg-destructive/50' : 'bg-primary/40')}
          style={{ left: `${Math.min(50, x)}%`, width: `${Math.abs(x - 50)}%` }}
        />
      )}
      <span
        className={cn(
          'absolute top-1/2 grid size-3 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ring-2 ring-card',
          out ? 'bg-destructive' : 'bg-primary',
        )}
        style={{ left: `${x}%` }}
      >
        {pinned && <Pin className="size-2 fill-current text-primary-foreground" />}
      </span>
    </span>
  );
}
