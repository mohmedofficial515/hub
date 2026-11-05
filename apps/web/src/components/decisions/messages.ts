/**
 * @file messages.ts
 * @description The shape of `messages/{ar,en}/decisions.json`, for `useT<DecisionMessages>('decisions')`.
 */
import type { PluralForms } from '@/lib/format';

import type catalog from '../../../messages/en/decisions.json';

type Catalog = typeof catalog;

export type DecisionMessages = Omit<Catalog, 'summary' | 'row' | 'table'> & {
  table: Omit<Catalog['table'], 'moreOptions'> & { moreOptions: PluralForms };
  summary: { mine: PluralForms; overdue: PluralForms; open: PluralForms; noneMine: string };
  row: Omit<Catalog['row'], 'comments' | 'options'> & { comments: PluralForms; options: PluralForms };
};
