/**
 * Small primitives for the version, on radix-ui directly (the dashboard's Sheet and Dialog pull next/navigation through
 * CloseLabel, which the lab cannot run). Buttons are 44px on touch widths and 36-40px from `sm`.
 */
import { useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import { Dialog as D, Popover as P, Tooltip as T } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@lab/utils';

/* ───────── buttons ───────── */

type Variant = 'primary' | 'outline' | 'ghost' | 'quiet' | 'danger';
export function btn(variant: Variant = 'outline', size: 'md' | 'sm' = 'md') {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold outline-none transition-colors',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:cursor-not-allowed disabled:opacity-50',
    size === 'md' ? 'min-h-11 px-4 text-14 sm:min-h-10' : 'min-h-11 px-3 text-13 sm:min-h-9',
    variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
    variant === 'outline' && 'border border-border bg-card text-foreground hover:bg-muted',
    variant === 'ghost' && 'text-foreground hover:bg-muted',
    variant === 'quiet' && 'text-muted-foreground hover:bg-muted hover:text-foreground',
    variant === 'danger' && 'border border-destructive/40 bg-card text-destructive hover:bg-destructive/10',
  );
}

export function IconButton({ label, className, children, ...rest }: ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:size-9',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ───────── tooltip ───────── */

export const TipProvider = ({ children }: { children: ReactNode }) => (
  <T.Provider delayDuration={600} skipDelayDuration={200}>
    {children}
  </T.Provider>
);

export function TipContent({ className, children, ...rest }: ComponentProps<typeof T.Content>) {
  return (
    <T.Portal>
      <T.Content
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          'z-50 max-w-72 rounded-xl border border-border bg-popover px-3 py-2 text-start text-12 leading-relaxed text-popover-foreground shadow-lg',
          'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 motion-reduce:animate-none',
          className,
        )}
        {...rest}
      >
        {children}
      </T.Content>
    </T.Portal>
  );
}

export const TipRoot = T.Root;
export const TipTrigger = T.Trigger;

export function Tip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <TipContent>{content}</TipContent>
    </T.Root>
  );
}

/* ───────── popover ───────── */

export const PopRoot = P.Root;
export const PopTrigger = P.Trigger;
export const PopAnchor = P.Anchor;
export const PopClose = P.Close;

export function PopContent({ className, children, ...rest }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={8}
        collisionPadding={16}
        className={cn(
          'z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-xl outline-none',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none',
          className,
        )}
        {...rest}
      >
        {children}
      </P.Content>
    </P.Portal>
  );
}

/* ───────── sheet (dialog from the end side, bottom on phones) ───────── */

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel: string;
  wide?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-foreground/35 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none dark:bg-black/60" />
        <D.Content
          className={cn(
            'fixed z-50 flex flex-col bg-background text-foreground shadow-2xl outline-none',
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl',
            'sm:inset-x-auto sm:inset-y-0 sm:end-0 sm:max-h-none sm:rounded-none sm:rounded-s-3xl',
            wide ? 'sm:w-[min(40rem,100vw)]' : 'sm:w-[min(34rem,100vw)]',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom sm:data-[state=open]:slide-in-from-bottom-0',
            'ltr:sm:data-[state=open]:slide-in-from-right rtl:sm:data-[state=open]:slide-in-from-left motion-reduce:animate-none',
          )}
        >
          <div className="flex items-start gap-3 border-b border-border px-5 pb-4 pt-5 sm:px-7 sm:pt-7">
            <div className="min-w-0 flex-1">
              <D.Title className="text-20 font-extrabold leading-snug">{title}</D.Title>
              {description ? <D.Description className="mt-1.5 text-14 leading-relaxed text-muted-foreground">{description}</D.Description> : null}
            </div>
            <D.Close asChild>
              <IconButton label={closeLabel} className="-me-2 -mt-1">
                <X className="size-5" aria-hidden />
              </IconButton>
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
          {footer ? <div className="border-t border-border bg-card/60 px-5 py-4 sm:px-7">{footer}</div> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/* ───────── segmented radio group (roving tabindex, arrows follow reading direction) ───────── */

export function Segmented<V extends string>({
  label,
  value,
  options,
  onChange,
  className,
  size = 'md',
}: {
  label: string;
  value: V;
  options: { value: V; label: ReactNode; badge?: ReactNode }[];
  onChange: (v: V) => void;
  className?: string;
  size?: 'md' | 'sm';
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const move = (e: KeyboardEvent, i: number) => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = -1;
    if (e.key === fwd || e.key === 'ArrowDown') next = (i + 1) % options.length;
    if (e.key === back || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex flex-wrap gap-1 rounded-2xl bg-muted p-1', className)}>
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
            tabIndex={i === index ? 0 : -1}
            onKeyDown={(e) => move(e, i)}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9',
              size === 'sm' ? 'text-12' : 'text-13',
              on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
            {o.badge}
          </button>
        );
      })}
    </div>
  );
}

/* ───────── small badges (tints only on small badges, owner rule) ───────── */

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'warning' | 'info' | 'violet' | 'danger' | 'success'; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 align-middle text-12 font-bold leading-5',
        tone === 'neutral' && 'bg-muted text-muted-foreground',
        tone === 'warning' && 'bg-warning/20 text-warning-soft-foreground',
        tone === 'info' && 'bg-info/15 text-info-soft-foreground',
        tone === 'violet' && 'bg-accent-violet/15 text-accent-violet-on-soft',
        tone === 'danger' && 'bg-destructive/12 text-destructive-soft-foreground',
        tone === 'success' && 'bg-success/15 text-success-soft-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}
