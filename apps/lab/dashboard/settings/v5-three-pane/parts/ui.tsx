import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import {
  BadgePercent, BarChart3, Bell, BellRing, BookOpenCheck, Coins, Construction, CreditCard, Database, EyeOff, FileCheck2, Gavel, Gift,
  Globe, Hourglass, KeyRound, Landmark, ListChecks, Luggage, MessageCircle, Palette, Plane, PlugZap, Scale, ScrollText, Settings2,
  ShieldAlert, ShieldBan, ShieldCheck, ShieldX, Smartphone, Table2, Undo2, UserCheck, UserCog, Users, Wallet, X, type LucideIcon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@dash/components/ui/tooltip';
import { cn } from './cn';

const ICONS: Record<string, LucideIcon> = {
  BadgePercent, BarChart3, Bell, BellRing, BookOpenCheck, Coins, Construction, CreditCard, Database, EyeOff, FileCheck2, Gavel, Gift,
  Globe, Hourglass, KeyRound, Landmark, ListChecks, Luggage, MessageCircle, Palette, Plane, PlugZap, Scale, ScrollText, ShieldAlert,
  ShieldBan, ShieldCheck, ShieldX, Smartphone, Table2, Undo2, UserCheck, UserCog, Users, Wallet,
};

/** lucide icon by the name the mock stores. */
export function Icon({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] ?? Settings2;
  return <C aria-hidden className={cn('size-4 shrink-0', className)} />;
}

export type Bp = 'sm' | 'md' | 'lg' | 'xl';
const query = (min: number) => `(min-width: ${min}px)`;
function read(): Bp {
  if (typeof window === 'undefined') return 'xl';
  if (window.matchMedia(query(1280)).matches) return 'xl';
  if (window.matchMedia(query(1024)).matches) return 'lg';
  if (window.matchMedia(query(768)).matches) return 'md';
  return 'sm';
}

/** Breakpoint for behaviour that CSS alone cannot express (which panes exist, inline vs sheet). */
export function useBp(): Bp {
  const [bp, setBp] = useState<Bp>(read);
  useEffect(() => {
    const on = () => setBp(read());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return bp;
}

export type Tone = 'neutral' | 'warning' | 'success' | 'info' | 'danger' | 'primary';

const PILL: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  warning: 'bg-warning/15 text-warning-strong dark:text-[color-mix(in_oklab,var(--warning)_70%,white)]',
  success: 'bg-success/12 text-success-soft-foreground dark:text-[color-mix(in_oklab,var(--success)_70%,white)]',
  info: 'bg-info/12 text-info-soft-foreground dark:text-[color-mix(in_oklab,var(--info)_70%,white)]',
  danger: 'bg-destructive/10 text-destructive-soft-foreground dark:text-[color-mix(in_oklab,var(--destructive)_70%,white)]',
  primary: 'bg-primary/10 text-[color-mix(in_oklab,var(--primary)_78%,black)] dark:text-[color-mix(in_oklab,var(--primary)_70%,white)]',
};

export function Pill({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-11 font-semibold leading-none whitespace-nowrap', PILL[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const DOT: Record<'on' | 'off' | 'attention' | 'new' | 'ok' | 'pending', string> = {
  on: 'bg-success',
  ok: 'bg-success/70',
  off: 'bg-transparent ring-[1.5px] ring-inset ring-muted-foreground/60',
  attention: 'bg-warning',
  new: 'bg-info',
  pending: 'bg-warning ring-2 ring-warning/30',
};

export function StateDot({ state, label, className }: { state: keyof typeof DOT; label: string; className?: string }) {
  return (
    <span className={cn('inline-flex size-2.5 shrink-0 rounded-full', DOT[state], className)} role="img" aria-label={label} title={label} />
  );
}

/** Icon-only button with a visible tooltip and an accessible name. 44px on touch, 32px from md. */
export function IconBtn({
  label,
  onClick,
  children,
  className,
  pressed,
  disabled,
  tip = true,
  ...rest
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  pressed?: boolean;
  disabled?: boolean;
  tip?: boolean;
} & Record<`data-${string}`, string>) {
  const btn = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 lg:size-8',
        pressed && 'bg-muted text-foreground',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
  if (!tip) return btn;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function Tip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-72">{label}</TooltipContent>
    </Tooltip>
  );
}

/** ↑ / ↓ / Home / End move focus between `[data-nav]` items inside the list. */
export function listKeys(e: KeyboardEvent<HTMLElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-nav]'));
  if (!items.length) return;
  const i = items.indexOf(document.activeElement as HTMLElement);
  let next = i;
  if (e.key === 'ArrowDown') next = i < 0 ? 0 : Math.min(items.length - 1, i + 1);
  if (e.key === 'ArrowUp') next = i < 0 ? 0 : Math.max(0, i - 1);
  if (e.key === 'Home') next = 0;
  if (e.key === 'End') next = items.length - 1;
  e.preventDefault();
  items[next]?.focus();
}

/** Dialog that is a bottom sheet below md and a centred panel from md. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
  closeLabel,
  returnTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  closeLabel: string;
  /** Selector to focus on close when the element that opened the dialog is gone. */
  returnTo?: string;
}) {
  const opener = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);
  // The dialogs unmount when they close, so focus is handed back from the cleanup as well as from onCloseAutoFocus.
  useEffect(() => () => returnFocus(opener.current, returnTo), [returnTo]);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocus(opener.current, returnTo);
          }}
          className={cn(
            'fixed z-50 flex max-h-[92dvh] flex-col bg-card text-card-foreground shadow-2xl outline-none',
            'inset-x-0 bottom-0 rounded-t-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8 motion-reduce:animate-none',
            'md:inset-x-auto md:bottom-auto md:start-1/2 md:top-1/2 md:w-[min(92vw,34rem)] md:-translate-y-1/2 md:rounded-2xl md:border md:ltr:-translate-x-1/2 md:rtl:translate-x-1/2 md:data-[state=open]:fade-in-0 md:data-[state=open]:zoom-in-95 md:data-[state=open]:slide-in-from-bottom-0',
            wide && 'md:w-[min(92vw,42rem)]',
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border md:hidden" aria-hidden />
          <div className="flex items-start gap-3 px-5 pt-4 pb-3 md:px-6 md:pt-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-17 font-bold leading-snug">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-13 text-muted-foreground">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label={closeLabel}
              className="-me-2 -mt-1 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:size-9"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 md:px-6">{children}</div>
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3 md:px-6">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Give focus back to the control that opened a dialog or sheet (or a fallback), unless something else already took it. */
export function returnFocus(el: Element | null, fallback?: string) {
  const attempt = () => {
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected && !active.closest('[role="dialog"]')) return;
    const target = el instanceof HTMLElement && el.isConnected && el !== document.body ? el : fallback ? document.querySelector<HTMLElement>(fallback) : null;
    target?.focus();
  };
  // Radix finishes its own focus handling after the close animation, so try again a moment later.
  window.setTimeout(attempt, 30);
  window.setTimeout(attempt, 250);
}

export function Btn({
  children,
  onClick,
  variant = 'outline',
  className,
  disabled,
  type = 'button',
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
} & Record<`aria-${string}` | `data-${string}`, string | boolean | undefined>) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-14 font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-9 md:text-13',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'outline' && 'border bg-card hover:bg-muted',
        variant === 'ghost' && 'hover:bg-muted',
        variant === 'danger' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export { X };
