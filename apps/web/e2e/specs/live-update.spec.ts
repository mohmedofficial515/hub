/**
 * @file The acceptance test of docs/15 §1 and §7: a real MCP HTTP call with a real token changes an open page within one second, with
 * no navigation and no reload, for create, edit, delete and decide. The clock starts before the call leaves. Timings go to
 * `test-results/live-timings.jsonl`, so a run reports real numbers.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { Page } from '@playwright/test';

import { expect, keyIn, mcp, test, view, waitForLive } from '../support/hub';
import { shared } from '../support/state';

const TIMINGS = resolve(__dirname, '../../test-results/live-timings.jsonl');
const LIMIT_MS = Number(process.env['E2E_LIVE_LIMIT_MS'] ?? 1000);
const ROUNDS = 3;

/** The number on a sidebar item: the one link to this view that wears a badge (a breadcrumb links there too). No badge means zero. */
function readCount(name: string): number {
  const badge = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
    .filter((a) => new URL(a.href).pathname.endsWith(`/${name}`))
    .map((a) => a.querySelector('span.tabular-nums'))
    .find(Boolean);
  return badge ? Number(badge.textContent?.trim()) : 0;
}

const countOf = (page: Page, item: string) => page.evaluate(readCount, item);

async function untilCount(page: Page, item: string, value: number) {
  await page.waitForFunction(
    ([name, wanted]) => {
      const badge = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
        .filter((a) => new URL(a.href).pathname.endsWith(`/${name}`))
        .map((a) => a.querySelector('span.tabular-nums'))
        .find(Boolean);
      return (badge ? Number(badge.textContent?.trim()) : 0) === wanted;
    },
    [item, value] as const,
    { polling: 'raf', timeout: 15_000 },
  );
}

/** Starts the clock, makes the call, and answers how long each visible change took. */
async function measure(
  label: string,
  call: () => Promise<string>,
  changes: Record<string, () => Promise<unknown>>,
  context: { locale: string },
) {
  const started = Date.now();
  const sent = call().then((text) => ({ text, at: Date.now() - started }));
  // A refused call fails at once, with its own words, rather than as a timeout on the page.
  const refused = sent.then(() => new Promise<never>(() => undefined));
  const seen = await Promise.race([
    refused,
    Promise.all(
      Object.entries(changes).map(async ([name, change]) => {
        await change();
        return [name, Date.now() - started] as const;
      }),
    ),
  ]);
  const { text, at } = await sent;
  const entry = { label, locale: context.locale, mcpMs: at, ...Object.fromEntries(seen) };
  mkdirSync(dirname(TIMINGS), { recursive: true });
  appendFileSync(TIMINGS, `${JSON.stringify(entry)}\n`);
  for (const [name, ms] of seen) {
    expect(ms, `${label}: ${name} after ${ms} ms (MCP answered at ${at} ms)`).toBeLessThanOrEqual(LIMIT_MS);
  }
  return text;
}

/** Nothing in flight, so each round measures one change and not the last one's tail. */
const settle = (page: Page) => page.waitForTimeout(1500);

/** The page and its sidebar numbers have answered, so a number read now is the real one. */
async function open(page: Page, url: string) {
  const counted = Promise.all([
    page.waitForResponse((response) => response.url().includes('awaiting=me') && response.ok()),
    page.waitForResponse((response) => response.url().includes('/tasks/ready') && response.ok()),
  ]);
  await page.goto(url);
  await counted;
  await waitForLive(page);
  await page.evaluate(() => {
    (window as unknown as { __notReloaded: boolean }).__notReloaded = true;
  });
  await settle(page);
}

async function assertNoNavigation(page: Page, navigations: { count: number }) {
  expect(navigations.count).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __notReloaded?: boolean }).__notReloaded)).toBe(
    true,
  );
}

function watchNavigation(page: Page) {
  const navigations = { count: 0, on: false };
  page.on('framenavigated', (frame) => {
    if (navigations.on && frame === page.mainFrame()) navigations.count += 1;
  });
  return navigations;
}

