/**
 * @file messages.ts
 * @description The shape of the Releases catalog.
 */
import type { PluralForms } from '@/lib/format';

import type catalog from '../../../messages/en/releases.json';

export type ReleasesMessages = Omit<typeof catalog, 'included' | 'meta' | 'waiting'> & {
  included: PluralForms;
  meta: { manager: PluralForms; other: PluralForms };
  waiting: { title: PluralForms; body: string };
};
