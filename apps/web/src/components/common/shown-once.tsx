'use client';

/**
 * @file shown-once.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/shown-once.tsx. Contract: apps/web/README.md.
 */
import { FlaskConical, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Pill } from '@/components/cards/badges';
import { CopyButton } from '@/components/common/copy-button';
import { cn } from '@/lib/utils';

/** A command or link to copy. Wraps instead of scrolling, so a phone sees all of it. Always LTR. */
export function CommandBlock({
  label,
  value,
  copyLabel,
  className,
}: {
  label?: ReactNode | undefined;
  value: string;
  copyLabel: string;
  className?: string | undefined;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <p className="text-body-sm font-medium text-foreground">{label}</p>}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-2">
        <code
          dir="ltr"
          translate="no"
          className="key min-w-0 flex-1 p-1 text-start text-body-sm wrap-anywhere whitespace-pre-wrap text-foreground"
        >
          {value}
        </code>
        <CopyButton text={value} label={copyLabel} showText={false} className="bg-card" />
      </div>
    </div>
  );
}

/**
 * A value the API returns exactly once: a personal token, an invite link, a reset link (09 §17, §18.5). States that it
 * will not be shown again, and in the lab that the value is an example, so a mock can never pass for a credential.
 */
export function ShownOnce({
  warning,
  exampleLabel,
  children,
  className,
}: {
  warning: ReactNode;
  /** The lab's "this is an example" label. A real value passes none. */
  exampleLabel?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-warning-soft px-3 py-2 text-body-sm font-medium text-warning-soft-foreground">
        <span className="flex min-w-0 flex-1 basis-56 items-start gap-2">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          {warning}
        </span>
        {exampleLabel && (
          <Pill tone="muted" icon={FlaskConical}>
            {exampleLabel}
          </Pill>
        )}
      </div>
      {children}
    </div>
  );
}
