'use client';

/**
 * @file shot.tsx
 * @description A screenshot cropped to its top, in a frame that holds its shape while loading. Ported from the design's
 * `pages/redesign/parts/shot.tsx`. The pictures are the lab's own files, served by the API.
 */
import { Image as ImageIcon } from 'lucide-react';

import { cn, Skeleton, useLocale } from '@/components/kit';
import type { RedesignCard } from '@/features/cards/types';
import { pickShot, type ShotMeta } from '@/features/redesign/lab';
import { useShots } from '@/features/redesign/queries';

/** The picture a tile shows by default: the member's own language and theme, at desktop width. */
export function useDefaultShot(card: Pick<RedesignCard, 'key' | 'attachments'>) {
  const locale = useLocale();
  const { shots, loading } = useShots(card);
  const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const shot: ShotMeta | undefined = pickShot(shots, {
    width: 1440,
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    theme,
  });
  return { shot, shots, loading };
}

/** A version with no pictures keeps the frame and says so, because that is a real state of a new version. */
export function ShotThumb({
  card,
  alt,
  emptyLabel,
  className,
}: {
  card: Pick<RedesignCard, 'key' | 'attachments'>;
  alt: string;
  emptyLabel: string;
  className?: string | undefined;
}) {
  const { shot, loading } = useDefaultShot(card);
  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {shot ? (
        <img
          src={shot.url}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 size-full object-cover object-top"
        />
      ) : loading ? (
        <Skeleton className="absolute inset-0 rounded-none" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center">
          <ImageIcon aria-hidden className="size-5 text-muted-foreground" strokeWidth={1.75} />
          <span className="text-body-sm text-muted-foreground">{emptyLabel}</span>
        </div>
      )}
    </div>
  );
}
