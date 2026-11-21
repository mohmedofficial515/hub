import { useSyncExternalStore } from 'react';

/**
 * Per-member UI preferences (08 §10): localStorage, never synced to the server. Every read and write is
 * guarded because storage can be blocked inside the lab iframe; the page then simply uses the defaults.
 */
interface Prefs {
  /** WCAG 2.1.4: single-key shortcuts can be turned off. Ctrl/Cmd combos and Esc stay on. */
  shortcuts: boolean;
  /** null = follow the width rule (08 §7: expanded from 1280 px, icons from 1024 px). */
  sidebarCollapsed: boolean | null;
}

const KEY = 'hub-v5:prefs';
const DEFAULTS: Prefs = { shortcuts: true, sidebarCollapsed: null };

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let prefs = load();
const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function setPreference<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  prefs = { ...prefs, [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* Kept in memory for this session. */
  }
  listeners.forEach((l) => l());
}

export function usePreference<K extends keyof Prefs>(key: K): Prefs[K] {
  return useSyncExternalStore(subscribe, () => prefs[key]);
}

/** For key handlers, which read the value at event time. */
export const shortcutsEnabled = () => prefs.shortcuts;

// ── Recent cards (palette group, 08 §5.5) ────────────────────────────────────────────────────────

const RECENT_KEY = 'hub-v5:recent-cards';

export function readRecentCards(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function rememberRecentCard(key: string) {
  try {
    const next = [key, ...readRecentCards().filter((k) => k !== key)].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* The palette falls back to its seed list. */
  }
}
