/**
 * @file Run now and the run strip on Settings › Sources, which failed once under contention: a real local folder, a real run through the worker, and the
 * result on the open page with no reload. Also the sign-in form, which every other test skips by reusing a session.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, view, word, words } from '../support/hub';

test('Run now reaches the worker, and the page shows the run', async ({ page, owner, locale, ws }) => {
  const folder = mkdtempSync(join(tmpdir(), 'hub-e2e-docs-'));
  try {
    mkdirSync(join(folder, 'guide'));
    writeFileSync(join(folder, 'guide', 'hello.md'), '# Hello\n\nA document for the run.\n');
    const name = `docs-${locale}-${Date.now()}`;
    await owner.post(`workspaces/${ws}/sources`, {
      kind: 'local_path',
      name,
      config: { path: folder, purpose: 'docs' },
    });

    await page.goto(view(locale, ws, 'settings', 'tab=sources'));
    const settings = words(locale, 'settings');
    const row = page.locator('[data-row], li, tr').filter({ hasText: name }).first();
    await expect(row).toBeVisible();

    const sources = await owner.get<{ id: string; name: string }[]>(`workspaces/${ws}/sources`);
    const source = sources.find((item) => item.name === name);
    if (!source) throw new Error('Source not found');
    const ran = page.waitForResponse((r) => r.url().endsWith(`/sources/${source.id}/run`));
    await row.getByRole('button', { name: word(settings, 'sources.runNow') }).click();
    expect((await ran).ok()).toBe(true);

    await expect
      .poll(
        async () => {
          const runs = await owner.get<{ status: string }[]>(
            `workspaces/${ws}/capture/runs?source=${source.id}&limit=5`,
          );
          return runs[0]?.status;
        },
        { timeout: 30_000 },
      )
      .toBe('ok');
    // The result reaches the open page with no reload: its strip of the last 24 hours appears once a real run exists.
    await expect(page.getByLabel(new RegExp(word(settings, 'strip.label'))).first()).toBeVisible();
    const docs = await owner.get<{ title: string }[]>(`workspaces/${ws}/cards?type=doc&limit=100`);
    expect(docs.some((card) => /hello/i.test(card.title))).toBe(true);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
