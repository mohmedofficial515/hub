/**
 * @file index.ts
 * @description The app's string access. next-intl holds the catalogs (`messages/<locale>/<namespace>.json`);
 * `useT(namespace)` returns the namespace as a plain object, so `t.nav.today`, `fmt`, `fill` and `plural` read the
 * way the approved design's code does. A page reads its own namespace and `kitMessages` for card vocabulary.
 */
import { useLocale as useIntlLocale, useMessages } from 'next-intl';

import type { CardType } from '@/features/cards/types';

import type { CardAction, KitDict } from './kit-dict';
import type { ShellDict } from './shell-dict';

export type { CardAction, KitDict } from './kit-dict';
export type { ShellDict } from './shell-dict';

export type Locale = 'ar' | 'en';

export const kitMessages = 'kit' as const;
export const messages = 'shell' as const;

export function useT(namespace: 'kit'): KitDict;
export function useT(namespace: 'shell'): ShellDict;
export function useT<T>(namespace: string): T;
export function useT(namespace: string): unknown {
  return (useMessages() as Record<string, unknown>)[namespace];
}

export const useLocale = () => useIntlLocale() as Locale;

/** The word for an action on this card: the type's own where it has one. */
export const actionName = (t: KitDict, type: CardType, action: CardAction) =>
  t.actionsByType[type]?.[action] ?? t.actions[action];

/** History's word for an event. A self-verified need says so (owner decision 2026-11-04). */
export const eventLabel = (t: KitDict, event: { kind: string; data?: Record<string, unknown> }) =>
  event.kind === 'verified' && event.data?.selfVerified
    ? t.sheet.history.selfVerified
    : (t.sheet.history.kinds[event.kind] ?? event.kind);
