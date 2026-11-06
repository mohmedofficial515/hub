/**
 * @file Starts the stack, then makes the people and projects the tests share: one project per language, an accountant, a frontend
 * member and a backend member with their own sessions, and an MCP token for the owner. Sign-in is limited to 10 a minute, so tests reuse
 * these sessions rather than signing in each time.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { type APIRequestContext, request } from '@playwright/test';

import { WEB_URL } from './ports';
import { OWNER, startStack } from './stack';
import { stackHolder } from './stack-holder';
import { type Person, type Shared, SHARED_FILE, storageFile } from './state';

const HEADERS = { 'X-Requested-With': 'hub' };

async function unwrap<T>(response: Awaited<ReturnType<APIRequestContext['post']>>): Promise<T> {
  if (!response.ok()) throw new Error(`${response.url()} ${response.status()} ${await response.text()}`);
  return ((await response.json()) as { data: T }).data;
}

async function acceptInvite(owner: APIRequestContext, slug: string, email: string, roles: string[]) {
  const invite = await unwrap<{ url: string }>(
    await owner.post(`/api/v1/workspaces/${slug}/invites`, { data: { email, roles }, headers: HEADERS }),
  );
  return invite.url.slice(invite.url.lastIndexOf('/') + 1);
}

export default async function globalSetup() {
  stackHolder.stack = await startStack();
  mkdirSync(dirname(SHARED_FILE), { recursive: true });

  const owner = await request.newContext({ baseURL: WEB_URL });
  const signedIn = await owner.post('/api/v1/auth/sign-in', {
    data: { email: OWNER.email, password: OWNER.password },
    headers: HEADERS,
  });
  if (!signedIn.ok()) throw new Error(`Owner sign-in: ${signedIn.status()} ${await signedIn.text()}`);
  await owner.storageState({ path: storageFile('owner') });

  for (const [slug, prefix] of [
    ['e2e-ar', 'EAR'],
    ['e2e-en', 'EEN'],
  ] as const) {
    await unwrap(
      await owner.post('/api/v1/workspaces', {
        data: { slug, name: `E2E ${slug.slice(-2)}`, keyPrefix: prefix },
        headers: HEADERS,
      }),
    );
  }

  const people: Record<string, Person> = {};
  const password = 'Member-pass-e2e-12345';
  for (const [name, roles] of [
    ['accountant', ['accountant']],
    ['frontend', ['frontend']],
    ['backend', ['backend']],
    ['manager', ['owner', 'pm', 'accountant']],
  ] as const) {
    const email = `${name}@e2e.test`;
    const context = await request.newContext({ baseURL: WEB_URL });
    const first = await acceptInvite(owner, 'e2e-ar', email, [...roles]);
    const joined = await context.post(`/api/v1/auth/invites/${first}/accept`, {
      data: { displayName: name, password, locale: 'en' },
      headers: HEADERS,
    });
    if (!joined.ok()) throw new Error(`Join ${name}: ${joined.status()} ${await joined.text()}`);
    const second = await acceptInvite(owner, 'e2e-en', email, [...roles]);
    const joinedToo = await context.post(`/api/v1/auth/invites/${second}/accept`, {
      data: {},
      headers: HEADERS,
    });
    if (!joinedToo.ok()) throw new Error(`Join ${name}: ${joinedToo.status()} ${await joinedToo.text()}`);
    await context.storageState({ path: storageFile(name) });
    const me = await unwrap<{ id: string }>(await context.get('/api/v1/auth/me'));
    const theirs = await unwrap<{ token: string }>(
      await context.post('/api/v1/me/tokens', { data: { name: 'e2e', kind: 'mcp' }, headers: HEADERS }),
    );
    people[name] = { id: me.id, email, name, token: theirs.token };
    await context.dispose();
  }

  const made = await unwrap<{ token: string }>(
    await owner.post('/api/v1/me/tokens', { data: { name: 'e2e', kind: 'mcp' }, headers: HEADERS }),
  );
  const ownerMe = await unwrap<{ id: string }>(await owner.get('/api/v1/auth/me'));
  await owner.dispose();

  const shared: Shared = {
    token: made.token,
    labRoot: stackHolder.stack.labRoot,
    apiEnv: stackHolder.stack.scriptEnv,
    owner: { id: ownerMe.id, email: OWNER.email, name: OWNER.name, token: made.token },
    people,
  };
  writeFileSync(SHARED_FILE, JSON.stringify(shared));
}
