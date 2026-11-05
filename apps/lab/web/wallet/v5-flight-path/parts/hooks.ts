import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { Locale } from '@lab/i18n';

const SHOWN_KEY = 'wallet.balance.shown';

/** Amounts start hidden (owner decision) and the choice is remembered, same key as the real balance card. */
export function useAmountsShown() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    try {
      setShown(localStorage.getItem(SHOWN_KEY) === '1');
    } catch {
      /* storage blocked: stay hidden */
    }
  }, []);
  const toggle = useCallback(() => {
    setShown((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SHOWN_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return [shown, toggle] as const;
}

/**
 * Hydration-safe media query: the server (and the first client render) answer `false`, then the store
 * subscribes to `matchMedia`. Used only for SVG geometry; layout switches are done in CSS.
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined') return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => (typeof window === 'undefined' ? false : window.matchMedia(query).matches),
    () => false,
  );
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const tag = (locale: Locale) => (locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');

export const formatTime = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export const formatDay = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { day: 'numeric', month: 'short' }).format(new Date(iso));

export const formatMonth = (yyyyMm: string, locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { month: 'long', year: 'numeric' }).format(new Date(`${yyyyMm}-15T12:00:00Z`));