test.describe('live updates through MCP', () => {
  // The sidebar's Tasks number counts tasks ready for the member's roles, so this one is a backend member and their own Claude Code. The owner watches too.
  test('a task created, edited and deleted through MCP changes the open Tasks page', async ({
    page: ownerPage,
    member,
    locale,
    ws,
  }) => {
    const { page } = await member('backend');
    const navigations = watchNavigation(page);
    await open(page, view(locale, ws, 'tasks'));
    await open(ownerPage, view(locale, ws, 'tasks'));
    navigations.on = true;
    const claude = await mcp(ws, shared().people['backend']?.token);
    try {
      for (let round = 0; round < ROUNDS; round += 1) {
        const before = await countOf(page, 'tasks');
        const title = `Live task ${locale} ${round} ${Date.now()}`;
        const created = await measure(
          'task create',
          () =>
            claude.call('create_task', {
              title,
              priority: 'P1',
              specialty: 'backend',
              acceptance: 'It works',
            }),
          {
            row: () => page.getByText(title, { exact: true }).first().waitFor({ timeout: 15_000 }),
            ownerRow: () => ownerPage.getByText(title, { exact: true }).first().waitFor({ timeout: 15_000 }),
            sidebar: () => untilCount(page, 'tasks', before + 1),
          },
          { locale },
        );
        const key = keyIn(created, ws);
        await settle(page);

        const edited = `${title} edited`;
        await measure(
          'task edit',
          () => claude.call('update_task', { key, title: edited }),
          { row: () => page.getByText(edited, { exact: true }).first().waitFor({ timeout: 15_000 }) },
          { locale },
        );
        await settle(page);

        await measure(
          'task delete',
          () => claude.call('delete_card', { key }),
          {
            row: () =>
              page.getByText(edited, { exact: true }).first().waitFor({ state: 'detached', timeout: 15_000 }),
            sidebar: () => untilCount(page, 'tasks', before),
          },
          { locale },
        );
        await settle(page);
      }
      await assertNoNavigation(page, navigations);
    } finally {
      await claude.close();
    }
  });

  test('a decision created and decided through MCP changes the open Decisions page', async ({
    page,
    locale,
    ws,
  }) => {
    const navigations = watchNavigation(page);
    await open(page, view(locale, ws, 'decisions'));
    navigations.on = true;
    const claude = await mcp(ws);
    try {
      for (let round = 0; round < ROUNDS; round += 1) {
        const before = await countOf(page, 'decisions');
        const title = `Live decision ${locale} ${round} ${Date.now()}`;
        const created = await measure(
          'decision create',
          () =>
            claude.call('request_decision', {
              title,
              kind: 'product',
              question: 'Which one?',
              deciderRole: 'owner',
              options: [
                { id: 'a', title: 'Option A' },
                { id: 'b', title: 'Option B' },
              ],
            }),
          {
            row: () => page.getByText(title, { exact: true }).first().waitFor({ timeout: 15_000 }),
            sidebar: () => untilCount(page, 'decisions', before + 1),
          },
          { locale },
        );
        const key = keyIn(created, ws);
        await settle(page);

        await measure(
          'decision decide',
          () => claude.call('decide', { key, optionId: 'b', rationale: 'B is simpler' }),
          { sidebar: () => untilCount(page, 'decisions', before) },
          { locale },
        );
        await settle(page);
      }
      await assertNoNavigation(page, navigations);
    } finally {
      await claude.close();
    }
  });

  test("a change on the page is what Claude's next tool call reads", async ({ page, owner, locale, ws }) => {
    const claude = await mcp(ws);
    try {
      const title = `Reverse ${locale} ${Date.now()}`;
      const key = keyIn(
        await claude.call('create_task', { title, specialty: 'backend', acceptance: 'x' }),
        ws,
      );
      await open(page, view(locale, ws, 'tasks', `card=${key}`));
      const written = page.waitForResponse((r) => r.url().endsWith(`/tasks/${key}/claim`) && r.ok());
      await page
        .getByRole('button', { name: /احجز|Claim/ })
        .first()
        .click();
      await written;
      const read = await claude.call('get_card', { key });
      expect(read).toMatch(/claimed/i);
      expect((await owner.card<{ status: string }>(key)).status).toBe('claimed');
    } finally {
      await claude.close();
    }
  });
});
