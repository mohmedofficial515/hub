import { cn } from '@lab/utils';

import type { FrameLevel } from './mock';
import { useAccount } from './model';
import { Postmark, type PostmarkSize } from './postmark';

/** The signed-in customer's avatar: the Postmark with the session's photo, monogram and level. */
export function AccountAvatar({
  size,
  tone = 'surface',
  className,
}: {
  size: PostmarkSize;
  tone?: 'surface' | 'brand';
  className?: string;
}) {
  const m = useAccount();
  return (
    <Postmark
      size={size}
      tone={tone}
      level={m.frame}
      label={m.a11yName}
      initial={m.initial}
      photo={m.customer.avatar}
      memberSince={m.customer.memberSince}
      state={m.state === 'loading' ? 'loading' : 'ready'}
      className={className}
    />
  );
}

/** The level as a small solid mark (the badge glyph): pairs with the level word, never shown alone. */
export function LevelMark({ level, className }: { level: FrameLevel; className?: string }) {
  if (level !== 'BLUE' && level !== 'SILVER' && level !== 'GOLD') return null;
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-[18px] shrink-0 items-center justify-center rounded-full',
        level === 'GOLD'
          ? 'bg-(--pm-gold) text-(--pm-on-gold) shadow-[inset_0_0_0_1px_var(--pm-gold-key)]'
          : level === 'SILVER'
            ? 'bg-(--pm-silver) text-(--pm-on-ink)'
            : 'bg-(--pm-blue) text-(--pm-on-ink)',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" width={11} height={11}>
        {level === 'BLUE' && <circle cx="12" cy="12" r="3.6" fill="currentColor" />}
        {level === 'SILVER' && (
          <path d="M6.5 15 12 9.5l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {level === 'GOLD' && (
          <path
            d="M6.5 12.5 12 7l5.5 5.5M6.5 18 12 12.5l5.5 5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </span>
  );
}
