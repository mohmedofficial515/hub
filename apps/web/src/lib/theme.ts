'use client';

/**
 * @file theme.ts
 * @description Light and dark, and the language switch. The theme lives in a cookie, so the server paints the right one the first time. With
 * no cookie the layout's inline script follows the system.
 */
import { useSyncExternalStore } from 'react';

import { patch } from '@/lib/api/client';

export type Theme = 'light' | 'dark';

export const THEME_COOKIE = 'hub-theme';
const YEAR = 60 * 60 * 24 * 365;

const listeners = new Set<() => void>();

const read = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${YEAR}; samesite=lax`;
  listeners.forEach((l) => l());
}

export const toggleTheme = () => setTheme(read() === 'dark' ? 'light' : 'dark');

export function useTheme(): Theme {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    read,
    () => 'dark',
  );
}

/** Same page in the other language. The preference follows the member, when signed in. */
export function setLocaleEverywhere(locale: 'ar' | 'en', { signedIn = true }: { signedIn?: boolean } = {}) {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${YEAR}; samesite=lax`;
  const parts = window.location.pathname.split('/');
  parts[1] = locale;
  const target = `${parts.join('/')}${window.location.search}`;
  if (signedIn) {
    void patch('me', { locale })
      .catch(() => undefined)
      .finally(() => window.location.assign(target));
  } else {
    window.location.assign(target);
  }
}
