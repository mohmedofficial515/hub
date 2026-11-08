/**
 * @file request.ts
 * @description next-intl request config. One JSON file per namespace, so two page authors never edit the same file.
 * A new namespace is one more entry in NAMESPACES (and `messages/{ar,en}/<name>.json`).
 */
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

export const NAMESPACES = [
  'kit',
  'chat',
  'shell',
  'auth',
  'workspaces',
  'today',
  'inbox',
  'timeline',
  'planning',
  'tasks',
  'decisions',
  'needs',
  'handoffs',
  'redesign',
  'releases',
  'docs',
  'ask',
  'onboarding',
  'members',
  'settings',
  'queue',
] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const entries = await Promise.all(
    NAMESPACES.map(async (namespace) => {
      const file = (await import(`../../messages/${locale}/${namespace}.json`)) as {
        default: Record<string, unknown>;
      };
      return [namespace, file.default] as const;
    }),
  );
  return { locale, messages: Object.fromEntries(entries), timeZone: 'Europe/Istanbul' };
});
