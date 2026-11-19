// Internal routing kept in the frame hash (`#/settings/v3-search-first?lang=ar&theme=light&view=group&g=security&f=lockout.maxFailures`),
// so every view and every field has a deep link and the browser Back button works. The lab's own params are kept.

import { useEffect, useState } from 'react';

export type Route =
  | { view: 'home' }
  | { view: 'group'; group: string; field?: string }
  | { view: 'prefs'; field?: string };

const OWN = ['view', 'g', 'f'];

function split(): { path: string; params: URLSearchParams } {
  const [path, query = ''] = location.hash.split('?');
  return { path, params: new URLSearchParams(query) };
}

export function readRoute(): Route {
  const { params } = split();
  const view = params.get('view');
  if (view === 'group' && params.get('g')) return { view: 'group', group: params.get('g')!, field: params.get('f') ?? undefined };
  if (view === 'prefs') return { view: 'prefs', field: params.get('f') ?? undefined };
  return { view: 'home' };
}

export function hrefFor(route: Route): string {
  const { path, params } = split();
  OWN.forEach((k) => params.delete(k));
  if (route.view !== 'home') params.set('view', route.view);
  if (route.view === 'group') params.set('g', route.group);
  if (route.view !== 'home' && route.field) params.set('f', route.field);
  return `${path}?${params.toString()}`;
}

export function navigate(route: Route) {
  const next = hrefFor(route);
  if (next !== location.hash) location.hash = next;
}

/** A one-off param read at start (`q`, `chips`, `as`, `scenario`) for demos and screenshots. */
export function startParam(name: string): string | null {
  return split().params.get(name);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/** Absolute link to a field, for "Copy link". */
export function fieldLink(route: Route): string {
  return `${location.origin}${location.pathname}${hrefFor(route)}`;
}
