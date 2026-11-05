'use client';

/**
 * @file sheet-support.tsx
 * @description What the Redesign sheet section needs from the page: its screenshots as the API serves them from the lab root
 * (docs/15 §3). The curtain compare belongs to the Redesign page; the page's author moves it here from
 * `pages/redesign/parts/compare.tsx`.
 */
import type { RedesignCard } from '@/features/cards/types';

export interface ShotMeta {
  name: string;
  url: string;
}

/** The card's screenshot attachments. An empty list shows the section's honest "no screenshots". */
export const shotsOf = (card: Pick<RedesignCard, 'attachments'>): ShotMeta[] =>
  card.attachments.filter((a) => a.kind === 'screenshot').map((a) => ({ name: a.name, url: a.url }));
