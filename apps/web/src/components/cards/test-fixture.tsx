/**
 * @file test-fixture.tsx
 * @description For the sheet's specs: a task in the API's shape, and a stubbed API that answers the sheet's reads from it. Not shipped.
 */
import { Tooltip } from 'radix-ui';

import { getQueryClient } from '@/lib/query-client';
import { renderWithApp, stubFetch } from '@/test/render';

import { CardSheet } from './card-sheet';

export const ME = 'u1';
export const OTHER = 'u2';

export interface Dto {
  key: string;
  type: string;
  status: string;
  detail?: Record<string, unknown>;
  links?: { kind: string; card: Record<string, unknown> }[];
  allowedActions?: string[];
  [field: string]: unknown;
}

export const summary = (key: string, fields: Record<string, unknown> = {}) => ({
  id: key,
  key,
  type: 'task',
  title: `Card ${key}`,
  status: 'ready',
  priority: 'P2',
  ownerRole: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  lastEventAt: '2026-11-01T10:00:00.000Z',
  flags: {},
  tags: [],
  ...fields,
});

export const task = (fields: Partial<Dto> = {}, detail: Record<string, unknown> = {}): Dto => ({
  ...summary('DMO-1'),
  createdBy: { kind: 'user', userId: OTHER, displayName: 'Ali', via: 'web' },
  body: null,
  links: [],
  watchers: [],
  watching: false,
  allowedActions: ['card.edit_content', 'card.edit_routing', 'task.edit_detail', 'card.delete'],
  ...fields,
  detail: { specialty: 'frontend', origin: 'manual', ...detail },
  type: 'task',
  key: fields.key ?? 'DMO-1',
  status: fields.status ?? 'ready',
});

const page = (data: unknown[]) => ({ body: { data, meta: { pagination: { nextCursor: null } } } });

export interface Api {
  card: Dto;
  events?: unknown[];
  comments?: unknown[];
  members?: unknown[];
  roles?: string[];
  /** Answers checked before the defaults, for writes and extra reads. */
  extra?: (url: URL, method: string) => { status?: number; body?: unknown } | undefined;
}

export function stubApi(api: Api) {
  return stubFetch((url, init, request) => {
    const method = request?.method ?? init?.method ?? 'GET';
    const own = api.extra?.(url, method);
    if (own) return own;
    const p = url.pathname;
    if (p.endsWith('/auth/me')) {
      return {
        body: {
          data: {
            id: ME,
            displayName: 'Owner',
            avatarColor: 'teal',
            workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles: api.roles ?? ['owner'] }],
          },
        },
      };
    }
    if (method !== 'GET') return undefined;
    if (p.endsWith('/members'))
      return page(api.members ?? [{ id: ME, displayName: 'Owner', roles: api.roles ?? ['owner'] }]);
    if (p.endsWith(`/cards/${api.card.key}/events`)) return page(api.events ?? []);
    if (p.endsWith(`/cards/${api.card.key}/comments`)) return page(api.comments ?? []);
    if (p.endsWith(`/cards/${api.card.key}`)) return { body: { data: api.card } };
    return undefined;
  });
}

export function renderSheet(search: string, locale: 'ar' | 'en' = 'en') {
  window.history.replaceState(null, '', `/${locale}/demo/tasks?${search}`);
  // The app's own client: writes and `getCard` read it, as in the app.
  const client = getQueryClient();
  client.clear();
  client.setDefaultOptions({ queries: { retry: false } });
  return renderWithApp(
    <Tooltip.Provider>
      <CardSheet />
    </Tooltip.Provider>,
    { locale, client },
  );
}

export const sheetQuery = () => new URLSearchParams(window.location.search);
