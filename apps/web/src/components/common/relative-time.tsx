'use client';

/**
 * @file relative-time.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/relative-time.tsx. Contract: apps/web/README.md.
 */
import { absolute, DAY, nowMs, rel, shortDate } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';

/** "5 min ago" / "قبل 5 دقائق", the full date in `title`. Absolute after 7 days (08 §5.1). */
export function RelativeTime({ iso, className }: { iso: string; className?: string | undefined }) {
  const locale = useLocale();
  const t = useT(kitMessages);
  const age = Math.abs(nowMs() - Date.parse(iso));
  if (age < 60_000) {
    return (
      <time dateTime={iso} title={absolute(iso, locale)} className={className}>
        {t.relative.justNow}
      </time>
    );
  }
  return (
    <time dateTime={iso} title={absolute(iso, locale)} className={className}>
      {age > 7 * DAY ? shortDate(iso, locale) : rel(iso, locale)}
    </time>
  );
}
