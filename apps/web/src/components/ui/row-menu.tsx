'use client';

/**
 * @file row-menu.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/row-menu.tsx. Contract: apps/web/README.md.
 */
import { type LucideIcon, MoreHorizontal } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useRef } from 'react';

import { IconButton } from '@/components/ui/button';
import { portalRoot } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface RowMenuItem {
  label: string;
  icon?: LucideIcon | undefined;
  onSelect: () => void;
  destructive?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Draws a line above this item. */
  separated?: boolean | undefined;
}

const item =
  'flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2.5 text-body-sm outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[highlighted]:bg-accent lg:min-h-9';

/**
 * The `⋯` menu of a row. An item that opens a dialog runs after the menu has closed and focus is back on the
 * trigger, so the dialog returns focus there instead of to a menu item that no longer exists.
 */
export function RowMenu({
  label,
  items,
  className,
}: {
  label: string;
  items: RowMenuItem[];
  className?: string | undefined;
}) {
  const locale = useLocale();
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef<(() => void) | null>(null);
  return (
    <DropdownMenu.Root dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <DropdownMenu.Trigger asChild>
        <IconButton ref={trigger} label={label} className={cn('relative z-10', className)}>
          <MoreHorizontal aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalRoot()}>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={12}
          onCloseAutoFocus={(e) => {
            const run = pending.current;
            if (!run) return;
            pending.current = null;
            e.preventDefault();
            trigger.current?.focus();
            run();
          }}
          className="z-[75] min-w-52 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {items.map((entry) => {
            const Icon = entry.icon;
            return (
              <div key={entry.label}>
                {entry.separated && <DropdownMenu.Separator className="my-1 h-px bg-border" />}
                <DropdownMenu.Item
                  disabled={entry.disabled}
                  onSelect={() => {
                    pending.current = entry.onSelect;
                  }}
                  className={cn(
                    item,
                    entry.destructive ? 'text-destructive-soft-foreground' : 'text-foreground',
                  )}
                >
                  {Icon && <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />}
                  {entry.label}
                </DropdownMenu.Item>
              </div>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
