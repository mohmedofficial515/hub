'use client';

/**
 * @file card-key.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/card-key.tsx. Contract: apps/web/README.md.
 */
import { StatusBadge, TypeDot } from '@/components/cards/badges';
import { focusRing } from '@/components/cards/meta';
import { Ltr } from '@/components/common/text';
import { AppLink } from '@/components/shell/router';
import { getCard } from '@/features/cards/store';
import { useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** The bare key as an LTR mono isolate. Opens the card when `link` is set. */
export function CardKey({
  k,
  link = false,
  className,
}: {
  k: string;
  link?: boolean | undefined;
  className?: string | undefined;
}) {
  if (!link) {
    return (
      <Ltr mono className={cn('text-caption text-muted-foreground', className)}>
        {k}
      </Ltr>
    );
  }
  return (
    <AppLink
      card={k}
      className={cn('hit-44 rounded-sm underline-offset-4 hover:underline', focusRing, className)}
    >
      <Ltr mono className="text-caption">
        {k}
      </Ltr>
    </AppLink>
  );
}

/**
 * Inline card reference (08 §5.1): dot + key + optional title + optional status. Opens the card over the current
 * page. `hit-44` gives it a 44 px hit area on phones without making sentences taller. Type and title come from
 * the catalogue when not passed.
 */
export function CardChip({
  k,
  type,
  title,
  showTitle = false,
  showStatus = false,
  className,
}: {
  k: string;
  type?: Parameters<typeof TypeDot>[0]['type'] | undefined;
  title?: string | undefined;
  showTitle?: boolean | undefined;
  showStatus?: boolean | undefined;
  className?: string | undefined;
}) {
  const t = useT(kitMessages);
  const card = getCard(k);
  const resolvedType = type ?? card?.type ?? 'task';
  const resolvedTitle = title ?? card?.title;
  return (
    <AppLink
      card={k}
      title={
        resolvedTitle ? `${t.types[resolvedType]} ${k}: ${resolvedTitle}` : `${t.types[resolvedType]} ${k}`
      }
      className={cn(
        'hit-44 inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2 align-middle text-caption text-foreground no-underline transition-colors duration-150 hover:bg-accent',
        focusRing,
        className,
      )}
    >
      <TypeDot type={resolvedType} />
      <Ltr mono className="shrink-0 text-muted-foreground">
        {k}
      </Ltr>
      {showTitle && resolvedTitle && <span className="min-w-0 truncate">{resolvedTitle}</span>}
      {showStatus && card && <StatusBadge status={card.status} className="h-4.5" />}
    </AppLink>
  );
}
