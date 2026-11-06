/**
 * @file The lab as a module of Hub (docs/16 §6): its own page in a new tab, each version in its own frame at `/lab`, a broken version alone in its frame, and
 * the proxy keeping to the lab's own files. Runs on the stack's temp lab, so nothing touches `apps/lab`.
 */
import {
  expect as baseExpect,
  type FrameLocator,
  type Page,
  request as requestContext,
} from '@playwright/test';

import { expect, type Locale, mcp, test, view, word, words } from '../support/hub';
import { WEB_URL } from '../support/ports';
import { shared } from '../support/state';

const VERSION = 'app=hub&page=frames&a=v2-good';
const LAB = { nav: 'Lab pages and versions', notes: 'Status & notes' };
const gallery = (locale: Locale, ws: string, query = '') =>
  view(locale, ws, 'gallery', `lang=en&theme=light&w=1440${query ? `&${query}` : ''}`);

const framed = (page: Page, version: string): FrameLocator =>
  page.frameLocator(`iframe[data-lab-frame="hub/frames/${version}"]`);

async function ensureLab(
  owner: { get: <T>(path: string) => Promise<T>; post: (path: string) => Promise<unknown> },
  ws: string,
) {
  const claude = await mcp(ws);
  try {
    await claude.call('add_source', {
      kind: 'local_path',
      name: 'lab',
      config: { path: shared().labRoot, purpose: 'lab' },
    });
  } catch (error) {
    if (!String(error).match(/conflict|exists|already/i)) throw error;
  } finally {
    await claude.close();
  }
  const sources = await owner.get<{ id: string; name: string }[]>(`workspaces/${ws}/sources`);
  const lab = sources.find((source) => source.name === 'lab');
  if (!lab) throw new Error('No lab source');
  await owner.post(`workspaces/${ws}/sources/${lab.id}/run`);
  await baseExpect
    .poll(
      async () => {
        const pages = await owner.get<{ page: string; renderable: string[] | null }[]>(
          `workspaces/${ws}/redesign/pages`,
        );
        return pages.find((row) => row.page === 'frames')?.renderable ?? [];
      },
      { timeout: 20_000 },
    )
    .toContain('v2-good');
}

