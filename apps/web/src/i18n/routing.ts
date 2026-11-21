/**
 * @file routing.ts
 * @description Locales and the URL prefix (D15: Arabic is the default, English second). Used by the middleware and the
 * request config.
 */
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  localePrefix: 'always',
  localeCookie: { name: 'NEXT_LOCALE', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 },
});

export const LOCALE_COOKIE = 'NEXT_LOCALE';
