/**
 * @file test-nav.ts
 * @description For specs: a `next/navigation` that reads the real `window.location` and re-renders on `pushState` and `replaceState`, so
 * `setQuery`, `openCard` and `closeCard` move the page under test as they do in the app.
 *
 * ```ts
 * vi.mock('next/navigation', async () => (await import('@/components/cards/test-nav')).liveNavigation());
 * window.history.replaceState(null, '', '/en/demo/tasks?card=DMO-1');
 * ```
 */
import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let patched = false;

function patchHistory() {
  if (patched) return;
  patched = true;
  for (const name of ['pushState', 'replaceState'] as const) {
    const original = window.history[name].bind(window.history);
    window.history[name] = (...args: Parameters<History['pushState']>) => {
      original(...args);
      listeners.forEach((listener) => listener());
    };
  }
  window.addEventListener('popstate', () => listeners.forEach((listener) => listener()));
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function liveNavigation() {
  patchHistory();
  return {
    useRouter: () => ({ push: () => undefined, replace: () => undefined }),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
    usePathname: () => useSyncExternalStore(subscribe, () => window.location.pathname),
  };
}
