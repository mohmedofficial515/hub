'use client';

/**
 * @file release-confirm.tsx
 * @description What Release asks before it ships (owner decision 6, 2026-11-19): a sentence naming the version and how many cards go out. The card's sheet
 * and the Releases page ask with the same words.
 */
import type { ReactNode } from 'react';

import { fill, Ltr } from '@/components/common/text';
import type { ReleaseCard } from '@/features/cards/types';
import { includedCount } from '@/features/releases/queries';
import { plural } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';

import type { ReleasesMessages } from './messages';

export function useReleaseConfirm(): (card: ReleaseCard) => { title: ReactNode; description: ReactNode } {
  const t = useT<ReleasesMessages>('releases');
  const locale = useLocale();
  return (card) => {
    const version = (
      <Ltr mono key="version">
        {card.release.version}
      </Ltr>
    );
    return {
      title: fill(t.confirm.title, { version }),
      description: fill(plural(includedCount(card.release), locale, t.confirm.body), { version }),
    };
  };
}
