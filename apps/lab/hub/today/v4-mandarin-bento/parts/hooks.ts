import { useCallback, useState, useSyncExternalStore } from 'react';

/** Matches a media query (the lab renders client-side only, so no hydration concerns). */
export function useMedia(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const KEY = 'hub.today.shortcuts';

/**
 * One-key shortcuts can be turned off (WCAG 2.1.4; docs/08 §10 keeps preferences per member in
 * localStorage). Storage can throw in a private window or a sandboxed frame, so it is best effort.
 */
export function useShortcutsPref() {
  const [on, setOn] = useState(() => {
    try {
      return window.localStorage.getItem(KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const set = useCallback((next: boolean) => {
    setOn(next);
    try {
      window.localStorage.setItem(KEY, next ? 'on' : 'off');
    } catch {
      // The preference then lasts only for this page view.
    }
  }, []);
  return [on, set] as const;
}
