/**
 * @file What the UX review of 2026-11-05 found only on a running app: a crash keeps the sidebar, an unknown address is the app's own page, a sheet's first open
 * lands on its action, Markdown bodies read as Markdown, and owner and pm see all ready work in the project's words.
 */
import { expect, type Rest, test, view, word, words } from '../support/hub';

const decision = (title: string, body: string, options: { title: string; recommended?: boolean }[]) => ({
  type: 'decision',
  title,
  body,
  // Later cards get earlier deadlines, so the newest is always the lead, also on a retry.
  dueAt: new Date(3_000_000_000_000 - Date.now()).toISOString(),
  detail: {
    kind: 'product',
    question: 'Which?',
    deciderRole: 'owner',
    options,
  },
});

async function lead(owner: Rest, locale: string, tag: string, options: Parameters<typeof decision>[2]) {
  return owner.create(
    decision(`Lead ${tag} ${locale} ${Date.now()}`, '## Summary\n\nThe **plain** words.', options),
  );
}

const LIST = '**/api/v1/workspaces/*/tasks?*';

test('a page crash keeps the sidebar, says so in the page language, and a walk away recovers', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  await owner.create({
    type: 'task',
    title: `Crash ${locale} ${Date.now()}`,
    detail: { specialty: 'backend' },
  });
  // Real rows, but a title no page can draw: a real render error, with no test hook in the app.
  await page.route(LIST, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { data: Record<string, unknown>[] };
    await route.fulfill({
      response,
      json: { ...body, data: body.data.map((row) => ({ ...row, title: { not: 'text' } })) },
    });
  });
  await page.goto(view(locale, ws, 'tasks', 'view=list'));
  const shell = words(locale, 'shell');
  await expect(page.getByText(word(shell, 'boundary.crashTitle'))).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  const nav = page.getByRole('link', { name: word(shell, 'nav.today') }).first();
  await expect(nav).toBeVisible();

  await page.unroute(LIST);
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
  const { key } = await lead(owner, locale, 'focus', [{ title: 'A' }, { title: 'B' }]);
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
      [{ title: 'A' }, { title: 'B' }],
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
  const options = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ title: `Option ${id}` }));
  const { key } = await lead(owner, locale, 'two', [
    options[0]!,
    { ...options[1]!, recommended: true },
    options[2]!,
    { ...options[3]!, recommended: true },
    options[4]!,
    options[5]!,
  ]);
  await page.goto(view(locale, ws, 'decisions'));
  const article = page.locator(`article[aria-labelledby="table-${key}"]`);
  await article.waitFor({ timeout: 30_000 });
  const tiles = article.locator('ul > li');
  await expect(tiles).toHaveCount(3);
  await expect(tiles.nth(0)).toContainText('Option b');
  await expect(tiles.nth(1)).toContainText('Option d');
  await expect(article.locator('button.bg-primary')).toHaveCount(0);
  await article.locator('button[aria-expanded="false"]').last().click();
  await expect(tiles).toHaveCount(6);
});
