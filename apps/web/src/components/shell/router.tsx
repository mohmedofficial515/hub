'use client';

/**
 * @file router.tsx
 * @description The design's router API on Next.js routes. `/[locale]/[ws]/<view>`; the sheet is `?card=GTV-123&action=&tab=` over
 * the current page (docs/08 §5.3). Query-only changes use `history.pushState`, which Next keeps in sync with `useSearchParams`,
 * so opening a card or setting a filter never asks the server for anything. Kept as plain functions because event handlers,
 * the palette and the keyboard list call them outside React.
 */
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ComponentProps, type MouseEvent, useEffect, useMemo } from 'react';

import type { CardAction } from '@/lib/i18n';
import { rememberRecentCard } from '@/lib/preferences';

export const VIEW_IDS = [
  'today',
  'inbox',
  'timeline',
  'planning',
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
  locale: string;
  ws: string;
  view: ViewId;
  cardKey: string | null;
  query: URLSearchParams;
}

const SHEET_PARAMS = ['card', 'action', 'tab'];

const isView = (v: string | undefined): v is ViewId => !!v && (VIEW_IDS as readonly string[]).includes(v);

export function parseRoute(pathname: string, search: string | URLSearchParams): Route {
  const [locale = 'ar', ws = '', view] = pathname.split('/').filter(Boolean);
  const query = new URLSearchParams(search);
  return { locale, ws, view: isView(view) ? view : 'today', cardKey: query.get('card'), query };
}

export function useRoute(): Route {
  const pathname = usePathname();
  const search = useSearchParams();
  const raw = search.toString();
  return useMemo(() => parseRoute(pathname, raw), [pathname, raw]);
}

/** Read the route outside React (event handlers). */
export const currentRoute = (): Route => parseRoute(window.location.pathname, window.location.search);

export interface HrefOptions {
  card?: string | null | undefined;
  /** `null` removes a param. Params not named keep their value only if the view stays the same. */
  query?: Record<string, string | null | undefined> | undefined;
}

export function buildHref(route: Route, view: ViewId, opts: HrefOptions = {}) {
  const params = new URLSearchParams();
  if (view === route.view) route.query.forEach((value, name) => params.set(name, value));
  params.delete('card');
  if (opts.card) params.set('card', opts.card);
  else if (opts.card === undefined && view === route.view && route.cardKey) params.set('card', route.cardKey);
  for (const [name, value] of Object.entries(opts.query ?? {})) {
    if (value === null || value === undefined) params.delete(name);
    else params.set(name, value);
  }
  const search = params.toString();
  return `/${route.locale}/${route.ws}/${view}${search ? `?${search}` : ''}`;
}

export const hrefFor = (view: ViewId, opts: HrefOptions = {}) => buildHref(currentRoute(), view, opts);

type NextRouter = ReturnType<typeof useRouter>;
let router: NextRouter | null = null;

/** Lets the plain functions below reach Next's router. Mounted once by the shell. */
export function RouterBridge() {
  const next = useRouter();
  useEffect(() => {
    router = next;
    return () => {
      router = null;
    };
  }, [next]);
  return null;
}

const here = () => `${window.location.pathname}${window.location.search}`;

function goQuery(href: string, replace = false) {
  if (href === here()) return;
  if (replace) window.history.replaceState(null, '', href);
  else window.history.pushState(null, '', href);
}

/** Leave this app's current page for any path of the app, for example another project. */
export function goTo(path: string) {
  if (router) router.push(path);
  else window.location.assign(path);
}

export function navigate(view: ViewId, opts: HrefOptions & { replace?: boolean } = {}) {
  const route = currentRoute();
  const href = buildHref(route, view, { card: opts.card ?? null, query: opts.query });
  if (view === route.view) {
    goQuery(href, opts.replace);
    return;
  }
  if (router) {
    if (opts.replace) router.replace(href);
    else router.push(href);
  } else {
    window.location.assign(href);
  }
}

/** Set or clear query params on the current view, e.g. `setQuery({ status: 'ready' })`. */
export function setQuery(query: HrefOptions['query'], { replace = true }: { replace?: boolean } = {}) {
  const route = currentRoute();
  goQuery(buildHref(route, route.view, { query }), replace);
}

// ── The card sheet's URL ─────────────────────────────────────────────────────────────────────────

let opener: HTMLElement | null = null;

export interface OpenCardOptions {
  /** Open the sheet on this action: its form is shown and focused (Decide…, Deliver…). */
  action?: CardAction | null | undefined;
  tab?: SheetTab | null | undefined;
  /** The element focus returns to on close. Defaults to whatever has focus now. */
  opener?: HTMLElement | null | undefined;
}

/** Open any card over the current view. The URL carries the key, so a refresh or link keeps it open. */
export function openCard(key: string, opts: OpenCardOptions = {}) {
  const route = currentRoute();
  // A link inside the sheet swaps the card; focus still returns to what opened the first one.
  if (!route.cardKey) {
    opener = opts.opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  }
  rememberRecentCard(key);
  goQuery(
    buildHref(route, route.view, {
      card: key,
      query: { action: opts.action ?? null, tab: opts.tab ?? null },
    }),
  );
}

export function closeCard() {
  const route = currentRoute();
  goQuery(
    buildHref(route, route.view, {
      card: null,
      query: Object.fromEntries(SHEET_PARAMS.map((name) => [name, null])),
    }),
  );
}

/** Handed to the sheet when it closes. One-shot. */
export function takeOpener() {
  const el = opener;
  opener = null;
  return el;
}

// ── Link ─────────────────────────────────────────────────────────────────────────────────────────

type AppLinkProps = Omit<ComponentProps<'a'>, 'href'> &
  (
    | { view: ViewId; query?: HrefOptions['query']; card?: undefined; action?: undefined }
    | { card: string; action?: CardAction | undefined; view?: undefined; query?: undefined }
  );

/**
 * Link to a view, or to a card over the current view. It is a real `<a href>`, so open-in-new-tab works,
 * and a plain click stays inside the app. Reach for this rather than a button whenever the target is a place.
 */
export function AppLink({ view, card, action, query, onClick, ...rest }: AppLinkProps) {
  const current = useRoute();
  const href = card
    ? buildHref(current, current.view, { card, query: { action: action ?? null, tab: null } })
    : buildHref(current, view!, { card: null, query });
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (card) openCard(card, { action, opener: e.currentTarget });
    else navigate(view!, { query });
  };
  return <a {...rest} href={href} onClick={handle} />;
}
