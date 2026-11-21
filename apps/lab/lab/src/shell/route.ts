import { useEffect, useState } from 'react';
import type { App } from '../core/registry';
import { readMode, type ViewMode } from '../core/view';

export type Width = 390 | 768 | 1440 | 'fill';
export const WIDTHS: { value: Width; label: string }[] = [
  { value: 390, label: 'Mobile' },
  { value: 768, label: 'Tablet' },
  { value: 1440, label: 'Desktop' },
  { value: 'fill', label: 'Fill' },
];

export interface Route extends ViewMode {
  app: App | null;
  page: string | null;
  a: string | null;
  b: string | null; // compare target; null = single view
  width: Width;
  notes: boolean;
  scenario: string;
}

/**
 * `#/<app>/<page>/<version>?w=390&lang=ar&theme=dark&notes=1`
 * `#/compare/<app>/<page>/<a>/<b>?…`
 */
export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const segs = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);
  const compare = segs[0] === 'compare';
  const [app, page, a, b] = compare ? segs.slice(1) : segs;
  const w = params.get('w');
  return {
    ...readMode(params),
    app: app === 'web' || app === 'dashboard' || app === 'hub' ? app : null,
    page: page ?? null,
    a: a ?? null,
    b: compare ? (b ?? null) : null,
    width: w === 'fill' ? 'fill' : w === '390' ? 390 : w === '768' ? 768 : 1440,
    notes: params.get('notes') === '1',
    scenario: params.get('scenario') ?? 'default',
  };
}

export function formatRoute(r: Route): string {
  const head = r.b ? ['compare', r.app, r.page, r.a, r.b] : [r.app, r.page, r.a];
  const path = head.filter(Boolean).map((s) => encodeURIComponent(s!)).join('/');
  const params = new URLSearchParams({ w: String(r.width), lang: r.lang, theme: r.theme });
  if (r.notes) params.set('notes', '1');
  if (r.scenario !== 'default') params.set('scenario', r.scenario);
  return `#/${path}?${params}`;
}

export function useRoute(): [Route, (patch: Partial<Route>) => void] {
  const [route, setRoute] = useState(() => parseRoute(location.hash));

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const update = (patch: Partial<Route>) => {
    location.hash = formatRoute({ ...route, ...patch });
  };
  return [route, update];
}
