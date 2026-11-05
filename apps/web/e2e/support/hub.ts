/**
 * @file What the tests share: the page's own words, the test's project per language, a real MCP client, and the REST API as a member.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
  test as base,
} from '@playwright/test';

import { API_URL, WEB_URL } from './ports';
import { shared, storageFile } from './state';

export type Locale = 'ar' | 'en';

type Tree = { [key: string]: string | Tree };

/** A namespace of the page's catalog. A test finds a button by the words a person reads. */
export function words(locale: Locale, namespace: string): Tree {
  return JSON.parse(
    readFileSync(resolve(__dirname, `../../messages/${locale}/${namespace}.json`), 'utf8'),
  ) as Tree;
}

/** `word(tree, 'a.b')`, failing loudly when a catalog moved. */
export function word(tree: Tree, path: string): string {
  let node: string | Tree | undefined = tree;
  for (const part of path.split('.')) node = typeof node === 'object' ? node[part] : undefined;
  if (typeof node !== 'string') throw new Error(`No string at ${path}`);
  return node;
}

export interface McpSession {
  /** Calls a tool and answers its Markdown. Throws on an error result. */
  call(name: string, args?: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

/** A real MCP client over HTTP with a real token, as Claude Code connects (docs/05 §3.2). */
export async function mcp(project: string, token = shared().token): Promise<McpSession> {
  const transport = new StreamableHTTPClientTransport(new URL(`${API_URL}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}`, 'X-Hub-Project': project } },
  });
  const client = new Client({ name: 'hub-e2e', version: '1' });
  await client.connect(transport);
  return {
    async call(name, args = {}) {
      const answer = (await client.callTool({ name, arguments: args })) as {
        isError?: boolean;
        content: { type: string; text: string }[];
      };
      const text = answer.content.map((part) => part.text).join('\n');
      if (answer.isError) throw new Error(`${name}: ${text}`);
      return text;
    },
    close: () => client.close(),
  };
}

/** The first card key in an MCP answer. */
export function keyIn(text: string, project: string): string {
  const prefix = project === 'e2e-ar' ? 'EAR' : 'EEN';
  const match = new RegExp(`${prefix}-\\d+`).exec(text);
  if (!match) throw new Error(`No card key in: ${text}`);
  return match[0];
}

const HEADERS = { 'X-Requested-With': 'hub' };

export class Rest {
  constructor(
    readonly context: APIRequestContext,
    readonly ws: string,
  ) {}

  private async answer<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
    if (!response.ok()) throw new Error(`${response.url()} ${response.status()} ${await response.text()}`);
    const text = await response.text();
    return (text ? (JSON.parse(text) as { data: T }).data : undefined) as T;
  }

  get<T = Record<string, unknown>>(path: string) {
    return this.context.get(`/api/v1/${path}`).then((r) => this.answer<T>(r));
  }

  post<T = Record<string, unknown>>(path: string, data: unknown = {}) {
    return this.context.post(`/api/v1/${path}`, { data, headers: HEADERS }).then((r) => this.answer<T>(r));
  }

  card<T = Record<string, unknown>>(key: string) {
    return this.get<T>(`workspaces/${this.ws}/cards/${key}`);
  }

  create(body: Record<string, unknown>) {
    return this.post<{ key: string; id: string }>(`workspaces/${this.ws}/cards`, body);
  }
}

export async function asPerson(browser: Browser, who: string) {
  const context = await browser.newContext({
    baseURL: WEB_URL,
    storageState: storageFile(who),
    viewport: { width: 1440, height: 900 },
  });
  return context;
}

interface Fixtures {
  locale: Locale;
  ws: string;
  ownerContext: BrowserContext;
  page: Page;
  owner: Rest;
  member: (who: string) => Promise<{ page: Page; rest: Rest }>;
}

/** Every test opens a project of its language, as the owner unless it asks for someone else. */
export const test = base.extend<Fixtures>({
  locale: async ({}, use, info) => {
    await use((info.project.metadata as { hubLocale: Locale }).hubLocale);
  },
  ws: async ({ locale }, use) => {
    await use(`e2e-${locale}`);
  },
  ownerContext: async ({ browser }, use) => {
    const context = await asPerson(browser, 'owner');
    await use(context);
    await context.close();
  },
  page: async ({ ownerContext }, use) => {
    const page = await ownerContext.newPage();
    await use(page);
    await page.close();
  },
  owner: async ({ ownerContext, ws }, use) => {
    await use(new Rest(ownerContext.request, ws));
  },
  member: async ({ browser, ws }, use) => {
    const opened: BrowserContext[] = [];
    await use(async (who) => {
      const context = await asPerson(browser, who);
      opened.push(context);
      return { page: await context.newPage(), rest: new Rest(context.request, ws) };
    });
    await Promise.all(opened.map((context) => context.close()));
  },
});

export { expect } from '@playwright/test';

export const view = (locale: Locale, ws: string, name: string, query = '') =>
  `/${locale}/${ws}/${name}${query ? `?${query}` : ''}`;

/** The live stream is open: until then a change could only arrive by refetch, which is not what these tests measure. */
export async function waitForLive(page: Page) {
  await page.locator('[data-live="live"]').first().waitFor({ timeout: 30_000 });
}
