import { useCallback, useEffect, useState } from 'react';
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

export function useMedia(query: string) {
  const [match, setMatch] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

const tag = (locale: Locale) => (locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');

export const formatTime = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export const formatDay = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { day: 'numeric', month: 'short' }).format(new Date(iso));

export const formatMonth = (yyyyMm: string, locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { month: 'long', year: 'numeric' }).format(new Date(`${yyyyMm}-15T12:00:00Z`));
