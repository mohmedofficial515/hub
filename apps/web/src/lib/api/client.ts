/**
 * @file client.ts
 * @description The one HTTP client: ky with the CSRF header, the locale, a single refresh-and-retry on 401, and error
 * unwrapping to HubError (docs/04 §1.6, §5). The generated SDK in `./generated` runs through the same instance, and
 * `get`, `post`, `patch`, `del` cover what the snapshot does not have yet.
 */
import ky, { isHTTPError, type KyInstance, type Options } from 'ky';

import { toHubError } from './errors';
import { client as generatedClient } from './generated/client.gen';

export const API_PREFIX = '/api/v1';

const REFRESH_PATH = `${API_PREFIX}/auth/refresh`;
const NO_REFRESH = [`${API_PREFIX}/auth/sign-in`, `${API_PREFIX}/auth/totp/verify`, REFRESH_PATH];

/** Failures that say the credentials themselves are wrong. Refreshing cannot help, and only these skip it. */
const NOT_REFRESHABLE = new Set([
  'hub.identity.invalid_credentials',
  'hub.identity.totp_invalid',
  'hub.identity.totp_required',
  'hub.identity.refresh_invalid',
  'hub.identity.token_invalid',
  'hub.identity.token_revoked',
]);

const REFRESHED_AT = 'hub:refreshed-at';
const JUST_REFRESHED_MS = 10_000;

function refreshedRecently() {
  try {
    return Date.now() - Number(localStorage.getItem(REFRESHED_AT) ?? 0) < JUST_REFRESHED_MS;
  } catch {
    return false;
  }
}

async function refreshOnce(): Promise<boolean> {
  // Another tab finished while this one waited for the lock: its new cookies are ours too.
  if (refreshedRecently()) return true;
  const response = await fetch(REFRESH_PATH, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'hub' },
  }).catch(() => null);
  if (!response?.ok) return false;
  try {
    localStorage.setItem(REFRESHED_AT, String(Date.now()));
  } catch {
    /* The lock still orders the tabs; the next one refreshes again, in turn. */
  }
  return true;
}

/** One refresh at a time in this tab: ten queries that hit 401 together share it. */
let refreshing: Promise<boolean> | null = null;

/**
 * One at a time across tabs too: the API treats a parallel refresh as token reuse and revokes the whole family. Web Locks needs a secure context,
 * which localhost and the HTTPS host both are.
 */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const locked = async (): Promise<boolean> => navigator.locks.request('hub-refresh', refreshOnce);
  const run = navigator.locks ? locked() : refreshOnce();
  const current = run.finally(() => {
    refreshing = null;
  });
  refreshing = current;
  return current;
}

/** A role here requires TOTP and the member has not enrolled: every project route answers 403 until they do (docs/04 §1.6). */
export const totpSetupPath = (locale: string, pathname: string, search: string) =>
  `/${locale}/totp?setup=1&next=${encodeURIComponent(pathname + search)}`;

function goToTotpSetup() {
  const { pathname, search } = window.location;
  if (!pathname.endsWith('/totp')) window.location.assign(totpSetupPath(currentLocale(), pathname, search));
}

async function errorCode(response: Response) {
  try {
    return ((await response.clone().json()) as { error?: { code?: string } }).error?.code;
  } catch {
    return undefined;
  }
}

type SignedOutListener = () => void;
const signedOutListeners = new Set<SignedOutListener>();

/** The shell listens: when refresh fails, the session is over and the member goes to sign-in. */
export function onSignedOut(listener: SignedOutListener) {
  signedOutListeners.add(listener);
  return () => {
    signedOutListeners.delete(listener);
  };
}

function currentLocale() {
  return typeof document === 'undefined' ? 'ar' : document.documentElement.lang || 'ar';
}

export const http: KyInstance = ky.create({
  // Read at call time, so a test or a polyfill can replace it.
  fetch: (...args) => globalThis.fetch(...args),
  credentials: 'same-origin',
  retry: 0,
  timeout: 30_000,
  headers: { 'X-Requested-With': 'hub' },
  hooks: {
    beforeRequest: [
      ({ request }) => {
        request.headers.set('Accept-Language', currentLocale());
      },
    ],
    afterResponse: [
      async ({ request, response }) => {
        if (response.status === 403) {
          if ((await errorCode(response)) === 'hub.identity.totp_setup_required') goToTotpSetup();
          return response;
        }
        const path = new URL(request.url, 'http://hub.local').pathname;
        if (response.status !== 401 || NO_REFRESH.some((p) => path.startsWith(p))) return response;
        if (NOT_REFRESHABLE.has((await errorCode(response)) ?? '')) return response;
        if (await refreshSession()) return ky(request.clone(), { retry: 0, throwHttpErrors: false });
        signedOutListeners.forEach((listener) => listener());
        return response;
      },
    ],
    beforeError: [({ error }) => (isHTTPError(error) ? toHubError(error.response, error.data) : error)],
  },
});

generatedClient.setConfig({ ky: http, baseUrl: '' });

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  total: number | undefined;
}

interface SuccessEnvelope<T> {
  data: T;
  meta?: { pagination?: { nextCursor: string | null; limit: number; total?: number } };
}

type Query = Record<string, string | number | boolean | readonly string[] | null | undefined>;

/** `{ a: ['x', 'y'], b: undefined }` becomes `a=x&a=y`. */
export function toSearchParams(query: Query = {}) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) (value as readonly string[]).forEach((v) => params.append(name, v));
    else params.set(name, String(value));
  }
  return params;
}

const url = (path: string) => `${API_PREFIX}/${path.replace(/^\//, '')}`;

async function unwrap<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 202) return undefined as T;
  return ((await response.json()) as SuccessEnvelope<T>).data;
}

export async function get<T>(path: string, query?: Query, options?: Options): Promise<T> {
  return unwrap<T>(await http.get(url(path), { searchParams: toSearchParams(query), ...options }));
}

export async function getPage<T>(path: string, query?: Query): Promise<Paginated<T>> {
  const body = await http
    .get(url(path), { searchParams: toSearchParams(query) })
    .json<SuccessEnvelope<T[]>>();
  return {
    items: body.data,
    nextCursor: body.meta?.pagination?.nextCursor ?? null,
    total: body.meta?.pagination?.total,
  };
}

export async function post<T>(path: string, json?: unknown, options?: Options): Promise<T> {
  return unwrap<T>(await http.post(url(path), { ...(json === undefined ? {} : { json }), ...options }));
}

export async function patch<T>(path: string, json: unknown): Promise<T> {
  return unwrap<T>(await http.patch(url(path), { json }));
}

export async function put<T>(path: string, json: unknown): Promise<T> {
  return unwrap<T>(await http.put(url(path), { json }));
}

export async function del<T>(path: string, json?: unknown): Promise<T> {
  return unwrap<T>(await http.delete(url(path), json === undefined ? {} : { json }));
}
