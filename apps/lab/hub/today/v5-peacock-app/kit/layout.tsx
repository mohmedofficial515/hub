import { forwardRef, useEffect, useRef, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useLocale } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { num } from './format';
import { Ltr } from './text';

/** Page gutter and width: 24 px desktop, 16 px phone, content max 1100 px (08 §3.3, §7). Every page starts with this. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto flex w-full max-w-275 flex-col gap-6 px-4 pt-4 pb-28 md:gap-8 md:px-6 md:pt-6', className)}>{children}</div>;
}

let titleFocusPending = false;

/** The shell calls this on a view change. The next `PageHeader` to mount takes focus, even if its page loads later. */
export function requestTitleFocus() {
  titleFocusPending = true;
}

/**
 * The page's h1, the loudest type on the page. Focus lands here when the view changes. `meta` sits under the
 * title, `actions` at the inline end, wrapping below on a phone.
 */
export function PageHeader({ title, meta, actions, className }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!titleFocusPending) return;
    titleFocusPending = false;
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        <h1 ref={ref} tabIndex={-1} className="hub-page-title text-headline text-balance text-foreground outline-none">
          {title}
        </h1>
        {meta && <div className="mt-0.5 text-body-lg text-muted-foreground">{meta}</div>}
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
    icon?: LucideIcon;
    title: ReactNode;
    count?: number;
    aside?: ReactNode;
    level?: 2 | 3;
    className?: string;
  }
>(function SectionHeader({ id, icon: Icon, title, count, aside, level = 2, className }, ref) {
  const locale = useLocale();
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      <H ref={ref} id={id} tabIndex={-1} className="flex items-center gap-2 text-title-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        {Icon && <Icon aria-hidden className="size-4.5 text-muted-foreground" strokeWidth={1.75} />}
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
