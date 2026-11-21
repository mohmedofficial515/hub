// Small primitives for this version: buttons, badges, switch, segmented radio group, select, sheet, popover, menu,
// highlight and toasts. All direction-aware (logical classes), 44px targets, visible focus.

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Info, X } from 'lucide-react';
import { Dialog, DropdownMenu, Popover } from 'radix-ui';
import { useLocale } from '@lab/i18n';
import { cn } from '@lab/utils';
import { matchRanges } from './search';

export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';


type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';

export function Btn({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'md' | 'sm' | 'icon' }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-14 font-semibold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-55',
        focusRing,
        size === 'md' && 'h-11 px-4',
        size === 'sm' && 'h-11 px-3 text-13 xl:h-10',
        size === 'icon' && 'size-11',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'secondary' && 'border border-border bg-card text-foreground hover:bg-muted',
        variant === 'ghost' && 'text-foreground hover:bg-muted',
        variant === 'quiet' && 'text-muted-foreground hover:bg-muted hover:text-foreground',
        variant === 'danger' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        className,
      )}
      {...props}
    />
  );
}

export type Tone = 'neutral' | 'primary' | 'warning' | 'danger' | 'violet' | 'info' | 'success';

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/12 text-foreground dark:bg-primary/20',
  warning: 'bg-warning/18 text-warning-soft-foreground dark:bg-warning/15',
  danger: 'bg-destructive/10 text-destructive-soft-foreground dark:bg-destructive/20',
  violet: 'bg-accent-violet/10 text-foreground [&_svg]:text-accent-violet dark:bg-accent-violet/15',
  info: 'bg-info/12 text-info-soft-foreground dark:bg-info/20',
  success: 'bg-success/12 text-success-soft-foreground dark:bg-success/20',
};