test.describe('lab module', () => {
  test.beforeEach(async ({ owner, ws }) => {
    await ensureLab(owner, ws);
  });

  test('Redesign opens the lab in a new tab, without the shell, and an old address still lands there', async ({
    page,
    locale,
    ws,
  }) => {
    const t = words(locale, 'redesign');
    await page.goto(view(locale, ws, 'redesign'));
    const [tab] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByRole('link', { name: word(t, 'openGallery'), exact: true }).click(),
    ]);
    await expect(tab).toHaveURL(/\/gallery/);
    await expect(tab.getByRole('navigation', { name: LAB.nav })).toContainText('v2-good');
    await expect(tab.locator('[data-lab-gallery]')).toHaveAttribute('dir', 'ltr');
    // No sidebar and no header: the lab's list is the only navigation there is.
    await expect(tab.getByRole('navigation')).toHaveCount(1);
    await expect(tab.getByRole('banner')).toHaveCount(0);
    await tab.close();

    await expect(page.locator('a[href^="http://localhost:6200"]')).toHaveCount(0);
    await page.goto(view(locale, ws, 'redesign', 'view=gallery&app=hub&page=frames&a=v2-good'));
    await expect(page).toHaveURL(/\/gallery\?.*a=v2-good/);
    await expect(page).not.toHaveURL(/view=gallery/);
  });

  test('a version renders in its own frame, and the toolbar drives size, language and theme', async ({
    page,
    locale,
    ws,
  }) => {
    await page.goto(gallery(locale, ws, VERSION));
    const frame = framed(page, 'v2-good');
    await expect(frame.getByTestId('fixture')).toHaveText('Frame works: en');
    await expect(frame.locator('html')).toHaveAttribute('dir', 'ltr');

    await page.getByRole('button', { name: 'AR · RTL', exact: true }).click();
    await expect(frame.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(frame.getByTestId('fixture')).toHaveText('Frame works: ar');

    await page.getByRole('button', { name: 'Theme', exact: true }).click();
    await expect(frame.locator('html')).toHaveClass(/dark/);

    await page.getByRole('button', { name: 'Mobile', exact: true }).click();
    const element = page.locator('iframe[data-lab-frame="hub/frames/v2-good"]');
    await expect(element).toHaveCSS('width', '390px');
    await expect(page).toHaveURL(/w=390/);

    // The address holds it: a reload stays where it was.
    await page.reload();
    await expect(framed(page, 'v2-good').locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('iframe[data-lab-frame="hub/frames/v2-good"]')).toHaveCSS('width', '390px');
  });

  test('compare shows two versions side by side, and a broken one fails in its own frame only', async ({
    page,
    locale,
    ws,
  }) => {
    await page.goto(gallery(locale, ws, `${VERSION}&b=v3-broken`));
    await expect(framed(page, 'v2-good').getByTestId('fixture')).toHaveText('Frame works: en');
    // The frame's own boundary, or the dev server's overlay, inside that frame.
    const broken = framed(page, 'v3-broken');
    await expect(broken.locator('pre, vite-error-overlay').first()).toBeAttached({ timeout: 20_000 });
    await expect(broken.getByTestId('fixture')).toHaveCount(0);

    await expect(page.getByRole('navigation', { name: LAB.nav })).toBeVisible();
    await page.getByRole('button', { name: 'Side-by-side', exact: true }).click();
    await expect(page.locator('iframe')).toHaveCount(1);
    await expect(framed(page, 'v2-good').getByTestId('fixture')).toHaveText('Frame works: en');
  });

  test('notes hold status and README, and the verdict is one click away in the sheet', async ({
    page,
    locale,
    ws,
  }) => {
    await page.goto(gallery(locale, ws, `${VERSION}&notes=1`));
    const notes = page.getByRole('complementary', { name: LAB.notes });
    await expect(notes).toContainText('The notes of the good version');
    await expect(notes).toContainText('2026-10-27');
    await expect(notes).toContainText('The brief of this page');
    await notes.getByRole('link').first().click();
    await expect(page).toHaveURL(/card=/);
    const kit = words(locale, 'kit');
    await expect(
      page.getByRole('dialog').getByRole('button', { name: word(kit, 'actions.approve') }),
    ).toBeVisible();
  });

  test('a baseline shows its pictures, and tokens have a frame of their own', async ({
    page,
    locale,
    ws,
  }) => {
    await page.goto(gallery(locale, ws, 'app=hub&page=frames&a=v1-baseline'));
    await expect(page.getByRole('img').first()).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.goto(gallery(locale, ws, 'app=hub&page=_tokens&a=preview'));
    await expect(page.frameLocator('iframe').locator('h1')).toBeVisible();
  });

  test('the proxy serves only the lab, and only to a member', async ({ page, locale, ws }) => {
    await page.goto(gallery(locale, ws));
    const member = page.request;
    expect((await member.get('/lab/frame-hub.html')).status()).toBe(200);
    const root = shared().labRoot.split('\\').join('/');
    for (const path of [
      '/lab/.env',
      '/lab/..%2f..%2f.env',
      '/lab/%252e%252e/.env',
      '/lab/..%5c..%5c.env',
      `/lab/@fs/${root}/.env`,
      `/lab/@fs/${root}/.git/config`,
    ]) {
      expect((await member.get(path)).status(), path).toBe(404);
    }
    const outside = await member.get('/lab/@fs/C:/Windows/win.ini');
    expect(await outside.text()).not.toContain('[fonts]');

    const stranger = await requestContext.newContext({ baseURL: WEB_URL });
    expect((await stranger.get('/lab/frame-hub.html', { headers: { accept: '*/*' } })).status()).toBe(401);
    await stranger.dispose();
  });
});
