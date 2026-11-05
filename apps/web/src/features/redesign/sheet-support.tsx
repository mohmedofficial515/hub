'use client';

/**
 * @file sheet-support.tsx
 * @description What the Redesign sheet section needs from the page: the versions of its lab page, for compare.
 */
import type { RedesignCard } from '@/features/cards/types';

import { useLabPages } from './queries';

/** The versions of this card's page, oldest first. Empty until the pages arrive. */
export function usePageVersions(card: RedesignCard | undefined): RedesignCard[] {
  const { data } = useLabPages();
  if (!card || !data) return [];
  const page = data.pages.find((p) => p.versionKeys.includes(card.key));
  const byKey = new Map(data.items.map((v) => [v.key, v]));
  return (page?.versionKeys ?? []).map((k) => byKey.get(k)).filter((v): v is RedesignCard => !!v);
}
