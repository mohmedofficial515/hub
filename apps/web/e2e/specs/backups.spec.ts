/**
 * @file Settings › Backups in a real browser (docs/16 D61 to D63): Back up now makes a real `pg_dump` of the throwaway database into a scratch folder, the
 * history shows it done with its size, Keep pins it, Delete asks and keeps the line, and the settings save from the bar. Then Settings › Devices says how
 * other devices reach Hub. Runs in `ar` and `en`, with screenshots of both. The Slice 6 review's fixes are checked here too: no "no access" flash on a direct load
 * (M1), the selected tab in view (M2), a failure in words with the raw text under Details (M3), the reach steps with Check again (M6, M7).
 * @description The stack sets `HUB_BACKUP_DIR` to a temp folder and `HUB_BACKUP_SCHEDULE=off` (`support/stack.ts`), so nothing reaches F:/HubBackups or
 * the owner's database, and no nightly run races the test.
 */
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { BackupDto } from '@hub/contracts';

import { expect, test, view, word, words } from '../support/hub';

test.describe('Settings › Backups', () => {
  test('back up now, keep, delete and the settings, as the owner', async ({ page, locale, ws }, info) => {
    const settings = words(locale, 'settings');
    const t = (path: string) => word(settings, `backups.${path}`);
    await page.goto(view(locale, ws, 'settings', 'tab=backups'));
    await expect(page.getByRole('tab', { name: word(settings, 'tabs.backups') })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('heading', { name: t('title'), exact: true })).toBeVisible();
    // The restore is a command, never a button.
    await expect(page.getByText('pnpm hub:restore', { exact: false })).toBeVisible();

    const started = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && /\/backups$/.test(new URL(response.url()).pathname),
    );
    await page.getByRole('button', { name: t('now') }).click();
    const backup = ((await (await started).json()) as { data: BackupDto }).data;
    const row = page.locator(`[data-backup="${backup.id}"]`);
    await expect(row.getByText(t('status.done'), { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(row.getByText(t('trigger.manual'), { exact: true })).toBeVisible();
    await expect(row.getByText(/\d+(\.\d+)? (KB|MB)/)).toBeVisible();
    const folder = (await row.locator('bdi').filter({ hasText: 'hub-' }).first().textContent())?.trim() ?? '';
    expect(folder).toMatch(/hub-\d{8}-\d{6}-[0-9a-f]{8}$/);
    // `docs/` appears only when Hub has written a document, which this stack's projects may not have.
    expect(readdirSync(folder)).toEqual(expect.arrayContaining(['hub.dump', 'manifest.json']));
    await page.screenshot({ path: info.outputPath(`backups-done-${locale}.png`), fullPage: true });

    // Keep: pinned, and said in a word.
    await row.getByRole('button', { name: new RegExp(`^${t('keep')}`) }).click();
    await expect(row.getByText(t('kept'), { exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: new RegExp(`^${t('unkeep')}`) })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Delete asks first, says the backup is kept, and the line stays, marked.
    await row.getByRole('button', { name: new RegExp(`^${t('delete')}`) }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(t('deleteKeptBody'))).toBeVisible();
    await dialog.getByRole('button', { name: t('delete'), exact: true }).click();
    await expect(row.getByText(t('status.deleted'), { exact: true })).toBeVisible();
    await expect(row.getByRole('button')).toHaveCount(0);
    expect(existsSync(folder)).toBe(false);

    // The settings save together from the bar.
    const keep = page.getByLabel(t('keepCount'));
    await keep.fill('21');
    await page.getByRole('button', { name: t('save') }).click();
    await expect(page.getByRole('button', { name: t('save') })).toBeHidden();
    await page.reload();
    await expect(page.getByLabel(t('keepCount'))).toHaveValue('21');
    await page.getByLabel(t('keepCount')).fill('14');
    await page.getByRole('button', { name: t('save') }).click();
    await expect(page.getByRole('button', { name: t('save') })).toBeHidden();
    await page.screenshot({ path: info.outputPath(`backups-history-${locale}.png`), fullPage: true });
  });

  test('a direct load never says "no access" to the owner, and the tab is in view (review M1, M2)', async ({
    page,
    locale,
    ws,
  }) => {
    const settings = words(locale, 'settings');
    const forbidden = word(words(locale, 'kit'), 'error.forbidden');
    // The session answers late, as on a slow machine, so a premature decision would show.
    await page.route('**/api/v1/auth/me', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto(view(locale, ws, 'settings', 'tab=backups'));
      const seen = page.evaluate(
        (text) =>
          new Promise<boolean>((resolve) => {
            const started = Date.now();
            const tick = () => {
              if (document.body.innerText.includes(text)) return resolve(true);
              if (Date.now() - started > 2500) return resolve(false);
              requestAnimationFrame(tick);
            };
            tick();
          }),
        forbidden,
      );
      expect(await seen).toBe(false);
      const tab = page.getByRole('tab', { name: word(settings, 'tabs.backups') });
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      // The selected tab sits inside the strip's visible part.
      await expect
        .poll(() =>
          tab.evaluate((el) => {
            const strip = el.parentElement!.getBoundingClientRect();
            const box = el.getBoundingClientRect();
            return box.left >= strip.left - 1 && box.right <= strip.right + 1;
          }),
        )
        .toBe(true);
    }
    await page.unroute('**/api/v1/auth/me');
  });

  test('a failed backup says what to do, with the raw text under Details (review M3)', async ({
    page,
    locale,
    ws,
    owner,
  }) => {
    const settings = words(locale, 'settings');
    const t = (path: string) => word(settings, `backups.${path}`);
    // A file where the folder should be: the backup fails at its first step, and nothing is written anywhere else.
    const scratch = mkdtempSync(join(tmpdir(), 'hub-e2e-backup-fail-'));
    const file = join(scratch, 'not-a-folder.txt');
    writeFileSync(file, 'x');
    const patch = (data: unknown) =>
      owner.context.patch(`/api/v1/workspaces/${ws}/backups/settings`, {
        data,
        headers: { 'X-Requested-With': 'hub' },
      });
    try {
      expect((await patch({ folder: file })).ok()).toBe(true);
      await page.goto(view(locale, ws, 'settings', 'tab=backups'));
      const started = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' && /\/backups$/.test(new URL(response.url()).pathname),
      );
      await page.getByRole('button', { name: t('now') }).click();
      const backup = ((await (await started).json()) as { data: BackupDto }).data;
      const row = page.locator(`[data-backup="${backup.id}"]`);
      await expect(row.getByText(t('status.failed'), { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(row.getByText(t('failure.folder'))).toBeVisible();
      const details = row.locator('details');
      await expect(details).not.toHaveAttribute('open', '');
      await details.locator('summary').click();
      await expect(details.locator('bdi')).toContainText('not-a-folder.txt');
      await expect(details.getByRole('button', { name: t('copyFailure') })).toBeVisible();
    } finally {
      await patch({ folder: null });
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  test('anyone but the owner sees no Backups tab, and the route refuses them', async ({
    member,
    locale,
    ws,
  }) => {
    const { page, rest } = await member('accountant');
    const settings = words(locale, 'settings');
    await page.goto(view(locale, ws, 'settings', 'tab=notifications'));
    await expect(page.getByRole('tab', { name: word(settings, 'tabs.notifications') })).toBeVisible();
    await expect(page.getByRole('tab', { name: word(settings, 'tabs.backups') })).toHaveCount(0);
    const answer = await rest.context.get(`/api/v1/workspaces/${ws}/backups`);
    expect(answer.status()).toBe(403);
  });

  test('Settings › Devices says how other devices reach Hub', async ({ page, locale, ws }, info) => {
    const settings = words(locale, 'settings');
    await page.goto(view(locale, ws, 'settings', 'tab=devices'));
    const section = page.locator('[data-devices-publishing]');
    await expect(
      section.getByRole('heading', { name: word(settings, 'devices.publishing.title') }),
    ).toBeVisible();
    await expect(section.getByText('pnpm hub:tailscale serve')).toBeVisible();
    // The throwaway stack runs on plain http, so the cookies are honestly not Secure yet.
    await expect(section.getByText(word(settings, 'devices.publishing.secureOff'))).toBeVisible();
    // A summary says the next step, the steps are split by machine, and the download link is the official one (review M6, M7).
    await expect(section.locator('[data-publishing-summary]')).toBeVisible();
    await expect(section.getByText(word(settings, 'devices.publishing.mainTitle'))).toBeVisible();
    await expect(section.getByText(word(settings, 'devices.publishing.otherTitle'))).toBeVisible();
    await expect(
      section.getByRole('link', { name: new RegExp(word(settings, 'devices.publishing.download')) }).first(),
    ).toHaveAttribute('href', 'https://tailscale.com/download');
    // Check again asks past the API's cache.
    const fresh = page.waitForRequest(
      (request) =>
        request.url().endsWith('/me/devices/publishing') && request.headers()['cache-control'] === 'no-cache',
    );
    await section.getByRole('button', { name: word(settings, 'devices.publishing.checkAgainLabel') }).click();
    await fresh;
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`devices-publishing-${locale}.png`), fullPage: true });
  });
});
