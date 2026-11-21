'use client';

/**
 * @file form.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/form.tsx. Contract: apps/web/README.md.
 */
import { AlertCircle } from 'lucide-react';
import { type ComponentProps, type ReactNode, useEffect, useLayoutEffect } from 'react';

import { focusRing } from '@/components/cards/meta';
import { fmt } from '@/components/common/text';
import { useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * A label bound to one control, a hint and an inline error (08 §5.7). The control must use the same `id`.
 * Required fields are marked with a dot, not an asterisk.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required = false,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  required?: boolean | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  const invalid = !!error;
  // An error reaches the control, not only the eye: `aria-invalid`, the message as its description, and focus on the first one.
  useLayoutEffect(() => {
    const control = document.getElementById(id);
    if (!control || !invalid) return;
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', `${id}-error`);
    return () => {
      control.removeAttribute('aria-invalid');
      control.removeAttribute('aria-describedby');
    };
  }, [id, invalid]);
  useEffect(() => {
    if (!invalid) return;
    // Forms draw their fields in order, so the first field in error wins and later ones leave it alone.
    if (document.activeElement?.getAttribute('aria-invalid') === 'true') return;
    document.getElementById(id)?.focus();
  }, [id, invalid]);
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-body-sm font-medium text-foreground">
        {required && <span aria-hidden className="size-1.5 rounded-full bg-foreground" />}
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-body-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-body-sm font-medium text-destructive-soft-foreground"
        >
          {error}
        </p>
      )}
    </div>
  );
}

const controlClass =
  'w-full rounded-md border border-input bg-card text-body text-foreground placeholder:text-muted-foreground';

/** A control is named after its id unless it says otherwise, so a browser's autofill has something to go on (review m9). */
export function TextInput({ className, ...rest }: ComponentProps<'input'>) {
  return (
    <input name={rest.id} className={cn(controlClass, 'h-11 px-3 md:h-9', focusRing, className)} {...rest} />
  );
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return (
    <textarea name={rest.id} className={cn(controlClass, 'px-3 py-2', focusRing, className)} {...rest} />
  );
}

export function Select({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <select name={rest.id} className={cn(controlClass, 'h-11 px-2 md:h-9', focusRing, className)} {...rest}>
      {children}
    </select>
  );
}

// ── Secret filter (08 §5.1, §5.7): free text never carries a secret ─────────────────────────────

const PATTERNS: [string, RegExp][] = [
  ['Stripe key', /\b(sk|rk)_(live|test)_[A-Za-z0-9]{8,}/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{16,}/],
  ['AWS key', /\bAKIA[0-9A-Z]{12,}/],
  ['Bearer token', /\bBearer\s+[A-Za-z0-9._-]{16,}/],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
];

/** Returns the pattern's name when the text looks like a secret, else null. */
/** After a refused submit: focus the first control marked invalid, such as a field holding a secret. Radios are entered by their first. */
export function focusFirstInvalid(root: HTMLElement | null) {
  const target = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!target) return;
  (target.matches('input, textarea, select, button')
    ? target
    : target.querySelector<HTMLElement>('[role="radio"], input, button')
  )?.focus();
}

export function detectSecret(text: string): string | null {
  return PATTERNS.find(([, re]) => re.test(text))?.[0] ?? null;
}

export function SecretFilterError({ pattern, id }: { pattern: string; id?: string | undefined }) {
  const t = useT(kitMessages);
  return (
    <div
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-body-sm text-destructive-soft-foreground"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <p>
        <span className="font-medium">{fmt(t.secret.title, { pattern })}</span> {t.secret.body}
      </p>
    </div>
  );
}
