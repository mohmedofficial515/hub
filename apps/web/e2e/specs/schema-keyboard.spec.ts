/**
 * @file The Database page by keyboard in a real browser (docs/17, Slice 6 review B2 and M9): `/` opens the page's search and not the palette, a search pick opens
 * the inspector with focus on its heading, Escape gives focus back to the table, Tab reaches the diagram's toolbar before its tables, Enter on a table opens it, and
 * the domains drawer on a narrow page takes focus and closes on Escape. Runs in `ar` and `en`.
 * @description The schema is a throwaway folder in the temp directory, registered on the test's project only for this test and read by the throwaway API, so
 * nothing reaches F:/Goteav or the owner's Hub. Its first model line ends with a comment, as Hub's own `SessionLog` does, so the reader fix is seen in the page.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { expect, type Rest, test, view, word, words } from '../support/hub';

const SCHEMA = `// Bookings: the booking and its notes.

model Booking {                                   // one row per booking
  id        String        @id
  reference String        @unique
  notes     BookingNote[]
}

model BookingNote {
  id        String  @id
  bookingId String
  booking   Booking @relation(fields: [bookingId], references: [id])
  text      String?
}
`;

const USERS = `model Customer {
  id    String @id
  email String @unique
}
`;

async function withSchemaFolder(owner: Rest, ws: string) {
  const folder = mkdtempSync(join(tmpdir(), 'hub-e2e-schema-'));
  mkdirSync(join(folder, 'prisma', 'schema'), { recursive: true });
  writeFileSync(join(folder, 'prisma', 'schema', 'bookings.prisma'), SCHEMA);
  writeFileSync(join(folder, 'prisma', 'schema', 'customers.prisma'), USERS);
  const project = await owner.get<{ repoPaths: string[] }>(`workspaces/${ws}`);
  const setFolders = async (repoPaths: string[]) => {
    const answer = await owner.context.patch(`/api/v1/workspaces/${ws}`, {
      data: { repoPaths },
      headers: { 'X-Requested-With': 'hub' },
    });
    if (!answer.ok()) throw new Error(`Setting folders: ${answer.status()} ${await answer.text()}`);
  };
  await setFolders([...project.repoPaths, folder]);
  const source = await owner.context.put(`/api/v1/workspaces/${ws}/schema/source`, {
    data: { name: 'e2e', path: folder, schemaDir: 'prisma/schema', deviceId: null },
    headers: { 'X-Requested-With': 'hub' },
  });
  if (!source.ok()) throw new Error(`Setting the source: ${source.status()} ${await source.text()}`);
  return {
    folder,
    async cleanup() {
      await setFolders(project.repoPaths).catch(() => undefined);
      rmSync(folder, { recursive: true, force: true });
    },
  };
}

const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return {
      heading: el?.hasAttribute('data-inspector-heading') ?? false,
      node: el?.classList.contains('react-flow__node-table') ? (el.dataset['id'] ?? null) : null,
      toolbar: !!el?.closest('.schema-toolbar'),
      inDrawer: !!el?.closest('.schema-rail-slot[role="dialog"]'),
      railToggle: el?.hasAttribute('data-schema-rail-toggle') ?? false,
      text: el?.textContent?.trim().slice(0, 60) ?? '',
    };
  });

test.describe('Database page by keyboard', () => {
  test('search, the inspector, Tab order and Enter on a table', async ({ page, locale, ws, owner }, info) => {
    const schema = await withSchemaFolder(owner, ws);
    try {
      const t = words(locale, 'schema');
      await page.goto(view(locale, ws, 'schema'));
      await expect(page.locator('.react-flow__node-table[data-id="Booking"]')).toBeVisible({
        timeout: 30_000,
      });
      // The reader opened `model Booking {   // …`: the table is there, with its columns, and no unread lines.
      await expect(page.locator('.react-flow__node-table')).toHaveCount(3);

      // `/` is the page's search here, not the global palette (M9).
      await page.locator('.schema-viewbar button').first().focus();
      await page.keyboard.press('/');
      const search = page.getByRole('dialog', { name: word(t, 'search.title') });
      await expect(search).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await page.keyboard.type('BookingNote');
      await page.keyboard.press('Enter');
      await expect(search).toBeHidden();

      // The pick opens the inspector, and focus lands on its heading (B2).
      const inspector = page.locator('[data-schema-inspector]');
      await expect(inspector).toBeVisible();
      await expect.poll(async () => (await focused(page)).heading).toBe(true);
      await page.screenshot({ path: info.outputPath(`schema-search-pick-${locale}.png`) });

      // Escape closes it and gives focus to the table on the diagram.
      await page.keyboard.press('Escape');
      await expect(inspector).toBeHidden();
      await expect.poll(async () => (await focused(page)).node).toBe('BookingNote');

      // Tab from the view switch reaches the toolbar before any table.
      await page.locator('.schema-viewbar button').first().focus();
      let toolbarAt = -1;
      let nodeAt = -1;
      for (let step = 0; step < 80 && nodeAt < 0; step += 1) {
        await page.keyboard.press('Tab');
        const now = await focused(page);
        if (now.toolbar && toolbarAt < 0) toolbarAt = step;
        if (now.node) nodeAt = step;
      }
      expect(toolbarAt).toBeGreaterThanOrEqual(0);
      expect(nodeAt).toBeGreaterThan(toolbarAt);

      // Enter on the table that has focus opens it, with focus in the inspector.
      const table = (await focused(page)).node!;
      await page.keyboard.press('Enter');
      await expect(inspector).toBeVisible();
      await expect(inspector.locator('[data-inspector-heading]')).toContainText(table);
      await expect.poll(async () => (await focused(page)).heading).toBe(true);
      await page.screenshot({ path: info.outputPath(`schema-enter-on-table-${locale}.png`) });
    } finally {
      await schema.cleanup();
    }
  });

  test('the domains drawer takes focus, and Escape gives it back to its toggle', async ({
    page,
    locale,
    ws,
    owner,
  }) => {
    const schema = await withSchemaFolder(owner, ws);
    try {
      const t = words(locale, 'schema');
      await page.setViewportSize({ width: 834, height: 1112 });
      await page.goto(view(locale, ws, 'schema'));
      const toggle = page.locator('[data-schema-rail-toggle]');
      await expect(toggle).toBeVisible({ timeout: 30_000 });
      // Closed, the drawer's buttons are out of the Tab order.
      await expect(page.locator('.schema-rail-slot')).toHaveAttribute('inert', '');
      await toggle.click();
      const drawer = page.getByRole('dialog', { name: word(t, 'domains.title') });
      await expect(drawer).toBeVisible();
      await expect.poll(async () => (await focused(page)).inDrawer).toBe(true);
      await page.keyboard.press('Escape');
      await expect(page.locator('.schema-rail-slot')).not.toHaveClass(/is-open/);
      await expect.poll(async () => (await focused(page)).railToggle).toBe(true);
    } finally {
      await schema.cleanup();
    }
  });
});
