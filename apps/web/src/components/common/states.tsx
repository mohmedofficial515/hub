'use client';

/**
 * @file states.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/states.tsx. Contract: apps/web/README.md.
 */
import { FileQuestion, Lock, type LucideIcon, TriangleAlert } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import { CopyButton } from '@/components/common/copy-button';
import { fmt, Ltr } from '@/components/common/text';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * 08 §5.6: icon, title, one sentence, one action when the member can act. `size="page"` centres it for a whole
 * empty page; `size="section"` is the quiet dashed line inside a list.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  size = 'section',
  className,
}: {
  icon: LucideIcon;
  title: string;
  /** One sentence. */
  children?: ReactNode | undefined;
  action?: ReactNode | undefined;
  size?: 'section' | 'page' | undefined;
  className?: string | undefined;
}) {
  if (size === 'page') {
    return (
      <div className={cn('flex flex-col items-center px-6 py-16 text-center md:py-24', className)}>
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon aria-hidden className="size-6 text-muted-foreground" strokeWidth={1.75} />
        </span>
        <p className="mt-4 text-title-sm font-semibold text-foreground">{title}</p>
        {children && <div className="mt-1.5 max-w-prose text-body text-muted-foreground">{children}</div>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-dashed border-border px-4 py-4',
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-body font-medium text-foreground">{title}</p>
        {children && <div className="mt-1 text-body-sm text-muted-foreground">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

/**
 * 08 §5.6: says what failed and how to go on. `thing` completes "Couldn't load <thing>". A 403 names the role
 * instead of offering Retry. `kind` sets the tone: only a real failure is the danger tone and an alert; "no access"
 * and "not found" are facts about the address, drawn neutral and announced politely.
 */
export function ErrorState({
  thing,
  title,
  code,
  requestId,
  onRetry,
  forbiddenRole,
  detail,
  className,
  kind,
}: {
  /** `forbidden` when `forbiddenRole` is set, else `error`. */
  kind?: 'error' | 'forbidden' | 'notFound' | undefined;
  /** A sentence under the title, above the retry. */
  detail?: string | undefined;
  thing?: string | undefined;
  /** Overrides the built title, for messages like "No card GTV-999 in this workspace". */
  title?: string | undefined;
  code?: string | undefined;
  requestId?: string | undefined;
  onRetry?: (() => void) | undefined;
  /** Set for a 403: the role that would give access. */
  forbiddenRole?: string | undefined;
  className?: string | undefined;
}) {
  const t = useT(kitMessages);
  const tone = kind ?? (forbiddenRole ? 'forbidden' : 'error');
  const failed = tone === 'error';
  const Icon = tone === 'forbidden' ? Lock : tone === 'notFound' ? FileQuestion : TriangleAlert;
  const heading = forbiddenRole ? t.error.forbidden : (title ?? fmt(t.error.title, { thing: thing ?? '' }));
  return (
    <div
      role={failed ? 'alert' : 'status'}
      data-error-kind={tone}
      className={cn('flex flex-col items-center px-6 py-12 text-center', className)}
    >
      <span
        className={cn(
          'flex size-12 items-center justify-center rounded-full',
          failed ? 'bg-destructive-soft' : 'bg-muted',
        )}
      >
        <Icon
          aria-hidden
          className={cn('size-6', failed ? 'text-destructive-soft-foreground' : 'text-muted-foreground')}
          strokeWidth={1.75}
        />
      </span>
      <p className="mt-4 text-title-sm font-semibold text-foreground">{heading}</p>
      {forbiddenRole && (
        <p className="mt-1.5 text-body text-muted-foreground">
          {fmt(t.error.forbiddenRole, { role: forbiddenRole })}
        </p>
      )}
      {detail && <p className="mt-1.5 max-w-md text-body text-muted-foreground">{detail}</p>}
      {code && (
        <p className="mt-1.5 text-body-sm text-muted-foreground">
          {t.error.code}{' '}
          <Ltr mono className="text-foreground">
            {code}
          </Ltr>
        </p>
      )}
      {requestId && (
        // What support asks for, readable and copyable by touch and keyboard, not only in a hover title.
        <p className="mt-1 flex items-center gap-1 text-body-sm text-muted-foreground">
          {t.error.requestId}{' '}
          <Ltr mono className="text-foreground">
            {requestId}
          </Ltr>
          <CopyButton compact showText={false} text={requestId} />
        </p>
      )}
      {onRetry && (
        <Button className="mt-5" onClick={onRetry}>
          {t.retry}
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string | undefined }) {
  return <div aria-hidden className={cn('rounded-md bg-muted motion-safe:animate-pulse', className)} />;
}

/** Shaped like a `CardRow`, same height, so loading does not shift the layout (08 §5.6). */
export function SkeletonRow({
  className,
  withAction = true,
}: {
  className?: string | undefined;
  withAction?: boolean | undefined;
}) {
  return (
    <div
      className={cn(
        'flex min-h-18 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3',
        className,
      )}
    >
      <Skeleton className="size-4 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      {withAction && <Skeleton className="h-9 w-20" />}
    </div>
  );
}

export function SkeletonRows({
  count = 5,
  className,
  withAction,
}: {
  count?: number | undefined;
  className?: string | undefined;
  withAction?: boolean | undefined;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} withAction={withAction} />
      ))}
    </div>
  );
}

/** 08 §5.6: wrap a loading view; the muted "Still loading…" line appears after 3 s. */
export function LoadingRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string | undefined;
}) {
  const t = useT(kitMessages);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 3000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div role="status" aria-label={label} className={cn('flex flex-col gap-6', className)}>
      {children}
      <p className="min-h-5 text-body-sm text-muted-foreground">{slow ? t.loading.still : ''}</p>
    </div>
  );
}
