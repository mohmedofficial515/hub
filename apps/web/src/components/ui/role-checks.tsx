'use client';

/**
 * @file role-checks.tsx
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/role-checks.tsx. Contract: apps/web/README.md.
 */
import type { ReactNode } from 'react';

import { roleIcon } from '@/components/cards/meta';
import type { Role } from '@/features/cards/types';
import { useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const ALL: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'];

/** Pick one or more roles: the invite form, the roles dialog, and the specialty mapping. A checked box is the selected state, in foreground. */
export function RoleChecks({
  legend,
  value,
  onChange,
  locked = [],
  error,
  hint,
  compact = false,
  className,
}: {
  legend: ReactNode;
  value: Role[];
  onChange: (next: Role[]) => void;
  /** Roles this member may not grant or take away. */
  locked?: Role[] | undefined;
  error?: ReactNode | undefined;
  hint?: ReactNode | undefined;
  /** Hide the legend visually, for a table cell whose row already names it. */
  compact?: boolean | undefined;
  className?: string | undefined;
}) {
  const t = useT(kitMessages);
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className={compact ? 'sr-only' : 'mb-1.5 text-body-sm font-medium text-foreground'}>
        {legend}
      </legend>
      <div className={cn('grid gap-x-3', compact ? 'grid-cols-2 sm:flex sm:flex-wrap' : 'grid-cols-2')}>
        {ALL.map((role) => {
          const Icon = roleIcon[role];
          const checked = value.includes(role);
          const disabled = locked.includes(role);
          return (
            <label
              key={role}
              className={cn(
                'flex min-h-11 items-center gap-2 text-body-sm text-foreground md:min-h-8',
                disabled ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() =>
                  onChange(
                    checked
                      ? value.filter((r) => r !== role)
                      : ALL.filter((r) => value.includes(r) || r === role),
                  )
                }
                className="size-4 shrink-0 accent-(--foreground) outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
              <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <span className="min-w-0">{t.roles[role]}</span>
            </label>
          );
        })}
      </div>
      {hint && !error && <p className="mt-1 text-body-sm text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-body-sm font-medium text-destructive-soft-foreground">
          {error}
        </p>
      )}
    </fieldset>
  );
}
