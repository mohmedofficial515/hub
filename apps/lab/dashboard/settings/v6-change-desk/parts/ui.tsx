// Small version-local primitives: buttons, badges, tips, icon tiles, segmented radio group, avatar.
import { forwardRef, useRef, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from 'react';
import {
  BadgePercent,
  BarChart3,
  Bell,
  BellRing,
  BookOpenCheck,
  Coins,
  Construction,
  CreditCard,
  Database,
  EyeOff,
  FileCheck2,
  Gavel,
  Gift,
  Globe,
  Hourglass,
  KeyRound,
  Landmark,
  ListChecks,
  Luggage,
  MessageCircle,
  Palette,
  Plane,
  PlugZap,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  ShieldX,
  Smartphone,
  Table2,
  Undo2,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  type LucideProps,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@dash/components/ui/tooltip';
import { cn } from '@dash/lib/utils';
import { initials } from './format';

const ICONS: Record<string, ComponentType<LucideProps>> = {
  BadgePercent, BarChart3, Bell, BellRing, BookOpenCheck, Coins, Construction, CreditCard, Database, EyeOff, FileCheck2, Gavel, Gift, Globe,
  Hourglass, KeyRound, Landmark, ListChecks, Luggage, MessageCircle, Palette, Plane, PlugZap, Scale, ScrollText, ShieldAlert, ShieldBan,
  ShieldCheck, ShieldX, Smartphone, Table2, Undo2, UserCheck, UserCog, Users, Wallet,
};

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = ICONS[name] ?? Globe;
  return <C aria-hidden {...props} />;
}

export const focusRing = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

type BtnVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'soft';
const VARIANTS: Record<BtnVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs',
  outline: 'border bg-card hover:bg-muted text-foreground',
  ghost: 'hover:bg-muted text-foreground',
  danger: 'border border-destructive/30 bg-card text-destructive-soft-foreground hover:bg-destructive/10',
  soft: 'bg-muted hover:bg-muted/70 text-foreground',
};

export const Btn = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'md' | 'sm' | 'icon' }>(
  function Btn({ variant = 'outline', size = 'md', className, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
          focusRing,
          size === 'md' && 'h-11 px-4 text-14 sm:h-10 sm:text-13',
          size === 'sm' && 'h-11 px-3 text-13 sm:h-9 sm:text-13',
          size === 'icon' && 'size-11 sm:size-10',
          VARIANTS[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

export type Tone = 'neutral' | 'primary' | 'warning' | 'danger' | 'info' | 'success';
const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-foreground dark:bg-primary/15',
  warning: 'bg-warning/15 text-warning-soft-foreground',
  danger: 'bg-destructive/10 text-destructive-soft-foreground',
  info: 'bg-info/10 text-info-soft-foreground',
  success: 'bg-success/10 text-success-soft-foreground',
};

export function Badge({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn('inline-flex h-6 max-w-full shrink-0 items-center gap-1 rounded-md px-2 text-12 font-semibold leading-none [&_svg]:size-3', TONES[tone], className)}>
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Tooltip on a focusable trigger. */
export function Tip({ content, children, side }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-72 text-12 leading-relaxed">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/** A badge that explains itself on hover and focus. */
export function TipBadge({ tone, label, tip, icon }: { tone: Tone; label: string; tip: string; icon?: ReactNode }) {
  return (
    <Tip content={tip}>
      <button type="button" className={cn('inline-flex min-h-11 items-center rounded-md sm:min-h-6', focusRing)} aria-label={`${label}: ${tip}`}>
        <Badge tone={tone} icon={icon}>
          {label}
        </Badge>
      </button>
    </Tip>
  );
}

export function IconTile({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl bg-muted text-[color:var(--primary)]',
        size === 'sm' && 'size-8 rounded-lg [&_svg]:size-4',
        size === 'md' && 'size-10 [&_svg]:size-5',
        size === 'lg' && 'size-12 [&_svg]:size-6',
        className,
      )}
    >
      <Icon name={name} />
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-12 font-bold text-foreground', className)}>
      {initials(name) || '·'}
    </span>
  );
}

/** Radio group with roving tabindex; arrows follow the reading direction. */
export function Segmented<V extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
  size = 'md',
}: {
  label: string;
  value: V;
  options: { value: V; label: ReactNode; hint?: string }[];
  onChange: (v: V) => void;
  disabled?: boolean;
  className?: string;
  size?: 'md' | 'sm';
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const move = (i: number) => {
    const n = (i + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn('inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1', disabled && 'opacity-60', className)}
      onKeyDown={(e) => {
        if (disabled) return;
        const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
        const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
        const back = rtl ? 'ArrowRight' : 'ArrowLeft';
        if (e.key === fwd || e.key === 'ArrowDown') (e.preventDefault(), move(idx + 1));
        else if (e.key === back || e.key === 'ArrowUp') (e.preventDefault(), move(idx - 1));
        else if (e.key === 'Home') (e.preventDefault(), move(0));
        else if (e.key === 'End') (e.preventDefault(), move(options.length - 1));
      }}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-md px-3 font-semibold transition-colors',
              focusRing,
              size === 'md' ? 'min-h-11 text-13 sm:min-h-10' : 'min-h-11 text-12 sm:min-h-9',
              on ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', className)} />;
}

export function Card({ children, className, as: As = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' | 'aside'; id?: string; 'aria-labelledby'?: string; 'aria-label'?: string }) {
  return (
    <As className={cn('rounded-2xl border bg-card text-card-foreground', className)} {...rest}>
      {children}
    </As>
  );
}

export function Bdi({ children }: { children: ReactNode }) {
  return <bdi>{children}</bdi>;
}
