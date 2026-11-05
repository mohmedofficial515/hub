import { useLocale, useT } from '@lab/i18n';
import { kitMessages } from './i18n';
import { DAY, absolute, nowMs, rel, shortDate } from './format';

/** "5 min ago" / "قبل 5 دقائق", the full date in `title`. Absolute after 7 days (08 §5.1). */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
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
