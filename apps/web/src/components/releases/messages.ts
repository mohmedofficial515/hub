/**
 * @file messages.ts
 * @description The shape of the Releases catalog.
 */
import type { PluralForms } from '@/lib/format';

import type catalog from '../../../messages/en/releases.json';

export type ReleasesMessages = Omit<typeof catalog, 'included' | 'meta' | 'waiting' | 'confirm'> & {
  included: PluralForms;
  /** Release asks first, naming the version and how many cards it ships (owner decision 6). */
  confirm: { title: string; body: PluralForms };
  meta: { manager: PluralForms; other: PluralForms };
  waiting: { title: PluralForms; body: string };
};
