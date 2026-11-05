'use client';

/**
 * @file hooks.ts
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/hooks.ts. Contract: apps/web/README.md.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';

/** While a form holds unsaved edits, closing or reloading the tab asks first (review m9). */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}

/** The tab's name, most specific first: "Tasks · Goteav · Hub". */
export function useDocumentTitle(...parts: (string | undefined)[]) {
  const name = parts.filter(Boolean).join(' · ');
  // A page that already names Hub ("Sign in to Hub") does not say it twice. An empty name leaves the title to whoever set it.
  const title = /\bHub$/.test(name) ? name : `${name} · Hub`;
  useEffect(() => {
    if (name) document.title = title;
  }, [name, title]);
}

/** Matches a media query. The lab renders client-side only, so there is no hydration concern. */
export function useMedia(query: string, serverValue = false) {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Portal target for Radix overlays: inside the version root, so they keep the version's tokens. */
export const portalRoot = () =>
  typeof document === 'undefined' ? undefined : (document.getElementById('hub-root') ?? undefined);

/**
 * Focus return for a Radix dialog that has no Trigger: pass the result as `onCloseAutoFocus`. It remembers what had
 * focus when `open` turned true. Touch browsers leave focus on `<body>` after a tap, so `fallback` names where to go
 * then (default: main). If the card sheet opened meanwhile and the opener is outside it, the sheet keeps focus.
 */
export function useFocusReturn(open: boolean, fallback?: () => HTMLElement | null) {
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) opener.current = document.activeElement as HTMLElement | null;
  wasOpen.current = open;
  return (e: Event) => {
    e.preventDefault();
    const el = opener.current;
    const sheet = document.querySelector('[data-card-sheet]');
    if (sheet && !(el && sheet.contains(el))) return;
    if (el && el.isConnected && el !== document.body) el.focus();
    else (fallback?.() ?? document.getElementById('main'))?.focus({ preventScroll: true });
  };
}
