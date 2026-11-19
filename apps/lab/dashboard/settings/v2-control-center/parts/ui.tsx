/**
 * Small primitives of the control centre. Buttons, switch and segmented control are version-local because the
 * dashboard Button forces white text in dark mode (fails AA on the light-green dark primary) and its Switch is
 * below the 44 px touch target. Both are listed in the README `touches-components`.
 */
import { forwardRef, useRef, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { Switch as SwitchPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui';
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
import { cn } from '@lab/utils';
import type { SectionId } from '@lab/mocks/settings';
import { HUE } from './model';

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

/** The coloured identity of a section: tinted tile + coloured glyph, optionally with a state lamp. */
export function IconTile({
  name,
  section,
  size = 'md',
  lamp,
}: {
  name: string;
  section: SectionId;
  size?: 'sm' | 'md' | 'lg';
  lamp?: 'on' | 'off' | 'attention' | 'scheduled' | 'none';
}) {
  const hue = HUE[section];
  const box = size === 'lg' ? 'size-12 rounded-2xl' : size === 'sm' ? 'size-8 rounded-lg' : 'size-10 rounded-xl';
  const glyph = size === 'lg' ? 'size-6' : size === 'sm' ? 'size-4' : 'size-5';
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center', box, hue.tile)}>
      <Icon name={name} className={cn(glyph, hue.icon)} />
      {lamp && lamp !== 'none' ? (
        <span
          aria-hidden
          className={cn(
            'absolute -bottom-0.5 -end-0.5 size-3 rounded-full ring-2 ring-card',
            lamp === 'on' && 'bg-success',
            lamp === 'off' && 'bg-muted-foreground/60',
            lamp === 'attention' && 'bg-warning',
            lamp === 'scheduled' && 'bg-info',
          )}
        />
      ) : null}
    </span>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'info' | 'danger' | 'primary' | 'outline';

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-foreground/80',
  success: 'bg-success/12 text-success-soft-foreground',
  warning: 'bg-warning/18 text-warning-soft-foreground',
  info: 'bg-info/12 text-info-soft-foreground',
  danger: 'bg-destructive/10 text-destructive-soft-foreground',
  primary: 'bg-primary/5 text-primary',
  outline: 'border border-border text-muted-foreground',
};

export function Pill({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-12 font-semibold', TONES[tone], className)}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

type BtnVariant = 'primary' | 'outline' | 'ghost' | 'quiet' | 'danger';

const BTN: Record<BtnVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs',
  outline: 'border border-border bg-card text-foreground hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  quiet: 'text-primary hover:bg-primary/8 font-semibold',
  danger: 'bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/70',
};

export const Btn = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'icon' }>(
  function Btn({ variant = 'outline', size = 'md', className, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-14 font-semibold outline-none transition-colors',
          'focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
          size === 'md' && 'min-h-11 px-4',
          size === 'sm' && 'min-h-11 px-3 text-13 sm:min-h-9',
          size === 'icon' && 'size-11 sm:size-9',
          BTN[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-6 min-w-6 place-items-center rounded-md border border-border bg-muted px-1.5 font-sans text-12 font-semibold text-muted-foreground">
      {children}
    </kbd>
  );
}

export function TipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={250}>{children}</TooltipPrimitive.Provider>;
}

/** Tooltip on a focusable trigger. The trigger keeps visible text; the tip only adds detail. */
export function Tip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-[80] max-w-72 rounded-lg bg-foreground px-3 py-2 text-12 leading-relaxed text-background shadow-lg"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** A small badge that explains itself in a tooltip and is reachable by keyboard. */
export function TipBadge({ tone, label, tip, icon }: { tone: Tone; label: ReactNode; tip: ReactNode; icon?: ReactNode }) {
  return (
    <Tip content={tip}>
      <button
        type="button"
        className={cn(
          'inline-flex h-6 shrink-0 cursor-help items-center gap-1 whitespace-nowrap rounded-full px-2 text-12 font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-3.5',
          TONES[tone],
        )}
      >
        {icon}
        {label}
      </button>
    </Tip>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        // The root is the 44 px hit area; the drawn track is its ::before.
        'peer relative inline-flex h-11 w-12 shrink-0 items-center rounded-full outline-none',
        'before:absolute before:inset-x-0.5 before:top-1/2 before:h-6 before:-translate-y-1/2 before:rounded-full before:transition-colors before:content-[""]',
        'data-[state=checked]:before:bg-primary data-[state=unchecked]:before:bg-foreground/25',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none relative block size-5 rounded-full bg-white shadow-sm transition-transform',
          'translate-x-1 data-[state=checked]:translate-x-6 rtl:-translate-x-1 rtl:data-[state=checked]:-translate-x-6',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export interface SegOption<V extends string> {
  value: V;
  label: ReactNode;
  badge?: ReactNode;
}

/** Radio group drawn as a segmented control; arrow keys move and select (WAI-ARIA radio pattern). */
export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
  className,
  disabled,
  stretch,
}: {
  value: V;
  options: SegOption<V>[];
  onChange: (v: V) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
  stretch?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, index: number) => {
    const rtl = document.documentElement.dir === 'rtl';
    const forward = e.key === 'ArrowDown' || e.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
    const back = e.key === 'ArrowUp' || e.key === (rtl ? 'ArrowRight' : 'ArrowLeft');
    if (!forward && !back) return;
    e.preventDefault();
    const next = (index + (forward ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1', stretch && 'flex w-full', className)}>
      {options.map((option, i) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60',
              size === 'md' ? 'min-h-11 text-13' : 'min-h-11 text-12 sm:min-h-9',
              stretch && 'flex-1',
              on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
            {option.badge}
          </button>
        );
      })}
    </div>
  );
}

export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
