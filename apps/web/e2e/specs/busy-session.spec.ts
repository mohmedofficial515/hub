/**
 * @file Can a normal busy Claude Code session hit the per-user limit (600 a minute, docs/04 §1.7)? Two open tabs, and a tool call that changes a
 * card about every 2 s for a minute, which is faster than a chat really goes. Every page request is counted, and not one may answer 429.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { expect, keyIn, mcp, test, view, waitForLive } from '../support/hub';

const OUT = resolve(__dirname, '../../test-results/live-timings.jsonl');

test('a busy session stays under the per-user limit, and the last change still arrives', async ({
  page,
  ownerContext,
  locale,
  ws,
}, info) => {
  test.skip(locale !== 'en', 'One language is enough for a load measurement.');
  test.setTimeout(180_000);
  const second = await ownerContext.newPage();
  let requests = 0;
  let limited = 0;
  for (const tab of [page, second]) {
    tab.on('response', (response) => {
      if (!response.url().includes('/api/v1/') || response.url().includes('/events/stream')) return;
      requests += 1;
      if (response.status() === 429) limited += 1;
    });
  }
  await page.goto(view(locale, ws, 'tasks'));
  await second.goto(view(locale, ws, 'today'));
  await Promise.all([waitForLive(page), waitForLive(second)]);
  await page.waitForTimeout(2000);
  requests = 0;

  const claude = await mcp(ws);
  const started = Date.now();
  let calls = 0;
  let last = '';
  try {
    while (Date.now() - started < 60_000) {
      const title = `Busy ${Date.now()}`;
      const key = keyIn(
        await claude.call('create_task', { title, specialty: 'backend', acceptance: 'x' }),
        ws,
      );
      await page.waitForTimeout(2000);
      last = `${title} edited`;
      await claude.call('update_task', { key, title: last });
      calls += 2;
      await page.waitForTimeout(2000);
    }
    await page.getByText(last, { exact: true }).first().waitFor({ timeout: 3000 });
  } finally {
    await claude.close();
    await second.close();
  }
  const minutes = (Date.now() - started) / 60_000;
  const perMinute = Math.round(requests / minutes);
  mkdirSync(dirname(OUT), { recursive: true });
  appendFileSync(OUT, `${JSON.stringify({ label: 'busy session', calls, requests, perMinute, limited })}\n`);
  await info.attach('busy-session', { body: JSON.stringify({ calls, requests, perMinute, limited }) });
  expect(limited).toBe(0);
  expect(perMinute).toBeLessThan(600);
});
