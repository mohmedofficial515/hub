'use client';

/**
 * @file ocellus.tsx
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/shell/ocellus.tsx. Contract: apps/web/README.md.
 */
import { cn } from '@/lib/utils';

/**
 * The brand mark: a peacock ocellus drawn as four concentric rings in type hues (bronze, tail teal, eye cyan,
 * neck blue). It appears once in the app, in the sidebar's workspace switcher. Hues only, no texture.
 */
export function Ocellus({ className }: { className?: string | undefined }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-7 shrink-0', className)}>
      <ellipse
        cx="16"
        cy="16"
        rx="14"
        ry="15"
        className="fill-type-decision stroke-(--sidebar)"
        strokeWidth="1"
      />
      <ellipse
        cx="16"
        cy="17.4"
        rx="10.4"
        ry="11.2"
        className="fill-type-doc stroke-(--sidebar)"
        strokeWidth="1"
      />
      <ellipse
        cx="16"
        cy="18.6"
        rx="7.2"
        ry="7.8"
        className="fill-type-handoff stroke-(--sidebar)"
        strokeWidth="1"
      />
      <ellipse cx="16" cy="19.6" rx="4.2" ry="4.6" className="fill-type-task" />
    </svg>
  );
}
