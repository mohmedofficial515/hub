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
  await expect(page.locator('main').getByText(title)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: word(shell, 'nav.today') }).first()).toBeVisible();

  await page.goto(`/${locale}/nope/deep/path`);
  await expect(page.locator('main').getByText(title)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
});

test('a sheet’s first open lands focus on its title once the card arrives, so Enter claims nothing', async ({
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
  await expect(page.locator('[data-sheet-title]')).toBeFocused();
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

test('Claim is filled for a manager on a task routed to Backend, the server accepts it, and Undo takes it back', async ({
  owner,
  member,
  locale,
  ws,
}) => {
  const title = `Routed to Backend ${locale} ${Date.now()}`;
  const { key } = await owner.create({
    type: 'task',
    title,
    priority: 'P0',
    detail: { specialty: 'backend' },
  });
  await owner.post(`workspaces/${ws}/tasks/${key}/mark-ready`);

  const { page, rest } = await member('manager');
  await page.goto(view(locale, ws, 'tasks', 'view=list'));
  const filled = page.locator('main button.bg-primary');
  await expect(filled).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator(`[data-row="${key}"] button.bg-primary`)).toHaveCount(1);
  await filled.click();
  await expect.poll(async () => (await rest.card<{ status: string }>(key)).status).toBe('claimed');
  expect((await rest.card<{ ownerRole: string }>(key)).ownerRole).toBe('backend');

  await page.getByRole('button', { name: word(words(locale, 'kit'), 'undo') }).click();
  await expect.poll(async () => (await rest.card<{ status: string }>(key)).status).toBe('ready');
});

for (const [name, width, height] of [
  ['1440', 1440, 900],
  ['390', 390, 844],
] as const) {
  test(`on ${name}, Choose keeps the picked option on the screen beside the rationale`, async ({
    page,
    owner,
    locale,
    ws,
  }) => {
    await page.setViewportSize({ width, height });
    const options = Array.from({ length: 8 }, (_, i) => ({
      title: `Option ${i + 1}`,
      pros: ['A long enough reason for it'],
      cons: ['A long enough reason against it'],
      recommended: i === 6,
    }));
    const { key } = await lead(owner, locale, `pick ${name}`, options);
    await page.goto(view(locale, ws, 'decisions'));
    const article = page.locator(`article[aria-labelledby="table-${key}"]`);
    await article.waitFor({ timeout: 30_000 });
    await article.locator('button.bg-primary').click();

    const sheet = page.locator('[data-card-sheet]');
    const why = sheet.locator('textarea');
    await expect(why).toBeFocused();
    const picked = sheet.locator('[data-picked]');
    await expect(picked).toContainText('Option 7');
    await expect(picked).toBeInViewport({ ratio: 1 });
    await expect(why).toBeInViewport({ ratio: 1 });
    // Recommended first, up to three, the rest folded.
    await expect(sheet.locator('[role="radio"]')).toHaveCount(3);
    await expect(sheet.locator('[role="radio"]').first()).toContainText('Option 7');
    await expect(sheet.locator('[role="radio"]').first()).not.toContainText('A long enough reason');
  });
}

test('a pick from the fold stays showing when the fold closes, and the decision saves', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  const options = Array.from({ length: 8 }, (_, i) => ({ title: `Option ${i + 1}` }));
  const { key } = await lead(owner, locale, 'fold', options);
  await page.goto(view(locale, ws, 'decisions', `card=${key}&action=decide`));
  const sheet = page.locator('[data-card-sheet]');
  await expect(sheet.locator('[role="radio"]')).toHaveCount(3, { timeout: 30_000 });
  const fold = sheet.locator('form button[aria-expanded]').last();
  await fold.click();
  await expect(sheet.locator('[role="radio"]')).toHaveCount(8);
  await sheet.locator('[role="radio"]', { hasText: 'Option 6' }).click();
  await fold.click();
  await expect(sheet.locator('[role="radio"]')).toHaveCount(4);
  await expect(sheet.locator('[role="radio"]').last()).toHaveAttribute('aria-checked', 'true');

  await sheet.locator('textarea').fill('It is the only one that covers the whole of the route.');
  await sheet.locator('form button[type="submit"]').click();
  await expect
    .poll(async () => (await owner.card<{ status: string }>(key)).status, { timeout: 10_000 })
    .toBe('decided');
  const card = await owner.card<{
    detail: { chosenOptionId: string; options: { id: string; title: string }[] };
  }>(key);
  const chosen = card.detail.options.find((option) => option.id === card.detail.chosenOptionId);
  expect(chosen?.title).toBe('Option 6');
});

test('an Arabic body that opens with an English word reads right to left, with 5xx whole', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  const { key } = await lead(owner, locale, 'direction', [{ title: 'A' }, { title: 'B' }]);
  await owner.context.patch(`/api/v1/workspaces/${ws}/cards/${key}`, {
    data: {
      body: 'Sentry لا يرى أخطاء 5xx عندما يتجاوز الملف 100 MB في طلب واحد.\n\nIt ends with a full stop.',
    },
    headers: { 'X-Requested-With': 'hub' },
  });
  await page.goto(view(locale, ws, 'decisions', `card=${key}`));
  const first = page.locator('[data-card-sheet] [role="tabpanel"] p', { hasText: 'Sentry' }).first();
  await first.waitFor({ timeout: 30_000 });
  expect(await first.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
  const order = await first.locator('bdi', { hasText: '5xx' }).evaluate((el) => {
    const text = el.firstChild as Text;
    const at = (i: number) => {
      const range = document.createRange();
      range.setStart(text, i);
      range.setEnd(text, i + 1);
      return range.getBoundingClientRect().left;
    };
    return [at(0), at(1), at(2)];
  });
  expect(order[0]).toBeLessThan(order[1] as number);
  expect(order[1]).toBeLessThan(order[2] as number);
  const english = page.locator('[data-card-sheet] [role="tabpanel"] p', { hasText: 'It ends with' });
  expect(await english.evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
});

test('Arabic on the English UI renders in Cairo, by what the renderer reports', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  test.skip(locale !== 'en', 'A check of the English UI.');
  const title = `مهمة باللغة العربية لفحص الخط ${Date.now()}`;
  const { key } = await owner.create({ type: 'task', title, detail: { specialty: 'backend' } });
  // The list's table form needs the page's whole width.
  await page.addInitScript(() => localStorage.setItem('hub-panel:open', 'false'));
  await page.goto(view(locale, ws, 'tasks', 'view=list'));
  const cell = page.locator(`#task-${key}`);
  await cell.waitFor({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `#task-${key}` });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  const families = fonts.map((font) => font.familyName);
  expect(families.some((family) => family.startsWith('Cairo'))).toBe(true);
  expect(families).not.toContain('Arial');
});

test('a 404 inside a project does not claim to be Today, and its action goes to the project', async ({
  page,
  locale,
  ws,
}) => {
  const shell = words(locale, 'shell');
  await page.goto(`/${locale}/${ws}/nosuchview`);
  await expect(page.getByRole('heading', { level: 1 }).or(page.getByRole('alert')).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('aside nav a[aria-current="page"]')).toHaveCount(0);
  const crumb = page.locator('header nav [aria-current="page"]');
  await expect(crumb).toHaveText(word(shell, 'boundary.notFoundTitle'));
  await page.getByRole('link', { name: word(shell, 'boundary.toToday') }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/${ws}/today`));
});

test('sheet headings follow the title without skipping a level', async ({ page, owner, locale, ws }) => {
  const { key } = await lead(owner, locale, 'headings', [{ title: 'A' }, { title: 'B' }]);
  await page.goto(view(locale, ws, 'decisions', `card=${key}`));
  const heading = page
    .locator('[data-card-sheet] [role="tabpanel"]')
    .getByRole('heading', { name: 'Summary' });
  await heading.waitFor({ timeout: 30_000 });
  expect(await heading.evaluate((el) => el.tagName)).toBe('H3');
});
