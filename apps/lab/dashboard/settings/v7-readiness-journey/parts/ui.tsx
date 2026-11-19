// Small version-local primitives. Real dashboard primitives (Button, Tooltip) are used where they fit the lab.
import { useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
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
  Loader2,
  Luggage,
  MessageCircle,
  Palette,
  Plane,
  PlugZap,
  Scale,
  ScrollText,
  Settings2,
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
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@dash/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@dash/components/ui/tooltip';
import { cn } from '@lab/utils';

const ICONS: Record<string, LucideIcon> = {
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
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? Settings2;
  return <Cmp aria-hidden className={className} />;
}

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'violet' | 'danger' | 'info';

/** Tints only on small badges (owner rule). */
const PILL: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-foreground',
  success: 'bg-success/12 text-success-soft-foreground',
  warning: 'bg-warning/18 text-warning-soft-foreground',
  violet: 'bg-accent-violet/12 text-accent-violet-on-soft',
  danger: 'bg-destructive/10 text-destructive-soft-foreground',
  info: 'bg-info/12 text-info-soft-foreground',
};

export function Pill({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 max-w-full shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-12 font-semibold leading-normal whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0',
        PILL[tone],
        className,
      )}
    >
      {icon}
      <span className="min-w-0 overflow-hidden text-ellipsis py-px">{children}</span>
    </span>
  );
}

const TILE: Record<Tone, string> = {
  neutral: 'text-muted-foreground',
  primary: 'text-primary dark:text-[color:var(--primary)]',
  success: 'text-success',
  warning: 'text-warning-strong',
  violet: 'text-accent-violet-on-soft',
  danger: 'text-destructive',
  info: 'text-info',
};

/** Neutral surface, coloured icon only. */
export function IconTile({ name, tone = 'primary', size = 'md', className }: { name: string; tone?: Tone; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-xl border border-border bg-background',
        size === 'sm' && 'size-9 [&_svg]:size-4',
        size === 'md' && 'size-11 [&_svg]:size-5',
        size === 'lg' && 'size-12 [&_svg]:size-6',
        TILE[tone],
        className,
      )}
    >
      <Icon name={name} />
    </span>
  );
}

type BtnProps = ComponentProps<typeof Button> & { busy?: boolean };

/** Dashboard Button at 44px, with readable text on the dark primary. */
export function Btn({ className, variant = 'default', size, busy, children, disabled, ...props }: BtnProps) {
  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || busy}
      className={cn(
        'h-11 rounded-lg px-4 text-14 font-semibold disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:border-transparent dark:disabled:!text-muted-foreground',
        variant === 'default' && 'dark:!text-primary-foreground',
        (variant === 'ghost' || variant === 'outline' || variant === 'secondary') && 'dark:!text-foreground',
        variant === 'link' && 'h-auto px-0 dark:!text-foreground',
        className,
      )}
      {...props}
    >
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}

export function IconBtn({ label, className, children, ...props }: ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[18px]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Tip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-72 text-start text-12 leading-relaxed">{content}</TooltipContent>
    </Tooltip>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
}

/** Radio group with roving tab index; arrow keys follow the reading direction. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = 'md',
  stretch,
}: {
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
  size?: 'md' | 'lg';
  stretch?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    let next = i;
    if (e.key === 'ArrowRight') next = rtl ? i - 1 : i + 1;
    else if (e.key === 'ArrowLeft') next = rtl ? i + 1 : i - 1;
    else if (e.key === 'ArrowDown') next = i + 1;
    else if (e.key === 'ArrowUp') next = i - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    else return;
    e.preventDefault();
    next = (next + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1', stretch && 'flex w-full', className)}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-13 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4',
              size === 'lg' && 'min-h-11 px-4 text-14',
              stretch && 'flex-1',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.icon}
            <span>{o.label}</span>
            {o.badge}
          </button>
        );
      })}
    </div>
  );
}

/** A 44px-high switch (the dashboard switch is 18px; this keeps its look but grows the target). */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  describedBy,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  describedBy?: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group/t inline-flex min-h-11 shrink-0 items-center rounded-full px-0.5 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors group-focus-visible/t:ring-[3px] group-focus-visible/t:ring-ring/50',
          checked ? 'bg-primary' : 'bg-input dark:bg-input/80',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-background shadow-sm transition-[inset-inline-start] dark:bg-foreground',
            checked ? 'start-[1.375rem] dark:bg-primary-foreground' : 'start-0.5',
          )}
        />
      </span>
    </button>
  );
}

export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export function Card({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card text-card-foreground', className)} {...props}>
      {children}
    </div>
  );
}
