'use client';

/**
 * @file button.tsx
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/button.tsx. Contract: apps/web/README.md.
 */
import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { focusRing } from '@/components/cards/meta';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'destructive';

export type ButtonProps = ComponentProps<'button'> & {
  /** `primary` is the one filled control of a view (08 §3.1). Everything else is `outline` or `ghost`. */
  variant?: ButtonVariant | undefined;
  size?: 'sm' | 'md' | undefined;
  /** Shows an inline spinner and keeps the width (08 §5.6). */
  busy?: boolean | undefined;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  outline: 'border border-border bg-card text-foreground hover:bg-accent',
  ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
  destructive:
    'border border-destructive/60 bg-card text-destructive-soft-foreground hover:bg-destructive-soft',
};

/** 44 px tall on phones. 36 px on desktop for `md` and 32 px for `sm`. */
export function Button({
  variant = 'outline',
  size = 'md',
  busy = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60',
        size === 'md' ? 'h-11 px-4 text-body md:h-9' : 'h-11 px-3 text-body-sm md:h-8',
        variantClass[variant],
        focusRing,
        className,
      )}
      {...rest}
    >
      {busy && <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" strokeWidth={1.75} />}
      {children}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonProps, 'children' | 'size' | 'aria-label'> & {
  /** Required: an icon-only button must have a name (08 §6). */
  label: string;
  children: ReactNode;
};

/** Square icon button: 44 px on phones, 36 px on desktop. */
export function IconButton({ label, variant = 'ghost', className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 md:size-9',
        variantClass[variant],
        focusRing,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return (
    <kbd
      dir="ltr"
      translate="no"
      className={cn(
        'key inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-muted px-1 text-caption text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
