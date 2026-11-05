/**
 * @file messages.ts
 * @description The shape of `messages/{ar,en}/planning.json`, for `useT<PlanningMessages>('planning')`.
 */
import type { PluralForms } from '@/lib/format';

import type catalog from '../../../messages/en/planning.json';

type Catalog = typeof catalog;

export type PlanningMessages = Omit<Catalog, 'summary' | 'focal'> & {
  summary: { ideas: PluralForms; plans: PluralForms };
  focal: Omit<Catalog['focal'], 'moreSteps'> & { moreSteps: PluralForms };
};
