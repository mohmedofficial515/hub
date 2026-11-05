/**
 * @file Render helper: the real catalogs, a fresh query client, and a stubbed `fetch` that answers from a table.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

import arAuth from '../../messages/ar/auth.json';
import arDecisions from '../../messages/ar/decisions.json';
import arKit from '../../messages/ar/kit.json';
import arPlanning from '../../messages/ar/planning.json';
import arShell from '../../messages/ar/shell.json';
import arTasks from '../../messages/ar/tasks.json';
import arWorkspaces from '../../messages/ar/workspaces.json';
import enAuth from '../../messages/en/auth.json';
import enDecisions from '../../messages/en/decisions.json';
import enKit from '../../messages/en/kit.json';
import enPlanning from '../../messages/en/planning.json';
import enShell from '../../messages/en/shell.json';
import enTasks from '../../messages/en/tasks.json';
import enWorkspaces from '../../messages/en/workspaces.json';

const catalogs = {
  ar: {
    kit: arKit,
    shell: arShell,
    auth: arAuth,
    workspaces: arWorkspaces,
    tasks: arTasks,
    decisions: arDecisions,
    planning: arPlanning,
  },
  en: {
    kit: enKit,
    shell: enShell,
    auth: enAuth,
    workspaces: enWorkspaces,
    tasks: enTasks,
    decisions: enDecisions,
    planning: enPlanning,
  },
};

export function renderWithApp(
  ui: ReactNode,
  { locale = 'en', client }: { locale?: 'ar' | 'en'; client?: QueryClient } = {},
) {
  const queryClient = client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  return {
    queryClient,
    ...render(
      <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="Europe/Istanbul">
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
      </NextIntlClientProvider>,
    ),
  };
}

export type Reply = { status?: number; body?: unknown };
export type Route = (url: URL, init: RequestInit | undefined, request?: Request) => Reply | undefined;

/** Replaces `fetch`. An unmatched request answers 404 in the API's envelope, so a test sees what a missing endpoint does. */
export function stubFetch(route: Route) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fake = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : undefined;
    const raw = request ? request.url : input instanceof URL ? input.href : (input as string);
    const url = new URL(raw, 'http://hub.local');
    const method = request?.method ?? init?.method ?? 'GET';
    const text = request ? await request.clone().text() : typeof init?.body === 'string' ? init.body : '';
    calls.push({ method, path: url.pathname, body: text ? (JSON.parse(text) as unknown) : undefined });
    const reply = route(url, init, request) ?? {
      status: 404,
      body: { error: { code: 'hub.common.not_found', message: 'none' } },
    };
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fake);
  return { fake, calls };
}
