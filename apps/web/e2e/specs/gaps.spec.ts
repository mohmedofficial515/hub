/**
 * @file Things a page must get right that earlier walks found wrong: an inbox row follows a live edit in the page's own language, a release lists what it
 * includes however old, and its notes say when a template wrote them.
 */
import { expect, keyIn, mcp, test, view, waitForLive, word, words } from '../support/hub';
import { shared } from '../support/state';

test('an inbox row says its title in the page language, from the live card, within a second', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  const claude = await mcp(ws, shared().people['backend']?.token);
  try {
    const title = `Watched ${locale} ${Date.now()}`;
    const key = keyIn(await claude.call('create_task', { title, specialty: 'backend', acceptance: 'x' }), ws);
    await owner.post(`workspaces/${ws}/cards/${key}/watch`);
    await claude.call('update_task', { key, body: 'First change' });

    await page.goto(view(locale, ws, 'inbox'));
    await waitForLive(page);
    const titles = words(locale, 'inbox');
    const sentence = word(titles, 'row.titles.watch_update').replace('{title}', title);
    await expect(page.getByText(sentence).first()).toBeVisible();

    const edited = `${title} edited`;
    const started = Date.now();
    await claude.call('update_task', { key, title: edited });
    await page
      .getByText(word(titles, 'row.titles.watch_update').replace('{title}', edited))
      .first()
      .waitFor({ timeout: 10_000 });
    expect(Date.now() - started).toBeLessThanOrEqual(1000);
  } finally {
    await claude.close();
  }
});

test('a release lists what it includes, and its notes name the template', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  const claude = await mcp(ws);
  try {
    const task = await owner.create({
      type: 'task',
      title: `Shipped long ago ${locale} ${Date.now()}`,
      detail: { specialty: 'backend', acceptance: 'x' },
    });
    const made = await claude.call('create_release', {
      title: `Release ${locale} ${Date.now()}`,
      version: `1.0.${Date.now() % 1000}`,
      includedKeys: [task.key],
    });
    const key = keyIn(made, ws);
    await claude.call('update_release', { key, generateNotes: true });

    await page.goto(view(locale, ws, 'releases', `card=${key}`));
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText(task.key).first()).toBeVisible();
    await expect(sheet.getByText(word(words(locale, 'kit'), 'sections.release.templateName'))).toBeVisible();
  } finally {
    await claude.close();
  }
});