export function Badge({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-12 font-semibold leading-none [&_svg]:size-3.5',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      dir="ltr"
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-card px-1.5 font-sans text-12 font-semibold text-muted-foreground shadow-[0_1px_0_0_var(--border)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
  describedBy,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'group/sw inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-55',
        'outline-none',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex h-6 w-11 items-center rounded-full transition-colors group-focus-visible/sw:ring-2 group-focus-visible/sw:ring-ring group-focus-visible/sw:ring-offset-2 group-focus-visible/sw:ring-offset-background',
          checked ? 'bg-primary' : 'bg-muted-foreground/85',
        )}
      >
        <span
          className={cn(
            'block size-5 rounded-full shadow-sm transition-transform duration-200 motion-reduce:transition-none',
            checked
              ? 'translate-x-[1.375rem] bg-white rtl:-translate-x-[1.375rem] dark:bg-primary-foreground'
              : 'translate-x-0.5 bg-white rtl:-translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}

export interface SegOption {
  value: string;
  label: string;
  badge?: ReactNode;
  swatch?: string;
}

/** Radio group with roving tabindex; arrows follow the reading direction. */
export function Segmented({
  value,
  options,
  onChange,
  label,
  disabled,
  size = 'md',
  describedBy,
}: {
  value: string;
  options: SegOption[];
  onChange: (v: string) => void;
  label: string;
  disabled?: boolean;
  size?: 'md' | 'sm';
  describedBy?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const rtl = useLocale() === 'ar';
  const current = Math.max(0, options.findIndex((o) => o.value === value));
  const move = (e: KeyboardEvent, i: number) => {
    const next = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, ArrowDown: 1, ArrowUp: -1 }[e.key];
    let to: number | null = null;
    if (next) to = (i + next + options.length) % options.length;
    if (e.key === 'Home') to = 0;
    if (e.key === 'End') to = options.length - 1;
    if (to === null) return;
    e.preventDefault();
    refs.current[to]?.focus();
    onChange(options[to].value);
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
      className={cn('inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1', disabled && 'opacity-55')}
    >
      {options.map((o, i) => {
        const on = i === current;
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
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              'inline-flex min-w-11 items-center justify-center gap-1.5 rounded-lg px-3 text-14 font-semibold transition-colors',
              size === 'md' ? 'min-h-11' : 'min-h-11 xl:min-h-10',
              focusRing,
              on ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.swatch && <span aria-hidden className="size-4 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: o.swatch }} />}
            {on && !o.swatch && <Check aria-hidden className="size-3.5 shrink-0 text-primary dark:text-foreground" />}
            <span className="truncate">{o.label}</span>
            {o.badge}
          </button>
        );
      })}
    </div>
  );
}

export function NativeSelect({
  value,
  options,
  onChange,
  label,
  id,
  disabled,
  describedBy,
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
  describedBy?: string;
  className?: string;
}) {
  return (
    <span className={cn('relative inline-flex w-full min-w-0', className)}>
      <select
        id={id}
        value={value}
        aria-label={label}
        aria-describedby={describedBy}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-11 w-full min-w-0 appearance-none truncate rounded-xl border border-muted-foreground/85 bg-card ps-3 pe-9 text-14 font-medium text-foreground disabled:opacity-55',
          focusRing,
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>
  );
}

/** Text with the search tokens marked (tinted background, never a stripe). */
export function Highlight({ text, tokens, className }: { text: string; tokens: string[]; className?: string }) {
  const ranges = matchRanges(text, tokens);
  if (!ranges.length) return <span className={className}>{text}</span>;
  const parts: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([s, e], i) => {
    if (s > at) parts.push(text.slice(at, s));
    parts.push(
      <mark key={i} className="bg-primary/18 text-foreground underline decoration-primary/60 decoration-2 underline-offset-4 dark:bg-primary/35">
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <span className={className}>{parts}</span>;
}

export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = () => setOn(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [query]);
  return on;
}

/** Side sheet from the inline end (bottom sheet below 640px). Radix handles focus trap and return. */
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
  const desktop = useMedia('(min-width: 640px)');
  const rtl = useLocale() === 'ar';
  const reduce = useReducedMotion();
  const from = reduce ? { opacity: 0 } : desktop ? { x: rtl ? -48 : 48, opacity: 0 } : { y: 64, opacity: 0 };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/45"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
              <motion.div
                initial={from}
                animate={{ x: 0, y: 0, opacity: 1 }}
                exit={{ ...from, transition: { duration: 0.14 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                className={cn(
                  'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border border-border bg-background text-foreground shadow-2xl',
                  'sm:inset-x-auto sm:inset-y-0 sm:end-0 sm:max-h-none sm:w-[34rem] sm:rounded-none sm:rounded-s-2xl sm:border-y-0 sm:border-e-0',
                  wide && 'sm:w-[38rem]',
                )}
              >
                <header className="flex items-start gap-3 border-b border-border px-5 pb-4 pt-5">
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="text-18 font-bold leading-snug">{title}</Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-1 text-14 leading-relaxed text-muted-foreground">{description}</Dialog.Description>
                    ) : (
                      <Dialog.Description className="sr-only">{title}</Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close asChild>
                    <Btn variant="quiet" size="icon" aria-label={closeLabel} className="-me-2 -mt-2">
                      <X className="size-5" />
                    </Btn>
                  </Dialog.Close>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
                {footer && <footer className="border-t border-border bg-card px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/** A badge that explains itself on click or focus (works on touch, unlike a hover tooltip). */
export function InfoBadge({ tone, icon, label, children }: { tone: Tone; icon?: ReactNode; label: string; children: ReactNode }) {
  const rtl = useLocale() === 'ar';
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className={cn('group/ib -my-2.5 inline-flex min-h-11 shrink-0 items-center rounded-md outline-none xl:-my-2 xl:min-h-10')}>
          <span
            className={cn(
              'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md px-2 text-12 font-semibold leading-none [&_svg]:size-3.5',
              'group-focus-visible/ib:ring-2 group-focus-visible/ib:ring-ring group-focus-visible/ib:ring-offset-2 group-focus-visible/ib:ring-offset-background',
              TONES[tone],
            )}
          >
            {icon}
            {label}
            <Info aria-hidden className="!size-3 opacity-70" />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          dir={rtl ? 'rtl' : 'ltr'}
          sideOffset={6}
          collisionPadding={12}
          className="z-[60] max-w-[min(20rem,calc(100vw-24px))] rounded-xl border border-border bg-popover p-3 text-13 leading-relaxed text-popover-foreground shadow-lg"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  hint?: string;
}

export function Menu({ trigger, items, label }: { trigger: ReactNode; items: MenuItem[]; label?: ReactNode }) {
  const rtl = useLocale() === 'ar';
  return (
    <DropdownMenu.Root dir={rtl ? 'rtl' : 'ltr'} modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={12}
          className="z-[60] min-w-56 max-w-[calc(100vw-24px)] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {label && <DropdownMenu.Label className="px-3 py-2 text-12 text-muted-foreground">{label}</DropdownMenu.Label>}
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-14 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground"
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.hint && <span className="text-12 text-muted-foreground">{item.hint}</span>}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function IconTile({ icon: Icon, className, size = 'md' }: { icon: React.ComponentType<{ className?: string }>; className?: string; size?: 'md' | 'lg' | 'sm' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-xl bg-muted text-primary dark:text-foreground',
        size === 'lg' && 'size-12 rounded-2xl [&_svg]:size-6',
        size === 'md' && 'size-10 [&_svg]:size-5',
        size === 'sm' && 'size-8 rounded-lg [&_svg]:size-4',
        className,
      )}
    >
      <Icon />
    </span>
  );
}
