/**
 * @file The page matrix of apps/web/README.md § Tests: 390, 768, 1280, 1440 × light, dark × the chat panel open and closed, on every page in its language, measured: no horizontal overflow and
 * no AA failure on rendered text, once the page's content has arrived (never a fixed delay). Slow, so it runs on request: `E2E_MATRIX=1 pnpm test:e2e:web --grep matrix`.
 * `E2E_MATRIX_PAGES=redesign,releases` narrows it. Results go to `test-results/matrix.jsonl`.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { Page } from '@playwright/test';

import { audit } from '../support/audit';
import { expect, mcp, test, view } from '../support/hub';
import { shared } from '../support/state';

const OUT = resolve(__dirname, '../../test-results/matrix.jsonl');
const ALL = ['today', 'inbox', 'planning', 'timeline', 'tasks', 'decisions', 'needs', 'handoffs', 'redesign'];
const MORE = ['releases', 'docs', 'ask', 'onboarding', 'members', 'settings'];
const PAGES = process.env['E2E_MATRIX_PAGES']?.split(',') ?? [...ALL, ...MORE];
const SIZES = [390, 768, 1280, 1440];
const PANEL = [true, false];
const THEMES = ['light', 'dark'] as const;

/** Content has arrived: the title is there, no skeleton is left, and the network has been quiet. The stream does not count. */
async function contentArrived(page: Page) {
  await page.locator('h1').first().waitFor({ timeout: 60_000 });
  await page.waitForFunction(
    () => !document.querySelector('[aria-busy="true"], [class*="animate-pulse"]'),
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => requestAnimationFrame(() => done()));
      }),
  );
}

test.describe('page matrix', () => {
  test.skip(!process.env['E2E_MATRIX'], 'Set E2E_MATRIX=1 to run it.');

  // A matrix over empty pages proves little: real rows first, through the same MCP a member uses.
  test('matrix needs something on the pages', async ({ owner, ws }) => {
    test.setTimeout(120_000);
    const claude = await mcp(ws);
    try {
      const stamp = Date.now();
      const task = await owner.create({
        type: 'task',
        title: `A task with a long enough title to wrap on a phone ${stamp}`,
        detail: { specialty: 'backend', acceptance: 'It works' },
      });
      await claude.call('request_decision', {
        title: `Which refund route should we use? ${stamp}`,
        kind: 'product',
        question: 'Which refund route?',
        deciderRole: 'owner',
        options: [
          { id: 'a', title: 'Wallet first' },
          { id: 'b', title: 'Card first' },
        ],
        links: [{ kind: 'blocks', key: task.key }],
      });
      await claude.call('create_need', {
        title: `PayTR live token ${stamp}`,
        kind: 'token',
        responsibleRole: 'owner',
      });
      await claude.call('create_idea', {
        title: `An idea ${stamp}`,
        problem: 'Something worth thinking about',
      });
      await claude.call('create_release', {
        title: `Autumn ${stamp}`,
        version: `1.${stamp % 1000}`,
        includedKeys: [task.key],
      });
      const sources = await owner.get<{ id: string; name: string }[]>(`workspaces/${ws}/sources`);
      const lab = sources.find((source) => source.name === 'lab');
      const id =
        lab?.id ??
        (
          await owner.post<{ id: string }>(`workspaces/${ws}/sources`, {
            kind: 'local_path',
            name: 'lab',
            config: { path: shared().labRoot, purpose: 'lab' },
          })
        ).id;
      await owner.post(`workspaces/${ws}/sources/${id}/run`);
      const docs = await owner.post<{ id: string }>(`workspaces/${ws}/sources`, {
        kind: 'local_path',
        name: `docs-${stamp}`,
        config: { path: resolve(__dirname, '../../../../docs'), purpose: 'docs', include: ['1*.md'] },
      });
      await owner.post(`workspaces/${ws}/sources/${docs.id}/run`);
    } finally {
      await claude.close();
    }
  });

  for (const name of PAGES) {
    test(`matrix ${name}`, async ({ page, locale, ws }) => {
      test.setTimeout(600_000);
      mkdirSync(dirname(OUT), { recursive: true });
      const problems: string[] = [];
      for (const theme of THEMES) {
        await page.emulateMedia({ colorScheme: theme });
        for (const width of SIZES) {
          for (const panel of PANEL) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(view(locale, ws, name));
            await page.evaluate((open) => {
              localStorage.setItem('hub-panel:open', JSON.stringify(open));
            }, panel);
            await page.reload();
            await contentArrived(page);
            await page.evaluate((dark) => {
              document.documentElement.classList.toggle('dark', dark);
            }, theme === 'dark');
            const result = await audit(page);
            appendFileSync(OUT, `${JSON.stringify({ name, locale, theme, width, panel, ...result })}\n`);
            if (result.overflow > 0 || result.fails.length > 0 || result.nodes === 0) {
              problems.push(`${width} ${theme} panel ${panel}: ${JSON.stringify(result)}`);
            }
          }
        }
      }
      expect(problems).toEqual([]);
    });
  }
});
