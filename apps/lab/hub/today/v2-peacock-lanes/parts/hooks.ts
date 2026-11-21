import { useSyncExternalStore } from 'react';

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
