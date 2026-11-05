'use client';

/**
 * @file tooltip.tsx
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/tooltip.tsx. Contract: apps/web/README.md.
 */
import { Tooltip as RadixTooltip } from 'radix-ui';
import type { ReactNode } from 'react';

import { portalRoot } from '@/lib/hooks';
import { cn } from '@/lib/utils';

/**
 * Collision-aware tooltip: it flips and shifts to stay inside the viewport at every width (review M5). The trigger
 * must be focusable. Keep real information in the trigger's accessible name too: a tooltip is not on touch.
 * The shell provides `Tooltip.Provider`.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  className,
}: {
  content: ReactNode;
  /** A single focusable element. */
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right' | undefined;
  align?: 'start' | 'center' | 'end' | undefined;
  className?: string | undefined;
}) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal container={portalRoot()}>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-[80] max-w-72 rounded-lg border border-border bg-popover px-2.5 py-2 text-start text-body-sm text-popover-foreground shadow-md',
            className,
          )}
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
