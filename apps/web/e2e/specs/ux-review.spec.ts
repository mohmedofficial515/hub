/**
 * @file What the UX review of 2026-11-05 found only on a running app: a crash keeps the sidebar, an unknown address is the app's own page, a sheet's first open
 * lands on its action, Markdown bodies read as Markdown, and owner and pm see all ready work in the project's words.
 */
import { expect, type Rest, test, view, word, words } from '../support/hub';

const decision = (
  title: string,
  body: string,
  options: { id: string; title: string; recommended?: boolean }[],
) => ({
  type: 'decision',
  title,
  body,
  detail: {
    question: 'Which?',
    deciderRole: 'owner',
    options: options.map((o) => ({ pros: [], cons: [], ...o })),
  },
});

async function lead(owner: Rest, locale: string, tag: string, options: Parameters<typeof decision>[2]) {
  return owner.create(
    decision(`Lead ${tag} ${locale} ${Date.now()}`, '## Summary\n\nThe **plain** words.', options),
  );
}

test('a page crash keeps the sidebar, says so in the page language, and a walk away recovers', async ({
  page,
  locale,
  ws,
}) => {
  // A page's list answers with something no page can draw: a real render error, no test hook in the app.
  await page.route('**/api/v1/workspaces/*/tasks*', (route) =>
    route.fulfill({ json: { data: 123, meta: { pagination: { nextCursor: null, limit: 1 } } } }),
  );
  await page.route('**/api/v1/workspaces/*/cards?*type=task*', (route) =>
    route.fulfill({ json: { data: 123, meta: { pagination: { nextCursor: null, limit: 1 } } } }),
  );
  await page.goto(view(locale, ws, 'tasks'));
  const shell = words(locale, 'shell');
  await expect(page.getByText(word(shell, 'boundary.crashTitle'))).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  const nav = page.getByRole('link', { name: word(shell, 'nav.today') }).first();
  await expect(nav).toBeVisible();

  await page.unroute('**/api/v1/workspaces/*/tasks*');
  await page.unroute('**/api/v1/workspaces/*/cards?*type=task*');
  await nav.click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/${ws}/today`));
  await expect(page.getByText(word(shell, 'boundary.crashTitle'))).toHaveCount(0);
});

test('a crash in the shell itself is still in the page language', async ({ page, locale, ws }) => {
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { data: { workspaces: 123 } } }));
  await page.goto(view(locale, ws, 'today'));
  await expect(page.getByText(word(words(locale, 'shell'), 'boundary.crashTitle'))).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
});

test('an unknown address is the app’s own page, inside the shell when it is a project’s view', async ({
  page,
  locale,
  ws,
}) => {
  const shell = words(locale, 'shell');
  const title = word(shell, 'boundary.notFoundTitle');

  await page.goto(`/${locale}/${ws}/nosuchview`);
  await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: word(shell, 'nav.today') }).first()).toBeVisible();

  await page.goto(`/${locale}/nope/deep/path`);
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
});

test('a sheet’s first open lands focus on its primary action once the card arrives', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  const { key } = await lead(owner, locale, 'focus', [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
  ]);
  // Slow enough that the dialog takes focus long before the card exists.
  await page.route(`**/api/v1/workspaces/*/cards/${key}`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto(view(locale, ws, 'decisions', `card=${key}`));
  const primary = page.locator('[data-card-sheet] [data-sheet-primary]');
  await primary.waitFor({ timeout: 30_000 });
  await expect(primary).toBeFocused();
});

test('a Markdown body renders in the sheet, its excerpt is plain, and an injected script stays inert', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  const { key } = await owner.create(
    decision(
      `Markdown ${locale} ${Date.now()}`,
      '## Summary\n\nThe **plain** words.\n\n- one\n- two\n\n---\n\n<img src=x onerror="window.__pwned=1">\n\n[bad](javascript:window.__pwned=1)',
      [{ id: 'a', title: 'A' }],
    ),
  );
  await page.goto(view(locale, ws, 'decisions', `card=${key}`));
  const sheet = page.locator('[data-card-sheet]');
  await sheet.getByRole('heading', { name: 'Summary' }).waitFor({ timeout: 30_000 });
  await expect(sheet.locator('li').filter({ hasText: 'one' })).toBeVisible();
  await expect(sheet.locator('hr')).toBeVisible();
  await expect(sheet).not.toContainText('##');
  await expect(sheet.locator('img')).toHaveCount(0);
  await expect(sheet.locator('a[href^="javascript"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
});

test('the lead decision folds options past three, and two recommended fill nothing', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  const copy = words(locale, 'decisions');
  const choose = word(copy, 'table.choose');
  const options = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, title: `Option ${id}` }));
  const { key } = await lead(owner, locale, 'two', [
    options[0]!,
    { ...options[1]!, recommended: true },
    options[2]!,
    { ...options[3]!, recommended: true },
    options[4]!,
    options[5]!,
  ]);
  // The earliest deadline lies open.
  await owner.context.patch(`/api/v1/workspaces/${ws}/cards/${key}`, {
    data: { dueAt: new Date(Date.now() + 3_600_000).toISOString() },
    headers: { 'X-Requested-With': 'hub' },
  });
  await page.goto(view(locale, ws, 'decisions'));
  const article = page.locator(`article[aria-labelledby="table-${key}"]`);
  await article.waitFor({ timeout: 30_000 });
  await expect(article.getByRole('button', { name: new RegExp(choose) })).toHaveCount(0);
  const tiles = article.locator('ul > li');
  await expect(tiles).toHaveCount(3);
  await expect(tiles.nth(0)).toContainText('Option b');
  await expect(tiles.nth(1)).toContainText('Option d');
  await expect(article.locator('button.bg-primary')).toHaveCount(0);
  await article.locator('button[aria-expanded="false"]').last().click();
  await expect(tiles).toHaveCount(6);
});
