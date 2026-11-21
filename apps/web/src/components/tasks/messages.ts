/**
 * @file messages.ts
 * @description The shape of `messages/{ar,en}/tasks.json`, for `useT<TaskMessages>('tasks')`.
 */
import type { PluralForms } from '@/lib/format';

import type catalog from '../../../messages/en/tasks.json';

type Catalog = typeof catalog;

export type TaskMessages = Omit<Catalog, 'summary' | 'board' | 'focus'> & {
  summary: { ready: PluralForms; readyProject: PluralForms; mine: PluralForms; review: PluralForms };
  board: Omit<Catalog['board'], 'blocked' | 'count'> & { blocked: PluralForms; count: PluralForms };
  focus: Omit<Catalog['focus'], 'blocked'> & { blocked: PluralForms };
};
