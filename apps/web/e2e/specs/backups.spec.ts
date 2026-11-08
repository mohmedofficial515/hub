/**
 * @file Settings › Backups in a real browser (docs/16 D61 to D63): Back up now makes a real `pg_dump` of the throwaway database into a scratch folder, the
 * history shows it done with its size, Keep pins it, Delete asks and keeps the line, and the settings save from the bar. Then Settings › Devices says how
 * other devices reach Hub. Runs in `ar` and `en`, with screenshots of both.
 * @description The stack sets `HUB_BACKUP_DIR` to a temp folder and `HUB_BACKUP_SCHEDULE=off` (`support/stack.ts`), so nothing reaches F:/HubBackups or
 * the owner's database, and no nightly run races the test.
 */
import { existsSync, readdirSync } from 'node:fs';

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
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`devices-publishing-${locale}.png`), fullPage: true });
  });
});
