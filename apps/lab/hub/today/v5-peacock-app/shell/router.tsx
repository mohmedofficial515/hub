import { useSyncExternalStore, type ComponentProps, type MouseEvent } from 'react';
import type { CardAction } from '../kit/i18n';
import { rememberRecentCard } from '../kit/preferences';

/**
 * In-version hash router.
 *
 *   #/today/v5-peacock-app/<view>[/<cardKey>]?lang=ar&theme=dark&scenario=frontend[&action=decide&tab=comments]
 *
 * The lab frame reads only the first two segments and `lang` / `theme`, so everything after them is ours.
 * The lab toolbar rewrites the hash without our segments when language or theme change (a same-document
 * navigation, or a reload). The last path is kept in sessionStorage and restored whenever it is missing.
 */
export const VIEW_IDS = [
  'today',
  'inbox',
  'timeline',
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
] as const;
export type ViewId = (typeof VIEW_IDS)[number];
export type SheetTab = 'details' | 'comments' | 'history' | 'links';

export interface Route {
  /** Lab page + version segments, never hard-coded so the router survives a version rename. */
  base: string;
  view: ViewId;
  cardKey: string | null;
  query: URLSearchParams;
}

const STORAGE_KEY = 'hub-v5:last-path';
/** Query params that survive a view change. Anything else belongs to the view that set it. */
const KEEP = new Set(['lang', 'theme', 'scenario', 'w', 'notes', 'dir', 'live']);

const isView = (v: string | undefined): v is ViewId => !!v && (VIEW_IDS as readonly string[]).includes(v);

function split(hash: string) {
  const [path = '', search = ''] = hash.replace(/^#\/?/, '').split('?');
  return { segs: path.split('/').filter(Boolean), search };
}

function readStored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(path: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, path);
  } catch {
    /* Storage can be blocked in the lab iframe: restoring is a convenience, navigation still works. */
  }
}

/** Put the remembered view back when the hash has none. `replaceState` adds no history entry. */
function restoreIfMissing() {
  const { segs, search } = split(location.hash);
  if (segs.length !== 2) return;
  const stored = readStored();
  const path = stored && isView(stored.split('/')[0]) ? stored : 'today';
  history.replaceState(null, '', `${location.pathname}${location.search}#/${segs[0]}/${segs[1]}/${path}${search ? `?${search}` : ''}`);
}

let cached: { hash: string; route: Route } | null = null;

function snapshot(): Route {
  restoreIfMissing();
  if (cached?.hash === location.hash) return cached.route;
  const { segs, search } = split(location.hash);
  const route: Route = {
    base: `${segs[0] ?? ''}/${segs[1] ?? ''}`,
    view: isView(segs[2]) ? segs[2] : 'today',
    cardKey: segs[3] ?? null,
    query: new URLSearchParams(search),
  };
  writeStored(route.cardKey ? `${route.view}/${route.cardKey}` : route.view);
  cached = { hash: location.hash, route };
  return route;
}

function subscribe(notify: () => void) {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot);
}

/** Read the route outside React (event handlers). */
export const currentRoute = snapshot;

export interface HrefOptions {
  card?: string | null;
  /** `null` removes a param. Params not named keep their value only if the view stays the same. */
  query?: Record<string, string | null | undefined>;
}

export function hrefFor(view: ViewId, opts: HrefOptions = {}) {
  const route = snapshot();
  const params = new URLSearchParams();
  route.query.forEach((value, name) => {
    if (view === route.view || KEEP.has(name)) params.set(name, value);
  });
  for (const [name, value] of Object.entries(opts.query ?? {})) {
    if (value === null || value === undefined) params.delete(name);
    else params.set(name, value);
  }
  const search = params.toString();
  const card = opts.card ? `/${opts.card}` : '';
  return `#/${route.base}/${view}${card}${search ? `?${search}` : ''}`;
}

/** Same-document change that also reaches the lab frame's own hashchange listener. */
function go(hash: string, replace = false) {
  if (hash === location.hash) return;
  if (replace) {
    const from = location.href;
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL: from, newURL: location.href }));
  } else {
    location.hash = hash;
  }
}

export function navigate(view: ViewId, opts: HrefOptions & { replace?: boolean } = {}) {
  go(hrefFor(view, opts), opts.replace);
}

/** Set or clear query params on the current view, e.g. `setQuery({ status: 'ready' })`. */
export function setQuery(query: HrefOptions['query'], { replace = true }: { replace?: boolean } = {}) {
  const route = snapshot();
  go(hrefFor(route.view, { card: route.cardKey, query }), replace);
}

// ── The card sheet's URL ─────────────────────────────────────────────────────────────────────────

let opener: HTMLElement | null = null;

export interface OpenCardOptions {
  /** Open the sheet on this action: its form is shown and focused (Decide…, Deliver…). */
  action?: CardAction | null;
  tab?: SheetTab | null;
  /** The element focus returns to on close. Defaults to whatever has focus now. */
  opener?: HTMLElement | null;
}

/** Open any card over the current view. The URL carries the key, so a refresh or link keeps it open. */
export function openCard(key: string, opts: OpenCardOptions = {}) {
  const route = snapshot();
  // A link inside the sheet swaps the card; focus still returns to what opened the first one.
  if (!route.cardKey) opener = opts.opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  rememberRecentCard(key);
  go(hrefFor(route.view, { card: key, query: { action: opts.action ?? null, tab: opts.tab ?? null } }));
}

export function closeCard() {
  const route = snapshot();
  go(hrefFor(route.view, { card: null, query: { action: null, tab: null } }));
}

/** Handed to the sheet when it closes. One-shot. */
export function takeOpener() {
  const el = opener;
  opener = null;
  return el;
}

// ── Link ─────────────────────────────────────────────────────────────────────────────────────────

type AppLinkProps = Omit<ComponentProps<'a'>, 'href'> &
  ({ view: ViewId; query?: HrefOptions['query']; card?: undefined; action?: undefined } | { card: string; action?: CardAction; view?: undefined; query?: undefined });

/**
 * Link to a view, or to a card over the current view. It is a real `<a href>`, so open-in-new-tab works,
 * and a plain click stays inside the app. Reach for this rather than a button whenever the target is a place.
 */
export function AppLink({ view, card, action, query, onClick, ...rest }: AppLinkProps) {
  const current = useRoute();
  const href = card ? hrefFor(current.view, { card, query: { action: action ?? null, tab: null } }) : hrefFor(view!, { query });
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (card) openCard(card, { action, opener: e.currentTarget });
    else navigate(view!, { query });
  };
  return <a {...rest} href={href} onClick={handle} />;
}
