/**
 * @file The five critical flows of docs/11 §1.5, through the real page in each language. The scope of docs/15 §3 applies: no GitHub, so F3 ends on
 * `drafted` with no pull request, and F5 reads a local lab in place of an iframe gallery.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { exact, expect, keyIn, type Locale, mcp, test, view, word, words } from '../support/hub';
import { shared } from '../support/state';

const kit = (locale: Locale) => words(locale, 'kit');
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

test.describe('critical flows', () => {
  test('F1 sign-in via invite', async ({ browser, owner, locale, ws }) => {
    const email = `joiner-${locale}-${Date.now()}@e2e.test`;
    const invite = await owner.post<{ url: string }>(`workspaces/${ws}/invites`, {
      email,
      roles: ['frontend', 'qa'],
    });
    const token = invite.url.slice(invite.url.lastIndexOf('/') + 1);
    const auth = words(locale, 'auth');
    const roles = kit(locale)['roles'] as Record<string, string>;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`/${locale}/invite/${token}`);
    // The roles were set in advance, and the invitation names them.
    await expect(page.getByText(roles['frontend'] ?? '').first()).toBeVisible();
    await expect(page.getByText(roles['qa'] ?? '').first()).toBeVisible();

    await page.getByLabel(word(auth, 'invite.name')).fill('Joiner');
    await page.getByLabel(word(auth, 'password.new'), { exact: false }).first().fill('Joiner-pass-e2e-12345');
    await page.getByLabel(word(auth, 'password.confirm')).fill('Joiner-pass-e2e-12345');
    await page.getByRole('button', { name: word(auth, 'invite.submit') }).click();

    await page.waitForURL(new RegExp(`/${ws}/onboarding`), { timeout: 30_000 });
    await expect(page.locator('h1').first()).toBeVisible();
    const cookies = await context.cookies();
    expect(cookies.some((cookie) => cookie.httpOnly)).toBe(true);

    const audit = await owner.get<{ items?: { action: string }[] } | { action: string }[]>(
      `workspaces/${ws}/audit?action=identity.invite.accept&limit=20`,
    );
    const rows = Array.isArray(audit) ? audit : (audit.items ?? []);
    expect(rows.some((row) => row.action === 'identity.invite.accept')).toBe(true);
    await context.close();
  });

  test('F2 claim a task', async ({ owner, member, locale, ws }) => {
    const backend = await member('backend');
    const creator = shared().people['frontend']?.id;
    const made = await member('frontend');
    const title = `F2 task ${locale} ${Date.now()}`;
    const { key } = await made.rest.create({
      type: 'task',
      title,
      detail: { specialty: 'backend', acceptance: 'It works' },
    });

    const { page } = backend;
    await page.goto(view(locale, ws, 'tasks'));
    const row = page.locator(`[data-row="${key}"]`).first();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: word(kit(locale), 'actions.claim') }).click();

    await expect
      .poll(async () => (await owner.card<{ status: string }>(key)).status, { timeout: 5000 })
      .toBe('claimed');
    const card = await owner.card<{ assignee?: { id: string } | null }>(key);
    expect(card.assignee?.id).toBe(shared().people['backend']?.id);

    await page.goto(view(locale, ws, 'tasks', `card=${key}`));
    await expect(page.getByRole('dialog').getByText('backend', { exact: false }).first()).toBeVisible();

    const events = await owner.get<{ items: { kind: string }[] }>(`workspaces/${ws}/cards/${key}/events`);
    expect(events.items.map((event) => event.kind)).toContain('claimed');

    // The creator hears about it in their inbox.
    const inbox = await made.rest.get<{ items: { data: { cardKey?: string } }[] }>(
      `workspaces/${ws}/inbox?limit=50`,
    );
    expect(inbox.items.some((item) => item.data.cardKey === key)).toBe(true);
    expect(creator).toBeTruthy();
  });

  test('F3 decide a decision and see the ADR status', async ({ page, owner, locale, ws }) => {
    const title = `F3 decision ${locale} ${Date.now()}`;
    const { key } = await owner.create({
      type: 'decision',
      title,
      dueAt: new Date(Date.now() - 3_600_000).toISOString(),
      detail: {
        kind: 'product',
        question: 'Which option?',
        deciderRole: 'owner',
        options: [
          { id: 'a', title: 'Option A' },
          { id: 'b', title: 'Option B' },
        ],
      },
    });
    const task = await owner.create({
      type: 'task',
      title: `Blocked by ${key}`,
      detail: { specialty: 'backend', acceptance: 'x' },
      links: [{ kind: 'blocked_by', key }],
    });

    const decisions = words(locale, 'decisions');
    await page.goto(view(locale, ws, 'decisions'));
    await expect(page.getByText(word(decisions, 'bands.overdue')).first()).toBeVisible();
    await page.goto(view(locale, ws, 'decisions', `card=${key}&action=decide`));
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('radio').nth(1).click();
    await sheet.getByRole('textbox').first().fill('Option B is simpler and costs less to keep.');
    await sheet.getByRole('button', { name: word(kit(locale), 'sheet.decision.save') }).click();

    await expect
      .poll(async () => (await owner.card<{ status: string }>(key)).status, { timeout: 5000 })
      .toBe('decided');

    const blocked = await owner.card<{ flags?: { blocked?: boolean } }>(task.key);
    expect(blocked.flags?.blocked ?? false).toBe(false);
    const events = await owner.get<{ items: { kind: string }[] }>(
      `workspaces/${ws}/cards/${task.key}/events`,
    );
    expect(events.items.map((event) => event.kind)).toContain('unblocked');

    const before = await owner.card<{ detail: { adrStatus: string } }>(key);
    expect(before.detail.adrStatus).toBe('none');
    await owner.post(`workspaces/${ws}/decisions/${key}/draft-adr`, { body: '# ADR\n\nOption B.' });
    const after = await owner.card<{ detail: { adrStatus: string } }>(key);
    expect(after.detail.adrStatus).toBe('drafted');
  });

  test('F4 deliver a need, refuse a pasted secret, verify as the accountant', async ({
    page,
    owner,
    member,
    locale,
    ws,
  }) => {
    const title = `F4 need ${locale} ${Date.now()}`;
    const { key } = await owner.create({
      type: 'need',
      title,
      detail: { kind: 'token', responsibleRole: 'owner' },
    });
    await owner.post(`workspaces/${ws}/needs/${key}/start`);

    await page.goto(view(locale, ws, 'needs', `card=${key}&action=deliver`));
    const sheet = page.getByRole('dialog');
    const need = kit(locale);
    const location = sheet.getByLabel(word(need, 'sheet.need.location'));
    const save = sheet.getByRole('button', { name: word(need, 'sheet.need.saveDeliver') });

    await location.fill(JWT);
    await save.click();
    await expect(sheet.getByRole('alert').first()).toBeVisible();
    expect((await owner.card<{ status: string }>(key)).status).toBe('in_progress');

    await location.fill('1Password › Goteav › F4');
    await save.click();
    await expect
      .poll(async () => (await owner.card<{ status: string }>(key)).status, { timeout: 5000 })
      .toBe('delivered');

    // The API's own filter is the authority, whatever the form did.
    const refused = await owner.context.post(`/api/v1/workspaces/${ws}/needs/${key}/verify`, {
      data: { note: JWT },
      headers: { 'X-Requested-With': 'hub' },
    });
    expect(refused.status()).toBe(400);

    const accountant = await member('accountant');
    await accountant.page.goto(view(locale, ws, 'needs', `card=${key}&action=verify`));
    const theirs = accountant.page.getByRole('dialog');
    await theirs.getByRole('button', { name: word(need, 'sheet.need.saveVerify') }).click();
    await expect
      .poll(async () => (await owner.card<{ status: string }>(key)).status, { timeout: 5000 })
      .toBe('verified');
  });

  test('F5 approve a redesign', async ({ page, owner, locale, ws }) => {
    const labRoot = shared().labRoot;
    const claude = await mcp(ws);
    try {
      await claude.call('add_source', {
        kind: 'local_path',
        name: 'lab',
        config: { path: join(labRoot, 'web', '..'), purpose: 'lab' },
      });
    } catch (error) {
      // The other language's run may have added it; a duplicate is fine.
      if (!String(error).match(/conflict|exists|already/i)) throw error;
    }
    const sources = await owner.get<{ id: string; name: string }[]>(`workspaces/${ws}/sources`);
    const lab = sources.find((source) => source.name === 'lab');
    if (!lab) throw new Error('No lab source');
    await owner.post(`workspaces/${ws}/sources/${lab.id}/run`);

    const listed = await expect
      .poll(
        async () => {
          const page2 = await owner.get<{ items: { key: string; title: string; status: string }[] }>(
            `workspaces/${ws}/cards?type=redesign&limit=50`,
          );
          return page2.items.filter((card) => card.title.includes(`wallet-${locale}`)).length;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThanOrEqual(2);
    expect(listed).toBeUndefined();

    const cards = await owner.get<{ items: { key: string; title: string; status: string }[] }>(
      `workspaces/${ws}/cards?type=redesign&limit=50`,
    );
    const version = cards.items.find((card) => card.title.includes(`wallet-${locale} · v2`));
    const baseline = cards.items.find((card) => card.title.includes(`wallet-${locale} · v1-baseline`));
    if (!version || !baseline) throw new Error(`Lab cards: ${JSON.stringify(cards.items)}`);
    expect(baseline.status).toBe('reference');
    expect(version.status).toBe('review');

    await page.goto(view(locale, ws, 'redesign'));
    await expect(page.locator(`[data-row="${version.key}"]`).first()).toBeVisible();
    await page.goto(view(locale, ws, 'redesign', `card=${version.key}&action=approve`));
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: word(kit(locale), 'sheet.redesign.saveApprove') }).click();
    await expect
      .poll(async () => (await owner.card<{ status: string }>(version.key)).status, { timeout: 5000 })
      .toBe('approved');

    const readme = readFileSync(
      join(labRoot, 'web', `wallet-${locale}`, 'v2-flight-path', 'README.md'),
      'utf8',
    );
    expect(readme).toMatch(/^status: approved/m);

    const tasks = await owner.get<{ items: { key: string; title: string; status: string }[] }>(
      `workspaces/${ws}/cards?type=task&q=${encodeURIComponent('wallet')}&limit=50`,
    );
    const port = tasks.items.find((card) => card.title.includes(`wallet-${locale}`));
    if (!port) throw new Error(`No port task: ${JSON.stringify(tasks.items)}`);
    expect(port.status).toBe('ready');
    const portCard = await owner.card<{ detail: { specialty: string; origin: string } }>(port.key);
    expect(portCard.detail.specialty).toBe('frontend');
    expect(keyIn(port.key, ws)).toBe(port.key);
    expect(exact('x').test('x')).toBe(true);
  });
});
