'use client';

/**
 * @file layout.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/layout.tsx. Contract: apps/web/README.md.
 */
import type { LucideIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { forwardRef, type ReactNode, type RefObject, useEffect, useRef } from 'react';

import { Ltr } from '@/components/common/text';
import { views } from '@/components/shell/views';
import { num } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Page gutter and width: 32 px desktop, 16 px phone, content up to 80 rem so a wide screen is used without lines running too long (Aurora Glass, 2026-11-09). Every page starts with this. */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-320 flex-col gap-5 px-4 pt-4 pb-28 md:gap-6 md:px-8 md:pt-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** When the shell last asked for the title's focus, or 0. */
let titleFocusAskedAt = 0;
/** A page that loads slowly still takes focus on its title; a title mounted long after the move (going back to the lists) does not. */
const TITLE_FOCUS_MS = 2_000;

/** The shell calls this on a view change. The next page title to mount within two seconds takes focus, even if its page loads later. */
export function requestTitleFocus() {
  titleFocusAskedAt = Date.now();
}

/**
 * Puts focus on a page's own h1 after a view change, for a page that draws its title itself instead of `PageHeader`
 * (the database, Live, a plan's page). The heading needs `tabIndex={-1}`.
 */
export function usePageTitleFocus(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!titleFocusAskedAt) return;
    const fresh = Date.now() - titleFocusAskedAt <= TITLE_FOCUS_MS;
    titleFocusAskedAt = 0;
    if (fresh) ref.current?.focus({ preventScroll: true });
  }, [ref]);
}

/**
 * The page's h1, the loudest type on the page. Focus lands here when the view changes. `meta` sits under the
 * title, `actions` at the inline end, wrapping below on a phone.
 */
export function PageHeader({
  title,
  meta,
  actions,
  icon,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode | undefined;
  actions?: ReactNode | undefined;
  /** The page's icon. By default the sidebar's icon for the view in the address. */
  icon?: LucideIcon | null | undefined;
  className?: string | undefined;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const viewId = usePathname().split('/').filter(Boolean)[2];
  const Icon = icon === null ? null : (icon ?? views.find((v) => v.id === viewId)?.icon ?? null);
  usePageTitleFocus(ref);
  return (
    <header
      className={cn(
        'glass animate-rise flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl px-4 py-3.5 md:px-5',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center icon-tile rounded-xl text-primary-text ring-1 ring-primary/15"
          >
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0">
          <h1
            ref={ref}
            tabIndex={-1}
            className="hub-page-title text-gradient text-headline text-balance outline-none"
          >
            {title}
          </h1>
          {meta && <div className="mt-0.5 text-body-sm text-muted-foreground">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Section heading with optional icon and count. The heading takes focus programmatically (`tabIndex=-1`), so pass
 * its ref to `useKeyboardList({ emptyFocusRef })`; focus lands here when the list empties.
 */
export const SectionHeader = forwardRef<
  HTMLHeadingElement,
  {
    id: string;
    icon?: LucideIcon | undefined;
    title: ReactNode;
    count?: number | undefined;
    aside?: ReactNode | undefined;
    level?: 2 | 3 | undefined;
    className?: string | undefined;
  }
>(function SectionHeader({ id, icon: Icon, title, count, aside, level = 2, className }, ref) {
  const locale = useLocale();
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      <H
        ref={ref}
        id={id}
        tabIndex={-1}
        className="flex items-center gap-2 text-title-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {Icon && (
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary-text"
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </span>
        )}
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-muted px-2 text-caption font-medium text-muted-foreground tabular-nums">
            <Ltr>{num(count, locale)}</Ltr>
          </span>
        )}
      </H>
      {aside && <div className="ms-auto flex items-center gap-2">{aside}</div>}
    </div>
  );
});
